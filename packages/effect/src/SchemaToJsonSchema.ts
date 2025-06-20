/**
 * @since 4.0.0
 */
import { formatPath, hasOwn } from "./internal/schema/util.js"
import * as Predicate from "./Predicate.js"
import type * as Schema from "./Schema.js"
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import * as SchemaAST from "./SchemaAST.js"
import type * as SchemaCheck from "./SchemaCheck.js"

/**
 * @since 4.0.0
 */
export declare namespace Annotation {
  /**
   * @since 4.0.0
   */
  export type Fragment = {
    readonly type: "fragment"
    readonly fragment: object
  }

  /**
   * @since 4.0.0
   */
  export type FragmentKey = "string" | "number" | "boolean" | "array" | "object" | "null"

  /**
   * @since 4.0.0
   */
  export type Fragments = {
    readonly type: "fragments"
    readonly fragments: { readonly [K in FragmentKey]?: Fragment["fragment"] | undefined }
  }

  /**
   * @since 4.0.0
   */
  export type Override = {
    readonly type: "override"
    readonly override: (defaultJson: JsonSchema.JsonSchema) => JsonSchema.JsonSchema
  }
}

/**
 * @since 4.0.0
 */
export function getAnnotation(ast: SchemaAST.AST): Annotation.Override | undefined {
  return ast.annotations?.jsonSchema as any
}

/**
 * @since 4.0.0
 */
export function getCheckAnnotation(
  check: SchemaCheck.SchemaCheck<any>
): Annotation.Fragment | Annotation.Fragments | undefined {
  return check.annotations?.jsonSchema as any
}

/**
 * @since 4.0.0
 */
export declare namespace JsonSchema {
  /**
   * @since 4.0.0
   */
  export interface Annotations {
    title?: string
    description?: string
    documentation?: string
    default?: unknown
    examples?: globalThis.Array<unknown>
  }

  /**
   * @since 4.0.0
   */
  export interface Any extends Annotations {}

  /**
   * @since 4.0.0
   */
  export interface Never extends Annotations {
    not: {}
  }

  /**
   * @since 4.0.0
   */
  export interface Null extends Annotations {
    type: "null"
  }

  /**
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
    enum?: globalThis.Array<string>
  }

  /**
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
    enum?: globalThis.Array<number>
  }

  /**
   * @since 4.0.0
   */
  export interface Boolean extends Annotations {
    type: "boolean"
    enum?: globalThis.Array<boolean>
  }

  /**
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
   * @since 4.0.0
   */
  export interface Object extends Annotations {
    type: "object"
    properties?: Record<string, JsonSchema>
    required?: globalThis.Array<string>
    additionalProperties?: false | JsonSchema
    patternProperties?: Record<string, JsonSchema>
  }

  /**
   * @since 4.0.0
   */
  export interface AnyOf extends Annotations {
    anyOf: globalThis.Array<JsonSchema>
  }

  /**
   * @since 4.0.0
   */
  export interface OneOf extends Annotations {
    oneOf: globalThis.Array<JsonSchema>
  }

  /**
   * @since 4.0.0
   */
  export interface Ref {
    $ref: string
  }

  /**
   * @since 4.0.0
   */
  export type JsonSchema =
    | JsonSchema.Any
    | JsonSchema.Never
    | JsonSchema.Null
    | JsonSchema.String
    | JsonSchema.Number
    | JsonSchema.Boolean
    | JsonSchema.Array
    | JsonSchema.Object
    | JsonSchema.AnyOf
    | JsonSchema.OneOf
    | JsonSchema.Ref

  /**
   * @since 4.0.0
   */
  export type Root = JsonSchema & {
    $schema?: "http://json-schema.org/draft-07/schema" | "https://json-schema.org/draft/2020-12/schema"
    $defs?: Record<string, JsonSchema>
  }
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
  readonly $defs?: Record<string, JsonSchema.JsonSchema> | undefined
  readonly getRef?: ((id: string) => string) | undefined
  readonly target?: Target | undefined
  readonly additionalPropertiesStrategy?: AdditionalPropertiesStrategy | undefined
  readonly topLevelReferenceStrategy?: TopLevelReferenceStrategy | undefined
}

/** @internal */
export function getTarget(target?: Target) {
  return target === "draft-2020-12"
    ? "https://json-schema.org/draft/2020-12/schema"
    : "http://json-schema.org/draft-07/schema"
}

/**
 * @since 4.0.0
 */
