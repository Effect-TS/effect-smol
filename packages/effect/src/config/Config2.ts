/**
 * @since 4.0.0
 */

import * as Effect from "../Effect.ts"
import * as AST from "../schema/AST.ts"
import * as Schema from "../schema/Schema.ts"
import * as Serializer from "../schema/Serializer.ts"
import * as ToParser from "../schema/ToParser.ts"
import type { ConfigProvider, Path, StringLeafJson } from "./ConfigProvider2.ts"
import { GetError } from "./ConfigProvider2.ts"

export interface Config<out T> {
  readonly parse: (provider: ConfigProvider) => Effect.Effect<T, GetError | Schema.SchemaError>
}

const dump: (
  provider: ConfigProvider,
  path: Path
) => Effect.Effect<StringLeafJson | undefined, GetError> = Effect.fnUntraced(function*(
  provider,
  path
) {
  const node = yield* provider.get(path)
  if (node === undefined) return undefined
  switch (node._tag) {
    case "leaf":
      return node.value
    case "object": {
      const out: Record<string, StringLeafJson> = {}
      for (const key of node.keys) {
        const child = yield* dump(provider, [...path, key])
        if (child !== undefined) out[key] = child
      }
      return out
    }
    case "array": {
      const out: Array<StringLeafJson> = []
      for (let i = 0; i < node.length; i++) {
        const child = yield* dump(provider, [...path, i])
        if (child !== undefined) out.push(child)
      }
      return out
    }
  }
})

const go: (
  ast: AST.AST,
  provider: ConfigProvider,
  path: Path
) => Effect.Effect<StringLeafJson | undefined, Schema.SchemaError | GetError> = Effect.fnUntraced(
  function*(ast, provider, path) {
    switch (ast._tag) {
      case "TypeLiteral": {
        const out: Record<string, StringLeafJson> = {}
        for (const ps of ast.propertySignatures) {
          const name = ps.name
          if (typeof name === "string") {
            const value = yield* go(ps.type, provider, [...path, name])
            if (value !== undefined) out[name] = value
          }
        }
        if (ast.indexSignatures.length > 0) {
          const node = yield* provider.get(path)
          if (node && node._tag === "object") {
            for (const is of ast.indexSignatures) {
              const matches = ToParser.refinement(is.parameter)
              for (const key of node.keys) {
                if (!Object.prototype.hasOwnProperty.call(out, key) && matches(key)) {
                  const value = yield* go(is.type, provider, [...path, key])
                  if (value !== undefined) out[key] = value
                }
              }
            }
          }
        }
        return out
      }
      case "TupleType": {
        if (ast.rest.length > 0) return yield* dump(provider, path)
        const out: Array<StringLeafJson> = []
        for (let i = 0; i < ast.elements.length; i++) {
          const value = yield* go(ast.elements[i], provider, [...path, i])
          if (value !== undefined) out.push(value)
        }
        return out
      }
      case "UnionType":
        return yield* dump(provider, path)
      case "Suspend":
        return yield* go(ast.thunk(), provider, path)
      default: {
        const node = yield* provider.get(path)
        if (node === undefined) return undefined
        if (node._tag === "leaf") return node.value
        return yield* Effect.fail(new GetError({ reason: "Expected a leaf, but received a container" }))
      }
    }
  }
)

export function make<T, E>(codec: Schema.Codec<T, E>): Config<T> {
  const serializer = Serializer.stringLeafJson(codec)
  const decodeUnknownEffect = Schema.decodeUnknownEffect(serializer)
  const serializerEncodedAST = AST.encodedAST(serializer.ast)
  return {
    parse(provider: ConfigProvider): Effect.Effect<T, GetError | Schema.SchemaError> {
      return go(serializerEncodedAST, provider, []).pipe(Effect.flatMap(decodeUnknownEffect))
    }
  }
}
