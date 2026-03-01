---
"effect": patch
---

Add `Command.exit(code)`, `Command.withErrorHandler`, and `CliError.CliExit` for programmatic CLI exit codes.

- `Command.exit(code)` fails with `CliExit` to signal a process exit
- `Command.withErrorHandler(fn)` attaches a post-hook that runs after the default error display (help + stderr) on parse errors
- `Command.run` intercepts `CliExit` and calls `process.exit(code)`; `Command.runWith` propagates it as a typed error for testability
- Default parse error behavior is unchanged (exit 0)
