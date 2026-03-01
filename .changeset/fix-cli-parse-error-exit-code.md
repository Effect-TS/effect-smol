---
"effect": patch
---

Add `Command.exit(code)` and `CliError.CliExit` for programmatic CLI exit codes. `Command.run` intercepts `CliExit` and calls `process.exit(code)`; `Command.runWith` propagates it as a typed error for testability. Default parse error behavior is unchanged (exit 0).
