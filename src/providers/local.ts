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
            const binDir = path.join(workspacePath, 'bin');
            const currentPath = env?.PATH ?? process.env.PATH ?? '';

            // On Windows, PATH entries are separated by semicolons.
            // MSYS2 bash converts them to POSIX format automatically.
            // Using colons on Windows breaks drive-letter paths (e.g. "C:\..." splits into "C" + "\...").
            const sep = process.platform === 'win32' ? ';' : ':';

            // Build a clean env object: remove all case-variants of PATH so only our canonical PATH survives
            const baseEnv = { ...process.env };

            for (const key of Object.keys(baseEnv)) {
                if (key.toLowerCase() === 'path') {
                    delete baseEnv[key];
                }
            }

            // Remove BASH_ENV and ENV so bash does not source extra startup files
            delete baseEnv['BASH_ENV'];
            delete baseEnv['ENV'];

            const bashPath = process.platform === 'win32' ? resolveGitBash() : 'bash';

            // On Windows, bash -c is non-login so /etc/profile is not sourced.
            // MSYS2's /usr/bin (grep, sed, touch, etc.) must be added explicitly.
            const gitUsrBin = process.platform === 'win32' && bashPath !== 'bash'
                ? path.dirname(bashPath)
                : '';
            const pathParts = [binDir];

            if (gitUsrBin) {
                pathParts.push(gitUsrBin);
            }

            pathParts.push(currentPath);

            const childEnv = {
                ...baseEnv,
                ...env,
                PATH: pathParts.join(sep),
            };

            const child = spawn(bashPath, ['-c', command], {
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
