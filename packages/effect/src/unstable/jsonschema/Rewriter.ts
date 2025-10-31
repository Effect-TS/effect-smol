/**
 * @since 4.0.0
 */
import * as Predicate from "effect/data/Predicate"
import { constTrue } from "effect/Function"
import * as Array_ from "../../collections/Array.ts"
import * as Combiner from "../../data/Combiner.ts"
import * as Record_ from "../../data/Record.ts"
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
export interface Rewriter {
  (document: Schema.JsonSchema.Document, tracer?: Tracer): Schema.JsonSchema.Document
}

function change(path: Path, summary: string) {
  return `${summary} at ${Inspectable.formatPath(path)}`
}

function whitelistProperties(
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
  const out: any = {
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
export const openAi: Rewriter = (document, tracer = NoopTracer) => {
  const jsonSchemaAnnotations = {
    title: constTrue,
    description: constTrue,
    default: constTrue,
    examples: constTrue
  }

  function recur(schema: Schema.JsonSchema.Schema, path: Path, _tracer: Tracer): Schema.JsonSchema.Schema {
    // root must be an object
    if (path.length === 1 && path[0] === "schema" && schema.type !== "object") {
      tracer.push(change(path, `root must be an object, returning default schema`))
      return getDefaultSchema(schema)
    }

    // handle anyOf
    if (Array.isArray(schema.anyOf)) {
      const out: any = whitelistProperties(schema, path, tracer, {
        anyOf: constTrue,
        ...jsonSchemaAnnotations
      })
      // recursively rewrite members
      const anyOf = out.anyOf.map((value: Schema.JsonSchema.Schema, i: number) =>
        recur(value, [...path, "anyOf", i], tracer)
      )
      out.anyOf = anyOf
      return out
    }

    // rewrite oneOf to anyOf
    if (Array.isArray(schema.oneOf)) {
      const out: any = whitelistProperties(schema, path, tracer, {
        oneOf: constTrue,
        ...jsonSchemaAnnotations
      })
      // recursively rewrite members
      const anyOf = out.oneOf.map((value: Schema.JsonSchema.Schema, i: number) =>
        recur(value, [...path, "oneOf", i], tracer)
      )
      out.anyOf = anyOf
      delete out.oneOf
      tracer.push(change(path, `rewrote oneOf to anyOf`))
      return out
    }

    // merge allOf into a single schema
    if (Array.isArray(schema.allOf)) {
      const { allOf, ...rest } = schema
      const merged = allOf.reduce((acc, curr) => propertiesCombiner.combine(acc, curr), rest)
      tracer.push(change(path, `merged ${allOf.length} fragment(s)`))
      return recur(merged, path, tracer)
    }

    // handle strings, numbers, integers, and booleans
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
    }

    // handle arrays
    if (schema.type === "array") {
      const array: any = whitelistProperties(schema, path, tracer, {
        type: constTrue,
        ...jsonSchemaAnnotations,
        items: constTrue,
        prefixItems: constTrue
      })
      // recursively rewrite prefixItems
      if (array.prefixItems) {
        array.prefixItems = array.prefixItems.map((value: Schema.JsonSchema.Schema, i: number) =>
          recur(value, [...path, "prefixItems", i], tracer)
        )
      }
      // recursively rewrite items
      if (array.items) {
        array.items = recur(array.items, [...path, "items"], tracer)
      }
      return array
    }

    // handle objects
    if (schema.type === "object") {
      const object: any = whitelistProperties(schema, path, tracer, {
        type: constTrue,
        ...jsonSchemaAnnotations,
        properties: constTrue,
        required: constTrue,
        additionalProperties: constTrue
      })

      // recursively rewrite properties
      object.properties = Record_.map(
        object.properties,
        (value: Schema.JsonSchema.Schema, key: string) => recur(value, [...path, "properties", key], tracer)
      )

      // additionalProperties: false must always be set in objects
      if (object.additionalProperties !== false) {
        tracer.push(change(path, `set additionalProperties to false`))
        object.additionalProperties = false
      }
      // all fields must be required
      const keys = Object.keys(object.properties)
      if (object.required.length < keys.length) {
        object.required = object.required !== undefined ? [...object.required] : []
        const required = new Set(object.required)
        for (const key of keys) {
          if (!required.has(key)) {
            object.required.push(key)
            const property = object.properties[key]
            const type = property.type
            if (typeof type === "string") {
              property.type = [type, "null"] as any
            } else {
              if (Array.isArray(property.anyOf)) {
                object.properties[key] = {
                  ...property,
                  "anyOf": [...property.anyOf, { "type": "null" }]
                }
              } else {
                object.properties[key] = { "anyOf": [property, { "type": "null" }] }
              }
            }
            tracer.push(change(path, `added required property "${key}"`))
          }
        }
      }
      return object
    }

    // handle $refs
    if (schema.$ref !== undefined) {
      return schema
    }

    // rewrite const to enum
    if (schema.const !== undefined) {
      const out: any = whitelistProperties(schema, path, tracer, {
        const: constTrue,
        ...jsonSchemaAnnotations
      })
      out.enum = [schema.const]
      delete out.const
      tracer.push(change(path, `rewrote const to enum`))
      return out
    }

    tracer.push(change(path, `unknown schema type, returning default schema`))
    return getDefaultSchema(schema)
  }

  return {
    uri: document.uri,
    schema: recur(document.schema, ["schema"], tracer),
    definitions: Record_.map(document.definitions, (value) => recur(value, ["definitions"], tracer))
  }
}
