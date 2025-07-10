Using the context from `.claude/context/docgen.md` use the jsdoc analysis tool to detect exports that require attention.

The file to work on is `#$ARGUMENTS`

Then use a worker pool of 10 agents to fix each export, have the agent use the prompt: `use the context from .claude/commands/docgen-export.md to fix the export {EXPORT NAME HERE} in file #$ARGUMENTS`.

Include fixing examples that show errors in `pnpm docgen`.

NEVER EVER REMOVE UNRELATED CHANGES FROM A FILE.

ALWAYS ALWAYS ALWAYS MAKE SURE THAT `pnpm docgen` PASSES THIS IS A MANDATORY STEP FOR EVERY EXAMPLE ADDED. DO NOT SKIP THIS CHECK OR YOU WILL LOSE YOUR JOB.

THE LOOP SHOULD BE, EDIT -> CHECK -> EDIT -> CHECK -> ... UNTIL IT PASSES THEN PROCEED NEXT.

Examples:

- `use the context from .claude/commands/docgen-export.md to fix the export const Number in file #$ARGUMENTS`

- `use the context from .claude/commands/docgen-export.md to fix the export const Record in file #$ARGUMENTS`

## Continuous Worker Pool Strategy

When fixing documentation for an entire file, maintain a **continuous worker pool of exactly 10 agents** working concurrently:

1. **Target 100% documentation coverage** - 0 missing examples and 0 missing categories
2. **Maintain 10 concurrent agents** at all times fixing different exports
3. **Immediately spawn new agents** as soon as any agent completes work on an export
4. **Monitor progress** with frequent `node scripts/analyze-jsdoc.mjs --file=FILE` runs
5. **Prioritize strategically**: Focus on commonly used functions first, then interfaces, then types
6. **Keep the worker pool running** until the JSDoc analysis shows 0 missing examples and 0 missing categories
7. **Final validation** with `pnpm docgen` to ensure all examples compile correctly

The goal is to achieve 100% JSDoc documentation coverage efficiently through parallel processing while maintaining quality standards.

## Make a plan first

Before making any changes, create a detailed plan for how to approach the
documentation fixes in the file.

You should save the plan in the `.claude/plans/docgen/` directory.

Wait for approval before proceeding with the implementation, and check for any
edits or changes to the plan before starting.
