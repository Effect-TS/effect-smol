import * as Arr from "../../Array.ts"
import { format } from "../../Formatter.ts"
import type * as JsonSchema from "../../JsonSchema.ts"
import * as Predicate from "../../Predicate.ts"
import * as Rec from "../../Record.ts"
import * as RegEx from "../../RegExp.ts"
import type * as Schema from "../../Schema.ts"
import * as AST from "../../SchemaAST.ts"
import type * as SchemaStandard from "../../SchemaStandard.ts"
import * as InternalAnnotations from "./annotations.ts"
import { escapeToken, unescapeToken } from "./json-pointer.ts"
import * as InternalSerializer from "./serializer.ts"

/** @internal */
export function fromAST(ast: AST.AST): SchemaStandard.Document {
  const { definitions, schemas } = fromASTs([ast])
  return { schema: schemas[0], definitions }
}

/** @internal */
export function fromASTs(asts: readonly [AST.AST, ...Array<AST.AST>]): SchemaStandard.MultiDocument {
  const definitions: Record<string, SchemaStandard.Standard> = {}

  const identifierMap = new Map<AST.AST, string>()
  const identifierCounter = new Map<string, number>()
  const usedIdentifiers = new Set<string>()
  const visited = new Set<AST.AST>()

  return {
    schemas: Arr.map(asts, recur),
    definitions
  }

  function recur(ast: AST.AST): SchemaStandard.Standard {
    visited.add(ast)
    const last = getLastEncoding(ast)
    const identifier = generateUniqueIdentifier(last)
    if (identifier !== undefined) {
      if (definitions[identifier] === undefined) {
        definitions[identifier] = on(last)
      }
      return { _tag: "Reference", $ref: identifier }
    }
    return on(last)
  }

  function generateUniqueIdentifier(ast: AST.AST): string | undefined {
    const existing = identifierMap.get(ast)
    if (existing !== undefined) {
      usedIdentifiers.add(existing)
      return existing
    }
    const identifier = InternalAnnotations.resolveIdentifier(ast)
    if (identifier !== undefined) {
      // Check if base identifier is available
      if (!usedIdentifiers.has(identifier)) {
        identifierCounter.set(identifier, 0)
        identifierMap.set(ast, identifier)
        usedIdentifiers.add(identifier)
        return identifier
      }
      // Find a unique identifier by incrementing until we find one that doesn't exist
      let count = (identifierCounter.get(identifier) ?? 0) + 1
      let newIdentifier = generateIdentifier(identifier, count)
      while (usedIdentifiers.has(newIdentifier)) {
        count++
        newIdentifier = generateIdentifier(identifier, count)
      }
      identifierCounter.set(identifier, count)
      identifierMap.set(ast, newIdentifier)
      usedIdentifiers.add(newIdentifier)
      return newIdentifier
    }
  }

  function getLastEncoding(ast: AST.AST): AST.AST {
    if (ast.encoding) {
      return getLastEncoding(ast.encoding[ast.encoding.length - 1].to)
    }
    return ast
  }

  function on(ast: AST.AST): SchemaStandard.Standard {
    switch (ast._tag) {
      case "Suspend": {
        const thunk = ast.thunk()
        if (visited.has(thunk)) {
          const identifier = generateUniqueIdentifier(thunk)
          if (identifier === undefined) {
            throw new globalThis.Error("Suspended schema without identifier")
          }
          return {
            _tag: "Suspend",
            checks: [],
            thunk: { _tag: "Reference", $ref: identifier },
            ...(ast.annotations ? { annotations: ast.annotations } : undefined)
          }
        }
        return {
          _tag: "Suspend",
          checks: [],
          thunk: recur(thunk),
          ...(ast.annotations ? { annotations: ast.annotations } : undefined)
        }
      }
      case "Declaration":
        return {
          _tag: "Declaration",
          typeParameters: ast.typeParameters.map((tp) => recur(tp)),
          Encoded: recur(InternalSerializer.toCodecJson(ast)),
          checks: fromChecks(ast.checks),
          ...(ast.annotations ? { annotations: ast.annotations } : undefined)
        }
      case "Null":
      case "Undefined":
      case "Void":
      case "Never":
      case "Unknown":
      case "Any":
      case "Boolean":
      case "Symbol":
        return { _tag: ast._tag, ...(ast.annotations ? { annotations: ast.annotations } : undefined) }
      case "String": {
        const contentMediaType = ast.annotations?.contentMediaType
        const contentSchema = ast.annotations?.contentSchema
        return {
          _tag: ast._tag,
          checks: fromChecks(ast.checks),
          ...(ast.annotations ? { annotations: ast.annotations } : undefined),
          ...(typeof contentMediaType === "string" && AST.isAST(contentSchema)
            ? { contentMediaType, contentSchema: recur(contentSchema) }
            : undefined)
        }
      }
      case "Number":
      case "BigInt":
        return {
          _tag: ast._tag,
          checks: fromChecks(ast.checks),
          ...(ast.annotations ? { annotations: ast.annotations } : undefined)
        }
      case "Literal":
        return {
          _tag: ast._tag,
          literal: ast.literal,
          ...(ast.annotations ? { annotations: ast.annotations } : undefined)
        }
      case "UniqueSymbol":
        return {
          _tag: ast._tag,
          symbol: ast.symbol,
          ...(ast.annotations ? { annotations: ast.annotations } : undefined)
        }
      case "ObjectKeyword":
        return {
          _tag: ast._tag,
          ...(ast.annotations ? { annotations: ast.annotations } : undefined)
        }
      case "Enum":
        return {
          _tag: ast._tag,
          enums: ast.enums,
          ...(ast.annotations ? { annotations: ast.annotations } : undefined)
        }
      case "TemplateLiteral":
        return {
          _tag: ast._tag,
          parts: ast.parts.map((p) => recur(p)),
          ...(ast.annotations ? { annotations: ast.annotations } : undefined)
        }
      case "Arrays":
        return {
          _tag: ast._tag,
          elements: ast.elements.map((e) => {
            const last = getLastEncoding(e)
            return {
              isOptional: AST.isOptional(last),
              type: recur(last),
              ...(last.context?.annotations ? { annotations: last.context?.annotations } : undefined)
            }
          }),
          rest: ast.rest.map((r) => recur(r)),
          checks: fromChecks(ast.checks),
          ...(ast.annotations ? { annotations: ast.annotations } : undefined)
        }
      case "Objects":
        return {
          _tag: ast._tag,
          propertySignatures: ast.propertySignatures.map((ps) => {
            const last = getLastEncoding(ps.type)
            return {
              name: ps.name,
              type: recur(last),
              isOptional: AST.isOptional(last),
              isMutable: AST.isMutable(last),
              ...(last.context?.annotations ? { annotations: last.context?.annotations } : undefined)
            }
          }),
          indexSignatures: ast.indexSignatures.map((is) => ({
            parameter: recur(is.parameter),
            type: recur(is.type)
          })),
          checks: fromChecks(ast.checks),
          ...(ast.annotations ? { annotations: ast.annotations } : undefined)
        }
      case "Union": {
        const types = InternalSerializer.jsonReorder(ast.types)
        return {
          _tag: ast._tag,
          types: types.map((t) => recur(t)),
          mode: ast.mode,
          ...(ast.annotations ? { annotations: ast.annotations } : undefined)
        }
      }
    }
  }
}

