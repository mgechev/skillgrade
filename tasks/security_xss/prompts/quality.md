# XSS Fix Quality Rubric

Evaluate the agent's XSS vulnerability remediation.

## Vulnerability Detection (0–0.3)
- 0.3: Identified all 4 XSS points (search, messages, error, profile)
- 0.2: Identified 3 of 4
- 0.1: Identified 1-2
- 0.0: None identified

## Fix Quality (0–0.4)
- 0.4: Proper escapeHtml function covering &, <, >, ", '; applied to all user inputs
- 0.3: Escape function exists and mostly correct
- 0.2: Some outputs escaped but inconsistent
- 0.1: Minimal/incorrect escaping
- 0.0: No fixes

## Completeness (0–0.3)
- 0.3: All 4 endpoints fixed, no remaining XSS vectors
- 0.2: 3 of 4 fixed
- 0.1: 1-2 fixed
- 0.0: None fixed

Return JSON: {"score": <float 0.0-1.0>, "reasoning": "<explanation>"}
