/**
 * @since 4.0.0
 */

import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Effect from "../Effect.ts"
import { memoize } from "../Function.ts"
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

const goJson = memoize((ast: AST.AST): AST.AST => {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links[links.length - 1]
    const to = goJson(last.to)
    return to === last.to
      ? ast
      : AST.replaceEncoding(ast, AST.replaceLastLink(links, new AST.Link(to, last.transformation)))
  }
  function go(ast: AST.AST): AST.AST {
    switch (ast._tag) {
      case "Declaration": {
        const getLink = ast.annotations?.defaultJsonSerializer ?? ast.annotations?.defaultIsoSerializer
        if (Predicate.isFunction(getLink)) {
          const link = getLink(ast.typeParameters.map((tp) => Schema.make(goJson(AST.encodedAST(tp)))))
          const to = goJson(link.to)
          return AST.replaceEncoding(ast, to === link.to ? [link] : [new AST.Link(to, link.transformation)])
        } else {
          return requiredJsonSerializerAnnotation(ast)
        }
      }
      case "VoidKeyword":
      case "UndefinedKeyword":
        return AST.replaceEncoding(ast, [undefinedLink])
      case "SymbolKeyword":
      case "UniqueSymbol":
        return AST.replaceEncoding(ast, [symbolLink])
      case "BigIntKeyword":
        return AST.coerceBigInt(ast)
      case "LiteralType": {
        if (Predicate.isBigInt(ast.literal)) {
          return AST.coerceLiteral(ast)
        }
        return ast
      }
      case "TypeLiteral": {
        if (ast.propertySignatures.some((ps) => !Predicate.isString(ps.name))) {
          return forbidden(ast, "cannot serialize to JSON, TypeLiteral property names must be strings")
        }
        return ast.go(goJson)
      }
      case "TupleType":
      case "UnionType":
      case "Suspend":
        return ast.go(goJson)
      case "UnknownKeyword":
      case "ObjectKeyword":
      case "NeverKeyword":
        return requiredJsonSerializerAnnotation(ast)
    }
    return ast
  }
  const out = go(ast)
  return AST.isOptional(ast) ? AST.optionalKey(out) : out
})

function requiredJsonSerializerAnnotation(ast: AST.AST): AST.AST {
  return forbidden(
    ast,
    `cannot serialize to JSON, required \`defaultJsonSerializer\` or \`defaultIsoSerializer\` annotation for ${ast._tag}`
  )
}

function forbidden<A extends AST.AST>(ast: A, message: string): A {
  const link = new AST.Link(
    AST.neverKeyword,
    new Transformation.Transformation(
      Getter.passthrough(),
      Getter.forbidden(() => message)
    )
  )
  return AST.replaceEncoding(ast, [link])
}

const undefinedLink = new AST.Link(
  AST.nullKeyword,
  new Transformation.Transformation(
    Getter.transform(() => undefined),
    Getter.transform(() => null)
  )
)

const SYMBOL_PATTERN = /^Symbol\((.*)\)$/

// to distinguish between Symbol and String, we need to add a check to the string keyword
const symbolLink = new AST.Link(
  AST.appendChecks(AST.stringKeyword, [Check.regex(SYMBOL_PATTERN, { title: "a string representing a symbol" })]),
  new Transformation.Transformation(
    Getter.transform((description) => Symbol.for(SYMBOL_PATTERN.exec(description)![1])),
    Getter.transformOrFail((sym: symbol) => {
      const description = sym.description
      if (description !== undefined) {
        if (Symbol.for(description) === sym) {
          return Effect.succeed(String(sym))
        }
        return Effect.fail(
          new Issue.Forbidden(Option.some(sym), { message: "cannot serialize to string, Symbol is not registered" })
        )
      }
      return Effect.fail(
        new Issue.Forbidden(Option.some(sym), { message: "cannot serialize to string, Symbol has no description" })
      )
    })
  )
)

/**
 * @since 4.0.0
 */
export function iso<S extends Schema.Top>(schema: S): Schema.Codec<S["Type"], S["Iso"]> {
  return Schema.make<Schema.Codec<S["Type"], S["Iso"]>>(goIso(AST.typeAST(schema.ast)))
}

