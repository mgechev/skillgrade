# Code Structure Improvement Quality Rubric

## Decomposition (0–0.4)
- 0.4: Functions properly decomposed, each with single responsibility
- 0.3: Most logic separated but some mixed concerns remain
- 0.2: Some extraction but large functions remain
- 0.1: Minimal extraction
- 0.0: No structural improvement

## Nesting Reduction (0–0.3)
- 0.3: Early returns used effectively, max nesting <= 3
- 0.2: Some nesting reduced
- 0.1: Minimal nesting reduction
- 0.0: No nesting changes

## Correctness (0–0.3)
- 0.3: Refactored code produces identical results
- 0.2: Mostly correct with minor differences
- 0.1: Some behavior changes
- 0.0: Broken after refactoring

Return JSON: {"score": <float 0.0-1.0>, "reasoning": "<explanation>"}
