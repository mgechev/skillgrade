# N+1 Query Fix Quality Rubric

## Fix Correctness (0–0.4)
- 0.4: All 3 functions fixed, N+1 eliminated, results identical
- 0.3: 2 of 3 functions fixed correctly
- 0.2: 1 function fixed correctly
- 0.1: Attempted but broken results
- 0.0: No fixes

## Technique (0–0.3)
- 0.3: Uses JOINs and/or WHERE IN efficiently; minimal query count
- 0.2: Uses batch queries but not optimal
- 0.1: Reduces queries but still suboptimal
- 0.0: Still has N+1 pattern

## Explanation (0–0.3)
- 0.3: Clearly explains N+1 problem and how JOINs/batching solves it
- 0.2: Partial explanation
- 0.1: Minimal explanation
- 0.0: No explanation

Return JSON: {"score": <float 0.0-1.0>, "reasoning": "<explanation>"}
