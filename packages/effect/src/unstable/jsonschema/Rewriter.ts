/**
 * @since 4.0.0
 */
import * as Predicate from "effect/data/Predicate"
import { constTrue } from "effect/Function"
import * as Boolean_ from "../../Boolean.ts"
import * as Array_ from "../../collections/Array.ts"
import * as Combiner from "../../data/Combiner.ts"
import * as Struct from "../../data/Struct.ts"
import * as UndefinedOr from "../../data/UndefinedOr.ts"
import * as Number_ from "../../Number.ts"
import type * as Schema from "../../schema/Schema.ts"

/**
 * @since 4.0.0
 */
export type Path = readonly ["schema" | "definitions", ...ReadonlyArray<string | number>]

/**
 * @since 4.0.0
 */
export type Change = {
  readonly name: string // short machine id, e.g. "root.wrapObject"
  readonly path: Path // where the change happened
  readonly summary: string // human-friendly one-liner
}

/**
 * @since 4.0.0
 */
export interface Tracer {
  push(change: Change): void
}

/**
 * @since 4.0.0
 */
export const NoopTracer: Tracer = { push() {} }

interface Context {
  readonly path: Path
  readonly definitions: Schema.JsonSchema.Definitions
  readonly tracer: Tracer
}

/**
 * @since 4.0.0
 */
export interface FragmentRewriter {
  (fragment: Schema.JsonSchema.Fragment, ctx: Context): Schema.JsonSchema.Fragment | undefined
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
  function recur(fragment: any, ctx: Context): any {
    if (Array.isArray(fragment)) {
      return fragment.map((v, i) => recur(v, { ...ctx, path: [...ctx.path, i] }))
    } else if (fragment && typeof fragment === "object") {
      let out = { ...fragment }
      for (const key of Object.keys(out)) {
        out[key] = recur(out[key], { ...ctx, path: [...ctx.path, key] })
      }
      for (const r of rewriters) {
        const fragment = r(out, ctx)
        if (fragment) out = fragment
      }
      return out
    } else {
      return fragment
    }
  }

  return (document: Schema.JsonSchema.Document, tracer: Tracer = NoopTracer): Schema.JsonSchema.Document => {
    return {
      uri: document.uri,
      schema: recur(document.schema, { path: ["schema"], definitions: document.definitions, tracer }),
      definitions: recur(document.definitions, { path: ["definitions"], definitions: document.definitions, tracer })
    }
  }
}

/**
 * @since 4.0.0
 */
