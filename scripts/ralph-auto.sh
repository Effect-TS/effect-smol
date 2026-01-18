#!/bin/bash

# Ralph Auto Loop - Autonomous AI coding agent that implements specs
#
# This script runs an autonomous agent to implement a specific task.
# A focus prompt is REQUIRED - the agent will only do what you ask.
#
# Usage: ./scripts/ralph-auto.sh <focus prompt> [options]
#
# Options:
#   --max-iterations <n>     Stop after n iterations (default: unlimited)
#
# Examples:
#   ./scripts/ralph-auto.sh "Fix the authentication bug in login flow"
#   ./scripts/ralph-auto.sh "Implement the Stream.mapAccum function" --max-iterations 5
#
# The loop continues until the task is complete (TASK_COMPLETE signal)
# COMMITS ARE HANDLED BY THIS SCRIPT, NOT THE AGENT.

set -e
set -o pipefail  # Propagate exit status through pipelines (important for tee)

# Parse arguments
FOCUS_PROMPT=""
MAX_ITERATIONS=0  # 0 means unlimited

while [[ $# -gt 0 ]]; do
    case $1 in
        --max-iterations)
            if [[ -n "$2" && "$2" =~ ^[0-9]+$ ]]; then
                MAX_ITERATIONS="$2"
                shift 2
            else
                echo "Error: --max-iterations requires a positive integer"
                exit 1
            fi
            ;;
        --help|-h)
            echo "Usage: ./scripts/ralph-auto.sh <focus prompt> [options]"
            echo ""
            echo "A focus prompt is REQUIRED. The agent will only do what you ask."
            echo ""
            echo "Options:"
            echo "  --max-iterations <n>     Stop after n iterations (default: unlimited)"
            echo "  --help, -h               Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./scripts/ralph-auto.sh \"Fix the type inference bug\""
            echo "  ./scripts/ralph-auto.sh \"Implement Stream.mapAccum\" --max-iterations 5"
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
        *)
            # Positional argument - treat as focus prompt
            if [[ -z "$FOCUS_PROMPT" ]]; then
                FOCUS_PROMPT="$1"
            else
                echo "Error: Multiple focus prompts provided"
                exit 1
            fi
            shift
            ;;
    esac
done

# Focus prompt is required
if [[ -z "$FOCUS_PROMPT" ]]; then
    echo "Error: A focus prompt is required"
    echo ""
    echo "Usage: ./scripts/ralph-auto.sh <focus prompt> [options]"
    echo ""
    echo "Examples:"
    echo "  ./scripts/ralph-auto.sh \"Fix the type inference bug\""
    echo "  ./scripts/ralph-auto.sh \"Implement Stream.mapAccum\""
    echo ""
    echo "Use --help for more information"
    exit 1
fi

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROGRESS_FILE="${SCRIPT_DIR}/progress-auto.txt"
PROMPT_TEMPLATE="${PROJECT_ROOT}/RALPH_PROMPT_AUTO.md"
COMPLETE_MARKER="NOTHING_LEFT_TO_DO"
OUTPUT_DIR=".ralph-auto"
AGENT_CMD="opencode run --model anthropic/claude-opus-4-5 --format json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track child processes for cleanup
CHILD_PIDS=""

# Cleanup function - kills children and removes output directory
cleanup() {
    # Kill any tracked child processes
    if [ -n "$CHILD_PIDS" ]; then
        for pid in $CHILD_PIDS; do
            if kill -0 "$pid" 2>/dev/null; then
                kill -TERM "$pid" 2>/dev/null || true
                sleep 0.5
                if kill -0 "$pid" 2>/dev/null; then
                    kill -9 "$pid" 2>/dev/null || true
                fi
            fi
        done
    fi

    # Also kill any child processes of this script
    pkill -P $$ 2>/dev/null || true

    if [ -d "${OUTPUT_DIR}" ]; then
        rm -rf "${OUTPUT_DIR}"
        echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Cleaned up ${OUTPUT_DIR}"
    fi
}

# Signal handler for graceful shutdown
handle_signal() {
    echo ""
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Received interrupt signal, shutting down..."
    cleanup
    exit 130
}

