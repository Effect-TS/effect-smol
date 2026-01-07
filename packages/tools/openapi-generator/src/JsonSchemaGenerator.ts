import * as Arr from "effect/Array"
import * as JsonSchema from "effect/JsonSchema"
import * as Rec from "effect/Record"
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
    const schemas: Array<JsonSchema.JsonSchema> = []

    const definitions: JsonSchema.Definitions = Rec.map(
      components,
      (js) => fromSchemaOpenApi(js).schema
    )

    for (const [name, js] of Object.entries(store)) {
      nameMap.push(name)
      schemas.push(fromSchemaOpenApi(js).schema)
    }

    if (Arr.isArrayNonEmpty(schemas)) {
      const multiDocument: SchemaStandard.MultiDocument = SchemaStandard.fromJsonSchemaMultiDocument({
        dialect: "draft-2020-12",
        schemas,
        definitions
      })

      const generationDocument = SchemaStandard.toGenerationDocument(multiDocument)

      const nonRecursives = generationDocument.references.nonRecursives.map(({ $ref, schema }) =>
        renderSchema($ref, schema)
      )
      const recursives = Object.entries(generationDocument.references.recursives).map(([$ref, schema]) =>
        renderSchema($ref, schema)
      )
      const generations = generationDocument.generations.map((g, i) => renderSchema(nameMap[i], g))

      const s = render("non-recursive definitions", nonRecursives) +
        render("recursive definitions", recursives) +
        render("schemas", generations)

      return s
    } else {
      return ""
    }

    function fromSchemaOpenApi(jsonSchema: JsonSchema.JsonSchema) {
      switch (source) {
        case "openapi-3.1":
          return JsonSchema.fromSchemaOpenApi3_1(jsonSchema)
        case "openapi-3.0":
          return JsonSchema.fromSchemaOpenApi3_0(jsonSchema)
      }
    }

    function renderSchema($ref: string, schema: SchemaStandard.Generation) {
      const strings = [`export type ${$ref} = ${schema.Type}`]
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
