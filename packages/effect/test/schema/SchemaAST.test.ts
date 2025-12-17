import { Schema, SchemaAnnotations, SchemaAST } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("SchemaAST", () => {
  describe("collectSentinels", () => {
    describe("Declaration", () => {
      it("~sentinels", () => {
        class A {
          readonly _tag = "A"
        }
        const schema = Schema.instanceOf(A, { "~sentinels": [{ key: "_tag", literal: "A" }] })
        const ast = schema.ast
        deepStrictEqual(SchemaAST.collectSentinels(ast), [{ key: "_tag", literal: "A" }])
      })
    })

    describe("Struct", () => {
      it("required tag", () => {
        const schema = Schema.Struct({
          _tag: Schema.Literal("a"),
          a: Schema.String
        })
        const ast = schema.ast
        deepStrictEqual(SchemaAST.collectSentinels(ast), [{ key: "_tag", literal: "a" }])
      })

      it("optional tag", () => {
        const schema = Schema.Struct({
          _tag: Schema.optionalKey(Schema.Literal("a")),
          a: Schema.String
        })
        const ast = schema.ast
        deepStrictEqual(SchemaAST.collectSentinels(ast), undefined)
      })
    })

    describe("Tuple", () => {
      it("required element", () => {
        const schema = Schema.Tuple([Schema.Literal("a"), Schema.Number])
        const ast = schema.ast
        deepStrictEqual(SchemaAST.collectSentinels(ast), [{ key: 0, literal: "a" }])
      })

      it("optional element", () => {
        const schema = Schema.Tuple([Schema.Number, Schema.optionalKey(Schema.Literal("a"))])
        const ast = schema.ast
        deepStrictEqual(SchemaAST.collectSentinels(ast), undefined)
      })
    })

    it("Declaration", () => {
      class A {
        readonly _tag = "A"
      }
      const schema = Schema.instanceOf(
        A,
        { "~sentinels": [{ key: "_tag", literal: "A" }] }
      )
      const ast = schema.ast
      deepStrictEqual(SchemaAST.collectSentinels(ast), [{ key: "_tag", literal: "A" }])
    })
  })

  describe("getCandidates", () => {
    it("should exclude never", () => {
      const schema = Schema.Union([Schema.String, Schema.Never])
      const ast = schema.ast
      deepStrictEqual(SchemaAST.getCandidates("a", ast.types), [ast.types[0]])
    })

    it("should exclude by type", () => {
      const schema = Schema.NullishOr(Schema.String)
      const ast = schema.ast
      deepStrictEqual(SchemaAST.getCandidates("a", ast.types), [ast.types[0]])
      deepStrictEqual(SchemaAST.getCandidates(null, ast.types), [ast.types[1]])
      deepStrictEqual(SchemaAST.getCandidates(undefined, ast.types), [ast.types[2]])
      deepStrictEqual(SchemaAST.getCandidates(1, ast.types), [])
    })

    it("should exclude by literals", () => {
      const schema = Schema.Union([
        Schema.UniqueSymbol(Symbol.for("a")),
        Schema.Literal("b"),
        Schema.String
      ])
      const ast = schema.ast
      deepStrictEqual(SchemaAST.getCandidates(Symbol.for("a"), ast.types), [ast.types[0]])
      deepStrictEqual(SchemaAST.getCandidates("b", ast.types), [ast.types[1], ast.types[2]])
      deepStrictEqual(SchemaAST.getCandidates("c", ast.types), [ast.types[2]])
      deepStrictEqual(SchemaAST.getCandidates(1, ast.types), [])
    })

    it("Literals", () => {
      const schema = Schema.Literals(["a", "b", "c"])
      const ast = schema.ast
      deepStrictEqual(SchemaAST.getCandidates("a", ast.types), [ast.types[0]])
      deepStrictEqual(SchemaAST.getCandidates("b", ast.types), [ast.types[1]])
      deepStrictEqual(SchemaAST.getCandidates("c", ast.types), [ast.types[2]])
      deepStrictEqual(SchemaAST.getCandidates("d", ast.types), [])
      deepStrictEqual(SchemaAST.getCandidates(null, ast.types), [])
      deepStrictEqual(SchemaAST.getCandidates(undefined, ast.types), [])
    })

    it("should handle tagged structs", () => {
      const schema = Schema.Union([
        Schema.Struct({ _tag: Schema.tag("a"), a: Schema.String }),
        Schema.Struct({ _tag: Schema.tag("b"), b: Schema.Number }),
        Schema.String
      ])
      const ast = schema.ast
      deepStrictEqual(SchemaAST.getCandidates({}, ast.types), [])
      deepStrictEqual(SchemaAST.getCandidates({ _tag: "a" }, ast.types), [ast.types[0]])
      deepStrictEqual(SchemaAST.getCandidates({ _tag: "b" }, ast.types), [ast.types[1]])
      deepStrictEqual(SchemaAST.getCandidates({ _tag: "c" }, ast.types), [])
      deepStrictEqual(SchemaAST.getCandidates("", ast.types), [ast.types[2]])
      deepStrictEqual(SchemaAST.getCandidates(1, ast.types), [])
    })

    it("should handle tagged tuples", () => {
      const schema = Schema.Union([
        Schema.Tuple([Schema.Literal("a"), Schema.String]),
        Schema.Tuple([Schema.Literal("b"), Schema.Number]),
        Schema.String
      ])
      const ast = schema.ast
      deepStrictEqual(SchemaAST.getCandidates([], ast.types), [])
      deepStrictEqual(SchemaAST.getCandidates(["a"], ast.types), [ast.types[0]])
      deepStrictEqual(SchemaAST.getCandidates(["b"], ast.types), [ast.types[1]])
      deepStrictEqual(SchemaAST.getCandidates(["c"], ast.types), [])
      deepStrictEqual(SchemaAST.getCandidates("", ast.types), [ast.types[2]])
      deepStrictEqual(SchemaAST.getCandidates(1, ast.types), [])
    })
  })

  describe("getExpected", () => {
    it("Objects", () => {
      const schema = Schema.Union([
        Schema.Struct({ _tag: Schema.Literal("a") }),
        Schema.Struct({ _tag: Schema.optionalKey(Schema.Literal("b")) }),
        Schema.Struct({ _tag: Schema.mutableKey(Schema.Literal("c")) }),
        Schema.Struct({ _tag: Schema.optionalKey(Schema.mutableKey(Schema.Literal("d"))) })
      ])
      const ast = schema.ast
      deepStrictEqual(
        ast.getExpected(SchemaAnnotations.getExpected),
        `{ readonly "_tag": "a", ... } | { readonly "_tag"?: "b", ... } | { "_tag": "c", ... } | { "_tag"?: "d", ... }`
      )
    })

    it("Arrays", () => {
      const schema = Schema.Union([
        Schema.Tuple([Schema.Literal("a")]),
        Schema.Tuple([Schema.optionalKey(Schema.Literal("b"))]),
        Schema.mutable(Schema.Tuple([Schema.Literal("c")])),
        Schema.mutable(Schema.Tuple([Schema.optionalKey(Schema.Literal("d"))]))
      ])
      const ast = schema.ast
      deepStrictEqual(
        ast.getExpected(SchemaAnnotations.getExpected),
        `readonly [ "a", ... ] | readonly [ "b"?, ... ] | [ "c", ... ] | [ "d"?, ... ]`
      )
    })
  })
})
