/**
 * @since 4.0.0
 */
import * as Array from "effect/Array"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"

/**
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
 * @since 4.0.0
 */
export declare namespace TestConsole {
  /**
   * @since 4.0.0
   * @category models
   */
  export type Method = keyof Console.Console

  /**
   * @since 4.0.0
   * @category models
   */
  export interface Entry {
    readonly method: Method
    readonly parameters: ReadonlyArray<unknown>
  }
}

/**
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

  const testConsole: TestConsole = {
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
  }

  yield* Effect.provideReferenceScoped(Console.CurrentConsole, testConsole)
})

/**
 * Retrieves the `TestConsole` service for this test and uses it to run the
 * specified workflow.
 *
 * @since 4.0.0
 * @category utils
 */
export const testConsoleWith = <A, E, R>(f: (console: TestConsole) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Console.consoleWith((console) => f(console as TestConsole))

/**
 * Returns an array of all items that have been logged by the program using
 * `Console.log` thus far.
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
 * @since 4.0.0
 * @category utils
 */
export const errorLines: Effect.Effect<ReadonlyArray<unknown>, never, never> = testConsoleWith(
  (console) => console.errorLines
)
