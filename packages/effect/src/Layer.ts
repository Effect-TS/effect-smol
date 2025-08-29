/**
 * A `Layer<ROut, E, RIn>` describes how to build one or more services in your
 * application. Services can be injected into effects via
 * `Effect.provideService`. Effects can require services via `Effect.service`.
 *
 * Layer can be thought of as recipes for producing bundles of services, given
 * their dependencies (other services).
 *
 * Construction of services can be effectful and utilize resources that must be
 * acquired and safely released when the services are done being utilized.
 *
 * By default layers are shared, meaning that if the same layer is used twice
 * the layer will only be allocated a single time.
 *
 * Because of their excellent composition properties, layers are the idiomatic
 * way in Effect-TS to create services that depend on other services.
 *
 * @since 2.0.0
 */
import type * as Cause from "./Cause.ts"
import type { NonEmptyArray } from "./collections/Array.ts"
import { hasProperty } from "./data/Predicate.ts"
import * as Deferred from "./Deferred.ts"
import type { Effect } from "./Effect.ts"
import type * as Exit from "./Exit.ts"
import type { LazyArg } from "./Function.ts"
import { constant, constTrue, dual, identity } from "./Function.ts"
import { type Pipeable, pipeArguments } from "./interfaces/Pipeable.ts"
import * as internalEffect from "./internal/effect.ts"
import type { ErrorWithStackTraceLimit } from "./internal/tracer.ts"
import * as Scope from "./Scope.ts"
import * as ServiceMap from "./ServiceMap.ts"
import type * as Types from "./types/Types.ts"

/**
 * The unique type identifier for Layer.
 *
 * @since 2.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/Layer"

/**
 * The TypeId type alias for Layer.
 *
 * @since 2.0.0
 * @category symbols
 */
export type TypeId = "~effect/Layer"

/**
 * A Layer describes how to build one or more services for dependency injection.
 *
 * A Layer<ROut, E, RIn> represents:
 * - ROut: The services this layer provides
 * - E: The possible errors during layer construction
 * - RIn: The services this layer requires as dependencies
 *
 * @since 2.0.0
 * @category models
 */
export interface Layer<in ROut, out E = never, out RIn = never> extends Variance<ROut, E, RIn>, Pipeable {
  /** @internal */
  build(memoMap: MemoMap, scope: Scope.Scope): Effect<ServiceMap.ServiceMap<ROut>, E, RIn>
}

/**
 * The variance interface for Layer type parameters.
 *
 * @since 2.0.0
 * @category models
 */
export interface Variance<in ROut, out E, out RIn> {
  readonly [TypeId]: {
    readonly _ROut: Types.Contravariant<ROut>
    readonly _E: Types.Covariant<E>
    readonly _RIn: Types.Covariant<RIn>
  }
}
/**
 * A constraint interface for working with any Layer type.
 *
 * This interface is used to constrain generic types to Layer types
 * without specifying exact type parameters.
 *
 * @since 3.9.0
 * @category type-level
 */
export interface Any {
  readonly [TypeId]: {
    readonly _ROut: any
    readonly _E: any
    readonly _RIn: any
  }
}
/**
 * Extracts the service dependencies (RIn) from a Layer type.
 *
 * @since 2.0.0
 * @category type-level
 */
export type Services<T extends Any> = T extends infer L
  ? L extends Layer<infer _ROut, infer _E, infer _RIn> ? _RIn : never
  : never
/**
 * Extracts the error type (E) from a Layer type.
 *
 * @since 2.0.0
 * @category type-level
 */
export type Error<T extends Any> = T extends Layer<infer _ROut, infer _E, infer _RIn> ? _E : never
/**
 * Extracts the service output type (ROut) from a Layer type.
 *
 * @since 2.0.0
 * @category type-level
 */
export type Success<T extends Any> = T extends Layer<infer _ROut, infer _E, infer _RIn> ? _ROut : never

/**
 * The unique type identifier for MemoMap.
 *
 * @since 2.0.0
 * @category symbols
 */
export const MemoMapTypeId: MemoMapTypeId = "~effect/Layer/MemoMap"

/**
 * The TypeId type alias for MemoMap.
 *
 * @since 2.0.0
 * @category symbols
 */
export type MemoMapTypeId = "~effect/Layer/MemoMap"

