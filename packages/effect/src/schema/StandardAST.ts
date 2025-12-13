/**
 * @since 4.0.0
 */
import * as Arr from "../collections/Array.ts"
import type { Formatter } from "../data/Formatter.ts"
import { format, formatPropertyKey } from "../data/Formatter.ts"
import * as Option from "../data/Option.ts"
import * as RegEx from "../RegExp.ts"
import * as AnnotationsModule from "./Annotations.ts"
import * as AST from "./AST.ts"
import type * as Getter from "./Getter.ts"
import * as Schema from "./Schema.ts"

// -----------------------------------------------------------------------------
// specification
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export type ExternalNode = {
  readonly _tag: "External"
  readonly annotations?: AnnotationsModule.Annotations | undefined
  readonly typeParameters: ReadonlyArray<StandardAST>
  readonly checks: ReadonlyArray<Check<DateCheckMeta>>
}

/**
 * @since 4.0.0
 */
export type ReferenceNode = {
  readonly _tag: "Reference"
  readonly annotations?: AnnotationsModule.Annotations | undefined
  readonly $ref: string
}

/**
 * @since 4.0.0
 */
export type StandardAST =
  | ExternalNode
  | ReferenceNode
  | {
    readonly _tag: "Null"
    readonly annotations?: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Undefined"
    readonly annotations?: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Void"
    readonly annotations?: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Never"
    readonly annotations?: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Unknown"
    readonly annotations?: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Any"
    readonly annotations?: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "String"
    readonly annotations?: AnnotationsModule.Annotations | undefined
    readonly checks: ReadonlyArray<Check<StringCheckMeta>>
    readonly contentMediaType?: string | undefined
    readonly contentSchema?: StandardAST | undefined
  }
  | {
    readonly _tag: "Number"
    readonly annotations?: AnnotationsModule.Annotations | undefined
    readonly checks: ReadonlyArray<Check<NumberCheckMeta>>
  }
  | {
    readonly _tag: "Boolean"
    readonly annotations?: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "BigInt"
    readonly annotations?: AnnotationsModule.Annotations | undefined
    readonly checks: ReadonlyArray<Check<BigIntCheckMeta>>
  }
  | {
    readonly _tag: "Symbol"
    readonly annotations?: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Literal"
    readonly annotations?: AnnotationsModule.Annotations | undefined
    readonly literal: string | number | boolean | bigint
  }
  | {
    readonly _tag: "UniqueSymbol"
    readonly annotations?: AnnotationsModule.Annotations | undefined
    readonly symbol: symbol
  }
  | {
    readonly _tag: "ObjectKeyword"
    readonly annotations?: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Enum"
    readonly annotations?: AnnotationsModule.Annotations | undefined
    readonly enums: ReadonlyArray<readonly [string, string | number]>
  }
  | {
    readonly _tag: "TemplateLiteral"
    readonly annotations?: AnnotationsModule.Annotations | undefined
    readonly parts: ReadonlyArray<StandardAST>
  }
  | {
    readonly _tag: "Arrays"
    readonly annotations?: AnnotationsModule.Annotations | undefined
    readonly elements: ReadonlyArray<StandardAST>
    readonly rest: ReadonlyArray<StandardAST>
  }
  | {
    readonly _tag: "Objects"
    readonly annotations?: AnnotationsModule.Annotations | undefined
    readonly propertySignatures: ReadonlyArray<PropertySignature>
    readonly indexSignatures: ReadonlyArray<IndexSignature>
  }
  | {
    readonly _tag: "Union"
    readonly annotations?: AnnotationsModule.Annotations | undefined
    readonly types: ReadonlyArray<StandardAST>
    readonly mode: "anyOf" | "oneOf"
  }

/**
 * @since 4.0.0
 */
