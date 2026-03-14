# Phase 6: CI Integration - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Both agent backends (OllamaToolAgent + OpenCodeAgent) run in CI with proper setup actions. Delivers extended setup-ollama action with multi-model support, new setup-opencode composite action, CI runner platform resolution, and agent eval workflow with matrix strategy. Does NOT include performance comparison (Phase 7) or OCP review (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### setup-ollama extension
- Replace single `model` input with YAML list of mappings `models` input -- no backward compatibility, all callers migrate at once
- Each entry in the YAML list: `name` (required), `modelfile` (optional path), `as` (optional custom model name)
- Action loops over entries: `ollama pull` for each `name`, then `ollama create {as} -f {modelfile}` for entries with Modelfile
- Single cache key for all models: hash of the full `models` input value, path `~/.ollama`
- Let Ollama handle deduplication -- `ollama pull` is a no-op for already-present models
- `OLLAMA_MAX_LOADED_MODELS=1` added to the action's optimized config (alongside existing FLASH_ATTENTION, KV_CACHE_TYPE, NUM_PARALLEL, NUM_THREAD)
- No default models in the action -- each workflow caller specifies all needed models explicitly
- All callers updated in one PR: skill-eval.yml (validate-graders + agent-eval), ci.yml (integration tests), benchmark-grader.yml

### setup-opencode composite action
- Composite action at `.github/actions/setup-opencode/action.yml`
- Install via `npm install -g opencode-ai@latest` (stable release, not @dev)
- Export `OPENCODE_BIN_PATH=$(which opencode)` to `GITHUB_ENV`
- Include `opencode --version` quick check to verify install
- Disable opencode auto-update via env var (researcher to confirm exact var name)
- No caching of global npm install -- fast enough (~10s), not worth the complexity
- No env var setup for `OPENCODE_DISABLE_*` -- agent code handles these inline in the runCommand call
- Version configurable via `version` input with `latest` default

### CI runner platform
- ARM64 first (ubuntu-24.04-arm), x64 fallback strategy:
  1. Research whether opencode linux-arm64 SIGABRT issue #13367 is fixed in stable
  2. If not: check if opencode-ai@dev has linux-arm64 build
  3. If neither: switch opencode eval jobs to ubuntu-latest (x64)
  4. OllamaToolAgent eval jobs stay on ARM64 regardless
- Remove SIGSEGV retry loop from OpenCodeAgent -- no longer needed with native ARM64 dev build locally
- Clean up stale x64/SIGSEGV comments in OpenCodeAgent class doc and inline comments
- Research Docker detection logic (cgroup patterns) for correctness on GitHub Actions runners

### CI Modelfile management
- CI Modelfile for opencode agent in `modelfiles/` directory (consistent with OllamaToolAgent pattern)
- New file: `modelfiles/qwen3-4b-skill-eval-opencode-agent.ci.Modelfile`
- 3 threads for CI Modelfiles (match existing qwen2.5-3b-skill-eval-ollama-agent.ci.Modelfile)
- Same model name for local and CI -- Modelfile differs (num_thread), name stays `qwen3-4b-skill-eval-opencode-agent`
- Both agents get Modelfile creation support in CI via the extended setup-ollama action

### Workflow structure
- Same `skill-eval.yml` workflow, extended with agent eval
- Existing eval jobs renamed to `validate-graders` -- single job with both providers (local + Docker) as separate steps
- New `agent-eval` matrix job: `agent: [ollama, opencode]` x `provider: [local, docker]` = 4 parallel combos
- `agent-eval` runs in parallel with `validate-graders` (no dependency between them)
- `setup-opencode` step conditional on `matrix.agent == 'opencode'`
- Models driven from matrix `include`: grader model (qwen2.5:3b) listed explicitly in each entry + agent-specific model from matrix value
- 30-minute timeout per job (match existing)
- Start with `--trials=1` for initial CI debugging, remove override once stable (default is 5 trials)
- Per-combo artifact upload: `eval-results-{agent}-{provider}`
- Include `npm run preview` step (if: always)
- Same triggers: pull_request, push to main, workflow_dispatch

### Claude's Discretion
- setup-ollama implementation: JavaScript action vs composite action for YAML parsing (user suggested considering JS action)
- Exact opencode auto-update disable env var (research during planning)
- Docker detection logic validation approach on CI runners
- Whether to start with 1-trial or jump to full 5-trial once CI works

</decisions>

<specifics>
## Specific Ideas

- User prefers actual YAML list of mappings for setup-ollama models input, not JSON or "YAML-like" key=value format
- validate-graders should be a single job covering both LocalProvider and DockerProvider in different steps (not two separate jobs)
- Matrix `include` attaches agent-specific model configs; grader model is listed statically in each include entry, not as an action default
- The `--validate` flag runs the reference solution (grader verification), not an agent -- important distinction for naming

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `setup-ollama` action (`.github/actions/setup-ollama/action.yml`): existing action to extend -- currently installs Ollama, caches models, starts server with optimized env, pulls single model
- `setup-node` action (`.github/actions/setup-node/action.yml`): installs Node.js + npm ci, reusable in new jobs
- `skill-eval.yml`: existing workflow to extend with agent eval jobs and rename existing jobs
- `ci.yml`: existing CI workflow, also uses setup-ollama (needs migration to new models input)
- CI Modelfile pattern: `modelfiles/qwen2.5-3b-skill-eval-ollama-agent.ci.Modelfile` (3 threads) vs local Modelfile (8 threads)
- `OpenCodeAgent` (`src/agents/opencode/index.ts`): config injection, Docker detection, model unload -- contains stale SIGSEGV retry loop and comments to clean up

### Established Patterns
- Composite actions in `.github/actions/` for reusable CI setup
- `ai-action/setup-ollama@v2` for Ollama binary installation
- Docker image caching in skill-eval.yml for eval-docker jobs
- Artifact upload with `actions/upload-artifact@v4` and `if: always()`
- Concurrency groups with cancel-in-progress for workflow-level dedup

### Integration Points
- `src/cli.ts:63`: `--agent=ollama|opencode` flag -- drives matrix.agent value
- `src/cli.ts:64`: `--provider=local|docker` flag -- drives matrix.provider value
- `src/agents/opencode/index.ts:14`: `OPENCODE_MODEL` constant -- must match Modelfile `as` name
- `modelfiles/`: all CI Modelfiles referenced by setup-ollama models input

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 06-ci-integration*
*Context gathered: 2026-03-15*
