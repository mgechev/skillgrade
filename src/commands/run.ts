/**
 * `skilleval` (run) command.
 *
 * Reads eval.yaml, resolves tasks, and executes evals.
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { loadEvalConfig, resolveTask } from '../core/config';
import { detectSkills } from '../core/skills';
import { DockerProvider } from '../providers/docker';
import { LocalProvider } from '../providers/local';
import { EvalRunner, EvalRunOptions } from '../evalRunner';
import { GeminiAgent } from '../agents/gemini';
import { ClaudeAgent } from '../agents/claude';
import { BaseAgent, EvalReport } from '../types';
import { ResolvedTask } from '../core/config.types';
import { parseEnvFile } from '../utils/env';

interface RunOptions {
    task?: string;       // run specific task by name
    trials?: number;     // override trial count
    parallel?: number;
    validate?: boolean;
    ci?: boolean;
    threshold?: number;
    preset?: 'smoke' | 'reliable' | 'regression';
    agent?: string;      // override agent (gemini|claude)
    provider?: string;   // override provider (docker|local)
    output?: string;     // output directory for reports and temp files
}

async function loadEnvFile(filePath: string): Promise<Record<string, string>> {
    if (await fs.pathExists(filePath)) {
        return parseEnvFile(await fs.readFile(filePath, 'utf-8'));
    }
    return {};
}

export async function runEvals(dir: string, opts: RunOptions) {
    // Load eval.yaml
    const config = await loadEvalConfig(dir);

    // Load environment variables
    const rootEnv = await loadEnvFile(path.join(dir, '.env'));
    const env: Record<string, string> = { ...rootEnv };
    if (process.env.GEMINI_API_KEY) env.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (Object.keys(rootEnv).length > 0) {
        console.log(`  Loaded .env: ${Object.keys(rootEnv).join(', ')}`);
    }

    // Detect skills
    let skillsPaths: string[] = [];
    if (config.skill) {
        let skillDir = path.resolve(dir, config.skill);
        const stat = await fs.stat(skillDir).catch(() => null);
        if (stat?.isFile()) {
            skillDir = path.dirname(skillDir);
        }
        if (stat && await fs.pathExists(skillDir)) {
            skillsPaths = [skillDir];
            console.log(`  Skill: ${path.relative(dir, skillDir) || '.'}`);
        } else {
            console.error(`  ⚠ Skill path not found: ${config.skill}`);
        }
    } else {
        const skills = await detectSkills(dir);
        skillsPaths = skills.map(s => s.path);
        if (skills.length > 0) {
            console.log(`  Skills: ${skills.map(s => s.name).join(', ')}`);
        }
    }

    // Filter tasks
    let tasksToRun = config.tasks;
    if (opts.task) {
        tasksToRun = config.tasks.filter(t => t.name === opts.task);
        if (tasksToRun.length === 0) {
            console.error(`  ❌ Task "${opts.task}" not found in eval.yaml`);
            console.log(`  Available tasks: ${config.tasks.map(t => t.name).join(', ')}`);
            process.exit(1);
        }
    }

    // Output directory
    const outputBase = opts.output || path.join(require('os').tmpdir(), 'skilleval');
    const skillName = path.basename(dir);
    const outputDir = path.join(outputBase, skillName);
    const resultsDir = path.join(outputDir, 'results');
    await fs.ensureDir(resultsDir);
    console.log(`  Output: ${outputDir}`);

    // Track CI results
    const reports: EvalReport[] = [];
    let allPassed = true;

    // Run each task
    for (const taskDef of tasksToRun) {
        const resolved = await resolveTask(taskDef, config.defaults, dir);
        const trials = opts.trials ?? resolved.trials;
        const parallel = opts.parallel ?? 1;

        // Create a temp task directory for Docker builds
        const tmpTaskDir = path.join(outputDir, 'tmp', resolved.name);
        await prepareTempTaskDir(resolved, dir, tmpTaskDir);

        // Build eval options — pass resolved content directly
        const evalOpts: EvalRunOptions = {
            instruction: resolved.instruction,
            graders: resolved.graders,
            timeoutSec: resolved.timeout,
            environment: {
                cpus: 2,
                memory_mb: 2048,
            },
        };

        // Pick agent: CLI flag > task-level override > auto-detect from API key > default
        let agentName = opts.agent || resolved.agent;
        if (!opts.agent && !taskDef.agent) {
            if (env.ANTHROPIC_API_KEY && !env.GEMINI_API_KEY) {
                agentName = 'claude';
            } else if (env.GEMINI_API_KEY && !env.ANTHROPIC_API_KEY) {
                agentName = 'gemini';
            }
        }
        const providerName = opts.provider || resolved.provider;

        // Pick provider
        const provider = providerName === 'docker'
            ? new DockerProvider()
            : new LocalProvider();

        const runner = new EvalRunner(provider, resultsDir);

        if (opts.validate) {
            // Validation mode
            if (!resolved.solution) {
                console.error(`  ❌ Task "${resolved.name}" has no solution defined.`);
                continue;
            }

            console.log(`\n  🔍 Validating "${resolved.name}" with reference solution...\n`);

            const solveAgent = {
                async run(_instruction: string, _workspace: string, runCommand: any) {
                    const result = await runCommand(`bash ${path.basename(resolved.solution!)}`);
                    return result.stdout;
                }
            } as BaseAgent;

            const report = await runner.runEval(solveAgent, tmpTaskDir, skillsPaths, evalOpts, 1, env);
            const passed = report.trials[0].reward >= 0.5;

            console.table(report.trials[0].grader_results.map(gr => ({
                Grader: gr.grader_type,
                Score: gr.score.toFixed(2),
                Weight: gr.weight,
            })));

            for (const gr of report.trials[0].grader_results) {
                console.log(`  [${gr.grader_type}] ${gr.details}`);
            }

            console.log(`\n  ${passed ? '✅ Validation PASSED' : '❌ Validation FAILED'} — reward: ${report.trials[0].reward.toFixed(2)}\n`);
            if (!passed) allPassed = false;
        } else {
            // Normal eval mode
            const agent = agentName === 'claude' ? new ClaudeAgent() : new GeminiAgent();

            console.log(`\n  🚀 ${resolved.name} | agent=${agentName} provider=${providerName} trials=${trials}${parallel > 1 ? ` parallel=${parallel}` : ''}\n`);

            try {
                const report = await runner.runEval(agent, tmpTaskDir, skillsPaths, evalOpts, trials, env, parallel);
                reports.push(report);

                // Per-trial summary
                console.table(report.trials.map(t => ({
                    Trial: t.trial_id,
                    Reward: t.reward.toFixed(2),
                    Duration: (t.duration_ms / 1000).toFixed(1) + 's',
                    Commands: t.n_commands,
                    'Tokens (in/out)': `~${t.input_tokens}/${t.output_tokens}`,
                    Graders: t.grader_results.map(g => `${g.grader_type}:${g.score.toFixed(1)}`).join(' ')
                })));

                // LLM grader reasoning
                for (const trial of report.trials) {
                    for (const g of trial.grader_results.filter(g => g.grader_type === 'llm_rubric')) {
                        console.log(`  Trial ${trial.trial_id} [${g.grader_type}] score=${g.score.toFixed(2)}: ${g.details}`);
                    }
                }

                // Summary
                const presetLabel = opts.preset === 'smoke' ? ' (smoke test)'
                    : opts.preset === 'reliable' ? ' (reliable pass rate)'
                        : opts.preset === 'regression' ? ' (regression check)'
                            : '';
                console.log(`\n  ── Results${presetLabel} ${'─'.repeat(50)}`);
                console.log(`  Pass Rate  ${(report.pass_rate * 100).toFixed(1)}%${opts.preset === 'reliable' ? '  ◀ key metric' : ''}`);
                console.log(`  pass@${trials}    ${(report.pass_at_k * 100).toFixed(1)}%${opts.preset === 'smoke' ? '  ◀ key metric' : ''}`);
                console.log(`  pass^${trials}    ${(report.pass_pow_k * 100).toFixed(1)}%${opts.preset === 'regression' ? '  ◀ key metric' : ''}\n`);

                if (report.pass_rate < (opts.threshold ?? config.defaults.threshold)) {
                    allPassed = false;
                }
            } catch (err) {
                console.error(`\n  ❌ Evaluation failed: ${err}\n`);
                allPassed = false;
            }
        }

        // Cleanup temp dir
        try { await fs.remove(tmpTaskDir); } catch { /* ignore cleanup errors */ }
    }

    // CI mode: exit with appropriate code
    if (opts.ci) {
        const threshold = opts.threshold ?? config.defaults.threshold;
        if (!allPassed) {
            console.error(`\n  ❌ CI check failed (threshold: ${(threshold * 100).toFixed(0)}%)\n`);
            process.exit(1);
        }
        console.log(`\n  ✅ CI check passed (threshold: ${(threshold * 100).toFixed(0)}%)\n`);
    }
}

