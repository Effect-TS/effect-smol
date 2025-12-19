import * as Effect from "effect/Effect"
import type * as JsonSchema from "effect/JsonSchema"
import * as SchemaFromJson from "effect/SchemaFromJson"
import * as ServiceMap from "effect/ServiceMap"
import type { OpenAPISpec } from "effect/unstable/httpapi/OpenApi"
import * as Utils from "./Utils.ts"
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

// This will be replaced by a closure in the generate function to use the refToSanitized map
const makeResolver = (refToSanitized: Map<string, string>): SchemaFromJson.Resolver => (ref) => {
  if (ref in effectSchemas) {
    return SchemaFromJson.makeGenerationExtern(
      effectSchemas[ref].namespace,
      effectSchemas[ref].importDeclaration
    )
  }
  // Use pre-computed sanitized name
  const sanitizedRef = refToSanitized.get(ref) ?? Utils.sanitizeSchemaName(ref)

  return SchemaFromJson.makeGeneration(
    sanitizedRef,
    SchemaFromJson.makeTypes(sanitizedRef, `${sanitizedRef}Encoded`)
  )
}

export const make = Effect.gen(function*() {
  const store: Record<string, JsonSchema.JsonSchema> = {}

  function addSchema(name: string, schema: JsonSchema.JsonSchema): string {
    store[name] = schema
    return name
  }

  function generate(
    source: JsonSchema.Source,
    spec: OpenAPISpec,
    typeOnly: boolean
  ): { schemas: string; imports: string } {
    const schemas: Array<string> = []
    const imports = new Set<string>()
    const generations: Array<{
      readonly name: string | undefined
      readonly generation: SchemaFromJson.Generation
    }> = []

    function addImportDeclarations(importDeclarations: ReadonlySet<string>) {
      for (const id of importDeclarations) {
        imports.add(id)
      }
    }

    const definitions: JsonSchema.Definitions = spec.components?.schemas ?? {}

    // Build sanitized name mapping and detect collisions
    const refToSanitized = new Map<string, string>()
    const usedNames = new Set<string>()

    for (const ref of Object.keys(definitions)) {
      let sanitized = Utils.sanitizeSchemaName(ref)

      // Handle collision by appending numeric suffix
      let counter = 1
      let candidate = sanitized
      while (usedNames.has(candidate)) {
        candidate = `${sanitized}${counter}`
        counter++
      }

      refToSanitized.set(ref, candidate)
      usedNames.add(candidate)
    }

    const resolver = makeResolver(refToSanitized)
    const options = {
      source,
      resolver,
      extractJsDocs: true
    }

    // dependencies
    if (spec.components) {
      SchemaFromJson.generateDefinitions(definitions, options).forEach(({ generation, ref }) => {
        const sanitizedRef = refToSanitized.get(ref) ?? ref
        generations.push({ name: ref in effectSchemas ? undefined : sanitizedRef, generation })
      })
    }

    // schemas
    Object.entries(store).forEach(([name, schema]) => {
      const generation = SchemaFromJson.generate(schema, {
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
