/**
 * @since 4.0.0
 */

import type { StandardSchemaV1 } from "@standard-schema/spec"
import * as Cause from "./Cause.js"
import { formatPath, formatUnknown } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaCheck from "./SchemaCheck.js"
import type * as SchemaIssue from "./SchemaIssue.js"

/**
 * @category Model
 * @since 4.0.0
 */
export interface SchemaFormatter<Out> {
  readonly format: (issue: SchemaIssue.Issue) => Out
}

function getMessageAnnotation(
  annotations: SchemaAnnotations.Annotations | undefined,
  type: "message" | "missingMessage" = "message"
): string | null {
  const message = annotations?.[type]
  if (Predicate.isString(message)) {
    return message
  }
  if (Predicate.isFunction(message)) {
    return message()
  }
  return null
}

/**
 * Tries to find a message in the annotations of the issue.
 * If no message is found, it returns `null`.
 */
function findMessage(
  issue:
    | SchemaIssue.InvalidType
    | SchemaIssue.InvalidValue
    | SchemaIssue.MissingKey
    | SchemaIssue.Forbidden
    | SchemaIssue.OneOf
): string | null {
  switch (issue._tag) {
    case "InvalidType":
    case "OneOf":
      return getMessageAnnotation(issue.ast.annotations)
    case "InvalidValue":
    case "Forbidden":
      return getMessageAnnotation(issue.annotations)
    case "MissingKey":
      return getMessageAnnotation(issue.annotations, "missingMessage")
  }
}

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export type LeafMessageFormatter = (
  issue:
    | SchemaIssue.InvalidType
    | SchemaIssue.InvalidValue
    | SchemaIssue.MissingKey
    | SchemaIssue.Forbidden
    | SchemaIssue.OneOf
) => string

interface Forest<A> extends ReadonlyArray<Tree<A>> {}

interface Tree<A> {
  readonly value: A
  readonly forest: Forest<A>
}

const makeTree = <A>(value: A, forest: Forest<A> = []): Tree<A> => ({
  value,
  forest
})

const drawTree = (tree: Tree<string>): string => tree.value + draw("\n", tree.forest)

const draw = (indentation: string, forest: Forest<string>): string => {
  let r = ""
  const len = forest.length
  let tree: Tree<string>
  for (let i = 0; i < len; i++) {
    tree = forest[i]
    const isLast = i === len - 1
    r += indentation + (isLast ? "└" : "├") + "─ " + tree.value
    r += draw(indentation + (len > 1 && !isLast ? "│  " : "   "), tree.forest)
  }
  return r
}

function formatUnknownOption(actual: Option.Option<unknown>): string {
  if (Option.isNone(actual)) {
    return "no value provided"
  }
  return formatUnknown(actual.value)
}

/** @internal */
export function formatCause(cause: Cause.Cause<unknown>): string {
  // TODO: use Cause.pretty when it's available
  return cause.failures.map((failure) => {
    switch (failure._tag) {
      case "Die": {
        const defect = failure.defect
        return defect instanceof Error ? defect.message : String(defect)
      }
      case "Interrupt":
        return failure._tag
      case "Fail": {
        const error = failure.error
        return error instanceof Error ? error.message : String(error)
      }
    }
  }).join("\n")
}

/**
 * @category Tree
 * @since 4.0.0
 */
export function getTree(): SchemaFormatter<string> {
  const leafMessageFormatter: LeafMessageFormatter = (issue) => {
    return findMessage(issue) ?? getTreeDefaultMessage(issue)
  }
  return {
    format: (issue) => drawTree(formatTree(issue, [], leafMessageFormatter))
  }
}

function formatSchemaCheck<T>(filter: SchemaCheck.SchemaCheck<T>): string {
  const title = filter.annotations?.title
  if (Predicate.isString(title)) {
    return title
  }
  const brand = SchemaCheck.getBrand(filter)
  if (brand !== undefined) {
    return `Brand<"${String(brand)}">`
  }
  switch (filter._tag) {
    case "Filter":
      return "<filter>"
    case "FilterGroup":
      return filter.checks.map(formatSchemaCheck).join(" & ")
  }
}

