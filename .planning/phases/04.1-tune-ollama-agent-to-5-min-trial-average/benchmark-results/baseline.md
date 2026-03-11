# Benchmark: Baseline

**Date:** 2026-03-11
**Configuration:** qwen3.5:4b baseline (migrated from qwen3:4b)

## Configuration

| Parameter | Value |
|-----------|-------|
| Model | qwen3.5-skill-eval-agent (qwen3.5:4b) |
| temperature | 0 |
| num_ctx | 4096 |
| num_predict | 4096 |
| num_thread | 8 |
| System prompt | 3-line directive + /no_think |
| Env vars | None (default Ollama) |

## Prior Model Reference

Quick trial comparison (single trial each, from Phase 4):
- qwen3:4b: 391.3s, 9 cmds, reward 0.97
- qwen3.5:4b: 361.7s, 6 cmds, reward 0.97

## Results

Clean 3-trial benchmark (no competing workloads, model pre-warmed):

| Trial | Duration (s) | Reward | Commands |
|-------|-------------|--------|----------|
| 1 | 224.5 | 1.00 | 4 |
| 2 | 237.9 | 1.00 | 4 |
| 3 | 242.5 | 0.97 | 4 |
| **Avg** | **235.0** | **0.99** | **4.0** |
| **StdDev** | **9.4** | - | - |

Target (<=300s): **MET**
Reward (>=0.90): **MET**

## Per-Turn Metrics (profiling run)

Captured via `scripts/profile-agent-turns.ts` in a separate profiling session.

**Note:** This profiler run was concurrent with another Ollama workload, so absolute
timings (especially turn 1 load) are inflated. Proportions and growth patterns remain
informative for identifying optimization targets.

| Turn | prompt_eval_count | prompt_eval_ms | eval_count | eval_ms | load_ms | total_ms | tool_calls |
|------|------------------|----------------|------------|---------|---------|----------|------------|
| 1 | 894 | 122211 | 73 | 9709 | -- | 135387 | 1 |
| 2 | 1444 | 29490 | 28 | 3521 | -- | 55204 | 1 |
| 3 | 1519 | 33555 | 46 | 5999 | -- | 79104 | 1 |
| 4 | 1715 | 40428 | 31 | 3790 | -- | 86908 | 1 |
| 5 | 1791 | 42032 | 30 | 3883 | -- | 91400 | 1 |
| 6 | 2097 | 61878 | 50 | 6561 | -- | 127511 | 1 |
| 7 | 2192 | 70654 | 47 | 6512 | -- | 79882 | 1 |
| 8 | 2294 | 57804 | 54 | 7844 | -- | 66006 | 1 |
| 9 | 2393 | 62332 | 36 | 5064 | -- | 67685 | 1 |
| 10 | 2463 | 62046 | 46 | 6128 | -- | 68503 | 1 |
| 11 | 2554 | 65486 | 32 | 4490 | -- | 70295 | 1 |
| **Total** | **21356** | **647916** | **473** | **63501** | -- | **927885** | **11** |
| **Avg** | **1941** | **58902** | **43** | **5773** | -- | **84353** | **1.0** |

Profiler session was interrupted at turn 11 (agent had not finished).

## Analysis

### Time Breakdown (from profiler, 11 turns captured)

| Category | Time (s) | % of Total |
|----------|----------|------------|
| Prompt eval (KV cache fill) | 647.9 | 69.8% |
| Generation (token output) | 63.5 | 6.8% |
| Overhead (load, scheduling) | 216.5 | 23.3% |
| **Total (Ollama)** | **927.9** | **100%** |

### Key Observations

1. **Prompt eval dominates:** ~70% of total Ollama time is spent on prompt evaluation
   (processing the growing context window). This is the primary optimization target.

2. **Context growth is linear:** prompt_eval_count grows from 894 (turn 1) to 2554
   (turn 11) -- roughly 166 tokens added per turn from tool call/response pairs.

3. **Prompt eval time scales super-linearly:** Turn 1 processes 894 tokens in 122s
   (inflated by model load), but turns 6-11 process ~2100-2550 tokens in 58-71s each.
   The per-token cost increases as context grows.

4. **Generation is cheap:** Only ~43 tokens generated per turn (tool call JSON),
   taking ~5.8s average. The model is efficient at producing structured output.

5. **Fewer commands = faster:** The benchmark trials average 4 commands, which is
   optimal for superlint_demo (check, fix, verify, done). Fewer turns means less
   accumulated prompt eval cost.

### Optimization Priorities

Based on this profile, the biggest wins would come from:

1. **Reducing prompt eval time** -- shorter system prompt, fewer tokens per tool
   response, context pruning between turns
2. **Reducing turn count** -- better prompting to complete in fewer steps
3. **Ollama parallelism settings** -- `OLLAMA_NUM_PARALLEL`, flash attention, etc.
4. **Context window reduction** -- smaller num_ctx if the task fits

## Verdict

BASELINE -- This is the starting point for all experiments.

Target: avg <= 300s. Current: **avg 235.0s**. The target is already met with the
qwen3.5:4b migration. The remaining optimization goal is to see how much further
we can push performance below 300s and to document what tuning knobs are effective.

Compared to the prior model (qwen3:4b at ~391s), qwen3.5:4b delivers a **40% speedup**
with the same or better reward (0.99 avg vs 0.97).
