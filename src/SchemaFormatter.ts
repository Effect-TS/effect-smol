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
    case "UnexpectedIssue":
      return makeTree("Unexpected value")
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
  readonly expected?: string
  readonly code: SchemaIssue.Issue["_tag"]
  readonly path: SchemaIssue.PropertyKeyPath
  readonly message: string
  readonly bail?: boolean
}

/**
 * @category formatting
 * @since 4.0.0
 */
export const StructuredFormatter: SchemaFormatter<Array<StructuredIssue>> = {
  format: (issue) => formatStructured(issue, [])
}

function formatStructured(issue: SchemaIssue.Issue, path: SchemaIssue.PropertyKeyPath): Array<StructuredIssue> {
  switch (issue._tag) {
    case "MismatchIssue":
      return [
        {
          expected: SchemaAST.format(issue.ast),
          code: issue._tag,
          path,
          message: formatMismatchIssue(issue)
        }
      ]
    case "InvalidIssue":
      return [
        {
          code: issue._tag,
          path,
          message: formatInvalidIssue(issue)
        }
      ]
    case "MissingIssue":
      return [
        {
          code: issue._tag,
          path,
          message: "Missing value"
        }
      ]
    case "UnexpectedIssue":
      return [
        {
          code: issue._tag,
          path,
          message: "Unexpected value"
        }
      ]
    case "ForbiddenIssue":
      return [
        {
          code: issue._tag,
          path,
          message: formatForbiddenIssue(issue)
        }
      ]
    case "FilterIssue":
      return [
        {
          expected: SchemaAST.formatFilter(issue.filter),
          code: issue._tag,
          path,
          message: "",
          bail: issue.abort
        }
      ]
    case "TransformationIssue":
      return [
        {
          expected: SchemaAST.formatParser(issue.parser),
          code: issue._tag,
          path,
          message: ""
        }
      ]
    case "MiddlewareIssue":
      return [
        {
          expected: SchemaAST.formatMiddleware(issue.middleware),
          code: issue._tag,
          path,
          message: ""
        }
      ]
    case "PointerIssue":
      return formatStructured(issue.issue, [...path, ...issue.path])
    case "CompositeIssue":
      return issue.issues.flatMap((issue) => formatStructured(issue, path))
  }
}
