/**
 * @since 4.0.0
 */

import * as Predicate from "../data/Predicate.ts"
import * as Effect from "../Effect.ts"
import { memoize } from "../Function.ts"
import * as Annotations from "./Annotations.ts"
import * as AST from "./AST.ts"
import * as Getter from "./Getter.ts"
import * as Schema from "./Schema.ts"
import * as Transformation from "./Transformation.ts"

/**
 * For use cases like RPC or messaging systems, the JSON format only needs to
 * support round-trip encoding and decoding. The `Serializer.json` operator
 * helps with this by taking a schema and returning a `Codec` that knows how to
 * serialize and deserialize the data using a JSON-compatible format.
 *
 * @since 4.0.0
 */
export function json<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): Schema.Codec<T, unknown, RD, RE> {
  return Schema.make(goJson(codec.ast))
}

const goJson = memoize(AST.apply((ast: AST.AST): AST.AST => {
  function go(ast: AST.AST): AST.AST {
    switch (ast._tag) {
      case "UnknownKeyword":
      case "ObjectKeyword":
      case "NeverKeyword":
        return requiredGoJsonAnnotation(ast)
      case "Declaration": {
        const getLink = ast.annotations?.defaultJsonSerializer ?? ast.annotations?.defaultIsoSerializer
        if (Predicate.isFunction(getLink)) {
          const link = getLink(ast.typeParameters.map((tp) => Schema.make(goJson(AST.encodedAST(tp)))))
          const to = goJson(link.to)
          return AST.replaceEncoding(ast, to === link.to ? [link] : [new AST.Link(to, link.transformation)])
        }
        return requiredGoJsonAnnotation(ast)
      }
      case "VoidKeyword":
      case "UndefinedKeyword":
      case "SymbolKeyword":
      case "UniqueSymbol":
      case "BigIntKeyword":
      case "LiteralType":
        return ast.goJson()
      case "TypeLiteral": {
        if (ast.propertySignatures.some((ps) => !Predicate.isString(ps.name))) {
          return forbidden(ast, "cannot serialize to JSON, TypeLiteral property names must be strings")
        }
        return ast.go(goJson)
      }
      case "TupleType":
      case "UnionType":
      case "Suspend":
        return ast.go(goJson)
    }
    return ast
  }

  const out = go(ast)
  return AST.isOptional(ast) ? AST.optionalKey(out) : out
}))

function requiredGoJsonAnnotation(ast: AST.AST): AST.AST {
  return forbidden(
    ast,
    `cannot serialize to JSON, required \`defaultJsonSerializer\` or \`defaultIsoSerializer\` annotation for ${ast._tag}`
  )
}

function forbidden<A extends AST.AST>(ast: A, message: string): A {
  const link = new AST.Link(
    AST.neverKeyword,
    new Transformation.Transformation(
      Getter.passthrough(),
      Getter.forbidden(() => message)
    )
  )
  return AST.replaceEncoding(ast, [link])
}

/**
 * @since 4.0.0
 */
export function iso<S extends Schema.Top>(schema: S): Schema.Codec<S["Type"], S["Iso"]> {
  return Schema.make(goIso(AST.typeAST(schema.ast)))
}

const goIso = memoize((ast: AST.AST): AST.AST => {
  function go(ast: AST.AST): AST.AST {
    switch (ast._tag) {
      case "Declaration": {
        const getLink = ast.annotations?.defaultIsoSerializer
        if (Predicate.isFunction(getLink)) {
          const link = getLink(ast.typeParameters.map((tp) => Schema.make(goIso(AST.encodedAST(tp)))))
          const to = goIso(link.to)
          return AST.replaceEncoding(ast, to === link.to ? [link] : [new AST.Link(to, link.transformation)])
        }
        return ast
      }
      case "TupleType":
      case "TypeLiteral":
      case "UnionType":
      case "Suspend":
        return ast.go(goIso)
    }
    return ast
  }
  const out = go(ast)
  return AST.isOptional(ast) ? AST.optionalKey(out) : out
})

/**
 * @since 4.0.0
 */
