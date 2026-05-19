/**
 * Perplexity Search module for calling the Perplexity Search API.
 *
 * @since 4.0.0
 */
import type * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"
import type * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as AiError from "effect/unstable/ai/AiError"
import * as HttpBody from "effect/unstable/http/HttpBody"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as PerplexityClient from "./PerplexityClient.ts"

// =============================================================================
// Schemas
// =============================================================================

/**
 * Perplexity Search result.
 *
 * @category schemas
 * @since 4.0.0
 */
export class SearchResult extends Schema.Class<SearchResult>(
  "@effect/ai-perplexity/SearchResult"
)({
  title: Schema.String,
  url: Schema.String,
  snippet: Schema.String,
  date: Schema.optional(Schema.NullOr(Schema.String))
}) {}

/**
 * Perplexity Search response.
 *
 * @category schemas
 * @since 4.0.0
 */
export class SearchResponse extends Schema.Class<SearchResponse>(
  "@effect/ai-perplexity/SearchResponse"
)({
  id: Schema.optional(Schema.String),
  results: Schema.Array(SearchResult)
}) {}

// =============================================================================
// Models
// =============================================================================

/**
 * Recency window for search results.
 *
 * @category models
 * @since 4.0.0
 */
export type RecencyFilter = "hour" | "day" | "week" | "month" | "year"

/**
 * Options accepted by `PerplexitySearch.search`.
 *
 * Matches the Perplexity Search API request body.
 *
 * @category models
 * @since 4.0.0
 */
export interface SearchOptions {
  readonly query: string
  readonly maxResults?: number | undefined
  readonly maxTokensPerPage?: number | undefined
  readonly domainFilter?: ReadonlyArray<string> | undefined
  readonly recencyFilter?: RecencyFilter | undefined
  readonly afterDateFilter?: string | undefined
  readonly beforeDateFilter?: string | undefined
}

/**
 * The Perplexity Search service interface.
 *
 * @category models
 * @since 4.0.0
 */
export interface Service {
  /**
   * Runs a Perplexity Search API query and returns decoded results.
   */
  readonly search: (options: SearchOptions) => Effect.Effect<SearchResponse, AiError.AiError>
}

// =============================================================================
// Service Identifier
// =============================================================================

/**
 * Service identifier for Perplexity Search.
 *
 * @category services
 * @since 4.0.0
 */
export class PerplexitySearch extends Context.Service<PerplexitySearch, Service>()(
  "@effect/ai-perplexity/PerplexitySearch"
) {}

// =============================================================================
// Utilities
// =============================================================================

const validateDomainFilter = (filter: ReadonlyArray<string>): string | undefined => {
  const hasAllow = filter.some((domain) => !domain.startsWith("-"))
  const hasDeny = filter.some((domain) => domain.startsWith("-"))
  return hasAllow && hasDeny
    ? "domainFilter cannot mix allowlist and denylist entries. Use either positive entries (e.g. 'nytimes.com') or negative entries (e.g. '-pinterest.com'), not both."
    : undefined
}

const buildBody = (options: SearchOptions): Effect.Effect<Record<string, unknown>, AiError.AiError> =>
  Effect.gen(function*() {
    if (Predicate.isNotUndefined(options.domainFilter) && options.domainFilter.length > 0) {
      const validationError = validateDomainFilter(options.domainFilter)
      if (Predicate.isNotUndefined(validationError)) {
        return yield* AiError.make({
          module: "PerplexitySearch",
          method: "search",
          reason: new AiError.InvalidRequestError({
            parameter: "domainFilter",
            constraint: "must contain either allowlist or denylist entries",
            description: validationError
          })
        })
      }
    }

    const body: Record<string, unknown> = { query: options.query }
    if (Predicate.isNotUndefined(options.maxResults)) body.max_results = options.maxResults
    if (Predicate.isNotUndefined(options.maxTokensPerPage)) body.max_tokens_per_page = options.maxTokensPerPage
    if (Predicate.isNotUndefined(options.domainFilter)) body.search_domain_filter = options.domainFilter
    if (Predicate.isNotUndefined(options.recencyFilter)) body.search_recency_filter = options.recencyFilter
    if (Predicate.isNotUndefined(options.afterDateFilter)) body.search_after_date_filter = options.afterDateFilter
    if (Predicate.isNotUndefined(options.beforeDateFilter)) body.search_before_date_filter = options.beforeDateFilter
    return body
  })

/**
 * Builds the request body sent to the Perplexity Search API.
 *
 * @category utilities
 * @since 4.0.0
 */
export const buildRequestBody = (options: SearchOptions): Effect.Effect<Record<string, unknown>, AiError.AiError> =>
  buildBody(options)

// =============================================================================
// Constructor
// =============================================================================

/**
 * Creates a Perplexity Search service from a `PerplexityClient`.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make: Effect.Effect<Service, never, PerplexityClient.PerplexityClient> = Effect.gen(function*() {
  const client = yield* PerplexityClient.PerplexityClient

  const search: Service["search"] = (options) =>
    Effect.gen(function*() {
      const body = yield* buildBody(options)
      const request = HttpClientRequest.post("/search", {
        body: HttpBody.jsonUnsafe(body)
      })
      return yield* client.executeRequest(request, SearchResponse, "search")
    })

  return PerplexitySearch.of({ search })
})

// =============================================================================
// Layers
// =============================================================================

/**
 * Layer that builds the `PerplexitySearch` service from a `PerplexityClient`.
 *
 * @category layers
 * @since 4.0.0
 */
export const layer: Layer.Layer<PerplexitySearch, never, PerplexityClient.PerplexityClient> = Layer.effect(
  PerplexitySearch,
  make
)

/**
 * Convenience layer that wires the `PerplexitySearch` service together with a
 * `PerplexityClient` configured from environment variables.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerConfig = (options?: {
  readonly apiKey?: Config.Config<Redacted.Redacted<string> | undefined> | undefined
  readonly apiUrl?: Config.Config<string> | undefined
  readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
}): Layer.Layer<PerplexitySearch, Config.ConfigError, HttpClient.HttpClient> =>
  layer.pipe(Layer.provide(PerplexityClient.layerConfig(options)))