/**
 * A MemoMap is used to memoize layer construction and ensure sharing of layers.
 *
 * The MemoMap prevents duplicate construction of the same layer instance,
 * enabling efficient resource sharing across layer dependencies.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * // Create a custom MemoMap for manual layer building
 * const program = Effect.gen(function* () {
 *   const memoMap = yield* Layer.makeMemoMap
 *   const scope = yield* Effect.scope
 *
 *   const dbLayer = Layer.succeed(Database)({ query: (sql: string) => Effect.succeed("result") })
 *   const services = yield* Layer.buildWithMemoMap(dbLayer, memoMap, scope)
 *
 *   return ServiceMap.get(services, Database)
 * })
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface MemoMap {
  readonly [MemoMapTypeId]: MemoMapTypeId
  readonly getOrElseMemoize: <RIn, E, ROut>(
    layer: Layer<ROut, E, RIn>,
    scope: Scope.Scope,
    build: (memoMap: MemoMap, scope: Scope.Scope) => Effect<ServiceMap.ServiceMap<ROut>, E, RIn>
  ) => Effect<ServiceMap.ServiceMap<ROut>, E, RIn>
}

/**
 * Returns `true` if the specified value is a `Layer`, `false` otherwise.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * const dbLayer = Layer.succeed(Database)({ query: (sql: string) => Effect.succeed("result") })
 * const notALayer = { someProperty: "value" }
 *
 * console.log(Layer.isLayer(dbLayer)) // true
 * console.log(Layer.isLayer(notALayer)) // false
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const isLayer = (u: unknown): u is Layer<unknown, unknown, unknown> => hasProperty(u, TypeId)

const LayerProto = {
  [TypeId]: {
    _ROut: identity,
    _E: identity,
    _RIn: identity
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

const fromBuildUnsafe = <ROut, E, RIn>(
  build: (
    memoMap: MemoMap,
    scope: Scope.Scope
  ) => Effect<ServiceMap.ServiceMap<ROut>, E, RIn>
): Layer<ROut, E, RIn> => {
  const self = Object.create(LayerProto)
  self.build = build
  return self
}

/**
 * Constructs a Layer from a function that uses a `MemoMap` and `Scope` to build the layer.
 *
 * The function receives a `MemoMap` for memoization and a `Scope` for resource management.
 * A child scope is created, and if the build fails, the child scope is closed.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * const databaseLayer = Layer.fromBuild(() =>
 *   Effect.sync(() => ServiceMap.make(Database, { query: (sql: string) => Effect.succeed("result") }))
 * )
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromBuild = <ROut, E, RIn>(
  build: (
    memoMap: MemoMap,
    scope: Scope.Scope
  ) => Effect<ServiceMap.ServiceMap<ROut>, E, RIn>
): Layer<ROut, E, RIn> =>
  fromBuildUnsafe((memoMap: MemoMap, scope: Scope.Scope) =>
    internalEffect.flatMap(Scope.fork(scope), (scope) =>
      internalEffect.onExit(
        build(memoMap, scope),
        (exit) => exit._tag === "Failure" ? scope.close(exit) : internalEffect.void
      ))
  )

/**
 * Constructs a Layer from a function that uses a `MemoMap` and `Scope` to build the layer,
 * with automatic memoization.
 *
 * This is similar to `fromBuild` but provides automatic memoization of the layer construction.
 * The layer will be memoized based on the provided `MemoMap`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * const databaseLayer = Layer.fromBuildMemo(() =>
 *   Effect.sync(() => ServiceMap.make(Database, { query: (sql: string) => Effect.succeed("result") }))
 * )
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromBuildMemo = <ROut, E, RIn>(
  build: (
    memoMap: MemoMap,
    scope: Scope.Scope
  ) => Effect<ServiceMap.ServiceMap<ROut>, E, RIn>
): Layer<ROut, E, RIn> => {
  const self: Layer<ROut, E, RIn> = fromBuild((memoMap, scope) => memoMap.getOrElseMemoize(self, scope, build))
  return self
}

class MemoMapImpl implements MemoMap {
  get [MemoMapTypeId](): typeof MemoMapTypeId {
    return MemoMapTypeId
  }

  readonly map = new Map<Layer<any, any, any>, {
    observers: number
    effect: Effect<ServiceMap.ServiceMap<any>, any>
    readonly finalizer: (exit: Exit.Exit<unknown, unknown>) => Effect<void>
  }>()

  getOrElseMemoize<RIn, E, ROut>(
    layer: Layer<ROut, E, RIn>,
    scope: Scope.Scope,
    build: (memoMap: MemoMap, scope: Scope.Scope) => Effect<ServiceMap.ServiceMap<ROut>, E, RIn>
  ): Effect<ServiceMap.ServiceMap<ROut>, E, RIn> {
    if (this.map.has(layer)) {
      const entry = this.map.get(layer)!
      entry.observers++
      return internalEffect.andThen(
        internalEffect.scopeAddFinalizerExit(scope, (exit) => entry.finalizer(exit)),
        entry.effect
      )
    }
    const layerScope = Scope.makeUnsafe()
    const deferred = Deferred.makeUnsafe<ServiceMap.ServiceMap<ROut>, E>()
    const entry = {
      observers: 1,
      effect: Deferred.await(deferred),
      finalizer: (exit: Exit.Exit<unknown, unknown>) =>
        internalEffect.suspend(() => {
          entry.observers--
          if (entry.observers === 0) {
            this.map.delete(layer)
            return layerScope.close(exit)
          }
          return internalEffect.void
        })
    }
    this.map.set(layer, entry)
    return internalEffect.scopeAddFinalizerExit(scope, entry.finalizer).pipe(
      internalEffect.flatMap(() => build(this, layerScope)),
      internalEffect.onExit((exit) => {
        entry.effect = exit
        return Deferred.done(deferred, exit)
      })
    )
  }
}

/**
 * Constructs a `MemoMap` that can be used to build additional layers.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * // Create a memo map for manual layer building
 * const program = Effect.gen(function* () {
 *   const memoMap = Layer.makeMemoMapUnsafe()
 *   const scope = yield* Effect.scope
 *
 *   const dbLayer = Layer.succeed(Database)({ query: (sql: string) => Effect.succeed("result") })
 *   const services = yield* Layer.buildWithMemoMap(dbLayer, memoMap, scope)
 *
 *   return ServiceMap.get(services, Database)
 * })
 * ```
 *
 * @since 4.0.0
 * @category memo map
 */
export const makeMemoMapUnsafe = (): MemoMap => new MemoMapImpl()

/**
 * Constructs a `MemoMap` that can be used to build additional layers.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * // Create a memo map safely within an Effect
 * const program = Effect.gen(function* () {
 *   const memoMap = yield* Layer.makeMemoMap
 *   const scope = yield* Effect.scope
 *
 *   const dbLayer = Layer.succeed(Database)({ query: (sql: string) => Effect.succeed("result") })
 *   const services = yield* Layer.buildWithMemoMap(dbLayer, memoMap, scope)
 *
 *   return ServiceMap.get(services, Database)
 * })
 * ```
 *
 * @since 2.0.0
 * @category memo map
 */
export const makeMemoMap: Effect<MemoMap> = internalEffect.sync(makeMemoMapUnsafe)

/**
 * A service reference for the current `MemoMap` used in layer construction.
 *
 * This service provides access to the current memoization map during layer building,
 * allowing layers to share memoized results.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * const getMemoMap = ServiceMap.get(Layer.CurrentMemoMap)
 * ```
 *
 * @since 3.13.0
 * @category models
 */
export const CurrentMemoMap = ServiceMap.Reference<MemoMap>("effect/Layer/CurrentMemoMap", {
  defaultValue: makeMemoMapUnsafe
})

/**
 * Builds a layer into an `Effect` value, using the specified `MemoMap` to memoize
 * the layer construction.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * class Logger extends ServiceMap.Key<Logger, { readonly log: (msg: string) => Effect.Effect<void> }>()("Logger") {}
 *
 * // Build layers with explicit memoization control
 * const program = Effect.gen(function* () {
 *   const memoMap = yield* Layer.makeMemoMap
 *   const scope = yield* Effect.scope
 *
 *   // Build database layer with memoization
 *   const dbLayer = Layer.succeed(Database)({ query: (sql: string) => Effect.succeed("result") })
 *   const dbServices = yield* Layer.buildWithMemoMap(dbLayer, memoMap, scope)
 *
 *   // Build logger layer with same memoization (reuses memo if same layer)
 *   const loggerLayer = Layer.succeed(Logger)({ log: (msg: string) => Effect.sync(() => console.log(msg)) })
 *   const loggerServices = yield* Layer.buildWithMemoMap(loggerLayer, memoMap, scope)
 *
 *   return {
 *     database: ServiceMap.get(dbServices, Database),
 *     logger: ServiceMap.get(loggerServices, Logger)
 *   }
 * })
 * ```
 *
 * @since 2.0.0
 * @category memo map
 */
