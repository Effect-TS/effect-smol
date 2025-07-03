import type { Effect } from "../Effect.js"
import { dual } from "../Function.js"
import * as Layer from "../Layer.js"
import * as ServiceMap from "../ServiceMap.js"
import * as effect from "./effect.js"

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
    <const Layers extends [Layer.Layer.Any, ...Array<Layer.Layer.Any>]>(
      layers: Layers
    ): <A, E, R>(
      self: Effect<A, E, R>
    ) => Effect<
      A,
      E | Layer.Layer.Error<Layers[number]>,
      | Layer.Layer.Services<Layers[number]>
      | Exclude<R, Layer.Layer.Success<Layers[number]>>
    >
    <ROut, E2, RIn>(
      layer: Layer.Layer<ROut, E2, RIn>
    ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | E2, RIn | Exclude<R, ROut>>
    <R2>(services: ServiceMap.ServiceMap<R2>): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, R2>>
  },
  {
    <A, E, R, const Layers extends [Layer.Layer.Any, ...Array<Layer.Layer.Any>]>(
      self: Effect<A, E, R>,
      layers: Layers
    ): Effect<
      A,
      E | Layer.Layer.Error<Layers[number]>,
      | Layer.Layer.Services<Layers[number]>
      | Exclude<R, Layer.Layer.Success<Layers[number]>>
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
      | Array<Layer.Layer.Any>
  ): Effect<any, any, Exclude<R, ROut>> =>
    ServiceMap.isServiceMap(source)
      ? effect.provideServices(self, source)
      : provideLayer(self, Array.isArray(source) ? Layer.mergeAll(...source as any) : source)
)
