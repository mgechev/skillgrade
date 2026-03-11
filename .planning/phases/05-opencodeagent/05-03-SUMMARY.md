---
phase: 05-opencodeagent
plan: 03
subsystem: agents
tags: [opencode, ollama, e2e-validation, blocked, model-capability]
status: blocked

# Dependency graph
requires:
  - phase: 05-opencodeagent
    plan: 02
    provides: "CLI wiring with --agent=opencode flag and smoke test"
provides: []
---

# Plan 05-03 Summary: End-to-End Validation (BLOCKED)

## Outcome

**BLOCKED** -- Qwen-family models (2.5 and 3.5, 3B-7B) cannot reliably drive opencode's multi-tool protocol for the superlint_demo task. The plan's E2E validation goal was not achieved. Moved to Phase 5.1 for focused research and model tuning.

## What Was Attempted

### Models tested through opencode

| Model | Size | Tool Calls | Result |
|-------|------|------------|--------|
| qwen2.5:3b | 1.9 GB | Invoked wrong tools (Skill), malformed bash args | reward 0.00 |
| qwen2.5:7b | 4.7 GB | Zero tool calls (empty response) | reward 0.00 |
| qwen3.5:4b | 3.4 GB | Ran step 1/3 (superlint check), stopped early | reward 0.00 |
| qwen3.5:4b (stronger prompt) | 3.4 GB | Ran 600s, timed out | timeout |

### What works

- Qwen 3.5:4b produces correct tool calls via /v1 API (confirmed with direct curl test)
- Simple tasks work locally through opencode (echo hello test passed)
- OpenCodeAgent class, config injection, Docker detection, SIGSEGV retry all function correctly
- Plans 01 and 02 are solid (13 + 7 unit tests passing)

### Root cause analysis

1. **Tool count overwhelm**: opencode exposes 10+ tools (bash, read, edit, glob, grep, list, Skill, question, plan...). OllamaToolAgent succeeds because it only exposes 3 tools.
2. **Early stopping**: Qwen 3.5:4b completes step 1 then generates a summary response instead of continuing to steps 2-3. Classic small-model behavior.
3. **Docker QEMU overhead**: opencode x64 binary under Docker container QEMU on ARM64 is extremely slow -- 9 minutes of overhead before model even starts working.
4. **Local SIGSEGV**: opencode x64 binary crashes ~60% of attempts under Windows ARM64 QEMU emulation (exit code 139).

## Decisions

- qwen3.5:4b-opencode-agent Modelfile created (FROM qwen3.5:4b, no system prompt, temp=0)
- Prompt prefix added: tool steering directives + /no_think for Qwen 3.5
- Docker baseURL adjustment to host.docker.internal confirmed working (Ollama reachable from container)
- npm install -g opencode-ai works in Docker container (v1.2.24)

## Files Modified (uncommitted)

- `src/agents/opencode/index.ts` -- switched to qwen3.5-4b-opencode-agent, stronger prompt prefix
- `src/agents/opencode/opencode.skill-eval-agent.json` -- updated model references
- `tests/opencode-agent.test.ts` -- updated model assertions
- `src/agents/opencode/qwen3.5-4b-opencode-agent.Modelfile` -- new (untracked)
- `src/agents/opencode/qwen2.5-7b-opencode-agent.Modelfile` -- new (untracked)

## Metrics

| Run | Provider | Model | Duration | Reward | Notes |
|-----|----------|-------|----------|--------|-------|
| Docker | qwen3.5:4b | 646s | 0.00 | Zero tool calls, QEMU overhead |
| Local | qwen3.5:4b | 381s | 0.00 | Ran superlint check only, stopped early |
| Local | qwen3.5:4b (strong prompt) | 600s | timeout | Ran full duration, no app.js changes |

## Next Steps

Moved to Phase 5.1 for research on:
- Multi-step tool execution at 4B scale
- qwen3.5:4b-q8_0 (higher precision) testing
- Docker QEMU mitigation
- Go/no-go decision on opencode path vs OllamaToolAgent fallback
