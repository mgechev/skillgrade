---
name: skillgrade-graders
description: Authors deterministic, LLM rubric, and human graders for skillgrade evaluations. Use when creating scoring scripts, writing evaluation rubrics, setting up human review workflows, or combining multiple graders with weighted scoring. Don't use for setting up eval pipelines, configuring eval.yaml defaults, or general test writing.
---

# Skillgrade Grader Authoring

## Procedures

**Step 1: Identify the Grading Strategy**
1. Determine which grader types the task needs:
   - **Deterministic**: objective verification — file checks, output comparison, test execution.
   - **LLM rubric**: qualitative assessment — workflow compliance, code quality, reasoning.
   - **Human**: subjective judgment — design fidelity, UX, documentation clarity.
2. For most tasks, combine deterministic (weight 0.7) and LLM rubric (weight 0.3).
3. Add a human grader when automated checks can't reliably measure quality.

**Step 2: Write a Deterministic Grader**
1. Create a script in the skill's `graders/` directory (bash or TypeScript).
2. The script must output a JSON object to stdout with the following structure:
   ```json
   {"score": 0.67, "details": "2/3 checks passed", "checks": [{"name": "check-name", "passed": true, "message": "Description"}]}
   ```
3. `score` (0.0–1.0) and `details` are required. `checks` is optional but recommended.
4. Read `references/grader-output-schema.md` for the full output specification.
5. Use `awk` for arithmetic in bash scripts — `bc` is not available in `node:20-slim`.
6. Access task context via `SKILLGRADE_INPUT` env var (JSON with `task`, `trial`, `expected`, `metadata`).
7. Reference the grader in eval.yaml:
   ```yaml
   - type: deterministic
     run: bash graders/check.sh
     weight: 0.7
   ```

**Step 3: Write an LLM Rubric Grader**
1. Draft a rubric with explicit scoring criteria and point allocations.
2. Structure the rubric into weighted sections that sum to 1.0:
   ```
   Workflow Compliance (0-0.5):
   - Did the agent follow the mandatory workflow steps?
   Efficiency (0-0.5):
   - Completed in ≤5 commands without trial-and-error?
   ```
3. Reference the rubric in eval.yaml:
   ```yaml
   - type: llm_rubric
     rubric: |
       [rubric text or file path]
     weight: 0.3
     provider: gemini               # optional: gemini (default) | anthropic | openai
     model: gemini-3.5-flash        # optional model override (defaults to the latest dynamically resolved flash model)
   ```
4. For long rubrics, store in a separate file and reference by path: `rubric: rubrics/quality.md`.

**Step 4: Write a Human Grader**
1. Define a prompt that tells the reviewer what to evaluate:
   ```yaml
   - type: human
     prompt: |
       Does the generated UI match the design spec?
       Check layout, colors, and responsive behavior.
     weight: 0.5
   ```
2. When the grader runs, it writes context to `<workspace>/.review/<task>-<trial>.json` and prints a banner.
3. The reviewer writes a result file at `<workspace>/.review/<task>-<trial>.result.json`:
   ```json
   {"score": 0.8, "details": "Layout matches, colors are off on mobile"}
   ```
4. The grader polls for the result file (30-minute timeout).

**Step 5: Combine Multiple Graders**
1. Assign weights to each grader based on importance. Weights are normalized automatically.
2. Final reward is calculated as: `Σ (grader_score × weight) / Σ weight`.
3. Example configuration:
   ```yaml
   graders:
     - type: deterministic
       run: bash graders/check.sh
       weight: 0.7      # 70% — did it work?
     - type: llm_rubric
       rubric: rubrics/quality.md
       weight: 0.2      # 20% — was the approach good?
     - type: human
       prompt: Is the output production-ready?
       weight: 0.1      # 10% — human sign-off
   ```

**Step 6: Write Graders for Multi-Turn Tasks**
1. Each turn in a multi-turn task can have its own graders.
2. Graders run after each turn completes — they see the cumulative workspace state.
3. Grader results from all turns are aggregated into the trial's final reward.

**Step 7: Write Graders for Dataset Tasks**
1. For dataset-expanded tasks, each row's data is available as `expected` in `SKILLGRADE_INPUT`.
2. Write one grader script that uses `expected` to dynamically check the correct answer:
   ```js
   const { expected } = JSON.parse(process.env.SKILLGRADE_INPUT);
   const answer = JSON.parse(fs.readFileSync('answer.json', 'utf8'));
   const score = answer.result === expected.expected_output ? 1 : 0;
   ```

**Step 8: Validate Graders**
1. Create a reference solution script that produces the expected output.
2. Run `skillgrade --validate` to verify graders score the reference solution correctly.
3. Test only deterministic graders: `skillgrade --grader=deterministic` (skips LLM calls, faster iteration).
4. Test only LLM rubric graders: `skillgrade --grader=llm_rubric`.
5. Run a specific eval with a specific grader type: `skillgrade --eval=my-eval --grader=deterministic`.
6. If a grader returns unexpected scores, inspect the script output and adjust scoring logic.

## Error Handling
* If a deterministic grader outputs non-JSON, ensure all `echo`/`console.log` statements except the final JSON result are redirected to stderr.
* If an LLM rubric grader returns 0.00 with a missing API key message, set the appropriate key for your provider: `GEMINI_API_KEY` (provider: gemini), `ANTHROPIC_API_KEY` (provider: anthropic), or `OPENAI_API_KEY` (provider: openai).
* To use a custom/self-hosted LLM endpoint, set `ANTHROPIC_BASE_URL` (for provider: anthropic) or `OPENAI_BASE_URL` (for provider: openai) — e.g. for Ollama or vLLM.
* If scores are inconsistent across trials, reduce rubric ambiguity by adding concrete examples of passing and failing behavior.
* If a human grader times out (30 minutes), it returns a score of 0. Write the result file promptly.
