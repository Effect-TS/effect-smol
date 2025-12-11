/**
 * @since 4.0.0
 */
import * as Arr from "../collections/Array.ts"
import { format, formatPropertyKey } from "../data/Formatter.ts"
import type * as AnnotationsModule from "./Annotations.ts"
import * as AST from "./AST.ts"
import type * as Getter from "./Getter.ts"
import * as Schema from "./Schema.ts"

// -----------------------------------------------------------------------------
// specification
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export type StandardAST =
  | {
    readonly _tag: "Null"
    readonly annotations: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Undefined"
    readonly annotations: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Void"
    readonly annotations: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Never"
    readonly annotations: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Unknown"
    readonly annotations: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Any"
    readonly annotations: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "String"
    readonly annotations: AnnotationsModule.Annotations | undefined
    readonly checks: ReadonlyArray<Check<StringFilter>>
  }
  | {
    readonly _tag: "Number"
    readonly annotations: AnnotationsModule.Annotations | undefined
    readonly checks: ReadonlyArray<Check<NumberFilter>>
  }
  | {
    readonly _tag: "Boolean"
    readonly annotations: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "BigInt"
    readonly annotations: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Symbol"
    readonly annotations: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Literal"
    readonly annotations: AnnotationsModule.Annotations | undefined
    readonly literal: string | number | boolean | bigint
  }
  | {
    readonly _tag: "UniqueSymbol"
    readonly annotations: AnnotationsModule.Annotations | undefined
    readonly symbol: symbol
  }
  | {
    readonly _tag: "ObjectKeyword"
    readonly annotations: AnnotationsModule.Annotations | undefined
  }
  | {
    readonly _tag: "Enum"
    readonly annotations: AnnotationsModule.Annotations | undefined
    readonly enums: ReadonlyArray<readonly [string, string | number]>
  }
  | {
    readonly _tag: "TemplateLiteral"
    readonly annotations: AnnotationsModule.Annotations | undefined
    readonly parts: ReadonlyArray<StandardAST>
  }
  | {
    readonly _tag: "Arrays"
    readonly annotations: AnnotationsModule.Annotations | undefined
    readonly elements: ReadonlyArray<StandardAST>
    readonly rest: ReadonlyArray<StandardAST>
  }
  | {
    readonly _tag: "Objects"
    readonly annotations: AnnotationsModule.Annotations | undefined
    readonly propertySignatures: ReadonlyArray<PropertySignature>
    readonly indexSignatures: ReadonlyArray<IndexSignature>
  }
  | {
    readonly _tag: "Union"
    readonly annotations: AnnotationsModule.Annotations | undefined
    readonly types: ReadonlyArray<StandardAST>
    readonly mode: "anyOf" | "oneOf"
  }

/**
 * @since 4.0.0
 */
export type StringFilter =
  | {
    readonly _tag: "isMinLength"
    readonly minLength: number
  }
  | {
    readonly _tag: "isMaxLength"
    readonly maxLength: number
  }
  | {
    readonly _tag: "isPattern"
    readonly regExp: RegExp
  }
  | {
    readonly _tag: "isLength"
    readonly length: number
  }

/**
 * @since 4.0.0
 */
export type NumberFilter =
  | {
    readonly _tag: "isInt"
  }
  | {
    readonly _tag: "isGreaterThanOrEqualTo"
    readonly minimum: number
  }
  | {
    readonly _tag: "isLessThanOrEqualTo"
    readonly maximum: number
  }
  | {
    readonly _tag: "isGreaterThan"
    readonly exclusiveMinimum: number
  }
  | {
    readonly _tag: "isLessThan"
    readonly exclusiveMaximum: number
  }
  | {
    readonly _tag: "isMultipleOf"
    readonly divisor: number
  }

/**
 * @since 4.0.0
 */
export type Filter<T> = {
  readonly _tag: "Filter"
  readonly annotations: AnnotationsModule.Annotations | undefined
  readonly meta: T
}

/**
 * @since 4.0.0
 */
export type FilterGroup<T> = {
  readonly _tag: "FilterGroup"
  readonly annotations: AnnotationsModule.Annotations | undefined
  readonly checks: readonly [Check<T>, Check<T>, ...Array<Check<T>>]
}

