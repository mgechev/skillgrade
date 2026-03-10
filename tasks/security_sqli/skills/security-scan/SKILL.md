# Security Scan Skill

## Purpose
Detect and remediate security vulnerabilities in source code.

## Key Patterns

### SQL Injection Prevention
- **Never** use string interpolation in SQL queries
- **Always** use parameterized queries with `?` placeholders
- **Whitelist** allowed values for ORDER BY, column names
- **Validate** and cast numeric inputs (parseInt, etc.)

### Common SQL Injection Patterns to Fix
```javascript
// BAD: String interpolation
db.prepare(`SELECT * FROM users WHERE id = '${id}'`).all();

// GOOD: Parameterized query
db.prepare('SELECT * FROM users WHERE id = ?').all(id);
```

### ORDER BY Safety
```javascript
// BAD: Direct interpolation
query += ` ORDER BY ${sort}`;

// GOOD: Whitelist approach
const allowedSorts = ['name', 'price', 'date'];
if (allowedSorts.includes(sort)) {
  query += ` ORDER BY ${sort}`;
}
```

## Workflow
1. Read the source code carefully
2. Identify all points where user input reaches SQL queries
3. Replace each with parameterized queries
4. Handle special cases (ORDER BY, LIMIT) with whitelists
5. Verify the fix doesn't break functionality
