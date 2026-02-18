import { assert, describe, it } from "@effect/vitest"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as SqlSchema from "effect/unstable/sql/SqlSchema"

describe("SqlSchema", () => {
  describe("findOne", () => {
    it.effect("returns Option.some when a row exists", () =>
      Effect.gen(function*() {
        const query = SqlSchema.findOne({
          Request: Schema.NumberFromString,
          Result: Schema.Struct({ value: Schema.String }),
          execute: (request) => Effect.succeed([{ value: `id:${request}` }])
        })

        const result = yield* query(1)
        assert.isTrue(Option.isSome(result))
        if (Option.isSome(result)) {
          assert.deepStrictEqual(result.value, { value: "id:1" })
        }
      }))

    it.effect("returns Option.none when no rows are returned", () =>
      Effect.gen(function*() {
        const query = SqlSchema.findOne({
          Request: Schema.NumberFromString,
          Result: Schema.String,
          execute: () => Effect.succeed([])
        })

        const result = yield* query(1)
        assert.isTrue(Option.isNone(result))
      }))

    it.effect("fails when the first row cannot be decoded", () =>
      Effect.gen(function*() {
        const query = SqlSchema.findOne({
          Request: Schema.String,
          Result: Schema.Struct({ id: Schema.Number }),
          execute: () => Effect.succeed([{ id: "not-a-number" }])
        })

        const error = yield* Effect.flip(query("ignored"))
        assert.isTrue(Schema.isSchemaError(error))
      }))
  })

  describe("single", () => {
    it.effect("returns the first decoded row", () =>
      Effect.gen(function*() {
        const query = SqlSchema.single({
          Request: Schema.String,
          Result: Schema.NumberFromString,
          execute: () => Effect.succeed(["1", "2"])
        })

        const result = yield* query("ignored")
        assert.strictEqual(result, 1)
      }))

    it.effect("fails with NoSuchElementError when no rows are returned", () =>
      Effect.gen(function*() {
        const query = SqlSchema.single({
          Request: Schema.String,
          Result: Schema.String,
          execute: () => Effect.succeed([])
        })

        const error = yield* Effect.flip(query("ignored"))
        assert.isTrue(Cause.isNoSuchElementError(error))
      }))
  })
})
