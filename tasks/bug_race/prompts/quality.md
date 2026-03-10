# Race Condition Bug Fix Quality Rubric

## Bug Detection (0–0.3)
- 0.3: All 5 race condition bugs identified (missing await, concurrent state, forEach async, parallel fire-and-forget, try-catch async)
- 0.2: 3-4 identified
- 0.1: 1-2 identified
- 0.0: None identified

## Fix Quality (0–0.4)
- 0.4: All fixes correct (proper await, mutex/sequential for shared state, Promise.all for parallel, for-of for async iteration)
- 0.3: Most fixes correct
- 0.2: Some fixes correct
- 0.1: Fixes attempted but still racy
- 0.0: No fixes

## Async Pattern Understanding (0–0.3)
- 0.3: Demonstrates understanding of JS event loop, Promise behavior, and concurrency patterns
- 0.2: Mostly understands
- 0.1: Partial understanding
- 0.0: No understanding shown

Return JSON: {"score": <float 0.0-1.0>, "reasoning": "<explanation>"}
