/**
 * @since 4.0.0
 */
import * as Arr from "./Array.ts"
import { format, formatPropertyKey } from "./Formatter.ts"
import * as InternalStandard from "./internal/schema/standard.ts"
import type * as JsonSchema from "./JsonSchema.ts"
import * as Option from "./Option.ts"
import * as Predicate from "./Predicate.ts"
import * as Rec from "./Record.ts"
import * as Schema from "./Schema.ts"
import type * as AST from "./SchemaAST.ts"
import * as Getter from "./SchemaGetter.ts"

// -----------------------------------------------------------------------------
// specification
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export interface Declaration {
  readonly _tag: "Declaration"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly typeParameters: ReadonlyArray<Standard>
  readonly checks: ReadonlyArray<Check<Meta>>
  readonly Encoded: Standard
}

/**
 * @since 4.0.0
 */
export interface Suspend {
  readonly _tag: "Suspend"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly checks: readonly []
  readonly thunk: Standard
}

/**
 * @since 4.0.0
 */
export interface Reference {
  readonly _tag: "Reference"
  readonly $ref: string
}

/**
 * @since 4.0.0
 */
export interface Null {
  readonly _tag: "Null"
  readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Undefined {
  readonly _tag: "Undefined"
  readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Void {
  readonly _tag: "Void"
  readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Never {
  readonly _tag: "Never"
  readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Unknown {
  readonly _tag: "Unknown"
  readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Any {
  readonly _tag: "Any"
  readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface String {
  readonly _tag: "String"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly checks: ReadonlyArray<Check<StringMeta>>
  readonly contentMediaType?: string | undefined
  readonly contentSchema?: Standard | undefined
}

/**
 * @since 4.0.0
 */
export interface Number {
  readonly _tag: "Number"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly checks: ReadonlyArray<Check<NumberMeta>>
}

/**
 * @since 4.0.0
 */
export interface Boolean {
  readonly _tag: "Boolean"
  readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface BigInt {
  readonly _tag: "BigInt"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly checks: ReadonlyArray<Check<BigIntMeta>>
}

/**
 * @since 4.0.0
 */
export interface Symbol {
  readonly _tag: "Symbol"
  readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Literal {
  readonly _tag: "Literal"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly literal: string | number | boolean | bigint
}

/**
 * @since 4.0.0
 */
export interface UniqueSymbol {
  readonly _tag: "UniqueSymbol"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly symbol: symbol
}

/**
 * @since 4.0.0
 */
export interface ObjectKeyword {
  readonly _tag: "ObjectKeyword"
  readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Enum {
  readonly _tag: "Enum"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly enums: ReadonlyArray<readonly [string, string | number]>
}

/**
 * @since 4.0.0
 */
export interface TemplateLiteral {
  readonly _tag: "TemplateLiteral"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly parts: ReadonlyArray<Standard>
}

/**
 * @since 4.0.0
 */
export interface Arrays {
  readonly _tag: "Arrays"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly elements: ReadonlyArray<Element>
  readonly rest: ReadonlyArray<Standard>
  readonly checks: ReadonlyArray<Check<ArraysMeta>>
}

/**
 * @since 4.0.0
 */
export interface Element {
  readonly isOptional: boolean
  readonly type: Standard
  readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Objects {
  readonly _tag: "Objects"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly propertySignatures: ReadonlyArray<PropertySignature>
  readonly indexSignatures: ReadonlyArray<IndexSignature>
  readonly checks: ReadonlyArray<Check<ObjectsMeta>>
}

/**
 * @since 4.0.0
 */
export interface PropertySignature {
  readonly name: PropertyKey
  readonly type: Standard
  readonly isOptional: boolean
  readonly isMutable: boolean
  readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface IndexSignature {
  readonly parameter: Standard
  readonly type: Standard
}

/**
 * @since 4.0.0
 */
export interface Union {
  readonly _tag: "Union"
  readonly annotations?: Schema.Annotations.Annotations | undefined
  readonly types: ReadonlyArray<Standard>
  readonly mode: "anyOf" | "oneOf"
}

/**
 * @since 4.0.0
 */
export type Standard =
  | Declaration
  | Reference
  | Suspend
  | Null
  | Undefined
  | Void
  | Never
  | Unknown
  | Any
  | String
  | Number
  | Boolean
  | BigInt
  | Symbol
  | Literal
  | UniqueSymbol
  | ObjectKeyword
  | Enum
  | TemplateLiteral
  | Arrays
  | Objects
  | Union

/**
 * @since 4.0.0
 */
export type Check<M> = Filter<M> | FilterGroup<M>

/**
 * @since 4.0.0
 */
export interface Filter<M> {
  readonly _tag: "Filter"
  readonly annotations?: Schema.Annotations.Filter | undefined
  readonly meta: M
}

/**
 * @since 4.0.0
 */
export interface FilterGroup<M> {
  readonly _tag: "FilterGroup"
  readonly annotations?: Schema.Annotations.Filter | undefined
  readonly checks: readonly [Check<M>, ...Array<Check<M>>]
}

/**
 * @since 4.0.0
 */
export type StringMeta = Schema.Annotations.BuiltInMetaDefinitions[
  | "isFiniteString"
  | "isBigIntString"
  | "isSymbolString"
  | "isMinLength"
  | "isMaxLength"
  | "isPattern"
  | "isLength"
  | "isTrimmed"
  | "isUUID"
  | "isULID"
  | "isBase64"
  | "isBase64Url"
  | "isStartsWith"
  | "isEndsWith"
  | "isIncludes"
  | "isUppercased"
  | "isLowercased"
  | "isCapitalized"
  | "isUncapitalized"
]

/**
 * @since 4.0.0
 */
export type NumberMeta = Schema.Annotations.BuiltInMetaDefinitions[
  | "isInt"
  | "isFinite"
  | "isMultipleOf"
  | "isGreaterThanOrEqualTo"
  | "isLessThanOrEqualTo"
  | "isGreaterThan"
  | "isLessThan"
  | "isBetween"
]

/**
 * @since 4.0.0
 */
export type BigIntMeta = Schema.Annotations.BuiltInMetaDefinitions[
  | "isGreaterThanOrEqualToBigInt"
  | "isLessThanOrEqualToBigInt"
  | "isGreaterThanBigInt"
  | "isLessThanBigInt"
  | "isBetweenBigInt"
]

/**
 * @since 4.0.0
 */
export type ArraysMeta =
  | Schema.Annotations.BuiltInMetaDefinitions[
    | "isMinLength"
    | "isMaxLength"
    | "isLength"
  ]
  | { readonly _tag: "isUnique" }

/**
 * @since 4.0.0
 */
export type ObjectsMeta = Schema.Annotations.BuiltInMetaDefinitions[
  | "isMinProperties"
  | "isMaxProperties"
  | "isPropertiesLength"
]

/**
 * @since 4.0.0
 */
export type DateMeta = Schema.Annotations.BuiltInMetaDefinitions[
  | "isValidDate"
  | "isGreaterThanDate"
  | "isGreaterThanOrEqualToDate"
  | "isLessThanDate"
  | "isLessThanOrEqualToDate"
  | "isBetweenDate"
]
/**
 * @since 4.0.0
 */
export type Meta = StringMeta | NumberMeta | BigIntMeta | ArraysMeta | ObjectsMeta | DateMeta

/**
 * @since 4.0.0
 */
export type Document = {
  readonly schema: Standard
  readonly definitions: Record<string, Standard>
}

/**
 * @since 4.0.0
 */
export type MultiDocument = {
  readonly schemas: readonly [Standard, ...Array<Standard>]
  readonly definitions: Record<string, Standard>
}

// -----------------------------------------------------------------------------
// schemas
// -----------------------------------------------------------------------------

const Standard$ref = Schema.suspend(() => Standard$)

const toJsonAnnotationsBlacklist: Set<string> = new Set([
  "toArbitrary",
  "toArbitraryConstraint",
  "toEquivalence",
  "toFormatter",
  "toCodec*",
  "toCodecJson",
  "toCodecIso",
  "expected",
  "meta",
  "~structural",
  "contentMediaType",
  "contentSchema"
])

/**
 * @category Tree
 * @since 4.0.0
 */
export type PrimitiveTree = Schema.Tree<null | number | boolean | bigint | symbol | string>

const PrimitiveTree$: Schema.Codec<PrimitiveTree> = Schema.Tree(
  Schema.Union([Schema.Null, Schema.Number, Schema.Boolean, Schema.BigInt, Schema.Symbol, Schema.String])
)

const isPrimitiveTree = Schema.is(PrimitiveTree$)

/**
 * @since 4.0.0
 */
export const Annotations$ = Schema.Record(Schema.String, Schema.Unknown).pipe(
  Schema.encodeTo(Schema.Record(Schema.String, PrimitiveTree$), {
    decode: Getter.passthrough(),
    encode: Getter.transformOptional(Option.flatMap((r) => {
      const out: Record<string, typeof PrimitiveTree$["Type"]> = {}
      for (const [k, v] of Object.entries(r)) {
        if (!toJsonAnnotationsBlacklist.has(k) && isPrimitiveTree(v)) {
          out[k] = v
        }
      }
      return Rec.isEmptyRecord(out) ? Option.none() : Option.some(out)
    }))
  })
).annotate({ identifier: "Annotations" })

/**
 * @since 4.0.0
 */
export const Null$ = Schema.Struct({
  _tag: Schema.tag("Null"),
  annotations: Schema.optional(Annotations$)
}).annotate({ identifier: "Null" })

/**
 * @since 4.0.0
 */
export const Undefined$ = Schema.Struct({
  _tag: Schema.tag("Undefined"),
  annotations: Schema.optional(Annotations$)
}).annotate({ identifier: "Undefined" })

/**
 * @since 4.0.0
 */
export const Void$ = Schema.Struct({
  _tag: Schema.tag("Void"),
  annotations: Schema.optional(Annotations$)
}).annotate({ identifier: "Void" })

/**
 * @since 4.0.0
 */
export const Never$ = Schema.Struct({
  _tag: Schema.tag("Never"),
  annotations: Schema.optional(Annotations$)
}).annotate({ identifier: "Never" })

/**
 * @since 4.0.0
 */
export const Unknown$ = Schema.Struct({
  _tag: Schema.tag("Unknown"),
  annotations: Schema.optional(Annotations$)
}).annotate({ identifier: "Unknown" })

/**
 * @since 4.0.0
 */
export const Any$ = Schema.Struct({
  _tag: Schema.tag("Any"),
  annotations: Schema.optional(Annotations$)
}).annotate({ identifier: "Any" })

const IsFiniteString$ = Schema.Struct({
  _tag: Schema.tag("isFiniteString"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsFiniteString" })

const IsBigIntString$ = Schema.Struct({
  _tag: Schema.tag("isBigIntString"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsBigIntString" })

const IsSymbolString$ = Schema.Struct({
  _tag: Schema.tag("isSymbolString"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsSymbolString" })

const IsTrimmed$ = Schema.Struct({
  _tag: Schema.tag("isTrimmed"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsTrimmed" })

const IsUUID$ = Schema.Struct({
  _tag: Schema.tag("isUUID"),
  regExp: Schema.RegExp,
  version: Schema.UndefinedOr(Schema.Literals([1, 2, 3, 4, 5, 6, 7, 8]))
}).annotate({ identifier: "IsUUID" })

const IsULID$ = Schema.Struct({
  _tag: Schema.tag("isULID"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsULID" })

const IsBase64$ = Schema.Struct({
  _tag: Schema.tag("isBase64"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsBase64" })

const IsBase64Url$ = Schema.Struct({
  _tag: Schema.tag("isBase64Url"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsBase64Url" })

const IsStartsWith$ = Schema.Struct({
  _tag: Schema.tag("isStartsWith"),
  startsWith: Schema.String,
  regExp: Schema.RegExp
}).annotate({ identifier: "IsStartsWith" })

const IsEndsWith$ = Schema.Struct({
  _tag: Schema.tag("isEndsWith"),
  endsWith: Schema.String,
  regExp: Schema.RegExp
}).annotate({ identifier: "IsEndsWith" })

const IsIncludes$ = Schema.Struct({
  _tag: Schema.tag("isIncludes"),
  includes: Schema.String,
  regExp: Schema.RegExp
}).annotate({ identifier: "IsIncludes" })

const IsUppercased$ = Schema.Struct({
  _tag: Schema.tag("isUppercased"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsUppercased" })

const IsLowercased$ = Schema.Struct({
  _tag: Schema.tag("isLowercased"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsLowercased" })

const IsCapitalized$ = Schema.Struct({
  _tag: Schema.tag("isCapitalized"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsCapitalized" })

const IsUncapitalized$ = Schema.Struct({
  _tag: Schema.tag("isUncapitalized"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsUncapitalized" })

const IsMinLength$ = Schema.Struct({
  _tag: Schema.tag("isMinLength"),
  minLength: Schema.Number
}).annotate({ identifier: "IsMinLength" })

const IsMaxLength$ = Schema.Struct({
  _tag: Schema.tag("isMaxLength"),
  maxLength: Schema.Number
}).annotate({ identifier: "IsMaxLength" })

const IsPattern$ = Schema.Struct({
  _tag: Schema.tag("isPattern"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsPattern" })

const IsLength$ = Schema.Struct({
  _tag: Schema.tag("isLength"),
  length: Schema.Number
}).annotate({ identifier: "IsLength" })

const StringMeta$ = Schema.Union([
  IsFiniteString$,
  IsBigIntString$,
  IsSymbolString$,
  IsTrimmed$,
  IsUUID$,
  IsULID$,
  IsBase64$,
  IsBase64Url$,
  IsStartsWith$,
  IsEndsWith$,
  IsIncludes$,
  IsUppercased$,
  IsLowercased$,
  IsCapitalized$,
  IsUncapitalized$,
  IsMinLength$,
  IsMaxLength$,
  IsPattern$,
  IsLength$
]).annotate({ identifier: "StringMeta" })

function makeCheck<T>(meta: Schema.Codec<T>, identifier: string) {
  const Check$ref = Schema.suspend(() => Check)
  const Check: Schema.Codec<Check<T>> = Schema.Union([
    Schema.Struct({
      _tag: Schema.tag("Filter"),
      annotations: Schema.optional(Annotations$),
      meta
    }).annotate({ identifier: `${identifier}Filter` }),
    Schema.Struct({
      _tag: Schema.tag("FilterGroup"),
      annotations: Schema.optional(Annotations$),
      checks: Schema.NonEmptyArray(Check$ref)
    }).annotate({ identifier: `${identifier}FilterGroup` })
  ]).annotate({ identifier: `${identifier}Check` })
  return Check
}

/**
 * @since 4.0.0
 */
export const String$ = Schema.Struct({
  _tag: Schema.tag("String"),
  annotations: Schema.optional(Annotations$),
  checks: Schema.Array(makeCheck(StringMeta$, "String")),
  contentMediaType: Schema.optional(Schema.String),
  contentSchema: Schema.optional(Standard$ref)
}).annotate({ identifier: "String" })

const IsInt$ = Schema.Struct({
  _tag: Schema.tag("isInt")
}).annotate({ identifier: "IsInt" })

const IsMultipleOf$ = Schema.Struct({
  _tag: Schema.tag("isMultipleOf"),
  divisor: Schema.Number
}).annotate({ identifier: "IsMultipleOf" })

const IsFinite$ = Schema.Struct({
  _tag: Schema.tag("isFinite")
}).annotate({ identifier: "IsFinite" })

const IsGreaterThan$ = Schema.Struct({
  _tag: Schema.tag("isGreaterThan"),
  exclusiveMinimum: Schema.Number
}).annotate({ identifier: "IsGreaterThan" })

const IsGreaterThanOrEqualTo$ = Schema.Struct({
  _tag: Schema.tag("isGreaterThanOrEqualTo"),
  minimum: Schema.Number
}).annotate({ identifier: "IsGreaterThanOrEqualTo" })

const IsLessThan$ = Schema.Struct({
  _tag: Schema.tag("isLessThan"),
  exclusiveMaximum: Schema.Number
}).annotate({ identifier: "IsLessThan" })

const IsLessThanOrEqualTo$ = Schema.Struct({
  _tag: Schema.tag("isLessThanOrEqualTo"),
  maximum: Schema.Number
}).annotate({ identifier: "IsLessThanOrEqualTo" })

const IsBetween$ = Schema.Struct({
  _tag: Schema.tag("isBetween"),
  minimum: Schema.Number,
  maximum: Schema.Number,
  exclusiveMinimum: Schema.optional(Schema.Boolean),
  exclusiveMaximum: Schema.optional(Schema.Boolean)
}).annotate({ identifier: "IsBetween" })

const NumberMeta$ = Schema.Union([
  IsInt$,
  IsMultipleOf$,
  IsFinite$,
  IsGreaterThan$,
  IsGreaterThanOrEqualTo$,
  IsLessThan$,
  IsLessThanOrEqualTo$,
  IsBetween$
]).annotate({ identifier: "NumberMeta" })

/**
 * @since 4.0.0
 */
export const Number$ = Schema.Struct({
  _tag: Schema.tag("Number"),
  annotations: Schema.optional(Annotations$),
  checks: Schema.Array(makeCheck(NumberMeta$, "Number"))
}).annotate({ identifier: "Number" })

/**
 * @since 4.0.0
 */
export const Boolean$ = Schema.Struct({
  _tag: Schema.tag("Boolean"),
  annotations: Schema.optional(Annotations$)
}).annotate({ identifier: "Boolean" })

const IsGreaterThanBigInt$ = Schema.Struct({
  _tag: Schema.tag("isGreaterThanBigInt"),
  exclusiveMinimum: Schema.BigInt
}).annotate({ identifier: "IsGreaterThanBigInt" })

const IsGreaterThanOrEqualToBigInt$ = Schema.Struct({
  _tag: Schema.tag("isGreaterThanOrEqualToBigInt"),
  minimum: Schema.BigInt
}).annotate({ identifier: "IsGreaterThanOrEqualToBigInt" })

const IsLessThanBigInt$ = Schema.Struct({
  _tag: Schema.tag("isLessThanBigInt"),
  exclusiveMaximum: Schema.BigInt
}).annotate({ identifier: "IsLessThanBigInt" })

const IsLessThanOrEqualToBigInt$ = Schema.Struct({
  _tag: Schema.tag("isLessThanOrEqualToBigInt"),
  maximum: Schema.BigInt
}).annotate({ identifier: "IsLessThanOrEqualToBigInt" })

const IsBetweenBigInt$ = Schema.Struct({
  _tag: Schema.tag("isBetweenBigInt"),
  minimum: Schema.BigInt,
  maximum: Schema.BigInt,
  exclusiveMinimum: Schema.optional(Schema.Boolean),
  exclusiveMaximum: Schema.optional(Schema.Boolean)
}).annotate({ identifier: "IsBetweenBigInt" })

const BigIntMeta$ = Schema.Union([
  IsGreaterThanBigInt$,
  IsGreaterThanOrEqualToBigInt$,
  IsLessThanBigInt$,
  IsLessThanOrEqualToBigInt$,
  IsBetweenBigInt$
]).annotate({ identifier: "BigIntMeta" })

/**
 * @since 4.0.0
 */
export const BigInt$ = Schema.Struct({
  _tag: Schema.tag("BigInt"),
  annotations: Schema.optional(Annotations$),
  checks: Schema.Array(makeCheck(BigIntMeta$, "BigInt"))
}).annotate({ identifier: "BigInt" })

/**
 * @since 4.0.0
 */
export const Symbol$ = Schema.Struct({
  _tag: Schema.tag("Symbol"),
  annotations: Schema.optional(Annotations$)
}).annotate({ identifier: "Symbol" })

/**
 * @since 4.0.0
 */
export const LiteralValue$ = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.BigInt
]).annotate({ identifier: "LiteralValue" })

/**
 * @since 4.0.0
 */
export const Literal$ = Schema.Struct({
  _tag: Schema.tag("Literal"),
  annotations: Schema.optional(Annotations$),
  literal: LiteralValue$
}).annotate({ identifier: "Literal" })

/**
 * @since 4.0.0
 */
export const UniqueSymbol$ = Schema.Struct({
  _tag: Schema.tag("UniqueSymbol"),
  annotations: Schema.optional(Annotations$),
  symbol: Schema.Symbol
}).annotate({ identifier: "UniqueSymbol" })

/**
 * @since 4.0.0
 */
export const ObjectKeyword$ = Schema.Struct({
  _tag: Schema.tag("ObjectKeyword"),
  annotations: Schema.optional(Annotations$)
}).annotate({ identifier: "ObjectKeyword" })

/**
 * @since 4.0.0
 */
export const Enum$ = Schema.Struct({
  _tag: Schema.tag("Enum"),
  annotations: Schema.optional(Annotations$),
  enums: Schema.Array(
    Schema.Tuple([Schema.String, Schema.Union([Schema.String, Schema.Number])])
  )
}).annotate({ identifier: "Enum" })

/**
 * @since 4.0.0
 */
export const TemplateLiteral$ = Schema.Struct({
  _tag: Schema.tag("TemplateLiteral"),
  annotations: Schema.optional(Annotations$),
  parts: Schema.Array(Standard$ref)
}).annotate({ identifier: "TemplateLiteral" })

/**
 * @since 4.0.0
 */
export const Element$ = Schema.Struct({
  isOptional: Schema.Boolean,
  type: Standard$ref,
  annotations: Schema.optional(Annotations$)
}).annotate({ identifier: "Element" })

const IsUnique$ = Schema.Struct({
  _tag: Schema.tag("isUnique")
}).annotate({ identifier: "IsUnique" })

const ArraysMeta$ = Schema.Union([
  IsMinLength$,
  IsMaxLength$,
  IsLength$,
  IsUnique$
]).annotate({ identifier: "ArraysMeta" })

/**
 * @since 4.0.0
 */
export const Arrays$ = Schema.Struct({
  _tag: Schema.tag("Arrays"),
  annotations: Schema.optional(Annotations$),
  elements: Schema.Array(Element$),
  rest: Schema.Array(Standard$ref),
  checks: Schema.Array(makeCheck(ArraysMeta$, "Arrays"))
}).annotate({ identifier: "Arrays" })

/**
 * @since 4.0.0
 */
export const PropertySignature$ = Schema.Struct({
  annotations: Schema.optional(Annotations$),
  name: Schema.PropertyKey,
  type: Standard$ref,
  isOptional: Schema.Boolean,
  isMutable: Schema.Boolean
}).annotate({ identifier: "PropertySignature" })

/**
 * @since 4.0.0
 */
export const IndexSignature$ = Schema.Struct({
  parameter: Standard$ref,
  type: Standard$ref
}).annotate({ identifier: "IndexSignature" })

const IsMinProperties$ = Schema.Struct({
  _tag: Schema.tag("isMinProperties"),
  minProperties: Schema.Number
}).annotate({ identifier: "IsMinProperties" })

const IsMaxProperties$ = Schema.Struct({
  _tag: Schema.tag("isMaxProperties"),
  maxProperties: Schema.Number
}).annotate({ identifier: "IsMaxProperties" })

const IsPropertiesLength$ = Schema.Struct({
  _tag: Schema.tag("isPropertiesLength"),
  length: Schema.Number
}).annotate({ identifier: "IsPropertiesLength" })

const ObjectsMeta$ = Schema.Union([
  IsMinProperties$,
  IsMaxProperties$,
  IsPropertiesLength$
]).annotate({ identifier: "ObjectsMeta" })

/**
 * @since 4.0.0
 */
export const Objects$ = Schema.Struct({
  _tag: Schema.tag("Objects"),
  annotations: Schema.optional(Annotations$),
  propertySignatures: Schema.Array(PropertySignature$),
  indexSignatures: Schema.Array(IndexSignature$),
  checks: Schema.Array(makeCheck(ObjectsMeta$, "Objects"))
}).annotate({ identifier: "Objects" })

/**
 * @since 4.0.0
 */
export const Union$ = Schema.Struct({
  _tag: Schema.tag("Union"),
  annotations: Schema.optional(Annotations$),
  types: Schema.Array(Standard$ref),
  mode: Schema.Literals(["anyOf", "oneOf"])
}).annotate({ identifier: "Union" })

/**
 * @since 4.0.0
 */
export const Reference$ = Schema.Struct({
  _tag: Schema.tag("Reference"),
  $ref: Schema.String
}).annotate({ identifier: "Reference" })

const isValidDate$ = Schema.Struct({
  _tag: Schema.tag("isValidDate")
}).annotate({ identifier: "isValidDate" })

const IsGreaterThanDate$ = Schema.Struct({
  _tag: Schema.tag("isGreaterThanDate"),
  exclusiveMinimum: Schema.Date
}).annotate({ identifier: "IsGreaterThanDate" })

const IsGreaterThanOrEqualToDate$ = Schema.Struct({
  _tag: Schema.tag("isGreaterThanOrEqualToDate"),
  minimum: Schema.Date
}).annotate({ identifier: "IsGreaterThanOrEqualToDate" })

const IsLessThanDate$ = Schema.Struct({
  _tag: Schema.tag("isLessThanDate"),
  exclusiveMaximum: Schema.Date
}).annotate({ identifier: "IsLessThanDate" })

const IsLessThanOrEqualToDate$ = Schema.Struct({
  _tag: Schema.tag("isLessThanOrEqualToDate"),
  maximum: Schema.Date
}).annotate({ identifier: "IsLessThanOrEqualToDate" })

const IsBetweenDate$ = Schema.Struct({
  _tag: Schema.tag("isBetweenDate"),
  minimum: Schema.Date,
  maximum: Schema.Date,
  exclusiveMinimum: Schema.optional(Schema.Boolean),
  exclusiveMaximum: Schema.optional(Schema.Boolean)
}).annotate({ identifier: "IsBetweenDate" })

const DateMeta$ = Schema.Union([
  isValidDate$,
  IsGreaterThanDate$,
  IsGreaterThanOrEqualToDate$,
  IsLessThanDate$,
  IsLessThanOrEqualToDate$,
  IsBetweenDate$
]).annotate({ identifier: "BigIntMeta" })

/**
 * @since 4.0.0
 */
export const Declaration$ = Schema.Struct({
  _tag: Schema.tag("Declaration"),
  annotations: Schema.optional(Annotations$),
  typeParameters: Schema.Array(Standard$ref),
  checks: Schema.Array(makeCheck(DateMeta$, "Date")),
  Encoded: Standard$ref
}).annotate({ identifier: "Declaration" })

/**
 * @since 4.0.0
 */
export const Suspend$ = Schema.Struct({
  _tag: Schema.tag("Suspend"),
  annotations: Schema.optional(Annotations$),
  checks: Schema.Tuple([]),
  thunk: Standard$ref
}).annotate({ identifier: "Suspend" })

/**
 * @since 4.0.0
 */
export interface Standard$ extends Schema.Codec<Standard> {}

/**
 * @since 4.0.0
 */
export const Standard$: Standard$ = Schema.Union([
  Null$,
  Undefined$,
  Void$,
  Never$,
  Unknown$,
  Any$,
  String$,
  Number$,
  Boolean$,
  BigInt$,
  Symbol$,
  Literal$,
  UniqueSymbol$,
  ObjectKeyword$,
  Enum$,
  TemplateLiteral$,
  Arrays$,
  Objects$,
  Union$,
  Reference$,
  Declaration$,
  Suspend$
]).annotate({ identifier: "Schema" })

/**
 * @since 4.0.0
 */
export const Document$ = Schema.Struct({
  schema: Standard$,
  definitions: Schema.Record(Schema.String, Standard$)
}).annotate({ identifier: "Document" })

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export const fromAST: (ast: AST.AST) => Document = InternalStandard.fromAST

/**
 * @since 4.0.0
 */
export const fromASTs: (asts: readonly [AST.AST, ...Array<AST.AST>]) => MultiDocument = InternalStandard.fromASTs

const schemaToCodecJson = Schema.toCodecJson(Standard$)
const encodeSchema = Schema.encodeUnknownSync(schemaToCodecJson)

/**
 * @since 4.0.0
 */
export function toJson(document: Document): JsonSchema.Document<"draft-2020-12"> {
  return {
    source: "draft-2020-12",
    schema: encodeSchema(document.schema) as JsonSchema.JsonSchema,
    definitions: Rec.map(document.definitions, (d) => encodeSchema(d)) as JsonSchema.Definitions
  }
}

const documentToCodecJson = Schema.toCodecJson(Document$)
const decodeDocument = Schema.decodeUnknownSync(documentToCodecJson)

// TODO: tests
/**
 * @since 4.0.0
 */
export function fromJson(u: unknown): Document {
  return decodeDocument(u)
}

/**
 * @since 4.0.0
 */
export type Reviver<T> = (declaration: Declaration, recur: (schema: Standard) => T) => T

/**
 * @since 4.0.0
 */
export const toSchemaDefaultReviver: Reviver<Schema.Top> = (declaration, recur) => {
  const typeConstructor = declaration.annotations?.typeConstructor
  if (Predicate.hasProperty(typeConstructor, "_tag")) {
    const _tag = typeConstructor._tag
    if (typeof _tag === "string") {
      switch (_tag) {
        default:
          return Schema.Unknown
        case "effect/Option":
          return Schema.Option(recur(declaration.typeParameters[0]))
      }
    }
  }
  return Schema.Unknown
}

// TODO: tests
/**
 * @since 4.0.0
 */
export function toSchema<S extends Schema.Top = Schema.Top>(
  document: Document,
  options?: { readonly reviver?: Reviver<Schema.Top> | undefined }
): S {
  const reviver = options?.reviver ?? toSchemaDefaultReviver

  type Slot = {
    // 0 = not started, 1 = building, 2 = done
    state: 0 | 1 | 2
    value: Schema.Top | undefined
    ref: Schema.Top
  }

  const slots = new Map<string, Slot>()

  return recur(document.schema) as S

  function recur(node: Standard): Schema.Top {
    let out = on(node)
    if ("annotations" in node && node.annotations) out = out.annotate(node.annotations)
    out = toSchemaChecks(out, node)
    return out
  }

  function getSlot(identifier: string): Slot {
    const existing = slots.get(identifier)
    if (existing) return existing

    // Create the slot *before* resolving, so self-references can see it.
    const slot: Slot = {
      state: 0,
      value: undefined,
      ref: Schema.suspend(() => {
        if (slot.value === undefined) {
          return Schema.Unknown
        }
        return slot.value
      })
    }
    slots.set(identifier, slot)
    return slot
  }

  function resolveReference(identifier: string): Schema.Top {
    const definition = document.definitions[identifier]
    if (definition === undefined) {
      throw new Error(`Reference to unknown schema: ${identifier}`)
    }

    const slot = getSlot(identifier)

    if (slot.state === 2) {
      // Already built: return the built schema directly
      return slot.value!
    }

    if (slot.state === 1) {
      // Circular: we're currently building this identifier.
      return slot.ref
    }

    // First time: build it.
    slot.state = 1
    try {
      slot.value = recur(definition)
      slot.state = 2
      return slot.value
    } catch (e) {
      // Leave the slot in a safe state so future thunks don't silently succeed.
      slot.state = 0
      slot.value = undefined
      throw e
    }
  }

  function on(schema: Standard): Schema.Top {
    switch (schema._tag) {
      case "Declaration":
        return reviver(schema, recur)
      case "Reference":
        return resolveReference(schema.$ref)
      case "Suspend":
        return recur(schema.thunk)
      case "Null":
        return Schema.Null
      case "Undefined":
        return Schema.Undefined
      case "Void":
        return Schema.Void
      case "Never":
        return Schema.Never
      case "Unknown":
        return Schema.Unknown
      case "Any":
        return Schema.Any
      case "String": {
        const contentMediaType = schema.contentMediaType
        const contentSchema = schema.contentSchema
        if (contentMediaType === "application/json" && contentSchema !== undefined) {
          return Schema.fromJsonString(recur(contentSchema))
        }
        return Schema.String
      }
      case "Number":
        return Schema.Number
      case "Boolean":
        return Schema.Boolean
      case "BigInt":
        return Schema.BigInt
      case "Symbol":
        return Schema.Symbol
      case "Literal":
        return Schema.Literal(schema.literal)
      case "UniqueSymbol":
        return Schema.UniqueSymbol(schema.symbol)
      case "ObjectKeyword":
        return Schema.ObjectKeyword
      case "Enum":
        return Schema.Enum(Object.fromEntries(schema.enums))
      case "TemplateLiteral": {
        const parts = schema.parts.map(recur) as Schema.TemplateLiteral.Parts
        return Schema.TemplateLiteral(parts)
      }
      case "Arrays": {
        const elements = schema.elements.map((e) => {
          const s = recur(e.type)
          return e.isOptional ? Schema.optionalKey(s) : s
        })
        const rest = schema.rest.map(recur)
        if (Arr.isArrayNonEmpty(rest)) {
          if (schema.elements.length === 0 && schema.rest.length === 1) {
            return Schema.Array(rest[0])
          }
          return Schema.TupleWithRest(Schema.Tuple(elements), rest)
        }
        return Schema.Tuple(elements)
      }
      case "Objects": {
        const fields: Record<PropertyKey, Schema.Top> = {}

        for (const ps of schema.propertySignatures) {
          const s = recur(ps.type)
          const withOptional = ps.isOptional ? Schema.optionalKey(s) : s
          fields[ps.name] = ps.isMutable ? Schema.mutableKey(withOptional) : withOptional
        }

        const indexSignatures = schema.indexSignatures.map((is) =>
          Schema.Record(recur(is.parameter) as Schema.Record.Key, recur(is.type))
        )

        if (Arr.isArrayNonEmpty(indexSignatures)) {
          if (schema.propertySignatures.length === 0 && indexSignatures.length === 1) {
            return indexSignatures[0]
          }
          return Schema.StructWithRest(Schema.Struct(fields), indexSignatures)
        }

        return Schema.Struct(fields)
      }
      case "Union": {
        if (schema.types.length === 0) return Schema.Never
        if (schema.types.every((t) => t._tag === "Literal")) {
          if (schema.types.length === 1) {
            return Schema.Literal(schema.types[0].literal)
          }
          return Schema.Literals(schema.types.map((t) => t.literal))
        }
        return Schema.Union(schema.types.map(recur), { mode: schema.mode })
      }
    }
  }
}

function toSchemaChecks(top: Schema.Top, schema: Standard): Schema.Top {
  switch (schema._tag) {
    default:
      return top
    case "String":
    case "Number":
    case "BigInt":
    case "Arrays": {
      const checks = schema.checks.map(toSchemaCheck)
      return Arr.isArrayNonEmpty(checks) ? top.check(...checks) : top
    }
  }
}

function toSchemaCheck(check: Check<Meta>): AST.Check<any> {
  switch (check._tag) {
    case "Filter":
      return toSchemaFilter(check)
    case "FilterGroup": {
      return Schema.makeFilterGroup(Arr.map(check.checks, toSchemaCheck), check.annotations)
    }
  }
}

function toSchemaFilter(filter: Filter<Meta>): AST.Check<any> {
  const a = filter.annotations
  switch (filter.meta._tag) {
    // String Meta
    case "isFiniteString":
      return Schema.isFiniteString(a) // TODO: return undefined
    case "isBigIntString":
      return Schema.isBigIntString(a) // TODO: return undefined
    case "isSymbolString":
      return Schema.isSymbolString(a) // TODO: return undefined
    case "isMinLength":
      return Schema.isMinLength(filter.meta.minLength, a)
    case "isMaxLength":
      return Schema.isMaxLength(filter.meta.maxLength, a)
    case "isLength":
      return Schema.isLength(filter.meta.length, a)
    case "isPattern":
      return Schema.isPattern(filter.meta.regExp, a)
    case "isTrimmed":
      return Schema.isTrimmed(a)
    case "isUUID":
      return Schema.isUUID(filter.meta.version, a)
    case "isULID":
      return Schema.isULID(a)
    case "isBase64":
      return Schema.isBase64(a)
    case "isBase64Url":
      return Schema.isBase64Url(a)
    case "isStartsWith":
      return Schema.isStartsWith(filter.meta.startsWith, a)
    case "isEndsWith":
      return Schema.isEndsWith(filter.meta.endsWith, a)
    case "isIncludes":
      return Schema.isIncludes(filter.meta.includes, a)
    case "isUppercased":
      return Schema.isUppercased(a)
    case "isLowercased":
      return Schema.isLowercased(a)
    case "isCapitalized":
      return Schema.isCapitalized(a)
    case "isUncapitalized":
      return Schema.isUncapitalized(a)

    // Number Meta
    case "isFinite":
      return Schema.isFinite(a)
    case "isInt":
      return Schema.isInt(a)
    case "isMultipleOf":
      return Schema.isMultipleOf(filter.meta.divisor, a)
    case "isGreaterThan":
      return Schema.isGreaterThan(filter.meta.exclusiveMinimum, a)
    case "isGreaterThanOrEqualTo":
      return Schema.isGreaterThanOrEqualTo(filter.meta.minimum, a)
    case "isLessThan":
      return Schema.isLessThan(filter.meta.exclusiveMaximum, a)
    case "isLessThanOrEqualTo":
      return Schema.isLessThanOrEqualTo(filter.meta.maximum, a)
    case "isBetween":
      return Schema.isBetween(filter.meta, a)

    // BigInt Meta
    case "isGreaterThanBigInt":
      return Schema.isGreaterThanBigInt(filter.meta.exclusiveMinimum, a)
    case "isGreaterThanOrEqualToBigInt":
      return Schema.isGreaterThanOrEqualToBigInt(filter.meta.minimum, a)
    case "isLessThanBigInt":
      return Schema.isLessThanBigInt(filter.meta.exclusiveMaximum, a)
    case "isLessThanOrEqualToBigInt":
      return Schema.isLessThanOrEqualToBigInt(filter.meta.maximum, a)
    case "isBetweenBigInt":
      return Schema.isBetweenBigInt(filter.meta, a)

    // Object Meta
    case "isMinProperties":
      return Schema.isMinProperties(filter.meta.minProperties, a)
    case "isMaxProperties":
      return Schema.isMaxProperties(filter.meta.maxProperties, a)
    case "isPropertiesLength":
      return Schema.isPropertiesLength(filter.meta.length, a)

    // Arrays Meta
    case "isUnique":
      return Schema.isUnique(a)

    // Date Meta
    case "isValidDate":
      return Schema.isValidDate(a)
    case "isGreaterThanDate":
      return Schema.isGreaterThanDate(filter.meta.exclusiveMinimum, a)
    case "isGreaterThanOrEqualToDate":
      return Schema.isGreaterThanOrEqualToDate(filter.meta.minimum, a)
    case "isLessThanDate":
      return Schema.isLessThanDate(filter.meta.exclusiveMaximum, a)
    case "isLessThanOrEqualToDate":
      return Schema.isLessThanOrEqualToDate(filter.meta.maximum, a)
    case "isBetweenDate":
      return Schema.isBetweenDate(filter.meta, a)
  }
}

/**
 * Return a Draft 2020-12 JSON Schema Document.
 *
 * @since 4.0.0
 */
export const toJsonSchemaDocument: (
  document: Document,
  options?: Schema.ToJsonSchemaOptions
) => JsonSchema.Document<"draft-2020-12"> = InternalStandard.toJsonSchemaDocument

/**
 * @since 4.0.0
 */
export const toJsonSchemaMultiDocument: (
  document: MultiDocument,
  options?: Schema.ToJsonSchemaOptions
) => JsonSchema.MultiDocument<"draft-2020-12"> = InternalStandard.toJsonSchemaMultiDocument

/**
 * @since 4.0.0
 */
export const toCodeDefaultReviver: Reviver<string> = (declaration, recur) => {
  const typeConstructor = declaration.annotations?.typeConstructor
  if (Predicate.hasProperty(typeConstructor, "_tag")) {
    const _tag = typeConstructor._tag
    if (typeof _tag === "string") {
      switch (_tag) {
        default:
          return "Schema.Unknown"
        case "effect/Option":
          return `Schema.Option(${declaration.typeParameters.map((p) => recur(p)).join(", ")})`
      }
    }
  }
  return "Schema.Unknown"
}

// TODO: tests
/**
 * @since 4.0.0
 */
export function toCode(document: Document, options?: {
  readonly reviver?: Reviver<string> | undefined
}): string {
  const reviver = options?.reviver ?? toCodeDefaultReviver
  const schema = document.schema

  if (schema._tag === "Reference") {
    const definition = document.definitions[schema.$ref]
    if (definition !== undefined) return recur(definition)
  }
  return recur(schema)

  function recur(schema: Standard): string {
    const b = on(schema)
    switch (schema._tag) {
      default:
        return b + toCodeAnnotate(schema.annotations)
      case "Declaration":
      case "Reference":
        return b
      case "String":
      case "Number":
      case "BigInt":
      case "Arrays":
      case "Suspend":
        return b + toCodeAnnotate(schema.annotations) + toCodeChecks(schema.checks)
    }
  }

  function on(schema: Standard): string {
    switch (schema._tag) {
      case "Declaration":
        return reviver(schema, recur)
      case "Reference":
        return schema.$ref
      case "Suspend": {
        const typeAnnotation = schema.thunk._tag === "Reference" ? `: Schema.Codec<${schema.thunk.$ref}>` : ""
        return `Schema.suspend(()${typeAnnotation} => ${recur(schema.thunk)})`
      }
      case "Null":
      case "Undefined":
      case "Void":
      case "Never":
      case "Unknown":
      case "Any":
      case "Number":
      case "Boolean":
      case "BigInt":
      case "Symbol":
        return `Schema.${schema._tag}`
      case "String": {
        const contentMediaType = schema.contentMediaType
        const contentSchema = schema.contentSchema
        if (contentMediaType === "application/json" && contentSchema !== undefined) {
          return `Schema.fromJsonString(${recur(contentSchema)})`
        }
        return `Schema.String`
      }
      case "Literal":
        return `Schema.Literal(${format(schema.literal)})`
      case "UniqueSymbol": {
        const key = globalThis.Symbol.keyFor(schema.symbol)
        if (key === undefined) {
          throw new Error("Cannot generate code for UniqueSymbol created without Symbol.for()")
        }
        return `Schema.UniqueSymbol(Symbol.for(${format(key)}))`
      }
      case "ObjectKeyword":
        return "Schema.ObjectKeyword"
      case "Enum":
        return `Schema.Enum([${schema.enums.map(([key, value]) => `[${format(key)}, ${format(value)}]`).join(", ")}])`
      case "TemplateLiteral":
        return `Schema.TemplateLiteral([${schema.parts.map((p) => recur(p)).join(", ")}])`
      case "Arrays": {
        const elements = schema.elements.map((e) => toCodeIsOptional(e.isOptional, recur(e.type)))
        const rest = schema.rest.map((r) => recur(r))
        if (Arr.isArrayNonEmpty(rest)) {
          if (elements.length === 0 && rest.length === 1) {
            return `Schema.Array(${rest[0]})`
          }
          return `Schema.TupleWithRest(Schema.Tuple([${elements.join(", ")}]), [${rest.join(", ")}])`
        }
        return `Schema.Tuple([${elements.join(", ")}])`
      }
      case "Objects": {
        const propertySignatures = schema.propertySignatures.map((p) =>
          `${formatPropertyKey(p.name)}: ${toCodeIsMutable(p.isMutable, toCodeIsOptional(p.isOptional, recur(p.type)))}`
        )
        const indexSignatures = schema.indexSignatures.map((i) =>
          `Schema.Record(${recur(i.parameter)}, ${recur(i.type)})`
        )
        if (Arr.isArrayNonEmpty(indexSignatures)) {
          if (propertySignatures.length === 0 && indexSignatures.length === 1) {
            return indexSignatures[0]
          }
          return `Schema.StructWithRest(Schema.Struct({ ${propertySignatures.join(", ")} }), [${
            indexSignatures.join(", ")
          }])`
        }
        return `Schema.Struct({ ${propertySignatures.join(", ")} })`
      }
      case "Union": {
        if (schema.types.length === 0) return "Schema.Never"
        if (schema.types.every((t) => t._tag === "Literal")) {
          if (schema.types.length === 1) {
            return `Schema.Literal(${format(schema.types[0].literal)})`
          }
          return `Schema.Literals([${schema.types.map((t) => format(t.literal)).join(", ")}])`
        }
        const mode = schema.mode === "anyOf" ? "" : `, { mode: "oneOf" }`
        return `Schema.Union([${schema.types.map((t) => recur(t)).join(", ")}]${mode})`
      }
    }
  }
}

const toCodeAnnotationsBlacklist: Set<string> = new Set([
  ...toJsonAnnotationsBlacklist,
  "typeConstructor"
])

function toCodeAnnotations(annotations: Schema.Annotations.Annotations | undefined): string {
  if (!annotations) return ""
  const entries: Array<string> = []
  for (const [key, value] of Object.entries(annotations)) {
    if (toCodeAnnotationsBlacklist.has(key)) continue
    entries.push(`${formatPropertyKey(key)}: ${format(value)}`)
  }
  if (entries.length === 0) return ""
  return `{ ${entries.join(", ")} }`
}

/**
 * @since 4.0.0
 */
export function toCodeAnnotate(annotations: Schema.Annotations.Annotations | undefined): string {
  const s = toCodeAnnotations(annotations)
  if (s === "") return ""
  return `.annotate(${s})`
}

function toCodeIsOptional(isOptional: boolean, code: string): string {
  return isOptional ? `Schema.optionalKey(${code})` : code
}

function toCodeIsMutable(isMutable: boolean, code: string): string {
  return isMutable ? `Schema.mutableKey(${code})` : code
}

function toCodeChecks(checks: ReadonlyArray<Check<StringMeta | NumberMeta | BigIntMeta | ArraysMeta>>): string {
  if (checks.length === 0) return ""
  return `.check(${checks.map((c) => toCodeCheck(c)).join(", ")})`
}

function toCodeCheck(check: Check<StringMeta | NumberMeta | BigIntMeta | ArraysMeta>): string {
  switch (check._tag) {
    case "Filter":
      return toCodeFilter(check)
    case "FilterGroup": {
      const a = toCodeAnnotations(check.annotations)
      const ca = a === "" ? "" : `, ${a}`
      return `Schema.makeFilterGroup([${check.checks.map((c) => toCodeCheck(c)).join(", ")}]${ca})`
    }
  }
}

function toCodeFilter(filter: Filter<Meta>): string {
  const a = toCodeAnnotations(filter.annotations)
  const ca = a === "" ? "" : `, ${a}`
  switch (filter.meta._tag) {
    // String Meta
    case "isFiniteString":
      return `Schema.isFiniteString(${toCodeRegExp(filter.meta.regExp)}${ca})`
    case "isBigIntString":
      return `Schema.isBigIntString(${toCodeRegExp(filter.meta.regExp)}${ca})`
    case "isSymbolString":
      return `Schema.isSymbolString(${toCodeRegExp(filter.meta.regExp)}${ca})`
    case "isMinLength":
      return `Schema.isMinLength(${filter.meta.minLength}${ca})`
    case "isMaxLength":
      return `Schema.isMaxLength(${filter.meta.maxLength}${ca})`
    case "isLength":
      return `Schema.isLength(${filter.meta.length}${ca})`
    case "isPattern":
      return `Schema.isPattern(${toCodeRegExp(filter.meta.regExp)}${ca})`
    case "isTrimmed":
      return `Schema.isTrimmed(${ca})`
    case "isUUID":
      return `Schema.isUUID(${filter.meta.version}${ca})`
    case "isULID":
      return `Schema.isULID(${ca})`
    case "isBase64":
      return `Schema.isBase64(${ca})`
    case "isBase64Url":
      return `Schema.isBase64Url(${ca})`
    case "isStartsWith":
      return `Schema.isStartsWith(${filter.meta.startsWith}${ca})`
    case "isEndsWith":
      return `Schema.isEndsWith(${filter.meta.endsWith}${ca})`
    case "isIncludes":
      return `Schema.isIncludes(${filter.meta.includes}${ca})`
    case "isUppercased":
      return `Schema.isUppercased(${ca})`
    case "isLowercased":
      return `Schema.isLowercased(${ca})`
    case "isCapitalized":
      return `Schema.isCapitalized(${ca})`
    case "isUncapitalized":
      return `Schema.isUncapitalized(${ca})`

      // Number Meta
    case "isFinite":
      return `Schema.isFinite(${ca})`
    case "isInt":
      return `Schema.isInt(${ca})`
    case "isMultipleOf":
      return `Schema.isMultipleOf(${filter.meta.divisor}${ca})`
    case "isGreaterThan":
      return `Schema.isGreaterThan(${filter.meta.exclusiveMinimum}${ca})`
    case "isGreaterThanOrEqualTo":
      return `Schema.isGreaterThanOrEqualTo(${filter.meta.minimum}${ca})`
    case "isLessThan":
      return `Schema.isLessThan(${filter.meta.exclusiveMaximum}${ca})`
    case "isLessThanOrEqualTo":
      return `Schema.isLessThanOrEqualTo(${filter.meta.maximum}${ca})`
    case "isBetween":
      return `Schema.isBetween(${filter.meta.minimum}, ${filter.meta.maximum}${ca})`

      // BigInt Meta
    case "isGreaterThanBigInt":
      return `Schema.isGreaterThanBigInt(${filter.meta.exclusiveMinimum}n${ca})`
    case "isGreaterThanOrEqualToBigInt":
      return `Schema.isGreaterThanOrEqualToBigInt(${filter.meta.minimum}n${ca})`
    case "isLessThanBigInt":
      return `Schema.isLessThanBigInt(${filter.meta.exclusiveMaximum}n${ca})`
    case "isLessThanOrEqualToBigInt":
      return `Schema.isLessThanOrEqualToBigInt(${filter.meta.maximum}n${ca})`
    case "isBetweenBigInt":
      return `Schema.isBetweenBigInt(${filter.meta.minimum}n, ${filter.meta.maximum}n${ca})`

    // Arrays Meta
    case "isUnique":
      return `Schema.isUnique(${a})`

    // Object Meta
    case "isMinProperties":
      return `Schema.isMinProperties(${filter.meta.minProperties}${ca})`
    case "isMaxProperties":
      return `Schema.isMaxProperties(${filter.meta.maxProperties}${ca})`
    case "isPropertiesLength":
      return `Schema.isPropertiesLength(${filter.meta.length}${ca})`

    // Date Meta
    case "isValidDate":
      return `Schema.isValidDate(${a})`
    case "isGreaterThanDate":
      return `Schema.isGreaterThanDate(${filter.meta.exclusiveMinimum}${ca})`
    case "isGreaterThanOrEqualToDate":
      return `Schema.isGreaterThanOrEqualToDate(${filter.meta.minimum}${ca})`
    case "isLessThanDate":
      return `Schema.isLessThanDate(${filter.meta.exclusiveMaximum}${ca})`
    case "isLessThanOrEqualToDate":
      return `Schema.isLessThanOrEqualToDate(${filter.meta.maximum}${ca})`
    case "isBetweenDate":
      return `Schema.isBetweenDate(${filter.meta.minimum}, ${filter.meta.maximum}${ca})`
  }
}

function toCodeRegExp(regExp: RegExp): string {
  return `new RegExp(${format(regExp.source)}, ${format(regExp.flags)})`
}

/**
 * @since 4.0.0
 */
export function fromJsonSchema(document: JsonSchema.Document<"draft-2020-12">): Document {
  const definitions = Rec.map(document.definitions, (d) => recur(d))

  return {
    schema: recur(document.schema),
    definitions
  }

  function recur(u: unknown): Standard {
    if (u === false) return never
    if (!Predicate.isObject(u)) return unknown

    const annotations = collectAnnotations(u)
    let out: Standard = { ...unknown, ...makeAnnotations(annotations) }

    if (typeof u.$ref === "string") {
      const $ref = u.$ref.slice(2).split("/").at(-1)!
      out = { _tag: "Reference", $ref } // TODO: handle annotations
    } else if ("const" in u) {
      if (isLiteralValue(u.const)) {
        out = { _tag: "Literal", literal: u.const, ...makeAnnotations(annotations) }
      }
    } else if (Array.isArray(u.enum)) {
      const values = u.enum
      if (values.every(isLiteralValue)) {
        if (values.length === 1) {
          out = { _tag: "Literal", literal: values[0], ...makeAnnotations(annotations) }
        } else {
          out = {
            _tag: "Union",
            types: values.map((v) => ({ _tag: "Literal", literal: v })),
            mode: "anyOf",
            ...makeAnnotations(annotations)
          }
        }
      }
    } else if (Array.isArray(u.anyOf)) {
      out = {
        _tag: "Union",
        types: u.anyOf.map((type) => recur(type)),
        mode: "anyOf",
        ...makeAnnotations(annotations)
      }
    } else if (Array.isArray(u.oneOf)) {
      out = {
        _tag: "Union",
        types: u.oneOf.map((type) => recur(type)),
        mode: "oneOf",
        ...makeAnnotations(annotations)
      }
    }

    const type = isType(u.type) ? u.type : getType(u)
    if (type !== undefined) {
      switch (type) {
        case "string":
          out = { _tag: "String", checks: [], ...makeAnnotations(annotations) }
          break
        case "number":
          out = {
            _tag: "Number",
            checks: [{ _tag: "Filter", meta: { _tag: "isFinite" } }],
            ...makeAnnotations(annotations)
          }
          break
        case "integer":
          out = {
            _tag: "Number",
            checks: [{ _tag: "Filter", meta: { _tag: "isInt" } }],
            ...makeAnnotations(annotations)
          }
          break
        case "boolean":
          out = { _tag: "Boolean", ...makeAnnotations(annotations) }
          break
        case "array": {
          const minItems = typeof u.minItems === "number" ? u.minItems : 0

          const elements: Array<Element> = (Array.isArray(u.prefixItems) ? u.prefixItems : []).map((e, i) => ({
            isOptional: i + 1 > minItems,
            type: recur(e)
          }))

          const rest: Array<Standard> = u.items !== undefined ?
            [recur(u.items)]
            : typeof u.maxItems === "number"
            ? []
            : [unknown]

          out = { _tag: "Arrays", elements, rest, checks: [], ...makeAnnotations(annotations) }
          break
        }
        case "object": {
          out = {
            _tag: "Objects",
            propertySignatures: collectProperties(u),
            indexSignatures: collectIndexSignatures(u),
            checks: [],
            ...makeAnnotations(annotations)
          }
          break
        }
      }
    }

    if (Array.isArray(u.allOf)) {
      out = u.allOf.reduce((acc, curr) => combine(acc, recur(curr)), out)
    }

    return out
  }

  function combine(a: Standard, b: Standard): Standard {
    switch (a._tag) {
      default:
        return never
      case "Never":
        return a
      case "Unknown":
        switch (b._tag) {
          case "Reference":
            return b // TODO: handle annotations
          default:
            return { ...b, ...combineAnnotations(a.annotations, b.annotations) }
        }
      case "Null":
        switch (b._tag) {
          case "Null":
            return { ...a, ...combineAnnotations(a.annotations, b.annotations) }
          case "Union":
            return combine(b, a)
          case "Reference":
            return combine(a, revolveRef(b.$ref))
          default:
            return never
        }
      case "String":
        switch (b._tag) {
          case "String":
            return {
              _tag: "String",
              checks: combineChecks(a.checks, b.checks),
              ...combineAnnotations(a.annotations, b.annotations)
            }
          case "Union":
            return combine(b, a)
          case "Reference":
            return combine(a, revolveRef(b.$ref))
          default:
            return never
        }
      case "Number":
        switch (b._tag) {
          case "Number":
            return {
              _tag: "Number",
              checks: combineChecks(a.checks, b.checks),
              ...combineAnnotations(a.annotations, b.annotations)
            }
          case "Union":
            return combine(b, a)
          case "Reference":
            return combine(a, revolveRef(b.$ref))
          default:
            return never
        }
      case "Boolean":
        switch (b._tag) {
          case "Boolean":
            return { _tag: "Boolean", ...combineAnnotations(a.annotations, b.annotations) }
          case "Union":
            return combine(b, a)
          case "Reference":
            return combine(a, revolveRef(b.$ref))
          default:
            return never
        }
      case "Literal":
        switch (b._tag) {
          case "Literal":
            return a.literal === b.literal
              ? { _tag: "Literal", literal: a.literal, ...combineAnnotations(a.annotations, b.annotations) }
              : never
          case "Union":
            return combine(b, a)
          case "Reference":
            return combine(a, revolveRef(b.$ref))
          default:
            return never
        }
      case "Arrays":
        switch (b._tag) {
          case "Unknown":
            return { ...a, ...combineAnnotations(a.annotations, b.annotations) }
          case "Arrays":
            return {
              _tag: "Arrays",
              elements: combineElements(a.elements, b.elements),
              rest: combineRest(a.rest, b.rest),
              checks: combineChecks(a.checks, b.checks),
              ...combineAnnotations(a.annotations, b.annotations)
            }
          case "Union":
            return combine(b, a)
          case "Reference":
            return combine(a, revolveRef(b.$ref))
          default:
            return never
        }
      case "Objects":
        switch (b._tag) {
          case "Unknown":
            return { ...a, ...combineAnnotations(a.annotations, b.annotations) }
          case "Objects":
            return {
              _tag: "Objects",
              propertySignatures: combinePropertySignatures(a.propertySignatures, b.propertySignatures),
              indexSignatures: combineIndexSignatures(a.indexSignatures, b.indexSignatures),
              checks: combineChecks(a.checks, b.checks),
              ...combineAnnotations(a.annotations, b.annotations)
            }
          case "Union":
            return combine(b, a)
          case "Reference":
            return combine(a, revolveRef(b.$ref))
          default:
            return never
        }
      case "Union": {
        const types = a.types.map((s) => combine(s, b)).filter((s) => s !== never)
        if (types.length === 0) return never
        return {
          _tag: "Union",
          types: a.types.map((s) => combine(s, b)),
          mode: "anyOf",
          ...makeAnnotations(a.annotations)
        }
      }
      case "Reference":
        return combine(revolveRef(a.$ref), b)
    }
  }

  function combineElements(a: ReadonlyArray<Element>, b: ReadonlyArray<Element>): Array<Element> {
    const len = Math.max(a.length, b.length)
    let out: Array<Element> = []
    for (let i = 0; i < len; i++) {
      out.push({
        isOptional: a[i].isOptional && b[i].isOptional,
        type: combine(a[i].type, b[i].type)
      })
    }
    if (a.length > len) {
      out = [...out, ...a.slice(len)]
    } else if (b.length > len) {
      out = [...out, ...b.slice(len)]
    }
    return out
  }

  function combineRest(a: ReadonlyArray<Standard>, b: ReadonlyArray<Standard>): Array<Standard> {
    const len = Math.max(a.length, b.length)
    let out: Array<Standard> = []
    for (let i = 0; i < len; i++) {
      out.push(combine(a[i], b[i]))
    }
    if (a.length > len) {
      out = [...out, ...a.slice(len)]
    } else if (b.length > len) {
      out = [...out, ...b.slice(len)]
    }
    return out
  }

  function revolveRef(ref: string): Standard {
    return definitions[ref] ?? unknown
  }

  function combinePropertySignatures(
    a: ReadonlyArray<PropertySignature>,
    b: ReadonlyArray<PropertySignature>
  ): Array<PropertySignature> {
    const propertySignatures: Array<PropertySignature> = []
    const thatPropertiesMap: Record<PropertyKey, PropertySignature> = {}
    for (const p of b) {
      thatPropertiesMap[p.name] = p
    }
    const keys = new Set<PropertyKey>()
    for (const p of a) {
      keys.add(p.name)
      const thatp = thatPropertiesMap[p.name]
      if (thatp) {
        propertySignatures.push(
          {
            name: p.name,
            type: combine(p.type, thatp.type),
            isOptional: p.isOptional && thatp.isOptional,
            isMutable: p.isMutable
          }
        )
      } else {
        propertySignatures.push(p)
      }
    }
    for (const p of b) {
      if (!keys.has(p.name)) propertySignatures.push(p)
    }
    return propertySignatures
  }

  function combineIndexSignatures(
    a: ReadonlyArray<IndexSignature>,
    b: ReadonlyArray<IndexSignature>
  ): Array<IndexSignature> {
    if (a.length === 0 || b.length === 0) return []
    const out: Array<IndexSignature> = [...a]
    for (const is of b) {
      if (is.parameter === string) {
        const i = a.findIndex((is) => is.parameter === string)
        if (i !== -1) {
          out[i] = { parameter: string, type: combine(a[i].type, is.type) }
        } else {
          out.push(is)
        }
      } else {
        out.push(is)
      }
    }
    return out
  }

  function combineChecks<M>(
    a: ReadonlyArray<Check<M>>,
    b: ReadonlyArray<Check<M>>
  ): Array<Check<M>> {
    return [...a, ...b]
  }

  function makeAnnotations(
    annotations: Schema.Annotations.Annotations | undefined
  ): { annotations: Schema.Annotations.Annotations } | undefined {
    return annotations ? { annotations } : undefined
  }

  function combineAnnotations(
    a: Schema.Annotations.Annotations | undefined,
    b: Schema.Annotations.Annotations | undefined
  ): { annotations: Schema.Annotations.Annotations } | undefined {
    if (a === undefined) return makeAnnotations(b)
    if (b === undefined) return makeAnnotations(a)
    return { annotations: { ...a, ...b } } // TODO: better merge
  }

  function collectProperties(js: JsonSchema.JsonSchema): Array<PropertySignature> {
    const properties: Record<string, unknown> = Predicate.isObject(js.properties) ? js.properties : {}
    const required = Array.isArray(js.required) ? js.required : []
    required.forEach((key) => {
      if (!Object.hasOwn(properties, key)) {
        properties[key] = {}
      }
    })
    return Object.entries(properties).map(([key, v]) => ({
      name: key,
      type: recur(v),
      isOptional: !required.includes(key),
      isMutable: false
    }))
  }

  function collectIndexSignatures(js: JsonSchema.JsonSchema): Array<IndexSignature> {
    const out: Array<IndexSignature> = []

    if (Predicate.isObject(js.patternProperties)) {
      for (const [pattern, value] of Object.entries(js.patternProperties)) {
        out.push({ parameter: recur(pattern), type: recur(value) })
      }
    }

    if (js.additionalProperties === undefined || js.additionalProperties === true) {
      out.push({ parameter: string, type: unknown })
    } else if (Predicate.isObject(js.additionalProperties)) {
      out.push({ parameter: string, type: recur(js.additionalProperties) })
    }

    return out
  }
}

const string: Standard = { _tag: "String", checks: [] }
const never: Standard = { _tag: "Never" }
const unknown: Standard = { _tag: "Unknown" }

function collectAnnotations(schema: JsonSchema.JsonSchema): Schema.Annotations.Annotations | undefined {
  const as: Record<string, unknown> = {}

  if (typeof schema.title === "string") as.title = schema.title
  if (typeof schema.description === "string") as.description = schema.description
  if (schema.default !== undefined) as.default = schema.default
  if (Array.isArray(schema.examples)) as.examples = schema.examples
  if (typeof schema.format === "string") as.format = schema.format

  return Rec.isEmptyRecord(as) ? undefined : as
}

function isLiteralValue(value: unknown): value is AST.LiteralValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
}

const stringKeys = ["minLength", "maxLength", "pattern", "format", "contentMediaType", "contentSchema"]
const numberKeys = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"]
const objectKeys = [
  "properties",
  "required",
  "additionalProperties",
  "patternProperties",
  "propertyNames",
  "minProperties",
  "maxProperties"
]
const arrayKeys = ["items", "prefixItems", "additionalItems", "minItems", "maxItems", "uniqueItems"]

function getType(js: JsonSchema.JsonSchema): JsonSchema.Type | undefined {
  if (stringKeys.some((key) => js[key] !== undefined)) {
    return "string"
  }
  if (numberKeys.some((key) => js[key] !== undefined)) {
    return "number"
  }
  if (objectKeys.some((key) => js[key] !== undefined)) {
    return "object"
  }
  if (arrayKeys.some((key) => js[key] !== undefined)) {
    return "array"
  }
}

const types = ["null", "string", "number", "integer", "boolean", "object", "array"]

function isType(type: unknown): type is JsonSchema.Type {
  return typeof type === "string" && types.includes(type)
}
