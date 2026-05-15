/**
 * @since 4.0.0
 */
import * as Context from "../../Context.ts"
import * as Equal from "../../Equal.ts"
import * as Equ from "../../Equivalence.ts"
import { dual } from "../../Function.ts"
import * as Hash from "../../Hash.ts"
import * as Inspectable from "../../Inspectable.ts"
import * as Option from "../../Option.ts"
import * as Predicate from "../../Predicate.ts"
import * as Record from "../../Record.ts"
import * as Redactable from "../../Redactable.ts"
import * as Redacted from "../../Redacted.ts"
import * as Schema from "../../Schema.ts"
import * as Transformation from "../../SchemaTransformation.ts"
import type { Mutable } from "../../Types.ts"

/**
 * This is a symbol to allow direct access of keys without conflicts.
 *
 * @category type ids
 * @since 4.0.0
 */
export const TypeId: unique symbol = Symbol.for("~effect/http/Headers")

/**
 * @category type ids
 * @since 4.0.0
 */
export type TypeId = typeof TypeId

/**
 * @category refinements
 * @since 4.0.0
 */
export const isHeaders = (u: unknown): u is Headers => Predicate.hasProperty(u, TypeId)

/**
 * @category models
 * @since 4.0.0
 */
export interface Headers extends Redactable.Redactable {
  readonly [TypeId]: TypeId
  readonly [key: string]: string
}

const Proto = Object.create(null)

Object.defineProperties(Proto, {
  [TypeId]: {
    value: TypeId
  },
  [Redactable.symbolRedactable]: {
    value(this: Headers, context: Context.Context<never>): Record<string, string | Redacted.Redacted<string>> {
      return redact(this, Context.get(context, CurrentRedactedNames))
    }
  },
  toJSON: {
    value(this: Headers) {
      return Redactable.redact(this)
    }
  },
  [Equal.symbol]: {
    value(this: Headers, that: Headers): boolean {
      return Equivalence(this, that)
    }
  },
  [Hash.symbol]: {
    value(this: Headers): number {
      return Hash.structure(this)
    }
  },
  toString: {
    value: Inspectable.BaseProto.toString
  },
  [Inspectable.NodeInspectSymbol]: {
    value: Inspectable.BaseProto[Inspectable.NodeInspectSymbol]
  }
})

const make = (input: Record.ReadonlyRecord<string, string>): Mutable<Headers> =>
  Object.assign(Object.create(Proto), input) as Headers

/**
 * @category Equivalence
 * @since 4.0.0
 */
export const Equivalence: Equ.Equivalence<Headers> = Record.makeEquivalence(Equ.strictEqual<string>())

/**
 * @category schemas
 * @since 4.0.0
 */
export interface HeadersSchema extends Schema.declare<Headers, { readonly [x: string]: string }> {}

/**
 * @category schemas
 * @since 4.0.0
 */
export const HeadersSchema: HeadersSchema = Schema.declare(
  isHeaders,
  {
    typeConstructor: {
      _tag: "effect/http/Headers"
    },
    generation: {
      runtime: `Headers.HeadersSchema`,
      Type: `Headers.Headers`,
      Encoded: `typeof Headers.HeadersSchema["Encoded"]`,
      importDeclaration: `import * as Headers from "effect/unstable/http/Headers"`
    },
    expected: "Headers",
    toEquivalence: () => Equivalence,
    toCodec: () =>
      Schema.link<Headers>()(
        Schema.Record(Schema.String, Schema.String),
        Transformation.transform({
          decode: (input) => fromInput(input),
          encode: (headers) => ({ ...headers })
        })
      )
  }
)

/**
 * @category models
 * @since 4.0.0
 */
export type Input =
  | Record.ReadonlyRecord<string, string | ReadonlyArray<string> | undefined>
  | Iterable<readonly [string, string]>

/**
 * @category constructors
 * @since 4.0.0
 */
export const empty: Headers = Object.create(Proto)

/**
 * @category constructors
 * @since 4.0.0
 */
