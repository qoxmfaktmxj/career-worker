import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Database from "better-sqlite3";

const JOB_FILE_COLUMNS = [
  "listing_file",
  "detail_file",
  "raw_file",
  "normalized_file",
];

const UNIQUE_INDEX_DEFINITIONS = [
  {
    name: "idx_jobs_raw_url_unique",
    createSql: `
      CREATE UNIQUE INDEX idx_jobs_raw_url_unique
      ON jobs(raw_url)
      WHERE raw_url IS NOT NULL AND raw_url != ''
    `,
    duplicateSql: `
      SELECT raw_url, COUNT(*) AS duplicate_count
      FROM jobs
      WHERE raw_url IS NOT NULL AND raw_url != ''
      GROUP BY raw_url
      HAVING COUNT(*) > 1
      LIMIT 1
    `,
  },
  {
    name: "idx_jobs_source_source_id_unique",
    createSql: `
      CREATE UNIQUE INDEX idx_jobs_source_source_id_unique
      ON jobs(source, source_id)
      WHERE source_id IS NOT NULL AND source_id != '' AND source != 'manual'
    `,
    duplicateSql: `
      SELECT source, source_id, COUNT(*) AS duplicate_count
      FROM jobs
      WHERE source_id IS NOT NULL AND source_id != '' AND source != 'manual'
      GROUP BY source, source_id
      HAVING COUNT(*) > 1
      LIMIT 1
    `,
  },
];

const MERGEABLE_FIELDS = [
  "source_id",
  "raw_url",
  "location",
  "employment_type",
  "company_size",
  "employee_count",
  "deadline",
  "deadline_text",
  "deadline_date",
  "salary_text",
  "fit_score",
  "fit_reason",
  "risks",
  "recommended_stories",
  "questions_detected",
  "listing_file",
  "detail_file",
  "detail_collected_at",
  "raw_file",
  "normalized_file",
  "filter_reason",
  "memo",
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function hasValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0) && (!Object.is(value, "") || typeof value !== "string");
}

function isMissingValue(value) {
  if (typeof value === "string") {
    return value.trim() === "";
  }

  return value === null || value === undefined;
}

function compareNullableText(left, right) {
  if (isNonEmptyString(left) && isNonEmptyString(right)) {
    return left.localeCompare(right);
  }

  if (isNonEmptyString(left)) {
    return -1;
  }

  if (isNonEmptyString(right)) {
    return 1;
  }

  return 0;
}

function detailStatusRank(status) {
  switch (status) {
    case "ready":
      return 3;
    case "failed":
      return 2;
    case "missing":
    default:
      return 1;
  }
}

function richnessScore(row) {
  let score = 0;

  score += row.output_count * 20;
  score += row.fingerprint_count * 5;
  score += detailStatusRank(row.detail_status) * 40;
  score += isNonEmptyString(row.detail_file) ? 20 : 0;
  score += isNonEmptyString(row.listing_file) ? 10 : 0;
  score += isNonEmptyString(row.raw_file) ? 10 : 0;
  score += isNonEmptyString(row.normalized_file) ? 20 : 0;
  score += hasValue(row.fit_score) ? 10 : 0;
  score += isNonEmptyString(row.fit_reason) ? 10 : 0;
  score += isNonEmptyString(row.risks) ? 10 : 0;
  score += isNonEmptyString(row.recommended_stories) ? 10 : 0;
  score += isNonEmptyString(row.questions_detected) ? 10 : 0;
  score += isNonEmptyString(row.memo) ? 5 : 0;

  if (row.fit_status && row.fit_status !== "unreviewed") {
    score += 5;
  }

  if (row.workflow_status && !["idle", "detail_pending"].includes(row.workflow_status)) {
    score += 5;
  }

  if (row.application_status && row.application_status !== "not_started") {
    score += 5;
  }

  return score;
}

function chooseSurvivor(rows) {
  return [...rows].sort((left, right) => {
    const scoreDiff = richnessScore(right) - richnessScore(left);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const createdDiff = compareNullableText(left.created_at, right.created_at);

    if (createdDiff !== 0) {
      return createdDiff;
    }

    return left.id - right.id;
  })[0];
}

