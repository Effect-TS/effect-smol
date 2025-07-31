/**
 * @since 4.0.0
 */

import * as Arr from "../collections/Array.ts"
import * as AST from "./AST.ts"
import * as Schema from "./Schema.ts"

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
    return AST.replaceEncoding(ast, Arr.append(links.slice(0, links.length - 1), new AST.Link(to, last.transformation)))
  }
  const out: any = ast
  return out.goJson?.(goJson, Schema.make) ?? out.go?.(goJson) ?? AST.forbidden(ast)
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
