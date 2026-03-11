# Agents

## Long-running commands

When a task requires a command that may exceed 2 minutes (benchmarks, builds, deployments):
- Use `run_in_background: true` and wait for the completion notification.
- NEVER poll with sleep loops, `cat | tail`, or repeated reads of the output file.
- If you need the result before proceeding, state that you are waiting and stop.

## Ollama

- Only one Ollama model should be loaded at a time. Run `ollama stop <model>` between experiments to free memory before loading the next model.
