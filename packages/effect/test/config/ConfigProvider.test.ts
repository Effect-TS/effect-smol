import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { Effect, Layer } from "effect"
import { ConfigProvider } from "effect/config"
import { Result } from "effect/data"
import { FileSystem, Path } from "effect/platform"
import { SystemError } from "effect/platform/PlatformError"

async function assertPathSuccess(
  provider: ConfigProvider.ConfigProvider,
  path: ConfigProvider.Path,
  expected: ConfigProvider.Stat | undefined
) {
  const r = Effect.result(ConfigProvider.run(provider, path))
  deepStrictEqual(await Effect.runPromise(r), Result.succeed(expected))
}

async function assertPathFailure(
  provider: ConfigProvider.ConfigProvider,
  path: ConfigProvider.Path,
  expected: ConfigProvider.SourceError
) {
  const r = Effect.result(provider.get(path))
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
    await assertPathSuccess(provider, ["A"], ConfigProvider.leaf("value1"))
    await assertPathSuccess(provider, ["B"], ConfigProvider.leaf("value2"))
  })

  it("constantCase", async () => {
    const provider = ConfigProvider.constantCase(ConfigProvider.fromEnv({
      env: {
        "CONSTANT_CASE": "value1"
      }
    }))
    await assertPathSuccess(provider, ["constant.case"], ConfigProvider.leaf("value1"))
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
      await assertPathSuccess(provider, ["KEY"], ConfigProvider.leaf("value"))
    })
  })

  describe("nested", () => {
    it("should add a prefix to the path", async () => {
      const provider = ConfigProvider.fromEnv({
        env: {
          "prefix__leaf": "value"
        }
      }).pipe(ConfigProvider.nested("prefix"))
      await assertPathSuccess(provider, ["leaf"], ConfigProvider.leaf("value"))
    })

    it("constantCase + nested", async () => {
      const provider = ConfigProvider.fromEnv({
        env: {
          "prefix__KEY_WITH_DOTS": "value"
        }
      }).pipe(ConfigProvider.constantCase, ConfigProvider.nested("prefix"))
      await assertPathSuccess(provider, ["key.with.dots"], ConfigProvider.leaf("value"))
    })

    it("nested + constantCase", async () => {
      const provider = ConfigProvider.fromEnv({
        env: {
          "PREFIX_WITH_DOTS__KEY_WITH_DOTS": "value"
        }
      }).pipe(ConfigProvider.nested("prefix.with.dots"), ConfigProvider.constantCase)
      await assertPathSuccess(provider, ["key.with.dots"], ConfigProvider.leaf("value"))
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
            reason: `Invalid environment: array at "a" is not dense (expected indices 0..2)`
          })
        )
      })
    })

    it("node can be both leaf and object (a=value1 + a__b=value2)", async () => {
      const env = { a: "value1", "a__b": "value2" }
      const provider = ConfigProvider.fromEnv({ env })
      await assertPathSuccess(provider, ["a"], ConfigProvider.object(new Set(["b"]), "value1"))
      await assertPathSuccess(provider, ["a", "b"], ConfigProvider.leaf("value2"))
    })

    it("node can be both leaf and array (a=value1 + a__0=value2)", async () => {
      const env = { a: "value1", "a__0": "value2" }
      const provider = ConfigProvider.fromEnv({ env })
      await assertPathSuccess(provider, ["a"], ConfigProvider.array(1, "value1"))
      await assertPathSuccess(provider, ["a", 0], ConfigProvider.leaf("value2"))
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

      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["leaf", "object", "array"])))

      await assertPathSuccess(provider, ["leaf"], ConfigProvider.leaf("value1"))
      await assertPathSuccess(provider, ["object", "key1"], ConfigProvider.leaf("value2"))
      await assertPathSuccess(provider, ["array", 0], ConfigProvider.leaf("value4"))
      await assertPathSuccess(provider, ["array", 1, "key4"], ConfigProvider.leaf("value5"))
      await assertPathSuccess(provider, ["array", 2, 0], ConfigProvider.leaf("value6"))

      await assertPathSuccess(provider, ["object"], ConfigProvider.object(new Set(["key1", "key2"])))
      await assertPathSuccess(provider, ["object", "key2"], ConfigProvider.object(new Set(["key3"])))

      await assertPathSuccess(provider, ["array"], ConfigProvider.array(3))
      await assertPathSuccess(provider, ["array", 2], ConfigProvider.array(1))

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

      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["A"])))
      await assertPathSuccess(provider, ["A"], ConfigProvider.object(new Set(["0", "B"])))
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

      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["A", "B"])))
      await assertPathSuccess(provider, ["A", 0], ConfigProvider.leaf("value1"))
      await assertPathSuccess(provider, ["A", 1], ConfigProvider.leaf("value2"))
      await assertPathSuccess(provider, ["B"], ConfigProvider.object(new Set(["01"])))
    })

    it("NODE_ENV should be parsed as string", async () => {
      const provider = ConfigProvider.fromEnv({
        env: {
          "NODE_ENV": "value"
        }
      })
      await assertPathSuccess(provider, ["NODE_ENV"], ConfigProvider.leaf("value"))
    })
  })

  describe("fromStringLeafJson", () => {
    const provider = ConfigProvider.fromStringLeafJson({
      leaf: "value1",
      object: {
        key1: "value2",
        key2: {
          key3: "value3"
        }
      },
      array: ["value4", {
        key4: "value5"
      }, ["value6"]]
    })

    it("Root node", async () => {
      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["leaf", "object", "array"])))
    })

    it("Exact leaf resolution", async () => {
      await assertPathSuccess(provider, ["leaf"], ConfigProvider.leaf("value1"))
      await assertPathSuccess(provider, ["object", "key1"], ConfigProvider.leaf("value2"))
      await assertPathSuccess(provider, ["array", 0], ConfigProvider.leaf("value4"))
      await assertPathSuccess(provider, ["array", 1, "key4"], ConfigProvider.leaf("value5"))
      await assertPathSuccess(provider, ["array", 2, 0], ConfigProvider.leaf("value6"))
    })

    it("Object detection", async () => {
      await assertPathSuccess(provider, ["object"], ConfigProvider.object(new Set(["key1", "key2"])))
      await assertPathSuccess(provider, ["object", "key2"], ConfigProvider.object(new Set(["key3"])))
    })

    it("Array detection", async () => {
      await assertPathSuccess(provider, ["array"], ConfigProvider.array(3))
      await assertPathSuccess(provider, ["array", 2], ConfigProvider.array(1))
    })

    it("should return undefined on non-existing paths", async () => {
      await assertPathSuccess(provider, ["leaf", "non-existing"], undefined)
      await assertPathSuccess(provider, ["object", "non-existing"], undefined)
      await assertPathSuccess(provider, ["array", 3, "non-existing"], undefined)
    })
  })

  describe("fromJson", () => {
    it("should convert various JSON types to StringLeafJson", async () => {
      const provider = ConfigProvider.fromJson({
        string: "hello",
        number: 42,
        boolean: true,
        null: null,
        undefined,
        array: [1, "two", false],
        object: {
          nested: "value",
          deep: {
            key: 123
          }
        }
      })

      await assertPathSuccess(
        provider,
        [],
        ConfigProvider.object(
          new Set([
            "string",
            "number",
            "boolean",
            "null",
            "undefined",
            "array",
            "object"
          ])
        )
      )
      await assertPathSuccess(provider, ["string"], ConfigProvider.leaf("hello"))
      await assertPathSuccess(provider, ["number"], ConfigProvider.leaf("42"))
      await assertPathSuccess(provider, ["boolean"], ConfigProvider.leaf("true"))
      await assertPathSuccess(provider, ["null"], ConfigProvider.leaf(""))
      await assertPathSuccess(provider, ["undefined"], ConfigProvider.leaf(""))
      await assertPathSuccess(provider, ["array"], ConfigProvider.array(3))
      await assertPathSuccess(provider, ["array", 0], ConfigProvider.leaf("1"))
      await assertPathSuccess(provider, ["array", 1], ConfigProvider.leaf("two"))
      await assertPathSuccess(provider, ["array", 2], ConfigProvider.leaf("false"))
      await assertPathSuccess(provider, ["object"], ConfigProvider.object(new Set(["nested", "deep"])))
      await assertPathSuccess(provider, ["object", "nested"], ConfigProvider.leaf("value"))
      await assertPathSuccess(provider, ["object", "deep"], ConfigProvider.object(new Set(["key"])))
      await assertPathSuccess(provider, ["object", "deep", "key"], ConfigProvider.leaf("123"))
    })
  })

  describe("fromDotEnvContents", () => {
    it("comments are ignored", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
# comments are ignored
API_URL=https://api.example.com
`)
      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["API_URL"])))
      await assertPathSuccess(provider, ["API_URL"], ConfigProvider.leaf("https://api.example.com"))
    })

    it("export is allowed", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
export NODE_ENV=production
`)
      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["NODE_ENV"])))
      await assertPathSuccess(provider, ["NODE_ENV"], ConfigProvider.leaf("production"))
    })

    it("quoting is allowed", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
NODE_ENV="production"
`)
      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["NODE_ENV"])))
      await assertPathSuccess(provider, ["NODE_ENV"], ConfigProvider.leaf("production"))
    })

    it("objects are supported", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
OBJECT__key1=value1
OBJECT__key2=value2
`)
      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["OBJECT"])))
      await assertPathSuccess(provider, ["OBJECT"], ConfigProvider.object(new Set(["key1", "key2"])))
      await assertPathSuccess(provider, ["OBJECT", "key1"], ConfigProvider.leaf("value1"))
      await assertPathSuccess(provider, ["OBJECT", "key2"], ConfigProvider.leaf("value2"))
    })

    it("a node may be both leaf and object", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
OBJECT=value1
OBJECT__key1=value2
OBJECT__key2=value3
`)
      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["OBJECT"])))
      await assertPathSuccess(provider, ["OBJECT"], ConfigProvider.object(new Set(["key1", "key2"]), "value1"))
      await assertPathSuccess(provider, ["OBJECT", "key1"], ConfigProvider.leaf("value2"))
      await assertPathSuccess(provider, ["OBJECT", "key2"], ConfigProvider.leaf("value3"))
    })

    it("a node may be both leaf and array", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
ARRAY=value1
ARRAY__0=value2
ARRAY__1=value3
`)
      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["ARRAY"])))
      await assertPathSuccess(provider, ["ARRAY"], ConfigProvider.array(2, "value1"))
      await assertPathSuccess(provider, ["ARRAY", 0], ConfigProvider.leaf("value2"))
      await assertPathSuccess(provider, ["ARRAY", 1], ConfigProvider.leaf("value3"))
    })

    it("arrays are supported", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
ARRAY__0=value1
ARRAY__1=value2
`)
      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["ARRAY"])))
      await assertPathSuccess(provider, ["ARRAY"], ConfigProvider.array(2))
      await assertPathSuccess(provider, ["ARRAY", 0], ConfigProvider.leaf("value1"))
      await assertPathSuccess(provider, ["ARRAY", 1], ConfigProvider.leaf("value2"))
    })

    it("expansion of environment variables is off by default", async () => {
      const provider = ConfigProvider.fromDotEnvContents(`
PASSWORD="value"
DB_PASS=$PASSWORD
`)
      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["PASSWORD", "DB_PASS"])))
      await assertPathSuccess(provider, ["PASSWORD"], ConfigProvider.leaf("value"))
      await assertPathSuccess(provider, ["DB_PASS"], ConfigProvider.leaf("$PASSWORD"))
    })

    it("expansion of environment variables is supported", async () => {
      const provider = ConfigProvider.fromDotEnvContents(
        `
PASSWORD="value"
DB_PASS=$PASSWORD
`,
        { expandVariables: true }
      )
      await assertPathSuccess(provider, [], ConfigProvider.object(new Set(["PASSWORD", "DB_PASS"])))
      await assertPathSuccess(provider, ["PASSWORD"], ConfigProvider.leaf("value"))
      await assertPathSuccess(provider, ["DB_PASS"], ConfigProvider.leaf("value"))
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

      await assertPathSuccess(provider, ["PATH"], ConfigProvider.leaf(".env"))
      await assertPathSuccess(provider, ["A"], ConfigProvider.leaf("1"))
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

      await assertPathSuccess(provider, ["CUSTOM_PATH"], ConfigProvider.leaf("custom.env"))
      await assertPathSuccess(provider, ["A"], ConfigProvider.leaf("1"))
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
          const secret = yield* provider.get(["secret"])
          const shouting = yield* provider.get(["SHOUTING"])
          const integer = yield* provider.get(["integer"])
          const nestedConfig = yield* provider.get(["nested", "config"])

          return { secret, shouting, integer, nestedConfig }
        }).pipe(Effect.provide(SetLayer))
      )

      deepStrictEqual(result.secret, ConfigProvider.leaf("keepitsafe"))
      deepStrictEqual(result.shouting, ConfigProvider.leaf("value"))
      deepStrictEqual(result.integer, ConfigProvider.leaf("123"))
      deepStrictEqual(result.nestedConfig, ConfigProvider.leaf("hello"))

      // Test that non-existent path throws an error
      const error = await Effect.runPromise(
        Effect.flip(
          Effect.gen(function*() {
            const provider = yield* ConfigProvider.ConfigProvider
            yield* provider.get(["fallback"])
          }).pipe(Effect.provide(SetLayer))
        )
      )

      deepStrictEqual(error.reason, "Failed to read file at /fallback")
    })

    it("layerAdd uses fallback", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function*() {
          const provider = yield* ConfigProvider.ConfigProvider
          const secret = yield* provider.get(["secret"])
          const integer = yield* provider.get(["integer"])
          const fallback = yield* provider.get(["fallback"])

          return { secret, integer, fallback }
        }).pipe(Effect.provide(AddLayer))
      )

      deepStrictEqual(result.secret, ConfigProvider.leaf("shh"))
      deepStrictEqual(result.integer, ConfigProvider.leaf("123"))
      deepStrictEqual(result.fallback, ConfigProvider.leaf("value"))
    })
  })
})
