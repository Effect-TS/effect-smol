import { AST, MetaAST } from "effect/schema"
import { describe, it } from "vitest"
import { strictEqual } from "../utils/assert.ts"

describe("MetaAST", () => {
  it("format", () => {
    strictEqual(
      AST.format(MetaAST.AST.ast),
      "Declaration | NullKeyword | UndefinedKeyword | VoidKeyword | NeverKeyword | UnknownKeyword | AnyKeyword | StringKeyword | NumberKeyword | BooleanKeyword | BigIntKeyword | SymbolKeyword | LiteralType | UniqueSymbol | ObjectKeyword | Enums | TemplateLiteral | TupleType | TypeLiteral | UnionType | Suspend"
    )
  })
})