export const buildWithMemoMap: {
  (
    memoMap: MemoMap,
    scope: Scope.Scope
  ): <RIn, E, ROut>(self: Layer<ROut, E, RIn>) => Effect<ServiceMap.ServiceMap<ROut>, E, RIn>
  <RIn, E, ROut>(
    self: Layer<ROut, E, RIn>,
    memoMap: MemoMap,
    scope: Scope.Scope
  ): Effect<ServiceMap.ServiceMap<ROut>, E, RIn>
} = dual(3, <RIn, E, ROut>(
  self: Layer<ROut, E, RIn>,
  memoMap: MemoMap,
  scope: Scope.Scope
): Effect<ServiceMap.ServiceMap<ROut>, E, RIn> =>
  internalEffect.provideService(
    self.build(memoMap, scope),
    CurrentMemoMap,
    memoMap
  ))

/**
 * Builds a layer into a scoped value.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * // Build a layer to get its services
 * const program = Effect.gen(function* () {
 *   const dbLayer = Layer.succeed(Database)({ query: (sql: string) => Effect.succeed("result") })
 *
 *   // Build the layer into ServiceMap - automatically manages scope and memoization
 *   const services = yield* Layer.build(dbLayer)
 *
 *   // Extract the specific service from the built layer
 *   const database = ServiceMap.get(services, Database)
 *
 *   return yield* database.query("SELECT * FROM users")
 * })
 * ```
 *
 * @since 2.0.0
 * @category destructors
 */
export const build = <RIn, E, ROut>(
  self: Layer<ROut, E, RIn>
): Effect<ServiceMap.ServiceMap<ROut>, E, RIn | Scope.Scope> =>
  internalEffect.flatMap(internalEffect.scope, (scope) => self.build(makeMemoMapUnsafe(), scope))

/**
 * Builds a layer into an `Effect` value. Any resources associated with this
 * layer will be released when the specified scope is closed unless their scope
 * has been extended. This allows building layers where the lifetime of some of
 * the services output by the layer exceed the lifetime of the effect the
 * layer is provided to.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 * import { Scope } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * // Build a layer with explicit scope control
 * const program = Effect.gen(function* () {
 *   const scope = yield* Effect.scope
 *
 *   const dbLayer = Layer.effect(Database)(Effect.gen(function* () {
 *     console.log("Initializing database...")
 *     yield* Scope.addFinalizer(scope, Effect.sync(() => console.log("Database closed")))
 *     return { query: (sql: string) => Effect.succeed(`Result: ${sql}`) }
 *   }))
 *
 *   // Build with specific scope - resources tied to this scope
 *   const services = yield* Layer.buildWithScope(dbLayer, scope)
 *   const database = ServiceMap.get(services, Database)
 *
 *   return yield* database.query("SELECT * FROM users")
 *   // Database will be closed when scope is closed
 * })
 * ```
 *
 * @since 2.0.0
 * @category destructors
 */
export const buildWithScope: {
  (scope: Scope.Scope): <RIn, E, ROut>(self: Layer<ROut, E, RIn>) => Effect<ServiceMap.ServiceMap<ROut>, E, RIn>
  <RIn, E, ROut>(self: Layer<ROut, E, RIn>, scope: Scope.Scope): Effect<ServiceMap.ServiceMap<ROut>, E, RIn>
} = dual(2, <RIn, E, ROut>(
  self: Layer<ROut, E, RIn>,
  scope: Scope.Scope
): Effect<ServiceMap.ServiceMap<ROut>, E, RIn> => internalEffect.suspend(() => self.build(makeMemoMapUnsafe(), scope)))

