# skill-eval vs. skill-creator: Eval & Benchmark Comparison

Comparison of [skill-eval](https://github.com/LayZeeDK/local-skill-eval) (this
project) with the Eval and Benchmark features of Anthropic's
[skill-creator](https://claude.com/plugins/skill-creator) plugin.

## Purpose & scope

| Dimension | **skill-eval** | **skill-creator** |
|---|---|---|
| Primary goal | Measure agent *reliability* on tasks statistically | Iterative skill *development lifecycle* (Create, Eval, Improve, Benchmark) |
| Unit of evaluation | A **task** (isolated coding challenge) | A **skill** (Claude Code skill definition) |
| What is being tested | Can agents solve tasks? Does a skill help? | Does the skill produce correct output? Does Claude trigger it? |
| Packaging | Standalone TypeScript CLI (`npm run eval`) | Claude Code plugin (Python scripts + agent markdown) |
| Target users | Researchers benchmarking agent capabilities | Skill authors iterating on quality |

skill-eval treats evaluation as a *statistical measurement problem* (how
reliable is this agent?). skill-creator treats it as a *feedback loop for
improvement* (how do I make this skill better?). skill-eval is closer to
academic benchmarking; skill-creator is closer to test-driven development.

## Eval architecture

| Dimension | **skill-eval** | **skill-creator** |
|---|---|---|
| Eval definition | `task.toml` + `instruction.md` + grader scripts + rubrics | `evals.json` with prompts, expected outputs, and assertion lists |
| Execution | Agent CLI (Gemini/Claude) runs inside Docker or local temp dir | Executor agent spawns Claude with/without the skill |
| Isolation | Docker containers (per-trial) or temp directories | Workspace directories (`iteration-N/eval-ID/with_skill/run-N/`) |
| Parallelism | Configurable `--parallel=N` trials | with_skill + without_skill runs spawned in parallel |
| Agents supported | Gemini CLI, Claude CLI (pluggable) | Claude only |

## Grading strategies

| Dimension | **skill-eval** | **skill-creator** |
|---|---|---|
| Deterministic grading | Shell scripts; exit code 0/1 or partial credit via `reward.txt` (0.0--1.0) | Not a separate concept; assertions can be script-verified but the Grader agent does evaluation |
| LLM grading | LLM Rubric grader with fallback chain: Ollama, Gemini, Anthropic | Grader *agent* (Claude) evaluates outputs against expectations |
| Scoring | Continuous 0.0--1.0 with weighted combination of graders | Binary pass/fail per assertion; pass_rate = passed/total |
| Partial credit | Yes -- grader scripts write float to `reward.txt` | No -- binary pass/fail only |
| Weighting | Each grader has a configurable `weight` in `task.toml` | All assertions weighted equally |
| Evidence | LLM rubric returns `reasoning` string | Each assertion gets `evidence` string explaining why it passed/failed |
| Claims verification | Not present | Grader extracts *implicit claims* from output and verifies them |
| Eval quality feedback | Not present | Grader critiques weak/non-discriminating assertions |
| Blind comparison | Not present | Comparator agent does blind A/B scoring on a 1--5 rubric |

skill-eval's grading is more *quantitative* (continuous scores, weighted
combinations, statistical aggregation). skill-creator's grading is more
*qualitative* (evidence-based reasoning, claims verification, critique of the
eval itself). The Grader agent in skill-creator is an LLM judge that reads
transcripts and file outputs, whereas skill-eval's deterministic graders run
actual test scripts.

## Metrics & benchmarking

| Metric | **skill-eval** | **skill-creator** |
|---|---|---|
| Pass rate | `mean(reward)` across trials | `passed / total` assertions per run |
| pass@k | Unbiased estimator: P(at least 1 success in k trials) | Not computed |
| pass^k | P(all k trials succeed) -- reliability metric | Not computed |
| Normalized gain | `(with - without) / (1 - without)` -- relative skill impact | Not computed; delta in `benchmark.json` is raw difference |
| Variance analysis | Standard deviation implicit in pass@k/pass^k formulas | Explicit: mean, stddev, min, max per configuration |
| Token/time tracking | `input_tokens`, `output_tokens`, `duration_ms` per trial | `time_seconds`, `tokens`, `tool_calls` per run |
| Delta reporting | Normalized gain across with/without-skill eval runs | Raw delta: `with_skill - without_skill` for pass rate, time, tokens |
| With/without skill | Separate eval runs with `--no-skills` flag | Built into every benchmark (parallel with_skill + without_skill runs) |

