import { describe, it } from "@effect/vitest"
import { assertFailure, assertSuccess, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import type { LogLevel } from "effect"
import { Brand, Cause, DateTime, Duration, Effect, Filter, Option, pipe, Redacted } from "effect"
import { Config, ConfigError, ConfigProvider } from "effect/config"

type Str = Brand.Branded<string, "Str">
const Str = Brand.refined<Str>(
  (n) => n.length > 2,
  (n) => Brand.error(`Brand: Expected ${n} to be longer than 2`)
)

const assertConfigError = <A>(
  config: Config.Config<A>,
  env: Record<string, string>,
  error: ConfigError.ConfigError
) => {
  const configProvider = ConfigProvider.fromEnv({ environment: env })
  const result = Effect.runSyncExit(config.parse(configProvider.context()))
  assertFailure(result, Cause.fail(error))
}

const assertConfigErrors = <A>(
  config: Config.Config<A>,
  env: Record<string, string>,
  errors: Array<ConfigError.ConfigError>
) => {
  const configProvider = ConfigProvider.fromEnv({ environment: env })
  const result = Effect.runSyncExit(config.parse(configProvider.context()))
  assertFailure(result, Cause.fromFailures(errors.flatMap((e) => Cause.fail(e).failures)))
}

const assertConfig = <A>(
  config: Config.Config<A>,
  env: Record<string, string>,
  a: A
) => {
  const configProvider = ConfigProvider.fromEnv({ environment: env })
  const result = Effect.runSyncExit(config.parse(configProvider.context()))
  assertSuccess(result, a)
}

describe("Config", () => {
  describe("boolean", () => {
    it("name = undefined", () => {
      const config = Config.Array("ITEMS", Config.Boolean())
      assertConfig(config, { ITEMS: "true" }, [true])
      assertConfigError(
        config,
        { ITEMS: "value" },
        new ConfigError.InvalidData({
          path: ["ITEMS", "0"],
          description: "Expected a boolean, but received: value"
        })
      )
    })

    it("name != undefined", () => {
      const config = Config.Boolean("BOOL")
      assertConfig(config, { BOOL: "true" }, true)
      assertConfig(config, { BOOL: "yes" }, true)
      assertConfig(config, { BOOL: "on" }, true)
      assertConfig(config, { BOOL: "1" }, true)
      assertConfig(config, { BOOL: "false" }, false)
      assertConfig(config, { BOOL: "no" }, false)
      assertConfig(config, { BOOL: "off" }, false)
      assertConfig(config, { BOOL: "0" }, false)

      assertConfigError(config, {}, new ConfigError.MissingData({ path: ["BOOL"], fullPath: "BOOL" }))
      assertConfigError(
        config,
        { BOOL: "value" },
        new ConfigError.InvalidData({ path: ["BOOL"], description: "Expected a boolean, but received: value" })
      )
    })
  })

  describe("url", () => {
    it("name != undefined", () => {
      const config = Config.Url("WEBSITE_URL")
      assertConfig(
        config,
        { WEBSITE_URL: "https://effect.website/docs/introduction#what-is-effect" },
        new URL("https://effect.website/docs/introduction#what-is-effect")
      )
      assertConfigError(
        config,
        { WEBSITE_URL: "abra-kadabra" },
        new ConfigError.InvalidData({
          path: ["WEBSITE_URL"],
          description: "Expected a valid URL, but received: abra-kadabra"
        })
      )
      assertConfigError(
        config,
        {},
        new ConfigError.MissingData({ path: ["WEBSITE_URL"], fullPath: "WEBSITE_URL" })
      )
    })
  })

  describe("port", () => {
    it("name != undefined", () => {
      const config = Config.Port("WEBSITE_PORT")

      assertConfig(
        config,
        { WEBSITE_PORT: "123" },
        123
      )
      assertConfigError(
        config,
        { WEBSITE_PORT: "abra-kadabra" },
        new ConfigError.InvalidData({
          path: ["WEBSITE_PORT"],
          description: "Expected a valid port number, but received: abra-kadabra"
        })
      )
      assertConfigError(
        config,
        {},
        new ConfigError.MissingData({ path: ["WEBSITE_PORT"], fullPath: "WEBSITE_PORT" })
      )
    })
  })

  describe("branded", () => {
    it("name != undefined", () => {
      const config = Config.branded(Config.String("STR"), Str)

      assertConfig(
        config,
        { STR: "123" },
        Str("123")
      )
      assertConfigError(
        config,
        { STR: "1" },
        new ConfigError.InvalidData({ path: ["STR"], description: "Brand: Expected 1 to be longer than 2" })
      )
      assertConfigError(
        config,
        {},
        new ConfigError.MissingData({ path: ["STR"], fullPath: "STR" })
      )
    })
  })

  describe("nonEmptyString", () => {
    it("name = undefined", () => {
      const config = Config.Array("ITEMS", Config.StringNonEmpty())
      assertConfig(config, { ITEMS: "foo" }, ["foo"])
      assertConfigError(
        config,
        { ITEMS: "" },
        new ConfigError.MissingData({ path: ["ITEMS", "0"], fullPath: "ITEMS_0" })
      )
    })

    it("name != undefined", () => {
      const config = Config.nested(Config.StringNonEmpty(), "NON_EMPTY_STRING")
      assertConfig(config, { NON_EMPTY_STRING: "foo" }, "foo")
      assertConfig(config, { NON_EMPTY_STRING: " " }, " ")
      assertConfigError(
        config,
        { NON_EMPTY_STRING: "" },
        new ConfigError.MissingData({ path: ["NON_EMPTY_STRING"], fullPath: "NON_EMPTY_STRING" })
      )
    })
  })

  describe("number", () => {
    it("name = undefined", () => {
      const config = Config.Array("ITEMS", Config.Integer())
      assertConfig(config, { ITEMS: "1" }, [1])
      assertConfigError(
        config,
        { ITEMS: "123qq" },
        new ConfigError.InvalidData({ path: ["ITEMS", "0"], description: "Expected an integer, but received: 123qq" })
      )
      assertConfigError(
        config,
        { ITEMS: "value" },
        new ConfigError.InvalidData({ path: ["ITEMS", "0"], description: "Expected an integer, but received: value" })
      )
    })

    it("name != undefined", () => {
      const config = Config.Number("NUMBER")
      assertConfig(config, { NUMBER: "1" }, 1)
      assertConfig(config, { NUMBER: "1.2" }, 1.2)
      assertConfig(config, { NUMBER: "-1" }, -1)
      assertConfig(config, { NUMBER: "-1.2" }, -1.2)
      assertConfig(config, { NUMBER: "0" }, 0)
      assertConfig(config, { NUMBER: "-0" }, -0)

      assertConfigError(config, {}, new ConfigError.MissingData({ path: ["NUMBER"], fullPath: "NUMBER" }))
      assertConfigError(
        config,
        { NUMBER: "value" },
        new ConfigError.InvalidData({ path: ["NUMBER"], description: "Expected a number, but received: value" })
      )
    })
  })

  describe("literal", () => {
    it("name = undefined", () => {
      const config = Config.Array("ITEMS", Config.Literal({ literals: ["a", "b"] }))
      assertConfig(config, { ITEMS: "a" }, ["a"])
      assertConfigError(
        config,
        { ITEMS: "value" },
        new ConfigError.InvalidData({
          path: ["ITEMS", "0"],
          description: "Expected one of (a, b), but received: value"
        })
      )
    })

    it("name != undefined", () => {
      const config = Config.Literal({ name: "LITERAL", literals: ["a", 0, -0.3, BigInt(5), false, null] })
      assertConfig(config, { LITERAL: "a" }, "a")
      assertConfig(config, { LITERAL: "0" }, 0)
      assertConfig(config, { LITERAL: "-0.3" }, -0.3)
      assertConfig(config, { LITERAL: "5" }, BigInt(5))
      assertConfig(config, { LITERAL: "false" }, false)
      assertConfig(config, { LITERAL: "null" }, null)

      assertConfigError(
        config,
        {},
        new ConfigError.MissingData({ path: ["LITERAL"], fullPath: "LITERAL" })
      )
      assertConfigError(
        config,
        { LITERAL: "value" },
        new ConfigError.InvalidData({
          path: ["LITERAL"],
          description: "Expected one of (a, 0, -0.3, 5, false, null), but received: value"
        })
      )
    })
  })

  describe("date", () => {
    it("name = undefined", () => {
      const config = Config.DateTime()
      assertConfig(
        config,
        { "": "0" },
        DateTime.unsafeMake("0")
      )
      assertConfigError(
        config,
        { "": "value" },
        new ConfigError.InvalidData({ path: [], description: "Expected a DateTime string, but received: value" })
      )
    })

    it("name != undefined", () => {
      const config = Config.DateTime("DATE")
      assertConfig(
        config,
        { DATE: "0" },
        DateTime.unsafeMake("0")
      )

      assertConfigError(config, {}, new ConfigError.MissingData({ path: ["DATE"], fullPath: "DATE" }))
      assertConfigError(
        config,
        { DATE: "value" },
        new ConfigError.InvalidData({ path: ["DATE"], description: "Expected a DateTime string, but received: value" })
      )
    })
  })

  it("map", () => {
    const config = Config.String("STRING").pipe(Config.map((s) => {
      const n = parseFloat(s)
      if (Number.isNaN(n)) {
        return new ConfigError.InvalidData({ path: [], description: "invalid number" }).asEffect()
      }
      if (n < 0) {
        return new ConfigError.InvalidData({ path: [], description: "invalid negative number" }).asEffect()
      }
      return n
    }))
    assertConfig(config, { STRING: "1" }, 1)
    assertConfigError(
      config,
      { STRING: "value" },
      new ConfigError.InvalidData({ path: [], description: "invalid number" })
    )
    assertConfigError(
      config,
      { STRING: "-1" },
      new ConfigError.InvalidData({ path: [], description: "invalid negative number" })
    )
    assertConfigError(config, {}, new ConfigError.MissingData({ path: ["STRING"], fullPath: "STRING" }))
  })

  describe("logLevel", () => {
    it("name = undefined", () => {
      const config = Config.LogLevel()
      assertConfig(config, { "": "Debug" }, "Debug" as LogLevel.LogLevel)

      assertConfigError(
        config,
        { "": "-" },
        new ConfigError.InvalidData({ path: [], description: "Expected a log level, but received: -" })
      )
    })

    it("name != undefined", () => {
      const config = Config.LogLevel("LOG_LEVEL")
      assertConfig(config, { LOG_LEVEL: "Debug" }, "Debug" as LogLevel.LogLevel)

      assertConfigError(
        config,
        { LOG_LEVEL: "-" },
        new ConfigError.InvalidData({ path: ["LOG_LEVEL"], description: "Expected a log level, but received: -" })
      )
    })
  })

  describe("duration", () => {
    it("name = undefined", () => {
      const config = Config.Duration()
      assertConfig(
        config,
        { "": "10 seconds" },
        Duration.seconds(10)
      )
      assertConfigError(
        config,
        { "": "-" },
        new ConfigError.InvalidData({ path: [], description: "Expected a Duration string, but received: -" })
      )
    })

    it("name != undefined", () => {
      const config = Config.Duration("DURATION")
      assertConfig(
        config,
        { DURATION: "10 seconds" },
        Duration.seconds(10)
      )

      assertConfigError(
        config,
        { DURATION: "-" },
        new ConfigError.InvalidData({ path: ["DURATION"], description: "Expected a Duration string, but received: -" })
      )
    })
  })

  describe("filter", () => {
    it("should preserve the original path", () => {
      const flat = Config.Number("NUMBER").pipe(
        Config.filter({
          filter: (n) => n >= 0 ? n : Filter.absent,
          onAbsent: () => "a positive number"
        })
      )
      assertConfig(flat, { NUMBER: "1" }, 1)
      assertConfig(flat, { NUMBER: "1.2" }, 1.2)
      assertConfigError(
        flat,
        { NUMBER: "-1" },
        new ConfigError.InvalidData({ path: ["NUMBER"], description: "a positive number" })
      )

      const nested = flat.pipe(
        Config.nested("NESTED1")
      )
      assertConfig(nested, { "NESTED1_NUMBER": "1" }, 1)
      assertConfig(nested, { "NESTED1_NUMBER": "1.2" }, 1.2)
      assertConfigError(
        nested,
        { "NESTED1_NUMBER": "-1" },
        new ConfigError.InvalidData({ path: ["NESTED1", "NUMBER"], description: "a positive number" })
      )

      const doubleNested = nested.pipe(Config.nested("NESTED2"))
      assertConfig(doubleNested, { "NESTED2_NESTED1_NUMBER": "1" }, 1)
      assertConfig(doubleNested, { "NESTED2_NESTED1_NUMBER": "1.2" }, 1.2)
      assertConfigError(
        doubleNested,
        { "NESTED2_NESTED1_NUMBER": "-1" },
        new ConfigError.InvalidData({ path: ["NESTED2", "NESTED1", "NUMBER"], description: "a positive number" })
      )
    })
  })

  describe("withDefault", () => {
    it("recovers from missing data error", () => {
      const config = pipe(
        Config.Integer("key"),
        Config.withDefault(0)
      )
      // available data
      assertConfig(config, { key: "1" }, 1)
      // missing data
      assertConfig(config, {}, 0)
    })

    it("does not recover from other errors", () => {
      const config = pipe(
        Config.Integer("key"),
        Config.withDefault(0)
      )
      assertConfig(config, { key: "1" }, 1)
      assertConfigError(
        config,
        { key: "1.2" },
        new ConfigError.InvalidData({ path: ["key"], description: "Expected an integer, but received: 1.2" })
      )
      assertConfigError(
        config,
        { key: "value" },
        new ConfigError.InvalidData({ path: ["key"], description: "Expected an integer, but received: value" })
      )
    })

    it("does not recover from missing data and other error", () => {
      const config = pipe(
        Config.all([Config.Integer("key1"), Config.Integer("key2")]),
        Config.withDefault([0, 0])
      )
      assertConfig(config, {}, [0, 0])
      assertConfig(config, { key1: "1", key2: "2" }, [1, 2])
      assertConfigErrors(
        config,
        { key1: "invalid", key2: "value" },
        [
          new ConfigError.InvalidData({ path: ["key1"], description: "Expected an integer, but received: invalid" }),
          new ConfigError.InvalidData({ path: ["key2"], description: "Expected an integer, but received: value" })
        ]
      )
    })

    it("does not recover from missing data or other error", () => {
      const config = pipe(
        Config.Integer("key1"),
        Config.orElse(() => Config.Integer("key2")),
        Config.withDefault(0)
      )
      assertConfig(config, {}, 0)
      assertConfig(config, { key1: "1" }, 1)
      assertConfig(config, { key2: "2" }, 2)
      assertConfigErrors(config, { key2: "value" }, [
        new ConfigError.MissingData({ path: ["key1"], fullPath: "key1" }),
        new ConfigError.InvalidData({ path: ["key2"], description: "Expected an integer, but received: value" })
      ])
    })
  })

  describe("option", () => {
    it("recovers from missing data error", () => {
      const config = Config.option(Config.Integer("key"))
      assertConfig(config, {}, Option.none())
      assertConfig(config, { key: "1" }, Option.some(1))
    })

    it("does not recover from other errors", () => {
      const config = Config.option(Config.Integer("key"))
      assertConfigError(
        config,
        { key: "value" },
        new ConfigError.InvalidData({ path: ["key"], description: "Expected an integer, but received: value" })
      )
    })

    it("does not recover from other errors", () => {
      const config = pipe(
        Config.all([Config.Integer("key1"), Config.Integer("key2")]),
        Config.option
      )
      assertConfig(config, { key1: "1", key2: "2" }, Option.some([1, 2]))
      assertConfigErrors(
        config,
        { key1: "value" },
        [
          new ConfigError.InvalidData({ path: ["key1"], description: "Expected an integer, but received: value" }),
          new ConfigError.MissingData({ path: ["key2"], fullPath: "key2" })
        ]
      )
    })

    it("does not recover from other errors", () => {
      const config = pipe(
        Config.Integer("key1"),
        Config.orElse(() => Config.Integer("key2")),
        Config.option
      )
      assertConfig(config, { key1: "1" }, Option.some(1))
      assertConfig(config, { key1: "value", key2: "2" }, Option.some(2))
      assertConfigErrors(config, { key2: "value" }, [
        new ConfigError.MissingData({ path: ["key1"], fullPath: "key1" }),
        new ConfigError.InvalidData({ path: ["key2"], description: "Expected an integer, but received: value" })
      ])
    })
  })

  describe("Wrap", () => {
    it("unwrap correctly builds config", () => {
      const wrapper = (
        _: Config.Wrap<{
          key1: number
          list: ReadonlyArray<number>
          option: Option.Option<number>
          secret: Redacted.Redacted
          nested?:
            | Partial<{
              key2: string
            }>
            | undefined
        }>
      ) => Config.unwrap(_)

      const config = wrapper({
        key1: Config.Integer("key1"),
        list: Config.Array("items", Config.Integer()),
        option: Config.option(Config.Integer("option")),
        secret: Config.Redacted("secret"),
        nested: {
          key2: Config.String("key2")
        }
      })
      assertConfig(config, { key1: "123", items: "1,2,3", option: "123", secret: "sauce", key2: "value" }, {
        key1: 123,
        list: [1, 2, 3],
        option: Option.some(123),
        secret: Redacted.make("sauce"),
        nested: {
          key2: "value"
        }
      })
      assertConfigError(
        config,
        { key1: "123", items: "1,value,3", option: "123", secret: "sauce", key2: "value" },
        new ConfigError.InvalidData({ path: ["items", "1"], description: "Expected an integer, but received: value" })
      )
    })
  })

  it("sync", () => {
    const config = Config.sync(() => 1)
    assertConfig(config, {}, 1)
  })

  describe("all", () => {
    describe("tuple", () => {
      it("length = 0", () => {
        const config = Config.all([])
        assertConfig(config, {}, [])
      })

      it("length = 1", () => {
        const config = Config.all([Config.Number("NUMBER")])
        assertConfig(config, { NUMBER: "1" }, [1])
      })

      it("length > 1", () => {
        const config = Config.all([Config.Number("NUMBER"), Config.Boolean("BOOL")])
        assertConfig(config, { NUMBER: "1", BOOL: "true" }, [1, true])
        assertConfigError(
          config,
          { NUMBER: "value", BOOL: "true" },
          new ConfigError.InvalidData({ path: ["NUMBER"], description: "Expected a number, but received: value" })
        )
        assertConfigError(
          config,
          { NUMBER: "1", BOOL: "value" },
          new ConfigError.InvalidData({ path: ["BOOL"], description: "Expected a boolean, but received: value" })
        )
      })
    })

    it("iterable", () => {
      const set = new Set([Config.Number("NUMBER"), Config.Boolean("BOOL")])
      const config = Config.all(set)
      assertConfig(config, { NUMBER: "1", BOOL: "true" }, [1, true])
      assertConfigError(
        config,
        { NUMBER: "value", BOOL: "true" },
        new ConfigError.InvalidData({ path: ["NUMBER"], description: "Expected a number, but received: value" })
      )
      assertConfigError(
        config,
        { NUMBER: "1", BOOL: "value" },
        new ConfigError.InvalidData({ path: ["BOOL"], description: "Expected a boolean, but received: value" })
      )
    })
  })

  describe("Config.redacted", () => {
    it("name = undefined", () => {
      const config = Config.Array("ITEMS", Config.Redacted())
      assertConfig(config, { ITEMS: "a" }, [Redacted.make("a")])
    })

    it("name != undefined", () => {
      const config = Config.Redacted("SECRET")
      assertConfig(config, { SECRET: "a" }, Redacted.make("a"))
    })

    it("can wrap generic Config", () => {
      const config = Config.Redacted("NUM", Config.Integer())
      assertConfig(config, { NUM: "2" }, Redacted.make(2))
    })
  })

  it("can be yielded", () => {
    const provider = ConfigProvider.fromEnv({ environment: { STRING: "value" } })
    const result = Effect.runSync(Effect.provide(
      Config.String("STRING").asEffect(),
      ConfigProvider.layer(provider)
    ))
    strictEqual(result, "value")
  })

  it("array nested", () => {
    const provider = ConfigProvider.fromEnv({ environment: { "NESTED_ARRAY": "1,2,3" } }).pipe(
      ConfigProvider.nested("NESTED")
    )
    const result = Effect.runSync(Effect.provide(
      Config.Array("ARRAY", Config.Integer()).asEffect(),
      ConfigProvider.layer(provider)
    ))
    deepStrictEqual(result, [1, 2, 3])
  })

  describe("Record", () => {
    describe("Basic Record Parsing", () => {
      it("should parse simple key-value pairs", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, { RECORD: "key1=value1,key2=value2" }, {
          key1: "value1",
          key2: "value2"
        })
      })

      it("should return empty object for empty input", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, { RECORD: "" }, {})
      })

      it("should parse single pair", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, { RECORD: "key=value" }, {
          key: "value"
        })
      })

      it("should parse multiple pairs", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, { RECORD: "key1=value1,key2=value2,key3=value3,key4=value4" }, {
          key1: "value1",
          key2: "value2",
          key3: "value3",
          key4: "value4"
        })
      })
    })

    describe("Custom Separators", () => {
      it("should use custom pair separator", () => {
        const config = Config.Record("RECORD", Config.String(), { separator: ";" })
        assertConfig(config, { RECORD: "key1=value1;key2=value2" }, {
          key1: "value1",
          key2: "value2"
        })
      })

      it("should use custom key-value separator", () => {
        const config = Config.Record("RECORD", Config.String(), { keyValueSeparator: ":" })
        assertConfig(config, { RECORD: "key1:value1,key2:value2" }, {
          key1: "value1",
          key2: "value2"
        })
      })

      it("should use both custom separators", () => {
        const config = Config.Record("RECORD", Config.String(), {
          separator: "|",
          keyValueSeparator: ":"
        })
        assertConfig(config, { RECORD: "key1:value1|key2:value2" }, {
          key1: "value1",
          key2: "value2"
        })
      })

      it("should use multi-character separators", () => {
        const config = Config.Record("RECORD", Config.String(), {
          separator: "||",
          keyValueSeparator: ":::"
        })
        assertConfig(config, { RECORD: "key1:::value1||key2:::value2" }, {
          key1: "value1",
          key2: "value2"
        })
      })
    })

    describe("Value Type Parsing", () => {
      it("should parse number values", () => {
        const config = Config.Record("RECORD", Config.Integer())
        assertConfig(config, { RECORD: "age=25,score=98" }, {
          age: 25,
          score: 98
        })
      })

      it("should parse boolean values", () => {
        const config = Config.Record("RECORD", Config.Boolean())
        assertConfig(config, { RECORD: "enabled=true,debug=false" }, {
          enabled: true,
          debug: false
        })
      })

      it("should parse with custom config", () => {
        const dateConfig = Config.map(Config.String(), (str) => new Date(str))
        const config = Config.Record("RECORD", dateConfig)
        assertConfig(config, { RECORD: "start=2024-01-01,end=2024-12-31" }, {
          start: new Date("2024-01-01"),
          end: new Date("2024-12-31")
        })
      })
    })

    describe("Edge Cases", () => {
      it("should handle whitespace", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, { RECORD: " key1 = value1 , key2 = value2 " }, {
          key1: "value1",
          key2: "value2"
        })
      })

      it("should handle empty values", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, { RECORD: "key1=,key2=value2" }, {
          key1: "",
          key2: "value2"
        })
      })

      it("should skip empty keys", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, { RECORD: "=value1,key2=value2" }, {
          "": "value1",
          key2: "value2"
        })
      })

      it("should skip invalid format", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, { RECORD: "not-a-pair,key2=value2" }, {
          key2: "value2"
        })
      })

      it("should handle special characters", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, { RECORD: "key-1=value 1,key.2=value-2" }, {
          "key-1": "value 1",
          "key.2": "value-2"
        })
      })

      it("should handle duplicate keys with last value winning", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, { RECORD: "key=value1,key=value2" }, {
          key: "value2"
        })
      })

      it("should handle unicode characters", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, { RECORD: "名前=太郎,émoji=🚀" }, {
          "名前": "太郎",
          "émoji": "🚀"
        })
      })
    })

    describe("Nested Configuration", () => {
      it("should parse nested config paths", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, {
          "RECORD[key1]": "value1",
          "RECORD[key2]": "value2"
        }, {
          key1: "value1",
          key2: "value2"
        })
      })

      it("should combine inline and nested config", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, {
          RECORD: "key1=value1",
          "RECORD[key2]": "value2"
        }, {
          key1: "value1",
          key2: "value2"
        })
      })

      it("should handle precedence with nested values winning", () => {
        const config = Config.Record("RECORD", Config.String())
        assertConfig(config, {
          RECORD: "key=inline",
          "RECORD[key]": "nested"
        }, {
          key: "nested"
        })
      })
    })

    describe("Error Handling", () => {
      it("should fail on type mismatch", () => {
        const config = Config.Record("RECORD", Config.Integer())
        assertConfigError(
          config,
          { RECORD: "age=not-a-number" },
          new ConfigError.InvalidData({
            path: ["RECORD", "age"],
            description: "Expected an integer, but received: not-a-number"
          })
        )
      })

      it("should handle missing required nested values", () => {
        const config = Config.Record("RECORD", Config.Integer())
        assertConfig(
          config,
          {},
          {}
        )
      })
    })

    describe("Integration Tests", () => {
      it("should work with map combinator", () => {
        const config = Config.map(
          Config.Record("RECORD", Config.Integer()),
          (record) => Object.entries(record).map(([k, v]) => `${k}:${v}`).join(",")
        )
        assertConfig(config, { RECORD: "a=1,b=2" }, "a:1,b:2")
      })

      it("should work with withDefault", () => {
        const config = Config.withDefault(
          Config.Record("RECORD", Config.String()),
          { default: "value" }
        )
        assertConfig(config, { RECORD: "key=value" }, { key: "value" })
      })

      it("should work as part of nested config structure", () => {
        const config = Config.all({
          settings: Config.Record("SETTINGS", Config.String()),
          flags: Config.Record("FLAGS", Config.Boolean())
        })
        assertConfig(config, {
          SETTINGS: "theme=dark,language=en",
          FLAGS: "debug=true,verbose=false"
        }, {
          settings: { theme: "dark", language: "en" },
          flags: { debug: true, verbose: false }
        })
      })
    })
  })
})
