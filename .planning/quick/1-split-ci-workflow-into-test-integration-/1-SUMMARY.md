---
phase: quick
plan: 1
subsystem: infra
tags: [github-actions, ci, testing]

# Dependency graph
requires:
  - phase: 01-ci-foundation
    provides: CI workflow with individual test jobs
  - phase: 02-local-llm-grader
    provides: ollama-grader and local-provider test jobs
provides:
  - Consolidated CI workflow with test-integration and test-unit jobs
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CI test jobs grouped by type: integration (e2e pipeline) vs unit"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "Group test:bootstrap as integration (exercises full eval pipeline) and analytics/ollama-grader/local-provider as unit"
  - "Run unit tests sequentially in single job to reduce runner overhead"

patterns-established:
  - "Integration tests run in dedicated job; unit tests consolidated in one job"

requirements-completed: [CI-SPLIT]

# Metrics
duration: 1min
completed: 2026-03-09
---

# Quick Plan 1: Split CI Workflow into test-integration and test-unit Summary

**Consolidated 6 CI jobs down to 4 by merging 4 individual test jobs into 2 semantically grouped jobs (integration vs unit)**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-09T07:01:44Z
- **Completed:** 2026-03-09T07:02:35Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Renamed test-bootstrap to test-integration (reflects e2e/integration nature of bootstrap tests)
- Consolidated test-analytics, test-ollama-grader, and test-local-provider into a single test-unit job
- Reduced CI runner overhead from 6 parallel jobs to 4

## Task Commits

Each task was committed atomically:

1. **Task 1: Consolidate CI test jobs into test-integration and test-unit** - `5e643ce` (feat)

## Files Created/Modified
- `.github/workflows/ci.yml` - Consolidated 4 test jobs into 2 (test-integration, test-unit)

## Decisions Made
- Grouped test:bootstrap as integration (exercises full eval pipeline end-to-end) and the remaining three test scripts as unit tests
- Unit tests run sequentially in a single multi-line run block to reduce runner overhead while preserving all test coverage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CI workflow is ready for use on push/PR triggers
- No blockers

---
*Phase: quick*
*Completed: 2026-03-09*
