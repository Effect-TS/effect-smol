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

const visited = new WeakSet<AST.AST>()

function go(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreIdentifier: boolean,
  ignoreAnnotation: boolean,
  ignoreErrors: boolean // TODO: remove this option, use try / catch instead
): Annotations.JsonSchema.JsonSchema {
  const target = options.target
  // ---------------------------------------------
  // handle identifier annotation
  // ---------------------------------------------
  if (!ignoreIdentifier && options.referenceStrategy !== "skip") {
    const identifier = getIdentifier(ast)
    if (identifier !== undefined) {
      const escapedIdentifier = identifier.replace(/~/ig, "~0").replace(/\//ig, "~1")
      const $ref = { $ref: getPointer(target) + escapedIdentifier }
      if (Object.hasOwn(options.definitions, identifier)) {
        if (AST.isSuspend(ast)) {
          // check for duplicated identifiers in different ASTs
          if (visited.has(ast)) {
            return $ref
          }
        } else {
          const existing = options.definitions[identifier]
          const generated = go(ast, path, options, true, ignoreAnnotation, ignoreErrors)
          // check for duplicated identifiers in different ASTs
          if (Equal.equals(existing, generated)) {
            return $ref
          }
        }
      } else {
        visited.add(ast) // allows to check for duplicated identifiers in different ASTs
        options.definitions[identifier] = $ref
        options.definitions[identifier] = go(ast, path, options, true, ignoreAnnotation, ignoreErrors)
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
          let out = annotation.override({
            target,
            jsonSchema: go(ast, path, options, ignoreIdentifier, true, true),
            make: (ast) => go(ast, path, options, false, false, false)
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
    return go(AST.encodedAST(ast), path, options, ignoreIdentifier, ignoreAnnotation, ignoreErrors)
  }
  let out = base(ast, path, options, false, false, ignoreErrors)
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
  ignoreIdentifier: boolean,
  ignoreAnnotation: boolean,
  ignoreErrors: boolean // TODO: remove this option, use try / catch instead
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
          let out = annotation.override({
            target,
            jsonSchema: base(ast, path, options, true, true, true),
            make: (ast) => go(ast, path, options, false, false, false)
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
      if (ignoreErrors) return {}
      const message = `Unsupported schema ${ast._tag} at ${formatPath(path)}`
      throw new Error(message)
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
      const message = `Unsupported literal ${Inspectable.format(ast.literal)} at ${formatPath(path)}`
      throw new Error(message)
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
        const message =
          "Generating a JSON Schema for post-rest elements is not currently supported. You're welcome to contribute by submitting a Pull Request"
        throw new Error(message)
      }
      const out: any = { type: "array" }
      // ---------------------------------------------
      // handle elements
      // ---------------------------------------------
      const items = ast.elements.map((e, i) => {
        return merge(
          go(e, [...path, i], options, false, false, ignoreErrors),
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
          const message = `Unsupported property signature name ${Inspectable.format(name)} at ${
            formatPath([...path, name])
          }`
          throw new Error(message)
        } else {
          out.properties[name] = merge(
            go(ps.type, [...path, name], options, false, false, ignoreErrors),
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
      const types: Array<Annotations.JsonSchema.JsonSchema> = []
      for (const type of ast.types) {
        if (!AST.isUndefined(type)) {
          types.push(go(type, path, options, false, false, ignoreErrors))
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
        return go(ast.thunk(), path, options, true, false, ignoreErrors)
      }
      if (ignoreErrors) return {}
      const message = `Missing identifier for ${ast._tag} at ${formatPath(path)}`
      throw new Error(message)
    }
  }
}

function formatPath(path: ReadonlyArray<PropertyKey>): string {
  return path.length > 0 ? Inspectable.formatPath(path) : "root"
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
    const required = getRequired(last.annotations)
    if (required !== undefined) return required
  } else {
    const required = getRequired(ast.annotations)
    if (required !== undefined) return required
  }
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
  const message = `Unsupported index signature parameter ${ast._tag} at ${formatPath(path)}`
  throw new Error(message)
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
    if (Object.keys(out).length > 0) {
      return out
    }
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
  if (AST.isSuspend(ast)) {
    return getIdentifier(ast.thunk())
  }
}
