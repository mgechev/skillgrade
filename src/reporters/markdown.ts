import * as path from 'path';
import * as fs from 'fs-extra';
import { EvalReport, TrialResult } from '../types';
import type { Reporter } from './index';

const PASS_THRESHOLD = 0.5;

function renderSummaryTable(results: EvalReport[]): string {
    const rows = [
        '| Task | Pass Rate | Pass@k | Trials |',
        '| --- | --- | --- | --- |',
    ];
    for (const report of results) {
        const passRate = `${(report.pass_rate * 100).toFixed(1)}%`;
        const passAtK = report.pass_at_k != null ? `${(report.pass_at_k * 100).toFixed(1)}%` : '—';
        rows.push(`| ${report.task} | ${passRate} | ${passAtK} | ${report.trials.length} |`);
    }
    return rows.join('\n');
}

function renderTrialDetails(trial: TrialResult): string {
    const status = trial.reward >= PASS_THRESHOLD ? '✅' : '❌';
    const duration = ((trial.duration_ms || 0) / 1000).toFixed(2);
    const scores = trial.grader_results.map(g => `${g.grader_type}:${g.score}`).join('; ') || '—';
    return `| ${trial.trial_id} | ${status} | ${trial.reward.toFixed(2)} | ${duration}s | ${scores} |`;
}

function renderTaskSection(report: EvalReport): string {
    const trialRows = [
        `## ${report.task}`,
        '',
        '| Trial | Status | Reward | Duration | Graders |',
        '| --- | --- | --- | --- | --- |',
        ...report.trials.map(renderTrialDetails),
    ];
    return trialRows.join('\n');
}

export class MarkdownReporter implements Reporter {
    async report(results: EvalReport[], outputDir: string): Promise<string> {
        const timestamp = new Date().toISOString();
        const sections = [
            `# Eval Report`,
            '',
            `*Generated at: ${timestamp}*`,
            '',
            `## Summary`,
            '',
            renderSummaryTable(results),
            '',
            ...results.map(renderTaskSection),
        ];

        const md = sections.join('\n') + '\n';
        await fs.ensureDir(outputDir);
        const filePath = path.join(outputDir, 'report.md');
        await fs.writeFile(filePath, md, 'utf-8');
        return filePath;
    }
}
