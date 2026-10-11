import * as path from 'path';
import * as fs from 'fs-extra';
import { EvalReport, TrialResult } from '../types';
import type { Reporter } from './index';

const PASS_THRESHOLD = 0.5;

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatTrialFailure(trial: TrialResult): string {
    const details = trial.grader_results
        .map(g => `${g.grader_type}: ${g.details}`)
        .join('; ');
    return details || `Trial failed with reward ${trial.reward}`;
}

function renderTestCase(trial: TrialResult): string {
    const timeSec = ((trial.duration_ms || 0) / 1000).toFixed(3);
    const name = `trial-${trial.trial_id}`;

    if (trial.reward >= PASS_THRESHOLD) {
        return `    <testcase name="${name}" time="${timeSec}" />`;
    }

    const failureMsg = escapeXml(formatTrialFailure(trial));
    return `    <testcase name="${name}" time="${timeSec}">\n      <failure message="${failureMsg}">${failureMsg}</failure>\n    </testcase>`;
}

function renderTestSuite(report: EvalReport): string {
    const tests = report.trials.length;
    const failures = report.trials.filter(t => t.reward < PASS_THRESHOLD).length;
    const timeSec = (report.trials.reduce((sum, t) => sum + (t.duration_ms || 0), 0) / 1000).toFixed(3);
    const taskName = escapeXml(report.task);

    const testcases = report.trials.map(renderTestCase).join('\n');
    return `  <testsuite name="${taskName}" tests="${tests}" failures="${failures}" time="${timeSec}">\n${testcases}\n  </testsuite>`;
}

export class JUnitReporter implements Reporter {
    async report(results: EvalReport[], outputDir: string): Promise<string> {
        const suites = results.map(renderTestSuite).join('\n');
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n${suites}\n</testsuites>\n`;

        await fs.ensureDir(outputDir);
        const filePath = path.join(outputDir, 'junit.xml');
        await fs.writeFile(filePath, xml, 'utf-8');
        return filePath;
    }
}
