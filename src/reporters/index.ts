import { EvalReport } from '../types';
import { JUnitReporter } from './junit';
import { CsvReporter } from './csv';
import { MarkdownReporter } from './markdown';

export interface Reporter {
    /** Generate a report from eval results. Returns the file path written. */
    report(results: EvalReport[], outputDir: string): Promise<string>;
}

const REPORTER_REGISTRY = new Map<string, () => Reporter>();

/** Register a reporter factory for an output format */
export function registerReporter(format: string, factory: () => Reporter): void {
    REPORTER_REGISTRY.set(format.toLowerCase(), factory);
}

/** Retrieve a reporter by format name */
export function getReporter(format: string): Reporter {
    const factory = REPORTER_REGISTRY.get(format.toLowerCase());
    if (!factory) {
        const available = Array.from(REPORTER_REGISTRY.keys()).join(', ');
        throw new Error(`Unknown reporter format: "${format}". Available: ${available}`);
    }
    return factory();
}

// Pre-register built-in reporters
registerReporter('junit', () => new JUnitReporter());
registerReporter('csv', () => new CsvReporter());
registerReporter('markdown', () => new MarkdownReporter());

export { JUnitReporter } from './junit';
export { CsvReporter } from './csv';
export { MarkdownReporter } from './markdown';
