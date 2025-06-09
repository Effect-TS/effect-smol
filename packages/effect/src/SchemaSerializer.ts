/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaGetter from "./SchemaGetter.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaResult from "./SchemaResult.js"
import * as SchemaTransformation from "./SchemaTransformation.js"

/**
 * @since 4.0.0
 */
export function json<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): Schema.Codec<T, unknown, RD, RE> {
  return Schema.make<Schema.Codec<T, unknown, RD, RE>>(go(codec.ast))
}

const go = SchemaAST.memoize((ast: SchemaAST.AST): SchemaAST.AST => {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links[links.length - 1]
    return SchemaAST.replaceEncoding(
      ast,
      Arr.append(
        links.slice(0, links.length - 1),
        new SchemaAST.Link(go(last.to), last.transformation)
      )
    )
  }
  switch (ast._tag) {
    case "Declaration": {
      const defaultJsonSerializer = ast.annotations?.defaultJsonSerializer
      if (Predicate.isFunction(defaultJsonSerializer)) {
        const link = defaultJsonSerializer(ast.typeParameters.map((tp) => Schema.make(go(SchemaAST.encodedAST(tp)))))
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
    case "TemplateLiteral":
    case "Enums":
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
        ast.indexSignatures.map((is) =>
          new SchemaAST.IndexSignature(is.isMutable, go(is.parameter), go(is.type), is.merge)
        ),
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
    }
    case "TupleType":
      return new SchemaAST.TupleType(
        ast.isMutable,
        ast.elements.map(go),
        ast.rest.map(go),
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
    case "UnionType":
      return new SchemaAST.UnionType(
        ast.types.map(go),
        ast.mode,
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
    case "Suspend":
      return new SchemaAST.Suspend(
        () => go(ast.thunk()),
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
  }
})

const forbiddenLink = new SchemaAST.Link(
  SchemaAST.unknownKeyword,
  new SchemaTransformation.SchemaTransformation(
    SchemaGetter.passthrough(),
    SchemaGetter.fail(
      (o) =>
        new SchemaIssue.Forbidden(o, {
          message: "cannot serialize to JSON, required `defaultJsonSerializer` annotation"
        })
    )
  )
)

const symbolLink = new SchemaAST.Link(
  SchemaAST.stringKeyword,
  new SchemaTransformation.SchemaTransformation(
    SchemaGetter.transform(Symbol.for),
    SchemaGetter.transformOrFail((sym: symbol) => {
      const description = sym.description
      if (description !== undefined) {
        if (Symbol.for(description) === sym) {
          return SchemaResult.succeed(description)
        }
        return SchemaResult.fail(
          new SchemaIssue.Forbidden(Option.some(sym), { message: "Symbol is not registered" })
        )
      }
      return SchemaResult.fail(
        new SchemaIssue.Forbidden(Option.some(sym), { message: "Symbol has no description" })
      )
    })
  )
)

const bigIntLink = new SchemaAST.Link(
  SchemaAST.stringKeyword,
  new SchemaTransformation.SchemaTransformation(
    SchemaGetter.transform(BigInt),
    SchemaGetter.String()
  )
)
