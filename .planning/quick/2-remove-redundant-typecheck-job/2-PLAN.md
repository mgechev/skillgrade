---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/ci.yml
  - package.json
autonomous: true
requirements: []
must_haves:
  truths:
    - "CI workflow has exactly 3 jobs: build, test-integration, test-unit"
    - "No typecheck job exists in CI"
    - "No typecheck script exists in package.json"
    - "Build job still validates types (tsc emits and type-checks in one pass)"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "CI workflow without redundant typecheck job"
      contains: "build:"
    - path: "package.json"
      provides: "Scripts without typecheck"
  key_links:
    - from: ".github/workflows/ci.yml"
      to: "package.json"
      via: "npm run build"
      pattern: "npm run build"
---

<objective>
Remove the redundant `typecheck` job from CI and the `typecheck` script from package.json.

Purpose: The project has a single tsconfig.json. Both `tsc --noEmit` (typecheck) and `tsc` (build) parse the same files and run the same type-checking pass. The only difference is build also emits .js to dist/. Since the build job catches all the same type errors, the separate typecheck job wastes CI minutes for zero additional signal.

Output: CI reduced from 4 jobs to 3 (build, test-integration, test-unit). The typecheck script removed from package.json.
</objective>

<execution_context>
@C:/Users/LarsGyrupBrinkNielse/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/LarsGyrupBrinkNielse/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.github/workflows/ci.yml
@package.json
@tsconfig.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove typecheck job from CI and typecheck script from package.json</name>
  <files>.github/workflows/ci.yml, package.json</files>
  <action>
1. Edit `.github/workflows/ci.yml`:
   - Delete the entire `typecheck:` job block (lines 20-27), which includes the job definition, name, runs-on, timeout-minutes, and all its steps.
   - Do NOT touch the `build:`, `test-integration:`, or `test-unit:` jobs.
   - Resulting `jobs:` section should have exactly 3 jobs: build, test-integration, test-unit.

2. Edit `package.json`:
   - Remove the `"typecheck": "tsc --noEmit",` line from the `scripts` object.
   - The `"build": "tsc"` script remains as-is -- it already validates types as part of compilation.
   - Ensure no trailing comma issues after removal.

No other files need changes. The typecheck job has no `needs:` dependents -- no other job references it.
  </action>
  <verify>
    <automated>node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8');const p=JSON.parse(require('fs').readFileSync('package.json','utf8'));const errors=[];if(y.includes('typecheck:'))errors.push('ci.yml still has typecheck job');if(p.scripts.typecheck)errors.push('package.json still has typecheck script');if(!y.includes('build:'))errors.push('ci.yml missing build job');if(!y.includes('test-integration:'))errors.push('ci.yml missing test-integration job');if(!y.includes('test-unit:'))errors.push('ci.yml missing test-unit job');if(!p.scripts.build)errors.push('package.json missing build script');const jobMatches=y.match(/^\s{2}\w[\w-]*:/gm);if(jobMatches&&jobMatches.length!==3)errors.push('Expected 3 jobs, found '+jobMatches.length+': '+jobMatches.join(', '));if(errors.length){console.error(errors.join('\n'));process.exit(1)}console.log('[OK] typecheck removed, 3 CI jobs remain, build script intact')"</automated>
  </verify>
  <done>
- ci.yml has exactly 3 jobs: build, test-integration, test-unit
- typecheck job is gone from ci.yml
- typecheck script is gone from package.json
- build script unchanged in package.json
- `npm run build` still exits 0 (types validated via tsc compilation)
  </done>
</task>

</tasks>

<verification>
- `npm run build` exits 0 (confirms type-checking still works via build)
- ci.yml contains exactly 3 job definitions
- package.json has no typecheck script
- No job in ci.yml has `needs: [typecheck]` or similar dependency
</verification>

<success_criteria>
CI workflow reduced from 4 jobs to 3. The typecheck script removed from package.json. Build job continues to validate types as a side effect of compilation.
</success_criteria>

<output>
After completion, create `.planning/quick/2-remove-redundant-typecheck-job/2-SUMMARY.md`
</output>
