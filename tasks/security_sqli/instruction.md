# Task: Fix SQL Injection Vulnerabilities

You have a Node.js Express application in `app.js` that has SQL injection vulnerabilities.

## Your Goal

1. Identify all SQL injection vulnerabilities in `app.js`
2. Fix each vulnerability by using parameterized queries
3. Ensure the application still works correctly after fixes

## Requirements

- Use parameterized queries (placeholder `?`) instead of string concatenation
- Do NOT change the API endpoints or their behavior
- Do NOT change the database schema
- The fixed code must still pass the existing functionality tests

## Files

- `app.js` — The vulnerable application (edit this file)
- `db.js` — Database setup (do not modify)
- `test_functional.js` — Functionality tests (do not modify)
