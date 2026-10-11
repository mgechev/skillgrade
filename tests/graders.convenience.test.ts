import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    HumanGrader,
    getGrader,
    registerGrader,
    Grader,
} from '../src/graders';
import { EnvironmentProvider, GraderConfig } from '../src/types';

/**
 * Mock fs-extra at the module boundary (clean-code §9.4 — mock only
 * external boundaries). HumanGrader reads/writes files via fs-extra,
 * so we intercept that boundary.
 */
const mockEnsureDir = vi.fn().mockResolvedValue(undefined);
const mockWriteJSON = vi.fn().mockResolvedValue(undefined);
const mockPathExists = vi.fn().mockResolvedValue(false);
const mockReadJSON = vi.fn();

vi.mock('fs-extra', () => ({
    ensureDir: (...args: any[]) => mockEnsureDir(...args),
    writeJSON: (...args: any[]) => mockWriteJSON(...args),
    pathExists: (...args: any[]) => mockPathExists(...args),
    readJSON: (...args: any[]) => mockReadJSON(...args),
    // LLMGrader uses these — stub them to avoid import errors
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    default: {},
}));

function createMockProvider(): EnvironmentProvider {
    return {
        setup: vi.fn(),
        cleanup: vi.fn(),
        runCommand: vi.fn().mockResolvedValue({
            stdout: '',
            stderr: '',
            exitCode: 0,
        }),
    };
}

function createSessionLog(agentOutput: string): any[] {
    return [
        { type: 'agent_start', timestamp: '2024-01-01', instruction: 'Do the thing' },
        { type: 'agent_result', timestamp: '2024-01-01', output: agentOutput },
    ];
}

describe('HumanGrader', () => {
    const grader = new HumanGrader();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return parsed score when result file appears', async () => {
        mockPathExists.mockResolvedValueOnce(true);
        mockReadJSON.mockResolvedValueOnce({ score: 0.8, details: 'Looks good' });

        const config: GraderConfig = {
            type: 'human',
            weight: 1.0,
            prompt: 'Check the output quality',
            input: { task: 'test-task', trial: 0 },
        };

        const result = await grader.grade(
            '/tmp/workspace',
            createMockProvider(),
            config,
            '/tmp/task',
            createSessionLog('agent did stuff'),
        );

        expect(result.grader_type).toBe('human');
        expect(result.score).toBe(0.8);
        expect(result.details).toBe('Looks good');
        expect(result.weight).toBe(1.0);
    });

    it('should clamp score to 0.0-1.0 range', async () => {
        mockPathExists.mockResolvedValueOnce(true);
        mockReadJSON.mockResolvedValueOnce({ score: 1.5, details: 'Over-scored' });

        const config: GraderConfig = {
            type: 'human',
            weight: 1.0,
            input: { task: 'test-task', trial: 0 },
        };

        const result = await grader.grade(
            '/tmp/workspace',
            createMockProvider(),
            config,
            '/tmp/task',
            createSessionLog('output'),
        );

        expect(result.score).toBe(1.0);
    });

    it('should return zero score when result file has invalid JSON', async () => {
        mockPathExists.mockResolvedValueOnce(true);
        mockReadJSON.mockRejectedValueOnce(new Error('invalid json'));

        const config: GraderConfig = {
            type: 'human',
            weight: 0.5,
            input: { task: 'test-task', trial: 0 },
        };

        const result = await grader.grade(
            '/tmp/workspace',
            createMockProvider(),
            config,
            '/tmp/task',
            createSessionLog('output'),
        );

        expect(result.score).toBe(0);
        expect(result.details).toContain('Failed to parse review result');
    });

    it('should write review context with instruction, output, and commands', async () => {
        mockPathExists.mockResolvedValueOnce(true);
        mockReadJSON.mockResolvedValueOnce({ score: 1.0, details: 'Perfect' });

        const sessionLog = [
            { type: 'agent_start', timestamp: '2024-01-01', instruction: 'Fix the bug' },
            { type: 'command', timestamp: '2024-01-01', command: 'npm test', stdout: 'ok', exitCode: 0 },
            { type: 'agent_result', timestamp: '2024-01-01', output: 'Fixed it' },
        ];

        const config: GraderConfig = {
            type: 'human',
            weight: 1.0,
            prompt: 'Was the bug fixed?',
            input: { task: 'test-task', trial: 1, expected: 'clean output' },
        };

        await grader.grade('/tmp/workspace', createMockProvider(), config, '/tmp/task', sessionLog);

        const writeCall = mockWriteJSON.mock.calls[0];
        const context = writeCall[1] as Record<string, unknown>;
        expect(context.prompt).toBe('Was the bug fixed?');
        expect(context.instruction).toBe('Fix the bug');
        expect(context.agent_output).toBe('Fixed it');
        expect(context.expected).toBe('clean output');
        expect(context.commands).toEqual([{ command: 'npm test', stdout: 'ok', exitCode: 0 }]);
    });
});

describe('Grader registry', () => {
    it('should resolve built-in deterministic grader', () => {
        const grader = getGrader('deterministic');
        expect(grader).toBeDefined();
    });

    it('should resolve built-in llm_rubric grader', () => {
        const grader = getGrader('llm_rubric');
        expect(grader).toBeDefined();
    });

    it('should resolve built-in human grader', () => {
        const grader = getGrader('human');
        expect(grader).toBeDefined();
        expect(grader).toBeInstanceOf(HumanGrader);
    });

    it('should throw for unknown grader type with available types listed', () => {
        expect(() => getGrader('nonexistent')).toThrow(/Unknown grader type/);
        expect(() => getGrader('nonexistent')).toThrow(/deterministic/);
        expect(() => getGrader('nonexistent')).toThrow(/human/);
    });

    it('should allow registering a custom grader', () => {
        const mockGrader: Grader = {
            grade: vi.fn().mockResolvedValue({
                grader_type: 'custom',
                score: 0.42,
                weight: 1.0,
                details: 'custom result',
            }),
        };

        registerGrader('custom_test', () => mockGrader);
        const resolved = getGrader('custom_test');
        expect(resolved).toBe(mockGrader);
    });

    it('should allow overriding a built-in grader', () => {
        const replacement: Grader = {
            grade: vi.fn().mockResolvedValue({
                grader_type: 'human',
                score: 1.0,
                weight: 1.0,
                details: 'overridden',
            }),
        };

        registerGrader('human', () => replacement);
        expect(getGrader('human')).toBe(replacement);

        // Restore original for other tests
        registerGrader('human', () => new HumanGrader());
    });
});
