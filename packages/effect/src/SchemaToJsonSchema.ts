/**
 * @since 4.0.0
 */
import type { SchemaCheck } from "./index.js"
import { formatPath } from "./internal/schema/util.js"
import * as Predicate from "./Predicate.js"
import type * as Schema from "./Schema.js"
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import * as SchemaAST from "./SchemaAST.js"

/**
 * @category model
 * @since 4.0.0
 */
export interface Annotations {
  title?: string
  description?: string
  default?: unknown
  examples?: globalThis.Array<unknown>
  [x: string]: unknown
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Any extends Annotations {}

/**
 * @category model
 * @since 4.0.0
 */
export interface Never extends Annotations {
  not: {}
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Null extends Annotations {
  type: "null"
}

/**
 * @category model
 * @since 4.0.0
 */
export interface String extends Annotations {
  type: "string"
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: string
  contentMediaType?: string
  allOf?: globalThis.Array<
    Annotations & {
      minLength?: number
      maxLength?: number
      pattern?: string
    }
  >
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Number extends Annotations {
  type: "number" | "integer"
  minimum?: number
  exclusiveMinimum?: number
  maximum?: number
  exclusiveMaximum?: number
  multipleOf?: number
  allOf?: globalThis.Array<
    Annotations & {
      minimum?: number
      exclusiveMinimum?: number
      maximum?: number
      exclusiveMaximum?: number
      multipleOf?: number
    }
  >
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Boolean extends Annotations {
  type: "boolean"
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Array extends Annotations {
  type: "array"
  minItems?: number
  prefixItems?: globalThis.Array<JsonSchema>
  items?: false | JsonSchema | globalThis.Array<JsonSchema>
  additionalItems?: false | JsonSchema
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Object extends Annotations {
  type: "object"
  properties?: Record<string, JsonSchema>
  required?: globalThis.Array<string>
  additionalProperties?: false | JsonSchema
}

/**
 * @category model
 * @since 4.0.0
 */
export interface AnyOf extends Annotations {
  anyOf: globalThis.Array<JsonSchema>
}

/**
 * @category model
 * @since 4.0.0
 */
export interface OneOf extends Annotations {
  oneOf: globalThis.Array<JsonSchema>
}

/**
 * @category model
 * @since 4.0.0
 */
export type JsonSchema =
  | Any
  | Never
  | Null
  | String
  | Number
  | Boolean
  | Array
  | Object
  | AnyOf
  | OneOf

/**
 * @category model
 * @since 4.0.0
 */
export type Root = JsonSchema & {
  $schema?: string
  $defs?: Record<string, JsonSchema>
}

type Target = "draft-07" | "draft-2020-12"
type AdditionalPropertiesStrategy = "allow" | "strict"

/**
 * @since 4.0.0
 */
export type Options = {
  target?: Target | undefined
  additionalPropertiesStrategy?: AdditionalPropertiesStrategy | undefined
}

/** @internal */
export function getTargetSchema(target?: Target): string {
  return target === "draft-2020-12"
    ? "https://json-schema.org/draft/2020-12/schema"
    : "http://json-schema.org/draft-07/schema"
}

/**
 * @since 4.0.0
 */
export function make<S extends Schema.Top>(schema: S, options?: Options): Root {
  const target = options?.target ?? "draft-07"
  const additionalPropertiesStrategy = options?.additionalPropertiesStrategy ?? "strict"
  const out = go(schema.ast, [], { target, additionalPropertiesStrategy }) as Root
  return {
    $schema: getTargetSchema(target),
    ...out
  }
}

function getAnnotations(annotations: SchemaAnnotations.Annotations | undefined): Annotations | undefined {
  if (annotations) {
    const out: any = {}
    const a = annotations
    function go(key: string) {
      if (Object.prototype.hasOwnProperty.call(a, key)) {
        out[key] = a[key]
      }
    }
    go("title")
    go("description")
    go("default")
    go("examples")
    return out
  }
}

function getFragment(
  type: string | undefined,
  check: SchemaCheck.SchemaCheck<any>
): Record<string, unknown> | undefined {
  const jsonSchema = check.annotations?.jsonSchema
  if (jsonSchema !== undefined) {
    if (jsonSchema.type === "fragment") {
      return jsonSchema.fragment
    } else if (type !== undefined) {
      return jsonSchema.fragments[type]
    }
  }
}

function getChecks(ast: SchemaAST.AST, type?: string): Record<string, unknown> | undefined {
  let out: any = { ...getAnnotations(ast.annotations), allOf: [] }
  if (ast.checks) {
    function go(check: SchemaCheck.SchemaCheck<any>) {
      const fragment: any = { ...getAnnotations(check.annotations), ...getFragment(type, check) }
      if (Object.prototype.hasOwnProperty.call(fragment, "type")) {
        out.type = fragment.type
        delete fragment.type
      }
      if (Object.keys(fragment).some((k) => Object.prototype.hasOwnProperty.call(out, k))) {
        out.allOf.push(fragment)
      } else {
        out = { ...out, ...fragment }
      }
    }
    ast.checks.forEach(go)
  }
  if (out.allOf.length === 0) {
    delete out.allOf
  }
  return out
}

function pruneUndefined(ast: SchemaAST.AST): globalThis.Array<SchemaAST.AST> {
  switch (ast._tag) {
    case "UndefinedKeyword":
      return []
    case "UnionType":
      return ast.types.flatMap(pruneUndefined)
    default:
      return [ast]
  }
}

function containsUndefined(ast: SchemaAST.AST): boolean {
  switch (ast._tag) {
    case "UndefinedKeyword":
      return true
    case "UnionType":
      return ast.types.some(containsUndefined)
    default:
      return false
  }
}

function isOptional(ast: SchemaAST.AST): boolean {
  return ast.context?.isOptional || containsUndefined(ast)
}

function getPattern(ast: SchemaAST.AST, path: ReadonlyArray<PropertyKey>, options: GoOptions): string | undefined {
  switch (ast._tag) {
    case "StringKeyword": {
      const json = go(ast, path, options)
      if (Predicate.isString(json.pattern)) {
        return json.pattern
      }
      return undefined
    }
    case "NumberKeyword":
      return "^[0-9]+$"
    case "TemplateLiteral":
      return SchemaAST.getTemplateLiteralCapturingRegExp(ast).source
  }
  throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
}

type GoOptions = {
  readonly target: Target
  readonly additionalPropertiesStrategy: AdditionalPropertiesStrategy
}

function go(
  ast: SchemaAST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions
): JsonSchema {
  switch (ast._tag) {
    case "UndefinedKeyword":
    case "VoidKeyword":
    case "Declaration":
    case "BigIntKeyword":
    case "SymbolKeyword":
    case "UniqueSymbol":
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    case "NullKeyword":
      return { type: "null", ...getChecks(ast, "null") }
    case "NeverKeyword":
      return { not: {} }
    case "UnknownKeyword":
    case "AnyKeyword":
      return { ...getChecks(ast) }
    case "StringKeyword":
      return { type: "string", ...getChecks(ast, "string") }
    case "NumberKeyword":
      return { type: "number", ...getChecks(ast, "number") }
    case "BooleanKeyword":
      return { type: "boolean", ...getChecks(ast, "boolean") }
    case "ObjectKeyword":
      return { type: "object", ...getChecks(ast, "object") }
    case "LiteralType":
    case "Enums":
    case "TemplateLiteral":
      // TODO
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    case "TupleType": {
      if (ast.rest.length > 1) {
        throw new Error(
          "Generating a JSON Schema for post-rest elements is not currently supported. You're welcome to contribute by submitting a Pull Request"
        )
      }
      const out: Array = {
        type: "array",
        ...getChecks(ast, "array")
      }
      const items = ast.elements.map((e, i) => go(e, [...path, i], options))
      const minItems = ast.elements.findIndex(isOptional)
      if (minItems !== -1) {
        out.minItems = minItems
      }
      const additionalItems = ast.rest.length > 0 ? go(ast.rest[0], [...path, ast.elements.length + 1], options) : false
      if (items.length === 0) {
        out.items = additionalItems
      } else {
        switch (options.target) {
          case "draft-07": {
            out.items = items
            out.additionalItems = additionalItems
            break
          }
          case "draft-2020-12": {
            out.prefixItems = items
            out.items = additionalItems
            break
          }
        }
      }
      return out
    }
    case "TypeLiteral": {
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        return {
          anyOf: [
            { type: "object" },
            { type: "array" }
          ],
          ...getChecks(ast, "object")
        }
      }
      const out: Object = {
        type: "object",
        ...getChecks(ast, "object")
      }
      out.properties = {}
      out.required = []
      for (const ps of ast.propertySignatures) {
        const name = ps.name
        if (Predicate.isSymbol(name)) {
          throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath([...path, name]) || "root"}`)
        } else {
          out.properties[name] = go(ps.type, [...path, name], options)
          if (!isOptional(ps.type)) {
            out.required.push(String(name))
          }
        }
      }
      if (options.additionalPropertiesStrategy === "strict") {
        out.additionalProperties = false
      }
      const patternProperties: Record<string, JsonSchema> = {}
      for (const is of ast.indexSignatures) {
        const type = go(is.type, path, options)
        const pattern = getPattern(is.parameter, path, options)
        if (pattern !== undefined) {
          patternProperties[pattern] = type
        } else {
          out.additionalProperties = type
        }
      }
      if (Object.keys(patternProperties).length > 0) {
        out.patternProperties = patternProperties
        delete out.additionalProperties
      }
      return out
    }
    case "UnionType": {
      const members = pruneUndefined(ast).map((ast) => go(ast, path, options))
      switch (members.length) {
        case 0:
          return { not: {} }
        case 1:
          return members[0]
        default:
          switch (ast.mode) {
            case "anyOf":
              return { "anyOf": members, ...getChecks(ast) }
            case "oneOf":
              return { "oneOf": members, ...getChecks(ast) }
          }
      }
    }
    case "Suspend":
      // TODO
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
  }
}
