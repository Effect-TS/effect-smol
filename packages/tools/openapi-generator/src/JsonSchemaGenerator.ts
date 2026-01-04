import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as JsonSchema from "effect/JsonSchema"
import * as SchemaFromJson from "effect/SchemaFromJson"
import * as SchemaStandard from "effect/SchemaStandard"
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
    source: JsonSchema.Dialect,
    spec: OpenAPISpec,
    typeOnly: boolean
  ) {
    const nameMap: Array<string> = []
    const schemas: Array<SchemaStandard.Standard> = []

    const definitions: Record<string, SchemaStandard.Standard> = {}
    for (const [name, jsonSchema] of Object.entries(spec.components?.schemas ?? {})) {
      addDefinition(name, go(jsonSchema))
    }

    for (const [name, jsonSchema] of Object.entries(store)) {
      nameMap.push(name)
      schemas.push(go(jsonSchema))
    }

    if (Arr.isArrayNonEmpty(schemas)) {
      const multiDocument: SchemaStandard.MultiDocument = {
        schemas,
        definitions
      }
      const generationDocument = SchemaStandard.toGenerationDocument(multiDocument)
      const imports = []
      for (const artifact of generationDocument.artifacts) {
        if (artifact._tag === "Import") {
          imports.push(artifact.importDeclaration)
        }
      }

      const nonRecursives = generationDocument.definitions.nonRecursives.map(({ $ref, schema }) =>
        renderSchema($ref, schema)
      )
      const recursives = Object.entries(generationDocument.definitions.recursives).map(([$ref, schema]) =>
        renderSchema($ref, schema)
      )
      const generations = generationDocument.generations.map((g, i) => renderSchema(nameMap[i], g))

      const s = `${render(imports)}${render(nonRecursives)}${render(recursives)}${render(generations)}`

      // console.log(s)
      const out = generateOld(source, spec, typeOnly)
      const s2 = out.imports + "\n\n" + out.schemas + "\n"
      return s === s2 ? s : s2
    } else {
      const out = generateOld(source, spec, typeOnly)
      return out.imports + "\n\n" + out.schemas + "\n"
    }

    function normalize(jsonSchema: JsonSchema.JsonSchema) {
      switch (source) {
        case "draft-07":
          return JsonSchema.fromSchemaDraft07(jsonSchema)
        case "draft-2020-12":
          return JsonSchema.fromSchemaDraft2020_12(jsonSchema)
        case "openapi-3.1":
          return JsonSchema.fromSchemaOpenApi3_1(jsonSchema)
        case "openapi-3.0":
          return JsonSchema.fromSchemaOpenApi3_0(jsonSchema)
      }
    }

    function addDefinition(name: string, definition: SchemaStandard.Standard) {
      if (name in definitions) {
        throw new Error(`Duplicate definition id: ${name}`)
      }
      definitions[name] = definition
    }

    function go(jsonSchema: JsonSchema.JsonSchema): SchemaStandard.Standard {
      const jsonDocument = normalize(jsonSchema)
      const standardDocument = SchemaStandard.fromJsonSchemaDocument(jsonDocument)
      for (const [name, definition] of Object.entries(standardDocument.definitions)) {
        addDefinition(name, definition)
      }
      return standardDocument.schema
    }

    function renderSchema($ref: string, schema: SchemaStandard.Generation) {
      const strings = [
        `export type ${$ref} = ${schema.Type}`,
        schema.Encoded !== schema.Type
          ? `export type ${$ref}Encoded = ${schema.Encoded}`
          : `export type ${$ref}Encoded = ${$ref}`
      ]
      if (!typeOnly) {
        strings.push(`export const ${$ref} = ${schema.runtime}`)
      }
      return strings.join("\n")
    }

    function render(as: ReadonlyArray<string>) {
      if (as.length === 0) return ""
      return "\n" + as.join("\n")
    }
  }

  function generateOld(
    source: JsonSchema.Dialect,
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
      const sanitized = Utils.sanitizeSchemaName(ref)

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
