---
phase: quick-3
plan: 01
subsystem: infra
tags: [docker, caching, sha256, content-hash, performance]

# Dependency graph
requires:
  - phase: 02-local-llm-grader
    provides: DockerProvider with prepare/teardown lifecycle
provides:
  - Content-hash Docker image naming via computeContextHash
  - Cache-hit detection skipping docker.buildImage on unchanged files
  - Image persistence across runs for automatic reuse
affects: [docker-provider, eval-runner, ci-docker-tests]

# Tech tracking
tech-stack:
  added: [node:crypto createHash]
  patterns: [content-hash caching, deterministic image naming]

key-files:
  created:
    - tests/docker-cache.test.ts
  modified:
    - src/providers/docker.ts
    - package.json

key-decisions:
  - "8-char SHA-256 prefix for image tag (collision-safe for local use, short enough for readability)"
  - "Preserve images in teardown instead of deleting -- users run docker image prune for cleanup"
  - "Include skills paths in hash so skill changes trigger rebuilds"
  - "Sort file paths alphabetically before hashing for deterministic order across platforms"

patterns-established:
  - "Content-hash naming: skill-eval-{taskname}-{hash8} or skill-eval-{taskname}-{hash8}-ready"
  - "Cache-hit via docker.getImage(name).inspect() before buildImage"

requirements-completed: [TODO-01]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Quick Task 3: Content-Hash Docker Image Naming Summary

**SHA-256 content-hash Docker image naming with cache-hit detection, skipping full rebuild when task/skill files are unchanged**

## Performance

- **Duration:** 5 min (including human verification checkpoint)
- **Started:** 2026-03-09T13:50:00Z
- **Completed:** 2026-03-09T13:55:00Z
- **Tasks:** 2 (1 TDD auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments
- Exported `computeContextHash(taskPath, skillsPaths)` function producing deterministic 8-char hex hashes from file contents
- `DockerProvider.prepare()` skips `docker.buildImage()` entirely when a cached image with matching content hash exists
- `teardown()` preserves images for cross-run reuse instead of deleting them
- 5 unit tests covering hash stability, mutation detection, order independence, skills inclusion, and naming pattern
- Human-verified: second `npm run test:bootstrap` shows "(cached)" and completes in seconds vs minutes

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for content-hash** - `986d059` (test)
2. **Task 1 (GREEN): Content-hash computation and cache-hit logic** - `2903a5f` (feat)
3. **Task 2: Human verification** - checkpoint approved (no commit needed)

**Plan metadata:** (pending - this commit)

## Files Created/Modified
- `tests/docker-cache.test.ts` - 5 unit tests for computeContextHash: stability, mutation, ordering, skills, naming
- `src/providers/docker.ts` - Extracted walkDir to module scope; added computeContextHash; content-hash naming in prepare(); cache-hit check via getImage().inspect(); teardown() preserves image
- `package.json` - Added test:docker-cache script

## Decisions Made
- Used 8-char SHA-256 prefix for image tags -- collision-safe for local Docker registries, readable in logs
- Preserved images in teardown instead of removing -- deterministic names mean stale images have different hashes and users can prune with `docker image prune`
- Included skills paths in hash with `skill/` prefix to distinguish from task files, ensuring skill changes trigger rebuilds
- Sorted file paths alphabetically before hashing for cross-platform deterministic ordering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Docker caching is operational; repeated eval runs with unchanged tasks skip the expensive npm install layer
- Old timestamp-named images no longer accumulate; only content-hash-named images persist
- Todo TODO-01 (Docker image speed optimizations) is resolved

## Self-Check: PASSED

- [x] `tests/docker-cache.test.ts` exists
- [x] `src/providers/docker.ts` exists with `computeContextHash` export
- [x] `package.json` has `test:docker-cache` script
- [x] Commit `986d059` exists (RED: failing tests)
- [x] Commit `2903a5f` exists (GREEN: implementation)

---
*Phase: quick-3*
*Completed: 2026-03-09*
