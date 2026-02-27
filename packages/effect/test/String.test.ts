import * as String from "effect/String"
import { describe, it } from "vitest"
import { assertNone, assertSome, strictEqual } from "./utils/assert.ts"

describe("String", () => {
  it("Equivalence", () => {
    strictEqual(String.Equivalence("a", "a"), true)
    strictEqual(String.Equivalence("a", "b"), false)
  })

  it("ReducerConcat", () => {
    strictEqual(String.ReducerConcat.combine("a", "b"), "ab")
    strictEqual(String.ReducerConcat.combine("a", String.ReducerConcat.initialValue), "a")
    strictEqual(String.ReducerConcat.combine(String.ReducerConcat.initialValue, "a"), "a")
  })

  it("charCodeAt", () => {
    assertSome(String.charCodeAt("abc", 1), 98)
    assertSome(String.charCodeAt(1)("abc"), 98)
    assertNone(String.charCodeAt("abc", 4))
  })

  it("at", () => {
    assertSome(String.at("abc", 1), "b")
    assertSome(String.at(1)("abc"), "b")
    assertSome(String.at("abc", -1), "c")
    assertNone(String.at("abc", 4))
  })

  it("charAt", () => {
    assertSome(String.charAt("abc", 1), "b")
    assertNone(String.charAt("abc", -1))
    assertNone(String.charAt("abc", 4))
  })

  it("codePointAt", () => {
    assertSome(String.codePointAt("abc", 1), 98)
    assertSome(String.codePointAt(1)("abc"), 98)
    assertNone(String.codePointAt("abc", 10))
  })

  it("indexOf", () => {
    assertSome(String.indexOf("b")("abbbc"), 1)
    assertNone(String.indexOf("z")("abbbc"))
  })

  it("lastIndexOf", () => {
    assertSome(String.lastIndexOf("b")("abbbc"), 3)
    assertNone(String.lastIndexOf("d")("abbbc"))
  })

  it("match", () => {
    const found = String.match(/l+/)("hello")
    strictEqual(found._tag, "Some")
    if (found._tag === "Some") {
      strictEqual(found.value[0], "ll")
    }
    assertNone(String.match(/x/)("hello"))
  })

  it("search", () => {
    assertSome(String.search("ababb", "b"), 1)
    assertSome(String.search(/abb/)("ababb"), 2)
    assertNone(String.search("ababb", "d"))
  })
})
