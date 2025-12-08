import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { ConfigProvider, Effect, Layer } from "effect"
import { Result } from "effect/data"
import { FileSystem, Path } from "effect/platform"
import { SystemError } from "effect/platform/PlatformError"

async function assertPathSuccess(
  provider: ConfigProvider.ConfigProvider,
  path: ConfigProvider.Path,
  expected: ConfigProvider.Node | undefined
) {
  const r = Effect.result(provider.load(path))
  deepStrictEqual(await Effect.runPromise(r), Result.succeed(expected))
}

async function assertPathFailure(
  provider: ConfigProvider.ConfigProvider,
  path: ConfigProvider.Path,
  expected: ConfigProvider.SourceError
) {
  const r = Effect.result(provider.load(path))
  deepStrictEqual(await Effect.runPromise(r), Result.fail(expected))
}

describe("ConfigProvider", () => {
  it("orElse", async () => {
    const provider1 = ConfigProvider.fromEnv({
      env: {
        "A": "value1"
      }
    })
    const provider2 = ConfigProvider.fromEnv({
      env: {
        "B": "value2"
      }
    })
    const provider = provider1.pipe(ConfigProvider.orElse(provider2))
    await assertPathSuccess(provider, ["A"], ConfigProvider.makeValue("value1"))
    await assertPathSuccess(provider, ["B"], ConfigProvider.makeValue("value2"))
  })

  it("constantCase", async () => {
    const provider = ConfigProvider.constantCase(ConfigProvider.fromEnv({
      env: {
        "CONSTANT_CASE": "value1"
      }
    }))
    await assertPathSuccess(provider, ["constant.case"], ConfigProvider.makeValue("value1"))
  })

  describe("mapInput", () => {
    it("two mappings", async () => {
      const appendA = ConfigProvider.mapInput((path) => path.map((sn) => typeof sn === "string" ? sn + "_A" : sn))
      const appendB = ConfigProvider.mapInput((path) => path.map((sn) => typeof sn === "string" ? sn + "_B" : sn))
      const provider = ConfigProvider.fromEnv({
        env: {
          "KEY_A_B": "value"
        }
      }).pipe(appendA, appendB)
      await assertPathSuccess(provider, ["KEY"], ConfigProvider.makeValue("value"))
    })
  })

  describe("nested", () => {
    it("should add a prefix to the path", async () => {
      const provider = ConfigProvider.fromEnv({
        env: {
          "prefix__leaf": "value"
        }
      }).pipe(ConfigProvider.nested("prefix"))
      await assertPathSuccess(provider, ["leaf"], ConfigProvider.makeValue("value"))
    })

    it("constantCase + nested", async () => {
      const provider = ConfigProvider.fromEnv({
        env: {
          "prefix__KEY_WITH_DOTS": "value"
        }
      }).pipe(ConfigProvider.constantCase, ConfigProvider.nested("prefix"))
      await assertPathSuccess(provider, ["key.with.dots"], ConfigProvider.makeValue("value"))
    })

    it("nested + constantCase", async () => {
      const provider = ConfigProvider.fromEnv({
        env: {
          "PREFIX_WITH_DOTS__KEY_WITH_DOTS": "value"
        }
      }).pipe(ConfigProvider.nested("prefix.with.dots"), ConfigProvider.constantCase)
      await assertPathSuccess(provider, ["key.with.dots"], ConfigProvider.makeValue("value"))
    })
  })

  describe("fromEnv", () => {
    describe("should fail with a SourceError when the environment is invalid", () => {
      it("array is not dense", async () => {
        const env = { a: "foo", "a__0": "bar", "a__2": "baz" }
        const provider = ConfigProvider.fromEnv({ env })
        await assertPathFailure(
          provider,
          ["a"],
          new ConfigProvider.SourceError({
            message: `Invalid environment: array at "a" is not dense (expected indices 0..2)`,
            cause: new Error(`Invalid environment: array at "a" is not dense (expected indices 0..2)`)
          })
        )
      })
    })

    it("node can be both leaf and object (a=value1 + a__b=value2)", async () => {
      const env = { a: "value1", "a__b": "value2" }
      const provider = ConfigProvider.fromEnv({ env })
      await assertPathSuccess(provider, ["a"], ConfigProvider.makeRecord(new Set(["b"]), "value1"))
      await assertPathSuccess(provider, ["a", "b"], ConfigProvider.makeValue("value2"))
    })

    it("node can be both leaf and array (a=value1 + a__0=value2)", async () => {
      const env = { a: "value1", "a__0": "value2" }
      const provider = ConfigProvider.fromEnv({ env })
      await assertPathSuccess(provider, ["a"], ConfigProvider.makeArray(1, "value1"))
      await assertPathSuccess(provider, ["a", 0], ConfigProvider.makeValue("value2"))
    })

    it("should support nested keys", async () => {
      const provider = ConfigProvider.fromEnv({
        env: {
          "leaf": "value1",
          "object__key1": "value2",
          "object__key2__key3": "value3",
          "array__0": "value4",
          "array__1__key4": "value5",
          "array__2__0": "value6"
        }
      })

      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["leaf", "object", "array"])))

      await assertPathSuccess(provider, ["leaf"], ConfigProvider.makeValue("value1"))
      await assertPathSuccess(provider, ["object", "key1"], ConfigProvider.makeValue("value2"))
      await assertPathSuccess(provider, ["array", 0], ConfigProvider.makeValue("value4"))
      await assertPathSuccess(provider, ["array", 1, "key4"], ConfigProvider.makeValue("value5"))
      await assertPathSuccess(provider, ["array", 2, 0], ConfigProvider.makeValue("value6"))

      await assertPathSuccess(provider, ["object"], ConfigProvider.makeRecord(new Set(["key1", "key2"])))
      await assertPathSuccess(provider, ["object", "key2"], ConfigProvider.makeRecord(new Set(["key3"])))

      await assertPathSuccess(provider, ["array"], ConfigProvider.makeArray(3))
      await assertPathSuccess(provider, ["array", 2], ConfigProvider.makeArray(1))

      await assertPathSuccess(provider, ["leaf", "non-existing"], undefined)
      await assertPathSuccess(provider, ["object", "non-existing"], undefined)
      await assertPathSuccess(provider, ["array", 3, "non-existing"], undefined)
    })

    it("When immediate child tokens are not all canonical non-negative integers, return object", async () => {
      const provider = ConfigProvider.fromEnv({
        env: {
          "A__0": "value1",
          "A__B": "value2"
        }
      })

      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["A"])))
      await assertPathSuccess(provider, ["A"], ConfigProvider.makeRecord(new Set(["0", "B"])))
    })

    it("Integer validation for array indices", async () => {
      const provider = ConfigProvider.fromEnv({
        env: {
          "A__0": "value1",
          "A__1": "value2",
          // "01" is not considered canonical
          "B__01": "value3"
        }
      })

      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["A", "B"])))
      await assertPathSuccess(provider, ["A", 0], ConfigProvider.makeValue("value1"))
      await assertPathSuccess(provider, ["A", 1], ConfigProvider.makeValue("value2"))
      await assertPathSuccess(provider, ["B"], ConfigProvider.makeRecord(new Set(["01"])))
    })

    it("NODE_ENV should be parsed as string", async () => {
      const provider = ConfigProvider.fromEnv({
        env: {
          "NODE_ENV": "value"
        }
      })
      await assertPathSuccess(provider, ["NODE_ENV"], ConfigProvider.makeValue("value"))
    })
  })

  describe("fromUnknown", () => {
    const provider = ConfigProvider.fromUnknown({
      string: "value1",
      record: {
        key1: "value2",
        key2: {
          key3: "value3"
        }
      },
      array: ["value4", {
        key4: "value5"
      }, ["value6"]],
      null: null,
      number: 42,
      boolean: true,
      bigint: 0n,
      undefined,
      unknown: Symbol("unknown")
    })

    it("Root node", async () => {
      await assertPathSuccess(
        provider,
        [],
        ConfigProvider.makeRecord(
          new Set(["string", "record", "array", "null", "number", "boolean", "bigint", "undefined", "unknown"])
        )
      )
    })

    it("Exact leaf resolution", async () => {
      await assertPathSuccess(provider, ["string"], ConfigProvider.makeValue("value1"))
      await assertPathSuccess(provider, ["record", "key1"], ConfigProvider.makeValue("value2"))
      await assertPathSuccess(provider, ["array", 0], ConfigProvider.makeValue("value4"))
      await assertPathSuccess(provider, ["array", 1, "key4"], ConfigProvider.makeValue("value5"))
      await assertPathSuccess(provider, ["array", 2, 0], ConfigProvider.makeValue("value6"))
    })

    it("Object detection", async () => {
      await assertPathSuccess(provider, ["record"], ConfigProvider.makeRecord(new Set(["key1", "key2"])))
      await assertPathSuccess(provider, ["record", "key2"], ConfigProvider.makeRecord(new Set(["key3"])))
    })

    it("Array detection", async () => {
      await assertPathSuccess(provider, ["array"], ConfigProvider.makeArray(3))
      await assertPathSuccess(provider, ["array", 2], ConfigProvider.makeArray(1))
    })

    it("should return undefined on non-existing paths", async () => {
      await assertPathSuccess(provider, ["string", "non-existing"], undefined)
      await assertPathSuccess(provider, ["record", "non-existing"], undefined)
      await assertPathSuccess(provider, ["array", 3, "non-existing"], undefined)
    })

    it("null values", async () => {
      await assertPathSuccess(provider, ["null"], undefined)
    })

    it("number values", async () => {
      await assertPathSuccess(provider, ["number"], ConfigProvider.makeValue("42"))
    })

    it("boolean values", async () => {
      await assertPathSuccess(provider, ["boolean"], ConfigProvider.makeValue("true"))
    })

    it("bigint values", async () => {
      await assertPathSuccess(provider, ["bigint"], ConfigProvider.makeValue("0"))
    })

    it("undefined values", async () => {
      await assertPathSuccess(provider, ["undefined"], undefined)
    })

    it("unknown values", async () => {
      await assertPathSuccess(provider, ["unknown"], ConfigProvider.makeValue("Symbol(unknown)"))
    })
  })

  describe("fromDotEnvContents", () => {
    it("comments are ignored", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
# comments are ignored
API_URL=https://api.example.com
`)
      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["API_URL"])))
      await assertPathSuccess(provider, ["API_URL"], ConfigProvider.makeValue("https://api.example.com"))
    })

    it("export is allowed", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
export NODE_ENV=production
`)
      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["NODE_ENV"])))
      await assertPathSuccess(provider, ["NODE_ENV"], ConfigProvider.makeValue("production"))
    })

    it("quoting is allowed", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
NODE_ENV="production"
`)
      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["NODE_ENV"])))
      await assertPathSuccess(provider, ["NODE_ENV"], ConfigProvider.makeValue("production"))
    })

    it("objects are supported", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
OBJECT__key1=value1
OBJECT__key2=value2
`)
      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["OBJECT"])))
      await assertPathSuccess(provider, ["OBJECT"], ConfigProvider.makeRecord(new Set(["key1", "key2"])))
      await assertPathSuccess(provider, ["OBJECT", "key1"], ConfigProvider.makeValue("value1"))
      await assertPathSuccess(provider, ["OBJECT", "key2"], ConfigProvider.makeValue("value2"))
    })

    it("a node may be both leaf and object", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
OBJECT=value1
OBJECT__key1=value2
OBJECT__key2=value3
`)
      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["OBJECT"])))
      await assertPathSuccess(provider, ["OBJECT"], ConfigProvider.makeRecord(new Set(["key1", "key2"]), "value1"))
      await assertPathSuccess(provider, ["OBJECT", "key1"], ConfigProvider.makeValue("value2"))
      await assertPathSuccess(provider, ["OBJECT", "key2"], ConfigProvider.makeValue("value3"))
    })

    it("a node may be both leaf and array", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
ARRAY=value1
ARRAY__0=value2
ARRAY__1=value3
`)
      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["ARRAY"])))
      await assertPathSuccess(provider, ["ARRAY"], ConfigProvider.makeArray(2, "value1"))
      await assertPathSuccess(provider, ["ARRAY", 0], ConfigProvider.makeValue("value2"))
      await assertPathSuccess(provider, ["ARRAY", 1], ConfigProvider.makeValue("value3"))
    })

    it("arrays are supported", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
ARRAY__0=value1
ARRAY__1=value2
`)
      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["ARRAY"])))
      await assertPathSuccess(provider, ["ARRAY"], ConfigProvider.makeArray(2))
      await assertPathSuccess(provider, ["ARRAY", 0], ConfigProvider.makeValue("value1"))
      await assertPathSuccess(provider, ["ARRAY", 1], ConfigProvider.makeValue("value2"))
    })

    it("expansion of environment variables is off by default", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
PASSWORD="value"
DB_PASS=$PASSWORD
`)
      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["PASSWORD", "DB_PASS"])))
      await assertPathSuccess(provider, ["PASSWORD"], ConfigProvider.makeValue("value"))
      await assertPathSuccess(provider, ["DB_PASS"], ConfigProvider.makeValue("$PASSWORD"))
    })

    it("expansion of environment variables is supported", async () => {
      const provider = ConfigProvider.fromDotEnvContents(
        `
PASSWORD="value"
DB_PASS=$PASSWORD
`,
        { expandVariables: true }
      )
      await assertPathSuccess(provider, [], ConfigProvider.makeRecord(new Set(["PASSWORD", "DB_PASS"])))
      await assertPathSuccess(provider, ["PASSWORD"], ConfigProvider.makeValue("value"))
      await assertPathSuccess(provider, ["DB_PASS"], ConfigProvider.makeValue("value"))
    })
  })

  describe("fromDotEnv", () => {
    it("should load configuration from .env file", async () => {
      const provider = await Effect.runPromise(
        ConfigProvider.fromDotEnv().pipe(
          Effect.provide(FileSystem.layerNoop({
            readFileString: (path) =>
              Effect.succeed(`PATH=${path}
A=1`)
          }))
        )
      )

      await assertPathSuccess(provider, ["PATH"], ConfigProvider.makeValue(".env"))
      await assertPathSuccess(provider, ["A"], ConfigProvider.makeValue("1"))
    })

    it("should support custom path", async () => {
      const provider = await Effect.runPromise(
        ConfigProvider.fromDotEnv({ path: "custom.env" }).pipe(
          Effect.provide(FileSystem.layerNoop({
            readFileString: (path) =>
              Effect.succeed(`CUSTOM_PATH=${path}
A=1`)
          }))
        )
      )

      await assertPathSuccess(provider, ["CUSTOM_PATH"], ConfigProvider.makeValue("custom.env"))
      await assertPathSuccess(provider, ["A"], ConfigProvider.makeValue("1"))
    })
  })

  describe("fromDir", () => {
    const provider = ConfigProvider.fromDir({ rootPath: "/" })
    const files: Record<string, string> = {
      "/secret": "keepitsafe\n", // test trimming
      "/SHOUTING": "value",
      "/integer": "123",
      "/nested/config": "hello"
    }
    const Fs = FileSystem.layerNoop({
      readFileString(path) {
        if (path in files) {
          return Effect.succeed(files[path])
        }
        return Effect.fail(
          new SystemError({
            module: "FileSystem",
            reason: "NotFound",
            method: "readFileString"
          })
        )
      },
      readDirectory(_path) {
        // For the test, we only have files, no directories
        return Effect.fail(
          new SystemError({
            module: "FileSystem",
            reason: "NotFound",
            method: "readDirectory"
          })
        )
      }
    })
    const Platform = Layer.mergeAll(Fs, Path.layer)
    const SetLayer = ConfigProvider.layer(provider).pipe(
      Layer.provide(Platform),
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({
        env: { secret: "fail" }
      })))
    )
    const AddLayer = ConfigProvider.layerAdd(provider).pipe(
      Layer.provide(Platform),
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({
        env: {
          secret: "shh",
          fallback: "value"
        }
      })))
    )

    it("reads config", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function*() {
          const provider = yield* ConfigProvider.ConfigProvider
          const secret = yield* provider.load(["secret"])
          const shouting = yield* provider.load(["SHOUTING"])
          const integer = yield* provider.load(["integer"])
          const nestedConfig = yield* provider.load(["nested", "config"])

          return { secret, shouting, integer, nestedConfig }
        }).pipe(Effect.provide(SetLayer))
      )

      deepStrictEqual(result.secret, ConfigProvider.makeValue("keepitsafe"))
      deepStrictEqual(result.shouting, ConfigProvider.makeValue("value"))
      deepStrictEqual(result.integer, ConfigProvider.makeValue("123"))
      deepStrictEqual(result.nestedConfig, ConfigProvider.makeValue("hello"))

      // Test that non-existent path throws an error
      const error = await Effect.runPromise(
        Effect.flip(
          Effect.gen(function*() {
            const provider = yield* ConfigProvider.ConfigProvider
            yield* provider.load(["fallback"])
          }).pipe(Effect.provide(SetLayer))
        )
      )

      deepStrictEqual(error.message, "Failed to read file at /fallback")
    })

    it("layerAdd uses fallback", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function*() {
          const provider = yield* ConfigProvider.ConfigProvider
          const secret = yield* provider.load(["secret"])
          const integer = yield* provider.load(["integer"])
          const fallback = yield* provider.load(["fallback"])

          return { secret, integer, fallback }
        }).pipe(Effect.provide(AddLayer))
      )

      deepStrictEqual(result.secret, ConfigProvider.makeValue("shh"))
      deepStrictEqual(result.integer, ConfigProvider.makeValue("123"))
      deepStrictEqual(result.fallback, ConfigProvider.makeValue("value"))
    })
  })
})
