import { format } from "../data/Formatter.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Annotations from "../schema/Annotations.ts"
import * as AST from "../schema/AST.ts"
import type * as Schema from "../schema/Schema.ts"
import { errorWithPath } from "./errors.ts"

/** @internal */
export function make<S extends Schema.Top>(
  schema: S,
  options: Schema.ToJsonSchemaOptions
): Schema.JsonSchema.Document {
  const target = options.target
  const definitions = {}
  const additionalProperties = options.additionalProperties ?? false
  const referenceStrategy = options.referenceStrategy ?? "keep"
  const generateDescriptions = options.generateDescriptions ?? false
  return {
    source: target,
    schema: recur(
      schema.ast,
      [],
      {
        target,
        definitions,
        referenceStrategy,
        additionalProperties,
        onMissingJsonSchemaAnnotation: options.onMissingJsonSchemaAnnotation,
        generateDescriptions
      },
      false,
      false
    ),
    definitions
  }
}

interface RecurOptions extends Schema.ToJsonSchemaOptions {
  readonly target: Schema.JsonSchema.Target
  readonly additionalProperties: true | false | Schema.JsonSchema
  readonly definitions: Record<string, Schema.JsonSchema>
  readonly generateDescriptions: boolean
}

function escapeJsonPointer(identifier: string) {
  return identifier.replace(/~/ig, "~0").replace(/\//ig, "~1")
}

const encodedMap = new WeakMap<AST.AST, string>()

function recur(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: RecurOptions,
  ignoreIdentifier: boolean,
  ignoreAnnotation: boolean
): Schema.JsonSchema {
  const target = options.target
  // ---------------------------------------------
  // handle identifier annotation
  // ---------------------------------------------
  const shouldHandleIdentifier = !ignoreIdentifier && (
    (options.referenceStrategy === "keep" || (options.referenceStrategy === "skip-top-level" && path.length > 0))
    || AST.isSuspend(ast)
  )
  if (shouldHandleIdentifier) {
    const identifier = getIdentifier(ast)
    if (identifier !== undefined) {
      const $ref = { $ref: getPointer(target) + escapeJsonPointer(identifier) }
      const encoded = AST.toEncoded(ast)
      if (Object.hasOwn(options.definitions, identifier)) {
        if (AST.isSuspend(ast) || encodedMap.get(encoded) === identifier) {
          return $ref
        }
      } else {
        encodedMap.set(encoded, identifier)
        options.definitions[identifier] = $ref
        options.definitions[identifier] = recur(ast, path, options, true, ignoreAnnotation)
        return $ref
      }
    }
  }
  // ---------------------------------------------
  // handle Override annotation
  // ---------------------------------------------
  if (!ignoreAnnotation) {
    const annotation = getAnnotation(Annotations.resolve(ast))
    if (annotation) {
      function getDefaultJsonSchema() {
        try {
          return recur(ast, path, options, ignoreIdentifier, true)
        } catch {
          return {}
        }
      }
      const typeParameters = AST.isDeclaration(ast)
        ? ast.typeParameters.map((tp) => recur(tp, path, options, false, false))
        : []
      const out = annotation({
        typeParameters,
        target,
        jsonSchema: getDefaultJsonSchema(),
        make: (ast) => recur(ast, path, options, false, false)
      })
      return mergeOrAppendJsonSchemaAnnotations(out, ast.annotations, options.generateDescriptions)
    }
  }
  // ---------------------------------------------
  // handle encoding
  // ---------------------------------------------
  if (ast.encoding) {
    return recur(AST.toEncoded(ast), path, options, ignoreIdentifier, ignoreAnnotation)
  }
  let out = flattenArrayJsonSchema(base(ast, path, options, false))
  // ---------------------------------------------
  // handle JSON Schema annotations
  // ---------------------------------------------
  out = mergeOrAppendJsonSchemaAnnotations(out, ast.annotations, options.generateDescriptions)
  // ---------------------------------------------
  // handle checks
  // ---------------------------------------------
  if (ast.checks) {
    function handleAnnotations(check: AST.Check<any>): void {
      const annotations = getJsonSchemaAnnotations(check.annotations, options.generateDescriptions)
      if (annotations) {
        out = appendFragment(out, annotations)
      }
    }
    function handleFilter(check: AST.Filter<any>): void {
      const fragment = getConstraint(check, options.target, out.type as Schema.JsonSchema.Type)
      if (fragment) {
        out = appendFragment(
          out,
          mergeOrAppendJsonSchemaAnnotations(fragment, check.annotations, options.generateDescriptions)
        )
      } else {
        handleAnnotations(check)
      }
    }
    function handleFilterGroup(checks: AST.Checks): void {
      for (const check of checks) {
        switch (check._tag) {
          case "Filter": {
            handleFilter(check)
            break
          }
          case "FilterGroup": {
            handleFilterGroup(check.checks)
            handleAnnotations(check)
            break
          }
        }
      }
    }
    handleFilterGroup(ast.checks)
  }
  return out
}

function flattenArrayJsonSchema(jsonSchema: Schema.JsonSchema): Schema.JsonSchema {
  if (Object.keys(jsonSchema).length === 1) {
    if (Array.isArray(jsonSchema.anyOf) && jsonSchema.anyOf.length === 1) {
      return jsonSchema.anyOf[0]
    } else if (Array.isArray(jsonSchema.oneOf) && jsonSchema.oneOf.length === 1) {
      return jsonSchema.oneOf[0]
    } else if (Array.isArray(jsonSchema.allOf) && jsonSchema.allOf.length === 1) {
      return jsonSchema.allOf[0]
    }
  }
  return jsonSchema
}

function isUnknownSchema(schema: unknown) {
  return Predicate.isObject(schema) && Object.keys(schema).length === 0
}

function base(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: RecurOptions,
  ignoreAnnotation: boolean
): Schema.JsonSchema {
  const target = options.target
  // ---------------------------------------------
  // handle Override annotation
  // ---------------------------------------------
  if (!ignoreAnnotation) {
    const annotation = getAnnotation(ast.annotations)
    if (annotation) {
      function getDefaultJsonSchema() {
        try {
          return flattenArrayJsonSchema(base(ast, path, options, true))
        } catch {
          return {}
        }
      }
      const typeParameters = AST.isDeclaration(ast)
        ? ast.typeParameters.map((tp) => recur(tp, path, options, false, false))
        : []
      const out = annotation({
        typeParameters,
        target,
        jsonSchema: getDefaultJsonSchema(),
        make: (ast) => recur(ast, path, options, false, false)
      })
      return mergeOrAppendJsonSchemaAnnotations(out, ast.annotations, options.generateDescriptions)
    }
  }
  switch (ast._tag) {
    case "Declaration":
    case "BigInt":
    case "Symbol":
    case "Undefined":
    case "UniqueSymbol": {
      if (options.onMissingJsonSchemaAnnotation) {
        const out = options.onMissingJsonSchemaAnnotation(ast)
        if (out) return out
      }
      throw errorWithPath(`Unsupported AST ${ast._tag}`, path)
    }

    case "Never":
      return { not: {} }

    case "Void":
    case "Unknown":
    case "Any":
      return {}

    case "Null":
      return { type: "null" }

    case "String":
      return { type: "string" }

    case "Number":
      return { type: "number" }

    case "Boolean":
      return { type: "boolean" }

    case "ObjectKeyword":
      return { anyOf: [{ type: "object" }, { type: "array" }] }

    case "Literal": {
      const literal = ast.literal
      if (typeof literal === "string") {
        return { type: "string", enum: [literal] }
      }
      if (typeof literal === "number") {
        return { type: "number", enum: [literal] }
      }
      if (typeof literal === "boolean") {
        return { type: "boolean", enum: [literal] }
      }
      throw errorWithPath(`Unsupported literal ${format(literal)}`, path)
    }

    case "Enum":
      return recur(AST.enumsToLiterals(ast), path, options, false, false)

    case "TemplateLiteral":
      return { type: "string", pattern: AST.getTemplateLiteralRegExp(ast).source }

    case "Arrays": {
      // ---------------------------------------------
      // handle post rest elements
      // ---------------------------------------------
      if (ast.rest.length > 1) {
        throw errorWithPath(
          "Generating a JSON Schema for post-rest elements is not currently supported. You're welcome to contribute by submitting a Pull Request",
          path
        )
      }
      const out: any = { type: "array" }
      // ---------------------------------------------
      // handle elements
      // ---------------------------------------------
      const items = ast.elements.map((e, i) =>
        mergeOrAppendJsonSchemaAnnotations(
          recur(e, [...path, i], options, false, false),
          e.context?.annotations,
          options.generateDescriptions
        )
      )
      out.minItems = ast.elements.length
      const minItems = ast.elements.findIndex(isOptional)
      if (minItems !== -1) {
        out.minItems = minItems
      }
      if (out.minItems === 0) {
        delete out.minItems
      }
      // ---------------------------------------------
      // handle rest element
      // ---------------------------------------------
      const additionalItems = ast.rest.length > 0
        ? recur(ast.rest[0], [...path, ast.elements.length], options, false, false)
        : false
      if (items.length === 0) {
        if (!isUnknownSchema(additionalItems)) {
          out.items = additionalItems
        }
      } else {
        switch (target) {
          case "draft-07": {
            out.items = items
            if (!isUnknownSchema(additionalItems)) {
              out.additionalItems = additionalItems
            }
            break
          }
          case "draft-2020-12":
          case "openapi-3.1": {
            out.prefixItems = items
            if (!isUnknownSchema(additionalItems)) {
              out.items = additionalItems
            }
            break
          }
        }
      }
      return out
    }
    case "Objects": {
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        return { anyOf: [{ type: "object" }, { type: "array" }] }
      }
      const out: any = { type: "object" }
      // ---------------------------------------------
      // handle property signatures
      // ---------------------------------------------
      for (const ps of ast.propertySignatures) {
        const name = ps.name as string
        if (Predicate.isSymbol(name)) {
          throw errorWithPath(`Unsupported property signature name ${format(name)}`, [...path, name])
        } else {
          out.properties ??= {}
          out.properties[name] = mergeOrAppendJsonSchemaAnnotations(
            recur(ps.type, [...path, name], options, false, false),
            ps.type.context?.annotations,
            options.generateDescriptions
          )
          if (!isOptional(ps.type)) {
            out.required ??= []
            out.required.push(name)
          }
        }
      }
      // ---------------------------------------------
      // handle index signatures
      // ---------------------------------------------
      out.additionalProperties = options.additionalProperties
      const patternProperties: Record<string, object> = {}
      for (const is of ast.indexSignatures) {
        const type = recur(is.type, path, options, false, false)
        const pattern = getPattern(is.parameter, path, options)
        if (pattern !== undefined) {
          patternProperties[pattern] = type
        } else {
          out.additionalProperties = type
        }
      }
      if (Object.keys(patternProperties).length > 0) {
        out.patternProperties = patternProperties
        delete out.additionalProperties
      }
      if (isUnknownSchema(out.additionalProperties)) {
        delete out.additionalProperties
      }
      return out
    }
    case "Union": {
      const types: Array<Schema.JsonSchema> = []
      for (const type of ast.types) {
        if (!AST.isUndefined(type)) {
          types.push(recur(type, path, options, false, false))
        }
      }
      return types.length === 0
        ? { not: {} }
        : ast.mode === "anyOf"
        ? { anyOf: types }
        : { oneOf: types }
    }
    case "Suspend": {
      const identifier = getIdentifier(ast)
      if (identifier !== undefined) {
        return recur(ast.thunk(), path, options, true, false)
      }
      throw errorWithPath("Missing identifier in suspended schema", path)
    }
  }
}