/**
 * @since 4.0.0
 */
export type Check<T> = Filter<T> | FilterGroup<T>

/**
 * @since 4.0.0
 */
export type PropertySignature = {
  readonly name: PropertyKey
  readonly type: StandardAST
  readonly isOptional: boolean
  readonly isMutable: boolean
  readonly annotations: AnnotationsModule.Annotations | undefined
}

/**
 * @since 4.0.0
 */
export type IndexSignature = {
  readonly parameter: StandardAST
  readonly type: StandardAST
}

// -----------------------------------------------------------------------------
// schemas
// -----------------------------------------------------------------------------

function makeCheck<T>(schema: Schema.Codec<T>) {
  const Check$ = Schema.suspend((): Schema.Codec<Check<T>> => Check)
  const Check = Schema.Union([
    Schema.Struct({
      _tag: Schema.tag("Filter"),
      annotations: Schema.UndefinedOr(Annotations),
      meta: schema
    }),
    Schema.Struct({
      _tag: Schema.tag("FilterGroup"),
      annotations: Schema.UndefinedOr(Annotations),
      checks: Schema.TupleWithRest(Schema.Tuple([Check$, Check$]), [Check$])
    })
  ])
  return Check
}

const StandardAST$ = Schema.suspend((): Schema.Codec<StandardAST, unknown> => StandardAST)

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
  annotations: Schema.UndefinedOr(Annotations)
}).annotate({ identifier: "Null" })

/**
 * @since 4.0.0
 */
export const Undefined = Schema.Struct({
  _tag: Schema.tag("Undefined"),
  annotations: Schema.UndefinedOr(Annotations)
}).annotate({ identifier: "Undefined" })

/**
 * @since 4.0.0
 */
export const Void = Schema.Struct({
  _tag: Schema.tag("Void"),
  annotations: Schema.UndefinedOr(Annotations)
}).annotate({ identifier: "Void" })

/**
 * @since 4.0.0
 */
export const Never = Schema.Struct({
  _tag: Schema.tag("Never"),
  annotations: Schema.UndefinedOr(Annotations)
}).annotate({ identifier: "Never" })

/**
 * @since 4.0.0
 */
export const Unknown = Schema.Struct({
  _tag: Schema.tag("Unknown"),
  annotations: Schema.UndefinedOr(Annotations)
}).annotate({ identifier: "Unknown" })

/**
 * @since 4.0.0
 */
export const Any = Schema.Struct({
  _tag: Schema.tag("Any"),
  annotations: Schema.UndefinedOr(Annotations)
}).annotate({ identifier: "Any" })

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

const StringFilter = Schema.Union([
  IsMinLength,
  IsMaxLength,
  IsPattern,
  IsLength
])

/**
 * @since 4.0.0
 */
export const String = Schema.Struct({
  _tag: Schema.tag("String"),
  annotations: Schema.UndefinedOr(Annotations),
  checks: Schema.Array(makeCheck(StringFilter))
}).annotate({ identifier: "String" })

const IsInt = Schema.Struct({
  _tag: Schema.tag("isInt")
})

const IsGreaterThanOrEqualTo = Schema.Struct({
  _tag: Schema.tag("isGreaterThanOrEqualTo"),
  minimum: Schema.Number
})

const IsLessThanOrEqualTo = Schema.Struct({
  _tag: Schema.tag("isLessThanOrEqualTo"),
  maximum: Schema.Number
})

const IsGreaterThan = Schema.Struct({
  _tag: Schema.tag("isGreaterThan"),
  exclusiveMinimum: Schema.Number
})

const IsLessThan = Schema.Struct({
  _tag: Schema.tag("isLessThan"),
  exclusiveMaximum: Schema.Number
})

const IsMultipleOf = Schema.Struct({
  _tag: Schema.tag("isMultipleOf"),
  divisor: Schema.Number
})

const NumberFilter = Schema.Union([
  IsInt,
  IsGreaterThanOrEqualTo,
  IsLessThanOrEqualTo,
  IsGreaterThan,
  IsLessThan,
  IsMultipleOf
])

/**
 * @since 4.0.0
 */
export const Number = Schema.Struct({
  _tag: Schema.tag("Number"),
  annotations: Schema.UndefinedOr(Annotations),
  checks: Schema.Array(makeCheck(NumberFilter))
}).annotate({ identifier: "Number" })

