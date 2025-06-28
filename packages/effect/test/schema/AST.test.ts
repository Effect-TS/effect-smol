import { AST, Schema } from "effect/schema"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.js"

describe("AST", () => {
  describe("collectSentinels", () => {
    it("required tag", () => {
      const schema = Schema.Struct({
        _tag: Schema.Literal("a"),
        a: Schema.String
      })
      const ast = schema.ast
      deepStrictEqual(AST.collectSentinels(ast), new Set([{ key: "_tag", literal: "a", isOptional: false }]))
    })

    it("optional tag", () => {
      const schema = Schema.Struct({
        _tag: Schema.optionalKey(Schema.Literal("a")),
        a: Schema.String
      })
      const ast = schema.ast
      deepStrictEqual(AST.collectSentinels(ast), new Set([{ key: "_tag", literal: "a", isOptional: true }]))
    })
  })

  describe("getCandidates", () => {
    it("required tag", () => {
      const schema = Schema.Struct({
        _tag: Schema.Literal("a"),
        a: Schema.String
      })
      const ast = schema.ast
      deepStrictEqual(AST.getCandidates({ _tag: "a", value: "a" }, [ast]), [ast])
      deepStrictEqual(AST.getCandidates({ value: "a" }, [ast]), [])
      deepStrictEqual(AST.getCandidates({ _tag: "b", value: "a" }, [ast]), [])
    })

    it("optional tag", () => {
      const schema = Schema.Struct({
        _tag: Schema.optionalKey(Schema.Literal("a")),
        a: Schema.String
      })
      const ast = schema.ast
      deepStrictEqual(AST.getCandidates({ _tag: "a", value: "a" }, [ast]), [ast])
      deepStrictEqual(AST.getCandidates({ value: "a" }, [ast]), [ast])
      deepStrictEqual(AST.getCandidates({ _tag: "b", value: "a" }, [ast]), [])
    })
  })
})
