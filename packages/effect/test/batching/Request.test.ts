import { assert, describe, expect, it } from "@effect/vitest"
import { Cause, Effect, Exit, Fiber, ServiceMap } from "effect"
import { Request, RequestResolver as Resolver } from "effect/batching"
import { Array } from "effect/collections"
import { Data } from "effect/data"
import { flow, pipe } from "effect/Function"

class Counter extends ServiceMap.Key<Counter, { count: number }>()("Counter") {}
class Requests extends ServiceMap.Key<Requests, { count: number }>()("Requests") {}
const Interrupts = ServiceMap.Reference("Interrupts", {
  defaultValue: () => ({ interrupts: 0 })
})
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

interface GetAllIds extends Request.Request<ReadonlyArray<number>> {
  readonly _tag: "GetAllIds"
}
const GetAllIds = Request.tagged<GetAllIds>("GetAllIds")

class GetNameById extends Request.TaggedClass("GetNameById")<
  {
    readonly id: number
  },
  string,
  string
> {}

const makeUserResolver = Effect.gen(function*() {
  const counter = yield* Counter
  const requests_ = yield* Requests

  const resolver = Resolver.make<UserRequest>(Effect.fnUntraced(function*(entries) {
    counter.count++
    requests_.count += entries.length
    for (const entry of entries) {
      yield* delay(processRequest(entry))
    }
  })).pipe(Resolver.batchN(15))

  const getIds = Effect.request(GetAllIds({}), resolver)
  const getNameById = (id: number) => Effect.request(new GetNameById({ id }), resolver)
  const getNameByIdPiped = (id: number) => pipe(new GetNameById({ id }), Effect.request(resolver))
  const getNames = getIds.pipe(
    Effect.flatMap(Effect.forEach(getNameById, { concurrency: "unbounded" })),
    Effect.onInterrupt(Effect.tap(Interrupts.asEffect(), (i) => i.interrupts++))
  )

  return { getNames, getIds, getNameById, getNameByIdPiped } as const
})

const makeUserResolverTagged = Effect.gen(function*() {
  const counter = yield* Counter
  const requests = yield* Requests

  const resolver = Resolver.fromEffectTagged<UserRequest>()({
    GetAllIds: Effect.fnUntraced(function*(reqs) {
      counter.count++
      requests.count += reqs.length
      return reqs.map(() => userIds)
    }),
    GetNameById: Effect.fnUntraced(function*(reqs) {
      counter.count++
      requests.count += reqs.length

      const names: Array<string> = []
      for (let i = 0; i < reqs.length; i++) {
        const req = reqs[i]
        if (!userNames.has(req.request.id)) return yield* Effect.fail("Not Found")
        names.push(userNames.get(req.request.id)!)
      }
      return names
    })
  }).pipe(Resolver.batchN(15))

  const getIds = Effect.request(GetAllIds({}), resolver)
  const getNameById = (id: number) => Effect.request(new GetNameById({ id }), resolver)
  const allNames = getIds.pipe(
    Effect.flatMap(Effect.forEach(getNameById, { concurrency: "unbounded" }))
  )

  return { allNames, getIds, getNameById } as const
})

