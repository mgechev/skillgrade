import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
    getReporter,
    registerReporter,
    JUnitReporter,
    CsvReporter,
    MarkdownReporter,
    Reporter,
} from '../src/reporters';
import { EvalReport } from '../src/types';

vi.mock('fs-extra', () => ({
    ensureDir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
}));

const mockEnsureDir = vi.mocked(fs.ensureDir);
const mockWriteFile = vi.mocked(fs.writeFile);

describe('Reporter Plugin System', () => {
    const sampleResults: EvalReport[] = [
        {
            task: 'fix-bug & sanitize <inputs>',
            pass_rate: 0.5,
            pass_at_k: 0.75,
            pass_pow_k: 0.25,
            skills_used: ['debugging'],
            trials: [
                {
                    trial_id: 1,
                    reward: 1.0,
                    duration_ms: 1250,
                    n_commands: 3,
                    input_tokens: 100,
                    output_tokens: 200,
                    session_log: [],
                    grader_results: [
                        { grader_type: 'deterministic', score: 1.0, weight: 1.0, details: 'All tests passed' },
                    ],
                },
                {
                    trial_id: 2,
                    reward: 0.0,
                    duration_ms: 2500,
                    n_commands: 4,
                    input_tokens: 110,
                    output_tokens: 220,
                    session_log: [],
                    grader_results: [
                        { grader_type: 'deterministic', score: 0.0, weight: 1.0, details: 'Expected true, got false' },
                    ],
                },
            ],
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Reporter Registry', () => {
        it('resolves built-in reporters', () => {
            expect(getReporter('junit')).toBeInstanceOf(JUnitReporter);
            expect(getReporter('csv')).toBeInstanceOf(CsvReporter);
            expect(getReporter('markdown')).toBeInstanceOf(MarkdownReporter);
        });

        it('throws an error listing available formats for unknown format', () => {
            expect(() => getReporter('unknown-fmt')).toThrowError(
                /Unknown reporter format: "unknown-fmt"\. Available:.*junit.*csv.*markdown/,
            );
        });

        it('registers and resolves custom reporter', () => {
            const customReporter: Reporter = {
                report: vi.fn().mockResolvedValue('/tmp/custom.txt'),
            };
            registerReporter('custom', () => customReporter);

            const resolved = getReporter('custom');
            expect(resolved).toBe(customReporter);
        });
    });

    describe('JUnitReporter', () => {
        it('writes valid JUnit XML with testsuites and testcases', async () => {
            const reporter = new JUnitReporter();
            const outputDir = '/fake/output';

            const filePath = await reporter.report(sampleResults, outputDir);

            expect(mockEnsureDir).toHaveBeenCalledWith(outputDir);
            expect(mockWriteFile).toHaveBeenCalledTimes(1);
            expect(filePath).toBe(path.join(outputDir, 'junit.xml'));

            const [writtenPath, content] = mockWriteFile.mock.calls[0] as unknown as [string, string];
            expect(writtenPath).toBe(path.join(outputDir, 'junit.xml'));
            expect(content).toContain('<testsuites>');
            expect(content).toContain('<testsuite name="fix-bug &amp; sanitize &lt;inputs&gt;" tests="2" failures="1"');
            expect(content).toContain('<testcase name="trial-1" time="1.250" />');
            expect(content).toContain('<testcase name="trial-2" time="2.500">');
            expect(content).toContain('<failure message="deterministic: Expected true, got false">');
        });
    });

    describe('CsvReporter', () => {
        it('writes CSV with expected headers and properly escaped rows', async () => {
            const reporter = new CsvReporter();
            const outputDir = '/fake/output';

            const filePath = await reporter.report(sampleResults, outputDir);

            expect(mockEnsureDir).toHaveBeenCalledWith(outputDir);
            expect(filePath).toBe(path.join(outputDir, 'results.csv'));

            const [, content] = mockWriteFile.mock.calls[0] as unknown as [string, string];
            const lines = content.trim().split('\n');

            expect(lines[0]).toBe('task,trial_id,reward,duration_ms,n_commands,grader_scores,pass');
            expect(lines[1]).toContain('fix-bug & sanitize <inputs>,1,1,1250,3,deterministic:1,true');
            expect(lines[2]).toContain('fix-bug & sanitize <inputs>,2,0,2500,4,deterministic:0,false');
        });

        it('escapes comma-containing fields in quotes', async () => {
            const reporter = new CsvReporter();
            const outputDir = '/fake/output';
            const resultsWithComma: EvalReport[] = [
                {
                    task: 'task,with,commas',
                    pass_rate: 1.0,
                    pass_at_k: 1.0,
                    pass_pow_k: 1.0,
                    skills_used: [],
                    trials: [
                        {
                            trial_id: 1,
                            reward: 1.0,
                            duration_ms: 100,
                            n_commands: 1,
                            input_tokens: 10,
                            output_tokens: 10,
                            session_log: [],
                            grader_results: [],
                        },
                    ],
                },
            ];

            await reporter.report(resultsWithComma, outputDir);
            const [, content] = mockWriteFile.mock.calls[0] as unknown as [string, string];
            expect(content).toContain('"task,with,commas"');
        });
    });

    describe('MarkdownReporter', () => {
        it('writes report.md with summary table and task sections', async () => {
            const reporter = new MarkdownReporter();
            const outputDir = '/fake/output';

            const filePath = await reporter.report(sampleResults, outputDir);

            expect(mockEnsureDir).toHaveBeenCalledWith(outputDir);
            expect(filePath).toBe(path.join(outputDir, 'report.md'));

            const [, content] = mockWriteFile.mock.calls[0] as unknown as [string, string];
            expect(content).toContain('# Eval Report');
            expect(content).toContain('## Summary');
            expect(content).toContain('| Task | Pass Rate | Pass@k | Trials |');
            expect(content).toContain('| fix-bug & sanitize <inputs> | 50.0% | 75.0% | 2 |');
            expect(content).toContain('## fix-bug & sanitize <inputs>');
            expect(content).toContain('✅');
            expect(content).toContain('❌');
        });
    });
});
