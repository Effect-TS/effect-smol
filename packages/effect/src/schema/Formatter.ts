/**
 * @since 4.0.0
 */
import type { StandardSchemaV1 } from "@standard-schema/spec"
import * as Cause from "../Cause.js"
import { formatPath, formatUnknown } from "../internal/schema/util.js"
import * as Option from "../Option.js"
import * as Predicate from "../Predicate.js"
import type * as Annotations from "./Annotations.js"
import * as AST from "./AST.js"
import * as SchemaCheck from "./Check.js"
import type * as Issue from "./Issue.js"

/**
 * @category Model
 * @since 4.0.0
 */
export interface SchemaFormatter<Out> {
  readonly format: (issue: Issue.Issue) => Out
}

function getMessageAnnotation(
  annotations: Annotations.Annotations | undefined,
  type: "message" | "missingKeyMessage" | "unexpectedKeyMessage" = "message"
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
    | Issue.InvalidType
    | Issue.InvalidValue
    | Issue.MissingKey
    | Issue.UnexpectedKey
    | Issue.Forbidden
    | Issue.OneOf
    | Issue.Check
): string | null {
  switch (issue._tag) {
    case "InvalidType":
    case "OneOf":
      return getMessageAnnotation(issue.ast.annotations)
    case "InvalidValue":
    case "Forbidden":
      return getMessageAnnotation(issue.annotations)
    case "MissingKey":
      return getMessageAnnotation(issue.annotations, "missingKeyMessage")
    case "UnexpectedKey":
      return getMessageAnnotation(issue.ast.annotations, "unexpectedKeyMessage")
    case "Check":
      return getMessageAnnotation(issue.check.annotations)
  }
}

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
  const leafHook: LeafHook = (issue) => {
    return findMessage(issue) ?? treeLeafHook(issue)
  }
  return {
    format: (issue) => drawTree(formatTree(issue, [], leafHook))
  }
}