/**
 * Create a temp task directory for Docker builds.
 * Contains: Dockerfile, workspace files, grader scripts.
 * No longer writes task.toml or instruction.md — those are passed directly.
 */
async function prepareTempTaskDir(resolved: ResolvedTask, baseDir: string, tmpDir: string) {
    await fs.ensureDir(tmpDir);

    // Write each deterministic grader script
    await fs.ensureDir(path.join(tmpDir, 'tests'));
    const detGraders = resolved.graders.filter(g => g.type === 'deterministic');
    for (let i = 0; i < detGraders.length; i++) {
        if (detGraders[i].run) {
            const script = `#!/bin/bash\n${detGraders[i].run!.trim()}\n`;
            const filename = i === 0 ? 'test.sh' : `test_${i}.sh`;
            await fs.writeFile(path.join(tmpDir, 'tests', filename), script);
        }
    }

    // Copy referenced grader files/directories
    for (const g of resolved.graders) {
        if (g.type === 'deterministic' && g.run) {
            const pathMatches = g.run.match(/[\w./-]+\.\w{1,4}/g) || [];
            for (const ref of pathMatches) {
                const refDir = ref.split('/')[0];
                const srcDir = path.resolve(baseDir, refDir);
                const destDir = path.join(tmpDir, refDir);
                if (refDir !== ref && await fs.pathExists(srcDir) && !await fs.pathExists(destDir)) {
                    await fs.copy(srcDir, destDir);
                }
            }
        }
    }

    // Write each LLM rubric
    await fs.ensureDir(path.join(tmpDir, 'prompts'));
    const llmGraders = resolved.graders.filter(g => g.type === 'llm_rubric');
    for (let i = 0; i < llmGraders.length; i++) {
        if (llmGraders[i].rubric) {
            const filename = i === 0 ? 'quality.md' : `quality_${i}.md`;
            await fs.writeFile(path.join(tmpDir, 'prompts', filename), llmGraders[i].rubric!);
        }
    }

    // Write Dockerfile
    await fs.ensureDir(path.join(tmpDir, 'environment'));
    let dockerfileContent = `FROM ${resolved.docker.base}\n\nWORKDIR /workspace\n\n`;

    // Install agent CLI
    if (resolved.agent === 'gemini') {
        dockerfileContent += `RUN npm install -g @google/gemini-cli\n\n`;
    } else if (resolved.agent === 'claude') {
        dockerfileContent += `RUN npm install -g @anthropic-ai/claude-code\n\n`;
    }

    // Docker setup commands
    if (resolved.docker.setup) {
        dockerfileContent += `RUN ${resolved.docker.setup.trim()}\n\n`;
    }

    // Grader setup commands
    for (const g of resolved.graders) {
        if (g.setup) {
            dockerfileContent += `# Grader setup\nRUN ${g.setup.trim()}\n\n`;
        }
    }

    // Copy workspace files
    for (const w of resolved.workspace) {
        const srcPath = path.resolve(baseDir, w.src);
        const destInTmp = path.join(tmpDir, path.basename(w.src));
        if (await fs.pathExists(srcPath)) {
            await fs.copy(srcPath, destInTmp);
            dockerfileContent += `COPY ${path.basename(w.src)} ${w.dest}\n`;
            if (w.chmod) {
                dockerfileContent += `RUN chmod ${w.chmod} ${w.dest}\n`;
            }
        }
    }

    dockerfileContent += `\nCOPY . .\nCMD ["bash"]\n`;
    await fs.writeFile(path.join(tmpDir, 'environment', 'Dockerfile'), dockerfileContent);
}