/**
 * @since 4.0.0
 */
export const Boolean = Schema.Struct({
  _tag: Schema.tag("Boolean"),
  annotations: Schema.UndefinedOr(Annotations)
}).annotate({ identifier: "Boolean" })

/**
 * @since 4.0.0
 */
export const BigInt = Schema.Struct({
  _tag: Schema.tag("BigInt"),
  annotations: Schema.UndefinedOr(Annotations)
}).annotate({ identifier: "BigInt" })

/**
 * @since 4.0.0
 */
export const Symbol = Schema.Struct({
  _tag: Schema.tag("Symbol"),
  annotations: Schema.UndefinedOr(Annotations)
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
  annotations: Schema.UndefinedOr(Annotations),
  literal: LiteralValue
}).annotate({ identifier: "Literal" })

/**
 * @since 4.0.0
 */
export const UniqueSymbol = Schema.Struct({
  _tag: Schema.tag("UniqueSymbol"),
  annotations: Schema.UndefinedOr(Annotations),
  symbol: Schema.Symbol
}).annotate({ identifier: "UniqueSymbol" })

/**
 * @since 4.0.0
 */
export const ObjectKeyword = Schema.Struct({
  _tag: Schema.tag("ObjectKeyword"),
  annotations: Schema.UndefinedOr(Annotations)
}).annotate({ identifier: "ObjectKeyword" })

/**
 * @since 4.0.0
 */
export const Enum = Schema.Struct({
  _tag: Schema.tag("Enum"),
  annotations: Schema.UndefinedOr(Annotations),
  enums: Schema.Array(
    Schema.Tuple([Schema.String, Schema.Union([Schema.String, Schema.Number])])
  )
}).annotate({ identifier: "Enum" })

/**
 * @since 4.0.0
 */
export const TemplateLiteral = Schema.Struct({
  _tag: Schema.tag("TemplateLiteral"),
  annotations: Schema.UndefinedOr(Annotations),
  parts: Schema.Array(StandardAST$)
}).annotate({ identifier: "TemplateLiteral" })

/**
 * @since 4.0.0
 */
export const Arrays = Schema.Struct({
  _tag: Schema.tag("Arrays"),
  annotations: Schema.UndefinedOr(Annotations),
  elements: Schema.Array(StandardAST$),
  rest: Schema.Array(StandardAST$)
}).annotate({ identifier: "Arrays" })

/**
 * @since 4.0.0
 */
export const PropertySignature = Schema.Struct({
  annotations: Schema.UndefinedOr(Annotations),
  name: Schema.PropertyKey,
  type: StandardAST$,
  isOptional: Schema.Boolean,
  isMutable: Schema.Boolean
}).annotate({ identifier: "PropertySignature" })

/**
 * @since 4.0.0
 */
export const IndexSignature = Schema.Struct({
  parameter: StandardAST$,
  type: StandardAST$
}).annotate({ identifier: "IndexSignature" })

/**
 * @since 4.0.0
 */
export const Objects = Schema.Struct({
  _tag: Schema.tag("Objects"),
  annotations: Schema.UndefinedOr(Annotations),
  propertySignatures: Schema.Array(PropertySignature),
  indexSignatures: Schema.Array(IndexSignature)
}).annotate({ identifier: "Objects" })

/**
 * @since 4.0.0
 */