# Set traps for cleanup on exit and signals
trap cleanup EXIT
trap handle_signal INT TERM

# Create output directory for logs
mkdir -p "${OUTPUT_DIR}"

# Logging function
log() {
    local level="${1}"
    shift
    local message="$@"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case "${level}" in
        "INFO")  echo -e "${BLUE}[${timestamp}]${NC} ${message}" ;;
        "SUCCESS") echo -e "${GREEN}[${timestamp}]${NC} ${message}" ;;
        "WARN")  echo -e "${YELLOW}[${timestamp}]${NC} ${message}" ;;
        "ERROR") echo -e "${RED}[${timestamp}]${NC} ${message}" ;;
    esac

    echo "[${timestamp}] [${level}] ${message}" >> "${OUTPUT_DIR}/ralph-auto.log"
}

# Initialize git submodules if needed
init_submodules() {
    if [ -f "${PROJECT_ROOT}/.gitmodules" ]; then
        log "INFO" "Checking git submodules..."
        if ! git submodule status | grep -q "^-"; then
            log "INFO" "Submodules already initialized"
        else
            log "INFO" "Initializing git submodules..."
            git submodule update --init
            log "SUCCESS" "Submodules initialized"
        fi
    fi
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."

    if ! command -v opencode &> /dev/null; then
        log "ERROR" "opencode is not installed or not in PATH"
        exit 1
    fi

    # Check if pnpm is available
    if ! command -v pnpm &> /dev/null; then
        log "ERROR" "pnpm is not installed or not in PATH"
        exit 1
    fi

    # Check if we're in a git repo
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log "ERROR" "Not in a git repository"
        exit 1
    fi

    # Initialize submodules if needed
    init_submodules

    # Check for .specs directory (optional)
    if [ -d ".specs" ]; then
        local spec_count
        spec_count=$(find .specs -name "*.md" -type f | wc -l | tr -d ' ')
        if [ "${spec_count}" -gt 0 ]; then
            log "INFO" "Found ${spec_count} spec file(s) in .specs/"
        fi
    fi

    # Check for .patterns directory (optional)
    if [ -d ".patterns" ]; then
        local pattern_count
        pattern_count=$(find .patterns -name "*.md" -type f | wc -l | tr -d ' ')
        if [ "${pattern_count}" -gt 0 ]; then
            log "INFO" "Found ${pattern_count} pattern file(s) in .patterns/"
        fi
    fi

    # Check for prompt template
    if [ ! -f "${PROMPT_TEMPLATE}" ]; then
        log "ERROR" "${PROMPT_TEMPLATE} not found"
        exit 1
    fi

    # Check for AGENTS.md
    if [ ! -f "${PROJECT_ROOT}/AGENTS.md" ]; then
        log "WARN" "AGENTS.md not found - agent will not have project-specific instructions"
    fi

    # Create progress file if it doesn't exist
    if [ ! -f "${PROGRESS_FILE}" ]; then
        echo "# Ralph Auto Progress Log" > "${PROGRESS_FILE}"
        echo "# This file tracks autonomous task completions" >> "${PROGRESS_FILE}"
        echo "" >> "${PROGRESS_FILE}"
    fi

    log "SUCCESS" "Prerequisites check passed"
}

# Check if there are uncommitted changes
has_changes() {
    ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]
}

# Filter opencode JSON output to show only relevant content
stream_filter() {
    while IFS= read -r line; do
        local event_type
        event_type=$(echo "${line}" | jq -r '.type // empty' 2>/dev/null)

        case "${event_type}" in
            "text")
                # Show text output from the assistant
                local text
                text=$(echo "${line}" | jq -r '.part.text // empty' 2>/dev/null)
                if [ -n "${text}" ]; then
                    echo "${text}"
                fi
                ;;
            "tool_start")
                # Show tool invocations
                local tool_name
                tool_name=$(echo "${line}" | jq -r '.part.tool // empty' 2>/dev/null)
                if [ -n "${tool_name}" ]; then
                    echo -e "${BLUE}> ${tool_name}${NC}"
                fi
                ;;
            "step_finish")
                # Show completion reason
                local reason
                reason=$(echo "${line}" | jq -r '.part.reason // empty' 2>/dev/null)
                if [ "${reason}" = "stop" ]; then
                    echo ""
                fi
                ;;
        esac
    done
}

