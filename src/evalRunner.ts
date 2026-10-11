import * as fs from 'fs-extra';
import * as path from 'path';
import {
    BaseAgent, EnvironmentProvider,
    LogEntry, TrialResult, EvalReport, GraderResult, AgentResult, CommandResult
} from './types';
import { ResolvedGrader, ResolvedTurn } from './core/config.types';
import { fmt, Spinner } from './utils/cli';
import {
    withTimeout,
    calculatePassAtK,
    calculatePassPowK,
    estimateTokens,
    normalizeAgentOutput,
    executeGraders,
    sanitizeReport
} from './evalHelpers';

/** Options for running an eval */
export interface EvalRunOptions {
    instruction: string;
    graders: ResolvedGrader[];
    timeoutSec: number;
    graderModel?: string;       // default LLM grader model
    graderProvider?: 'gemini' | 'anthropic' | 'openai';  // default LLM grader provider
    graderTimeoutSec?: number;  // timeout per grader (default: 120s)
    expected?: unknown;                     // reference output handed to graders
    metadata?: Record<string, unknown>;     // task labels handed to graders and recorded with results
    environment: {
        cpus: number;
        memory_mb: number;
    };
    turns?: ResolvedTurn[];  // if present, run multi-turn instead of single instruction
}

export class EvalRunner {
    private provider: EnvironmentProvider;
    private logDir?: string;

    constructor(provider: EnvironmentProvider, logDir?: string) {
        this.provider = provider;
        this.logDir = logDir;
    }

    private timestamp(): string {
        return new Date().toISOString();
    }

    async runEval(
        agent: BaseAgent,
        taskPath: string,
        skillsPaths: string[],
        opts: EvalRunOptions,
        numTrials: number = 1,
        env?: Record<string, string>,
        parallel: number = 1
    ): Promise<EvalReport> {
        const taskName = path.basename(taskPath);

        // One-time image build (if provider supports it)
        if (this.provider.prepare) {
            const buildSpinner = new Spinner('build', 'building image');
            try {
                const imageId = await this.provider.prepare(taskPath, skillsPaths, opts, env);
                buildSpinner.stop(`${fmt.dim('image ready')}  ${fmt.dim(typeof imageId === 'string' ? imageId : '')}`);
            } catch (err) {
                buildSpinner.stop(`${fmt.fail('build failed')}`);
                throw err;
            }
        }

        let trials: TrialResult[];

        try {
            if (parallel > 1 && numTrials > 1) {
                trials = await this.runTrialsParallel(agent, taskPath, skillsPaths, opts, numTrials, parallel, env);
            } else {
                trials = [];
                for (let i = 0; i < numTrials; i++) {
                    const result = await this.runSingleTrial(agent, taskPath, skillsPaths, opts, i, numTrials, env);
                    trials.push(result);
                }
            }
        } finally {
            if (this.provider.teardown) {
                await this.provider.teardown();
            }
        }

        const totalReward = trials.reduce((sum, t) => sum + t.reward, 0);
        const successes = trials.filter(t => t.reward >= 0.5).length;

        const report: EvalReport = {
            task: taskName,
            metadata: opts.metadata,
            pass_rate: totalReward / numTrials,
            pass_at_k: calculatePassAtK(numTrials, successes, numTrials),
            pass_pow_k: calculatePassPowK(numTrials, successes, numTrials),
            trials,
            skills_used: skillsPaths.map(p => path.basename(p))
        };

        if (this.logDir) {
            const sanitized = sanitizeReport(report, env);
            await this.saveReport(sanitized);
        }

        return report;
    }

    private async runTrialsParallel(
        agent: BaseAgent,
        taskPath: string,
        skillsPaths: string[],
        opts: EvalRunOptions,
        numTrials: number,
        parallel: number,
        env?: Record<string, string>
    ): Promise<TrialResult[]> {
        const results: TrialResult[] = new Array(numTrials);
        const queue = Array.from({ length: numTrials }, (_, i) => i);

        const workers = Array.from({ length: Math.min(parallel, numTrials) }, async () => {
            while (queue.length > 0) {
                const i = queue.shift()!;
                results[i] = await this.runSingleTrial(agent, taskPath, skillsPaths, opts, i, numTrials, env);
            }
        });

        await Promise.all(workers);
        return results;
    }

