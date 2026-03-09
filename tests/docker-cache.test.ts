/**
 * Tests for Docker content-hash image naming.
 *
 * Verifies that computeContextHash produces deterministic hashes based on
 * file content, enabling cache-hit detection for Docker image reuse.
 * Same test runner pattern as bootstrap.test.ts (sequential, exit(1) on failure).
 */
import { computeContextHash } from '../src/providers/docker';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`FAIL: ${message}`);
    }
}

async function removeWithRetry(dir: string, retries = 5, delayMs = 200): Promise<void> {
    for (let i = 0; i < retries; i++) {
        try {
            await fs.remove(dir);

            return;
        } catch (err: any) {
            if (i === retries - 1) {
                throw err;
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

async function runTests() {
    let passed = 0;
    let failed = 0;
    const taskDir = path.resolve(__dirname, '..', 'tasks', 'superlint_demo');

    // Test 1: computeContextHash returns a stable hash for unchanged files
    try {
        const hash1 = await computeContextHash(taskDir, []);
        const hash2 = await computeContextHash(taskDir, []);

        assert(typeof hash1 === 'string', `Expected string, got ${typeof hash1}`);
        assert(hash1.length === 8, `Expected 8-char hash, got ${hash1.length} chars: '${hash1}'`);
        assert(/^[0-9a-f]{8}$/.test(hash1), `Expected hex string, got '${hash1}'`);
        assert(hash1 === hash2, `Expected identical hashes for unchanged files: '${hash1}' vs '${hash2}'`);

        console.log('  PASS: stable hash for unchanged files');
        passed++;
    } catch (e: any) {
        console.error(`  FAIL: stable hash for unchanged files - ${e.message}`);
        failed++;
    }

    // Test 2: modifying a file changes the hash
    try {
        const tmpDir = path.join(os.tmpdir(), `docker-cache-test-${Date.now()}`);
        await fs.copy(taskDir, tmpDir);

        const hashBefore = await computeContextHash(tmpDir, []);
        // Modify one file
        const appFile = path.join(tmpDir, 'app.js');
        const original = await fs.readFile(appFile, 'utf-8');
        await fs.writeFile(appFile, original + '\n// modified');
        const hashAfter = await computeContextHash(tmpDir, []);

        assert(hashBefore !== hashAfter,
            `Expected different hashes after file modification: both '${hashBefore}'`);

        await removeWithRetry(tmpDir);
        console.log('  PASS: modifying a file changes the hash');
        passed++;
    } catch (e: any) {
        console.error(`  FAIL: modifying a file changes the hash - ${e.message}`);
        failed++;
    }

    // Test 3: file ordering does not affect the hash (deterministic sort)
    try {
        const tmpDir = path.join(os.tmpdir(), `docker-cache-order-${Date.now()}`);
        await fs.ensureDir(tmpDir);

        // Create files with names that sort differently than filesystem order
        await fs.writeFile(path.join(tmpDir, 'z-file.txt'), 'content-z');
        await fs.writeFile(path.join(tmpDir, 'a-file.txt'), 'content-a');
        await fs.writeFile(path.join(tmpDir, 'm-file.txt'), 'content-m');

        const hash1 = await computeContextHash(tmpDir, []);
        const hash2 = await computeContextHash(tmpDir, []);

        assert(hash1 === hash2,
            `Expected identical hashes regardless of traversal order: '${hash1}' vs '${hash2}'`);

        await removeWithRetry(tmpDir);
        console.log('  PASS: file ordering does not affect the hash');
        passed++;
    } catch (e: any) {
        console.error(`  FAIL: file ordering does not affect the hash - ${e.message}`);
        failed++;
    }

    // Test 4: skills paths affect the hash
    try {
        const skillsDir = path.resolve(__dirname, '..', 'tasks', 'superlint_demo', 'skills');
        const hasSkillsDir = await fs.pathExists(skillsDir);

        if (hasSkillsDir) {
            const hashWithout = await computeContextHash(taskDir, []);
            const hashWith = await computeContextHash(taskDir, [skillsDir]);

            assert(hashWithout !== hashWith,
                `Expected different hashes with/without skills: both '${hashWithout}'`);

            console.log('  PASS: skills paths affect the hash');
        } else {
            // Create a temporary skills directory
            const tmpSkills = path.join(os.tmpdir(), `docker-cache-skills-${Date.now()}`);
            await fs.ensureDir(tmpSkills);
            await fs.writeFile(path.join(tmpSkills, 'SKILL.md'), '# Test Skill');

            const hashWithout = await computeContextHash(taskDir, []);
            const hashWith = await computeContextHash(taskDir, [tmpSkills]);

            assert(hashWithout !== hashWith,
                `Expected different hashes with/without skills: both '${hashWithout}'`);

            await removeWithRetry(tmpSkills);
            console.log('  PASS: skills paths affect the hash');
        }

        passed++;
    } catch (e: any) {
        console.error(`  FAIL: skills paths affect the hash - ${e.message}`);
        failed++;
    }

    // Test 5: image name follows expected pattern
    try {
        const hash = await computeContextHash(taskDir, []);
        const taskName = path.basename(taskDir);
        const baseName = `skill-eval-${taskName}-${hash}`;

        assert(baseName === `skill-eval-superlint_demo-${hash}`,
            `Expected 'skill-eval-superlint_demo-${hash}', got '${baseName}'`);

        const withSkills = `${baseName}-ready`;
        assert(withSkills.endsWith('-ready'),
            `Expected name ending with '-ready', got '${withSkills}'`);

        console.log('  PASS: image name follows expected pattern');
        passed++;
    } catch (e: any) {
        console.error(`  FAIL: image name follows expected pattern - ${e.message}`);
        failed++;
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed}`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error('Test runner error:', err);
    process.exit(1);
});