function normalizeComponentRows(rows) {
  const survivor = chooseSurvivor(rows);
  const duplicates = rows.filter((row) => row.id !== survivor.id);

  return {
    survivor,
    duplicates,
  };
}

function groupDuplicateRows(rows, keyBuilder, type) {
  const groups = new Map();

  for (const row of rows) {
    const key = keyBuilder(row);

    if (!key) {
      continue;
    }

    const existing = groups.get(key) ?? [];
    existing.push(row.id);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({
      type,
      key,
      ids: [...new Set(ids)].sort((left, right) => left - right),
    }));
}

class UnionFind {
  constructor() {
    this.parents = new Map();
  }

  add(value) {
    if (!this.parents.has(value)) {
      this.parents.set(value, value);
    }
  }

  find(value) {
    const parent = this.parents.get(value);

    if (parent === value) {
      return value;
    }

    const root = this.find(parent);
    this.parents.set(value, root);
    return root;
  }

  union(left, right) {
    this.add(left);
    this.add(right);

    const leftRoot = this.find(left);
    const rightRoot = this.find(right);

    if (leftRoot !== rightRoot) {
      const nextRoot = Math.min(leftRoot, rightRoot);
      const childRoot = Math.max(leftRoot, rightRoot);
      this.parents.set(childRoot, nextRoot);
    }
  }
}

function fetchCandidateRows(database) {
  const rawUrlRows = database
    .prepare(
      `
        SELECT id, raw_url
        FROM jobs
        WHERE raw_url IS NOT NULL AND raw_url != ''
        ORDER BY raw_url ASC, id ASC
      `
    )
    .all();
  const sourceRows = database
    .prepare(
      `
        SELECT id, source, source_id
        FROM jobs
        WHERE source_id IS NOT NULL AND source_id != '' AND source != 'manual'
        ORDER BY source ASC, source_id ASC, id ASC
      `
    )
    .all();

  return [
    ...groupDuplicateRows(rawUrlRows, (row) => row.raw_url, "raw_url"),
    ...groupDuplicateRows(
      sourceRows,
      (row) => `${row.source}\u0000${row.source_id}`,
      "source_source_id"
    ),
  ];
}

function fetchJobsByIds(database, ids) {
  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => "?").join(", ");

  return database
    .prepare(
      `
        SELECT
          j.id,
          j.job_id,
          j.source,
          j.source_id,
          j.company,
          j.position,
          j.location,
          j.employment_type,
          j.company_size,
          j.employee_count,
          j.raw_url,
          j.deadline,
          j.deadline_text,
          j.deadline_date,
          j.deadline_parse_status,
          j.salary_text,
          j.status,
          j.fit_status,
          j.workflow_status,
          j.application_status,
          j.fit_score,
          j.fit_reason,
          j.risks,
          j.recommended_stories,
          j.questions_detected,
          j.listing_file,
          j.detail_file,
          j.detail_collected_at,
          j.detail_status,
          j.raw_file,
          j.normalized_file,
          j.filter_reason,
          j.memo,
          j.created_at,
          j.updated_at,
          (
            SELECT COUNT(*)
            FROM outputs o
            WHERE o.job_id = j.job_id
          ) AS output_count,
          (
            SELECT COUNT(*)
            FROM job_fingerprints f
            WHERE f.job_id = j.job_id
          ) AS fingerprint_count
        FROM jobs j
        WHERE j.id IN (${placeholders})
      `
    )
    .all(...ids);
}

function decodeRelationKey(relation) {
  if (relation.type === "source_source_id") {
    const [source, sourceId] = relation.key.split("\u0000");
    return `${source}:${sourceId}`;
  }

  return relation.key;
}

