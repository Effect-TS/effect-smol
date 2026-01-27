# Build Mode

You are working in a non-interactive loop. Do not ask follow-up questions.
If information is missing, make reasonable assumptions, list them briefly, then proceed.

## 0. Orient

0a. Study `@SPEC.md` to understand current priorities and remaining work.

0b. Study `@AGENTS.md` for operational constraints and learnings.

0c. Study existing source code in the workspace. Do not assume functionality is missing; search the codebase first.

## 1. Select Task

Pick the single highest-priority incomplete task from `@SPEC.md`.

## 2. Implement

- Make small, reversible changes.
- Do not create placeholder implementations.
- If functionality is missing, it is your job to add it.
- Resolve ambiguities or document them in `@AGENTS.md`.

## 3. Validate

Run the smallest relevant check after changes:
- Lint (`pnpm lint` or equivalent)
- Typecheck (`pnpm check`)
- Targeted test (`vitest run <file>`)

Do not proceed until checks pass.

## 4. Commit

When tests pass, commit your changes with a clear message describing what changed and why.

## 5. Update Plan

Update `@SPEC.md`:
- Mark completed tasks as done.
- Add any newly discovered tasks.
- Keep it up to date.

## 9999. Guardrails

- One task per iteration. Do not batch multiple tasks.
- Do not assume files exist; search before creating or modifying.
- Prefer editing existing files over creating new ones.
- Capture the "why" in commit messages and documentation.
- Single sources of truth; no duplicate implementations.

## 99999. Output

Summarize briefly:
- What you changed
- Assumptions made
- Any blockers or questions for next iteration