# Run CI checks
run_ci_checks() {
    log "INFO" "Running CI checks..."

    local ci_failed=0
    local error_output=""

    echo "=========================================="
    echo "Running CI Checks"
    echo "=========================================="

    # Linting with pnpm lint-fix
    echo ""
    echo "1. Linting (oxlint + dprint)..."
    echo "-------------------------------"
    local lint_output
    if lint_output=$(pnpm lint-fix 2>&1); then
        echo -e "${GREEN}Lint passed${NC}"
    else
        echo -e "${RED}Lint failed${NC}"
        ci_failed=1
        error_output+="## Lint Failed

Command: \`pnpm lint-fix\`

\`\`\`
${lint_output}
\`\`\`

"
    fi

    # Type checking with pnpm check
    echo ""
    echo "2. Type checking (tsc)..."
    echo "-------------------------"
    local check_output
    if check_output=$(pnpm check 2>&1); then
        echo -e "${GREEN}Type check passed${NC}"
    else
        echo -e "${RED}Type check failed${NC}"
        ci_failed=1
        error_output+="## Type Check Failed

Command: \`pnpm check\`

\`\`\`
${check_output}
\`\`\`

"
    fi

    # Summary
    echo ""
    echo "=========================================="
    if [ "${ci_failed}" -eq 0 ]; then
        echo -e "${GREEN}All CI checks passed!${NC}"
        log "SUCCESS" "CI checks passed"
        return 0
    else
        echo -e "${RED}CI checks failed!${NC}"
        log "ERROR" "CI checks failed"
        # Save detailed errors for feedback to next iteration
        cat > "${OUTPUT_DIR}/ci_errors.txt" << EOF
# CI Check Failures

The previous iteration failed CI checks. You MUST fix these errors before continuing.

${error_output}
EOF
        return 1
    fi
}

# Commit changes with auto-generated message
commit_changes() {
    local iteration="${1}"
    local task_summary="${2}"

    log "INFO" "Committing changes..."

    # Stage all changes
    git add -A

    # Check if there are changes to commit
    if git diff --cached --quiet; then
        log "WARN" "No changes to commit"
        return 0
    fi

    # Create commit message
    local commit_msg="feat(auto): ${task_summary}

Ralph-Auto-Iteration: ${iteration}

Automated commit by Ralph Auto loop."

    # Commit
    if git commit -m "${commit_msg}"; then
        log "SUCCESS" "Committed: ${task_summary}"
        return 0
    else
        log "ERROR" "Commit failed"
        return 1
    fi
}

# Rollback uncommitted changes
rollback_changes() {
    log "WARN" "Rolling back uncommitted changes..."
    git checkout -- .
    git clean -fd
}

# Build the prompt for the agent
build_prompt() {
    local iteration="${1}"
    local ci_errors=""
    local progress_content=""
    local focus_section=""

    if [ -f "${OUTPUT_DIR}/ci_errors.txt" ]; then
        ci_errors="## Previous Iteration Errors

**CI checks failed in the previous iteration. You MUST fix these errors.**

Read the error details from: \`${OUTPUT_DIR}/ci_errors.txt\`
"
    fi

    if [ -f "${PROGRESS_FILE}" ]; then
        progress_content="## Progress So Far

\`\`\`
$(cat "${PROGRESS_FILE}")
\`\`\`
"
    fi

    # Build focus section (always present since focus prompt is required)
    focus_section="## FOCUS MODE (User-Specified)

**The user has specified that you should ONLY work on the following task:**

> ${FOCUS_PROMPT}

Work exclusively on this task. When the task is complete, signal TASK_COMPLETE. Do NOT select other tasks from specs - only do what is specified above.

"

    # Get list of specs files
    local specs_list=""
    if [ -d ".specs" ]; then
        specs_list=$(find .specs -name "*.md" -type f | sort | while read -r f; do echo "- \`${f}\`"; done)
    fi

    # Get list of pattern files
    local patterns_list=""
    if [ -d ".patterns" ]; then
        patterns_list=$(find .patterns -name "*.md" -type f | sort | while read -r f; do echo "- \`${f}\`"; done)
    fi

    # Combine specs and patterns
    local all_docs=""
    if [ -n "${specs_list}" ]; then
        all_docs+="### Specs
${specs_list}

"
    fi
    if [ -n "${patterns_list}" ]; then
        all_docs+="### Patterns
${patterns_list}
"
    fi

    # Read template and substitute placeholders
    local prompt
    prompt=$(cat "${PROMPT_TEMPLATE}")
    prompt="${prompt//\{\{SPECS_LIST\}\}/${all_docs}}"
    prompt="${prompt//\{\{ITERATION\}\}/${iteration}}"
    prompt="${prompt//\{\{CI_ERRORS\}\}/${ci_errors}}"
    prompt="${prompt//\{\{PROGRESS\}\}/${progress_content}}"
    prompt="${prompt//\{\{FOCUS\}\}/${focus_section}}"

    echo "${prompt}"
}

# Extract task description from output (handles opencode JSON format)
extract_task_description() {
    local output_file="${1}"
    local desc=""

    # Extract text content from opencode JSON and find TASK_COMPLETE:
    desc=$(cat "${output_file}" | \
        jq -r 'select(.type == "text") | .part.text // empty' 2>/dev/null | \
        grep "TASK_COMPLETE:" | \
        head -1 | \
        sed 's/.*TASK_COMPLETE:[[:space:]]*//')

    # If we got something, return it; otherwise return default
    if [ -n "${desc}" ]; then
        echo "${desc}"
    else
        echo "Autonomous improvements"
    fi
}

# Run a single iteration of the agent
run_iteration() {
    local iteration="${1}"
    local output_file="${OUTPUT_DIR}/iteration_${iteration}_output.txt"

    log "INFO" "Starting iteration ${iteration}"

    # Build the prompt
    local prompt
    prompt=$(build_prompt "${iteration}")

    # Save prompt for debugging
    local prompt_file="${OUTPUT_DIR}/iteration_${iteration}_prompt.md"
    echo "${prompt}" > "${prompt_file}"

    # Log prompt details
    local prompt_lines
    prompt_lines=$(echo "${prompt}" | wc -l | tr -d ' ')
    local has_ci_errors="no"
    if [ -f "${OUTPUT_DIR}/ci_errors.txt" ]; then
        has_ci_errors="yes"
    fi
    log "INFO" "Prompt: ${prompt_lines} lines, CI errors: ${has_ci_errors}"
    log "INFO" "Prompt file: ${prompt_file}"

    # Run the agent
    log "INFO" "Running OpenCode agent..."
    echo ""  # Blank line before agent output

    # Run agent with JSON output, filter for readability
    # Run synchronously - signal handler will kill child processes on Ctrl+C
    local agent_exit_code=0
    if cat "${prompt_file}" | ${AGENT_CMD} 2>/dev/null | tee "${output_file}" | stream_filter; then
        echo ""  # Blank line after agent output
        log "SUCCESS" "Agent completed iteration ${iteration}"
    else
        agent_exit_code=$?
        echo ""
        if [ $agent_exit_code -eq 130 ] || [ $agent_exit_code -eq 143 ]; then
            log "INFO" "Agent interrupted by user"
            return 1
        fi
        log "WARN" "Agent exited with non-zero status (${agent_exit_code})"
    fi

    # Extract only text content from opencode JSON output
    local assistant_text
    assistant_text=$(cat "${output_file}" | \
        jq -r 'select(.type == "text") | .part.text // empty' 2>/dev/null)

    # Check if agent signaled nothing left to do (only in assistant output, not prompt)
    if echo "${assistant_text}" | grep -q "${COMPLETE_MARKER}"; then
        log "SUCCESS" "Agent signaled NOTHING_LEFT_TO_DO"
        return 0
    fi

    # Check if agent signaled task completion (only in assistant output, not prompt)
    if echo "${assistant_text}" | grep -q "TASK_COMPLETE"; then
        log "INFO" "Agent signaled task completion"

        local task_desc
        task_desc=$(extract_task_description "${output_file}")

        # Run CI checks before committing
        if run_ci_checks; then
            # Update progress log BEFORE committing so it's included
            echo "" >> "${PROGRESS_FILE}"
            echo "## Iteration ${iteration} - $(date '+%Y-%m-%d %H:%M')" >> "${PROGRESS_FILE}"
            echo "**Task**: ${task_desc}" >> "${PROGRESS_FILE}"
            echo "**Status**: complete" >> "${PROGRESS_FILE}"
            echo "---" >> "${PROGRESS_FILE}"

            # Clear CI errors on success
            rm -f "${OUTPUT_DIR}/ci_errors.txt"

            # Commit the changes
            if commit_changes "${iteration}" "${task_desc}"; then
                log "SUCCESS" "Task completed and committed: ${task_desc}"
            else
                log "ERROR" "Failed to commit changes"
                rollback_changes
                return 1
            fi
        else
            log "WARN" "CI checks failed - keeping changes for next iteration to fix"
            # Don't rollback - keep changes so next iteration can fix CI errors
        fi
    else
        log "WARN" "Agent did not complete a task"
        # Check if there are changes anyway
        if has_changes; then
            log "INFO" "Found uncommitted changes, running CI checks..."
            if run_ci_checks; then
                echo "" >> "${PROGRESS_FILE}"
                echo "## Iteration ${iteration} - $(date '+%Y-%m-%d %H:%M')" >> "${PROGRESS_FILE}"
                echo "**Task**: Partial work (no explicit completion signal)" >> "${PROGRESS_FILE}"
                echo "---" >> "${PROGRESS_FILE}"

                rm -f "${OUTPUT_DIR}/ci_errors.txt"

                if commit_changes "${iteration}" "Partial work from iteration ${iteration}"; then
                    log "SUCCESS" "Partial work committed"
                fi
            fi
        fi
    fi

    return 1
}

# Main loop
main() {
    log "INFO" "=========================================="
    log "INFO" "Starting Ralph Auto Loop"
    log "INFO" "=========================================="

    log "INFO" "Focus: ${FOCUS_PROMPT}"
    if [ "${MAX_ITERATIONS}" -gt 0 ]; then
        log "INFO" "Max iterations: ${MAX_ITERATIONS}"
    fi

    check_prerequisites

    local start_time
    start_time=$(date +%s)
    local iteration=1
    local completed=false

    # Run initial CI checks before first iteration
    # This ensures the agent knows about any pre-existing errors
    log "INFO" "Running initial CI checks..."
    if ! run_ci_checks; then
        log "WARN" "Initial CI checks failed - errors will be included in prompt for agent to fix"
    else
        log "SUCCESS" "Initial CI checks passed - starting with clean slate"
        # Clear any stale error file
        rm -f "${OUTPUT_DIR}/ci_errors.txt"
    fi

    while true; do
        log "INFO" "------------------------------------------"
        log "INFO" "ITERATION ${iteration}"
        if [ "${MAX_ITERATIONS}" -gt 0 ]; then
            log "INFO" "(max: ${MAX_ITERATIONS})"
        fi
        log "INFO" "Focus: ${FOCUS_PROMPT}"
        log "INFO" "------------------------------------------"

        # Run the agent
        if run_iteration "${iteration}"; then
            log "SUCCESS" "Nothing left to do!"
            completed=true
            break
        fi

        # Check max iterations
        if [ "${MAX_ITERATIONS}" -gt 0 ] && [ "${iteration}" -ge "${MAX_ITERATIONS}" ]; then
            log "WARN" "Reached max iterations (${MAX_ITERATIONS}) - stopping"
            break
        fi

        # Small delay between iterations
        sleep 2

        ((iteration++))
    done

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log "INFO" "=========================================="
    log "INFO" "Ralph Auto Loop Complete"
    log "INFO" "Total iterations: ${iteration}"
    log "INFO" "Duration: ${duration}s"

    if [ "${completed}" = true ]; then
        log "SUCCESS" "All work completed successfully!"
    fi
    log "INFO" "=========================================="

    # Show git log of Ralph Auto commits
    log "INFO" "Recent Ralph Auto commits:"
    git log --oneline -10 --grep="Ralph-Auto" || true

    exit 0
}

# Run main
main
