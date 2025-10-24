import type { Option } from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import type * as Record from "../data/Record.ts"
import { formatPath } from "../interfaces/Inspectable.ts"
import * as Annotations from "../schema/Annotations.ts"
import * as AST from "../schema/AST.ts"
import type * as Schema from "../schema/Schema.ts"
import * as ToParser from "../schema/ToParser.ts"

interface Options extends Schema.JsonSchemaOptions {
  readonly target?: Annotations.JsonSchema.Target | undefined
}

function get$schema(target: Annotations.JsonSchema.Target) {
  switch (target) {
    case "draft-07":
      return "http://json-schema.org/draft-07/schema"
    case "draft-2020-12":
    case "openApi3.1":
      return "https://json-schema.org/draft/2020-12/schema"
  }
}

/** @internal */
export function make<S extends Schema.Top>(schema: S, options?: Options): Annotations.JsonSchema.JsonSchema {
  const definitions = options?.definitions ?? {}
  const getRef = (id: string) => "#/$defs/" + id
  const target = options?.target ?? "draft-07"
  const additionalPropertiesStrategy = options?.additionalPropertiesStrategy ?? "strict"
  const referenceStrategy = options?.referenceStrategy ?? "keep"
  const out: Annotations.JsonSchema.JsonSchema = {
    $schema: get$schema(target),
    ...go(schema.ast, [], {
      definitions,
      getRef,
      target,
      referenceStrategy,
      additionalPropertiesStrategy,
      onMissingJsonSchemaAnnotation: options?.onMissingJsonSchemaAnnotation
    })
  }
  if (Object.keys(definitions).length > 0) {
    out.$defs = definitions
  }
  return out
}

function getAnnotationsParser(ast: AST.AST) {
  return ToParser.asOption(ToParser.run(AST.flip(ast)))
}

function getJsonSchemaAnnotations(
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
    return Object.keys(out).length > 0 ? out : undefined
  }
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

function getChecksJsonFragment(
  ast: AST.AST,
  target: Annotations.JsonSchema.Target,
  type?: Annotations.JsonSchema.Type
): Annotations.JsonSchema.Fragment | undefined {
  let out: Annotations.JsonSchema.Fragment & { allOf: Array<unknown> } = {
    ...getJsonSchemaAnnotations(ast, target, ast.annotations),
    allOf: []
  }
  if (ast.checks) {
    function handle(check: AST.Check<any>) {
      const fragment: Annotations.JsonSchema.Fragment = {
        ...getJsonSchemaAnnotations(ast, target, check.annotations),
        ...getCheckJsonFragment(check, target, type)
      }
      if (fragment.type !== undefined) {
        out.type = fragment.type
        delete fragment.type
      }
      if (Object.keys(fragment).some((k) => Object.hasOwn(out, k))) {
        out.allOf.push(fragment)
      } else {
        out = { ...out, ...fragment }
      }
    }
    function go(check: AST.Check<any>) {
      handle(check)
      if (check._tag === "FilterGroup") {
        check.checks.forEach(go)
      }
    }
    ast.checks.forEach(go)
  }
  if (out.allOf.length === 0) {
    delete (out as any).allOf
  }
  return out
}

/** Either the AST is optional or it contains an undefined keyword */
function isLooseOptional(ast: AST.AST): boolean {
  const annotation = getAnnotation(ast.annotations)
  if (annotation && annotation._tag === "Override" && annotation.required === true) {
    return false
  }
  return AST.isOptional(ast) || AST.containsUndefined(ast)
}

