/**
 * @since 4.0.0
 */
import * as Arr from "../collections/Array.ts"
import type { Formatter } from "../data/Formatter.ts"
import { format, formatPropertyKey } from "../data/Formatter.ts"
import * as Option from "../data/Option.ts"
import * as Rec from "../data/Record.ts"
import * as RegEx from "../RegExp.ts"
import * as Annotations from "./Annotations.ts"
import * as SchemaAST from "./AST.ts"
import * as Getter from "./Getter.ts"
import * as Schema from "./Schema.ts"

// -----------------------------------------------------------------------------
// specification
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export interface External {
  readonly _tag: "External"
  readonly annotations?: Annotations.Annotations | undefined
  readonly typeParameters: ReadonlyArray<AST>
  readonly checks: ReadonlyArray<Check<DateCheckMeta>>
}

/**
 * @since 4.0.0
 */
export interface Reference {
  readonly _tag: "Reference"
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
  readonly checks: ReadonlyArray<Check<StringCheckMeta>>
  readonly contentMediaType?: string | undefined
  readonly contentSchema?: AST | undefined
}

/**
 * @since 4.0.0
 */
export interface Number {
  readonly _tag: "Number"
  readonly annotations?: Annotations.Annotations | undefined
  readonly checks: ReadonlyArray<Check<NumberCheckMeta>>
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
  readonly checks: ReadonlyArray<Check<BigIntCheckMeta>>
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
  readonly parts: ReadonlyArray<AST>
}

/**
 * @since 4.0.0
 */
export interface Element {
  readonly isOptional: boolean
  readonly ast: AST
}

/**
 * @since 4.0.0
 */
export interface Arrays {
  readonly _tag: "Arrays"
  readonly annotations?: Annotations.Annotations | undefined
  readonly elements: ReadonlyArray<Element>
  readonly rest: ReadonlyArray<AST>
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
  readonly types: ReadonlyArray<AST>
  readonly mode: "anyOf" | "oneOf"
}

/**
 * @since 4.0.0
 */
export interface PropertySignature {
  readonly name: PropertyKey
  readonly type: AST
  readonly isOptional: boolean
  readonly isMutable: boolean
  readonly annotations?: Annotations.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export interface IndexSignature {
  readonly parameter: AST
  readonly type: AST
}

/**
 * @since 4.0.0
 */
export type AST =
  | External
  | Reference
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
  readonly meta: M | undefined
  readonly annotations?: Annotations.Annotations | undefined
  readonly checks: ReadonlyArray<Check<M>>
}

/**
 * @since 4.0.0
 */
export type StringCheckMeta = Annotations.BuiltInMetaRegistry[
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
export type NumberCheckMeta =
  | Annotations.BuiltInMetaRegistry[
    | "isInt"
    | "isInt32"
    | "isUint32"
    | "isFinite"
    | "isMultipleOf"
  ]
  | Annotations.isGreaterThanOrEqualTo<number>
  | Annotations.isLessThanOrEqualTo<number>
  | Annotations.isGreaterThan<number>
  | Annotations.isLessThan<number>
  | Annotations.isBetween<number>

/**
 * @since 4.0.0
 */
export type BigIntCheckMeta =
  | Annotations.isGreaterThanOrEqualTo<bigint>
  | Annotations.isLessThanOrEqualTo<bigint>
  | Annotations.isGreaterThan<bigint>
  | Annotations.isLessThan<bigint>
  | Annotations.isBetween<bigint>

/**
 * @since 4.0.0
 */
export type DateCheckMeta =
  | Annotations.BuiltInMetaRegistry["isValidDate"]
  | Annotations.isGreaterThanOrEqualTo<number>
  | Annotations.isLessThanOrEqualTo<number>
  | Annotations.isGreaterThan<number>
  | Annotations.isLessThan<number>
  | Annotations.isBetween<number>

// -----------------------------------------------------------------------------
// schemas
// -----------------------------------------------------------------------------

const AST$ref = Schema.suspend((): Schema.Codec<AST, unknown> => AST$)

type PrimitiveTree = Getter.Tree<null | number | boolean | bigint | symbol | string>

const PrimitiveTree$ref = Schema.suspend((): Schema.Codec<PrimitiveTree> => PrimitiveTree$)

/**
 * @since 4.0.0
 */
export const PrimitiveTree$ = Schema.Union([
  Schema.Null,
  Schema.Number,
  Schema.Boolean,
  Schema.BigInt,
  Schema.Symbol,
  Schema.String,
  Schema.Array(PrimitiveTree$ref),
  Schema.Record(Schema.String, PrimitiveTree$ref)
])

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

const isPrimitiveTree = Schema.is(PrimitiveTree$)

/**
 * @since 4.0.0
 */
export const Annotations$ = Schema.Record(Schema.String, Schema.Unknown).pipe(
  Schema.encodeTo(Schema.Record(Schema.String, PrimitiveTree$), {
    decode: Getter.passthrough(),
    encode: Getter.transformOptional(Option.flatMap((r) => {
      const out: Record<string, PrimitiveTree> = {}
      for (const [k, v] of Object.entries(r)) {
        if (!toJsonBlacklist.has(k) && isPrimitiveTree(v)) {
          out[k] = v
        }
      }
      return Rec.isRecordEmpty(out) ? Option.none() : Option.some(out)
    }))
  })
)

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
})