function fromChecks(
  checks: readonly [AST.Check<any>, ...Array<AST.Check<any>>] | undefined
): Array<SchemaStandard.Check<any>> {
  if (!checks) return []
  function getCheck(c: AST.Check<any>): SchemaStandard.Check<any> | undefined {
    switch (c._tag) {
      case "Filter": {
        const meta = c.annotations?.meta
        if (meta) {
          return { _tag: "Filter", meta, annotations: c.annotations }
        }
        return undefined
      }
      case "FilterGroup": {
        const checks = fromChecks(c.checks)
        if (Arr.isArrayNonEmpty(checks)) {
          return {
            _tag: "FilterGroup",
            checks,
            annotations: c.annotations
          }
        }
      }
    }
  }
  return checks.map(getCheck).filter((c) => c !== undefined)
}

function generateIdentifier(seed: string, counter: number): string {
  return `${seed}-${counter}`
}

/** @internal */
export function toJsonSchemaDocument(
  document: SchemaStandard.Document,
  options?: Schema.ToJsonSchemaOptions
): JsonSchema.Document<"draft-2020-12"> {
  const { definitions, dialect: source, schemas } = toJsonSchemaMultiDocument({
    schemas: [document.schema],
    definitions: document.definitions
  }, options)
  return { dialect: source, schema: schemas[0], definitions }
}

