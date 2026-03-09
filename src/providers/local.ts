import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { EnvironmentProvider, CommandResult, TaskConfig } from '../types';

/**
 * Resolve the path to Git Bash on Windows.
 *
 * On Windows, multiple bash.exe binaries may exist on PATH:
 *   - C:\Program Files\Git\usr\bin\bash.exe  (Git Bash / MSYS2)
 *   - C:\WINDOWS\system32\bash.exe           (WSL launcher)
 *   - C:\Users\...\AppData\Local\Microsoft\WindowsApps\bash.exe  (WSL app alias)
 *
 * When spawned from PowerShell, system32\bash.exe (WSL) is typically found
 * first because Git\usr\bin is not on the Windows PATH (MSYS2 only prepends
 * it inside Git Bash sessions). WSL bash reconstructs PATH from Linux
 * defaults and does not inherit Windows env vars, breaking PATH augmentation
 * and custom env var propagation.
 *
 * This function locates Git Bash explicitly via `git --exec-path`, falling
 * back to common install locations, so the correct bash is always used.
 */
let _cachedBashPath: string | null = null;

function resolveGitBash(): string {
    if (_cachedBashPath !== null) {
        return _cachedBashPath;
    }

    // Derive Git root from git --exec-path (e.g. C:/Program Files/Git/mingw64/libexec/git-core)
    try {
        const execPath = execSync('git --exec-path', {
            encoding: 'utf-8',
            timeout: 5000,
        }).trim();
        const gitRoot = path.resolve(execPath, '..', '..', '..');
        const bashPath = path.join(gitRoot, 'usr', 'bin', 'bash.exe');

        if (fs.existsSync(bashPath)) {
            _cachedBashPath = bashPath;

            return _cachedBashPath;
        }
    } catch {
        // git not available or timed out; fall through
    }

    // Fallback: common Git for Windows install locations
    const candidates = [
        'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe',
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            _cachedBashPath = candidate;

            return _cachedBashPath;
        }
    }

    // Last resort: bare 'bash' and hope it resolves correctly
    _cachedBashPath = 'bash';

    return _cachedBashPath;
}

export class LocalProvider implements EnvironmentProvider {
    async setup(taskPath: string, skillsPaths: string[], _taskConfig: TaskConfig, env?: Record<string, string>): Promise<string> {
        const tempDir = path.join(os.tmpdir(), `skill-eval-${Math.random().toString(36).substring(7)}`);
        await fs.ensureDir(tempDir);
        await fs.copy(taskPath, tempDir);

        // Inject skills into agent discovery paths
        // Gemini: .agents/skills/  |  Claude: .claude/skills/
        const discoveryDirs = [
            path.join(tempDir, '.agents', 'skills'),
            path.join(tempDir, '.claude', 'skills'),
        ];

        for (const skillsDir of discoveryDirs) {
            await fs.ensureDir(skillsDir);
            for (const spath of skillsPaths) {
                const skillName = path.basename(spath);
                await fs.copy(spath, path.join(skillsDir, skillName));
            }
        }

        return tempDir;
    }

    async cleanup(workspacePath: string): Promise<void> {
        if (await fs.pathExists(workspacePath)) {
            await fs.remove(workspacePath);
        }
    }

    async runCommand(workspacePath: string, command: string, env?: Record<string, string>): Promise<CommandResult> {
        return new Promise((resolve) => {
            // Build env: pass all process env + caller overrides (except PATH).
            // PATH is prepended inside the shell after login profile has run,
            // so the login profile cannot push workspace bin/ down the PATH.
            const baseEnv = { ...process.env };

            for (const key of Object.keys(baseEnv)) {
                if (key.toLowerCase() === 'path') {
                    delete baseEnv[key];
                }
            }

            const childEnv = {
                ...baseEnv,
                ...env,
            };

            const bashPath = process.platform === 'win32' ? resolveGitBash() : 'bash';

            // Use --login so the full user environment is available (MSYS2 /usr/bin,
            // FNM-managed node, user-installed CLIs, etc.). Prepend workspace bin/
            // inside the shell so it takes precedence over everything the profile adds.
            // Use $(pwd)/bin instead of the Node.js binDir path to avoid Windows drive
            // letter colons (C:\...) being interpreted as PATH separators.
            const wrappedCommand = `export PATH="$(pwd)/bin:\$PATH" && ${command}`;

            const child = spawn(bashPath, ['--login', '-c', wrappedCommand], {
                cwd: workspacePath,
                env: childEnv,
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });

            child.on('close', (code) => {
                resolve({ stdout, stderr, exitCode: code ?? 1 });
            });

            child.on('error', () => {
                resolve({ stdout, stderr, exitCode: 1 });
            });
        });
    }
}
