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
 * @category Formatting
 * @since 4.0.0
 */
export interface SchemaFormatter<Out> {
  readonly format: (issue: SchemaIssue.Issue) => Out
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

function formatInvalidData(issue: SchemaIssue.InvalidData, annotations?: SchemaAnnotations.Annotations): string {
  const message = issue.annotations?.message
  if (Predicate.isString(message)) {
    return message
  }
  const expected = issue.annotations?.title ?? issue.annotations?.description ?? annotations?.title ??
    annotations?.description
  if (expected) {
    return `Expected ${expected}, actual ${formatUnknownOption(issue.actual)}`
  }
  return `Invalid data ${formatUnknownOption(issue.actual)}`
}

function formatInvalidType(issue: SchemaIssue.InvalidType): string {
  return `Expected ${SchemaAST.format(issue.ast)}, actual ${formatUnknownOption(issue.actual)}`
}

function formatOneOf(issue: SchemaIssue.OneOf): string {
  return `Expected exactly one successful result for ${SchemaAST.format(issue.ast)}, actual ${
    formatUnknown(issue.actual)
  }`
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

function formatForbidden(issue: SchemaIssue.Forbidden): string {
  const message = issue.annotations?.message
  if (Predicate.isString(message)) {
    return message
  }
  const cause = issue.annotations?.cause
  if (Cause.isCause(cause)) {
    return formatCause(cause)
  }
  return "Forbidden operation"
}

function formatPointer(issue: SchemaIssue.Pointer): string {
  const path = formatPath(issue.path)
  const hint = issue.annotations?.title ?? issue.annotations?.description
  if (hint) {
    return `${path} (${hint})`
  }
  return path
}

function formatTree(issue: SchemaIssue.Issue): Tree<string> {
  switch (issue._tag) {
    case "InvalidType":
      return makeTree(formatInvalidType(issue))
    case "InvalidData":
      return makeTree(formatInvalidData(issue))
    case "Composite":
      return makeTree(SchemaAST.format(issue.ast), issue.issues.map(formatTree))
    case "Pointer":
      return makeTree(formatPointer(issue), [formatTree(issue.issue)])
    case "Check":
      return makeTree(SchemaAST.formatCheck(issue.check), [formatTree(issue.issue)])
    case "MissingKey":
      return makeTree("Missing key")
    case "Forbidden":
      return makeTree(formatForbidden(issue))
    case "OneOf":
      return makeTree(formatOneOf(issue))
  }
}

/**
 * @category formatting
 * @since 4.0.0
 */
export const TreeFormatter: SchemaFormatter<string> = {
  format: (issue) => drawTree(formatTree(issue))
}

/**
 * @category formatting
 * @since 4.0.0
 */
export const StandardFormatter: SchemaFormatter<StandardSchemaV1.FailureResult> = {
  format: (issue) => ({
    issues: formatStructured(issue, [], undefined)
  })
}

/**
 * @category formatting
 * @since 4.0.0
 */
export interface StructuredIssue {
  readonly _tag: "InvalidType" | "InvalidData" | "MissingKey" | "Forbidden" | "OneOf"
  readonly annotations: SchemaAnnotations.Annotations | undefined
  readonly actual: Option.Option<unknown>
  readonly path: SchemaIssue.PropertyKeyPath
  readonly message: string
  readonly abort?: boolean
}

/**
 * @category formatting
 * @since 4.0.0
 */
export const StructuredFormatter: SchemaFormatter<Array<StructuredIssue>> = {
  format: (issue) => formatStructured(issue, [], undefined)
}

function formatStructured(
  issue: SchemaIssue.Issue,
  path: SchemaIssue.PropertyKeyPath,
  annotations: SchemaAnnotations.Annotations | undefined
): Array<StructuredIssue> {
  switch (issue._tag) {
    case "InvalidType":
      return [
        {
          _tag: issue._tag,
          annotations: issue.ast.annotations,
          actual: issue.actual,
          path,
          message: formatInvalidType(issue)
        }
      ]
    case "InvalidData":
      return [
        {
          _tag: issue._tag,
          annotations: annotations ?? issue.annotations,
          actual: issue.actual,
          path,
          message: formatInvalidData(issue, annotations)
        }
      ]
    case "MissingKey":
      return [
        {
          _tag: issue._tag,
          annotations,
          actual: Option.none(),
          path,
          message: "Missing key"
        }
      ]
    case "Forbidden":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: issue.actual,
          path,
          message: formatForbidden(issue)
        }
      ]
    case "OneOf":
      return [
        {
          _tag: issue._tag,
          annotations: issue.ast.annotations,
          actual: Option.some(issue.actual),
          path,
          message: formatOneOf(issue)
        }
      ]
    case "Check":
      return formatStructured(issue.issue, path, issue.check.annotations).map((structured) => ({
        ...structured,
        abort: issue.abort
      }))
    case "Pointer":
      return formatStructured(issue.issue, [...path, ...issue.path], annotations)
    case "Composite":
      return issue.issues.flatMap((i) => formatStructured(i, path, issue.ast.annotations))
  }
}