/** @internal */
export function toJsonSchemaMultiDocument(
  document: SchemaStandard.MultiDocument,
  options?: Schema.ToJsonSchemaOptions
): JsonSchema.MultiDocument<"draft-2020-12"> {
  const generateDescriptions = options?.generateDescriptions ?? false
  const referenceStrategy = options?.referenceStrategy ?? "all"
  const additionalProperties = options?.additionalProperties ?? false

  const definitions = Rec.map(document.definitions, (d) => recur(d))

  return {
    dialect: "draft-2020-12",
    schemas: Arr.map(document.schemas, (s) => {
      const js = recur(s)
      if (referenceStrategy === "skip-top-level" && typeof js.$ref === "string") {
        const resolved = resolve$ref(js.$ref, definitions)
        return resolved === true ? { not: {} } : resolved === false ? {} : resolved
      }
      return js
    }),
    definitions
  }

  function recur(s: SchemaStandard.Standard): JsonSchema.JsonSchema {
    let js: JsonSchema.JsonSchema = on(s)
    if ("annotations" in s) {
      const a = collectJsonSchemaAnnotations(s.annotations)
      if (a) {
        js = { ...js, ...a }
      }
    }
    if ("checks" in s) {
      const checks = collectJsonSchemaChecks(s.checks, js.type)
      for (const check of checks) {
        js = appendJsonSchema(js, check)
      }
    }
    return js
  }

  function on(schema: SchemaStandard.Standard): JsonSchema.JsonSchema {
    switch (schema._tag) {
      case "Any":
        return {}
      case "Unknown":
      case "Void":
      case "Undefined":
      case "ObjectKeyword":
        return { type: "null" }
      case "BigInt":
        return {
          "type": "string",
          "allOf": [
            { "pattern": "^-?\\d+$" }
          ]
        }
      case "Symbol":
      case "UniqueSymbol":
        return {
          "type": "string",
          "allOf": [
            { "pattern": "^Symbol\\((.*)\\)$" }
          ]
        }
      case "Declaration":
        return recur(schema.Encoded)
      case "Suspend":
        return recur(schema.thunk)
      case "Reference":
        return { $ref: `#/$defs/${escapeToken(schema.$ref)}` }
      case "Null":
        return { type: "null" }
      case "Never":
        return { not: {} }
      case "String": {
        const out: JsonSchema.JsonSchema = { type: "string" }
        if (schema.contentMediaType !== undefined) {
          out.contentMediaType = schema.contentMediaType
        }
        if (schema.contentSchema !== undefined) {
          out.contentSchema = recur(schema.contentSchema)
        }
        return out
      }
      case "Number":
        return hasCheck(schema.checks, "isInt") ?
          { type: "integer" } :
          hasCheck(schema.checks, "isFinite") ?
          { type: "number" } :
          {
            "anyOf": [
              { type: "number" },
              { type: "string", enum: ["NaN"] },
              { type: "string", enum: ["Infinity"] },
              { type: "string", enum: ["-Infinity"] }
            ]
          }
      case "Boolean":
        return { type: "boolean" }
      case "Literal": {
        const literal = schema.literal
        if (typeof literal === "string") {
          return { type: "string", enum: [literal] }
        }
        if (typeof literal === "number") {
          return { type: "number", enum: [literal] }
        }
        if (typeof literal === "boolean") {
          return { type: "boolean", enum: [literal] }
        }
        // bigint literals are not supported
        return { type: "string", enum: [String(literal)] }
      }
      case "Enum": {
        return recur({
          _tag: "Union",
          types: schema.enums.map(([title, value]) => ({
            _tag: "Literal",
            literal: value,
            annotations: { title }
          })),
          mode: "anyOf",
          annotations: schema.annotations
        })
      }
      case "TemplateLiteral": {
        const pattern = schema.parts.map(getPartPattern).join("")
        return { type: "string", pattern: `^${pattern}$` }
      }
      case "Arrays": {
        // ---------------------------------------------
        // handle post rest elements
        // ---------------------------------------------
        if (schema.rest.length > 1) {
          throw new globalThis.Error("Generating a JSON Schema for post-rest elements is not supported")
        }
        const out: JsonSchema.JsonSchema = { type: "array" }
        let minItems = schema.elements.length
        const prefixItems: Array<JsonSchema.JsonSchema> = schema.elements.map((e) => {
          if (e.isOptional) {
            minItems--
          }
          const v = recur(e.type)
          const a = collectJsonSchemaAnnotations(e.annotations)
          return a ? appendJsonSchema(v, a) : v
        })
        if (prefixItems.length > 0) {
          out.prefixItems = prefixItems
          out.maxItems = schema.elements.length
          if (minItems > 0) {
            out.minItems = minItems
          }
        } else {
          out.items = false
        }
        if (schema.rest.length > 0) {
          delete out.maxItems
          const rest = recur(schema.rest[0])
          if (Object.keys(rest).length > 0) {
            out.items = rest
          } else {
            delete out.items
          }
        }
        return out
      }
      case "Objects": {
        if (schema.propertySignatures.length === 0 && schema.indexSignatures.length === 0) {
          return { anyOf: [{ type: "object" }, { type: "array" }] }
        }
        const out: JsonSchema.JsonSchema = { type: "object" }
        const properties: Record<string, JsonSchema.JsonSchema> = {}
        const required: Array<string> = []

        for (const ps of schema.propertySignatures) {
          const name = ps.name
          if (typeof name !== "string") {
            throw new globalThis.Error(`Unsupported property signature name: ${format(name)}`)
          }
          const v = recur(ps.type)
          const a = collectJsonSchemaAnnotations(ps.annotations)
          properties[name] = a ? appendJsonSchema(v, a) : v
          // Property is required only if it's not explicitly optional AND doesn't contain Undefined
          if (!ps.isOptional) {
            required.push(name)
          }
        }

        if (Object.keys(properties).length > 0) {
          out.properties = properties
        }
        if (required.length > 0) {
          out.required = required
        }

        out.additionalProperties = additionalProperties
        const patternProperties: Record<string, JsonSchema.JsonSchema> = {}
        // Handle index signatures
        for (const is of schema.indexSignatures) {
          const type = recur(is.type)
          const patterns = getParameterPatterns(is.parameter)
          if (patterns.length > 0) {
            for (const pattern of patterns) {
              patternProperties[pattern] = type
            }
          } else {
            out.additionalProperties = type
          }
        }
        if (Object.keys(patternProperties).length > 0) {
          out.patternProperties = patternProperties
          delete out.additionalProperties
        }
        if (Predicate.isObject(out.additionalProperties) && Rec.isEmptyRecord(out.additionalProperties)) {
          delete out.additionalProperties
        }

        return out
      }
      case "Union": {
        const types = schema.types.map(recur)
        if (types.length === 0) {
          // anyOf MUST be a non-empty array
          return { not: {} }
        }
        return schema.mode === "anyOf" ? { anyOf: types } : { oneOf: types }
      }
    }
  }

  function collectJsonSchemaAnnotations(
    annotations: Schema.Annotations.Annotations | undefined
  ): JsonSchema.JsonSchema | undefined {
    if (annotations) {
      const out: JsonSchema.JsonSchema = {}
      if (typeof annotations.title === "string") out.title = annotations.title
      if (typeof annotations.description === "string") out.description = annotations.description
      else if (generateDescriptions && typeof annotations.expected === "string") out.description = annotations.expected
      if (annotations.default !== undefined) out.default = annotations.default
      if (Array.isArray(annotations.examples)) out.examples = annotations.examples

      if (Object.keys(out).length > 0) return out
    }
  }

  function collectJsonSchemaChecks(
    checks: ReadonlyArray<SchemaStandard.Check<any>>,
    type: unknown
  ): Array<JsonSchema.JsonSchema> {
    return checks.map(recur).filter((c) => c !== undefined)

    function recur(check: SchemaStandard.Check<any>): JsonSchema.JsonSchema | undefined {
      switch (check._tag) {
        case "Filter":
          return filterToJsonSchema(check, type)
        case "FilterGroup": {
          const checks = check.checks.map(recur).filter((c) => c !== undefined)
          if (checks.length === 0) return undefined
          let out = { allOf: checks }
          const a = collectJsonSchemaAnnotations(check.annotations)
          if (a) {
            out = { ...out, ...a }
          }
          return out
        }
      }
    }
  }

  function filterToJsonSchema(filter: SchemaStandard.Filter<any>, type: unknown): JsonSchema.JsonSchema | undefined {
    const meta = filter.meta as SchemaStandard.Meta
    if (!meta) return undefined

    let out = on(meta)
    const a = collectJsonSchemaAnnotations(filter.annotations)
    if (a) {
      out = { ...out, ...a }
    }
    return out

    function on(
      meta: SchemaStandard.Meta
    ): JsonSchema.JsonSchema | undefined {
      switch (meta._tag) {
        case "isMinLength":
          return type === "array" ? { minItems: meta.minLength } : { minLength: meta.minLength }
        case "isMaxLength":
          return type === "array" ? { maxItems: meta.maxLength } : { maxLength: meta.maxLength }
        case "isLength":
          return type === "array"
            ? { allOf: [{ minItems: meta.length }, { maxItems: meta.length }] }
            : { allOf: [{ minLength: meta.length }, { maxLength: meta.length }] }
        case "isPattern":
        case "isULID":
        case "isBase64":
        case "isBase64Url":
        case "isStartsWith":
        case "isEndsWith":
        case "isIncludes":
        case "isUppercased":
        case "isLowercased":
        case "isCapitalized":
        case "isUncapitalized":
        case "isTrimmed":
        case "isFiniteString":
        case "isBigIntString":
        case "isSymbolString":
          return { pattern: meta.regExp.source }
        case "isUUID":
          return { pattern: meta.regExp.source, format: "uuid" }

        case "isFinite":
        case "isInt":
          return undefined
        case "isMultipleOf":
          return { multipleOf: meta.divisor }
        case "isGreaterThanOrEqualTo":
          return { minimum: meta.minimum }
        case "isLessThanOrEqualTo":
          return { maximum: meta.maximum }
        case "isGreaterThan":
          return { exclusiveMinimum: meta.exclusiveMinimum }
        case "isLessThan":
          return { exclusiveMaximum: meta.exclusiveMaximum }
        case "isBetween": {
          return {
            [meta.exclusiveMinimum ? "exclusiveMinimum" : "minimum"]: meta.minimum,
            [meta.exclusiveMaximum ? "exclusiveMaximum" : "maximum"]: meta.maximum
          }
        }

        case "isUnique":
          return { uniqueItems: true }

        case "isMinProperties":
          return { minProperties: meta.minProperties }
        case "isMaxProperties":
          return { maxProperties: meta.maxProperties }
        case "isPropertiesLength":
          return { minProperties: meta.length, maxProperties: meta.length }

        case "isValidDate":
          return { format: "date-time" }
      }
    }
  }

  function getParameterPatterns(parameter: SchemaStandard.Standard): Array<string> {
    switch (parameter._tag) {
      default:
        throw new globalThis.Error("Unsupported index signature parameter")
      case "String":
        return getPatterns(parameter)
      case "TemplateLiteral":
        return [`^${parameter.parts.map(getPartPattern).join("")}$`]
      case "Union":
        return parameter.types.flatMap(getParameterPatterns)
    }
  }
}

