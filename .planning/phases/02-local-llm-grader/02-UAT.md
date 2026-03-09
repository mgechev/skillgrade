---
status: diagnosed
phase: 02-local-llm-grader
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md
started: 2026-03-08T22:30:00Z
updated: 2026-03-09T00:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Ollama Grader Mock Tests Pass
expected: Run `npm run test:ollama-grader`. All 19 tests pass covering: Ollama health check, model availability, retry logic for malformed JSON, fallback chain (Ollama -> Gemini -> Anthropic), JSON schema structured output, and model name prefix matching (e.g. "qwen3" matches "qwen3:latest").
result: pass

### 2. SKILL.md Agent Frontmatter
expected: Open `tasks/superlint_demo/skills/superlint/SKILL.md`. File begins with YAML frontmatter containing `name: superlint` and a `description` field. This enables agent CLI auto-discovery of the skill.
result: pass

### 3. Evaluation Without Ollama (Graceful Degradation)
expected: With Ollama NOT running, run `npm run eval:superlint`. Deterministic grader scores 1.0. LLM grader gracefully degrades to score 0 (no crash, no unhandled error). Overall pass_rate is approximately 0.70 (from weighted average: 1.0 * 0.7 + 0.0 * 0.3). Console output shows a warning about Ollama being unavailable, not an unhandled exception.
result: pass

### 4. Local Provider PATH Augmentation
expected: Run `npx ts-node tests/local-provider.test.ts`. All 3 tests pass confirming: workspace bin/ is prepended to PATH in spawned bash processes, task CLI tools are executable by name (not requiring absolute paths), and custom environment variables are preserved alongside the PATH augmentation.
result: issue
reported: "FAIL: workspace bin/ is first on PATH - FAIL: Expected first PATH entry to end with /bin, got /usr/local/sbin. PASS: task-provided CLI is executable by name. FAIL: custom env vars are preserved - FAIL: Expected 'hello', got ''. Note: passes from Git Bash but fails from PowerShell terminal."
severity: major

### 5. Bootstrap End-to-End Test
expected: Run `npm run test:bootstrap` with Ollama running. LLM grader produces an actual 0.0-1.0 score from Ollama inference (not 0.00 from timeout). Deterministic grader scores 1.0. This verifies Success Criterion 1: Ollama produces real LLM grading scores with no cloud API keys.
result: issue
reported: "Core LLM grading works: llm_rubric=1.00 and deterministic=1.00 across Local (1-trial, 3-trial, with logDir) and Docker provider tests. However, the Secret Injection & Sanitization test fails: reward=0.00, agent ran only 1 command in 10s ('Checking for secret...'), did not follow superlint workflow. Both graders scored 0.00. Secret test appears to alter agent behavior away from normal task workflow."
severity: minor

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "workspace bin/ is prepended to PATH in spawned bash processes, CLI tools executable by name, custom env vars preserved"
  status: failed
  reason: "User reported: 2/3 tests fail from PowerShell. PATH first entry is /usr/local/sbin (not bin/), custom env var empty. Tool-by-name test passes. All 3 pass from Git Bash but not PowerShell."
  severity: major
  test: 4
  root_cause: "Two issues: (1) MSYS2 bash always runs as login shell on Windows (shopt login_shell=yes), sourcing /etc/profile which reconstructs PATH with MSYS2 defaults + user profile scripts (FNM etc.) prepended. This pushes workspace bin/ down the PATH list. (2) User's custom bash profile scripts (for FNM node version management) may export env vars and reorder PATH. spawn with shell:'bash' has no way to suppress /etc/profile since MSYS2 forces login shell behavior. User guidance: Test 1 assertion is too strict — should check bin/ is in PATH and precedes system dirs, not that it's first entry."
  artifacts:
    - path: "src/providers/local.ts"
      issue: "spawn with shell:'bash' allows MSYS2 login shell initialization; env spread may create both Path and PATH keys on Windows"
    - path: "tests/local-provider.test.ts"
      issue: "Test 1 asserts first PATH entry is bin/ — too strict for MSYS2 where profiles prepend entries. Test 3 env var propagation fails from PowerShell."
  missing:
    - "Test 1: Change assertion to verify bin/ is in PATH and precedes /usr/bin (system dirs), not necessarily first"
    - "Test 3 / local.ts: Use spawn('bash', ['--norc', '--noprofile', '-c', command]) to suppress profile sourcing that may clear env vars"
    - "local.ts: Delete all case-variants of Path/PATH from process.env spread before setting PATH"
    - "local.ts: Use delete instead of undefined for BASH_ENV/ENV removal"
    - "Secret injection test: Fix sanitization assertion to not require [REDACTED] when env var never reached subprocess"
  debug_session: ""

