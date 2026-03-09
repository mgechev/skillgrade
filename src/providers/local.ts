import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { EnvironmentProvider, CommandResult, TaskConfig } from '../types';

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

            const childEnv = {
                ...baseEnv,
                ...env,
                PATH: `${binDir}:${currentPath}`,
            };

            const child = spawn('bash', ['--norc', '--noprofile', '-c', command], {
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