function formatSchemaCheck<T>(filter: SchemaCheck.Check<T>): string {
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
export function formatAST(ast: AST.AST): string {
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
  return AST.format(ast) + checks
}

/** @internal */
export const treeLeafHook: LeafHook = (issue): string => {
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
    case "UnexpectedKey":
      return "Unexpected key"
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
  issue: Issue.Issue,
  path: ReadonlyArray<PropertyKey>,
  leafHook: LeafHook
): Tree<string> {
  switch (issue._tag) {
    case "MissingKey":
    case "UnexpectedKey":
    case "InvalidType":
    case "InvalidValue":
    case "Forbidden":
    case "OneOf":
      return makeTree(leafHook(issue))
    case "Check": {
      const message = findMessage(issue)
      if (message !== null) {
        return makeTree(message)
      }
      return makeTree(formatSchemaCheck(issue.check), [formatTree(issue.issue, path, leafHook)])
    }
    case "Encoding": {
      const children = formatTree(issue.issue, path, leafHook)
      if (path.length > 0) {
        return makeTree("Encoding failure", [children])
      }
      return children
    }
    case "Pointer":
      return makeTree(formatPath(issue.path), [formatTree(issue.issue, [...path, ...issue.path], leafHook)])
    case "Composite":
      return makeTree(formatAST(issue.ast), issue.issues.map((issue) => formatTree(issue, path, leafHook)))
    case "AnyOf": {
      if (issue.issues.length === 1) {
        return formatTree(issue.issues[0], path, leafHook)
      }
      return makeTree(formatAST(issue.ast), issue.issues.map((issue) => formatTree(issue, path, leafHook)))
    }
  }
}

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export type LeafHook = (
  issue:
    | Issue.InvalidType
    | Issue.InvalidValue
    | Issue.MissingKey
    | Issue.UnexpectedKey
    | Issue.Forbidden
    | Issue.OneOf
) => string

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export type CheckHook = (issue: Issue.Check) => string | undefined

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export function getStandardSchemaV1(options: {
  readonly leafHook: LeafHook
  readonly checkHook: CheckHook
}): SchemaFormatter<StandardSchemaV1.FailureResult> {
  const leafHook: LeafHook = (issue) => {
    return findMessage(issue) ?? options.leafHook(issue)
  }
  const checkHook: CheckHook = (issue) => {
    return findMessage(issue) ?? options.checkHook(issue)
  }
  return {
    format: (issue) => ({
      issues: formatStandardV1(issue, [], leafHook, checkHook)
    })
  }
}

function formatStandardV1(
  issue: Issue.Issue,
  path: ReadonlyArray<PropertyKey>,
  leafHook: LeafHook,
  checkHook: CheckHook
): Array<StandardSchemaV1.Issue> {
  switch (issue._tag) {
    case "InvalidType":
    case "InvalidValue":
    case "MissingKey":
    case "UnexpectedKey":
    case "Forbidden":
    case "OneOf":
      return [{ path, message: leafHook(issue) }]
    case "Check": {
      const checkMessage = checkHook(issue)
      if (checkMessage !== undefined) {
        return [{ path, message: checkMessage }]
      }
      return formatStandardV1(issue.issue, path, leafHook, checkHook)
    }
    case "Encoding":
      return formatStandardV1(issue.issue, path, leafHook, checkHook)
    case "Pointer":
      return formatStandardV1(issue.issue, [...path, ...issue.path], leafHook, checkHook)
    case "Composite":
    case "AnyOf":
      return issue.issues.flatMap((issue) => formatStandardV1(issue, path, leafHook, checkHook))
  }
}

/**
 * @category StructuredFormatter
 * @since 4.0.0
 */
export interface StructuredIssue {
  /** The type of issue that occurs at leaf nodes in the schema. */
  readonly _tag: "InvalidType" | "InvalidValue" | "MissingKey" | "UnexpectedKey" | "Forbidden" | "OneOf"
  /** The annotations of the issue, if any. */
  readonly annotations: Annotations.Annotations | undefined
  /** The actual value that caused the issue. */
  readonly actual: Option.Option<unknown>
  /** The path to the issue. */
  readonly path: ReadonlyArray<PropertyKey>
  /** The check that caused the issue, if any. */
  readonly check?: {
    /** The annotations of the check, if any. */
    readonly annotations: Annotations.Filter | undefined
    /** Whether the check was aborted. */
    readonly abort: boolean
  }
}

/**
 * @category StructuredFormatter
 * @since 4.0.0
 */
export function getStructured(): SchemaFormatter<Array<StructuredIssue>> {
  return {
    format: (issue) => formatStructured(issue, [])
  }
}

function formatStructured(
  issue: Issue.Issue,
  path: ReadonlyArray<PropertyKey>
): Array<StructuredIssue> {
  switch (issue._tag) {
    case "InvalidType":
      return [
        {
          _tag: issue._tag,
          annotations: issue.ast.annotations,
          actual: issue.actual,
          path
        }
      ]
    case "UnexpectedKey":
    case "OneOf":
      return [
        {
          _tag: issue._tag,
          annotations: issue.ast.annotations,
          actual: Option.some(issue.actual),
          path
        }
      ]
    case "InvalidValue":
    case "Forbidden":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: issue.actual,
          path
        }
      ]
    case "MissingKey":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: Option.none(),
          path
        }
      ]
    case "Check":
      return formatStructured(issue.issue, path).map((structured) => {
        return {
          check: {
            annotations: issue.check.annotations,
            abort: issue.check.abort
          },
          ...structured
        }
      })
    case "Encoding":
      return formatStructured(issue.issue, path)
    case "Pointer":
      return formatStructured(issue.issue, [...path, ...issue.path])
    case "Composite":
    case "AnyOf":
      return issue.issues.flatMap((issue) => formatStructured(issue, path))
  }
}
