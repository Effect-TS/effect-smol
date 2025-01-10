import { Effect, Exit, Fiber, Mailbox, Option, Stream } from "effect"
import { assert, describe, it } from "./utils/extend.js"

describe("Mailbox", () => {
  it.effect("offerAll with capacity", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number>(2)
      const fiber = yield* Mailbox.offerAll(mailbox, [1, 2, 3, 4]).pipe(
        Effect.fork
      )
      yield* Effect.yieldNow
      assert.isUndefined(fiber.unsafePoll())

      let result = yield* Mailbox.takeAll(mailbox)
      assert.deepStrictEqual(result[0], [1, 2])
      assert.isFalse(result[1])

      yield* Effect.yieldNow
      assert.isDefined(fiber.unsafePoll())

      result = yield* Mailbox.takeAll(mailbox)
      assert.deepStrictEqual(result[0], [3, 4])
      assert.isFalse(result[1])

      yield* Effect.yieldNow
      assert.deepStrictEqual(fiber.unsafePoll(), Exit.succeed([]))
    }))

  it.effect("takeN", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number>()
      yield* Mailbox.offerAll(mailbox, [1, 2, 3, 4]).pipe(Effect.fork)
      const [a] = yield* Mailbox.takeN(mailbox, 2)
      const [b] = yield* Mailbox.takeN(mailbox, 2)
      assert.deepEqual(a, [1, 2])
      assert.deepEqual(b, [3, 4])
    }))

  it.effect("offer dropping", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number>({ capacity: 2, strategy: "dropping" })
      const remaining = yield* Mailbox.offerAll(mailbox, [1, 2, 3, 4])
      assert.deepStrictEqual(remaining, [3, 4])
      const result = yield* Mailbox.offer(mailbox, 5)
      assert.isFalse(result)
      assert.deepStrictEqual((yield* Mailbox.takeAll(mailbox))[0], [1, 2])
    }))

  it.effect("offer sliding", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number>({ capacity: 2, strategy: "sliding" })
      const remaining = yield* Mailbox.offerAll(mailbox, [1, 2, 3, 4])
      assert.deepStrictEqual(remaining, [])
      const result = yield* Mailbox.offer(mailbox, 5)
      assert.isTrue(result)
      assert.deepStrictEqual((yield* Mailbox.takeAll(mailbox))[0], [4, 5])
    }))

  it.effect("offerAll can be interrupted", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number>(2)
      const fiber = yield* Mailbox.offerAll(mailbox, [1, 2, 3, 4]).pipe(
        Effect.fork
      )

      yield* Effect.yieldNow
      yield* Fiber.interrupt(fiber)
      yield* Effect.yieldNow

      let result = yield* Mailbox.takeAll(mailbox)
      assert.deepStrictEqual(result[0], [1, 2])
      assert.isFalse(result[1])

      yield* Mailbox.offer(mailbox, 5)
      yield* Effect.yieldNow

      result = yield* Mailbox.takeAll(mailbox)
      assert.deepStrictEqual(result[0], [5])
      assert.isFalse(result[1])
    }))

  it.effect("done completes takes", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number>(2)
      const fiber = yield* Mailbox.takeAll(mailbox).pipe(
        Effect.fork
      )
      yield* Effect.yieldNow
      yield* Mailbox.done(mailbox, Exit.void)
      assert.deepStrictEqual(yield* Fiber.await(fiber), Exit.succeed([[] as Array<number>, true] as const))
    }))

  it.effect("end", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number>(2)
      yield* Effect.fork(Mailbox.offerAll(mailbox, [1, 2, 3, 4]))
      yield* Effect.fork(Mailbox.offerAll(mailbox, [5, 6, 7, 8]))
      yield* Effect.fork(Mailbox.offer(mailbox, 9))
      yield* Effect.fork(Mailbox.end(mailbox))
      const items = yield* Stream.runCollect(Stream.fromMailbox(mailbox))
      assert.deepStrictEqual(items, [1, 2, 3, 4, 5, 6, 7, 8, 9])
      assert.strictEqual(yield* Mailbox.await(mailbox), void 0)
      assert.strictEqual(yield* Mailbox.offer(mailbox, 10), false)
    }))

  it.effect("end with take", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number>(2)
      yield* Effect.fork(Mailbox.offerAll(mailbox, [1, 2]))
      yield* Effect.fork(Mailbox.offer(mailbox, 3))
      yield* Effect.fork(Mailbox.end(mailbox))
      assert.strictEqual(yield* Mailbox.take(mailbox), 1)
      assert.strictEqual(yield* Mailbox.take(mailbox), 2)
      assert.strictEqual(yield* Mailbox.take(mailbox), 3)
      assert.strictEqual(yield* Mailbox.take(mailbox).pipe(Effect.flip), Option.none())
      assert.strictEqual(yield* Mailbox.await(mailbox), void 0)
      assert.strictEqual(yield* Mailbox.offer(mailbox, 10), false)
    }))

  it.effect("fail", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number, string>(2)
      yield* Effect.fork(Mailbox.offerAll(mailbox, [1, 2, 3, 4]))
      yield* Effect.fork(Mailbox.offer(mailbox, 5))
      yield* Effect.fork(Mailbox.fail(mailbox, "boom"))
      const takeArr = Effect.map(Mailbox.takeAll(mailbox), ([_]) => _)
      assert.deepStrictEqual(yield* takeArr, [1, 2])
      assert.deepStrictEqual(yield* takeArr, [3, 4])
      const [items, done] = yield* Mailbox.takeAll(mailbox)
      assert.deepStrictEqual(items, [5])
      assert.strictEqual(done, false)
      const error = yield* Mailbox.takeAll(mailbox).pipe(Effect.flip)
      assert.deepStrictEqual(error, "boom")
      assert.strictEqual(yield* Mailbox.await(mailbox).pipe(Effect.flip), "boom")
      assert.strictEqual(yield* Mailbox.offer(mailbox, 6), false)
    }))

  it.effect("shutdown", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number>(2)
      yield* Effect.fork(Mailbox.offerAll(mailbox, [1, 2, 3, 4]))
      yield* Effect.fork(Mailbox.offerAll(mailbox, [5, 6, 7, 8]))
      yield* Effect.fork(Mailbox.shutdown(mailbox))
      const items = yield* Stream.runCollect(Stream.fromMailbox(mailbox))
      assert.deepStrictEqual(items, [])
      assert.strictEqual(yield* Mailbox.await(mailbox), void 0)
      assert.strictEqual(yield* Mailbox.offer(mailbox, 10), false)
    }))

  it.effect("fail doesnt drop items", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number, string>(2)
      yield* Effect.fork(Mailbox.offerAll(mailbox, [1, 2, 3, 4]))
      yield* Effect.fork(Mailbox.offer(mailbox, 5))
      yield* Effect.fork(Mailbox.fail(mailbox, "boom"))
      const items: Array<number> = []
      const error = yield* Stream.fromMailbox(mailbox).pipe(
        Stream.runForEach((item) => Effect.sync(() => items.push(item))),
        Effect.flip
      )
      assert.deepStrictEqual(items, [1, 2, 3, 4, 5])
      assert.strictEqual(error, "boom")
    }))

  it.effect("await waits for no items", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number>()
      const fiber = yield* Mailbox.await(mailbox).pipe(Effect.fork)
      yield* Effect.yieldNow
      yield* Mailbox.offer(mailbox, 1)
      yield* Mailbox.end(mailbox)

      yield* Effect.yieldNow
      assert.isUndefined(fiber.unsafePoll())
      const [result, done] = yield* Mailbox.takeAll(mailbox)
      assert.deepStrictEqual(result, [1])
      assert.isTrue(done)
      yield* Effect.yieldNow
      assert.isNotNull(fiber.unsafePoll())
    }))

  it.effect("bounded 0 capacity", () =>
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<number>(0)
      yield* Mailbox.offer(mailbox, 1).pipe(Effect.fork)
      let result = yield* Mailbox.take(mailbox)
      assert.strictEqual(result, 1)
      const fiber = yield* Mailbox.take(mailbox).pipe(Effect.fork)
      yield* Mailbox.offer(mailbox, 2)
      result = yield* Fiber.join(fiber)
      assert.strictEqual(result, 2)
    }))
})
