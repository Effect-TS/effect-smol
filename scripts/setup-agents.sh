#!/usr/bin/env bash
# Setup symlinks for AI agent tool directories
# Based on https://github.com/iannuttall/dotagents (project scope)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Ensure .agents directory exists
if [ ! -d ".agents" ]; then
  echo "Error: .agents directory not found"
  exit 1
fi

# Create symlinks for each client (project scope - commands/hooks/skills only)
# Claude
mkdir -p .claude
ln -sfn ../.agents/commands .claude/commands
ln -sfn ../.agents/hooks .claude/hooks
ln -sfn ../.agents/skills .claude/skills

# Codex (uses "prompts" instead of "commands")
mkdir -p .codex
ln -sfn ../.agents/commands .codex/prompts
ln -sfn ../.agents/skills .codex/skills

# Cursor
mkdir -p .cursor
ln -sfn ../.agents/commands .cursor/commands
ln -sfn ../.agents/skills .cursor/skills

# OpenCode
mkdir -p .opencode
ln -sfn ../.agents/commands .opencode/commands
ln -sfn ../.agents/skills .opencode/skills

echo "Agent symlinks created successfully"
