import { Annotations, AST, Schema } from "effect/schema"
import { describe, it } from "vitest"
import { assertGetter, deepStrictEqual, strictEqual } from "../utils/assert.ts"

describe("AST", () => {
  describe("annotate", () => {
    it("should keep getters", () => {
      const schema = Schema.String.annotate({
        get title() {
          return "value"
        }
      })
      const annotations = schema.ast.annotations
      assertGetter(annotations, "title", "value")
    })

    it("should preserve existing getters when merging", () => {
      const schema = Schema.String
        .annotate({
          a: "a",
          get b() {
            return "b"
          },
          get c() {
            return "c"
          }
        })
        .annotate({
          get c() {
            return "c2"
          },
          get d() {
            return "d"
          }
        })

      const annotations = schema.ast.annotations
      strictEqual(annotations?.a, "a")
      assertGetter(annotations, "b", "b")
      assertGetter(annotations, "c", "c2")
      assertGetter(annotations, "d", "d")
    })
  })

  describe("annotateKey", () => {
    it("should keep getters", () => {
      const schema = Schema.String.annotateKey({
        get title() {
          return "value"
        }
      })
      const annotations = schema.ast.context?.annotations
      assertGetter(annotations, "title", "value")
    })

    it("should preserve existing getters when merging", () => {
      const schema = Schema.String
        .annotateKey({
          a: "a",
          get b() {
            return "b"
          },
          get c() {
            return "c"
          }
        })
        .annotateKey({
          get c() {
            return "c2"
          },
          get d() {
            return "d"
          }
        })

      const annotations = schema.ast.context?.annotations
      strictEqual(annotations?.a, "a")
      assertGetter(annotations, "b", "b")
      assertGetter(annotations, "c", "c2")
      assertGetter(annotations, "d", "d")
    })
  })

  describe("collectSentinels", () => {
    describe("Declaration", () => {
      it("~sentinels", () => {
        class A {
          readonly _tag = "A"
        }
        const schema = Schema.instanceOf(A, { "~sentinels": [{ key: "_tag", literal: "A" }] })
        const ast = schema.ast
        deepStrictEqual(AST.collectSentinels(ast), [{ key: "_tag", literal: "A" }])
      })
    })

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
      const schema = Schema.instanceOf(
        A,
        { "~sentinels": [{ key: "_tag", literal: "A" }] }
      )
      const ast = schema.ast
      deepStrictEqual(AST.collectSentinels(ast), [{ key: "_tag", literal: "A" }])
    })
  })

  describe("getCandidates", () => {
    it("should exclude never", () => {
      const schema = Schema.Union([Schema.String, Schema.Never])
      const ast = schema.ast
      deepStrictEqual(AST.getCandidates("a", ast.types), [ast.types[0]])
    })

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
        ast.getExpected(Annotations.getExpected),
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
        ast.getExpected(Annotations.getExpected),
        `readonly [ "a", ... ] | readonly [ "b"?, ... ] | [ "c", ... ] | [ "d"?, ... ]`
      )
    })
  })
})
