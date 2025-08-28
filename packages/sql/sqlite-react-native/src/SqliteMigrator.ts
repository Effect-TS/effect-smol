/**
 * @since 1.0.0
 */
import * as Migrator from "effect/unstable/sql/Migrator"
import type * as Client from "effect/unstable/sql/SqlClient"
import type { SqlError } from "effect/unstable/sql/SqlError"
import type * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

/**
 * @since 1.0.0
 */
export * from "effect/unstable/sql/Migrator"

/**
 * @category constructor
 * @since 1.0.0
 */
export const run: <R>(
  options: Migrator.MigratorOptions<R>
) => Effect.Effect<
  ReadonlyArray<readonly [id: number, name: string]>,
  SqlError | Migrator.MigrationError,
  Client.SqlClient | R
> = Migrator.make({})

/**
 * @category constructor
 * @since 1.0.0
 */
export const layer = <R>(
  options: Migrator.MigratorOptions<R>
): Layer.Layer<never, SqlError | Migrator.MigrationError, R | Client.SqlClient> => Layer.effectDiscard(run(options))