const IsBigIntString$ = Schema.Struct({
  _tag: Schema.tag("isBigIntString"),
  regExp: Schema.RegExp
})

const IsSymbolString$ = Schema.Struct({
  _tag: Schema.tag("isSymbolString"),
  regExp: Schema.RegExp
})

const IsTrimmed$ = Schema.Struct({
  _tag: Schema.tag("isTrimmed")
})

const IsUUID$ = Schema.Struct({
  _tag: Schema.tag("isUUID"),
  regExp: Schema.RegExp,
  version: Schema.UndefinedOr(Schema.Literals([1, 2, 3, 4, 5, 6, 7, 8]))
})

const IsULID$ = Schema.Struct({
  _tag: Schema.tag("isULID"),
  regExp: Schema.RegExp
})

const IsBase64$ = Schema.Struct({
  _tag: Schema.tag("isBase64"),
  regExp: Schema.RegExp
})

const IsBase64Url$ = Schema.Struct({
  _tag: Schema.tag("isBase64Url"),
  regExp: Schema.RegExp
})

const IsStartsWith$ = Schema.Struct({
  _tag: Schema.tag("isStartsWith"),
  startsWith: Schema.String
})

const IsEndsWith$ = Schema.Struct({
  _tag: Schema.tag("isEndsWith"),
  endsWith: Schema.String
})

const IsIncludes$ = Schema.Struct({
  _tag: Schema.tag("isIncludes"),
  includes: Schema.String
})

const IsUppercased$ = Schema.Struct({
  _tag: Schema.tag("isUppercased")
})

const IsLowercased$ = Schema.Struct({
  _tag: Schema.tag("isLowercased")
})

const IsCapitalized$ = Schema.Struct({
  _tag: Schema.tag("isCapitalized")
})

const IsUncapitalized$ = Schema.Struct({
  _tag: Schema.tag("isUncapitalized")
})

const IsMinLength$ = Schema.Struct({
  _tag: Schema.tag("isMinLength"),
  minLength: Schema.Number
})

const IsMaxLength$ = Schema.Struct({
  _tag: Schema.tag("isMaxLength"),
  maxLength: Schema.Number
})

const IsPattern$ = Schema.Struct({
  _tag: Schema.tag("isPattern"),
  regExp: Schema.RegExp
})

const IsLength$ = Schema.Struct({
  _tag: Schema.tag("isLength"),
  length: Schema.Number
})

const StringMeta = Schema.Union([
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
])

