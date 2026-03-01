---
"effect": patch
---

Fix `Command.run` / `Command.runWith` exiting 0 on parse errors.

Unknown flags, unknown subcommands, missing required values, and malformed input now cause a non-zero exit code. All parse errors are preserved in the `Cause` via `Cause.fromReasons`. Clean help requests (`--help`, no-handler commands) still exit 0.
