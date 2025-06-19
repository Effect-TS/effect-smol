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
import type * as SchemaIssue from "./SchemaIssue.js"

/**
 * @category Model
 * @since 4.0.0
 */
export interface SchemaFormatter<Out> {
  readonly format: (issue: SchemaIssue.Issue) => Out
}

/**
 * @category Model
 * @since 4.0.0
 */
export type MessageFormatter = (issue: SchemaIssue.Issue) => string

function getMessageAnnotation(
  annotations: SchemaAnnotations.Annotations | undefined,
  type: "message" | "missingMessage"
): string | undefined {
  const message = annotations?.[type]
  if (message !== undefined) {
    if (Predicate.isString(message)) {
      return message
    }
    if (Predicate.isFunction(message)) {
      return message()
    }
  }
}

/**
 * Tries to find a message in the annotations of the issue.
 * If no message is found, it returns `undefined`.
 */
function findMessage(issue: SchemaIssue.Issue): string | undefined {
  switch (issue._tag) {
    case "InvalidType":
    case "OneOf":
    case "Composite":
      return getMessageAnnotation(issue.ast.annotations, "message")
    case "InvalidValue":
    case "Forbidden":
      return getMessageAnnotation(issue.annotations, "message")
    case "MissingKey":
      return getMessageAnnotation(issue.annotations, "missingMessage")
    case "Check":
      return getMessageAnnotation(issue.check.annotations, "message")
    case "Pointer":
      return findMessage(issue.issue)
  }
}

/**
 * Returns an error message for the issue.
 * If no message is found, it returns a default message.
 *
 * @category MessageFormatter
 * @since 4.0.0
 */
