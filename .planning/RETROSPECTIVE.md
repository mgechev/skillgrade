# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 -- Local Skill Eval

**Shipped:** 2026-03-09
**Phases:** 4 | **Plans:** 15 | **Sessions:** ~8

### What Was Built
- Ollama-backed LLM grader with fallback chain (Ollama -> Gemini -> Anthropic) and graceful degradation
- GitHub Actions CI with 3 parallel jobs (build, test-integration, test-unit) and npm caching
- Benchmark-validated model selection: qwen2.5:3b with JSON Schema structured output
- Skill eval CI workflow with parallel local/Docker evaluation jobs and artifact upload
- Reusable composite actions for Node.js setup and Ollama setup across workflows
- LLMGrader warmup method eliminating cold-start timeout waste in CI

### What Worked
- Coarse-grained 3-phase decomposition (CI -> Grader -> CI Pipeline) mapped cleanly to 18 requirements
- GSD verifier caught real gaps: 5 gap-closure plans in Phase 2 fixed PATH handling, timeouts, model selection
- Benchmark-driven model selection (Phase 2.1) replaced trial-and-error with data: 8 models x 3 fixtures x 3 profiles
- CI-first approach (Phase 1) provided safety net that caught regressions during Phase 2 gap closures
- Quick task workflow handled CI restructuring (typecheck consolidation, test splitting) without disrupting phase execution

### What Was Inefficient
- Phase 2 required 5 gap-closure plans (Plans 03-08) after initial integration -- better upfront research on Windows/MSYS2 bash spawn behavior would have caught PATH issues earlier
- Default model changed 3 times (qwen3:4b -> phi3.5:3.8b -> qwen2.5:3b) across Phases 2 and 2.1 -- benchmarking should have been Phase 2 work, not a separate inserted phase
- SUMMARY.md files lack `requirements-completed` frontmatter, weakening the 3-source cross-reference during audit

### Patterns Established
- Composite actions for CI setup (setup-node, setup-ollama) -- reusable across workflows
- Benchmark-validated constants over user-configurable params -- hardcoded Ollama params removed 2 GraderConfig fields
- warmUp pattern for cold-start elimination -- num_predict:1 request before real grading
- removeWithRetry helper for Windows EBUSY file locking in tests
- spawn('bash', ['--norc', '--noprofile', '-c', command]) for subprocess isolation on Windows/MSYS2

### Key Lessons
1. Windows/MSYS2 bash spawn behavior is a minefield -- PATH case-variants, login shell PATH rebuilding, BASH_ENV sourcing all need explicit handling. Test subprocess env early.
2. Model selection should be benchmarked on target hardware before integration, not after. The Phase 2 -> 2.1 bounce cost an extra phase.
3. JSON Schema structured output (Ollama `format` field) is more reliable than regex extraction for local LLMs -- 100% validity in benchmarks.
4. CI env vars are best delivered through composite actions (GITHUB_ENV export) rather than job-level env blocks -- centralizes configuration.

### Cost Observations
- Model mix: ~60% sonnet, ~30% haiku, ~10% opus (plan-check and verification)
- Sessions: ~8 across 2 days
- Notable: 15 plans averaging 4 min execution each. Phase 2 was the heaviest (8 plans, 36 min total) due to gap closures.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 4 | First milestone. Established CI-first pattern, benchmark-driven model selection. |

### Cumulative Quality

| Milestone | Tests | Coverage | Key Metric |
|-----------|-------|----------|------------|
| v1.0 | 28+ (24 ollama-grader + 4 local-provider) | Core grading paths | 18/18 requirements satisfied |

### Top Lessons (Verified Across Milestones)

1. CI as first phase provides safety net for all subsequent work -- caught regressions during 5 gap-closure plans
2. Benchmark before committing to model/parameter choices -- saves rework phases
