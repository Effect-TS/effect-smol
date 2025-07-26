/**
 * @since 3.14.0
 */
import * as Effect from "./Effect.ts"
import { identity } from "./Function.ts"
import * as Layer from "./Layer.ts"
import * as RcMap from "./RcMap.ts"
import * as Scope from "./Scope.ts"
import * as ServiceMap from "./ServiceMap.ts"
import type * as Duration from "./time/Duration.ts"
import type { Mutable } from "./types/Types.ts"

/**
 * @since 3.14.0
 * @category Symbols
 */
export const TypeId: TypeId = "~effect/LayerMap"

/**
 * @since 3.14.0
 * @category Symbols
 */
export type TypeId = "~effect/LayerMap"

/**
 * @since 3.14.0
 * @category Models
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 * import { LayerMap } from "effect"
 *
 * // Define a service key
 * const DatabaseService = ServiceMap.Key<{
 *   readonly query: (sql: string) => Effect.Effect<string>
 * }>("Database")
 *
 * // Create a LayerMap that provides different database configurations
 * const createDatabaseLayerMap = LayerMap.make((env: string) =>
 *   Layer.succeed(DatabaseService)({
 *     query: (sql) => Effect.succeed(`${env}: ${sql}`)
 *   })
 * )
 *
 * // Use the LayerMap
 * const program = Effect.gen(function* () {
 *   const layerMap = yield* createDatabaseLayerMap
 *
 *   // Get a layer for a specific environment
 *   const devLayer = layerMap.get("development")
 *
 *   // Get services directly
 *   const services = yield* layerMap.services("production")
 *
 *   // Invalidate a cached layer
 *   yield* layerMap.invalidate("development")
 * })
 * ```
 */
export interface LayerMap<in out K, in out I, in out E = never> {
  readonly [TypeId]: TypeId

  /**
   * The internal RcMap that stores the resources.
   */
  readonly rcMap: RcMap.RcMap<K, ServiceMap.ServiceMap<I>, E>

  /**
   * Retrieves a Layer for the resources associated with the key.
   */
  get(key: K): Layer.Layer<I, E>

  /**
   * Retrieves the services associated with the key.
   */
  services(key: K): Effect.Effect<ServiceMap.ServiceMap<I>, E, Scope.Scope>

  /**
   * Invalidates the resource associated with the key.
   */
  invalidate(key: K): Effect.Effect<void>
}

/**
 * @since 3.14.0
 * @category Constructors
 *
 * A `LayerMap` allows you to create a map of Layer's that can be used to
 * dynamically access resources based on a key.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer, ServiceMap } from "effect"
 * import { LayerMap, Scope } from "effect"
 *
 * // Define a service key
 * const DatabaseService = ServiceMap.Key<{
 *   readonly query: (sql: string) => Effect.Effect<string>
 * }>("Database")
 *
 * // Create a LayerMap that provides different database configurations
 * const program = Effect.gen(function* () {
 *   const layerMap = yield* LayerMap.make((env: string) =>
 *     Layer.succeed(DatabaseService)({
 *       query: (sql) => Effect.succeed(`${env}: ${sql}`)
 *     }),
 *     { idleTimeToLive: "5 seconds" }
 *   )
 *
 *   // Get a layer for a specific environment
 *   const devLayer = layerMap.get("development")
 *
 *   // Use the layer to provide the service
 *   const result = yield* Effect.provide(
 *     Effect.gen(function* () {
 *       const db = yield* DatabaseService
 *       return yield* db.query("SELECT * FROM users")
 *     }),
 *     devLayer
 *   )
 *
 *   console.log(result) // "development: SELECT * FROM users"
 * })
 * ```
 */
export const make: <
  K,
  L extends Layer.Layer<any, any, any>
>(
  lookup: (key: K) => L,
  options?: {
    readonly idleTimeToLive?: Duration.DurationInput | undefined
  } | undefined
) => Effect.Effect<
  LayerMap<
    K,
    L extends Layer.Layer<infer _A, infer _E, infer _R> ? _A : never,
    L extends Layer.Layer<infer _A, infer _E, infer _R> ? _E : never
  >,
  never,
  Scope.Scope | (L extends Layer.Layer<infer _A, infer _E, infer _R> ? _R : never)
