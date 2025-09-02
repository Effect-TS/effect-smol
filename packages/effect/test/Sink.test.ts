import { describe, it } from "@effect/vitest"
import { assertFailure, assertSuccess, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Cause, Effect, Ref } from "effect"
import { Array } from "effect/collections"
import { constTrue } from "effect/Function"
import { Sink, Stream } from "effect/stream"

describe("Sink", () => {
  describe("fold", () => {
    it.effect("empty", () =>
      Effect.gen(function*() {
        const result = yield* Stream.empty.pipe(
          Stream.transduce(Sink.fold<number, number>(() => 0, constTrue, (x, y) => x + y)),
          Stream.runCollect
        )
        deepStrictEqual(result, [0])
      }))

    it.effect("termination in the middle", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(1, 9).pipe(
          Stream.run(Sink.fold<number, number>(() => 0, (n) => n <= 5, (x, y) => x + y))
        )
        strictEqual(result, 6)
      }))

    it.effect("immediate termination", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(1, 9).pipe(
          Stream.run(Sink.fold<number, number>(() => 0, (n) => n <= -1, (x, y) => x + y))
        )
        strictEqual(result, 0)
      }))

    it.effect("no termination", () =>
      Effect.gen(function*() {
        const result = yield* Stream.range(1, 9).pipe(
          Stream.run(Sink.fold<number, number>(() => 0, (n) => n <= 500, (x, y) => x + y))
        )
        strictEqual(result, 45)
      }))
  })
  describe("foldEffect", () => {
    it.effect("short circuits", () =>
      Effect.gen(function*() {
        const empty: Stream.Stream<number> = Stream.empty
        const single = Stream.make(1)
        const double = Stream.make(1, 2)
        const failed = Stream.fail("Ouch")
        const run = <E>(stream: Stream.Stream<number, E>) =>
          Ref.make(Array.empty<number>()).pipe(
            Effect.flatMap((ref) =>
              stream.pipe(
                Stream.transduce(Sink.foldEffect(
                  () => 0,
                  constTrue,
                  (_, y: number) => Effect.as(Ref.update(ref, Array.append(y)), 30)
                )),
                Stream.runCollect,
                Effect.flatMap((exit) =>
                  Ref.get(ref).pipe(
                    Effect.map((result) => [exit, result])
                  )
                )
              )
            ),
            Effect.exit
          )
        const result1 = yield* run(empty)
        const result2 = yield* run(single)
        const result3 = yield* run(double)
        const result4 = yield* run(failed)
        assertSuccess(result1, [[0], []])
        assertSuccess(result2, [[30], [1]])
        assertSuccess(result3, [[30], [1, 2]])
        assertFailure(result4, Cause.fail("Ouch"))
      }))
  })

  describe("foldLeft", () => {
    it.effect("equivalence with Array.reduce", () =>
      Effect.gen(function*() {
        const stream = Stream.range(1, 9)
        const result1 = yield* stream.pipe(Stream.run(Sink.foldLeft(() => "", (s, n) => s + `${n}`)))
        const result2 = yield* stream.pipe(
          Stream.runCollect,
          Effect.map(Array.reduce("", (s, n) => s + `${n}`))
        )
        strictEqual(result1, result2)
      }))
  })

  describe("take", () => {
    it.effect("respects the given limit", () =>
      Effect.gen(function*() {
        const stream = Stream.make(1, 2, 3, 4).pipe(
          Stream.transduce(Sink.take<number>(3))
        )
        const result = yield* Stream.runCollect(stream)
        deepStrictEqual(
          result,
          [[1, 2, 3], [4]]
        )
      }))

    it.effect("produces empty trailing chunks", () =>
      Effect.gen(function*() {
        const stream = Stream.make(1, 2, 3, 4).pipe(
          Stream.transduce(Sink.take<number>(4))
        )
        const result = yield* Stream.runCollect(stream)
        deepStrictEqual(
          result,
          [[1, 2, 3, 4], []]
        )
      }))

    it.effect("produces empty trailing chunks", () =>
      Effect.gen(function*() {
        const stream = Stream.empty.pipe(
          Stream.transduce(Sink.take<number>(3))
        )
        const result = yield* Stream.runCollect(stream)
        deepStrictEqual(result, [[]])
      }))
  })
})
