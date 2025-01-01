/**
 * @since 2.0.0
 */
import type * as Context from "./Context.js"
import type * as Effect from "./Effect.js"
import { dual } from "./Function.js"
import * as core from "./internal/core.js"
import type * as Scope from "./Scope.js"

/**
 * @since 2.0.0
 * @category symbols
 */
export const TypeId: unique symbol = core.ConsoleTypeId

/**
 * @since 2.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId

/**
 * @since 2.0.0
 * @category models
 */
export interface Console extends Console.Proto {
  readonly unsafe: Console.Unsafe
  assert(condition: boolean, ...args: ReadonlyArray<any>): Effect.Effect<void>
  readonly clear: Effect.Effect<void>
  count(label?: string): Effect.Effect<void>
  countReset(label?: string): Effect.Effect<void>
  debug(...args: ReadonlyArray<any>): Effect.Effect<void>
  dir(item: any, options?: any): Effect.Effect<void>
  dirxml(...args: ReadonlyArray<any>): Effect.Effect<void>
  error(...args: ReadonlyArray<any>): Effect.Effect<void>
  group(options?: {
    readonly label?: string | undefined
    readonly collapsed?: boolean | undefined
  }): Effect.Effect<void>
  readonly groupEnd: Effect.Effect<void>
  info(...args: ReadonlyArray<any>): Effect.Effect<void>
  log(...args: ReadonlyArray<any>): Effect.Effect<void>
  table(tabularData: any, properties?: ReadonlyArray<string>): Effect.Effect<void>
  time(label?: string): Effect.Effect<void>
  timeEnd(label?: string): Effect.Effect<void>
  timeLog(label?: string, ...args: ReadonlyArray<any>): Effect.Effect<void>
  trace(...args: ReadonlyArray<any>): Effect.Effect<void>
  warn(...args: ReadonlyArray<any>): Effect.Effect<void>
}

/**
 * @since 4.0.0
 */
export declare namespace Console {
  /**
   * @since 4.0.0
   * @category model
   */
  export interface Proto {
    readonly [TypeId]: TypeId
  }

  /**
   * @since 4.0.0
   * @category model
   */
  export interface Unsafe {
    assert(condition: boolean, ...args: ReadonlyArray<any>): void
    clear(): void
    count(label?: string): void
    countReset(label?: string): void
    debug(...args: ReadonlyArray<any>): void
    dir(item: any, options?: any): void
    dirxml(...args: ReadonlyArray<any>): void
    error(...args: ReadonlyArray<any>): void
    group(...args: ReadonlyArray<any>): void
    groupCollapsed(...args: ReadonlyArray<any>): void
    groupEnd(): void
    info(...args: ReadonlyArray<any>): void
    log(...args: ReadonlyArray<any>): void
    table(tabularData: any, properties?: ReadonlyArray<string>): void
    time(label?: string): void
    timeEnd(label?: string): void
    timeLog(label?: string, ...args: ReadonlyArray<any>): void
    trace(...args: ReadonlyArray<any>): void
    warn(...args: ReadonlyArray<any>): void
  }
}

/**
 * @since 4.0.0
 * @category references
 */
export interface CurrentConsole {
  readonly _: unique symbol
}

/**
 * @since 4.0.0
 * @category references
 */
export const CurrentConsole: Context.Reference<CurrentConsole, Console> = core.CurrentConsole

/**
 * @since 2.0.0
 * @category constructors
 */
export const consoleWith = <A, E, R>(f: (console: Console) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  core.withFiber((fiber) => f(fiber.getRef(CurrentConsole)))

/**
 * @since 2.0.0
 * @category accessor
 */
export const assert = (condition: boolean, ...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) => console.assert(condition, ...args))

/**
 * @since 2.0.0
 * @category accessor
 */
export const clear: Effect.Effect<void> = consoleWith((console) => console.clear)

/**
 * @since 2.0.0
 * @category accessor
 */
export const count = (label?: string): Effect.Effect<void> => consoleWith((console) => console.count(label))

/**
 * @since 2.0.0
 * @category accessor
 */
export const countReset = (label?: string): Effect.Effect<void> => consoleWith((console) => console.countReset(label))

/**
 * @since 2.0.0
 * @category accessor
 */
export const debug = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) => console.debug(...args))

/**
 * @since 2.0.0
 * @category accessor
 */
export const dir = (item: any, options?: any): Effect.Effect<void> =>
  consoleWith((console) => console.dir(item, options))

/**
 * @since 2.0.0
 * @category accessor
 */
export const dirxml = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) => console.dirxml(...args))

/**
 * @since 2.0.0
 * @category accessor
 */
export const error = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) => console.error(...args))

/**
 * @since 2.0.0
 * @category accessor
 */
export const group = (
  options?: { label?: string | undefined; collapsed?: boolean | undefined } | undefined
): Effect.Effect<void, never, Scope.Scope> =>
  consoleWith((console) =>
    core.acquireRelease(
      console.group(options),
      () => console.groupEnd
    )
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const info = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) => console.info(...args))

/**
 * @since 2.0.0
 * @category accessor
 */
export const log = (...args: ReadonlyArray<any>): Effect.Effect<void> => consoleWith((console) => console.log(...args))

/**
 * @since 2.0.0
 * @category accessor
 */
export const table = (tabularData: any, properties?: ReadonlyArray<string>): Effect.Effect<void> =>
  consoleWith((console) => console.table(tabularData, properties))

/**
 * @since 2.0.0
 * @category accessor
 */
export const time = (label?: string | undefined): Effect.Effect<void, never, Scope.Scope> =>
  consoleWith((console) =>
    core.acquireRelease(
      console.time(label),
      () => console.timeEnd(label)
    )
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const timeLog = (label?: string, ...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) => console.timeLog(label, ...args))

/**
 * @since 2.0.0
 * @category accessor
 */
export const trace = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) => console.trace(...args))

/**
 * @since 2.0.0
 * @category accessor
 */
export const warn = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) => console.warn(...args))

/**
 * @since 2.0.0
 * @category accessor
 */
export const withGroup = dual<
  (
    options?: {
      readonly label?: string | undefined
      readonly collapsed?: boolean | undefined
    }
  ) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>,
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    options?: {
      readonly label?: string | undefined
      readonly collapsed?: boolean | undefined
    }
  ) => Effect.Effect<A, E, R>
>((args) => core.isEffect(args[0]), (self, options) =>
  consoleWith((console) =>
    core.acquireUseRelease(
      console.group(options),
      () => self,
      () => console.groupEnd
    )
  ))

/**
 * @since 2.0.0
 * @category accessor
 */
export const withTime = dual<
  (label?: string) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>,
  <A, E, R>(self: Effect.Effect<A, E, R>, label?: string) => Effect.Effect<A, E, R>
>((args) => core.isEffect(args[0]), (self, label) =>
  consoleWith((console) =>
    core.acquireUseRelease(
      console.time(label),
      () => self,
      () => console.timeEnd(label)
    )
  ))
