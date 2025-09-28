import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { Config, ConfigProvider, Duration, Effect, pipe } from "effect"
import { Option, Redacted, Result } from "effect/data"
import { Issue, Schema } from "effect/schema"
import * as assert from "node:assert"

async function succeed<T>(config: Config.Config<T>, provider: ConfigProvider.ConfigProvider, expected: T) {
  const r = await config.parse(provider).pipe(
    Effect.result,
    Effect.runPromise
  )
  assert.deepStrictEqual(r, Result.succeed(expected))
}

async function fail<T>(config: Config.Config<T>, provider: ConfigProvider.ConfigProvider, message: string) {
  const r = await config.parse(provider).pipe(
    Effect.catchTag(
      "SourceError",
      (e) =>
        Effect.fail(
          new Schema.SchemaError(new Issue.InvalidValue(Option.none(), { message: `SourceError: ${e.message}` }))
        )
    ),
    Effect.mapError((e) => e.issue.toString()),
    Effect.result,
    Effect.runPromise
  )
  assert.deepStrictEqual(r, Result.fail(message))
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

  it("map", async () => {
    const config = Config.schema(Schema.String)

    await succeed(
      Config.map(config, (value) => value.toUpperCase()),
      ConfigProvider.fromStringPojo("value"),
      "VALUE"
    )
    await succeed(
      pipe(config, Config.map((value) => value.toUpperCase())),
      ConfigProvider.fromStringPojo("value"),
      "VALUE"
    )
  })

  it("mapOrFail", async () => {
    const config = Config.schema(Schema.String)
    const f = (s: string) =>
      s === ""
        ? Effect.fail(new Schema.SchemaError(new Issue.InvalidValue(Option.some(s), { message: "empty" })))
        : Effect.succeed(s.toUpperCase())

    await succeed(
      Config.mapOrFail(config, f),
      ConfigProvider.fromStringPojo("value"),
      "VALUE"
    )
    await fail(
      Config.mapOrFail(config, f),
      ConfigProvider.fromStringPojo(""),
      `empty`
    )
  })

  it("orElse", async () => {
    const config = Config.orElse(Config.string("a"), () => Config.finite("b"))

    await succeed(
      config,
      ConfigProvider.fromStringPojo({ a: "value" }),
      "value"
    )
    await succeed(
      config,
      ConfigProvider.fromStringPojo({ b: "1" }),
      1
    )
  })

  describe("all", () => {
    it("tuple", async () => {
      const config = Config.all([Config.nonEmptyString("a"), Config.finite("b")])

      await succeed(config, ConfigProvider.fromStringPojo({ a: "a", b: "1" }), ["a", 1])
      await fail(
        config,
        ConfigProvider.fromStringPojo({ a: "", b: "1" }),
        `Expected a value with a length of at least 1, got ""
  at ["a"]`
      )
      await fail(
        config,
        ConfigProvider.fromStringPojo({ a: "a", b: "b" }),
        `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "b"
  at ["b"]`
      )
    })

    it("iterable", async () => {
      const config = Config.all(new Set([Config.nonEmptyString("a"), Config.finite("b")]))

      await succeed(config, ConfigProvider.fromStringPojo({ a: "a", b: "1" }), ["a", 1])
      await fail(
        config,
        ConfigProvider.fromStringPojo({ a: "", b: "1" }),
        `Expected a value with a length of at least 1, got ""
  at ["a"]`
      )
      await fail(
        config,
        ConfigProvider.fromStringPojo({ a: "a", b: "b" }),
        `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "b"
  at ["b"]`
      )
    })

    it("struct", async () => {
      const config = Config.all({ a: Config.nonEmptyString("b"), c: Config.finite("d") })

      await succeed(config, ConfigProvider.fromStringPojo({ b: "b", d: "1" }), { a: "b", c: 1 })
      await fail(
        config,
        ConfigProvider.fromStringPojo({ b: "", d: "1" }),
        `Expected a value with a length of at least 1, got ""
  at ["b"]`
      )
      await fail(
        config,
        ConfigProvider.fromStringPojo({ b: "b", d: "b" }),
        `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "b"
  at ["d"]`
      )
    })
  })

  describe("withDefault", () => {
    it("value", async () => {
      const defaultValue = 0
      const config = Config.finite("a").pipe(Config.withDefault(() => defaultValue))

      await succeed(config, ConfigProvider.fromStringPojo({ a: "1" }), 1)
      await succeed(config, ConfigProvider.fromStringPojo({}), defaultValue)
      await fail(
        config,
        ConfigProvider.fromStringPojo({ a: "value" }),
        `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "value"
  at ["a"]`
      )
    })

    it("struct", async () => {
      const defaultValue = { a: "a", c: 0 }
      const config = Config.all({ a: Config.nonEmptyString("b"), c: Config.finite("d") }).pipe(
        Config.withDefault(() => defaultValue)
      )

      await succeed(config, ConfigProvider.fromStringPojo({ b: "b", d: "1" }), { a: "b", c: 1 })
      await succeed(config, ConfigProvider.fromStringPojo({ b: "b" }), defaultValue)
      await succeed(config, ConfigProvider.fromStringPojo({ d: "1" }), defaultValue)

      await fail(
        config,
        ConfigProvider.fromStringPojo({ b: "", d: "1" }),
        `Expected a value with a length of at least 1, got ""
  at ["b"]`
      )
    })
  })

  describe("option", () => {
    it("value", async () => {
      const config = Config.finite("a").pipe(Config.option)

      await succeed(config, ConfigProvider.fromStringPojo({ a: "1" }), Option.some(1))
      await succeed(config, ConfigProvider.fromStringPojo({}), Option.none())
      await fail(
        config,
        ConfigProvider.fromStringPojo({ a: "value" }),
        `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "value"
  at ["a"]`
      )
    })

    it("struct", async () => {
      const config = Config.all({ a: Config.nonEmptyString("b"), c: Config.finite("d") }).pipe(
        Config.option
      )

      await succeed(config, ConfigProvider.fromStringPojo({ b: "b", d: "1" }), Option.some({ a: "b", c: 1 }))
      await succeed(config, ConfigProvider.fromStringPojo({ b: "b" }), Option.none())
      await succeed(config, ConfigProvider.fromStringPojo({ d: "1" }), Option.none())

      await fail(
        config,
        ConfigProvider.fromStringPojo({ b: "", d: "1" }),
        `Expected a value with a length of at least 1, got ""
  at ["b"]`
      )
    })
  })

  describe("unwrap", () => {
    it("plain object", async () => {
      const config = Config.unwrap({
        a: Config.schema(Schema.String, "a2")
      })

      await succeed(config, ConfigProvider.fromStringPojo({ a2: "value" }), { a: "value" })
    })

    it("nested", async () => {
      const config = Config.unwrap({
        a: {
          b: Config.schema(Schema.String, "b2")
        }
      })

      await succeed(
        config,
        ConfigProvider.fromStringPojo({ b2: "value" }),
        { a: { b: "value" } }
      )
    })
  })

  describe("fromEnv", () => {
    describe("leafs and containers", () => {
      it("node can be both leaf and object", async () => {
        const schema = Schema.Struct({ a: Schema.Finite })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "1", "a__b": "2" } }), { a: 1 })
      })

      it("node can be both leaf and array", async () => {
        const schema = Schema.Struct({ a: Schema.Finite })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "1", "a__0": "2" } }), { a: 1 })
      })

      it("if a node can be both object and array, it should be an object", async () => {
        const schema = Schema.Struct({ a: Schema.Struct({ b: Schema.Finite }) })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "1", "a__b": "2", "a__0": "3" } }), {
          a: { b: 2 }
        })
      })
    })

    it("path argument", async () => {
      await succeed(
        Config.schema(Schema.String, "a"),
        ConfigProvider.fromEnv({ env: { a: "value" } }),
        "value"
      )
      await succeed(
        Config.schema(Schema.String, ["a", "b"]),
        ConfigProvider.fromEnv({ env: { "a__b": "value" } }),
        "value"
      )
      await succeed(
        Config.schema(Schema.UndefinedOr(Schema.String)),
        ConfigProvider.fromEnv({ env: {} }),
        undefined
      )
      await succeed(
        Config.schema(Schema.UndefinedOr(Schema.String), "a"),
        ConfigProvider.fromEnv({ env: {} }),
        undefined
      )
    })

    it("String", async () => {
      const schema = Schema.String
      const config = Config.schema(schema, "a")

      await succeed(config, ConfigProvider.fromEnv({ env: { a: "a" } }), "a")
      await fail(
        config,
        ConfigProvider.fromEnv({ env: {} }),
        `Expected string, got undefined
  at ["a"]`
      )
    })

    describe("Struct", () => {
      it("required properties", async () => {
        const schema = Schema.Struct({ a: Schema.Finite })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: 1 })
      })

      it("optionalKey properties", async () => {
        const schema = Schema.Struct({ a: Schema.optionalKey(Schema.Finite) })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: 1 })
        await succeed(config, ConfigProvider.fromEnv({ env: {} }), {})
      })

      it("optional properties", async () => {
        const config = Config.schema(
          Schema.Struct({ a: Schema.optional(Schema.Finite) })
        )

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: 1 })
        await succeed(config, ConfigProvider.fromEnv({ env: {} }), {})
      })

      it("Literals", async () => {
        const schema = Schema.Struct({ a: Schema.Literals(["b", "c"]) })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "b" } }), { a: "b" })
        await succeed(config, ConfigProvider.fromEnv({ env: { a: "c" } }), { a: "c" })
      })

      it("Array(Finite)", async () => {
        const schema = Schema.Struct({ a: Schema.Array(Schema.Finite) })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "" } }), { a: [] })
        await succeed(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: [1] })
        await succeed(config, ConfigProvider.fromEnv({ env: { a__0: "1", a__1: "2" } }), { a: [1, 2] })
      })
    })

    describe("Record", () => {
      it("Finite", async () => {
        const schema = Schema.Record(Schema.String, Schema.Finite)
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: 1 })
        await succeed(config, ConfigProvider.fromEnv({ env: { a: "1", b: "2" } }), { a: 1, b: 2 })
        await fail(
          config,
          ConfigProvider.fromEnv({ env: { a: "1", b: "value" } }),
          `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "value"
  at ["b"]`
        )
      })
    })

    describe("Tuple", () => {
      it("empty", async () => {
        const schema = Schema.Struct({ a: Schema.Tuple([]) })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "" } }), { a: [] })
      })

      it("ensure array", async () => {
        const schema = Schema.Struct({ a: Schema.Tuple([Schema.Finite]) })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: [1] })
      })

      it("required elements", async () => {
        const schema = Schema.Struct({ a: Schema.Tuple([Schema.String, Schema.Finite]) })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a__0: "a", a__1: "2" } }), { a: ["a", 2] })
        await fail(
          config,
          ConfigProvider.fromEnv({ env: { a: "a" } }),
          `Missing key
  at ["a"][1]`
        )
        await fail(
          config,
          ConfigProvider.fromEnv({ env: { a__0: "a", a__1: "value" } }),
          `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "value"
  at ["a"][1]`
        )
      })
    })

    it("Array", async () => {
      const schema = Schema.Struct({ a: Schema.Array(Schema.Finite) })
      const config = Config.schema(schema)

      await succeed(config, ConfigProvider.fromEnv({ env: { a: "1" } }), { a: [1] })
      await succeed(config, ConfigProvider.fromEnv({ env: { a__0: "1", a__1: "2" } }), { a: [1, 2] })
      await fail(
        config,
        ConfigProvider.fromEnv({ env: { a__0: "1", a__1: "value" } }),
        `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "value"
  at ["a"][1]`
      )
    })

    describe("Union", () => {
      describe("Literals", () => {
        it("string", async () => {
          const schema = Schema.Struct({ a: Schema.Literals(["a", "b"]) })
          const config = Config.schema(schema)

          await succeed(config, ConfigProvider.fromEnv({ env: { a: "a" } }), { a: "a" })
          await succeed(config, ConfigProvider.fromEnv({ env: { a: "b" } }), { a: "b" })
        })
      })

      it("inclusive", async () => {
        const schema = Schema.Union([
          Schema.Struct({ a: Schema.String }),
          Schema.Struct({ b: Schema.Finite })
        ])
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "a" } }), { a: "a" })
        await succeed(config, ConfigProvider.fromEnv({ env: { b: "1" } }), { b: 1 })
        await succeed(config, ConfigProvider.fromEnv({ env: { a: "a", b: "1" } }), { a: "a" })
      })

      it("exclusive", async () => {
        const schema = Schema.Union([
          Schema.Struct({ a: Schema.String }),
          Schema.Struct({ b: Schema.Finite })
        ], { mode: "oneOf" })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromEnv({ env: { a: "a" } }), { a: "a" })
        await succeed(config, ConfigProvider.fromEnv({ env: { b: "1" } }), { b: 1 })
        await fail(
          config,
          ConfigProvider.fromEnv({ env: { a: "a", b: "1" } }),
          `Expected exactly one member to match the input {"a":"a","b":"1"}`
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

      await succeed(config, ConfigProvider.fromEnv({ env: { a: "1", as: "" } }), { a: "1", as: [] })
      await succeed(
        config,
        ConfigProvider.fromEnv({ env: { a: "1", as__0__a: "2", as__0__as__TYPE: "A" } }),
        {
          a: "1",
          as: [{ a: "2", as: [] }]
        }
      )
    })

    it("Redacted(Int)", async () => {
      const schema = Schema.Redacted(Schema.Int)
      const config = Config.schema(schema, "a")

      await succeed(config, ConfigProvider.fromEnv({ env: { a: "1" } }), Redacted.make(1))
      await fail(
        config,
        ConfigProvider.fromEnv({ env: {} }),
        `Expected string, got undefined
  at ["a"]`
      )
      await fail(
        config,
        ConfigProvider.fromEnv({ env: { a: "1.1" } }),
        `Expected an integer, got 1.1
  at ["a"]`
      )
    })
  })

  describe("fromStringLeafJson", () => {
    it("path argument", async () => {
      await succeed(
        Config.schema(Schema.String, []),
        ConfigProvider.fromStringPojo("value"),
        "value"
      )
      await succeed(
        Config.schema(Schema.String, "a"),
        ConfigProvider.fromStringPojo({ a: "value" }),
        "value"
      )
      await succeed(
        Config.schema(Schema.String, ["a", "b"]),
        ConfigProvider.fromStringPojo({ a: { b: "value" } }),
        "value"
      )
    })

    it("String", async () => {
      const schema = Schema.String
      const config = Config.schema(schema)

      await succeed(config, ConfigProvider.fromStringPojo("value"), "value")
      await fail(config, ConfigProvider.fromStringPojo({}), `Expected string, got undefined`)
    })

    describe("Struct", () => {
      it("required properties", async () => {
        const schema = Schema.Struct({ a: Schema.Finite })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromStringPojo({ a: "1" }), { a: 1 })
        await fail(
          config,
          ConfigProvider.fromStringPojo({}),
          `Missing key
  at ["a"]`
        )
        await fail(
          config,
          ConfigProvider.fromStringPojo({ a: "value" }),
          `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "value"
  at ["a"]`
        )
      })

      it("optionalKey properties", async () => {
        const schema = Schema.Struct({ a: Schema.optionalKey(Schema.Finite) })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromStringPojo({ a: "1" }), { a: 1 })
        await succeed(config, ConfigProvider.fromStringPojo({}), {})
      })

      it("optional properties", async () => {
        const config = Config.schema(
          Schema.Struct({ a: Schema.optional(Schema.Finite) })
        )

        await succeed(config, ConfigProvider.fromStringPojo({ a: "1" }), { a: 1 })
        await succeed(config, ConfigProvider.fromStringPojo({}), {})
      })

      it("Literals", async () => {
        const schema = Schema.Struct({ a: Schema.Literals(["b", "c"]) })
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromStringPojo({ a: "b" }), { a: "b" })
        await succeed(config, ConfigProvider.fromStringPojo({ a: "c" }), { a: "c" })
      })
    })

    it("Record", async () => {
      const schema = Schema.Record(Schema.String, Schema.Finite)
      const config = Config.schema(schema)

      await succeed(config, ConfigProvider.fromStringPojo({ a: "1" }), { a: 1 })
      await succeed(config, ConfigProvider.fromStringPojo({ a: "1", b: "2" }), { a: 1, b: 2 })
      await fail(
        config,
        ConfigProvider.fromStringPojo({ a: "1", b: "value" }),
        `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "value"
  at ["b"]`
      )
    })

    describe("Tuple", () => {
      it("ensure array", async () => {
        const schema = Schema.Tuple([Schema.Finite])
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromStringPojo(["1"]), [1])
        await succeed(config, ConfigProvider.fromStringPojo("1"), [1])
      })

      it("required elements", async () => {
        const schema = Schema.Tuple([Schema.String, Schema.Finite])
        const config = Config.schema(schema)

        await succeed(config, ConfigProvider.fromStringPojo(["a", "2"]), ["a", 2])
        await fail(
          config,
          ConfigProvider.fromStringPojo(["a"]),
          `Missing key
  at [1]`
        )
        await fail(
          config,
          ConfigProvider.fromStringPojo(["a", "value"]),
          `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "value"
  at [1]`
        )
      })
    })

    it("Array", async () => {
      const schema = Schema.Array(Schema.Finite)
      const config = Config.schema(schema)

      await succeed(config, ConfigProvider.fromStringPojo(["1"]), [1])
      // ensure array
      await succeed(config, ConfigProvider.fromStringPojo("1"), [1])
      await succeed(config, ConfigProvider.fromStringPojo(["1", "2"]), [1, 2])
      await fail(
        config,
        ConfigProvider.fromStringPojo(["1", "value"]),
        `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "value"
  at [1]`
      )
    })

    describe("Union", () => {
      describe("Literals", () => {
        it("string", async () => {
          const schema = Schema.Literals(["a", "b"])
          const config = Config.schema(schema)

          await succeed(config, ConfigProvider.fromStringPojo("a"), "a")
          await succeed(config, ConfigProvider.fromStringPojo("b"), "b")
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

      await succeed(config, ConfigProvider.fromStringPojo({ a: "1", as: [] }), { a: "1", as: [] })
      await succeed(config, ConfigProvider.fromStringPojo({ a: "1", as: [{ a: "2", as: [] }] }), {
        a: "1",
        as: [{ a: "2", as: [] }]
      })
    })

    it("URL", async () => {
      const schema = Schema.Struct({ url: Schema.URL })
      const config = Config.schema(schema)

      await succeed(
        config,
        ConfigProvider.fromStringPojo({ url: "https://example.com" }),
        { url: new URL("https://example.com") }
      )
    })
  })

  describe("constructors", () => {
    it("fail", async () => {
      await fail(
        Config.fail(
          new Schema.SchemaError(new Issue.Forbidden(Option.none(), { message: "failure message" }))
        ),
        ConfigProvider.fromStringPojo({}),
        `failure message`
      )
    })

    it("succeed", async () => {
      const provider = ConfigProvider.fromStringPojo({})
      await succeed(Config.succeed(1), provider, 1)
    })

    it("string", async () => {
      const provider = ConfigProvider.fromStringPojo({ a: "value" })
      await succeed(Config.string("a"), provider, "value")
      await fail(
        Config.string("b"),
        provider,
        `Expected string, got undefined
  at ["b"]`
      )
    })

    it("nonEmptyString", async () => {
      const provider = ConfigProvider.fromStringPojo({ a: "value", b: "" })
      await succeed(Config.nonEmptyString("a"), provider, "value")
      await fail(
        Config.nonEmptyString("b"),
        provider,
        `Expected a value with a length of at least 1, got ""
  at ["b"]`
      )
    })

    it("number", async () => {
      const provider = ConfigProvider.fromStringPojo({ a: "1", c: "c", d: "Infinity" })
      await succeed(Config.number("a"), provider, 1)
      await succeed(Config.number("d"), provider, Infinity)
      await fail(
        Config.number("b"),
        provider,
        `Expected string, got undefined
  at ["b"]`
      )
      await fail(
        Config.finite("c"),
        provider,
        `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "c"
  at ["c"]`
      )
    })

    it("finite", async () => {
      const provider = ConfigProvider.fromStringPojo({ a: "1", b: "a", c: "Infinity" })
      await succeed(Config.finite("a"), provider, 1)
      await fail(
        Config.finite("b"),
        provider,
        `Expected a string matching the regex (?:[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|Infinity|-Infinity|NaN), got "a"
  at ["b"]`
      )
      await fail(
        Config.finite("c"),
        provider,
        `Expected a finite number, got Infinity
  at ["c"]`
      )
    })

    it("int", async () => {
      const provider = ConfigProvider.fromStringPojo({ a: "1", b: "1.2" })
      await succeed(Config.int("a"), provider, 1)
      await fail(
        Config.int("b"),
        provider,
        `Expected an integer, got 1.2
  at ["b"]`
      )
    })

    it("literal", async () => {
      const provider = ConfigProvider.fromStringPojo({ a: "L" })
      await succeed(Config.literal("L", "a"), provider, "L")
      await fail(
        Config.literal("-", "a"),
        provider,
        `Expected "-", got "L"
  at ["a"]`
      )
    })

    it("date", async () => {
      const provider = ConfigProvider.fromStringPojo({ a: "2021-01-01", b: "invalid" })
      await succeed(Config.date("a"), provider, new Date("2021-01-01"))
      await fail(
        Config.date("b"),
        provider,
        `Expected a valid date, got Invalid Date
  at ["b"]`
      )
    })
  })

  describe("schemas", () => {
    it("Boolean / boolean", async () => {
      const provider = ConfigProvider.fromStringPojo({
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

      await succeed(Config.boolean("a"), provider, true)
      await succeed(Config.boolean("b"), provider, false)
      await succeed(Config.boolean("c"), provider, true)
      await succeed(Config.boolean("d"), provider, false)
      await succeed(Config.boolean("e"), provider, true)
      await succeed(Config.boolean("f"), provider, false)
      await succeed(Config.boolean("g"), provider, true)
      await succeed(Config.boolean("h"), provider, false)
      await fail(
        Config.boolean("failure"),
        provider,
        `Expected "true" | "yes" | "on" | "1" | "false" | "no" | "off" | "0", got "value"
  at ["failure"]`
      )
    })

    it("Duration / duration", async () => {
      const provider = ConfigProvider.fromStringPojo({
        a: "1000 millis",
        b: "1 second",
        failure: "value"
      })

      await succeed(Config.duration("a"), provider, Duration.millis(1000))
      await succeed(Config.duration("b"), provider, Duration.seconds(1))
      await fail(
        Config.duration("failure"),
        provider,
        `Invalid data "value"
  at ["failure"]`
      )
    })

    it("Port / port", async () => {
      const provider = ConfigProvider.fromStringPojo({
        a: "8080",
        failure: "-1"
      })

      await succeed(Config.port("a"), provider, 8080)
      await fail(
        Config.port("failure"),
        provider,
        `Expected a value between 1 and 65535, got -1
  at ["failure"]`
      )
    })

    it("LogLevel / logLevel", async () => {
      const provider = ConfigProvider.fromStringPojo({
        a: "Info",
        failure_1: "info",
        failure_2: "value"
      })

      await succeed(Config.logLevel("a"), provider, "Info")
      await fail(
        Config.logLevel("failure_1"),
        provider,
        `Expected "All" | "Fatal" | "Error" | "Warn" | "Info" | "Debug" | "Trace" | "None", got "info"
  at ["failure_1"]`
      )
      await fail(
        Config.logLevel("failure_2"),
        provider,
        `Expected "All" | "Fatal" | "Error" | "Warn" | "Info" | "Debug" | "Trace" | "None", got "value"
  at ["failure_2"]`
      )
    })

    it("redacted", async () => {
      const provider = ConfigProvider.fromStringPojo({
        a: "value"
      })

      await succeed(Config.redacted("a"), provider, Redacted.make("value"))
      await fail(
        Config.redacted("failure"),
        provider,
        `Expected string, got undefined
  at ["failure"]`
      )
    })

    it("url", async () => {
      const provider = ConfigProvider.fromStringPojo({
        a: "https://example.com"
      })

      await succeed(Config.url("a"), provider, new URL("https://example.com"))
      await fail(
        Config.url("failure"),
        provider,
        `Expected string, got undefined
  at ["failure"]`
      )
    })

    describe("Record", () => {
      it("from record", async () => {
        const schema = Config.Record(Schema.String, Schema.String)
        const config = Config.schema(schema, "OTEL_RESOURCE_ATTRIBUTES")

        await succeed(
          config,
          ConfigProvider.fromStringPojo({
            OTEL_RESOURCE_ATTRIBUTES: {
              "service.name": "my-service",
              "service.version": "1.0.0",
              "custom.attribute": "value"
            }
          }),
          {
            "service.name": "my-service",
            "service.version": "1.0.0",
            "custom.attribute": "value"
          }
        )
      })

      it("from string", async () => {
        const schema = Config.Record(Schema.String, Schema.String)
        const config = Config.schema(schema, "OTEL_RESOURCE_ATTRIBUTES")

        await succeed(
          config,
          ConfigProvider.fromEnv({
            env: {
              OTEL_RESOURCE_ATTRIBUTES: "service.name=my-service,service.version=1.0.0,custom.attribute=value"
            }
          }),
          {
            "service.name": "my-service",
            "service.version": "1.0.0",
            "custom.attribute": "value"
          }
        )
      })

      it("options", async () => {
        const schema = Config.Record(Schema.String, Schema.String, { separator: "&", keyValueSeparator: "==" })
        const config = Config.schema(schema, "OTEL_RESOURCE_ATTRIBUTES")

        await succeed(
          config,
          ConfigProvider.fromEnv({
            env: {
              OTEL_RESOURCE_ATTRIBUTES: "service.name==my-service&service.version==1.0.0&custom.attribute==value"
            }
          }),
          {
            "service.name": "my-service",
            "service.version": "1.0.0",
            "custom.attribute": "value"
          }
        )
      })
    })
  })
})