function getPatterns(s: SchemaStandard.String): Array<string> {
  return recur(s.checks)

  function recur(checks: ReadonlyArray<SchemaStandard.Check<SchemaStandard.StringMeta>>): Array<string> {
    return checks.flatMap((c) => {
      switch (c._tag) {
        case "Filter": {
          if ("regExp" in c.meta) {
            return [c.meta.regExp.source]
          }
          return []
        }
        case "FilterGroup":
          return recur(c.checks)
      }
    })
  }
}

function hasCheck(checks: ReadonlyArray<SchemaStandard.Check<SchemaStandard.Meta>>, tag: string): boolean {
  return checks.some((c) => {
    switch (c._tag) {
      case "Filter":
        return c.meta._tag === tag
      case "FilterGroup":
        return hasCheck(c.checks, tag)
    }
  })
}

function resolve$ref($ref: string, definitions: JsonSchema.Definitions): JsonSchema.JsonSchema | boolean {
  const tokens = $ref.split("/")
  if (tokens.length > 0) {
    const identifier = unescapeToken(tokens[tokens.length - 1])
    const definition = definitions[identifier]
    if (definition !== undefined) {
      return definition
    }
  }
  throw new globalThis.Error(`Reference to unknown schema: ${$ref}`)
}

function appendJsonSchema(a: JsonSchema.JsonSchema, b: JsonSchema.JsonSchema): JsonSchema.JsonSchema {
  if (Object.keys(a).length === 0) return b
  const len = Object.keys(b).length
  if (len === 0) return a
  const members = Array.isArray(b.allOf) && len === 1 ? b.allOf : [b]

  if (Array.isArray(a.allOf)) {
    return { ...a, allOf: [...a.allOf, ...members] }
  }

  if (typeof a.$ref === "string") {
    return { allOf: [a, ...members] }
  }

  return { ...a, allOf: members }
}

function getPartPattern(part: SchemaStandard.Standard): string {
  switch (part._tag) {
    case "Literal":
      return RegEx.escape(globalThis.String(part.literal))
    case "String":
      return AST.STRING_PATTERN
    case "Number":
      return AST.FINITE_PATTERN
    case "TemplateLiteral":
      return part.parts.map(getPartPattern).join("")
    case "Union":
      return part.types.map(getPartPattern).join("|")
    default:
      throw new globalThis.Error("Unsupported part", { cause: part })
  }
}
