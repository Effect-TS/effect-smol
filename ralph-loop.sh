#!/usr/bin/env bash
set -euo pipefail

# Ralph Wiggum Loop - Based on Geoffrey Huntley's technique
# https://github.com/ghuntley/how-to-ralph-wiggum

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS] [MODE] [MAX_ITERATIONS]

Modes:
  build    Use PROMPT_build.md (default)
  plan     Use PROMPT_plan.md

Options:
  -a, --agent AGENT      Agent to use: claude (default), codex
  -w, --workdir DIR      Working directory (default: current)
  -p, --prompt FILE      Override prompt file
  -m, --model MODEL      Model to use (default: opus for plan, sonnet for build)
  -s, --sleep SECONDS    Sleep between iterations (default: 0)
  --no-push              Skip git push after each iteration
  -h, --help             Show this help

Environment:
  MAX_ITERATIONS         Max iterations (0 = unlimited, default: 0)
  SLEEP_SECONDS          Sleep between iterations
  RALPH_MODEL            Override default model (opus, sonnet, haiku)

Examples:
  $(basename "$0")                    # Build mode, unlimited
  $(basename "$0") 20                 # Build mode, max 20 iterations
  $(basename "$0") plan               # Plan mode, unlimited
  $(basename "$0") plan 5             # Plan mode, max 5 iterations
  $(basename "$0") -a codex build 10  # Codex agent, build mode, 10 iterations

Logs:
  Iteration logs are saved to .ralph/logs/iteration-NNN.log
  Watch latest: tail -f .ralph/logs/iteration-*.log
  Review past:  less .ralph/logs/iteration-005.log
EOF
  exit 0
}

# Defaults
AGENT="claude"
MODE="build"
WORKDIR="$(pwd)"
PROMPT_FILE=""
MODEL=""  # Set per-mode below if not overridden
SLEEP_SECONDS="${SLEEP_SECONDS:-0}"
MAX_ITERATIONS="${MAX_ITERATIONS:-0}"
GIT_PUSH=true

# Parse options
while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--agent)
      AGENT="$2"
      shift 2
      ;;
    -w|--workdir)
      WORKDIR="$2"
      shift 2
      ;;
    -p|--prompt)
      PROMPT_FILE="$2"
      shift 2
      ;;
    -m|--model)
      MODEL="$2"
      shift 2
      ;;
    -s|--sleep)
      SLEEP_SECONDS="$2"
      shift 2
      ;;
    --no-push)
      GIT_PUSH=false
      shift
      ;;
    -h|--help)
      usage
      ;;
    plan)
      MODE="plan"
      shift
      ;;
    build)
      MODE="build"
      shift
      ;;
    [0-9]*)
      MAX_ITERATIONS="$1"
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      ;;
  esac
done

# Set default model per mode (opus for planning, sonnet for building)
if [[ -z "${MODEL}" ]]; then
  MODEL="${RALPH_MODEL:-}"
  if [[ -z "${MODEL}" ]]; then
    case "${MODE}" in
      plan)
        MODEL="opus"
        ;;
      build)
        MODEL="sonnet"
        ;;
    esac
  fi
fi

# Determine prompt file
if [[ -z "${PROMPT_FILE}" ]]; then
  case "${MODE}" in
    plan)
      PROMPT_FILE="PROMPT_plan.md"
      ;;
    build)
      PROMPT_FILE="PROMPT_build.md"
      ;;
  esac

  # Fall back to PROMPT.md if mode-specific file doesn't exist
  if [[ ! -f "${WORKDIR}/${PROMPT_FILE}" ]] && [[ -f "${WORKDIR}/PROMPT.md" ]]; then
    PROMPT_FILE="PROMPT.md"
  fi
fi

# Validate prompt file exists
if [[ ! -f "${WORKDIR}/${PROMPT_FILE}" ]]; then
  echo "Prompt file not found: ${WORKDIR}/${PROMPT_FILE}" >&2
  exit 1
fi

# Create logs directory
LOG_DIR="${WORKDIR}/.ralph/logs"
mkdir -p "${LOG_DIR}"

echo "Ralph Wiggum Loop"
echo "  Mode:       ${MODE}"
echo "  Agent:      ${AGENT}"
echo "  Model:      ${MODEL}"
echo "  Prompt:     ${PROMPT_FILE}"
echo "  Workdir:    ${WORKDIR}"
echo "  Max iters:  ${MAX_ITERATIONS:-unlimited}"
echo "  Git push:   ${GIT_PUSH}"
echo "  Logs:       ${LOG_DIR}"
echo ""

run_once() {
  local prompt log_file
  prompt="$(cat "${WORKDIR}/${PROMPT_FILE}")"
  log_file="${LOG_DIR}/iteration-$(printf '%03d' "${ITERATION}").log"

  echo "Logging to: ${log_file}"

  case "${AGENT}" in
    claude)
      (cd "${WORKDIR}" && claude -p "${prompt}" \
        --dangerously-skip-permissions \
        --model "${MODEL}" \
        --output-format stream-json \
        --verbose 2>&1 | tee "${log_file}")
      ;;
    codex)
      (cd "${WORKDIR}" && codex exec --full-auto "${prompt}" 2>&1 | tee "${log_file}")
      ;;
    *)
      echo "Unsupported agent: ${AGENT}" >&2
      exit 1
      ;;
  esac
}

git_push() {
  if [[ "${GIT_PUSH}" == "true" ]]; then
    local branch
    branch="$(cd "${WORKDIR}" && git branch --show-current 2>/dev/null || true)"
    if [[ -n "${branch}" ]]; then
      (cd "${WORKDIR}" && git push origin "${branch}" 2>/dev/null || true)
    fi
  fi
}

ITERATION=0

while true; do
  # Check iteration limit
  if [[ "${MAX_ITERATIONS}" -gt 0 ]] && [[ "${ITERATION}" -ge "${MAX_ITERATIONS}" ]]; then
    echo "Reached max iterations (${MAX_ITERATIONS})"
    break
  fi

  ITERATION=$((ITERATION + 1))
  echo "=== Iteration ${ITERATION} ($(date '+%Y-%m-%d %H:%M:%S')) ==="

  run_once
  git_push

  if [[ "${SLEEP_SECONDS}" != "0" ]]; then
    echo "Sleeping ${SLEEP_SECONDS}s..."
    sleep "${SLEEP_SECONDS}"
  fi
done

echo "Loop complete after ${ITERATION} iterations"