export type StringPojo = string | undefined | { [x: string]: StringPojo } | Array<StringPojo>

/**
 * @since 4.0.0
 */
export function stringPojo<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): Schema.Codec<T, StringPojo, RD, RE> {
  return Schema.make(goStringPojo(codec.ast))
}

/** @internal */
export const goStringPojo = memoize(AST.apply((ast: AST.AST): AST.AST => {
  function go(ast: AST.AST): AST.AST {
    switch (ast._tag) {
      case "UnknownKeyword":
      case "ObjectKeyword":
      case "NeverKeyword":
        return requiredGoStringPojoAnnotation(ast)
      case "Declaration": {
        const getLink = ast.annotations?.defaultIsoSerializer ?? ast.annotations?.defaultJsonSerializer
        if (Predicate.isFunction(getLink)) {
          const link = getLink(ast.typeParameters.map((tp) => Schema.make(goIso(AST.encodedAST(tp)))))
          const to = goStringPojo(link.to)
          return AST.replaceEncoding(ast, to === link.to ? [link] : [new AST.Link(to, link.transformation)])
        }
        return requiredGoStringPojoAnnotation(ast)
      }
      case "NullKeyword":
        return AST.replaceEncoding(ast, [nullLink])
      case "BooleanKeyword":
        return AST.replaceEncoding(ast, [booleanLink])
      case "Enums":
      case "NumberKeyword":
      case "LiteralType":
        return ast.goStringPojo()
      case "BigIntKeyword":
      case "SymbolKeyword":
      case "UniqueSymbol":
        return ast.goJson()
      case "TypeLiteral": {
        if (ast.propertySignatures.some((ps) => !Predicate.isString(ps.name))) {
          return forbidden(ast, "cannot serialize to StringPojo, TypeLiteral property names must be strings")
        }
        return ast.go(goStringPojo)
      }
      case "TupleType":
      case "UnionType":
      case "Suspend":
        return ast.go(goStringPojo)
    }
    return ast
  }
  const out = go(ast)
  return AST.isOptional(ast) ? AST.optionalKey(out) : out
}))

const nullLink = new AST.Link(
  AST.undefinedKeyword,
  new Transformation.Transformation(
    Getter.transform(() => null),
    Getter.transform(() => undefined)
  )
)

const booleanLink = new AST.Link(
  new AST.UnionType([new AST.LiteralType("true"), new AST.LiteralType("false")], "anyOf"),
  new Transformation.Transformation(
    Getter.transform((s) => s === "true"),
    Getter.String()
  )
)

function requiredGoStringPojoAnnotation(ast: AST.AST): AST.AST {
  return forbidden(
    ast,
    `cannot serialize to StringPojo, required \`defaultIsoSerializer\` or \`defaultJsonSerializer\` annotation for ${ast._tag}`
  )
}

/**
 * @since 4.0.0
 */
export function ensureArray<T, RD, RE>(
  codec: Schema.Codec<T, StringPojo, RD, RE>
): Schema.Codec<T, StringPojo, RD, RE> {
  return Schema.make(goEnsureArray(codec.ast))
}

const ENSURE_ARRAY_ANNOTATION_KEY = "~effect/schema/Serializer/ensureArray"

/** @internal */
export const goEnsureArray = memoize(AST.apply((ast: AST.AST): AST.AST => {
  if (AST.isUnionType(ast) && ast.annotations?.[ENSURE_ARRAY_ANNOTATION_KEY]) {
    return ast
  }
  const out: AST.AST = (ast as any).go?.(goEnsureArray) ?? ast
  if (AST.isTupleType(out)) {
    const ensure = new AST.UnionType(
      [
        out,
        AST.decodeTo(
          AST.stringKeyword,
          out,
          new Transformation.Transformation(
            Getter.split(),
            Getter.passthrough()
          )
        )
      ],
      "anyOf",
      { [ENSURE_ARRAY_ANNOTATION_KEY]: true }
    )
    return out.context?.isOptional ? AST.optionalKey(ensure) : ensure
  }
  return out
}))

