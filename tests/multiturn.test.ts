import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateConfig } from '../src/core/config';
import { EvalRunner, EvalRunOptions } from '../src/evalRunner';
import { BaseAgent, EnvironmentProvider, GraderResult } from '../src/types';

vi.mock('fs-extra', () => ({
    readFile: vi.fn(),
    ensureDir: vi.fn(),
    writeJSON: vi.fn(),
    pathExists: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/graders', () => ({
    getGrader: vi.fn(),
}));

describe('Multi-Turn Evaluation', () => {
    function makeMockProvider(): EnvironmentProvider {
        return {
            setup: vi.fn().mockResolvedValue('/workspace'),
            cleanup: vi.fn().mockResolvedValue(undefined),
            runCommand: vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 }),
        };
    }

    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    describe('Config Validation', () => {
        it('throws an error when both instruction and turns are configured', async () => {
            const raw = {
                version: '1',
                tasks: [
                    {
                        name: 'invalid-both',
                        instruction: 'Single instruction',
                        turns: [{ instruction: 'Turn 1' }],
                        graders: [{ type: 'deterministic', run: 'echo 1' }],
                    },
                ],
            };

            await expect(validateConfig(raw)).rejects.toThrow('cannot have both "instruction" and "turns"');
        });

        it('throws an error when neither instruction nor turns is configured', async () => {
            const raw = {
                version: '1',
                tasks: [
                    {
                        name: 'invalid-neither',
                        graders: [{ type: 'deterministic', run: 'echo 1' }],
                    },
                ],
            };

            await expect(validateConfig(raw)).rejects.toThrow('must have either "instruction" or "turns"');
        });

        it('validates and parses multi-turn task configs with turn graders', async () => {
            const raw = {
                version: '1',
                tasks: [
                    {
                        name: 'valid-multiturn',
                        turns: [
                            {
                                instruction: 'Turn 1 prompt',
                                graders: [{ type: 'deterministic', run: 'test1.sh', weight: 1.0 }],
                            },
                            {
                                instruction: 'Turn 2 prompt',
                                graders: [{ type: 'deterministic', run: 'test2.sh', weight: 2.0 }],
                            },
                        ],
                    },
                ],
            };

            const config = await validateConfig(raw);

            expect(config.tasks).toHaveLength(1);
            expect(config.tasks[0].turns).toHaveLength(2);
            expect(config.tasks[0].turns?.[0].instruction).toBe('Turn 1 prompt');
            expect(config.tasks[0].turns?.[0].graders?.[0].run).toBe('test1.sh');
            expect(config.tasks[0].turns?.[1].instruction).toBe('Turn 2 prompt');
            expect(config.tasks[0].turns?.[1].graders?.[0].weight).toBe(2.0);
        });
    });

    describe('EvalRunner Multi-Turn Execution', () => {
        it('preserves single-turn behavior for backward compatibility', async () => {
            const provider = makeMockProvider();
            const agent: BaseAgent = {
                run: vi.fn().mockResolvedValue('Single-turn answer'),
            };

            const mockGrader = {
                grade: vi.fn().mockResolvedValue({
                    grader_type: 'deterministic',
                    score: 1.0,
                    weight: 1.0,
                    details: 'pass',
                } as GraderResult),
            };

            const gradersModule = await import('../src/graders');
            vi.spyOn(gradersModule, 'getGrader').mockReturnValue(mockGrader);

            const runner = new EvalRunner(provider);
            const opts: EvalRunOptions = {
                instruction: 'Single turn instruction',
                graders: [{ type: 'deterministic', run: 'test.sh', weight: 1.0 }],
                timeoutSec: 30,
                environment: { cpus: 2, memory_mb: 2048 },
            };

            const report = await runner.runEval(agent, '/task', [], opts, 1);

            expect(agent.run).toHaveBeenCalledTimes(1);
            expect(report.trials[0].reward).toBe(1.0);
            expect(provider.setup).toHaveBeenCalledTimes(1);
            expect(provider.cleanup).toHaveBeenCalledTimes(1);
        });

        it('executes multi-turn conversation across 2 turns with per-turn grading', async () => {
            const provider = makeMockProvider();
            const runTurnMock = vi.fn()
                .mockResolvedValueOnce('Turn 1 output')
                .mockResolvedValueOnce('Turn 2 output');

            const agent: BaseAgent = {
                run: vi.fn().mockResolvedValue('Default run output'),
                runTurn: runTurnMock,
            };

            let gradeCallCount = 0;
            const mockGrader = {
                grade: vi.fn().mockImplementation(async () => {
                    gradeCallCount++;
                    return {
                        grader_type: 'deterministic',
                        score: gradeCallCount === 1 ? 0.8 : 1.0,
                        weight: 1.0,
                        details: `Grade turn ${gradeCallCount}`,
                    } as GraderResult;
                }),
            };

            const gradersModule = await import('../src/graders');
            vi.spyOn(gradersModule, 'getGrader').mockReturnValue(mockGrader);

            const runner = new EvalRunner(provider);
            const opts: EvalRunOptions = {
                instruction: 'Turn 1 instruction',
                graders: [],
                timeoutSec: 30,
                environment: { cpus: 2, memory_mb: 2048 },
                turns: [
                    {
                        instruction: 'Turn 1 instruction',
                        graders: [{ type: 'deterministic', run: 'grade1.sh', weight: 1.0 }],
                    },
                    {
                        instruction: 'Turn 2 instruction',
                        graders: [{ type: 'deterministic', run: 'grade2.sh', weight: 1.0 }],
                    },
                ],
            };

            const report = await runner.runEval(agent, '/task', [], opts, 1);
            const trial = report.trials[0];

            expect(runTurnMock).toHaveBeenCalledTimes(2);
            expect(runTurnMock).toHaveBeenNthCalledWith(
                1,
                'Turn 1 instruction',
                '/workspace',
                expect.any(Function),
                0,
                []
            );
            expect(runTurnMock).toHaveBeenNthCalledWith(
                2,
                'Turn 2 instruction',
                '/workspace',
                expect.any(Function),
                1,
                ['Turn 1 output']
            );

            // Workspace setup and cleanup called once per trial (workspace state persists across turns)
            expect(provider.setup).toHaveBeenCalledTimes(1);
            expect(provider.cleanup).toHaveBeenCalledTimes(1);

            // Both turn graders ran and reward is averaged
            expect(trial.grader_results).toHaveLength(2);
            expect(trial.reward).toBe(0.9);

            // Verify turn_start and turn_end events in session log
            const logTypes = trial.session_log.map(e => e.type);
            expect(logTypes).toContain('turn_start');
            expect(logTypes).toContain('turn_end');
        });

        it('falls back to agent.run() when agent.runTurn() is not defined', async () => {
            const provider = makeMockProvider();
            const runMock = vi.fn()
                .mockResolvedValueOnce('Turn 1 result')
                .mockResolvedValueOnce('Turn 2 result');

            const agent: BaseAgent = {
                run: runMock,
            };

            const mockGrader = {
                grade: vi.fn().mockResolvedValue({
                    grader_type: 'deterministic',
                    score: 1.0,
                    weight: 1.0,
                    details: 'passed',
                } as GraderResult),
            };

            const gradersModule = await import('../src/graders');
            vi.spyOn(gradersModule, 'getGrader').mockReturnValue(mockGrader);

            const runner = new EvalRunner(provider);
            const opts: EvalRunOptions = {
                instruction: 'Turn 1 instruction',
                graders: [],
                timeoutSec: 30,
                environment: { cpus: 2, memory_mb: 2048 },
                turns: [
                    { instruction: 'Turn 1 instruction', graders: [] },
                    {
                        instruction: 'Turn 2 instruction',
                        graders: [{ type: 'deterministic', run: 'grade2.sh', weight: 1.0 }],
                    },
                ],
            };

            const report = await runner.runEval(agent, '/task', [], opts, 1);

            expect(runMock).toHaveBeenCalledTimes(2);
            expect(runMock).toHaveBeenNthCalledWith(1, 'Turn 1 instruction', '/workspace', expect.any(Function));
            expect(runMock).toHaveBeenNthCalledWith(2, 'Turn 2 instruction', '/workspace', expect.any(Function));
            expect(report.trials[0].reward).toBe(1.0);
        });
    });
});
