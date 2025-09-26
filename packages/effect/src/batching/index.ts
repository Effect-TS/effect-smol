/**
 * @since 4.0.0
 */

/**
 * The `Request` module provides a way to model requests to external data sources
 * in a functional and composable manner. Requests represent descriptions of
 * operations that can be batched, cached, and executed efficiently.
 *
 * A `Request<A, E, R>` represents a request that:
 * - Yields a value of type `A` on success
 * - Can fail with an error of type `E`
 * - Requires services of type `R`
 *
 * Requests are primarily used with RequestResolver to implement efficient
 * data fetching patterns, including automatic batching and caching.
 *
 * @since 2.0.0
 */
export * as Request from "../Request.ts"

/**
 * @since 2.0.0
 */
export * as RequestResolver from "../RequestResolver.ts"
