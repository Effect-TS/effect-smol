/**
 * The `EmbeddingModel` module provides provider-agnostic text embedding capabilities.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as EmbeddingModel from "effect/unstable/ai/EmbeddingModel"
 *
 * const program = Effect.gen(function*() {
 *   const model = yield* EmbeddingModel.EmbeddingModel
 *   return yield* model.embed("hello world")
 * })
 * ```
 *
 * @since 4.0.0
 */
import type * as Effect from "../../Effect.ts"
import * as Request from "../../Request.ts"
import type * as RequestResolver from "../../RequestResolver.ts"
import * as Schema from "../../Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as AiError from "./AiError.ts"

/**
 * Service tag for embedding model operations.
 *
 * @since 4.0.0
 * @category services
 */
export class EmbeddingModel extends ServiceMap.Service<EmbeddingModel, Service>()(
  "effect/unstable/ai/EmbeddingModel"
) {}

/**
 * Token usage metadata for embedding operations.
 *
 * @since 4.0.0
 * @category models
 */
export class EmbeddingUsage extends Schema.Class<EmbeddingUsage>(
  "effect/ai/EmbeddingModel/EmbeddingUsage"
)({
  inputTokens: Schema.UndefinedOr(Schema.Number)
}) {}

/**
 * Response for a single embedding request.
 *
 * @since 4.0.0
 * @category models
 */
export class EmbedResponse extends Schema.Class<EmbedResponse>(
  "effect/ai/EmbeddingModel/EmbedResponse"
)({
  vector: Schema.Array(Schema.Number)
}) {}

/**
 * Response for multiple embeddings.
 *
 * @since 4.0.0
 * @category models
 */
export class EmbedManyResponse extends Schema.Class<EmbedManyResponse>(
  "effect/ai/EmbeddingModel/EmbedManyResponse"
)({
  embeddings: Schema.Array(EmbedResponse),
  usage: EmbeddingUsage
}) {}

/**
 * Provider input options for embedding requests.
 *
 * @since 4.0.0
 * @category models
 */
export interface ProviderOptions {
  readonly inputs: ReadonlyArray<string>
}

/**
 * Provider embedding result mapped to the original input index.
 *
 * @since 4.0.0
 * @category models
 */
export interface ProviderResult {
  readonly index: number
  readonly vector: Array<number>
}

/**
 * Provider response for batch embedding requests.
 *
 * @since 4.0.0
 * @category models
 */
export interface ProviderResponse {
  readonly results: Array<ProviderResult>
  readonly usage: {
    readonly inputTokens: number | undefined
  }
}

/**
 * Tagged request used by request resolvers for embedding operations.
 *
 * @since 4.0.0
 * @category constructors
 */
export class EmbeddingRequest extends Request.TaggedClass("EmbeddingRequest")<
  { readonly input: string },
  EmbedResponse,
  AiError.AiError
> {}

/**
 * Service interface for embedding operations.
 *
 * @since 4.0.0
 * @category models
 */
export interface Service {
  readonly resolver: RequestResolver.RequestResolver<EmbeddingRequest>
  readonly embed: (input: string) => Effect.Effect<EmbedResponse, AiError.AiError>
  readonly embedMany: (input: ReadonlyArray<string>) => Effect.Effect<EmbedManyResponse, AiError.AiError>
}
