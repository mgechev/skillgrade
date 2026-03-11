#!/usr/bin/env npx ts-node
/**
 * Benchmark runner for the Ollama agent.
 *
 * Wraps `npm run eval` to run measured trials of superlint_demo, capturing
 * per-trial duration, reward, and command counts. Outputs structured JSON
 * to stdout (or --output file) and a human-readable summary to stderr.
 *
 * Usage:
 *   npx ts-node scripts/benchmark-agent.ts --name baseline --trials 3
 *   npx ts-node scripts/benchmark-agent.ts --name experiment-1 --modelfile modelfiles/custom.Modelfile --output results.json
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Import the default model name from types.ts so it is not hardcoded
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DEFAULT_OLLAMA_AGENT_CONFIG } = require('../src/agents/ollama/types');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrialData {
    trial: number;
    duration_s: number;
    reward: number;
    commands: number;
}

interface BenchmarkOutput {
    name: string;
    timestamp: string;
    modelfile: string | null;
    trials: TrialData[];
    avg_duration_s: number;
    std_dev_s: number;
    avg_reward: number;
    avg_commands: number;
    target_met: boolean;  // avg_duration_s <= 300
    reward_met: boolean;  // all trials reward >= 0.90
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function printUsage(): void {
    const usage = `
benchmark-agent.ts -- Benchmark runner for the Ollama agent

Usage:
  npx ts-node scripts/benchmark-agent.ts --name <experiment-name> [options]

Options:
  --name <name>           Experiment name (required)
  --trials <N>            Number of measured trials (default: 3)
  --warmup                Run a warm-up trial before measurement (default: true)
  --no-warmup             Skip warm-up trial
  --modelfile <path>      Rebuild model from Modelfile before run
  --env <KEY=VAL>         Document Ollama env vars (repeatable, informational only)
  --output <path>         Write JSON output to file (default: stdout)
  --help, -h              Show this help
`.trim();
    console.error(usage);
}

interface ParsedArgs {
    name: string;
    trials: number;
    warmup: boolean;
    modelfile: string | null;
    envVars: string[];
    output: string | null;
}

function parseArgs(argv: string[]): ParsedArgs | null {
    const result: ParsedArgs = {
        name: '',
        trials: 3,
        warmup: true,
        modelfile: null,
        envVars: [],
        output: null,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--help' || arg === '-h') {
            return null;
        }

        if (arg === '--name' && i + 1 < argv.length) {
            result.name = argv[++i];
        } else if (arg === '--trials' && i + 1 < argv.length) {
            result.trials = parseInt(argv[++i], 10);
        } else if (arg === '--warmup') {
            result.warmup = true;
        } else if (arg === '--no-warmup') {
            result.warmup = false;
        } else if (arg === '--modelfile' && i + 1 < argv.length) {
            result.modelfile = argv[++i];
        } else if (arg === '--env' && i + 1 < argv.length) {
            result.envVars.push(argv[++i]);
        } else if (arg === '--output' && i + 1 < argv.length) {
            result.output = argv[++i];
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Output parsing
// ---------------------------------------------------------------------------

/**
 * Parse the eval CLI output to extract per-trial data.
 *
 * The CLI prints a console.table with columns: Trial, Reward, Duration, Commands, ...
 * and a summary section with "Avg Duration", "Pass Rate", etc.
 *
 * console.table output looks like:
 *   (index)  Trial  Reward  Duration    Commands  ...
 *   0        1      '0.97'  '440.2s'    9         ...
 */
