/**
 * @since 4.0.0
 */
import * as Arr from "../collections/Array.ts"
import { format, formatPropertyKey } from "../data/Formatter.ts"
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Rec from "../data/Record.ts"
import * as RegEx from "../RegExp.ts"
import type * as Types from "../types/Types.ts"
import * as Annotations from "./Annotations.ts"
import * as AST from "./AST.ts"
import * as Getter from "./Getter.ts"
import * as Schema from "./Schema.ts"

// -----------------------------------------------------------------------------
// specification
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export interface Declaration {
  readonly _tag: "Declaration"
  readonly annotations?: Annotations.Annotations | undefined
  readonly typeParameters: ReadonlyArray<StandardSchema>
  readonly checks: ReadonlyArray<Check<DateMeta>>
}

/**
 * @since 4.0.0
 */
export interface Suspend {
  readonly _tag: "Suspend"
  readonly annotations?: Annotations.Annotations | undefined
  readonly $ref: string
}

/**
 * @since 4.0.0
 */
export interface Null {
  readonly _tag: "Null"
  readonly annotations?: Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Undefined {
  readonly _tag: "Undefined"
  readonly annotations?: Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Void {
  readonly _tag: "Void"
  readonly annotations?: Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Never {
  readonly _tag: "Never"
  readonly annotations?: Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Unknown {
  readonly _tag: "Unknown"
  readonly annotations?: Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Any {
  readonly _tag: "Any"
  readonly annotations?: Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface String {
  readonly _tag: "String"
  readonly annotations?: Annotations.Annotations | undefined
  readonly checks: ReadonlyArray<Check<StringMeta>>
  readonly contentMediaType?: string | undefined
  readonly contentSchema?: StandardSchema | undefined
}

/**
 * @since 4.0.0
 */
export interface Number {
  readonly _tag: "Number"
  readonly annotations?: Annotations.Annotations | undefined
  readonly checks: ReadonlyArray<Check<NumberMeta>>
}

/**
 * @since 4.0.0
 */
export interface Boolean {
  readonly _tag: "Boolean"
  readonly annotations?: Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface BigInt {
  readonly _tag: "BigInt"
  readonly annotations?: Annotations.Annotations | undefined
  readonly checks: ReadonlyArray<Check<BigIntMeta>>
}

/**
 * @since 4.0.0
 */
export interface Symbol {
  readonly _tag: "Symbol"
  readonly annotations?: Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Literal {
  readonly _tag: "Literal"
  readonly annotations?: Annotations.Annotations | undefined
  readonly literal: string | number | boolean | bigint
}

/**
 * @since 4.0.0
 */
export interface UniqueSymbol {
  readonly _tag: "UniqueSymbol"
  readonly annotations?: Annotations.Annotations | undefined
  readonly symbol: symbol
}

/**
 * @since 4.0.0
 */
export interface ObjectKeyword {
  readonly _tag: "ObjectKeyword"
  readonly annotations?: Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface Enum {
  readonly _tag: "Enum"
  readonly annotations?: Annotations.Annotations | undefined
  readonly enums: ReadonlyArray<readonly [string, string | number]>
}

/**
 * @since 4.0.0
 */
export interface TemplateLiteral {
  readonly _tag: "TemplateLiteral"
  readonly annotations?: Annotations.Annotations | undefined
  readonly parts: ReadonlyArray<StandardSchema>
}

/**
 * @since 4.0.0
 */
export interface Element {
  readonly isOptional: boolean
  readonly ast: StandardSchema
}

/**
 * @since 4.0.0
 */
export interface Arrays {
  readonly _tag: "Arrays"
  readonly annotations?: Annotations.Annotations | undefined
  readonly elements: ReadonlyArray<Element>
  readonly rest: ReadonlyArray<StandardSchema>
}

/**
 * @since 4.0.0
 */
export interface Objects {
  readonly _tag: "Objects"
  readonly annotations?: Annotations.Annotations | undefined
  readonly propertySignatures: ReadonlyArray<PropertySignature>
  readonly indexSignatures: ReadonlyArray<IndexSignature>
}

/**
 * @since 4.0.0
 */
export interface Union {
  readonly _tag: "Union"
  readonly annotations?: Annotations.Annotations | undefined
  readonly types: ReadonlyArray<StandardSchema>
  readonly mode: "anyOf" | "oneOf"
}

/**
 * @since 4.0.0
 */
export interface PropertySignature {
  readonly name: PropertyKey
  readonly type: StandardSchema
  readonly isOptional: boolean
  readonly isMutable: boolean
  readonly annotations?: Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface IndexSignature {
  readonly parameter: StandardSchema
  readonly type: StandardSchema
}

/**
 * @since 4.0.0
 */
export type StandardSchema =
  | Declaration
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
export type Check<T> = Filter<T> | FilterGroup<T>

/**
 * @since 4.0.0
 */
export interface Filter<M> {
  readonly _tag: "Filter"
  readonly annotations?: Annotations.Annotations | undefined
  readonly meta: M
}

/**
 * @since 4.0.0
 */
export interface FilterGroup<M> {
  readonly _tag: "FilterGroup"
  readonly annotations?: Annotations.Annotations | undefined
  readonly checks: readonly [Check<M>, ...Array<Check<M>>]
}

/**
 * @since 4.0.0
 */
export type StringMeta = Annotations.BuiltInMetaRegistry[
  | "isNumberString"
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
export type NumberMeta = Annotations.BuiltInMetaRegistry[
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
export type BigIntMeta = Annotations.BuiltInMetaRegistry[
  | "isGreaterThanOrEqualToBigInt"
  | "isLessThanOrEqualToBigInt"
  | "isGreaterThanBigInt"
  | "isLessThanBigInt"
  | "isBetweenBigInt"
]

/**
 * @since 4.0.0
 */
export type DateMeta = Annotations.BuiltInMetaRegistry[
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
export type Document = {
  readonly schema: StandardSchema
  readonly definitions: Record<string, StandardSchema>
}

// -----------------------------------------------------------------------------
// schemas
// -----------------------------------------------------------------------------

const Schema$ref = Schema.suspend(() => Schema$)

const toJsonBlacklist: Set<string> = new Set([
  "toArbitrary",
  "toArbitraryConstraint",
  "toJsonSchema",
  "toJsonSchemaConstraint",
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

const PrimitiveTree = Schema.PrimitiveTree.annotate({ identifier: "PrimitiveTree" })

const isPrimitiveTree = Schema.is(PrimitiveTree)

/**
 * @since 4.0.0
 */
export const Annotations$ = Schema.Record(Schema.String, Schema.Unknown).pipe(
  Schema.encodeTo(Schema.Record(Schema.String, PrimitiveTree), {
    decode: Getter.passthrough(),
    encode: Getter.transformOptional(Option.flatMap((r) => {
      const out: Record<string, typeof PrimitiveTree["Type"]> = {}
      for (const [k, v] of Object.entries(r)) {
        if (!toJsonBlacklist.has(k) && isPrimitiveTree(v)) {
          out[k] = v
        }
      }
      return Rec.isRecordEmpty(out) ? Option.none() : Option.some(out)
    }))
  })
).annotate({ identifier: "Annotations" })

/**
 * @since 4.0.0
 */
export const Null$ = Schema.Struct({
  _tag: Schema.tag("Null"),
  annotations: Schema.optionalKey(Annotations$)
}).annotate({ identifier: "Null" })

/**
 * @since 4.0.0
 */
export const Undefined$ = Schema.Struct({
  _tag: Schema.tag("Undefined"),
  annotations: Schema.optionalKey(Annotations$)
}).annotate({ identifier: "Undefined" })

/**
 * @since 4.0.0
 */
export const Void$ = Schema.Struct({
  _tag: Schema.tag("Void"),
  annotations: Schema.optionalKey(Annotations$)
}).annotate({ identifier: "Void" })

/**
 * @since 4.0.0
 */
export const Never$ = Schema.Struct({
  _tag: Schema.tag("Never"),
  annotations: Schema.optionalKey(Annotations$)
}).annotate({ identifier: "Never" })

/**
 * @since 4.0.0
 */
export const Unknown$ = Schema.Struct({
  _tag: Schema.tag("Unknown"),
  annotations: Schema.optionalKey(Annotations$)
}).annotate({ identifier: "Unknown" })

/**
 * @since 4.0.0
 */
export const Any$ = Schema.Struct({
  _tag: Schema.tag("Any"),
  annotations: Schema.optionalKey(Annotations$)
}).annotate({ identifier: "Any" })

const IsNumberString$ = Schema.Struct({
  _tag: Schema.tag("isNumberString"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsNumberString" })

const IsBigIntString$ = Schema.Struct({
  _tag: Schema.tag("isBigIntString"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsBigIntString" })

const IsSymbolString$ = Schema.Struct({
  _tag: Schema.tag("isSymbolString"),
  regExp: Schema.RegExp
}).annotate({ identifier: "IsSymbolString" })

const IsTrimmed$ = Schema.Struct({
  _tag: Schema.tag("isTrimmed")
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
  startsWith: Schema.String
}).annotate({ identifier: "IsStartsWith" })

const IsEndsWith$ = Schema.Struct({
  _tag: Schema.tag("isEndsWith"),
  endsWith: Schema.String
}).annotate({ identifier: "IsEndsWith" })

const IsIncludes$ = Schema.Struct({
  _tag: Schema.tag("isIncludes"),
  includes: Schema.String
}).annotate({ identifier: "IsIncludes" })

const IsUppercased$ = Schema.Struct({
  _tag: Schema.tag("isUppercased")
}).annotate({ identifier: "IsUppercased" })

const IsLowercased$ = Schema.Struct({
  _tag: Schema.tag("isLowercased")
}).annotate({ identifier: "IsLowercased" })

const IsCapitalized$ = Schema.Struct({
  _tag: Schema.tag("isCapitalized")
}).annotate({ identifier: "IsCapitalized" })

const IsUncapitalized$ = Schema.Struct({
  _tag: Schema.tag("isUncapitalized")
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
  IsNumberString$,
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
      annotations: Schema.optionalKey(Annotations$),
      meta
    }).annotate({ identifier: `${identifier}Filter` }),
    Schema.Struct({
      _tag: Schema.tag("FilterGroup"),
      annotations: Schema.optionalKey(Annotations$),
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
  annotations: Schema.optionalKey(Annotations$),
  checks: Schema.Array(makeCheck(StringMeta$, "String")),
  contentMediaType: Schema.optional(Schema.String),
  contentSchema: Schema.optional(Schema$ref)
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
  maximum: Schema.Number
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
  annotations: Schema.optionalKey(Annotations$),
  checks: Schema.Array(makeCheck(NumberMeta$, "Number"))
}).annotate({ identifier: "Number" })

/**
 * @since 4.0.0
 */
export const Boolean$ = Schema.Struct({
  _tag: Schema.tag("Boolean"),
  annotations: Schema.optionalKey(Annotations$)
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
  maximum: Schema.BigInt
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
  annotations: Schema.optionalKey(Annotations$),
  checks: Schema.Array(makeCheck(BigIntMeta$, "BigInt"))
}).annotate({ identifier: "BigInt" })

/**
 * @since 4.0.0
 */
export const Symbol$ = Schema.Struct({
  _tag: Schema.tag("Symbol"),
  annotations: Schema.optionalKey(Annotations$)
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
  annotations: Schema.optionalKey(Annotations$),
  literal: LiteralValue$
}).annotate({ identifier: "Literal" })

/**
 * @since 4.0.0
 */
export const UniqueSymbol$ = Schema.Struct({
  _tag: Schema.tag("UniqueSymbol"),
  annotations: Schema.optionalKey(Annotations$),
  symbol: Schema.Symbol
}).annotate({ identifier: "UniqueSymbol" })

/**
 * @since 4.0.0
 */
export const ObjectKeyword$ = Schema.Struct({
  _tag: Schema.tag("ObjectKeyword"),
  annotations: Schema.optionalKey(Annotations$)
}).annotate({ identifier: "ObjectKeyword" })

/**
 * @since 4.0.0
 */
export const Enum$ = Schema.Struct({
  _tag: Schema.tag("Enum"),
  annotations: Schema.optionalKey(Annotations$),
  enums: Schema.Array(
    Schema.Tuple([Schema.String, Schema.Union([Schema.String, Schema.Number])])
  )
}).annotate({ identifier: "Enum" })

/**
 * @since 4.0.0
 */
export const TemplateLiteral$ = Schema.Struct({
  _tag: Schema.tag("TemplateLiteral"),
  annotations: Schema.optionalKey(Annotations$),
  parts: Schema.Array(Schema$ref)
}).annotate({ identifier: "TemplateLiteral" })

/**
 * @since 4.0.0
 */
export const Element$ = Schema.Struct({
  isOptional: Schema.Boolean,
  ast: Schema$ref
}).annotate({ identifier: "Element" })

/**
 * @since 4.0.0
 */
export const Arrays$ = Schema.Struct({
  _tag: Schema.tag("Arrays"),
  annotations: Schema.optionalKey(Annotations$),
  elements: Schema.Array(Element$),
  rest: Schema.Array(Schema$ref)
}).annotate({ identifier: "Arrays" })

/**
 * @since 4.0.0
 */
export const PropertySignature$ = Schema.Struct({
  annotations: Schema.optionalKey(Annotations$),
  name: Schema.PropertyKey,
  type: Schema$ref,
  isOptional: Schema.Boolean,
  isMutable: Schema.Boolean
}).annotate({ identifier: "PropertySignature" })

/**
 * @since 4.0.0
 */
export const IndexSignature$ = Schema.Struct({
  parameter: Schema$ref,
  type: Schema$ref
}).annotate({ identifier: "IndexSignature" })

/**
 * @since 4.0.0
 */
export const Objects$ = Schema.Struct({
  _tag: Schema.tag("Objects"),
  annotations: Schema.optionalKey(Annotations$),
  propertySignatures: Schema.Array(PropertySignature$),
  indexSignatures: Schema.Array(IndexSignature$)
}).annotate({ identifier: "Objects" })

/**
 * @since 4.0.0
 */
export const Union$ = Schema.Struct({
  _tag: Schema.tag("Union"),
  annotations: Schema.optionalKey(Annotations$),
  types: Schema.Array(Schema$ref),
  mode: Schema.Literals(["anyOf", "oneOf"])
}).annotate({ identifier: "Union" })

/**
 * @since 4.0.0
 */
export const Suspend$ = Schema.Struct({
  _tag: Schema.tag("Suspend"),
  annotations: Schema.optionalKey(Annotations$),
  $ref: Schema.String
}).annotate({ identifier: "Suspend" })

const IsValidDate$ = Schema.Struct({
  _tag: Schema.tag("isValidDate")
}).annotate({ identifier: "IsValidDate" })

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
  maximum: Schema.Date
}).annotate({ identifier: "IsBetweenDate" })

/**
 * @since 4.0.0
 */
const DateMeta$ = Schema.Union([
  IsValidDate$,
  IsGreaterThanDate$,
  IsGreaterThanOrEqualToDate$,
  IsLessThanDate$,
  IsLessThanOrEqualToDate$,
  IsBetweenDate$
]).annotate({ identifier: "DateMeta" })

/**
 * @since 4.0.0
 */
export const Declaration$ = Schema.Struct({
  _tag: Schema.tag("Declaration"),
  annotations: Schema.optionalKey(Annotations$),
  typeParameters: Schema.Array(Schema$ref),
  checks: Schema.Array(makeCheck(DateMeta$, "Date"))
}).annotate({ identifier: "Declaration" })

/**
 * @since 4.0.0
 */
export const Schema$: Schema.Codec<StandardSchema, unknown> = Schema.Union([
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
  Suspend$,
  Declaration$
]).annotate({ identifier: "Schema" })

/**
 * @since 4.0.0
 */
export const Document$ = Schema.Struct({
  schema: Schema$,
  definitions: Schema.Record(Schema.String, Schema$)
}).annotate({ identifier: "Document" })

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export function fromSchema(schema: Schema.Top): Document {
  return fromAST(schema.ast)
}

/**
 * @since 4.0.0
 */
export function fromAST(ast: AST.AST): Document {
  const visited = new Set<AST.AST>()
  const definitions: Record<string, StandardSchema> = {}

  return {
    schema: recur(ast),
    definitions
  }

  function recur(ast: AST.AST, ignoreIdentifier = false): StandardSchema {
    if (!ignoreIdentifier) {
      const $ref = Annotations.resolveIdentifier(ast)
      if ($ref !== undefined) {
        if ($ref in definitions) {
          throw new Error(`Duplicate identifier: ${$ref}`)
        }
        definitions[$ref] = recur(ast, true)
        return { _tag: "Suspend", $ref }
      }
    }
    const out = on(ast)
    if (ast.annotations) {
      out.annotations = ast.annotations
    }
    return out
  }

  function on(ast: AST.AST): Types.Mutable<StandardSchema> {
    visited.add(ast)
    switch (ast._tag) {
      case "Suspend": {
        const thunk = ast.thunk()
        if (visited.has(thunk)) {
          const $ref = Annotations.resolveIdentifier(thunk)
          if ($ref !== undefined) {
            return { _tag: "Suspend", $ref }
          } else {
            throw new Error("Suspended schema without identifier detected", { cause: ast })
          }
        } else {
          return recur(thunk)
        }
      }
      case "Declaration":
        return {
          _tag: "Declaration",
          typeParameters: ast.typeParameters.map((tp) => recur(tp)),
          checks: fromASTChecks(ast.checks)
        }
      case "Null":
      case "Undefined":
      case "Void":
      case "Never":
      case "Unknown":
      case "Any":
      case "Boolean":
      case "Symbol":
        return { _tag: ast._tag }
      case "String": {
        const contentMediaType = ast.annotations?.contentMediaType
        const contentSchema = ast.annotations?.contentSchema
        if (typeof contentMediaType === "string" && AST.isAST(contentSchema)) {
          return {
            _tag: ast._tag,
            checks: [],
            contentMediaType,
            contentSchema: recur(contentSchema)
          }
        }
        return { _tag: ast._tag, checks: fromASTChecks(ast.checks) }
      }
      case "Number":
      case "BigInt":
        return { _tag: ast._tag, checks: fromASTChecks(ast.checks) }
      case "Literal":
        return { _tag: ast._tag, literal: ast.literal }
      case "UniqueSymbol":
        return { _tag: ast._tag, symbol: ast.symbol }
      case "ObjectKeyword":
        return { _tag: ast._tag }
      case "Enum":
        return { _tag: ast._tag, enums: ast.enums }
      case "TemplateLiteral":
        return { _tag: ast._tag, parts: ast.parts.map((p) => recur(p)) }
      case "Arrays":
        return {
          _tag: ast._tag,
          elements: ast.elements.map((e) => ({ isOptional: AST.isOptional(e), ast: recur(e) })),
          rest: ast.rest.map((r) => recur(r))
        }
      case "Objects":
        return {
          _tag: ast._tag,
          propertySignatures: ast.propertySignatures.map((ps) => {
            const out: Types.Mutable<PropertySignature> = {
              name: ps.name,
              type: recur(ps.type),
              isOptional: AST.isOptional(ps.type),
              isMutable: AST.isMutable(ps.type)
            }
            if (ps.type.context?.annotations) {
              out.annotations = ps.type.context.annotations
            }
            return out
          }),
          indexSignatures: ast.indexSignatures.map((is) => ({
            parameter: recur(is.parameter),
            type: recur(is.type)
          }))
        }
      case "Union":
        return {
          _tag: ast._tag,
          types: ast.types.map((t) => recur(t)),
          mode: ast.mode
        }
    }
  }
}

function fromASTChecks(
  checks: readonly [AST.Check<any>, ...Array<AST.Check<any>>] | undefined
): Array<Check<any>> {
  if (!checks) return []
  function getCheck(c: AST.Check<any>): Check<any> | undefined {
    switch (c._tag) {
      case "Filter": {
        const meta = c.annotations?.meta
        if (meta) {
          const out: Types.Mutable<Check<any>> = { _tag: "Filter", meta }
          if (c.annotations) {
            out.annotations = c.annotations
          }
          return out
        }
        return undefined
      }
      case "FilterGroup": {
        const checks = fromASTChecks(c.checks)
        if (Arr.isArrayNonEmpty(checks)) {
          const out: Types.Mutable<Check<any>> = {
            _tag: "FilterGroup",
            checks
          }
          if (c.annotations) {
            out.annotations = c.annotations
          }
          return out
        }
      }
    }
  }
  return checks.map(getCheck).filter((c) => c !== undefined)
}

const serializerJson = Schema.toCodecJson(Document$)
const encodeUnknownSync = Schema.encodeUnknownSync(serializerJson)
const decodeUnknownSync = Schema.decodeUnknownSync(serializerJson)

/**
 * @since 4.0.0
 */
export function toJson(document: Document): Schema.JsonSchema.Document<"draft-2020-12"> {
  const json = encodeUnknownSync(document) as Pick<Schema.JsonSchema.Document, "schema" | "definitions">
  return {
    source: "draft-2020-12",
    schema: json.schema,
    definitions: json.definitions
  }
}

/**
 * @since 4.0.0
 */
export function fromJson(u: unknown): Document {
  return decodeUnknownSync(u)
}

/**
 * @since 4.0.0
 */
export type Reviver<T> = (declaration: Declaration, recur: (schema: StandardSchema) => T) => T

/**
 * @since 4.0.0
 */
export const toSchemaDefaultReviver: Reviver<Schema.Top> = (declaration, recur) => {
  switch (declaration.annotations?.typeConstructor) {
    default:
      throw new Error(`Unknown type constructor: ${declaration.annotations?.typeConstructor}`)
    case "Option":
      return Schema.Option(recur(declaration.typeParameters[0]))
  }
}

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

  function recur(node: StandardSchema): Schema.Top {
    let out = on(node)
    if (node.annotations) out = out.annotate(node.annotations)
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

  function on(schema: StandardSchema): Schema.Top {
    switch (schema._tag) {
      case "Declaration":
        return reviver(schema, recur)
      case "Suspend":
        return resolveReference(schema.$ref)
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
      case "String":
        return Schema.String
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
          const s = recur(e.ast)
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

function toSchemaChecks(top: Schema.Top, schema: StandardSchema): Schema.Top {
  switch (schema._tag) {
    default:
      return top
    case "String":
    case "Number":
    case "BigInt":
    case "Declaration": {
      const checks = schema.checks.map(toSchemaCheck)
      return Arr.isArrayNonEmpty(checks) ? top.check(...checks) : top
    }
  }
}

function toSchemaCheck(check: Check<Annotations.BuiltInMeta>): AST.Check<any> {
  switch (check._tag) {
    case "Filter":
      return toSchemaFilter(check)
    case "FilterGroup": {
      return Schema.makeFilterGroup(Arr.map(check.checks, toSchemaCheck), check.annotations)
    }
  }
}

function toSchemaFilter(filter: Filter<Annotations.BuiltInMeta>): AST.Check<any> {
  const a = filter.annotations
  switch (filter.meta._tag) {
    // String Meta
    case "isNumberString":
      return Schema.isNumberString(a)
    case "isBigIntString":
      return Schema.isBigIntString(a)
    case "isSymbolString":
      return Schema.isSymbolString(a)
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

    // Object Meta
    case "isMinProperties":
      return Schema.isMinProperties(filter.meta.minProperties, a)
    case "isMaxProperties":
      return Schema.isMaxProperties(filter.meta.maxProperties, a)
    case "isPropertiesLength":
      return Schema.isPropertiesLength(filter.meta.length, a)

    // Arrays Meta
    case "isUnique":
      return Schema.isUnique(undefined, a) // TODO: equivalence parameter?
    case "isMinSize":
      return Schema.isMinSize(filter.meta.minSize, a)
    case "isMaxSize":
      return Schema.isMaxSize(filter.meta.maxSize, a)
    case "isSize":
      return Schema.isSize(filter.meta.size, a)
  }
}

/**
 * Return a Draft 2020-12 JSON Schema Document.
 *
 * @since 4.0.0
 */
export function toJsonSchema(document: Document): Schema.JsonSchema.Document<"draft-2020-12"> {
  return {
    source: "draft-2020-12",
    schema: recur(document.schema),
    definitions: Rec.map(document.definitions, (d) => recur(d))
  }

  function recur(ast: StandardSchema): Schema.JsonSchema {
    let jsonSchema: Schema.JsonSchema = on(ast)
    jsonSchema = mergeJsonSchemaAnnotations(jsonSchema, ast.annotations)
    if ((ast._tag === "String" || ast._tag === "Number") && ast.checks.length > 0) {
      jsonSchema = applyChecks(jsonSchema, ast.checks, ast._tag)
    }
    return jsonSchema
  }

  function on(schema: StandardSchema): Schema.JsonSchema {
    switch (schema._tag) {
      case "Declaration":
        return {} // TODO
      case "Suspend":
        return { $ref: `#/$defs/${escapeJsonPointer(schema.$ref)}` }
      case "Null":
        return { type: "null" }
      case "Undefined":
      case "Void":
      case "Unknown":
      case "Any":
      case "BigInt":
      case "Symbol":
      case "UniqueSymbol":
        return {}
      case "Never":
        return { not: {} }
      case "String": {
        const out: Schema.JsonSchema = { type: "string" }
        if (schema.contentMediaType !== undefined) {
          out.contentMediaType = schema.contentMediaType
        }
        if (schema.contentSchema !== undefined) {
          out.contentSchema = recur(schema.contentSchema)
        }
        return out
      }
      case "Number":
        return { type: "number" }
      case "Boolean":
        return { type: "boolean" }
      case "Literal": {
        const literal = schema.literal
        if (typeof literal === "string") {
          return { type: "string", enum: [literal] }
        }
        if (typeof literal === "number") {
          return { type: "number", enum: [literal] }
        }
        if (typeof literal === "boolean") {
          return { type: "boolean", enum: [literal] }
        }
        // bigint literals are not supported
        return {}
      }
      case "ObjectKeyword":
        return { anyOf: [{ type: "object" }, { type: "array" }] }
      case "Enum": {
        const enumValues = schema.enums.map(([, value]) => value)
        if (enumValues.length === 0) {
          return {}
        }
        const firstType = typeof enumValues[0]
        if (enumValues.every((v) => typeof v === firstType)) {
          return { type: firstType === "string" ? "string" : "number", enum: enumValues }
        }
        // Mixed types - use anyOf
        return {
          anyOf: enumValues.map((value) =>
            typeof value === "string"
              ? { type: "string", enum: [value] }
              : { type: "number", enum: [value] }
          )
        }
      }
      case "TemplateLiteral": {
        const pattern = schema.parts.map(getPartPattern).join("")
        return { type: "string", pattern: `^${pattern}$` }
      }
      case "Arrays": {
        const out: Schema.JsonSchema = { type: "array" }
        let minItems = schema.elements.length
        const items: Array<Schema.JsonSchema> = schema.elements.map((e) => {
          if (e.isOptional) minItems--
          return recur(e.ast)
        })
        if (items.length > 0) {
          out.prefixItems = items
          out.minItems = minItems
        }
        if (schema.rest.length > 0) {
          out.items = recur(schema.rest[0])
        } else {
          // No rest element: no additional items allowed
          out.items = false
        }
        if (out.minItems === 0) {
          delete out.minItems
        }
        return out
      }
      case "Objects": {
        if (schema.propertySignatures.length === 0 && schema.indexSignatures.length === 0) {
          return { anyOf: [{ type: "object" }, { type: "array" }] }
        }
        const out: Schema.JsonSchema = { type: "object" }
        const properties: Record<string, Schema.JsonSchema> = {}
        const required: Array<string> = []

        for (const ps of schema.propertySignatures) {
          const name = typeof ps.name === "string" ? ps.name : globalThis.String(ps.name)
          properties[name] = recur(ps.type)
          // Property is required only if it's not explicitly optional AND doesn't contain Undefined
          if (!ps.isOptional && !containsUndefined(ps.type)) {
            required.push(name)
          }
        }

        if (Object.keys(properties).length > 0) {
          out.properties = properties
        }
        if (required.length > 0) {
          out.required = required
        }

        // Handle index signatures
        if (schema.indexSignatures.length > 0) {
          // For draft-2020-12, we can use patternProperties or additionalProperties
          const firstIndex = schema.indexSignatures[0]
          out.additionalProperties = recur(firstIndex.type)
        } else {
          // No index signatures: additional properties are not allowed
          out.additionalProperties = false
        }

        return out
      }
      case "Union": {
        const types = schema.types.map((t) => recur(t)).filter((t) => Object.keys(t).length > 0)
        if (types.length === 0) {
          return { not: {} }
        }
        const result = schema.mode === "anyOf" ? { anyOf: types } : { oneOf: types }
        return flattenArrayJsonSchema(result)
      }
    }
  }
}

function escapeJsonPointer(identifier: string): string {
  return identifier.replace(/~/g, "~0").replace(/\//g, "~1")
}

function getJsonSchemaAnnotations(
  annotations: Annotations.Annotations | undefined
): Schema.JsonSchema | undefined {
  if (annotations) {
    const out: Schema.JsonSchema = {}
    if (typeof annotations.title === "string") out.title = annotations.title
    if (typeof annotations.description === "string") out.description = annotations.description
    if (annotations.default !== undefined) out.default = annotations.default
    if (Array.isArray(annotations.examples)) out.examples = annotations.examples

    if (Object.keys(out).length > 0) return out
  }
}

function mergeJsonSchemaAnnotations(
  jsonSchema: Schema.JsonSchema,
  annotations: Annotations.Annotations | undefined
): Schema.JsonSchema {
  const a = getJsonSchemaAnnotations(annotations)
  if (a) {
    return combineJsonSchema(jsonSchema, a)
  }
  return jsonSchema
}

function combineJsonSchema(a: Schema.JsonSchema, b: Schema.JsonSchema): Schema.JsonSchema {
  if ("$ref" in a) {
    return { allOf: [a, b] }
  } else {
    const hasIntersection = Object.keys(a).filter((key) => key !== "type").some((key) => Object.hasOwn(b, key))
    if (hasIntersection) {
      if (Array.isArray(a.allOf)) {
        return { ...a, allOf: [...a.allOf, b] }
      } else {
        return { ...a, allOf: [b] }
      }
    } else {
      return { ...a, ...b }
    }
  }
}

function flattenArrayJsonSchema(js: Schema.JsonSchema): Schema.JsonSchema {
  if (Object.keys(js).length === 1) {
    if (Array.isArray(js.anyOf) && js.anyOf.length === 1) {
      return js.anyOf[0]
    } else if (Array.isArray(js.oneOf) && js.oneOf.length === 1) {
      return js.oneOf[0]
    } else if (Array.isArray(js.allOf) && js.allOf.length === 1) {
      return js.allOf[0]
    }
  }
  return js
}

function checkToJsonSchemaFragment(
  check: Check<any>,
  tag: "String" | "Number" | "BigInt"
): Schema.JsonSchema {
  if (check._tag === "FilterGroup") {
    const merged = check.checks
      .map((c) => checkToJsonSchemaFragment(c, tag))
      .filter((js) => Object.keys(js).length > 0)
      .reduce<Schema.JsonSchema>((acc, js) => combineJsonSchema(acc, js), {})

    return mergeJsonSchemaAnnotations(merged, check.annotations)
  }

  if (!check.meta) {
    return getJsonSchemaAnnotations(check.annotations) ?? {}
  }

  const meta = check.meta
  const fragment: Schema.JsonSchema = {}

  switch (tag) {
    case "String": {
      switch (meta._tag) {
        case "isMinLength":
          fragment.minLength = meta.minLength
          break
        case "isMaxLength":
          fragment.maxLength = meta.maxLength
          break
        case "isLength":
          fragment.minLength = meta.length
          fragment.maxLength = meta.length
          break
        case "isPattern":
          fragment.pattern = meta.regExp.source
          break
        case "isUUID":
          fragment.format = "uuid"
          break
        case "isULID":
          fragment.pattern = "^[0-7][0-9A-HJKMNP-TV-Z]{25}$"
          break
        case "isBase64":
          fragment.contentEncoding = "base64"
          break
        case "isBase64Url":
          fragment.contentEncoding = "base64url"
          break
      }
      break
    }
    case "Number": {
      switch (meta._tag) {
        case "isInt":
          fragment.type = "integer"
          break
        case "isMultipleOf":
          fragment.multipleOf = meta.divisor
          break
        case "isGreaterThanOrEqualTo":
          fragment.minimum = meta.minimum
          break
        case "isLessThanOrEqualTo":
          fragment.maximum = meta.maximum
          break
        case "isGreaterThan":
          fragment.exclusiveMinimum = meta.exclusiveMinimum
          break
        case "isLessThan":
          fragment.exclusiveMaximum = meta.exclusiveMaximum
          break
        case "isBetween":
          fragment.minimum = meta.minimum
          fragment.maximum = meta.maximum
          break
      }
      break
    }
    case "BigInt": {
      switch (meta._tag) {
        case "isGreaterThanOrEqualToBigInt":
          fragment.minimum = meta.minimum
          break
        case "isLessThanOrEqualToBigInt":
          fragment.maximum = meta.maximum
          break
        case "isGreaterThanBigInt":
          fragment.exclusiveMinimum = meta.exclusiveMinimum
          break
        case "isLessThanBigInt":
          fragment.exclusiveMaximum = meta.exclusiveMaximum
          break
        case "isBetweenBigInt":
          fragment.minimum = meta.minimum
          fragment.maximum = meta.maximum
          break
      }
      break
    }
  }

  return mergeJsonSchemaAnnotations(fragment, check.annotations)
}

function applyChecks(
  jsonSchema: Schema.JsonSchema,
  checks: ReadonlyArray<Check<any>>,
  tag: "String" | "Number" | "BigInt"
): Schema.JsonSchema {
  return checks.reduce((acc, check) => {
    const fragment = checkToJsonSchemaFragment(check, tag)
    if (Object.keys(fragment).length === 0) return acc

    if (
      typeof acc.type === "string" &&
      typeof fragment.type === "string" &&
      fragment.type !== acc.type
    ) {
      const { type, ...rest } = fragment
      const updated = { ...acc, type }
      return Object.keys(rest).length > 0 ? combineJsonSchema(updated, rest) : updated
    }

    return combineJsonSchema(acc, fragment)
  }, jsonSchema)
}

function containsUndefined(schema: StandardSchema): boolean {
  switch (schema._tag) {
    case "Undefined":
      return true
    case "Union":
      return schema.types.some(containsUndefined)
    default:
      return false
  }
}

function getPartPattern(part: StandardSchema): string {
  switch (part._tag) {
    case "String":
      return AST.STRING_PATTERN
    case "Number":
      return AST.NUMBER_PATTERN
    case "Literal":
      return RegEx.escape(globalThis.String(part.literal))
    case "TemplateLiteral":
      return part.parts.map(getPartPattern).join("")
    case "Union":
      return part.types.map(getPartPattern).join("|")
    default:
      throw new Error("Unsupported part", { cause: part })
  }
}

/**
 * @since 4.0.0
 */
export const toCodeDefaultReviver: Reviver<string> = (declaration, recur) => {
  const typeConstructor = declaration.annotations?.typeConstructor
  if (typeof typeConstructor === "string") {
    return `Schema.${typeConstructor}(${declaration.typeParameters.map((p) => recur(p)).join(", ")})`
  }
  return `Schema.Unknown`
}

/**
 * @since 4.0.0
 */
export function toCode(document: Document, options?: {
  readonly reviver?: Reviver<string> | undefined
}): string {
  const reviver = options?.reviver ?? toCodeDefaultReviver
  const schema = document.schema

  if (schema._tag === "Suspend") {
    const definition = document.definitions[schema.$ref]
    if (definition !== undefined) return recur(definition)
  }
  return recur(schema)

  function recur(schema: StandardSchema): string {
    const b = on(schema)
    switch (schema._tag) {
      default:
        return b + toCodeAnnotate(schema.annotations)
      case "Declaration":
      case "Suspend":
        return b
      case "String":
      case "Number":
      case "BigInt":
        return b + toCodeAnnotate(schema.annotations) + toCodeChecks(schema.checks)
    }
  }

  function on(schema: StandardSchema): string {
    switch (schema._tag) {
      case "Declaration":
        return reviver(schema, recur)
      case "Suspend": {
        if (schema.$ref in document.definitions) {
          return `Schema.suspend((): Schema.Codec<${schema.$ref}> => ${schema.$ref})`
        }
        throw new Error(`Reference to unknown schema: ${schema.$ref}`)
      }
      case "Null":
      case "Undefined":
      case "Void":
      case "Never":
      case "Unknown":
      case "Any":
      case "String":
      case "Number":
      case "Boolean":
      case "BigInt":
      case "Symbol":
        return `Schema.${schema._tag}`
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
        const elements = schema.elements.map((e) => toCodeIsOptional(e.isOptional, recur(e.ast)))
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
  ...toJsonBlacklist,
  "typeConstructor"
])

function toCodeAnnotations(annotations: Annotations.Annotations | undefined): string {
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
export function toCodeAnnotate(annotations: Annotations.Annotations | undefined): string {
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

function toCodeChecks(checks: ReadonlyArray<Check<Annotations.BuiltInMeta>>): string {
  if (checks.length === 0) return ""
  return `.check(${checks.map((c) => toCodeCheck(c)).join(", ")})`
}

function toCodeCheck(check: Check<Annotations.BuiltInMeta>): string {
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

function toCodeFilter(filter: Filter<Annotations.BuiltInMeta>): string {
  const a = toCodeAnnotations(filter.annotations)
  const ca = a === "" ? "" : `, ${a}`
  switch (filter.meta._tag) {
    // String Meta
    case "isNumberString":
      return `Schema.isNumberString(${toCodeRegExp(filter.meta.regExp)}${ca})`
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
    // Date Meta
    case "isValidDate":
      return `Schema.isValidDate(${ca})`
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

    // Object Meta
    case "isMinProperties":
      return `Schema.isMinProperties(${filter.meta.minProperties}${ca})`
    case "isMaxProperties":
      return `Schema.isMaxProperties(${filter.meta.maxProperties}${ca})`
    case "isPropertiesLength":
      return `Schema.isPropertiesLength(${filter.meta.length}${ca})`

    // Arrays Meta
    case "isUnique":
      return `Schema.isUnique(undefined, ${a})` // TODO: equivalence parameter?
    case "isMinSize":
      return `Schema.isMinSize(${filter.meta.minSize}${ca})`
    case "isMaxSize":
      return `Schema.isMaxSize(${filter.meta.maxSize}${ca})`
    case "isSize":
      return `Schema.isSize(${filter.meta.size}${ca})`
  }
}

function toCodeRegExp(regExp: RegExp): string {
  return `new RegExp(${format(regExp.source)}, ${format(regExp.flags)})`
}

/**
 * @internal
 */
export function rewriteToDraft07(document: Schema.JsonSchema.Document): Schema.JsonSchema.Document {
  function rewrite(u: unknown): any {
    if (Array.isArray(u)) {
      return u.map(rewrite)
    } else if (typeof u === "object" && u !== null) {
      if ("$ref" in u || "prefixItems" in u) {
        const out: Schema.JsonSchema = { ...u }
        if ("$ref" in out && typeof out.$ref === "string") {
          out.$ref = out.$ref.replace(/#\/\$defs\//g, "#/definitions/")
        }
        if ("prefixItems" in out) {
          if ("items" in out) {
            out.additionalItems = out.items
            delete out.items
          }
          out.items = out.prefixItems
          delete out.prefixItems
        }
        return out
      }
      return u
    } else {
      return u
    }
  }
  return {
    source: "draft-07",
    schema: rewrite(document.schema),
    definitions: Rec.map(document.definitions, (d) => rewrite(d))
  }
}

/**
 * @internal
 */
export function rewriteToOpenApi3_1(document: Schema.JsonSchema.Document): Schema.JsonSchema.Document {
  function rewrite(u: unknown): any {
    if (Array.isArray(u)) {
      return u.map(rewrite)
    } else if (typeof u === "object" && u !== null) {
      if ("$ref" in u && typeof u.$ref === "string") {
        const out: Schema.JsonSchema = { ...u }
        out.$ref = u.$ref.replace(/#\/\$defs\//g, "#/components/schemas/")
        return out
      }
      return u
    } else {
      return u
    }
  }
  return {
    source: "openapi-3.1",
    schema: rewrite(document.schema),
    definitions: Rec.map(document.definitions, (d) => rewrite(d))
  }
}

/**
 * @since 4.0.0
 */
export function fromJsonSchema(document: Schema.JsonSchema.Document<"draft-2020-12">): Document {
  return {
    schema: recur(normalize(document.schema)),
    definitions: Rec.map(document.definitions, (d) => recur(normalize(d)))
  }

  function recur(u: unknown): StandardSchema {
    const out = on(u)
    const annotations = collectAnnotations(u)
    if (annotations !== undefined) {
      out.annotations = annotations
    }
    return out
  }

  function on(u: unknown): Types.Mutable<StandardSchema> {
    if (u === true) return { _tag: "Unknown" }
    if (u === false) return { _tag: "Never" }
    if (Predicate.isObject(u)) {
      if ("enum" in u && Array.isArray(u.enum)) {
        switch (u.enum.length) {
          case 0:
            return { _tag: "Never" }
          case 1:
            return { _tag: "Literal", literal: u.enum[0] }
          default:
            return { _tag: "Union", types: u.enum.map((e) => ({ _tag: "Literal", literal: e })), mode: "anyOf" }
        }
      }
      switch (u.type) {
        case "null":
          return { _tag: "Null" }
        case "boolean":
          return { _tag: "Boolean" }
        case "number":
          return { _tag: "Number", checks: collectNumberChecks(u) }
        case "integer":
          return { _tag: "Number", checks: [{ _tag: "Filter", meta: { _tag: "isInt" } }, ...collectNumberChecks(u)] }
        case "string":
          return { _tag: "String", checks: collectStringChecks(u) }
        case "array":
          return { _tag: "Arrays", elements: [], rest: [] }
        case "object": {
          const propertySignatures = collectProperties(u)
          const indexSignatures = collectIndexSignatures(u)
          return { _tag: "Objects", propertySignatures, indexSignatures }
        }
      }
      if ("anyOf" in u && Array.isArray(u.anyOf)) {
        return { _tag: "Union", types: u.anyOf.map((e) => recur(e)), mode: "anyOf" }
      }
    }
    return { _tag: "Unknown" }
  }

  function collectStringChecks(r: Record<string, unknown>): Array<Check<StringMeta>> {
    const checks: Array<Check<StringMeta>> = []
    if (typeof r.minLength === "number") {
      checks.push({ _tag: "Filter", meta: { _tag: "isMinLength", minLength: r.minLength } })
    }
    if (typeof r.maxLength === "number") {
      checks.push({ _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: r.maxLength } })
    }
    if (typeof r.pattern === "string") {
      checks.push({ _tag: "Filter", meta: { _tag: "isPattern", regExp: new RegExp(r.pattern) } })
    }
    return checks
  }

  function collectNumberChecks(r: Record<string, unknown>): Array<Check<NumberMeta>> {
    const checks: Array<Check<NumberMeta>> = []
    if (typeof r.exclusiveMinimum === "number") {
      checks.push({ _tag: "Filter", meta: { _tag: "isGreaterThan", exclusiveMinimum: r.exclusiveMinimum } })
    }
    if (typeof r.minimum === "number") {
      checks.push({ _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualTo", minimum: r.minimum } })
    }
    if (typeof r.maximum === "number") {
      checks.push({ _tag: "Filter", meta: { _tag: "isLessThanOrEqualTo", maximum: r.maximum } })
    }
    if (typeof r.exclusiveMaximum === "number") {
      checks.push({ _tag: "Filter", meta: { _tag: "isLessThan", exclusiveMaximum: r.exclusiveMaximum } })
    }
    if (typeof r.multipleOf === "number") {
      checks.push({ _tag: "Filter", meta: { _tag: "isMultipleOf", divisor: r.multipleOf } })
    }
    return checks
  }

  function collectProperties(r: Record<string, unknown>): Array<PropertySignature> {
    const properties: Array<PropertySignature> = []
    if (Predicate.isObject(r.properties)) {
      for (const [key, value] of Object.entries(r.properties)) {
        properties.push({ name: key, type: recur(value), isOptional: false, isMutable: false })
      }
    }
    return properties
  }

  function collectIndexSignatures(_r: Record<string, unknown>): Array<IndexSignature> {
    const indexSignatures: Array<IndexSignature> = []
    return indexSignatures
  }
}

function normalize(jsonSchema: Schema.JsonSchema): Schema.JsonSchema {
  return jsonSchema
}

function collectAnnotations(u: unknown): Annotations.Annotations | undefined {
  if (Predicate.isObject(u)) {
    const as: Types.Mutable<Annotations.Annotations> = {}
    if (typeof u.title === "string") as.title = u.title
    if (typeof u.description === "string") as.description = u.description
    if (u.default !== undefined) as.default = u.default
    if (Array.isArray(u.examples)) {
      as.examples = u.examples
    } else if (u.example !== undefined) {
      // OpenAPI 3.0 uses `example` (singular). Only use it if defined
      as.examples = [u.example]
    }
    if (typeof u.format === "string") as.format = u.format
    if (Object.keys(as).length === 0) return undefined
    return as
  }
}
