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
function findMessage(issue: SchemaIssue.Issue): string | null {
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
      return getMessageAnnotation(issue.annotations, "missingMessage")
    case "Check":
      return getMessageAnnotation(issue.check.annotations)
    case "Pointer":
      return null
  }
}

type MessageFormatter = (issue: SchemaIssue.Issue) => string

/**
 * Returns a default message for the issue.
 */
function getDefaultMessage(issue: SchemaIssue.Issue): string {
  switch (issue._tag) {
    case "InvalidType":
      return `Expected ${SchemaAST.format(issue.ast)}, actual ${formatUnknownOption(issue.actual)}`
    case "InvalidValue": {
      const actual = formatUnknownOption(issue.actual)
      const expected = issue.annotations?.description ?? issue.annotations?.title
      if (Predicate.isString(expected)) {
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
      return getDefaultMessage(issue.issue)
    case "Composite":
    case "AnyOf":
      return issue.issues.map(getDefaultMessage).join("\n")
  }
}

/**
 * Returns an error message for the issue.
 * If no message is found, it returns a default message.
 */
const getMessage: MessageFormatter = (issue: SchemaIssue.Issue): string => {
  return findMessage(issue) ?? getDefaultMessage(issue)
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
  return {
    format: (issue) => drawTree(formatTree(issue, [], getMessage))
  }
}

function formatTree(
  issue: SchemaIssue.Issue,
  path: ReadonlyArray<PropertyKey>,
  formatter: MessageFormatter
): Tree<string> {
  switch (issue._tag) {
    case "Check": {
      const message = findMessage(issue)
      if (message !== null) {
        return makeTree(message)
      }
      return makeTree(SchemaAST.formatCheck(issue.check), [formatTree(issue.issue, path, formatter)])
    }
    case "Pointer":
      return makeTree(formatPath(issue.path), [formatTree(issue.issue, [...path, ...issue.path], formatter)])
    case "Composite":
    case "AnyOf":
      return makeTree(SchemaAST.format(issue.ast), issue.issues.map((issue) => formatTree(issue, path, formatter)))
    case "MissingKey":
    case "InvalidType":
    case "InvalidValue":
    case "Forbidden":
      return makeTree(formatter(issue))
    case "OneOf":
      return makeTree(SchemaAST.format(issue.ast), [
        makeTree(`Expected exactly one successful schema for ${formatUnknown(issue.actual)}`),
        makeTree(
          "The following schemas were successful:",
          issue.successes.map((ast) => makeTree(SchemaAST.format(ast)))
        )
      ])
  }
}

/**
 * @category StandardSchemaV1
 * @since 4.0.0
 */
export function getStandardSchemaV1(): SchemaFormatter<StandardSchemaV1.FailureResult> {
  return {
    format: (issue) => ({
      issues: formatStandardV1(issue, [], getMessage)
    })
  }
}

function formatStandardV1(
  issue: SchemaIssue.Issue,
  path: ReadonlyArray<PropertyKey>,
  formatter: MessageFormatter
): Array<StandardSchemaV1.Issue> {
  switch (issue._tag) {
    case "InvalidType":
    case "InvalidValue":
    case "MissingKey":
    case "Forbidden":
    case "OneOf":
      return [{ path, message: formatter(issue) }]
    case "Check": {
      const message = findMessage(issue)
      if (message !== null) {
        return [{ path, message }]
      }
      const actual = formatUnknown(issue.actual)
      const annotations = issue.check.annotations
      const expected = annotations?.description ?? annotations?.title
      if (Predicate.isString(expected)) {
        return [{ path, message: `Expected ${expected}, actual ${actual}` }]
      }
      return formatStandardV1(issue.issue, path, formatter)
    }
    case "Pointer":
      return formatStandardV1(issue.issue, [...path, ...issue.path], formatter)
    case "Composite":
    case "AnyOf":
      return issue.issues.flatMap((issue) => formatStandardV1(issue, path, formatter))
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
export function getStructured(): SchemaFormatter<Array<StructuredIssue>> {
  return {
    format: (issue) => formatStructured(issue, [], getMessage)
  }
}

function formatStructured(
  issue: SchemaIssue.Issue,
  path: ReadonlyArray<PropertyKey>,
  formatter: MessageFormatter
): Array<StructuredIssue> {
  switch (issue._tag) {
    case "InvalidType":
      return [
        {
          _tag: issue._tag,
          annotations: issue.ast.annotations,
          actual: issue.actual,
          path,
          message: formatter(issue)
        }
      ]
    case "InvalidValue":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: issue.actual,
          path,
          message: formatter(issue)
        }
      ]
    case "MissingKey":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: Option.none(),
          path,
          message: formatter(issue)
        }
      ]
    case "Forbidden":
      return [
        {
          _tag: issue._tag,
          annotations: issue.annotations,
          actual: issue.actual,
          path,
          message: formatter(issue)
        }
      ]
    case "OneOf":
      return [
        {
          _tag: issue._tag,
          annotations: issue.ast.annotations,
          actual: Option.some(issue.actual),
          path,
          message: formatter(issue)
        }
      ]
    case "Check":
      return formatStructured(issue.issue, path, formatter).map((structured) => {
        return {
          ...structured,
          annotations: structured.annotations,
          check: issue.check.annotations,
          abort: issue.abort
        }
      })
    case "Pointer":
      return formatStructured(issue.issue, [...path, ...issue.path], formatter)
    case "Composite":
    case "AnyOf":
      return issue.issues.flatMap((issue) => formatStructured(issue, path, formatter))
  }
}
