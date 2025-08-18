/**
 * @since 4.0.0
 */
import * as Predicate from "../data/Predicate.ts"
import type * as Record from "../data/Record.ts"
import { formatPath, hasOwn } from "../internal/schema/util.ts"
import type * as Annotations from "./Annotations.ts"
import * as AST from "./AST.ts"
import type * as Check from "./Check.ts"
import type * as Schema from "./Schema.ts"

/**
 * @since 4.0.0
 */
export declare namespace Annotation {
  /**
   * @since 4.0.0
   */
  export type Type = "string" | "number" | "boolean" | "array" | "object" | "null"

  /**
   * @since 4.0.0
   */
  export type Constraint = {
    readonly _tag: "Constraint"
    readonly constraint: (type: Type | undefined, target: Target) => object | undefined
  }

  /**
   * @since 4.0.0
   */
  export type Override = {
    readonly _tag: "Override"
    readonly override: (target: Target, go: (ast: AST.AST) => object) => object
  }
}

/**
 * @since 4.0.0
 */
export type Target = "draft-07" | "draft-2020-12" | "openApi3.1"

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
export interface BaseOptions {
  readonly definitions?: Record<string, object> | undefined
  readonly getRef?: ((id: string) => string) | undefined
  readonly additionalPropertiesStrategy?: AdditionalPropertiesStrategy | undefined
  readonly topLevelReferenceStrategy?: TopLevelReferenceStrategy | undefined
}

/**
 * @since 4.0.0
 */
export interface Draft07Options extends BaseOptions {}

/**
 * @since 4.0.0
 */
export function makeDraft07<S extends Schema.Top>(schema: S, options?: Draft07Options): object {
  return make(schema, { ...options, target: "draft-07" })
}

/**
 * @since 4.0.0
 */
export interface Draft2020Options extends BaseOptions {}

/**
 * @since 4.0.0
 */
export function makeDraft2020<S extends Schema.Top>(schema: S, options?: Draft2020Options): object {
  return make(schema, { ...options, target: "draft-2020-12" })
}

/**
 * @since 4.0.0
 */
export interface OpenApi3_1Options extends BaseOptions {}

/**
 * @since 4.0.0
 */
export function makeOpenApi3_1<S extends Schema.Top>(schema: S, options?: OpenApi3_1Options): object {
  return make(schema, { ...options, target: "openApi3.1" })
}

interface Options extends Draft07Options {
  readonly target?: Target | undefined
}

function get$schema(target: Target) {
  switch (target) {
    case "draft-07":
      return "http://json-schema.org/draft-07/schema"
    case "draft-2020-12":
    case "openApi3.1":
      return "https://json-schema.org/draft/2020-12/schema"
  }
}

function make<S extends Schema.Top>(schema: S, options?: Options): object {
  const definitions = options?.definitions ?? {}
  const getRef = options?.getRef ?? ((id: string) => "#/$defs/" + id)
  const target = options?.target ?? "draft-07"
  const additionalPropertiesStrategy = options?.additionalPropertiesStrategy ?? "strict"
  const topLevelReferenceStrategy = options?.topLevelReferenceStrategy ?? "keep"
  const skipId = topLevelReferenceStrategy === "skip"
  const out: Record<string, unknown> = {
    $schema: get$schema(target),
    ...go(schema.ast, [], {
      definitions,
      getRef,
      target,
      additionalPropertiesStrategy
    }, skipId)
  }
  if (Object.keys(definitions).length > 0) {
    out.$defs = definitions
  }
  return out
}

