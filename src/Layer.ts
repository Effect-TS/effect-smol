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
import type { NonEmptyArray } from "./Array.js"
import * as Context from "./Context.js"
import * as Deferred from "./Deferred.js"
import * as Effect from "./Effect.js"
import type { LazyArg } from "./Function.js"
import { constant, dual, identity } from "./Function.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import * as Scope from "./Scope.js"
import type * as Types from "./Types.js"

/**
 * @since 2.0.0
 * @category symbols
 */
export const LayerTypeId: unique symbol = Symbol.for("effect/Layer")

/**
 * @since 2.0.0
 * @category symbols
 */
export type LayerTypeId = typeof LayerTypeId

/**
 * @since 2.0.0
 * @category models
 */
export interface Layer<in ROut, out E = never, out RIn = never> extends Layer.Variance<ROut, E, RIn>, Pipeable {
  /** @internal */
  build(memoMap: MemoMap, scope: Scope.Scope): Effect.Effect<Context.Context<ROut>, E, RIn>
}

/**
 * @since 2.0.0
 */
export declare namespace Layer {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<in ROut, out E, out RIn> {
    readonly [LayerTypeId]: {
      readonly _ROut: Types.Contravariant<ROut>
      readonly _E: Types.Covariant<E>
      readonly _RIn: Types.Covariant<RIn>
    }
  }
  /**
   * @since 3.9.0
   * @category type-level
   */
  export interface Any {
    readonly [LayerTypeId]: {
      readonly _ROut: any
      readonly _E: any
      readonly _RIn: any
    }
  }
  /**
   * @since 2.0.0
   * @category type-level
   */
  export type Context<T extends Any> = [T] extends [Layer<infer _ROut, infer _E, infer _RIn>] ? _RIn
    : never
  /**
   * @since 2.0.0
   * @category type-level
   */
  export type Error<T extends Any> = [T] extends [Layer<infer _ROut, infer _E, infer _RIn>] ? _E
    : never
  /**
   * @since 2.0.0
   * @category type-level
   */
  export type Success<T extends Any> = [T] extends [Layer<infer _ROut, infer _E, infer _RIn>] ? _ROut
    : never
}

/**
 * @since 2.0.0
 * @category symbols
 */
export const MemoMapTypeId: unique symbol = Symbol.for("effect/Layer/MemoMap")

/**
 * @since 2.0.0
 * @category symbols
 */
export type MemoMapTypeId = typeof MemoMapTypeId

/**
 * @since 2.0.0
 * @category models
 */
export interface MemoMap {
  readonly [MemoMapTypeId]: MemoMapTypeId
  readonly getOrElseMemoize: <RIn, E, ROut>(
    layer: Layer<ROut, E, RIn>,
    scope: Scope.Scope,
    build: (memoMap: MemoMap, scope: Scope.Scope) => Effect.Effect<Context.Context<ROut>, E, RIn>
  ) => Effect.Effect<Context.Context<ROut>, E, RIn>
}

/**
 * Returns `true` if the specified value is a `Layer`, `false` otherwise.
 *
 * @since 2.0.0
 * @category getters
 */
export const isLayer = (u: unknown): u is Layer<unknown, unknown, unknown> => hasProperty(u, LayerTypeId)

