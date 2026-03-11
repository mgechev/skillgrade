# Phase 5: OpenCodeAgent - Research

**Researched:** 2026-03-11
**Domain:** opencode CLI wrapper agent, Ollama integration, subprocess management
**Confidence:** HIGH

## Summary

Phase 5 wraps the opencode CLI (`opencode run`) as an agent backend for the skill-eval pipeline. OpenCode v1.2.24 is already installed on the dev machine (x64 binary under emulation via `OPENCODE_BIN_PATH`). The `opencode run "<prompt>"` command provides non-interactive execution, and an `opencode.json` config file placed in the task workspace controls provider, model, and permissions. The primary technical challenges are: (1) opencode hangs indefinitely on API errors (issue #8203) requiring external process tree killing, (2) config injection must use the CWD-based project config lookup path, and (3) Docker provider support requires `host.docker.internal` networking for container-to-host Ollama access.

The existing agent pattern (GeminiAgent/ClaudeAgent) is a 22-line class extending BaseAgent that encodes the instruction via base64, writes it to a temp file, and invokes the CLI through the `runCommand` callback. OpenCodeAgent follows this pattern with three additions: config file injection before launch, diagnostic logging, and a finally-block model unload via the Ollama API. The external kill timer is implemented inside OpenCodeAgent itself (fork principle: extend, don't modify evalRunner.ts).

**Primary recommendation:** Use the established CLI agent pattern (base64 prompt + runCommand), add opencode.json config injection, and use `tree-kill` for reliable cross-platform process tree termination as the kill timer safety net.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Static config template `opencode.skill-eval-agent.json` checked into repo at `src/agents/opencode/`
- OpenCodeAgent copies the config file into the task workspace at runtime before launching opencode
- Config validation approach: researcher decides based on opencode's actual error behavior when config is missing
- Both Docker and local providers supported -- implement local first, Docker second
- Docker support is required for Phase 5 completion (blocks until working)
- opencode installed inside Docker container, matching the GeminiAgent/ClaudeAgent pattern
- OpenCodeAgent uses the `runCommand` provider callback (same pattern as GeminiAgent/ClaudeAgent)
- Plain text output (default opencode output), not --format json (RPT-01 deferred)
- Log model name at run start for diagnostics
- Smoke test: verify opencode binary exists and can reach Ollama before first trial
- Kill timer implemented inside OpenCodeAgent (do not modify upstream `withTimeout` in evalRunner.ts)
- Timeout duration uses existing task.toml `agent.timeout_sec`
- Explicit Ollama model unload via `keep_alive: 0` in finally block after opencode exits
- Benchmark the per-trial model reload cost
- Warmup strategy: try all variants and benchmark to pick the best
- Fork principle: extend, don't modify upstream code

### Claude's Discretion
- Stderr handling (combine with stdout or log separately) based on opencode's actual output
- Smoke test implementation details (what trivial command to run, pass/fail criteria)
- Process tree killing implementation (platform-specific child process management)
- opencode CLI flags and invocation pattern (researcher determines from docs)

### Deferred Ideas (OUT OF SCOPE)
- RPT-01: Parse opencode `--format json` output for structured events and token counts
- CI-specific opencode config variant (`.ci.json`) -- Phase 6
- Docker networking investigation may inform CI setup approach -- Phase 6
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGENT-02 | OpenCodeAgent executes tasks via opencode CLI backed by Ollama | opencode.json config with Ollama provider + `opencode run` invocation pattern documented in Architecture Patterns |
| PIPE-02 | `--agent=opencode` CLI flag selects OpenCodeAgent | CLI integration points identified at src/cli.ts lines 51, 62, 191-220, 225; follows established ollama agent pattern |
| PIPE-04 | OpenCodeAgent injects opencode.json config into workspace | Config injection strategy documented: copy static template to workspace CWD before launch; opencode looks for project config in CWD |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| opencode-ai | 1.2.24 | CLI agent that executes coding tasks via Ollama | Already installed; provides `opencode run` non-interactive mode |
| ollama | 0.6.3 | Ollama Node.js client (already a dependency) | Used for model unload (`keep_alive: 0`) in finally block |
| tree-kill | 1.2.2 | Cross-platform process tree termination | 18M weekly downloads; uses `taskkill /T /F` on Windows, handles the opencode hang problem reliably |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/tree-kill | latest | TypeScript definitions for tree-kill | Development dependency for type safety |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tree-kill | Manual taskkill spawn | tree-kill handles cross-platform; manual spawn is Windows-only and more code |
| tree-kill | child.kill('SIGTERM') | Only kills the direct child, not the process tree; opencode spawns subprocesses |
| Static config file | Runtime JSON generation | Static file is simpler, auditable, and follows Modelfile convention |

**Installation:**
```bash
npm install tree-kill
npm install -D @types/tree-kill
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  agents/
    opencode/
      index.ts                             # OpenCodeAgent class
      opencode.skill-eval-agent.json       # Static opencode.json config template
    ollama/                                # Existing OllamaToolAgent (reference)
    gemini.ts                              # Existing GeminiAgent (reference)
    claude.ts                              # Existing ClaudeAgent (reference)
tests/
  opencode-agent.test.ts                   # Unit tests (no live opencode needed)
  cli-opencode-flag.test.ts                # CLI integration source tests
```

### Pattern 1: CLI Agent via runCommand (Established)
**What:** Encode instruction as base64, write to temp file, invoke CLI tool with the prompt
**When to use:** Any CLI-based agent (Gemini, Claude, opencode)
**Example:**
```typescript
// Source: src/agents/gemini.ts (existing pattern)
const b64 = Buffer.from(instruction).toString('base64');
await runCommand(`echo '${b64}' | base64 -d > /tmp/.prompt.md`);
const command = `opencode run "$(cat /tmp/.prompt.md)"`;
const result = await runCommand(command);
```

### Pattern 2: Config Injection Before Launch
**What:** Copy a static config file into the workspace CWD before invoking opencode
**When to use:** Every OpenCodeAgent.run() call
**Why:** opencode looks for `opencode.json` in the project root (CWD). The config must be workspace-scoped to avoid affecting the repo root.
**Example:**
```typescript
// Copy config template into workspace before launching opencode
await runCommand(`cp /path/to/config/opencode.json ./opencode.json`);
// Then invoke opencode (it picks up CWD config automatically)
const result = await runCommand(`opencode run "$(cat /tmp/.prompt.md)"`);
```

**Config injection mechanism for local vs Docker:**
- **Local provider:** The config file is embedded in the OpenCodeAgent module directory. The agent copies it to the workspace temp dir via `runCommand('cp ...')`. Since local provider uses `--login` bash, the absolute path to the config source in the repo must be computed at runtime (e.g., using `__dirname` to find the source file, then passing the path through runCommand).
- **Docker provider:** The config file needs to be available inside the container. Two approaches: (a) copy via `runCommand` from a known path (if baked into the Docker image), or (b) write the JSON content inline via `runCommand('cat << EOF > opencode.json ... EOF')`. Approach (b) is more portable since it does not require modifying the Dockerfile.

### Pattern 3: Finally-Block Model Unload (Established)
**What:** Unload the Ollama model in a finally block after agent run completes
**When to use:** Every agent that uses Ollama (prevents 16GB RAM OOM)
**Example:**
```typescript
// Source: src/agents/ollama/index.ts (existing pattern)
try {
    // ... agent logic ...
} finally {
    try {
        await ollamaClient.chat({
            model: modelName,
            messages: [],
            keep_alive: 0,
        });
    } catch {
        // Ignore unload errors
    }
}
```

### Pattern 4: External Kill Timer (New)
**What:** Spawn opencode as a subprocess with an external timeout that kills the entire process tree
**When to use:** OpenCodeAgent only (compensates for opencode hang bug #8203)
**Why:** The evalRunner.ts `withTimeout` only rejects the promise but cannot kill a hanging subprocess. OpenCodeAgent needs its own kill timer that forcefully terminates the process tree.

**Important design note:** OpenCodeAgent invokes opencode through `runCommand`, which is a provider callback. The `runCommand` callback spawns the actual subprocess. This means OpenCodeAgent does NOT directly have access to the child process PID. The kill timer must work differently depending on the approach:

**Approach A (Recommended): Wrapper with timeout command**
Use the `timeout` command (available in bash) to wrap the opencode invocation:
```typescript
// timeout sends SIGTERM, then SIGKILL after grace period
const cmd = `timeout --signal=TERM --kill-after=10 ${timeoutSec} opencode run "$(cat /tmp/.prompt.md)"`;
const result = await runCommand(cmd);
```
This is the simplest approach because `timeout` is a standard coreutils command available in both Git Bash (local provider) and Linux (Docker provider). It handles SIGTERM first, then SIGKILL after the grace period, and kills the process group.

**Approach B: Direct spawn with tree-kill (for local-only or if timeout unavailable)**
If direct PID access is needed, OpenCodeAgent would need to bypass runCommand and spawn opencode directly. This is more complex and breaks the provider abstraction. Reserve for fallback only.

**Recommendation:** Use Approach A (`timeout` command wrapper) as the primary mechanism. The `timeout` command is available on both Git Bash (Windows local provider) and Linux (Docker provider). The evalRunner.ts `withTimeout` still acts as the outer safety net.

### Pattern 5: Smoke Test Gate (Established)
**What:** Verify the agent backend is reachable before starting trials
**When to use:** Pre-eval setup in cli.ts for `--agent=opencode`
**Example:** Run `opencode run "Say hello"` (or equivalent trivial prompt) and verify it returns within a short timeout (e.g., 30 seconds). Also verify Ollama is reachable at localhost:11434.

### opencode.json Config Template

The static config file checked into `src/agents/opencode/opencode.skill-eval-agent.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": {
        "baseURL": "http://localhost:11434/v1"
      },
      "models": {
        "qwen2.5-3b-skill-eval-agent": {
          "name": "Qwen 2.5 3B Skill Eval Agent",
          "tools": true
        }
      }
    }
  },
  "model": "ollama/qwen2.5-3b-skill-eval-agent",
  "permission": {
    "read": "allow",
    "edit": "allow",
    "bash": "allow",
    "glob": "allow",
    "grep": "allow",
    "list": "allow",
    "webfetch": "deny",
    "websearch": "deny",
    "codesearch": "deny",
    "external_directory": "deny",
    "doom_loop": "allow"
  }
}
```

**Key config decisions:**
- **Model name `qwen2.5-3b-skill-eval-agent`:** This is the custom Modelfile name from Phase 4.1 (already configured in Ollama with num_ctx 4096, temperature 0, etc.). opencode accesses it via the OpenAI-compatible endpoint `/v1`.
- **`"tools": true`:** Required for opencode to enable tool calling (read, write, bash, etc.).
- **`baseURL: "http://localhost:11434/v1"`:** The `/v1` suffix is required -- opencode uses the OpenAI-compatible API, not the native Ollama API.
- **Permissions all `"allow"`:** Prevents opencode from hanging on permission prompts in non-interactive `run` mode. Web access denied since eval should be offline.
- **`"doom_loop": "allow"`:** Prevents opencode from prompting about repeated tool calls, which would hang non-interactive mode.

**Docker variant:** For Docker provider, `baseURL` must change to `"http://host.docker.internal:11434/v1"` to reach host Ollama from inside the container. This can be handled by having two config templates or by string-replacing at runtime.

### Anti-Patterns to Avoid
- **Modifying evalRunner.ts withTimeout:** Fork principle -- extend, don't modify. OpenCodeAgent owns its kill timer.
- **Spawning opencode without config injection:** Without opencode.json in CWD, opencode uses global config or defaults, which may pick wrong provider/model or prompt for permissions.
- **Using child.kill() alone on Windows:** Only kills the direct process, not the tree. opencode spawns MCP servers and tool processes as children.
- **Relying on opencode's graceful exit:** Issue #8203 confirms opencode hangs on errors. External timeout is mandatory.
- **Using `--format json` output parsing:** Deferred to RPT-01. Use plain text for now.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Process tree killing | Manual PID walking + kill | `tree-kill` npm package (fallback) or `timeout` bash command (primary) | Cross-platform PID tree traversal is error-prone; `timeout` is already available in bash |
| Config file templating | Runtime JSON builder | Static JSON file copied to workspace | Simpler, auditable, follows Modelfile convention, avoids JSON escaping bugs |
| Ollama model unload | Custom HTTP calls | `ollama` npm client (already installed) | Handles API versioning, connection errors internally |
| Base64 prompt encoding | Custom encoding | `Buffer.from(instruction).toString('base64')` (established pattern) | Already proven in GeminiAgent/ClaudeAgent |

**Key insight:** OpenCodeAgent is fundamentally a thin CLI wrapper (like GeminiAgent/ClaudeAgent) with three additions: config injection, kill timer, and model unload. Keep it simple.

## Common Pitfalls

### Pitfall 1: opencode Hangs on API/Permission Errors
**What goes wrong:** `opencode run` encounters an error (rate limit, missing config, permission prompt) and hangs indefinitely instead of exiting.
**Why it happens:** Known bug (GitHub issue #8203, #4506, #3213). opencode's internal error handling does not exit the process on unrecoverable errors.
**How to avoid:** Wrap every `opencode run` invocation with the `timeout` command. The agent.timeout_sec from task.toml (600s for superlint_demo) sets the outer limit. Use a shorter internal timeout (e.g., 90% of agent.timeout_sec) so the kill timer fires before evalRunner's withTimeout.
**Warning signs:** Trial never completes, process count keeps growing, `timeout` exits with code 124 (killed).

### Pitfall 2: Config Not Found in Workspace CWD
**What goes wrong:** opencode picks up global config or no config, using wrong model/provider, or prompting for auth.
**Why it happens:** opencode searches for config in CWD first, then global. If the config file is not copied to the workspace temp dir, CWD has no config.
**How to avoid:** Always copy opencode.json to workspace before invoking opencode. Verify with a smoke test that the correct model is used. When opencode cannot find a valid config or model, it typically hangs or prompts for auth -- the `timeout` wrapper catches this.
**Warning signs:** Logs show wrong model name, opencode prompts for API key, unexpected provider errors.

### Pitfall 3: Ollama baseURL Missing /v1 Suffix
**What goes wrong:** opencode cannot connect to Ollama, reports API errors.
**Why it happens:** opencode uses `@ai-sdk/openai-compatible` which expects the OpenAI-compatible endpoint format. Ollama's native API is at port 11434 but the OpenAI-compatible endpoint is at `localhost:11434/v1`.
**How to avoid:** Always use `http://localhost:11434/v1` (local) or `http://host.docker.internal:11434/v1` (Docker) as the baseURL.
**Warning signs:** Connection refused errors, 404 errors from Ollama.

### Pitfall 4: Docker Container Cannot Reach Host Ollama
**What goes wrong:** opencode inside Docker container cannot connect to Ollama running on the host.
**Why it happens:** Docker containers have their own network namespace. `localhost` inside a container refers to the container itself, not the host.
**How to avoid:** Use `host.docker.internal` in the Docker config variant. Ensure Ollama is listening on `0.0.0.0:11434` (set `OLLAMA_HOST=0.0.0.0`). On Linux, add `--add-host=host.docker.internal:host-gateway` to the Docker run command. The existing DockerProvider does not currently set `extra_hosts` -- this may need investigation.
**Warning signs:** ECONNREFUSED from opencode inside container, Ollama logs show no incoming connections.

### Pitfall 5: Ollama Context Window Too Small for opencode
**What goes wrong:** Tool calls fail or get truncated because Ollama defaults to 4096 context.
**Why it happens:** Even though the custom Modelfile sets num_ctx 4096, opencode's internal tool-calling protocol may need more context than direct API calls.
**How to avoid:** The existing qwen2.5-3b-skill-eval-agent Modelfile already sets num_ctx 4096, which was proven sufficient for OllamaToolAgent. Monitor opencode's behavior -- if tool calls fail, increase num_ctx. Note: opencode cannot override Ollama's num_ctx via config; it must be set in the Modelfile.
**Warning signs:** Truncated tool call responses, opencode reporting "context length exceeded".

### Pitfall 6: Windows ARM64 Emulation Overhead
**What goes wrong:** opencode runs slower than expected on the dev machine.
**Why it happens:** opencode-windows-x64 binary runs under QEMU x86_64 emulation on ARM64 Surface Laptop.
**How to avoid:** Accept the overhead. The ARM64 binary does not exist yet (GitHub issue #4340). Benchmark to quantify the impact.
**Warning signs:** Startup time >5s, overall trial time significantly higher than OllamaToolAgent.

### Pitfall 7: Permission Prompts Hang Non-Interactive Mode
**What goes wrong:** opencode prompts for permission approval during `opencode run`, process hangs waiting for input.
**Why it happens:** Some permissions default to "ask" (e.g., `doom_loop`, `external_directory`). In non-interactive mode, these prompts hang.
**How to avoid:** Set ALL permissions explicitly in opencode.json. Set sensitive ones to "deny" (not "ask") and safe ones to "allow". Never leave any permission at its default "ask" value for non-interactive use.
**Warning signs:** opencode output stops after initial setup, no tool calls executed, process hangs.

## Code Examples

### OpenCodeAgent Class Structure
```typescript
// Source: Derived from GeminiAgent/ClaudeAgent pattern + opencode-specific additions
import { Ollama } from 'ollama';
import { BaseAgent, CommandResult } from '../../types';
import { DEFAULT_OLLAMA_AGENT_CONFIG } from '../ollama/types';
import * as path from 'path';
import * as fs from 'fs';

export class OpenCodeAgent extends BaseAgent {
    private ollamaClient: Ollama;

    constructor() {
        super();
        this.ollamaClient = new Ollama({ host: DEFAULT_OLLAMA_AGENT_CONFIG.host });
    }

    async run(
        instruction: string,
        workspacePath: string,
        runCommand: (cmd: string) => Promise<CommandResult>
    ): Promise<string> {
        // 1. Inject opencode.json config into workspace
        const configContent = fs.readFileSync(
            path.join(__dirname, 'opencode.skill-eval-agent.json'),
            'utf-8'
        );
        const b64Config = Buffer.from(configContent).toString('base64');
        await runCommand(`echo '${b64Config}' | base64 -d > opencode.json`);

        // 2. Log model for diagnostics
        console.log('[OpenCodeAgent] Using model: qwen2.5-3b-skill-eval-agent');

        // 3. Write instruction to temp file (established pattern)
        const b64 = Buffer.from(instruction).toString('base64');
        await runCommand(`echo '${b64}' | base64 -d > /tmp/.prompt.md`);

        try {
            // 4. Invoke opencode with timeout wrapper
            const timeoutSec = 540; // ~90% of 600s task timeout
            const command = `timeout --signal=TERM --kill-after=10 ${timeoutSec} opencode run "$(cat /tmp/.prompt.md)"`;
            const result = await runCommand(command);

            if (result.exitCode === 124) {
                console.error('[OpenCodeAgent] opencode killed by timeout');
            } else if (result.exitCode !== 0) {
                console.error('[OpenCodeAgent] opencode exited with code:', result.exitCode);
            }

            return result.stdout + '\n' + result.stderr;
        } finally {
            // 5. Unload model (safety net, same pattern as OllamaToolAgent)
            try {
                await this.ollamaClient.chat({
                    model: DEFAULT_OLLAMA_AGENT_CONFIG.model,
                    messages: [],
                    keep_alive: 0,
                });
            } catch {
                // Ignore unload errors
            }
        }
    }
}
```

### CLI Integration (src/cli.ts additions)
```typescript
// Import at top of cli.ts
import { OpenCodeAgent } from './agents/opencode';

// Help text update (line 51)
console.log('  --agent=gemini|claude|ollama|opencode  Default: gemini');

// Pre-eval setup (around line 192) -- add alongside existing ollama block
if (agentType === 'opencode') {
    // Same model unload logic as ollama agent
    // ... unload non-agent models ...

    // Smoke test: verify opencode binary and Ollama connectivity
    // ... smoke test ...
    console.log('[INFO] OpenCode smoke test passed');
}

// Agent selection switch (line 225)
case 'opencode':
    agent = new OpenCodeAgent();
    break;
```

### opencode.json Docker Variant
```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (host)",
      "options": {
        "baseURL": "http://host.docker.internal:11434/v1"
      },
      "models": {
        "qwen2.5-3b-skill-eval-agent": {
          "name": "Qwen 2.5 3B Skill Eval Agent",
          "tools": true
        }
      }
    }
  },
  "model": "ollama/qwen2.5-3b-skill-eval-agent",
  "permission": {
    "read": "allow",
    "edit": "allow",
    "bash": "allow",
    "glob": "allow",
    "grep": "allow",
    "list": "allow",
    "webfetch": "deny",
    "websearch": "deny",
    "codesearch": "deny",
    "external_directory": "deny",
    "doom_loop": "allow"
  }
}
```

### Smoke Test Pattern
```typescript
// Verify opencode binary exists and can reach Ollama
async function smokeTestOpenCode(
    runCommand: (cmd: string) => Promise<CommandResult>
): Promise<{ passed: boolean; error?: string }> {
    try {
        // Check binary exists
        const versionResult = await runCommand('opencode --version');
        if (versionResult.exitCode !== 0) {
            return { passed: false, error: 'opencode binary not found or not executable' };
        }

        // Check Ollama is reachable (reuse existing Ollama client)
        const { Ollama } = require('ollama');
        const client = new Ollama({ host: 'http://localhost:11434' });
        await client.list(); // Throws on connection failure

        return { passed: true };
    } catch (err: any) {
        return { passed: false, error: `OpenCode smoke test failed: ${err.message}` };
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| opencode default 4K context | Custom Modelfile with num_ctx set | Ongoing | Must use custom Modelfile model name in config |
| opencode `tools` boolean config | `permission` config system | opencode v1.1.1+ | Use `permission` object, not deprecated `tools` booleans |
| opencode TUI-first | `opencode run` non-interactive | Early 2025 | Enables scripting and automation use cases |
| No YOLO mode | Feature requested but not standardized | Issue #9070, #11831 | Use explicit permission `"allow"` entries instead of relying on YOLO flag |

**Deprecated/outdated:**
- `tools` boolean config in opencode.json: Replaced by `permission` object in v1.1.1+. Do not use.
- `opencode serve` + `opencode run --attach`: Optimization for MCP cold boot. Not needed for eval (each trial is independent).

## Open Questions

1. **Does `timeout` command exist in Git Bash on Windows?**
   - What we know: `timeout` is a GNU coreutils command. Git Bash ships with many coreutils, but `timeout` availability varies.
   - What's unclear: Whether the Windows Git Bash bundled with Git for Windows includes `timeout`.
   - Recommendation: Test during implementation. If unavailable, fall back to a Node.js-level setTimeout + tree-kill approach where OpenCodeAgent wraps the runCommand promise with its own timer.

2. **Does opencode respect the CWD `opencode.json` when invoked via `runCommand` in the local provider?**
   - What we know: opencode docs say project config (`opencode.json` in project root) has high precedence. The local provider sets CWD to the workspace temp dir.
   - What's unclear: Whether `opencode run` respects the CWD or looks for the config relative to some other directory (e.g., the Git root).
   - Recommendation: Verify empirically. If opencode uses Git root detection, may need to `git init` in the workspace or use `OPENCODE_CONFIG` env var to force config path.

3. **How does opencode handle the custom Modelfile model name `qwen2.5-3b-skill-eval-agent`?**
   - What we know: opencode uses the OpenAI-compatible endpoint (`/v1`). Ollama serves custom Modelfile models at this endpoint with their custom names.
   - What's unclear: Whether opencode passes the model name through correctly to Ollama via the `/v1` API.
   - Recommendation: Test with a trivial prompt. If the model name is not recognized, may need to use the base model name (`qwen2.5:3b`) and accept default parameters, or create the model via `/save` instead of Modelfile.

4. **Docker provider `extra_hosts` for Ollama access**
   - What we know: DockerProvider creates containers with resource limits but does not currently set `HostConfig.ExtraHosts`.
   - What's unclear: Whether `host.docker.internal` resolves automatically on Windows Docker Desktop (it typically does) vs Linux Docker (needs `--add-host`).
   - Recommendation: Test on Windows Docker Desktop first. If needed, add `ExtraHosts: ['host.docker.internal:host-gateway']` to the container config. Also need `OLLAMA_HOST=0.0.0.0` on the host.

5. **Per-trial model reload cost**
   - What we know: OpenCodeAgent unloads the model in the finally block. The next trial reloads it. OllamaToolAgent had this same pattern.
   - What's unclear: Whether opencode's startup triggers a model load that adds significant overhead compared to direct API calls.
   - Recommendation: Benchmark with 3 trials. If reload cost is >10% of trial time, explore keeping model warm between trials (skip unload for opencode agent, or add warm-up prompt).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | ts-node + custom assert (no test runner -- established project pattern) |
| Config file | None -- tests run via `ts-node tests/*.test.ts` |
| Quick run command | `npx ts-node tests/<test-file>.test.ts` |
| Full suite command | `npm run test:opencode-agent && npm run test:cli-opencode-flag` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-02 | OpenCodeAgent constructable, extends BaseAgent, has run method | unit | `npx ts-node tests/opencode-agent.test.ts` | No -- Wave 0 |
| AGENT-02 | OpenCodeAgent config file exists and is valid JSON | unit | `npx ts-node tests/opencode-agent.test.ts` | No -- Wave 0 |
| AGENT-02 | OpenCodeAgent config has correct Ollama provider, model, permissions | unit | `npx ts-node tests/opencode-agent.test.ts` | No -- Wave 0 |
| PIPE-02 | CLI source contains opencode agent import, case, help text | unit | `npx ts-node tests/cli-opencode-flag.test.ts` | No -- Wave 0 |
| PIPE-02 | CLI smoke test gate for opencode agent type | unit | `npx ts-node tests/cli-opencode-flag.test.ts` | No -- Wave 0 |
| PIPE-04 | Config injection: opencode.json written to workspace (source code analysis) | unit | `npx ts-node tests/opencode-agent.test.ts` | No -- Wave 0 |
| AGENT-02 | Model unload pattern (keep_alive: 0 in finally block) in source | unit | `npx ts-node tests/opencode-agent.test.ts` | No -- Wave 0 |
| AGENT-02 | Kill timer / timeout wrapper in source | unit | `npx ts-node tests/opencode-agent.test.ts` | No -- Wave 0 |
| AGENT-02 | superlint_demo completes with OpenCodeAgent (local provider) | smoke (manual) | `npm run eval -- superlint_demo --agent=opencode --provider=local --trials=1` | No -- manual |
| AGENT-02 | superlint_demo completes with OpenCodeAgent (Docker provider) | smoke (manual) | `npm run eval -- superlint_demo --agent=opencode --provider=docker --trials=1` | No -- manual |

### Sampling Rate
- **Per task commit:** `npx ts-node tests/opencode-agent.test.ts && npx ts-node tests/cli-opencode-flag.test.ts`
- **Per wave merge:** Full unit test suite for all opencode tests
- **Phase gate:** All unit tests green + superlint_demo completes with both local and Docker providers

### Wave 0 Gaps
- [ ] `tests/opencode-agent.test.ts` -- covers AGENT-02 (constructability, config validation, source patterns)
- [ ] `tests/cli-opencode-flag.test.ts` -- covers PIPE-02 (CLI wiring)
- [ ] Install `tree-kill` and `@types/tree-kill` (if kill timer uses tree-kill instead of `timeout` command)
- [ ] `npm run test:opencode-agent` and `npm run test:cli-opencode-flag` scripts in package.json

## Sources

### Primary (HIGH confidence)
- opencode CLI `--help` output (v1.2.24, installed locally) -- CLI flags, `run` command syntax
- [OpenCode Config docs](https://opencode.ai/docs/config/) -- config file locations, precedence, schema
- [OpenCode Permissions docs](https://opencode.ai/docs/permissions/) -- permission types, allow/ask/deny values
- [OpenCode CLI docs](https://opencode.ai/docs/cli/) -- `opencode run` flags including `--format`, `--model`, `--agent`
- Existing codebase: src/agents/gemini.ts, src/agents/claude.ts, src/agents/ollama/index.ts -- established patterns
- Existing codebase: src/cli.ts -- integration points at lines 51, 62, 191-220, 225
- Existing codebase: src/types.ts -- BaseAgent abstract class, CommandResult, EnvironmentProvider

### Secondary (MEDIUM confidence)
- [OpenCode + Ollama setup guides](https://docs.ollama.com/integrations/opencode) -- config format for Ollama provider
- [ollama-x-opencode repository](https://github.com/p-lemonish/ollama-x-opencode) -- verified opencode.json config for Ollama
- [tree-kill npm package](https://www.npmjs.com/package/tree-kill) -- process tree killing, cross-platform
- [OpenCode issue #8203](https://github.com/anomalyco/opencode/issues/8203) -- `opencode run` hang bug on API errors
- [OpenCode issue #4506](https://github.com/sst/opencode/issues/4506) -- hang in CI context

### Tertiary (LOW confidence)
- [OpenCode issue #4340](https://github.com/anomalyco/opencode/issues/4340) -- Windows ARM64 binary not yet available
- [OpenCode issue #9070](https://github.com/anomalyco/opencode/issues/9070) -- YOLO mode feature request (may not be implemented in v1.2.24)
- [OpenCode issue #10411](https://github.com/anomalyco/opencode/issues/10411) -- `--non-interactive` flag request (may not exist yet)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- opencode v1.2.24 verified installed, config format verified via official docs and community examples, tree-kill is battle-tested
- Architecture: HIGH -- follows established project patterns (GeminiAgent/ClaudeAgent), config injection approach verified with opencode's config precedence docs
- Pitfalls: HIGH -- opencode hang issues well-documented in GitHub issues with multiple confirmations; Docker networking is standard Docker knowledge
- Kill timer approach: MEDIUM -- `timeout` command availability in Git Bash on Windows needs empirical verification; tree-kill fallback is proven

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (opencode evolves quickly, but core CLI + config patterns are stable)
