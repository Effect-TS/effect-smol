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
export class OpenAiConfig extends Context.Service<
  OpenAiConfig,
  OpenAiConfig.Service
>()("@effect/ai-openai-compat/OpenAiConfig") {
  /**
   * Gets the configured OpenAI-compatible service from the current context when present.
   *
   * @since 1.0.0
   */
  static readonly getOrUndefined: Effect.Effect<typeof OpenAiConfig.Service | undefined> = Effect.map(
    Effect.context<never>(),
    (context) => context.mapUnsafe.get(OpenAiConfig.key)
  )
}

/**
 * @since 1.0.0
 */
export declare namespace OpenAiConfig {
  /**
   * @category models
   * @since 1.0.
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
} = dual(2, <A, E, R>(
  self: Effect.Effect<A, E, R>,
  transformClient: (client: HttpClient) => HttpClient
) =>
  Effect.flatMap(
    OpenAiConfig.getOrUndefined,
    (config) => Effect.provideService(self, OpenAiConfig, { ...config, transformClient })
  ))
