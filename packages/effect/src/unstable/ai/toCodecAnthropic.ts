/**
 * @since 4.0.0
 */

import * as Arr from "../../Array.ts"
import * as Option from "../../Option.ts"
import * as Predicate from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import * as AST from "../../SchemaAST.ts"
import * as Transformation from "../../SchemaTransformation.ts"

/**
 * @category Serializer
 * @since 4.0.0
 */
export function toCodecAnthropic<T, E, RD, RE>(schema: Schema.Codec<T, E, RD, RE>): Schema.Codec<T, unknown, RD, RE> {
  const to = schema.ast
  const from = recur(AST.toEncoded(to))
  if (from === to) {
    return schema
  }
  return Schema.make(AST.decodeTo(from, to, Transformation.passthrough()))
}

function recur(ast: AST.AST): AST.AST {
  switch (ast._tag) {
    case "Declaration":
    case "Undefined":
    case "Void":
    case "Never":
    case "Unknown":
    case "Any":
    case "BigInt":
    case "Symbol":
    case "Literal":
    case "UniqueSymbol":
    case "ObjectKeyword":
    case "Enum":
    case "TemplateLiteral":
    case "Suspend":
      throw new Error(`Unsupported AST ${ast._tag}`)
    case "Null":
      return ast
    case "String": {
      const { annotations, filters } = get(ast)
      if (annotations !== undefined || filters !== undefined) {
        return new AST.String(annotations, filters)
      }
      return ast
    }
    case "Number": {
      const { annotations, filters } = get(ast)
      if (annotations !== undefined || filters !== undefined) {
        return new AST.Number(annotations, filters)
      }
      return ast
    }
    case "Boolean":
      return ast
    case "Union": {
      if (ast.mode === "oneOf") {
        return new AST.Union(ast.types, "anyOf", ast.annotations, ast.checks)
      }
      const types = AST.mapOrSame(ast.types, recur)
      const { annotations, filters } = get(ast)
      if (types !== ast.types || annotations !== undefined || filters !== undefined) {
        return new AST.Union(types, "anyOf", annotations, filters)
      }
      return ast
    }
    case "Arrays": {
      if (ast.rest.length > 1) {
        throw new Error(`Post-rest elements are not supported for arrays`)
      }
      const { annotations, filters } = get(ast)
      if (ast.elements.length > 0) {
        // since tuples are not supported, we translate them to objects with string keys
        const propertySignatures = ast.elements.map((e, i) => {
          return new AST.PropertySignature(String(i), e)
        })
        if (ast.rest.length === 1) {
          propertySignatures.push(new AST.PropertySignature("rest", new AST.Arrays(false, [], ast.rest)))
        }
        return AST.decodeTo(
          recur(new AST.Objects(propertySignatures, [], annotations, filters)),
          ast,
          Transformation.transform({
            decode: (o) => {
              let t: any = []
              for (let i = 0; i < ast.elements.length; i++) {
                const k = String(i)
                if (o[k] !== undefined) {
                  t.push(o[k])
                }
              }
              if ("rest" in o) {
                t = [...t, ...o.rest]
              }
              return t
            },
            encode: (t) => {
              const o: any = {}
              for (let i = 0; i < ast.elements.length; i++) {
                if (t.length >= i) {
                  o[String(i)] = t[i]
                }
              }
              if (ast.rest.length === 1) {
                o.rest = t.length >= ast.elements.length ? t.slice(ast.elements.length) : []
              }
              return o
            }
          })
        )
      } else {
        const rest = AST.mapOrSame(ast.rest, recur)
        if (rest !== ast.rest || annotations !== undefined || filters !== undefined) {
          return new AST.Arrays(false, [], rest, annotations, filters)
        }
        return ast
      }
    }
    case "Objects": {
      if (ast.indexSignatures.length > 0) {
        throw new Error(`Index signatures are not supported for objects`)
      }
      const propertySignatures = AST.mapOrSame(ast.propertySignatures, (ps) => {
        let type = recur(ps.type)
        if (AST.isOptional(ps.type)) {
          type = AST.decodeTo(
            new AST.Union([type, AST.null], "anyOf"),
            AST.optionalKey(type),
            Transformation.transformOptional({
              decode: Option.filter(Predicate.isNotNull),
              encode: Option.orElseSome(() => null)
            })
          )
        }
        if (type === ps.type) {
          return ps
        }
        return new AST.PropertySignature(ps.name, type)
      })
      const { annotations, filters } = get(ast)
      if (propertySignatures !== ast.propertySignatures || annotations !== undefined || filters !== undefined) {
        return new AST.Objects(propertySignatures, [], annotations, filters)
      }
      return ast
    }
  }
}