/** @internal */
export function formatAST(ast: SchemaAST.AST): string {
  let out: string | undefined
  let checks: string = ""
  const identifier = ast.annotations?.identifier
  if (Predicate.isString(identifier)) {
    out = identifier
  }
  if (ast.checks) {
    for (const check of ast.checks) {
      const identifier = check.annotations?.identifier
      if (Predicate.isString(identifier)) {
        out = identifier
        checks = ""
      } else {
        checks += ` & ${formatSchemaCheck(check)}`
      }
    }
  }
  if (out !== undefined) {
    return out + checks
  }
  return SchemaAST.format(ast) + checks
}

/**
 * @category Tree
 * @since 4.0.0
 */
export const getTreeDefaultMessage: LeafMessageFormatter = (issue): string => {
  switch (issue._tag) {
    case "InvalidType":
      return `Expected ${formatAST(issue.ast)}, actual ${formatUnknownOption(issue.actual)}`
    case "InvalidValue": {
      const description = issue.annotations?.description
      if (Predicate.isString(description)) {
        return description
      }
      return `Invalid data ${formatUnknownOption(issue.actual)}`
    }
    case "MissingKey":
      return "Missing key"
    case "Forbidden": {
      const description = issue.annotations?.description
      if (Predicate.isString(description)) {
        return description
      }
      const cause = issue.annotations?.cause
      if (Cause.isCause(cause)) {
        return formatCause(cause)
      }
      return "Forbidden operation"
    }
    case "OneOf":
      return `Expected exactly one successful schema for ${formatUnknown(issue.actual)} in ${formatAST(issue.ast)}`
  }
}

function formatTree(
  issue: SchemaIssue.Issue,
  path: ReadonlyArray<PropertyKey>,
  leafMessageFormatter: LeafMessageFormatter
): Tree<string> {
  switch (issue._tag) {
    case "MissingKey":
    case "InvalidType":
    case "InvalidValue":
    case "Forbidden":
    case "OneOf":
      return makeTree(leafMessageFormatter(issue))
    case "Check": {
      const message = getMessageAnnotation(issue.check.annotations)
      if (message !== null) {
        return makeTree(message)
      }
      return makeTree(formatSchemaCheck(issue.check), [formatTree(issue.issue, path, leafMessageFormatter)])
    }
    case "Encoding": {
      const children = formatTree(issue.issue, path, leafMessageFormatter)
      if (path.length > 0) {
        return makeTree("Encoding failure", [children])
      }
      return children
    }
    case "Pointer":
      return makeTree(formatPath(issue.path), [formatTree(issue.issue, [...path, ...issue.path], leafMessageFormatter)])
    case "Composite":
    case "AnyOf":
      return makeTree(
        formatAST(issue.ast),
        issue.issues.map((issue) => formatTree(issue, path, leafMessageFormatter))
      )
  }
}

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export type CheckMessageFormatter = (issue: SchemaIssue.Check) => string | undefined

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export function getStandardSchemaV1(options?: {
  readonly leafMessageFormatter?: LeafMessageFormatter | undefined
  readonly checkMessageFormatter?: CheckMessageFormatter | undefined
}): SchemaFormatter<StandardSchemaV1.FailureResult> {
  const leafMessageFormatter = options?.leafMessageFormatter ?? getStandardSchemaV1SystemMessage
  const lmf: LeafMessageFormatter = (issue) => {
    return findMessage(issue) ?? leafMessageFormatter(issue)
  }
  const cmf: CheckMessageFormatter = options?.checkMessageFormatter ?? getStandardSchemaV1CheckSystemMessage
  return {
    format: (issue) => ({
      issues: formatStandardV1(issue, [], lmf, cmf)
    })
  }
}

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export const getStandardSchemaV1CheckDefaultMessage: CheckMessageFormatter = (issue): string | undefined => {
  const description = issue.check.annotations?.description
  if (Predicate.isString(description)) {
    return `Expected ${description}`
  }
}

function formatSystemMessage(parts: ReadonlyArray<string>): string {
  return `~system|${parts.join("|")}`
}

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export const getStandardSchemaV1CheckSystemMessage: CheckMessageFormatter = (issue): string | undefined => {
  const meta = issue.check.annotations?.meta
  if (Predicate.isObject(meta)) {
    const { id, ...rest } = meta
    return formatSystemMessage(["check", id, formatUnknown(rest)])
  }
}

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export const getStandardSchemaV1SystemMessage: LeafMessageFormatter = (issue): string => {
  switch (issue._tag) {
    case "InvalidType":
      return formatSystemMessage([issue._tag, issue.ast._tag])
    case "OneOf":
    case "InvalidValue":
    case "MissingKey":
    case "Forbidden":
      return formatSystemMessage([issue._tag])
  }
}

