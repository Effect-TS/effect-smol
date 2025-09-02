import { assert, describe, it } from "@effect/vitest"
import { Effect, Exit, Fiber, Queue } from "effect"
import { Array } from "effect/collections"
import { isReadonlyArrayNonEmpty, type NonEmptyArray } from "effect/collections/Array"
import { Filter, Option } from "effect/data"
import { constTrue } from "effect/Function"
import { Sink, Stream } from "effect/stream"
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
})

const grouped = <A>(arr: Array<A>, size: number): Array<NonEmptyArray<A>> => {
  const builder: Array<NonEmptyArray<A>> = []
  for (let i = 0; i < arr.length; i = i + size) {
    builder.push(arr.slice(i, i + size) as NonEmptyArray<A>)
  }
  return builder
}
