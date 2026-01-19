import * as Arr from "effect/Array"
import * as JsonSchema from "effect/JsonSchema"
import * as Rec from "effect/Record"
import * as SchemaRepresentation from "effect/SchemaRepresentation"

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

    // Add schemas from store (parameter schemas, inline schemas, etc.)
    for (const [name, js] of Object.entries(store)) {
      nameMap.push(name)
      schemas.push(fromSchemaOpenApi(js).schema)
    }

    // Add a meta schema that references all component schemas
    // This ensures they all get extracted as non-recursive definitions
    if (Object.keys(components).length > 0) {
      const properties: Record<string, any> = {}
      for (const name of Object.keys(components)) {
        properties[name] = { $ref: `#/${name}` }
      }
      nameMap.push("__AllComponentSchemas__")
      schemas.push({
        type: "object" as JsonSchema.Type,
        properties,
        additionalProperties: false
      })
    }

    if (Arr.isArrayNonEmpty(schemas)) {
      const multiDocument: SchemaRepresentation.MultiDocument = SchemaRepresentation.fromJsonSchemaMultiDocument({
        dialect: "draft-2020-12",
        schemas,
        definitions
      })

      const codeDocument = SchemaRepresentation.toCodeDocument(multiDocument)

      // Collect all names that need sanitization
      const namesForSanitization = [...nameMap]
      for (const { $ref } of codeDocument.references.nonRecursives) {
        if (!namesForSanitization.includes($ref)) {
          namesForSanitization.push($ref)
        }
      }
      for (const $ref of Object.keys(codeDocument.references.recursives)) {
        if (!namesForSanitization.includes($ref)) {
          namesForSanitization.push($ref)
        }
      }

      const nonRecursives = codeDocument.references.nonRecursives.map(({ $ref, code }) =>
        renderSchema($ref, code, namesForSanitization)
      )
      const recursives = Object.entries(codeDocument.references.recursives).map(([$ref, code]) =>
        renderSchema($ref, code, namesForSanitization)
      )
      const codes = codeDocument.codes
        .map((code, i) => ({ name: nameMap[i], code }))
        .filter(({ name }) => name !== "__AllComponentSchemas__")
        .map(({ name, code }) => renderSchema(name, code, namesForSanitization))

      const s = render("non-recursive definitions", nonRecursives) +
        render("recursive definitions", recursives) +
        render("schemas", codes)

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

    function sanitizeIdentifier(name: string): string {
      return name.replace(/-/g, "_")
    }

    function sanitizeCode(codeStr: string, names: Array<string>): string {
      let result = codeStr
      for (const name of names) {
        if (name.includes("-")) {
          const sanitized = sanitizeIdentifier(name)
          const regex = new RegExp(`\\b${name.replace(/-/g, "\\-")}\\b`, "g")
          result = result.replace(regex, sanitized)
        }
      }
      return result
    }

    function renderSchema($ref: string, code: SchemaRepresentation.Code, names: Array<string>) {
      const sanitized = sanitizeIdentifier($ref)
      const sanitizedType = sanitizeCode(code.Type, names)
      const strings = [`export type ${sanitized} = ${sanitizedType}`]
      if (!typeOnly) {
        const sanitizedRuntime = sanitizeCode(code.runtime, names)
        strings.push(`export const ${sanitized} = ${sanitizedRuntime}`)
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