export function whitelistProperties(
  schema: Schema.JsonSchema.Schema,
  ctx: Context,
  whitelist: Record<string, (value: unknown) => boolean>
) {
  const out = { ...schema }
  for (const key of Object.keys(schema)) {
    if (key === "type" || (key in whitelist && whitelist[key](schema[key]))) continue

    // tracer
    ctx.tracer.push({
      name: "remove-unsupported-property",
      path: ctx.path,
      summary: `removed unsupported property "${key}"`
    })

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
  f: (schema: Schema.JsonSchema.Schema, ctx: Context) => Schema.JsonSchema.Fragment | undefined
): FragmentRewriter {
  return (fragment, ctx) => {
    if (isSchema(ctx.path)) return f(fragment, ctx)
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
  f: (schema: JsonObject, ctx: Context) => Schema.JsonSchema.Fragment | undefined
): FragmentRewriter {
  return onSchema((fragment, ctx) => {
    if (fragment.type === "object") return f(fragment as JsonObject, ctx)
  })
}

// Return a pattern string that matches iff the ENTIRE string matches A and B.
function combinePatterns(a: string, b: string): string {
  const A = stripAnchors(a)
  const B = stripAnchors(b)
  return `(?=(?:${A})$)(?=(?:${B})$).*$`
}

function stripAnchors(src: string): string {
  // remove a single leading ^ and trailing $ if present
  return src.replace(/^\^/, "").replace(/\$$/, "")
}

const or = UndefinedOr.getReducer(Boolean_.ReducerOr)
const last = UndefinedOr.getReducer(Combiner.last())
const join = UndefinedOr.getReducer(Combiner.make<string>((a, b) => `${a} and ${b}`))

const combiner: Combiner.Combiner<any> = Struct.getCombiner({
  type: UndefinedOr.getReducer(Combiner.first<string>()),
  description: join,
  title: join,
  default: last,
  examples: UndefinedOr.getReducer(Array_.getReducerConcat()),
  minimum: UndefinedOr.getReducer(Number_.ReducerMax),
  maximum: UndefinedOr.getReducer(Number_.ReducerMin),
  exclusiveMinimum: or,
  exclusiveMaximum: or,
  multipleOf: UndefinedOr.getReducer(Number_.ReducerMultiply),
  format: last,
  pattern: UndefinedOr.getReducer(Combiner.make(combinePatterns))
}, {
  omitKeyWhen: Predicate.isUndefined
})

function mergeAllOf(
  schema: Schema.JsonSchema.Schema,
  allOf: Array<Schema.JsonSchema.Fragment>
): Schema.JsonSchema.Schema {
  return allOf.reduce((acc, curr) => combiner.combine(acc, curr), schema)
}

/**
 * @see https://platform.openai.com/docs/guides/structured-outputs/supported-schemas?type-restrictions=string-restrictions#supported-schemas
 *
 * @since 4.0.0
 */
export const openAi = make([
  // rewrite top level refs
  onSchema((schema, ctx) => {
    if (
      ctx.path.length === 1 && ctx.path[0] === "schema" && Predicate.isString(schema.$ref)
    ) {
      const identifier = unescapeJsonPointer(schema.$ref.split("/").at(-1)!)

      // tracer
      ctx.tracer.push({
        name: "replace-top-level-ref-with-definition",
        path: ctx.path,
        summary: `replaced top level ref "${identifier}" with its definition`
      })

      return ctx.definitions[identifier]
    }
  }),

  // root must be an object
  onSchema((schema, ctx) => {
    if (ctx.path.length === 1 && ctx.path[0] === "schema" && schema.type !== "object") {
      // tracer
      ctx.tracer.push({
        name: "root-must-be-an-object",
        path: ctx.path,
        summary: `replaced top level non-object with an empty object`
      })

      return {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": false
      }
    }
  }),

  // merge allOf
  onSchema((schema, ctx) => {
    if (Array.isArray(schema.allOf)) {
      const { allOf, ...rest } = schema

      // tracer
      ctx.tracer.push({
        name: "merge-allOf-fragments",
        path: ctx.path,
        summary: `merged ${allOf.length} allOf fragment(s)`
      })

      return mergeAllOf(rest, allOf)
    }
  }),

  // Supported properties
  onSchema((schema, ctx) => {
    const jsonSchemaAnnotations = {
      title: constTrue,
      description: constTrue,
      default: constTrue,
      examples: constTrue
    }
    if (schema.type === "string") {
      return whitelistProperties(schema, ctx, {
        ...jsonSchemaAnnotations,
        enum: constTrue,
        pattern: constTrue,
        format: (format) =>
          Predicate.isString(format) && format in {
              "date-time": true,
              "time": true,
              "date": true,
              "duration": true,
              "email": true,
              "hostname": true,
              "ipv4": true,
              "ipv6": true,
              "uuid": true
            }
      })
    } else if (schema.type === "number") {
      return whitelistProperties(schema, ctx, {
        ...jsonSchemaAnnotations,
        enum: constTrue,
        multipleOf: constTrue,
        minimum: constTrue,
        maximum: constTrue,
        exclusiveMinimum: constTrue,
        exclusiveMaximum: constTrue
      })
    } else if (schema.type === "array") {
      return whitelistProperties(schema, ctx, {
        ...jsonSchemaAnnotations,
        items: constTrue,
        additionalItems: constTrue,
        prefixItems: constTrue,
        minItems: constTrue,
        maxItems: constTrue
      })
    } else if (schema.type === "object") {
      return whitelistProperties(schema, ctx, {
        ...jsonSchemaAnnotations,
        properties: constTrue,
        required: constTrue,
        additionalProperties: constTrue
      })
    }
  }),

  // additionalProperties: false must always be set in objects
  onObject((schema, ctx) => {
    if (schema.additionalProperties !== false) {
      // tracer
      ctx.tracer.push({
        name: "additionalProperties-must-be-false",
        path: ctx.path,
        summary: `set additionalProperties to false`
      })

      return { ...schema, additionalProperties: false }
    }
  }),

  // all fields must be required
  // it is possible to emulate an optional parameter by using a union type with null
  onObject((schema, ctx) => {
    const keys = Object.keys(schema.properties)
    if (schema.required.length < keys.length) {
      const required = new Set(schema.required)
      // clone the schema
      const out = { ...schema }
      out.required = [...out.required]

      for (const key of keys) {
        if (!required.has(key)) {
          // tracer
          ctx.tracer.push({
            name: "add-required-property",
            path: ctx.path,
            summary: `added required property "${key}"`
          })

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

  // rewrite oneOf to anyOf
  onSchema((schema, ctx) => {
    if ("oneOf" in schema) {
      // tracer
      ctx.tracer.push({
        name: "rewrite-oneOf-to-anyOf",
        path: ctx.path,
        summary: `rewrote oneOf to anyOf`
      })

      const out = { ...schema }
      out.anyOf = out.oneOf
      delete out.oneOf
      return out
    }
  })
])
