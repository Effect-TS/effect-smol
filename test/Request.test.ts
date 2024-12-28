import * as Array from "effect/Array"
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import { flow, pipe } from "effect/Function"
import * as Request from "effect/Request"
import * as Resolver from "effect/RequestResolver"
import { assert, describe, expect, it } from "./utils/extend.js"

class Counter extends Context.Tag("Counter")<Counter, { count: number }>() {}
class Requests extends Context.Tag("Requests")<Requests, { count: number }>() {}
class Interrupts extends Context.Reference<Interrupts>()("Interrupts", {
  defaultValue: () => ({ interrupts: 0 })
}) {}
const delay = <A, E, R>(self: Effect.Effect<A, E, R>) =>
  Effect.andThen(
    Effect.promise(() => new Promise((r) => setTimeout(() => r(0), 0))),
    self
  )

const userIds: ReadonlyArray<number> = Array.range(1, 26)

const userNames: ReadonlyMap<number, string> = new Map(
  Array.zipWith(
    userIds,
    Array.map(Array.range(97, 122), (a) => String.fromCharCode(a)),
    (a, b) => [a, b] as const
  )
)

type UserRequest = GetAllIds | GetNameById

interface GetAllIds extends Request.Request<ReadonlyArray<number>, never, Counter | Requests> {
  readonly _tag: "GetAllIds"
}
const GetAllIds = Request.tagged<GetAllIds>("GetAllIds")

class GetNameById extends Request.TaggedClass("GetNameById")<
  {
    readonly id: number
  },
  string,
  string,
  Counter | Requests
> {}

const UserResolver = Resolver.make(Effect.fnUntraced(function*(requests: Array<UserRequest>) {
  const context = yield* Request.context(requests[0])
  Context.get(context, Counter).count++
  Context.get(context, Requests).count += requests.length
  for (const request of requests) {
    yield* delay(processRequest(request))
  }
})).pipe(
  Resolver.batchN(15)
)

export const getAllUserIds = Effect.request(GetAllIds({}), UserResolver)

export const getUserNameById = (id: number) => Effect.request(new GetNameById({ id }), UserResolver)

export const getUserNameByIdPiped = (id: number) => pipe(new GetNameById({ id }), Effect.request(UserResolver))

export const getAllUserNames = getAllUserIds.pipe(
  Effect.flatMap(Effect.forEach(getUserNameById, { concurrency: "unbounded" })),
  Effect.onInterrupt(Effect.tap(Effect.service(Interrupts), (i) => i.interrupts++))
)

const UserResolverTagged = Resolver.fromEffectTagged<UserRequest>()({
  GetAllIds: Effect.fnUntraced(function*(reqs) {
    const context = yield* Request.context(reqs[0])
    Context.get(context, Counter).count++
    Context.get(context, Requests).count += reqs.length
    return reqs.map(() => userIds)
  }),
  GetNameById: Effect.fnUntraced(function*(reqs) {
    const context = yield* Request.context(reqs[0])
    Context.get(context, Counter).count++
    Context.get(context, Requests).count += reqs.length
    const names: Array<string> = []
    for (let i = 0; i < reqs.length; i++) {
      const req = reqs[i]
      if (!userNames.has(req.id)) return yield* Effect.fail("Not Found")
      names.push(userNames.get(req.id)!)
    }
    return names
  })
}).pipe(Resolver.batchN(15))
export const getAllUserIdsTagged = Effect.request(GetAllIds({}), UserResolverTagged)
export const getUserNameByIdTagged = (id: number) => Effect.request(new GetNameById({ id }), UserResolverTagged)
export const getAllUserNamesTagged = getAllUserIdsTagged.pipe(
  Effect.flatMap(Effect.forEach(getUserNameByIdTagged, { concurrency: "unbounded" }))
)

// const print = (request: UserRequest): string => {
//   switch (request._tag) {
//     case "GetAllIds": {
//       return request._tag
//     }
//     case "GetNameById": {
//       return `${request._tag}(${request.id})`
//     }
//   }
// }