export function make<S extends Schema.Top>(schema: S, options?: Options): JsonSchema.Root {
  const $defs = options?.$defs ?? {}
  const getRef = options?.getRef ?? ((id: string) => "#/$defs/" + id)
  const target = options?.target ?? "draft-07"
  const additionalPropertiesStrategy = options?.additionalPropertiesStrategy ?? "strict"
  const topLevelReferenceStrategy = options?.topLevelReferenceStrategy ?? "keep"
  const skipIdentifier = topLevelReferenceStrategy === "skip"
  const out: JsonSchema.Root = {
    $schema: getTarget(target),
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

function getAnnotations(annotations: SchemaAnnotations.Annotations | undefined): JsonSchema.Annotations | undefined {
  if (annotations) {
    const out: JsonSchema.Annotations = {}
    if (hasOwn(annotations, "title") && Predicate.isString(annotations.title)) {
      out.title = annotations.title
    }
    if (hasOwn(annotations, "description") && Predicate.isString(annotations.description)) {
      out.description = annotations.description
    }
    if (hasOwn(annotations, "documentation") && Predicate.isString(annotations.documentation)) {
      out.documentation = annotations.documentation
    }
    if (hasOwn(annotations, "default")) {
      out.default = annotations.default
    }
    if (hasOwn(annotations, "examples") && Array.isArray(annotations.examples)) {
      out.examples = annotations.examples
    }
    return out
  }
}

function getFragment(
  check: SchemaCheck.SchemaCheck<any>,
  types?: Annotation.FragmentKey | ReadonlyArray<Annotation.FragmentKey>
): JsonSchema.JsonSchema | undefined {
  const annotation = getCheckAnnotation(check)
  if (annotation) {
    switch (annotation.type) {
      case "fragment":
        return annotation.fragment
      case "fragments": {
        if (types) {
          if (Predicate.isString(types)) {
            return annotation.fragments[types]
          } else {
            for (const type of types) {
              if (hasOwn(annotation.fragments, type)) {
                return annotation.fragments[type]
              }
            }
          }
        }
      }
    }
  }
}

function getChecks(
  ast: SchemaAST.AST,
  types?: Annotation.FragmentKey | ReadonlyArray<Annotation.FragmentKey>
): Record<string, unknown> | undefined {
  let out: { [x: string]: unknown; allOf: globalThis.Array<unknown> } = {
    ...getAnnotations(ast.annotations),
    allOf: []
  }
  if (ast.checks) {
    function go(check: SchemaCheck.SchemaCheck<any>) {
      const fragment = { ...getAnnotations(check.annotations), ...getFragment(check, types) }
      if (hasOwn(fragment, "type")) {
        out.type = fragment.type
        delete fragment.type
      }
      if (Object.keys(fragment).some((k) => hasOwn(out, k))) {
        out.allOf.push(fragment)
      } else {
        out = { ...out, ...fragment }
      }
    }
    ast.checks.forEach(go)
  }
  if (out.allOf.length === 0) {
    delete (out as any).allOf
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
      if (hasOwn(json, "pattern") && Predicate.isString(json.pattern)) {
        return json.pattern
      }
      return undefined
    }
    case "NumberKeyword":
      return "^[0-9]+$"
    case "TemplateLiteral":
      return SchemaAST.getTemplateLiteralRegExp(ast).source
  }
  throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
}

type GoOptions = {
  readonly $defs: Record<string, JsonSchema.JsonSchema>
  readonly getRef: (id: string) => string
  readonly target: Target
  readonly additionalPropertiesStrategy: AdditionalPropertiesStrategy
}

function go(
  ast: SchemaAST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreIdentifier: boolean = false,
  ignoreJsonSchemaAnnotation: boolean = false
): JsonSchema.JsonSchema {
  if (!ignoreJsonSchemaAnnotation) {
    const annotation = getAnnotation(ast)
    if (annotation) {
      return annotation.override(go(ast, path, options, ignoreIdentifier, true))
    }
  }
  if (!ignoreIdentifier) {
    const identifier = SchemaAST.getIdentifier(ast)
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
      if (Predicate.isString(ast.literal)) {
        return { type: "string", enum: [ast.literal], ...getChecks(ast, "string") }
      } else if (Predicate.isNumber(ast.literal)) {
        return { type: "number", enum: [ast.literal], ...getChecks(ast, "number") }
      } else if (Predicate.isBoolean(ast.literal)) {
        return { type: "boolean", enum: [ast.literal], ...getChecks(ast, "boolean") }
      }
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    }
    case "Enums": {
      return {
        ...go(SchemaAST.enumsToLiterals(ast), path, options),
        ...getChecks(ast)
      }
    }
    case "TemplateLiteral":
      return {
        type: "string",
        pattern: SchemaAST.getTemplateLiteralRegExp(ast).source,
        ...getChecks(ast, "string")
      }
    case "TupleType": {
      // ---------------------------------------------
      // handle post rest elements
      // ---------------------------------------------
      if (ast.rest.length > 1) {
        throw new Error(
          "Generating a JSON Schema for post-rest elements is not currently supported. You're welcome to contribute by submitting a Pull Request"
        )
      }
      const out: JsonSchema.Array = {
        type: "array",
        ...getChecks(ast, "array")
      }
      // ---------------------------------------------
      // handle elements
      // ---------------------------------------------
      const items = ast.elements.map((e, i) => go(e, [...path, i], options))
      const minItems = ast.elements.findIndex(isOptional)
      if (minItems !== -1) {
        out.minItems = minItems
      }
      // ---------------------------------------------
      // handle rest element
      // ---------------------------------------------
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
      const out: JsonSchema.Object = {
        type: "object",
        ...getChecks(ast, "object")
      }
      // ---------------------------------------------
      // handle property signatures
      // ---------------------------------------------
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
      // ---------------------------------------------
      // handle index signatures
      // ---------------------------------------------
      if (options.additionalPropertiesStrategy === "strict") {
        out.additionalProperties = false
      }
      const patternProperties: Record<string, JsonSchema.JsonSchema> = {}
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
      const identifier = SchemaAST.getIdentifier(ast)
      if (identifier !== undefined) {
        return go(ast.thunk(), path, options, true)
      }
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    }
  }
}
