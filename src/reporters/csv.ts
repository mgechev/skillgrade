import * as path from 'path';
import * as fs from 'fs-extra';
import { EvalReport, TrialResult } from '../types';
import type { Reporter } from './index';

const PASS_THRESHOLD = 0.5;
const CSV_HEADERS = 'task,trial_id,reward,duration_ms,n_commands,grader_scores,pass';

function escapeCsv(value: string | number | boolean): string {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function renderTrialRow(task: string, trial: TrialResult): string {
    const graderScores = trial.grader_results
        .map(g => `${g.grader_type}:${g.score}`)
        .join(';');
    const pass = trial.reward >= PASS_THRESHOLD;

    return [
        escapeCsv(task),
        escapeCsv(trial.trial_id),
        escapeCsv(trial.reward),
        escapeCsv(trial.duration_ms ?? 0),
        escapeCsv(trial.n_commands ?? 0),
        escapeCsv(graderScores),
        escapeCsv(pass),
    ].join(',');
}

export class CsvReporter implements Reporter {
    async report(results: EvalReport[], outputDir: string): Promise<string> {
        const rows = [CSV_HEADERS];
        for (const report of results) {
            for (const trial of report.trials) {
                rows.push(renderTrialRow(report.task, trial));
            }
        }
        const csv = rows.join('\n') + '\n';

        await fs.ensureDir(outputDir);
        const filePath = path.join(outputDir, 'results.csv');
        await fs.writeFile(filePath, csv, 'utf-8');
        return filePath;
    }
}
