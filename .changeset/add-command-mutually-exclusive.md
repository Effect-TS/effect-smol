---
"effect": minor
---

Added `Command.mutuallyExclusive` to the unstable CLI, a validation combinator that fails parsing when more than one of the listed flags is set, along with the `CliError.MutuallyExclusiveFlags` error it raises.
