---
created: "2026-03-08T21:49:18.239Z"
title: Ollama LLM grader times out in bootstrap test on ARM64
area: testing
files:
  - src/graders/index.ts:190-230
  - tests/bootstrap.test.ts
---

## Problem

When running `npm run test:bootstrap` on a Snapdragon X Elite ARM64 machine, the Ollama LLM grader times out during the grading phase. The `qwen3:4b` model runs on CPU (no GPU acceleration on this hardware), and inference is too slow to complete within the 5-minute default timeout configured in `callOllama`.

Bootstrap test output shows:
```
[LLMGrader] Ollama call failed: The operation was aborted due to timeout
```

The deterministic grader still scores 1.0 (weight 0.7), so the overall reward is 0.70. The LLM rubric score is 0.00 (weight 0.3) because the timeout prevents any LLM grading from completing.

This is an environment/hardware constraint, not a code bug. On machines with GPU acceleration or faster CPUs, the timeout may be sufficient. However, the default timeout should either be configurable or the system should detect slow hardware and adjust.

## Solution

Possible approaches:
- Make Ollama generation timeout configurable via `SKILL.md` frontmatter or grader config (e.g., `ollama_timeout: 600000`)
- Auto-detect ARM64/CPU-only environments and extend timeout
- Use a smaller/faster model for grading on resource-constrained hardware (e.g., `phi3.5:3.8b` instead of `qwen3:4b`)
- Add a `--skip-llm-grading` flag to bootstrap test for quick verification runs