function makeCheck<T>(schema: Schema.Codec<T>) {
  const Check$ref = Schema.suspend((): Schema.Codec<Check<T>> => Check)
  const Check = Schema.Union([
    Schema.Struct({
      _tag: Schema.tag("Filter"),
      annotations: Schema.optionalKey(Annotations$),
      meta: schema
    }),
    Schema.Struct({
      _tag: Schema.tag("FilterGroup"),
      annotations: Schema.optionalKey(Annotations$),
      meta: Schema.UndefinedOr(schema),
      checks: Schema.TupleWithRest(Schema.Tuple([Check$ref, Check$ref]), [Check$ref])
    })
  ])
  return Check
}

/**
 * @since 4.0.0
 */
export const String$ = Schema.Struct({
  _tag: Schema.tag("String"),
  annotations: Schema.optionalKey(Annotations$),
  checks: Schema.Array(makeCheck(StringMeta)),
  contentMediaType: Schema.optional(Schema.String),
  contentSchema: Schema.optional(AST$ref)
}).annotate({ identifier: "String" })

const IsInt$ = Schema.Struct({
  _tag: Schema.tag("isInt")
})

const IsMultipleOf$ = Schema.Struct({
  _tag: Schema.tag("isMultipleOf"),
  divisor: Schema.Number
})

const IsInt32$ = Schema.Struct({
  _tag: Schema.tag("isInt32")
})

const IsUint32$ = Schema.Struct({
  _tag: Schema.tag("isUint32")
})

const IsFinite$ = Schema.Struct({
  _tag: Schema.tag("isFinite")
})

function makeIsGreaterThanOrEqualTo<S extends Schema.Top>(minimum: S) {
  return Schema.Struct({
    _tag: Schema.tag("isGreaterThanOrEqualTo"),
    minimum
  })
}

function makeIsLessThanOrEqualTo<S extends Schema.Top>(maximum: S) {
  return Schema.Struct({
    _tag: Schema.tag("isLessThanOrEqualTo"),
    maximum
  })
}

function makeIsGreaterThan<S extends Schema.Top>(exclusiveMinimum: S) {
  return Schema.Struct({
    _tag: Schema.tag("isGreaterThan"),
    exclusiveMinimum
  })
}

function makeIsLessThan<S extends Schema.Top>(exclusiveMaximum: S) {
  return Schema.Struct({
    _tag: Schema.tag("isLessThan"),
    exclusiveMaximum
  })
}

function makeIsBetween<S extends Schema.Top>(minimum: S, maximum: S) {
  return Schema.Struct({
    _tag: Schema.tag("isBetween"),
    minimum,
    maximum
  })
}

const NumberMeta$ = Schema.Union([
  IsInt$,
  IsMultipleOf$,
  IsInt32$,
  IsUint32$,
  IsFinite$,
  makeIsGreaterThanOrEqualTo(Schema.Number),
  makeIsLessThanOrEqualTo(Schema.Number),
  makeIsGreaterThan(Schema.Number),
  makeIsLessThan(Schema.Number),
  makeIsBetween(Schema.Number, Schema.Number)
])

/**
 * @since 4.0.0
 */
export const Number$ = Schema.Struct({
  _tag: Schema.tag("Number"),
  annotations: Schema.optionalKey(Annotations$),
  checks: Schema.Array(makeCheck(NumberMeta$))
}).annotate({ identifier: "Number" })

/**
 * @since 4.0.0
 */
export const Boolean$ = Schema.Struct({
  _tag: Schema.tag("Boolean"),
  annotations: Schema.optionalKey(Annotations$)
}).annotate({ identifier: "Boolean" })

const BigIntMeta$ = Schema.Union([
  makeIsGreaterThanOrEqualTo(Schema.BigInt),
  makeIsLessThanOrEqualTo(Schema.BigInt),
  makeIsGreaterThan(Schema.BigInt),
  makeIsLessThan(Schema.BigInt),
  makeIsBetween(Schema.BigInt, Schema.BigInt)
])

/**
 * @since 4.0.0
 */
export const BigInt$ = Schema.Struct({
  _tag: Schema.tag("BigInt"),
  annotations: Schema.optionalKey(Annotations$),
  checks: Schema.Array(makeCheck(BigIntMeta$))
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
])

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
  parts: Schema.Array(AST$ref)
}).annotate({ identifier: "TemplateLiteral" })