    private createCommandRunner(
        workspace: string,
        sessionLog: LogEntry[],
        env?: Record<string, string>,
        onCommand?: () => void
    ): (cmd: string, cmdEnv?: Record<string, string>) => Promise<CommandResult> {
        return async (cmd: string, cmdEnv?: Record<string, string>) => {
            const mergedEnv = cmdEnv ? { ...(env || {}), ...cmdEnv } : env;
            const result = await this.provider.runCommand(workspace, cmd, mergedEnv);
            onCommand?.();
            sessionLog.push({
                type: 'command',
                timestamp: this.timestamp(),
                command: cmd,
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
            });
            return result;
        };
    }


    private finalizeTrial(
        trialId: number,
        graderResults: GraderResult[],
        sessionLog: LogEntry[],
        startTime: number,
        commandCount: number,
        instructionText: string,
        spinner: Spinner
    ): TrialResult {
        const totalWeight = graderResults.reduce((sum, r) => sum + r.weight, 0);
        const reward = totalWeight > 0
            ? graderResults.reduce((sum, r) => sum + r.score * r.weight, 0) / totalWeight
            : 0;

        sessionLog.push({
            type: 'reward',
            timestamp: this.timestamp(),
            value: reward,
        });

        const duration_ms = Date.now() - startTime;
        const input_tokens = estimateTokens(instructionText);
        const output_tokens = sessionLog
            .filter(e => e.type === 'agent_result' || e.type === 'command')
            .reduce((sum, e) => sum + estimateTokens((e.output || '') + (e.stdout || '') + (e.stderr || '')), 0);

        const status = reward >= 0.5 ? fmt.pass('PASS') : fmt.fail('FAIL');
        spinner.stop(`${status}  ${fmt.bold(reward.toFixed(2))}  ${fmt.dim((duration_ms / 1000).toFixed(1) + 's')}  ${fmt.dim(commandCount + ' cmds')}`);

        return {
            trial_id: trialId,
            reward,
            grader_results: graderResults,
            duration_ms,
            n_commands: commandCount,
            input_tokens,
            output_tokens,
            session_log: sessionLog,
        };
    }

    private async handleTrialError(
        err: unknown,
        trialId: number,
        workspace: string,
        startTime: number,
        commandCount: number,
        sessionLog: LogEntry[],
        spinner: Spinner
    ): Promise<TrialResult> {
        const duration_ms = Date.now() - startTime;
        const errorMsg = (err as any)?.message || String(err);
        spinner.stop(`${fmt.fail('FAIL')}  ${errorMsg.substring(0, 50)}  ${fmt.dim((duration_ms / 1000).toFixed(1) + 's')}`);

        let diagnostics = '';
        if (this.provider.diagnose) {
            try {
                diagnostics = await this.provider.diagnose(workspace);
                console.log(diagnostics);
            } catch (e) {
                diagnostics = `(diagnostics failed: ${e})`;
            }
        }

        sessionLog.push({
            type: 'reward',
            timestamp: this.timestamp(),
            value: 0,
            output: diagnostics ? `${errorMsg}\n\n${diagnostics}` : errorMsg,
        });

        return {
            trial_id: trialId,
            reward: 0,
            grader_results: [],
            duration_ms,
            n_commands: commandCount,
            input_tokens: 0,
            output_tokens: 0,
            session_log: sessionLog,
        };
    }

