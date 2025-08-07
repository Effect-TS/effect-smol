#!/usr/bin/env node

/**
 * A copy command example demonstrating positional arguments with @effect/cli
 *
 * This example shows:
 * - Positional arguments (source and destination)
 * - Optional positional arguments (pattern)
 * - Variadic positional arguments (multiple sources)
 * - Mixed options and positional arguments
 *
 * Try these commands:
 * - `tsx copy-files.ts --help`
 * - `tsx copy-files.ts src.txt dest.txt`
 * - `tsx copy-files.ts --verbose src.txt dest.txt`
 * - `tsx copy-files.ts --recursive dir1 dir2 output/`
 * - `tsx copy-files.ts file1.txt file2.txt file3.txt --all output/`
 */

import * as NodeServices from "@effect/platform-node/NodeServices"
import { Effect } from "effect"
import * as Console from "effect/logging/Console"
import * as Argument from "../src/Argument.ts"
import * as Command from "../src/Command.ts"
import * as Flag from "../src/Flag.ts"

// Single file copy command
const copyCommand = Command.make("copy", {
  verbose: Flag.boolean("verbose").pipe(
    Flag.withAlias("v"),
    Flag.withDescription("Show detailed progress")
  ),
  force: Flag.boolean("force").pipe(
    Flag.withAlias("f"),
    Flag.withDescription("Overwrite existing files")
  ),
  source: Argument.file("source", "yes").pipe(
    Argument.withDescription("Source file to copy")
  ),
  destination: Argument.string("destination").pipe(
    Argument.withDescription("Destination path")
  )
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log("Copy command:", JSON.stringify(config, null, 2))
  })).pipe(
    Command.withDescription("Copy a single file to a destination")
  )

// Multiple files copy command
const copyMultipleCommand = Command.make("copy-multiple", {
  recursive: Flag.boolean("recursive").pipe(
    Flag.withAlias("r"),
    Flag.withDescription("Copy directories recursively")
  ),
  all: Flag.boolean("all").pipe(
    Flag.withAlias("a"),
    Flag.withDescription("Include hidden files")
  ),
  sources: Argument.string("sources").pipe(
    Argument.variadic({ min: 1 }),
    Argument.withDescription("Source files/directories to copy")
  ),
  destination: Argument.directory("destination", "either").pipe(
    Argument.withDescription("Destination directory")
  )
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log("Copy multiple command:", JSON.stringify(config, null, 2))
  })).pipe(
    Command.withDescription("Copy multiple files/directories to a destination")
  )

// Deploy command with optional version
const deployCommand = Command.make("deploy", {
  environment: Argument.string("environment").pipe(
    Argument.withDescription("Target environment (dev, staging, prod)")
  ),
  version: Argument.string("version").pipe(
    Argument.optional,
    Argument.withDescription("Version to deploy (defaults to latest)")
  ),
  dryRun: Flag.boolean("dry-run").pipe(
    Flag.withDescription("Show what would be deployed without deploying")
  )
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log("Deploy command:", JSON.stringify(config, null, 2))
  })).pipe(
    Command.withDescription("Deploy application to an environment")
  )

// Process files with optional count
const processCommand = Command.make("process", {
  maxFiles: Argument.integer("max-files").pipe(
    Argument.withDefault(100),
    Argument.withDescription("Maximum number of files to process")
  ),
  pattern: Flag.string("pattern").pipe(
    Flag.withDefault("*"),
    Flag.withDescription("File pattern to match")
  ),
  files: Argument.string("files").pipe(
    Argument.variadic(),
    Argument.withDescription("Files to process")
  )
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log("Process command:", JSON.stringify(config, null, 2))
  })).pipe(
    Command.withDescription("Process files with optional limits")
  )

// Main CLI app
const app = Command.make("file-tools", {}).pipe(
  Command.withDescription("File manipulation tools demonstrating positional arguments"),
  Command.withSubcommands(copyCommand, copyMultipleCommand, deployCommand, processCommand)
)

// Create CLI App
const fileToolsApp = Command.run(app, {
  name: "file-tools",
  version: "1.0.0"
})

// Main execution
fileToolsApp(process.argv.slice(2)).pipe(
  Effect.provide(NodeServices.layer),
  Effect.runPromise
)
