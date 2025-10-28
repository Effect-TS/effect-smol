import * as Arr from "../collections/Array.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Equal from "../interfaces/Equal.ts"
import * as Inspectable from "../interfaces/Inspectable.ts"
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
  const additionalProperties = options.additionalProperties ?? false
  const referenceStrategy = options.referenceStrategy ?? "keep"
  const jsonSchema = go(
    schema.ast,
    [],
    {
      target,
      definitions,
      referenceStrategy,
      additionalProperties,
      onMissingJsonSchemaAnnotation: options.onMissingJsonSchemaAnnotation
    },
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
  readonly additionalProperties: true | false | Annotations.JsonSchema.JsonSchema
  readonly definitions: Record<string, Annotations.JsonSchema.JsonSchema>
}

function go(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreIdentifier: boolean,
  ignoreAnnotation: boolean
): Annotations.JsonSchema.JsonSchema {
  const target = options.target
  // ---------------------------------------------
  // handle identifier annotation
  // ---------------------------------------------
  if (!ignoreIdentifier && (options.referenceStrategy !== "skip" || AST.isSuspend(ast))) {
    const identifier = getIdentifier(ast)
    if (identifier !== undefined) {
      const escapedIdentifier = identifier.replace(/~/ig, "~0").replace(/\//ig, "~1")
      const $ref = { $ref: getPointer(target) + escapedIdentifier }
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
    const annotation = getAnnotation(Annotations.get(ast))
    if (annotation) {
      switch (annotation._tag) {
        case "Override": {
          function getDefaultJsonSchema() {
            try {
              return go(ast, path, options, ignoreIdentifier, true)
            } catch {
              return {}
            }
          }
          let out = annotation.override({
            target,
            jsonSchema: getDefaultJsonSchema(),
            make: (ast) => go(ast, path, options, false, false)
          })
          const annotations = getJsonSchemaAnnotations(ast.annotations)
          if (annotations) {
            if ("$ref" in out) {
              out = { allOf: [out] }
            }
            out = { ...out, ...annotations }
          }
          return out
        }
      }
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
    const allOf = getFragments(ast.checks, options.target, out.type)
    if (allOf) {
      if ("$ref" in out) {
        out = { allOf: [out] }
      }
      if (Array.isArray(out.allOf)) {
        out = { allOf: [...out.allOf, ...allOf] }
      } else {
        out = { ...out, allOf }
      }
    }
  }
  // ---------------------------------------------
  // handle JSON Schema annotations
  // ---------------------------------------------
  const annotations = getJsonSchemaAnnotations(ast.annotations)
  if (annotations) {
    if ("$ref" in out) {
      out = { allOf: [out] }
    }
    out = { ...out, ...annotations }
  }
  return out
}

function base(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreAnnotation: boolean
): Annotations.JsonSchema.JsonSchema {
  const target = options.target
  // ---------------------------------------------
  // handle Override annotation
  // ---------------------------------------------
  if (!ignoreAnnotation) {
    const annotation = getAnnotation(ast.annotations)
    if (annotation) {
      switch (annotation._tag) {
        case "Override": {
          function getDefaultJsonSchema() {
            try {
              return base(ast, path, options, true)
            } catch {
              return {}
            }
          }
          let out = annotation.override({
            target,
            jsonSchema: getDefaultJsonSchema(),
            make: (ast) => go(ast, path, options, false, false)
          })
          const annotations = getJsonSchemaAnnotations(ast.annotations)
          if (annotations) {
            if ("$ref" in out) {
              out = { allOf: [out] }
            }
            out = { ...out, ...annotations }
          }
          return out
        }
      }
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
      throw error(`Unsupported schema ${ast._tag}`, path)
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
      throw error(`Unsupported literal ${Inspectable.format(ast.literal)}`, path)
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
        throw error(
          "Generating a JSON Schema for post-rest elements is not currently supported. You're welcome to contribute by submitting a Pull Request",
          path
        )
      }
      const out: any = { type: "array" }
      // ---------------------------------------------
      // handle elements
      // ---------------------------------------------
      const items = ast.elements.map((e, i) => {
        return merge(
          go(e, [...path, i], options, false, false),
          getJsonSchemaAnnotations(e.context?.annotations)
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
          case "draft-2020-12":
          case "openApi3.1": {
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
          throw error(`Unsupported property signature name ${Inspectable.format(name)}`, [...path, name])
        } else {
          out.properties[name] = merge(
            go(ps.type, [...path, name], options, false, false),
            getJsonSchemaAnnotations(ps.type.context?.annotations)
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
      const types: Array<Annotations.JsonSchema.JsonSchema> = []
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
      throw error(`Missing identifier for ${ast._tag}`, path)
    }
  }
}

function error(message: string, path: ReadonlyArray<PropertyKey>) {
  if (path.length > 0) {
    message += `\n  at ${Inspectable.formatPath(path)}`
  }
  return new Error(message)
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

function getFragments(
  checks: AST.Checks,
  target: Annotations.JsonSchema.Target,
  type?: Annotations.JsonSchema.Type
): [Annotations.JsonSchema.Fragment, ...Array<Annotations.JsonSchema.Fragment>] | undefined {
  const allOf = []
  for (let i = 0; i < checks.length; i++) {
    const fragment = getFragment(checks[i], target, type)
    if (fragment) allOf.push(fragment)
  }
  if (Arr.isArrayNonEmpty(allOf)) {
    return allOf
  }
}

function getFragment(
  check: AST.Check<any>,
  target: Annotations.JsonSchema.Target,
  type?: Annotations.JsonSchema.Type
): Annotations.JsonSchema.Fragment | undefined {
  const annotations = getJsonSchemaAnnotations(check.annotations)
  switch (check._tag) {
    case "Filter": {
      const fragment = getConstraint(check, target, type)
      if (annotations || fragment) {
        return {
          ...annotations,
          ...fragment
        }
      }
      break
    }
    case "FilterGroup": {
      const allOf = getFragments(check.checks, target, type)
      if (annotations || allOf) {
        return {
          ...annotations,
          allOf
        }
      }
      break
    }
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
    const last = ast.checks[ast.checks.length - 1]
    const out = getRequired(last.annotations)
    if (out !== undefined) return out
  } else {
    const out = getRequired(ast.annotations)
    if (out !== undefined) return out
  }
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
      if (Object.hasOwn(jsonSchema, "pattern") && Predicate.isString(jsonSchema.pattern)) {
        return jsonSchema.pattern
      }
      return undefined
    }
    case "Number":
      return "^[0-9]+$"
    case "TemplateLiteral":
      return AST.getTemplateLiteralRegExp(ast).source
    default:
      throw error(`Unsupported index signature parameter ${ast._tag}`, path)
  }
}

function getJsonSchemaAnnotations(
  annotations: Annotations.Annotations | undefined
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

    if (Object.keys(out).length > 0) return out
  }
}

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
  const identifier = Annotations.getIdentifier(ast)
  if (identifier !== undefined) return identifier

  if (AST.isSuspend(ast)) return getIdentifier(ast.thunk())
}
