/**
 * @title Acquiring resources with Effect.acquireRelease
 *
 * Use `Effect.acquireRelease` for resources that must always be cleaned up,
 * then run the workflow with `Effect.scoped` so finalizers run automatically.
 */

import { Effect, Exit } from "effect"

interface DbConnection {
  readonly query: (sql: string) => Effect.Effect<ReadonlyArray<{ readonly id: number; readonly name: string }>>
  readonly close: Effect.Effect<void>
  readonly rollback: Effect.Effect<void>
}

declare const openConnection: Effect.Effect<DbConnection, Error>
declare const persistAuditLog: (message: string) => Effect.Effect<void>

export const connection = Effect.acquireRelease(
  // Acquire the connection once and register a finalizer in the current scope.
  openConnection,
  (db, exit) =>
    Effect.gen(function*() {
      // Use the Exit value to decide extra cleanup work.
      if (Exit.isFailure(exit)) {
        yield* db.rollback
      }

      yield* db.close
      yield* persistAuditLog(`db connection closed (${Exit.isSuccess(exit) ? "success" : "failure"})`)
    })
)

export const loadUsers = Effect.scoped(
  connection.pipe(
    // Any workflow that uses this resource now gets deterministic cleanup.
    Effect.flatMap((db) => db.query("select id, name from users order by id")),
    Effect.tap((rows) => persistAuditLog(`loaded ${rows.length} users`))
  )
)
