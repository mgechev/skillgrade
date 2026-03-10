# Security Fix Quality Rubric

Evaluate the agent's security vulnerability remediation.

## Vulnerability Detection (0–0.4)
- 0.4: Identified all 4 SQL injection points (search, login, products, delete)
- 0.3: Identified 3 of 4 vulnerabilities
- 0.2: Identified 2 of 4 vulnerabilities
- 0.1: Identified only 1 vulnerability
- 0.0: Failed to identify any vulnerabilities

## Fix Quality (0–0.4)
- 0.4: All fixes use proper parameterized queries, ORDER BY is whitelisted
- 0.3: Most fixes correct, minor issues
- 0.2: Some fixes applied but inconsistent approach
- 0.1: Attempted fixes but still vulnerable
- 0.0: No meaningful fixes applied

## Explanation (0–0.2)
- 0.2: Clear explanation of each vulnerability and why the fix works
- 0.1: Partial explanation
- 0.0: No explanation provided

Return JSON: {"score": <float 0.0-1.0>, "reasoning": "<explanation>"}
