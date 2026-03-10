# Null Reference Bug Fix Quality Rubric

## Bug Detection (0–0.3)
- 0.3: All 8 null reference bugs identified
- 0.2: 5-7 identified
- 0.1: 2-4 identified
- 0.0: 0-1 identified

## Fix Quality (0–0.4)
- 0.4: All fixes use appropriate patterns (optional chaining, nullish coalescing, defaults)
- 0.3: Most fixes appropriate
- 0.2: Some fixes correct but inconsistent
- 0.1: Fixes present but poor quality
- 0.0: No fixes

## Defensive Programming (0–0.3)
- 0.3: Uses modern JS patterns (?., ??), appropriate defaults, no silent swallowing of errors
- 0.2: Mostly modern patterns
- 0.1: Uses verbose null checks
- 0.0: No improvement

Return JSON: {"score": <float 0.0-1.0>, "reasoning": "<explanation>"}
