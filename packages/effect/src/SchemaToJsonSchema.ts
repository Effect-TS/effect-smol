/**
 * @since 4.0.0
 */
import { formatPath } from "./internal/schema/util.js"
import * as Predicate from "./Predicate.js"
import type * as Schema from "./Schema.js"
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import * as SchemaAST from "./SchemaAST.js"
import type * as SchemaCheck from "./SchemaCheck.js"

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

/**
 * @since 4.0.0
 */
export type Target = "draft-07" | "draft-2020-12"

/**
 * @since 4.0.0
 */
export type AdditionalPropertiesStrategy = "allow" | "strict"

/**
 * @since 4.0.0
 */
export type TopLevelReferenceStrategy = "skip" | "keep"

/**
 * @since 4.0.0
 */
export type Options = {
  readonly $defs?: Record<string, JsonSchema> | undefined
  readonly getRef?: ((id: string) => string) | undefined
  readonly target?: Target | undefined
  readonly additionalPropertiesStrategy?: AdditionalPropertiesStrategy | undefined
  readonly topLevelReferenceStrategy?: TopLevelReferenceStrategy | undefined
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
  const $defs = options?.$defs ?? {}
  const getRef = options?.getRef ?? ((id: string) => "#/$defs/" + id)
  const target = options?.target ?? "draft-07"
  const additionalPropertiesStrategy = options?.additionalPropertiesStrategy ?? "strict"
  const topLevelReferenceStrategy = options?.topLevelReferenceStrategy ?? "keep"
  const skipIdentifier = topLevelReferenceStrategy === "skip"
  const out: Root = {
    $schema: getTargetSchema(target),
    ...go(SchemaAST.encodedAST(schema.ast), [], {
      $defs,
      getRef,
      target,
      additionalPropertiesStrategy
    }, skipIdentifier)
  }
  if (Object.keys($defs).length > 0) {
    out.$defs = $defs
  }
  return out
}

function getAnnotations(annotations: SchemaAnnotations.Annotations | undefined): Annotations | undefined {
  if (annotations) {
    const out: any = {}
    const a = annotations
    function go(key: string) {
      if (Object.hasOwn(a, key)) {
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
  check: SchemaCheck.SchemaCheck<any>,
  types?: string | ReadonlyArray<string>
): Record<string, unknown> | undefined {
  const jsonSchema = check.annotations?.jsonSchema
  if (jsonSchema) {
    if (jsonSchema.type === "fragment") {
      return jsonSchema.fragment
    } else if (types) {
      if (Predicate.isString(types)) {
        return jsonSchema.fragments[types]
      } else {
        for (const type of types) {
          if (Object.hasOwn(jsonSchema.fragments, type)) {
            return jsonSchema.fragments[type]
          }
        }
      }
    }
  }
}

function getChecks(ast: SchemaAST.AST, types?: string | ReadonlyArray<string>): Record<string, unknown> | undefined {
  let out: any = { ...getAnnotations(ast.annotations), allOf: [] }
  if (ast.checks) {
    function go(check: SchemaCheck.SchemaCheck<any>) {
      const fragment = { ...getAnnotations(check.annotations), ...getFragment(check, types) }
      if (Object.hasOwn(fragment, "type")) {
        out.type = fragment.type
        delete fragment.type
      }
      if (Object.keys(fragment).some((k) => Object.hasOwn(out, k))) {
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

function getPattern(
  ast: SchemaAST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions
): string | undefined {
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
  readonly $defs: Record<string, JsonSchema>
  readonly getRef: (id: string) => string
  readonly target: Target
  readonly additionalPropertiesStrategy: AdditionalPropertiesStrategy
}

function getIdentifier(ast: SchemaAST.AST): string | undefined {
  const identifier = ast.annotations?.identifier
  if (Predicate.isString(identifier)) {
    return identifier
  }
  if (SchemaAST.isSuspend(ast)) {
    return getIdentifier(ast.thunk())
  }
}

function go(
  ast: SchemaAST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreIdentifier: boolean = false,
  ignoreJsonSchemaAnnotation: boolean = false
): JsonSchema {
  if (!ignoreJsonSchemaAnnotation) {
    const jsonSchema = ast.annotations?.jsonSchema
    if (Predicate.isRecord(jsonSchema)) {
      if (jsonSchema.type === "override" && Predicate.isFunction(jsonSchema.override)) {
        return jsonSchema.override(go(ast, path, options, ignoreIdentifier, true))
      }
    }
  }
  if (!ignoreIdentifier) {
    const identifier = getIdentifier(ast)
    if (identifier !== undefined) {
      if (Object.hasOwn(options.$defs, identifier)) {
        return options.$defs[identifier]
      } else {
        const escapedId = identifier.replace(/~/ig, "~0").replace(/\//ig, "~1")
        const out = { $ref: options.getRef(escapedId) }
        options.$defs[identifier] = out
        options.$defs[identifier] = go(ast, path, options, true)
        return out
      }
    }
  }
  switch (ast._tag) {
    case "Declaration":
    case "VoidKeyword":
    case "UndefinedKeyword":
    case "BigIntKeyword":
    case "SymbolKeyword":
    case "UniqueSymbol":
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    case "UnknownKeyword":
    case "AnyKeyword":
      return { ...getChecks(ast) }
    case "NeverKeyword":
      return { not: {}, ...getChecks(ast) }
    case "NullKeyword":
      return { type: "null", ...getChecks(ast, "null") }
    case "StringKeyword":
      return { type: "string", ...getChecks(ast, "string") }
    case "NumberKeyword":
      return { type: "number", ...getChecks(ast, "number") }
    case "BooleanKeyword":
      return { type: "boolean", ...getChecks(ast, "boolean") }
    case "ObjectKeyword":
      return {
        anyOf: [
          { type: "object" },
          { type: "array" }
        ],
        ...getChecks(ast, ["object", "array"])
      }
    case "LiteralType": {
      const literal = ast.literal
      if (Predicate.isBigInt(literal)) {
        throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
      }
      const type = typeof literal
      return { type, enum: [literal], ...getChecks(ast, type) }
    }
    case "Enums": {
      const union = new SchemaAST.UnionType(
        ast.enums.map((e) => new SchemaAST.LiteralType(e[1], { title: e[0] }, undefined, undefined, undefined)),
        "anyOf",
        undefined,
        undefined,
        undefined,
        undefined
      )
      return {
        ...go(union, path, options),
        ...getChecks(ast)
      }
    }
    case "TemplateLiteral":
      return {
        type: "string",
        pattern: SchemaAST.getTemplateLiteralCapturingRegExp(ast).source,
        ...getChecks(ast, "string")
      }
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
      const additionalItems = ast.rest.length > 0 ? go(ast.rest[0], [...path, ast.elements.length], options) : false
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
    case "Suspend": {
      const identifier = getIdentifier(ast)
      if (identifier !== undefined) {
        return go(ast.thunk(), path, options, true)
      }
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    }
  }
}
