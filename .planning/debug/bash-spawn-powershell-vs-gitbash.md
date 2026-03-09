---
status: resolved
trigger: "Investigate why LocalProvider.runCommand's bash spawn fails from PowerShell but works from Git Bash on Windows."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T13:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - Superseded by local-provider-path-powershell.md debug session
test: n/a
expecting: n/a
next_action: n/a - merged into primary debug session

## Symptoms

expected: Test 1 - first PATH entry is workspace bin/ dir; Test 3 - MY_CUSTOM_VAR equals 'hello'
actual: Test 1 - first PATH entry is /usr/local/sbin; Test 3 - MY_CUSTOM_VAR is empty string
errors: |
  Test 1: Expected first PATH entry to include workspace ID, got /usr/local/sbin
  Test 3: Expected 'hello', got ''
reproduction: Run tests from PowerShell (not Git Bash)
started: Observed when running from PowerShell; works from Git Bash

## Eliminated

(none - investigation moved to local-provider-path-powershell.md)

## Evidence

See local-provider-path-powershell.md for complete evidence chain.

## Resolution

root_cause: Same as local-provider-path-powershell.md - WSL bash (system32) resolves instead of Git Bash from PowerShell
fix: See local-provider-path-powershell.md
verification: See local-provider-path-powershell.md
files_changed: []
