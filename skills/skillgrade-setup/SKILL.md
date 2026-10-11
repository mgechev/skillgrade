---
name: skillgrade-setup
description: Sets up and runs skillgrade evaluation pipelines for AI agents and Agent Skills. Use when initializing eval configurations, running trials, reviewing results, exporting reports, or integrating with CI. Don't use for writing grader scripts, general test authoring, or non-agentic documentation.
---

# Skillgrade Evaluation Setup

## Procedures

**Step 1: Install Skillgrade**
1. Verify Node.js 20+ and Docker are available.
2. Run `npm i -g skillgrade` to install the CLI globally.

**Step 2: Initialize an Eval Configuration**
1. Navigate to any project directory.
2. If the directory contains a `SKILL.md` and an API key is set, `skillgrade init` generates AI-powered tasks and graders tailored to the skill.
3. Without a `SKILL.md` or API key, `skillgrade init` creates a ready-to-edit generic eval template.
4. Pass `--force` to overwrite an existing `eval.yaml`.

**Step 3: Configure eval.yaml**
1. Read `references/eval-yaml-spec.md` for the full configuration schema.
2. Define tasks under the `tasks:` key. Each task requires:
   - `name`: unique task identifier
   - `instruction`: what the agent should accomplish (OR `turns:` for multi-turn evals)
   - `graders`: one or more scoring mechanisms (see the `skillgrade-graders` skill)
3. Optionally add `workspace:` (files the agent edits) and `context:` (reference material not directly graded).
4. Configure `defaults:` for agent, provider, trials, timeout, and threshold.
5. For multi-turn evals, replace `instruction` with `turns:` — each turn has its own `instruction` and optional `graders`. The workspace persists across turns.
6. For batch evals, add `dataset: path/to/file.jsonl` (or `.csv`) to a task. Each row expands into a separate task with `{{key}}` template variables interpolated in the instruction.

**Step 4: Run Evaluations**
1. Select an appropriate preset based on the evaluation goal:
   - `--smoke` (5 trials): Quick capability check.
   - `--reliable` (15 trials): Reliable pass rate estimate.
   - `--regression` (30 trials): High-confidence regression detection.
2. Run the evaluation: `skillgrade --smoke`.
3. Run a specific eval by name: `skillgrade --eval=fix-linting`.
4. Run multiple evals: `skillgrade --eval=fix-linting,write-tests`.
5. Run only deterministic graders (skip LLM calls): `skillgrade --grader=deterministic`.
6. Run only LLM rubric graders: `skillgrade --grader=llm_rubric`.
7. Run only human review graders: `skillgrade --grader=human`.
8. The agent is auto-detected from the API key. Override with `--agent=gemini|claude|codex|acp|opencode|command`.
9. For ACP, pass `--acp-command="gemini --acp"` or set `defaults.acp.command`.
10. For OpenCode, pass `--opencode-agent=build|plan|explore` or `--opencode-model=provider/model`.
11. For a custom agent, pass `--agent=command --command="node mycli.js"` or set `defaults.command`. The instruction is piped to the command's stdin.
12. Override the provider with `--provider=docker|local` (or any custom-registered provider).

**Step 5: Review Results**
1. Run `skillgrade preview` for a CLI report.
2. Run `skillgrade preview browser` to open the web UI at `http://localhost:3847`.
3. Export results: `--format=json|junit|csv|markdown`. Combine with commas: `--format=json,junit`.
4. Reports are saved to `$TMPDIR/skillgrade/<eval-name>/results/`. Override with `--output=DIR`.

**Step 6: Integrate with CI**
1. Add a GitHub Actions step that installs skillgrade, navigates to the eval directory, and runs with `--regression --ci --provider=local`.
2. Use `--provider=local` in CI — the runner is already an ephemeral sandbox, so Docker adds overhead without benefit.
3. The `--ci` flag causes a non-zero exit code if the pass rate falls below `--threshold` (default: 0.8).
4. Use `--format=junit` to generate JUnit XML for CI dashboard integration.
5. Read `references/ci-example.md` for a complete workflow template.

**Step 7: Extend with Custom Registries**
1. Register custom graders: `registerGrader('my_grader', () => new MyGrader())`.
2. Register custom agents: `registerAgent('my-agent', (config) => new MyAgent(config))`.
3. Register custom providers: `registerProvider('ssh', (config) => new SSHProvider(config))`.
4. Register custom reporters: `registerReporter('dashboard', () => new DashboardReporter())`.

## Error Handling
* If `skillgrade init` produces a generic template, it means no `SKILL.md` was found — this is expected for non-skill evals.
* If evaluation hangs, check Docker is running and the container has network access for API calls.
* If all trials fail with "No API key," ensure the environment variable is exported, not just set inline for a different command.
* If a task has both `instruction` and `turns`, skillgrade will error — use one or the other.
* If a dataset file is not found, skillgrade errors at config load time with the resolved path.
