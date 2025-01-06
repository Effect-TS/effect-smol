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
import type * as Cause from "./Cause.js"
import * as Context from "./Context.js"
import * as Deferred from "./Deferred.js"
import type { Effect } from "./Effect.js"
import type * as Exit from "./Exit.js"
import type { LazyArg } from "./Function.js"
import { constant, dual, identity } from "./Function.js"
import * as core from "./internal/core.js"
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
  build(memoMap: MemoMap, scope: Scope.Scope): Effect<Context.Context<ROut>, E, RIn>
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
  export type Context<T extends Any> = T extends Layer<infer _ROut, infer _E, infer _RIn> ? _RIn : never
  /**
   * @since 2.0.0
   * @category type-level
   */
  export type Error<T extends Any> = T extends Layer<infer _ROut, infer _E, infer _RIn> ? _E : never
  /**
   * @since 2.0.0
   * @category type-level
   */
  export type Success<T extends Any> = T extends Layer<infer _ROut, infer _E, infer _RIn> ? _ROut : never
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
    build: (memoMap: MemoMap, scope: Scope.Scope) => Effect<Context.Context<ROut>, E, RIn>
  ) => Effect<Context.Context<ROut>, E, RIn>
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

const fromBuildUnsafe = <ROut, E, RIn>(
  build: (
    memoMap: MemoMap,
    scope: Scope.Scope
  ) => Effect<Context.Context<ROut>, E, RIn>
): Layer<ROut, E, RIn> => {
  const self = Object.create(LayerProto)
  self.build = build
  return self
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromBuild = <ROut, E, RIn>(
  build: (
    memoMap: MemoMap,
    scope: Scope.Scope
  ) => Effect<Context.Context<ROut>, E, RIn>
): Layer<ROut, E, RIn> =>
  fromBuildUnsafe((memoMap: MemoMap, scope: Scope.Scope) =>
    core.flatMap(scope.fork, (scope) =>
      core.onExit(
        build(memoMap, scope),
        (exit) => exit._tag === "Failure" ? scope.close(exit) : core.void
      ))
  )

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromBuildMemo = <ROut, E, RIn>(
  build: (
    memoMap: MemoMap,
    scope: Scope.Scope
  ) => Effect<Context.Context<ROut>, E, RIn>
): Layer<ROut, E, RIn> => {
  const self: Layer<ROut, E, RIn> = fromBuild((memoMap, scope) => memoMap.getOrElseMemoize(self, scope, build))
  return self
}

class MemoMapImpl implements MemoMap {
  readonly [MemoMapTypeId]!: MemoMapTypeId
  static {
    // @ts-expect-error
    this.prototype[MemoMapTypeId] = MemoMapTypeId
  }
  readonly map = new Map<Layer<any, any, any>, {
    observers: number
    effect: Effect<Context.Context<any>, any>
    readonly finalizer: (exit: Exit.Exit<unknown, unknown>) => Effect<void>
  }>()

  getOrElseMemoize<RIn, E, ROut>(
    layer: Layer<ROut, E, RIn>,
    scope: Scope.Scope,
    build: (memoMap: MemoMap, scope: Scope.Scope) => Effect<Context.Context<ROut>, E, RIn>
  ): Effect<Context.Context<ROut>, E, RIn> {
    if (this.map.has(layer)) {
      const entry = this.map.get(layer)!
      entry.observers++
      return core.andThen(
        scope.addFinalizer((exit) => entry.finalizer(exit)),
        entry.effect
      )
    }
    const layerScope = Scope.unsafeMake()
    const deferred = Deferred.unsafeMake<Context.Context<ROut>, E>()
    const entry = {
      observers: 1,
      effect: Deferred.await(deferred),
      finalizer: (exit: Exit.Exit<unknown, unknown>) =>
        core.suspend(() => {
          entry.observers--
          if (entry.observers === 0) {
            this.map.delete(layer)
            return layerScope.close(exit)
          }
          return core.void
        })
    }
    this.map.set(layer, entry)
    return scope.addFinalizer(entry.finalizer).pipe(
      core.flatMap(() => build(this, layerScope)),
      core.onExit((exit) => {
        entry.effect = exit
        return Deferred.done(deferred, exit)
      })
    )
  }
}

/**
 * Constructs a `MemoMap` that can be used to build additional layers.
 *
 * @since 4.0.0
 * @category memo map
 */
export const unsafeMakeMemoMap = (): MemoMap => new MemoMapImpl()

/**
 * Constructs a `MemoMap` that can be used to build additional layers.
 *
 * @since 2.0.0
 * @category memo map
 */
export const makeMemoMap: Effect<MemoMap> = core.sync(unsafeMakeMemoMap)

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
  ): <RIn, E, ROut>(self: Layer<ROut, E, RIn>) => Effect<Context.Context<ROut>, E, RIn>
  <RIn, E, ROut>(
    self: Layer<ROut, E, RIn>,
    memoMap: MemoMap,
    scope: Scope.Scope
  ): Effect<Context.Context<ROut>, E, RIn>
} = dual(3, <RIn, E, ROut>(
  self: Layer<ROut, E, RIn>,
  memoMap: MemoMap,
  scope: Scope.Scope
): Effect<Context.Context<ROut>, E, RIn> => self.build(memoMap, scope))

