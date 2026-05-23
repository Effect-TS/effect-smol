/**
 * The `OpenRouterConfig` module provides contextual configuration for the
 * OpenRouter provider integration. It is used to customize the HTTP client that
 * backs OpenRouter requests without rebuilding the provider layer itself.
 *
 * Use {@link withClientTransform} when a single effect, workflow, or scoped
 * portion of an application needs to add cross-cutting HTTP client behavior
 * such as request logging, retries, proxy routing, additional headers, or test
 * doubles. The configuration is read from the current Effect context, so the
 * transform only applies where the returned effect is run with that context.
 *
 * **Gotchas**
 *
 * - Each call to {@link withClientTransform} replaces the current client
 *   transform for the provided effect; compose transforms manually when both
 *   behaviors should apply.
 * - The transform receives and returns an `HttpClient`, so it should preserve
 *   the OpenRouter client contract while adding behavior around it.
 *
 * @since 4.0.0
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import type { HttpClient } from "effect/unstable/http/HttpClient"

/**
 * Context service carrying scoped OpenRouter provider configuration for client
 * operations.
 *
 * **When to use**
 *
 * Use as the context service tag when manually providing or reading scoped
 * OpenRouter provider configuration in an Effect context.
 *
 * @see {@link withClientTransform} for scoping an HTTP client transformation
 *
 * @category services
 * @since 4.0.0
 */
export class OpenRouterConfig extends Context.Service<
  OpenRouterConfig,
  OpenRouterConfig.Service
>()("@effect/ai-openrouter/OpenRouterConfig") {
  /**
   * Gets the configured OpenRouter service from the current context when present.
   *
   * @since 4.0.0
   */
  static readonly getOrUndefined: Effect.Effect<typeof OpenRouterConfig.Service | undefined> = Effect.map(
    Effect.context<never>(),
    (services) => services.mapUnsafe.get(OpenRouterConfig.key)
  )
}

/**
 * Types associated with the `OpenRouterConfig` context service.
 *
 * @since 4.0.0
 */
export declare namespace OpenRouterConfig {
  /**
   * Configuration values read by OpenRouter provider operations when resolving
   * the generated HTTP client.
   *
   * @category models
   * @since 4.0.0
   */
  export interface Service {
    readonly transformClient?: ((client: HttpClient) => HttpClient) | undefined
  }
}

/**
 * Provides a scoped transform for the OpenRouter HTTP client used by provider
 * operations.
 *
 * **When to use**
 *
 * Use when a single effect or workflow needs temporary OpenRouter HTTP client
 * customization without rebuilding the client layer.
 *
 * **Details**
 *
 * Supports both data-first and data-last forms. The transform is stored in the
 * scoped `OpenRouterConfig` service and read by generated OpenRouter request
 * operations while running the supplied effect.
 *
 * **Gotchas**
 *
 * If a transform is already present in the scoped config, this helper replaces
 * it. Compose transforms manually when both should apply. Streaming chat
 * completion requests are sent directly by `OpenRouterClient.make` and do not
 * read this scoped transform.
 *
 * @category configuration
 * @since 4.0.0
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