> = Effect.fnUntraced(function*<I, K, EL, RL>(
  lookup: (key: K) => Layer.Layer<I, EL, RL>,
  options?: {
    readonly idleTimeToLive?: Duration.DurationInput | undefined
  } | undefined
) {
  const services = yield* Effect.services<never>()
  const memoMap = ServiceMap.get(services, Layer.CurrentMemoMap)

  const rcMap = yield* RcMap.make({
    lookup: (key: K) =>
      Effect.servicesWith((_: ServiceMap.ServiceMap<Scope.Scope>) =>
        Layer.buildWithMemoMap(lookup(key), memoMap, ServiceMap.get(_, Scope.Scope))
      ),
    idleTimeToLive: options?.idleTimeToLive
  })

  return identity<LayerMap<K, I, any>>({
    [TypeId]: TypeId,
    rcMap,
    get: (key) => Layer.effectServices(RcMap.get(rcMap, key)),
    services: (key) => RcMap.get(rcMap, key),
    invalidate: (key) => RcMap.invalidate(rcMap, key)
  })
})

/**
 * @since 3.14.0
 * @category Constructors
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { LayerMap } from "effect"
 * import { Layer, ServiceMap } from "effect"
 *
 * // Define service keys
 * const DevDatabase = ServiceMap.Key<{
 *   readonly query: (sql: string) => Effect.Effect<string>
 * }>("DevDatabase")
 *
 * const ProdDatabase = ServiceMap.Key<{
 *   readonly query: (sql: string) => Effect.Effect<string>
 * }>("ProdDatabase")
 *
 * // Create predefined layers
 * const layers = {
 *   development: Layer.succeed(DevDatabase)({
 *     query: (sql) => Effect.succeed(`DEV: ${sql}`)
 *   }),
 *   production: Layer.succeed(ProdDatabase)({
 *     query: (sql) => Effect.succeed(`PROD: ${sql}`)
 *   })
 * } as const
 *
 * // Create a LayerMap from the record
 * const program = Effect.gen(function* () {
 *   const layerMap = yield* LayerMap.fromRecord(layers, {
 *     idleTimeToLive: "10 seconds"
 *   })
 *
 *   // Get layers by key
 *   const devLayer = layerMap.get("development")
 *   const prodLayer = layerMap.get("production")
 *
 *   console.log("LayerMap created from record")
 * })
 * ```
 */
export const fromRecord = <
  const Layers extends Record<string, Layer.Layer<any, any, any>>
>(
  layers: Layers,
  options?: {
    readonly idleTimeToLive?: Duration.DurationInput | undefined
  } | undefined
): Effect.Effect<
  LayerMap<
    keyof Layers,
    Layers[keyof Layers] extends Layer.Layer<infer _A, infer _E, infer _R> ? _A : never,
    Layers[keyof Layers] extends Layer.Layer<infer _A, infer _E, infer _R> ? _E : never
  >,
  never,
  Scope.Scope | (Layers[keyof Layers] extends Layer.Layer<infer _A, infer _E, infer _R> ? _R : never)
> => make((key: keyof Layers) => layers[key], options)

/**
 * @since 3.14.0
 * @category Service
 */
export interface TagClass<
  in out Self,
  in out Id extends string,
  in out K,
  in out I,
  in out E,
  in out R,
  in out Deps extends Layer.Layer<any, any, any>
> extends ServiceMap.KeyClass<Self, Id, LayerMap<K, I, E>> {
  /**
   * A default layer for the `LayerMap` service.
   */
  readonly layer: Layer.Layer<
    Self,
    (Deps extends Layer.Layer<infer _A, infer _E, infer _R> ? _E : never),
    | Exclude<R, (Deps extends Layer.Layer<infer _A, infer _E, infer _R> ? _A : never)>
    | (Deps extends Layer.Layer<infer _A, infer _E, infer _R> ? _R : never)
  >

  /**
   * A default layer for the `LayerMap` service without the dependencies provided.
   */
  readonly layerNoDeps: Layer.Layer<Self, never, R>

  /**
   * Retrieves a Layer for the resources associated with the key.
   */
  readonly get: (key: K) => Layer.Layer<I, E, Self>

  /**
   * Retrieves the services associated with the key.
   */
  readonly services: (key: K) => Effect.Effect<ServiceMap.ServiceMap<I>, E, Scope.Scope | Self>

  /**
   * Invalidates the resource associated with the key.
   */
  readonly invalidate: (key: K) => Effect.Effect<void, never, Self>
}