function getPointer(target: Schema.JsonSchema.Target) {
  switch (target) {
    case "draft-07":
      return "#/definitions/"
    case "draft-2020-12":
      return "#/$defs/"
    case "openapi-3.1":
      return "#/components/schemas/"
  }
}

function getConstraint<T>(
  check: AST.Check<T>,
  target: Schema.JsonSchema.Target,
  type?: Schema.JsonSchema.Type
): Schema.JsonSchema | undefined {
  const annotation = check.annotations?.jsonSchemaConstraint as Annotations.JsonSchema.Constraint | undefined
  if (annotation) return annotation({ target, type })
}

function getAnnotation(
  annotations: Annotations.Annotations | undefined
): Annotations.JsonSchema.Override<ReadonlyArray<Schema.Top>> | undefined {
  return annotations?.jsonSchema as any
}

function isOptional(ast: AST.AST): boolean {
  const encoded = AST.toEncoded(ast)
  return AST.isOptional(encoded) || AST.containsUndefined(encoded)
}

function getPattern(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: RecurOptions
): string | undefined {
  switch (ast._tag) {
    case "String": {
      const jsonSchema = recur(ast, path, options, false, false)
      if (Object.hasOwn(jsonSchema, "pattern") && typeof jsonSchema.pattern === "string") {
        return jsonSchema.pattern
      }
      return undefined
    }
    case "Number":
      return "^[0-9]+$"
    case "TemplateLiteral":
      return AST.getTemplateLiteralRegExp(ast).source
    default:
      throw errorWithPath("Unsupported index signature parameter", path)
  }
}

