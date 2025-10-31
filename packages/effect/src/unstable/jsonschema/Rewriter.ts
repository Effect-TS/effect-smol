/**
 * @since 4.0.0
 */
import * as Predicate from "effect/data/Predicate"
import { constTrue } from "effect/Function"
import * as Array_ from "../../collections/Array.ts"
import * as Combiner from "../../data/Combiner.ts"
import * as Struct from "../../data/Struct.ts"
import * as UndefinedOr from "../../data/UndefinedOr.ts"
import * as Inspectable from "../../interfaces/Inspectable.ts"
import type * as Schema from "../../schema/Schema.ts"

/**
 * @since 4.0.0
 */
export type Path = readonly ["schema" | "definitions", ...ReadonlyArray<string | number>]

/**
 * @since 4.0.0
 */
export interface Tracer {
  push(change: string): void
}

/**
 * @since 4.0.0
 */
export const NoopTracer: Tracer = { push() {} }

/**
 * @since 4.0.0
 */
export interface FragmentRewriter {
  (fragment: Schema.JsonSchema.Fragment, path: Path, tracer: Tracer): Schema.JsonSchema.Fragment | undefined
}

/**
 * @since 4.0.0
 */
export interface Rewriter {
  (document: Schema.JsonSchema.Document, tracer?: Tracer): Schema.JsonSchema.Document
}

/**
 * @since 4.0.0
 */
export function make(rewriters: ReadonlyArray<FragmentRewriter>): Rewriter {
  function recur(fragment: any, path: Path, tracer: Tracer): any {
    if (Array.isArray(fragment)) {
      return fragment.map((v, i) => recur(v, [...path, i], tracer))
    } else if (fragment && typeof fragment === "object") {
      let out: any = {}
      for (const key of Object.keys(fragment)) {
        out[key] = recur(fragment[key], [...path, key], tracer)
      }
      for (const r of rewriters) {
        const fragment = r(out, path, tracer)
        if (fragment !== undefined) out = fragment
      }
      return out
    }
    return fragment
  }

  return (document: Schema.JsonSchema.Document, tracer: Tracer = NoopTracer): Schema.JsonSchema.Document => {
    return {
      uri: document.uri,
      schema: recur(document.schema, ["schema"], tracer),
      definitions: recur(document.definitions, ["definitions"], tracer)
    }
  }
}

function change(path: Path, summary: string) {
  return `${summary} at ${Inspectable.formatPath(path)}`
}

/**
 * @since 4.0.0
 */
export function whitelistProperties(
  schema: Schema.JsonSchema.Schema,
  path: Path,
  tracer: Tracer,
  whitelist: Record<string, (value: unknown) => boolean>
) {
  const out = { ...schema }
  for (const key of Object.keys(schema)) {
    if (key in whitelist && whitelist[key](schema[key])) continue

    // tracer
    tracer.push(change(path, `removed property "${key}"`))

    delete out[key]
  }
  return out
}

/**
 * @since 4.0.0
 */
export function unescapeJsonPointer(identifier: string) {
  return identifier.replace(/~0/g, "~").replace(/~1/g, "/")
}

function isSchema(path: Path): boolean {
  if (path.length === 1 && path[0] === "schema") return true
  if (path.length === 2 && path[0] === "definitions") return true
  if (path.length >= 2) {
    const last = path[path.length - 1]
    if (
      last === "items"
      || last === "additionalProperties"
      || last === "not"
    ) return true
  }
  if (path.length >= 3) {
    const segment = path[path.length - 2]
    if (
      segment === "properties"
      || segment === "prefixItems"
      || segment === "items"
      || segment === "additionalItems"
      || segment === "allOf"
      || segment === "anyOf"
      || segment === "oneOf"
    ) return true
  }
  return false
}

/**
 * @since 4.0.0
 */
export function onSchema(
  f: (schema: Schema.JsonSchema.Schema, path: Path, tracer: Tracer) => Schema.JsonSchema.Fragment | undefined
): FragmentRewriter {
  return (fragment, path, tracer) => {
    if (isSchema(path)) return f(fragment, path, tracer)
  }
}

interface JsonObject extends Schema.JsonSchema.Schema {
  type: Schema.JsonSchema.Type
  properties: Record<string, Schema.JsonSchema.Schema>
  required: Array<string>
  additionalProperties?: boolean | Schema.JsonSchema.Schema
}

/**
 * @since 4.0.0
 */
export function onObject(
  f: (schema: JsonObject, path: Path, tracer: Tracer) => Schema.JsonSchema.Fragment | undefined
): FragmentRewriter {
  return onSchema((fragment, path, tracer) => {
    if (fragment.type === "object") return f(fragment as JsonObject, path, tracer)
  })
}