const processRequest = (request: UserRequest): Effect.Effect<void> => {
  switch (request._tag) {
    case "GetAllIds": {
      return Request.complete(request, Exit.succeed(userIds))
    }
    case "GetNameById": {
      if (userNames.has(request.id)) {
        const userName = userNames.get(request.id)!
        return Request.complete(request, Exit.succeed(userName))
      }
      return Request.completeEffect(request, Exit.fail("Not Found"))
    }
  }
}

const provideEnv = flow(
  Effect.provideServiceEffect(Counter, Effect.sync(() => ({ count: 0 }))),
  Effect.provideServiceEffect(Requests, Effect.sync(() => ({ count: 0 })))
)

describe.sequential("Request", () => {
  it.effect(
    "requests are executed correctly",
    Effect.fnUntraced(function*() {
      const names = yield* getAllUserNames
      const counter = yield* Effect.service(Counter)
      const requests = yield* Effect.service(Requests)
      assert.strictEqual(counter.count, 3)
      assert.strictEqual(requests.count, userIds.length + 1)
      assert.deepStrictEqual(names, userIds.map((id) => userNames.get(id)))
    }, provideEnv)
  )

  it.effect(
    "requests with dual syntax are executed correctly",
    Effect.fnUntraced(function*() {
      const names = yield* getAllUserNames
      const counter = yield* Effect.service(Counter)
      const requests = yield* Effect.service(Requests)
      assert.strictEqual(counter.count, 3)
      assert.strictEqual(requests.count, userIds.length + 1)
      assert.deepStrictEqual(names, userIds.map((id) => userNames.get(id)))
    }, provideEnv)
  )

  it.effect(
    "requests are executed correctly with fromEffectTagged",
    Effect.fnUntraced(function*() {
      const names = yield* getAllUserNamesTagged
      const count = yield* Effect.service(Counter)
      expect(count.count).toEqual(3)
      expect(names.length).toBeGreaterThan(2)
      expect(names).toEqual(userIds.map((id) => userNames.get(id)))
    }, provideEnv)
  )

  it.effect(
    "requests don't break interruption",
    Effect.fnUntraced(
      function*() {
        const fiber = yield* Effect.fork(getAllUserNames)
        yield* Effect.yieldNow
        yield* Fiber.interrupt(fiber)
        const exit = yield* Fiber.await(fiber)
        expect(exit._tag).toEqual("Failure")
        if (exit._tag === "Failure") {
          expect(Cause.isInterruptedOnly(exit.cause)).toEqual(true)
        }
        expect(yield* Effect.service(Counter)).toEqual({ count: 0 })
        expect(yield* Effect.service(Interrupts)).toEqual({ interrupts: 1 })
      },
      provideEnv,
      Effect.provideService(Interrupts, { interrupts: 0 })
    )
  )

  it.effect(
    "requests work with uninterruptible",
    Effect.fnUntraced(
      function*() {
        const fiber = yield* Effect.fork(Effect.uninterruptible(getAllUserNames))
        yield* Effect.yieldNow
        yield* Fiber.interrupt(fiber)
        const exit = yield* Fiber.await(fiber)
        expect(exit._tag).toEqual("Failure")
        if (exit._tag === "Failure") {
          expect(Cause.isInterruptedOnly(exit.cause)).toEqual(true)
        }
        expect(yield* Effect.service(Counter)).toEqual({ count: 3 })
        expect(yield* Effect.service(Interrupts)).toEqual({ interrupts: 0 })
      },
      provideEnv,
      Effect.provideService(Interrupts, { interrupts: 0 })
    )
  )

  it.effect(
    "batching preserves individual & identical requests",
    Effect.fnUntraced(function*() {
      yield* Effect.all([getUserNameById(userIds[0]), getUserNameById(userIds[0])], {
        concurrency: "unbounded",
        discard: true
      })
      const requests = yield* Effect.service(Requests)
      const invocations = yield* Effect.service(Counter)
      expect(requests.count).toEqual(2)
      expect(invocations.count).toEqual(1)
    }, provideEnv)
  )
})