export type PropertySignature = {
  readonly name: PropertyKey
  readonly type: StandardAST
  readonly isOptional: boolean
  readonly isMutable: boolean
  readonly annotations?: AnnotationsModule.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export type IndexSignature = {
  readonly parameter: StandardAST
  readonly type: StandardAST
}

/**
 * @since 4.0.0
 */
export type Check<T> = Filter<T> | FilterGroup<T>

/**
 * @since 4.0.0
 */
export type Filter<M> = {
  readonly _tag: "Filter"
  readonly annotations?: AnnotationsModule.Annotations | undefined
  readonly meta: M
}

/**
 * @since 4.0.0
 */
export type FilterGroup<M> = {
  readonly _tag: "FilterGroup"
  readonly meta: M | undefined
  readonly annotations?: AnnotationsModule.Annotations | undefined
  readonly checks: ReadonlyArray<Check<M>>
}

/**
 * @since 4.0.0
 */
export type StringCheckMeta = AnnotationsModule.BuiltInMetaRegistry[
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
  | AnnotationsModule.BuiltInMetaRegistry[
    | "isInt"
    | "isInt32"
    | "isUint32"
    | "isFinite"
    | "isMultipleOf"
  ]
  | AnnotationsModule.isGreaterThanOrEqualTo<number>
  | AnnotationsModule.isLessThanOrEqualTo<number>
  | AnnotationsModule.isGreaterThan<number>
  | AnnotationsModule.isLessThan<number>
  | AnnotationsModule.isBetween<number>

/**
 * @since 4.0.0
 */
export type BigIntCheckMeta =
  | AnnotationsModule.isGreaterThanOrEqualTo<bigint>
  | AnnotationsModule.isLessThanOrEqualTo<bigint>
  | AnnotationsModule.isGreaterThan<bigint>
  | AnnotationsModule.isLessThan<bigint>
  | AnnotationsModule.isBetween<bigint>

/**
 * @since 4.0.0
 */
export type DateCheckMeta =
  | AnnotationsModule.BuiltInMetaRegistry["isValidDate"]
  | AnnotationsModule.isGreaterThanOrEqualTo<number>
  | AnnotationsModule.isLessThanOrEqualTo<number>
  | AnnotationsModule.isGreaterThan<number>
  | AnnotationsModule.isLessThan<number>
  | AnnotationsModule.isBetween<number>

// -----------------------------------------------------------------------------
// schemas
// -----------------------------------------------------------------------------

const StandardAST$ref = Schema.suspend((): Schema.Codec<StandardAST, unknown> => StandardAST)

type PrimitiveTree = Getter.Tree<null | number | boolean | bigint | symbol | string>

const PrimitiveTree$ = Schema.suspend((): Schema.Codec<PrimitiveTree> => PrimitiveTree)

/**
 * @since 4.0.0
 */
export const PrimitiveTree = Schema.Union([
  Schema.Null,
  Schema.Number,
  Schema.Boolean,
  Schema.BigInt,
  Schema.Symbol,
  Schema.String,
  Schema.Array(PrimitiveTree$),
  Schema.Record(Schema.String, PrimitiveTree$)
])

/**
 * @since 4.0.0
 */
export const Annotations = Schema.Record(Schema.String, Schema.Unknown)

/**
 * @since 4.0.0
 */
export const Null = Schema.Struct({
  _tag: Schema.tag("Null"),
  annotations: Schema.optional(Annotations)
}).annotate({ identifier: "Null" })

/**
 * @since 4.0.0
 */
export const Undefined = Schema.Struct({
  _tag: Schema.tag("Undefined"),
  annotations: Schema.optional(Annotations)
}).annotate({ identifier: "Undefined" })

/**
 * @since 4.0.0
 */
export const Void = Schema.Struct({
  _tag: Schema.tag("Void"),
  annotations: Schema.optional(Annotations)
}).annotate({ identifier: "Void" })

/**
 * @since 4.0.0
 */
export const Never = Schema.Struct({
  _tag: Schema.tag("Never"),
  annotations: Schema.optional(Annotations)
}).annotate({ identifier: "Never" })

/**
 * @since 4.0.0
 */
export const Unknown = Schema.Struct({
  _tag: Schema.tag("Unknown"),
  annotations: Schema.optional(Annotations)
}).annotate({ identifier: "Unknown" })

/**
 * @since 4.0.0
 */
export const Any = Schema.Struct({
  _tag: Schema.tag("Any"),
  annotations: Schema.optional(Annotations)
}).annotate({ identifier: "Any" })

const IsNumberString = Schema.Struct({
  _tag: Schema.tag("isNumberString"),
  regExp: Schema.RegExp
})

const IsBigIntString = Schema.Struct({
  _tag: Schema.tag("isBigIntString"),
  regExp: Schema.RegExp
})

const IsSymbolString = Schema.Struct({
  _tag: Schema.tag("isSymbolString"),
  regExp: Schema.RegExp
})

const IsTrimmed = Schema.Struct({
  _tag: Schema.tag("isTrimmed")
})

const IsUUID = Schema.Struct({
  _tag: Schema.tag("isUUID"),
  regExp: Schema.RegExp,
  version: Schema.UndefinedOr(Schema.Literals([1, 2, 3, 4, 5, 6, 7, 8]))
})

const IsULID = Schema.Struct({
  _tag: Schema.tag("isULID"),
  regExp: Schema.RegExp
})

const IsBase64 = Schema.Struct({
  _tag: Schema.tag("isBase64"),
  regExp: Schema.RegExp
})

const IsBase64Url = Schema.Struct({
  _tag: Schema.tag("isBase64Url"),
  regExp: Schema.RegExp
})

const IsStartsWith = Schema.Struct({
  _tag: Schema.tag("isStartsWith"),
  startsWith: Schema.String
})

const IsEndsWith = Schema.Struct({
  _tag: Schema.tag("isEndsWith"),
  endsWith: Schema.String
})

const IsIncludes = Schema.Struct({
  _tag: Schema.tag("isIncludes"),
  includes: Schema.String
})

const IsUppercased = Schema.Struct({
  _tag: Schema.tag("isUppercased")
})

const IsLowercased = Schema.Struct({
  _tag: Schema.tag("isLowercased")
})

const IsCapitalized = Schema.Struct({
  _tag: Schema.tag("isCapitalized")
})

const IsUncapitalized = Schema.Struct({
  _tag: Schema.tag("isUncapitalized")
})

const IsMinLength = Schema.Struct({
  _tag: Schema.tag("isMinLength"),
  minLength: Schema.Number
})

const IsMaxLength = Schema.Struct({
  _tag: Schema.tag("isMaxLength"),
  maxLength: Schema.Number
})

const IsPattern = Schema.Struct({
  _tag: Schema.tag("isPattern"),
  regExp: Schema.RegExp
})

const IsLength = Schema.Struct({
  _tag: Schema.tag("isLength"),
  length: Schema.Number
})

const StringMeta = Schema.Union([
  IsNumberString,
  IsBigIntString,
  IsSymbolString,
  IsTrimmed,
  IsUUID,
  IsULID,
  IsBase64,
  IsBase64Url,
  IsStartsWith,
  IsEndsWith,
  IsIncludes,
  IsUppercased,
  IsLowercased,
  IsCapitalized,
  IsUncapitalized,
  IsMinLength,
  IsMaxLength,
  IsPattern,
  IsLength
])

function makeCheck<T>(schema: Schema.Codec<T>) {
  const Check$ref = Schema.suspend((): Schema.Codec<Check<T>> => Check)
  const Check = Schema.Union([
    Schema.Struct({
      _tag: Schema.tag("Filter"),
      annotations: Schema.optional(Annotations),
      meta: schema
    }),
    Schema.Struct({
      _tag: Schema.tag("FilterGroup"),
      annotations: Schema.optional(Annotations),
      meta: Schema.UndefinedOr(schema),
      checks: Schema.TupleWithRest(Schema.Tuple([Check$ref, Check$ref]), [Check$ref])
    })
  ])
  return Check
}

/**
 * @since 4.0.0
 */
export const String = Schema.Struct({
  _tag: Schema.tag("String"),
  annotations: Schema.optional(Annotations),
  checks: Schema.Array(makeCheck(StringMeta)),
  contentMediaType: Schema.optional(Schema.String),
  contentSchema: Schema.optional(StandardAST$ref)
}).annotate({ identifier: "String" })

const IsInt = Schema.Struct({
  _tag: Schema.tag("isInt")
})

const IsMultipleOf = Schema.Struct({
  _tag: Schema.tag("isMultipleOf"),
  divisor: Schema.Number
})

const IsInt32 = Schema.Struct({
  _tag: Schema.tag("isInt32")
})

const IsUint32 = Schema.Struct({
  _tag: Schema.tag("isUint32")
})

const IsFinite = Schema.Struct({
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

const NumberMeta = Schema.Union([
  IsInt,
  IsMultipleOf,
  IsInt32,
  IsUint32,
  IsFinite,
  makeIsGreaterThanOrEqualTo(Schema.Number),
  makeIsLessThanOrEqualTo(Schema.Number),
  makeIsGreaterThan(Schema.Number),
  makeIsLessThan(Schema.Number)
])

/**
 * @since 4.0.0
 */
export const Number = Schema.Struct({
  _tag: Schema.tag("Number"),
  annotations: Schema.optional(Annotations),
  checks: Schema.Array(makeCheck(NumberMeta))
}).annotate({ identifier: "Number" })

/**
 * @since 4.0.0
 */
export const Boolean = Schema.Struct({
  _tag: Schema.tag("Boolean"),
  annotations: Schema.optional(Annotations)
}).annotate({ identifier: "Boolean" })

const BigIntMeta = Schema.Union([
  makeIsGreaterThanOrEqualTo(Schema.BigInt),
  makeIsLessThanOrEqualTo(Schema.BigInt),
  makeIsGreaterThan(Schema.BigInt),
  makeIsLessThan(Schema.BigInt)
])

/**
 * @since 4.0.0
 */
export const BigInt = Schema.Struct({
  _tag: Schema.tag("BigInt"),
  annotations: Schema.optional(Annotations),
  checks: Schema.Array(makeCheck(BigIntMeta))
}).annotate({ identifier: "BigInt" })

/**
 * @since 4.0.0
 */
export const Symbol = Schema.Struct({
  _tag: Schema.tag("Symbol"),
  annotations: Schema.optional(Annotations)
}).annotate({ identifier: "Symbol" })

/**
 * @since 4.0.0
 */
export const LiteralValue = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.BigInt
])

/**
 * @since 4.0.0
 */
export const Literal = Schema.Struct({
  _tag: Schema.tag("Literal"),
  annotations: Schema.optional(Annotations),
  literal: LiteralValue
}).annotate({ identifier: "Literal" })

/**
 * @since 4.0.0
 */
export const UniqueSymbol = Schema.Struct({
  _tag: Schema.tag("UniqueSymbol"),
  annotations: Schema.optional(Annotations),
  symbol: Schema.Symbol
}).annotate({ identifier: "UniqueSymbol" })

/**
 * @since 4.0.0
 */
export const ObjectKeyword = Schema.Struct({
  _tag: Schema.tag("ObjectKeyword"),
  annotations: Schema.optional(Annotations)
}).annotate({ identifier: "ObjectKeyword" })

/**
 * @since 4.0.0
 */
export const Enum = Schema.Struct({
  _tag: Schema.tag("Enum"),
  annotations: Schema.optional(Annotations),
  enums: Schema.Array(
    Schema.Tuple([Schema.String, Schema.Union([Schema.String, Schema.Number])])
  )
}).annotate({ identifier: "Enum" })

/**
 * @since 4.0.0
 */
export const TemplateLiteral = Schema.Struct({
  _tag: Schema.tag("TemplateLiteral"),
  annotations: Schema.optional(Annotations),
  parts: Schema.Array(StandardAST$ref)
}).annotate({ identifier: "TemplateLiteral" })

/**
 * @since 4.0.0
 */
export const Arrays = Schema.Struct({
  _tag: Schema.tag("Arrays"),
  annotations: Schema.optional(Annotations),
  elements: Schema.Array(StandardAST$ref),
  rest: Schema.Array(StandardAST$ref)
}).annotate({ identifier: "Arrays" })

/**
 * @since 4.0.0
 */
export const PropertySignature = Schema.Struct({
  annotations: Schema.optional(Annotations),
  name: Schema.PropertyKey,
  type: StandardAST$ref,
  isOptional: Schema.Boolean,
  isMutable: Schema.Boolean
}).annotate({ identifier: "PropertySignature" })

/**
 * @since 4.0.0
 */
export const IndexSignature = Schema.Struct({
  parameter: StandardAST$ref,
  type: StandardAST$ref
}).annotate({ identifier: "IndexSignature" })

/**
 * @since 4.0.0
 */
export const Objects = Schema.Struct({
  _tag: Schema.tag("Objects"),
  annotations: Schema.optional(Annotations),
  propertySignatures: Schema.Array(PropertySignature),
  indexSignatures: Schema.Array(IndexSignature)
}).annotate({ identifier: "Objects" })

/**
 * @since 4.0.0
 */
export const Union = Schema.Struct({
  _tag: Schema.tag("Union"),
  annotations: Schema.optional(Annotations),
  types: Schema.Array(StandardAST$ref),
  mode: Schema.Literals(["anyOf", "oneOf"])
}).annotate({ identifier: "Union" })

/**
 * @since 4.0.0
 */
export const StandardAST = Schema.Union([
  Null,
  Undefined,
  Void,
  Never,
  Unknown,
  Any,
  String,
  Number,
  Boolean,
  BigInt,
  Symbol,
  Literal,
  UniqueSymbol,
  ObjectKeyword,
  Enum,
  TemplateLiteral,
  Arrays,
  Objects,
  Union
]).annotate({ identifier: "AST" })

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export function fromAST(ast: AST.AST): StandardAST {
  const visited = new Set<AST.AST>()

  return recur(ast)

  function recur(ast: AST.AST): StandardAST {
    visited.add(ast)
    switch (ast._tag) {
      case "Suspend": {
        const thunk = ast.thunk()
        if (visited.has(thunk)) {
          const thunkReference = AnnotationsModule.resolveIdentifier(thunk)
          if (thunkReference !== undefined) {
            return {
              _tag: "Reference",
              annotations: undefined,
              $ref: thunkReference
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
          annotations: fromASTAnnotations(ast.annotations),
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
        return { _tag: ast._tag, annotations: fromASTAnnotations(ast.annotations) }
      case "String": {
        const contentMediaType = ast.annotations?.contentMediaType
        const contentSchema = ast.annotations?.contentSchema
        if (typeof contentMediaType === "string" && AST.isAST(contentSchema)) {
          return {
            _tag: ast._tag,
            annotations: undefined,
            checks: [],
            contentMediaType,
            contentSchema: recur(contentSchema)
          }
        }
        return { _tag: ast._tag, annotations: fromASTAnnotations(ast.annotations), checks: fromASTChecks(ast.checks) }
      }
      case "Number":
      case "BigInt":
        return { _tag: ast._tag, annotations: fromASTAnnotations(ast.annotations), checks: fromASTChecks(ast.checks) }
      case "Literal":
        return { _tag: ast._tag, annotations: fromASTAnnotations(ast.annotations), literal: ast.literal }
      case "UniqueSymbol":
        return { _tag: ast._tag, annotations: fromASTAnnotations(ast.annotations), symbol: ast.symbol }
      case "ObjectKeyword":
        return { _tag: ast._tag, annotations: fromASTAnnotations(ast.annotations) }
      case "Enum":
        return { _tag: ast._tag, annotations: fromASTAnnotations(ast.annotations), enums: ast.enums }
      case "TemplateLiteral":
        return {
          _tag: ast._tag,
          annotations: fromASTAnnotations(ast.annotations),
          parts: ast.parts.map((p) => recur(p))
        }
      case "Arrays":
        return {
          _tag: ast._tag,
          annotations: fromASTAnnotations(ast.annotations),
          elements: ast.elements.map((e) => recur(e)),
          rest: ast.rest.map((r) => recur(r))
        }
      case "Objects":
        return {
          _tag: ast._tag,
          annotations: fromASTAnnotations(ast.annotations),
          propertySignatures: ast.propertySignatures.map((ps) => ({
            annotations: fromASTAnnotations(ps.type.context?.annotations),
            name: ps.name,
            type: recur(ps.type),
            isOptional: AST.isOptional(ps.type),
            isMutable: AST.isMutable(ps.type)
          })),
          indexSignatures: ast.indexSignatures.map((is) => ({
            parameter: recur(is.parameter),
            type: recur(is.type)
          }))
        }
      case "Union":
        return {
          _tag: ast._tag,
          annotations: fromASTAnnotations(ast.annotations),
          types: ast.types.map((t) => recur(t)),
          mode: ast.mode
        }
    }
  }
}

const fromASTAnnotationsBlacklist: Set<string> = new Set([
  "arbitraryConstraint",
  "serializerJson",
  "serializer",
  "expected",
  "meta",
  "~structural"
])

function fromASTAnnotations(
  annotations: AnnotationsModule.Annotations | undefined
): AnnotationsModule.Annotations | undefined {
  if (!annotations) return undefined
  const entries = Object.entries(annotations).filter(([key, value]) =>
    !fromASTAnnotationsBlacklist.has(key) && typeof value !== "function"
  )
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
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
          return { _tag: "Filter", meta, annotations: fromASTAnnotations(c.annotations) }
        }
        return undefined
      }
      case "FilterGroup": {
        return {
          _tag: "FilterGroup",
          meta: c.annotations?.meta,
          annotations: fromASTAnnotations(c.annotations),
          checks: fromASTChecks(c.checks)
        }
      }
    }
  }
  return checks.map(getCheck).filter((c) => c !== undefined)
}

const serializerJson = Schema.toSerializerJson(StandardAST)
const encodeUnknownSync = Schema.encodeUnknownSync(serializerJson)
const decodeUnknownSync = Schema.decodeUnknownSync(serializerJson)

/**
 * @since 4.0.0
 */
export type JsonValue = Getter.Tree<null | string | number | boolean>

/**
 * @since 4.0.0
 */
export function toJson(ast: StandardAST): JsonValue {
  return encodeUnknownSync(ast) as JsonValue
}

/**
 * @since 4.0.0
 */
export function fromJson(u: unknown): StandardAST {
  return decodeUnknownSync(u)
}

/**
 * @since 4.0.0
 */
export type Resolver<O> = (ast: ExternalNode | ReferenceNode, recur: (ast: StandardAST) => O) => O

/**
 * @since 4.0.0
 */
export function toCode(ast: StandardAST, options?: {
  readonly resolver?: Resolver<string> | undefined
}): string {
  const resolver = options?.resolver ?? defaultResolver

  return recur(ast)

  function defaultResolver(): string {
    return `Schema.Unknown`
  }

  function recur(ast: StandardAST): string {
    const b = base(ast)
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

  function base(ast: StandardAST): string {
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
        if (ast.elements.length === 0 && ast.rest.length === 0) {
          return "Schema.Tuple([])"
        }
        if (ast.elements.length === 0 && ast.rest.length > 0) {
          const rest = ast.rest.map((r) => recur(r)).join(", ")
          return `Schema.Array(${rest})`
        }
        if (ast.rest.length === 0) {
          const elements = ast.elements.map((e) => recur(e)).join(", ")
          return `Schema.Tuple([${elements}])`
        }
        const elements = ast.elements.map((e) => recur(e)).join(", ")
        const rest = ast.rest.map((r) => recur(r)).join(", ")
        return `Schema.TupleWithRest(Schema.Tuple([${elements}]), [${rest}])`
      }
      case "Objects": {
        const propertySignatures = ast.propertySignatures.map((p) =>
          `${formatPropertyKey(p.name)}: ${toCodeIsOptional(p.isOptional, recur(p.type))}`
        ).join(", ")
        return `Schema.Struct({ ${propertySignatures} })`
      }
      case "Union": {
        const mode = ast.mode === "anyOf" ? "" : `, { mode: "oneOf" }`
        return `Schema.Union([${ast.types.map((t) => recur(t)).join(", ")}]${mode})`
      }
    }
  }
}

const toCodeAnnotationsBlacklist: Set<string> = new Set([
  "typeConstructor"
])

function toCodeAnnotations(annotations: AnnotationsModule.Annotations | undefined): string {
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
export function toCodeAnnotate(annotations: AnnotationsModule.Annotations | undefined): string {
  const s = toCodeAnnotations(annotations)
  if (s === "") return ""
  return `.annotate(${s})`
}

function toCodeIsOptional(isOptional: boolean, code: string): string {
  return isOptional ? `Schema.optionalKey(${code})` : code
}

function toCodeChecks(checks: ReadonlyArray<Check<AnnotationsModule.BuiltInMeta>>): string {
  if (checks.length === 0) return ""
  return `.check(${checks.map((c) => toCodeCheck(c)).join(", ")})`
}

function toCodeCheck(check: Check<AnnotationsModule.BuiltInMeta>): string {
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

function toCodeFilter(filter: Filter<AnnotationsModule.BuiltInMeta>): string {
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
export function toSchema<S extends Schema.Top = Schema.Top>(ast: StandardAST): S {
  let out = toSchemaBase(ast)
  if (ast.annotations) out = out.annotate(ast.annotations)
  out = toSchemaChecks(out, ast)
  return out as S
}

function toSchemaBase(ast: StandardAST): Schema.Top {
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
      const parts = ast.parts.map(toSchema) as any // TODO: Fix this
      return Schema.TemplateLiteral(parts)
    }
    case "Arrays": {
      if (ast.elements.length === 0 && ast.rest.length === 0) {
        return Schema.Tuple([])
      }
      if (ast.elements.length === 0 && ast.rest.length > 0) {
        return Schema.Array(toSchema(ast.rest[0]))
      }
      if (ast.rest.length === 0) {
        const elements = ast.elements.map(toSchema) as any
        return Schema.Tuple(elements)
      }
      const elements = ast.elements.map(toSchema) as any
      const rest = ast.rest.map(toSchema) as any
      return Schema.TupleWithRest(Schema.Tuple(elements), rest)
    }
    case "Objects": {
      const fields: Record<PropertyKey, Schema.Top> = {}
      for (const ps of ast.propertySignatures) {
        const schema = toSchema(ps.type)
        fields[ps.name] = ps.isOptional ? Schema.optionalKey(schema) : schema
      }
      const out = Schema.Struct(fields)
      // TODO: Handle index signatures
      return out
    }
    case "Union":
      return Schema.Union(ast.types.map(toSchema), { mode: ast.mode })
  }
}

function toSchemaChecks(schema: Schema.Top, ast: StandardAST): Schema.Top {
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
export function toJsonSchema(ast: StandardAST): Schema.JsonSchema.Document {
  const definitions: Schema.JsonSchema.Definitions = {}
  const visited = new Map<StandardAST, string>()

  return {
    source: "draft-2020-12",
    schema: recur(ast),
    definitions
  }

  function recur(ast: StandardAST, ignoreIdentifier = false): Schema.JsonSchema {
    // Handle identifier annotation for definitions
    if (!ignoreIdentifier) {
      const identifier = getIdentifier(ast)
      if (identifier !== undefined) {
        const existing = visited.get(ast)
        if (existing !== undefined) {
          return { $ref: `#/$defs/${escapeJsonPointer(existing)}` }
        }
        visited.set(ast, identifier)
        if (!Object.hasOwn(definitions, identifier)) {
          // Recur with ignoreIdentifier=true to avoid infinite loop
          definitions[identifier] = recur(ast, true)
        }
        return { $ref: `#/$defs/${escapeJsonPointer(identifier)}` }
      }
    }

    switch (ast._tag) {
      case "External": {
        return {} // TODO
      }
      case "Reference":
        return { $ref: `#/$defs/${escapeJsonPointer(ast.$ref)}` }
      default: {
        let jsonSchema: Schema.JsonSchema = base(ast)
        jsonSchema = mergeJsonSchemaAnnotations(jsonSchema, ast.annotations)
        if ((ast._tag === "String" || ast._tag === "Number") && ast.checks.length > 0) {
          jsonSchema = applyChecks(jsonSchema, ast.checks, ast._tag)
        }
        return jsonSchema
      }
    }
  }

  function base(ast: StandardAST): Schema.JsonSchema {
    switch (ast._tag) {
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
        const items: Array<Schema.JsonSchema> = ast.elements.map((e) => recur(e))
        if (items.length > 0) {
          out.prefixItems = items
          out.minItems = items.length
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
      case "Reference":
      case "External":
        // These are handled in recur function
        return {}
    }
  }
}

function escapeJsonPointer(identifier: string): string {
  return identifier.replace(/~/g, "~0").replace(/\//g, "~1")
}

function getJsonSchemaAnnotations(
  annotations: AnnotationsModule.Annotations | undefined
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
  annotations: AnnotationsModule.Annotations | undefined
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

function getIdentifier(ast: StandardAST): string | undefined {
  return typeof ast.annotations?.identifier === "string" ? ast.annotations.identifier : undefined
}

function applyChecks(
  jsonSchema: Schema.JsonSchema,
  checks: ReadonlyArray<Check<any>>,
  astTag: "String" | "Number"
): Schema.JsonSchema {
  let result = jsonSchema
  for (const check of checks) {
    result = applyCheck(result, check, astTag)
  }
  return result
}

function getCheckConstraintFragment(
  check: Check<any>,
  astTag: "String" | "Number"
): Schema.JsonSchema {
  if (check._tag === "FilterGroup") {
    // Recursively collect constraints from nested FilterGroups
    const fragments: Array<Schema.JsonSchema> = []
    for (const c of check.checks) {
      const fragment = getCheckConstraintFragment(c, astTag)
      if (Object.keys(fragment).length > 0) {
        fragments.push(fragment)
      }
    }
    // Merge all fragments
    let combined: Schema.JsonSchema = {}
    for (const fragment of fragments) {
      combined = { ...combined, ...fragment }
    }
    return combined
  }

  const meta = check.meta
  if (!meta) {
    return {}
  }

  const fragment: Schema.JsonSchema = {}

  switch (astTag) {
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
  }

  return fragment
}

function applyCheck(
  jsonSchema: Schema.JsonSchema,
  check: Check<any>,
  _tag: "String" | "Number"
): Schema.JsonSchema {
  if (check._tag === "FilterGroup") {
    // Collect all constraint fragments from checks
    const constraintFragment = getCheckConstraintFragment(check, _tag)

    // Merge with FilterGroup annotations
    const fragmentWithAnnotations = mergeJsonSchemaAnnotations(constraintFragment, check.annotations)

    // If FilterGroup has annotations, always use allOf to keep constraints and annotations together
    if (check.annotations && Object.keys(fragmentWithAnnotations).length > 0) {
      return combineJsonSchema(jsonSchema, fragmentWithAnnotations)
    } else if (Object.keys(constraintFragment).length > 0) {
      // No annotations, merge constraints directly
      return combineJsonSchema(jsonSchema, constraintFragment)
    }
    return jsonSchema
  }

  const meta = check.meta
  if (!meta) {
    // No meta, just apply annotations
    const checkAnnotations = getJsonSchemaAnnotations(check.annotations)
    if (checkAnnotations) {
      return combineJsonSchema(jsonSchema, checkAnnotations)
    }
    return jsonSchema
  }

  const fragment: Schema.JsonSchema = {}

  switch (_tag) {
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
  }

  // Merge fragment with check annotations
  const fragmentWithAnnotations = mergeJsonSchemaAnnotations(fragment, check.annotations)

  // If fragment changes the type, merge type at top level and handle annotations separately
  if ("type" in fragmentWithAnnotations && "type" in jsonSchema && fragmentWithAnnotations.type !== jsonSchema.type) {
    const { type, ...restFragment } = fragmentWithAnnotations
    const updatedSchema = { ...jsonSchema, type }
    if (Object.keys(restFragment).length > 0) {
      return combineJsonSchema(updatedSchema, restFragment)
    }
    return updatedSchema
  }

  return combineJsonSchema(jsonSchema, fragmentWithAnnotations)
}

function containsUndefined(ast: StandardAST): boolean {
  switch (ast._tag) {
    case "Undefined":
      return true
    case "Union":
      return ast.types.some(containsUndefined)
    default:
      return false
  }
}

function getPartPattern(part: StandardAST): string {
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
export function toFormatter(ast: StandardAST, options?: {
  readonly resolver?: Resolver<Formatter<any>> | undefined
  readonly onBefore?: (ast: StandardAST, recur: (ast: StandardAST) => Formatter<any>) => Option.Option<Formatter<any>>
}): Formatter<unknown> {
  const resolver = options?.resolver ?? defaultResolver

  return recur(ast)

  function defaultResolver(): Formatter<unknown> {
    return format
  }

  function recur(ast: StandardAST): Formatter<unknown> {
    if (options?.onBefore) {
      const onBefore = options.onBefore(ast, recur)
      if (Option.isSome(onBefore)) {
        return onBefore.value
      }
    }
    return on(ast)
  }

  function on(ast: StandardAST): Formatter<unknown> {
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
