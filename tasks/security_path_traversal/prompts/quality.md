# Path Traversal Fix Quality Rubric

Evaluate the agent's path traversal vulnerability remediation.

## Vulnerability Detection (0–0.3)
- 0.3: Identified all 4 path traversal points
- 0.2: Identified 3 of 4
- 0.1: Identified 1-2
- 0.0: None identified

## Fix Quality (0–0.4)
- 0.4: Uses path.resolve + startsWith check consistently; returns 403 for traversal
- 0.3: Mostly correct path validation
- 0.2: Some paths validated but inconsistent
- 0.1: Minimal validation
- 0.0: No fixes

## Robustness (0–0.3)
- 0.3: Handles encoded paths (../, %2e%2e), null bytes, symlinks
- 0.2: Handles basic traversal patterns
- 0.1: Only handles simple cases
- 0.0: Trivially bypassable

Return JSON: {"score": <float 0.0-1.0>, "reasoning": "<explanation>"}
