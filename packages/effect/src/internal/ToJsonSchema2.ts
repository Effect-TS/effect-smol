import type { Option } from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import type * as Record from "../data/Record.ts"
import { formatPath } from "../interfaces/Inspectable.ts"
import type * as Annotations from "../schema/Annotations.ts"
import * as AST from "../schema/AST.ts"
import type * as Schema from "../schema/Schema.ts"
import * as ToParser from "../schema/ToParser.ts"

interface Options extends Schema.JsonSchemaOptions {
  readonly target: Annotations.JsonSchema.Target
}

/** @internal */
export function make<S extends Schema.Top>(schema: S, options: Options): {
  readonly uri: string
  readonly jsonSchema: Annotations.JsonSchema.JsonSchema
  readonly definitions: Record<string, Annotations.JsonSchema.JsonSchema>
} {
  const definitions = options.definitions ?? {}
  const target = options.target
  const additionalPropertiesStrategy = options.additionalPropertiesStrategy ?? "strict"
  const referenceStrategy = options.referenceStrategy ?? "keep"
  const jsonSchema = go(
    schema.ast,
    [],
    {
      target,
      definitions,
      referenceStrategy,
      additionalPropertiesStrategy,
      onMissingJsonSchemaAnnotation: options.onMissingJsonSchemaAnnotation
    },
    false,
    false,
    false
  )
  return {
    uri: getMetaSchemaUri(target),
    jsonSchema,
    definitions
  }
}

function getMetaSchemaUri(target: Annotations.JsonSchema.Target) {
  switch (target) {
    case "draft-07":
      return "http://json-schema.org/draft-07/schema"
    case "draft-2020-12":
    case "openApi3.1":
      return "https://json-schema.org/draft/2020-12/schema"
  }
}

// function getPointer(target: Annotations.JsonSchema.Target) {
//   switch (target) {
//     case "draft-07":
//       return "#/definitions/"
//     case "draft-2020-12":
//       return "#/$defs/"
//     case "openApi3.1":
//       return "#/components/schemas/"
//   }
// }

function getAnnotationsParser(ast: AST.AST) {
  return ToParser.asOption(ToParser.run(AST.flip(ast)))
}

function isContentEncodingSupported(target: Annotations.JsonSchema.Target): boolean {
  switch (target) {
    case "draft-07":
      return false
    case "draft-2020-12":
    case "openApi3.1":
      return true
  }
}

/** @internal */
export function getJsonSchemaAnnotations(
  ast: AST.AST,
  target: Annotations.JsonSchema.Target,
  annotations: Annotations.Annotations | undefined
): Annotations.JsonSchema.Fragment | undefined {
  let parser: (input: unknown, options?: AST.ParseOptions) => Option<unknown>
  if (annotations) {
    const out: Annotations.JsonSchema.Fragment = {}
    if (Predicate.isString(annotations.title)) {
      out.title = annotations.title
    }
    if (Predicate.isString(annotations.description)) {
      out.description = annotations.description
    }
    if (annotations.default !== undefined) {
      parser ??= getAnnotationsParser(ast)
      const o = parser(annotations.default)
      if (o._tag === "Some") {
        out.default = o.value
      }
    }
    if (Array.isArray(annotations.examples)) {
      parser ??= getAnnotationsParser(ast)
      const examples = []
      for (const example of annotations.examples) {
        if (example !== undefined) {
          const o = parser(example)
          if (o._tag === "Some") {
            examples.push(o.value)
          }
        }
      }
      if (examples.length > 0) {
        out.examples = examples
      }
    }
    if (isContentEncodingSupported(target)) {
      if (Predicate.isString(annotations.contentEncoding)) {
        out.contentEncoding = annotations.contentEncoding
      }
    }
    return Object.keys(out).length > 0 ? out : undefined
  }
}

function hasIntersection(
  jsonSchema: Annotations.JsonSchema.JsonSchema,
  fragment: Annotations.JsonSchema.Fragment
): boolean {
  const keys = new Set(Object.keys(jsonSchema))
  for (const key of Object.keys(fragment)) {
    if (keys.has(key)) return true
  }
  return false
}

function merge(
  jsonSchema: Annotations.JsonSchema.JsonSchema,
  fragment: Annotations.JsonSchema.Fragment | undefined,
  target: Annotations.JsonSchema.Target
): Annotations.JsonSchema.JsonSchema {
  if (fragment) {
    if (target === "draft-07" && "$ref" in jsonSchema) {
      jsonSchema = { allOf: [jsonSchema] }
    }
    if (hasIntersection(jsonSchema, fragment)) {
      if (Array.isArray(jsonSchema.allOf)) {
        return { ...jsonSchema, allOf: [...jsonSchema.allOf, fragment] }
      } else {
        return { allOf: [jsonSchema, fragment] }
      }
    } else {
      return { ...jsonSchema, ...fragment }
    }
  }
  return jsonSchema
}

