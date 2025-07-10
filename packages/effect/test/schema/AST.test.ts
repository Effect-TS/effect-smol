import { AST, Schema } from "effect/schema"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.js"

describe("AST", () => {
  describe("collectSentinels", () => {
    describe("Struct", () => {
      it("required tag", () => {
        const schema = Schema.Struct({
          _tag: Schema.Literal("a"),
          a: Schema.String
        })
        const ast = schema.ast
        deepStrictEqual(AST.collectSentinels(ast), [{ key: "_tag", literal: "a" }])
      })

      it("optional tag", () => {
        const schema = Schema.Struct({
          _tag: Schema.optionalKey(Schema.Literal("a")),
          a: Schema.String
        })
        const ast = schema.ast
        deepStrictEqual(AST.collectSentinels(ast), undefined)
      })
    })

    describe("Tuple", () => {
      it("required element", () => {
        const schema = Schema.Tuple([Schema.Literal("a"), Schema.Number])
        const ast = schema.ast
        deepStrictEqual(AST.collectSentinels(ast), [{ key: 0, literal: "a" }])
      })

      it("optional element", () => {
        const schema = Schema.Tuple([Schema.Number, Schema.optionalKey(Schema.Literal("a"))])
        const ast = schema.ast
        deepStrictEqual(AST.collectSentinels(ast), undefined)
      })
    })

    it("Declaration", () => {
      class A {
        readonly _tag = "A"
      }
      const schema = Schema.instanceOf({
        constructor: A,
        annotations: {
          "~sentinels": [{ key: "_tag", literal: "A" }]
        }
      })
      const ast = schema.ast
      deepStrictEqual(AST.collectSentinels(ast), [{ key: "_tag", literal: "A" }])
    })
  })

  describe("getCandidates", () => {
    it("should exclude by type", () => {
      const schema = Schema.NullishOr(Schema.String)
      const ast = schema.ast
      deepStrictEqual(AST.getCandidates("a", ast.types), [ast.types[0]])
      deepStrictEqual(AST.getCandidates(null, ast.types), [ast.types[1]])
      deepStrictEqual(AST.getCandidates(undefined, ast.types), [ast.types[2]])
      deepStrictEqual(AST.getCandidates(1, ast.types), [])
    })

    it("should exclude by literals", () => {
      const schema = Schema.Union([
        Schema.UniqueSymbol(Symbol.for("a")),
        Schema.Literal("b"),
        Schema.String
      ])
      const ast = schema.ast
      deepStrictEqual(AST.getCandidates(Symbol.for("a"), ast.types), [ast.types[0]])
      deepStrictEqual(AST.getCandidates("b", ast.types), [ast.types[1], ast.types[2]])
      deepStrictEqual(AST.getCandidates("c", ast.types), [ast.types[2]])
      deepStrictEqual(AST.getCandidates(1, ast.types), [])
    })

    it("Literals", () => {
      const schema = Schema.Literals(["a", "b", "c"])
      const ast = schema.ast
      deepStrictEqual(AST.getCandidates("a", ast.types), [ast.types[0]])
      deepStrictEqual(AST.getCandidates("b", ast.types), [ast.types[1]])
      deepStrictEqual(AST.getCandidates("c", ast.types), [ast.types[2]])
      deepStrictEqual(AST.getCandidates("d", ast.types), [])
      deepStrictEqual(AST.getCandidates(null, ast.types), [])
      deepStrictEqual(AST.getCandidates(undefined, ast.types), [])
    })

    it("should handle tagged structs", () => {
      const schema = Schema.Union([
        Schema.Struct({ _tag: Schema.tag("a"), a: Schema.String }),
        Schema.Struct({ _tag: Schema.tag("b"), b: Schema.Number }),
        Schema.String
      ])
      const ast = schema.ast
      deepStrictEqual(AST.getCandidates({}, ast.types), [])
      deepStrictEqual(AST.getCandidates({ _tag: "a" }, ast.types), [ast.types[0]])
      deepStrictEqual(AST.getCandidates({ _tag: "b" }, ast.types), [ast.types[1]])
      deepStrictEqual(AST.getCandidates({ _tag: "c" }, ast.types), [])
      deepStrictEqual(AST.getCandidates("", ast.types), [ast.types[2]])
      deepStrictEqual(AST.getCandidates(1, ast.types), [])
    })

    it("should handle tagged tuples", () => {
      const schema = Schema.Union([
        Schema.Tuple([Schema.Literal("a"), Schema.String]),
        Schema.Tuple([Schema.Literal("b"), Schema.Number]),
        Schema.String
      ])
      const ast = schema.ast
      deepStrictEqual(AST.getCandidates([], ast.types), [])
      deepStrictEqual(AST.getCandidates(["a"], ast.types), [ast.types[0]])
      deepStrictEqual(AST.getCandidates(["b"], ast.types), [ast.types[1]])
      deepStrictEqual(AST.getCandidates(["c"], ast.types), [])
      deepStrictEqual(AST.getCandidates("", ast.types), [ast.types[2]])
      deepStrictEqual(AST.getCandidates(1, ast.types), [])
    })
  })
})
