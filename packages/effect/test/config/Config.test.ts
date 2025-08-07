import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { Effect, pipe } from "effect"
import { Config, ConfigProvider } from "effect/config"
import { Option } from "effect/data"
import { Issue, Schema } from "effect/schema"
import { Duration } from "effect/time"
import { assertions } from "../utils/schema.ts"

async function assertSuccess<T>(config: Config.Config<T>, provider: ConfigProvider.ConfigProvider, expected: T) {
  const result = config.parse(provider)
  return await assertions.effect.succeed(result, expected)
}

async function assertFailure<T>(config: Config.Config<T>, provider: ConfigProvider.ConfigProvider, message: string) {
  const result = config.parse(provider).pipe(
    Effect.catchTag(
      "SourceError",
      (e) =>
        Effect.fail(
          new Schema.SchemaError({
            issue: new Issue.InvalidValue(Option.none(), { message: `SourceError: ${e.reason}` })
          })
        )
    )
  )
  return await assertions.effect.fail(result.pipe(Effect.mapError((e) => e.issue)), message)
}

describe("Config", () => {
  it("a config can be yielded", () => {
    const provider = ConfigProvider.fromEnv({ env: { STRING: "value" } })
    const result = Effect.runSync(Effect.provide(
      Config.schema(Schema.Struct({ STRING: Schema.String })).asEffect(),
      ConfigProvider.layer(provider)
    ))
    deepStrictEqual(result, { STRING: "value" })
  })

  describe("schema", () => {
    it("path argument", async () => {
      await assertSuccess(
        Config.schema(Schema.String, []),
        ConfigProvider.fromStringLeafJson("value"),
        "value"
      )
      await assertSuccess(
        Config.schema(Schema.String, "a"),
        ConfigProvider.fromStringLeafJson({ a: "value" }),
        "value"
      )
      await assertSuccess(
        Config.schema(Schema.String, ["a", "b"]),
        ConfigProvider.fromStringLeafJson({ a: { b: "value" } }),
        "value"
      )
    })
  })

  it("map", async () => {
    const config = Config.schema(Schema.String)
    await assertSuccess(
      Config.map(config, (value) => value.toUpperCase()),
      ConfigProvider.fromStringLeafJson("value"),
      "VALUE"
    )
    await assertSuccess(
      pipe(config, Config.map((value) => value.toUpperCase())),
      ConfigProvider.fromStringLeafJson("value"),
      "VALUE"
    )
  })

  describe("unwrap", () => {
    it("plain object", async () => {
      const config = Config.unwrap({
        a: Config.schema(Schema.String, "a2")
      })

      await assertSuccess(config, ConfigProvider.fromStringLeafJson({ a2: "value" }), { a: "value" })
    })

    it("nested", async () => {
      const config = Config.unwrap({
        a: {
          b: Config.schema(Schema.String, "b2")
        }
      })

      await assertSuccess(
        config,
        ConfigProvider.fromStringLeafJson({ b2: "value" }),
        { a: { b: "value" } }
      )
    })
  })

  describe("fromEnv", () => {
    it("String", async () => {
      const schema = Schema.String
      const config = Config.schema(schema)

      await assertFailure(config, ConfigProvider.fromEnv({ env: {} }), `Expected string, actual undefined`)
    })

    it("node can be both leaf and object", async () => {
      const schema = Schema.Struct({ a: Schema.Finite })
      const config = Config.schema(schema)

      await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "1", "a__b": "2" } }), { a: 1 })
    })

    it("node can be both leaf and array", async () => {
      const schema = Schema.Struct({ a: Schema.Finite })
      const config = Config.schema(schema)

      await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "1", "a__0": "2" } }), { a: 1 })
    })

    describe("Struct", () => {
      it("required properties", async () => {
        const schema = Schema.Struct({ a: Schema.Finite })
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: 1 })
      })

      it("optionalKey properties", async () => {
        const schema = Schema.Struct({ a: Schema.optionalKey(Schema.Finite) })
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: 1 })
        await assertSuccess(config, ConfigProvider.fromEnv({ env: {} }), {})
      })

      it("optional properties", async () => {
        const config = Config.schema(
          Schema.Struct({ a: Schema.optional(Schema.Finite) })
        )

        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: 1 })
        await assertSuccess(config, ConfigProvider.fromEnv({ env: {} }), {})
      })

      it("Literals", async () => {
        const schema = Schema.Struct({ a: Schema.Literals(["b", "c"]) })
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "b" } }), { a: "b" })
        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "c" } }), { a: "c" })
      })

      it("Array(Finite)", async () => {
        const schema = Schema.Struct({ a: Schema.Array(Schema.Finite) })
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "" } }), { a: [] })
        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: [1] })
        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a__0: "1", a__1: "2" } }), { a: [1, 2] })
      })
    })

    it("Record", async () => {
      const schema = Schema.Record(Schema.String, Schema.Finite)
      const config = Config.schema(schema)

      await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: 1 })
      await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "1", b: "2" } }), { a: 1, b: 2 })
      await assertFailure(
        config,
        ConfigProvider.fromEnv({ env: { a: "1", b: "value" } }),
        `{ readonly [x: string]: number }
└─ ["b"]
   └─ Encoding failure
      └─ string & a string representing a number
         └─ a string representing a number
            └─ Invalid data "value"`
      )
    })

    describe("Tuple", () => {
      it("empty", async () => {
        const schema = Schema.Struct({ a: Schema.Tuple([]) })
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "" } }), { a: [] })
      })

      it("ensure array", async () => {
        const schema = Schema.Struct({ a: Schema.Tuple([Schema.Finite]) })
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: [1] })
      })

      it("required elements", async () => {
        const schema = Schema.Struct({ a: Schema.Tuple([Schema.String, Schema.Finite]) })
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a__0: "a", a__1: "2" } }), { a: ["a", 2] })
        await assertFailure(
          config,
          ConfigProvider.fromEnv({ env: { a: "a" } }),
          `{ readonly "a": readonly [string, number] }
└─ ["a"]
   └─ readonly [string, number]
      └─ [1]
         └─ Missing key`
        )
        await assertFailure(
          config,
          ConfigProvider.fromEnv({ env: { a__0: "a", a__1: "value" } }),
          `{ readonly "a": readonly [string, number] }
└─ ["a"]
   └─ readonly [string, number]
      └─ [1]
         └─ Encoding failure
            └─ string & a string representing a number
               └─ a string representing a number
                  └─ Invalid data "value"`
        )
      })
    })

    it("Array", async () => {
      const schema = Schema.Struct({ a: Schema.Array(Schema.Finite) })
      const config = Config.schema(schema)

      await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: [1] })
      await assertSuccess(config, ConfigProvider.fromEnv({ env: { a__0: "1", a__1: "2" } }), { a: [1, 2] })
      await assertFailure(
        config,
        ConfigProvider.fromEnv({ env: { a__0: "1", a__1: "value" } }),
        `{ readonly "a": ReadonlyArray<number> }
└─ ["a"]
   └─ ReadonlyArray<number>
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
          const schema = Schema.Struct({ a: Schema.Literals(["a", "b"]) })
          const config = Config.schema(schema)

          await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "a" } }), { a: "a" })
          await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "b" } }), { a: "b" })
        })
      })

      it("inclusive", async () => {
        const schema = Schema.Union([
          Schema.Struct({ a: Schema.String }),
          Schema.Struct({ b: Schema.Finite })
        ])
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "a" } }), { a: "a" })
        await assertSuccess(config, ConfigProvider.fromEnv({ env: { b: "1" } }), { b: 1 })
        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "a", b: "1" } }), { a: "a" })
      })

      it("exclusive", async () => {
        const schema = Schema.Union([
          Schema.Struct({ a: Schema.String }),
          Schema.Struct({ b: Schema.Finite })
        ], { mode: "oneOf" })
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "a" } }), { a: "a" })
        await assertSuccess(config, ConfigProvider.fromEnv({ env: { b: "1" } }), { b: 1 })
        await assertFailure(
          config,
          ConfigProvider.fromEnv({ env: { a: "a", b: "1" } }),
          `Expected exactly one member to match the input {"a":"a","b":"1"}, but multiple members matched in { readonly "a": string } ⊻ { readonly "b": number }`
        )
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
      const config = Config.schema(schema)

      await assertSuccess(config, ConfigProvider.fromEnv({ env: { a: "1", as: "" } }), { a: "1", as: [] })
      await assertSuccess(
        config,
        ConfigProvider.fromEnv({ env: { a: "1", as__0__a: "2", as__0__as__TYPE: "A" } }),
        {
          a: "1",
          as: [{ a: "2", as: [] }]
        }
      )
    })
  })

  describe("fromStringLeafJson", () => {
    it("String", async () => {
      const schema = Schema.String
      const config = Config.schema(schema)

      await assertSuccess(config, ConfigProvider.fromStringLeafJson("value"), "value")
      await assertFailure(config, ConfigProvider.fromStringLeafJson({}), `Expected string, actual undefined`)
    })

    describe("Struct", () => {
      it("required properties", async () => {
        const schema = Schema.Struct({ a: Schema.Finite })
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromStringLeafJson({ a: "1" }), { a: 1 })
        await assertFailure(
          config,
          ConfigProvider.fromStringLeafJson({}),
          `{ readonly "a": number }
└─ ["a"]
   └─ Missing key`
        )
        await assertFailure(
          config,
          ConfigProvider.fromStringLeafJson({ a: "value" }),
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
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromStringLeafJson({ a: "1" }), { a: 1 })
        await assertSuccess(config, ConfigProvider.fromStringLeafJson({}), {})
      })

      it("optional properties", async () => {
        const config = Config.schema(
          Schema.Struct({ a: Schema.optional(Schema.Finite) })
        )

        await assertSuccess(config, ConfigProvider.fromStringLeafJson({ a: "1" }), { a: 1 })
        await assertSuccess(config, ConfigProvider.fromStringLeafJson({}), {})
      })

      it("Literals", async () => {
        const schema = Schema.Struct({ a: Schema.Literals(["b", "c"]) })
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromStringLeafJson({ a: "b" }), { a: "b" })
        await assertSuccess(config, ConfigProvider.fromStringLeafJson({ a: "c" }), { a: "c" })
      })
    })

    it("Record", async () => {
      const schema = Schema.Record(Schema.String, Schema.Finite)
      const config = Config.schema(schema)

      await assertSuccess(config, ConfigProvider.fromStringLeafJson({ a: "1" }), { a: 1 })
      await assertSuccess(config, ConfigProvider.fromStringLeafJson({ a: "1", b: "2" }), { a: 1, b: 2 })
      await assertFailure(
        config,
        ConfigProvider.fromStringLeafJson({ a: "1", b: "value" }),
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
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromStringLeafJson(["1"]), [1])
        await assertSuccess(config, ConfigProvider.fromStringLeafJson("1"), [1])
      })

      it("required elements", async () => {
        const schema = Schema.Tuple([Schema.String, Schema.Finite])
        const config = Config.schema(schema)

        await assertSuccess(config, ConfigProvider.fromStringLeafJson(["a", "2"]), ["a", 2])
        await assertFailure(
          config,
          ConfigProvider.fromStringLeafJson(["a"]),
          `readonly [string, number]
└─ [1]
   └─ Missing key`
        )
        await assertFailure(
          config,
          ConfigProvider.fromStringLeafJson(["a", "value"]),
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
      const config = Config.schema(schema)

      await assertSuccess(config, ConfigProvider.fromStringLeafJson(["1"]), [1])
      // ensure array
      await assertSuccess(config, ConfigProvider.fromStringLeafJson("1"), [1])
      await assertSuccess(config, ConfigProvider.fromStringLeafJson(["1", "2"]), [1, 2])
      await assertFailure(
        config,
        ConfigProvider.fromStringLeafJson(["1", "value"]),
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
          const config = Config.schema(schema)

          await assertSuccess(config, ConfigProvider.fromStringLeafJson("a"), "a")
          await assertSuccess(config, ConfigProvider.fromStringLeafJson("b"), "b")
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
      const config = Config.schema(schema)

      await assertSuccess(config, ConfigProvider.fromStringLeafJson({ a: "1", as: [] }), { a: "1", as: [] })
      await assertSuccess(config, ConfigProvider.fromStringLeafJson({ a: "1", as: [{ a: "2", as: [] }] }), {
        a: "1",
        as: [{ a: "2", as: [] }]
      })
    })

    it("URL", async () => {
      const schema = Schema.Struct({ url: Schema.URL })
      const config = Config.schema(schema)

      await assertSuccess(
        config,
        ConfigProvider.fromStringLeafJson({ url: "https://example.com" }),
        { url: new URL("https://example.com") }
      )
    })
  })

  describe("schemas", () => {
    it("Boolean", async () => {
      const provider = ConfigProvider.fromStringLeafJson({
        a: "true",
        b: "false",
        c: "yes",
        d: "no",
        e: "on",
        f: "off",
        g: "1",
        h: "0",
        failure: "value"
      })

      await assertSuccess(Config.schema(Config.Boolean, "a"), provider, true)
      await assertSuccess(Config.schema(Config.Boolean, "b"), provider, false)
      await assertSuccess(Config.schema(Config.Boolean, "c"), provider, true)
      await assertSuccess(Config.schema(Config.Boolean, "d"), provider, false)
      await assertSuccess(Config.schema(Config.Boolean, "e"), provider, true)
      await assertSuccess(Config.schema(Config.Boolean, "f"), provider, false)
      await assertSuccess(Config.schema(Config.Boolean, "g"), provider, true)
      await assertSuccess(Config.schema(Config.Boolean, "h"), provider, false)
      await assertFailure(
        Config.schema(Config.Boolean, "failure"),
        provider,
        `Expected "true" | "yes" | "on" | "1" | "false" | "no" | "off" | "0", actual "value"`
      )
    })

    it("Duration", async () => {
      const provider = ConfigProvider.fromStringLeafJson({
        a: "1000 millis",
        b: "1 second",
        failure: "value"
      })

      await assertSuccess(Config.schema(Config.Duration, "a"), provider, Duration.millis(1000))
      await assertSuccess(Config.schema(Config.Duration, "b"), provider, Duration.seconds(1))
      await assertFailure(Config.schema(Config.Duration, "failure"), provider, `Invalid data "value"`)
    })

    it("Port", async () => {
      const provider = ConfigProvider.fromStringLeafJson({
        a: "8080",
        failure: "-1"
      })

      await assertSuccess(Config.schema(Config.Port, "a"), provider, 8080)
      await assertFailure(
        Config.schema(Config.Port, "failure"),
        provider,
        `number & int & between(1, 65535)
└─ between(1, 65535)
   └─ Invalid data -1`
      )
    })

    it("LogLevel", async () => {
      const provider = ConfigProvider.fromStringLeafJson({
        a: "Info",
        failure_1: "info",
        failure_2: "value"
      })

      await assertSuccess(Config.schema(Config.LogLevel, "a"), provider, "Info")
      await assertFailure(
        Config.schema(Config.LogLevel, "failure_1"),
        provider,
        `Expected "All" | "Fatal" | "Error" | "Warn" | "Info" | "Debug" | "Trace" | "None", actual "info"`
      )
      await assertFailure(
        Config.schema(Config.LogLevel, "failure_2"),
        provider,
        `Expected "All" | "Fatal" | "Error" | "Warn" | "Info" | "Debug" | "Trace" | "None", actual "value"`
      )
    })
  })
})
