/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import * as Option from "./Option.js"
import * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"
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
export function serializer<T, E, RD = never, RE = never, RI = never>(
  codec: Schema.Codec<T, E, RD, RE, RI>
): Schema.Codec<T, Json, RD, RE, RI> {
  return Schema.make<Schema.Codec<T, Json, RD, RE, RI>>(go(codec.ast))
}

const go = SchemaAST.memoize((ast: SchemaAST.AST): SchemaAST.AST => {
  if (ast.encoding) {
    const links = ast.encoding.links
    const last = links[links.length - 1]
    return SchemaAST.replaceEncoding(
      ast,
      new SchemaAST.Encoding(
        Arr.append(
          links.slice(0, links.length - 1),
          new SchemaAST.Link(last.transformation, go(last.to))
        )
      )
    )
  }
  switch (ast._tag) {
    case "Declaration": {
      const annotation: any = ast.annotations?.toJson
      if (annotation !== undefined) {
        const encoding = annotation(ast.typeParameters.map((tp) => go(SchemaAST.encodedAST(tp))))
        return SchemaAST.replaceEncoding(ast, encoding)
      }
      return SchemaAST.replaceEncoding(ast, forbiddenEncoding)
    }
    case "LiteralType":
    case "NullKeyword":
    case "StringKeyword":
    case "NumberKeyword":
    case "BooleanKeyword":
      return ast
    case "SymbolKeyword":
      return SchemaAST.replaceEncoding(ast, symbolEncoding)
    case "NeverKeyword":
    case "UnknownKeyword":
    case "UndefinedKeyword":
      return SchemaAST.replaceEncoding(ast, forbiddenEncoding)
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
})

const forbiddenEncoding = new SchemaAST.Encoding([
  new SchemaAST.Link(
    SchemaTransformation.fail("cannot serialize to JSON, annotation is required"),
    SchemaAST.unknownKeyword
  )
])

const symbolEncoding = new SchemaAST.Encoding([
  new SchemaAST.Link(
    new SchemaTransformation.Transformation(
      SchemaParser.lift((s: string) => Symbol.for(s)),
      SchemaParser.onSome((sym: symbol) => {
        const description = sym.description
        if (description !== undefined) {
          if (Symbol.for(description) === sym) {
            return SchemaResult.succeed(Option.some(description))
          }
          return SchemaResult.fail(new SchemaAST.ForbiddenIssue(Option.some(sym), "Symbol is not registered"))
        }
        return SchemaResult.fail(new SchemaAST.ForbiddenIssue(Option.some(sym), "Symbol has no description"))
      }, undefined)
    ),
    SchemaAST.stringKeyword
  )
])
