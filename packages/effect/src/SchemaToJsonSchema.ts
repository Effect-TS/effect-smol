/**
 * @since 4.0.0
 */
import type { SchemaCheck } from "./index.js"
import { formatPath } from "./internal/schema/util.js"
import type * as Schema from "./Schema.js"
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import type * as SchemaAST from "./SchemaAST.js"

/**
 * @category model
 * @since 4.0.0
 */
export interface Annotations {
  title?: string
  description?: string
  default?: unknown
  examples?: globalThis.Array<unknown>
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
export interface Array extends Annotations {
  type: "array"
  prefixItems?: globalThis.Array<JsonSchema>
  items?: false | JsonSchema | globalThis.Array<JsonSchema>
}

/**
 * @category model
 * @since 4.0.0
 */
export type JsonSchema =
  | Any
  | Null
  | String
  | Number
  | Array

/**
 * @category model
 * @since 4.0.0
 */
export type Root = JsonSchema & {
  $schema?: string
  $defs?: Record<string, JsonSchema>
}

type Target = "draft-07" | "draft-2020-12"

/**
 * @since 4.0.0
 */
export type Options = {
  target?: Target | undefined
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
  const out = go(schema.ast, [], { target }) as Root
  out["$schema"] = getTargetSchema(target)
  return out
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

function getFragment(type: string, check: SchemaCheck.SchemaCheck<any>): Record<string, unknown> | undefined {
  const jsonSchema = check.annotations?.jsonSchema
  if (jsonSchema !== undefined) {
    return jsonSchema.type === "fragment"
      ? jsonSchema.fragment
      : jsonSchema.fragments[type]
  }
}

function getChecks(type: string, ast: SchemaAST.AST): Record<string, unknown> | undefined {
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

function go(
  ast: SchemaAST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: {
    readonly target: Target
  }
): JsonSchema {
  switch (ast._tag) {
    case "UndefinedKeyword":
    case "VoidKeyword":
    case "Declaration":
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    case "NullKeyword":
      return { type: "null", ...getAnnotations(ast.annotations) }
    case "NeverKeyword":
    case "UnknownKeyword":
    case "AnyKeyword":
      return { ...getAnnotations(ast.annotations) }
    case "StringKeyword":
      return {
        type: "string",
        ...getChecks("string", ast)
      }
    case "NumberKeyword":
      return {
        type: "number",
        ...getChecks("number", ast)
      }
    case "BooleanKeyword":
    case "BigIntKeyword":
    case "SymbolKeyword":
    case "LiteralType":
    case "UniqueSymbol":
    case "ObjectKeyword":
    case "Enums":
    case "TemplateLiteral":
      return { ...getAnnotations(ast.annotations) }
    case "TupleType": {
      const out: Array = {
        type: "array",
        ...getChecks("array", ast)
      }
      const prefixItems = ast.elements.map((e, i) => go(e, [...path, i], options))
      const items = ast.rest.length > 0 ? go(ast.rest[0], [...path, ast.elements.length + 1], options) : false
      switch (options.target) {
        case "draft-07": {
          if (items !== false) {
            prefixItems.push(items)
          }
          out.items = prefixItems.length > 1 ? prefixItems : prefixItems[0]
          break
        }
        case "draft-2020-12": {
          out.prefixItems = prefixItems
          out.items = items
          break
        }
      }
      return out
    }
    case "TypeLiteral":
    case "UnionType":
    case "Suspend":
      return { ...getAnnotations(ast.annotations) }
  }
}
