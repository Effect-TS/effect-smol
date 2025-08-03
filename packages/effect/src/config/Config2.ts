/**
 * @since 4.0.0
 */

import { hasProperty } from "../data/Predicate.ts"
import * as Effect from "../Effect.ts"
import type { Pipeable } from "../interfaces/Pipeable.ts"
import { PipeInspectableProto, YieldableProto } from "../internal/core.ts"
import * as AST from "../schema/AST.ts"
import * as Schema from "../schema/Schema.ts"
import * as Serializer from "../schema/Serializer.ts"
import * as ToParser from "../schema/ToParser.ts"
import type { GetError, Path, StringLeafJson } from "./ConfigProvider2.ts"
import * as ConfigProvider from "./ConfigProvider2.ts"

/**
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/config/Config"

/**
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = "~effect/config/Config"

/**
 * A type guard that checks if a value is a Config instance.
 *
 * This function is useful for runtime type checking to determine if an unknown value
 * is a Config before calling Config-specific methods or properties.
 *
 * @since 4.0.0
 * @category Guards
 */
export const isConfig = (u: unknown): u is Config<unknown> => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 */
export interface Config<out T> extends Pipeable, Effect.Yieldable<Config<T>, T, GetError | Schema.SchemaError> {
  readonly [TypeId]: TypeId
  readonly parse: (provider: ConfigProvider.ConfigProvider) => Effect.Effect<T, GetError | Schema.SchemaError>
}

const Proto = {
  ...PipeInspectableProto,
  ...YieldableProto,
  [TypeId]: TypeId,
  asEffect(this: Config<unknown>) {
    return Effect.flatMap(ConfigProvider.ConfigProvider.asEffect(), (provider) => this.parse(provider))
  },
  toJSON(this: Config<unknown>) {
    return {
      _id: "Config"
    }
  }
}

/**
 * Constructs a low-level Config from a parsing function.
 *
 * This is the primitive constructor used internally by other Config constructors
 * to create custom configuration parsers. It provides direct access to the
 * configuration provider and allows for fine-grained control over parsing behavior.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function make<T>(
  parse: (provider: ConfigProvider.ConfigProvider) => Effect.Effect<T, GetError | Schema.SchemaError>
): Config<T> {
  const self = Object.create(Proto)
  self.parse = parse
  return self
}

const dump: (
  provider: ConfigProvider.ConfigProvider,
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
  provider: ConfigProvider.ConfigProvider,
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
        if (ast.rest.length > 0) {
          const out = yield* dump(provider, path)
          // ensure array
          if (typeof out === "string") return [out]
          return out
        }
        const node = yield* provider.get(path)
        // ensure array
        if (node && node._tag === "leaf") return [node.value]
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
        return yield* Effect.fail(new ConfigProvider.GetError({ reason: "Expected a leaf, but received a container" }))
      }
    }
  }
)

/**
 * @since 4.0.0
 */
export function schema<T, E>(codec: Schema.Codec<T, E>): Config<T> {
  const serializer = Serializer.stringLeafJson(codec)
  const decodeUnknownEffect = Schema.decodeUnknownEffect(serializer)
  const serializerEncodedAST = AST.encodedAST(serializer.ast)
  return make((provider) => go(serializerEncodedAST, provider, []).pipe(Effect.flatMap(decodeUnknownEffect)))
}
