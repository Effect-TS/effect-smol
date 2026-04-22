import { PgliteClient } from "@effect/sql-pglite"
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"

const queryFailureReasonTag = (cause: unknown) =>
  Effect.gen(function*() {
    const stub = makeFailingClient(cause)
    const client = yield* PgliteClient.fromClient({ liveClient: stub as any })
    const error = yield* Effect.flip(client`SELECT 1`)
    return error.reason._tag
  }).pipe(
    Effect.scoped,
    Effect.provide(Reactivity.layer)
  )

const makeFailingClient = (cause: unknown) => ({
  query: () => Promise.reject(cause),
  exec: () => Promise.reject(cause),
  listen: () => Promise.resolve(() => Promise.resolve()),
  notify: () => Promise.resolve(),
  dumpDataDir: () => Promise.reject(cause),
  close: () => Promise.resolve(),
  waitReady: Promise.resolve(),
  ready: true,
  closed: false
})

describe("PgliteClient SqlError classification", () => {
  it.effect("checks 42501 before generic 42*", () =>
    Effect.gen(function*() {
      const authorizationTag = yield* queryFailureReasonTag({ code: "42501" })
      assert.strictEqual(authorizationTag, "AuthorizationError")

      const syntaxTag = yield* queryFailureReasonTag({ code: "42P01" })
      assert.strictEqual(syntaxTag, "SqlSyntaxError")
    }))

  it.effect("maps connection / constraint / deadlock", () =>
    Effect.gen(function*() {
      assert.strictEqual(yield* queryFailureReasonTag({ code: "08006" }), "ConnectionError")
      assert.strictEqual(yield* queryFailureReasonTag({ code: "23505" }), "ConstraintError")
      assert.strictEqual(yield* queryFailureReasonTag({ code: "40P01" }), "DeadlockError")
      assert.strictEqual(yield* queryFailureReasonTag({ code: "40001" }), "SerializationError")
      assert.strictEqual(yield* queryFailureReasonTag({ code: "55P03" }), "LockTimeoutError")
      assert.strictEqual(yield* queryFailureReasonTag({ code: "57014" }), "StatementTimeoutError")
      assert.strictEqual(yield* queryFailureReasonTag({ code: "28000" }), "AuthenticationError")
    }))

  it.effect("falls back to UnknownError for unmapped SQLSTATE", () =>
    Effect.gen(function*() {
      const tag = yield* queryFailureReasonTag({ code: "ZZZZZ" })
      assert.strictEqual(tag, "UnknownError")
    }))
})