function formatStandardV1(
  issue: SchemaIssue.Issue,
  path: ReadonlyArray<PropertyKey>,
  leafMessageFormatter: LeafMessageFormatter,
  checkMessageFormatter: CheckMessageFormatter
): Array<StandardSchemaV1.Issue> {
  switch (issue._tag) {
    case "InvalidType":
    case "InvalidValue":
    case "MissingKey":
    case "Forbidden":
    case "OneOf":
      return [{ path, message: leafMessageFormatter(issue) }]
    case "Check": {
      const message = getMessageAnnotation(issue.check.annotations)
      if (message !== null) {
        return [{ path, message }]
      }
      const checkMessage = checkMessageFormatter(issue)
      if (checkMessage !== undefined) {
        return [{ path, message: checkMessage }]
      }
      return formatStandardV1(issue.issue, path, leafMessageFormatter, checkMessageFormatter)
    }
    case "Encoding":
      return formatStandardV1(issue.issue, path, leafMessageFormatter, checkMessageFormatter)
    case "Pointer":
      return formatStandardV1(issue.issue, [...path, ...issue.path], leafMessageFormatter, checkMessageFormatter)
    case "Composite":
    case "AnyOf":
      return issue.issues.flatMap((issue) => formatStandardV1(issue, path, leafMessageFormatter, checkMessageFormatter))
  }
}

/**
 * @category StructuredFormatter
 * @since 4.0.0
 */
export interface StructuredIssue {
  readonly _tag: "InvalidType" | "InvalidValue" | "MissingKey" | "Forbidden" | "OneOf"
  readonly annotations: SchemaAnnotations.Annotations | undefined
  readonly actual: Option.Option<unknown>
  readonly path: ReadonlyArray<PropertyKey>
  readonly message: string
  readonly check?: {
    readonly annotations: SchemaAnnotations.Filter | undefined
    readonly abort: boolean
  }
}

/**
 * @category StructuredFormatter
 * @since 4.0.0
 */
export function getStructured(): SchemaFormatter<Array<StructuredIssue>> {
  const leafMessageFormatter: LeafMessageFormatter = (issue) => {
    return findMessage(issue) ?? getTreeDefaultMessage(issue)
  }
  return {
    format: (issue) => formatStructured(issue, [], leafMessageFormatter)
  }
}

function formatStructured(
  issue: SchemaIssue.Issue,
  path: ReadonlyArray<PropertyKey>,
  leafMessageFormatter: LeafMessageFormatter
): Array<StructuredIssue> {
  switch (issue._tag) {
    case "InvalidType":
      return [
        {
          _tag: issue._tag,
          annotations: issue.ast.annotations,
          actual: issue.actual,
          path,
          message: leafMessageFormatter(issue)
        }
      ]
    case "InvalidValue":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: issue.actual,
          path,
          message: leafMessageFormatter(issue)
        }
      ]
    case "MissingKey":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: Option.none(),
          path,
          message: leafMessageFormatter(issue)
        }
      ]
    case "Forbidden":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: issue.actual,
          path,
          message: leafMessageFormatter(issue)
        }
      ]
    case "OneOf":
      return [
        {
          _tag: issue._tag,
          annotations: issue.ast.annotations,
          actual: Option.some(issue.actual),
          path,
          message: leafMessageFormatter(issue)
        }
      ]
    case "Check":
      return formatStructured(issue.issue, path, leafMessageFormatter).map((structured) => {
        return {
          check: {
            annotations: issue.check.annotations,
            abort: issue.check.abort
          },
          ...structured
        }
      })
    case "Encoding":
      return formatStructured(issue.issue, path, leafMessageFormatter)
    case "Pointer":
      return formatStructured(issue.issue, [...path, ...issue.path], leafMessageFormatter)
    case "Composite":
    case "AnyOf":
      return issue.issues.flatMap((issue) => formatStructured(issue, path, leafMessageFormatter))
  }
}
