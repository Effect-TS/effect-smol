import { Effect } from "effect"
import { Option, Result } from "effect/data"
import { Getter } from "effect/schema"
import { describe, it } from "vitest"
import { assertSome, deepStrictEqual } from "../utils/assert.ts"

function makeAsserts<T, E>(getter: Getter.Getter<T, E>) {
  return async (input: E, expected: T) => {
    const r = await Effect.runPromise(
      getter.run(Option.some(input), {}).pipe(
        Effect.mapError((issue) => issue.toString()),
        Effect.result
      )
    )
    deepStrictEqual(r, Result.succeed(Option.some(expected)))
  }
}

describe("Getter", () => {
  it("map", () => {
    const getter = Getter.succeed(1).map((t) => t + 1)
    const result = Effect.runSync(getter.run(Option.some(1), {}))
    assertSome(result, 2)
  })

  describe("decodeFormData / encodeFormData", () => {
    const decoding = makeAsserts(Getter.decodeFormData())
    const encoding = makeAsserts(Getter.encodeFormData())

    it("should handle top level empty keys", async () => {
      const formData = new FormData()
      formData.append("", "value")
      const object = { "": "value" }
      await decoding(formData, object)
      await encoding(object, formData)
    })

    it("decodes simple top-level keys", async () => {
      const formData = new FormData()
      formData.append("a", "1")
      formData.append("b", "two")
      const object = {
        a: "1",
        b: "two"
      }
      await decoding(formData, object)
      await encoding(object, formData)
    })

    it("decodes nested objects via bracket notation", async () => {
      const formData = new FormData()
      formData.append("user[name]", "John")
      formData.append("user[email]", "john@example.com")
      const object = {
        user: {
          name: "John",
          email: "john@example.com"
        }
      }
      await decoding(formData, object)
      await encoding(object, formData)
    })

    it("decodes nested objects via dot notation", async () => {
      const formData = new FormData()
      formData.append("user.name", "John")
      formData.append("user.email", "john@example.com")
      const object = {
        user: {
          name: "John",
          email: "john@example.com"
        }
      }
      await decoding(formData, object)
    })

    it("decodes mixed dot + bracket notation", async () => {
      const formData = new FormData()
      formData.append("user.address[city]", "Milan")
      formData.append("user.address[zip]", "20100")
      const object = {
        user: {
          address: {
            city: "Milan",
            zip: "20100"
          }
        }
      }
      await decoding(formData, object)
    })

    it("decodes arrays with numeric indices", async () => {
      const formData = new FormData()
      formData.append("items[0]", "item1")
      formData.append("items[1]", "item2")
      const object = {
        items: ["item1", "item2"]
      }
      await decoding(formData, object)
      await encoding(object, formData)
    })

    it("decodes arrays with numeric indices and nested objects", async () => {
      const formData = new FormData()
      formData.append("items[0][id]", "a")
      formData.append("items[0][name]", "Item A")
      formData.append("items[1][id]", "b")
      formData.append("items[1][name]", "Item B")
      const object = {
        items: [
          { id: "a", name: "Item A" },
          { id: "b", name: "Item B" }
        ]
      }
      await decoding(formData, object)
      await encoding(object, formData)
    })

    it("decodes arrays with [] (append)", async () => {
      const formData = new FormData()
      formData.append("tags[]", "a")
      formData.append("tags[]", "b")
      formData.append("tags[]", "c")
      const object = {
        tags: ["a", "b", "c"]
      }
      await decoding(formData, object)

      {
        const formData = new FormData()
        formData.append("tags[0]", "a")
        formData.append("tags[1]", "b")
        formData.append("tags[2]", "c")
        await encoding(object, formData)
      }
    })

    it("decodes arrays with [] and nested objects", async () => {
      const formData = new FormData()
      formData.append("items[][id]", "x")
      formData.append("items[][id]", "y")
      const object = {
        items: [
          { id: "x" },
          { id: "y" }
        ]
      }
      await decoding(formData, object)
    })

    it("decodes mixed indexed and append arrays under the same key", async () => {
      const formData = new FormData()
      formData.append("items[0]", "a")
      formData.append("items[]", "b")
      formData.append("items[]", "c")
      const object = {
        items: ["a", "b", "c"]
      }
      // Implementation detail: first write at index 0, then pushes at 1 and 2
      await decoding(formData, object)
    })

    it("decodes nested objects inside appended array elements", async () => {
      const formData = new FormData()
      formData.append("users[][name]", "John")
      formData.append("users[][name]", "Alice")
      const object = {
        users: [
          { name: "John" },
          { name: "Alice" }
        ]
      }
      await decoding(formData, object)
    })

    it("decodes complex mixed structure", async () => {
      const formData = new FormData()
      formData.append("user[name]", "John")
      formData.append("user[address][city]", "Milan")
      formData.append("user[address][zip]", "20100")
      formData.append("orders[0][id]", "o1")
      formData.append("orders[0][total]", "10")
      formData.append("orders[1][id]", "o2")
      formData.append("orders[1][total]", "20")
      formData.append("tags[0]", "a")
      formData.append("tags[1]", "b")
      const object = {
        user: {
          name: "John",
          address: {
            city: "Milan",
            zip: "20100"
          }
        },
        orders: [
          { id: "o1", total: "10" },
          { id: "o2", total: "20" }
        ],
        tags: ["a", "b"]
      }
      await decoding(formData, object)
    })
  })
})
