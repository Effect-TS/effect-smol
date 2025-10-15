import * as Arr from "effect/collections/Array"
import * as Option from "effect/data/Option"
import * as Predicate from "effect/data/Predicate"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as ServiceMap from "effect/ServiceMap"
import type { JSONSchema } from "json-schema-typed/draft-2020-12"
import type { SchemaObject } from "openapi-typescript"
import * as JsonSchemaTransformer from "./JsonSchemaTransformer.ts"
import * as Utils from "./Utils.ts"

/**
 * The service for the JSON schema generator.
 */
export class JsonSchemaGenerator extends ServiceMap.Service<
  JsonSchemaGenerator,
  Effect.Success<typeof make>
>()("JsonSchemaGenerator") {}

/**
 * Represents a JSONSchema which is not a primitive boolean.
 */
type JsonSchema = Exclude<JSONSchema, boolean>

/**
 * Represents contextual information which can be used when adding schemas to
 * the generator.
 */
export interface OpenApiContext extends JsonSchema {
  readonly components?: {
    readonly schemas: Record<string, SchemaObject>
  } | undefined
}

export const make = Effect.gen(function*() {
  const transformer = yield* JsonSchemaTransformer.JsonSchemaTransformer

  const store = new Map<string, JsonSchema>()
  const refStore = new Map<string, JsonSchema>()
  const classes = new Set<string>()
  const enums = new Set<string>()
  const seenRefs = new Set<string>()

  function addSchema(name: string, root: JsonSchema, context?: OpenApiContext, asStruct = false): string {
    root = cleanupSchema(root)

    function addRefs(schema: JSONSchema, childName: string | undefined, asStruct = true) {
      if (typeof schema === "boolean") {
        return
      }
      schema = cleanupSchema(schema)
      const enumSuffix = childName?.endsWith("Enum") ? "" : "Enum"
      if (Predicate.isNotUndefined(schema.$ref)) {
        if (seenRefs.has(schema.$ref)) {
          return
        }
        seenRefs.add(schema.$ref)
        const resolved = resolveRef(schema, {
          ...root,
          ...context
        })
        if (!resolved) {
          return
        }
        if (store.has(resolved.name)) {
          return
        }
        refStore.set(schema.$ref, resolved.schema)
        addRefs(resolved.schema, resolved.name)
        store.set(resolved.name, resolved.schema)
        classes.add(resolved.name)
      } else if (Predicate.isNotUndefined(schema.properties)) {
        for (const [name, propSchema] of Object.entries(schema.properties)) {
          addRefs(propSchema as JsonSchema, childName ? childName + Utils.identifier(name) : undefined)
        }
      } else if (Predicate.isNotUndefined(schema.type) && schema.type === "array") {
        if (Array.isArray(schema.items)) {
          schema.items.forEach((s) => addRefs(s, undefined))
        } else if (schema.items) {
          addRefs(schema.items, undefined)
        }
      } else if (Predicate.isNotUndefined(schema.allOf)) {
        const resolved = resolveAllOf(schema, {
          ...root,
          ...context
        })
        if (childName !== undefined) {
          addRefs(resolved, childName + enumSuffix, asStruct)
          store.set(childName, resolved)
        } else {
          addRefs(resolved, undefined, asStruct)
        }
      } else if (Predicate.isNotUndefined(schema.anyOf)) {
        schema.anyOf.forEach((s) => addRefs(s as any, childName ? childName + enumSuffix : undefined))
      } else if (Predicate.isNotUndefined(schema.oneOf)) {
        ;(schema as any).oneOf.forEach((s: any) => addRefs(s, childName ? childName + enumSuffix : undefined))
      } else if (Predicate.isNotUndefined(schema.enum)) {
        if (childName !== undefined && !("const" in schema)) {
          store.set(childName, schema)
          enums.add(childName)
        }
      }
    }

    if (Predicate.isNotUndefined(root.$ref)) {
      addRefs(root, undefined, false)
      return Utils.identifier(root.$ref.split("/").pop()!)
    } else {
      addRefs(root, Predicate.isNotUndefined(root.properties) ? name : undefined)
      store.set(name, root)
      if (!asStruct) {
        classes.add(name)
      }
    }
    return name
  }

  function topLevelSource(importName: string, name: string, schema: JsonSchema): Option.Option<string> {
    const isClass = classes.has(name)
    const isEnum = enums.has(name)
    const topLevel = transformer.supportsTopLevel({
      importName,
      schema,
      name,
      isClass,
      isEnum
    })
    return toSource(
      importName,
      Object.keys(schema).length ? schema : {
        properties: {}
      } as JsonSchema,
      name,
      topLevel
    ).pipe(
      Option.map((source) =>
        transformer.onTopLevel({
          importName,
          schema,
          description: Utils.nonEmptyString(schema.description),
          name,
          source,
          isClass,
          isEnum
        })
      )
    )
  }

  function getSchema(raw: JsonSchema): JsonSchema {
    if (Predicate.isNotUndefined(raw.$ref)) {
      return refStore.get(raw.$ref) ?? raw
    }
    return cleanupSchema(raw)
  }

  function flattenAllOf(schema: JsonSchema): JsonSchema {
    if (Predicate.isNotUndefined(schema.allOf)) {
      let out = {} as JsonSchema
      for (const member of schema.allOf) {
        let s = getSchema(member as any)
        if (Predicate.isNotUndefined(s.allOf)) {
          s = flattenAllOf(s)
        }
        out = mergeSchemas(out, s)
      }
      return out
    }
    return getSchema(schema)
  }

  function toSource(
    importName: string,
    schema: JsonSchema,
    currentIdentifier: string,
    topLevel = false
  ): Option.Option<string> {
    schema = cleanupSchema(schema)
    if (Predicate.isNotUndefined(schema.properties)) {
      const obj = schema as JSONSchema.Object
      const required = obj.required ?? []
      const properties = pipe(
        Object.entries(obj.properties ?? {}),
        Arr.filterMap(([key, schema]) => {
          const fullSchema = getSchema(schema as JsonSchema)
          schema = cleanupSchema(schema as JsonSchema)
          const isOptional = !required.includes(key)
          const [enumNullable, filteredSchema] = filterNullable(fullSchema)
          return toSource(
            importName,
            enumNullable ? filteredSchema : schema,
            currentIdentifier + Utils.identifier(key)
          ).pipe(
            Option.map((source) =>
              transformer.onProperty({
                importName,
                description: Utils.nonEmptyString(schema.description),
                key,
                source,
                isOptional,
                isNullable: enumNullable ||
                  isSchemaNullable(fullSchema) ||
                  ("default" in fullSchema && fullSchema.default === null),
                default: fullSchema.default
              })
            )
          )
        }),
        Arr.join(transformer.propertySeparator)
      )
      return Option.some(
        transformer.onObject({ importName, properties, topLevel })
      )
    } else if (isSchemaNullable(schema)) {
      return Option.some(transformer.onNull({ importName }))
    } else if (Predicate.isNotUndefined(schema.type) && schema.type === "object") {
      return Option.some(transformer.onRecord({ importName }))
    } else if (Predicate.isNotUndefined(schema.const)) {
      return Option.some(
        transformer.onEnum({
          importName,
          items: [JSON.stringify(schema.const)]
        })
      )
    } else if (Predicate.isNotUndefined(schema.enum)) {
      if (!topLevel && enums.has(currentIdentifier)) {
        return Option.some(
          transformer.onRef({ importName, name: currentIdentifier })
        )
      } else if (!topLevel && enums.has(currentIdentifier + "Enum")) {
        return Option.some(
          transformer.onRef({ importName, name: currentIdentifier + "Enum" })
        )
      }
      const items = schema.enum.map((_) => JSON.stringify(_))
      return Option.some(
        transformer.onEnum({
          importName,
          items
        })
      )
    } else if (Predicate.isNotUndefined(schema.$ref)) {
      if (!schema.$ref.startsWith("#")) {
        return Option.none()
      }
      const name = Utils.identifier(schema.$ref.split("/").pop()!)
      return Option.some(transformer.onRef({ importName, name }))
    } else if (Predicate.isNotUndefined(schema.allOf)) {
      if (store.has(currentIdentifier)) {
        return Option.some(
          transformer.onRef({ importName, name: currentIdentifier })
        )
      }
      const sources = (schema as any).allOf as Array<JSONSchema>
      if (sources.length === 0) {
        return Option.none()
      }
      const flattened = flattenAllOf(schema)
      return toSource(
        importName,
        flattened,
        currentIdentifier + "Enum",
        topLevel
      )
    } else if (Predicate.isNotUndefined(schema.anyOf) || Predicate.isNotUndefined(schema.oneOf)) {
      let itemSchemas = "anyOf" in schema
        ? (schema.anyOf as Array<JsonSchema>)
        : (schema.oneOf as Array<JsonSchema>)
      let typePrimitives = 0
      const constItems = Arr.empty<JsonSchema>()
      for (const item of itemSchemas) {
        if (Predicate.isNotUndefined(item.type) && item.type !== "null") {
          typePrimitives++
        } else if (Predicate.isNotUndefined(item.const)) {
          constItems.push(item)
        }
      }
      if (
        typePrimitives <= 1 &&
        constItems.length > 0 &&
        constItems.length + typePrimitives === itemSchemas.length
      ) {
        itemSchemas = constItems
      }
      const items = pipe(
        itemSchemas,
        Arr.filterMap((_) =>
          toSource(importName, _, currentIdentifier + "Enum").pipe(
            Option.map(
              (source) =>
                ({
                  description: Utils.nonEmptyString(_.description),
                  title: Utils.nonEmptyString(_.title),
                  source
                }) as const
            )
          )
        )
      )
      if (items.length === 0) {
        return Option.none()
      } else if (items.length === 1) {
        return Option.some(items[0].source)
      }
      return Option.some(transformer.onUnion({ importName, items, topLevel }))
    } else if (Predicate.isNotUndefined(schema.type) && schema.type) {
      switch (schema.type) {
        case "string": {
          return Option.some(transformer.onString({
            importName,
            schema: schema as JSONSchema.String
          }))
        }
        case "integer":
        case "number": {
          const minimum = typeof schema.exclusiveMinimum === "number"
            ? schema.exclusiveMinimum
            : schema.minimum
          const exclusiveMinimum = typeof schema.exclusiveMinimum === "boolean"
            ? schema.exclusiveMinimum
            : typeof schema.exclusiveMinimum === "number"
          const maximum = typeof schema.exclusiveMaximum === "number"
            ? schema.exclusiveMaximum
            : schema.maximum
          const exclusiveMaximum = typeof schema.exclusiveMaximum === "boolean"
            ? schema.exclusiveMaximum
            : typeof schema.exclusiveMaximum === "number"
          return Option.some(
            transformer.onNumber({
              importName,
              schema: schema as JSONSchema.Number,
              minimum,
              exclusiveMinimum,
              maximum,
              exclusiveMaximum
            })
          )
        }
        case "boolean": {
          return Option.some(transformer.onBoolean({ importName }))
        }
        case "array": {
          const nonEmpty = typeof schema.minItems === "number" && schema.minItems > 0
          return toSource(importName, itemsSchema(schema.items), currentIdentifier).pipe(
            Option.map((item) =>
              transformer.onArray({
                importName,
                schema: schema as JSONSchema.Array,
                item,
                nonEmpty
              })
            )
          )
        }
      }
    }
    return Option.none()
  }

  function itemsSchema(schema: JSONSchema.Array["items"]): JsonSchema {
    if (Predicate.isUndefined(schema)) {
      return { $id: "/schemas/any" }
    } else if (Array.isArray(schema)) {
      return { anyOf: schema }
    }
    return schema as JsonSchema
  }

  function generate(importName: string) {
    return Effect.sync(() =>
      pipe(
        store.entries(),
        Arr.filterMap(([name, schema]) => topLevelSource(importName, name, schema)),
        Arr.join("\n\n")
      )
    )
  }

  return { addSchema, generate } as const
})

