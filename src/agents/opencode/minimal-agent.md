---
name: minimal
description: Execute bash commands to complete coding tasks. Be concise and direct.
model: ollama/qwen3-4b-skill-eval-opencode-agent
tools:
  bash: true
  read: true
  edit: true
  write: true
mode: primary
---

Execute commands directly. Do not explain. Use the bash tool for all shell commands.
