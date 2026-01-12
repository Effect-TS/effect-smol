/**
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as ServiceMap from "effect/ServiceMap"
import type * as HttpClient from "effect/unstable/http/HttpClient"

/**
 * @since 1.0.0
 * @category Context
 */
export class OpenAiConfig extends ServiceMap.Service<OpenAiConfig, Service>()(
  "@effect/ai-openai/OpenAiConfig"
) {
  /**
   * @since 1.0.0
   */
  static readonly getOrUndefined: Effect.Effect<typeof OpenAiConfig.Service | undefined> = Effect.map(
    Effect.services<never>(),
    (serviceMap) => serviceMap.mapUnsafe.get(OpenAiConfig.key)
  )
}

/**
 * @since 1.0.
 * @category Models
 */
export interface Service {
  readonly transformClient?: (client: HttpClient.HttpClient) => HttpClient.HttpClient
}

/**
 * @since 1.0.0
 * @category Configuration
 */
export const withClientTransform: {
  (
    transform: (client: HttpClient.HttpClient) => HttpClient.HttpClient
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    transform: (client: HttpClient.HttpClient) => HttpClient.HttpClient
  ): Effect.Effect<A, E, R>
} = dual(2, (self, transformClient) =>
  Effect.flatMap(
    OpenAiConfig.getOrUndefined,
    (config) => Effect.provideService(self, OpenAiConfig, { ...config, transformClient })
  ))
