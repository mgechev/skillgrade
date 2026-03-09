---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/ci.yml
autonomous: true
requirements: [CI-SPLIT]
must_haves:
  truths:
    - "CI has exactly two test jobs: test-integration and test-unit"
    - "test-integration runs only npm run test:bootstrap"
    - "test-unit runs npm run test:analytics, test:ollama-grader, and test:local-provider"
    - "typecheck and build jobs remain unchanged"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "Consolidated CI workflow with two test jobs"
      contains: "test-integration"
  key_links: []
---

<objective>
Consolidate the four separate CI test jobs into two: test-integration (bootstrap) and test-unit (analytics, ollama-grader, local-provider).

Purpose: The bootstrap test exercises the full eval pipeline (integration/e2e), while the other three are unit tests. Grouping them by type clarifies intent and reduces runner overhead from 4 jobs to 2.
Output: Updated `.github/workflows/ci.yml`
</objective>

<context>
Current CI workflow has 6 jobs: typecheck, build, test-bootstrap, test-analytics, test-ollama-grader, test-local-provider. The goal is to keep typecheck and build unchanged, replace the 4 test-* jobs with 2 consolidated jobs.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Consolidate CI test jobs into test-integration and test-unit</name>
  <files>.github/workflows/ci.yml</files>
  <action>
Replace the four test jobs (test-bootstrap, test-analytics, test-ollama-grader, test-local-provider) with two jobs:

1. `test-integration` job:
   - name: "Test (integration)"
   - runs-on: ubuntu-24.04-arm
   - timeout-minutes: 20
   - Steps: checkout, setup-node composite action, run `npm run test:bootstrap`

2. `test-unit` job:
   - name: "Test (unit)"
   - runs-on: ubuntu-24.04-arm
   - timeout-minutes: 20
   - Steps: checkout, setup-node composite action, then run all three unit test scripts sequentially:
     - `npm run test:analytics`
     - `npm run test:ollama-grader`
     - `npm run test:local-provider`
   - Use a single `run:` block with the three commands separated by newlines (multi-line YAML scalar with `|`).

Keep the typecheck and build jobs exactly as they are. Keep all top-level workflow keys (name, on, permissions, concurrency, env) unchanged.
  </action>
  <verify>
    <automated>node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); const jobs=['test-integration','test-unit','typecheck','build']; const missing=jobs.filter(j=>!y.includes(j+':')); const removed=['test-bootstrap','test-analytics','test-ollama-grader','test-local-provider'].filter(j=>y.includes(j+':')); if(missing.length) { console.error('Missing jobs:', missing); process.exit(1); } if(removed.length) { console.error('Old jobs still present:', removed); process.exit(1); } console.log('[OK] CI workflow has correct job structure');"</automated>
  </verify>
  <done>CI workflow has exactly 4 jobs: typecheck, build, test-integration, test-unit. The old 4 individual test jobs are removed.</done>
</task>

</tasks>

<verification>
- CI workflow YAML is valid (no syntax errors)
- Exactly 4 jobs remain: typecheck, build, test-integration, test-unit
- test-integration runs only test:bootstrap
- test-unit runs test:analytics, test:ollama-grader, test:local-provider
- typecheck and build jobs are unchanged
</verification>

<success_criteria>
CI workflow consolidates the four test jobs into two semantically grouped jobs (integration vs unit) while preserving all existing test coverage.
</success_criteria>

<output>
No summary file needed for quick plans.
</output>
