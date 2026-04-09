export const FIT_STATUSES = [
  "unreviewed",
  "filtered_out",
  "passed",
  "matched",
  "low_fit",
  "evaluation_failed",
] as const;

export const WORKFLOW_STATUSES = [
  "idle",
  "detail_pending",
  "detail_ready",
  "generating",
  "draft_ready",
  "generation_failed",
] as const;

export const APPLICATION_STATUSES = [
  "not_started",
  "applied",
  "hold",
  "withdrawn",
  "closed",
] as const;

export type FitStatus = (typeof FIT_STATUSES)[number];
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

type StatusFilterAxis =
  | { column: "fit_status"; value: FitStatus }
  | { column: "workflow_status"; value: WorkflowStatus }
  | { column: "application_status"; value: ApplicationStatus };

export interface ResolvedJobStatuses {
  fit_status: FitStatus;
  workflow_status: WorkflowStatus;
  application_status: ApplicationStatus;
  status: string;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isFitStatus(value: string): value is FitStatus {
  return (FIT_STATUSES as readonly string[]).includes(value);
}

function isWorkflowStatus(value: string): value is WorkflowStatus {
  return (WORKFLOW_STATUSES as readonly string[]).includes(value);
}

function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}

function applyLegacyStatusAlias(
  target: Record<string, unknown>,
  status: string
): boolean {
  if (isFitStatus(status)) {
    target.fit_status = status;
    return true;
  }

  if (isWorkflowStatus(status)) {
    target.workflow_status = status;
    return true;
  }

  if (isApplicationStatus(status)) {
    target.application_status = status;
    return true;
  }

  return false;
}

function deriveFitStatusFromLegacy(job: Record<string, unknown>): FitStatus {
  const legacyStatus = asNonEmptyString(job.status);
  const fitScore =
    typeof job.fit_score === "number"
      ? job.fit_score
      : Number.parseFloat(String(job.fit_score ?? ""));

  if (!legacyStatus || legacyStatus === "collected") {
    if (Number.isFinite(fitScore)) {
      if (fitScore >= 3.5) {
        return "matched";
      }

      if (fitScore > 0) {
        return "low_fit";
      }
    }

    return "unreviewed";
  }

  if (
    legacyStatus &&
    ["filtered_out", "passed", "matched", "low_fit"].includes(legacyStatus)
  ) {
    return legacyStatus as FitStatus;
  }

  if (Number.isFinite(fitScore)) {
    if (fitScore >= 3.5) {
      return "matched";
    }

    if (fitScore > 0) {
      return "low_fit";
    }
  }

  return "passed";
}

function deriveWorkflowStatusFromLegacy(
  job: Record<string, unknown>
): WorkflowStatus {
  const legacyStatus = asNonEmptyString(job.status);

  if (legacyStatus === "draft_ready") {
    return "draft_ready";
  }

  const detailStatus = asNonEmptyString(job.detail_status);

  if (detailStatus === "ready") {
    return "detail_ready";
  }

  if (detailStatus === "missing" || detailStatus === "failed") {
    return "detail_pending";
  }

  return "idle";
}

function deriveApplicationStatusFromLegacy(
  job: Record<string, unknown>
): ApplicationStatus {
  const legacyStatus = asNonEmptyString(job.status);

  if (
    legacyStatus &&
    ["applied", "hold", "withdrawn", "closed"].includes(legacyStatus)
  ) {
    return legacyStatus as ApplicationStatus;
  }

  return "not_started";
}

export function getFitStatus(job: Record<string, unknown>): FitStatus {
  const fitStatus = asNonEmptyString(job.fit_status);
  const derivedStatus = deriveFitStatusFromLegacy(job);

  if (!fitStatus || !isFitStatus(fitStatus)) {
    return derivedStatus;
  }

  return fitStatus === "unreviewed" ? derivedStatus : fitStatus;
}

export function getWorkflowStatus(job: Record<string, unknown>): WorkflowStatus {
  const workflowStatus = asNonEmptyString(job.workflow_status);
  const derivedStatus = deriveWorkflowStatusFromLegacy(job);

  if (!workflowStatus || !isWorkflowStatus(workflowStatus)) {
    return derivedStatus;
  }

  return workflowStatus === "idle" ? derivedStatus : workflowStatus;
}

export function getApplicationStatus(
  job: Record<string, unknown>
): ApplicationStatus {
  const applicationStatus = asNonEmptyString(job.application_status);
  const derivedStatus = deriveApplicationStatusFromLegacy(job);

  if (!applicationStatus || !isApplicationStatus(applicationStatus)) {
    return derivedStatus;
  }

  return applicationStatus === "not_started" ? derivedStatus : applicationStatus;
}

export function getDisplayStatus(job: Record<string, unknown>): string {
  const applicationStatus = getApplicationStatus(job);

  if (applicationStatus !== "not_started") {
    return applicationStatus;
  }

  const workflowStatus = getWorkflowStatus(job);

  if (workflowStatus === "draft_ready") {
    return workflowStatus;
  }

  return getFitStatus(job);
}

export function resolveJobStatuses(
  job: Record<string, unknown>
): ResolvedJobStatuses {
  const fitStatus = getFitStatus(job);
  const workflowStatus = getWorkflowStatus(job);
  const applicationStatus = getApplicationStatus(job);

  return {
    fit_status: fitStatus,
    workflow_status: workflowStatus,
    application_status: applicationStatus,
    status: getDisplayStatus({
      ...job,
      fit_status: fitStatus,
      workflow_status: workflowStatus,
      application_status: applicationStatus,
    }),
  };
}

export function mapLegacyStatusFilter(status: string): StatusFilterAxis | null {
  if (isFitStatus(status)) {
    return { column: "fit_status", value: status };
  }

  if (isWorkflowStatus(status)) {
    return { column: "workflow_status", value: status };
  }

  if (isApplicationStatus(status)) {
    return { column: "application_status", value: status };
  }

  return null;
}

export function resolveStatusUpdate(
  currentJob: Record<string, unknown>,
  updates: {
    status?: unknown;
    fit_status?: unknown;
    workflow_status?: unknown;
    application_status?: unknown;
  }
): ResolvedJobStatuses | null {
  const nextJob: Record<string, unknown> = { ...currentJob };

  if (updates.status !== undefined) {
    const status = asNonEmptyString(updates.status);

    if (!status || !applyLegacyStatusAlias(nextJob, status)) {
      return null;
    }
  }

  if (updates.fit_status !== undefined) {
    const fitStatus = asNonEmptyString(updates.fit_status);

    if (!fitStatus || !isFitStatus(fitStatus)) {
      return null;
    }

    nextJob.fit_status = fitStatus;
  }

  if (updates.workflow_status !== undefined) {
    const workflowStatus = asNonEmptyString(updates.workflow_status);

    if (!workflowStatus || !isWorkflowStatus(workflowStatus)) {
      return null;
    }

    nextJob.workflow_status = workflowStatus;
  }

  if (updates.application_status !== undefined) {
    const applicationStatus = asNonEmptyString(updates.application_status);

    if (!applicationStatus || !isApplicationStatus(applicationStatus)) {
      return null;
    }

    nextJob.application_status = applicationStatus;
  }

  return resolveJobStatuses(nextJob);
}

export function applyResolvedStatuses<T extends Record<string, unknown>>(job: T) {
  const resolved = resolveJobStatuses(job);

  return {
    ...job,
    ...resolved,
  };
}