/**
 * Constructs a layer from the specified value.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * class Logger extends ServiceMap.Key<Logger, { readonly log: (msg: string) => Effect.Effect<void> }>()("Logger") {}
 *
 * // Create layers from concrete service implementations
 * const databaseLayer = Layer.succeed(Database)({
 *   query: (sql: string) => Effect.succeed(`Query result: ${sql}`)
 * })
 *
 * const loggerLayer = Layer.succeed(Logger)({
 *   log: (msg: string) => Effect.sync(() => console.log(`[LOG] ${msg}`))
 * })
 *
 * // Use the layers in a program
 * const program = Effect.gen(function* () {
 *   const database = yield* Database
 *   const logger = yield* Logger
 *
 *   yield* logger.log("Starting database query")
 *   const result = yield* database.query("SELECT * FROM users")
 *   yield* logger.log(`Query completed: ${result}`)
 *
 *   return result
 * }).pipe(
 *   Effect.provide(Layer.mergeAll(databaseLayer, loggerLayer))
 * )
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeed = <I, S>(key: ServiceMap.Key<I, S>) => (resource: S): Layer<I> =>
  succeedServices(ServiceMap.make(key, resource))

/**
 * Constructs a layer from the specified value, which must return one or more
 * services.
 *
 * This is a more general version of `succeed` that allows you to provide multiple
 * services at once through a `ServiceMap`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * class Logger extends ServiceMap.Key<Logger, { readonly log: (msg: string) => Effect.Effect<void> }>()("Logger") {}
 *
 * const services = ServiceMap.make(Database, { query: (sql: string) => Effect.succeed("result") })
 *   .pipe(ServiceMap.add(Logger, { log: (msg: string) => Effect.sync(() => console.log(msg)) }))
 *
 * const layer = Layer.succeedServices(services)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeedServices = <A>(services: ServiceMap.ServiceMap<A>): Layer<A> =>
  fromBuildUnsafe(constant(internalEffect.succeed(services)))

/**
 * A Layer that constructs an empty ServiceMap.
 *
 * This layer provides no services and can be used as a neutral element
 * in layer composition or as a starting point for building layers.
 *
 * @example
 * ```ts
 * import { Layer } from "effect"
 *
 * const emptyLayer = Layer.empty
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const empty: Layer<never> = succeedServices(ServiceMap.empty())

/**
 * Lazily constructs a layer from the specified value.
 *
 * This is a lazy version of `succeed` where the service value is computed
 * synchronously only when the layer is built.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * const layer = Layer.sync(Database)(() => ({
 *   query: (sql: string) => Effect.succeed(`Query: ${sql}`)
 * }))
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const sync = <I, S>(key: ServiceMap.Key<I, S>) => (evaluate: LazyArg<S>): Layer<I> =>
  syncServices(() => ServiceMap.make(key, evaluate()))

/**
 * Lazily constructs a layer from the specified value, which must return one or more
 * services.
 *
 * This is a lazy version of `succeedServices` where the ServiceMap is computed
 * synchronously only when the layer is built.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * const layer = Layer.syncServices(() =>
 *   ServiceMap.make(Database, {
 *     query: (sql: string) => Effect.succeed(`Query: ${sql}`)
 *   })
 * )
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const syncServices = <A>(evaluate: LazyArg<ServiceMap.ServiceMap<A>>): Layer<A> =>
  fromBuildUnsafe(constant(internalEffect.sync(evaluate)))

/**
 * Constructs a layer from the specified scoped effect.
 *
 * This allows you to create a Layer from an Effect that produces a service.
 * The Effect is executed in the scope of the layer, allowing for proper
 * resource management.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * const layer = Layer.effect(Database)(
 *   Effect.sync(() => ({
 *     query: (sql: string) => Effect.succeed(`Query: ${sql}`)
 *   }))
 * )
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const effect = <I, S>(key: ServiceMap.Key<I, S>): {
  <E, R>(
    effect: Effect<S, E, R>
  ): Layer<I, E, Exclude<R, Scope.Scope>>
  <Args extends ReadonlyArray<any>, E, R>(
    f: (...args: Args) => Effect<S, E, R>
  ): (...args: Args) => Layer<I, E, Exclude<R, Scope.Scope>>
} =>
(effectOrFn: Effect<any, any, any> | ((...args: any) => Effect<any, any, any>)) =>
  typeof effectOrFn === "function"
    ? (...args: any) => effectImpl(key, internalEffect.suspend(() => effectOrFn(...args)))
    : effectImpl(key, effectOrFn) as any

const effectImpl = <I, S, E, R>(
  key: ServiceMap.Key<I, S>,
  effect: Effect<S, E, R>
): Layer<I, E, Exclude<R, Scope.Scope>> =>
  effectServices(internalEffect.map(effect, (value) => ServiceMap.make(key, value)))

/**
 * Constructs a layer from the specified scoped effect, which must return one
 * or more services.
 *
 * This allows you to create a Layer from an effectful computation that returns
 * multiple services. The Effect is executed in the scope of the layer.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * const layer = Layer.effectServices(
 *   Effect.succeed(ServiceMap.make(Database, {
 *     query: (sql: string) => Effect.succeed(`Query: ${sql}`)
 *   }))
 * )
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const effectServices = <A, E, R>(
  effect: Effect<ServiceMap.ServiceMap<A>, E, R>
): Layer<A, E, Exclude<R, Scope.Scope>> => fromBuildMemo((_, scope) => Scope.provide(effect, scope))

/**
 * Constructs a layer from the specified scoped effect.
 *
 * This is useful when you want to run an Effect for its side effects during
 * layer construction, but don't need to provide any services.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 *
 * const initLayer = Layer.effectDiscard(
 *   Effect.sync(() => {
 *     console.log("Initializing application...")
 *   })
 * )
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const effectDiscard = <X, E, R>(effect: Effect<X, E, R>): Layer<never, E, Exclude<R, Scope.Scope>> =>
  effectServices(internalEffect.as(effect, ServiceMap.empty()))

/**
 * Unwraps a Layer from an Effect, flattening the nested structure.
 *
 * This is useful when you have an Effect that produces a Layer, and you want to
 * use that Layer directly. The resulting Layer will have the combined error and
 * dependency types from both the outer Effect and the inner Layer.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * const layerEffect = Effect.succeed(
 *   Layer.succeed(Database)({ query: (sql: string) => Effect.succeed("result") })
 * )
 *
 * const unwrappedLayer = Layer.unwrap(layerEffect)
 * ```
 *
 * @since 4.0.0
 * @category utils
 */
export const unwrap = <A, E1, R1, E, R>(
  self: Effect<Layer<A, E1, R1>, E, R>
): Layer<A, E | E1, R1 | Exclude<R, Scope.Scope>> => {
  const key = ServiceMap.Key<Layer<A, E1, R1>>("effect/Layer/unwrap")
  return flatMap(effect(key)(self), ServiceMap.get(key))
}

const mergeAllEffect = <Layers extends [Layer<never, any, any>, ...Array<Layer<never, any, any>>]>(
  layers: Layers,
  memoMap: MemoMap,
  scope: Scope.Scope
): Effect<
  ServiceMap.ServiceMap<{ [k in keyof Layers]: Success<Layers[k]> }[number]>,
  { [k in keyof Layers]: Error<Layers[k]> }[number],
  { [k in keyof Layers]: Services<Layers[k]> }[number]
> =>
  internalEffect.forEach(layers, (layer) => layer.build(memoMap, scope), { concurrency: layers.length }).pipe(
    internalEffect.map((contexts) => {
      const map = new Map<string, any>()
      for (const context of contexts) {
        for (const [key, value] of context.mapUnsafe) {
          map.set(key, value)
        }
      }
      return ServiceMap.makeUnsafe(map)
    })
  )