export const Union = Schema.Struct({
  _tag: Schema.tag("Union"),
  annotations: Schema.UndefinedOr(Annotations),
  types: Schema.Array(StandardAST$),
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

const serializerJson = Schema.toSerializerJson(StandardAST)
const encodeUnknownSync = Schema.encodeUnknownSync(serializerJson)
const decodeUnknownSync = Schema.decodeUnknownSync(serializerJson)

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export type JsonValue = Getter.Tree<null | string | number | boolean>

/**
 * @since 4.0.0
 */
export function toJson<S extends Schema.Top>(schema: S): JsonValue {
  return encodeUnknownSync(fromAST(schema.ast)) as JsonValue
}

const keyBlacklist: ReadonlyArray<string> = [
  "arbitraryConstraint",
  "serializerJson",
  "serializer",
  "expected",
  "meta",
  "~structural"
]

function getAnnotations(
  annotations: AnnotationsModule.Annotations | undefined
): AnnotationsModule.Annotations | undefined {
  if (!annotations) return undefined
  const entries = Object.entries(annotations).filter(([key, value]) =>
    !keyBlacklist.includes(key) && typeof value !== "function"
  )
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

/**
 * @since 4.0.0
 */
export function fromAST(ast: AST.AST): StandardAST {
  switch (ast._tag) {
    case "Null":
    case "Undefined":
    case "Void":
    case "Never":
    case "Unknown":
    case "Any":
    case "Boolean":
    case "BigInt":
    case "Symbol":
      return { _tag: ast._tag, annotations: getAnnotations(ast.annotations) }
    case "String": {
      let checks: Array<Check<StringFilter>> = []
      if (ast.checks) {
        checks = ast.checks.map((c) => {
          switch (c._tag) {
            case "Filter": {
              const meta = c.annotations?.meta
              if (meta) {
                switch (meta._tag) {
                  case "isMinLength":
                  case "isMaxLength":
                  case "isPattern":
                  case "isLength":
                    return { _tag: "Filter", meta, annotations: getAnnotations(c.annotations) }
                }
              }
              throw new Error("Unsupported Filter", { cause: c })
            }
            case "FilterGroup":
              throw new Error("Unsupported FilterGroup", { cause: c })
          }
        })
      }
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        checks
      }
    }
    case "Number": {
      let checks: Array<Check<NumberFilter>> = []
      if (ast.checks) {
        checks = ast.checks.map((c) => {
          switch (c._tag) {
            case "Filter": {
              const meta = c.annotations?.meta
              if (meta) {
                switch (meta._tag) {
                  case "isInt":
                    return { _tag: "Filter", meta, annotations: getAnnotations(c.annotations) }
                  case "isGreaterThanOrEqualTo":
                    return { _tag: "Filter", meta, annotations: getAnnotations(c.annotations) }
                  case "isLessThanOrEqualTo":
                    return { _tag: "Filter", meta, annotations: getAnnotations(c.annotations) }
                  case "isGreaterThan":
                    return { _tag: "Filter", meta, annotations: getAnnotations(c.annotations) }
                  case "isLessThan":
                    return { _tag: "Filter", meta, annotations: getAnnotations(c.annotations) }
                  case "isMultipleOf":
                    return { _tag: "Filter", meta, annotations: getAnnotations(c.annotations) }
                }
              }
              throw new Error("Unsupported Filter", { cause: c })
            }
            case "FilterGroup":
              throw new Error("Unsupported FilterGroup", { cause: c })
          }
        })
      }
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        checks
      }
    }
    case "Literal":
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        literal: ast.literal
      }
    case "UniqueSymbol":
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        symbol: ast.symbol
      }
    case "ObjectKeyword":
      return {
        _tag: ast._tag,
        annotations: ast.annotations
      }
    case "Enum":
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        enums: ast.enums
      }
    case "TemplateLiteral":
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        parts: ast.parts.map(fromAST)
      }
    case "Arrays":
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        elements: ast.elements.map(fromAST),
        rest: ast.rest.map(fromAST)
      }
    case "Objects":
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        propertySignatures: ast.propertySignatures.map((ps) => ({
          annotations: getAnnotations(ps.type.context?.annotations),
          name: ps.name,
          type: fromAST(ps.type),
          isOptional: AST.isOptional(ps.type),
          isMutable: AST.isMutable(ps.type)
        })),
        indexSignatures: ast.indexSignatures.map((is) => ({
          parameter: fromAST(is.parameter),
          type: fromAST(is.type)
        }))
      }
    case "Union":
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        types: ast.types.map(fromAST),
        mode: ast.mode
      }
  }
  throw new globalThis.Error("Unsupported AST: " + ast._tag, { cause: ast })
}

/**
 * @since 4.0.0
 */
export function fromJson<S extends Schema.Top = Schema.Top>(u: unknown): S {
  return toRuntime(decodeUnknownSync(u)) as S
}

/**
 * @since 4.0.0
 */
export function toCode(ast: StandardAST): string {
  return toCodeBase(ast) + toCodeAnnotations(ast.annotations)
}

