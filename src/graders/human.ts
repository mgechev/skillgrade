import { GraderConfig, GraderResult, EnvironmentProvider } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Grader } from './index';

/**
 * Pauses for manual review. Writes the task context to a review file and
 * prompts the reviewer via stdout. The reviewer writes a JSON result file
 * and the grader reads it back.
 *
 * Config: { type: 'human', prompt: 'Check that...', weight: 0.5 }
 *
 * The review file is written to `<workspace>/.review/<task>-<trial>.json`
 * with the session transcript and prompt. The reviewer writes their score
 * to `<workspace>/.review/<task>-<trial>.result.json` with the standard
 * grader output format: { "score": 0.0-1.0, "details": "..." }
 */
export class HumanGrader implements Grader {
    async grade(
        workspace: string,
        _provider: EnvironmentProvider,
        config: GraderConfig,
        taskPath: string,
        sessionLog: any[],
        _env?: Record<string, string>
    ): Promise<GraderResult> {
        const taskName = path.basename(taskPath);
        const trial = config.input?.trial ?? 0;
        const reviewDir = path.join(workspace, '.review');
        await fs.ensureDir(reviewDir);

        const reviewContext = buildReviewContext(config, sessionLog);
        const reviewPath = path.join(reviewDir, `${taskName}-${trial}.json`);
        const resultPath = path.join(reviewDir, `${taskName}-${trial}.result.json`);
        await fs.writeJSON(reviewPath, reviewContext, { spaces: 2 });

        printReviewBanner(taskName, trial, config.prompt, reviewPath, resultPath);

        return waitForResult(resultPath, config);
    }
}

function printReviewBanner(
    taskName: string,
    trial: number,
    prompt: string | undefined,
    reviewPath: string,
    resultPath: string,
): void {
    console.log(`\n  ┌─ HUMAN REVIEW REQUIRED ─────────────────────`);
    console.log(`  │ Task:   ${taskName} (trial ${trial})`);
    if (prompt) {
        console.log(`  │ Prompt: ${prompt.substring(0, 80)}`);
    }
    console.log(`  │ Context: ${reviewPath}`);
    console.log(`  │`);
    console.log(`  │ Write your score to:`);
    console.log(`  │   ${resultPath}`);
    console.log(`  │ Format: {"score": 0.0-1.0, "details": "..."}`);
    console.log(`  └──────────────────────────────────────────────\n`);
}

function buildReviewContext(
    config: GraderConfig,
    sessionLog: any[]
): Record<string, unknown> {
    const instruction = sessionLog.find(e => e.type === 'agent_start')?.instruction;
    const agentOutput = sessionLog
        .filter(e => e.type === 'agent_result')
        .map(e => e.output || '')
        .join('\n');
    const commands = sessionLog
        .filter(e => e.type === 'command')
        .map(e => ({ command: e.command, stdout: e.stdout, exitCode: e.exitCode }));

    return {
        prompt: config.prompt,
        instruction,
        agent_output: agentOutput,
        commands,
        expected: config.input?.expected,
    };
}

const REVIEW_POLL_INTERVAL_MS = 2000;
const REVIEW_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

async function waitForResult(
    resultPath: string,
    config: GraderConfig
): Promise<GraderResult> {
    const deadline = Date.now() + REVIEW_TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (await fs.pathExists(resultPath)) {
            return parseResultFile(resultPath, config);
        }
        await new Promise(resolve => setTimeout(resolve, REVIEW_POLL_INTERVAL_MS));
    }

    return {
        grader_type: 'human',
        score: 0,
        weight: config.weight,
        details: 'Human review timed out after 30 minutes',
    };
}

async function parseResultFile(
    resultPath: string,
    config: GraderConfig
): Promise<GraderResult> {
    try {
        const parsed = await fs.readJSON(resultPath);
        const score = Math.max(0, Math.min(1, parseFloat(parsed.score) || 0));
        return {
            grader_type: 'human',
            score,
            weight: config.weight,
            details: parsed.details || `Human score: ${score.toFixed(2)}`,
        };
    } catch (e) {
        return {
            grader_type: 'human',
            score: 0,
            weight: config.weight,
            details: `Failed to parse review result: ${e}`,
        };
    }
}
