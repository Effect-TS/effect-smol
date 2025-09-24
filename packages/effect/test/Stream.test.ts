/* eslint-disable no-restricted-syntax */
import { assert, describe, it } from "@effect/vitest"
import { assertExitFailure, deepStrictEqual } from "@effect/vitest/utils"
import { Cause, Deferred, Effect, Exit, Fiber, Queue, Ref, Schedule } from "effect"
import { Array } from "effect/collections"
import { isReadonlyArrayNonEmpty, type NonEmptyArray } from "effect/collections/Array"
import { Filter, Option } from "effect/data"
import { constTrue, pipe } from "effect/Function"
import { Sink, Stream } from "effect/stream"
import { TestClock } from "effect/testing"
import * as fc from "effect/testing/FastCheck"
import { assertFailure } from "./utils/assert.ts"

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
          Effect.fork
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
        const s: readonly [number, Array<number>] = [0, [1, 2, 3]]
        const result = yield* Stream.paginate(s, ([n, nums]) =>
          nums.length === 0 ?
            [n, Option.none()] as const :
            [n, Option.some([nums[0], nums.slice(1)] as const)] as const).pipe(Stream.runCollect)
        assert.deepStrictEqual(result, [0, 1, 2, 3])
      }))

    it.effect("paginateEffect", () =>
      Effect.gen(function*() {
        const s: readonly [number, Array<number>] = [0, [1, 2, 3]]
        const result = yield* Stream.paginateEffect(
          s,
          (
            [n, nums]
          ): Effect.Effect<readonly [number, Option.Option<readonly [number, Array<number>]>]> =>
            nums.length === 0 ?
              Effect.succeed([n, Option.none()]) :
              Effect.succeed([n, Option.some([nums[0], nums.slice(1)])])
        ).pipe(Stream.runCollect)
        assert.deepStrictEqual(result, [0, 1, 2, 3])
      }))

    it.effect("paginateChunk", () =>
      Effect.gen(function*() {
        const s: readonly [ReadonlyArray<number>, Array<number>] = [[0], [1, 2, 3, 4, 5]]
        const pageSize = 2
        const result = yield* Stream.paginateArray(s, ([chunk, nums]) =>
          nums.length === 0 ?
            [chunk, Option.none()] as const :
            [
              chunk,
              Option.some(
                [
                  nums.slice(0, pageSize),
                  nums.slice(pageSize)
                ] as const
              )
            ] as const).pipe(Stream.runCollect)
        assert.deepStrictEqual(result, [0, 1, 2, 3, 4, 5])
      }))

    it.effect("paginateChunkEffect", () =>
      Effect.gen(function*() {
        const s: readonly [ReadonlyArray<number>, Array<number>] = [[0], [1, 2, 3, 4, 5]]
        const pageSize = 2
        const result = yield* Stream.paginateArrayEffect(s, ([chunk, nums]) =>
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
          Stream.transduce(Sink.fold(() => 100, (n) => n % 2 === 0, (acc, n) => acc + n)),
          Stream.runCollect
        )
        assert.deepStrictEqual(result, [101, 105, 104])
      }))

    it.effect("with a sink that always signals more", () =>
      Effect.gen(function*() {
        const result = yield* Stream.make(1, 2, 3).pipe(
          Stream.transduce(Sink.fold(() => 0, constTrue, (acc, n) => acc + n)),
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
          Effect.fork({ startImmediately: true })
        )

        yield* TestClock.adjust("1 seconds")

        const first = yield* Fiber.join(firstFiber)
        deepStrictEqual(first, [0])

        const secondFiber = yield* sharedStream.pipe(
          Stream.take(1),
          Stream.run(Sink.collectAll()),
          Effect.fork({ startImmediately: true })
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
          Effect.fork({ startImmediately: true })
        )

        yield* TestClock.adjust("1 seconds")

        const first = yield* Fiber.join(firstFiber)
        deepStrictEqual(first, [0])

        const secondFiber = yield* sharedStream.pipe(
          Stream.take(1),
          Stream.run(Sink.collectAll()),
          Effect.fork({ startImmediately: true })
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
          Effect.fork({ startImmediately: true })
        )
        const fiber2 = yield* sharedStream.pipe(
          Stream.take(2),
          Stream.run(Sink.collectAll()),
          Effect.fork({ startImmediately: true })
        )

        yield* TestClock.adjust("2 seconds")

        const [result1, result2] = yield* Fiber.joinAll([fiber1, fiber2])

        deepStrictEqual(result1, [0])
        deepStrictEqual(result2, [0, 1])
      }))
  })
})

const grouped = <A>(arr: Array<A>, size: number): Array<NonEmptyArray<A>> => {
  const builder: Array<NonEmptyArray<A>> = []
  for (let i = 0; i < arr.length; i = i + size) {
    builder.push(arr.slice(i, i + size) as NonEmptyArray<A>)
  }
  return builder
}
