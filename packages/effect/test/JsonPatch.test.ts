import { describe, it } from "@effect/vitest"
import { deepStrictEqual, throws } from "@effect/vitest/utils"
import * as JsonPatch from "effect/JsonPatch"
import type * as Schema from "effect/Schema"

const expectMessage = (f: () => unknown, includes: string) => {
  throws(f, (e) => {
    if (e instanceof Error && e.message.includes(includes)) return undefined
    throw e
  })
}

const expectAppliesTo = (patch: JsonPatch.JsonPatch, oldValue: Schema.Json, newValue: Schema.Json) => {
  deepStrictEqual(JsonPatch.apply(patch, oldValue), newValue)
}

describe("JsonPatch", () => {
  describe("get", () => {
    describe("root values", () => {
      it("returns [] for identical values", () => {
        const cases: ReadonlyArray<Schema.Json> = [
          1,
          "hello",
          true,
          null,
          [1, 2, 3],
          { a: 1 }
        ]
        for (const v of cases) {
          deepStrictEqual(JsonPatch.get(v, v), [])
        }
      })

      it("emits a root replace for primitive changes", () => {
        const cases: ReadonlyArray<[Schema.Json, Schema.Json]> = [
          [1, 2],
          ["hello", "world"],
          [true, false],
          [null, 42]
        ]
        for (const [from, to] of cases) {
          deepStrictEqual(JsonPatch.get(from, to), [{ op: "replace", path: "", value: to }])
        }
      })

      it("emits a root replace for type changes", () => {
        deepStrictEqual(JsonPatch.get(1, "string"), [{ op: "replace", path: "", value: "string" }])
        deepStrictEqual(JsonPatch.get([1, 2], { a: 1 }), [{ op: "replace", path: "", value: { a: 1 } }])
        deepStrictEqual(JsonPatch.get({ a: 1 }, [1, 2]), [{ op: "replace", path: "", value: [1, 2] }])
      })
    })

    describe("arrays", () => {
      it("adds new elements (append semantics)", () => {
        deepStrictEqual(JsonPatch.get([1, 2], [1, 2, 3]), [{ op: "add", path: "/2", value: 3 }])
        deepStrictEqual(JsonPatch.get([], [1, 2, 3]), [
          { op: "add", path: "/0", value: 1 },
          { op: "add", path: "/1", value: 2 },
          { op: "add", path: "/2", value: 3 }
        ])
      })

      it("removes elements in descending index order (no index shifting)", () => {
        deepStrictEqual(JsonPatch.get([1, 2, 3], [1, 2]), [{ op: "remove", path: "/2" }])

        const patch = JsonPatch.get([0, 1, 2, 3, 4, 5], [0, 1, 3])
        const removeIdx = patch
          .filter((op) => op.op === "remove")
          .map((op) => Number(op.path.slice(1)))

        deepStrictEqual(removeIdx, [...removeIdx].sort((a, b) => b - a))
        expectAppliesTo(patch, [0, 1, 2, 3, 4, 5], [0, 1, 3])
      })

      it("replaces modified elements", () => {
        deepStrictEqual(JsonPatch.get([1, 2, 3], [1, 4, 3]), [{ op: "replace", path: "/1", value: 4 }])
      })

      it("handles mixed operations", () => {
        deepStrictEqual(JsonPatch.get([1, 2, 3], [1, 4, 5, 6]), [
          { op: "replace", path: "/1", value: 4 },
          { op: "replace", path: "/2", value: 5 },
          { op: "add", path: "/3", value: 6 }
        ])

        deepStrictEqual(JsonPatch.get([1, 2, 3, 4], [1, 5]), [
          { op: "replace", path: "/1", value: 5 },
          { op: "remove", path: "/3" },
          { op: "remove", path: "/2" }
        ])
      })

      it("supports nested arrays", () => {
        deepStrictEqual(JsonPatch.get([[1, 2], [3, 4]], [[1, 2], [3, 5]]), [
          { op: "replace", path: "/1/1", value: 5 }
        ])

        deepStrictEqual(JsonPatch.get([[1, 2]], [[1, 2], [3, 4]]), [
          { op: "add", path: "/1", value: [3, 4] }
        ])
      })
    })

    describe("objects", () => {
      it("uses stable key order for deterministic patches", () => {
        const patch = JsonPatch.get({ b: 1, a: 1 }, { a: 2, b: 2 })
        deepStrictEqual(
          patch.filter((op) => op.op === "replace").map((op) => op.path),
          ["/a", "/b"]
        )
        expectAppliesTo(patch, { b: 1, a: 1 }, { a: 2, b: 2 })
      })

      it("adds / removes / replaces properties", () => {
        deepStrictEqual(JsonPatch.get({ a: 1 }, { a: 1, b: 2 }), [{ op: "add", path: "/b", value: 2 }])
        deepStrictEqual(JsonPatch.get({ a: 1, b: 2 }, { a: 1 }), [{ op: "remove", path: "/b" }])
        deepStrictEqual(JsonPatch.get({ a: 1, b: 2 }, { a: 1, b: 3 }), [{ op: "replace", path: "/b", value: 3 }])
      })

      it("removes properties in sorted key order", () => {
        deepStrictEqual(JsonPatch.get({ a: 1, b: 2, c: 3 }, {}), [
          { op: "remove", path: "/a" },
          { op: "remove", path: "/b" },
          { op: "remove", path: "/c" }
        ])
      })

      it("handles mixed object operations", () => {
        deepStrictEqual(JsonPatch.get({ a: 1, b: 2 }, { a: 1, c: 3, d: 4 }), [
          { op: "remove", path: "/b" },
          { op: "add", path: "/c", value: 3 },
          { op: "add", path: "/d", value: 4 }
        ])
      })

      it("supports nested objects", () => {
        deepStrictEqual(JsonPatch.get({ a: { b: 1 } }, { a: { b: 2 } }), [
          { op: "replace", path: "/a/b", value: 2 }
        ])
        deepStrictEqual(JsonPatch.get({ a: { b: 1 } }, { a: { b: 1, c: 2 } }), [
          { op: "add", path: "/a/c", value: 2 }
        ])
        deepStrictEqual(JsonPatch.get({ a: { b: 1, c: 2 } }, { a: { b: 1 } }), [
          { op: "remove", path: "/a/c" }
        ])
      })

      describe("JSON Pointer escaping in keys", () => {
        it("escapes '/' as '~1' and '~' as '~0'", () => {
          deepStrictEqual(JsonPatch.get({ "a/b": 1 }, { "a/b": 2 }), [
            { op: "replace", path: "/a~1b", value: 2 }
          ])
          deepStrictEqual(JsonPatch.get({ "a~b": 1 }, { "a~b": 2 }), [
            { op: "replace", path: "/a~0b", value: 2 }
          ])
        })

        it("represents a literal key '~1' as token '~01'", () => {
          deepStrictEqual(JsonPatch.get({}, { "~1": 0 }), [
            { op: "add", path: "/~01", value: 0 }
          ])
        })

        it("does not confuse '~01' with '/' (unescape order)", () => {
          deepStrictEqual(JsonPatch.get({ "a~1b": 1 }, { "a~1b": 2 }), [
            { op: "replace", path: "/a~01b", value: 2 }
          ])
        })
      })
    })

    describe("complex nested structures", () => {
      it("emits a minimal-ish patch for deep updates (and is applicable)", () => {
        const oldValue: Schema.Json = {
          users: [
            { id: 1, name: "Alice", tags: ["admin"] },
            { id: 2, name: "Bob", tags: [] }
          ],
          metadata: { version: 1 }
        }

        const newValue: Schema.Json = {
          users: [
            { id: 1, name: "Alice", tags: ["admin", "moderator"] },
            { id: 2, name: "Bob", tags: [] },
            { id: 3, name: "Charlie", tags: [] }
          ],
          metadata: { version: 2 }
        }

        const patch = JsonPatch.get(oldValue, newValue)
        deepStrictEqual(patch, [
          { op: "replace", path: "/metadata/version", value: 2 },
          { op: "add", path: "/users/0/tags/1", value: "moderator" },
          { op: "add", path: "/users/2", value: { id: 3, name: "Charlie", tags: [] } }
        ])

        expectAppliesTo(patch, oldValue, newValue)
      })
    })
  })

  describe("apply", () => {
    describe("happy paths", () => {
      it("replace", () => {
        deepStrictEqual(JsonPatch.apply([{ op: "replace", path: "", value: 42 }], 1), 42)

        deepStrictEqual(
          JsonPatch.apply([{ op: "replace", path: "/a", value: 2 }], { a: 1 }),
          { a: 2 }
        )

        deepStrictEqual(
          JsonPatch.apply([{ op: "replace", path: "/1", value: 20 }], [1, 2, 3]),
          [1, 20, 3]
        )

        deepStrictEqual(
          JsonPatch.apply([{ op: "replace", path: "/a/b", value: 2 }], { a: { b: 1 } }),
          { a: { b: 2 } }
        )
      })

      it("add", () => {
        deepStrictEqual(
          JsonPatch.apply([{ op: "add", path: "/b", value: 2 }], { a: 1 }),
          { a: 1, b: 2 }
        )

        deepStrictEqual(
          JsonPatch.apply([{ op: "add", path: "/1", value: 10 }], [1, 2, 3]),
          [1, 10, 2, 3]
        )

        deepStrictEqual(
          JsonPatch.apply([{ op: "add", path: "/-", value: 4 }], [1, 2, 3]),
          [1, 2, 3, 4]
        )

        deepStrictEqual(
          JsonPatch.apply([{ op: "add", path: "/users/0/tags/-", value: "admin" }], {
            users: [{ id: 1, tags: [] }]
          }),
          { users: [{ id: 1, tags: ["admin"] }] }
        )
      })

      it("remove", () => {
        deepStrictEqual(
          JsonPatch.apply([{ op: "remove", path: "/a" }], { a: 1, b: 2 }),
          { b: 2 }
        )

        deepStrictEqual(
          JsonPatch.apply([{ op: "remove", path: "/1" }], [1, 2, 3]),
          [1, 3]
        )

        deepStrictEqual(
          JsonPatch.apply([{ op: "remove", path: "/a/b" }], { a: { b: 1, c: 2 } }),
          { a: { c: 2 } }
        )
      })

      it("applies multiple operations in sequence", () => {
        deepStrictEqual(
          JsonPatch.apply(
            [
              { op: "add", path: "/c", value: 3 },
              { op: "replace", path: "/a", value: 10 },
              { op: "remove", path: "/b" }
            ],
            { a: 1, b: 2 }
          ),
          { a: 10, c: 3 }
        )
      })
    })

    describe("JSON Pointer decoding", () => {
      it("decodes '~1' as '/' and '~0' as '~'", () => {
        deepStrictEqual(
          JsonPatch.apply([{ op: "replace", path: "/a~1b", value: 2 }], { "a/b": 1 }),
          { "a/b": 2 }
        )

        deepStrictEqual(
          JsonPatch.apply([{ op: "add", path: "/a~0b", value: 1 }], {}),
          { "a~b": 1 }
        )

        deepStrictEqual(
          JsonPatch.apply([{ op: "add", path: "/path~1to~0key", value: "value" }], {}),
          { "path/to~key": "value" }
        )
      })

      it("decodes '~01' as a literal '~1' (unescape order)", () => {
        deepStrictEqual(
          JsonPatch.apply([{ op: "add", path: "/a~01b", value: 1 }], {}),
          { "a~1b": 1 }
        )
      })

      it("addresses a literal key '~1' via token '~01'", () => {
        deepStrictEqual(
          JsonPatch.apply([{ op: "add", path: "/~01", value: 0 }], {}),
          { "~1": 0 }
        )
      })
    })

    describe("errors", () => {
      it("rejects non-empty pointers that do not start with '/'", () => {
        expectMessage(
          () => JsonPatch.apply([{ op: "add", path: "invalid", value: 1 }], {}),
          `must start with "/"`
        )
      })

      it("rejects invalid array indices", () => {
        expectMessage(
          () => JsonPatch.apply([{ op: "add", path: "/abc", value: 1 }], []),
          `Invalid array index`
        )
        expectMessage(
          () => JsonPatch.apply([{ op: "replace", path: "/-1", value: 1 }], [1, 2, 3]),
          `Invalid array index`
        )
      })

      it("rejects out-of-bounds array access", () => {
        expectMessage(
          () => JsonPatch.apply([{ op: "replace", path: "/10", value: 1 }], [1, 2, 3]),
          "Array index out of bounds"
        )
        expectMessage(
          () => JsonPatch.apply([{ op: "add", path: "/10", value: 1 }], [1, 2, 3]),
          "Array index out of bounds"
        )
        expectMessage(
          () => JsonPatch.apply([{ op: "remove", path: "/10" }], [1, 2, 3]),
          "Array index out of bounds"
        )
      })

      it("rejects '-' for replace/remove", () => {
        expectMessage(
          () => JsonPatch.apply([{ op: "replace", path: "/-", value: 1 }], [1, 2, 3]),
          `"-" is not valid for replace`
        )

        expectMessage(
          () => JsonPatch.apply([{ op: "remove", path: "/-" }], [1, 2, 3]),
          `"-" is not valid for remove`
        )
      })

      it("rejects replace/remove of non-existent object members", () => {
        expectMessage(
          () => JsonPatch.apply([{ op: "replace", path: "/nonexistent", value: 1 }], { a: 1 }),
          `does not exist`
        )
        expectMessage(
          () => JsonPatch.apply([{ op: "remove", path: "/nonexistent" }], { a: 1 }),
          `does not exist`
        )
      })

      it("rejects add/replace when the parent is missing or not a container", () => {
        expectMessage(
          () => JsonPatch.apply([{ op: "add", path: "/a/b", value: 1 }], { a: null }),
          "Cannot add at"
        )
        expectMessage(
          () => JsonPatch.apply([{ op: "add", path: "/a/b", value: 1 }], {}),
          "Cannot add at"
        )

        expectMessage(
          () => JsonPatch.apply([{ op: "add", path: "/a/b", value: 1 }], { a: "string" }),
          "not a container"
        )
        expectMessage(
          () => JsonPatch.apply([{ op: "replace", path: "/a/b", value: 1 }], { a: 42 }),
          "not a container"
        )

        expectMessage(
          () => JsonPatch.apply([{ op: "add", path: "/a/b/c", value: 1 }], { a: { b: "not-object" } }),
          "not a container"
        )
      })

      it("rejects remove at the root", () => {
        expectMessage(
          () => JsonPatch.apply([{ op: "remove", path: "" }], { a: 1 }),
          "root"
        )
      })
    })
  })

  describe("round-trip", () => {
    const cases: ReadonlyArray<[Schema.Json, Schema.Json]> = [
      [
        {
          users: [
            { id: 1, name: "Alice", active: true },
            { id: 2, name: "Bob", active: false }
          ],
          metadata: { version: 1, tags: ["v1"] }
        },
        {
          users: [
            { id: 1, name: "Alice Updated", active: true },
            { id: 3, name: "Charlie", active: true }
          ],
          metadata: { version: 2, tags: ["v2", "latest"] }
        }
      ],
      [
        [1, 2, 3, 4, 5],
        [1, 20, 3, 40, 50, 60]
      ],
      [
        { a: 1, b: 2, c: 3 },
        { a: 10, d: 4, e: 5 }
      ],
      [
        { level1: { level2: { level3: { value: "old" } } } },
        { level1: { level2: { level3: { value: "new", extra: "added" } } } }
      ]
    ]

    it("apply(get(old, new), old) === new", () => {
      for (const [oldValue, newValue] of cases) {
        const patch = JsonPatch.get(oldValue, newValue)
        expectAppliesTo(patch, oldValue, newValue)
      }
    })
  })
})
