# Phase 5: OpenCodeAgent - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Wrap the opencode CLI as an agent backend, leveraging the Ollama model proven in Phase 4/4.1. Delivers OpenCodeAgent class, `--agent=opencode` CLI flag, config injection, external kill timer, and superlint_demo completion with both local and Docker providers. Does NOT include CI setup (Phase 6), performance comparison (Phase 7), or --format json parsing (deferred RPT-01).

</domain>

<decisions>
## Implementation Decisions

### Config injection strategy
- Static config template `opencode.skill-eval-agent.json` checked into repo at `src/agents/opencode/`
- OpenCodeAgent copies the config file into the task workspace at runtime before launching opencode
- Researcher must confirm opencode's config lookup path (CWD-based config expected)
- Config validation approach: researcher decides based on opencode's actual error behavior when config is missing
- CI-specific config variant deferred to Phase 6

### Provider scope
- Both Docker and local providers supported -- implement local first, Docker second
- Docker support is required for Phase 5 completion (blocks until working)
- opencode installed inside Docker container, matching the GeminiAgent/ClaudeAgent pattern
- Researcher investigates Docker networking approach for container-to-host Ollama access
- Researcher investigates opencode's permission model to determine auto-approve configuration
- OpenCodeAgent uses the `runCommand` provider callback (same pattern as GeminiAgent/ClaudeAgent)

### Output format & logging
- Plain text output (default opencode output), not --format json (RPT-01 deferred)
- Log model name at run start for diagnostics: `[OpenCodeAgent] Using model: <name>` -- removable once stable
- Smoke test: verify opencode binary exists and can reach Ollama before first trial -- removable once stable
- Stderr handling: Claude's discretion based on opencode's actual output behavior

### Timeout kill strategy
- Kill timer implemented inside OpenCodeAgent (do not modify upstream `withTimeout` in evalRunner.ts -- fork principle: extend, don't modify)
- Researcher decides signal sequence (how opencode responds to SIGTERM vs SIGKILL)
- Timeout duration uses existing task.toml `agent.timeout_sec` (consistent with all agents)
- Explicit Ollama model unload via `keep_alive: 0` in finally block after opencode exits (safety net)
- Benchmark the per-trial model reload cost -- if significant, explore keeping model warm between trials
- Warmup strategy: try all variants (opencode warmup, direct Ollama API warmup, no warmup) and benchmark to pick the best

### Claude's Discretion
- Stderr handling (combine with stdout or log separately) based on opencode's actual output
- Smoke test implementation details (what trivial command to run, pass/fail criteria)
- Process tree killing implementation (platform-specific child process management)
- opencode CLI flags and invocation pattern (researcher determines from docs)

</decisions>

<specifics>
## Specific Ideas

- Fork principle: extend, don't modify upstream code. Keep kill timer self-contained in OpenCodeAgent rather than modifying evalRunner.ts `withTimeout`.
- Config file naming follows project convention: `opencode.skill-eval-agent.json` (matches `qwen2.5-skill-eval-agent.Modelfile` pattern)
- Config must be workspace-scoped (not repo root) to avoid affecting developers using opencode for normal development in this project
- Diagnostic logging (model name, smoke test) should be added during development and considered for removal once the setup is proven stable

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BaseAgent` abstract class (`src/types.ts`): OpenCodeAgent extends this with `run(instruction, workspacePath, runCommand)`
- `GeminiAgent`/`ClaudeAgent` (`src/agents/`): 22-line CLI wrappers using base64 prompt + runCommand pattern -- direct template for OpenCodeAgent's basic structure
- `OllamaToolAgent` (`src/agents/ollama/index.ts`): finally-block model unload pattern (`keep_alive: 0`) -- reuse for OpenCodeAgent cleanup
- `DEFAULT_OLLAMA_AGENT_CONFIG` (`src/agents/ollama/types.ts`): model name and host constants -- OpenCodeAgent can reference for consistency
- `smokeTestToolCalling` (`src/agents/ollama/smoke-test.ts`): pattern for pre-eval gate -- OpenCodeAgent needs its own variant

### Established Patterns
- Agent receives `runCommand` callback for provider-isolated command execution with automatic session logging
- Provider handles workspace lifecycle (prepare/setup/cleanup/teardown) -- agent is stateless between trials
- CLI agent selection via `--agent=` flag in `src/cli.ts:62` with switch statement at line 225
- Sequential model loading: agent model unloaded before grader loads (16GB RAM constraint)
- Separate Modelfiles for local vs CI (deferred to Phase 6 for opencode config)

### Integration Points
- `src/cli.ts:225`: agent selection switch -- add `opencode` case alongside `gemini`, `claude`, `ollama`
- `src/cli.ts:51`: help text -- add `opencode` to `--agent=` options
- `src/cli.ts:191-220`: pre-eval setup block (Ollama smoke test, model unload) -- extend for opencode
- Provider `runCommand` callback -- opencode invoked through this, same as Gemini/Claude
- Ollama API at localhost:11434 -- opencode uses same server as OllamaToolAgent and LLMGrader

</code_context>

<deferred>
## Deferred Ideas

- RPT-01: Parse opencode `--format json` output for structured events and token counts -- future reporting phase
- CI-specific opencode config variant (`.ci.json`) -- Phase 6
- Docker networking investigation may inform CI setup approach -- Phase 6

</deferred>

---

*Phase: 05-opencodeagent*
*Context gathered: 2026-03-11*
