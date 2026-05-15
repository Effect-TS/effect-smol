/**
 * @since 1.0.0
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import type { HttpClient } from "effect/unstable/http/HttpClient"

/**
 * @category services
 * @since 1.0.0
 */
export class OpenRouterConfig extends Context.Service<
  OpenRouterConfig,
  OpenRouterConfig.Service
>()("@effect/ai-openrouter/OpenRouterConfig") {
  /**
   * @since 1.0.0
   */
  static readonly getOrUndefined: Effect.Effect<typeof OpenRouterConfig.Service | undefined> = Effect.map(
    Effect.context<never>(),
    (services) => services.mapUnsafe.get(OpenRouterConfig.key)
  )
}

/**
 * @since 1.0.0
 */
export declare namespace OpenRouterConfig {
  /**
   * @category models
   * @since 1.0.0
   */
  export interface Service {
    readonly transformClient?: ((client: HttpClient) => HttpClient) | undefined
  }
}

/**
 * @category configuration
 * @since 1.0.0
 */
export const withClientTransform: {
  (transform: (client: HttpClient) => HttpClient): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(self: Effect.Effect<A, E, R>, transform: (client: HttpClient) => HttpClient): Effect.Effect<A, E, R>
} = dual<
  (transform: (client: HttpClient) => HttpClient) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>,
  <A, E, R>(self: Effect.Effect<A, E, R>, transform: (client: HttpClient) => HttpClient) => Effect.Effect<A, E, R>
>(
  2,
  (self, transformClient) =>
    Effect.flatMap(
      OpenRouterConfig.getOrUndefined,
      (config) => Effect.provideService(self, OpenRouterConfig, { ...config, transformClient })
    )
)
