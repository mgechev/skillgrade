# Off-by-One Bug Fix Quality Rubric

## Bug Detection (0–0.4)
- 0.4: All 6 off-by-one bugs correctly identified and explained
- 0.3: 5 bugs identified
- 0.2: 3-4 bugs identified
- 0.1: 1-2 bugs identified
- 0.0: No bugs identified

## Fix Quality (0–0.3)
- 0.3: All fixes are minimal and targeted (only changed the boundary condition)
- 0.2: Most fixes are minimal
- 0.1: Some fixes involve unnecessary refactoring
- 0.0: Rewrote functions instead of fixing

## Root Cause Analysis (0–0.3)
- 0.3: Explained the root cause of each off-by-one error
- 0.2: Explained most
- 0.1: Minimal explanation
- 0.0: No explanation

Return JSON: {"score": <float 0.0-1.0>, "reasoning": "<explanation>"}
