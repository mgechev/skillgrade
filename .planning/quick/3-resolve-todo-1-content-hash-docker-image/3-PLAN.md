---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/providers/docker.ts
  - tests/docker-cache.test.ts
autonomous: false
requirements:
  - TODO-01

must_haves:
  truths:
    - "Second run of DockerProvider.prepare() with unchanged task files skips docker.buildImage entirely"
    - "Image name is deterministic based on file content, not timestamp"
    - "Changed task files produce a different image name and trigger a fresh build"
    - "teardown() preserves cached images for future runs"
  artifacts:
    - path: "src/providers/docker.ts"
      provides: "Content-hash image naming with cache-hit detection"
      contains: "createHash"
    - path: "tests/docker-cache.test.ts"
      provides: "Unit tests for hash computation and cache logic"
      contains: "computeContextHash"
  key_links:
    - from: "src/providers/docker.ts"
      to: "node:crypto"
      via: "createHash('sha256') for content hashing"
      pattern: "createHash.*sha256"
    - from: "src/providers/docker.ts"
      to: "docker.getImage().inspect()"
      via: "cache-hit check before buildImage"
      pattern: "getImage.*inspect"
---

<objective>
Replace timestamp-based Docker image naming with content-hash naming so that `DockerProvider.prepare()` skips the expensive `docker.buildImage()` call when the task directory and skills have not changed.

Purpose: The `npm install -g @google/gemini-cli` layer inside the Dockerfile takes significant time. When nothing has changed, the image should be reused from the local Docker cache, making "Image ready" appear in seconds instead of minutes.

Output: Modified `src/providers/docker.ts` with content-hash naming, cache-hit detection, and preserved images across runs. Unit test file validating hash computation and cache logic.
</objective>

<execution_context>
@C:/Users/LarsGyrupBrinkNielse/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/LarsGyrupBrinkNielse/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/todos/pending/2026-03-09-apply-and-verify-docker-image-speed-optimizations.md

<interfaces>
<!-- Key types and contracts the executor needs. -->

From src/types.ts:
```typescript
export interface EnvironmentProvider {
    prepare?(taskPath: string, skillsPaths: string[], taskConfig: TaskConfig, env?: Record<string, string>): Promise<string>;
    setup(taskPath: string, skillsPaths: string[], taskConfig: TaskConfig, env?: Record<string, string>): Promise<string>;
    cleanup(workspacePath: string): Promise<void>;
    teardown?(): Promise<void>;
    runCommand(workspacePath: string, command: string, env?: Record<string, string>): Promise<CommandResult>;
    diagnose?(workspacePath: string): Promise<string>;
}
```

From src/providers/docker.ts (current prepare logic):
```typescript
// Line 25 - CHANGE THIS: timestamp-based naming
const baseName = `skill-eval-${path.basename(taskPath)}-${Date.now()}`;

// Lines 28-39 - Docker build (skip when cached)
const stream = await this.docker.buildImage({
    context: taskPath,
    src: ['.']
}, { t: baseName, dockerfile: 'environment/Dockerfile' });

// Lines 43-82 - Skills injection + commit (skip when cached)
if (skillsPaths.length > 0) {
    // ... creates temp container, injects skills, commits as `${baseName}-ready`
    this.preparedImage = `${baseName}-ready`;
} else {
    this.preparedImage = baseName;
}

// Lines 134-143 - teardown removes image (CHANGE: preserve for cache reuse)
async teardown(): Promise<void> {
    if (this.preparedImage) {
        await this.docker.getImage(this.preparedImage).remove({ force: true });
        this.preparedImage = undefined;
    }
}
```