type Annotation =
  | { readonly _tag: "description"; readonly description: string }
  | { readonly _tag: "format"; readonly format: string }

type Filter =
  | Annotation
  | { readonly _tag: "filter"; readonly filter: AST.Filter<any> }

function get(ast: AST.AST): {
  annotations: Record<string, string> | undefined
  filters: [AST.Check<any>, ...AST.Check<any>[]] | undefined
} {
  const annotations: Record<string, string> = {}
  const filters: Array<AST.Filter<any>> = []
  const checks = getChecks(ast)
  if (checks.length > 0) {
    for (const check of checks) {
      switch (check._tag) {
        case "description": {
          if (annotations.description !== undefined) {
            annotations.description += ` and ${check.description}`
          } else {
            annotations.description = check.description
          }
          break
        }
        case "format": {
          annotations.format = check.format
          break
        }
        case "filter": {
          filters.push(check.filter)
          break
        }
      }
    }
  }
  return {
    annotations: Object.keys(annotations).length > 0 ? annotations : undefined,
    filters: Arr.isArrayNonEmpty(filters) ? filters : undefined
  }
}

function getChecks(ast: AST.AST): Array<Filter> {
  return [
    ...(ast.checks !== undefined ? getFilters(ast.checks) : []),
    ...getAnnotations(ast.annotations)
  ]
}

function getAnnotations(annotations: Schema.Annotations.Filter | undefined): Array<Annotation> {
  const out: Array<Annotation> = []
  if (annotations !== undefined) {
    const description = annotations?.description
      ?? (annotations.meta?._tag === "isInt" || annotations.meta?._tag === "isFinite"
        ? undefined
        : annotations?.expected)
      ?? annotations?.title
    if (typeof description === "string") {
      out.push({ _tag: "description", description })
    }
    const format = annotations?.format
    if (typeof format === "string") {
      if (formats.includes(format)) {
        out.push({ _tag: "format", format })
      } else {
        out.push({ _tag: "description", description: `a value with a format of ${format}` })
      }
    }
  }
  return out
}

function getFilter(filter: AST.Filter<any>): Array<Filter> {
  let out: Array<Filter> = getAnnotations(filter.annotations)
  const meta = filter.annotations?.meta
  if (meta !== undefined) {
    if (meta._tag === "isInt" || meta._tag === "isFinite") {
      out.push({
        _tag: "filter",
        filter: filter.annotate({
          description: undefined,
          expected: undefined,
          title: undefined,
          format: undefined
        })
      })
    } else if ("regExp" in meta && meta.regExp instanceof RegExp) {
      out.push({
        _tag: "filter",
        filter: filter.annotate({
          description: undefined,
          expected: undefined,
          title: undefined,
          format: undefined
        })
      })
    }
  }
  return out
}

function getFilters(checks: readonly [AST.Check<any>, ...AST.Check<any>[]]): Array<Filter> {
  return checks.flatMap((check) => {
    switch (check._tag) {
      case "Filter":
        return getFilter(check)
      case "FilterGroup":
        return getFilters(check.checks)
    }
  })
}

const formats = [
  "date-time",
  "time",
  "date",
  "duration",
  "email",
  "hostname",
  "uri",
  "ipv4",
  "ipv6",
  "uuid"
]
