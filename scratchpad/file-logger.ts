import { NodeFileSystem, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Logger } from "effect"

const LoggerLayer = Logger.layer([
  Logger.toFile(Logger.formatJson, "logs.json")
]).pipe(
  Layer.provide(NodeFileSystem.layer)
)

Effect.gen(function*() {
  yield* Effect.log("Starting file logger...")
  yield* Effect.log("Logging to file...")
  yield* Effect.log("File logger finished.")
}).pipe(
  Effect.provide(LoggerLayer),
  NodeRuntime.runMain
)
