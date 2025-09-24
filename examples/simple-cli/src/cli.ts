#!/usr/bin/env node

import { NodeServices } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import * as Console from "effect/logging/Console"
import { Argument, Command, Flag, HelpFormatter } from "effect/unstable/cli"

// File operations command
const copy = Command.make("copy", {
  source: Argument.file("source", { mustExist: false }).pipe(
    Argument.withDescription("Source file to copy")
  ),
  destination: Argument.file("destination", { mustExist: false }).pipe(
    Argument.withDescription("Destination path")
  ),
  recursive: Flag.boolean("recursive").pipe(
    Flag.withAlias("r"),
    Flag.withDescription("Copy directories recursively")
  ),
  force: Flag.boolean("force").pipe(
    Flag.withAlias("f"),
    Flag.withDescription("Overwrite existing files")
  ),
  showDetails: Flag.boolean("show-details").pipe(
    Flag.withDescription("Show detailed output")
  )
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log(`📁 Copying ${config.source} → ${config.destination}`)
    if (config.recursive) yield* Console.log("  🔄 Recursive mode enabled")
    if (config.force) yield* Console.log("  💪 Force mode enabled")
    if (config.showDetails) yield* Console.log("  🗣️  Detailed output enabled")
    yield* Console.log("✅ Copy completed!")
  })).pipe(
    Command.withDescription("Copy files and directories")
  )

// Build command with multiple options
const build = Command.make("build", {
  outDir: Flag.directory("out-dir").pipe(
    Flag.withAlias("o"),
    Flag.withDescription("Output directory"),
    Flag.withDefault("./dist")
  ),
  target: Flag.string("target").pipe(
    Flag.withDescription("Build target (development, production)"),
    Flag.withDefault("development")
  ),
  watch: Flag.boolean("watch").pipe(
    Flag.withAlias("w"),
    Flag.withDescription("Watch for file changes")
  ),
  minify: Flag.boolean("minify").pipe(
    Flag.withDescription("Minify output")
  )
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log(`🏗️  Building project...`)
    yield* Console.log(`  📂 Output: ${config.outDir}`)
    yield* Console.log(`  🎯 Target: ${config.target}`)
    if (config.watch) yield* Console.log("  👀 Watch mode enabled")
    if (config.minify) yield* Console.log("  📦 Minification enabled")
    yield* Console.log("✅ Build completed!")
  })).pipe(
    Command.withDescription("Build the project")
  )

// Deploy command with nested subcommands
const deployStaging = Command.make("staging", {
  skipTests: Flag.boolean("skip-tests").pipe(
    Flag.withDescription("Skip running tests before deploy")
  ),
  force: Flag.boolean("force").pipe(
    Flag.withDescription("Force deployment even with warnings")
  )
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log("🚀 Deploying to staging...")
    if (config.skipTests) yield* Console.log("  ⚠️  Skipping tests")
    if (config.force) yield* Console.log("  💪 Force deployment")
    yield* Console.log("✅ Deployed to staging!")
  })).pipe(
    Command.withDescription("Deploy to staging environment")
  )

const deployProd = Command.make("production", {
  skipTests: Flag.boolean("skip-tests").pipe(
    Flag.withDescription("Skip running tests before deploy")
  ),
  confirm: Flag.boolean("confirm").pipe(
    Flag.withDescription("Confirm production deployment")
  )
}, (config) =>
  Effect.gen(function*() {
    yield* Console.log("🚀 Deploying to production...")
    if (config.skipTests) yield* Console.log("  ⚠️  Skipping tests")
    if (config.confirm) yield* Console.log("  ✅ Confirmed deployment")
    yield* Console.log("✅ Deployed to production!")
  })).pipe(
    Command.withDescription("Deploy to production environment")
  )

const deploy = Command.make("deploy", {
  dryRun: Flag.boolean("dry-run").pipe(
    Flag.withDescription("Show what would be deployed without doing it")
  )
}).pipe(
  Command.withDescription("Deploy the application"),
  Command.withSubcommands(deployStaging, deployProd)
)

// Database commands
const dbMigrate = Command.make("migrate", {
  up: Flag.boolean("up").pipe(
    Flag.withDescription("Run pending migrations")
  ),
  down: Flag.boolean("down").pipe(
    Flag.withDescription("Rollback last migration")
  ),
  count: Flag.integer("count").pipe(
    Flag.withDescription("Number of migrations to run/rollback"),
    Flag.withDefault(1)
  )
}, (config) =>
  Effect.gen(function*() {
    if (config.up) {
      yield* Console.log(`📈 Running ${config.count} migration(s) up...`)
    } else if (config.down) {
      yield* Console.log(`📉 Rolling back ${config.count} migration(s)...`)
    } else {
      yield* Console.log("🔍 Checking migration status...")
    }
    yield* Console.log("✅ Migration completed!")
  })).pipe(
    Command.withDescription("Run database migrations")
  )

const dbSeed = Command.make("seed", {
  env: Flag.string("env").pipe(
    Flag.withDescription("Environment to seed (dev, test, prod)"),
    Flag.withDefault("dev")
  ),
  reset: Flag.boolean("reset").pipe(
    Flag.withDescription("Reset database before seeding")
  )
}, (config) =>
  Effect.gen(function*() {
    if (config.reset) yield* Console.log("🗑️  Resetting database...")
    yield* Console.log(`🌱 Seeding ${config.env} database...`)
    yield* Console.log("✅ Database seeded!")
  })).pipe(
    Command.withDescription("Seed the database with sample data")
  )

const db = Command.make("db").pipe(
  Command.withDescription("Database operations"),
  Command.withSubcommands(dbMigrate, dbSeed)
)

// Main CLI with global options
const cli = Command.make("myapp", {
  config: Flag.file("config").pipe(
    Flag.withAlias("c"),
    Flag.withDescription("Path to config file"),
    Flag.optional
  ),
  verbose: Flag.boolean("verbose").pipe(
    Flag.withAlias("v"),
    Flag.withDescription("Enable verbose logging")
  ),
  logLevel: Flag.string("log-level").pipe(
    Flag.withDescription("Set log level (debug, info, warn, error)"),
    Flag.withDefault("info")
  )
}).pipe(
  Command.withDescription("A sample CLI application demonstrating Effect CLI features"),
  Command.withSubcommands(copy, build, deploy, db)
)

// Run the CLI - automatically gets args and provides necessary layers
const main = Command.run(cli, {
  version: "1.0.0"
}).pipe(
  Effect.provide(
    Layer.mergeAll(
      NodeServices.layer,
      HelpFormatter.layer(HelpFormatter.defaultHelpRenderer({ colors: true }))
    )
  )
)

Effect.runPromise(main)