/**
 * Combines all the provided layers concurrently, creating a new layer with merged input, error, and output types.
 *
 * All layers are built concurrently, and their outputs are merged into a single layer.
 * This is useful when you need to combine multiple independent layers.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * class Logger extends ServiceMap.Key<Logger, { readonly log: (msg: string) => Effect.Effect<void> }>()("Logger") {}
 *
 * const dbLayer = Layer.succeed(Database)({ query: (sql: string) => Effect.succeed("result") })
 * const loggerLayer = Layer.succeed(Logger)({ log: (msg: string) => Effect.sync(() => console.log(msg)) })
 *
 * const mergedLayer = Layer.mergeAll(dbLayer, loggerLayer)
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const mergeAll = <Layers extends [Layer<never, any, any>, ...Array<Layer<never, any, any>>]>(
  ...layers: Layers
): Layer<
  Success<Layers[number]>,
  Error<Layers[number]>,
  Services<Layers[number]>
> => fromBuild((memoMap, scope) => mergeAllEffect(layers, memoMap, scope))

/**
 * Merges this layer with the specified layer concurrently, producing a new layer with combined input and output types.
 *
 * This is a binary version of `mergeAll` that merges exactly two layers or one layer with an array of layers.
 * The layers are built concurrently and their outputs are combined.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * class Logger extends ServiceMap.Key<Logger, { readonly log: (msg: string) => Effect.Effect<void> }>()("Logger") {}
 *
 * const dbLayer = Layer.succeed(Database)({ query: (sql: string) => Effect.succeed("result") })
 * const loggerLayer = Layer.succeed(Logger)({ log: (msg: string) => Effect.sync(() => console.log(msg)) })
 *
 * const mergedLayer = Layer.merge(dbLayer, loggerLayer)
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const merge: {
  <RIn, E, ROut>(
    that: Layer<ROut, E, RIn>
  ): <RIn2, E2, ROut2>(self: Layer<ROut2, E2, RIn2>) => Layer<ROut | ROut2, E | E2, RIn | RIn2>
  <const Layers extends [Any, ...Array<Any>]>(
    that: Layers
  ): <A, E, R>(
    self: Layer<A, E, R>
  ) => Layer<
    A | Success<Layers[number]>,
    E | Error<Layers[number]>,
    | Services<Layers[number]>
    | R
  >
  <RIn2, E2, ROut2, RIn, E, ROut>(
    self: Layer<ROut2, E2, RIn2>,
    that: Layer<ROut, E, RIn>
  ): Layer<ROut | ROut2, E | E2, RIn | RIn2>
  <A, E, R, const Layers extends [Any, ...Array<Any>]>(
    self: Layer<A, E, R>,
    that: Layers
  ): Layer<
    A | Success<Layers[number]>,
    E | Error<Layers[number]>,
    | Services<Layers[number]>
    | R
  >
} = dual(2, (
  self: Layer<any, any, any>,
  that: Layer<any, any, any> | ReadonlyArray<Layer<any, any, any>>
) => mergeAll(self, ...(Array.isArray(that) ? that : [that])))

const provideWith = (
  self: Layer<any, any, any>,
  that: Layer<any, any, any> | ReadonlyArray<Layer<any, any, any>>,
  f: (
    selfServices: ServiceMap.ServiceMap<any>,
    thatServices: ServiceMap.ServiceMap<any>
  ) => ServiceMap.ServiceMap<any>
) =>
  fromBuild((memoMap, scope) =>
    internalEffect.flatMap(
      Array.isArray(that)
        ? mergeAllEffect(that as NonEmptyArray<Layer<any, any, any>>, memoMap, scope)
        : (that as Layer<any, any, any>).build(memoMap, scope),
      (context) =>
        self.build(memoMap, scope).pipe(
          internalEffect.provideServices(context),
          internalEffect.map((merged) => f(merged, context))
        )
    )
  )

/**
 * Feeds the output services of this builder into the input of the specified
 * builder, resulting in a new builder with the inputs of this builder as
 * well as any leftover inputs, and the outputs of the specified builder.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * class UserService extends ServiceMap.Key<UserService, { readonly getUser: (id: string) => Effect.Effect<{ id: string; name: string }> }>()("UserService") {}
 *
 * class Logger extends ServiceMap.Key<Logger, { readonly log: (msg: string) => Effect.Effect<void> }>()("Logger") {}
 *
 * // Create dependency layers
 * const databaseLayer = Layer.succeed(Database)({
 *   query: (sql: string) => Effect.succeed(`DB: ${sql}`)
 * })
 *
 * const loggerLayer = Layer.succeed(Logger)({
 *   log: (msg: string) => Effect.sync(() => console.log(`[LOG] ${msg}`))
 * })
 *
 * // UserService depends on Database and Logger
 * const userServiceLayer = Layer.effect(UserService)(Effect.gen(function* () {
 *   const database = yield* Database
 *   const logger = yield* Logger
 *
 *   return {
 *     getUser: (id: string) => Effect.gen(function* () {
 *       yield* logger.log(`Looking up user ${id}`)
 *       const result = yield* database.query(`SELECT * FROM users WHERE id = ${id}`)
 *       return { id, name: result }
 *     })
 *   }
 * }))
 *
 * // Provide dependencies to UserService layer
 * const userServiceWithDependencies = userServiceLayer.pipe(
 *   Layer.provide(Layer.mergeAll(databaseLayer, loggerLayer))
 * )
 *
 * // Now UserService layer has no dependencies
 * const program = Effect.gen(function* () {
 *   const userService = yield* UserService
 *   return yield* userService.getUser("123")
 * }).pipe(
 *   Effect.provide(userServiceWithDependencies)
 * )
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const provide: {
  <RIn, E, ROut>(
    that: Layer<ROut, E, RIn>
  ): <RIn2, E2, ROut2>(self: Layer<ROut2, E2, RIn2>) => Layer<ROut2, E | E2, RIn | Exclude<RIn2, ROut>>
  <const Layers extends [Any, ...Array<Any>]>(
    that: Layers
  ): <A, E, R>(
    self: Layer<A, E, R>
  ) => Layer<
    A,
    E | Error<Layers[number]>,
    | Services<Layers[number]>
    | Exclude<R, Success<Layers[number]>>
  >
  <RIn2, E2, ROut2, RIn, E, ROut>(
    self: Layer<ROut2, E2, RIn2>,
    that: Layer<ROut, E, RIn>
  ): Layer<ROut2, E | E2, RIn | Exclude<RIn2, ROut>>
  <A, E, R, const Layers extends [Any, ...Array<Any>]>(
    self: Layer<A, E, R>,
    that: Layers
  ): Layer<
    A,
    E | Error<Layers[number]>,
    | Services<Layers[number]>
    | Exclude<R, Success<Layers[number]>>
  >
} = dual(2, (
  self: Layer<any, any, any>,
  that: Layer<any, any, any> | ReadonlyArray<Layer<any, any, any>>
) => provideWith(self, that, identity))

/**
 * Feeds the output services of this layer into the input of the specified
 * layer, resulting in a new layer with the inputs of this layer, and the
 * outputs of both layers.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * class Logger extends ServiceMap.Key<Logger, { readonly log: (msg: string) => Effect.Effect<void> }>()("Logger") {}
 *
 * class UserService extends ServiceMap.Key<UserService, { readonly getUser: (id: string) => Effect.Effect<{ id: string; name: string }> }>()("UserService") {}
 *
 * // Create dependency layers
 * const databaseLayer = Layer.succeed(Database)({
 *   query: (sql: string) => Effect.succeed(`DB: ${sql}`)
 * })
 *
 * const loggerLayer = Layer.succeed(Logger)({
 *   log: (msg: string) => Effect.sync(() => console.log(`[LOG] ${msg}`))
 * })
 *
 * // UserService depends on Database and Logger
 * const userServiceLayer = Layer.effect(UserService)(Effect.gen(function* () {
 *   const database = yield* Database
 *   const logger = yield* Logger
 *
 *   return {
 *     getUser: (id: string) => Effect.gen(function* () {
 *       yield* logger.log(`Looking up user ${id}`)
 *       const result = yield* database.query(`SELECT * FROM users WHERE id = ${id}`)
 *       return { id, name: result }
 *     })
 *   }
 * }))
 *
 * // Provide dependencies and merge all services together
 * const allServicesLayer = userServiceLayer.pipe(
 *   Layer.provideMerge(Layer.mergeAll(databaseLayer, loggerLayer))
 * )
 *
 * // Now the resulting layer provides UserService, Database, AND Logger
 * const program = Effect.gen(function* () {
 *   const userService = yield* UserService
 *   const logger = yield* Logger // Still available!
 *   const database = yield* Database // Still available!
 *
 *   const user = yield* userService.getUser("123")
 *   yield* logger.log(`Found user: ${user.name}`)
 *
 *   return user
 * }).pipe(
 *   Effect.provide(allServicesLayer)
 * )
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const provideMerge: {
  <RIn, E, ROut>(
    that: Layer<ROut, E, RIn>
  ): <RIn2, E2, ROut2>(self: Layer<ROut2, E2, RIn2>) => Layer<ROut | ROut2, E | E2, RIn | Exclude<RIn2, ROut>>
  <const Layers extends [Any, ...Array<Any>]>(
    that: Layers
  ): <A, E, R>(
    self: Layer<A, E, R>
  ) => Layer<
    A | Success<Layers[number]>,
    E | Error<Layers[number]>,
    | Services<Layers[number]>
    | Exclude<R, Success<Layers[number]>>
  >
  <RIn2, E2, ROut2, RIn, E, ROut>(
    self: Layer<ROut2, E2, RIn2>,
    that: Layer<ROut, E, RIn>
  ): Layer<ROut | ROut2, E | E2, RIn | Exclude<RIn2, ROut>>
  <A, E, R, const Layers extends [Any, ...Array<Any>]>(
    self: Layer<A, E, R>,
    that: Layers
  ): Layer<
    A | Success<Layers[number]>,
    E | Error<Layers[number]>,
    | Services<Layers[number]>
    | Exclude<R, Success<Layers[number]>>
  >
} = dual(2, (
  self: Layer<any, any, any>,
  that: Layer<any, any, any> | ReadonlyArray<Layer<any, any, any>>
) =>
  provideWith(
    self,
    that,
    (self, that) => ServiceMap.merge(that, self)
  ))

/**
 * Constructs a layer dynamically based on the output of this layer.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class Config extends ServiceMap.Key<Config, { readonly dbUrl: string; readonly logLevel: string }>()("Config") {}
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * class Logger extends ServiceMap.Key<Logger, { readonly log: (msg: string) => Effect.Effect<void> }>()("Logger") {}
 *
 * // Base config layer
 * const configLayer = Layer.succeed(Config)({
 *   dbUrl: "postgres://localhost:5432/mydb",
 *   logLevel: "debug"
 * })
 *
 * // Dynamically create services based on config
 * const dynamicServiceLayer = configLayer.pipe(
 *   Layer.flatMap((services) => {
 *     const config = ServiceMap.get(services, Config)
 *
 *     // Create database layer based on config
 *     const dbLayer = Layer.succeed(Database)({
 *       query: (sql: string) => Effect.succeed(`Querying ${config.dbUrl}: ${sql}`)
 *     })
 *
 *     // Create logger layer based on config
 *     const loggerLayer = Layer.succeed(Logger)({
 *       log: (msg: string) => config.logLevel === "debug"
 *         ? Effect.sync(() => console.log(`[DEBUG] ${msg}`))
 *         : Effect.sync(() => console.log(msg))
 *     })
 *
 *     // Return combined layer
 *     return Layer.mergeAll(dbLayer, loggerLayer)
 *   })
 * )
 *
 * // Use the dynamic services
 * const program = Effect.gen(function* () {
 *   const database = yield* Database
 *   const logger = yield* Logger
 *
 *   yield* logger.log("Starting database query")
 *   const result = yield* database.query("SELECT * FROM users")
 *
 *   return result
 * }).pipe(
 *   Effect.provide(dynamicServiceLayer)
 * )
 * ```
 *
 * @since 2.0.0
 * @category sequencing
 */
