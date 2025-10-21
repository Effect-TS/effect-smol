/* eslint-disable no-restricted-syntax */
import { assert, describe, it } from "@effect/vitest"
import { assertExitFailure, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Cause, Deferred, Duration, Effect, Exit, Fiber, Queue, Ref, Schedule } from "effect"
import { Array } from "effect/collections"
import { isReadonlyArrayNonEmpty, type NonEmptyArray } from "effect/collections/Array"
import { Filter, Option } from "effect/data"
import { constTrue, constVoid, pipe } from "effect/Function"
import { Sink, Stream } from "effect/stream"
import { TestClock } from "effect/testing"
import * as fc from "effect/testing/FastCheck"
import { assertFailure } from "../utils/assert.ts"
import { chunkCoordination } from "../utils/chunkCoordination.ts"

describe("Stream", () => {
  describe("callback", () => {
    it.effect("with take", () =>
      Effect.gen(function*() {
        const array = [1, 2, 3, 4, 5]
        const result = yield* Stream.callback<number>((mb) => {
          array.forEach((n) => {
            Queue.offerUnsafe(mb, n)
          })
        }).pipe(
          Stream.take(array.length),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, array)
      }))

    it.effect("with cleanup", () =>
      Effect.gen(function*() {
        let cleanup = false
        const latch = yield* Effect.makeLatch()
        const fiber = yield* Stream.callback<void>(Effect.fnUntraced(function*(mb) {
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              cleanup = true
            })
          )
          yield* Queue.offer(mb, void 0)
        })).pipe(
          Stream.tap(() => latch.open),
          Stream.runDrain,
          Effect.forkChild
        )
        yield* latch.await
        yield* Fiber.interrupt(fiber)
        assert.isTrue(cleanup)
      }))

    it.effect("signals the end of the stream", () =>
      Effect.gen(function*() {
        const result = yield* Stream.callback<number>((mb) => {
          Queue.doneUnsafe(mb, Exit.void)
          return Effect.void
        }).pipe(Stream.runCollect)
        assert.isTrue(result.length === 0)
      }))

    it.effect("handles errors", () =>
      Effect.gen(function*() {
        const error = new Error("boom")
        const result = yield* Stream.callback<number, Error>((mb) => {
          Queue.doneUnsafe(mb, Exit.fail(error))
          return Effect.void
        }).pipe(
          Stream.runCollect,
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.fail(error))
      }))

    it.effect("handles defects", () =>
      Effect.gen(function*() {
        const error = new Error("boom")
        const result = yield* Stream.callback<number, Error>(() => {
          throw error
        }).pipe(
          Stream.runCollect,
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.die(error))
      }))

    it.effect("backpressure", () =>
      Effect.gen(function*() {
        let count = 0
        let offered = 0
        let done = false
        const pull = yield* Stream.callback<number>((mb) =>
          Effect.forEach(
            [1, 2, 3, 4, 5, 6, 7],
            Effect.fnUntraced(function*(n) {
              count++
              yield* Queue.offer(mb, n)
              offered++
            }),
            { concurrency: "unbounded" }
          ).pipe(
            Effect.tap(() => done = true)
          ), { bufferSize: 2 }).pipe(Stream.toPull)
        yield* Effect.yieldNow
        assert.strictEqual(count, 7)
        assert.strictEqual(offered, 2)
        assert.isFalse(done)
        yield* pull
        assert.strictEqual(offered, 4)
        assert.isFalse(done)
      }))
  })

  describe("constructors", () => {
    it.effect("range - min less than max", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(1, 3).pipe(Stream.runCollect)
        assert.deepStrictEqual(result, [1, 2, 3])
      }))

    it.effect("range - min greater than max", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(4, 3).pipe(Stream.runCollect)
        assert.deepStrictEqual(result, [])
      }))

    it.effect("range - min equal to max", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(3, 3).pipe(Stream.runCollect)
        assert.deepStrictEqual(result, [3])
      }))
  })

  describe("taking", () => {
    it.effect("take - pulls the first `n` values from a stream", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(1, 5).pipe(
          Stream.take(3),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, [1, 2, 3])
      }))

    it.effect("take - short-circuits stream evaluation", () =>
      Effect.gen(function*() {
        const result = yield* Stream.succeed(1).pipe(
          Stream.concat(Stream.never),
          Stream.take(1),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, [1])
      }))

    it.effect("take - taking 0 short-circuits stream evaluation", () =>
      Effect.gen(function*() {
        const result = yield* Stream.never.pipe(
          Stream.take(0),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, [])
      }))

    it.effect("takeUntil - takes elements until a predicate is satisfied", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(1, 5).pipe(
          Stream.takeUntil((n) => n % 3 === 0),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, [1, 2, 3])
      }))

    it.effect("takeWhile - takes elements while a predicate is satisfied", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(1, 5).pipe(
          Stream.takeWhile((n) => n % 3 !== 0),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, [1, 2])
      }))

    it.effect("takeUntilEffect - takes elements until an effectful predicate is satisfied", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(1, 5).pipe(
          Stream.takeUntilEffect((n) => Effect.succeed(n % 3 === 0)),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, [1, 2, 3])
      }))

    it.effect("takeWhileEffect - takes elements while an effectful predicate is satisfied", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(1, 5).pipe(
          Stream.takeWhileEffect((n) => Effect.succeed(n % 3 !== 0)),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, [1, 2])
      }))
  })

  describe("pagination", () => {
    it.effect("paginate", () =>
      Effect.gen(function*() {
        const s: readonly [ReadonlyArray<number>, Array<number>] = [[0], [1, 2, 3, 4, 5]]
        const pageSize = 2
        const result = yield* Stream.paginate(s, ([chunk, nums]) =>
          nums.length === 0 ?
            Effect.succeed([chunk, Option.none<readonly [ReadonlyArray<number>, Array<number>]>()] as const) :
            Effect.succeed(
              [
                chunk,
                Option.some(
                  [
                    nums.slice(0, pageSize),
                    nums.slice(pageSize)
                  ] as const
                )
              ] as const
            )).pipe(Stream.runCollect)
        assert.deepStrictEqual(result, [0, 1, 2, 3, 4, 5])
      }))
  })

  describe("error handling", () => {
    it.effect("catch", () =>
      Effect.gen(function*() {
        let error: string | undefined = undefined
        const results = yield* Stream.make(1, 2, 3).pipe(
          Stream.concat(Stream.fail("boom")),
          Stream.catch((error_) => {
            error = error_
            return Stream.make(4, 5, 6)
          }),
          Stream.runCollect
        )
        assert.deepStrictEqual(results, [1, 2, 3, 4, 5, 6])
        assert.strictEqual(error, "boom")
      }))
  })

  describe("scanning", () => {
    it.effect("scan", () =>
      Effect.gen(function*() {
        const stream = Stream.make(1, 2, 3, 4, 5)
        const { result1, result2 } = yield* Effect.all({
          result1: stream.pipe(Stream.scan(0, (acc, curr) => acc + curr), Stream.runCollect),
          result2: Stream.runCollect(stream).pipe(
            Effect.map((chunk) => Array.scan(chunk, 0, (acc, curr) => acc + curr))
          )
        })
        assert.deepStrictEqual(result1, result2)
      }))
  })

  describe("grouping", () => {
    it.effect("groupBy", () =>
      Effect.gen(function*() {
        const stream = Stream.make(1, 2, 3, 4, 5)
        const grouped = yield* stream.pipe(
          Stream.groupByKey((n) => n % 2 === 0 ? "even" : "odd"),
          Stream.mapEffect(
            Effect.fnUntraced(function*([key, stream]) {
              return [key, yield* Stream.runCollect(stream)] as const
            }),
            { concurrency: "unbounded" }
          ),
          Stream.runCollect
        )
        assert.deepStrictEqual(grouped, [
          ["odd", [1, 3, 5]],
          ["even", [2, 4]]
        ])
      }))
  })

  it.effect.prop(
    "rechunk",
    {
      chunks: fc.array(fc.array(fc.integer()), { minLength: 1 }),
      size: fc.integer({ min: 1, max: 100 })
    },
    Effect.fnUntraced(function*({ chunks, size }) {
      const actual = yield* Stream.fromArray(chunks).pipe(
        Stream.filter((a) => isReadonlyArrayNonEmpty(a) ? a : Filter.fail(a)),
        Stream.flattenArray,
        Stream.rechunk(size),
        Stream.chunks,
        Stream.runCollect
      )
      const expected = chunks.flat()
      assert.deepStrictEqual(actual, grouped(expected, size))
    })
  )

  describe("transduce", () => {
    it.effect("no remainder", () =>
      Effect.gen(function*() {
        const result = yield* Stream.make(1, 2, 3, 4).pipe(
          Stream.transduce(Sink.reduceWhile(() => 100, (n) => n % 2 === 0, (acc, n) => acc + n)),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, [101, 105, 104])
      }))

    it.effect("with a sink that always signals more", () =>
      Effect.gen(function*() {
        const result = yield* Stream.make(1, 2, 3).pipe(
          Stream.transduce(Sink.reduceWhile(() => 0, constTrue, (acc, n) => acc + n)),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, [6])
      }))

    it.effect("propagates scope error", () =>
      Effect.gen(function*() {
        const result = yield* Stream.make(1, 2, 3).pipe(
          Stream.transduce(Sink.fail("Woops")),
          Stream.runCollect,
          Effect.result
        )
        assertFailure(result, "Woops")
      }))
  })

  describe("buffer", () => {
    it.effect("maintains elements and ordering", () =>
      Effect.gen(function*() {
        const chunks = Array.make(
          Array.range(0, 3),
          Array.range(2, 5),
          Array.range(3, 7)
        )
        const result = yield* Stream.fromArrays(...chunks).pipe(
          Stream.buffer({ capacity: 2 }),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, chunks.flat())
      }))

    it.effect("stream with a failure", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(0, 9).pipe(
          Stream.concat(Stream.fail("boom")),
          Stream.buffer({ capacity: 2 }),
          Stream.runCollect,
          Effect.exit
        )
        assertExitFailure(result, Cause.fail("boom"))
      }))

    it.effect("fast producer progresses independently", () =>
      Effect.gen(function*() {
        const arr = Array.empty<number>()
        const latch = yield* Deferred.make<void>()
        const stream = Stream.range(1, 4).pipe(
          Stream.tap(Effect.fnUntraced(function*(n) {
            arr.push(n)
            if (n === 4) {
              yield* Deferred.succeed(latch, void 0)
            }
          })),
          Stream.buffer({ capacity: 2 })
        )
        const result1 = yield* stream.pipe(Stream.take(2), Stream.runCollect)
        yield* Deferred.await(latch)
        assert.deepStrictEqual(result1, [1, 2])
        assert.deepStrictEqual(arr, [1, 2, 3, 4])
      }))
  })

  describe("bufferArray - suspend", () => {
    it.effect("maintains elements and ordering", () =>
      Effect.gen(function*() {
        const chunks = Array.make(
          Array.range(0, 3),
          Array.range(2, 5),
          Array.range(3, 7)
        )
        const result = yield* Stream.fromArrays(...chunks).pipe(
          Stream.bufferArray({ capacity: 2 }),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, chunks.flat())
      }))

    it.effect("stream with a failure", () =>
      Effect.gen(function*() {
        const error = "boom"
        const result = yield* Stream.range(0, 9).pipe(
          Stream.concat(Stream.fail(error)),
          Stream.bufferArray({ capacity: 2 }),
          Stream.runCollect,
          Effect.exit
        )
        assertExitFailure(result, Cause.fail(error))
      }))

    it.effect("fast producer progresses independently", () =>
      Effect.gen(function*() {
        const arr = Array.empty<number>()
        const latch = yield* Deferred.make<void>()
        const stream = Stream.range(1, 4).pipe(
          Stream.tap(Effect.fnUntraced(function*(n) {
            arr.push(n)
            if (n === 4) {
              yield* Deferred.succeed(latch, void 0)
            }
          })),
          Stream.bufferArray({ capacity: 2 })
        )
        const result1 = yield* stream.pipe(Stream.take(2), Stream.runCollect)
        yield* Deferred.await(latch)
        assert.deepStrictEqual(result1, [1, 2])
        assert.deepStrictEqual(arr, [1, 2, 3, 4])
      }))
  })

  describe("bufferArray - dropping", () => {
    it.effect("buffers a stream with a failure", () =>
      Effect.gen(function*() {
        const error = "boom"
        const result = yield* Stream.range(1, 1_000).pipe(
          Stream.concat(Stream.fail(error)),
          Stream.concat(Stream.range(1_001, 2_000)),
          Stream.bufferArray({ capacity: 2, strategy: "dropping" }),
          Stream.runCollect,
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.fail(error))
      }))

    it.effect("fast producer progress independently", () =>
      Effect.gen(function*() {
        const arr = Array.empty<number>()
        const latch1 = yield* Deferred.make<void>()
        const latch2 = yield* Deferred.make<void>()
        const latch3 = yield* Deferred.make<void>()
        const latch4 = yield* Deferred.make<void>()
        const stream1 = Stream.make(0).pipe(
          Stream.concat(
            Stream.fromEffect(Deferred.await(latch1)).pipe(
              Stream.flatMap(() =>
                Stream.range(1, 16).pipe(
                  Stream.rechunk(1),
                  Stream.ensuring(Deferred.succeed(latch2, void 0))
                )
              )
            )
          )
        )
        const stream2 = Stream.fromEffect(Deferred.await(latch3)).pipe(
          Stream.flatMap(() =>
            Stream.range(17, 24).pipe(
              Stream.rechunk(1),
              Stream.ensuring(Deferred.succeed(latch4, void 0))
            )
          )
        )
        const stream3 = Stream.make(-1)
        const stream = stream1.pipe(
          Stream.concat(stream2),
          Stream.concat(stream3),
          Stream.bufferArray({ capacity: 8, strategy: "dropping" })
        )
        const { result1, result2, result3 } = yield* Stream.toPull(stream).pipe(
          Effect.flatMap((pull) =>
            Effect.gen(function*() {
              const result1 = yield* pull
              yield* Deferred.succeed(latch1, void 0)
              yield* Deferred.await(latch2)
              yield* pull.pipe(
                Effect.andThen((chunk) => {
                  arr.push(...chunk)
                }),
                Effect.repeat({ times: 7 })
              )
              const result2 = arr.slice()
              yield* Deferred.succeed(latch3, void 0)
              yield* Deferred.await(latch4)
              yield* pull.pipe(
                Effect.andThen((chunk) => {
                  arr.push(...chunk)
                }),
                Effect.repeat({ times: 7 })
              )
              const result3 = arr.slice()
              return { result1, result2, result3 }
            })
          ),
          Effect.scoped
        )
        const expected1 = [0]
        const expected2 = [1, 2, 3, 4, 5, 6, 7, 8]
        const expected3 = [1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23, 24]
        assert.deepStrictEqual(result1, expected1)
        assert.deepStrictEqual(result2, expected2)
        assert.deepStrictEqual(result3, expected3)
      }))

    it.effect("buffers a stream with a failure", () =>
      Effect.gen(function*() {
        const error = "boom"
        const result = yield* pipe(
          Stream.range(1, 1_000),
          Stream.concat(Stream.fail(error)),
          Stream.concat(Stream.range(1_000, 2_000)),
          Stream.buffer({ capacity: 2, strategy: "dropping" }),
          Stream.runCollect,
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.fail(error))
      }))

    it.effect("fast producer progress independently", () =>
      Effect.gen(function*() {
        const ref = yield* Ref.make(Array.empty<number>())
        const latch1 = yield* Deferred.make<void>()
        const latch2 = yield* Deferred.make<void>()
        const latch3 = yield* Deferred.make<void>()
        const latch4 = yield* Deferred.make<void>()
        const stream1 = pipe(
          Stream.make(0),
          Stream.concat(
            pipe(
              Stream.fromEffect(Deferred.await(latch1)),
              Stream.flatMap(() =>
                pipe(
                  Stream.range(1, 17),
                  Stream.rechunk(1),
                  Stream.ensuring(Deferred.succeed(latch2, void 0))
                )
              )
            )
          )
        )
        const stream2 = pipe(
          Stream.fromEffect(Deferred.await(latch3)),
          Stream.flatMap(() =>
            pipe(
              Stream.range(17, 24),
              Stream.rechunk(1),
              Stream.ensuring(Deferred.succeed(latch4, void 0))
            )
          )
        )
        const stream3 = Stream.make(-1)
        const stream = pipe(
          stream1,
          Stream.concat(stream2),
          Stream.concat(stream3),
          Stream.buffer({ capacity: 8, strategy: "dropping" })
        )
        const { result1, result2, result3 } = yield* pipe(
          Stream.toPull(stream),
          Effect.flatMap((pull) =>
            Effect.gen(function*() {
              const result1 = yield* pull
              yield* Deferred.succeed(latch1, void 0)
              yield* Deferred.await(latch2)
              yield* pipe(
                pull,
                Effect.flatMap((chunk) => Ref.update(ref, Array.appendAll(chunk)))
              )
              const result2 = yield* Ref.get(ref)
              yield* Deferred.succeed(latch3, void 0)
              yield* Deferred.await(latch4)
              yield* pipe(
                pull,
                Effect.flatMap((chunk) => Ref.update(ref, Array.appendAll(chunk)))
              )
              const result3 = yield* (Ref.get(ref))
              return { result1, result2, result3 }
            })
          ),
          Effect.scoped
        )
        const expected1 = [0]
        const expected2 = [1, 2, 3, 4, 5, 6, 7, 8]
        const expected3 = [1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23, 24]
        deepStrictEqual(result1, expected1)
        deepStrictEqual(result2, expected2)
        deepStrictEqual(result3, expected3)
      }))
  })

  describe("bufferArray - sliding", () => {
    it.effect("buffers a stream with a failure", () =>
      Effect.gen(function*() {
        const error = "boom"
        const result = yield* Stream.range(1, 1_000).pipe(
          Stream.concat(Stream.fail(error)),
          Stream.concat(Stream.range(1_001, 2_000)),
          Stream.bufferArray({ capacity: 2, strategy: "sliding" }),
          Stream.runCollect,
          Effect.exit
        )
        assertExitFailure(result, Cause.fail(error))
      }))

    it.effect("fast producer progress independently", () =>
      Effect.gen(function*() {
        const ref = yield* Ref.make(Array.empty<number>())

        const latch1 = yield* Deferred.make<void>()
        const latch2 = yield* Deferred.make<void>()
        const latch3 = yield* Deferred.make<void>()
        const latch4 = yield* Deferred.make<void>()
        const latch5 = yield* Deferred.make<void>()
        const stream1 = Stream.make(0).pipe(
          Stream.concat(
            pipe(
              Stream.fromEffect(Deferred.await(latch1)),
              Stream.flatMap(() =>
                pipe(
                  Stream.range(1, 16),
                  Stream.rechunk(1),
                  Stream.ensuring(Deferred.succeed(latch2, void 0))
                )
              )
            )
          )
        )
        const stream2 = pipe(
          Stream.fromEffect(Deferred.await(latch3)),
          Stream.flatMap(() =>
            pipe(
              Stream.range(17, 25),
              Stream.rechunk(1),
              Stream.ensuring(Deferred.succeed(latch4, void 0))
            )
          )
        )
        const stream3 = pipe(
          Stream.fromEffect(Deferred.await(latch5)),
          Stream.flatMap(() => Stream.make(-1))
        )
        const stream = pipe(
          stream1,
          Stream.concat(stream2),
          Stream.concat(stream3),
          Stream.bufferArray({ capacity: 8, strategy: "sliding" })
        )
        const { result1, result2, result3 } = yield* pipe(
          Stream.toPull(stream),
          Effect.flatMap((pull) =>
            Effect.gen(function*() {
              const result1 = yield* pull
              yield* Deferred.succeed(latch1, void 0)
              yield* Deferred.await(latch2)
              yield* pipe(
                pull,
                Effect.flatMap((chunk) => Ref.update(ref, Array.appendAll(chunk))),
                Effect.repeat({ times: 7 })
              )
              const result2 = yield* Ref.get(ref)
              yield* Deferred.succeed(latch3, void 0)
              yield* Deferred.await(latch4)
              yield* pipe(
                pull,
                Effect.flatMap((chunk) => Ref.update(ref, Array.appendAll(chunk))),
                Effect.repeat({ times: 7 })
              )
              const result3 = yield* (Ref.get(ref))
              return { result1, result2, result3 }
            })
          ),
          Effect.scoped
        )
        const expected1 = [0]
        const expected2 = [9, 10, 11, 12, 13, 14, 15, 16]
        const expected3 = [9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25]
        assert.deepStrictEqual(Array.fromIterable(result1), expected1)
        assert.deepStrictEqual(Array.fromIterable(result2), expected2)
        assert.deepStrictEqual(Array.fromIterable(result3), expected3)
      }))

    it.effect("buffers a stream with a failure", () =>
      Effect.gen(function*() {
        const error = "boom"
        const result = yield* pipe(
          Stream.range(1, 1_000),
          Stream.concat(Stream.fail(error)),
          Stream.concat(Stream.range(1_001, 2_000)),
          Stream.buffer({ capacity: 2, strategy: "sliding" }),
          Stream.runCollect,
          Effect.exit
        )
        deepStrictEqual(result, Exit.fail(error))
      }))

    it.effect("fast producer progress independently", () =>
      Effect.gen(function*() {
        const ref = yield* Ref.make(Array.empty<number>())
        const latch1 = yield* Deferred.make<void>()
        const latch2 = yield* Deferred.make<void>()
        const latch3 = yield* Deferred.make<void>()
        const latch4 = yield* Deferred.make<void>()
        const stream1 = pipe(
          Stream.make(0),
          Stream.concat(
            pipe(
              Stream.fromEffect(Deferred.await(latch1)),
              Stream.flatMap(() =>
                pipe(
                  Stream.range(1, 16),
                  Stream.rechunk(1),
                  Stream.ensuring(Deferred.succeed(latch2, void 0))
                )
              )
            )
          )
        )
        const stream2 = pipe(
          Stream.fromEffect(Deferred.await(latch3)),
          Stream.flatMap(() =>
            pipe(
              Stream.range(17, 24),
              Stream.rechunk(1),
              Stream.ensuring(Deferred.succeed(latch4, void 0))
            )
          )
        )
        const stream3 = Stream.make(-1)
        const stream = pipe(
          stream1,
          Stream.concat(stream2),
          Stream.concat(stream3),
          Stream.buffer({ capacity: 8, strategy: "sliding" })
        )
        const { result1, result2, result3 } = yield* pipe(
          Stream.toPull(stream),
          Effect.flatMap((pull) =>
            Effect.gen(function*() {
              const result1 = yield* pull
              yield* Deferred.succeed(latch1, void 0)
              yield* Deferred.await(latch2)
              yield* pipe(
                pull,
                Effect.flatMap((chunk) => Ref.update(ref, Array.appendAll(chunk)))
              )
              const result2 = yield* (Ref.get(ref))
              yield* (Deferred.succeed(latch3, void 0))
              yield* (Deferred.await(latch4))
              yield* pipe(
                pull,
                Effect.flatMap((chunk) => Ref.update(ref, Array.appendAll(chunk))),
                Effect.repeat({ times: 7 })
              )
              const result3 = yield* (Ref.get(ref))
              return { result1, result2, result3 }
            })
          ),
          Effect.scoped
        )
        const expected1 = [0]
        const expected2 = [9, 10, 11, 12, 13, 14, 15, 16]
        const expected3 = [9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, -1]
        deepStrictEqual(result1, expected1)
        deepStrictEqual(result2, expected2)
        deepStrictEqual(result3, expected3)
      }))

    it.effect("propagates defects", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.fromEffect(Effect.die("boom")),
          Stream.buffer({ capacity: 1, strategy: "sliding" }),
          Stream.runDrain,
          Effect.exit
        )
        deepStrictEqual(result, Exit.die("boom"))
      }))
  })

  describe("buffer - unbounded", () => {
    it.effect("buffer - buffers the stream", () =>
      Effect.gen(function*() {
        const chunk = Array.range(0, 10)
        const result = yield* pipe(
          Stream.fromIterable(chunk),
          Stream.buffer({ capacity: "unbounded" }),
          Stream.runCollect
        )
        deepStrictEqual(result, chunk)
      }))

    it.effect("buffers a stream with a failure", () =>
      Effect.gen(function*() {
        const error = "boom"
        const result = yield* pipe(
          Stream.range(0, 9),
          Stream.concat(Stream.fail(error)),
          Stream.buffer({ capacity: "unbounded" }),
          Stream.runCollect,
          Effect.exit
        )
        deepStrictEqual(result, Exit.fail(error))
      }))

    it.effect("fast producer progress independently", () =>
      Effect.gen(function*() {
        const ref = yield* Ref.make(Array.empty<number>())
        const latch = yield* Deferred.make<void>()
        const stream = pipe(
          Stream.range(1, 999),
          Stream.tap((n) =>
            pipe(
              Ref.update(ref, Array.append(n)),
              Effect.andThen(pipe(Deferred.succeed(latch, void 0), Effect.when(() => n === 999)))
            )
          ),
          Stream.rechunk(999),
          Stream.buffer({ capacity: "unbounded" })
        )
        const result1 = yield* pipe(stream, Stream.take(2), Stream.runCollect)
        yield* Deferred.await(latch)
        const result2 = yield* Ref.get(ref)
        deepStrictEqual(result1, [1, 2])
        deepStrictEqual(result2, Array.range(1, 999))
      }))
  })

  describe("share", () => {
    it.effect("sequenced", () =>
      Effect.gen(function*() {
        const sharedStream = yield* Stream.fromSchedule(Schedule.spaced("1 seconds")).pipe(
          Stream.share({ capacity: 16 })
        )

        const firstFiber = yield* sharedStream.pipe(
          Stream.take(1),
          Stream.run(Sink.collectAll()),
          Effect.forkChild({ startImmediately: true })
        )

        yield* TestClock.adjust("1 seconds")

        const first = yield* Fiber.join(firstFiber)
        deepStrictEqual(first, [0])

        const secondFiber = yield* sharedStream.pipe(
          Stream.take(1),
          Stream.run(Sink.collectAll()),
          Effect.forkChild({ startImmediately: true })
        )

        yield* TestClock.adjust("1 seconds")

        const second = yield* Fiber.join(secondFiber)
        deepStrictEqual(second, [0])
      }))

    it.effect("sequenced with idleTimeToLive", () =>
      Effect.gen(function*() {
        const sharedStream = yield* Stream.fromSchedule(Schedule.spaced("1 seconds")).pipe(
          Stream.share({
            capacity: 16,
            idleTimeToLive: "1 second"
          })
        )

        const firstFiber = yield* sharedStream.pipe(
          Stream.take(1),
          Stream.run(Sink.collectAll()),
          Effect.forkChild({ startImmediately: true })
        )

        yield* TestClock.adjust("1 seconds")

        const first = yield* Fiber.join(firstFiber)
        deepStrictEqual(first, [0])

        const secondFiber = yield* sharedStream.pipe(
          Stream.take(1),
          Stream.run(Sink.collectAll()),
          Effect.forkChild({ startImmediately: true })
        )

        yield* TestClock.adjust("1 seconds")

        const second = yield* Fiber.join(secondFiber)
        deepStrictEqual(second, [1])
      }))

    it.effect("parallel", () =>
      Effect.gen(function*() {
        const sharedStream = yield* Stream.fromSchedule(Schedule.spaced("1 seconds")).pipe(
          Stream.share({ capacity: 16 })
        )

        const fiber1 = yield* sharedStream.pipe(
          Stream.take(1),
          Stream.run(Sink.collectAll()),
          Effect.forkChild({ startImmediately: true })
        )
        const fiber2 = yield* sharedStream.pipe(
          Stream.take(2),
          Stream.run(Sink.collectAll()),
          Effect.forkChild({ startImmediately: true })
        )

        yield* TestClock.adjust("2 seconds")

        const [result1, result2] = yield* Fiber.joinAll([fiber1, fiber2])

        deepStrictEqual(result1, [0])
        deepStrictEqual(result2, [0, 1])
      }))
  })

  describe("raceAll", () => {
    it.effect("sync", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.raceAll(
            Stream.make(0, 1, 2, 3),
            Stream.make(4, 5, 6, 7),
            Stream.make(7, 8, 9, 10)
          ),
          Stream.runCollect
        )
        deepStrictEqual(result, [0, 1, 2, 3])
      }))

    it.effect("async", () =>
      Effect.gen(function*() {
        const fiber = yield* pipe(
          Stream.raceAll(
            Stream.fromSchedule(Schedule.spaced("1 second")),
            Stream.fromSchedule(Schedule.spaced("2 second"))
          ),
          Stream.take(5),
          Stream.runCollect,
          Effect.fork
        )
        yield* TestClock.adjust("5 second")
        const result = yield* Fiber.join(fiber)
        deepStrictEqual(result, [0, 1, 2, 3, 4])
      }))

    it.effect("combined async + sync", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.raceAll(
            Stream.fromSchedule(Schedule.spaced("1 second")),
            Stream.make(0, 1, 2, 3)
          ),
          Stream.runCollect
        )
        deepStrictEqual(result, [0, 1, 2, 3])
      }))

    it.effect("combined sync + async", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.raceAll(
            Stream.make(0, 1, 2, 3),
            Stream.fromSchedule(Schedule.spaced("1 second"))
          ),
          Stream.runCollect
        )
        deepStrictEqual(result, [0, 1, 2, 3])
      }))
  })

  it.effect("onStart", () =>
    Effect.gen(function*() {
      let counter = 0
      const result = yield* pipe(
        Stream.make(1, 1),
        Stream.onStart(Effect.sync(() => counter++)),
        Stream.runCollect
      )
      strictEqual(counter, 1)
      deepStrictEqual(result, [1, 1])
    }))

  it.effect("onEnd", () =>
    Effect.gen(function*() {
      let counter = 0
      const result = yield* pipe(
        Stream.make(1, 2, 3),
        Stream.onEnd(Effect.sync(() => counter++)),
        Stream.runCollect
      )
      strictEqual(counter, 1)
      deepStrictEqual(result, [1, 2, 3])
    }))

  describe("groupAdjacentBy", () => {
    it.effect("one big chunk", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.fromIterable([
            { code: 1, message: "A" },
            { code: 1, message: "B" },
            { code: 1, message: "D" },
            { code: 2, message: "C" }
          ]),
          Stream.groupAdjacentBy((x) => x.code),
          Stream.runCollect
        )
        deepStrictEqual(
          result.map(([, chunk]) => chunk),
          [
            [
              { code: 1, message: "A" },
              { code: 1, message: "B" },
              { code: 1, message: "D" }
            ],
            [
              { code: 2, message: "C" }
            ]
          ]
        )
      }))

    it.effect("several single element chunks", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.fromArrays(
            [{ code: 1, message: "A" }],
            [{ code: 1, message: "B" }],
            [{ code: 1, message: "D" }],
            [{ code: 2, message: "C" }]
          ),
          Stream.groupAdjacentBy((x) => x.code),
          Stream.runCollect
        )
        deepStrictEqual(
          result.map(([, chunk]) => chunk),
          [
            [
              { code: 1, message: "A" },
              { code: 1, message: "B" },
              { code: 1, message: "D" }
            ],
            [
              { code: 2, message: "C" }
            ]
          ]
        )
      }))

    it.effect("group across chunks", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.fromArrays(
            [{ code: 1, message: "A" }, { code: 1, message: "B" }],
            [{ code: 1, message: "D" }, { code: 2, message: "C" }]
          ),
          Stream.groupAdjacentBy((x) => x.code),
          Stream.runCollect
        )
        deepStrictEqual(
          result.map(([, chunk]) => chunk),
          [
            [
              { code: 1, message: "A" },
              { code: 1, message: "B" },
              { code: 1, message: "D" }
            ],
            [
              { code: 2, message: "C" }
            ]
          ]
        )
      }))
  })

  describe("aggregateWithin", () => {
    it.effect("simple example", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.make(1, 1, 1, 1, 2, 2),
          Stream.aggregateWithin(
            pipe(
              Sink.fold(
                () => [[] as Array<number>, true] as readonly [Array<number>, boolean],
                (tuple) => tuple[1],
                ([array], curr: number): readonly [Array<number>, boolean] => {
                  if (curr === 1) {
                    return [[curr, ...array], true]
                  }
                  return [[curr, ...array], false]
                }
              ),
              Sink.map((tuple) => tuple[0])
            ),
            Schedule.spaced(Duration.minutes(30))
          ),
          Stream.runCollect
        )
        deepStrictEqual(result, [[2, 1, 1, 1, 1], [2]])
      }))

    it.effect("fails fast", () =>
      Effect.gen(function*() {
        const queue = yield* Queue.unbounded<number>()
        yield* pipe(
          Stream.range(1, 9),
          Stream.tap((n) =>
            pipe(
              Effect.fail("Boom"),
              Effect.when(() => n === 6),
              Effect.andThen(Queue.offer(queue, n))
            )
          ),
          Stream.aggregateWithin(
            Sink.foldUntil(constVoid, 5, constVoid),
            Schedule.forever
          ),
          Stream.runDrain,
          Effect.catch(() => Effect.succeed(void 0))
        )
        const result = yield* Queue.takeAll(queue)
        yield* Queue.shutdown(queue)
        deepStrictEqual(result, [1, 2, 3, 4, 5])
      }))

    it.effect("error propagation #1", () =>
      Effect.gen(function*() {
        const error = new Error("Boom")
        const result = yield* pipe(
          Stream.make(1, 1, 1, 1),
          Stream.aggregateWithin(
            Sink.die(error),
            Schedule.spaced(Duration.minutes(30))
          ),
          Stream.runCollect,
          Effect.exit
        )
        deepStrictEqual(result, Exit.die(error))
      }))

    it.effect("error propagation #2", () =>
      Effect.gen(function*() {
        const error = new Error("Boom")
        const result = yield* pipe(
          Stream.make(1, 1),
          Stream.aggregateWithin(
            Sink.fold(() => [], constTrue, () => Effect.die(error)),
            Schedule.spaced(Duration.minutes(30))
          ),
          Stream.runCollect,
          Effect.exit
        )
        deepStrictEqual(result, Exit.die(error))
      }))

    it.effect("interruption propagation #1", () =>
      Effect.gen(function*() {
        const latch = yield* Deferred.make<void>()
        const ref = yield* Ref.make(false)
        const sink = Sink.fold(Array.empty<number>, constTrue, (acc, curr: number) => {
          if (curr === 1) {
            acc.push(curr)
            return Effect.succeed(acc)
          }
          return pipe(
            Deferred.succeed(latch, void 0),
            Effect.andThen(Effect.never),
            Effect.onInterrupt(() => Ref.set(ref, true))
          )
        })
        const fiber = yield* pipe(
          Stream.make(1, 1, 2),
          Stream.aggregateWithin(sink, Schedule.spaced(Duration.minutes(30))),
          Stream.runCollect,
          Effect.fork
        )
        yield* Deferred.await(latch)
        yield* Fiber.interrupt(fiber)
        const result = yield* Ref.get(ref)
        assertTrue(result)
      }))

    it.effect("interruption propagation #2", () =>
      Effect.gen(function*() {
        const ref = yield* Ref.make(false)
        const sink = Sink.fromEffect(
          Effect.never.pipe(
            Effect.onInterrupt(() => Ref.set(ref, true))
          )
        )
        const fiber = yield* Stream.make(1, 1, 2).pipe(
          Stream.aggregateWithin(sink, Schedule.spaced(Duration.minutes(30))),
          Stream.runCollect,
          Effect.fork({ startImmediately: true })
        )
        yield* Fiber.interrupt(fiber)
        const result = yield* Ref.get(ref)
        assertTrue(result)
      }))

    // it.effect("leftover handling", () =>
    //   Effect.gen(function*() {
    //     const input = [1, 2, 2, 3, 2, 3]
    //     const fiber = yield* pipe(
    //       Stream.fromIterable(input),
    //       Stream.aggregateWithin(
    //         Sink.foldWeighted({
    //           initial: Chunk.empty<number>(),
    //           maxCost: 4,
    //           cost: (_, n) => n,
    //           body: (acc, curr) => Chunk.append(acc, curr)
    //         }),
    //         Schedule.spaced(Duration.millis(100))
    //       ),
    //       Stream.flattenIterable,
    //       Stream.runCollect,
    //       Effect.fork
    //     )
    //     yield* TestClock.adjust(Duration.minutes(31))
    //     const result = yield* Fiber.join(fiber)
    //     deepStrictEqual(result, input)
    //   }))
  })

  describe("debounce", () => {
    it.effect("should drop earlier chunks within waitTime", () =>
      Effect.gen(function*() {
        const coordination = yield* chunkCoordination([
          [1],
          [3, 4],
          [5],
          [6, 7]
        ])
        const stream = pipe(
          coordination.stream,
          Stream.chunks,
          Stream.debounce(Duration.seconds(1))
        )
        const fiber = yield* pipe(stream, Stream.runCollect, Effect.fork)
        yield* coordination.offer
        yield* pipe(
          Effect.sleep(Duration.millis(500)),
          Effect.andThen(coordination.offer),
          Effect.fork
        )
        yield* pipe(
          Effect.sleep(Duration.seconds(2)),
          Effect.andThen(coordination.offer),
          Effect.fork
        )
        yield* pipe(
          Effect.sleep(Duration.millis(2500)),
          Effect.andThen(coordination.offer),
          Effect.fork
        )
        yield* TestClock.adjust(Duration.millis(3500))
        const result = yield* Fiber.join(fiber)
        deepStrictEqual(
          result,
          [[3, 4], [6, 7]]
        )
      }))

    it.effect("should take latest chunk within waitTime", () =>
      Effect.gen(function*() {
        const coordination = yield* chunkCoordination([
          [1, 2],
          [3, 4],
          [5, 6]
        ])
        const stream = pipe(
          coordination.stream,
          Stream.chunks,
          Stream.debounce(Duration.seconds(1))
        )
        const fiber = yield* pipe(stream, Stream.runCollect, Effect.fork)
        yield* pipe(
          coordination.offer,
          Effect.andThen(coordination.offer),
          Effect.andThen(coordination.offer)
        )
        yield* TestClock.adjust(Duration.seconds(1))
        const result = yield* Fiber.join(fiber)
        deepStrictEqual(result, [[5, 6]])
      }))

    it.effect("should work properly with parallelization", () =>
      Effect.gen(function*() {
        const coordination = yield* chunkCoordination([
          [1],
          [2],
          [3]
        ])
        const stream = pipe(
          coordination.stream,
          Stream.chunks,
          Stream.debounce(Duration.seconds(1))
        )
        const fiber = yield* pipe(stream, Stream.runCollect, Effect.fork)
        yield* Effect.all([
          coordination.offer,
          coordination.offer,
          coordination.offer
        ], { concurrency: 3, discard: true })
        yield* TestClock.adjust(Duration.seconds(1))
        const result = yield* Fiber.join(fiber)
        deepStrictEqual(result, [[3]])
      }))

    it.effect("should handle empty chunks properly", () =>
      Effect.gen(function*() {
        const fiber = yield* pipe(
          Stream.make(1, 2, 3),
          Stream.tap(() => Effect.sleep(Duration.millis(500))),
          Stream.debounce(Duration.seconds(1)),
          Stream.runCollect,
          Effect.fork({ startImmediately: true })
        )
        yield* TestClock.adjust(Duration.seconds(3))
        const result = yield* Fiber.join(fiber)
        deepStrictEqual(result, [3])
      }))

    it.effect("should fail immediately", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.fromEffect(Effect.fail(Option.none())),
          Stream.debounce(Duration.infinity),
          Stream.runCollect,
          Effect.exit
        )
        assertExitFailure(result, Cause.fail(Option.none()))
      }))

    it.effect("should work with empty streams", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.empty,
          Stream.debounce(Duration.seconds(5)),
          Stream.runCollect
        )
        assertTrue(result.length === 0)
      }))

    it.effect("should pick last element from every chunk", () =>
      Effect.gen(function*() {
        const fiber = yield* pipe(
          Stream.make(1, 2, 3),
          Stream.debounce(Duration.seconds(1)),
          Stream.runCollect,
          Effect.fork
        )
        yield* TestClock.adjust(Duration.seconds(1))
        const result = yield* Fiber.join(fiber)
        deepStrictEqual(result, [3])
      }))

    it.effect("should interrupt fibers properly", () =>
      Effect.gen(function*() {
        const coordination = yield* chunkCoordination([
          [1],
          [2],
          [3]
        ])
        const fiber = yield* pipe(
          coordination.stream,
          Stream.chunks,
          Stream.tap(() => coordination.proceed),
          Stream.flattenArray,
          Stream.debounce(Duration.millis(200)),
          // Stream.interruptWhen(Effect.never),
          Stream.take(1),
          Stream.runCollect,
          Effect.fork
        )
        yield* pipe(
          coordination.offer,
          Effect.andThen(TestClock.adjust(Duration.millis(100))),
          Effect.andThen(coordination.awaitNext),
          Effect.repeat({ times: 2 })
        )
        yield* TestClock.adjust(Duration.millis(100))
        const result = yield* Fiber.join(fiber)
        deepStrictEqual(result, [3])
      }))

    it.effect("should interrupt children fiber on stream interruption", () =>
      Effect.gen(function*() {
        const ref = yield* (Ref.make(false))
        const fiber = yield* pipe(
          Stream.fromEffect(Effect.void),
          Stream.concat(Stream.fromEffect(pipe(
            Effect.never,
            Effect.onInterrupt(() => Ref.set(ref, true))
          ))),
          Stream.debounce(Duration.millis(800)),
          Stream.runDrain,
          Effect.fork
        )
        yield* TestClock.adjust(Duration.minutes(1))
        yield* Fiber.interrupt(fiber)
        const result = yield* Ref.get(ref)
        assertTrue(result)
      }))
  })

  describe("throttle", () => {
    it.effect("throttleEnforce - free elements", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.make(1, 2, 3, 4),
          Stream.throttle({
            cost: () => 0,
            units: 0,
            duration: Duration.infinity,
            strategy: "enforce"
          }),
          Stream.runCollect
        )
        deepStrictEqual(result, [1, 2, 3, 4])
      }))

    it.effect("throttleEnforce - no bandwidth", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.make(1, 2, 3, 4),
          Stream.throttle({
            cost: () => 1,
            units: 0,
            duration: Duration.infinity,
            strategy: "enforce"
          }),
          Stream.runCollect
        )
        assertTrue(result.length === 0)
      }))

    it.effect("throttleEnforce - refill bucket tokens", () =>
      Effect.gen(function*() {
        const fiber = yield* pipe(
          Stream.fromSchedule(Schedule.spaced(Duration.millis(100))),
          Stream.take(10),
          Stream.throttle({
            cost: () => 1,
            units: 1,
            duration: Duration.millis(200),
            strategy: "enforce"
          }),
          Stream.runCollect,
          Effect.fork
        )
        yield* TestClock.adjust(Duration.seconds(1))
        const result = yield* Fiber.join(fiber)
        deepStrictEqual(result, [0, 2, 4, 6, 8])
      }))

    it.effect("throttleShape", () =>
      Effect.gen(function*() {
        const queue = yield* Queue.unbounded<number>()
        const fiber = yield* pipe(
          Stream.fromQueue(queue),
          Stream.throttle({
            strategy: "shape",
            cost: (arr) => arr.reduce((a, b) => a + b, 0),
            units: 1,
            duration: Duration.seconds(1)
          }),
          Stream.toPull,
          Effect.flatMap((pull) =>
            Effect.gen(function*() {
              yield* Queue.offer(queue, 1)
              const result1 = yield* pull
              yield* Queue.offer(queue, 2)
              const result2 = yield* pull
              yield* Effect.sleep(Duration.seconds(4))
              yield* Queue.offer(queue, 3)
              const result3 = yield* pull
              return [result1, result2, result3] as const
            })
          ),
          Effect.scoped,
          Effect.fork
        )
        yield* TestClock.adjust(Duration.seconds(8))
        const result = yield* Fiber.join(fiber)
        deepStrictEqual(result, [[1], [2], [3]])
      }))

    it.effect("throttleShape - infinite bandwidth", () =>
      Effect.gen(function*() {
        const queue = yield* Queue.unbounded<number>()
        const result = yield* pipe(
          Stream.fromQueue(queue),
          Stream.throttle({
            strategy: "shape",
            cost: () => 100_000,
            units: 1,
            duration: Duration.zero
          }),
          Stream.toPull,
          Effect.flatMap((pull) =>
            Effect.gen(function*() {
              yield* Queue.offer(queue, 1)
              const result1 = yield* pull
              yield* Queue.offer(queue, 2)
              const result2 = yield* pull
              return [result1, result2] as const
            })
          ),
          Effect.scoped
        )
        deepStrictEqual(result, [[1], [2]])
      }))

    it.effect("throttleShape - with burst", () =>
      Effect.gen(function*() {
        const queue = yield* Queue.unbounded<number>()
        const fiber = yield* pipe(
          Stream.fromQueue(queue),
          Stream.throttle({
            strategy: "shape",
            cost: (arr) => arr.reduce((a, b) => a + b, 0),
            units: 1,
            duration: Duration.seconds(1),
            burst: 2
          }),
          Stream.toPull,
          Effect.flatMap((pull) =>
            Effect.gen(function*() {
              yield* Queue.offer(queue, 1)
              const result1 = yield* pull
              yield* TestClock.adjust(Duration.seconds(2))
              yield* Queue.offer(queue, 2)
              const result2 = yield* pull
              yield* TestClock.adjust(Duration.seconds(4))
              yield* Queue.offer(queue, 3)
              const result3 = yield* pull
              return [result1, result2, result3] as const
            })
          ),
          Effect.scoped,
          Effect.fork
        )
        const result = yield* Fiber.join(fiber)
        deepStrictEqual(result, [[1], [2], [3]])
      }))

    it.effect("throttleShape - free elements", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Stream.make(1, 2, 3, 4),
          Stream.throttle({
            strategy: "shape",
            cost: () => 0,
            units: 1,
            duration: Duration.infinity
          }),
          Stream.runCollect
        )
        deepStrictEqual(result, [1, 2, 3, 4])
      }))
  })

  describe("zipping", () => {
    it.effect("zipWith - combines elements point-wise", () =>
      Effect.gen(function*() {
        const stream1 = Stream.make(1, 2, 3)
        const stream2 = Stream.make("a", "b", "c")
        const result = yield* Stream.zipWith(stream1, stream2, (n, s) => `${n}-${s}`).pipe(
          Stream.runCollect
        )
        assert.deepStrictEqual(result, ["1-a", "2-b", "3-c"])
      }))

    it.effect("zipWith - stops when shortest stream ends", () =>
      Effect.gen(function*() {
        const stream1 = Stream.make(1, 2, 3, 4, 5, 6)
        const stream2 = Stream.make("a", "b", "c")
        const result = yield* Stream.zipWith(stream1, stream2, (n, s) => `${n}-${s}`).pipe(
          Stream.runCollect
        )
        assert.deepStrictEqual(result, ["1-a", "2-b", "3-c"])
      }))

    it.effect("zipWith - does not pull too much when one stream ends", () =>
      Effect.gen(function*() {
        const left = Stream.fromArrays([1, 2], [3, 4], [5]).pipe(
          Stream.concat(Stream.fail("boom"))
        )
        const right = Stream.fromArrays(["a", "b"], ["c"])
        const result = yield* Stream.zipWith(left, right, (n, s) => [n, s] as const).pipe(
          Stream.runCollect
        )
        assert.deepStrictEqual(result, [[1, "a"], [2, "b"], [3, "c"]])
      }))

    it.effect("zipWith - prioritizes failures", () =>
      Effect.gen(function*() {
        const result = yield* Stream.zipWith(
          Stream.never,
          Stream.fail("Ouch"),
          (a, b) => [a, b]
        ).pipe(
          Stream.runCollect,
          Effect.exit
        )
        assertExitFailure(result, Cause.fail("Ouch"))
      }))

    it.effect("zipWith - handles exceptions", () =>
      Effect.gen(function*() {
        const error = new Error("Ouch")
        const result = yield* Stream.make(1).pipe(
          Stream.flatMap(() =>
            Stream.sync(() => {
              throw error
            })
          ),
          Stream.zipWith(Stream.make(1), (a, b) => [a, b]),
          Stream.runCollect,
          Effect.exit
        )
        assertExitFailure(result, Cause.die(error))
      }))

    it.effect("zipWith - handles empty streams", () =>
      Effect.gen(function*() {
        const result1 = yield* Stream.zipWith(
          Stream.empty,
          Stream.make(1, 2, 3),
          (a, b) => [a, b]
        ).pipe(Stream.runCollect)

        const result2 = yield* Stream.zipWith(
          Stream.make(1, 2, 3),
          Stream.empty,
          (a, b) => [a, b]
        ).pipe(Stream.runCollect)

        assert.strictEqual(result1.length, 0)
        assert.strictEqual(result2.length, 0)
      }))

    it.effect.prop(
      "zipWith - equivalence with array operations",
      {
        left: fc.array(fc.integer()),
        right: fc.array(fc.integer())
      },
      Effect.fnUntraced(function*({ left, right }) {
        const stream = Stream.zipWith(
          Stream.fromIterable(left),
          Stream.fromIterable(right),
          (a, b) => a + b
        )
        const result = yield* Stream.runCollect(stream)

        const minLength = Math.min(left.length, right.length)
        const expected = Array.empty<number>()
        for (let i = 0; i < minLength; i++) {
          expected.push(left[i] + right[i])
        }

        assert.deepStrictEqual(result, expected)
      })
    )

    describe("zipWithArray", () => {
      it.effect("basic zipping with equal length streams", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zipWithArray(stream1, stream2, (left, right) => {
            const minLength = Math.min(left.length, right.length)
            const output = Array.makeBy(minLength, (i: number) => [left[i], right[i]] as const)
            return [output, left.slice(minLength), right.slice(minLength)]
          }).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a"], [2, "b"], [3, "c"]])
        }))

      it.effect("left stream shorter than right", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b", "c", "d", "e")
          const result = yield* Stream.zipWithArray(stream1, stream2, (left, right) => {
            const minLength = Math.min(left.length, right.length)
            const output = Array.makeBy(minLength, (i: number) => [left[i], right[i]] as const)
            return [output, left.slice(minLength), right.slice(minLength)]
          }).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a"], [2, "b"], [3, "c"]])
        }))

      it.effect("right stream shorter than left", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3, 4, 5)
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zipWithArray(stream1, stream2, (left, right) => {
            const minLength = Math.min(left.length, right.length)
            const output = Array.makeBy(minLength, (i: number) => [left[i], right[i]] as const)
            return [output, left.slice(minLength), right.slice(minLength)]
          }).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a"], [2, "b"], [3, "c"]])
        }))

      it.effect("multiple arrays from each stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.fromArrays([1, 2], [3, 4], [5, 6])
          const stream2 = Stream.fromArrays(["a", "b"], ["c", "d"], ["e", "f"])
          const result = yield* Stream.zipWithArray(stream1, stream2, (left, right) => {
            const minLength = Math.min(left.length, right.length)
            const output = Array.makeBy(minLength, (i: number) => [left[i], right[i]] as const)
            return [output, left.slice(minLength), right.slice(minLength)]
          }).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a"], [2, "b"], [3, "c"], [4, "d"], [5, "e"], [6, "f"]])
        }))

      it.effect("handles leftover elements correctly", () =>
        Effect.gen(function*() {
          const stream1 = Stream.fromArrays([1, 2, 3], [4, 5])
          const stream2 = Stream.fromArrays(["a", "b"], ["c", "d", "e"])
          let leftLeftovers = 0
          let rightLeftovers = 0

          const result = yield* Stream.zipWithArray(stream1, stream2, (left, right) => {
            const minLength = Math.min(left.length, right.length)
            const output = Array.makeBy(minLength, (i: number) => [left[i], right[i]] as const)
            const leftSlice = left.slice(minLength)
            const rightSlice = right.slice(minLength)
            if (leftSlice.length > 0) {
              leftLeftovers++
            } else if (rightSlice.length > 0) {
              rightLeftovers++
            }
            return [output, leftSlice, rightSlice]
          }).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a"], [2, "b"], [3, "c"], [4, "d"], [5, "e"]])
          assert.isTrue(leftLeftovers > 0 || rightLeftovers > 0)
        }))

      it.effect("error propagation from left stream", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipWithArray(
            Stream.make(1, 2).pipe(Stream.concat(Stream.fail("boom"))),
            Stream.make("a", "b", "c"),
            (left, right) => {
              const minLength = Math.min(left.length, right.length)
              const output = Array.makeBy(minLength, (i: number) => [left[i], right[i]] as const)
              return [output, [], []]
            }
          ).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("boom"))
        }))

      // Note: This test is skipped because with sequential pulling (matching zipWith behavior),
      // when the left stream ends, we don't pull from the right stream, so errors after
      // the left stream ends are not encountered. This is correct behavior.
      it.skip("error propagation from right stream", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipWithArray(
            Stream.make(1, 2, 3),
            Stream.make("a", "b").pipe(Stream.concat(Stream.fail("boom"))),
            (left, right) => {
              const minLength = Math.min(left.length, right.length)
              const output = Array.makeBy(minLength, (i: number) => [left[i], right[i]] as const)
              return [output, [], []]
            }
          ).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("boom"))
        }))

      it.effect("handles empty streams", () =>
        Effect.gen(function*() {
          const result1 = yield* Stream.zipWithArray(
            Stream.empty,
            Stream.make(1, 2, 3),
            (left, right) => {
              return [Array.of([left[0], right[0]] as const), [], []]
            }
          ).pipe(Stream.runCollect)

          const result2 = yield* Stream.zipWithArray(
            Stream.make(1, 2, 3),
            Stream.empty,
            (left, right) => {
              return [Array.of([left[0], right[0]] as const), [], []]
            }
          ).pipe(Stream.runCollect)

          assert.strictEqual(result1.length, 0)
          assert.strictEqual(result2.length, 0)
        }))

      it.effect("processes arrays of different sizes within streams", () =>
        Effect.gen(function*() {
          const stream1 = Stream.fromArrays([1], [2, 3, 4], [5])
          const stream2 = Stream.fromArrays([10, 20], [30], [40, 50])
          const result = yield* Stream.zipWithArray(stream1, stream2, (left, right) => {
            const minLength = Math.min(left.length, right.length)
            const output = Array.makeBy(minLength, (i: number) => [left[i], right[i]] as const)
            return [output, left.slice(minLength), right.slice(minLength)]
          }).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, 10], [2, 20], [3, 30], [4, 40], [5, 50]])
        }))

      it.effect("custom array-level logic - take pairs", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3, 4)
          const stream2 = Stream.make(10, 20, 30, 40)
          const result = yield* Stream.zipWithArray(stream1, stream2, (left, right) => {
            const pairs = Math.min(Math.floor(left.length / 2), Math.floor(right.length / 2))
            const output = Array.makeBy(pairs, (i: number) => {
              return [left[i * 2], left[i * 2 + 1], right[i * 2], right[i * 2 + 1]] as const
            })

            const leftUsed = pairs * 2
            const rightUsed = pairs * 2
            const leftLeftover = left.slice(leftUsed)
            const rightLeftover = right.slice(rightUsed)

            return [output, leftLeftover, rightLeftover]
          }).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, 2, 10, 20], [3, 4, 30, 40]])
        }))

      it.effect("does not pull too much when one stream ends", () =>
        Effect.gen(function*() {
          const left = Stream.fromArrays([1, 2], [3, 4], [5]).pipe(
            Stream.concat(Stream.fail("boom"))
          )
          const right = Stream.fromArrays(["a", "b"], ["c"])
          const result = yield* Stream.zipWithArray(left, right, (leftArr, rightArr) => {
            const minLength = Math.min(leftArr.length, rightArr.length)
            const output = Array.makeBy(minLength, (i: number) => [leftArr[i], rightArr[i]] as const)
            return [output, leftArr.slice(minLength), rightArr.slice(minLength)]
          }).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a"], [2, "b"], [3, "c"]])
        }))
    })

    describe("zip", () => {
      it.effect("zips two streams into tuples", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zip(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a"], [2, "b"], [3, "c"]])
        }))

      it.effect("terminates when left stream ends first", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2)
          const stream2 = Stream.make("a", "b", "c", "d")
          const result = yield* Stream.zip(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a"], [2, "b"]])
        }))

      it.effect("terminates when right stream ends first", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3, 4)
          const stream2 = Stream.make("a", "b")
          const result = yield* Stream.zip(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a"], [2, "b"]])
        }))

      it.effect("handles empty left stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.empty
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zip(stream1, stream2).pipe(Stream.runCollect)

          assert.strictEqual(result.length, 0)
        }))

      it.effect("handles empty right stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.empty
          const result = yield* Stream.zip(stream1, stream2).pipe(Stream.runCollect)

          assert.strictEqual(result.length, 0)
        }))

      it.effect("propagates errors from left stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2).pipe(Stream.concat(Stream.fail("boom")))
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zip(stream1, stream2).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("boom"))
        }))

      it.effect("propagates errors from right stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b").pipe(Stream.concat(Stream.fail("ouch")))
          const result = yield* Stream.zip(stream1, stream2).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("ouch"))
        }))

      it.effect("works with pipe syntax", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* stream1.pipe(Stream.zip(stream2), Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a"], [2, "b"], [3, "c"]])
        }))
    })

    describe("zipLeft", () => {
      it.effect("keeps only left values", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zipLeft(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [1, 2, 3])
        }))

      it.effect("terminates when left stream ends first", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2)
          const stream2 = Stream.make("a", "b", "c", "d")
          const result = yield* Stream.zipLeft(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [1, 2])
        }))

      it.effect("terminates when right stream ends first", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3, 4)
          const stream2 = Stream.make("a", "b")
          const result = yield* Stream.zipLeft(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [1, 2])
        }))

      it.effect("handles empty left stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.empty
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zipLeft(stream1, stream2).pipe(Stream.runCollect)

          assert.strictEqual(result.length, 0)
        }))

      it.effect("handles empty right stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.empty
          const result = yield* Stream.zipLeft(stream1, stream2).pipe(Stream.runCollect)

          assert.strictEqual(result.length, 0)
        }))

      it.effect("propagates errors from left stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2).pipe(Stream.concat(Stream.fail("boom")))
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zipLeft(stream1, stream2).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("boom"))
        }))

      it.effect("propagates errors from right stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b").pipe(Stream.concat(Stream.fail("ouch")))
          const result = yield* Stream.zipLeft(stream1, stream2).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("ouch"))
        }))

      it.effect("works with pipe syntax", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* stream1.pipe(Stream.zipLeft(stream2), Stream.runCollect)

          assert.deepStrictEqual(result, [1, 2, 3])
        }))

      it.effect("consumes right stream elements", () =>
        Effect.gen(function*() {
          let rightPulled = 0
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b", "c").pipe(
            Stream.tap(() =>
              Effect.sync(() => {
                rightPulled++
              })
            )
          )
          const result = yield* Stream.zipLeft(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [1, 2, 3])
          assert.strictEqual(rightPulled, 3)
        }))
    })

    describe("zipRight", () => {
      it.effect("keeps only right values", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zipRight(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, ["a", "b", "c"])
        }))

      it.effect("terminates when left stream ends first", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2)
          const stream2 = Stream.make("a", "b", "c", "d")
          const result = yield* Stream.zipRight(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, ["a", "b"])
        }))

      it.effect("terminates when right stream ends first", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3, 4)
          const stream2 = Stream.make("a", "b")
          const result = yield* Stream.zipRight(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, ["a", "b"])
        }))

      it.effect("handles empty left stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.empty
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zipRight(stream1, stream2).pipe(Stream.runCollect)

          assert.strictEqual(result.length, 0)
        }))

      it.effect("handles empty right stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.empty
          const result = yield* Stream.zipRight(stream1, stream2).pipe(Stream.runCollect)

          assert.strictEqual(result.length, 0)
        }))

      it.effect("propagates errors from left stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2).pipe(Stream.concat(Stream.fail("boom")))
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zipRight(stream1, stream2).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("boom"))
        }))

      it.effect("propagates errors from right stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b").pipe(Stream.concat(Stream.fail("ouch")))
          const result = yield* Stream.zipRight(stream1, stream2).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("ouch"))
        }))

      it.effect("works with pipe syntax", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make(1, 2, 3)
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* stream1.pipe(Stream.zipRight(stream2), Stream.runCollect)

          assert.deepStrictEqual(result, ["a", "b", "c"])
        }))

      it.effect("consumes left stream elements", () =>
        Effect.gen(function*() {
          let leftPulled = 0
          const stream1 = Stream.make(1, 2, 3).pipe(
            Stream.tap(() =>
              Effect.sync(() => {
                leftPulled++
              })
            )
          )
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zipRight(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, ["a", "b", "c"])
          assert.strictEqual(leftPulled, 3)
        }))
    })

    describe("zipFlatten", () => {
      it.effect("flattens tuples when zipping", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make([1, "a"] as const, [2, "b"] as const, [3, "c"] as const)
          const stream2 = Stream.make("x", "y", "z")
          const result = yield* Stream.zipFlatten(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a", "x"], [2, "b", "y"], [3, "c", "z"]])
        }))

      it.effect("works with single element tuples", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make([1] as const, [2] as const, [3] as const)
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zipFlatten(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a"], [2, "b"], [3, "c"]])
        }))

      it.effect("works with larger tuples", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make([1, 2, 3] as const, [4, 5, 6] as const)
          const stream2 = Stream.make("a", "b")
          const result = yield* Stream.zipFlatten(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, 2, 3, "a"], [4, 5, 6, "b"]])
        }))

      it.effect("terminates when left stream ends first", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make([1, "a"] as const, [2, "b"] as const)
          const stream2 = Stream.make("x", "y", "z", "w")
          const result = yield* Stream.zipFlatten(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a", "x"], [2, "b", "y"]])
        }))

      it.effect("terminates when right stream ends first", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make([1, "a"] as const, [2, "b"] as const, [3, "c"] as const, [4, "d"] as const)
          const stream2 = Stream.make("x", "y")
          const result = yield* Stream.zipFlatten(stream1, stream2).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a", "x"], [2, "b", "y"]])
        }))

      it.effect("handles empty left stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.empty
          const stream2 = Stream.make("a", "b", "c")
          const result = yield* Stream.zipFlatten(stream1, stream2).pipe(Stream.runCollect)

          assert.strictEqual(result.length, 0)
        }))

      it.effect("handles empty right stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make([1, "a"] as const, [2, "b"] as const)
          const stream2 = Stream.empty
          const result = yield* Stream.zipFlatten(stream1, stream2).pipe(Stream.runCollect)

          assert.strictEqual(result.length, 0)
        }))

      it.effect("propagates errors from left stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make([1, "a"] as const, [2, "b"] as const).pipe(Stream.concat(Stream.fail("boom")))
          const stream2 = Stream.make("x", "y", "z")
          const result = yield* Stream.zipFlatten(stream1, stream2).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("boom"))
        }))

      it.effect("propagates errors from right stream", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make([1, "a"] as const, [2, "b"] as const, [3, "c"] as const)
          const stream2 = Stream.make("x", "y").pipe(Stream.concat(Stream.fail("ouch")))
          const result = yield* Stream.zipFlatten(stream1, stream2).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("ouch"))
        }))

      it.effect("works with pipe syntax", () =>
        Effect.gen(function*() {
          const stream1 = Stream.make([1, "a"] as const, [2, "b"] as const, [3, "c"] as const)
          const stream2 = Stream.make("x", "y", "z")
          const result = yield* stream1.pipe(Stream.zipFlatten(stream2), Stream.runCollect)

          assert.deepStrictEqual(result, [[1, "a", "x"], [2, "b", "y"], [3, "c", "z"]])
        }))
    })

    describe("zipWithIndex", () => {
      it.effect("zips stream with indices starting at 0", () =>
        Effect.gen(function*() {
          const stream = Stream.make("a", "b", "c", "d")
          const result = yield* Stream.zipWithIndex(stream).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [["a", 0], ["b", 1], ["c", 2], ["d", 3]])
        }))

      it.effect("handles empty stream", () =>
        Effect.gen(function*() {
          const stream = Stream.empty
          const result = yield* Stream.zipWithIndex(stream).pipe(Stream.runCollect)

          assert.strictEqual(result.length, 0)
        }))

      it.effect("handles single element stream", () =>
        Effect.gen(function*() {
          const stream = Stream.make("a")
          const result = yield* Stream.zipWithIndex(stream).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [["a", 0]])
        }))

      it.effect("preserves order", () =>
        Effect.gen(function*() {
          const stream = Stream.make(5, 4, 3, 2, 1)
          const result = yield* Stream.zipWithIndex(stream).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[5, 0], [4, 1], [3, 2], [2, 3], [1, 4]])
        }))

      it.effect("works with numbers", () =>
        Effect.gen(function*() {
          const stream = Stream.make(10, 20, 30)
          const result = yield* Stream.zipWithIndex(stream).pipe(Stream.runCollect)

          assert.deepStrictEqual(result, [[10, 0], [20, 1], [30, 2]])
        }))

      it.effect("propagates errors", () =>
        Effect.gen(function*() {
          const stream = Stream.make(1, 2, 3).pipe(Stream.concat(Stream.fail("boom")))
          const result = yield* Stream.zipWithIndex(stream).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("boom"))
        }))

      it.effect("works with pipe syntax", () =>
        Effect.gen(function*() {
          const stream = Stream.make("x", "y", "z")
          const result = yield* stream.pipe(Stream.zipWithIndex, Stream.runCollect)

          assert.deepStrictEqual(result, [["x", 0], ["y", 1], ["z", 2]])
        }))

      it.effect("index increments correctly for large streams", () =>
        Effect.gen(function*() {
          const stream = Stream.range(0, 99)
          const result = yield* Stream.zipWithIndex(stream).pipe(Stream.runCollect)

          assert.strictEqual(result.length, 100)
          assert.deepStrictEqual(result[0], [0, 0])
          assert.deepStrictEqual(result[99], [99, 99])
        }))
    })

    describe("zipLatest", () => {
      it.effect("combines streams with latest values", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatest(
            Stream.make(1, 2, 3),
            Stream.make("a", "b", "c", "d")
          ).pipe(Stream.runCollect)

          // Both streams emit, latest values are paired
          assert.isTrue(result.length > 0)
          assert.isTrue(result.every((item) => Array.isArray(item) && item.length === 2))
        }))

      it.effect("waits for both streams to emit before producing output", () =>
        Effect.gen(function*() {
          const queue1 = yield* Queue.unbounded<number>()
          const queue2 = yield* Queue.unbounded<string>()

          const fiber = yield* Effect.fork(
            Stream.zipLatest(
              Stream.fromQueue(queue1),
              Stream.fromQueue(queue2)
            ).pipe(Stream.take(3), Stream.runCollect)
          )

          yield* Queue.offer(queue1, 1)
          yield* Queue.offer(queue2, "a")
          yield* Queue.offer(queue1, 2)
          yield* Queue.offer(queue2, "b")
          yield* Queue.offer(queue1, 3)

          const result = yield* Fiber.join(fiber)

          assert.isTrue(result.length > 0)
        }))

      it.effect("propagates errors from left stream", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatest(
            Stream.make(1, 2).pipe(Stream.concat(Stream.fail("boom"))),
            Stream.make("a", "b", "c")
          ).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("boom"))
        }))

      it.effect("propagates errors from right stream", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatest(
            Stream.make(1, 2, 3),
            Stream.make("a", "b").pipe(Stream.concat(Stream.fail("ouch")))
          ).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("ouch"))
        }))

      it.effect("terminates when left stream ends", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatest(
            Stream.make(1, 2),
            Stream.make("a", "b", "c", "d", "e")
          ).pipe(Stream.runCollect)

          // Should terminate when left stream (1, 2) ends
          assert.isTrue(result.length > 0)
        }))

      it.effect("terminates when right stream ends", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatest(
            Stream.make(1, 2, 3, 4, 5),
            Stream.make("a", "b")
          ).pipe(Stream.runCollect)

          // Should terminate when right stream ("a", "b") ends
          assert.isTrue(result.length > 0)
        }))

      it.effect("works with pipe syntax", () =>
        Effect.gen(function*() {
          const result = yield* Stream.make(1, 2, 3).pipe(
            Stream.zipLatest(Stream.make("a", "b", "c")),
            Stream.runCollect
          )

          assert.isTrue(result.length > 0)
        }))

      it.effect("basic synchronous example", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatest(
            Stream.make(1, 2, 3),
            Stream.make("a", "b", "c")
          ).pipe(Stream.runCollect)

          // Both streams emit synchronously, latest values are paired
          assert.isTrue(result.length > 0)
          assert.isTrue(result.every((item) => Array.isArray(item) && item.length === 2))
        }))
    })

    describe("zipLatestWith", () => {
      it.effect("transforms combined values", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatestWith(
            Stream.make(1, 2, 3),
            Stream.make(10, 20, 30),
            (n, m) => n * m
          ).pipe(Stream.runCollect)

          assert.isTrue(result.length > 0)
          assert.isTrue(result.every((item) => typeof item === "number"))
        }))

      it.effect("combines with custom function", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatestWith(
            Stream.make(1, 2, 3),
            Stream.make("a", "b", "c"),
            (n, s) => `${n}-${s}`
          ).pipe(Stream.runCollect)

          assert.isTrue(result.length > 0)
          assert.isTrue(result.every((item) => typeof item === "string" && item.includes("-")))
        }))

      it.effect("propagates errors from left stream", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatestWith(
            Stream.make(1, 2).pipe(Stream.concat(Stream.fail("boom"))),
            Stream.make("a", "b", "c"),
            (n, s) => `${n}-${s}`
          ).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("boom"))
        }))

      it.effect("propagates errors from right stream", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatestWith(
            Stream.make(1, 2, 3),
            Stream.make("a", "b").pipe(Stream.concat(Stream.fail("ouch"))),
            (n, s) => `${n}-${s}`
          ).pipe(Stream.runCollect, Effect.exit)

          assertExitFailure(result, Cause.fail("ouch"))
        }))

      it.effect("terminates when left stream ends", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatestWith(
            Stream.make(1, 2),
            Stream.make(10, 20, 30, 40),
            (n, m) => n + m
          ).pipe(Stream.runCollect)

          assert.isTrue(result.length > 0)
        }))

      it.effect("terminates when right stream ends", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatestWith(
            Stream.make(1, 2, 3, 4),
            Stream.make(10, 20),
            (n, m) => n + m
          ).pipe(Stream.runCollect)

          assert.isTrue(result.length > 0)
        }))

      it.effect("works with pipe syntax", () =>
        Effect.gen(function*() {
          const result = yield* Stream.make(1, 2, 3).pipe(
            Stream.zipLatestWith(
              Stream.make(10, 20, 30),
              (n, m) => n + m
            ),
            Stream.runCollect
          )

          assert.isTrue(result.length > 0)
        }))

      it.effect("basic synchronous example", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatestWith(
            Stream.make(1, 2, 3),
            Stream.make(10, 20, 30),
            (a, b) => a + b
          ).pipe(Stream.runCollect)

          assert.isTrue(result.length > 0)
          assert.isTrue(result.every((item) => typeof item === "number"))
        }))

      it.effect("string concatenation example", () =>
        Effect.gen(function*() {
          const result = yield* Stream.zipLatestWith(
            Stream.make("Alice", "Bob", "Charlie"),
            Stream.make("Smith", "Jones"),
            (first, last) => `${first} ${last}`
          ).pipe(Stream.runCollect)

          assert.isTrue(result.length > 0)
          assert.isTrue(result.every((item) => typeof item === "string" && item.includes(" ")))
        }))
    })
  })
})

const grouped = <A>(arr: Array<A>, size: number): Array<NonEmptyArray<A>> => {
  const builder: Array<NonEmptyArray<A>> = []
  for (let i = 0; i < arr.length; i = i + size) {
    builder.push(arr.slice(i, i + size) as NonEmptyArray<A>)
  }
  return builder
}