export const fromInput: (input?: Input) => Headers = (input) => {
  if (input === undefined) {
    return empty
  } else if (Symbol.iterator in input) {
    const out: Record<string, string> = Object.create(Proto)
    for (const [k, v] of input) {
      out[k.toLowerCase()] = v
    }
    return out as Headers
  }
  const out: Record<string, string> = Object.create(Proto)
  for (const [k, v] of Object.entries(input)) {
    if (Array.isArray(v)) {
      out[k.toLowerCase()] = v.join(", ")
    } else if (v !== undefined) {
      out[k.toLowerCase()] = v as string
    }
  }
  return out as Headers
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const fromRecordUnsafe = (input: Record.ReadonlyRecord<string, string>): Headers =>
  Object.setPrototypeOf(input, Proto) as Headers

/**
 * @category combinators
 * @since 4.0.0
 */
export const has: {
  (key: string): (self: Headers) => boolean
  (self: Headers, key: string): boolean
} = dual<
  (key: string) => (self: Headers) => boolean,
  (self: Headers, key: string) => boolean
>(2, (self, key) => key.toLowerCase() in self)

/**
 * @category combinators
 * @since 4.0.0
 */
export const get: {
  (key: string): (self: Headers) => Option.Option<string>
  (self: Headers, key: string): Option.Option<string>
} = dual<
  (key: string) => (self: Headers) => Option.Option<string>,
  (self: Headers, key: string) => Option.Option<string>
>(2, (self, key) => Option.fromUndefinedOr(self[key.toLowerCase()]))

/**
 * @category combinators
 * @since 4.0.0
 */
export const set: {
  (key: string, value: string): (self: Headers) => Headers
  (self: Headers, key: string, value: string): Headers
} = dual<
  (key: string, value: string) => (self: Headers) => Headers,
  (self: Headers, key: string, value: string) => Headers
>(3, (self, key, value) => {
  const out = make(self)
  out[key.toLowerCase()] = value
  return out
})

/**
 * @category combinators
 * @since 4.0.0
 */
export const setAll: {
  (headers: Input): (self: Headers) => Headers
  (self: Headers, headers: Input): Headers
} = dual<
  (headers: Input) => (self: Headers) => Headers,
  (self: Headers, headers: Input) => Headers
>(2, (self, headers) =>
  make({
    ...self,
    ...fromInput(headers)
  }))

/**
 * @category combinators
 * @since 4.0.0
 */
export const merge: {
  (headers: Headers): (self: Headers) => Headers
  (self: Headers, headers: Headers): Headers
} = dual<
  (headers: Headers) => (self: Headers) => Headers,
  (self: Headers, headers: Headers) => Headers
>(2, (self, headers) => {
  const out = make(self)
  Object.assign(out, headers)
  return out
})

/**
 * @category combinators
 * @since 4.0.0
 */
export const remove: {
  (key: string): (self: Headers) => Headers
  (self: Headers, key: string): Headers
} = dual<
  (key: string) => (self: Headers) => Headers,
  (self: Headers, key: string) => Headers
>(2, (self, key) => {
  const out = make(self)
  delete out[key.toLowerCase()]
  return out
})

/**
 * @category combinators
 * @since 4.0.0
 */
export const removeMany: {
  (keys: Iterable<string>): (self: Headers) => Headers
  (self: Headers, keys: Iterable<string>): Headers
} = dual<
  (keys: Iterable<string>) => (self: Headers) => Headers,
  (self: Headers, keys: Iterable<string>) => Headers
>(2, (self, keys) => {
  const out = make(self)
  for (const key of keys) {
    delete out[key.toLowerCase()]
  }
  return out
})

/**
 * @category combinators
 * @since 4.0.0
 */
export const redact: {
  (
    key: string | RegExp | ReadonlyArray<string | RegExp>
  ): (self: Headers) => Record<string, string | Redacted.Redacted>
  (
    self: Headers,
    key: string | RegExp | ReadonlyArray<string | RegExp>
  ): Record<string, string | Redacted.Redacted>
} = dual(
  2,
  (
    self: Headers,
    key: string | RegExp | ReadonlyArray<string | RegExp>
  ): Record<string, string | Redacted.Redacted> => {
    const out: Record<string, string | Redacted.Redacted> = { ...self }
    const modify = (key: string | RegExp) => {
      if (typeof key === "string") {
        const k = key.toLowerCase()
        if (k in self) {
          out[k] = Redacted.make(self[k])
        }
      } else {
        for (const name in self) {
          if (key.test(name)) {
            out[name] = Redacted.make(self[name])
          }
        }
      }
    }
    if (Array.isArray(key)) {
      for (let i = 0; i < key.length; i++) {
        modify(key[i])
      }
    } else {
      modify(key as string | RegExp)
    }
    return out
  }
)

/**
 * @category fiber refs
 * @since 4.0.0
 */
export const CurrentRedactedNames = Context.Reference<
  ReadonlyArray<string | RegExp>
>("effect/Headers/CurrentRedactedNames", {
  defaultValue: () => [
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key"
  ]
})
