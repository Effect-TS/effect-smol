/**
 * Re-exports the public `@duckdb/node-api` surface used by the DuckDB SQL
 * adapter, including value constructors, logical type constructors, data
 * chunks, appenders, prepared statements, and scalar functions.
 *
 * @since 4.0.0
 */

import duckdbDefault from "@duckdb/node-api"

/**
 * Default `@duckdb/node-api` export.
 *
 * @category re-exports
 * @since 4.0.0
 */
export const duckdb = duckdbDefault

/**
 * @category re-exports
 * @since 4.0.0
 */
export * from "@duckdb/node-api"
