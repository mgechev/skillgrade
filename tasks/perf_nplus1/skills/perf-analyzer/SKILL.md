# Performance Analyzer Skill

## Purpose
Detect and fix performance issues in source code.

## Key Patterns

### Algorithm Complexity
- Identify O(n²) or worse algorithms that can be O(n) or O(n log n)
- Look for nested loops over the same dataset
- Consider using hash maps/sets for O(1) lookups instead of array scans

### Database Query Optimization
- Identify N+1 query patterns (query in a loop)
- Use JOINs or batch queries instead of per-item queries
- Add appropriate indexes

### React Re-render Prevention
- Use React.memo for components that receive the same props
- Use useMemo/useCallback to memoize expensive computations
- Avoid creating new objects/arrays in render

## Workflow
1. Read the code and identify performance bottlenecks
2. Analyze the algorithmic complexity
3. Apply targeted optimizations
4. Verify the fix maintains correctness
