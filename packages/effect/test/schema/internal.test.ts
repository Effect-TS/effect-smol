import { Option, Redacted } from "effect/data"
import { format, toStringUnknown } from "effect/interfaces/Inspectable"
import { Schema } from "effect/schema"
import { describe, it } from "vitest"
import { strictEqual } from "../utils/assert.ts"

describe("Inspectable", () => {
  describe("format", () => {
    it("null", () => {
      strictEqual(format(null), `null`)
    })

    it("undefined", () => {
      strictEqual(format(undefined), `undefined`)
    })

    it("string", () => {
      strictEqual(format("a"), `"a"`)
    })

    it("number", () => {
      strictEqual(format(123), `123`)
    })

    it("boolean", () => {
      strictEqual(format(true), `true`)
    })

    it("symbol", () => {
      strictEqual(format(Symbol("a")), `Symbol(a)`)
    })

    it("bigint", () => {
      strictEqual(format(BigInt(123)), `123n`)
    })

    it("custom toString method", () => {
      strictEqual(format({ toString: () => "custom" }), `custom`)
    })

    it("array", () => {
      strictEqual(format([1, 2, 3n]), `[1,2,3n]`)
    })

    it("circular array", () => {
      const arr: any = [1]
      arr.push(arr)
      strictEqual(format(arr), `[1,[Circular]]`)
    })

    it("Set", () => {
      strictEqual(format(new Set([1, 2, 3])), `Set([1,2,3])`)
    })

    it("Map", () => {
      strictEqual(format(new Map([["a", 1], ["b", 2]])), `Map([["a",1],["b",2]])`)
    })

    it("circular Map contents", () => {
      const obj: any = { a: 1 }
      const map = new Map([["obj", obj]])
      obj.map = map
      strictEqual(format(map), `Map([["obj",{"a":1,"map":[Circular]}]])`)
    })

    it("circular Set contents", () => {
      const obj: any = { a: 1 }
      const set = new Set([obj])
      obj.set = set
      strictEqual(format(set), `Set([{"a":1,"set":[Circular]}])`)
    })

    it("object", () => {
      strictEqual(format({ a: 1 }), `{"a":1}`)
      strictEqual(format({ a: 1, b: 2 }), `{"a":1,"b":2}`)
      strictEqual(format({ [Symbol.for("a")]: 1 }), `{Symbol(a):1}`)
      strictEqual(format({ a: 1, b: [1, 2, 3n] }), `{"a":1,"b":[1,2,3n]}`)
    })

    it("circular object", () => {
      const obj: any = { a: 1 }
      obj.b = obj
      strictEqual(format(obj), `{"a":1,"b":[Circular]}`)
    })

    it("object with null prototype", () => {
      strictEqual(format(Object.create(null)), `{}`)
      strictEqual(format(Object.create(null, { a: { value: 1 } })), `{"a":1}`)
    })

    it("Error", () => {
      strictEqual(format(new Error("a")), `Error: a`)
    })

    it("Date", () => {
      strictEqual(format(new Date(0)), `1970-01-01T00:00:00.000Z`)
      strictEqual(format(new Date("invalid")), `Invalid Date`)
    })

    it("RegExp", () => {
      strictEqual(format(/a/), `/a/`)
    })

    it("Redacted", () => {
      strictEqual(format(Redacted.make("a")), `<redacted>`)
    })

    it("Option", () => {
      strictEqual(
        format(Option.some(1)),
        `some(1)`
      )
      strictEqual(
        format(Option.none()),
        `none()`
      )
    })

    it("Class", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      strictEqual(format(new A({ a: "a" })), `A({"a":"a"})`)
    })

    it("ErrorClass", () => {
      class E extends Schema.ErrorClass<E>("E")({
        a: Schema.String
      }) {}
      strictEqual(format(new E({ a: "a" })), `Error`)
    })

    describe("whitespace", () => {
      it("object", () => {
        strictEqual(format({ a: 1 }, { whitespace: 2 }), `{"a":1}`)
        strictEqual(
          format({ a: 1, b: 2 }, { whitespace: 2 }),
          `{
  "a": 1,
  "b": 2
}`
        )
        strictEqual(
          format({ a: 1, b: [1, 2, 3n] }, { whitespace: 2 }),
          `{
  "a": 1,
  "b": [
    1,
    2,
    3n
  ]
}`
        )
        strictEqual(format({ [Symbol.for("a")]: 1 }, { whitespace: 2 }), `{Symbol(a):1}`)
      })

      it("circular object", () => {
        const obj: any = { a: 1 }
        obj.b = obj
        strictEqual(
          format(obj, { whitespace: 2 }),
          `{
  "a": 1,
  "b": [Circular]
}`
        )
      })

      it("object with null prototype", () => {
        strictEqual(format(Object.create(null), { whitespace: 2 }), `{}`)
        strictEqual(
          format(Object.create(null, { a: { value: 1 } }), { whitespace: 2 }),
          `{"a":1}`
        )
      })
    })
  })

  // TODO: replace with schema formatUnknown?
  describe("toStringUnknown", () => {
    const format = toStringUnknown

    it("null", () => {
      strictEqual(format(null), `null`)
    })

    it("undefined", () => {
      strictEqual(format(undefined), `undefined`)
    })

    it("string", () => {
      strictEqual(format("a"), `a`)
    })

    it("number", () => {
      strictEqual(format(123), `123`)
    })

    it("boolean", () => {
      strictEqual(format(true), `true`)
    })

    it("symbol", () => {
      strictEqual(format(Symbol("a")), `Symbol(a)`)
    })

    it("bigint", () => {
      strictEqual(format(BigInt(123)), `123`)
    })

    it("custom toString", () => {
      strictEqual(format({ toString: () => "custom" }), `{}`)
    })

    it("array", () => {
      strictEqual(format([1, 2, 3n]), `1,2,3`)
    })

    it("circular array", () => {
      const arr: any = [1]
      arr.push(arr)
      strictEqual(
        format(arr),
        `[
  1,
  null
]`
      )
    })

    it("Set", () => {
      strictEqual(format(new Set([1, 2, 3])), `{}`)
    })

    it("Map", () => {
      strictEqual(format(new Map([["a", 1], ["b", 2]])), `{}`)
    })

    it("circular Map contents", () => {
      const obj: any = { a: 1 }
      const map = new Map([["obj", obj]])
      obj.map = map
      strictEqual(format(map), `{}`)
    })

    it("circular Set contents", () => {
      const obj: any = { a: 1 }
      const set = new Set([obj])
      obj.set = set
      strictEqual(format(set), `{}`)
    })

    it("object", () => {
      strictEqual(
        format({ a: 1 }),
        `{
  "a": 1
}`
      )
      strictEqual(
        format({ a: 1, b: 2 }),
        `{
  "a": 1,
  "b": 2
}`
      )
      strictEqual(
        format({ [Symbol.for("a")]: 1 }),
        `{}`
      )
      strictEqual(
        format({ a: 1, b: [1, 2, 3n] }),
        `[object Object]`
      )
    })

    it("circular object", () => {
      const obj: any = { a: 1 }
      obj.b = obj
      strictEqual(
        format(obj),
        `{
  "a": 1
}`
      )
    })

    it("object with null prototype", () => {
      strictEqual(format(Object.create(null)), `{}`)
    })

    it("Error", () => {
      strictEqual(format(new Error("a")), `{}`)
    })

    it("Date", () => {
      strictEqual(format(new Date(0)), `"1970-01-01T00:00:00.000Z"`)
      strictEqual(format(new Date("invalid")), `null`)
    })

    it("RegExp", () => {
      strictEqual(format(/a/), `{}`)
    })

    it("Redacted", () => {
      strictEqual(format(Redacted.make("a")), `"<redacted>"`)
    })

    it("Option", () => {
      strictEqual(
        format(Option.some(1)),
        `{
  "_id": "Option",
  "_tag": "Some",
  "value": 1
}`
      )
      strictEqual(
        format(Option.none()),
        `{
  "_id": "Option",
  "_tag": "None"
}`
      )
    })

    it("Class", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      strictEqual(
        format(new A({ a: "a" })),
        `{
  "a": "a"
}`
      )
    })

    it("ErrorClass", () => {
      class E extends Schema.ErrorClass<E>("E")({
        a: Schema.String
      }) {}
      strictEqual(
        format(new E({ a: "a" })),
        `{
  "a": "a"
}`
      )
    })
  })
})