export const flatMap: {
  <A, A2, E2, R2>(
    f: (context: ServiceMap.ServiceMap<A>) => Layer<A2, E2, R2>
  ): <E, R>(self: Layer<A, E, R>) => Layer<A2, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Layer<A, E, R>,
    f: (context: ServiceMap.ServiceMap<A>) => Layer<A2, E2, R2>
  ): Layer<A2, E | E2, R | R2>
} = dual(2, <A, E, R, A2, E2, R2>(
  self: Layer<A, E, R>,
  f: (context: ServiceMap.ServiceMap<A>) => Layer<A2, E2, R2>
): Layer<A2, E | E2, R | R2> =>
  fromBuild((memoMap, scope) =>
    internalEffect.flatMap(
      self.build(memoMap, scope),
      (context) => f(context).build(memoMap, scope)
    )
  ))

/**
 * Translates effect failure into death of the fiber, making all failures
 * unchecked and not a part of the type of the layer.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 * import { Data } from "effect/data"
 *
 * class DatabaseError extends Data.TaggedError("DatabaseError")<{
 *   message: string
 * }> {}
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * // Layer that can fail during construction
 * const flakyDatabaseLayer = Layer.effect(Database)(Effect.gen(function* () {
 *   // Simulate a database connection that might fail
 *   const shouldFail = Math.random() > 0.5
 *   if (shouldFail) {
 *     yield* Effect.fail(new DatabaseError({ message: "Connection failed" }))
 *   }
 *
 *   return { query: (sql: string) => Effect.succeed(`Result: ${sql}`) }
 * }))
 *
 * // Convert failures to fiber death - removes error from type
 * const reliableDatabaseLayer = flakyDatabaseLayer.pipe(Layer.orDie)
 *
 * // Now the layer type is Layer<Database, never, never> - no error in type
 * const program = Effect.gen(function* () {
 *   const database = yield* Database
 *   return yield* database.query("SELECT * FROM users")
 * }).pipe(
 *   Effect.provide(reliableDatabaseLayer)
 * )
 *
 * // If the database layer fails, the entire fiber will die
 * // instead of the effect failing with DatabaseError
 * ```
 *
 * @since 2.0.0
 * @category error handling
 */
