---
"effect": patch
---

Add `Command.exit(code)` for programmatic CLI exit codes. `Command.run` intercepts `CliExit` and calls `process.exit(code)`; `Command.runWith` propagates it as a typed `CliExit` error for testability. Parse errors now exit non-zero via this mechanism. Clean help requests (`--help`, no-handler commands) still exit 0.
