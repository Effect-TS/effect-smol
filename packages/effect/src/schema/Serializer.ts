/**
 * @since 4.0.0
 */

import * as Arr from "../Array.js"
import * as Effect from "../Effect.js"
import * as Option from "../Option.js"
import * as Predicate from "../Predicate.js"
import * as AST from "./AST.js"
import * as Getter from "./Getter.js"
import * as Issue from "./Issue.js"
import * as Schema from "./Schema.js"
import * as Transformation from "./Transformation.js"

/**
 * @since 4.0.0
 */
export function json<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): Schema.Codec<T, unknown, RD, RE> {
  return Schema.make<Schema.Codec<T, unknown, RD, RE>>(go(codec.ast))
}

const go = AST.memoize((ast: AST.AST): AST.AST => {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links[links.length - 1]
    return AST.replaceEncoding(
      ast,
      Arr.append(
        links.slice(0, links.length - 1),
        new AST.Link(go(last.to), last.transformation)
      )
    )
  }
  switch (ast._tag) {
    case "Declaration": {
      const defaultJsonSerializer = ast.annotations?.defaultJsonSerializer
      if (Predicate.isFunction(defaultJsonSerializer)) {
        const link = defaultJsonSerializer(ast.typeParameters.map((tp) => Schema.make(go(AST.encodedAST(tp)))))
        return AST.replaceEncoding(ast, [link])
      } else {
        return AST.replaceEncoding(ast, [forbiddenLink])
      }
    }
    case "LiteralType":
    case "NullKeyword":
    case "StringKeyword":
    case "NumberKeyword":
    case "BooleanKeyword":
    case "TemplateLiteral":
    case "Enums":
      return ast
    case "UniqueSymbol":
    case "SymbolKeyword":
      return AST.replaceEncoding(ast, [symbolLink])
    case "BigIntKeyword":
      return AST.replaceEncoding(ast, [bigIntLink])
    case "NeverKeyword":
    case "AnyKeyword":
    case "UnknownKeyword":
    case "UndefinedKeyword":
    case "VoidKeyword":
    case "ObjectKeyword":
      return AST.replaceEncoding(ast, [forbiddenLink])
    case "TypeLiteral": {
      return new AST.TypeLiteral(
        ast.propertySignatures.map((ps) => new AST.PropertySignature(ps.name, go(ps.type))),
        ast.indexSignatures.map((is) => new AST.IndexSignature(is.isMutable, go(is.parameter), go(is.type), is.merge)),
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
    }
    case "TupleType":
      return new AST.TupleType(
        ast.isMutable,
        ast.elements.map(go),
        ast.rest.map(go),
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
    case "UnionType":
      return new AST.UnionType(
        ast.types.map(go),
        ast.mode,
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
    case "Suspend":
      return new AST.Suspend(
        () => go(ast.thunk()),
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
  }
})

const forbiddenLink = new AST.Link(
  AST.annotate(AST.unknownKeyword, { title: "JSON value" }),
  new Transformation.Transformation(
    Getter.passthrough(),
    Getter.fail(
      (o) =>
        new Issue.Forbidden(o, {
          description: "cannot serialize to JSON, required `defaultJsonSerializer` annotation"
        })
    )
  )
)

const symbolLink = new AST.Link(
  AST.stringKeyword,
  new Transformation.Transformation(
    Getter.map(Symbol.for),
    Getter.mapOrFail((sym: symbol) => {
      const description = sym.description
      if (description !== undefined) {
        if (Symbol.for(description) === sym) {
          return Effect.succeed(description)
        }
        return Effect.fail(
          new Issue.Forbidden(Option.some(sym), {
            description: "cannot serialize to JSON, Symbol is not registered"
          })
        )
      }
      return Effect.fail(
        new Issue.Forbidden(Option.some(sym), {
          description: "cannot serialize to JSON, Symbol has no description"
        })
      )
    })
  )
)

const bigIntLink = new AST.Link(
  AST.stringKeyword,
  new Transformation.Transformation(
    Getter.map(BigInt),
    Getter.String()
  )
)
