/**
 * @since 4.0.0
 */
import * as Arr from "../collections/Array.ts"
import { format, formatPropertyKey } from "../data/Formatter.ts"
import * as AST from "./AST.ts"
import type * as Getter from "./Getter.ts"
import * as Schema from "./Schema.ts"

/**
 * @since 4.0.0
 */
export type StandardAST =
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
  | {
    readonly _tag: "TemplateLiteral"
    readonly annotations: typeof Annotations["Type"] | undefined
    readonly parts: ReadonlyArray<StandardAST>
  }
  | {
    readonly _tag: "Arrays"
    readonly annotations: typeof Annotations["Type"] | undefined
    readonly elements: ReadonlyArray<StandardAST>
    readonly rest: ReadonlyArray<StandardAST>
  }
  | {
    readonly _tag: "Objects"
    readonly annotations: typeof Annotations["Type"] | undefined
    readonly propertySignatures: ReadonlyArray<PropertySignature>
    readonly indexSignatures: ReadonlyArray<IndexSignature>
  }
  | {
    readonly _tag: "Union"
    readonly annotations: typeof Annotations["Type"] | undefined
    readonly types: ReadonlyArray<StandardAST>
    readonly mode: "anyOf" | "oneOf"
  }

const MetaASTSuspended = Schema.suspend((): Schema.Codec<StandardAST> => StandardAST)

/**
 * @since 4.0.0
 */
export type PrimitiveTree = Getter.Tree<null | number | boolean | bigint | symbol | string>

const PrimitiveTreeSuspended = Schema.suspend((): Schema.Codec<PrimitiveTree> => PrimitiveTree)

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
  Schema.Array(PrimitiveTreeSuspended),
  Schema.Record(Schema.String, PrimitiveTreeSuspended)
]).annotate({ identifier: "Annotation" })

/**
 * @since 4.0.0
 */
export const Annotations = Schema.Record(Schema.String, Schema.Unknown.pipe(Schema.encodeTo(PrimitiveTree)))

/**
 * @since 4.0.0
 */
export class Null extends Schema.Opaque<Null>()(
  Schema.Struct({
    _tag: Schema.tag("Null"),
    annotations: Schema.UndefinedOr(Annotations)
  }).annotate({ identifier: "Null" })
) {}

/**
 * @since 4.0.0
 */
export class Undefined extends Schema.Opaque<Undefined>()(
  Schema.Struct({
    _tag: Schema.tag("Undefined"),
    annotations: Schema.UndefinedOr(Annotations)
  }).annotate({ identifier: "Undefined" })
) {}

/**
 * @since 4.0.0
 */
export class Void extends Schema.Opaque<Void>()(
  Schema.Struct({
    _tag: Schema.tag("Void"),
    annotations: Schema.UndefinedOr(Annotations)
  }).annotate({ identifier: "Void" })
) {}

/**
 * @since 4.0.0
 */
export class Never extends Schema.Opaque<Never>()(
  Schema.Struct({
    _tag: Schema.tag("Never"),
    annotations: Schema.UndefinedOr(Annotations)
  }).annotate({ identifier: "Never" })
) {}

/**
 * @since 4.0.0
 */
export class Unknown extends Schema.Opaque<Unknown>()(
  Schema.Struct({
    _tag: Schema.tag("Unknown"),
    annotations: Schema.UndefinedOr(Annotations)
  }).annotate({ identifier: "Unknown" })
) {}

/**
 * @since 4.0.0
 */
export class Any extends Schema.Opaque<Any>()(
  Schema.Struct({
    _tag: Schema.tag("Any"),
    annotations: Schema.UndefinedOr(Annotations)
  }).annotate({ identifier: "Any" })
) {}

const MinLength = Schema.Struct({
  _tag: Schema.tag("isMinLength"),
  minLength: Schema.Number
})

const MaxLength = Schema.Struct({
  _tag: Schema.tag("isMaxLength"),
  maxLength: Schema.Number
})

const Pattern = Schema.Struct({
  _tag: Schema.tag("isPattern"),
  source: Schema.String
})

const StringCheck = Schema.Union([
  MinLength,
  MaxLength,
  Pattern
])

/**
 * @since 4.0.0
 */
export class String extends Schema.Opaque<String>()(
  Schema.Struct({
    _tag: Schema.tag("String"),
    annotations: Schema.UndefinedOr(Annotations),
    checks: Schema.Array(StringCheck)
  }).annotate({ identifier: "String" })
) {}

/**
 * @since 4.0.0
 */
export class Number extends Schema.Opaque<Number>()(
  Schema.Struct({
    _tag: Schema.tag("Number"),
    annotations: Schema.UndefinedOr(Annotations)
  }).annotate({ identifier: "Number" })
) {}

/**
 * @since 4.0.0
 */
export class Boolean extends Schema.Opaque<Boolean>()(
  Schema.Struct({
    _tag: Schema.tag("Boolean"),
    annotations: Schema.UndefinedOr(Annotations)
  }).annotate({ identifier: "Boolean" })
) {}

