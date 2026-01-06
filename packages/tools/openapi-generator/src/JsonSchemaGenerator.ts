import * as Arr from "effect/Array"
import * as JsonSchema from "effect/JsonSchema"
import * as SchemaStandard from "effect/SchemaStandard"

export function make() {
  const store: Record<string, JsonSchema.JsonSchema> = {}

  function addSchema(name: string, schema: JsonSchema.JsonSchema): string {
    store[name] = schema
    return name
  }

  function generate(
    source: "openapi-3.0" | "openapi-3.1",
    components: JsonSchema.Definitions,
    typeOnly: boolean
  ) {
    const nameMap: Array<string> = []
    const schemas: Array<SchemaStandard.Standard> = []

    const definitions: Record<string, SchemaStandard.Standard> = {}
    for (const [name, jsonSchema] of Object.entries(components)) {
      const definition = go(jsonSchema)
      if (definition._tag !== "Reference") {
        const annotations = definition.annotations
        addDefinition(name, { ...definition, annotations: { ...annotations, identifier: name } })
      } else {
        addDefinition(name, definition)
      }
    }

    for (const [name, jsonSchema] of Object.entries(store)) {
      nameMap.push(name)
      schemas.push(go(jsonSchema))
    }

    if (Arr.isArrayNonEmpty(schemas)) {
      const multiDocument: SchemaStandard.MultiDocument = {
        schemas,
        references: definitions
      }
      const generationDocument = SchemaStandard.toGenerationDocument(multiDocument)

      const nonRecursives = generationDocument.references.nonRecursives.map(({ $ref, schema }) =>
        renderSchema($ref, schema)
      )
      const recursives = Object.entries(generationDocument.references.recursives).map(([$ref, schema]) =>
        renderSchema($ref, schema)
      )
      const generations = generationDocument.generations.map((g, i) => renderSchema(nameMap[i], g))

      const s = render("schemas", generations) +
        render("non-recursive definitions", nonRecursives) +
        render("recursive definitions", recursives)

      return s
    } else {
      return ""
    }

    function normalize(jsonSchema: JsonSchema.JsonSchema) {
      switch (source) {
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
      for (const [name, definition] of Object.entries(standardDocument.references)) {
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

    function render(title: string, as: ReadonlyArray<string>) {
      if (as.length === 0) return ""
      return "// " + title + "\n" + as.join("\n") + "\n"
    }
  }

  return { addSchema, generate } as const
}
