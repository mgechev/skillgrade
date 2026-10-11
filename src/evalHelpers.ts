/**
 * Helper utilities for eval execution, grading, and reporting.
 */
import * as path from 'path';
import {
    EnvironmentProvider,
    LogEntry,
    EvalReport,
    GraderResult,
    AgentResult
} from './types';
import { ResolvedGrader } from './core/config.types';
import { getGrader } from './graders';
import { Spinner } from './utils/cli';
import { EvalRunOptions } from './evalRunner';

/** Run a promise with a timeout, rejecting with a labeled error on expiry. */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs);

        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

/**
 * Calculate pass@k: probability of at least 1 success in k trials
 * Using unbiased estimator: 1 - C(n-c, k) / C(n, k)
 */
export function calculatePassAtK(n: number, c: number, k: number): number {
    if (n - c < k) return 1.0;
    let result = 1.0;
    for (let i = 0; i < k; i++) {
        result *= (n - c - i) / (n - i);
    }
    return 1.0 - result;
}

/** Calculate pass^k: probability that all k trials succeed. */
export function calculatePassPowK(n: number, c: number, k: number): number {
    const p = c / n;
    return Math.pow(p, k);
}

/** Estimate token count from text (~4 chars per token). */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/** Normalize agent output to AgentResult format. */
export function normalizeAgentOutput(raw: string | AgentResult): AgentResult {
    if (typeof raw === 'string') {
        return {
            output: raw,
            skills_triggered: [],
            tools_used: [],
        };
    }
    return raw;
}

/** Execute a list of graders against the workspace and append grader log entries. */
export async function executeGraders(
    provider: EnvironmentProvider,
    graders: ResolvedGrader[],
    workspace: string,
    taskPath: string,
    index: number,
    opts: EvalRunOptions,
    sessionLog: LogEntry[],
    timestamp: () => string,
    env?: Record<string, string>,
    spinner?: Spinner
): Promise<GraderResult[]> {
    const graderResults: GraderResult[] = [];
    for (let gIdx = 0; gIdx < graders.length; gIdx++) {
        const graderDef = graders[gIdx];
        const grader = getGrader(graderDef.type);
        spinner?.update(`grading (${graderDef.type}${graders.length > 1 ? ` ${gIdx + 1}/${graders.length}` : ''})`);

        const detIndex = graders.slice(0, gIdx).filter(g => g.type === 'deterministic').length;
        const llmIndex = graders.slice(0, gIdx).filter(g => g.type === 'llm_rubric').length;

        const graderConfig = {
            type: graderDef.type,
            command: graderDef.type === 'deterministic'
                ? `bash tests/${detIndex === 0 ? 'test.sh' : `test_${detIndex}.sh`}`
                : undefined,
            rubric: graderDef.type === 'llm_rubric'
                ? `prompts/${llmIndex === 0 ? 'quality.md' : `quality_${llmIndex}.md`}`
                : undefined,
            model: graderDef.model || opts.graderModel,
            provider: graderDef.provider || opts.graderProvider,
            weight: graderDef.weight,
            input: {
                task: path.basename(taskPath),
                trial: index,
                expected: opts.expected,
                metadata: opts.metadata,
            },
        };

        const graderTimeoutMs = (opts.graderTimeoutSec ?? 120) * 1000;
        const result = await withTimeout(
            grader.grade(workspace, provider, graderConfig, taskPath, sessionLog, env),
            graderTimeoutMs,
            `Grader ${graderDef.type} (limit: ${opts.graderTimeoutSec ?? 120}s)`
        );
        graderResults.push(result);
        sessionLog.push({
            type: 'grader',
            timestamp: timestamp(),
            grader_result: result,
        });
    }
    return graderResults;
}

/** Sanitize secrets from an eval report before writing to disk. */
export function sanitizeReport(report: EvalReport, env?: Record<string, string>): EvalReport {
    if (!env) return report;

    const sanitized: EvalReport = JSON.parse(JSON.stringify(report));
    const secrets = Object.values(env);

    const redact = (text: string) => {
        let result = text;
        for (const secret of secrets) {
            if (secret && secret.length > 5) {
                result = result.split(secret).join('[REDACTED]');
            }
        }
        return result;
    };

    for (const trial of sanitized.trials) {
        for (const entry of trial.session_log) {
            if (entry.instruction) entry.instruction = redact(entry.instruction);
            if (entry.command) entry.command = redact(entry.command);
            if (entry.stdout) entry.stdout = redact(entry.stdout);
            if (entry.stderr) entry.stderr = redact(entry.stderr);
            if (entry.output) entry.output = redact(entry.output);
            if (entry.grader_result?.details) entry.grader_result.details = redact(entry.grader_result.details);
        }
        for (const gr of trial.grader_results) {
            if (gr.details) gr.details = redact(gr.details);
        }
    }

    return sanitized;
}