function getAnnotation(
  annotations: Annotations.Annotations | undefined
): Annotations.JsonSchema.Override | Annotations.JsonSchema.Constraint | undefined {
  return annotations?.jsonSchema as Annotations.JsonSchema.Override | Annotations.JsonSchema.Constraint | undefined
}

function getCheckJsonFragment<T>(
  check: AST.Check<T>,
  target: Annotations.JsonSchema.Target,
  type?: Annotations.JsonSchema.Type
): Annotations.JsonSchema.Fragment | undefined {
  const annotation = getAnnotation(check.annotations)
  if (annotation && annotation._tag === "Constraint") {
    return annotation.constraint({ target, type })
  }
}

function handleAnnotations(
  jsonSchema: Annotations.JsonSchema.JsonSchema,
  ast: AST.AST,
  target: Annotations.JsonSchema.Target
): Annotations.JsonSchema.JsonSchema {
  if (ast.checks) {
    for (let i = ast.checks.length - 1; i >= 0; i--) {
      const check = ast.checks[i]
      const annotations = getJsonSchemaAnnotations(ast, target, check.annotations)
      jsonSchema = merge(jsonSchema, annotations, target)
      const fragment = getCheckJsonFragment(check, target, jsonSchema.type)
      jsonSchema = merge(jsonSchema, fragment, target)
    }
  }
  const annotations = getJsonSchemaAnnotations(ast, target, ast.annotations)
  jsonSchema = merge(jsonSchema, annotations, target)
  return jsonSchema
}

function go(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: Options,
  ignoreIdentifier: boolean,
  ignoreAnnotation: boolean,
  ignoreErrors: boolean
): Annotations.JsonSchema.JsonSchema {
  // ---------------------------------------------
  // handle encoding
  // ---------------------------------------------
  if (ast.encoding) {
    return go(ast.encoding[ast.encoding.length - 1].to, path, options, ignoreIdentifier, ignoreAnnotation, ignoreErrors)
  }
  // ---------------------------------------------
  // handle base cases
  // ---------------------------------------------
  switch (ast._tag) {
    case "Declaration":
    case "BigInt":
    case "Symbol":
    case "UniqueSymbol": {
      if (ignoreErrors) return {}
      if (options.onMissingJsonSchemaAnnotation) {
        const out = options.onMissingJsonSchemaAnnotation(ast)
        if (out) return out
      }
      throw new Error(`cannot generate JSON Schema for ${ast.getExpected()} at ${formatPath(path) || "root"}`)
    }

    case "Never":
    case "Undefined":
      return handleAnnotations({ not: {} }, ast, options.target)

    case "Void":
    case "Unknown":
    case "Any":
      return handleAnnotations({}, ast, options.target)

    case "Null":
      return handleAnnotations({ type: "null" }, ast, options.target)

    case "String":
      return handleAnnotations({ type: "string" }, ast, options.target)

    case "Number":
      return handleAnnotations({ type: "number" }, ast, options.target)

    case "Boolean":
      return handleAnnotations({ type: "boolean" }, ast, options.target)

    case "ObjectKeyword":
      return handleAnnotations({ anyOf: [{ type: "object" }, { type: "array" }] }, ast, options.target)

    case "Literal": {
      if (Predicate.isString(ast.literal)) {
        return handleAnnotations({ type: "string", enum: [ast.literal] }, ast, options.target)
      } else if (Predicate.isNumber(ast.literal)) {
        return handleAnnotations({ type: "number", enum: [ast.literal] }, ast, options.target)
      } else if (Predicate.isBoolean(ast.literal)) {
        return handleAnnotations({ type: "boolean", enum: [ast.literal] }, ast, options.target)
      }
      if (ignoreErrors) return {}
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    }

    case "Enum":
      return handleAnnotations(
        go(AST.enumsToLiterals(ast), path, options, ignoreIdentifier, ignoreAnnotation, ignoreErrors),
        ast,
        options.target
      )

    case "TemplateLiteral":
      return handleAnnotations(
        { type: "string", pattern: AST.getTemplateLiteralRegExp(ast).source },
        ast,
        options.target
      )

    case "Arrays":
    case "Objects":
    case "Union":
    case "Suspend":
      return handleAnnotations({}, ast, options.target)
  }
}