- truth: "Running an evaluation with Ollama produces 0.0-1.0 LLM scores using local model with no cloud API keys"
  status: resolved
  reason: "User reported: llm_rubric scored 0.00 despite Ollama running. qwen3:4b inference does not complete within timeout on ARM64 CPU. Success Criterion 1 not met."
  severity: blocker
  test: 5
  root_cause: "Three compounding issues: (1) Hardcoded AbortSignal.timeout(300000) at src/graders/index.ts:238 is 5 min but should be ~60s for grader response (5 min was the trial budget, not grader budget). (2) qwen3:4b is a thinking model that generates chain-of-thought tokens before the answer, consuming most of num_predict:2048 budget on thinking. (3) No explicit num_ctx set -- Ollama defaults to 2048 (NOT model's native 32,768), which may silently truncate grading prompt (~825 tokens) + response budget (2048) = ~2900 tokens needed. At 2048 default, prompt is truncated from beginning with no warning. (4) Silent failure -- evalRunner.ts prints score but not details, hiding the timeout reason."
  artifacts:
    - path: "src/graders/index.ts"
      issue: "Line 238: hardcoded 300s timeout. Line 129/223: default model qwen3:4b is a thinking model. Line 250-253: error logged as console.warn only. No num_ctx set in Ollama API call."
    - path: "src/types.ts"
      issue: "Lines 15-21: GraderConfig has no timeout_ms or num_ctx field"
    - path: "src/evalRunner.ts"
      issue: "Lines 51-53: output loop prints score but not details when score is 0"
  missing:
    - "Reduce grader timeout to 60s (1 min) -- grading a single response should not take 5 min"
    - "Set explicit num_ctx in Ollama API call (default 4096) -- Ollama defaults to 2048 which silently truncates prompt (~825 tokens) + response (2048) = ~2900 tokens needed"
    - "Make timeout_ms configurable via GraderConfig / task.toml"
    - "Switch default model to a non-thinking model (e.g. phi3.5:3.8b) or make model configurable per task"
    - "Surface grader failure details in evalRunner output when score is 0"
  debug_session: ".planning/debug/ollama-grader-score-zero-arm64.md"

- truth: "Secret injection test: agent receives injected secret, follows normal task workflow, secret is redacted from logs"
  status: failed
  reason: "User reported: Secret Injection & Sanitization test fails with reward=0.00. Agent ran only 1 command in 10s ('Checking for secret...'), did not follow superlint workflow. Both graders scored 0.00. Core LLM grading works (llm_rubric=1.00 in all other tests)."
  severity: minor
  test: 5
  root_cause: "Two issues: (1) reward=0.00 is EXPECTED — the secretAgent intentionally only runs echo, not the superlint workflow, so both graders correctly score 0. (2) The REAL failure is in the sanitization assertion: $MY_SECRET expands to empty string in bash subprocess (same env var propagation bug as Test 4), so sanitize() finds nothing to replace, [REDACTED] never appears in log, and the test hits the else branch ('not found and not redacted'). Fix depends on fixing env var propagation in local.ts (shared root cause with Test 4)."
  artifacts:
    - path: "tests/bootstrap.test.ts"
      issue: "Lines 138-146: sanitization assertion assumes secret appears in stdout then gets redacted; no fallback for env var never reaching subprocess"
    - path: "src/providers/local.ts"
      issue: "Same spawn env var propagation issue as Test 4 — env vars lost in MSYS2 profile sourcing from PowerShell"
    - path: "secret_logs/superlint_demo_2026-03-09T00-09-34-928Z.json"
      issue: "stdout shows 'The secret is \\n' — empty expansion confirms env var did not reach bash"
  missing:
    - "Fix env var propagation in local.ts (shared fix with Test 4)"
    - "Update sanitization test to verify secret is NOT in logs (positive assertion) rather than requiring [REDACTED] to appear"
  debug_session: ".planning/debug/secret-injection-reward-zero.md"
