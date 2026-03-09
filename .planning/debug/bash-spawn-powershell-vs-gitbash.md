---
status: investigating
trigger: "Investigate why LocalProvider.runCommand's bash spawn fails from PowerShell but works from Git Bash on Windows."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: MSYS2 startup scripts (profile/bashrc) are sourced when bash is launched as a non-interactive non-login shell from a PowerShell-originated Node process, reordering PATH and clearing custom env vars
test: inspect /etc/profile, /etc/bash.bashrc, and related MSYS2 startup files for PATH manipulation; check Node spawn shell mode behavior
expecting: profile or bashrc resets PATH to MSYS2 defaults, and custom vars are lost because env inheritance chain is broken
next_action: read MSYS2 startup scripts and Node.js spawn 'shell' option behavior

## Symptoms

expected: Test 1 - first PATH entry is workspace bin/ dir; Test 3 - MY_CUSTOM_VAR equals 'hello'
actual: Test 1 - first PATH entry is /usr/local/sbin; Test 3 - MY_CUSTOM_VAR is empty string
errors: |
  Test 1: Expected first PATH entry to include workspace ID, got /usr/local/sbin
  Test 3: Expected 'hello', got ''
reproduction: Run tests from PowerShell (not Git Bash)
started: Observed when running from PowerShell; works from Git Bash

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-09T00:00:00Z
  checked: src/providers/local.ts
  found: spawn(command, { shell: 'bash', env: { ...process.env, ...env, PATH: binDir+':'+currentPath, BASH_ENV: undefined, ENV: undefined } })
  implication: shell:'bash' means Node passes command to bash as "bash -c <command>". Setting BASH_ENV/ENV to undefined is intended to suppress startup file sourcing, but undefined values may not be passed to the child process at all.

- timestamp: 2026-03-09T00:00:00Z
  checked: tests/local-provider.test.ts
  found: Test 1 runs echo "$PATH", Test 2 runs a named tool, Test 3 runs echo "$MY_CUSTOM_VAR" with env {MY_CUSTOM_VAR:'hello'}
  implication: Test 2 passes (tool found on PATH) but Test 1 fails (PATH order wrong) - this means bin/ IS on PATH but not first. Test 3 fails meaning env vars are lost or overwritten.

## Resolution

root_cause:
fix:
verification:
files_changed: []
