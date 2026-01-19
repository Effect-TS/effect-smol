---
root: true
targets: ["*"]
description: "Core instructions for the Effect library repository"
globs: ["**/*"]
---

# Agent Instructions

This is the Effect library repository, focusing on functional programming patterns and effect systems in TypeScript.

## Development Workflow

- The git base branch is `main`
- Use `pnpm` as the package manager

### Core Principles

- **Zero Tolerance for Errors**: All automated checks must pass
- **Clarity over Cleverness**: Choose clear, maintainable solutions
- **Conciseness**: Keep code and any wording concise and to the point. Sacrifice grammar for the sake of concision.
- **Reduce comments**: Avoid comments unless absolutely required to explain unusual or complex logic

### Mandatory Validation Steps

- Run `pnpm lint-fix` after editing ANY TypeScript file
- Always run tests after making changes: `pnpm test <test_file.ts>`
- Run type checking: `pnpm check`
  - If type checking continues to fail, run `pnpm clean` to clear caches, then re-run `pnpm check`
- Build the project: `pnpm build`
- Check JSDoc examples compile: `pnpm docgen`

## Rules and Guidelines

- **NEVER use `try-catch` blocks inside `Effect.gen` generators!**
- **NEVER EVER use `as never`, `as any`, or `as unknown` type assertions!**
- **ALWAYS use `return yield*` when yielding errors or interrupts in Effect.gen!**
  - When yielding `Effect.fail`, `Effect.interrupt`, or other terminal effects, always use `return yield*`
  - This makes it clear that the generator function terminates at that point

## References

- If you ever need to research the previous version of the Effect library, the
  source code is available in `.repos/effect-old/`
