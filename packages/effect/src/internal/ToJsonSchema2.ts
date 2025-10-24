import * as Arr from "../collections/Array.ts"
import * as Predicate from "../data/Predicate.ts"
import type * as Record from "../data/Record.ts"
import { formatPath } from "../interfaces/Inspectable.ts"
import * as Annotations from "../schema/Annotations.ts"
import * as AST from "../schema/AST.ts"
import type * as Schema from "../schema/Schema.ts"

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

interface GoOptions extends Options {
  readonly definitions: Record<string, Annotations.JsonSchema.JsonSchema>
}

function go(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreIdentifier: boolean,
  ignoreAnnotation: boolean,
  ignoreErrors: boolean
): Annotations.JsonSchema.JsonSchema {
  const target = options.target
  // ---------------------------------------------
  // handle identifier annotation
  // ---------------------------------------------
  if (
    !ignoreIdentifier &&
    (options.referenceStrategy !== "skip" || AST.isSuspend(ast))
  ) {
    const identifier = getIdentifier(ast)
    if (identifier !== undefined) {
      const escapedIdentifier = identifier.replace(/~/ig, "~0").replace(/\//ig, "~1")
      const $ref = { $ref: getPointer(target) + escapedIdentifier }
      if (Object.hasOwn(options.definitions, identifier)) {
        return $ref
      } else {
        options.definitions[identifier] = $ref
        options.definitions[identifier] = go(ast, path, options, true, false, ignoreErrors)
        return $ref
      }
    }
  }
  // ---------------------------------------------
  // handle checks
  // ---------------------------------------------
  if (ast.checks) {
    const last = ast.checks[ast.checks.length - 1]
    const init = ast.checks.slice(0, -1)
    let out = go(
      AST.replaceChecks(ast, Arr.isReadonlyArrayNonEmpty(init) ? init : undefined),
      path,
      options,
      false,
      false,
      false
    )
    if (!ignoreAnnotation) {
      const annotation = getAnnotation(last.annotations)
      if (annotation) {
        switch (annotation._tag) {
          case "Override":
            return {
              $comment: "Override",
              ...annotation.override({
                target,
                jsonSchema: go(ast, path, options, ignoreIdentifier, true, true),
                make: (ast) => go(ast, path, options, ignoreIdentifier, false, false)
              })
            }
          case "Constraint": {
            const fragment = getFragment(ast, last, target, out.type)
            if (fragment) {
              out = merge(out, fragment)
            }
          }
        }
      }
    }
    return out
  }
  // ---------------------------------------------
  // handle annotations
  // ---------------------------------------------
  if (ast.annotations) {
    let out = go(AST.replaceAnnotations(ast, undefined), path, options, false, false, ignoreErrors)
    if (!ignoreAnnotation) {
      const annotation = getAnnotation(ast.annotations)
      if (annotation) {
        switch (annotation._tag) {
          case "Override": {
            out = {
              $comment: "Override",
              ...annotation.override({
                target,
                jsonSchema: go(ast, path, options, ignoreIdentifier, true, true),
                make: (ast) => go(ast, path, options, ignoreIdentifier, false, false)
              })
            }
            break
          }
          case "Constraint": {
            if (ignoreErrors) return {}
            throw new Error("Constraint annotation found on non-constrained AST", { cause: ast })
          }
        }
      }
    }
    if (!ast.encoding) {
      const annotations = getJsonSchemaAnnotations(target, ast.annotations)
      if (annotations) {
        if ("$ref" in out) {
          out = { allOf: [out] }
        }
        out = { ...out, ...annotations }
      }
    }
    return out
  }
  // ---------------------------------------------
  // handle encoding
  // ---------------------------------------------
  if (ast.encoding) {
    return {
      $comment: "Encoding",
      ...go(ast.encoding[ast.encoding.length - 1].to, path, options, false, false, ignoreErrors)
    }
  }
  // ---------------------------------------------
  // handle base cases
  // ---------------------------------------------
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
      if (ignoreErrors) return {}
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
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
      if (Predicate.isString(ast.literal)) {
        return { type: "string", enum: [ast.literal] }
      }
      if (Predicate.isNumber(ast.literal)) {
        return { type: "number", enum: [ast.literal] }
      }
      if (Predicate.isBoolean(ast.literal)) {
        return { type: "boolean", enum: [ast.literal] }
      }
      if (ignoreErrors) return {}
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    }

    case "Enum":
      return go(AST.enumsToLiterals(ast), path, options, false, false, ignoreErrors)

    case "TemplateLiteral":
      return { type: "string", pattern: AST.getTemplateLiteralRegExp(ast).source }

    case "Arrays": {
      // ---------------------------------------------
      // handle post rest elements
      // ---------------------------------------------
      if (ast.rest.length > 1) {
        if (ignoreErrors) return {}
        throw new Error(
          "Generating a JSON Schema for post-rest elements is not currently supported. You're welcome to contribute by submitting a Pull Request"
        )
      }
      const out: any = { type: "array" }
      // ---------------------------------------------
      // handle elements
      // ---------------------------------------------
      const items = ast.elements.map((e, i) => {
        return merge(
          go(e, [...path, i], options, false, false, ignoreErrors),
          getJsonSchemaAnnotations(target, e.context?.annotations, "key annotations")
        )
      })
      const minItems = ast.elements.findIndex(isOptional)
      if (minItems !== -1) {
        out.minItems = minItems
      }
      // ---------------------------------------------
      // handle rest element
      // ---------------------------------------------
      const additionalItems = ast.rest.length > 0
        ? go(ast.rest[0], [...path, ast.elements.length], options, false, false, ignoreErrors)
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
          case "draft-2020-12": {
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
          if (ignoreErrors) return {}
          throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath([...path, name]) || "root"}`)
        } else {
          out.properties[name] = merge(
            go(ps.type, [...path, name], options, false, false, ignoreErrors),
            getJsonSchemaAnnotations(target, ps.type.context?.annotations, "key annotations")
          )
          if (!isOptional(ps.type)) {
            out.required.push(name)
          }
        }
      }
      // ---------------------------------------------
      // handle index signatures
      // ---------------------------------------------
      if (options.additionalPropertiesStrategy === "strict") {
        out.additionalProperties = false
      } else {
        out.additionalProperties = true
      }
      const patternProperties: Record<string, object> = {}
      for (const is of ast.indexSignatures) {
        const type = go(is.type, path, options, false, false, ignoreErrors)
        const pattern = getPattern(is.parameter, path, options, ignoreErrors)
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
      const types = ast.types.filter((ast) => !AST.isUndefined(ast)).map((t) =>
        go(t, path, options, false, false, ignoreErrors)
      )
      return types.length === 0
        ? { not: {} }
        : types.length === 1
        ? types[0]
        : ast.mode === "anyOf"
        ? { anyOf: types }
        : { oneOf: types }
    }
    case "Suspend": {
      const id = getIdentifier(ast)
      if (id !== undefined) {
        return go(ast.thunk(), path, options, true, false, ignoreErrors)
      }
      if (ignoreErrors) return {}
      throw new Error(
        `cannot generate JSON Schema for ${ast._tag} at ${
          formatPath(path) || "root"
        }, required \`identifier\` annotation`
      )
    }
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

