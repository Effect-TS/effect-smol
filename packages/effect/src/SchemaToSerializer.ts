/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import * as Option from "./Option.js"
import * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaParser from "./SchemaParser.js"
import * as SchemaResult from "./SchemaResult.js"
import * as SchemaTransformation from "./SchemaTransformation.js"

/**
 * @category Model
 * @since 4.0.0
 */
export type Json = unknown

/**
 * @since 4.0.0
 */
export function make<T, E, RD = never, RE = never, RI = never>(
  codec: Schema.Codec<T, E, RD, RE, RI>
): Schema.Codec<T, Json, RD, RE, RI> {
  return Schema.make<Schema.Codec<T, Json, RD, RE, RI>>(go(codec.ast))
}

const go = SchemaAST.memoize((ast: SchemaAST.AST): SchemaAST.AST => {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links[links.length - 1]
    return SchemaAST.replaceEncoding(
      ast,
      Arr.append(
        links.slice(0, links.length - 1),
        new SchemaAST.Link(last.transformation, go(last.to))
      )
    )
  }
  switch (ast._tag) {
    case "Declaration": {
      const annotation: any = ast.annotations?.serializer
      if (annotation !== undefined) {
        const link = annotation(ast.typeParameters.map((tp) => Schema.make(go(SchemaAST.encodedAST(tp)))))
        return SchemaAST.replaceEncoding(ast, [link])
      } else {
        return SchemaAST.replaceEncoding(ast, [forbiddenLink])
      }
    }
    case "LiteralType":
    case "NullKeyword":
    case "StringKeyword":
    case "NumberKeyword":
    case "BooleanKeyword":
      return ast
    case "UniqueSymbol":
    case "SymbolKeyword":
      return SchemaAST.replaceEncoding(ast, [symbolLink])
    case "BigIntKeyword":
      return SchemaAST.replaceEncoding(ast, [bigIntLink])
    case "NeverKeyword":
    case "AnyKeyword":
    case "UnknownKeyword":
    case "UndefinedKeyword":
    case "VoidKeyword":
    case "ObjectKeyword":
      return SchemaAST.replaceEncoding(ast, [forbiddenLink])
    case "TypeLiteral": {
      return new SchemaAST.TypeLiteral(
        ast.propertySignatures.map((ps) => new SchemaAST.PropertySignature(ps.name, go(ps.type))),
        ast.indexSignatures.map((is) => new SchemaAST.IndexSignature(go(is.parameter), go(is.type), is.merge)),
        ast.annotations,
        ast.modifiers,
        undefined,
        ast.context
      )
    }
    case "TupleType":
      return new SchemaAST.TupleType(
        ast.isReadonly,
        ast.elements.map(go),
        ast.rest.map(go),
        ast.annotations,
        ast.modifiers,
        undefined,
        ast.context
      )
    case "UnionType":
      return new SchemaAST.UnionType(
        ast.types.map(go),
        ast.annotations,
        ast.modifiers,
        undefined,
        ast.context
      )
    case "Suspend":
      return new SchemaAST.Suspend(
        () => go(ast.thunk()),
        ast.annotations,
        ast.modifiers,
        undefined,
        ast.context
      )
  }
  ast satisfies never // TODO: remove this
})

const forbiddenLink = new SchemaAST.Link(
  SchemaTransformation.fail("cannot serialize to JSON, required `serializer` annotation", {
    title: "required annotation"
  }),
  SchemaAST.unknownKeyword
)

const symbolLink = new SchemaAST.Link(
  new SchemaTransformation.Transformation(
    SchemaParser.lift(Symbol.for),
    SchemaParser.onSome((sym: symbol) => {
      const description = sym.description
      if (description !== undefined) {
        if (Symbol.for(description) === sym) {
          return SchemaResult.succeed(Option.some(description))
        }
        return SchemaResult.fail(new SchemaIssue.ForbiddenIssue(Option.some(sym), "Symbol is not registered"))
      }
      return SchemaResult.fail(new SchemaIssue.ForbiddenIssue(Option.some(sym), "Symbol has no description"))
    }, { title: "symbol encoding" })
  ),
  SchemaAST.stringKeyword
)

const bigIntLink = new SchemaAST.Link(
  new SchemaTransformation.Transformation(SchemaParser.lift(BigInt), SchemaParser.String),
  SchemaAST.stringKeyword
)
