import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { Effect } from "effect"
import { ConfigProvider2 } from "effect/config"
import { Result } from "effect/data"
import { FileSystem } from "effect/platform"

async function assertPathSuccess(
  provider: ConfigProvider2.ConfigProvider,
  path: ConfigProvider2.Path,
  expected: ConfigProvider2.Node | undefined
) {
  const r = Effect.result(provider.get(path))
  deepStrictEqual(await Effect.runPromise(r), Result.succeed(expected))
}

// async function assertPathFailure(
//   provider: ConfigProvider2.ConfigProvider,
//   path: ConfigProvider2.Path,
//   expected: ConfigProvider2.GetError
// ) {
//   const r = Effect.result(provider.get(path))
//   deepStrictEqual(await Effect.runPromise(r), Result.fail(expected))
// }

describe("ConfigProvider2", () => {
  describe("fromEnv", () => {
    it("should support nested keys", async () => {
      const provider = ConfigProvider2.fromEnv({
        environment: {
          "leaf": "value1",
          "object__key1": "value2",
          "object__key2__key3": "value3",
          "array__0": "value4",
          "array__1__key4": "value5",
          "array__2__0": "value6"
        }
      })

      await assertPathSuccess(provider, [], ConfigProvider2.object(["leaf", "object", "array"]))

      await assertPathSuccess(provider, ["leaf"], ConfigProvider2.leaf("value1"))
      await assertPathSuccess(provider, ["object", "key1"], ConfigProvider2.leaf("value2"))
      await assertPathSuccess(provider, ["array", 0], ConfigProvider2.leaf("value4"))
      await assertPathSuccess(provider, ["array", 1, "key4"], ConfigProvider2.leaf("value5"))
      await assertPathSuccess(provider, ["array", 2, 0], ConfigProvider2.leaf("value6"))

      await assertPathSuccess(provider, ["object"], ConfigProvider2.object(["key1", "key2"]))
      await assertPathSuccess(provider, ["object", "key2"], ConfigProvider2.object(["key3"]))

      await assertPathSuccess(provider, ["array"], ConfigProvider2.array(3))
      await assertPathSuccess(provider, ["array", 2], ConfigProvider2.array(1))

      await assertPathSuccess(provider, ["leaf", "non-existing"], undefined)
      await assertPathSuccess(provider, ["object", "non-existing"], undefined)
      await assertPathSuccess(provider, ["array", 3, "non-existing"], undefined)
    })

    it("When immediate child tokens are not all canonical non-negative integers, return object", async () => {
      const provider = ConfigProvider2.fromEnv({
        environment: {
          "A__0": "value1",
          "A__B": "value2"
        }
      })

      await assertPathSuccess(provider, [], ConfigProvider2.object(["A"]))
      await assertPathSuccess(provider, ["A"], ConfigProvider2.object(["0", "B"]))
    })

    it("Integer validation for array indices", async () => {
      const provider = ConfigProvider2.fromEnv({
        environment: {
          "A__0": "value1",
          "A__1": "value2",
          // "01" is not considered canonical
          "B__01": "value3"
        }
      })

      await assertPathSuccess(provider, [], ConfigProvider2.object(["A", "B"]))
      await assertPathSuccess(provider, ["A", "0"], ConfigProvider2.leaf("value1"))
      await assertPathSuccess(provider, ["A", "1"], ConfigProvider2.leaf("value2"))
      await assertPathSuccess(provider, ["B"], ConfigProvider2.object(["01"]))
    })

    it("NODE_ENV should be parsed as string", async () => {
      const provider = ConfigProvider2.fromEnv({
        environment: {
          "NODE_ENV": "value"
        }
      })
      await assertPathSuccess(provider, ["NODE_ENV"], ConfigProvider2.leaf("value"))
    })

    it("should support custom split/join", async () => {
      const provider = ConfigProvider2.fromEnv({
        environment: {
          "leaf": "value1",
          "object_key1": "value2",
          "object_key2_key3": "value3",
          "array_0": "value4",
          "array_1_key4": "value5",
          "array_2_0": "value6"
        },
        parser: {
          splitKey: (key) => key.split("_"),
          joinTokens: (tokens) => tokens.join("_"),
          inlineParser: ConfigProvider2.defaultParser.inlineParser
        }
      })

      await assertPathSuccess(provider, [], ConfigProvider2.object(["leaf", "object", "array"]))

      await assertPathSuccess(provider, ["leaf"], ConfigProvider2.leaf("value1"))
      await assertPathSuccess(provider, ["object", "key1"], ConfigProvider2.leaf("value2"))
      await assertPathSuccess(provider, ["array", 0], ConfigProvider2.leaf("value4"))
      await assertPathSuccess(provider, ["array", 1, "key4"], ConfigProvider2.leaf("value5"))
      await assertPathSuccess(provider, ["array", 2, 0], ConfigProvider2.leaf("value6"))

      await assertPathSuccess(provider, ["object"], ConfigProvider2.object(["key1", "key2"]))
      await assertPathSuccess(provider, ["object", "key2"], ConfigProvider2.object(["key3"]))

      await assertPathSuccess(provider, ["array"], ConfigProvider2.array(3))
      await assertPathSuccess(provider, ["array", 2], ConfigProvider2.array(1))

      await assertPathSuccess(provider, ["leaf", "non-existing"], undefined)
      await assertPathSuccess(provider, ["object", "non-existing"], undefined)
      await assertPathSuccess(provider, ["array", 3, "non-existing"], undefined)
    })

    it("should support bracket tokenization", async () => {
      const provider = ConfigProvider2.fromEnv({
        environment: {
          "LIST[0]": "a",
          "LIST[1]": "b",
          "LIST[2]": "c",
          "OBJECT[name]": "bob",
          "OBJECT[age]": "30",
          "LIST_OF_OBJECTS[0]__name": "alice",
          "LIST_OF_OBJECTS[0]__age": "25",
          "LIST_OF_OBJECTS[1][name]": "bob",
          "LIST_OF_OBJECTS[1][age]": "30"
        }
      })

      await assertPathSuccess(provider, [], ConfigProvider2.object(["LIST", "OBJECT", "LIST_OF_OBJECTS"]))

      await assertPathSuccess(provider, ["OBJECT"], ConfigProvider2.object(["name", "age"]))

      await assertPathSuccess(provider, ["LIST"], ConfigProvider2.array(3))
      await assertPathSuccess(provider, ["LIST", 0], ConfigProvider2.leaf("a"))
      await assertPathSuccess(provider, ["LIST", 1], ConfigProvider2.leaf("b"))
      await assertPathSuccess(provider, ["LIST", 2], ConfigProvider2.leaf("c"))

      await assertPathSuccess(provider, ["LIST_OF_OBJECTS"], ConfigProvider2.array(2))
      await assertPathSuccess(provider, ["LIST_OF_OBJECTS", 0], ConfigProvider2.object(["name", "age"]))
      await assertPathSuccess(provider, ["LIST_OF_OBJECTS", 1], ConfigProvider2.object(["name", "age"]))
    })

    it("should support inline parsing", async () => {
      const provider = ConfigProvider2.fromEnv({
        environment: {
          "LIST": "1,2,3",
          "OBJECT": "a=1,b=2,c=3",
          // edge cases: whitespace
          "WHITESPACED_LIST": " 1, 2 , 3 ",
          "WHITESPACED_OBJECT": " a = 1, b = 2 , c = 3 ",
          // edge cases: empty values
          "EMPTY_OBJECT": "a=,b=2,c=3"
        }
      })

      await assertPathSuccess(
        provider,
        [],
        ConfigProvider2.object([
          "LIST",
          "OBJECT",
          "WHITESPACED_LIST",
          "WHITESPACED_OBJECT",
          "EMPTY_OBJECT"
        ])
      )
      await assertPathSuccess(provider, ["LIST"], ConfigProvider2.array(3))
      await assertPathSuccess(provider, ["LIST", 0], ConfigProvider2.leaf("1"))
      await assertPathSuccess(provider, ["LIST", 1], ConfigProvider2.leaf("2"))
      await assertPathSuccess(provider, ["LIST", 2], ConfigProvider2.leaf("3"))

      await assertPathSuccess(provider, ["OBJECT"], ConfigProvider2.object(["a", "b", "c"]))
      await assertPathSuccess(provider, ["OBJECT", "a"], ConfigProvider2.leaf("1"))
      await assertPathSuccess(provider, ["OBJECT", "b"], ConfigProvider2.leaf("2"))
      await assertPathSuccess(provider, ["OBJECT", "c"], ConfigProvider2.leaf("3"))

      await assertPathSuccess(provider, ["WHITESPACED_LIST"], ConfigProvider2.array(3))
      await assertPathSuccess(provider, ["WHITESPACED_LIST", 0], ConfigProvider2.leaf("1"))
      await assertPathSuccess(provider, ["WHITESPACED_LIST", 1], ConfigProvider2.leaf("2"))
      await assertPathSuccess(provider, ["WHITESPACED_LIST", 2], ConfigProvider2.leaf("3"))

      await assertPathSuccess(provider, ["WHITESPACED_OBJECT"], ConfigProvider2.object(["a", "b", "c"]))
      await assertPathSuccess(provider, ["WHITESPACED_OBJECT", "a"], ConfigProvider2.leaf("1"))
      await assertPathSuccess(provider, ["WHITESPACED_OBJECT", "b"], ConfigProvider2.leaf("2"))
      await assertPathSuccess(provider, ["WHITESPACED_OBJECT", "c"], ConfigProvider2.leaf("3"))

      await assertPathSuccess(provider, ["EMPTY_OBJECT"], ConfigProvider2.object(["a", "b", "c"]))
      await assertPathSuccess(provider, ["EMPTY_OBJECT", "a"], ConfigProvider2.leaf(""))
      await assertPathSuccess(provider, ["EMPTY_OBJECT", "b"], ConfigProvider2.leaf("2"))
      await assertPathSuccess(provider, ["EMPTY_OBJECT", "c"], ConfigProvider2.leaf("3"))
    })

    it("should support both bracket and inline parsing", async () => {
      const provider = ConfigProvider2.fromEnv({
        environment: {
          "LIST[0]": "1,2,3",
          "LIST[1]": "a=1,b=2,c=3",
          "OBJECT[a]": "1,2,3",
          "OBJECT[b]": "a=1,b=2,c=3"
        }
      })

      await assertPathSuccess(provider, [], ConfigProvider2.object(["LIST", "OBJECT"]))
      await assertPathSuccess(provider, ["LIST"], ConfigProvider2.array(2))

      await assertPathSuccess(provider, ["LIST", 0], ConfigProvider2.array(3))
      await assertPathSuccess(provider, ["LIST", 0, 0], ConfigProvider2.leaf("1"))
      await assertPathSuccess(provider, ["LIST", 0, 1], ConfigProvider2.leaf("2"))
      await assertPathSuccess(provider, ["LIST", 0, 2], ConfigProvider2.leaf("3"))

      await assertPathSuccess(provider, ["LIST", 1], ConfigProvider2.object(["a", "b", "c"]))
      await assertPathSuccess(provider, ["LIST", 1, "a"], ConfigProvider2.leaf("1"))
      await assertPathSuccess(provider, ["LIST", 1, "b"], ConfigProvider2.leaf("2"))
      await assertPathSuccess(provider, ["LIST", 1, "c"], ConfigProvider2.leaf("3"))

      await assertPathSuccess(provider, ["OBJECT"], ConfigProvider2.object(["a", "b"]))
      await assertPathSuccess(provider, ["OBJECT", "a"], ConfigProvider2.array(3))
      await assertPathSuccess(provider, ["OBJECT", "a", 0], ConfigProvider2.leaf("1"))
      await assertPathSuccess(provider, ["OBJECT", "a", 1], ConfigProvider2.leaf("2"))
      await assertPathSuccess(provider, ["OBJECT", "a", 2], ConfigProvider2.leaf("3"))
      await assertPathSuccess(provider, ["OBJECT", "b"], ConfigProvider2.object(["a", "b", "c"]))
      await assertPathSuccess(provider, ["OBJECT", "b", "a"], ConfigProvider2.leaf("1"))
    })
  })

  describe("fromStringLeafJson", () => {
    const provider = ConfigProvider2.fromStringLeafJson({
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
      await assertPathSuccess(provider, [], ConfigProvider2.object(["leaf", "object", "array"]))
    })

    it("Exact leaf resolution", async () => {
      await assertPathSuccess(provider, ["leaf"], ConfigProvider2.leaf("value1"))
      await assertPathSuccess(provider, ["object", "key1"], ConfigProvider2.leaf("value2"))
      await assertPathSuccess(provider, ["array", 0], ConfigProvider2.leaf("value4"))
      await assertPathSuccess(provider, ["array", 1, "key4"], ConfigProvider2.leaf("value5"))
      await assertPathSuccess(provider, ["array", 2, 0], ConfigProvider2.leaf("value6"))
    })

    it("Object detection", async () => {
      await assertPathSuccess(provider, ["object"], ConfigProvider2.object(["key1", "key2"]))
      await assertPathSuccess(provider, ["object", "key2"], ConfigProvider2.object(["key3"]))
    })

    it("Array detection", async () => {
      await assertPathSuccess(provider, ["array"], ConfigProvider2.array(3))
      await assertPathSuccess(provider, ["array", 2], ConfigProvider2.array(1))
    })

    it("should return undefined on non-existing paths", async () => {
      await assertPathSuccess(provider, ["leaf", "non-existing"], undefined)
      await assertPathSuccess(provider, ["object", "non-existing"], undefined)
      await assertPathSuccess(provider, ["array", 3, "non-existing"], undefined)
    })
  })

  describe("fromDotEnv", () => {
    it("should support dotenv parsing", async () => {
      const provider = ConfigProvider2.fromDotEnv(`
# comments are ignored
export NODE_ENV="production"
API_URL=https://api.example.com

# inline containers (off by default)
TAGS="a, b , c"
MAP="a=,b=2,c=3"

# structural arrays/objects (on by default)
USERS__0__name=alice
USERS__1__name=bob

# expansion of environment variables (off by default)
PASSWORD="s1mpl3"
DB_PASS=$PASSWORD
`)
      await assertPathSuccess(
        provider,
        [],
        ConfigProvider2.object(["NODE_ENV", "API_URL", "TAGS", "MAP", "USERS", "PASSWORD", "DB_PASS"])
      )
      await assertPathSuccess(provider, ["NODE_ENV"], ConfigProvider2.leaf("production"))
      await assertPathSuccess(provider, ["API_URL"], ConfigProvider2.leaf("https://api.example.com"))
      await assertPathSuccess(provider, ["TAGS"], ConfigProvider2.leaf("a, b , c"))
      await assertPathSuccess(provider, ["MAP"], ConfigProvider2.leaf("a=,b=2,c=3"))
      await assertPathSuccess(provider, ["PASSWORD"], ConfigProvider2.leaf("s1mpl3"))
      await assertPathSuccess(provider, ["DB_PASS"], ConfigProvider2.leaf("$PASSWORD"))
    })

    it("should support custom parser", async () => {
      const provider = ConfigProvider2.fromDotEnv(
        `
# inline containers (your inline parser handles these)
TAGS="a, b , c"
MAP="a=,b=2,c=3"
`,
        { parser: ConfigProvider2.defaultParser }
      )
      await assertPathSuccess(provider, ["TAGS"], ConfigProvider2.array(3))
      await assertPathSuccess(provider, ["MAP"], ConfigProvider2.object(["a", "b", "c"]))
    })

    it("should expand variables", async () => {
      const provider = ConfigProvider2.fromDotEnv(
        `
API_URL=https://api.example.com
DB_PASS=$API_URL
`,
        { expandVariables: true }
      )
      await assertPathSuccess(provider, ["API_URL"], ConfigProvider2.leaf("https://api.example.com"))
      await assertPathSuccess(provider, ["DB_PASS"], ConfigProvider2.leaf("https://api.example.com"))
    })
  })

  describe("dotEnv", () => {
    it("should load configuration from .env file", async () => {
      const provider = await Effect.runPromise(
        ConfigProvider2.dotEnv().pipe(
          Effect.provide(FileSystem.layerNoop({
            readFileString: (path) =>
              Effect.succeed(`PATH=${path}
A=1`)
          }))
        )
      )

      await assertPathSuccess(provider, ["PATH"], ConfigProvider2.leaf(".env"))
      await assertPathSuccess(provider, ["A"], ConfigProvider2.leaf("1"))
    })

    it("should support custom path", async () => {
      const provider = await Effect.runPromise(
        ConfigProvider2.dotEnv({ path: "custom.env" }).pipe(
          Effect.provide(FileSystem.layerNoop({
            readFileString: (path) =>
              Effect.succeed(`CUSTOM_PATH=${path}
A=1`)
          }))
        )
      )

      await assertPathSuccess(provider, ["CUSTOM_PATH"], ConfigProvider2.leaf("custom.env"))
      await assertPathSuccess(provider, ["A"], ConfigProvider2.leaf("1"))
    })
  })
})
