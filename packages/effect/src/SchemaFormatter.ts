/**
 * @since 4.0.0
 */

import type { StandardSchemaV1 } from "@standard-schema/spec"
import * as Cause from "./Cause.js"
import { formatPath, formatUnknown } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import * as SchemaAnnotations from "./SchemaAnnotations.js"
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
export type MessageFormatter = (
  ctx: {
    issue:
      | SchemaIssue.InvalidType
      | SchemaIssue.InvalidValue
      | SchemaIssue.MissingKey
      | SchemaIssue.Forbidden
      | SchemaIssue.OneOf
    path: ReadonlyArray<PropertyKey>
  }
) => string

function formatMessage(
  issue: SchemaIssue.Forbidden | SchemaIssue.InvalidValue | SchemaIssue.InvalidType,
  annotations: SchemaAnnotations.Annotations | undefined
): string | undefined {
  const message = SchemaAnnotations.get(annotations, "message")
  if (message !== undefined) {
    if (Predicate.isString(message)) {
      return message
    }
    return message(issue)
  }
}

/**
 * @category MessageFormatter
 * @since 4.0.0
 */
export const defaultMessageFormatter: MessageFormatter = (ctx) => {
  const { issue } = ctx
  switch (issue._tag) {
    case "InvalidType": {
      const message = formatMessage(issue, issue.ast.annotations)
      if (message !== undefined) {
        return message
      }
      return `Expected ${SchemaAST.format(issue.ast)}, actual ${formatUnknownOption(issue.input)}`
    }
    case "InvalidValue": {
      const message = formatMessage(issue, issue.annotations)
      if (message !== undefined) {
        return message
      }
      const actual = formatUnknownOption(issue.input)
      const expected = SchemaAnnotations.get(issue.annotations, "description") ??
        SchemaAnnotations.get(issue.annotations, "title")
      if (expected) {
        return `Expected ${expected}, actual ${actual}`
      }
      return `Invalid data ${actual}`
    }
    case "MissingKey": {
      const missingMessage = SchemaAnnotations.get(issue.annotations, "missingMessage")
      if (missingMessage !== undefined) {
        if (Predicate.isString(missingMessage)) {
          return missingMessage
        }
        return missingMessage({ path: ctx.path })
      }
      return "Missing key"
    }
    case "Forbidden": {
      const message = formatMessage(issue, issue.annotations)
      if (message !== undefined) {
        return message
      }
      const cause = issue.annotations?.cause
      if (Cause.isCause(cause)) {
        return formatCause(cause)
      }
      return "Forbidden operation"
    }
    case "OneOf":
      return `Expected exactly one successful result for ${SchemaAST.format(issue.ast)}, actual ${
        formatUnknown(issue.input)
      }`
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

function formatTree(
  issue: SchemaIssue.Issue,
  path: ReadonlyArray<PropertyKey>,
  formatMessage: MessageFormatter
): Tree<string> {
  switch (issue._tag) {
    case "Composite":
      return makeTree(SchemaAST.format(issue.ast), issue.issues.map((issue) => formatTree(issue, path, formatMessage)))
    case "Pointer":
      return makeTree(formatPointerPath(issue), [formatTree(issue.issue, [...path, ...issue.path], formatMessage)])
    case "Check":
      return makeTree(SchemaAST.formatCheck(issue.check), [formatTree(issue.issue, path, formatMessage)])
    case "MissingKey":
    case "InvalidType":
    case "InvalidValue":
    case "Forbidden":
    case "OneOf":
      return makeTree(formatMessage({ issue, path }))
  }
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
      issues: formatStructured(issue, [], messageFormatter).map((si) => ({
        path: si.path,
        message: si.message
      }))
    })
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
          actual: issue.input,
          path,
          message: formatMessage({ issue, path })
        }
      ]
    case "InvalidValue":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: issue.input,
          path,
          message: formatMessage({ issue, path })
        }
      ]
    case "MissingKey":
      return [
        {
          _tag: issue._tag,
          annotations: undefined,
          actual: Option.none(),
          path,
          message: formatMessage({ issue, path })
        }
      ]
    case "Forbidden":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: issue.input,
          path,
          message: formatMessage({ issue, path })
        }
      ]
    case "OneOf":
      return [
        {
          _tag: issue._tag,
          annotations: issue.ast.annotations,
          actual: Option.some(issue.input),
          path,
          message: formatMessage({ issue, path })
        }
      ]
    case "Check":
      return formatStructured(issue.issue, path, formatMessage).map((structured) => ({
        ...structured,
        abort: issue.abort
      }))
    case "Pointer":
      return formatStructured(issue.issue, [...path, ...issue.path], formatMessage)
    case "Composite":
      return issue.issues.flatMap((issue) => formatStructured(issue, path, formatMessage))
  }
}