export function inspectJobDuplicateMaintenance({ dbPath }) {
  const database = new Database(dbPath);

  try {
    const relations = fetchCandidateRows(database);

    if (relations.length === 0) {
      return {
        componentCount: 0,
        duplicateRowCount: 0,
        components: [],
      };
    }

    const unionFind = new UnionFind();

    for (const relation of relations) {
      const [firstId, ...restIds] = relation.ids;
      unionFind.add(firstId);

      for (const id of restIds) {
        unionFind.union(firstId, id);
      }
    }

    const allIds = [...new Set(relations.flatMap((relation) => relation.ids))];
    const rows = fetchJobsByIds(database, allIds);
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const componentsByRoot = new Map();

    for (const id of allIds) {
      const rootId = unionFind.find(id);
      const component = componentsByRoot.get(rootId) ?? {
        rows: [],
        relations: [],
      };
      const row = rowsById.get(id);

      if (row) {
        component.rows.push(row);
      }

      componentsByRoot.set(rootId, component);
    }

    for (const relation of relations) {
      const rootId = unionFind.find(relation.ids[0]);
      const component = componentsByRoot.get(rootId);

      if (!component) {
        continue;
      }

      component.relations.push({
        type: relation.type,
        key: decodeRelationKey(relation),
        ids: relation.ids,
      });
    }

    const components = [...componentsByRoot.values()]
      .map((component) => {
        const { survivor, duplicates } = normalizeComponentRows(component.rows);

        return {
          survivor,
          duplicates,
          relations: component.relations.sort((left, right) =>
            left.key.localeCompare(right.key)
          ),
        };
      })
      .sort((left, right) => left.survivor.id - right.survivor.id);

    return {
      componentCount: components.length,
      duplicateRowCount: components.reduce(
        (count, component) => count + component.duplicates.length,
        0
      ),
      components,
    };
  } finally {
    database.close();
  }
}

function buildMergedJobRecord(survivor, duplicates) {
  const merged = { ...survivor };

  for (const duplicate of duplicates) {
    for (const field of MERGEABLE_FIELDS) {
      if (isMissingValue(merged[field]) && hasValue(duplicate[field])) {
        merged[field] = duplicate[field];
      }
    }

    if (detailStatusRank(duplicate.detail_status) > detailStatusRank(merged.detail_status)) {
      merged.detail_status = duplicate.detail_status;
    }

    if (
      merged.status === "collected" &&
      isNonEmptyString(duplicate.status) &&
      duplicate.status !== "collected"
    ) {
      merged.status = duplicate.status;
    }

    if (
      merged.fit_status === "unreviewed" &&
      isNonEmptyString(duplicate.fit_status) &&
      duplicate.fit_status !== "unreviewed"
    ) {
      merged.fit_status = duplicate.fit_status;
    }

    if (
      ["idle", "detail_pending"].includes(merged.workflow_status) &&
      isNonEmptyString(duplicate.workflow_status) &&
      !["idle", "detail_pending"].includes(duplicate.workflow_status)
    ) {
      merged.workflow_status = duplicate.workflow_status;
    }

    if (
      merged.application_status === "not_started" &&
      isNonEmptyString(duplicate.application_status) &&
      duplicate.application_status !== "not_started"
    ) {
      merged.application_status = duplicate.application_status;
    }

    if (
      merged.deadline_parse_status === "missing" &&
      isNonEmptyString(duplicate.deadline_parse_status) &&
      duplicate.deadline_parse_status !== "missing"
    ) {
      merged.deadline_parse_status = duplicate.deadline_parse_status;
    }
  }

  return merged;
}

function updateSurvivorJob(database, original, merged) {
  const changedFields = [];
  const values = [];

  for (const field of [
    ...MERGEABLE_FIELDS,
    "detail_status",
    "status",
    "fit_status",
    "workflow_status",
    "application_status",
    "deadline_parse_status",
  ]) {
    if (original[field] === merged[field]) {
      continue;
    }

    changedFields.push(`${field} = ?`);
    values.push(merged[field]);
  }

  if (changedFields.length === 0) {
    return;
  }

  values.push(original.id);

  database
    .prepare(
      `
        UPDATE jobs
        SET ${changedFields.join(", ")},
            updated_at = datetime('now')
        WHERE id = ?
      `
    )
    .run(...values);
}

