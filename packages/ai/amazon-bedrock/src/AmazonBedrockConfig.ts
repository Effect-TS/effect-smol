/**
 * @since 1.0.0
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import type { HttpClient } from "effect/unstable/http/HttpClient"

/**
 * @since 1.0.0
 * @category services
 */
export class AmazonBedrockConfig extends Context.Service<
  AmazonBedrockConfig,
  AmazonBedrockConfig.Service
>()("@effect/ai-amazon-bedrock/AmazonBedrockConfig") {
  /**
   * @since 1.0.0
   */
  static readonly getOrUndefined: Effect.Effect<typeof AmazonBedrockConfig.Service | undefined> = Effect.map(
    Effect.context<never>(),
    (context) => context.mapUnsafe.get(AmazonBedrockConfig.key)
  )
}

/**
 * @since 1.0.0
 */
export declare namespace AmazonBedrockConfig {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Service {
    readonly transformClient?: (client: HttpClient) => HttpClient
  }
}

/**
 * @since 1.0.0
 * @category configuration
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
      AmazonBedrockConfig.getOrUndefined,
      (config) => Effect.provideService(self, AmazonBedrockConfig, { ...config, transformClient })
    )
)
