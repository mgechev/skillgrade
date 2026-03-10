# React Re-render Fix Quality Rubric

## Optimization Correctness (0–0.4)
- 0.4: All re-render issues fixed (inline objects, callbacks, expensive computations, child components)
- 0.3: 3 of 4 issues fixed
- 0.2: 2 of 4 issues fixed
- 0.1: 1 issue fixed
- 0.0: No fixes

## Technique Appropriateness (0–0.3)
- 0.3: Correct use of React.memo, useMemo, useCallback in all cases
- 0.2: Mostly correct but some misuse (e.g., unnecessary memoization)
- 0.1: Some correct, some incorrect usage
- 0.0: Incorrect or no optimization

## Code Quality (0–0.3)
- 0.3: Clean, readable code; dependencies arrays correct
- 0.2: Minor issues in dependency arrays
- 0.1: Missing or incorrect dependency arrays
- 0.0: Broken code

Return JSON: {"score": <float 0.0-1.0>, "reasoning": "<explanation>"}