export const orDie = <A, E, R>(self: Layer<A, E, R>): Layer<A, never, R> =>
  fromBuildUnsafe((memoMap, scope) => internalEffect.orDie(self.build(memoMap, scope)))

const catch_: {
  <E, RIn2, E2, ROut2>(
    onError: (error: E) => Layer<ROut2, E2, RIn2>
  ): <RIn, ROut>(self: Layer<ROut, E, RIn>) => Layer<ROut & ROut2, E2, RIn2 | RIn>
  <RIn, E, ROut, RIn2, E2, ROut2>(
    self: Layer<ROut, E, RIn>,
    onError: (error: E) => Layer<ROut2, E2, RIn2>
  ): Layer<ROut & ROut2, E2, RIn | RIn2>
} = dual(2, <RIn, E, ROut, RIn2, E2, ROut2>(
  self: Layer<ROut, E, RIn>,
  onError: (error: E) => Layer<ROut2, E2, RIn2>
): Layer<ROut & ROut2, E2, RIn | RIn2> =>
  fromBuildUnsafe((memoMap, scope) =>
    internalEffect.catch_(
      self.build(memoMap, scope),
      (e) => onError(e).build(memoMap, scope)
    ) as any
  ))

export {
  /**
   * Recovers from all errors.
   *
   * @since 4.0.0
   * @category error handling
   */
  catch_ as catch
}

/**
 * Recovers from all errors.
 *
 * @example
 * ```ts
 * import { Effect, Cause } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 * import { Data } from "effect/data"
 *
 * class DatabaseError extends Data.TaggedError("DatabaseError")<{
 *   message: string
 * }> {}
 *
 * class NetworkError extends Data.TaggedError("NetworkError")<{
 *   reason: string
 * }> {}
 *
 * class Database extends ServiceMap.Key<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
 *
 * class Logger extends ServiceMap.Key<Logger, { readonly log: (msg: string) => Effect.Effect<void> }>()("Logger") {}
 *
 * // Primary database layer that might fail
 * const primaryDatabaseLayer = Layer.effect(Database)(Effect.gen(function* () {
 *   yield* Effect.fail(new DatabaseError({ message: "Primary DB unreachable" }))
 *   return { query: (sql: string) => Effect.succeed(`Primary: ${sql}`) }
 * }))
 *
 * // Fallback layers for different error causes
 * const databaseWithFallback = primaryDatabaseLayer.pipe(
 *   Layer.catchCause(() => {
 *     // For any cause/error, fallback to in-memory database
 *     return Layer.mergeAll(
 *       Layer.succeed(Database)({
 *         query: (sql: string) => Effect.succeed(`Memory: ${sql}`)
 *       }),
 *       Layer.succeed(Logger)({
 *         log: (msg: string) => Effect.sync(() => console.log(`[FALLBACK] ${msg}`))
 *       })
 *     )
 *   })
 * )
 *
 * const program = Effect.gen(function* () {
 *   const database = yield* Database
 *   return yield* database.query("SELECT * FROM users")
 * }).pipe(
 *   Effect.provide(databaseWithFallback)
 * )
 * ```
 *
 * @since 2.0.0
 * @category error handling
 */
export const catchCause: {
  <E, RIn2, E2, ROut2>(
    onError: (cause: Cause.Cause<E>) => Layer<ROut2, E2, RIn2>
  ): <RIn, ROut>(self: Layer<ROut, E, RIn>) => Layer<ROut & ROut2, E2, RIn2 | RIn>
  <RIn, E, ROut, RIn2, E2, ROut22>(
    self: Layer<ROut, E, RIn>,
    onError: (cause: Cause.Cause<E>) => Layer<ROut22, E2, RIn2>
  ): Layer<ROut & ROut22, E2, RIn | RIn2>
} = dual(2, <RIn, E, ROut, RIn2, E2, ROut2>(
  self: Layer<ROut, E, RIn>,
  onError: (cause: Cause.Cause<E>) => Layer<ROut2, E2, RIn2>
): Layer<ROut & ROut2, E2, RIn | RIn2> =>
  fromBuildUnsafe((memoMap, scope) =>
    internalEffect.catchCause(
      self.build(memoMap, scope),
      (cause) => onError(cause).build(memoMap, scope)
    ) as any
  ))

/**
 * Updates a service in the context with a new implementation.
 *
 * **Details**
 *
 * This function modifies the existing implementation of a service in the
 * context. It retrieves the current service, applies the provided
 * transformation function `f`, and replaces the old service with the
 * transformed one.
 *
 * **When to Use**
 *
 * This is useful for adapting or extending a service's behavior during the
 * creation of a layer.
 *
 * @since 3.13.0
 * @category utils
 */
export const updateService: {
  <I, A>(key: ServiceMap.Key<I, A>, f: (a: A) => A): <A1, E1, R1>(layer: Layer<A1, E1, R1>) => Layer<A1, E1, I | R1>
  <A1, E1, R1, I, A>(layer: Layer<A1, E1, R1>, key: ServiceMap.Key<I, A>, f: (a: A) => A): Layer<A1, E1, I | R1>
} = dual(
  3,
  <A1, E1, R1, I, A>(layer: Layer<A1, E1, R1>, key: ServiceMap.Key<I, A>, f: (a: A) => A): Layer<A1, E1, I | R1> =>
    provide(
      layer,
      effect(key)(internalEffect.map(key.asEffect(), f))
    )
)