/**
 * @since 4.0.0
 */
export const Element$ = Schema.Struct({
  isOptional: Schema.Boolean,
  ast: AST$ref
}).annotate({ identifier: "Element" })

/**
 * @since 4.0.0
 */
export const Arrays$ = Schema.Struct({
  _tag: Schema.tag("Arrays"),
  annotations: Schema.optionalKey(Annotations$),
  elements: Schema.Array(Element$),
  rest: Schema.Array(AST$ref)
}).annotate({ identifier: "Arrays" })

/**
 * @since 4.0.0
 */
export const PropertySignature$ = Schema.Struct({
  annotations: Schema.optionalKey(Annotations$),
  name: Schema.PropertyKey,
  type: AST$ref,
  isOptional: Schema.Boolean,
  isMutable: Schema.Boolean
}).annotate({ identifier: "PropertySignature" })

/**
 * @since 4.0.0
 */
export const IndexSignature$ = Schema.Struct({
  parameter: AST$ref,
  type: AST$ref
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
  types: Schema.Array(AST$ref),
  mode: Schema.Literals(["anyOf", "oneOf"])
}).annotate({ identifier: "Union" })

/**
 * @since 4.0.0
 */
export const Reference$ = Schema.Struct({
  _tag: Schema.tag("Reference"),
  annotations: Schema.optionalKey(Annotations$),
  $ref: Schema.String
}).annotate({ identifier: "Reference" })

/**
 * @since 4.0.0
 */
const DateMeta$ = Schema.Union([
  Schema.Struct({
    _tag: Schema.tag("isValidDate")
  }),
  makeIsGreaterThanOrEqualTo(Schema.Number),
  makeIsLessThanOrEqualTo(Schema.Number),
  makeIsGreaterThan(Schema.Number),
  makeIsLessThan(Schema.Number),
  makeIsBetween(Schema.Number, Schema.Number)
])

/**
 * @since 4.0.0
 */
export const External$ = Schema.Struct({
  _tag: Schema.tag("External"),
  annotations: Schema.optionalKey(Annotations$),
  typeParameters: Schema.Array(AST$ref),
  checks: Schema.Array(makeCheck(DateMeta$))
}).annotate({ identifier: "External" })

/**
 * @since 4.0.0
 */
export const AST$ = Schema.Union([
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
  External$
]).annotate({ identifier: "AST" })

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export type Document = {
  readonly ast: AST
  readonly definitions: Record<string, AST>
}

/**
 * @since 4.0.0
 */