/**
 * Cleans up the provided `schema`.
 */
function cleanupSchema(schema: JsonSchema): JsonSchema {
  const cleaned = { ...schema }

  // Remove empty `oneOf` property if a `type` is also present
  if (
    Predicate.isNotUndefined(cleaned.type) &&
    Predicate.isNotUndefined(cleaned.oneOf) &&
    cleaned.oneOf.length === 0
  ) {
    delete cleaned.oneOf
  }

  // Assign single element composite schemas to themselves
  if (Predicate.isNotUndefined(cleaned.allOf) && cleaned.allOf.length === 1) {
    const item = cleaned.allOf[0]
    delete cleaned.allOf
    Object.assign(cleaned, item)
  }
  if (Predicate.isNotUndefined(cleaned.anyOf) && cleaned.anyOf.length === 1) {
    const item = cleaned.anyOf[0]
    delete cleaned.anyOf
    Object.assign(cleaned, item)
  }
  if (Predicate.isNotUndefined(cleaned.oneOf) && cleaned.oneOf.length === 1) {
    const item = cleaned.oneOf[0]
    delete cleaned.oneOf
    Object.assign(cleaned, item)
  }

  return cleaned
}

function resolveRef(schema: JsonSchema, context: OpenApiContext, recursive = false): {
  readonly name: string
  readonly schema: JsonSchema
} | undefined {
  if (Predicate.isUndefined(schema.$ref)) {
    return
  }
  if (!schema.$ref.startsWith("#")) {
    return
  }
  const path = schema.$ref.slice(2).split("/")
  const name = Utils.identifier(path[path.length - 1])
  let current = context
  for (const key of path) {
    if (!current) return
    current = (current as any)[key] as JsonSchema
  }
  return { name, schema: resolveAllOf(current, context, recursive) } as const
}

