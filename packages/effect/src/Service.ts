import type * as EffectTypes from "./Effect.ts"
import * as Effect from "./Effect.ts"
import { isEffect } from "./internal/core.ts"
import * as Layer from "./Layer.ts"
import type { Scope } from "./Scope.ts"
import * as ServiceMap from "./ServiceMap.ts"
import type * as Types from "./types/Types.ts"

/**
 * Extracts the Effect type from a make function or Effect value.
 *
 * @since 4.0.0
 * @category Internal
 */
type MakeEffect<Make> = Make extends (...args: Array<any>) => EffectTypes.Effect<any, any, any> ? ReturnType<Make>
  : Make

/**
 * Extracts the argument types from a make function.
 *
 * @since 4.0.0
 * @category Internal
 */
type MakeArgs<Make> = Make extends (...args: infer Args) => EffectTypes.Effect<any, any, any> ? Args : never

/**
 * Extracts the combined service requirements from dependency layers.
 *
 * @since 4.0.0
 * @category Internal
 */
type DepsContext<Deps extends ReadonlyArray<Layer.Layer<any, any, any>> | undefined> = Deps extends
  ReadonlyArray<Layer.Layer<any, any, any>> ? Layer.Services<Deps[number]>
  : never

/**
 * Lifts a value, Promise, or Effect into an Effect type.
 *
 * @since 4.0.0
 * @category Internal
 */
type LiftToEffect<X> = X extends EffectTypes.Effect<infer A, infer E, infer R> ? EffectTypes.Effect<A, E, R>
  : X extends Promise<infer A> ? EffectTypes.Effect<A, unknown>
  : EffectTypes.Effect<X, never>

/**
 * Layer type without dependencies - requires what make effect requires (excluding Scope).
 *
 * @since 4.0.0
 * @category Internal
 */
type LayerShapeNoDeps<Self, Eff> = Layer.Layer<
  Self,
  EffectTypes.Error<Eff>,
  Exclude<EffectTypes.Services<Eff>, Scope>
>

/**
 * Layer type with dependencies - requires only what dependency layers require.
 *
 * @since 4.0.0
 * @category Internal
 */
type LayerShapeWithDeps<Self, Eff, DepsReq> = Layer.Layer<Self, EffectTypes.Error<Eff>, DepsReq>

/**
 * Converts an optional dependency array to a non-empty tuple type.
 *
 * @since 4.0.0
 * @category Internal
 */
type NonEmptyDeps<Deps extends ReadonlyArray<Layer.Layer<any, any, any>> | undefined> = Deps extends
  ReadonlyArray<infer L> ? readonly [L, ...Array<L>] : never

/**
 * Generates the layer type from make function, handling both factory and value cases.
 *
 * @since 4.0.0
 * @category Internal
 */
type LayerFromMake<Self, Make, Deps extends ReadonlyArray<Layer.Layer<any, any, any>> | undefined> = Deps extends
  undefined ? ([MakeArgs<Make>] extends [never] ? LayerShapeNoDeps<Self, MakeEffect<Make>>
      : (...args: MakeArgs<Make>) => LayerShapeNoDeps<Self, MakeEffect<Make>>)
  : ([MakeArgs<Make>] extends [never] ? LayerShapeWithDeps<Self, MakeEffect<Make>, DepsContext<Deps>>
    : (...args: MakeArgs<Make>) => LayerShapeWithDeps<Self, MakeEffect<Make>, DepsContext<Deps>>)

/**
 * Layer type ignoring dependencies - always requires what make effect requires.
 *
 * @since 4.0.0
 * @category Internal
 */
type LayerWithoutDepsFromMake<Self, Make> = [MakeArgs<Make>] extends [never] ? LayerShapeNoDeps<Self, MakeEffect<Make>>
  : (...args: MakeArgs<Make>) => LayerShapeNoDeps<Self, MakeEffect<Make>>

// Type guard to check if a value is a Promise.
const isPromise = (u: unknown): u is Promise<unknown> =>
  typeof u === "object" && u !== null && "then" in u && typeof (u as any).then === "function"

// Builds the `use` helper for a service, allowing callback-based access.
const buildUse = (service: any) => {
  return <X>(f: (svc: any) => X): EffectTypes.Effect<any, any, any> =>
    Effect.gen(function*() {
      const svc = yield* service
      const result = f(svc)
      if (isEffect(result)) {
        return yield* result
      }
      if (isPromise(result)) {
        return yield* Effect.promise(() => result)
      }
      return result
    })
}

// Builds the `layer` or `layerWithoutDependencies`, handling factories and dependency provision.
const buildLayer = (
  service: any,
  make: EffectTypes.Effect<any, any, any> | ((...args: Array<any>) => EffectTypes.Effect<any, any, any>),
  dependencies?: ReadonlyArray<Layer.Layer<any, any, any>>
) => {
  const isFactory = typeof make === "function"
  const depsLayer = dependencies && dependencies.length > 0
    ? Layer.mergeAll(...(dependencies as NonEmptyDeps<typeof dependencies>))
    : undefined

  const base = (...args: Array<any>) => {
    const eff = isFactory ? (make as any)(...args) : make
    return Layer.effect(service, eff)
  }

  return depsLayer
    ? isFactory
      ? (...args: Array<any>) => Layer.provide(base(...args), depsLayer)
      : Layer.provide(base(), depsLayer)
    : isFactory
    ? (...args: Array<any>) => base(...args)
    : base()
}