/**
 * Builds a layer into a scoped value.
 *
 * @since 2.0.0
 * @category destructors
 */
export const build = <RIn, E, ROut>(
  self: Layer<ROut, E, RIn>
): Effect<Context.Context<ROut>, E, Scope.Scope | RIn> =>
  core.flatMap(core.scope, (scope) => self.build(unsafeMakeMemoMap(), scope))

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
  (scope: Scope.Scope): <RIn, E, ROut>(self: Layer<ROut, E, RIn>) => Effect<Context.Context<ROut>, E, RIn>
  <RIn, E, ROut>(self: Layer<ROut, E, RIn>, scope: Scope.Scope): Effect<Context.Context<ROut>, E, RIn>
} = dual(2, <RIn, E, ROut>(
  self: Layer<ROut, E, RIn>,
  scope: Scope.Scope
): Effect<Context.Context<ROut>, E, RIn> => core.suspend(() => self.build(unsafeMakeMemoMap(), scope)))

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
export const succeedContext = <A>(context: Context.Context<A>): Layer<A> =>
  fromBuildUnsafe(constant(core.succeed(context)))

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
): Layer<Context.Tag.Identifier<T>> => syncContext(() => Context.make(tag, evaluate())))

/**
 * Lazily constructs a layer from the specified value, which must return one or more
 * services.
 *
 * @since 2.0.0
 * @category constructors
 */
export const syncContext = <A>(evaluate: LazyArg<Context.Context<A>>): Layer<A> =>
  fromBuildUnsafe(constant(core.sync(evaluate)))

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
    effect: Effect<Context.Tag.Service<T>, E, R>
  ) => Layer<Context.Tag.Identifier<T>, E, Exclude<R, Scope.Scope>>
  <T extends Context.Tag<any, any>, E, R>(
    tag: T,
    effect: Effect<Context.Tag.Service<T>, E, R>
  ): Layer<Context.Tag.Identifier<T>, E, Exclude<R, Scope.Scope>>
} = dual(2, <T extends Context.Tag<any, any>, E, R>(
  tag: T,
  effect: Effect<Context.Tag.Service<T>, E, R>
): Layer<Context.Tag.Identifier<T>, E, Exclude<R, Scope.Scope>> =>
  effectContext(core.map(effect, (value) => Context.make(tag, value))))

/**
 * Constructs a layer from the specified scoped effect, which must return one
 * or more services.
 *
 * @since 2.0.0
 * @category constructors
 */
export const effectContext = <A, E, R>(
  effect: Effect<Context.Context<A>, E, R>
): Layer<A, E, Exclude<R, Scope.Scope>> => fromBuildMemo((_, scope) => Scope.provide(effect, scope))

/**
 * Constructs a layer from the specified scoped effect.
 *
 * @since 2.0.0
 * @category constructors
 */
export const effectDiscard = <X, E, R>(effect: Effect<X, E, R>): Layer<never, E, Exclude<R, Scope.Scope>> =>
  effectContext(core.as(effect, Context.empty()))

/**
 * @since 4.0.0
 * @category utils
 */
export const unwrap = <A, E1, R1, E, R>(
  self: Effect<Layer<A, E1, R1>, E, R>
): Layer<A, E | E1, R1 | Exclude<R, Scope.Scope>> => {
  const tag = Context.GenericTag<Layer<A, E1, R1>>("effect/Layer/unwrap")
  return flatMap(effect(tag, self), Context.get(tag))
}

const mergeAllEffect = <Layers extends [Layer<never, any, any>, ...Array<Layer<never, any, any>>]>(
  layers: Layers,
  memoMap: MemoMap,
  scope: Scope.Scope
): Effect<
  Context.Context<{ [k in keyof Layers]: Layer.Success<Layers[k]> }[number]>,
  { [k in keyof Layers]: Layer.Error<Layers[k]> }[number],
  { [k in keyof Layers]: Layer.Context<Layers[k]> }[number]
