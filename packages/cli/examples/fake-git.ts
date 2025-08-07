#!/usr/bin/env node

/**
 * A fake git CLI example demonstrating @effect/cli features
 *
 * This example shows:
 * - Creating commands with options
 * - Hierarchical subcommands
 * - Different option types (string, boolean, integer)
 * - Command handlers that log actions
 * - Automatic help generation
 *
 * Try these commands:
 * - `tsx fake-git.ts --help`
 * - `tsx fake-git.ts clone --help`
 * - `tsx fake-git.ts clone --url https://github.com/user/repo.git --depth 1`
 * - `tsx fake-git.ts add --all`
 * - `tsx fake-git.ts commit --message "Initial commit"`
 * - `tsx fake-git.ts status --porcelain`
 */

import * as NodeServices from "@effect/platform-node/NodeServices"
import { Effect } from "effect"
import * as Console from "effect/logging/Console"
import * as Command from "../src/Command.ts"
import * as Flag from "../src/Flag.ts"

// Reusable branch option
const branchOption = Flag.string("branch").pipe(
  Flag.withAlias("b"),
  Flag.withDescription("Clone a specific branch"),
  Flag.optional
)

// Clone subcommand
const cloneCommand = Command.make("clone", {
  url: Flag.string("url").pipe(
    Flag.withDescription("Repository URL to clone")
  ),
  directory: Flag.string("directory").pipe(
    Flag.withDescription("Directory name for the cloned repository"),
    Flag.optional
  ),
  depth: Flag.integer("depth").pipe(
    Flag.withDescription("Create a shallow clone with a history truncated to the specified number of commits"),
    Flag.withDefault(0)
  ),
  branch: branchOption
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log("git clone called with:", JSON.stringify(config, null, 2))
  })).pipe(
    Command.withDescription("Clone a repository into a new directory")
  )

// Add subcommand
const addCommand = Command.make("add", {
  files: Flag.string("files").pipe(
    Flag.withDescription("Files to add to the staging area"),
    Flag.optional
  ),
  all: Flag.boolean("all").pipe(
    Flag.withAlias("A"),
    Flag.withDescription("Add all tracked and untracked files")
  ),
  patch: Flag.boolean("patch").pipe(
    Flag.withAlias("p"),
    Flag.withDescription("Interactively choose hunks to add")
  )
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log("git add called with:", JSON.stringify(config, null, 2))
  })).pipe(
    Command.withDescription("Add file contents to the index")
  )

// Status subcommand
const statusCommand = Command.make("status", {
  short: Flag.boolean("short").pipe(
    Flag.withAlias("s"),
    Flag.withDescription("Give the output in the short-format")
  ),
  porcelain: Flag.boolean("porcelain").pipe(
    Flag.withDescription("Give the output in an easy-to-parse format for scripts")
  ),
  branch: Flag.boolean("branch").pipe(
    Flag.withAlias("b"),
    Flag.withDescription("Show the branch and tracking info")
  )
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log("git status called with:", JSON.stringify(config, null, 2))
  })).pipe(
    Command.withDescription("Show the working tree status")
  )

// Commit subcommand
const commitCommand = Command.make("commit", {
  message: Flag.string("message").pipe(
    Flag.withAlias("m"),
    Flag.withDescription("Commit message")
  ),
  all: Flag.boolean("all").pipe(
    Flag.withAlias("a"),
    Flag.withDescription("Automatically stage files that have been modified and deleted")
  ),
  amend: Flag.boolean("amend").pipe(
    Flag.withDescription("Replace the tip of the current branch by creating a new commit")
  ),
  author: Flag.string("author").pipe(
    Flag.withDescription("Override the commit author"),
    Flag.optional
  )
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log("git commit called with:", JSON.stringify(config, null, 2))
  })).pipe(
    Command.withDescription("Record changes to the repository")
  )

// Main git command with global options
const gitCommand = Command.make("fake-git", {
  verbose: Flag.boolean("verbose").pipe(
    Flag.withAlias("v"),
    Flag.withDescription("Enable verbose output")
  ),
  version: Flag.boolean("version").pipe(
    Flag.withDescription("Show version information")
  )
}).pipe(
  Command.withDescription("A fake git command-line interface built with @effect/cli"),
  Command.withSubcommands(cloneCommand, addCommand, statusCommand, commitCommand)
)

// Create CLI App
const fakeGitApp = Command.run(gitCommand, {
  name: "fake-git",
  version: "2.42.0"
})

// Main execution
fakeGitApp(process.argv.slice(2)).pipe(
  Effect.provide(NodeServices.layer),
  Effect.runPromise
)
