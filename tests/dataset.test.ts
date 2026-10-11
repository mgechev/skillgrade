import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs-extra', () => ({
    pathExists: vi.fn(),
    readFile: vi.fn(),
}));

import * as fs from 'fs-extra';
import { loadDataset, interpolateTemplate, expandDatasetTasks } from '../src/core/dataset';
import { EvalTaskConfig } from '../src/core/config.types';

const mockPathExists = vi.mocked(fs.pathExists);
const mockReadFile = vi.mocked(fs.readFile);

describe('dataset', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('interpolateTemplate', () => {
        it('replaces known keys with row values', () => {
            // Arrange
            const template = 'Translate {{input}} into uppercase';
            const row = { input: 'hello world' };

            // Act
            const result = interpolateTemplate(template, row);

            // Assert
            expect(result).toBe('Translate hello world into uppercase');
        });

        it('leaves unknown placeholder keys intact', () => {
            // Arrange
            const template = 'Hello {{name}}, your role is {{role}} and {{unknown}}';
            const row = { name: 'Alice', role: 'admin' };

            // Act
            const result = interpolateTemplate(template, row);

            // Assert
            expect(result).toBe('Hello Alice, your role is admin and {{unknown}}');
        });
    });

    describe('loadDataset', () => {
        it('parses JSONL lines and skips blank lines', async () => {
            // Arrange
            mockPathExists.mockResolvedValue(true as any);
            mockReadFile.mockResolvedValue(`
                {"input": "hello", "expected_output": "HELLO"}

                {"input": "world", "expected_output": "WORLD"}
            ` as any);

            // Act
            const rows = await loadDataset('data.jsonl', '/test/dir');

            // Assert
            expect(rows).toEqual([
                { input: 'hello', expected_output: 'HELLO' },
                { input: 'world', expected_output: 'WORLD' },
            ]);
        });

        it('parses CSV headers and handles quoted fields with commas', async () => {
            // Arrange
            mockPathExists.mockResolvedValue(true as any);
            mockReadFile.mockResolvedValue(
                ('input,expected_output\n' +
                '"hello, world",HELLO\n' +
                'test,TEST\n') as any
            );

            // Act
            const rows = await loadDataset('data.csv', '/test/dir');

            // Assert
            expect(rows).toEqual([
                { input: 'hello, world', expected_output: 'HELLO' },
                { input: 'test', expected_output: 'TEST' },
            ]);
        });

        it('throws an error when dataset file does not exist', async () => {
            // Arrange
            mockPathExists.mockResolvedValue(false as any);

            // Act & Assert
            await expect(loadDataset('missing.csv', '/test/dir')).rejects.toThrow(
                /Dataset file not found/
            );
        });

        it('throws an error for unsupported file formats', async () => {
            // Arrange
            mockPathExists.mockResolvedValue(true as any);
            mockReadFile.mockResolvedValue('content' as any);

            // Act & Assert
            await expect(loadDataset('data.txt', '/test/dir')).rejects.toThrow(
                /Unsupported dataset format/
            );
        });
    });

    describe('expandDatasetTasks', () => {
        it('expands a single task with 3-row dataset into 3 tasks with correct names and expected', async () => {
            // Arrange
            mockPathExists.mockResolvedValue(true as any);
            mockReadFile.mockResolvedValue(
                '{"input": "item-0", "val": 10}\n' +
                '{"input": "item-1", "val": 20}\n' +
                '{"input": "item-2", "val": 30}\n' as any
            );

            const task: EvalTaskConfig = {
                name: 'process-item',
                instruction: 'Process input {{input}} with threshold {{val}}',
                dataset: 'items.jsonl',
                graders: [{ type: 'deterministic', run: 'echo ok', weight: 1 }],
                timeout: 120,
            };

            // Act
            const expanded = await expandDatasetTasks([task], '/workspace');

            // Assert
            expect(expanded).toHaveLength(3);
            expect(expanded[0].name).toBe('process-item/0');
            expect(expanded[0].instruction).toBe('Process input item-0 with threshold 10');
            expect(expanded[0].expected).toEqual({ input: 'item-0', val: 10 });
            expect(expanded[0].timeout).toBe(120);
            expect(expanded[0].dataset).toBeUndefined();

            expect(expanded[1].name).toBe('process-item/1');
            expect(expanded[1].instruction).toBe('Process input item-1 with threshold 20');
            expect(expanded[1].expected).toEqual({ input: 'item-1', val: 20 });

            expect(expanded[2].name).toBe('process-item/2');
            expect(expanded[2].instruction).toBe('Process input item-2 with threshold 30');
            expect(expanded[2].expected).toEqual({ input: 'item-2', val: 30 });
        });

        it('leaves tasks without dataset unchanged', async () => {
            // Arrange
            const task: EvalTaskConfig = {
                name: 'static-task',
                instruction: 'Do static work',
                graders: [{ type: 'deterministic', run: 'echo ok', weight: 1 }],
            };

            // Act
            const result = await expandDatasetTasks([task], '/workspace');

            // Assert
            expect(result).toEqual([task]);
        });
    });
});
