/**
 * `skillgrade preview` command.
 *
 * Opens the CLI or browser results viewer.
 */
import * as path from 'path';
import * as os from 'os';
import { runCliPreview } from '../reporters/cli';
import { runBrowserPreview } from '../reporters/browser';

export async function runPreview(dir: string, mode: 'cli' | 'browser', outputDir?: string) {
    const base = outputDir || path.join(os.tmpdir(), 'skillgrade');
    const resultsDir = path.join(base, path.basename(dir), 'results');

    if (mode === 'browser') {
        await runBrowserPreview(resultsDir);
    } else {
        await runCliPreview(resultsDir);
    }
}
