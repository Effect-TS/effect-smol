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

const SYMBOL_PATTERN = /^Symbol\((.*)\)$/

// to distinguish between Symbol and String, we need to add a check to the string keyword
const symbolLink = new AST.Link(
  AST.appendChecks(AST.stringKeyword, [Check.regex(SYMBOL_PATTERN)]),
  new Transformation.Transformation(
    Getter.map((description) => Symbol.for(SYMBOL_PATTERN.exec(description)![1])),
    Getter.mapOrFail((sym: symbol) => {
      const description = sym.description
      if (description !== undefined) {
        if (Symbol.for(description) === sym) {
          return Effect.succeed(String(sym))
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

function coerceSymbol<A extends AST.SymbolKeyword | AST.UniqueSymbol>(ast: A): A {
  return AST.replaceEncoding(ast, [symbolLink])
}

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

function forbidden(ast: AST.AST): AST.AST {
  return AST.replaceEncoding(ast, [jsonForbiddenLink])
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
        return forbidden(ast)
      }
    }
    case "LiteralType": {
      if (Predicate.isBigInt(ast.literal)) {
        return AST.coerceBigInt(ast)
      }
      return ast
    }
    case "NullKeyword":
    case "StringKeyword":
    case "NumberKeyword":
    case "BooleanKeyword":
    case "TemplateLiteral":
    case "Enums":
      return ast
    case "UniqueSymbol":
    case "SymbolKeyword":
      return coerceSymbol(ast)
    case "BigIntKeyword":
      return AST.coerceBigInt(ast)
    case "NeverKeyword":
    case "AnyKeyword":
    case "UnknownKeyword":
    case "UndefinedKeyword":
    case "VoidKeyword":
    case "ObjectKeyword":
      return forbidden(ast)
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
  return Schema.make<Schema.Codec<T, StringLeafJson, RD, RE>>(AST.goStringLeafJson(goJson(codec.ast)))
}
