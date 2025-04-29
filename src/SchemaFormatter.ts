/**
 * @since 4.0.0
 */

import { formatPath, formatUnknown } from "./internal/schema/util.js"
import * as Option from "./Option.js"
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

function formatInvalidIssue(issue: SchemaIssue.InvalidIssue): string {
  if (issue.message !== undefined) {
    return issue.message
  }
  if (Option.isNone(issue.actual)) {
    return "No value provided"
  }
  return `Invalid value ${formatUnknown(issue.actual.value)}`
}

function formatMismatchIssue(issue: SchemaIssue.MismatchIssue): string {
  if (issue.message !== undefined) {
    return issue.message
  }
  if (Option.isNone(issue.actual)) {
    return `Expected ${SchemaAST.format(issue.ast)} but no value was provided`
  }
  return `Expected ${SchemaAST.format(issue.ast)}, actual ${formatUnknown(issue.actual.value)}`
}

function formatForbiddenIssue(issue: SchemaIssue.ForbiddenIssue): string {
  if (issue.message !== undefined) {
    return issue.message
  }
  return "Forbidden operation"
}

function formatTree(issue: SchemaIssue.Issue): Tree<string> {
  switch (issue._tag) {
    case "MismatchIssue":
      return makeTree(formatMismatchIssue(issue))
    case "InvalidIssue":
      return makeTree(formatInvalidIssue(issue))
    case "CompositeIssue":
      return makeTree(SchemaAST.format(issue.ast), issue.issues.map(formatTree))
    case "PointerIssue":
      return makeTree(formatPath(issue.path), [formatTree(issue.issue)])
    case "FilterIssue":
      return makeTree(SchemaAST.formatFilter(issue.filter), [formatTree(issue.issue)])
    case "TransformationIssue":
      return makeTree(SchemaAST.formatParser(issue.parser), [formatTree(issue.issue)])
    case "MiddlewareIssue":
      return makeTree(SchemaAST.formatMiddleware(issue.middleware), [formatTree(issue.issue)])
    case "MissingIssue":
      return makeTree("Missing value")
    case "ForbiddenIssue":
      return makeTree(formatForbiddenIssue(issue))
  }
  issue satisfies never // TODO: remove this
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
export interface StructuredIssue {
  readonly _tag: "MismatchIssue" | "InvalidIssue" | "MissingIssue" | "ForbiddenIssue"
  readonly expected: string
  readonly actual: Option.Option<unknown>
  readonly path: SchemaIssue.PropertyKeyPath
  readonly message: string
  readonly bail?: boolean
  readonly meta?: unknown
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
  expected: string | undefined
): Array<StructuredIssue> {
  switch (issue._tag) {
    case "MismatchIssue":
      return [
        {
          _tag: issue._tag,
          expected: expected ?? SchemaAST.format(issue.ast),
          actual: issue.actual,
          path,
          message: formatMismatchIssue(issue)
        }
      ]
    case "InvalidIssue":
      return [
        {
          _tag: issue._tag,
          expected: expected ?? "unknown",
          actual: issue.actual,
          path,
          message: formatInvalidIssue(issue)
        }
      ]
    case "MissingIssue":
      return [
        {
          _tag: issue._tag,
          expected: expected ?? "unknown",
          actual: Option.none(),
          path,
          message: "Missing value"
        }
      ]
    case "ForbiddenIssue":
      return [
        {
          _tag: issue._tag,
          expected: expected ?? "unknown",
          actual: issue.actual,
          path,
          message: formatForbiddenIssue(issue)
        }
      ]
    case "FilterIssue": {
      expected = expected ?? SchemaAST.formatFilter(issue.filter)
      return formatStructured(issue.issue, path, expected).map((structured) => ({
        ...structured,
        bail: issue.bail,
        meta: issue.filter.annotations?.meta
      }))
    }
    case "TransformationIssue": {
      expected = expected ?? SchemaAST.formatParser(issue.parser)
      return formatStructured(issue.issue, path, expected)
    }
    case "MiddlewareIssue": {
      expected = expected ?? SchemaAST.formatMiddleware(issue.middleware)
      return formatStructured(issue.issue, path, expected)
    }
    case "PointerIssue":
      return formatStructured(issue.issue, [...path, ...issue.path], expected)
    case "CompositeIssue": {
      expected = expected ?? SchemaAST.format(issue.ast)
      return issue.issues.flatMap((issue) => formatStructured(issue, path, expected))
    }
  }
}