const join = UndefinedOr.getReducer(Combiner.make<string>((a, b) => `${a} and ${b}`))

const propertiesCombiner: Combiner.Combiner<any> = Struct.getCombiner({
  type: UndefinedOr.getReducer(Combiner.first<string>()),
  description: join,
  title: join,
  default: UndefinedOr.getReducer(Combiner.last()),
  examples: UndefinedOr.getReducer(Array_.getReducerConcat())
}, {
  omitKeyWhen: Predicate.isUndefined
})

function getDefaultSchema(schema: Schema.JsonSchema.Schema): Schema.JsonSchema.Schema {
  const out: JsonObject = {
    "type": "object",
    "properties": {},
    "required": [],
    "additionalProperties": false
  }
  if (schema.description !== undefined) out.description = schema.description
  if (schema.title !== undefined) out.title = schema.title
  if (schema.default !== undefined) out.default = schema.default
  if (schema.examples !== undefined) out.examples = schema.examples
  return out
}

/**
 * @see https://platform.openai.com/docs/guides/structured-outputs/supported-schemas?type-restrictions=string-restrictions#supported-schemas
 *
 * @since 4.0.0
 */
export const openAi = make([
  // merge allOf
  onSchema((schema, path, tracer) => {
    if (Array.isArray(schema.allOf)) {
      const { allOf, ...rest } = schema

      // tracer
      tracer.push(change(path, `merged ${allOf.length} allOf fragment(s)`))

      return allOf.reduce((acc, curr) => propertiesCombiner.combine(acc, curr), rest)
    }
  }),

  // all fields must be required
  // it is possible to emulate an optional parameter by using a union type with null
  onObject((schema, path, tracer) => {
    const keys = Object.keys(schema.properties)
    if (schema.required.length < keys.length) {
      const required = new Set(schema.required)
      // clone the schema
      const out = { ...schema }
      out.required = [...out.required]

      for (const key of keys) {
        if (!required.has(key)) {
          // tracer
          tracer.push(change(path, `added required property "${key}"`))

          out.required.push(key)
          const type = out.properties[key].type
          if (typeof type === "string") {
            out.properties[key].type = [type, "null"] as any
          } else {
            if (Array.isArray(out.properties[key].anyOf)) {
              out.properties[key] = {
                ...out.properties[key],
                "anyOf": [...out.properties[key].anyOf, { "type": "null" }]
              }
            } else {
              out.properties[key] = { "anyOf": [out.properties[key], { "type": "null" }] }
            }
          }
        }
      }

      return out
    }
  }),

  // Supported types
  onSchema((schema, path, tracer) => {
    // whitelist supported properties and types
    const jsonSchemaAnnotations = {
      title: constTrue,
      description: constTrue,
      default: constTrue,
      examples: constTrue
    }
    if (
      schema.type === "string"
      || schema.type === "number"
      || schema.type === "integer"
      || schema.type === "boolean"
    ) {
      return whitelistProperties(schema, path, tracer, {
        type: constTrue,
        ...jsonSchemaAnnotations,
        enum: constTrue
      })
    } else if (schema.type === "array") {
      return whitelistProperties(schema, path, tracer, {
        type: constTrue,
        ...jsonSchemaAnnotations,
        items: constTrue,
        prefixItems: constTrue
      })
    } else if (schema.type === "object") {
      // additionalProperties: false must always be set in objects
      if (schema.additionalProperties !== false) {
        // tracer
        tracer.push(change(path, `set additionalProperties to false`))

        schema = { ...schema, additionalProperties: false }
      }

      return whitelistProperties(schema, path, tracer, {
        type: constTrue,
        ...jsonSchemaAnnotations,
        properties: constTrue,
        required: constTrue,
        additionalProperties: constTrue
      })
    } else if (schema.enum !== undefined) {
      return whitelistProperties(schema, path, tracer, {
        enum: constTrue,
        ...jsonSchemaAnnotations
      })
    } else if (schema.anyOf !== undefined) {
      return whitelistProperties(schema, path, tracer, {
        anyOf: constTrue,
        ...jsonSchemaAnnotations
      })
    } else if (schema.$ref !== undefined) {
      return whitelistProperties(schema, path, tracer, {
        $ref: constTrue,
        ...jsonSchemaAnnotations
      })
    } else if ("oneOf" in schema) {
      // tracer
      tracer.push(change(path, `rewrote oneOf to anyOf`))

      const out = { ...schema }
      out.anyOf = out.oneOf
      delete out.oneOf
      return out
    }
  }),

  // root must be an object
  onSchema((schema, path, tracer) => {
    if (path.length === 1 && path[0] === "schema" && schema.type !== "object") {
      // tracer
      tracer.push(change(path, `return default schema`))

      return getDefaultSchema(schema)
    }
  })
])