function getPattern(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreErrors: boolean
): string | undefined {
  switch (ast._tag) {
    case "String": {
      const json = go(ast, path, options)
      if (Object.hasOwn(json, "pattern") && Predicate.isString(json.pattern)) {
        return json.pattern
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

type GoOptions = {
  readonly definitions: Record<string, Annotations.JsonSchema.JsonSchema>
  readonly getRef: (id: string) => string
  readonly target: Annotations.JsonSchema.Target
  readonly referenceStrategy: Schema.JsonSchemaReferenceStrategy
  readonly additionalPropertiesStrategy: Schema.JsonSchemaAdditionalPropertiesStrategy
  readonly onMissingJsonSchemaAnnotation?: ((ast: AST.AST) => Annotations.JsonSchema.JsonSchema | undefined) | undefined
}

function getId(ast: AST.AST): string | undefined {
  const id = Annotations.getIdentifier(ast)
  if (id !== undefined) return id
  if (AST.isSuspend(ast)) {
    return getId(ast.thunk())
  }
}

/**
 * If the AST has checks, we look for an override annotation in the checks. If
 * not, we look for an override annotation or constraint annotation in the
 * annotations.
 */
function getBottomJsonSchemaAnnotation(
  ast: AST.AST
): Annotations.JsonSchema.Override | Annotations.JsonSchema.Constraint | undefined {
  if (ast.checks) {
    for (let i = ast.checks.length - 1; i >= 0; i--) {
      const annotation = getAnnotation(ast.checks[i].annotations)
      if (annotation && annotation._tag === "Override") {
        return annotation
      }
    }
  }
  return getAnnotation(ast.annotations)
}

function isCompactableLiteral(
  jsonSchema: Annotations.JsonSchema.JsonSchema | undefined
): jsonSchema is Annotations.JsonSchema.JsonSchema & { enum: Array<unknown> } {
  return jsonSchema !== undefined && "enum" in jsonSchema && "type" in jsonSchema &&
    Object.keys(jsonSchema).length === 2
}

function compactLiterals(members: Array<Annotations.JsonSchema.JsonSchema>) {
  const out: Array<Annotations.JsonSchema.JsonSchema> = []
  for (const m of members) {
    if (isCompactableLiteral(m) && out.length > 0) {
      const last = out[out.length - 1]
      if (isCompactableLiteral(last) && last.type === m.type) {
        out[out.length - 1] = {
          ...last,
          enum: [...last.enum, ...m.enum]
        }
        continue
      }
    }
    out.push(m)
  }
  return out
}

const cacheEncodedAST = new Map<AST.AST, string>()

function go(
  ast: AST.AST,
  path: ReadonlyArray<PropertyKey>,
  options: GoOptions,
  ignoreIdentifier: boolean = false,
  ignoreAnnotation: boolean = false,
  ignoreErrors: boolean = false
): Annotations.JsonSchema.JsonSchema {
  // ---------------------------------------------
  // handle identifier annotation
  // ---------------------------------------------
  if (
    !ignoreIdentifier &&
    (options.referenceStrategy !== "skip" || AST.isSuspend(ast))
  ) {
    const identifier = getId(ast)
    if (identifier !== undefined) {
      const escapedIdentifier = identifier.replace(/~/ig, "~0").replace(/\//ig, "~1")
      const $ref = { $ref: options.getRef(escapedIdentifier) }
      const encodedAST = AST.encodedAST(ast)
      if (Object.hasOwn(options.definitions, identifier)) {
        if (AST.isSuspend(ast) || cacheEncodedAST.has(encodedAST)) {
          return $ref
        }
      } else {
        options.definitions[identifier] = $ref
        cacheEncodedAST.set(encodedAST, identifier)
        options.definitions[identifier] = go(ast, path, options, true)
        return $ref
      }
    }
  }
  // ---------------------------------------------
  // handle json schema annotations
  // ---------------------------------------------
  const target = options.target
  if (!ignoreAnnotation) {
    const annotation = getBottomJsonSchemaAnnotation(ast)
    if (annotation) {
      switch (annotation._tag) {
        case "Override":
          return annotation.override({
            target,
            jsonSchema: go(ast, path, options, ignoreIdentifier, true, true),
            make: (ast) => go(ast, path, options, ignoreIdentifier)
          })
        case "Constraint": {
          const jsonSchema = go(ast, path, options, ignoreIdentifier, true)
          return {
            ...jsonSchema,
            ...annotation.constraint({ target, type: jsonSchema.type })
          }
        }
      }
    }
  }
  // ---------------------------------------------
  // handle encoding
  // ---------------------------------------------
  if (ast.encoding) {
    return go(ast.encoding[ast.encoding.length - 1].to, path, options, ignoreIdentifier)
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
      return { not: {}, ...getChecksJsonFragment(ast, target) }
    case "Void":
    case "Unknown":
    case "Any":
      return { ...getChecksJsonFragment(ast, target) }
    case "Null": {
      const constraint = getChecksJsonFragment(ast, target, "null")
      return { type: "null", ...constraint }
    }
    case "String":
      return { type: "string", ...getChecksJsonFragment(ast, target, "string") }
    case "Number":
      return { type: "number", ...getChecksJsonFragment(ast, target, "number") }
    case "Boolean":
      return { type: "boolean", ...getChecksJsonFragment(ast, target, "boolean") }
    case "ObjectKeyword":
      return {
        anyOf: [
          { type: "object" },
          { type: "array" }
        ],
        ...getChecksJsonFragment(ast, target)
      }
    case "Literal": {
      if (Predicate.isString(ast.literal)) {
        return { type: "string", enum: [ast.literal], ...getChecksJsonFragment(ast, target, "string") }
      } else if (Predicate.isNumber(ast.literal)) {
        return { type: "number", enum: [ast.literal], ...getChecksJsonFragment(ast, target, "number") }
      } else if (Predicate.isBoolean(ast.literal)) {
        return { type: "boolean", enum: [ast.literal], ...getChecksJsonFragment(ast, target, "boolean") }
      }
      if (ignoreErrors) return {}
      throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath(path) || "root"}`)
    }
    case "Enum": {
      return {
        ...go(AST.enumsToLiterals(ast), path, options),
        ...getChecksJsonFragment(ast, target)
      }
    }
    case "TemplateLiteral":
      return {
        type: "string",
        pattern: AST.getTemplateLiteralRegExp(ast).source,
        ...getChecksJsonFragment(ast, target, "string")
      }
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
      const out: Annotations.JsonSchema.JsonSchema = {
        type: "array",
        ...getChecksJsonFragment(ast, target, "array")
      }
      // ---------------------------------------------
      // handle elements
      // ---------------------------------------------
      const items = ast.elements.map((e, i) => ({
        ...go(e, [...path, i], options),
        ...getJsonSchemaAnnotations(e, target, e.context?.annotations)
      }))
      const minItems = ast.elements.findIndex(isLooseOptional)
      if (minItems !== -1) {
        out.minItems = minItems
      }
      // ---------------------------------------------
      // handle rest element
      // ---------------------------------------------
      const additionalItems = ast.rest.length > 0 ? go(ast.rest[0], [...path, ast.elements.length], options) : false
      if (items.length === 0) {
        out.items = additionalItems
      } else {
        switch (options.target) {
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
        return {
          anyOf: [
            { type: "object" },
            { type: "array" }
          ],
          ...getChecksJsonFragment(ast, target)
        }
      }
      const out: any = {
        type: "object",
        ...getChecksJsonFragment(ast, target, "object")
      }
      // ---------------------------------------------
      // handle property signatures
      // ---------------------------------------------
      out.properties = {}
      out.required = []
      for (const ps of ast.propertySignatures) {
        const name = ps.name
        if (Predicate.isSymbol(name)) {
          if (ignoreErrors) return {}
          throw new Error(`cannot generate JSON Schema for ${ast._tag} at ${formatPath([...path, name]) || "root"}`)
        } else {
          out.properties[name] = {
            ...go(ps.type, [...path, name], options),
            ...getJsonSchemaAnnotations(ps.type, target, ps.type.context?.annotations)
          }
          if (!isLooseOptional(ps.type)) {
            out.required.push(String(name))
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
        const type = go(is.type, path, options)
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
      const members = compactLiterals(
        ast.types
          .filter((ast) => !AST.isUndefined(ast)) // prune undefined
          .map((ast) => {
            const out = go(ast, path, options)
            if (path.length > 0) {
              return { ...out, ...getJsonSchemaAnnotations(ast, target, ast.context?.annotations) }
            }
            return out
          })
      )
      switch (members.length) {
        case 0:
          return { not: {}, ...getChecksJsonFragment(ast, target) }
        case 1:
          return { ...members[0], ...getChecksJsonFragment(ast, target) }
        default:
          switch (ast.mode) {
            case "anyOf":
              return { "anyOf": members, ...getChecksJsonFragment(ast, target) }
            case "oneOf":
              return { "oneOf": members, ...getChecksJsonFragment(ast, target) }
          }
      }
    }
    case "Suspend": {
      const id = getId(ast)
      if (id !== undefined) {
        return go(ast.thunk(), path, options, true)
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
