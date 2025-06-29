#!/usr/bin/env node

import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

import { pack } from "./commands/pack.js"

const nozzle = Command.make("utils").pipe(
  Command.withDescription("The Nozzle Command Line Interface"),
  Command.withSubcommands([pack])
)

const cli = Command.run(nozzle, {
  name: "Effect Utils",
  version: "v0.0.1"
})

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
