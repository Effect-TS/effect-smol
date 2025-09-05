/**
 * @since 4.0.0
 */

import * as Predicate from "../data/Predicate.ts"
import * as AST from "./AST.ts"
import * as Getter from "./Getter.ts"
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
    const last = links.at(-1)!
    const to = goJson(last.to)
    if (to === last.to) {
      return ast
    }
    return AST.replaceEncoding(ast, AST.replaceLastLink(links, new AST.Link(to, last.transformation)))
  }
  if (AST.isTypeLiteral(ast) && ast.propertySignatures.some((ps) => !Predicate.isString(ps.name))) {
    return AST.forbidden(ast, "cannot serialize to JSON, property names must be strings")
  }
  const out = (ast as any).goJson?.(goJson, Schema.make) ?? (ast as any).go?.(goJson) ??
    AST.requiredDefaultJsonSerializerAnnotation(ast)
  return AST.isOptional(ast) ? AST.optionalKey(out) : out
})

/**
 * A subtype of `Json` whose leaves are always strings (or `undefined`).
 *
 * @since 4.0.0
 */
export type StringLeafJson = string | undefined | { [x: string]: StringLeafJson } | Array<StringLeafJson>

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

/**
 * @since 4.0.0
 */
export function ensureArray<T, RD, RE>(
  codec: Schema.Codec<T, StringLeafJson, RD, RE>
): Schema.Codec<T, StringLeafJson, RD, RE> {
  return Schema.make<Schema.Codec<T, StringLeafJson, RD, RE>>(goEnsureArray(codec.ast))
}

/** @internal */
export const goEnsureArray = AST.memoize((ast: AST.AST): AST.AST => {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links.at(-1)!
    const to = goEnsureArray(last.to)
    if (to === last.to) {
      return ast
    }
    return AST.replaceEncoding(ast, AST.replaceLastLink(links, new AST.Link(to, last.transformation)))
  }
  if (AST.isUnionType(ast) && ast.annotations?.["~effect/schema/AST/ensureArray"]) {
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
      { "~effect/schema/AST/ensureArray": true }
    )
    return out.context?.isOptional ? AST.optionalKey(ensure) : ensure
  }
  return out
})
