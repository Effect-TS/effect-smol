/**
 * @since 2.0.0
 */
import { hasProperty } from "./data/Predicate.ts"
import * as Effect from "./Effect.ts"
import * as Exit from "./Exit.ts"
import * as Fiber from "./Fiber.ts"
import * as Layer from "./Layer.ts"
import * as Scope from "./Scope.ts"
import type * as ServiceMap from "./ServiceMap.ts"
import type { Mutable } from "./types/Types.ts"

const TypeId = "~effect/ManagedRuntime"

/**
 * Checks if the provided argument is a `ManagedRuntime`.
 *
 * @since 3.9.0
 * @category guards
 */
export const isManagedRuntime = (input: unknown): input is ManagedRuntime<unknown, unknown> =>
  hasProperty(input, TypeId)

/**
 * @since 3.4.0
 */
export declare namespace ManagedRuntime {
  /**
   * @category type-level
   * @since 4.0.0
   */
  export type Services<T extends ManagedRuntime<never, any>> = [T] extends [ManagedRuntime<infer R, infer _E>] ? R
    : never
  /**
   * @category type-level
   * @since 3.4.0
   */
  export type Error<T extends ManagedRuntime<never, any>> = [T] extends [ManagedRuntime<infer _R, infer E>] ? E : never
}

/**
 * @since 2.0.0
 * @category models
 */
export interface ManagedRuntime<in R, out ER> {
  readonly [TypeId]: typeof TypeId
  readonly memoMap: Layer.MemoMap
  readonly servicesEffect: Effect.Effect<ServiceMap.ServiceMap<R>, ER>
  readonly services: () => Promise<ServiceMap.ServiceMap<R>>

  // internal
  readonly scope: Scope.Closeable
  // internal
  cachedServices: ServiceMap.ServiceMap<R> | undefined

  /**
   * Executes the effect using the provided Scheduler or using the global
   * Scheduler if not provided
   */
  readonly runFork: <A, E>(
    self: Effect.Effect<A, E, R>,
    options?: Effect.RunOptions
  ) => Fiber.Fiber<A, E | ER>

  /**
   * Executes the effect synchronously returning the exit.
   *
   * This method is effectful and should only be invoked at the edges of your
   * program.
   */
  readonly runSyncExit: <A, E>(effect: Effect.Effect<A, E, R>) => Exit.Exit<A, ER | E>

  /**
   * Executes the effect synchronously throwing in case of errors or async boundaries.
   *
   * This method is effectful and should only be invoked at the edges of your
   * program.
   */
  readonly runSync: <A, E>(effect: Effect.Effect<A, E, R>) => A

  /**
   * Executes the effect asynchronously, eventually passing the exit value to
   * the specified callback.
   *
   * This method is effectful and should only be invoked at the edges of your
   * program.
   */
  readonly runCallback: <A, E>(
    effect: Effect.Effect<A, E, R>,
    options?:
      | Effect.RunOptions & {
        readonly onExit: (exit: Exit.Exit<A, E | ER>) => void
      }
      | undefined
  ) => (interruptor?: number | undefined) => void

  /**
   * Runs the `Effect`, returning a JavaScript `Promise` that will be resolved
   * with the value of the effect once the effect has been executed, or will be
   * rejected with the first error or exception throw by the effect.
   *
   * This method is effectful and should only be used at the edges of your
   * program.
   */
  readonly runPromise: <A, E>(effect: Effect.Effect<A, E, R>, options?: Effect.RunOptions) => Promise<A>

  /**
   * Runs the `Effect`, returning a JavaScript `Promise` that will be resolved
   * with the `Exit` state of the effect once the effect has been executed.
   *
   * This method is effectful and should only be used at the edges of your
   * program.
   */
  readonly runPromiseExit: <A, E>(
    effect: Effect.Effect<A, E, R>,
    options?: Effect.RunOptions
  ) => Promise<Exit.Exit<A, ER | E>>

  /**
   * Dispose of the resources associated with the runtime.
   */
  readonly dispose: () => Promise<void>

  /**
   * Dispose of the resources associated with the runtime.
   */
  readonly disposeEffect: Effect.Effect<void, never, never>
}