> =>
  core.forEach(layers, (layer) => layer.build(memoMap, scope), { concurrency: layers.length }).pipe(
    core.map((contexts) => {
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
  Layer.Success<Layers[number]>,
  Layer.Error<Layers[number]>,
  Layer.Context<Layers[number]>
> => fromBuild((memoMap, scope) => mergeAllEffect(layers, memoMap, scope))

/**
 * Merges this layer with the specified layer concurrently, producing a new layer with combined input and output types.
 *
 * @since 2.0.0
 * @category zipping
 */
export const merge: {
  <RIn, E, ROut>(
    that: Layer<ROut, E, RIn>
  ): <RIn2, E2, ROut2>(self: Layer<ROut2, E2, RIn2>) => Layer<ROut | ROut2, E | E2, RIn | RIn2>
  <const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
    that: Layers
  ): <A, E, R>(
    self: Layer<A, E, R>
  ) => Layer<
    A | Layer.Success<Layers[number]>,
    E | Layer.Error<Layers[number]>,
    | Layer.Context<Layers[number]>
    | R
  >
  <RIn2, E2, ROut2, RIn, E, ROut>(
    self: Layer<ROut2, E2, RIn2>,
    that: Layer<ROut, E, RIn>
  ): Layer<ROut | ROut2, E | E2, RIn | RIn2>
  <A, E, R, const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
    self: Layer<A, E, R>,
    that: Layers
  ): Layer<
    A | Layer.Success<Layers[number]>,
    E | Layer.Error<Layers[number]>,
    | Layer.Context<Layers[number]>
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
    selfContext: Context.Context<any>,
    thatContext: Context.Context<any>
  ) => Context.Context<any>
) =>
  fromBuild((memoMap, scope) =>
    core.flatMap(
      Array.isArray(that)
        ? mergeAllEffect(that as NonEmptyArray<Layer<any, any, any>>, memoMap, scope)
        : (that as Layer<any, any, any>).build(memoMap, scope),
      (context) =>
        self.build(memoMap, scope).pipe(
          core.provideContext(context),
          core.map((merged) => f(merged, context))
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
    E | Layer.Error<Layers[number]>,
    | Layer.Context<Layers[number]>
    | Exclude<R, Layer.Success<Layers[number]>>
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
    E | Layer.Error<Layers[number]>,
    | Layer.Context<Layers[number]>
    | Exclude<R, Layer.Success<Layers[number]>>
  >
} = dual(2, (
  self: Layer<any, any, any>,
  that: Layer<any, any, any> | ReadonlyArray<Layer<any, any, any>>
) => provideWith(self, that, (context) => context))

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
    that: Layer<ROut, E, RIn>
  ): <RIn2, E2, ROut2>(self: Layer<ROut2, E2, RIn2>) => Layer<ROut | ROut2, E | E2, RIn | Exclude<RIn2, ROut>>
  <const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
    that: Layers
  ): <A, E, R>(
    self: Layer<A, E, R>
  ) => Layer<
    A | Layer.Success<Layers[number]>,
    E | Layer.Error<Layers[number]>,
    | Layer.Context<Layers[number]>
    | Exclude<R, Layer.Success<Layers[number]>>
  >
  <RIn2, E2, ROut2, RIn, E, ROut>(
    self: Layer<ROut2, E2, RIn2>,
    that: Layer<ROut, E, RIn>
  ): Layer<ROut | ROut2, E | E2, RIn | Exclude<RIn2, ROut>>
  <A, E, R, const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
    self: Layer<A, E, R>,
    that: Layers
  ): Layer<
    A | Layer.Success<Layers[number]>,
    E | Layer.Error<Layers[number]>,
    | Layer.Context<Layers[number]>
    | Exclude<R, Layer.Success<Layers[number]>>
  >
} = dual(2, (
  self: Layer<any, any, any>,
  that: Layer<any, any, any> | ReadonlyArray<Layer<any, any, any>>
) =>
  provideWith(
    self,
    that,
    (selfContext, thatContext) => Context.merge(thatContext, selfContext)
  ))

/**
 * Constructs a layer dynamically based on the output of this layer.
 *
 * @since 2.0.0
 * @category sequencing
 */
export const flatMap: {
  <A, A2, E2, R2>(
    f: (context: Context.Context<A>) => Layer<A2, E2, R2>
  ): <E, R>(self: Layer<A, E, R>) => Layer<A2, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Layer<A, E, R>,
    f: (context: Context.Context<A>) => Layer<A2, E2, R2>
  ): Layer<A2, E | E2, R | R2>
} = dual(2, <A, E, R, A2, E2, R2>(
  self: Layer<A, E, R>,
  f: (context: Context.Context<A>) => Layer<A2, E2, R2>
): Layer<A2, E | E2, R | R2> =>
  fromBuild((memoMap, scope) =>
    core.flatMap(
      self.build(memoMap, scope),
      (context) => f(context).build(memoMap, scope)
    )
  ))

/**
 * Translates effect failure into death of the fiber, making all failures
 * unchecked and not a part of the type of the layer.
 *
 * @since 2.0.0
 * @category error handling
 */
export const orDie = <A, E, R>(self: Layer<A, E, R>): Layer<A, never, R> =>
  fromBuildUnsafe((memoMap, scope) => core.orDie(self.build(memoMap, scope)))

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
    core.catch_(
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
    core.catchCause(
      self.build(memoMap, scope),
      (cause) => onError(cause).build(memoMap, scope)
    ) as any
  ))

/**
 * Creates a fresh version of this layer that will not be shared.
 *
 * @since 2.0.0
 * @category utils
 */
export const fresh = <A, E, R>(self: Layer<A, E, R>): Layer<A, E, R> =>
  fromBuildUnsafe((_, scope) => self.build(unsafeMakeMemoMap(), scope))

/**
 * Builds this layer and uses it until it is interrupted. This is useful when
 * your entire application is a layer, such as an HTTP server.
 *
 * @since 2.0.0
 * @category conversions
 */
export const launch = <RIn, E, ROut>(self: Layer<ROut, E, RIn>): Effect<never, E, RIn> =>
  core.scoped(core.andThen(build(self), core.never))
