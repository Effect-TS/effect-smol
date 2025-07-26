/**
 * @since 4.0.0
 */
import * as Array from "../collections/Array.ts"
import * as Option from "../data/Option.ts"
import * as Effect from "../Effect.ts"
import * as Layer from "../Layer.ts"
import * as Console from "../logging/Console.ts"

/**
 * A `TestConsole` provides a testable implementation of the Console interface.
 * It captures all console output for testing purposes while maintaining full
 * compatibility with the standard Console API.
 *
 * This interface extends the standard Console interface and adds methods to
 * retrieve logged messages for verification in tests.
 *
 * @example
 * ```ts
 * import { TestConsole } from "effect/testing"
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 *
 * const program = Effect.gen(function*() {
 *   yield* Console.log("Hello, World!")
 *   yield* Console.error("An error occurred")
 *
 *   const logs = yield* TestConsole.logLines
 *   const errors = yield* TestConsole.errorLines
 *
 *   console.log(logs)   // [["Hello, World!"]]
 *   console.log(errors) // [["An error occurred"]]
 * }).pipe(Effect.provide(TestConsole.layer))
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface TestConsole extends Console.Console {
  /**
   * Returns an array of all items that have been logged by the program using
   * `Console.log` thus far.
   */
  readonly logLines: Effect.Effect<ReadonlyArray<unknown>>
  /**
   * Returns an array of all items that have been logged by the program using
   * `Console.error` thus far.
   */
  readonly errorLines: Effect.Effect<ReadonlyArray<unknown>>
}

/**
 * The `TestConsole` namespace provides types and utilities for working with
 * test console implementations.
 *
 * @example
 * ```ts
 * import { TestConsole } from "effect/testing"
 *
 * // The TestConsole namespace provides types for testing
 * // Use TestConsole.make to create a test console instance
 * // Use TestConsole.layer to provide the service in tests
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export declare namespace TestConsole {
  /**
   * Represents a console method name that can be invoked on the TestConsole.
   * This type includes all methods available on the Console interface.
   *
   * @example
   * ```ts
   * import { Console } from "effect/logging"
   *
   * // Method represents console method names like:
   * // "log", "error", "warn", "debug", "info", etc.
   * // All methods from the Console interface are supported
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export type Method = keyof Console.Console

  /**
   * Represents a single console method invocation captured by the TestConsole.
   * Each entry contains the method name and the parameters passed to it.
   *
   * @example
   * ```ts
   * import { TestConsole } from "effect/testing"
   *
   * // Entry represents captured console calls with their method and parameters
   * // Each entry contains: { method: string, parameters: ReadonlyArray<unknown> }
   * // Used internally by TestConsole to track all console operations
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export interface Entry {
    readonly method: Method
    readonly parameters: ReadonlyArray<unknown>
  }
}

/**
 * Creates a new TestConsole instance that captures all console output.
 * The returned TestConsole implements the Console interface and provides
 * additional methods to retrieve logged messages.
 *
 * @example
 * ```ts
 * import { TestConsole } from "effect/testing"
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 *
 * const program = Effect.gen(function*() {
 *   yield* Console.log("Debug message")
 *   yield* Console.error("Error occurred")
 *
 *   const logs = yield* TestConsole.logLines
 *   const errors = yield* TestConsole.errorLines
 *
 *   console.log("Captured logs:", logs)
 *   console.log("Captured errors:", errors)
 * }).pipe(Effect.provide(TestConsole.layer))
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make = Effect.gen(function*() {
  const entries: Array<TestConsole.Entry> = []

  function unsafeCreateEntry(method: TestConsole.Method) {
    return (...parameters: ReadonlyArray<any>): void => {
      entries.push({ method, parameters })
    }
  }

  const logLines = Effect.sync(() => {
    return Array.filterMap(entries, (entry) =>
      entry.method === "log"
        ? Option.some(entry.parameters) :
        Option.none())
  }).pipe(Effect.map(Array.flatten))

  const errorLines = Effect.sync(() => {
    return Array.filterMap(entries, (entry) =>
      entry.method === "error"
        ? Option.some(entry.parameters) :
        Option.none())
  }).pipe(Effect.map(Array.flatten))

  return {
    assert: unsafeCreateEntry("assert"),
    clear: unsafeCreateEntry("clear"),
    count: unsafeCreateEntry("count"),
    countReset: unsafeCreateEntry("countReset"),
    debug: unsafeCreateEntry("debug"),
    dir: unsafeCreateEntry("dir"),
    dirxml: unsafeCreateEntry("dirxml"),
    error: unsafeCreateEntry("error"),
    group: unsafeCreateEntry("group"),
    groupCollapsed: unsafeCreateEntry("groupCollapsed"),
    groupEnd: unsafeCreateEntry("groupEnd"),
    info: unsafeCreateEntry("info"),
    log: unsafeCreateEntry("log"),
    table: unsafeCreateEntry("table"),
    time: unsafeCreateEntry("time"),
    timeEnd: unsafeCreateEntry("timeEnd"),
    timeLog: unsafeCreateEntry("timeLog"),
    trace: unsafeCreateEntry("trace"),
    warn: unsafeCreateEntry("warn"),
    logLines,
    errorLines
  } as TestConsole
})

/**
 * Retrieves the `TestConsole` service for this test and uses it to run the
 * specified workflow.
 *
 * @example
 * ```ts
 * import { TestConsole } from "effect/testing"
 * import { Effect } from "effect"
 *
 * const program = TestConsole.testConsoleWith((testConsole) =>
 *   Effect.gen(function*() {
 *     testConsole.log("Test message")
 *     testConsole.error("Test error")
 *
 *     const logs = yield* testConsole.logLines
 *     const errors = yield* testConsole.errorLines
 *
 *     console.log("Logs:", logs)   // [["Test message"]]
 *     console.log("Errors:", errors) // [["Test error"]]
 *   })
 * ).pipe(Effect.provide(TestConsole.layer))
 * ```
 *
 * @since 4.0.0
 * @category utils
 */
