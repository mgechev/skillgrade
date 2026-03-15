---
phase: 06-ci-integration
plan: 01
subsystem: infra
tags: [github-actions, ollama, ci, modelfile, composite-action]

# Dependency graph
requires:
  - phase: 04-ollama-agent
    provides: Ollama agent model configuration and Modelfile patterns
  - phase: 05-opencode-agent
    provides: OpenCode agent model and Modelfile patterns
provides:
  - Multi-model setup-ollama composite action with YAML list input
  - CI Modelfile for opencode agent (3 threads)
  - OLLAMA_MAX_LOADED_MODELS=1 in CI environment
  - All workflow callers migrated to new models input format
affects: [06-02, 06-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [YAML list parsing in composite actions via temp-file and case matching, sha256sum cache key hashing]

key-files:
  created:
    - modelfiles/qwen3-4b-skill-eval-opencode-agent.ci.Modelfile
  modified:
    - .github/actions/setup-ollama/action.yml
    - .github/workflows/skill-eval.yml
    - .github/workflows/ci.yml
    - .github/workflows/benchmark-grader.yml

key-decisions:
  - "Kept benchmark-grader.yml using ai-action/setup-ollama@v2 directly due to multi-profile restart pattern"
  - "Used temp-file approach for YAML parsing to avoid subshell variable scoping issues"

patterns-established:
  - "setup-ollama models input: YAML list with name/modelfile/as fields, parsed via shell case matching"
  - "Cache key: sha256sum hash of full models input string"

requirements-completed: [CI-01, CI-04]

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 6 Plan 1: Multi-Model Setup-Ollama Summary

**Extended setup-ollama composite action with YAML list input for multi-model pull/create, OLLAMA_MAX_LOADED_MODELS=1, and CI Modelfile for opencode agent**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-14T23:57:44Z
- **Completed:** 2026-03-14T23:59:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Replaced single `model` input with `models` YAML list supporting name, modelfile, and as fields
- Added OLLAMA_MAX_LOADED_MODELS=1 to prevent OOM from concurrent model loading in CI
- Created CI Modelfile for opencode agent with num_thread 3 (matching existing ollama agent CI pattern)
- Migrated skill-eval.yml and ci.yml to new models input format
- Documented benchmark-grader.yml exception for direct ai-action/setup-ollama@v2 usage

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CI Modelfile and extend setup-ollama with multi-model YAML input** - `d52aec9` (feat)
2. **Task 2: Migrate all workflow callers to new setup-ollama models input** - `a976045` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `modelfiles/qwen3-4b-skill-eval-opencode-agent.ci.Modelfile` - CI Modelfile for opencode agent (3 threads)
- `.github/actions/setup-ollama/action.yml` - Multi-model composite action with YAML list parsing
- `.github/workflows/skill-eval.yml` - Both eval jobs pass qwen2.5:3b and qwen3:4b models
- `.github/workflows/ci.yml` - Integration test job passes qwen2.5:3b model
- `.github/workflows/benchmark-grader.yml` - Added comment documenting direct setup-ollama@v2 usage

## Decisions Made
- Kept benchmark-grader.yml using ai-action/setup-ollama@v2 directly -- its multi-profile restart pattern (default vs optimized Ollama configs) and dynamic comma-separated model input conflict with the composite action's single-start approach
- Used temp-file approach for YAML parsing (write to /tmp/models.yml, read with redirect) to avoid subshell variable scoping issues with piped while-read loops

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- setup-ollama action ready for use by Plan 02 (setup-opencode) and Plan 03 (agent-eval matrix)
- All existing workflow callers migrated and validated (YAML syntax checked)
- benchmark-grader.yml documented as intentional exception

## Self-Check: PASSED

All 6 files verified present. Both task commits (d52aec9, a976045) found in git log.

---
*Phase: 06-ci-integration*
*Completed: 2026-03-15*
