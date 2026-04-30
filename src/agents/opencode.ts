import { BaseAgent, CommandResult } from '../types';

export interface OpenCodeAgentConfig {
    agent?: string;
    model?: string;
}

export class OpenCodeAgent extends BaseAgent {
    private config: OpenCodeAgentConfig;

    constructor(config: OpenCodeAgentConfig = {}) {
        super();
        this.config = config;
    }

    async run(
        instruction: string,
        _workspacePath: string,
        runCommand: (cmd: string) => Promise<CommandResult>
    ): Promise<string> {
        const b64 = Buffer.from(instruction).toString('base64');
        await runCommand(`echo '${b64}' | base64 -d > /tmp/.prompt.md`);

        let command = 'opencode run';
        if (this.config.agent) {
            command += ` --agent ${this.config.agent}`;
        }
        if (this.config.model) {
            command += ` --model ${this.config.model}`;
        }
        command += ` "$(cat /tmp/.prompt.md)"`;

        const result = await runCommand(command);

        if (result.exitCode !== 0) {
            console.error('OpenCodeAgent: OpenCode failed to execute correctly.');
        }

        return result.stdout + '\n' + result.stderr;
    }
}
