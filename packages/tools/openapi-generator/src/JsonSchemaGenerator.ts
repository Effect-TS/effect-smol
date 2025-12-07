import * as Effect from "effect/Effect"
import * as FromJsonSchema from "effect/schema/FromJsonSchema"
import type * as Schema from "effect/schema/Schema"
import * as ServiceMap from "effect/ServiceMap"
import type { OpenAPISpec } from "effect/unstable/httpapi/OpenApi"
/**
 * The service for the JSON schema generator.
 */
export class JsonSchemaGenerator extends ServiceMap.Service<
  JsonSchemaGenerator,
  Effect.Success<typeof make>
>()("JsonSchemaGenerator") {}

/**
 * The effect schemas that must be imported instead of being generated.
 */
const effectSchemas: Record<string, {
  readonly namespace: string
  readonly importDeclaration: string
}> = {
  "effect/HttpApiSchemaError": {
    namespace: "HttpApiSchemaError",
    importDeclaration: `import { HttpApiSchemaError } from "effect/unstable/httpapi/HttpApiError"`
  }
}

const resolver: FromJsonSchema.Resolver = (ref) => {
  if (ref in effectSchemas) {
    return FromJsonSchema.makeGenerationExtern(
      effectSchemas[ref].namespace,
      effectSchemas[ref].importDeclaration
    )
  }
  return FromJsonSchema.makeGeneration(
    ref,
    FromJsonSchema.makeTypes(ref, `${ref}Encoded`)
  )
}

export const make = Effect.gen(function*() {
  const store: Record<string, Schema.JsonSchema> = {}

  function addSchema(name: string, schema: Schema.JsonSchema): string {
    store[name] = schema
    return name
  }

  function generate(
    source: FromJsonSchema.Source,
    spec: OpenAPISpec,
    typeOnly: boolean
  ): { schemas: string; imports: string } {
    const schemas: Array<string> = []
    const imports = new Set<string>()
    const generations: Array<{
      readonly name: string | undefined
      readonly generation: FromJsonSchema.Generation
    }> = []

    function addImportDeclarations(importDeclarations: ReadonlySet<string>) {
      for (const id of importDeclarations) {
        imports.add(id)
      }
    }

    const definitions: Schema.JsonSchema.Definitions = spec.components?.schemas ?? {}
    const options = {
      source,
      resolver,
      extractJsDocs: true
    }

    // dependencies
    if (spec.components) {
      FromJsonSchema.generateDefinitions(definitions, options).forEach(({ generation, ref }) => {
        generations.push({ name: ref in effectSchemas ? undefined : ref, generation })
      })
    }

    // schemas
    Object.entries(store).forEach(([name, schema]) => {
      const generation = FromJsonSchema.generate(schema, {
        ...options,
        definitions
      })
      generations.push({ name, generation })
    })

    for (const { generation, name } of generations) {
      addImportDeclarations(generation.importDeclarations)
      const jsDocs = generation.jsDocs ?? ""
      if (name) {
        const strings = [
          jsDocs + `export type ${name} = ${generation.types.Type}`,
          generation.types.Encoded !== generation.types.Type
            ? `export type ${name}Encoded = ${generation.types.Encoded}`
            : `export type ${name}Encoded = ${name}`
        ]
        if (!typeOnly) {
          strings.push(jsDocs + `export const ${name} = ${generation.code}`)
        }
        schemas.push(strings.join("\n"))
      }
    }
    return {
      schemas: schemas.join("\n\n"),
      imports: Array.from(imports).join("\n")
    }
  }

  return { addSchema, generate } as const
})
