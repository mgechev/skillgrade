# Task: Fix N+1 Query Performance Issue

You have a Node.js application in `app.js` that suffers from N+1 query problems when fetching data from a SQLite database.

## Your Goal

1. Identify all N+1 query patterns in `app.js`
2. Fix each by using JOINs or batch queries
3. The optimized code must produce identical results

## Requirements

- Replace loops with individual queries by using JOINs or WHERE IN clauses
- Do NOT change the response format (same JSON structure)
- Do NOT modify the database schema
- The fixed code must pass all correctness tests

## Files

- `app.js` — The application with N+1 queries (edit this file)
- `db.js` — Database setup (do not modify)
- `test_correctness.js` — Correctness tests (do not modify)
