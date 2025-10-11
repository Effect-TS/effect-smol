/**
 * @since 4.0.0
 */
import type { Effect } from "../../Effect.ts"
import type { Scope } from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { Stream } from "../../stream/Stream.ts"
import type { SqlError } from "./SqlError.ts"
import type { Primitive } from "./Statement.ts"

/**
 * @category model
 * @since 4.0.0
 */
export interface Connection {
  readonly execute: (
    sql: string,
    params: ReadonlyArray<Primitive>,
    transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ) => Effect<ReadonlyArray<any>, SqlError>

  /**
   * Execute the specified SQL query and return the raw results directly from
   * underlying SQL client.
   */
  readonly executeRaw: (
    sql: string,
    params: ReadonlyArray<Primitive>
  ) => Effect<unknown, SqlError>

  readonly executeStream: (
    sql: string,
    params: ReadonlyArray<Primitive>,
    transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ) => Stream<any, SqlError>

  readonly executeValues: (
    sql: string,
    params: ReadonlyArray<Primitive>
  ) => Effect<ReadonlyArray<ReadonlyArray<Primitive>>, SqlError>

  readonly executeUnprepared: (
    sql: string,
    params: ReadonlyArray<Primitive>,
    transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ) => Effect<ReadonlyArray<any>, SqlError>
}

/**
 * @category model
 * @since 4.0.0
 */
export type Acquirer = Effect<Connection, SqlError, Scope>

/**
 * @category tag
 * @since 4.0.0
 */
export const Connection = ServiceMap.Service<Connection>("effect/sql/SqlConnection")

/**
 * @category model
 * @since 4.0.0
 */
export type Row = { readonly [column: string]: Primitive }
