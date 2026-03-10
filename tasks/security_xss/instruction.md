# Task: Fix Cross-Site Scripting (XSS) Vulnerabilities

You have a Node.js Express application in `app.js` that serves HTML with XSS vulnerabilities.

## Your Goal

1. Identify all XSS vulnerabilities in `app.js`
2. Fix each vulnerability by properly escaping/sanitizing output
3. Ensure the application still renders correctly after fixes

## Requirements

- Properly escape HTML entities in all user-controlled output
- Do NOT change the API endpoints or their routes
- Do NOT add external sanitization libraries — implement escaping manually
- The fixed code must still pass the existing functionality tests

## Files

- `app.js` — The vulnerable application (edit this file)
- `test_functional.js` — Functionality tests (do not modify)
