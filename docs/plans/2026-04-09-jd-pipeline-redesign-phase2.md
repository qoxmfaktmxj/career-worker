# JD Pipeline Redesign Phase 2

Date: 2026-04-09
Basis: `docs/specs/2026-04-09-jd-pipeline-redesign.md`, previous `/plan-eng-review` findings

## Goal

Fix the two remaining data-model problems that still distort stats and workflow:

1. split the single `jobs.status` column into separate status axes
2. switch stats and list logic from `deadline` text to normalized `deadline_date`

Phase 2 keeps the legacy `status` column for compatibility, but stops using it as the source of truth.

## Status model

New source-of-truth columns on `jobs`:

- `fit_status`
  - `unreviewed`
  - `filtered_out`
  - `passed`
  - `matched`
  - `low_fit`
  - `evaluation_failed`
- `workflow_status`
  - `idle`
  - `detail_pending`
  - `detail_ready`
  - `generating`
  - `draft_ready`
  - `generation_failed`
- `application_status`
  - `not_started`
  - `applied`
  - `hold`
  - `withdrawn`
  - `closed`

Legacy `status` remains as a compatibility alias only.

## Migration rules

Backfill existing rows during schema migration:

- `fit_status`
  - `filtered_out`, `passed`, `matched`, `low_fit` map directly from legacy `status`
  - `draft_ready`, `applied`, `hold`, `withdrawn`, `closed` derive from `fit_score`
- `workflow_status`
  - `draft_ready` if legacy `status = 'draft_ready'`
  - `detail_ready` if `detail_status = 'ready'`
  - `detail_pending` if `detail_status in ('missing', 'failed')`
  - otherwise `idle`
- `application_status`
  - `applied`, `hold`, `withdrawn`, `closed` map from legacy `status`
  - otherwise `not_started`
- deadline fields
  - `deadline_text = deadline` when missing
  - `deadline_date = deadline` only when legacy value is ISO `YYYY-MM-DD`
  - `deadline_parse_status = parsed | invalid | missing`

## API changes

### GET `/api/jobs`

- filter by `fit_status`, `workflow_status`, `application_status`
- keep legacy `status` query support by mapping it to one of the new axes
- default list excludes `fit_status = 'filtered_out'`
- return:
  - the three new status columns
  - `deadline_text`
  - `deadline_date`
  - `status` as a computed display alias

### GET `/api/jobs/stats`

- `total`: jobs where `fit_status != 'filtered_out'`
- `new_jobs`: jobs where `fit_status = 'passed'`
- `matched`: jobs where `fit_status = 'matched'`
- `deadline_soon`: jobs where `application_status = 'not_started'` and `deadline_date` is within 3 days
- `expired`: jobs where `application_status not in ('applied', 'withdrawn', 'closed')` and `deadline_date < today`

### AI routes

Writers must update the split columns:

- evaluate:
  - update `fit_status`
- generate-*:
  - update `workflow_status = 'draft_ready'`
- manual/scanner inserts:
  - write all three status axes explicitly

## UI changes

- Jobs list and Dashboard should render the computed display status, not raw legacy `status`
- D-day should be based on `deadline_date`
- when `deadline_date` is absent, UI falls back to `deadline_text`
- fix mojibake in touched UI files while changing status/deadline presentation

## Verification

- unit/integration tests for migration backfill
- stats route tests using `deadline_date`
- jobs route tests for legacy status query mapping
- browser check:
  - dashboard stats
  - jobs list badges
  - matched job still visible after draft generation