/**
 * Creates a fresh version of this layer that will not be shared.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 * import { Ref } from "effect"
 *
 * class Counter extends ServiceMap.Key<Counter, { readonly count: number; readonly increment: () => Effect.Effect<number> }>()("Counter") {}
 *
 * // Layer that creates a counter with shared state
 * const counterLayer = Layer.effect(Counter)(Effect.gen(function* () {
 *   const ref = yield* Ref.make(0)
 *   return {
 *     count: 0,
 *     increment: () => Ref.update(ref, n => n + 1).pipe(
 *       Effect.flatMap(() => Ref.get(ref))
 *     )
 *   }
 * }))
 *
 * // By default, layers are shared - same instance used everywhere
 * const sharedProgram = Effect.gen(function* () {
 *   const counter1 = yield* Counter
 *   const counter2 = yield* Counter
 *
 *   // Both counter1 and counter2 refer to the same instance
 *   console.log("Shared layer - same instance")
 * }).pipe(
 *   Effect.provide(counterLayer)
 * )
 *
 * // Fresh layer creates a new instance each time
 * const freshProgram = Effect.gen(function* () {
 *   const counter1 = yield* Counter
 *   const counter2 = yield* Counter
 *
 *   // counter1 and counter2 are different instances
 *   console.log("Fresh layer - different instances")
 * }).pipe(
 *   Effect.provide(Layer.fresh(counterLayer))
 * )
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const fresh = <A, E, R>(self: Layer<A, E, R>): Layer<A, E, R> =>
  fromBuildUnsafe((_, scope) => self.build(makeMemoMapUnsafe(), scope))

/**
 * Builds this layer and uses it until it is interrupted. This is useful when
 * your entire application is a layer, such as an HTTP server.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 * import { Console } from "effect/logging"
 *
 * class HttpServer extends ServiceMap.Key<HttpServer, {
 *   readonly start: () => Effect.Effect<string>
 *   readonly stop: () => Effect.Effect<string>
 * }>()("HttpServer") {}
 *
 * class Logger extends ServiceMap.Key<Logger, { readonly log: (msg: string) => Effect.Effect<void> }>()("Logger") {}
 *
 * // Server layer that starts an HTTP server
 * const serverLayer = Layer.effect(HttpServer)(Effect.gen(function* () {
 *   yield* Console.log("Starting HTTP server...")
 *
 *   return {
 *     start: () => Effect.gen(function* () {
 *       yield* Console.log("Server listening on port 3000")
 *       return "Server started"
 *     }),
 *     stop: () => Effect.gen(function* () {
 *       yield* Console.log("Server stopped gracefully")
 *       return "Server stopped"
 *     })
 *   }
 * }))
 *
 * const loggerLayer = Layer.succeed(Logger)({
 *   log: (msg: string) => Console.log(`[LOG] ${msg}`)
 * })
 *
 * // Application layer combining all services
 * const appLayer = Layer.mergeAll(serverLayer, loggerLayer)
 *
 * // Launch the application - runs until interrupted
 * const application = appLayer.pipe(
 *   Layer.launch,
 *   Effect.tapError((error) => Console.log(`Application failed: ${error}`)),
 *   Effect.tap(() => Console.log("Application completed"))
 * )
 *
 * // This will run forever until externally interrupted
 * // Effect.runFork(application)
 * ```
 *
 * @since 2.0.0
 * @category conversions
 */
export const launch = <RIn, E, ROut>(self: Layer<ROut, E, RIn>): Effect<never, E, RIn> =>
  internalEffect.scoped(internalEffect.andThen(build(self), internalEffect.never))

/**
 * A utility type for creating partial mocks of services in testing.
 *
 * This type makes Effect methods and Effect-returning functions optional,
 * while keeping non-Effect properties required. This allows you to provide
 * only the methods you need to test while leaving others unimplemented.
 *
 * @since 4.0.0
 * @category Testing
 */
export type PartialEffectful<A extends object> = Types.Simplify<
  & {
    [
      K in keyof A as A[K] extends Effect<any, any, any> | ((...args: any) => Effect<any, any, any>) ? K
        : never
    ]?: A[K]
  }
  & {
    [
      K in keyof A as A[K] extends Effect<any, any, any> | ((...args: any) => Effect<any, any, any>) ? never
        : K
    ]: A[K]
  }
>

/**
 * Creates a mock layer for testing purposes. You can provide a partial
 * implementation of the service, and any methods not provided will
 * throw an unimplemented defect when called.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 *
 * class UserService extends ServiceMap.Key<UserService, {
 *   readonly config: { apiUrl: string }
 *   readonly getUser: (id: string) => Effect.Effect<{ id: string; name: string }, Error>
 *   readonly deleteUser: (id: string) => Effect.Effect<void, Error>
 *   readonly updateUser: (id: string, data: object) => Effect.Effect<{ id: string; name: string }, Error>
 * }>()("UserService") {}
 *
 * // Create a partial mock - only implement what you need for testing
 * const testUserLayer = Layer.mock(UserService)({
 *   config: { apiUrl: "https://test-api.com" }, // Required - non-Effect property
 *   getUser: (id: string) => Effect.succeed({ id, name: "Test User" }), // Mock implementation
 *   // deleteUser and updateUser are omitted - will throw UnimplementedError if called
 * })
 *
 * // Use in tests
 * const testProgram = Effect.gen(function* () {
 *   const userService = yield* UserService
 *
 *   // This works - we provided an implementation
 *   const user = yield* userService.getUser("123")
 *   console.log(user.name) // "Test User"
 *
 *   // This would throw - we didn't implement deleteUser
 *   // yield* userService.deleteUser("123") // UnimplementedError
 * }).pipe(
 *   Effect.provide(testUserLayer)
 * )
 * ```
 *
 * @since 4.0.0
 * @category Testing
 */
export const mock = <I, S extends object>(key: ServiceMap.Key<I, S>) => (service: PartialEffectful<S>): Layer<I> =>
  succeed(key)(
    new Proxy({ ...service as object } as S, {
      get(target, prop, _receiver) {
        if (prop in target) {
          return target[prop as keyof S]
        }
        const prevLimit = (Error as ErrorWithStackTraceLimit).stackTraceLimit
        ;(Error as ErrorWithStackTraceLimit).stackTraceLimit = 2
        const error = new Error(`${key.key}: Unimplemented method "${prop.toString()}"`)
        ;(Error as ErrorWithStackTraceLimit).stackTraceLimit = prevLimit
        error.name = "UnimplementedError"
        return makeUnimplemented(error)
      },
      has: constTrue
    })
  )

const makeUnimplemented = (error: globalThis.Error) => {
  const dead = internalEffect.die(error)
  function unimplemented() {
    return dead
  }
  // @effect-diagnostics-next-line floatingEffect:off
  Object.assign(unimplemented, dead)
  Object.setPrototypeOf(unimplemented, Object.getPrototypeOf(dead))
  return unimplemented
}
