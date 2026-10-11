/**
 * Dataset loader and template interpolation for batch evaluation tasks.
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { EvalTaskConfig } from './config.types';

/** Single row of dataset values */
export type DatasetRow = Record<string, unknown>;

/**
 * Replace {{key}} placeholders in template with corresponding row values.
 * Unmatched {{...}} placeholders are preserved.
 */
export function interpolateTemplate(template: string, row: DatasetRow): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmed = key.trim();
        if (Object.prototype.hasOwnProperty.call(row, trimmed) && row[trimmed] !== undefined) {
            return String(row[trimmed]);
        }
        return match;
    });
}

/** Parse single CSV line handling quoted fields with commas */
function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
            continue;
        }
        if (char === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    fields.push(current.trim());
    return fields;
}

/** Parse CSV content into dataset rows */
function parseCsv(content: string): DatasetRow[] {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    const headers = parseCsvLine(lines[0]);
    return lines.slice(1).map(line => {
        const values = parseCsvLine(line);
        const row: DatasetRow = {};
        for (let i = 0; i < headers.length; i++) row[headers[i]] = values[i] ?? '';
        return row;
    });
}

/** Parse JSONL content into dataset rows */
function parseJsonl(content: string): DatasetRow[] {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    return lines.map((line, idx) => {
        try {
            return JSON.parse(line) as DatasetRow;
        } catch (err: any) {
            throw new Error(`Invalid JSON on line ${idx + 1}: ${err.message}`);
        }
    });
}

/**
 * Load dataset from a JSONL or CSV file resolved relative to basePath.
 */
export async function loadDataset(filePath: string, basePath: string): Promise<DatasetRow[]> {
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);
    if (!await fs.pathExists(resolvedPath)) {
        throw new Error(`Dataset file not found: ${resolvedPath}`);
    }
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext === '.jsonl') return parseJsonl(content);
    if (ext === '.csv') return parseCsv(content);
    throw new Error(`Unsupported dataset format: ${ext}. Supported formats are .jsonl and .csv`);
}

/**
 * Expand tasks containing a dataset reference into one task per dataset row.
 */
export async function expandDatasetTasks(
    tasks: EvalTaskConfig[],
    configDir: string
): Promise<EvalTaskConfig[]> {
    const expanded: EvalTaskConfig[] = [];
    for (const task of tasks) {
        if (!task.dataset) {
            expanded.push(task);
            continue;
        }
        const basePath = task.sourceFile ? path.dirname(task.sourceFile) : configDir;
        const rows = await loadDataset(task.dataset, basePath);
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const { dataset: _, ...taskWithoutDataset } = task;
            const expandedTask: EvalTaskConfig = {
                ...taskWithoutDataset,
                name: `${task.name}/${i}`,
                expected: row,
            };
            if (task.instruction) {
                expandedTask.instruction = interpolateTemplate(task.instruction, row);
            }
            expanded.push(expandedTask);
        }
    }
    return expanded;
}