    private async runMultiTurnTrial(
        agent: BaseAgent,
        taskPath: string,
        skillsPaths: string[],
        opts: EvalRunOptions,
        index: number,
        total: number,
        env?: Record<string, string>
    ): Promise<TrialResult> {
        const sessionLog: LogEntry[] = [];
        let commandCount = 0;
        const startTime = Date.now();
        const spinner = new Spinner(`${index + 1}/${total}`, 'setting up environment');
        const workspace = await this.provider.setup(taskPath, skillsPaths, opts, env);
        const turns = opts.turns || [];
        const previousOutputs: string[] = [];
        const allGraderResults: GraderResult[] = [];

        try {
            const loggedRunCommand = this.createCommandRunner(workspace, sessionLog, env, () => commandCount++);
            const agentTimeoutMs = opts.timeoutSec * 1000;

            for (let turnIdx = 0; turnIdx < turns.length; turnIdx++) {
                const turn = turns[turnIdx];
                spinner.update(`running turn ${turnIdx + 1}/${turns.length}`);
                sessionLog.push({
                    type: 'turn_start',
                    timestamp: this.timestamp(),
                    instruction: turn.instruction,
                    turn_index: turnIdx,
                });

                const agentRaw = await withTimeout(
                    agent.runTurn
                        ? agent.runTurn(turn.instruction, workspace, loggedRunCommand, turnIdx, [...previousOutputs])
                        : agent.run(turn.instruction, workspace, loggedRunCommand),
                    agentTimeoutMs,
                    `Agent turn ${turnIdx + 1} (limit: ${opts.timeoutSec}s)`
                );
                const agentResult = normalizeAgentOutput(agentRaw);
                previousOutputs.push(agentResult.output);

                sessionLog.push({
                    type: 'agent_result',
                    timestamp: this.timestamp(),
                    output: agentResult.output,
                });

                if (turn.graders && turn.graders.length > 0) {
                    const turnResults = await executeGraders(
                        this.provider, turn.graders, workspace, taskPath, index, opts, sessionLog, () => this.timestamp(), env, spinner
                    );
                    allGraderResults.push(...turnResults);
                }

                sessionLog.push({
                    type: 'turn_end',
                    timestamp: this.timestamp(),
                    turn_index: turnIdx,
                });
            }

            if (opts.graders && opts.graders.length > 0) {
                const topResults = await executeGraders(
                    this.provider, opts.graders, workspace, taskPath, index, opts, sessionLog, () => this.timestamp(), env, spinner
                );
                allGraderResults.push(...topResults);
            }

            const totalInstructionText = turns.map(t => t.instruction).join('\n');
            return this.finalizeTrial(index + 1, allGraderResults, sessionLog, startTime, commandCount, totalInstructionText, spinner);
        } catch (err: unknown) {
            return await this.handleTrialError(err, index + 1, workspace, startTime, commandCount, sessionLog, spinner);
        } finally {
            await this.provider.cleanup(workspace);
        }
    }

    private async runSingleTrial(
        agent: BaseAgent,
        taskPath: string,
        skillsPaths: string[],
        opts: EvalRunOptions,
        index: number,
        total: number,
        env?: Record<string, string>
    ): Promise<TrialResult> {
        if (opts.turns && opts.turns.length > 0) {
            return this.runMultiTurnTrial(agent, taskPath, skillsPaths, opts, index, total, env);
        }

        const sessionLog: LogEntry[] = [];
        let commandCount = 0;
        const startTime = Date.now();

        const spinner = new Spinner(`${index + 1}/${total}`, 'setting up environment');
        const workspace = await this.provider.setup(taskPath, skillsPaths, opts, env);

        try {
            sessionLog.push({
                type: 'agent_start',
                timestamp: this.timestamp(),
                instruction: opts.instruction,
            });

            spinner.update('running agent');
            const loggedRunCommand = this.createCommandRunner(workspace, sessionLog, env, () => commandCount++);
            const agentTimeoutMs = opts.timeoutSec * 1000;
            const agentRaw = await withTimeout(
                agent.run(opts.instruction, workspace, loggedRunCommand),
                agentTimeoutMs,
                `Agent (limit: ${opts.timeoutSec}s)`
            );
            const agentResult = normalizeAgentOutput(agentRaw);

            sessionLog.push({
                type: 'agent_result',
                timestamp: this.timestamp(),
                output: agentResult.output,
            });

            const graderResults = await executeGraders(
                this.provider, opts.graders, workspace, taskPath, index, opts, sessionLog, () => this.timestamp(), env, spinner
            );
            return this.finalizeTrial(index + 1, graderResults, sessionLog, startTime, commandCount, opts.instruction, spinner);
        } catch (err: unknown) {
            return await this.handleTrialError(err, index + 1, workspace, startTime, commandCount, sessionLog, spinner);
        } finally {
            await this.provider.cleanup(workspace);
        }
    }

    private async saveReport(report: EvalReport): Promise<void> {
        if (!this.logDir) return;

        await fs.ensureDir(this.logDir);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${report.task}_${timestamp}.json`;
        const filePath = path.join(this.logDir, fileName);

        await fs.writeJSON(filePath, report, { spaces: 2 });
    }
}