type XmlEncoderOptions = {
  /** Root element name for the returned XML string. Default: "root" */
  readonly rootName?: string | undefined
  /** When an array doesn't have a natural item name, use this. Default: "item" */
  readonly arrayItemName?: string | undefined
  /** Pretty-print output. Default: true */
  readonly pretty?: boolean | undefined
  /** Indentation used when pretty-printing. Default: "  " (two spaces) */
  readonly indent?: string | undefined
  /** Sort object keys for stable output. Default: true */
  readonly sortKeys?: boolean | undefined
}

/**
 * @since 4.0.0
 */
export function xmlEncoder<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>,
  options?: XmlEncoderOptions
) {
  const rootName = Annotations.getIdentifier(codec.ast) ?? Annotations.getTitle(codec.ast)
  const serialize = Schema.encodeEffect(stringPojo(codec))
  return (t: T) => serialize(t).pipe(Effect.map((pojo) => stringPojoToXml(pojo, { rootName, ...options })))
}

/**
 * Convert a StringPojo to XML text.
 */
function stringPojoToXml(value: StringPojo, options: XmlEncoderOptions): string {
  const opts: { [P in keyof XmlEncoderOptions]-?: Exclude<XmlEncoderOptions[P], undefined> } = {
    rootName: options.rootName ?? "root",
    arrayItemName: options.arrayItemName ?? "item",
    pretty: options.pretty ?? true,
    indent: options.indent ?? "  ",
    sortKeys: options.sortKeys ?? true
  }

  const seen = new Set<{ [x: string]: StringPojo } | Array<StringPojo>>()
  const lines: Array<string> = []
  const push = (depth: number, text: string) => lines.push(opts.pretty ? opts.indent.repeat(depth) + text : text)

  const tagInfo = (name: string, original?: string) => {
    const { changed, safe } = parseTagName(name)
    const needsMeta = changed || (original && original !== name)
    const attrs = needsMeta ? ` data-name="${escapeAttribute(original ?? name)}"` : ""
    return { safe, attrs }
  }

  const render = (tagName: string, node: StringPojo, depth: number, originalNameForMeta?: string): void => {
    if (node === undefined) {
      const { attrs, safe } = tagInfo(tagName, originalNameForMeta)
      push(depth, `<${safe}${attrs}/>`)
      return
    }

    if (typeof node === "string") {
      const { attrs, safe } = tagInfo(tagName, originalNameForMeta)
      push(depth, `<${safe}${attrs}>${escapeText(node)}</${safe}>`)
      return
    }

    if (seen.has(node)) throw new Error("Cycle detected while serializing to XML.")
    seen.add(node)
    try {
      if (Array.isArray(node)) {
        const { attrs, safe: safeParent } = tagInfo(tagName, originalNameForMeta)
        if (node.length === 0) {
          push(depth, `<${safeParent}${attrs}/>`)
        } else {
          push(depth, `<${safeParent}${attrs}>`)
          for (const item of node) render(opts.arrayItemName, item, depth + 1)
          push(depth, `</${safeParent}>`)
        }
      } else {
        const { attrs, safe } = tagInfo(tagName, originalNameForMeta)
        const keys = Object.keys(node)
        if (opts.sortKeys) keys.sort()
        if (keys.length === 0) {
          push(depth, `<${safe}${attrs}/>`)
          return
        }
        push(depth, `<${safe}${attrs}>`)
        for (const k of keys) {
          const { safe: childSafe } = parseTagName(k)
          render(childSafe, node[k], depth + 1, k)
        }
        push(depth, `</${safe}>`)
      }
    } finally {
      seen.delete(node)
    }
  }

  render(opts.rootName, value, 0)
  return opts.pretty ? lines.join("\n") : lines.join("")
}

const escapeText = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const escapeAttribute = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const parseTagName = (name: string): { safe: string; changed: boolean } => {
  const original = name
  let safe = name
  if (!/^[A-Za-z_]/.test(safe)) safe = "_" + safe
  safe = safe.replace(/[^A-Za-z0-9._-]/g, "_")
  if (/^xml/i.test(safe)) safe = "_" + safe
  return { safe, changed: safe !== original }
}