export function fromAST(ast: SchemaAST.AST): Document {
  const visited = new Set<SchemaAST.AST>()
  const definitions: Record<string, AST> = {}

  return {
    ast: recur(ast),
    definitions
  }

  function recur(ast: SchemaAST.AST, ignoreIdentifier = false): AST {
    if (!ignoreIdentifier) {
      const $ref = Annotations.resolveIdentifier(ast)
      if ($ref !== undefined) {
        definitions[$ref] = recur(ast, true)
        return { _tag: "Reference", $ref }
      }
    }
    const out: AST = on(ast)
    if (ast.annotations) {
      return { ...out, annotations: ast.annotations }
    }
    return out
  }

  function on(ast: SchemaAST.AST): AST {
    visited.add(ast)
    switch (ast._tag) {
      case "Suspend": {
        const thunk = ast.thunk()
        if (visited.has(thunk)) {
          const $ref = Annotations.resolveIdentifier(thunk)
          if ($ref !== undefined) {
            return {
              _tag: "Reference",
              $ref
            }
          } else {
            throw new Error("Suspended schema without identifier detected")
          }
        } else {
          return recur(thunk)
        }
      }
      case "Declaration":
        return {
          _tag: "External",
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
        if (typeof contentMediaType === "string" && SchemaAST.isAST(contentSchema)) {
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
          elements: ast.elements.map((e) => ({ isOptional: SchemaAST.isOptional(e), ast: recur(e) })),
          rest: ast.rest.map((r) => recur(r))
        }
      case "Objects":
        return {
          _tag: ast._tag,
          propertySignatures: ast.propertySignatures.map((ps) => {
            const out: PropertySignature = {
              name: ps.name,
              type: recur(ps.type),
              isOptional: SchemaAST.isOptional(ps.type),
              isMutable: SchemaAST.isMutable(ps.type)
            }
            if (ps.type.context?.annotations) {
              return { ...out, annotations: ps.type.context.annotations }
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
  checks: readonly [SchemaAST.Check<any>, ...Array<SchemaAST.Check<any>>] | undefined
): Array<Check<any>> {
  if (!checks) return []
  function getCheck(c: SchemaAST.Check<any>): Check<any> | undefined {
    switch (c._tag) {
      case "Filter": {
        const meta = c.annotations?.meta
        if (meta) {
          const out: Check<any> = { _tag: "Filter", meta }
          if (c.annotations) {
            return { ...out, annotations: c.annotations }
          }
          return out
        }
        return undefined
      }
      case "FilterGroup": {
        const out: Check<any> = {
          _tag: "FilterGroup",
          meta: c.annotations?.meta,
          checks: fromASTChecks(c.checks)
        }
        if (c.annotations) {
          return { ...out, annotations: c.annotations }
        }
        return out
      }
    }
  }
  return checks.map(getCheck).filter((c) => c !== undefined)
}

const serializerJson = Schema.toCodecJson(AST$)
const encodeUnknownSync = Schema.encodeUnknownSync(serializerJson)
const decodeUnknownSync = Schema.decodeUnknownSync(serializerJson)

/**
 * @since 4.0.0
 */
export type JsonValue = Getter.Tree<null | string | number | boolean>

/**
 * @since 4.0.0
 */
export function toJson(ast: AST): JsonValue {
  return encodeUnknownSync(ast) as JsonValue
}

/**
 * @since 4.0.0
 */
export function fromJson(u: unknown): AST {
  return decodeUnknownSync(u)
}

/**
 * @since 4.0.0
 */
export type Resolver<O> = (ast: External | Reference, recur: (ast: AST) => O) => O

/**
 * @since 4.0.0
 */
export function toCode(document: Document, options?: {
  readonly resolver?: Resolver<string> | undefined
}): string {
  const resolver = options?.resolver ?? defaultResolver
  const ast = document.ast

  if (ast._tag === "Reference") {
    const definition = document.definitions[ast.$ref]
    if (definition !== undefined) return recur(definition)
  }
  return recur(ast)

  function defaultResolver(): string {
    return `Schema.Unknown`
  }

  function recur(ast: AST): string {
    const b = on(ast)
    switch (ast._tag) {
      default:
        return b + toCodeAnnotate(ast.annotations)
      case "Reference":
      case "External":
        return b
      case "String":
      case "Number":
      case "BigInt":
        return b + toCodeAnnotate(ast.annotations) + toCodeChecks(ast.checks)
    }
  }

  function on(ast: AST): string {
    switch (ast._tag) {
      case "External":
      case "Reference":
        return resolver(ast, recur)
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
        return `Schema.${ast._tag}`
      case "Literal":
        return `Schema.Literal(${format(ast.literal)})`
      case "UniqueSymbol": {
        const key = globalThis.Symbol.keyFor(ast.symbol)
        if (key === undefined) {
          throw new Error("Cannot generate code for UniqueSymbol created without Symbol.for()")
        }
        return `Schema.UniqueSymbol(Symbol.for(${format(key)}))`
      }
      case "ObjectKeyword":
        return "Schema.ObjectKeyword"
      case "Enum":
        return `Schema.Enum([${ast.enums.map(([key, value]) => `[${format(key)}, ${format(value)}]`).join(", ")}])`
      case "TemplateLiteral":
        return `Schema.TemplateLiteral([${ast.parts.map((p) => recur(p)).join(", ")}])`
      case "Arrays": {
        const elements = ast.elements.map((e) => toCodeIsOptional(e.isOptional, recur(e.ast)))
        const rest = ast.rest.map((r) => recur(r))
        if (Arr.isArrayNonEmpty(rest)) {
          if (elements.length === 0 && rest.length === 1) {
            return `Schema.Array(${rest[0]})`
          }
          return `Schema.TupleWithRest(Schema.Tuple([${elements.join(", ")}]), [${rest.join(", ")}])`
        }
        return `Schema.Tuple([${elements.join(", ")}])`
      }
      case "Objects": {
        const propertySignatures = ast.propertySignatures.map((p) =>
          `${formatPropertyKey(p.name)}: ${toCodeIsMutable(p.isMutable, toCodeIsOptional(p.isOptional, recur(p.type)))}`
        )
        const indexSignatures = ast.indexSignatures.map((i) => `Schema.Record(${recur(i.parameter)}, ${recur(i.type)})`)
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
        const mode = ast.mode === "anyOf" ? "" : `, { mode: "oneOf" }`
        return `Schema.Union([${ast.types.map((t) => recur(t)).join(", ")}]${mode})`
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
    case "isFinite":
      return `Schema.isFinite(${ca})`
    case "isInt":
      return `Schema.isInt(${ca})`
    case "isInt32":
      return `Schema.isInt32(${ca})`
    case "isUint32":
      return `Schema.isUint32(${ca})`
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
    case "isValidDate":
      return `Schema.isValidDate(${ca})`
    case "isMinProperties":
      return `Schema.isMinProperties(${filter.meta.minProperties}${ca})`
    case "isMaxProperties":
      return `Schema.isMaxProperties(${filter.meta.maxProperties}${ca})`
    case "isPropertiesLength":
      return `Schema.isPropertiesLength(${filter.meta.length}${ca})`
    case "isUnique":
      return `Schema.isUnique(${a})`
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
 * @since 4.0.0
 */
export function toSchema<S extends Schema.Top = Schema.Top>(ast: AST): S {
  return recur(ast) as S

  function recur(ast: AST): Schema.Top {
    let out = on(ast)
    if (ast.annotations) out = out.annotate(ast.annotations)
    out = toSchemaChecks(out, ast)
    return out
  }

  function on(ast: AST): Schema.Top {
    switch (ast._tag) {
      case "External":
      case "Reference":
        return Schema.Unknown // TODO
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
        return Schema.Literal(ast.literal)
      case "UniqueSymbol":
        return Schema.UniqueSymbol(ast.symbol)
      case "ObjectKeyword":
        return Schema.ObjectKeyword
      case "Enum":
        return Schema.Enum(Object.fromEntries(ast.enums))
      case "TemplateLiteral": {
        const parts = ast.parts.map(recur) as Schema.TemplateLiteral.Parts
        return Schema.TemplateLiteral(parts)
      }
      case "Arrays": {
        const elements = ast.elements.map((e) => {
          const schema = recur(e.ast)
          return e.isOptional ? Schema.optionalKey(schema) : schema
        })
        const rest = ast.rest.map(recur)
        if (Arr.isArrayNonEmpty(rest)) {
          if (ast.elements.length === 0 && ast.rest.length === 1) {
            return Schema.Array(rest[0])
          }
          return Schema.TupleWithRest(Schema.Tuple(elements), rest)
        }
        return Schema.Tuple(elements)
      }
      case "Objects": {
        const fields: Record<PropertyKey, Schema.Top> = {}
        for (const ps of ast.propertySignatures) {
          const schema = recur(ps.type)
          fields[ps.name] = ps.isOptional ?
            ps.isMutable ? Schema.mutableKey(Schema.optionalKey(schema)) : Schema.optionalKey(schema) :
            ps.isMutable ?
            Schema.mutableKey(schema)
            : schema
        }
        const indexSignatures = ast.indexSignatures.map((is) =>
          Schema.Record(recur(is.parameter) as Schema.Record.Key, recur(is.type))
        )
        if (Arr.isArrayNonEmpty(indexSignatures)) {
          if (ast.propertySignatures.length === 0 && indexSignatures.length === 1) {
            return indexSignatures[0]
          }
          return Schema.StructWithRest(Schema.Struct(fields), indexSignatures)
        }
        return Schema.Struct(fields)
      }
      case "Union":
        return Schema.Union(ast.types.map(recur), { mode: ast.mode })
    }
  }
}

function toSchemaChecks(schema: Schema.Top, ast: AST): Schema.Top {
  switch (ast._tag) {
    case "String": {
      if (ast.checks) {
        const checks = ast.checks.map((c) => {
          switch (c._tag) {
            case "Filter": {
              const meta = c.meta
              switch (meta._tag) {
                case "isMinLength":
                  return Schema.isMinLength(meta.minLength, c.annotations)
                case "isMaxLength":
                  return Schema.isMaxLength(meta.maxLength, c.annotations)
                case "isPattern":
                  return Schema.isPattern(meta.regExp, c.annotations)
                case "isLength":
                  return Schema.isLength(meta.length, c.annotations)
                case "isTrimmed":
                  return Schema.isTrimmed(c.annotations)
                case "isUUID":
                  return Schema.isUUID(meta.version, c.annotations)
                case "isULID":
                  return Schema.isULID(c.annotations)
                case "isBase64":
                  return Schema.isBase64(c.annotations)
                case "isBase64Url":
                  return Schema.isBase64Url(c.annotations)
                case "isStartsWith":
                  return Schema.isStartsWith(meta.startsWith, c.annotations)
                case "isEndsWith":
                  return Schema.isEndsWith(meta.endsWith, c.annotations)
                case "isIncludes":
                  return Schema.isIncludes(meta.includes, c.annotations)
                case "isUppercased":
                  return Schema.isUppercased(c.annotations)
                case "isLowercased":
                  return Schema.isLowercased(c.annotations)
                case "isCapitalized":
                  return Schema.isCapitalized(c.annotations)
                case "isUncapitalized":
                  return Schema.isUncapitalized(c.annotations)
                case "isNumberString":
                  return Schema.isNumberString(c.annotations)
                case "isBigIntString":
                  return Schema.isBigIntString(c.annotations)
                case "isSymbolString":
                  return Schema.isSymbolString(c.annotations)
              }
            }
            case "FilterGroup":
              throw new Error("Unsupported FilterGroup", { cause: c })
          }
        })
        if (Arr.isArrayNonEmpty(checks)) {
          return (schema as Schema.String).check(...checks)
        }
      }
      return schema
    }
    // TODO: other cases
    default:
      return schema
  }
}

/**
 * Return a Draft 2020-12 JSON Schema Document.
 *
 * @since 4.0.0
 */
export function toJsonSchema(document: Document): Schema.JsonSchema.Document {
  return {
    source: "draft-2020-12",
    schema: recur(document.ast),
    definitions: Rec.map(document.definitions, (d) => recur(d))
  }

  function recur(ast: AST): Schema.JsonSchema {
    let jsonSchema: Schema.JsonSchema = on(ast)
    jsonSchema = mergeJsonSchemaAnnotations(jsonSchema, ast.annotations)
    if ((ast._tag === "String" || ast._tag === "Number") && ast.checks.length > 0) {
      jsonSchema = applyChecks(jsonSchema, ast.checks, ast._tag)
    }
    return jsonSchema
  }

  function on(ast: AST): Schema.JsonSchema {
    switch (ast._tag) {
      case "External":
        return {} // TODO
      case "Reference":
        return { $ref: `#/$defs/${escapeJsonPointer(ast.$ref)}` }
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
        if (ast.contentMediaType !== undefined) {
          out.contentMediaType = ast.contentMediaType
        }
        if (ast.contentSchema !== undefined) {
          out.contentSchema = recur(ast.contentSchema)
        }
        return out
      }
      case "Number":
        return { type: "number" }
      case "Boolean":
        return { type: "boolean" }
      case "Literal": {
        const literal = ast.literal
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
        const enumValues = ast.enums.map(([, value]) => value)
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
        const pattern = ast.parts.map(getPartPattern).join("")
        return { type: "string", pattern: `^${pattern}$` }
      }
      case "Arrays": {
        const out: Schema.JsonSchema = { type: "array" }
        let minItems = ast.elements.length
        const items: Array<Schema.JsonSchema> = ast.elements.map((e) => {
          if (e.isOptional) minItems--
          return recur(e.ast)
        })
        if (items.length > 0) {
          out.prefixItems = items
          out.minItems = minItems
        }
        if (ast.rest.length > 0) {
          out.items = recur(ast.rest[0])
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
        if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
          return { anyOf: [{ type: "object" }, { type: "array" }] }
        }
        const out: Schema.JsonSchema = { type: "object" }
        const properties: Record<string, Schema.JsonSchema> = {}
        const required: Array<string> = []

        for (const ps of ast.propertySignatures) {
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
        if (ast.indexSignatures.length > 0) {
          // For draft-2020-12, we can use patternProperties or additionalProperties
          const firstIndex = ast.indexSignatures[0]
          out.additionalProperties = recur(firstIndex.type)
        } else {
          // No index signatures: additional properties are not allowed
          out.additionalProperties = false
        }

        return out
      }
      case "Union": {
        const types = ast.types.map((t) => recur(t)).filter((t) => Object.keys(t).length > 0)
        if (types.length === 0) {
          return { not: {} }
        }
        const result = ast.mode === "anyOf" ? { anyOf: types } : { oneOf: types }
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
    if (typeof annotations.title === "string") {
      out.title = annotations.title
    }
    if (typeof annotations.description === "string") {
      out.description = annotations.description
    }
    if (annotations.default !== undefined) {
      out.default = annotations.default
    }
    if (Array.isArray(annotations.examples)) {
      out.examples = annotations.examples
    }

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
  tag: "String" | "Number"
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

  if (tag === "String") {
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
  } else {
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
  }

  return mergeJsonSchemaAnnotations(fragment, check.annotations)
}

function applyChecks(
  jsonSchema: Schema.JsonSchema,
  checks: ReadonlyArray<Check<any>>,
  tag: "String" | "Number"
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

function containsUndefined(ast: AST): boolean {
  switch (ast._tag) {
    case "Undefined":
      return true
    case "Union":
      return ast.types.some(containsUndefined)
    default:
      return false
  }
}

function getPartPattern(part: AST): string {
  switch (part._tag) {
    case "String":
      return SchemaAST.STRING_PATTERN
    case "Number":
      return SchemaAST.NUMBER_PATTERN
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
export function toFormatter(ast: AST, options?: {
  readonly resolver?: Resolver<Formatter<any>> | undefined
  readonly onBefore?: (ast: AST, recur: (ast: AST) => Formatter<any>) => Option.Option<Formatter<any>>
}): Formatter<unknown> {
  const resolver = options?.resolver ?? defaultResolver

  return recur(ast)

  function defaultResolver(): Formatter<unknown> {
    return format
  }

  function recur(ast: AST): Formatter<unknown> {
    if (options?.onBefore) {
      const onBefore = options.onBefore(ast, recur)
      if (Option.isSome(onBefore)) {
        return onBefore.value
      }
    }
    return on(ast)
  }

  function on(ast: AST): Formatter<unknown> {
    switch (ast._tag) {
      case "Void":
        return () => "void"
      case "Never":
        return () => "never"
      case "External":
      case "Reference":
        return resolver(ast, recur)
      case "Null":
      case "Undefined":
      case "Unknown":
      case "Any":
      case "String":
      case "Number":
      case "Boolean":
      case "BigInt":
      case "Symbol":
      case "Literal":
      case "UniqueSymbol":
      case "ObjectKeyword":
      case "Enum":
      case "TemplateLiteral":
      case "Arrays":
      case "Union":
        return format
      case "Objects": {
        if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
          return format
        }
        return format
      }
    }
  }
}
