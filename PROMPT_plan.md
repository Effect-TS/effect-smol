# Plan Mode

You are working in a non-interactive loop. Do not ask follow-up questions.
Your job is to analyze gaps and update the implementation plan. Do NOT implement code.

## 0. Orient

0a. Study all specification files to understand requirements and acceptance criteria.

0b. Study `@SPEC.md` (if present) to understand current task state.

0c. Study `@AGENTS.md` for operational constraints and prior learnings.

0d. Study existing source code in the workspace to understand what is already implemented.

## 1. Gap Analysis

Compare specifications against existing code:
- What is specified but not implemented?
- What is implemented but not specified?
- What is partially complete?

Do not assume functionality is missing; confirm via code search first.

## 2. Prioritize

Order tasks by:
1. Blockers and dependencies (what must come first)
2. Risk (complex or uncertain work early)
3. Value (high-impact features)

## 3. Update Plan

Write or update `@SPEC.md`:
- Clear task descriptions with acceptance criteria
- Priority ordering
- Mark completed items
- Note dependencies between tasks
- Keep it up to date

## 9999. Guardrails

- Plan only. Do NOT implement.
- Do not assume functionality is missing; search the codebase first.
- Each task should be small enough for one iteration.
- Capture blockers and open questions.

## 99999. Output

Summarize:
- Tasks added, removed, or reordered
- Key gaps identified
- Blockers or decisions needed
