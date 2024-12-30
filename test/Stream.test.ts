import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { assert, describe, it } from "./utils/extend.js"

describe("Stream", () => {
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
})
