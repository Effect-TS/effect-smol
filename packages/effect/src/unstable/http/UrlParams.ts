/**
 * @since 4.0.0
 */
import * as Arr from "../../collections/Array.ts"
import * as Data from "../../data/Data.ts"
import * as Equivalence_ from "../../data/Equivalence.ts"
import * as Option from "../../data/Option.ts"
import { hasProperty } from "../../data/Predicate.ts"
import type { ReadonlyRecord } from "../../data/Record.ts"
import * as Result from "../../data/Result.ts"
import * as Tuple from "../../data/Tuple.ts"
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import * as Equal from "../../interfaces/Equal.ts"
import * as Hash from "../../interfaces/Hash.ts"
import { type Inspectable } from "../../interfaces/Inspectable.ts"
import type { Pipeable } from "../../interfaces/Pipeable.ts"
import { PipeInspectableProto } from "../../internal/core.ts"
import * as String$ from "../../primitives/String.ts"
import type * as Annotations from "../../schema/Annotations.ts"
import type * as AST from "../../schema/AST.ts"
import * as Issue from "../../schema/Issue.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Transformation from "../../schema/Transformation.ts"

/**
 * @since 4.0.0
 * @category models
 */
export const TypeId: TypeId = "~effect/http/UrlParams"

/**
 * @since 4.0.0
 * @category models
 */
export type TypeId = "~effect/http/UrlParams"

/**
 * @since 4.0.0
 * @category models
 */
export interface UrlParams extends Pipeable, Inspectable, Iterable<readonly [string, string]> {
  readonly [TypeId]: TypeId
  readonly params: ReadonlyArray<readonly [string, string]>
}

/**
 * @since 4.0.0
 * @category Guards
 */
export const isUrlParams = (u: unknown): u is UrlParams => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category models
 */
export type Input =
  | CoercibleRecord
  | Iterable<readonly [string, Coercible]>
  | URLSearchParams

/**
 * @since 4.0.0
 * @category models
 */
export type Coercible = string | number | bigint | boolean | null | undefined

/**
 * @since 4.0.0
 * @category models
 */
export interface CoercibleRecord {
  readonly [key: string]: Coercible | ReadonlyArray<Coercible> | CoercibleRecord
}

const Proto = {
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  [Symbol.iterator](this: UrlParams) {
    return this.params[Symbol.iterator]()
  },
  toJSON(this: UrlParams): unknown {
    return {
      _id: "UrlParams",
      params: Object.fromEntries(this.params)
    }
  },
  [Equal.symbol](this: UrlParams, that: UrlParams): boolean {
    return Equivalence(this, that)
  },
  [Hash.symbol](this: UrlParams): number {
    return Hash.cached(this, () => Hash.array(this.params.flat()))
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = (params: ReadonlyArray<readonly [string, string]>): UrlParams => {
  const self = Object.create(Proto)
  self.params = params
  return self
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromInput = (input: Input): UrlParams => {
  const parsed = fromInputNested(input)
  const out: Array<[string, string]> = []
  for (let i = 0; i < parsed.length; i++) {
    if (Array.isArray(parsed[i][0])) {
      const [keys, value] = parsed[i] as [Array<string>, string]
      out.push([`${keys[0]}[${keys.slice(1).join("][")}]`, value])
    } else {
      out.push(parsed[i] as [string, string])
    }
  }
  return make(out)
}

const fromInputNested = (input: Input): Array<[string | Array<string>, any]> => {
  const entries = Symbol.iterator in input ? Arr.fromIterable(input) : Object.entries(input)
  const out: Array<[string | Array<string>, string]> = []
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] !== undefined) {
          out.push([key, String(value[i])])
        }
      }
    } else if (typeof value === "object") {
      const nested = fromInputNested(value as CoercibleRecord)
      for (const [k, v] of nested) {
        out.push([[key, ...(typeof k === "string" ? [k] : k)], v])
      }
    } else if (value !== undefined) {
      out.push([key, String(value)])
    }
  }
  return out
}

/**
 * @since 4.0.0
 * @category Equivalence
 */
export const Equivalence: Equivalence_.Equivalence<UrlParams> = Equivalence_.make<UrlParams>((a, b) =>
  arrayEquivalence(a.params, b.params)
)

const arrayEquivalence = Arr.getEquivalence(Tuple.getEquivalence([String$.Equivalence, String$.Equivalence]))

/**
 * @since 4.0.0
 * @category schemas
 */
export interface schema extends Schema.declare<UrlParams> {}

/**
 * @since 4.0.0
 * @category schemas
 */
export const schema: schema = Schema.declare(
  isUrlParams,
  {
    identifier: "UrlParams",
    equivalence: {
      _tag: "Declaration",
      declaration: () => Equivalence
    },
    defaultJsonSerializer: () =>
      Schema.link<UrlParams>()(
        Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
        Transformation.transform({
          decode: make,
          encode: (self) => self.params
        })
      )
  }
)

