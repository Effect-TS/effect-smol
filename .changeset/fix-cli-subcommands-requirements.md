---
"effect": patch
---

Fix `Command.withSubcommands` collapsing the inferred requirements type to `never` when given more than one subcommand.