function parseEvalOutput(output: string): TrialData[] {
    const trials: TrialData[] = [];

    // Match lines from console.table output that contain trial data
    // Pattern: row index, Trial number, Reward (quoted), Duration (quoted with 's'), Commands
    const lines = output.split('\n');

    for (const line of lines) {
        // console.table rows look like: |  0  |  1  | '0.97' | '440.2s' |  9  | ...
        // Or in some environments: 0  1  '0.97'  '440.2s'  9  ...
        // We look for the Duration pattern like '123.4s' and extract surrounding values

        // Try to match a line with duration pattern (number followed by 's')
        const durationMatch = line.match(/['"](\d+(?:\.\d+)?)s['"]/);

        if (durationMatch) {
            // Extract reward -- look for a decimal like '0.97' or '1.00' before the duration
            const rewardMatch = line.match(/['"](\d+\.\d+)['"]/);
            // Extract commands -- look for a bare integer after the duration
            const afterDuration = line.substring(line.indexOf(durationMatch[0]) + durationMatch[0].length);
            const commandsMatch = afterDuration.match(/\b(\d+)\b/);

            // Extract trial number
            const trialMatch = line.match(/\b(\d+)\b/);

            if (rewardMatch && commandsMatch && trialMatch) {
                trials.push({
                    trial: trials.length + 1,
                    duration_s: parseFloat(durationMatch[1]),
                    reward: parseFloat(rewardMatch[1]),
                    commands: parseInt(commandsMatch[1], 10),
                });
            }
        }
    }

    return trials;
}

/**
 * Parse the summary line for average duration as a fallback.
 * Looks for: "Avg Duration 123.4s"
 */
function parseAvgDuration(output: string): number | null {
    const match = output.match(/Avg Duration\s+(\d+(?:\.\d+)?)s/);

    if (match) {
        return parseFloat(match[1]);
    }

    return null;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function standardDeviation(values: number[]): number {
    if (values.length < 2) {
        return 0;
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sqDiffs = values.map(v => (v - mean) ** 2);
    const variance = sqDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);

    return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
    const args = parseArgs(process.argv.slice(2));

    if (!args) {
        printUsage();
        process.exit(0);
    }

    if (!args.name) {
        console.error('[ERROR] --name is required');
        printUsage();
        process.exit(1);
    }

    const modelName = DEFAULT_OLLAMA_AGENT_CONFIG.model as string;
    const rootDir = path.resolve(__dirname, '..');
    // 600s per trial (10 min ceiling) to avoid killing multi-trial runs
    const perTrialTimeout = 600_000;
    const execOpts = { cwd: rootDir, encoding: 'utf-8' as const, timeout: perTrialTimeout, stdio: 'pipe' as const };

    // Step 1: Rebuild model if --modelfile provided
    if (args.modelfile) {
        console.error(`[INFO] Rebuilding model "${modelName}" from ${args.modelfile}`);

        try {
            execSync(`ollama create ${modelName} -f ${args.modelfile}`, { ...execOpts, stdio: 'inherit' });
        } catch (err) {
            console.error(`[ERROR] Failed to rebuild model: ${err}`);
            process.exit(1);
        }
    }

    // Step 2: Warm-up run
    if (args.warmup) {
        console.error('[INFO] Running warm-up trial (results discarded)...');

        try {
            execSync('npm run eval -- superlint_demo --agent=ollama --provider=local --trials=1', execOpts);
            console.error('[OK] Warm-up complete');
        } catch (err) {
            console.error(`[WARN] Warm-up trial failed: ${err}`);
        }
    }

    // Step 3: Measured trials -- run one at a time so each gets its own timeout
    console.error(`[INFO] Running ${args.trials} measured trial(s) for experiment "${args.name}"...`);
    const trials: TrialData[] = [];

    for (let i = 1; i <= args.trials; i++) {
        console.error(`[INFO] Trial ${i}/${args.trials}...`);
        let rawOutput: string;

        try {
            rawOutput = execSync(
                'npm run eval -- superlint_demo --agent=ollama --provider=local --trials=1',
                { ...execOpts, timeout: perTrialTimeout }
            );
        } catch (err: any) {
            // execSync throws on non-zero exit, but stdout may still have data
            if (err.stdout) {
                rawOutput = err.stdout;
                console.error(`[WARN] Trial ${i} process exited with non-zero code, parsing available output`);
            } else {
                console.error(`[ERROR] Trial ${i} failed: ${err}`);
                continue;
            }
        }

        const parsed = parseEvalOutput(rawOutput);

        if (parsed.length === 0) {
            console.error(`[WARN] Trial ${i}: could not parse data from output`);
            console.error('[INFO] Raw output:');
            console.error(rawOutput);
            continue;
        }

        // Re-number the trial
        const t = parsed[0];
        t.trial = i;
        trials.push(t);
        console.error(`[OK] Trial ${i}: ${t.duration_s}s | reward=${t.reward} | cmds=${t.commands}`);
    }

    if (trials.length === 0) {
        console.error('[ERROR] No trials completed successfully');
        process.exit(1);
    }

    // Step 5: Calculate statistics
    const durations = trials.map(t => t.duration_s);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const stdDev = standardDeviation(durations);
    const avgReward = trials.reduce((s, t) => s + t.reward, 0) / trials.length;
    const avgCommands = trials.reduce((s, t) => s + t.commands, 0) / trials.length;

    const result: BenchmarkOutput = {
        name: args.name,
        timestamp: new Date().toISOString(),
        modelfile: args.modelfile,
        trials,
        avg_duration_s: parseFloat(avgDuration.toFixed(1)),
        std_dev_s: parseFloat(stdDev.toFixed(1)),
        avg_reward: parseFloat(avgReward.toFixed(2)),
        avg_commands: parseFloat(avgCommands.toFixed(1)),
        target_met: avgDuration <= 300,
        reward_met: trials.every(t => t.reward >= 0.90),
    };

    // Step 6: Human-readable summary to stderr
    console.error('');
    console.error(`=== Benchmark Results: ${args.name} ===`);
    console.error('');

    for (const t of trials) {
        console.error(`  Trial ${t.trial}: ${t.duration_s}s | reward=${t.reward} | cmds=${t.commands}`);
    }

    console.error('');
    console.error(`  Avg Duration: ${result.avg_duration_s}s +/- ${result.std_dev_s}s`);
    console.error(`  Avg Reward:   ${result.avg_reward}`);
    console.error(`  Avg Commands: ${result.avg_commands}`);
    console.error(`  Target Met (<=300s): ${result.target_met ? '[OK]' : '[NO]'}`);
    console.error(`  Reward Met (>=0.90): ${result.reward_met ? '[OK]' : '[NO]'}`);
    console.error('');

    // Step 7: JSON output
    const jsonOutput = JSON.stringify(result, null, 2);

    if (args.output) {
        const outputDir = path.dirname(args.output);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(args.output, jsonOutput, 'utf-8');
        console.error(`[OK] Results written to ${args.output}`);
    } else {
        process.stdout.write(jsonOutput + '\n');
    }
}

main();
