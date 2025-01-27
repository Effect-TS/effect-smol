/**
 * @since 2.0.0
 */
import type * as Context from "./Context.js"
import type * as Effect from "./Effect.js"
import { dual } from "./Function.js"
import * as core from "./internal/core.js"
import * as effect from "./internal/effect.js"

/**
 * @since 2.0.0
 * @category models
 */
export interface Console {
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

/**
 * @since 4.0.0
 * @category references
 */
export const CurrentConsole: Context.Reference<Console> = effect.CurrentConsole

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
  consoleWith((console) =>
    effect.sync(() => {
      console.assert(condition, ...args)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const clear: Effect.Effect<void> = consoleWith((console) =>
  effect.sync(() => {
    console.clear()
  })
)

/**
 * @since 2.0.0
 * @category accessor
 */
export const count = (label?: string): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.count(label)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const countReset = (label?: string): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.countReset(label)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const debug = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.debug(...args)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const dir = (item: any, options?: any): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.dir(item, options)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const dirxml = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.dirxml(...args)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const error = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.error(...args)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const group = (
  options?: { label?: string | undefined; collapsed?: boolean | undefined } | undefined
): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.acquireRelease(
      effect.sync(() => {
        if (options?.collapsed) {
          console.groupCollapsed(options.label)
        } else {
          console.group(options?.label)
        }
      }),
      () =>
        effect.sync(() => {
          console.groupEnd()
        })
    )
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const info = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.info(...args)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const log = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.log(...args)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const table = (tabularData: any, properties?: ReadonlyArray<string>): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.table(tabularData, properties)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const time = (label?: string | undefined): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.acquireRelease(
      effect.sync(() => {
        console.time(label)
      }),
      () =>
        effect.sync(() => {
          console.timeEnd(label)
        })
    )
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const timeLog = (label?: string, ...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.timeLog(label, ...args)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const trace = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.trace(...args)
    })
  )

/**
 * @since 2.0.0
 * @category accessor
 */
export const warn = (...args: ReadonlyArray<any>): Effect.Effect<void> =>
  consoleWith((console) =>
    effect.sync(() => {
      console.warn(...args)
    })
  )

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
    effect.acquireUseRelease(
      effect.sync(() => {
        if (options?.collapsed) {
          console.groupCollapsed(options.label)
        } else {
          console.group(options?.label)
        }
      }),
      () => self,
      () =>
        effect.sync(() => {
          console.groupEnd()
        })
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
    effect.acquireUseRelease(
      effect.sync(() => {
        console.time(label)
      }),
      () => self,
      () =>
        effect.sync(() => {
          console.timeEnd(label)
        })
    )
  ))
