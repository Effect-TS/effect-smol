import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { Effect, Layer } from "effect"
import { ConfigProvider } from "effect/config"
import { Result } from "effect/data"
import { FileSystem, Path } from "effect/platform"
import { SystemError } from "effect/platform/PlatformError"
import type { StringLeafJson } from "effect/schema/Serializer"
import { throws } from "../utils/assert.ts"

async function assertPathSuccess(
  provider: ConfigProvider.ConfigProvider,
  path: ConfigProvider.Path,
  expected: ConfigProvider.Stat | undefined
) {
  const r = Effect.result(provider.get(path))
  deepStrictEqual(await Effect.runPromise(r), Result.succeed(expected))
}

// async function assertPathFailure(
//   provider: ConfigProvider.ConfigProvider,
//   path: ConfigProvider.Path,
//   expected: ConfigProvider.ConfigProviderError
// ) {
//   const r = Effect.result(provider.get(path))
//   deepStrictEqual(await Effect.runPromise(r), Result.fail(expected))
// }

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

  it("nested", async () => {
    const provider = ConfigProvider.nested("prefix")(ConfigProvider.fromEnv({
      env: {
        "prefix__leaf": "value1"
      }
    }))
    await assertPathSuccess(provider, ["leaf"], ConfigProvider.leaf("value1"))
  })

  describe("fromEnv", () => {
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

  describe("fromDotEnv", () => {
    it("should support dotenv parsing", async () => {
      const provider = ConfigProvider.fromDotEnv(`
# comments are ignored
export NODE_ENV="production"
API_URL=https://api.example.com

# structural arrays/objects
USERS__0__name=alice
USERS__1__name=bob

# expansion of environment variables (off by default)
PASSWORD="s1mpl3"
DB_PASS=$PASSWORD
`)
      await assertPathSuccess(
        provider,
        [],
        ConfigProvider.object(new Set(["NODE_ENV", "API_URL", "USERS", "PASSWORD", "DB_PASS"]))
      )
      await assertPathSuccess(provider, ["NODE_ENV"], ConfigProvider.leaf("production"))
      await assertPathSuccess(provider, ["API_URL"], ConfigProvider.leaf("https://api.example.com"))
      await assertPathSuccess(provider, ["PASSWORD"], ConfigProvider.leaf("s1mpl3"))
      await assertPathSuccess(provider, ["DB_PASS"], ConfigProvider.leaf("$PASSWORD"))
    })
  })

  describe("dotEnv", () => {
    it("should load configuration from .env file", async () => {
      const provider = await Effect.runPromise(
        ConfigProvider.dotEnv().pipe(
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
        ConfigProvider.dotEnv({ path: "custom.env" }).pipe(
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

  describe("fileTree", () => {
    const provider = ConfigProvider.fileTree({ rootDirectory: "/" })
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

describe("decode", () => {
  function expectDecode(env: Record<string, string>, expected: StringLeafJson) {
    const got = ConfigProvider.decode(env)
    deepStrictEqual(got, expected)
  }

  // -------------------------
  // R1/R2: Segmentation + Trie
  // -------------------------
  it("R1/R2 basic path segmentation builds nested containers and leaf", () => {
    const env = { "a__0__b__c": "foo" }
    expectDecode(env, { a: [{ b: { c: "foo" } }] })
  })

  it("R1 forbids empty segments", () => {
    const env = { "a____b": "x" } // empty segment between ____
    throws(
      () => ConfigProvider.decode(env),
      new Error(`Invalid input (R1): empty segment in variable name "a____b"`)
    )
  })

  // ------------------------------------------
  // R3: Role exclusivity (leaf vs container)
  // ------------------------------------------
  it("R3 error: node cannot be leaf and container (a=foo + a__b=bar)", () => {
    const env = { a: "foo", "a__b": "bar" }
    throws(
      () => ConfigProvider.decode(env),
      new Error(`Invalid input (R3): node "a" is both leaf and container`)
    )
  })

  // ---------------------------------------------------------
  // R4: Disambiguation per node (all numeric => array; else object)
  // ---------------------------------------------------------
  it("R4 array: all children numeric -> array", () => {
    const env = { "x__0": "a", "x__1": "b" }
    expectDecode(env, { x: ["a", "b"] })
  })

  it("R4 object: at least one non-numeric -> object", () => {
    const env = { "x__0": "a", "x__foo": "b" }
    expectDecode(env, { x: { "0": "a", "foo": "b" } })
  })

  it("R4 with \"01\": not numeric (leading zero) -> object, not array", () => {
    const env = { "x__0": "a", "x__01": "b" }
    expectDecode(env, { x: { "0": "a", "01": "b" } })
  })

  // ----------------------------------------------
  // R5: Arrays must be dense (0..max), no gaps
  // ----------------------------------------------
  it("R5 error: non-dense array (missing index)", () => {
    const env = { "x__0": "a", "x__2": "b" }
    throws(
      () => ConfigProvider.decode(env),
      new Error(`Invalid input (R5): array at "x" is not dense (expected indices 0..2)`)
    )
  })

  it("R5 dense array with nested objects", () => {
    const env = {
      "items__0__id": "1",
      "items__0__name": "A",
      "items__1__id": "2",
      "items__1__name": "B"
    }
    expectDecode(env, { items: [{ id: "1", name: "A" }, { id: "2", name: "B" }] })
  })

  // --------------------------------------
  // R6: Object keys are used as-is
  // --------------------------------------
  it("R6 object keys preserved as-is (dashes, dots, spaces)", () => {
    const env = {
      "meta-key__a.b": "dots",
      "user name__first-name": "Ada"
    }
    expectDecode(env, {
      "meta-key": { "a.b": "dots" },
      "user name": { "first-name": "Ada" }
    })
  })

  // ------------------------------------------
  // R7: Empty containers via __TYPE sentinels
  // ------------------------------------------
  it("R7 empty containers at leaf paths", () => {
    const env = {
      "list__TYPE": "A",
      "opts__TYPE": "O"
    }
    expectDecode(env, { list: [], opts: {} })
  })

  it("R7 root empty array/object via __TYPE only", () => {
    expectDecode({ "__TYPE": "A" }, [])
    expectDecode({ "__TYPE": "O" }, {})
  })

  it("R7 error: __TYPE cannot coexist with children", () => {
    const env = { "x__TYPE": "A", "x__0": "v" }
    throws(
      () => ConfigProvider.decode(env),
      new Error(`Invalid input (R3/R7): node "x" has __TYPE and also leaf/children`)
    )
  })

  it("R7 error: __TYPE cannot coexist with leaf", () => {
    const env = { "x__TYPE": "O", "x": "leaf" }
    throws(
      () => ConfigProvider.decode(env),
      new Error(`Invalid input (R3/R7): node "x" has __TYPE and also leaf/children`)
    )
  })

  it("R7 error: bad __TYPE value", () => {
    const env = { "x__TYPE": "Z" as any }
    throws(
      () => ConfigProvider.decode(env),
      new Error(`Invalid input (R7): "x__TYPE" must be "A" or "O"`)
    )
  })
})