function moveOutputs(database, survivorJobId, duplicateJobIds) {
  if (duplicateJobIds.length === 0) {
    return { moved: 0, renumbered: 0 };
  }

  const placeholders = [survivorJobId, ...duplicateJobIds].map(() => "?").join(", ");
  const outputs = database
    .prepare(
      `
        SELECT id, job_id, type, language, version, created_at
        FROM outputs
        WHERE job_id IN (${placeholders})
        ORDER BY created_at ASC, id ASC
      `
    )
    .all(survivorJobId, ...duplicateJobIds);

  const maxVersions = new Map();

  for (const output of outputs) {
    if (output.job_id !== survivorJobId) {
      continue;
    }

    const key = `${output.type}\u0000${output.language}`;
    const currentMax = maxVersions.get(key) ?? 0;
    maxVersions.set(key, Math.max(currentMax, output.version));
  }

  let moved = 0;
  let renumbered = 0;
  const updateOutput = database.prepare(
    "UPDATE outputs SET job_id = ?, version = ? WHERE id = ?"
  );

  for (const output of outputs) {
    if (output.job_id === survivorJobId) {
      continue;
    }

    const key = `${output.type}\u0000${output.language}`;
    const nextVersion = (maxVersions.get(key) ?? 0) + 1;
    updateOutput.run(survivorJobId, nextVersion, output.id);
    maxVersions.set(key, nextVersion);
    moved += 1;

    if (nextVersion !== output.version) {
      renumbered += 1;
    }
  }

  return { moved, renumbered };
}

function moveFingerprints(database, survivorJobId, duplicateJobIds) {
  if (duplicateJobIds.length === 0) {
    return 0;
  }

  const placeholders = duplicateJobIds.map(() => "?").join(", ");
  const result = database
    .prepare(
      `
        UPDATE job_fingerprints
        SET job_id = ?
        WHERE job_id IN (${placeholders})
      `
    )
    .run(survivorJobId, ...duplicateJobIds);

  return result.changes;
}

function deleteDuplicateJobs(database, duplicateJobIds) {
  if (duplicateJobIds.length === 0) {
    return 0;
  }

  const placeholders = duplicateJobIds.map(() => "?").join(", ");
  const result = database
    .prepare(`DELETE FROM jobs WHERE job_id IN (${placeholders})`)
    .run(...duplicateJobIds);

  return result.changes;
}

function collectCandidateJobFiles(component) {
  const paths = new Set();

  for (const duplicate of component.duplicates) {
    for (const field of JOB_FILE_COLUMNS) {
      if (isNonEmptyString(duplicate[field])) {
        paths.add(duplicate[field]);
      }
    }
  }

  return paths;
}

function collectReferencedJobFiles(database) {
  const rows = database
    .prepare(
      `
        SELECT listing_file, detail_file, raw_file, normalized_file
        FROM jobs
      `
    )
    .all();
  const references = new Set();

  for (const row of rows) {
    for (const field of JOB_FILE_COLUMNS) {
      if (isNonEmptyString(row[field])) {
        references.add(row[field]);
      }
    }
  }

  return references;
}

function resolveJobFilePath(jobsDir, relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");

  if (/^normalized\/[^/]+\.json$/u.test(normalized)) {
    return path.join(jobsDir, "normalized", path.basename(normalized));
  }

  const [directory, fileName, ...rest] = normalized.split("/");

  if (!directory || !fileName || rest.length > 0 || !fileName.endsWith(".md")) {
    throw new Error(`Unsupported job file path: ${relativePath}`);
  }

  if (!["listings", "details", "raw"].includes(directory)) {
    throw new Error(`Unsupported job file path: ${relativePath}`);
  }

  return path.join(jobsDir, directory, path.basename(fileName));
}

function deleteUnreferencedJobFiles(jobsDir, candidatePaths, referencedPaths) {
  let deleted = 0;

  for (const relativePath of candidatePaths) {
    if (referencedPaths.has(relativePath)) {
      continue;
    }

    const absolutePath = resolveJobFilePath(jobsDir, relativePath);

    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    fs.unlinkSync(absolutePath);
    deleted += 1;
  }

  return deleted;
}

function assertNoDuplicateRows(database) {
  for (const definition of UNIQUE_INDEX_DEFINITIONS) {
    const duplicate = database.prepare(definition.duplicateSql).get();

    if (duplicate) {
      throw new Error(`Duplicate rows remain for ${definition.name}`);
    }
  }
}

function recreateUniqueIndexes(database) {
  assertNoDuplicateRows(database);

  const created = [];

  for (const definition of UNIQUE_INDEX_DEFINITIONS) {
    database.exec(`DROP INDEX IF EXISTS ${definition.name}`);
    database.exec(definition.createSql);
    created.push(definition.name);
  }

  return created;
}