/**
 * @since 4.0.0
 * @category constructors
 */
export const empty: UrlParams = make([])

/**
 * @since 4.0.0
 * @category combinators
 */
export const getAll: {
  (key: string): (self: UrlParams) => ReadonlyArray<string>
  (self: UrlParams, key: string): ReadonlyArray<string>
} = dual(
  2,
  (self: UrlParams, key: string): ReadonlyArray<string> =>
    Arr.reduce(self.params, [] as Array<string>, (acc, [k, value]) => {
      if (k === key) {
        acc.push(value)
      }
      return acc
    })
)

/**
 * @since 4.0.0
 * @category combinators
 */
export const getFirst: {
  (key: string): (self: UrlParams) => Option.Option<string>
  (self: UrlParams, key: string): Option.Option<string>
} = dual(2, (self: UrlParams, key: string): Option.Option<string> =>
  Option.map(
    Arr.findFirst(self.params, ([k]) => k === key),
    ([, value]) => value
  ))

/**
 * @since 4.0.0
 * @category combinators
 */
export const getLast: {
  (key: string): (self: UrlParams) => Option.Option<string>
  (self: UrlParams, key: string): Option.Option<string>
} = dual(2, (self: UrlParams, key: string): Option.Option<string> =>
  Option.map(
    Arr.findLast(self.params, ([k]) => k === key),
    ([, value]) => value
  ))

/**
 * @since 4.0.0
 * @category combinators
 */
export const set: {
  (key: string, value: Coercible): (self: UrlParams) => UrlParams
  (self: UrlParams, key: string, value: Coercible): UrlParams
} = dual(3, (self: UrlParams, key: string, value: Coercible): UrlParams =>
  make(
    Arr.append(
      Arr.filter(self.params, ([k]) => k !== key),
      [key, String(value)]
    )
  ))

/**
 * @since 4.0.0
 * @category combinators
 */
export const transform: {
  (f: (params: UrlParams["params"]) => UrlParams["params"]): (self: UrlParams) => UrlParams
  (self: UrlParams, f: (params: UrlParams["params"]) => UrlParams["params"]): UrlParams
} = dual(
  2,
  (self: UrlParams, f: (params: UrlParams["params"]) => UrlParams["params"]): UrlParams => make(f(self.params))
)

/**
 * @since 4.0.0
 * @category combinators
 */
export const setAll: {
  (input: Input): (self: UrlParams) => UrlParams
  (self: UrlParams, input: Input): UrlParams
} = dual(2, (self: UrlParams, input: Input): UrlParams => {
  const toSet = fromInput(input)
  const keys = toSet.params.map(([k]) => k)
  return make(Arr.appendAll(
    Arr.filter(self.params, ([k]) => keys.includes(k)),
    toSet.params
  ))
})

/**
 * @since 4.0.0
 * @category combinators
 */
export const append: {
  (key: string, value: Coercible): (self: UrlParams) => UrlParams
  (self: UrlParams, key: string, value: Coercible): UrlParams
} = dual(3, (self: UrlParams, key: string, value: Coercible): UrlParams =>
  make(Arr.append(
    self.params,
    [key, String(value)]
  )))

/**
 * @since 4.0.0
 * @category combinators
 */
export const appendAll: {
  (input: Input): (self: UrlParams) => UrlParams
  (self: UrlParams, input: Input): UrlParams
} = dual(2, (self: UrlParams, input: Input): UrlParams => transform(self, Arr.appendAll(fromInput(input).params)))

/**
 * @since 4.0.0
 * @category combinators
 */
export const remove: {
  (key: string): (self: UrlParams) => UrlParams
  (self: UrlParams, key: string): UrlParams
} = dual(2, (self: UrlParams, key: string): UrlParams => transform(self, Arr.filter(([k]) => k !== key)))

/**
 * @since 4.0.0
 * @category Errors
 */
export class UrlParamsError extends Data.TaggedError("UrlParamsError")<{
  cause: unknown
}> {}

/**
 * @since 4.0.0
 * @category conversions
 */
export const makeUrl = (
  url: string,
  params: UrlParams,
  hash: Option.Option<string>
): Result.Result<URL, UrlParamsError> => {
  try {
    const urlInstance = new URL(url, baseUrl())
    for (let i = 0; i < params.params.length; i++) {
      const [key, value] = params.params[i]
      if (value !== undefined) {
        urlInstance.searchParams.append(key, value)
      }
    }
    if (hash._tag === "Some") {
      urlInstance.hash = hash.value
    }
    return Result.succeed(urlInstance)
  } catch (e) {
    return Result.fail(new UrlParamsError({ cause: e }))
  }
}

