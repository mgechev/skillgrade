import * as fs from 'fs';
import * as path from 'path';

function main() {
    console.log('Running Modelfile config tests...');
    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, message: string): void {
        if (condition) {
            console.log(`  [OK] ${message}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${message}`);
            failed++;
        }
    }

    // Read Modelfile content (current active model: qwen2.5-3b)
    const modelfilePath = path.join(__dirname, '..', 'modelfiles', 'qwen2.5-3b-skill-eval-agent.Modelfile');
    const content = fs.readFileSync(modelfilePath, 'utf-8');

    // Modelfile content assertions
    assert(content.includes('FROM qwen2.5:3b'), 'Modelfile contains FROM qwen2.5:3b');
    assert(content.includes('num_ctx 4096'), 'Modelfile contains num_ctx 4096 (OLCFG-01)');
    assert(content.includes('num_predict 4096'), 'Modelfile contains num_predict 4096 (OLCFG-02)');
    assert(content.includes('temperature 0'), 'Modelfile contains temperature 0 (deterministic)');
    assert(content.includes('num_thread 8'), 'Modelfile contains num_thread 8 (CPU cap)');

    // Verify old qwen3.5 Modelfile still exists as reference
    const oldModelfilePath = path.join(__dirname, '..', 'modelfiles', 'qwen3.5-skill-eval-agent.Modelfile');
    assert(fs.existsSync(oldModelfilePath), 'Old qwen3.5 Modelfile still exists as reference');

    // Types module compile check -- import and verify exports are defined
    const types = require('../src/agents/ollama/types');

    assert(
        typeof types.DEFAULT_OLLAMA_AGENT_CONFIG === 'object',
        'types.ts exports DEFAULT_OLLAMA_AGENT_CONFIG object'
    );
    assert(
        types.DEFAULT_OLLAMA_AGENT_CONFIG.model === 'qwen2.5-3b-skill-eval-agent',
        'OllamaAgentConfig default model is qwen2.5-3b-skill-eval-agent'
    );
    assert(
        types.DEFAULT_OLLAMA_AGENT_CONFIG.host === 'http://localhost:11434',
        'OllamaAgentConfig default host is http://localhost:11434'
    );
    assert(
        types.DEFAULT_OLLAMA_AGENT_CONFIG.maxIterations === 30,
        'OllamaAgentConfig default maxIterations is 30'
    );
    assert(
        types.DEFAULT_OLLAMA_AGENT_CONFIG.maxToolOutputChars === 8000,
        'OllamaAgentConfig default maxToolOutputChars is 8000'
    );

    // Summary
    console.log(`\n${passed} passed, ${failed} failed`);

    if (failed > 0) {
        process.exit(1);
    }

    console.log('[SUCCESS] All Modelfile config tests passed.');
}

main();
