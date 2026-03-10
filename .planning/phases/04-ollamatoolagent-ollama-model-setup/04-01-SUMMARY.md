---
phase: 04-ollamatoolagent-ollama-model-setup
plan: 01
subsystem: agents
tags: [ollama, picomatch, tool-calling, permissions, path-traversal, modelfile]

# Dependency graph
requires: []
provides:
  - "Four agent tool definitions (read_file, write_file, bash, list_directory) with JSON Schema"
  - "Three-tier bash permission system (secure denylist, agent defaults, task overrides)"
  - "Path traversal defense with symlink protection"
  - "Custom Modelfile with num_ctx 16384 for agentic workflows"
  - "Shared type definitions (ToolExecutor, PermissionConfig, OllamaAgentConfig)"
affects: [04-02-PLAN, 04-03-PLAN]

# Tech tracking
tech-stack:
  added: [ollama@0.6.3, picomatch@4.0.3, "@types/picomatch"]
  patterns: [three-tier-permissions, path-scoped-file-ops, picomatch-bash-mode]

key-files:
  created:
    - modelfiles/qwen3-agent.Modelfile
    - src/agents/ollama/types.ts
    - src/agents/ollama/tools.ts
    - src/agents/ollama/permissions.ts
    - tests/modelfile-config.test.ts
    - tests/permissions.test.ts
    - tests/path-traversal.test.ts
  modified:
    - package.json

key-decisions:
  - "Used picomatch { dot: true, bash: true } options for flat string matching instead of path-segment matching"
  - "Separated permissions.ts and tools.ts for single-responsibility and testability"

patterns-established:
  - "Three-tier permission check: secure denylist (immutable) > task allowlist override > agent+task denylist > agent allowlist"
  - "Path traversal defense: path.resolve + path.normalize + startsWith + fs.realpathSync for symlink protection"

requirements-completed: [OLCFG-01, OLCFG-02, AGENT-01]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 4 Plan 01: Dependencies, Modelfile, Tools, and Permissions Summary

**Ollama agent foundation with 4 tool definitions, picomatch-based three-tier permission system, and path-scoped file operations**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T14:14:02Z
- **Completed:** 2026-03-10T14:18:50Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Installed ollama and picomatch dependencies with type definitions
- Created custom Modelfile overriding Ollama's 2048-token default to 16384 for multi-turn tool loops
- Built four tool definitions matching Ollama's tool-calling JSON Schema format
- Implemented three-tier permission system with immutable secure denylist, agent defaults, and task overrides
- Path traversal defense blocks workspace escape and symlink attacks

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, create Modelfile + types, and add Modelfile config test** - `2e0e530` (feat)
2. **Task 2 RED: Add failing tests for permissions and path traversal** - `d66455b` (test)
3. **Task 2 GREEN: Implement tool definitions, permissions, and path security** - `98be644` (feat)

_Note: Task 2 used TDD flow with RED and GREEN commits._

## Files Created/Modified

- `modelfiles/qwen3-agent.Modelfile` - Custom Modelfile with num_ctx 16384, num_predict 4096, temperature 0
- `src/agents/ollama/types.ts` - Shared types: ToolExecutor, PermissionConfig, OllamaAgentConfig with defaults
- `src/agents/ollama/tools.ts` - AGENT_TOOLS (4 tools), resolveWorkspacePath, truncateToolOutput, createToolExecutor
- `src/agents/ollama/permissions.ts` - SECURE_DENYLIST, AGENT_DEFAULT_DENYLIST, isCommandAllowed with picomatch
- `tests/modelfile-config.test.ts` - 9 assertions: Modelfile content + type export validation
- `tests/permissions.test.ts` - 15 assertions: all three tiers, override behavior, benign commands
- `tests/path-traversal.test.ts` - 6 assertions: rejection and acceptance cases
- `package.json` - Added ollama, picomatch, @types/picomatch, 3 test scripts

## Decisions Made

- Used picomatch `{ dot: true, bash: true }` options so `*` matches across `/` in URLs and pipe characters -- picomatch defaults treat `/` as path separator which breaks bash command matching
- Separated permissions.ts and tools.ts into distinct modules for single-responsibility and independent testability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed picomatch glob matching for bash commands**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** picomatch default options treat `/` as a path separator, so `curl *` did not match `curl http://example.com` and pipe patterns like `curl * | bash` failed
- **Fix:** Added `{ dot: true, bash: true }` options to all `picomatch.isMatch()` calls, enabling flat string matching
- **Files modified:** src/agents/ollama/permissions.ts
- **Verification:** All 15 permission tests pass including curl/wget/pipe patterns
- **Committed in:** 98be644 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correct permission matching. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tool definitions and permission system ready for Plan 02 (OllamaToolAgent agent loop)
- `createToolExecutor` factory ready to be wired into the agent's `run()` method
- Modelfile ready for `ollama create qwen3-agent -f modelfiles/qwen3-agent.Modelfile`

---
*Phase: 04-ollamatoolagent-ollama-model-setup*
*Completed: 2026-03-10*
