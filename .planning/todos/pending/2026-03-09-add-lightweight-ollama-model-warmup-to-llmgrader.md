---
created: 2026-03-09T15:23:02.768Z
title: Add lightweight Ollama model warmup to LLMGrader
area: grader
files:
  - src/graders/index.ts:251-299
  - tests/benchmark-grader.ts
---

## Problem

The first `callOllama` invocation pays a cold-start penalty because the model must be loaded into GPU/CPU memory before inference begins. On local ARM64 (Snapdragon X Elite), qwen2.5:3b's first call takes ~81s on 4-vCPU CI runners vs ~12s warm — exceeding the 60s timeout and forcing a timeout-then-retry cycle that wastes 60s.

The `callOllamaWithRetry` mechanism (3 retries) handles this implicitly: the first attempt times out, the second hits a warm model and succeeds. But this wastes the full timeout duration on the first attempt unnecessarily.

Discovered during Phase 2.1 benchmark analysis: CI logs showed qwen2.5:3b cold=81s, warm=12s; llama3.2:3b cold=78s, warm=6.5s.

## Solution

Add a lightweight warmup call before the first real grading request:

1. Send a minimal `/api/generate` request with `num_predict: 1` and a short prompt (e.g., "hi") to force model loading without generating a full response.
2. Place it in the `grade()` method or as a lazy-init pattern in LLMGrader (warm up once per instance).
3. This should add ~5-10s startup cost but eliminate the 60s timeout waste on cold starts.

Alternative: increase the timeout for the first attempt only, or detect cold vs warm state via `/api/tags` endpoint (check if model is loaded).
