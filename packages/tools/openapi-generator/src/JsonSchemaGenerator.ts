import * as Arr from "effect/Array"
import * as JsonSchema from "effect/JsonSchema"
import * as Rec from "effect/Record"
import * as SchemaRepresentation from "effect/SchemaRepresentation"

type Source = "openapi-3.0" | "openapi-3.1"

interface GenerateOptions {
  readonly onEnter?: ((js: JsonSchema.JsonSchema) => JsonSchema.JsonSchema) | undefined
}

export function make() {
  const store: Record<string, JsonSchema.JsonSchema> = {}

  function addSchema(name: string, schema: JsonSchema.JsonSchema): string {
    if (name in store) {
      throw new Error(`Schema ${name} already exists`)
    }
    store[name] = schema
    return name
  }

  function generate(
    source: Source,
    components: JsonSchema.Definitions,
    typeOnly: boolean,
    options?: GenerateOptions
  ) {
    const generated = makeCodeDocument(source, components, options)
    if (generated === undefined) {
      return ""
    }

    const nonRecursives = generated.codeDocument.references.nonRecursives.map(({ $ref, code }) =>
      renderSchemaTypeAndRuntime($ref, code, typeOnly)
    )
    const recursives = Object.entries(generated.codeDocument.references.recursives).map(([$ref, code]) =>
      renderSchemaTypeAndRuntime($ref, code, typeOnly)
    )
    const codes = generated.codeDocument.codes.map((code, i) =>
      renderSchemaTypeAndRuntime(generated.nameMap[i], code, typeOnly)
    )

    return render("non-recursive definitions", nonRecursives) +
      render("recursive definitions", recursives) +
      render("schemas", codes)
  }

  function generateHttpApi(
    source: Source,
    components: JsonSchema.Definitions,
    options?: GenerateOptions
  ) {
    const generated = makeCodeDocument(source, components, options)
    if (generated === undefined) {
      return ""
    }

    const nonRecursives = generated.codeDocument.references.nonRecursives.map(({ $ref, code }) =>
      renderSchemaHttpApi($ref, code, generated.rawSchemaByName[$ref])
    )
    const recursives = Object.entries(generated.codeDocument.references.recursives).map(([$ref, code]) =>
      renderSchemaTypeAndRuntime($ref, code, false)
    )
    const codes = generated.codeDocument.codes.map((code, i) =>
      renderSchemaHttpApi(generated.nameMap[i], code, generated.rawSchemaByName[generated.nameMap[i]])
    )

    return render("non-recursive definitions", nonRecursives) +
      render("recursive definitions", recursives) +
      render("schemas", codes)
  }

  function makeCodeDocument(
    source: Source,
    components: JsonSchema.Definitions,
    options?: GenerateOptions
  ): {
    readonly nameMap: Array<string>
    readonly codeDocument: SchemaRepresentation.CodeDocument
    readonly rawSchemaByName: Record<string, JsonSchema.JsonSchema>
  } | undefined {
    const nameMap: Array<string> = []
    const schemas: Array<JsonSchema.JsonSchema> = []
    const rawSchemaByName: Record<string, JsonSchema.JsonSchema> = { ...components }

    const definitions: JsonSchema.Definitions = Rec.map(
      components,
      (js) => fromSchemaOpenApi(source, js).schema
    )

    for (const [name, js] of Object.entries(store)) {
      nameMap.push(name)
      rawSchemaByName[name] = js
      schemas.push(fromSchemaOpenApi(source, js).schema)
    }

    if (!Arr.isArrayNonEmpty(schemas)) {
      return
    }

    const multiDocument: SchemaRepresentation.MultiDocument = SchemaRepresentation.fromJsonSchemaMultiDocument({
      dialect: "draft-2020-12",
      schemas,
      definitions
    }, {
      onEnter(js) {
        const out = { ...js }
        if (out.type === "object" && out.additionalProperties === undefined) {
          out.additionalProperties = false
        }
        return options?.onEnter?.(out) ?? out
      }
    })

    return {
      nameMap,
      rawSchemaByName,
      codeDocument: SchemaRepresentation.toCodeDocument(multiDocument)
    }
  }

  return { addSchema, generate, generateHttpApi } as const
}

function fromSchemaOpenApi(source: Source, jsonSchema: JsonSchema.JsonSchema) {
  switch (source) {
    case "openapi-3.1":
      return JsonSchema.fromSchemaOpenApi3_1(jsonSchema)
    case "openapi-3.0":
      return JsonSchema.fromSchemaOpenApi3_0(jsonSchema)
  }
}

function renderSchemaTypeAndRuntime($ref: string, code: SchemaRepresentation.Code, typeOnly: boolean) {
  const strings = [`export type ${$ref} = ${code.Type}`]
  if (!typeOnly) {
    strings.push(`export const ${$ref} = ${code.runtime}`)
  }
  return strings.join("\n")
}

function renderSchemaHttpApi(
  $ref: string,
  code: SchemaRepresentation.Code,
  rawSchema: JsonSchema.JsonSchema | undefined
) {
  const classFields = extractStructFields(code.runtime)
  if (isStructLike(rawSchema) && classFields !== undefined) {
    return `export class ${$ref} extends Schema.Class<${$ref}>(${JSON.stringify($ref)})(${classFields}) {}`
  }
  return [
    `export const ${$ref} = ${code.runtime}`,
    `export type ${$ref} = typeof ${$ref}.Type`
  ].join("\n")
}

function isStructLike(schema: JsonSchema.JsonSchema | undefined): boolean {
  if (schema === undefined || typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    return false
  }
  if (schema.type !== "object") {
    return false
  }
  return "properties" in schema
}

function extractStructFields(runtime: string): string | undefined {
  const prefix = "Schema.Struct("
  const trimmed = runtime.trim()
  if (!trimmed.startsWith(prefix)) {
    return
  }

  const rest = trimmed.slice(prefix.length)
  let depth = 1
  for (let i = 0; i < rest.length; i++) {
    const char = rest[i]
    if (char === "(") {
      depth += 1
    } else if (char === ")") {
      depth -= 1
      if (depth === 0) {
        if (i !== rest.length - 1) {
          return
        }
        return rest.slice(0, i)
      }
    }
  }
  return
}

function render(title: string, as: ReadonlyArray<string>) {
  if (as.length === 0) return ""
  return "// " + title + "\n" + as.join("\n") + "\n"
}