pass@k and pass^k are borrowed from the code generation literature (e.g.,
HumanEval). pass@k answers "can the agent ever solve this?" while pass^k
answers "can we trust the agent to always solve this?" -- distinct questions
with different implications for deployment. skill-creator does not make this
distinction, treating each run equally.

Normalized gain is particularly revealing: if the baseline (no skill) already
succeeds 90% of the time, a skill that raises it to 95% gets a gain of 0.5 --
the skill captured half the remaining headroom. Raw deltas show only +5%.

## Trigger evals (skill-creator only)

skill-creator has a second eval system with no equivalent in skill-eval:

- **Purpose**: Optimize the skill's `description` field so Claude invokes it
  for the right prompts.
- **Method**: 20 queries (10 should-trigger, 10 should-not-trigger), each run 3
  times.
- **Optimization loop**: Train/test split (60/40), Claude proposes description
  improvements, iterated up to 5 times, best selected by test score to prevent
  overfitting.
- **Output**: Optimized `description` field + HTML report.

skill-eval has no concept of trigger evaluation because it does not test skill
*discoverability*. It injects skills directly and measures task outcomes.

## Results & reporting

| Dimension | **skill-eval** | **skill-creator** |
|---|---|---|
| Output format | JSON `EvalReport` in `results/` | `grading.json` + `benchmark.json` + `feedback.json` per iteration |
| CLI reporting | ANSI table with per-trial results and summary | Not present (Python scripts, not a CLI) |
| Web viewer | Browser reporter at `localhost:3847` | Interactive HTML viewer via `generate_review.py` |
| Human feedback | Not present | Textbox per eval in viewer, saved to `feedback.json` |
| Iteration tracking | Separate eval runs, analyzed post-hoc | Built-in `iteration-N/` directory structure |
| Analyst notes | Not present | Analyzer agent surfaces patterns (flaky evals, non-discriminating assertions) |

## Improvement loop

| Dimension | **skill-eval** | **skill-creator** |
|---|---|---|
| Feedback mechanism | Manual -- re-run after changing skill/task | Built-in: Viewer, `feedback.json`, Improve mode, re-eval |
| Iteration model | Run eval, read report, manually adjust, re-run | Run eval, grade, benchmark, review, improve, re-eval (guided) |
| Automated improvement | Not present | Trigger eval loop auto-optimizes skill descriptions |
| Comparator | Not present | Blind A/B comparison between skill versions |

skill-creator implements a *closed-loop* improvement cycle where evaluation
feeds directly into improvement. The Analyzer surfaces what is wrong, the Viewer
collects human feedback, and the Improve mode applies changes. skill-eval is an
*open-loop* measurement tool -- it reports the numbers but leaves interpretation
and action to the human.

## Complementary strengths

| Strength | **skill-eval** | **skill-creator** |
|---|---|---|
| Statistical rigor | pass@k, pass^k, normalized gain | Mean/stddev/min/max |
| Environment isolation | Docker containers with resource limits | Directory-based workspace |
| Multi-agent support | Gemini + Claude | Claude only |
| Deterministic testing | Shell script graders with partial credit | Assertion-based binary pass/fail |
| Local-first grading | Ollama with cloud fallback chain | Cloud-only (Claude as grader) |
| Skill discoverability | Not addressed | Trigger evals with optimization loop |
| Iterative development | Not addressed | Integrated feedback, improve, re-eval cycle |
| Blind comparison | Not addressed | Comparator agent with rubric scoring |
| Eval self-critique | Not addressed | Grader critiques weak assertions |

The two systems occupy different niches. skill-eval is a benchmarking harness
for measuring agent reliability across controlled tasks with statistical
confidence. skill-creator is an IDE-integrated development workflow for iterating
on skill quality through eval, feedback, improve cycles.

They could be complementary: skill-eval's statistical metrics and isolation
model could strengthen skill-creator's benchmarking, while skill-creator's
trigger evals and improvement loop could extend skill-eval into a development
tool.