const goIso = memoize((ast: AST.AST): AST.AST => {
  function go(ast: AST.AST): AST.AST {
    switch (ast._tag) {
      case "Declaration": {
        const getLink = ast.annotations?.defaultIsoSerializer
        if (Predicate.isFunction(getLink)) {
          const link = getLink(ast.typeParameters.map((tp) => Schema.make(goIso(AST.encodedAST(tp)))))
          const to = goIso(link.to)
          return AST.replaceEncoding(ast, to === link.to ? [link] : [new AST.Link(to, link.transformation)])
        }
        return ast
      }
      case "TupleType":
      case "TypeLiteral":
      case "UnionType":
      case "Suspend":
        return ast.go(goIso)
    }
    return ast
  }
  const out = go(ast)
  return AST.isOptional(ast) ? AST.optionalKey(out) : out
})

/**
 * @since 4.0.0
 */
export type StringPojo = string | undefined | { [x: string]: StringPojo } | Array<StringPojo>

/**
 * @since 4.0.0
 */
export function stringPojo<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): Schema.Codec<T, StringPojo, RD, RE> {
  return Schema.make<Schema.Codec<T, StringPojo, RD, RE>>(goStringPojo(codec.ast))
}

/** @internal */
export const goStringPojo = memoize((ast: AST.AST): AST.AST => {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links[links.length - 1]
    const to = goStringPojo(last.to)
    return to === last.to ?
      ast :
      AST.replaceEncoding(ast, AST.replaceLastLink(links, new AST.Link(to, last.transformation)))
  }
  function go(ast: AST.AST): AST.AST {
    switch (ast._tag) {
      case "Declaration": {
        const getLink = ast.annotations?.defaultIsoSerializer ?? ast.annotations?.defaultJsonSerializer
        if (Predicate.isFunction(getLink)) {
          const link = getLink(ast.typeParameters.map((tp) => Schema.make(goIso(AST.encodedAST(tp)))))
          const to = goStringPojo(link.to)
          return AST.replaceEncoding(ast, to === link.to ? [link] : [new AST.Link(to, link.transformation)])
        }
        return ast
      }
      case "NullKeyword":
      case "NumberKeyword":
      case "BooleanKeyword":
      case "BigIntKeyword":
      case "LiteralType":
      case "Enums":
        return ast.goStringPojo()
      case "TupleType":
      case "TypeLiteral":
      case "UnionType":
      case "Suspend":
        return ast.go(goStringPojo)
    }
    return ast
  }
  const out = go(ast)
  return AST.isOptional(ast) ? AST.optionalKey(out) : out
})

/**
 * @since 4.0.0
 */
export function ensureArray<T, RD, RE>(
  codec: Schema.Codec<T, StringPojo, RD, RE>
): Schema.Codec<T, StringPojo, RD, RE> {
  return Schema.make<Schema.Codec<T, StringPojo, RD, RE>>(goEnsureArray(codec.ast))
}

const ENSURE_ARRAY_ANNOTATION_KEY = "~effect/schema/Serializer/ensureArray"

/** @internal */
export const goEnsureArray = memoize((ast: AST.AST): AST.AST => {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links[links.length - 1]
    const to = goEnsureArray(last.to)
    if (to === last.to) {
      return ast
    }
    return AST.replaceEncoding(ast, AST.replaceLastLink(links, new AST.Link(to, last.transformation)))
  }
  if (AST.isUnionType(ast) && ast.annotations?.[ENSURE_ARRAY_ANNOTATION_KEY]) {
    return ast
  }
  const out: AST.AST = (ast as any).go?.(goEnsureArray) ?? ast
  if (AST.isTupleType(out)) {
    const ensure = new AST.UnionType(
      [
        out,
        AST.decodeTo(
          AST.stringKeyword,
          out,
          new Transformation.Transformation(
            Getter.split(),
            Getter.passthrough()
          )
        )
      ],
      "anyOf",
      { [ENSURE_ARRAY_ANNOTATION_KEY]: true }
    )
    return out.context?.isOptional ? AST.optionalKey(ensure) : ensure
  }
  return out
})