/**
 * Extended ServiceClass with layer helpers for services with `make`.
 *
 * Provides:
 * - `make`: The effect or factory function to create the service
 * - `use`: Callback-based service access
 * - `layer`: Layer constructor respecting dependencies
 * - `layerWithoutDependencies`: Layer constructor ignoring dependencies (only when deps provided)
 *
 * @since 4.0.0
 * @category Models
 */
export type ServiceWithMake<
  Self,
  Id extends string,
  Shape,
  Make extends EffectTypes.Effect<any, any, any> | ((...args: any) => EffectTypes.Effect<any, any, any>),
  Deps extends ReadonlyArray<Layer.Layer<any, any, any>> | undefined
> = ServiceMap.ServiceClass<Self, Id, Shape> & {
  readonly make: Make
  readonly use: <X>(f: (svc: Shape) => X) => LiftToEffect<X>
  readonly layer: LayerFromMake<Self, Make, Deps>
  readonly layerWithoutDependencies: Deps extends undefined ? never : LayerWithoutDepsFromMake<Self, Make>
}

/**
 * Creates a service with layer helpers when `make` is provided.
 *
 * @example
 * ```ts
 * import { Service, Effect } from "effect"
 *
 * class Logger extends Service<Logger>()("Logger", {
 *   make: Effect.sync(() => ({ log: (msg: string) => console.log(msg) }))
 * }) {}
 *
 * // Use Logger.layer, Logger.use, etc.
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export type ServiceConstructor = {
  // Plain tag (no make)
  <Identifier, Shape = Identifier>(key: string): ServiceMap.Service<Identifier, Shape>
  // Curried with explicit Shape; make optional
  <Self, Shape>(): <
    const Identifier extends string,
    E,
    R = Types.unassigned,
    Args extends ReadonlyArray<any> = never,
    Deps extends ReadonlyArray<Layer.Layer<any, any, any>> | undefined = undefined
  >(
    id: Identifier,
    options?: {
      readonly make?: ((...args: Args) => EffectTypes.Effect<Shape, E, R>) | EffectTypes.Effect<Shape, E, R> | undefined
      readonly dependencies?: Deps
    } | undefined
  ) => [Types.unassigned] extends [R] ? ServiceMap.ServiceClass<Self, Identifier, Shape>
    : ServiceWithMake<
      Self,
      Identifier,
      Shape,
      [Args] extends [never] ? EffectTypes.Effect<Shape, E, R> : (...args: Args) => EffectTypes.Effect<Shape, E, R>,
      Deps
    >
  // Curried with inferred Shape; make required
  <Self>(): <
    const Identifier extends string,
    Make extends EffectTypes.Effect<any, any, any> | ((...args: any) => EffectTypes.Effect<any, any, any>),
    Deps extends ReadonlyArray<Layer.Layer<any, any, any>> | undefined = undefined
  >(
    id: Identifier,
    options: {
      readonly make: Make
      readonly dependencies?: Deps
    }
  ) => ServiceWithMake<
    Self,
    Identifier,
    Make extends
      | EffectTypes.Effect<infer _A, infer _E, infer _R>
      | ((...args: infer _Args) => EffectTypes.Effect<infer _A, infer _E, infer _R>) ? _A
      : never,
    Make,
    Deps
  >
}

const ServiceImpl = (...args: Array<any>) => {
  if (args.length === 0) {
    const baseService = ServiceMap.Service()

    return function(key: string, options?: {
      readonly make?: any
      readonly dependencies?: ReadonlyArray<Layer.Layer<any, any, any>>
    }) {
      const service = options?.make
        ? baseService(key, { make: options.make })
        : baseService(key)

      if (options?.make) {
        const deps = options.dependencies
        type Self = typeof service
        type Make = typeof options.make
        type Deps = typeof deps

        const svc = service as Types.Mutable<
          & ServiceMap.ServiceClass<Self, typeof service.key, typeof service.Service>
          & Partial<ServiceWithMake<Self, typeof service.key, typeof service.Service, Make, Deps>>
        >

        svc.layer = buildLayer(svc, options.make, deps) as LayerFromMake<Self, Make, Deps>
        if (deps && deps.length > 0) {
          svc.layerWithoutDependencies = buildLayer(svc, options.make) as LayerWithoutDepsFromMake<Self, Make>
        }
        svc.use = buildUse(svc) as ServiceWithMake<Self, typeof service.key, typeof service.Service, Make, Deps>["use"]
      }

      return service
    }
  }

  return (ServiceMap.Service as (...fnArgs: Array<any>) => any)(...args)
}

/**
 * Layer-aware service constructor. Use this when providing `make` to get
 * automatic `layer`, `layerWithoutDependencies`, and `use` helpers.
 *
 * @example
 * ```ts
 * import { Service, Effect } from "effect"
 *
 * class Logger extends Service<Logger>()("Logger", {
 *   make: Effect.sync(() => ({ log: (msg: string) => console.log(msg) }))
 * }) {}
 *
 * // Use Logger.layer, Logger.use, etc.
 * ```
 *
 * @since 4.0.0
 */
export const Service = ServiceImpl as ServiceConstructor

/**
 * Alias to the underlying service tag type.
 *
 * @since 4.0.0
 */
export type ServiceTag<Identifier, Shape = Identifier> = ServiceMap.Service<Identifier, Shape>

/**
 * Alias to the underlying service class type.
 *
 * @since 4.0.0
 */
export type ServiceClass<Self, Identifier extends string, Shape> = ServiceMap.ServiceClass<Self, Identifier, Shape>