function resolveAllOf(
  schema: JsonSchema,
  context: OpenApiContext,
  resolveRefs = true
): JsonSchema {
  if (Predicate.isNotUndefined(schema.$ref)) {
    const resolved = resolveRef(schema, context, resolveRefs)
    if (Predicate.isUndefined(resolved)) {
      return schema
    }
    return resolved.schema
  } else if (Predicate.isNotUndefined(schema.allOf)) {
    if (schema.allOf.length <= 1) {
      const out = { ...schema }
      delete out.allOf
      if (schema.allOf.length === 0) {
        return out
      }
      Object.assign(out, schema.allOf[0])
      return resolveAllOf(out, context, resolveRefs)
    }
    let out = {} as JsonSchema
    for (const member of schema.allOf) {
      out = mergeSchemas(out, resolveAllOf(member as any, context, resolveRefs))
    }
    return out
  }
  return schema
}

function mergeSchemas(self: JsonSchema, other: JsonSchema): JsonSchema {
  if (
    Predicate.isNotUndefined(self.properties) &&
    Predicate.isNotUndefined(other.properties)
  ) {
    return {
      ...other,
      ...self,
      properties: {
        ...other.properties,
        ...self.properties
      },
      required: [...(other.required || []), ...(self.required || [])]
    }
  } else if (
    Predicate.isNotUndefined(self.anyOf) &&
    Predicate.isNotUndefined(other.anyOf)
  ) {
    return {
      ...other,
      ...self,
      anyOf: [...self.anyOf, ...other.anyOf] as any
    }
  }
  return { ...self, ...other } as any
}

/**
 * Returns `true` if the provided `schema` is assignable to `null`, otherwise
 * returns `false`.
 */
function isSchemaNullable(schema: JsonSchema): boolean {
  if (Predicate.isNotUndefined(schema.type)) {
    if (Array.isArray(schema.type)) {
      return schema.type.includes("null")
    }
    return schema.type === "null"
  }
  return false
}

function filterNullable(schema: JsonSchema) {
  if (Predicate.isNotUndefined(schema.oneOf) || Predicate.isNotUndefined(schema.anyOf)) {
    const items: Array<JsonSchema> = (schema.oneOf ?? schema.anyOf) as any
    const prop = Predicate.isNotUndefined(schema.oneOf) ? "oneOf" : "anyOf"
    let isNullable = false
    const otherItems = Arr.empty<JsonSchema>()
    for (const item of items) {
      if (!isSchemaNullable(item)) {
        isNullable = true
      } else if (Predicate.isNotUndefined(item.const) && item.const === null) {
        isNullable = true
      } else {
        otherItems.push(item)
      }
    }
    return [isNullable, { ...schema, [prop]: otherItems } as JsonSchema] as const
  }
  return [false, schema] as const
}