/**
 * @since 4.0.0
 * @category conversions
 */
export const toString = (self: UrlParams): string => new URLSearchParams(self.params as any).toString()

const baseUrl = (): string | undefined => {
  if (
    "location" in globalThis &&
    globalThis.location !== undefined &&
    globalThis.location.origin !== undefined &&
    globalThis.location.pathname !== undefined
  ) {
    return location.origin + location.pathname
  }
  return undefined
}

/**
 * Builds a `Record` containing all the key-value pairs in the given `UrlParams`
 * as `string` (if only one value for a key) or a `NonEmptyArray<string>`
 * (when more than one value for a key)
 *
 * **Example**
 *
 * ```ts
 * import * as assert from "node:assert"
 * import { UrlParams } from "effect/unstable/http"
 *
 * const urlParams = UrlParams.fromInput({ a: 1, b: true, c: "string", e: [1, 2, 3] })
 * const result = UrlParams.toRecord(urlParams)
 *
 * assert.deepStrictEqual(
 *   result,
 *   { "a": "1", "b": "true", "c": "string", "e": ["1", "2", "3"] }
 * )
 * ```
 *
 * @since 4.0.0
 * @category conversions
 */
export const toRecord = (self: UrlParams): Record<string, string | Arr.NonEmptyArray<string>> => {
  const out: Record<string, string | Arr.NonEmptyArray<string>> = {}
  for (const [k, value] of self.params) {
    const curr = out[k]
    if (curr === undefined) {
      out[k] = value
    } else if (typeof curr === "string") {
      out[k] = [curr, value]
    } else {
      curr.push(value)
    }
  }
  return out
}

/**
 * @since 4.0.0
 * @category conversions
 */
export const toReadonlyRecord: (self: UrlParams) => ReadonlyRecord<string, string | Arr.NonEmptyReadonlyArray<string>> =
  toRecord as any

/**
 * @since 4.0.0
 * @category Schemas
 */
export interface schemaJsonField extends Schema.decodeTo<Schema.UnknownFromJsonString, schema> {}

/**
 * Extract a JSON value from the first occurrence of the given `field` in the
 * `UrlParams`.
 *
 * ```ts
 * import { Schema } from "effect/schema"
 * import { UrlParams } from "effect/unstable/http"
 *
 * const extractFoo = UrlParams.schemaJsonField("foo").pipe(
 *   Schema.decodeTo(Schema.Struct({
 *     some: Schema.String,
 *     number: Schema.Number
 *   }))
 * )
 *
 * console.log(
 *   Schema.decodeSync(extractFoo)(UrlParams.fromInput({
 *     foo: JSON.stringify({ some: "bar", number: 42 }),
 *     baz: "qux"
 *   }))
 * )
 * ```
 *
 * @since 4.0.0
 * @category Schemas
 */
export const schemaJsonField = (field: string): schemaJsonField =>
  schema.pipe(
    Schema.decodeTo(
      Schema.UnknownFromJsonString,
      Transformation.transformOrFail({
        decode: (params) =>
          Option.match(getFirst(params, field), {
            onNone: () => Effect.fail(new Issue.Pointer([field], new Issue.MissingKey(undefined))),
            onSome: Effect.succeed
          }),
        encode: (value) => Effect.succeed(make([[field, value]]))
      })
    )
  )

/**
 * Extract a record of key-value pairs from the `UrlParams`.
 *
 * @since 4.0.0
 * @category Schemas
 */
export interface schemaRecord extends
  Schema.Bottom<
    ReadonlyRecord<string, string | Arr.NonEmptyReadonlyArray<string>>,
    UrlParams,
    never,
    never,
    AST.AST,
    schemaRecord,
    Annotations.Bottom<ReadonlyRecord<string, string | Arr.NonEmptyReadonlyArray<string>>>
  >
{}

/**
 * Extract schema from all key-value pairs in the given `UrlParams`.
 *
 * **Example**
 *
 * ```ts
 * import { Schema } from "effect/schema"
 * import { UrlParams } from "effect/unstable/http"
 *
 * const toStruct = UrlParams.schemaRecord.pipe(
 *   Schema.decodeTo(Schema.Struct({
 *     some: Schema.String,
 *     number: Schema.FiniteFromString
 *   }))
 * )
 *
 * console.log(
 *   Schema.decodeSync(toStruct)(UrlParams.fromInput({
 *     some: "value",
 *     number: 42
 *   }))
 * )
 * ```
 *
 * @since 4.0.0
 * @category schema
 */
export const schemaRecord: schemaRecord = schema.pipe(
  Schema.decodeTo(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.String, Schema.NonEmptyArray(Schema.String)])
    ),
    Transformation.transform({
      decode: toReadonlyRecord,
      encode: fromInput
    })
  )
)