function getPointer(target: Annotations.JsonSchema.Target) {
  switch (target) {
    case "draft-07":
      return "#/definitions/"
    case "draft-2020-12":
      return "#/$defs/"
    case "openApi3.1":
      return "#/components/schemas/"
  }
}

function getConstraint<T>(
  check: AST.Check<T>,
  target: Annotations.JsonSchema.Target,
  type?: Annotations.JsonSchema.Type
): Annotations.JsonSchema.Fragment | undefined {
  const annotation = getAnnotation(check.annotations)
  if (annotation && annotation._tag === "Constraint") {
    return annotation.constraint({ target, type })
  }
}

function getFragment(
  ast: AST.AST,
  check: AST.Check<any>,
  target: Annotations.JsonSchema.Target,
  type?: Annotations.JsonSchema.Type
): Annotations.JsonSchema.Fragment | undefined {
  const annotations = getJsonSchemaAnnotations(target, check.annotations)
  switch (check._tag) {
    case "Filter": {
      const fragment = getConstraint(check, target, type)
      return {
        $comment: "Filter",
        ...annotations,
        ...fragment
      }
    }
    case "FilterGroup": {
      return {
        $comment: "FilterGroup",
        ...annotations,
        allOf: getConstraints(ast, check.checks, target, type)
      }
    }
  }
}