export const testConsoleWith = <A, E, R>(f: (console: TestConsole) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Console.consoleWith((console) => f(console as TestConsole))

/**
 * Creates a `Layer` which constructs a `TestConsole`.
 * This layer can be used to provide a TestConsole implementation
 * for testing purposes.
 *
 * @example
 * ```ts
 * import { TestConsole } from "effect/testing"
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 *
 * const program = Effect.gen(function*() {
 *   yield* Console.log("This will be captured")
 *   yield* Console.error("This error will be captured")
 *
 *   const logs = yield* TestConsole.logLines
 *   const errors = yield* TestConsole.errorLines
 *
 *   console.log("Captured logs:", logs)
 *   console.log("Captured errors:", errors)
 * }).pipe(Effect.provide(TestConsole.layer))
 * ```
 *
 * @since 4.0.0
 * @category layers
 */
export const layer: Layer.Layer<TestConsole> = Layer.effect(Console.Console)(make) as any

/**
 * Returns an array of all items that have been logged by the program using
 * `Console.log` thus far.
 *
 * @example
 * ```ts
 * import { TestConsole } from "effect/testing"
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 *
 * const program = Effect.gen(function*() {
 *   yield* Console.log("First message")
 *   yield* Console.log("Second message", { key: "value" })
 *   yield* Console.log("Third message", 42, true)
 *
 *   const logs = yield* TestConsole.logLines
 *
 *   console.log(logs)
 *   // [
 *   //   ["First message"],
 *   //   ["Second message", { key: "value" }],
 *   //   ["Third message", 42, true]
 *   // ]
 * }).pipe(Effect.provide(TestConsole.layer))
 * ```
 *
 * @since 4.0.0
 * @category utils
 */
export const logLines: Effect.Effect<ReadonlyArray<unknown>, never, never> = testConsoleWith(
  (console) => console.logLines
)

/**
 * Returns an array of all items that have been logged by the program using
 * `Console.error` thus far.
 *
 * @example
 * ```ts
 * import { TestConsole } from "effect/testing"
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 *
 * const program = Effect.gen(function*() {
 *   yield* Console.error("Error message")
 *   yield* Console.error("Another error", new Error("Something went wrong"))
 *
 *   const errors = yield* TestConsole.errorLines
 *
 *   console.log(errors)
 *   // [
 *   //   ["Error message"],
 *   //   ["Another error", Error: Something went wrong]
 *   // ]
 * }).pipe(Effect.provide(TestConsole.layer))
 * ```
 *
 * @since 4.0.0
 * @category utils
 */
export const errorLines: Effect.Effect<ReadonlyArray<unknown>, never, never> = testConsoleWith(
  (console) => console.errorLines
)
