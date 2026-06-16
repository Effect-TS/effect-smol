/**
 * The `PerplexityConfig` module provides contextual configuration for the
 * Perplexity AI provider integration. It is used to customize the HTTP client
 * used by Perplexity requests without threading configuration through every
 * call.
 *
 * @since 4.0.0
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import type { HttpClient } from "effect/unstable/http/HttpClient"

/**
 * Service tag for Perplexity client configuration overrides, such as transformations applied to the HTTP client.
 *
 * @category services
 * @since 4.0.0
 */
export class PerplexityConfig extends Context.Service<
  PerplexityConfig,
  PerplexityConfig.Service
>()("@effect/ai-perplexity/PerplexityConfig") {
  /**
   * Gets the configured Perplexity service from the current context when present.
   *
   * @since 4.0.0
   */
  static readonly getOrUndefined: Effect.Effect<typeof PerplexityConfig.Service | undefined> = Effect.map(
    Effect.context<never>(),
    (services) => services.mapUnsafe.get(PerplexityConfig.key)
  )
}

/**
 * Namespace containing types associated with the `PerplexityConfig` service.
 *
 * @since 4.0.0
 */
export declare namespace PerplexityConfig {
  /**
   * Configuration provided through `PerplexityConfig`.
   *
   * @category models
   * @since 4.0.0
   */
  export interface Service {
    readonly transformClient?: ((client: HttpClient) => HttpClient) | undefined
  }
}

/**
 * Runs an effect with a `PerplexityConfig` override that transforms the underlying `HttpClient` used by Perplexity requests.
 *
 * @category configuration
 * @since 4.0.0
 */
export const withClientTransform: {
  (transform: (client: HttpClient) => HttpClient): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(self: Effect.Effect<A, E, R>, transform: (client: HttpClient) => HttpClient): Effect.Effect<A, E, R>
} = dual(2, <A, E, R>(
  self: Effect.Effect<A, E, R>,
  transformClient: (client: HttpClient) => HttpClient
) =>
  Effect.flatMap(
    PerplexityConfig.getOrUndefined,
    (config) => Effect.provideService(self, PerplexityConfig, { ...config, transformClient })
  ))
