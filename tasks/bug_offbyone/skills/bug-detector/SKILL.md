# Bug Detector Skill

## Purpose
Detect and fix common programming bugs.

## Common Bug Patterns

### Off-by-One Errors
- Array index bounds (0-based vs 1-based)
- Loop boundary conditions (< vs <=)
- Fence-post problems (n elements need n-1 separators)
- Substring/slice end indices (exclusive vs inclusive)

### Null/Undefined Reference
- Missing null checks before property access
- Optional chaining (?.) where needed
- Default values for function parameters
- Checking array/object existence before iteration

### Race Conditions
- Shared mutable state in async code
- Missing await on async operations
- Concurrent modifications to shared data
- Order-dependent operations without proper synchronization

## Debugging Workflow
1. Read the code and test cases carefully
2. Run existing tests to see which fail
3. Identify the root cause of each failure
4. Apply minimal, targeted fixes
5. Verify all tests pass after fixes
