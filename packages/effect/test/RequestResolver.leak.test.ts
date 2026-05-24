/**
 * Repro: `pendingBatches` in `internal/request.ts` keeps a strong reference to
 * every `RequestResolver` instance it has ever seen. When code mints a fresh
 * resolver per request (e.g. `RequestResolver.withCache(...)` inside a
 * per-request scope), every cache and its entries survive past the scope —
 * objects produced by the resolver can never be collected.
 *
 * Run with: NODE_OPTIONS=--expose-gc pnpm vitest run test/RequestResolver.leak.test.ts
 */
import { expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Request from "effect/Request"
import * as RequestResolver from "effect/RequestResolver"

interface GetUser extends Request.Request<User> {
  readonly _tag: "GetUser"
  readonly id: number
}
const GetUser = Request.tagged<GetUser>("GetUser")

class User {
  constructor(readonly id: number, readonly payload: string) {}
}

// ~100kb per clone so a leak is unmistakable in RSS too.
const HUGE = "x".repeat(100_000)

const refs: Array<WeakRef<User>> = []

const baseResolver = RequestResolver.make((entries: ReadonlyArray<Request.Entry<GetUser>>) =>
  Effect.forEach(entries, (entry) => {
    const clone = new User(entry.request.id, HUGE)
    refs.push(new WeakRef(clone))
    return Request.complete(Exit.succeed(clone))(entry)
  }, { discard: true })
)

const REQUEST_COUNT = 100
const USERS_PER_REQUEST = 10

it.live(
  "per-request RequestResolver.withCache resolvers should be GC-eligible after use",
  Effect.fnUntraced(function*() {
    if (typeof globalThis.gc !== "function") {
      return yield* Effect.die(new Error("run with --expose-gc"))
    }
    refs.length = 0

    const oneRequest = Effect.fnUntraced(function*() {
      const cached = yield* RequestResolver.withCache(baseResolver, {
        capacity: 10_000,
        strategy: "fifo"
      })
      for (let u = 0; u < USERS_PER_REQUEST; u++) {
        yield* Effect.request(GetUser({ id: u }), cached)
      }
    })
    for (let r = 0; r < REQUEST_COUNT; r++) {
      yield* oneRequest()
    }
    yield* Effect.sleep("200 millis")
    globalThis.gc()
    yield* Effect.sleep("50 millis")
    globalThis.gc()

    const total = refs.length
    const alive = refs.filter((ref) => ref.deref() !== undefined).length

    expect(total).toBe(REQUEST_COUNT * USERS_PER_REQUEST)
    // Post-fix bound: only the most-recently-used resolver may remain (its
    // cache + entries pinned by the last fiber's structural retention).
    // Pre-fix: `alive` grew linearly with REQUEST_COUNT (every resolver
    // pinned via `pendingBatches` Map).
    expect(alive).toBe(USERS_PER_REQUEST)
  }),
  { timeout: 30_000 }
)
