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

function formatInvalidData(issue: SchemaIssue.InvalidData): string {
  if (issue.meta?.message !== undefined) {
    return issue.meta.message
  }
  if (Option.isNone(issue.actual)) {
    return "No value provided"
  }
  return `Invalid data ${formatUnknown(issue.actual.value)}`
}

function formatInvalidType(issue: SchemaIssue.InvalidType): string {
  if (issue.meta?.message !== undefined) {
    return issue.meta.message
  }
  if (Option.isNone(issue.actual)) {
    return `Expected ${SchemaAST.format(issue.ast)} but no value was provided`
  }
  return `Expected ${SchemaAST.format(issue.ast)}, actual ${formatUnknown(issue.actual.value)}`
}

function formatOneOf(issue: SchemaIssue.OneOf): string {
  return `Expected exactly one successful result for ${SchemaAST.format(issue.ast)}, actual ${
    formatUnknown(issue.actual)
  }`
}

function formatForbidden(issue: SchemaIssue.Forbidden): string {
  if (issue.meta?.message !== undefined) {
    return issue.meta.message
  }
  return "Forbidden operation"
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
      return makeTree(formatPath(issue.path), [formatTree(issue.issue)])
    case "Check":
      return makeTree(SchemaAST.formatCheck(issue.check), [formatTree(issue.issue)])
    case "Transformation":
      return makeTree(SchemaAST.formatGetter(issue.getter), [formatTree(issue.issue)])
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
export interface StructuredIssue {
  readonly _tag: "InvalidType" | "InvalidData" | "MissingKey" | "Forbidden" | "OneOf"
  readonly ast: SchemaAST.AST | undefined
  readonly actual: Option.Option<unknown>
  readonly path: SchemaIssue.PropertyKeyPath
  readonly abort?: boolean
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
  ast: SchemaAST.AST | undefined
): Array<StructuredIssue> {
  switch (issue._tag) {
    case "InvalidType":
      return [
        {
          _tag: issue._tag,
          ast: issue.ast,
          actual: issue.actual,
          path,
          meta: issue.meta
        }
      ]
    case "InvalidData":
      return [
        {
          _tag: issue._tag,
          ast,
          actual: issue.actual,
          path,
          meta: issue.meta
        }
      ]
    case "MissingKey":
      return [
        {
          _tag: issue._tag,
          ast,
          actual: Option.none(),
          path
        }
      ]
    case "Forbidden":
      return [
        {
          _tag: issue._tag,
          ast,
          actual: issue.actual,
          path,
          meta: issue.meta
        }
      ]
    case "OneOf":
      return [
        {
          _tag: issue._tag,
          ast: issue.ast,
          actual: Option.some(issue.actual),
          path
        }
      ]
    case "Check":
      return formatStructured(issue.issue, path, issue.ast).map((structured) => ({
        ...structured,
        abort: issue.abort,
        meta: issue.check.annotations?.meta
      }))
    case "Transformation":
      return formatStructured(issue.issue, path, issue.ast)
    case "Pointer":
      return formatStructured(issue.issue, [...path, ...issue.path], ast)
    case "Composite":
      return issue.issues.flatMap((i) => formatStructured(i, path, issue.ast))
  }
}
