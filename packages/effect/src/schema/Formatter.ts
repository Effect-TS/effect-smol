/**
 * @since 4.0.0
 */
import type { StandardSchemaV1 } from "@standard-schema/spec"
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import { formatPath, formatUnknown } from "../internal/schema/util.ts"
import type * as Annotations from "./Annotations.ts"
import * as AST from "./AST.ts"
import * as Check from "./Check.ts"
import type * as Issue from "./Issue.ts"

/**
 * @category Model
 * @since 4.0.0
 */
export interface Formatter<Out> {
  readonly format: (issue: Issue.Issue) => Out
}

/**
 * @category Model
 * @since 4.0.0
 */
export type LeafHook = (issue: Issue.Leaf) => string

function formatCheck<T>(filter: Check.Check<T>, verbose: boolean = false): string {
  if (verbose) {
    const description = filter.annotations?.description
    if (Predicate.isString(description)) return description
  }
  const title = filter.annotations?.title
  if (Predicate.isString(title)) return title
  const brand = Check.getBrand(filter)
  if (brand !== undefined) return `Brand<"${String(brand)}">`
  switch (filter._tag) {
    case "Filter":
      return "<filter>"
    case "FilterGroup":
      return filter.checks.map((check) => formatCheck(check, verbose)).join(" & ")
  }
}

// -----------------------------------------------------------------------------
// StandardSchemaV1
// -----------------------------------------------------------------------------

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export function makeStandardSchemaV1(options?: {
  readonly leafHook?: LeafHook | undefined
}): Formatter<StandardSchemaV1.FailureResult> {
  return {
    format: (issue) => ({
      issues: toDefaultIssues(issue, [], options?.leafHook ?? defaultLeafHook)
    })
  }
}

type DefaultIssue = {
  readonly message: string
  readonly path: ReadonlyArray<PropertyKey>
}

function toDefaultIssues(
  issue: Issue.Issue,
  path: ReadonlyArray<PropertyKey>,
  leafHook: LeafHook
): Array<DefaultIssue> {
  switch (issue._tag) {
    case "Filter": {
      const message = findMessage(issue.issue) ?? findMessage(issue)
      if (message !== undefined) {
        return [{ path, message }]
      }
      switch (issue.issue._tag) {
        case "InvalidValue":
          return [{
            path,
            message: `Expected ${formatCheck(issue.filter, true)}, got ${formatUnknown(issue.actual)}`
          }]
        default:
          return toDefaultIssues(issue.issue, path, leafHook)
      }
    }
    case "Encoding":
      return toDefaultIssues(issue.issue, path, leafHook)
    case "Pointer":
      return toDefaultIssues(issue.issue, [...path, ...issue.path], leafHook)
    case "Composite":
    case "AnyOf": {
      if (issue.issues.length === 0) {
        return [{
          path,
          message: getMessageAnnotation(issue.ast.annotations) ??
            `Expected ${getExpected(issue.ast)}, got ${formatUnknownOption(issue.actual)}`
        }]
      }
      return issue.issues.flatMap((issue) => toDefaultIssues(issue, path, leafHook))
    }
    default:
      return [{ path, message: leafHook(issue) }]
  }
}

function getExpected(ast: AST.AST): string {
  switch (ast._tag) {
    case "Declaration": {
      const id = ast.annotations?.id
      if (Predicate.isString(id)) return id
      const title = ast.annotations?.title
      if (Predicate.isString(title)) {
        const tps = ast.typeParameters.map(getExpected)
        return `${title}${tps.length > 0 ? `<${tps.join(", ")}>` : ""}`
      }
      return "<Declaration>"
    }
    case "AnyKeyword":
      return "any"
    case "UnknownKeyword":
      return "unknown"
    case "NeverKeyword":
      return "never"
    case "NullKeyword":
      return "null"
    case "UndefinedKeyword":
      return "undefined"
    case "VoidKeyword":
      return "void"
    case "StringKeyword":
      return "string"
    case "TemplateLiteral":
      return AST.formatTemplateLiteral(ast)
    case "NumberKeyword":
      return "number"
    case "BooleanKeyword":
      return "boolean"
    case "SymbolKeyword":
      return "symbol"
    case "UniqueSymbol":
      return String(ast.symbol)
    case "BigIntKeyword":
      return "bigint"
    case "TupleType":
      return "array"
    case "ObjectKeyword":
      return "object | array | function"
    case "TypeLiteral":
      return ast.propertySignatures.length || ast.indexSignatures.length
        ? "object"
        : "object | array"
    case "Enums":
      return AST.formatEnums(ast)
    case "LiteralType":
      return AST.formatLiteralType(ast)
    case "UnionType": {
      if (ast.types.length === 0) return "never"
      return Array.from(new Set(ast.types.map((ast) => getExpected(ast)))).join(" | ")
    }
    case "Suspend":
      return getExpected(ast.thunk())
  }
}

/**
 * @since 4.0.0
 */
export const defaultLeafHook: LeafHook = (issue): string => {
  const message = findMessage(issue)
  if (message !== undefined) return message
  switch (issue._tag) {
    case "InvalidType":
      return `Expected ${getExpected(issue.ast)}, got ${formatUnknownOption(issue.actual)}`
    case "InvalidValue":
      return `Invalid data ${formatUnknownOption(issue.actual)}`
    case "MissingKey":
      return "Missing key"
    case "UnexpectedKey":
      return "Unexpected key"
    case "Forbidden":
      return "Forbidden operation"
    case "OneOf":
      return `Expected exactly one member to match the input ${formatUnknown(issue.actual)}`
  }
}

function formatDefaultIssue(issue: DefaultIssue): string {
  let out = issue.message
  if (issue.path && issue.path.length > 0) {
    const path = formatPath(issue.path as ReadonlyArray<PropertyKey>)
    out += `\n  at ${path}`
  }
  return out
}

/**
 * The default formatter used across the Effect ecosystem to keep the bundle
 * size small.
 *
 * @since 4.0.0
 */
export function makeDefault(): Formatter<string> {
  return {
    format: (issue) =>
      toDefaultIssues(issue, [], defaultLeafHook)
        .map(formatDefaultIssue)
        .join("\n")
  }
}

function findMessage(issue: Issue.Issue): string | undefined {
  switch (issue._tag) {
    case "InvalidType":
    case "OneOf":
    case "Composite":
    case "AnyOf":
      return getMessageAnnotation(issue.ast.annotations)
    case "InvalidValue":
    case "Forbidden":
      return getMessageAnnotation(issue.annotations)
    case "MissingKey":
      return getMessageAnnotation(issue.annotations, "missingKeyMessage")
    case "UnexpectedKey":
      return getMessageAnnotation(issue.ast.annotations, "unexpectedKeyMessage")
    case "Filter":
      return getMessageAnnotation(issue.filter.annotations)
    case "Encoding":
      return findMessage(issue.issue)
  }
}

function getMessageAnnotation(
  annotations: Annotations.Annotations | undefined,
  type: "message" | "missingKeyMessage" | "unexpectedKeyMessage" = "message"
): string | undefined {
  const message = annotations?.[type]
  if (Predicate.isString(message)) return message
  if (Predicate.isFunction(message)) return message()
}

function formatUnknownOption(actual: Option.Option<unknown>): string {
  if (Option.isNone(actual)) return "no value provided"
  return formatUnknown(actual.value)
}