export function applyJobDuplicateMaintenance({
  dbPath,
  jobsDir = path.join(process.cwd(), "jobs"),
}) {
  const analysis = inspectJobDuplicateMaintenance({ dbPath });
  const database = new Database(dbPath);

  try {
    const candidatePaths = new Set(
      analysis.components.flatMap((component) => [...collectCandidateJobFiles(component)])
    );

    const result = database.transaction(() => {
      let outputsMoved = 0;
      let outputsRenumbered = 0;
      let fingerprintsMoved = 0;
      let jobsDeleted = 0;

      for (const component of analysis.components) {
        const merged = buildMergedJobRecord(
          component.survivor,
          component.duplicates
        );

        updateSurvivorJob(database, component.survivor, merged);

        const duplicateJobIds = component.duplicates.map((job) => job.job_id);
        const outputSummary = moveOutputs(
          database,
          component.survivor.job_id,
          duplicateJobIds
        );

        outputsMoved += outputSummary.moved;
        outputsRenumbered += outputSummary.renumbered;
        fingerprintsMoved += moveFingerprints(
          database,
          component.survivor.job_id,
          duplicateJobIds
        );
        jobsDeleted += deleteDuplicateJobs(database, duplicateJobIds);
      }

      const indexesCreated = recreateUniqueIndexes(database);

      return {
        outputsMoved,
        outputsRenumbered,
        fingerprintsMoved,
        jobsDeleted,
        indexesCreated,
      };
    })();

    const referencedPaths = collectReferencedJobFiles(database);
    const filesDeleted = deleteUnreferencedJobFiles(
      jobsDir,
      candidatePaths,
      referencedPaths
    );

    return {
      componentCount: analysis.componentCount,
      duplicateRowCount: analysis.duplicateRowCount,
      components: analysis.components.map((component) => ({
        survivorJobId: component.survivor.job_id,
        duplicateJobIds: component.duplicates.map((job) => job.job_id),
        reasons: component.relations.map((relation) => ({
          type: relation.type,
          key: relation.key,
        })),
      })),
      filesDeleted,
      ...result,
    };
  } finally {
    database.close();
  }
}

function parseArgs(argv) {
  const options = {
    apply: false,
    json: false,
    dbPath: path.join(process.cwd(), "data", "career.db"),
    jobsDir: path.join(process.cwd(), "jobs"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--apply":
        options.apply = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--db":
        options.dbPath = path.resolve(argv[index + 1]);
        index += 1;
        break;
      case "--jobs-dir":
        options.jobsDir = path.resolve(argv[index + 1]);
        index += 1;
        break;
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHumanReadableAnalysis(analysis) {
  if (analysis.componentCount === 0) {
    console.log("No duplicate jobs found.");
    return;
  }

  console.log(`Duplicate components: ${analysis.componentCount}`);

  for (const component of analysis.components) {
    console.log(
      [
        `- survivor=${component.survivor.job_id}`,
        `duplicates=${component.duplicates.map((job) => job.job_id).join(",")}`,
        `reasons=${component.relations
          .map((relation) => `${relation.type}:${relation.key}`)
          .join(",")}`,
      ].join(" ")
    );
  }
}

function printHumanReadableResult(result) {
  console.log(`Duplicate components processed: ${result.componentCount}`);
  console.log(`Jobs deleted: ${result.jobsDeleted}`);
  console.log(`Outputs moved: ${result.outputsMoved}`);
  console.log(`Outputs renumbered: ${result.outputsRenumbered}`);
  console.log(`Fingerprints moved: ${result.fingerprintsMoved}`);
  console.log(`Job files deleted: ${result.filesDeleted}`);
  console.log(`Indexes recreated: ${result.indexesCreated.join(", ")}`);
}

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
      console.log(
        "Usage: node scripts/reconcile-job-duplicates.mjs [--apply] [--json] [--db <path>] [--jobs-dir <path>]"
      );
      process.exit(0);
    }

    if (options.apply) {
      const result = applyJobDuplicateMaintenance(options);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printHumanReadableResult(result);
      }
    } else {
      const analysis = inspectJobDuplicateMaintenance(options);

      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
      } else {
        printHumanReadableAnalysis(analysis);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