/**
 * @since 4.0.0
 */
export class BigInt extends Schema.Opaque<BigInt>()(
  Schema.Struct({
    _tag: Schema.tag("BigInt"),
    annotations: Schema.UndefinedOr(Annotations)
  }).annotate({ identifier: "BigInt" })
) {}

/**
 * @since 4.0.0
 */
export class Symbol extends Schema.Opaque<Symbol>()(
  Schema.Struct({
    _tag: Schema.tag("Symbol"),
    annotations: Schema.UndefinedOr(Annotations)
  }).annotate({ identifier: "Symbol" })
) {}

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
export class Literal extends Schema.Opaque<Literal>()(
  Schema.Struct({
    _tag: Schema.tag("Literal"),
    annotations: Schema.UndefinedOr(Annotations),
    literal: LiteralValue
  }).annotate({ identifier: "Literal" })
) {}

/**
 * @since 4.0.0
 */
export class UniqueSymbol extends Schema.Opaque<UniqueSymbol>()(
  Schema.Struct({
    _tag: Schema.tag("UniqueSymbol"),
    annotations: Schema.UndefinedOr(Annotations),
    symbol: Schema.Symbol
  }).annotate({ identifier: "UniqueSymbol" })
) {}

/**
 * @since 4.0.0
 */
export class ObjectKeyword extends Schema.Opaque<ObjectKeyword>()(
  Schema.Struct({
    _tag: Schema.tag("ObjectKeyword"),
    annotations: Schema.UndefinedOr(Annotations)
  }).annotate({ identifier: "ObjectKeyword" })
) {}

/**
 * @since 4.0.0
 */
export class Enum extends Schema.Opaque<Enum>()(
  Schema.Struct({
    _tag: Schema.tag("Enum"),
    annotations: Schema.UndefinedOr(Annotations),
    enums: Schema.Array(
      Schema.Tuple([Schema.String, Schema.Union([Schema.String, Schema.Number])])
    )
  }).annotate({ identifier: "Enum" })
) {}

/**
 * @since 4.0.0
 */
export class TemplateLiteral extends Schema.Opaque<TemplateLiteral>()(
  Schema.Struct({
    _tag: Schema.tag("TemplateLiteral"),
    annotations: Schema.UndefinedOr(Annotations),
    parts: Schema.Array(MetaASTSuspended)
  }).annotate({ identifier: "TemplateLiteral" })
) {}

/**
 * @since 4.0.0
 */
export class Arrays extends Schema.Opaque<Arrays>()(
  Schema.Struct({
    _tag: Schema.tag("Arrays"),
    annotations: Schema.UndefinedOr(Annotations),
    elements: Schema.Array(MetaASTSuspended),
    rest: Schema.Array(MetaASTSuspended)
  }).annotate({ identifier: "Arrays" })
) {}

/**
 * @since 4.0.0
 */
class PropertySignature extends Schema.Opaque<PropertySignature>()(
  Schema.Struct({
    name: Schema.PropertyKey,
    type: MetaASTSuspended,
    isOptional: Schema.Boolean,
    isMutable: Schema.Boolean
  }).annotate({ identifier: "PropertySignature" })
) {}

/**
 * @since 4.0.0
 */
class IndexSignature extends Schema.Opaque<IndexSignature>()(
  Schema.Struct({
    parameter: MetaASTSuspended,
    type: MetaASTSuspended
  }).annotate({ identifier: "IndexSignature" })
) {}

/**
 * @since 4.0.0
 */
export class Objects extends Schema.Opaque<Objects>()(
  Schema.Struct({
    _tag: Schema.tag("Objects"),
    annotations: Schema.UndefinedOr(Annotations),
    propertySignatures: Schema.Array(PropertySignature),
    indexSignatures: Schema.Array(IndexSignature)
  }).annotate({ identifier: "Objects" })
) {}

/**
 * @since 4.0.0
 */
export class Union extends Schema.Opaque<Union>()(
  Schema.Struct({
    _tag: Schema.tag("Union"),
    annotations: Schema.UndefinedOr(Annotations),
    types: Schema.Array(MetaASTSuspended),
    mode: Schema.Literals(["anyOf", "oneOf"])
  }).annotate({ identifier: "Union" })
) {}

/**
 * @since 4.0.0
 */
