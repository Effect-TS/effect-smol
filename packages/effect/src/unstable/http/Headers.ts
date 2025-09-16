/**
 * @since 4.0.0
 */
import * as Equivalence_ from "../../data/Equivalence.ts"
import * as Predicate from "../../data/Predicate.ts"
import * as Record from "../../data/Record.ts"
import * as Redacted from "../../data/Redacted.ts"
import { dual } from "../../Function.ts"
import * as Equal from "../../interfaces/Equal.ts"
import * as Hash from "../../interfaces/Hash.ts"
import { type Redactable, symbolRedactable } from "../../interfaces/Inspectable.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Transformation from "../../schema/Transformation.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { Mutable } from "../../types/Types.ts"

/**
 * This is a symbol to allow direct access of keys without conflicts.
 *
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: unique symbol = Symbol.for("~effect/http/Headers")

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 4.0.0
 * @category refinements
 */
export const isHeaders = (u: unknown): u is Headers => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category models
 */
export interface Headers extends Redactable {
  readonly [TypeId]: TypeId
  readonly [key: string]: string
}

const Proto = Object.assign(Object.create(null), {
  [TypeId]: TypeId,
  [symbolRedactable](
    this: Headers,
    context: ServiceMap.ServiceMap<never>
  ): Record<string, string | Redacted.Redacted<string>> {
    return redact(this, ServiceMap.get(context, CurrentRedactedNames))
  },
  [Equal.symbol](this: Headers, that: Headers): boolean {
    return Equivalence(this, that)
  },
  [Hash.symbol](this: Headers, context: Hash.HashContext): number {
    return context.structure(this)
  }
})

const make = (input: Record.ReadonlyRecord<string, string>): Mutable<Headers> =>
  Object.assign(Object.create(Proto), input) as Headers

/**
 * @since 4.0.0
 * @category Equivalence
 */
export const Equivalence: Equivalence_.Equivalence<Headers> = Record.getEquivalence(Equivalence_.strict<string>())

/**
 * @since 4.0.0
 * @category schemas
 */
export interface schema extends Schema.declare<Headers> {}

/**
 * @since 4.0.0
 * @category schemas
 */
export const schema: schema = Schema.declare(
  isHeaders,
  {
    identifier: "Headers",
    equivalence: {
      _tag: "Declaration",
      declaration: () => Equivalence
    },
    defaultIsoSerializer: () =>
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
 * @since 4.0.0
 * @category models
 */
export type Input =
  | Record.ReadonlyRecord<string, string | ReadonlyArray<string> | undefined>
  | Iterable<readonly [string, string]>

/**
 * @since 4.0.0
 * @category constructors
 */
export const empty: Headers = Object.create(Proto)

/**
 * @since 4.0.0
 * @category constructors
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
 * @since 4.0.0
 * @category constructors
 */
export const fromRecordUnsafe = (input: Record.ReadonlyRecord<string, string>): Headers =>
  Object.setPrototypeOf(input, Proto) as Headers

/**
 * @since 4.0.0
 * @category combinators
 */
export const has: {
  (key: string): (self: Headers) => boolean
  (self: Headers, key: string): boolean
} = dual<
  (key: string) => (self: Headers) => boolean,
  (self: Headers, key: string) => boolean
>(2, (self, key) => key.toLowerCase() in self)

/**
 * @since 4.0.0
 * @category combinators
 */
export const get: {
  (key: string): (self: Headers) => string | undefined
  (self: Headers, key: string): string | undefined
} = dual<
  (key: string) => (self: Headers) => string | undefined,
  (self: Headers, key: string) => string | undefined
>(2, (self, key) => self[key.toLowerCase()])

/**
 * @since 4.0.0
 * @category combinators
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
 * @since 4.0.0
 * @category combinators
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
 * @since 4.0.0
 * @category combinators
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
 * @since 4.0.0
 * @category combinators
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
 * @since 4.0.0
 * @category combinators
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
 * @since 4.0.0
 * @category fiber refs
 */
export const CurrentRedactedNames = ServiceMap.Reference<
  ReadonlyArray<string | RegExp>
>("effect/Headers/CurrentRedactedNames", {
  defaultValue: () => [
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key"
  ]
})
