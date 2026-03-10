# Task: Fix Path Traversal Vulnerabilities

You have a Node.js Express file server in `app.js` that has path traversal vulnerabilities.

## Your Goal

1. Identify all path traversal vulnerabilities in `app.js`
2. Fix each vulnerability by properly validating and sanitizing file paths
3. Ensure the application still serves files correctly after fixes

## Requirements

- Validate that resolved file paths stay within the allowed directory
- Use `path.resolve()` and check paths are within the base directory
- Do NOT change the API endpoints or their routes
- Do NOT remove any functionality — files should still be serveable
- The fixed code must still pass the existing functionality tests

## Files

- `app.js` — The vulnerable application (edit this file)
- `test_functional.js` — Functionality tests (do not modify)
- `public/` — The allowed file serving directory (do not modify)
