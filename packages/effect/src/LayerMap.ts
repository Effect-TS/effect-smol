/**
 * @since 3.14.0
 * @experimental
 */
import type * as Duration from "./Duration.js"
import * as Effect from "./Effect.js"
import { identity } from "./Function.js"
import * as Layer from "./Layer.js"
import * as RcMap from "./RcMap.js"
import * as Scope from "./Scope.js"
import * as ServiceMap from "./ServiceMap.js"
import type { Mutable } from "./Types.js"

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
 * @experimental
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
 * @experimental
 *
 * A `LayerMap` allows you to create a map of Layer's that can be used to
 * dynamically access resources based on a key.
 *
 * ```ts
 * import { NodeRuntime } from "@effect/platform-node"
 * import { ServiceMap, Effect, FiberRef, Layer, LayerMap } from "effect"
 *
 * class Greeter extends ServiceMap.Tag("Greeter")<Greeter, {
 *   greet: Effect.Effect<string>
 * }>() {}
 *
 * // create a service that wraps a LayerMap
 * class GreeterMap extends LayerMap.Service<GreeterMap>()("GreeterMap", {
 *   // define the lookup function for the layer map
 *   //
 *   // The returned Layer will be used to provide the Greeter service for the
 *   // given name.
 *   lookup: (name: string) =>
 *     Layer.succeed(Greeter, {
 *       greet: Effect.succeed(`Hello, ${name}!`)
 *     }),
 *
 *   // If a layer is not used for a certain amount of time, it can be removed
 *   idleTimeToLive: "5 seconds",
 *
 *   // Supply the dependencies for the layers in the LayerMap
 *   dependencies: []
 * }) {}
 *
 * // usage
 * const program: Effect.Effect<void, never, GreeterMap> = Effect.gen(function*() {
 *   // access and use the Greeter service
 *   const greeter = yield* Greeter
 *   yield* Effect.log(yield* greeter.greet)
 * }).pipe(
 *   // use the GreeterMap service to provide a variant of the Greeter service
 *   Effect.provide(GreeterMap.get("John"))
 * )
 *
 * // run the program
 * program.pipe(
 *   Effect.provide(GreeterMap.layer),
 *   NodeRuntime.runMain
 * )
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
 * @experimental
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
 * @experimental
 *
 * Create a `LayerMap` service that provides a dynamic set of resources based on
 * a key.
 *
 * ```ts
 * import { NodeRuntime } from "@effect/platform-node"
 * import { ServiceMap, Effect, FiberRef, Layer, LayerMap } from "effect"
 *
 * class Greeter extends ServiceMap.Tag("Greeter")<Greeter, {
 *   greet: Effect.Effect<string>
 * }>() {}
 *
 * // create a service that wraps a LayerMap
 * class GreeterMap extends LayerMap.Service<GreeterMap>()("GreeterMap", {
 *   // define the lookup function for the layer map
 *   //
 *   // The returned Layer will be used to provide the Greeter service for the
 *   // given name.
 *   lookup: (name: string) =>
 *     Layer.succeed(Greeter, {
 *       greet: Effect.succeed(`Hello, ${name}!`)
 *     }),
 *
 *   // If a layer is not used for a certain amount of time, it can be removed
 *   idleTimeToLive: "5 seconds",
 *
 *   // Supply the dependencies for the layers in the LayerMap
 *   dependencies: []
 * }) {}
 *
 * // usage
 * const program: Effect.Effect<void, never, GreeterMap> = Effect.gen(function*() {
 *   // access and use the Greeter service
 *   const greeter = yield* Greeter
 *   yield* Effect.log(yield* greeter.greet)
 * }).pipe(
 *   // use the GreeterMap service to provide a variant of the Greeter service
 *   Effect.provide(GreeterMap.get("John"))
 * )
 *
 * // run the program
 * program.pipe(
 *   Effect.provide(GreeterMap.layer),
 *   NodeRuntime.runMain
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

  TagClass_.layerNoDeps = Layer.effect(
    TagClass_,
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
 * @experimental
 */
export declare namespace Service {
  /**
   * @since 3.14.0
   * @category Service
   * @experimental
   */
  export type Key<Options> = Options extends { readonly lookup: (key: infer K) => any } ? K
    : Options extends { readonly layers: infer Layers } ? keyof Layers
    : never

  /**
   * @since 3.14.0
   * @category Service
   * @experimental
   */
  export type Layers<Options> = Options extends { readonly lookup: (key: infer _K) => infer Layers } ? Layers
    : Options extends { readonly layers: infer Layers } ? Layers[keyof Layers]
    : never

  /**
   * @since 3.14.0
   * @category Service
   * @experimental
   */
  export type Success<Options> = Layers<Options> extends Layer.Layer<infer _A, infer _E, infer _R> ? _A : never

  /**
   * @since 3.14.0
   * @category Service
   * @experimental
   */
  export type Error<Options> = Layers<Options> extends Layer.Layer<infer _A, infer _E, infer _R> ? _E : never

  /**
   * @since 3.14.0
   * @category Service
   * @experimental
   */
  export type Services<Options> = Layers<Options> extends Layer.Layer<infer _A, infer _E, infer _R> ? _R : never
}
