---
"effect": patch
---

Fix `Command.withSubcommands` collapsing the inferred requirements type to `never` when given more than one subcommand, and add a `Command.Services` utility type to extract the required services from a `Command`.
