import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
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
        Effect.fail(
          new Schema.SchemaError({ issue: new Issue.InvalidValue(Option.none(), { message: `GetError: ${e.reason}` }) })
        )
    )
  )
  return await assertions.effect.fail(result.pipe(Effect.mapError((e) => e.issue)), message)
}

describe("Config2", () => {
  it("can be yielded", () => {
    const provider = ConfigProvider2.fromEnv({ environment: { STRING: "value" } })
    const result = Effect.runSync(Effect.provide(
      Config2.schema(Schema.Struct({ STRING: Schema.String })).asEffect(),
      ConfigProvider2.layer(provider)
    ))
    deepStrictEqual(result, { STRING: "value" })
  })

  describe("schema", () => {
    it("path argument", async () => {
      await assertSuccess(
        Config2.schema(Schema.String, []),
        ConfigProvider2.fromStringLeafJson("value"),
        "value"
      )
      await assertSuccess(
        Config2.schema(Schema.String, "a"),
        ConfigProvider2.fromStringLeafJson({ a: "value" }),
        "value"
      )
      await assertSuccess(
        Config2.schema(Schema.String, ["a", "b"]),
        ConfigProvider2.fromStringLeafJson({ a: { b: "value" } }),
        "value"
      )
    })
  })

  describe("unwrap", () => {
    it("plain object", async () => {
      const config = Config2.unwrap({
        a: Config2.schema(Schema.String, "a2")
      })

      await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a2: "value" }), { a: "value" })
    })

    it("nested", async () => {
      const config = Config2.unwrap({
        a: {
          b: Config2.schema(Schema.String, "b2")
        }
      })

      await assertSuccess(
        config,
        ConfigProvider2.fromStringLeafJson({ b2: "value" }),
        { a: { b: "value" } }
      )
    })
  })

  describe("fromEnv", () => {
    it("example", async () => {
      const schema = Schema.Struct({
        API_KEY: Schema.String,
        PORT: Schema.Int,
        LOCALHOST: Schema.URL
      })
      const config = Config2.schema(schema)

      await assertSuccess(
        config,
        ConfigProvider2.fromEnv({ environment: { API_KEY: "abc123", PORT: "1", LOCALHOST: "https://example.com" } }),
        { API_KEY: "abc123", PORT: 1, LOCALHOST: new URL("https://example.com") }
      )
    })

    it("String", async () => {
      const schema = Schema.String
      const config = Config2.schema(schema)

      await assertFailure(config, ConfigProvider2.fromEnv({ environment: {} }), `Expected string, actual undefined`)
    })

    describe("Struct", () => {
      it("required properties", async () => {
        const schema = Schema.Struct({ a: Schema.Finite })
        const config = Config2.schema(schema)

        await assertSuccess(config, ConfigProvider2.fromEnv({ environment: { a: "1" } }), { a: 1 })
      })

      it("Array(Finite)", async () => {
        const schema = Schema.Struct({ a: Schema.Array(Schema.Finite) })
        const config = Config2.schema(schema)

        await assertSuccess(config, ConfigProvider2.fromEnv({ environment: { a: "1" } }), { a: [1] })
        // ensure array
        await assertSuccess(config, ConfigProvider2.fromEnv({ environment: { a: "1" } }), { a: [1] })
      })
    })
  })

  describe("fromStringLeafJson", () => {
    it("String", async () => {
      const schema = Schema.String
      const config = Config2.schema(schema)

      await assertSuccess(config, ConfigProvider2.fromStringLeafJson("value"), "value")
      await assertFailure(config, ConfigProvider2.fromStringLeafJson({}), `Expected string, actual undefined`)
    })

    describe("Struct", () => {
      it("required properties", async () => {
        const schema = Schema.Struct({ a: Schema.Finite })
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
   └─ Encoding failure
      └─ string & a string representing a number
         └─ a string representing a number
            └─ Invalid data "value"`
        )
      })

      it("optionalKey properties", async () => {
        const schema = Schema.Struct({ a: Schema.optionalKey(Schema.Finite) })
        const config = Config2.schema(schema)

        await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "1" }), { a: 1 })
        await assertSuccess(config, ConfigProvider2.fromStringLeafJson({}), {})
      })

      it("optional properties", async () => {
        const config = Config2.schema(
          Schema.Struct({ a: Schema.optional(Schema.Finite) })
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
      const schema = Schema.Record(Schema.String, Schema.Finite)
      const config = Config2.schema(schema)

      await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "1" }), { a: 1 })
      await assertSuccess(config, ConfigProvider2.fromStringLeafJson({ a: "1", b: "2" }), { a: 1, b: 2 })
      await assertFailure(
        config,
        ConfigProvider2.fromStringLeafJson({ a: "1", b: "value" }),
        `{ readonly [x: string]: number }
└─ ["b"]
   └─ Encoding failure
      └─ string & a string representing a number
         └─ a string representing a number
            └─ Invalid data "value"`
      )
    })

    describe("Tuple", () => {
      it("ensure array", async () => {
        const schema = Schema.Tuple([Schema.Finite])
        const config = Config2.schema(schema)

        await assertSuccess(config, ConfigProvider2.fromStringLeafJson(["1"]), [1])
        await assertSuccess(config, ConfigProvider2.fromStringLeafJson("1"), [1])
      })

      it("required elements", async () => {
        const schema = Schema.Tuple([Schema.String, Schema.Finite])
        const config = Config2.schema(schema)

        await assertSuccess(config, ConfigProvider2.fromStringLeafJson(["a", "2"]), ["a", 2])
        await assertFailure(
          config,
          ConfigProvider2.fromStringLeafJson(["a"]),
          `readonly [string, number]
└─ [1]
   └─ Missing key`
        )
        await assertFailure(
          config,
          ConfigProvider2.fromStringLeafJson(["a", "value"]),
          `readonly [string, number]
└─ [1]
   └─ Encoding failure
      └─ string & a string representing a number
         └─ a string representing a number
            └─ Invalid data "value"`
        )
      })
    })

    it("Array", async () => {
      const schema = Schema.Array(Schema.Finite)
      const config = Config2.schema(schema)

      await assertSuccess(config, ConfigProvider2.fromStringLeafJson(["1"]), [1])
      // ensure array
      await assertSuccess(config, ConfigProvider2.fromStringLeafJson("1"), [1])
      await assertSuccess(config, ConfigProvider2.fromStringLeafJson(["1", "2"]), [1, 2])
      await assertFailure(
        config,
        ConfigProvider2.fromStringLeafJson(["1", "value"]),
        `ReadonlyArray<number>
└─ [1]
   └─ Encoding failure
      └─ string & a string representing a number
         └─ a string representing a number
            └─ Invalid data "value"`
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
