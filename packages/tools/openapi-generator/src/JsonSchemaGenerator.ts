import * as Effect from "effect/Effect"
import * as FromJsonSchema from "effect/schema/FromJsonSchema"
import type * as Schema from "effect/schema/Schema"
import * as ServiceMap from "effect/ServiceMap"
import type { JSONSchema } from "json-schema-typed/draft-2020-12"

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
    readonly schemas: Schema.JsonSchema.Definitions
  } | undefined
}

export const make = Effect.gen(function*() {
  const store: Record<string, {
    readonly schema: JSONSchema
    readonly context?: OpenApiContext | undefined
    readonly asStruct: boolean
  }> = {}

  function addSchema(name: string, root: JSONSchema, context?: OpenApiContext, asStruct = false): string {
    store[name] = { schema: root, context, asStruct }
    return name
  }

  function generate(source: FromJsonSchema.Source): { schemas: string; imports: string } {
    const schemas: Array<string> = []
    const imports = new Set<string>()
    for (const [name, { context, schema }] of Object.entries(store)) {
      const generation = FromJsonSchema.generate(schema, {
        source,
        extractJsDocs: true,
        definitions: context?.components?.schemas
      })
      schemas.push(`export const ${name} = ${generation.runtime}`)
      for (const importDeclaration of generation.importDeclarations) {
        imports.add(importDeclaration)
      }
    }
    return { schemas: schemas.join("\n\n"), imports: Array.from(imports).join("\n") }
  }

  return { addSchema, generate } as const
})