function getJsonSchemaAnnotations(annotations: Annotations.Annotations | undefined): object | undefined {
  if (annotations) {
    const out: Record<string, unknown> = {}
    if (hasOwn(annotations, "title") && Predicate.isString(annotations.title)) {
      out.title = annotations.title
    }
    if (hasOwn(annotations, "description") && Predicate.isString(annotations.description)) {
      out.description = annotations.description
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

function getCheckConstraint(
  check: Check.Check<any>,
  target: Target,
  type?: Annotation.Type
): object | undefined {
  const annotation = check.annotations?.jsonSchema
  if (annotation) {
    return annotation.constraint(type, target)
  }
}

function getChecksConstraint(
  ast: AST.AST,
  target: Target,
  type?: Annotation.Type
): Record<string, unknown> | undefined {
  let out: { [x: string]: unknown; allOf: Array<unknown> } = {
    ...getJsonSchemaAnnotations(ast.annotations),
    allOf: []
  }
  if (ast.checks) {
    function go(check: Check.Check<any>) {
      const constraint = { ...getJsonSchemaAnnotations(check.annotations), ...getCheckConstraint(check, target, type) }
      if (hasOwn(constraint, "type")) {
        out.type = constraint.type
        delete constraint.type
      }
      if (Object.keys(constraint).some((k) => hasOwn(out, k))) {
        out.allOf.push(constraint)
      } else {
        out = { ...out, ...constraint }
      }
    }
    ast.checks.forEach(go)
  }
  if (out.allOf.length === 0) {
    delete (out as any).allOf
  }
  return out
}

function pruneUndefined(ast: AST.UnionType): Array<AST.AST> {
  return ast.types.filter((ast) => !AST.isUndefinedKeyword(ast))
}

/** Either the AST is optional or it contains an undefined keyword */
function isLooseOptional(ast: AST.AST): boolean {
  return AST.isOptional(ast) || AST.containsUndefined(ast)
}

function getPattern(
  ast: AST.AST,
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
      return AST.getTemplateLiteralRegExp(ast).source
  }
  throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
}

type GoOptions = {
  readonly definitions: Record<string, object>
  readonly getRef: (id: string) => string
  readonly target: Target
  readonly additionalPropertiesStrategy: AdditionalPropertiesStrategy
}

function getId(ast: AST.AST): string | undefined {
  const id = AST.getIdAnnotation(ast)
  if (id !== undefined) return id
  if (AST.isSuspend(ast)) {
    return getId(ast.thunk())
  }
}

function getOverrideAnnotation(ast: AST.AST): Annotation.Override | undefined {
  if (ast.checks) {
    for (let i = ast.checks.length - 1; i >= 0; i--) {
      const check = ast.checks[i]
      const annotation = check.annotations?.jsonSchema as Annotation.Override | Annotation.Constraint | undefined
      if (annotation && annotation._tag === "Override") {
        return annotation
      }
    }
  }
  const annotation = ast.annotations?.jsonSchema as Annotation.Override | Annotation.Constraint | undefined
  if (annotation && annotation._tag === "Override") {
    return annotation
  }
}

function go(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreId: boolean = false
): object {
  if (!ignoreId) {
    const id = getId(ast)
    if (id !== undefined) {
      if (Object.hasOwn(options.definitions, id)) {
        return options.definitions[id]
      } else {
        const escapedId = id.replace(/~/ig, "~0").replace(/\//ig, "~1")
        const out = { $ref: options.getRef(escapedId) }
        options.definitions[id] = out
        options.definitions[id] = go(ast, path, options, true)
        return out
      }
    }
  }
  // ---------------------------------------------
  // handle annotations
  // ---------------------------------------------
  const target = options.target
  const annotation = getOverrideAnnotation(ast)
  if (annotation) {
    return annotation.override(target, (ast) => go(ast, path, options, ignoreId))
  }
  if (ast.encoding) {
    return go(ast.encoding[ast.encoding.length - 1].to, path, options, ignoreId)
  }
  switch (ast._tag) {
    case "Declaration":
    case "UndefinedKeyword":
    case "BigIntKeyword":
    case "SymbolKeyword":
    case "UniqueSymbol":
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    case "VoidKeyword":
    case "UnknownKeyword":
    case "AnyKeyword":
      return { ...getChecksConstraint(ast, target) }
    case "NeverKeyword":
      return { not: {}, ...getChecksConstraint(ast, target) }
    case "NullKeyword": {
      const constraint = getChecksConstraint(ast, target, "null")
      return { type: "null", ...constraint }
    }
    case "StringKeyword":
      return { type: "string", ...getChecksConstraint(ast, target, "string") }
    case "NumberKeyword":
      return { type: "number", ...getChecksConstraint(ast, target, "number") }
    case "BooleanKeyword":
      return { type: "boolean", ...getChecksConstraint(ast, target, "boolean") }
    case "ObjectKeyword":
      return {
        anyOf: [
          { type: "object" },
          { type: "array" }
        ],
        ...getChecksConstraint(ast, target)
      }
    case "LiteralType": {
      if (Predicate.isString(ast.literal)) {
        return { type: "string", enum: [ast.literal], ...getChecksConstraint(ast, target, "string") }
      } else if (Predicate.isNumber(ast.literal)) {
        return { type: "number", enum: [ast.literal], ...getChecksConstraint(ast, target, "number") }
      } else if (Predicate.isBoolean(ast.literal)) {
        return { type: "boolean", enum: [ast.literal], ...getChecksConstraint(ast, target, "boolean") }
      }
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    }
    case "Enums": {
      return {
        ...go(AST.enumsToLiterals(ast), path, options),
        ...getChecksConstraint(ast, target)
      }
    }
    case "TemplateLiteral":
      return {
        type: "string",
        pattern: AST.getTemplateLiteralRegExp(ast).source,
        ...getChecksConstraint(ast, target, "string")
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
      const out: Record<string, unknown> = {
        type: "array",
        ...getChecksConstraint(ast, target, "array")
      }
      // ---------------------------------------------
      // handle elements
      // ---------------------------------------------
      const items = ast.elements.map((e, i) => ({
        ...go(e, [...path, i], options),
        ...getJsonSchemaAnnotations(e.context?.annotations)
      }))
      const minItems = ast.elements.findIndex(isLooseOptional)
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
          ...getChecksConstraint(ast, target)
        }
      }
      const out: any = {
        type: "object",
        ...getChecksConstraint(ast, target, "object")
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
          out.properties[name] = {
            ...go(ps.type, [...path, name], options),
            ...getJsonSchemaAnnotations(ps.type.context?.annotations)
          }
          if (!isLooseOptional(ps.type)) {
            out.required.push(String(name))
          }
        }
      }
      // ---------------------------------------------
      // handle index signatures
      // ---------------------------------------------
      if (options.additionalPropertiesStrategy === "strict") {
        out.additionalProperties = false
      } else {
        out.additionalProperties = true
      }
      const patternProperties: Record<string, object> = {}
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
          return { ...members[0], ...getChecksConstraint(ast, target) }
        default:
          switch (ast.mode) {
            case "anyOf":
              return { "anyOf": members, ...getChecksConstraint(ast, target) }
            case "oneOf":
              return { "oneOf": members, ...getChecksConstraint(ast, target) }
          }
      }
    }
    case "Suspend": {
      const id = getId(ast)
      if (id !== undefined) {
        return go(ast.thunk(), path, options, true)
      }
      throw new Error(
        `cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}, required \`id\` annotation`
      )
    }
  }
}
