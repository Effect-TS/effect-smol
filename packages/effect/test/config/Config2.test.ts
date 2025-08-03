import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { Config2, ConfigProvider2 } from "effect/config"
import { Option } from "effect/data"
import { Issue, Schema } from "effect/schema"
import { assertions } from "../utils/schema.ts"

async function assertSuccess<T>(config: Config2.Config<T>, provider: ConfigProvider2.ConfigProvider, expected: T) {
  const result = config.parse(provider)
  return await assertions.effect.succeed(result, expected)
}

async function assertFailure<T>(config: Config2.Config<T>, provider: ConfigProvider2.ConfigProvider, message: string) {
  const result = config.parse(provider).pipe(
    Effect.catchTag(
      "GetError",
      (e) =>
        Effect.fail(new Schema.SchemaError({ issue: new Issue.InvalidValue(Option.none(), { message: e.reason }) }))
    )
  )
  return await assertions.effect.fail(result.pipe(Effect.mapError((e) => e.issue)), message)
}

describe("Config2", () => {
  describe("fromStringLeafJson", () => {
    it("String", async () => {
      const schema = Schema.String
      const config = Config2.schema(schema)

      await assertSuccess(config, ConfigProvider2.fromStringLeafJson("value"), "value")
    })

    describe("Struct", () => {
      it("required properties", async () => {
        const schema = Schema.Struct({ a: Schema.FiniteFromString })
        const config = Config2.schema(schema)

        await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "1" }), { a: 1 })
        await assertFailure(
          config,
          ConfigProvider2.fromStringLeafJson({}),
          `{ readonly "a": number }
└─ ["a"]
   └─ Missing key`
        )
        await assertFailure(
          config,
          ConfigProvider2.fromStringLeafJson({ a: "value" }),
          `{ readonly "a": number }
└─ ["a"]
   └─ number & finite
      └─ finite
         └─ Invalid data NaN`
        )
      })

      it("optionalKey properties", async () => {
        const schema = Schema.Struct({ a: Schema.optionalKey(Schema.FiniteFromString) })
        const config = Config2.schema(schema)

        await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "1" }), { a: 1 })
        await assertSuccess(config, ConfigProvider2.fromStringLeafJson({}), {})
      })

      it("optional properties", async () => {
        const config = Config2.schema(
          Schema.Struct({ a: Schema.optional(Schema.FiniteFromString) })
        )

        await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "1" }), { a: 1 })
        await assertSuccess(config, ConfigProvider2.fromStringLeafJson({}), {})
      })

      it("Literals", async () => {
        const schema = Schema.Struct({ a: Schema.Literals(["b", "c"]) })
        const config = Config2.schema(schema)

        await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "b" }), { a: "b" })
        await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "c" }), { a: "c" })
      })
    })

    it("Record", async () => {
      const schema = Schema.Record(Schema.String, Schema.FiniteFromString)
      const config = Config2.schema(schema)

      await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "1" }), { a: 1 })
      await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "1", b: "2" }), { a: 1, b: 2 })
      await assertFailure(
        config,
        ConfigProvider2.fromStringLeafJson({ a: "1", b: "value" }),
        `{ readonly [x: string]: number }
└─ ["b"]
   └─ number & finite
      └─ finite
         └─ Invalid data NaN`
      )
    })

    it("Tuple", async () => {
      const schema = Schema.Tuple([Schema.String, Schema.FiniteFromString])
      const config = Config2.schema(schema)

      await assertSuccess(config, ConfigProvider2.fromStringLeafJson(["1", "2"]), ["1", 2])
      await assertFailure(
        config,
        ConfigProvider2.fromStringLeafJson(["1", "value"]),
        `readonly [string, number]
└─ [1]
   └─ number & finite
      └─ finite
         └─ Invalid data NaN`
      )
    })

    it("Array", async () => {
      const schema = Schema.Array(Schema.FiniteFromString)
      const config = Config2.schema(schema)

      await assertSuccess(config, ConfigProvider2.fromStringLeafJson(["1", "2"]), [1, 2])
      await assertFailure(
        config,
        ConfigProvider2.fromStringLeafJson(["1", "value"]),
        `ReadonlyArray<number>
└─ [1]
   └─ number & finite
      └─ finite
         └─ Invalid data NaN`
      )
    })

    describe("Union", () => {
      describe("Literals", () => {
        it("string", async () => {
          const schema = Schema.Literals(["a", "b"])
          const config = Config2.schema(schema)

          await assertSuccess(config, ConfigProvider2.fromStringLeafJson("a"), "a")
          await assertSuccess(config, ConfigProvider2.fromStringLeafJson("b"), "b")
        })
      })
    })

    it("Suspend", async () => {
      interface A {
        readonly a: string
        readonly as: ReadonlyArray<A>
      }
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
      })
      const config = Config2.schema(schema)

      await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "1", as: [] }), { a: "1", as: [] })
      await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "1", as: [{ a: "2", as: [] }] }), {
        a: "1",
        as: [{ a: "2", as: [] }]
      })
    })

    it("URL", async () => {
      const schema = Schema.Struct({ url: Schema.URL })
      const config = Config2.schema(schema)

      await assertSuccess(
        config,
        ConfigProvider2.fromStringLeafJson({ url: "https://example.com" }),
        { url: new URL("https://example.com") }
      )
    })
  })
})