function getJsonSchemaAnnotations(
  annotations: Annotations.Annotations | undefined,
  generateDescriptions: boolean
): Schema.JsonSchema | undefined {
  if (annotations) {
    const out: Schema.JsonSchema = {}
    if (typeof annotations.title === "string") {
      out.title = annotations.title
    }
    if (typeof annotations.description === "string") {
      out.description = annotations.description
    } else if (generateDescriptions && typeof annotations.expected === "string") {
      out.description = annotations.expected
    }
    if (annotations.default !== undefined) {
      out.default = annotations.default
    }
    if (Array.isArray(annotations.examples)) {
      out.examples = annotations.examples
    }

    if (Object.keys(out).length > 0) return out
  }
}

function mergeOrAppendJsonSchemaAnnotations(
  jsonSchema: Schema.JsonSchema,
  annotations: Annotations.Annotations | undefined,
  generateDescriptions: boolean
): Schema.JsonSchema {
  const fragment = getJsonSchemaAnnotations(annotations, generateDescriptions)
  if (fragment) {
    return appendFragment(jsonSchema, fragment)
  }
  return jsonSchema
}

function hasIntersection(
  jsonSchema: Schema.JsonSchema,
  fragment: Schema.JsonSchema
): boolean {
  return Object.keys(jsonSchema).filter((key) => key !== "type").some((key) => Object.hasOwn(fragment, key))
}

function appendFragment(
  jsonSchema: Schema.JsonSchema,
  fragment: Schema.JsonSchema
): Schema.JsonSchema {
  if ("$ref" in jsonSchema) {
    return { allOf: [jsonSchema, fragment] }
  } else {
    if (hasIntersection(jsonSchema, fragment)) {
      if (Array.isArray(jsonSchema.allOf)) {
        return { ...jsonSchema, allOf: [...jsonSchema.allOf, fragment] }
      } else {
        return { ...jsonSchema, allOf: [fragment] }
      }
    } else {
      return { ...jsonSchema, ...fragment }
    }
  }
}

function getIdentifier(ast: AST.AST): string | undefined {
  return Annotations.resolveIdentifier(ast) ?? (AST.isSuspend(ast) ? getIdentifier(ast.thunk()) : undefined)
}
