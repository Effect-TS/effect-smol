/**
 * @since 1.0.0
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import type { HttpClient } from "effect/unstable/http/HttpClient"

/**
 * Service tag for Anthropic client configuration overrides, such as transformations applied to the generated HTTP client.
 *
 * @category services
 * @since 1.0.0
 */
export class AnthropicConfig extends Context.Service<
  AnthropicConfig,
  AnthropicConfig.Service
>()("@effect/ai-anthropic/AnthropicConfig") {
  /**
   * Gets the configured Anthropic service from the current context when present.
   *
   * @since 1.0.0
   */
  static readonly getOrUndefined: Effect.Effect<typeof AnthropicConfig.Service | undefined> = Effect.map(
    Effect.context<never>(),
    (services) => services.mapUnsafe.get(AnthropicConfig.key)
  )
}

/**
 * Namespace containing types associated with the `AnthropicConfig` service.
 *
 * @since 1.0.0
 */
export declare namespace AnthropicConfig {
  /**
   * Configuration provided through `AnthropicConfig`.
   *
   * **Details**
   * Use `transformClient` to wrap or replace the `HttpClient` used by generated Anthropic API requests.
   *
   * @category models
   * @since 1.0.0
   */
  export interface Service {
    readonly transformClient?: ((client: HttpClient) => HttpClient) | undefined
  }
}

/**
 * Runs an effect with an `AnthropicConfig` override that transforms the underlying `HttpClient` used by generated Anthropic requests.
 *
 * @category configuration
 * @since 1.0.0
 */
export const withClientTransform: {
  (transform: (client: HttpClient) => HttpClient): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(self: Effect.Effect<A, E, R>, transform: (client: HttpClient) => HttpClient): Effect.Effect<A, E, R>
} = dual(2, <A, E, R>(
  self: Effect.Effect<A, E, R>,
  transformClient: (client: HttpClient) => HttpClient
) =>
  Effect.flatMap(
    AnthropicConfig.getOrUndefined,
    (config) => Effect.provideService(self, AnthropicConfig, { ...config, transformClient })
  ))