function getConstraints(
  ast: AST.AST,
  checks: AST.Checks,
  target: Annotations.JsonSchema.Target,
  type?: Annotations.JsonSchema.Type
): Array<Annotations.JsonSchema.Fragment> {
  return checks.map((check) => getFragment(ast, check, target, type)).filter(Predicate.isNotUndefined)
}

function getAnnotation(
  annotations: Annotations.Annotations | undefined
): Annotations.JsonSchema.Override | Annotations.JsonSchema.Constraint | undefined {
  return annotations?.jsonSchema as Annotations.JsonSchema.Override | Annotations.JsonSchema.Constraint | undefined
}

function getRequired(annotations: Annotations.Annotations | undefined): boolean | undefined {
  const annotation = getAnnotation(annotations)
  if (annotation && annotation._tag === "Override" && annotation.required !== undefined) {
    return !annotation.required
  }
}

function isOptional(ast: AST.AST): boolean {
  if (ast.checks) {
    for (let i = ast.checks.length - 1; i >= 0; i--) {
      const required = getRequired(ast.checks[i].annotations)
      if (required !== undefined) return required
    }
  }
  const required = getRequired(ast.annotations)
  if (required !== undefined) return required
  const encodedAST = AST.encodedAST(ast)
  return AST.isOptional(encodedAST) || AST.containsUndefined(encodedAST)
}

function getPattern(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreErrors: boolean
): string | undefined {
  switch (ast._tag) {
    case "String": {
      const jsonSchema = go(ast, path, options, false, false, ignoreErrors)
      if (Object.hasOwn(jsonSchema, "pattern") && Predicate.isString(jsonSchema.pattern)) {
        return jsonSchema.pattern
      }
      return undefined
    }
    case "Number":
      return "^[0-9]+$"
    case "TemplateLiteral":
      return AST.getTemplateLiteralRegExp(ast).source
  }
  if (ignoreErrors) return undefined
  throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
}

function getJsonSchemaAnnotations(
  target: Annotations.JsonSchema.Target,
  annotations: Annotations.Annotations | undefined,
  comment?: string | undefined
): Annotations.JsonSchema.Fragment | undefined {
  if (annotations) {
    const out: Annotations.JsonSchema.Fragment = {}
    if (Predicate.isString(annotations.title)) {
      out.title = annotations.title
    }
    if (Predicate.isString(annotations.description)) {
      out.description = annotations.description
    }
    if (annotations.default !== undefined) {
      out.default = annotations.default
    }
    if (Array.isArray(annotations.examples)) {
      out.examples = annotations.examples
    }
    return Object.keys(out).length > 0 ? comment !== undefined ? { $comment: comment, ...out } : out : undefined
  }
}

// function hasIntersection(
//   jsonSchema: Annotations.JsonSchema.JsonSchema,
//   fragment: Annotations.JsonSchema.Fragment
// ): boolean {
//   const keys = new Set(Object.keys(jsonSchema))
//   for (const key of Object.keys(fragment)) {
//     if (keys.has(key)) return true
//   }
//   return false
// }

function merge(
  jsonSchema: Annotations.JsonSchema.JsonSchema,
  fragment: Annotations.JsonSchema.Fragment | undefined
): Annotations.JsonSchema.JsonSchema {
  if (fragment) {
    if ("$ref" in jsonSchema) {
      jsonSchema = { allOf: [jsonSchema] }
    }
    if (Array.isArray(jsonSchema.allOf)) {
      return { ...jsonSchema, allOf: [...jsonSchema.allOf, fragment] }
    } else {
      return { ...jsonSchema, allOf: [fragment] }
    }
  }
  return jsonSchema
}

function getIdentifier(ast: AST.AST): string | undefined {
  const id = Annotations.getIdentifier(ast)
  if (id !== undefined) return id
  if (AST.isSuspend(ast)) {
    return getIdentifier(ast.thunk())
  }
}
