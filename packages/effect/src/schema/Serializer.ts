/**
 * @since 4.0.0
 */

import * as Arr from "../collections/Array.ts"
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Effect from "../Effect.ts"
import * as AST from "./AST.ts"
import * as Check from "./Check.ts"
import * as Getter from "./Getter.ts"
import * as Issue from "./Issue.ts"
import * as Schema from "./Schema.ts"
import * as Transformation from "./Transformation.ts"

/**
 * For use cases like RPC or messaging systems, the JSON format only needs to
 * support round-trip encoding and decoding. The `Serializer.json` operator
 * helps with this by taking a schema and returning a `Codec` that knows how to
 * serialize and deserialize the data using a JSON-compatible format.
 *
 * @since 4.0.0
 */
export function json<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): Schema.Codec<T, unknown, RD, RE> {
  return Schema.make<Schema.Codec<T, unknown, RD, RE>>(goJson(codec.ast))
}

const goJson = AST.memoize((ast: AST.AST): AST.AST => {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links[links.length - 1]
    const to = goJson(last.to)
    if (to === last.to) {
      return ast
    }
    return AST.replaceEncoding(
      ast,
      Arr.append(
        links.slice(0, links.length - 1),
        new AST.Link(to, last.transformation)
      )
    )
  }
  switch (ast._tag) {
    case "Declaration": {
      const defaultJsonSerializer = ast.annotations?.defaultJsonSerializer
      if (Predicate.isFunction(defaultJsonSerializer)) {
        const link = defaultJsonSerializer(ast.typeParameters.map((tp) => Schema.make(goJson(AST.encodedAST(tp)))))
        const to = goJson(link.to)
        if (to === link.to) {
          return AST.replaceEncoding(ast, [link])
        } else {
          return AST.replaceEncoding(ast, [new AST.Link(to, link.transformation)])
        }
      } else {
        return AST.replaceEncoding(ast, [jsonForbiddenLink])
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
      return AST.replaceEncoding(ast, [jsonForbiddenLink])
    case "TypeLiteral": {
      const propertySignatures = AST.mapOrSame(
        ast.propertySignatures,
        (ps) => {
          const type = goJson(ps.type)
          if (type === ps.type) {
            return ps
          }
          return new AST.PropertySignature(ps.name, type)
        }
      )
      const indexSignatures = AST.mapOrSame(
        ast.indexSignatures,
        (is) => {
          const parameter = goJson(is.parameter)
          const type = goJson(is.type)
          if (parameter === is.parameter && type === is.type) {
            return is
          }
          return new AST.IndexSignature(is.isMutable, parameter, type, is.merge)
        }
      )
      if (propertySignatures === ast.propertySignatures && indexSignatures === ast.indexSignatures) {
        return ast
      }
      return new AST.TypeLiteral(
        propertySignatures,
        indexSignatures,
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
    }
    case "TupleType": {
      const elements = AST.mapOrSame(ast.elements, goJson)
      const rest = AST.mapOrSame(ast.rest, goJson)
      if (elements === ast.elements && rest === ast.rest) {
        return ast
      }
      return new AST.TupleType(ast.isMutable, elements, rest, ast.annotations, ast.checks, undefined, ast.context)
    }
    case "UnionType": {
      const types = AST.mapOrSame(ast.types, goJson)
      if (types === ast.types) {
        return ast
      }
      return new AST.UnionType(types, ast.mode, ast.annotations, ast.checks, undefined, ast.context)
    }
    case "Suspend":
      return new AST.Suspend(
        () => goJson(ast.thunk()),
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
  }
})

const jsonForbiddenLink = new AST.Link(
  AST.neverKeyword,
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
            description: "cannot serialize to string, Symbol is not registered"
          })
        )
      }
      return Effect.fail(
        new Issue.Forbidden(Option.some(sym), {
          description: "cannot serialize to string, Symbol has no description"
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

/**
 * A subtype of `Json` whose leaves are always strings.
 *
 * @since 4.0.0
 */
export type StringLeafJson = string | { [x: PropertyKey]: StringLeafJson } | Array<StringLeafJson>

/**
 * The `stringLeafJson` serializer is a wrapper around the `json` serializer. It
 * uses the `json` serializer to encode the value, and then converts the result
 * to a `StringLeafJson` tree by handling numbers, booleans, and nulls.
 *
 * @since 4.0.0
 */
export function stringLeafJson<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): Schema.Codec<T, StringLeafJson, RD, RE> {
  return Schema.make<Schema.Codec<T, StringLeafJson, RD, RE>>(goStringLeafJson(goJson(codec.ast)))
}

const stringNumber = AST.appendChecks(AST.stringKeyword, [
  Check.regex(new RegExp(AST.NUMBER_KEYWORD_PATTERN))
])

const numberFromString = new Transformation.Transformation(
  Getter.parseFloat(),
  Getter.String()
)

const stringBoolean = new AST.UnionType([new AST.LiteralType("true"), new AST.LiteralType("false")], "anyOf")

const booleanFromString = new Transformation.Transformation(
  Getter.map((s) => s === "true"),
  Getter.String()
)

const stringNull = new AST.LiteralType("")

const nullFromEmptyString = Transformation.transform({
  decode: () => null,
  encode: () => stringNull.literal
})

const goStringLeafJson = AST.memoize((ast: AST.AST): AST.AST => {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links[links.length - 1]
    const to = goStringLeafJson(last.to)
    if (to === last.to) {
      return ast
    }
    return AST.replaceEncoding(
      ast,
      Arr.append(
        links.slice(0, links.length - 1),
        new AST.Link(to, last.transformation)
      )
    )
  }
  switch (ast._tag) {
    case "StringKeyword":
      return ast
    case "NumberKeyword":
      return AST.decodeTo(stringNumber, ast, numberFromString)
    case "BooleanKeyword":
      return AST.decodeTo(stringBoolean, ast, booleanFromString)
    case "NullKeyword":
      return AST.decodeTo(stringNull, ast, nullFromEmptyString)
    case "TypeLiteral": {
      const propertySignatures = AST.mapOrSame(
        ast.propertySignatures,
        (ps) => {
          const type = goStringLeafJson(ps.type)
          if (type === ps.type) {
            return ps
          }
          return new AST.PropertySignature(ps.name, type)
        }
      )
      const indexSignatures = AST.mapOrSame(
        ast.indexSignatures,
        (is) => {
          const parameter = goStringLeafJson(is.parameter)
          const type = goStringLeafJson(is.type)
          if (parameter === is.parameter && type === is.type) {
            return is
          }
          return new AST.IndexSignature(is.isMutable, parameter, type, is.merge)
        }
      )
      if (propertySignatures === ast.propertySignatures && indexSignatures === ast.indexSignatures) {
        return ast
      }
      return new AST.TypeLiteral(
        propertySignatures,
        indexSignatures,
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
    }
    case "TupleType": {
      const elements = AST.mapOrSame(ast.elements, goStringLeafJson)
      const rest = AST.mapOrSame(ast.rest, goStringLeafJson)
      if (elements === ast.elements && rest === ast.rest) {
        return ast
      }
      return new AST.TupleType(ast.isMutable, elements, rest, ast.annotations, ast.checks, undefined, ast.context)
    }
    case "UnionType": {
      const types = AST.mapOrSame(ast.types, goStringLeafJson)
      if (types === ast.types) {
        return ast
      }
      return new AST.UnionType(types, ast.mode, ast.annotations, ast.checks, undefined, ast.context)
    }
    case "Suspend":
      return new AST.Suspend(
        () => goStringLeafJson(ast.thunk()),
        ast.annotations,
        ast.checks,
        undefined,
        ast.context
      )
    default:
      throw new Error("BUG: unreachable")
  }
})