/**
 * @since 3.14.0
 * @category Service
 *
 * Create a `LayerMap` service that provides a dynamic set of resources based on
 * a key.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { ServiceMap } from "effect"
 * import { Console } from "effect/logging"
 * import { LayerMap } from "effect"
 *
 * // Define a service key
 * const Greeter = ServiceMap.Key<{
 *   readonly greet: Effect.Effect<string>
 * }>("Greeter")
 *
 * // Create a service that wraps a LayerMap
 * class GreeterMap extends LayerMap.Service<GreeterMap>()("GreeterMap", {
 *   // Define the lookup function for the layer map
 *   lookup: (name: string) =>
 *     Layer.succeed(Greeter)({
 *       greet: Effect.succeed(`Hello, ${name}!`)
 *     }),
 *
 *   // If a layer is not used for a certain amount of time, it can be removed
 *   idleTimeToLive: "5 seconds"
 * }) {}
 *
 * // Usage
 * const program = Effect.gen(function* () {
 *   // Access and use the Greeter service
 *   const greeter = yield* Greeter
 *   yield* Console.log(yield* greeter.greet)
 * }).pipe(
 *   // Use the GreeterMap service to provide a variant of the Greeter service
 *   Effect.provide(GreeterMap.get("John"))
 * ).pipe(
 *   // Provide the GreeterMap layer
 *   Effect.provide(GreeterMap.layer)
 * )
 * ```
 */
export const Service = <Self>() =>
<
  const Id extends string,
  Lookup extends {
    readonly lookup: (key: any) => Layer.Layer<any, any, any>
  } | {
    readonly layers: Record<string, Layer.Layer<any, any, any>>
  },
  const Deps extends ReadonlyArray<Layer.Layer<any, any, any>> = []
>(
  id: Id,
  options: Lookup & {
    readonly dependencies?: Deps | undefined
    readonly idleTimeToLive?: Duration.DurationInput | undefined
  }
): TagClass<
  Self,
  Id,
  Lookup extends { readonly lookup: (key: infer K) => any } ? K
    : Lookup extends { readonly layers: infer Layers } ? keyof Layers
    : never,
  Service.Success<Lookup>,
  Service.Error<Lookup>,
  Service.Services<Lookup>,
  Deps[number]
> => {
  const Err = globalThis.Error as any
  const limit = Err.stackTraceLimit
  Err.stackTraceLimit = 2
  const creationError = new Err()
  Err.stackTraceLimit = limit

  function TagClass() {}
  const TagClass_ = TagClass as any as Mutable<TagClass<Self, Id, string, any, any, any, any>>
  Object.setPrototypeOf(TagClass, Object.getPrototypeOf(ServiceMap.Key<Self, any>(id)))
  TagClass.key = id
  Object.defineProperty(TagClass, "stack", {
    get() {
      return creationError.stack
    }
  })

  TagClass_.layerNoDeps = Layer.effect(TagClass_)(
    "lookup" in options
      ? make(options.lookup, options)
      : fromRecord(options.layers as any, options) as any
  )
  TagClass_.layer = options.dependencies && options.dependencies.length > 0 ?
    Layer.provide(TagClass_.layerNoDeps, options.dependencies as any) :
    TagClass_.layerNoDeps

  TagClass_.get = (key: string) => Layer.unwrap(Effect.map(TagClass_.asEffect(), (layerMap) => layerMap.get(key)))
  TagClass_.services = (key: string) => Effect.flatMap(TagClass_.asEffect(), (layerMap) => layerMap.services(key))
  TagClass_.invalidate = (key: string) => Effect.flatMap(TagClass_.asEffect(), (layerMap) => layerMap.invalidate(key))

  return TagClass as any
}

/**
 * @since 3.14.0
 * @category Service
 */
export declare namespace Service {
  /**
   * @since 3.14.0
   * @category Service
   */
  export type Key<Options> = Options extends { readonly lookup: (key: infer K) => any } ? K
    : Options extends { readonly layers: infer Layers } ? keyof Layers
    : never

  /**
   * @since 3.14.0
   * @category Service
   */
  export type Layers<Options> = Options extends { readonly lookup: (key: infer _K) => infer Layers } ? Layers
    : Options extends { readonly layers: infer Layers } ? Layers[keyof Layers]
    : never

  /**
   * @since 3.14.0
   * @category Service
   */
  export type Success<Options> = Layers<Options> extends Layer.Layer<infer _A, infer _E, infer _R> ? _A : never

  /**
   * @since 3.14.0
   * @category Service
   */
  export type Error<Options> = Layers<Options> extends Layer.Layer<infer _A, infer _E, infer _R> ? _E : never

  /**
   * @since 3.14.0
   * @category Service
   */
  export type Services<Options> = Layers<Options> extends Layer.Layer<infer _A, infer _E, infer _R> ? _R : never
}
