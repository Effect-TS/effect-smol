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

    const nonRecursiveReferences = generated.codeDocument.references.nonRecursives
    const recursiveReferences = Object.entries(generated.codeDocument.references.recursives)

    const nonRecursives = nonRecursiveReferences.map(({ $ref, code }) =>
      renderSchemaTypeAndRuntime($ref, code, typeOnly)
    )

    const recursiveDeclarations: Array<string> = []
    const recursives: Array<string> = []

    if (typeOnly) {
      for (const [$ref, code] of recursiveReferences) {
        recursives.push(renderSchemaTypeAndRuntime($ref, code, true))
      }
    } else {
      const recursivelyForwardReferenced = collectForwardReferencedRecursives(
        nonRecursiveReferences,
        recursiveReferences
      )
      const recursiveInternalNames = makeRecursiveInternalNameMap(
        recursivelyForwardReferenced,
        [
          ...nonRecursiveReferences.map(({ $ref }) => $ref),
          ...recursiveReferences.map(([$ref]) => $ref),
          ...generated.nameMap
        ]
      )

      for (const [$ref, code] of recursiveReferences) {
        if (recursivelyForwardReferenced.has($ref)) {
          const internalName = recursiveInternalNames.get($ref)!
          recursiveDeclarations.push(renderRecursiveReferenceDeclaration($ref, code, internalName))
          recursives.push(`const ${internalName} = ${code.runtime}`)
          continue
        }

        recursives.push(renderSchemaTypeAndRuntime($ref, code, false))
      }
    }

    const codes = generated.codeDocument.codes.map((code, i) =>
      renderSchemaTypeAndRuntime(generated.nameMap[i], code, typeOnly)
    )

    return render("recursive declarations", recursiveDeclarations) +
      render("non-recursive definitions", nonRecursives) +
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

    const nonRecursiveReferences = generated.codeDocument.references.nonRecursives
    const recursiveReferences = Object.entries(generated.codeDocument.references.recursives)

    const nonRecursives = nonRecursiveReferences.map(({ $ref, code }) =>
      renderSchemaHttpApi($ref, code, generated.rawSchemaByName[$ref])
    )

    const recursivelyForwardReferenced = collectForwardReferencedRecursives(nonRecursiveReferences, recursiveReferences)
    const recursiveInternalNames = makeRecursiveInternalNameMap(
      recursivelyForwardReferenced,
      [
        ...nonRecursiveReferences.map(({ $ref }) => $ref),
        ...recursiveReferences.map(([$ref]) => $ref),
        ...generated.nameMap
      ]
    )

    const recursiveDeclarations: Array<string> = []
    const recursives: Array<string> = []

    for (const [$ref, code] of recursiveReferences) {
      if (recursivelyForwardReferenced.has($ref)) {
        const internalName = recursiveInternalNames.get($ref)!
        recursiveDeclarations.push(renderRecursiveReferenceDeclaration($ref, code, internalName))
        recursives.push(`const ${internalName} = ${code.runtime}`)
        continue
      }

      recursives.push(renderSchemaTypeAndRuntime($ref, code, false))
    }

    const codes = generated.codeDocument.codes.map((code, i) =>
      renderSchemaHttpApi(generated.nameMap[i], code, generated.rawSchemaByName[generated.nameMap[i]])
    )

    return render("recursive declarations", recursiveDeclarations) +
      render("non-recursive definitions", nonRecursives) +
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

function renderRecursiveReferenceDeclaration(
  $ref: string,
  code: SchemaRepresentation.Code,
  internalName: string
): string {
  return [
    `export type ${$ref} = ${code.Type}`,
    `export const ${$ref} = Schema.suspend((): Schema.Codec<${$ref}> => ${internalName})`
  ].join("\n")
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

const tokenPattern = /[A-Za-z_$][A-Za-z0-9_$]*/g

function collectForwardReferencedRecursives(
  nonRecursives: ReadonlyArray<{
    readonly $ref: string
    readonly code: SchemaRepresentation.Code
  }>,
  recursives: ReadonlyArray<readonly [string, SchemaRepresentation.Code]>
): Set<string> {
  const recursiveNames = new Set(recursives.map(([name]) => name))
  const referenced = new Set<string>()

  for (const { code } of nonRecursives) {
    for (const token of code.runtime.matchAll(tokenPattern)) {
      const identifier = token[0]
      if (recursiveNames.has(identifier)) {
        referenced.add(identifier)
      }
    }
  }

  return referenced
}

function makeRecursiveInternalNameMap(
  recursiveNames: ReadonlySet<string>,
  existingNames: ReadonlyArray<string>
): Map<string, string> {
  const usedNames = new Set(existingNames)
  const internalNames = new Map<string, string>()

  for (const name of recursiveNames) {
    let candidate = `__recursive_${name}`
    while (usedNames.has(candidate)) {
      candidate = `_${candidate}`
    }
    usedNames.add(candidate)
    internalNames.set(name, candidate)
  }

  return internalNames
}
