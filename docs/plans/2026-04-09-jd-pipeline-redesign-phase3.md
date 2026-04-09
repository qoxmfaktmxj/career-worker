# JD Pipeline Redesign Phase 3

Date: 2026-04-09
Basis: `docs/specs/2026-04-09-jd-pipeline-redesign.md`, previous `/plan-eng-review` findings

## Goal

Fix output persistence so repeated generation is safe and metadata stays aligned with files.

This phase addresses:

1. file overwrite on regenerate
2. `outputs.version` never incrementing
3. DB/file divergence during create, read, and delete

## Storage contract

Generated outputs remain under `OUTPUTS_DIR/<type_dir>/`, but file names must become unique:

- include UTC timestamp
- include `job_id`
- include output `type`
- include `v{version}`
- include language
- include random suffix

Example:

- `answer_packs/20260409T114530123Z_JOB-ABCD_answer_pack_v2_ko_a1b2c3.md`

## Versioning rules

- version scope is `(job_id, type)`
- next version is `MAX(version) + 1`
- language does not reset version
- each generated output row must store:
  - `file_path`
  - `language`
  - `version`

## Create flow

Generation routes must stop doing:

- raw file save
- manual `INSERT INTO outputs`
- separate `UPDATE jobs`

Instead they call one shared helper:

- compute next version inside a SQLite transaction
- write content through a temp file
- move temp file to final unique path
- insert output row with computed version
- update related job workflow state in the same transaction

Failure behavior:

- if file move fails, no DB row is inserted
- if DB write fails after file move, the final file is deleted before surfacing the error

## Read flow

`GET /api/outputs/:id` must distinguish:

- row missing -> `404`
- file missing but row exists -> `409 output_file_missing`

This makes DB/file divergence visible instead of throwing a generic 500.

## Delete flow

`DELETE /api/outputs/:id` must be resilient to divergence:

- row missing -> `404`
- if file exists, remove it
- always remove the DB row
- if file delete fails, preserve the DB row and return an error

## Verification

- unit test for unique file names on repeated save
- integration test for version increments on repeated generation
- route test for `GET /api/outputs/:id` when file is missing
- route test for deleting generated outputs without leaving stale DB rows