const processRequest = (entry: Request.Entry<UserRequest>): Effect.Effect<void> => {
  switch (entry.request._tag) {
    case "GetAllIds": {
      return Request.complete(entry, Exit.succeed(userIds))
    }
    case "GetNameById": {
      if (userNames.has(entry.request.id)) {
        const userName = userNames.get(entry.request.id)!
        return Request.complete(entry, Exit.succeed(userName))
      }
      return Request.completeEffect(entry, Exit.fail("Not Found"))
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
      const { getNames } = yield* makeUserResolver
      const names = yield* getNames
      const counter = yield* Counter
      const requests = yield* Requests
      assert.strictEqual(counter.count, 3)
      assert.strictEqual(requests.count, userIds.length + 1)
      assert.deepStrictEqual(names, userIds.map((id) => userNames.get(id)))
    }, provideEnv)
  )

  it.effect(
    "requests with dual syntax are executed correctly",
    Effect.fnUntraced(function*() {
      const names = yield* (yield* makeUserResolver).getNames
      const counter = yield* Counter
      const requests = yield* Requests
      assert.strictEqual(counter.count, 3)
      assert.strictEqual(requests.count, userIds.length + 1)
      assert.deepStrictEqual(names, userIds.map((id) => userNames.get(id)))
    }, provideEnv)
  )

  it.effect(
    "requests are executed correctly with fromEffectTagged",
    Effect.fnUntraced(function*() {
      const { allNames } = yield* makeUserResolverTagged
      const names = yield* allNames
      const count = yield* Counter
      expect(count.count).toEqual(3)
      expect(names.length).toBeGreaterThan(2)
      expect(names).toEqual(userIds.map((id) => userNames.get(id)))
    }, provideEnv)
  )

  it.effect(
    "requests don't break interruption",
    Effect.fnUntraced(
      function*() {
        const { getNames } = yield* makeUserResolver
        const fiber = yield* Effect.fork(getNames)
        yield* Effect.yieldNow
        yield* Fiber.interrupt(fiber)
        const exit = yield* Fiber.await(fiber)
        expect(exit._tag).toEqual("Failure")
        if (exit._tag === "Failure") {
          expect(Cause.isInterruptedOnly(exit.cause)).toEqual(true)
        }
        expect(yield* Counter).toEqual({ count: 0 })
        expect(yield* Interrupts).toEqual({ interrupts: 1 })
      },
      provideEnv,
      Effect.provideService(Interrupts, { interrupts: 0 })
    )
  )

  it.effect(
    "requests work with uninterruptible",
    Effect.fnUntraced(
      function*() {
        const { getNames } = yield* makeUserResolver
        const fiber = yield* Effect.fork(Effect.uninterruptible(getNames))
        yield* Effect.yieldNow
        yield* Fiber.interrupt(fiber)
        const exit = yield* Fiber.await(fiber)
        expect(exit._tag).toEqual("Failure")
        if (exit._tag === "Failure") {
          expect(Cause.isInterruptedOnly(exit.cause)).toEqual(true)
        }
        expect(yield* Counter).toEqual({ count: 3 })
        expect(yield* Interrupts).toEqual({ interrupts: 0 })
      },
      provideEnv,
      Effect.provideService(Interrupts, { interrupts: 0 })
    )
  )

  it.effect(
    "batching preserves individual & identical requests",
    Effect.fnUntraced(function*() {
      const { getNameById } = yield* makeUserResolver
      yield* Effect.all([getNameById(userIds[0]), getNameById(userIds[0])], {
        concurrency: "unbounded",
        discard: true
      })
      const requests = yield* Requests
      const invocations = yield* Counter
      expect(requests.count).toEqual(2)
      expect(invocations.count).toEqual(1)
    }, provideEnv)
  )

  it.effect(
    "grouped requests + batchN",
    Effect.fnUntraced(function*() {
      let count = 0
      let requestsCount = 0

      class Key extends Data.Class<{ id: number }> {}

      const resolver = Resolver.make<GetNameById>(Effect.fnUntraced(function*(entries) {
        count++
        requestsCount += entries.length
        for (const entry of entries) {
          entry.completeUnsafe(Exit.succeed(userNames.get(entry.request.id)!))
        }
      })).pipe(
        Resolver.batchN(5),
        Resolver.grouped(({ request }) => new Key({ id: request.id % 2 }))
      )

      yield* Effect.forEach(userIds, (id) => Effect.request(new GetNameById({ id }), resolver), {
        concurrency: "unbounded"
      })

      expect(count).toEqual(6)
      expect(requestsCount).toEqual(26)
    })
  )
})
