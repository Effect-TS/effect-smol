import * as Arr from "../collections/Array.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Equal from "../interfaces/Equal.ts"
import * as Inspectable from "../interfaces/Inspectable.ts"
import * as Annotations from "../schema/Annotations.ts"
import * as AST from "../schema/AST.ts"
import type * as Schema from "../schema/Schema.ts"
import { errorWithPath } from "./errors.ts"

interface Options extends Schema.JsonSchemaOptions {
  readonly target: Annotations.JsonSchema.Target
}

/** @internal */
export function make<S extends Schema.Top>(schema: S, options: Options): Schema.JsonSchema.Document {
  const definitions = options.definitions ?? {}
  const target = options.target
  const additionalProperties = options.additionalProperties ?? false
  const referenceStrategy = options.referenceStrategy ?? "keep"
  const generateDescriptions = options.generateDescriptions ?? false
  return {
    uri: getMetaSchemaUri(target),
    schema: go(
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

interface GoOptions extends Options {
  readonly additionalProperties: true | false | Schema.JsonSchema.Schema
  readonly definitions: Record<string, Schema.JsonSchema.Schema>
  readonly generateDescriptions: boolean
}

function escapeJsonPointer(identifier: string) {
  return identifier.replace(/~/ig, "~0").replace(/\//ig, "~1")
}

function go(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreIdentifier: boolean,
  ignoreAnnotation: boolean
): Schema.JsonSchema.Schema {
  const target = options.target
  // ---------------------------------------------
  // handle identifier annotation
  // ---------------------------------------------
  if (
    !ignoreIdentifier && (
      options.referenceStrategy === "keep"
      || options.referenceStrategy === "skip-top-level" && path.length > 0
      || AST.isSuspend(ast)
    )
  ) {
    const identifier = getIdentifier(ast)
    if (identifier !== undefined) {
      const $ref = { $ref: getPointer(target) + escapeJsonPointer(identifier) }
      if (Object.hasOwn(options.definitions, identifier)) {
        if (AST.isSuspend(ast)) {
          return $ref
        } else {
          const existing = options.definitions[identifier]
          const generated = go(ast, path, options, true, ignoreAnnotation)
          // check for duplicated identifiers in different ASTs
          if (Equal.equals(existing, generated)) {
            return $ref
          }
        }
      } else {
        options.definitions[identifier] = $ref
        options.definitions[identifier] = go(ast, path, options, true, ignoreAnnotation)
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
          return go(ast, path, options, ignoreIdentifier, true)
        } catch {
          return {}
        }
      }
      const typeParameters = AST.isDeclaration(ast)
        ? ast.typeParameters.map((tp) => go(tp, path, options, false, false))
        : []
      const out = annotation({
        typeParameters,
        target,
        jsonSchema: getDefaultJsonSchema(),
        make: (ast) => go(ast, path, options, false, false)
      })
      return overwriteJsonSchemaAnnotations(out, ast.annotations, options.generateDescriptions)
    }
  }
  // ---------------------------------------------
  // handle encoding
  // ---------------------------------------------
  if (ast.encoding) {
    return go(AST.encodedAST(ast), path, options, ignoreIdentifier, ignoreAnnotation)
  }
  let out = base(ast, path, options, false)
  // ---------------------------------------------
  // handle checks
  // ---------------------------------------------
  if (ast.checks) {
    out = appendFragments(out, getFragments(ast.checks, options, out.type))
  }
  // ---------------------------------------------
  // handle JSON Schema annotations
  // ---------------------------------------------
  return overwriteJsonSchemaAnnotations(out, ast.annotations, options.generateDescriptions)
}

function base(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreAnnotation: boolean
): Schema.JsonSchema.Schema {
  const target = options.target
  // ---------------------------------------------
  // handle Override annotation
  // ---------------------------------------------
  if (!ignoreAnnotation) {
    const annotation = getAnnotation(ast.annotations)
    if (annotation) {
      function getDefaultJsonSchema() {
        try {
          return base(ast, path, options, true)
        } catch {
          return {}
        }
      }
      const typeParameters = AST.isDeclaration(ast)
        ? ast.typeParameters.map((tp) => go(tp, path, options, false, false))
        : []
      const out = annotation({
        typeParameters,
        target,
        jsonSchema: getDefaultJsonSchema(),
        make: (ast) => go(ast, path, options, false, false)
      })
      return overwriteJsonSchemaAnnotations(out, ast.annotations, options.generateDescriptions)
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
      throw errorWithPath(`Unsupported literal ${Inspectable.format(literal)}`, path)
    }

    case "Enum":
      return go(AST.enumsToLiterals(ast), path, options, false, false)

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
          go(e, [...path, i], options, false, false),
          e.context?.annotations,
          options.generateDescriptions
        )
      )
      const minItems = ast.elements.findIndex(isOptional)
      if (minItems !== -1) {
        out.minItems = minItems
      }
      // ---------------------------------------------
      // handle rest element
      // ---------------------------------------------
      const additionalItems = ast.rest.length > 0
        ? go(ast.rest[0], [...path, ast.elements.length], options, false, false)
        : false
      if (items.length === 0) {
        out.items = additionalItems
      } else {
        switch (target) {
          case "draft-07": {
            out.items = items
            out.additionalItems = additionalItems
            break
          }
          case "2020-12":
          case "oas3.1": {
            out.prefixItems = items
            out.items = additionalItems
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
      out.properties = {}
      out.required = []
      for (const ps of ast.propertySignatures) {
        const name = ps.name as string
        if (Predicate.isSymbol(name)) {
          throw errorWithPath(`Unsupported property signature name ${Inspectable.format(name)}`, [...path, name])
        } else {
          out.properties[name] = mergeOrAppendJsonSchemaAnnotations(
            go(ps.type, [...path, name], options, false, false),
            ps.type.context?.annotations,
            options.generateDescriptions
          )
          if (!isOptional(ps.type)) {
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
        const type = go(is.type, path, options, false, false)
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
      return out
    }
    case "Union": {
      const types: Array<Schema.JsonSchema.Schema> = []
      for (const type of ast.types) {
        if (!AST.isUndefined(type)) {
          types.push(go(type, path, options, false, false))
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
        return go(ast.thunk(), path, options, true, false)
      }
      throw errorWithPath("Missing identifier in suspended schema", path)
    }
  }
}

function getMetaSchemaUri(target: Annotations.JsonSchema.Target) {
  switch (target) {
    case "draft-07":
      return "http://json-schema.org/draft-07/schema"
    case "2020-12":
    case "oas3.1":
      return "https://json-schema.org/draft/2020-12/schema"
  }
}

function getPointer(target: Annotations.JsonSchema.Target) {
  switch (target) {
    case "draft-07":
      return "#/definitions/"
    case "2020-12":
      return "#/$defs/"
    case "oas3.1":
      return "#/components/schemas/"
  }
}

function getFragments(
  checks: AST.Checks,
  options: GoOptions,
  type?: Schema.JsonSchema.Type
): [Schema.JsonSchema.Fragment, ...Array<Schema.JsonSchema.Fragment>] | undefined {
  const allOf: Array<Schema.JsonSchema.Fragment> = []
  for (let i = 0; i < checks.length; i++) {
    const fragment = getFragment(checks[i], options, type)
    if (fragment) {
      if (allOf.length === 0) {
        allOf.push(fragment)
      } else {
        const last = allOf[allOf.length - 1]
        if (hasIntersection(last, fragment)) {
          allOf.push(fragment)
        } else {
          allOf[allOf.length - 1] = { ...last, ...fragment }
        }
      }
    }
  }
  if (Arr.isArrayNonEmpty(allOf)) {
    return allOf
  }
}

function getFragment(
  check: AST.Check<any>,
  options: GoOptions,
  type?: Schema.JsonSchema.Type
): Schema.JsonSchema.Fragment | undefined {
  switch (check._tag) {
    case "Filter": {
      const fragment = getConstraint(check, options.target, type)
      if (fragment) {
        return mergeOrAppendJsonSchemaAnnotations(fragment, check.annotations, options.generateDescriptions)
      } else {
        return getJsonSchemaAnnotations(check.annotations, options.generateDescriptions)
      }
    }
    case "FilterGroup": {
      const allOf = getFragments(check.checks, options, type)
      if (allOf) {
        return mergeOrAppendJsonSchemaAnnotations({ allOf }, check.annotations, options.generateDescriptions)
      } else {
        return getJsonSchemaAnnotations(check.annotations, options.generateDescriptions)
      }
    }
  }
}

function getConstraint<T>(
  check: AST.Check<T>,
  target: Annotations.JsonSchema.Target,
  type?: Schema.JsonSchema.Type
): Schema.JsonSchema.Fragment | undefined {
  const annotation = check.annotations?.jsonSchemaConstraint as Annotations.JsonSchema.Constraint | undefined
  if (annotation) return annotation({ target, type })
}

function getAnnotation(
  annotations: Annotations.Annotations | undefined
): Annotations.JsonSchema.Override<ReadonlyArray<Schema.Top>> | undefined {
  return annotations?.jsonSchema as any
}

function isOptional(ast: AST.AST): boolean {
  const encoded = AST.encodedAST(ast)
  return AST.isOptional(encoded) || AST.containsUndefined(encoded)
}

function getPattern(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions
): string | undefined {
  switch (ast._tag) {
    case "String": {
      const jsonSchema = go(ast, path, options, false, false)
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
): Schema.JsonSchema.Fragment | undefined {
  if (annotations) {
    const out: Schema.JsonSchema.Fragment = {}
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

function unwrap(jsonSchema: Schema.JsonSchema.Schema): Schema.JsonSchema.Schema | undefined {
  if (Object.keys(jsonSchema).length === 1) {
    if (Array.isArray(jsonSchema.anyOf) && jsonSchema.anyOf.length === 1) {
      return jsonSchema.anyOf[0]
    } else if (Array.isArray(jsonSchema.oneOf) && jsonSchema.oneOf.length === 1) {
      return jsonSchema.oneOf[0]
    } else if (Array.isArray(jsonSchema.allOf) && jsonSchema.allOf.length === 1) {
      return jsonSchema.allOf[0]
    }
  }
}

function overwriteJsonSchemaAnnotations(
  jsonSchema: Schema.JsonSchema.Schema,
  annotations: Annotations.Annotations | undefined,
  generateDescriptions: boolean
): Schema.JsonSchema.Schema {
  const jsonSchemaAnnotations = getJsonSchemaAnnotations(annotations, generateDescriptions)
  if (jsonSchemaAnnotations) {
    if ("$ref" in jsonSchema) {
      return { allOf: [jsonSchema, jsonSchemaAnnotations] }
    } else {
      const unwrapped = unwrap(jsonSchema)
      if (unwrapped && !hasIntersection(unwrapped, jsonSchemaAnnotations)) {
        return { ...unwrapped, ...jsonSchemaAnnotations }
      } else {
        return { ...jsonSchema, ...jsonSchemaAnnotations }
      }
    }
  }
  return unwrap(jsonSchema) ?? jsonSchema
}

function mergeOrAppendJsonSchemaAnnotations(
  jsonSchema: Schema.JsonSchema.Schema,
  annotations: Annotations.Annotations | undefined,
  generateDescriptions: boolean
): Schema.JsonSchema.Schema {
  const fragment = getJsonSchemaAnnotations(annotations, generateDescriptions)
  return appendFragments(jsonSchema, fragment ? [fragment] : undefined)
}

function hasIntersection(
  jsonSchema: Schema.JsonSchema.Schema,
  fragment: Schema.JsonSchema.Fragment
): boolean {
  return Object.keys(jsonSchema).filter((key) => key !== "type").some((key) => Object.hasOwn(fragment, key))
}

function appendFragments(
  jsonSchema: Schema.JsonSchema.Schema,
  fragments:
    | [Schema.JsonSchema.Fragment, ...Array<Schema.JsonSchema.Fragment>]
    | undefined
): Schema.JsonSchema.Schema {
  if (fragments) {
    if ("$ref" in jsonSchema) {
      return { allOf: [jsonSchema, ...fragments] }
    } else {
      jsonSchema = unwrap(jsonSchema) ?? jsonSchema
      for (const fragment of fragments) {
        if (hasIntersection(jsonSchema, fragment)) {
          if (Array.isArray(jsonSchema.allOf)) {
            jsonSchema = { ...jsonSchema, allOf: [...jsonSchema.allOf, fragment] }
          } else {
            jsonSchema = { ...jsonSchema, allOf: [fragment] }
          }
        } else {
          jsonSchema = { ...jsonSchema, ...fragment }
        }
      }
      return jsonSchema
    }
  }
  return unwrap(jsonSchema) ?? jsonSchema
}

function getIdentifier(ast: AST.AST): string | undefined {
  return Annotations.resolveIdentifier(ast) ?? (AST.isSuspend(ast) ? getIdentifier(ast.thunk()) : undefined)
}