From tasks/superlint_demo/environment/Dockerfile:
```dockerfile
FROM node:24-slim
WORKDIR /workspace
RUN npm install -g @google/gemini-cli
COPY bin/superlint /usr/local/bin/superlint
RUN chmod +x /usr/local/bin/superlint
COPY app.js .
COPY . .
RUN mkdir -p logs/verifier
CMD ["bash"]
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add content-hash computation and cache-hit logic to DockerProvider</name>
  <files>src/providers/docker.ts, tests/docker-cache.test.ts, package.json</files>
  <behavior>
    - computeContextHash(taskPath, skillsPaths) returns a stable hex string for unchanged files
    - computeContextHash returns a different hex string when any file in taskPath changes
    - computeContextHash returns a different hex string when any file in skillsPaths changes
    - computeContextHash returns the same hash regardless of file traversal order (sorted)
    - Image name follows pattern: skill-eval-{taskname}-{hash8} (8-char hash prefix)
    - When skills are present, final image name is skill-eval-{taskname}-{hash8}-ready
  </behavior>
  <action>
Create a new exported async function `computeContextHash(taskPath: string, skillsPaths: string[]): Promise&lt;string&gt;` in `src/providers/docker.ts` that:

1. Import `createHash` from `node:crypto`.
2. Use the existing `walkDir` method logic (extract to a standalone function or make it static) to collect all files from `taskPath` and each entry in `skillsPaths`.
3. Sort all file paths alphabetically (relative to their root) for deterministic ordering.
4. For each file, feed `relativePath + '\0' + fileContent` into a SHA-256 hasher.
5. Return the first 8 hex characters of the final digest.

Refactor `walkDir` from a private instance method to a module-level async function so `computeContextHash` can use it without a class instance (also needed for testability). The class method can delegate to it.

Then modify `DockerProvider.prepare()`:

1. Replace line 25:
   ```typescript
   const hash = await computeContextHash(taskPath, skillsPaths);
   const baseName = `skill-eval-${path.basename(taskPath)}-${hash}`;
   ```
2. Determine the final expected image name:
   - With skills: `${baseName}-ready`
   - Without skills: `baseName`
3. Before building, check if the image already exists:
   ```typescript
   const finalName = skillsPaths.length > 0 ? `${baseName}-ready` : baseName;
   try {
       await this.docker.getImage(finalName).inspect();
       this.preparedImage = finalName;
       console.log(`  Image ready: ${this.preparedImage} (cached)`);
       return this.preparedImage;
   } catch {
       // Image does not exist, proceed with build
   }
   ```
4. Keep the rest of the build + skills injection logic unchanged.

Modify `DockerProvider.teardown()`:
- Change to a no-op that only clears `this.preparedImage` reference without removing the Docker image. Add a comment explaining the image is preserved for cache reuse across runs.
- The image name is deterministic, so stale images are replaced automatically when content changes (same name prefix, different hash). Users can run `docker image prune` to clean up old images.

Create `tests/docker-cache.test.ts` with unit tests:
- Test that `computeContextHash` produces a stable hash for the `tasks/superlint_demo` directory.
- Test that modifying a file changes the hash (create a temp copy, modify one file, compare hashes).
- Test that file ordering does not affect the hash (the function sorts internally).
- Use `node:crypto`, `fs-extra`, `path`, and `os` (for tmpdir). No Docker dependency needed for hash tests.

Add a `test:docker-cache` script to `package.json`:
```json
"test:docker-cache": "ts-node tests/docker-cache.test.ts"
```
  </action>
  <verify>
    <automated>npm run test:docker-cache</automated>
  </verify>
  <done>
    - computeContextHash is exported and tested with 3+ assertions
    - DockerProvider.prepare() uses content hash for image naming
    - DockerProvider.prepare() skips build when image exists (inspect succeeds)
    - DockerProvider.teardown() preserves the image (no remove call)
    - npm run build succeeds (TypeScript compiles)
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify Docker image cache-hit speeds up second run</name>
  <files>n/a</files>
  <action>Human verifies the end-to-end behavior by running test:bootstrap twice and observing the timing difference.</action>
  <what-built>Content-hash Docker image naming with cache-hit detection. On first run, the image builds normally. On second run with unchanged files, `prepare()` detects the existing image and skips the build entirely.</what-built>
  <how-to-verify>
    1. Make sure Docker Desktop is running
    2. Clean up any existing skill-eval images: `docker images | grep skill-eval`
       If any exist: `docker rmi $(docker images -q --filter "reference=skill-eval-*")`
    3. First run (cold -- expect full build time):
       `npm run test:bootstrap`
       Note the time between "Starting eval for task: superlint_demo" and "Image ready:" in the Docker test section
    4. Second run (warm -- expect near-instant):
       `npm run test:bootstrap`
       The "Image ready:" line should appear within 1-2 seconds and show "(cached)"
    5. Verify the test still passes (all assertions green, exit code 0)
  </how-to-verify>
  <verify>Human observes "(cached)" in second run output and confirms faster timing</verify>
  <done>"Image ready" appears with "(cached)" on second run in under 5 seconds; all bootstrap tests pass</done>
  <resume-signal>Type "approved" if second run shows "(cached)" and is noticeably faster, or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `npm run build` compiles without errors
- `npm run test:docker-cache` passes all hash computation tests
- `npm run test:bootstrap` passes with Docker available (first run builds, second run cache-hits)
- "Image ready" message includes "(cached)" on second run
</verification>

<success_criteria>
1. Running `npm run test:bootstrap` twice in a row shows "Image ready: ... (cached)" on the second run
2. The second run's Docker prepare phase completes in under 5 seconds (vs 30+ seconds for a full build)
3. All existing tests continue to pass
4. Hash changes when task files change (verified by unit test)
</success_criteria>

<output>
After completion, create `.planning/quick/3-resolve-todo-1-content-hash-docker-image/3-SUMMARY.md`
</output>
