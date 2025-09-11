import { dual } from "../data/Function.ts"
import type { Effect } from "../Effect.ts"
import * as Layer from "../Layer.ts"
import * as ServiceMap from "../ServiceMap.ts"
import * as effect from "./effect.ts"

const provideLayer = <A, E, R, ROut, E2, RIn>(
  self: Effect<A, E, R>,
  layer: Layer.Layer<ROut, E2, RIn>
): Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
  effect.scopedWith((scope) =>
    effect.flatMap(
      Layer.buildWithScope(layer, scope),
      (context) => effect.provideServices(self, context)
    )
  )

/** @internal */
export const provide = dual<
  {
    <const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
      layers: Layers
    ): <A, E, R>(
      self: Effect<A, E, R>
    ) => Effect<
      A,
      E | Layer.Error<Layers[number]>,
      | Layer.Services<Layers[number]>
      | Exclude<R, Layer.Success<Layers[number]>>
    >
    <ROut, E2, RIn>(
      layer: Layer.Layer<ROut, E2, RIn>
    ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | E2, RIn | Exclude<R, ROut>>
    <R2>(services: ServiceMap.ServiceMap<R2>): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, R2>>
  },
  {
    <A, E, R, const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
      self: Effect<A, E, R>,
      layers: Layers
    ): Effect<
      A,
      E | Layer.Error<Layers[number]>,
      | Layer.Services<Layers[number]>
      | Exclude<R, Layer.Success<Layers[number]>>
    >
    <A, E, R, ROut, E2, RIn>(
      self: Effect<A, E, R>,
      layer: Layer.Layer<ROut, E2, RIn>
    ): Effect<A, E | E2, RIn | Exclude<R, ROut>>
    <A, E, R, R2>(
      self: Effect<A, E, R>,
      services: ServiceMap.ServiceMap<R2>
    ): Effect<A, E, Exclude<R, R2>>
  }
>(
  2,
  <A, E, R, ROut>(
    self: Effect<A, E, R>,
    source:
      | Layer.Layer<ROut, any, any>
      | ServiceMap.ServiceMap<ROut>
      | Array<Layer.Any>
  ): Effect<any, any, Exclude<R, ROut>> =>
    ServiceMap.isServiceMap(source)
      ? effect.provideServices(self, source)
      : provideLayer(self, Array.isArray(source) ? Layer.mergeAll(...source as any) : source)
)