const LayerProto = {
  [LayerTypeId]: {
    _ROut: identity,
    _E: identity,
    _RIn: identity
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromBuild = <ROut, E, RIn>(
  build: (
    this: Layer<ROut, E, RIn>,
    memoMap: MemoMap,
    scope: Scope.Scope
  ) => Effect.Effect<Context.Context<ROut>, E, RIn>
): Layer<ROut, E, RIn> => {
  const self = Object.create(LayerProto)
  self.build = build
  return self
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromBuildMemo = <ROut, E, RIn>(
  build: (scope: Scope.Scope, memoMap: MemoMap) => Effect.Effect<Context.Context<ROut>, E, RIn>
): Layer<ROut, E, RIn> =>
  fromBuild(function(memoMap, scope) {
    return memoMap.getOrElseMemoize(this, scope, (memoMap, scope) => build(scope, memoMap))
  })

class MemoMapImpl implements MemoMap {
  readonly [MemoMapTypeId]!: MemoMapTypeId
  static {
    // @ts-expect-error
    this.prototype[MemoMapTypeId] = MemoMapTypeId
  }
  readonly map = new Map<Layer<any, any, any>, Effect.Effect<Context.Context<any>, any, any>>()

  getOrElseMemoize<RIn, E, ROut>(
    layer: Layer<ROut, E, RIn>,
    scope: Scope.Scope,
    build: (memoMap: MemoMap, scope: Scope.Scope) => Effect.Effect<Context.Context<ROut>, E, RIn>
  ): Effect.Effect<Context.Context<ROut>, E, RIn> {
    if (this.map.has(layer)) {
      return this.map.get(layer) as Effect.Effect<Context.Context<ROut>, E, RIn>
    }
    const deferred = Deferred.unsafeMake<Context.Context<ROut>, E>()
    this.map.set(layer, Deferred.await(deferred))
    return build(this, scope).pipe(
      Effect.onExit((exit) => {
        this.map.set(layer, exit)
        return Deferred.done(deferred, exit)
      })
    )
  }
}

/**
 * Constructs a `MemoMap` that can be used to build additional layers.
 *
 * @since 2.0.0
 * @category memo map
 */
export const unsafeMakeMemoMap = (): MemoMap => new MemoMapImpl()

/**
 * Builds a layer into an `Effect` value, using the specified `MemoMap` to memoize
 * the layer construction.
 *
 * @since 2.0.0
 * @category memo map
 */
export const buildWithMemoMap: {
  (
    memoMap: MemoMap,
    scope: Scope.Scope
  ): <RIn, E, ROut>(self: Layer<ROut, E, RIn>) => Effect.Effect<Context.Context<ROut>, E, RIn>
  <RIn, E, ROut>(
    self: Layer<ROut, E, RIn>,
    memoMap: MemoMap,
    scope: Scope.Scope
  ): Effect.Effect<Context.Context<ROut>, E, RIn>
} = dual(3, <RIn, E, ROut>(
  self: Layer<ROut, E, RIn>,
  memoMap: MemoMap,
  scope: Scope.Scope
): Effect.Effect<Context.Context<ROut>, E, RIn> => self.build(memoMap, scope))

/**
 * Builds a layer into a scoped value.
 *
 * @since 2.0.0
 * @category destructors
 */
export const build = <RIn, E, ROut>(
  self: Layer<ROut, E, RIn>
): Effect.Effect<Context.Context<ROut>, E, Scope.Scope | RIn> =>
  Effect.flatMap(Effect.scope, (scope) => self.build(unsafeMakeMemoMap(), scope))

/**
 * Builds a layer into an `Effect` value. Any resources associated with this
 * layer will be released when the specified scope is closed unless their scope
 * has been extended. This allows building layers where the lifetime of some of
 * the services output by the layer exceed the lifetime of the effect the
 * layer is provided to.
 *
 * @since 2.0.0
 * @category destructors
 */
export const buildWithScope: {
  (scope: Scope.Scope): <RIn, E, ROut>(self: Layer<ROut, E, RIn>) => Effect.Effect<Context.Context<ROut>, E, RIn>
  <RIn, E, ROut>(self: Layer<ROut, E, RIn>, scope: Scope.Scope): Effect.Effect<Context.Context<ROut>, E, RIn>
} = dual(2, <RIn, E, ROut>(
  self: Layer<ROut, E, RIn>,
  scope: Scope.Scope
): Effect.Effect<Context.Context<ROut>, E, RIn> => Effect.suspend(() => self.build(unsafeMakeMemoMap(), scope)))

/**
 * Constructs a layer from the specified value.
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeed: {
  <T extends Context.Tag<any, any>>(
    tag: T
  ): (resource: Context.Tag.Service<T>) => Layer<Context.Tag.Identifier<T>>
  <T extends Context.Tag<any, any>>(
    tag: T,
    resource: Context.Tag.Service<T>
  ): Layer<Context.Tag.Identifier<T>>
} = dual(2, <T extends Context.Tag<any, any>>(
  tag: T,
  resource: Context.Tag.Service<T>
): Layer<Context.Tag.Identifier<T>> => succeedContext(Context.make(tag, resource)))

/**
 * Constructs a layer from the specified value, which must return one or more
 * services.
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeedContext = <A>(context: Context.Context<A>): Layer<A> => fromBuild(constant(Effect.succeed(context)))

/**
 * A Layer that constructs an empty Context.
 *
 * @since 2.0.0
 * @category constructors
 */
export const empty: Layer<never> = succeedContext(Context.empty())

/**
 * Lazily constructs a layer from the specified value.
 *
 * @since 2.0.0
 * @category constructors
 */
export const sync: {
  <T extends Context.Tag<any, any>>(
    tag: T
  ): (evaluate: LazyArg<Context.Tag.Service<T>>) => Layer<Context.Tag.Identifier<T>>
  <T extends Context.Tag<any, any>>(
    tag: T,
    evaluate: LazyArg<Context.Tag.Service<T>>
  ): Layer<Context.Tag.Identifier<T>>
} = dual(2, <T extends Context.Tag<any, any>>(
  tag: T,
  evaluate: LazyArg<Context.Tag.Service<T>>
): Layer<Context.Tag.Identifier<T>> => fromBuildMemo((_) => Effect.sync(() => Context.make(tag, evaluate()))))

/**
 * Constructs a layer from the specified scoped effect.
 *
 * @since 2.0.0
 * @category constructors
 */
export const effect: {
  <T extends Context.Tag<any, any>>(
    tag: T
  ): <E, R>(
    effect: Effect.Effect<Context.Tag.Service<T>, E, R>
  ) => Layer<Context.Tag.Identifier<T>, E, Exclude<R, Scope.Scope>>
  <T extends Context.Tag<any, any>, E, R>(
    tag: T,
    effect: Effect.Effect<Context.Tag.Service<T>, E, R>
  ): Layer<Context.Tag.Identifier<T>, E, Exclude<R, Scope.Scope>>
} = dual(2, <T extends Context.Tag<any, any>, E, R>(
  tag: T,
  effect: Effect.Effect<Context.Tag.Service<T>, E, R>
): Layer<Context.Tag.Identifier<T>, E, Exclude<R, Scope.Scope>> =>
  effectContext(Effect.map(effect, (value) => Context.make(tag, value))))

/**
 * Constructs a layer from the specified scoped effect, which must return one
 * or more services.
 *
 * @since 2.0.0
 * @category constructors
 */
export const effectContext = <A, E, R>(
  effect: Effect.Effect<Context.Context<A>, E, R>
): Layer<A, E, Exclude<R, Scope.Scope>> => fromBuildMemo((scope) => effect.pipe(Scope.provide(scope)))

/**
 * Constructs a layer from the specified scoped effect.
 *
 * @since 2.0.0
 * @category constructors
 */
export const effectDiscard = <X, E, R>(effect: Effect.Effect<X, E, R>): Layer<never, E, Exclude<R, Scope.Scope>> =>
  effectContext(Effect.as(effect, Context.empty()))

/**
 * @since 4.0.0
 * @category utils
 */
export const unwrap = <A, E1, R1, E, R>(
  self: Effect.Effect<Layer<A, E1, R1>, E, R>
): Layer<A, E | E1, R1 | Exclude<R, Scope.Scope>> =>
  fromBuildMemo((scope, memoMap) =>
    self.pipe(
      Scope.provide(scope),
      Effect.flatMap((layer) => layer.build(memoMap, scope))
    )
  )

const mergeAllEffect = <Layers extends [Layer<never, any, any>, ...Array<Layer<never, any, any>>]>(
  layers: Layers,
  memoMap: MemoMap,
  scope: Scope.Scope
): Effect.Effect<
  Context.Context<{ [k in keyof Layers]: Layer.Success<Layers[k]> }[number]>,
  { [k in keyof Layers]: Layer.Error<Layers[k]> }[number],
  { [k in keyof Layers]: Layer.Context<Layers[k]> }[number]
> =>
  Effect.forEach(layers, (layer) => layer.build(memoMap, scope), { concurrency: layers.length }).pipe(
    Effect.map((contexts) => {
      const map = new Map<string, any>()
      for (const context of contexts) {
        for (const [key, value] of context.unsafeMap) {
          map.set(key, value)
        }
      }
      return Context.unsafeMake(map)
    })
  )

/**
 * Combines all the provided layers concurrently, creating a new layer with merged input, error, and output types.
 *
 * @since 2.0.0
 * @category zipping
 */
export const mergeAll = <Layers extends [Layer<never, any, any>, ...Array<Layer<never, any, any>>]>(
  ...layers: Layers
): Layer<
  { [k in keyof Layers]: Layer.Success<Layers[k]> }[number],
  { [k in keyof Layers]: Layer.Error<Layers[k]> }[number],
  { [k in keyof Layers]: Layer.Context<Layers[k]> }[number]
> => fromBuildMemo((scope, memoMap) => mergeAllEffect(layers, memoMap, scope))

const provideWith = (
  self: Layer<any, any, any>,
  that: Layer<any, any, any> | ReadonlyArray<Layer<any, any, any>>,
  f: (
    effect: Effect.Effect<Context.Context<any>, any, any>,
    merged: Context.Context<any>
  ) => Effect.Effect<Context.Context<any>, any, any>
) =>
  fromBuildMemo((scope, memoMap) =>
    Effect.flatMap(
      Array.isArray(that)
        ? mergeAllEffect(that as NonEmptyArray<Layer<any, any, any>>, memoMap, scope)
        : (that as Layer<any, any, any>).build(memoMap, scope),
      (context) =>
        self.build(memoMap, scope).pipe(
          Effect.provideContext(context),
          (effect) => f(effect, context)
        )
    )
  )

/**
 * Feeds the output services of this builder into the input of the specified
 * builder, resulting in a new builder with the inputs of this builder as
 * well as any leftover inputs, and the outputs of the specified builder.
 *
 * @since 2.0.0
 * @category utils
 */
export const provide: {
  <RIn, E, ROut>(
    that: Layer<ROut, E, RIn>
  ): <RIn2, E2, ROut2>(self: Layer<ROut2, E2, RIn2>) => Layer<ROut2, E | E2, RIn | Exclude<RIn2, ROut>>
  <const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
    that: Layers
  ): <A, E, R>(
    self: Layer<A, E, R>
  ) => Layer<
    A,
    E | { [k in keyof Layers]: Layer.Error<Layers[k]> }[number],
    | { [k in keyof Layers]: Layer.Context<Layers[k]> }[number]
    | Exclude<R, { [k in keyof Layers]: Layer.Success<Layers[k]> }[number]>
  >
  <RIn2, E2, ROut2, RIn, E, ROut>(
    self: Layer<ROut2, E2, RIn2>,
    that: Layer<ROut, E, RIn>
  ): Layer<ROut2, E | E2, RIn | Exclude<RIn2, ROut>>
  <A, E, R, const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
    self: Layer<A, E, R>,
    that: Layers
  ): Layer<
    A,
    E | { [k in keyof Layers]: Layer.Error<Layers[k]> }[number],
    | { [k in keyof Layers]: Layer.Context<Layers[k]> }[number]
    | Exclude<R, { [k in keyof Layers]: Layer.Success<Layers[k]> }[number]>
  >
} = dual(2, (
  self: Layer<any, any, any>,
  that: Layer<any, any, any> | ReadonlyArray<Layer<any, any, any>>
) => provideWith(self, that, (effect, _context) => effect))

/**
 * Feeds the output services of this layer into the input of the specified
 * layer, resulting in a new layer with the inputs of this layer, and the
 * outputs of both layers.
 *
 * @since 2.0.0
 * @category utils
 */
export const provideMerge: {
  <RIn, E, ROut>(
    self: Layer<ROut, E, RIn>
  ): <RIn2, E2, ROut2>(that: Layer<ROut2, E2, RIn2>) => Layer<ROut | ROut2, E | E2, RIn | Exclude<RIn2, ROut>>
  <RIn2, E2, ROut2, RIn, E, ROut>(
    that: Layer<ROut2, E2, RIn2>,
    self: Layer<ROut, E, RIn>
  ): Layer<ROut2 | ROut, E2 | E, RIn | Exclude<RIn2, ROut>>
} = dual(2, <RIn, E, ROut>(
  self: Layer<ROut, E, RIn>,
  that: Layer<any, any, any>
): Layer<ROut | Layer.Success<typeof that>, E | Layer.Error<typeof that>, RIn | Layer.Context<typeof that>> =>
  provideWith(self, that, (effect, merged) => Effect.map(effect, (context) => Context.merge(merged, context))))