export const StandardAST: Schema.Codec<StandardAST> = Schema.Union([
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

/**
 * @since 4.0.0
 */
export type JsonValue = Getter.Tree<null | string | number | boolean>

/**
 * @since 4.0.0
 */
export function toJson<S extends Schema.Top>(schema: S): JsonValue {
  return encodeUnknownSync(fromRuntime(schema.ast)) as JsonValue
}

/**
 * @since 4.0.0
 */
export function fromRuntime(ast: AST.AST): StandardAST {
  switch (ast._tag) {
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
      return {
        _tag: ast._tag,
        annotations: ast.annotations
      }
    case "String": {
      let checks: Array<typeof StringCheck["Type"]> = []
      if (ast.checks) {
        checks = ast.checks.map((c) => {
          if (c._tag === "Filter") {
            const meta = c.annotations?.meta
            if (meta) {
              switch (meta._tag) {
                case "isMinLength":
                  return { _tag: "isMinLength", minLength: meta.minLength }
                case "isMaxLength":
                  return { _tag: "isMaxLength", maxLength: meta.maxLength }
                case "isPattern":
                  return { _tag: "isPattern", source: meta.regex.source }
              }
            }
          }
          // TODO: Handle FilterGroup
          throw new Error("Unsupported check", { cause: c })
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
        parts: ast.parts.map(fromRuntime)
      }
    case "Arrays":
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        elements: ast.elements.map(fromRuntime),
        rest: ast.rest.map(fromRuntime)
      }
    case "Objects":
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        propertySignatures: ast.propertySignatures.map((ps) => ({
          name: ps.name,
          type: fromRuntime(ps.type),
          isOptional: AST.isOptional(ps.type),
          isMutable: AST.isMutable(ps.type)
        })),
        indexSignatures: ast.indexSignatures.map((is) => ({
          parameter: fromRuntime(is.parameter),
          type: fromRuntime(is.type)
        }))
      }
    case "Union":
      return {
        _tag: ast._tag,
        annotations: ast.annotations,
        types: ast.types.map(fromRuntime),
        mode: ast.mode
      }
  }
  throw new globalThis.Error("Unsupported AST: " + ast._tag, { cause: ast })
}

/**
 * @since 4.0.0
 */
export function fromJson<S extends Schema.Top = Schema.Top>(u: unknown): S {
  return runtime(decodeUnknownSync(u)) as S
}

/**
 * @since 4.0.0
 */
export function toCode(ast: StandardAST): string {
  return toCodeBase(ast) + codeAnnotations(ast.annotations)
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
        `${formatPropertyKey(p.name)}: ${codeOptional(p.isOptional, toCode(p.type))}`
      ).join(", ")
      return `Schema.Struct({ ${propertySignatures} })`
    }
    case "Union": {
      const mode = ast.mode === "anyOf" ? "" : `, { mode: "oneOf" }`
      return `Schema.Union([${ast.types.map((t) => toCode(t)).join(", ")}]${mode})`
    }
  }
}

function codeAnnotations(annotations: typeof Annotations["Type"] | undefined): string {
  if (!annotations || Object.keys(annotations).length === 0) return ""
  const entries = Object.entries(annotations).map(([key, value]) => {
    return `${formatPropertyKey(key)}: ${format(value)}`
  }).join(", ")
  return `.annotate({ ${entries} })`
}

function codeOptional(isOptional: boolean, code: string): string {
  return isOptional ? `Schema.optionalKey(${code})` : code
}

/**
 * @since 4.0.0
 */
export function runtime(ast: StandardAST): Schema.Top {
  let out = runtimeBase(ast)
  if (ast.annotations) out = out.annotate(ast.annotations)
  out = runtimeChecks(out, ast)
  return out
}

function runtimeChecks(schema: Schema.Top, ast: StandardAST): Schema.Top {
  switch (ast._tag) {
    case "String": {
      const checks = ast.checks.map((c) => {
        switch (c._tag) {
          case "isMinLength":
            return Schema.isMinLength(c.minLength)
          case "isMaxLength":
            return Schema.isMaxLength(c.maxLength)
          case "isPattern":
            return Schema.isPattern(new RegExp(c.source))
        }
      })
      if (Arr.isArrayNonEmpty(checks)) {
        return (schema as Schema.String).check(...checks)
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
      const parts = ast.parts.map(runtime) as any // TODO: Fix this
      return Schema.TemplateLiteral(parts)
    }
    case "Arrays": {
      if (ast.elements.length === 0 && ast.rest.length === 0) {
        return Schema.Tuple([])
      }
      if (ast.elements.length === 0 && ast.rest.length > 0) {
        return Schema.Array(runtime(ast.rest[0]))
      }
      if (ast.rest.length === 0) {
        const elements = ast.elements.map(runtime) as any
        return Schema.Tuple(elements)
      }
      const elements = ast.elements.map(runtime) as any
      const rest = ast.rest.map(runtime) as any
      return Schema.TupleWithRest(Schema.Tuple(elements), rest)
    }
    case "Objects": {
      const fields: Record<PropertyKey, Schema.Top> = {}
      for (const ps of ast.propertySignatures) {
        const name = ps.name
        const schema = runtime(ps.type)
        fields[name] = ps.isOptional ? Schema.optionalKey(schema) : schema
      }
      const out = Schema.Struct(fields)
      // TODO: Handle index signatures
      return out
    }
    case "Union":
      return Schema.Union(ast.types.map(runtime), { mode: ast.mode })
  }
}
