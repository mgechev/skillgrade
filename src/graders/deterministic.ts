import { GraderConfig, GraderResult, EnvironmentProvider } from '../types';
import { Grader } from './index';

/**
 * Runs a command and parses structured JSON from stdout.
 *
 * The grader script MUST output JSON to stdout:
 *   { "score": 0.0-1.0, "details": "...", "checks": [...] }
 *
 * - score: float between 0.0 and 1.0
 * - details: human-readable summary
 * - checks: optional array of { name, passed, message } for per-check breakdown
 */
export class DeterministicGrader implements Grader {
    async grade(
        workspace: string,
        provider: EnvironmentProvider,
        config: GraderConfig,
        _taskPath: string,
        _sessionLog: any[],
        env?: Record<string, string>
    ): Promise<GraderResult> {
        const command = config.command || 'bash tests/test.sh';

        // Hand the grader its task context as one JSON document. One variable
        // rather than one per field, so `expected` keeps its structure.
        const graderEnv = config.input
            ? { ...env, SKILLGRADE_INPUT: JSON.stringify(config.input) }
            : env;

        const result = await provider.runCommand(workspace, command, graderEnv);

        // Parse JSON from stdout
        const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return {
                grader_type: 'deterministic',
                score: 0,
                weight: config.weight,
                details: `Grader did not output JSON. stdout: ${result.stdout.trim() || '(empty)'} stderr: ${result.stderr.trim() || '(empty)'}`
            };
        }

        try {
            const parsed = JSON.parse(jsonMatch[0]);
            const score = Math.max(0, Math.min(1, parseFloat(parsed.score) || 0));
            const details = parsed.details || `score=${score.toFixed(2)}`;
            const checks = parsed.checks || [];

            // Build rich details string with per-check breakdown
            const checkLines = checks.map((c: any) =>
                `  ${c.passed ? '✓' : '✗'} ${c.name}: ${c.message || ''}`
            );
            const fullDetails = checkLines.length > 0
                ? `${details}\n${checkLines.join('\n')}`
                : details;

            return {
                grader_type: 'deterministic',
                score,
                weight: config.weight,
                details: fullDetails
            };
        } catch (e) {
            return {
                grader_type: 'deterministic',
                score: 0,
                weight: config.weight,
                details: `Failed to parse grader JSON: ${jsonMatch[0].substring(0, 200)}`
            };
        }
    }
}