/**
 * Convert a Layer into an ManagedRuntime, that can be used to run Effect's using
 * your services.
 *
 * @since 2.0.0
 * @category runtime class
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { Console } from "effect/logging"
 * import { ServiceMap } from "effect"
 * import { ManagedRuntime } from "effect"
 *
 * class Notifications extends ServiceMap.Key<
 *   Notifications,
 *   { readonly notify: (message: string) => Effect.Effect<void> }
 * >()("Notifications") {
 *   static layer = Layer.succeed(this)({ notify: (message) => Console.log(message) })
 * }
 *
 * async function main() {
 *   const runtime = ManagedRuntime.make(Notifications.layer)
 *   await runtime.runPromise(Effect.flatMap(
 *     Notifications.asEffect(),
 *     (_) => _.notify("Hello, world!")
 *   ))
 *   await runtime.dispose()
 * }
 *
 * main()
 * ```
 */
export const make = <R, ER>(
  layer: Layer.Layer<R, ER, never>,
  options?: {
    readonly memoMap?: Layer.MemoMap | undefined
  } | undefined
): ManagedRuntime<R, ER> => {
  const memoMap = options?.memoMap ?? Layer.makeMemoMapUnsafe()
  const scope = Scope.makeUnsafe()
  let buildFiber: Fiber.Fiber<ServiceMap.ServiceMap<R>, ER> | undefined
  const servicesEffect = Effect.withFiber<ServiceMap.ServiceMap<R>, ER>((fiber) => {
    if (!buildFiber) {
      buildFiber = Fiber.runIn(
        Effect.runFork(
          Effect.tap(
            Layer.buildWithMemoMap(layer, memoMap, scope),
            (services) => {
              self.cachedServices = services
            }
          ),
          { scheduler: fiber.currentScheduler }
        ),
        scope
      )
    }
    return Effect.flatten(Fiber.await(buildFiber))
  })
  const self: ManagedRuntime<R, ER> = {
    [TypeId]: TypeId,
    memoMap,
    scope,
    servicesEffect,
    cachedServices: undefined,
    services() {
      return self.cachedServices === undefined ?
        Effect.runPromise(self.servicesEffect) :
        Promise.resolve(self.cachedServices)
    },
    dispose(): Promise<void> {
      return Effect.runPromise(self.disposeEffect)
    },
    disposeEffect: Effect.suspend(() => {
      ;(self as Mutable<ManagedRuntime<R, ER>>).servicesEffect = Effect.die("ManagedRuntime disposed")
      self.cachedServices = undefined
      return Scope.close(self.scope, Exit.void)
    }),
    runFork<A, E>(effect: Effect.Effect<A, E, R>, options?: Effect.RunOptions): Fiber.Fiber<A, E | ER> {
      return self.cachedServices === undefined ?
        Effect.runFork(provide(self, effect), options) :
        Effect.runForkWith(self.cachedServices)(effect, options)
    },
    runCallback<A, E>(
      effect: Effect.Effect<A, E, R>,
      options?: Effect.RunOptions & {
        readonly onExit: (exit: Exit.Exit<A, E | ER>) => void
      }
    ): (interruptor?: number | undefined) => void {
      return self.cachedServices === undefined ?
        Effect.runCallback(provide(self, effect), options) :
        Effect.runCallbackWith(self.cachedServices)(effect, options)
    },
    runSyncExit<A, E>(effect: Effect.Effect<A, E, R>): Exit.Exit<A, E | ER> {
      return self.cachedServices === undefined ?
        Effect.runSyncExit(provide(self, effect)) :
        Effect.runSyncExitWith(self.cachedServices)(effect)
    },
    runSync<A, E>(effect: Effect.Effect<A, E, R>): A {
      return self.cachedServices === undefined ?
        Effect.runSync(provide(self, effect)) :
        Effect.runSyncWith(self.cachedServices)(effect)
    },
    runPromiseExit<A, E>(effect: Effect.Effect<A, E, R>, options?: Effect.RunOptions): Promise<Exit.Exit<A, E | ER>> {
      return self.cachedServices === undefined ?
        Effect.runPromiseExit(provide(self, effect), options) :
        Effect.runPromiseExitWith(self.cachedServices)(effect, options)
    },
    runPromise<A, E>(effect: Effect.Effect<A, E, R>, options?: {
      readonly signal?: AbortSignal | undefined
    }): Promise<A> {
      return self.cachedServices === undefined ?
        Effect.runPromise(provide(self, effect), options) :
        Effect.runPromiseWith(self.cachedServices)(effect, options)
    }
  }
  return self
}

function provide<R, ER, A, E>(
  managed: ManagedRuntime<R, ER>,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | ER> {
  return Effect.flatMap(
    managed.servicesEffect,
    (services) => Effect.provideServices(effect, services)
  )
}
