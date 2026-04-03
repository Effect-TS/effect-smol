import { PgClient } from "@effect/sql-pg"
import { assert, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"

const makeFailingPool = (cause: unknown) => ({
  options: {},
  ending: false,
  connect: (cb: (cause: unknown, client?: unknown, release?: (cause?: Error) => void) => void) =>
    cb(cause, undefined, () => undefined),
  query: () => undefined
})

it.effect("withTransaction surfaces acquire failures instead of defecting", () =>
  Effect.gen(function*() {
    const sql = yield* PgClient.fromPool({
      acquire: Effect.succeed(makeFailingPool({ code: "08006" }) as any)
    })

    const error = yield* Effect.flip(sql.withTransaction(sql`SELECT 1`))

    assert.strictEqual(error.reason._tag, "ConnectionError")
    assert.strictEqual(error.reason.message, "Failed to acquire connection for transaction")
    assert.strictEqual(error.reason.operation, "acquireConnection")
  }).pipe(
    Effect.scoped,
    Effect.provide(Reactivity.layer)
  ))
