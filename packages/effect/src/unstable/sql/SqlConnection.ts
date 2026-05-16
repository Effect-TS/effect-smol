/**
 * @since 4.0.0
 */
import * as Context from "../../Context.ts"
import type { Effect } from "../../Effect.ts"
import type { Scope } from "../../Scope.ts"
import type { Stream } from "../../Stream.ts"
import type { SqlError } from "./SqlError.ts"

/**
 * Low-level SQL driver connection capable of executing compiled SQL as
 * transformed rows, raw results, streams, value arrays, or unprepared
 * statements.
 *
 * @category model
 * @since 4.0.0
 */
export interface Connection {
  readonly execute: (
    sql: string,
    params: ReadonlyArray<unknown>,
    transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ) => Effect<ReadonlyArray<any>, SqlError>

  /**
   * Execute the specified SQL query and return the raw results directly from
   * underlying SQL client.
   */
  readonly executeRaw: (
    sql: string,
    params: ReadonlyArray<unknown>
  ) => Effect<unknown, SqlError>

  readonly executeStream: (
    sql: string,
    params: ReadonlyArray<unknown>,
    transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ) => Stream<any, SqlError>

  readonly executeValues: (
    sql: string,
    params: ReadonlyArray<unknown>
  ) => Effect<ReadonlyArray<ReadonlyArray<unknown>>, SqlError>

  readonly executeUnprepared: (
    sql: string,
    params: ReadonlyArray<unknown>,
    transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ) => Effect<ReadonlyArray<any>, SqlError>
}

/**
 * Scoped effect that acquires a `Connection`, may fail with `SqlError`, and
 * requires a `Scope` for release.
 *
 * @category model
 * @since 4.0.0
 */
export type Acquirer = Effect<Connection, SqlError, Scope>

/**
 * Context service tag for a low-level SQL `Connection`.
 *
 * @category tag
 * @since 4.0.0
 */
export const Connection = Context.Service<Connection>("effect/sql/SqlConnection")

/**
 * Generic SQL row shape mapping column names to unknown values.
 *
 * @category model
 * @since 4.0.0
 */
export type Row = { readonly [column: string]: unknown }
