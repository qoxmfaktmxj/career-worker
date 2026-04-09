# Changelog

All notable changes to this project will be documented in this file.

## 0.1.1.0 - 2026-04-08

### Added
- Added `scripts/next-runner.mjs` so `npm run dev -- --port <port>` and `npm start -- --port <port>` honor runtime port overrides.
- Added AI availability metadata on the job detail API so the UI can gate actions when `openclaw` is not installed.

### Changed
- Updated the job detail screen to show inline success and error feedback for AI actions instead of failing silently.
- Disabled answer generation until detected questions exist, and disabled recruiter reply generation until a message is entered.
- Allowed `127.0.0.1` as a dev origin for local testing on non-default ports.

### Fixed
- Fixed local dev and start scripts so custom ports work without breaking hydration on alternate localhost ports.
- Fixed the job detail page so missing `openclaw` installs do not surface as confusing 500-only failures.