function toCodeBase(ast: StandardAST): string {
  switch (ast._tag) {
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
      return `Schema.TemplateLiteral([${ast.parts.map((p) => toCode(p)).join(", ")}])`
    case "Arrays": {
      if (ast.elements.length === 0 && ast.rest.length === 0) {
        return "Schema.Tuple([])"
      }
      if (ast.elements.length === 0 && ast.rest.length > 0) {
        const rest = ast.rest.map((r) => toCode(r)).join(", ")
        return `Schema.Array(${rest})`
      }
      if (ast.rest.length === 0) {
        const elements = ast.elements.map((e) => toCode(e)).join(", ")
        return `Schema.Tuple([${elements}])`
      }
      const elements = ast.elements.map((e) => toCode(e)).join(", ")
      const rest = ast.rest.map((r) => toCode(r)).join(", ")
      return `Schema.TupleWithRest(Schema.Tuple([${elements}]), [${rest}])`
    }
    case "Objects": {
      const propertySignatures = ast.propertySignatures.map((p) =>
        `${formatPropertyKey(p.name)}: ${toCodeIsOptional(p.isOptional, toCode(p.type))}`
      ).join(", ")
      return `Schema.Struct({ ${propertySignatures} })`
    }
    case "Union": {
      const mode = ast.mode === "anyOf" ? "" : `, { mode: "oneOf" }`
      return `Schema.Union([${ast.types.map((t) => toCode(t)).join(", ")}]${mode})`
    }
  }
}

function toCodeAnnotations(annotations: AnnotationsModule.Annotations | undefined): string {
  if (!annotations || Object.keys(annotations).length === 0) return ""
  const entries = Object.entries(annotations).map(([key, value]) => {
    return `${formatPropertyKey(key)}: ${format(value)}`
  }).join(", ")
  return `.annotate({ ${entries} })`
}

function toCodeIsOptional(isOptional: boolean, code: string): string {
  return isOptional ? `Schema.optionalKey(${code})` : code
}

/**
 * @since 4.0.0
 */
export function toRuntime(ast: StandardAST): Schema.Top {
  let out = runtimeBase(ast)
  if (ast.annotations) out = out.annotate(ast.annotations)
  out = runtimeChecks(out, ast)
  return out
}

function runtimeChecks(schema: Schema.Top, ast: StandardAST): Schema.Top {
  switch (ast._tag) {
    case "String": {
      if (ast.checks) {
        const checks = ast.checks.map((c) => {
          switch (c._tag) {
            case "Filter": {
              const meta = c.meta
              switch (meta._tag) {
                case "isMinLength":
                  return Schema.isMinLength(meta.minLength)
                case "isMaxLength":
                  return Schema.isMaxLength(meta.maxLength)
                case "isPattern":
                  return Schema.isPattern(meta.regExp)
                case "isLength":
                  return Schema.isLength(meta.length)
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
    default:
      return schema
  }
}

function runtimeBase(ast: StandardAST): Schema.Top {
  switch (ast._tag) {
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
      const parts = ast.parts.map(toRuntime) as any // TODO: Fix this
      return Schema.TemplateLiteral(parts)
    }
    case "Arrays": {
      if (ast.elements.length === 0 && ast.rest.length === 0) {
        return Schema.Tuple([])
      }
      if (ast.elements.length === 0 && ast.rest.length > 0) {
        return Schema.Array(toRuntime(ast.rest[0]))
      }
      if (ast.rest.length === 0) {
        const elements = ast.elements.map(toRuntime) as any
        return Schema.Tuple(elements)
      }
      const elements = ast.elements.map(toRuntime) as any
      const rest = ast.rest.map(toRuntime) as any
      return Schema.TupleWithRest(Schema.Tuple(elements), rest)
    }
    case "Objects": {
      const fields: Record<PropertyKey, Schema.Top> = {}
      for (const ps of ast.propertySignatures) {
        const schema = toRuntime(ps.type)
        fields[ps.name] = ps.isOptional ? Schema.optionalKey(schema) : schema
      }
      const out = Schema.Struct(fields)
      // TODO: Handle index signatures
      return out
    }
    case "Union":
      return Schema.Union(ast.types.map(toRuntime), { mode: ast.mode })
  }
}
