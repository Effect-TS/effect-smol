#!/usr/bin/env node

import * as NodeContext from "@effect/platform-node/NodeContext"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import { codegen } from "./commands/codegen.ts"

const cli = Command.make("effect-utils").pipe(
  Command.withSubcommands([codegen])
)

const main = Command.run(cli, { version: "0.0.0" }).pipe(
  Effect.provide(NodeContext.layer)
)

Effect.runPromise(main)