export const defaultMessageFormatter: MessageFormatter = (issue: SchemaIssue.Issue): string => {
  const message = findMessage(issue)
  if (message !== undefined) {
    return message
  }
  switch (issue._tag) {
    case "InvalidType":
      return `Expected ${SchemaAST.format(issue.ast)}, actual ${formatUnknownOption(issue.actual)}`
    case "InvalidValue": {
      const actual = formatUnknownOption(issue.actual)
      const expected = issue.annotations?.description ?? issue.annotations?.title
      if (expected !== undefined) {
        return `Expected ${expected}, actual ${actual}`
      }
      return `Invalid data ${actual}`
    }
    case "MissingKey":
      return "Missing key"
    case "Forbidden": {
      const cause = issue.annotations?.cause
      if (Cause.isCause(cause)) {
        return formatCause(cause)
      }
      return "Forbidden operation"
    }
    case "OneOf":
      return `Expected exactly one successful schema for ${formatUnknown(issue.actual)} in ${
        SchemaAST.format(issue.ast)
      }`
    case "Check":
    case "Pointer":
      return defaultMessageFormatter(issue.issue)
    case "Composite":
    case "AnyOf":
      return issue.issues.map(defaultMessageFormatter).join("\n")
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

function formatPointerPath(issue: SchemaIssue.Pointer): string {
  const path = formatPath(issue.path)
  const hint = issue.annotations?.description ?? issue.annotations?.title
  if (hint) {
    return `${path} (${hint})`
  }
  return path
}

/**
 * @category Tree
 * @since 4.0.0
 */
export function getTree(options?: {
  readonly messageFormatter?: MessageFormatter | undefined
}): SchemaFormatter<string> {
  const messageFormatter = options?.messageFormatter ?? defaultMessageFormatter
  return {
    format: (issue) => drawTree(formatTree(issue, [], messageFormatter))
  }
}

function formatTree(
  issue: SchemaIssue.Issue,
  path: ReadonlyArray<PropertyKey>,
  formatMessage: MessageFormatter
): Tree<string> {
  switch (issue._tag) {
    case "Check": {
      const message = findMessage(issue)
      if (message !== undefined) {
        return makeTree(message, [])
      }
      return makeTree(SchemaAST.formatCheck(issue.check), [formatTree(issue.issue, path, formatMessage)])
    }
    case "Pointer":
      return makeTree(formatPointerPath(issue), [formatTree(issue.issue, [...path, ...issue.path], formatMessage)])
    case "Composite":
    case "AnyOf":
      return makeTree(SchemaAST.format(issue.ast), issue.issues.map((issue) => formatTree(issue, path, formatMessage)))
    case "MissingKey":
    case "InvalidType":
    case "InvalidValue":
    case "Forbidden":
      return makeTree(formatMessage(issue))
    case "OneOf":
      return makeTree(SchemaAST.format(issue.ast), [
        makeTree(`Expected exactly one successful schema for ${formatUnknown(issue.actual)}`),
        makeTree(
          "The following schemas were successful:",
          issue.successes.map((ast) => makeTree(SchemaAST.format(ast), []))
        )
      ])
  }
}

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export function getStandardSchemaV1(options?: {
  readonly messageFormatter?: MessageFormatter | undefined
}): SchemaFormatter<StandardSchemaV1.FailureResult> {
  const messageFormatter = options?.messageFormatter ?? defaultMessageFormatter
  return {
    format: (issue) => ({
      issues: formatStandardV1(issue, [], messageFormatter).map((si) => ({
        path: si.path,
        message: si.message
      }))
    })
  }
}

function formatStandardV1(
  issue: SchemaIssue.Issue,
  path: ReadonlyArray<PropertyKey>,
  formatMessage: MessageFormatter
): Array<StandardSchemaV1.Issue> {
  switch (issue._tag) {
    case "InvalidType":
    case "InvalidValue":
    case "MissingKey":
    case "Forbidden":
    case "OneOf":
      return [{ path, message: formatMessage(issue) }]
    case "Check": {
      const message = findMessage(issue)
      if (message !== undefined) {
        return [{ path, message }]
      }
      const actual = formatUnknown(issue.actual)
      const annotations = issue.check.annotations
      const expected = annotations?.description ?? annotations?.title
      if (expected !== undefined) {
        return [{ path, message: `Expected ${expected}, actual ${actual}` }]
      }
      return formatStandardV1(issue.issue, path, formatMessage)
    }
    case "Pointer":
      return formatStandardV1(issue.issue, [...path, ...issue.path], formatMessage)
    case "Composite":
    case "AnyOf":
      return issue.issues.flatMap((issue) => formatStandardV1(issue, path, formatMessage))
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
  readonly check?: SchemaAnnotations.Filter | undefined
  readonly abort?: boolean
}

/**
 * @category StructuredFormatter
 * @since 4.0.0
 */
export function getStructured(options?: {
  readonly messageFormatter?: MessageFormatter | undefined
}): SchemaFormatter<Array<StructuredIssue>> {
  const messageFormatter = options?.messageFormatter ?? defaultMessageFormatter
  return {
    format: (issue) => formatStructured(issue, [], messageFormatter)
  }
}

function formatStructured(
  issue: SchemaIssue.Issue,
  path: ReadonlyArray<PropertyKey>,
  formatMessage: MessageFormatter
): Array<StructuredIssue> {
  switch (issue._tag) {
    case "InvalidType":
      return [
        {
          _tag: issue._tag,
          annotations: issue.ast.annotations,
          actual: issue.actual,
          path,
          message: formatMessage(issue)
        }
      ]
    case "InvalidValue":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: issue.actual,
          path,
          message: formatMessage(issue)
        }
      ]
    case "MissingKey":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: Option.none(),
          path,
          message: formatMessage(issue)
        }
      ]
    case "Forbidden":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: issue.actual,
          path,
          message: formatMessage(issue)
        }
      ]
    case "OneOf":
      return [
        {
          _tag: issue._tag,
          annotations: issue.ast.annotations,
          actual: Option.some(issue.actual),
          path,
          message: formatMessage(issue)
        }
      ]
    case "Check":
      return formatStructured(issue.issue, path, formatMessage).map((structured) => {
        return {
          ...structured,
          annotations: structured.annotations,
          check: issue.check.annotations,
          abort: issue.abort
        }
      })
    case "Pointer":
      return formatStructured(issue.issue, [...path, ...issue.path], formatMessage)
    case "Composite":
    case "AnyOf":
      return issue.issues.flatMap((issue) => formatStructured(issue, path, formatMessage))
  }
}
