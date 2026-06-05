import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Str from "effect/String"
import { DiscoveryError } from "./errors.ts"

/** @internal */
export type TagPredicate = (tags: ReadonlyArray<string>) => boolean

type Expression =
  | {
    readonly _tag: "Tag"
    readonly tag: string
  }
  | {
    readonly _tag: "Not"
    readonly expression: Expression
  }
  | {
    readonly _tag: "And"
    readonly left: Expression
    readonly right: Expression
  }
  | {
    readonly _tag: "Or"
    readonly left: Expression
    readonly right: Expression
  }

interface ParseResult {
  readonly expression: Expression
  readonly index: number
}

/** @internal */
export const compileAll = (
  expressions: ReadonlyArray<string>
): Effect.Effect<TagPredicate, DiscoveryError> =>
  Effect.forEach(expressions, compile).pipe(
    Effect.map((predicates) => (tags) => Arr.every(predicates, (predicate) => predicate(tags)))
  )

const compile = (expression: string): Effect.Effect<TagPredicate, DiscoveryError> => {
  const tokens = tokenize(expression)
  if (tokens === undefined || tokens.length === 0) {
    return fail(expression, "Expected a tag expression")
  }
  const result = parseOr(tokens, 0)
  if (result === undefined || result.index !== tokens.length) {
    return fail(expression, "Could not parse tag expression")
  }
  return Effect.succeed((tags) => evaluate(result.expression, tags))
}

const parseOr = (tokens: ReadonlyArray<string>, index: number): ParseResult | undefined => {
  const left = parseAnd(tokens, index)
  if (left === undefined) {
    return undefined
  }
  return parseOrRest(tokens, left)
}

const parseOrRest = (tokens: ReadonlyArray<string>, left: ParseResult): ParseResult => {
  if (tokens[left.index] !== "or") {
    return left
  }
  const right = parseAnd(tokens, left.index + 1)
  if (right === undefined) {
    return left
  }
  return parseOrRest(tokens, {
    expression: {
      _tag: "Or",
      left: left.expression,
      right: right.expression
    },
    index: right.index
  })
}

const parseAnd = (tokens: ReadonlyArray<string>, index: number): ParseResult | undefined => {
  const left = parseUnary(tokens, index)
  if (left === undefined) {
    return undefined
  }
  return parseAndRest(tokens, left)
}

const parseAndRest = (tokens: ReadonlyArray<string>, left: ParseResult): ParseResult => {
  if (tokens[left.index] !== "and") {
    return left
  }
  const right = parseUnary(tokens, left.index + 1)
  if (right === undefined) {
    return left
  }
  return parseAndRest(tokens, {
    expression: {
      _tag: "And",
      left: left.expression,
      right: right.expression
    },
    index: right.index
  })
}

const parseUnary = (tokens: ReadonlyArray<string>, index: number): ParseResult | undefined =>
  tokens[index] === "not" ? parseNot(tokens, index) : parsePrimary(tokens, index)

const parseNot = (tokens: ReadonlyArray<string>, index: number): ParseResult | undefined => {
  const result = parseUnary(tokens, index + 1)
  return result === undefined
    ? undefined
    : {
      expression: {
        _tag: "Not",
        expression: result.expression
      },
      index: result.index
    }
}

const parsePrimary = (tokens: ReadonlyArray<string>, index: number): ParseResult | undefined => {
  const token = tokens[index]
  if (token === undefined) {
    return undefined
  }
  if (token === "(") {
    const result = parseOr(tokens, index + 1)
    return result !== undefined && tokens[result.index] === ")"
      ? {
        expression: result.expression,
        index: result.index + 1
      }
      : undefined
  }
  return pipe(token, Str.startsWith("@"))
    ? {
      expression: {
        _tag: "Tag",
        tag: token
      },
      index: index + 1
    }
    : undefined
}

const evaluate = (expression: Expression, tags: ReadonlyArray<string>): boolean => {
  switch (expression._tag) {
    case "Tag": {
      return Arr.contains(expression.tag)(tags)
    }
    case "Not": {
      return !evaluate(expression.expression, tags)
    }
    case "And": {
      return evaluate(expression.left, tags) && evaluate(expression.right, tags)
    }
    case "Or": {
      return evaluate(expression.left, tags) || evaluate(expression.right, tags)
    }
  }
}

const tokenize = (expression: string): ReadonlyArray<string> | undefined => {
  const matches = expression.match(/\(|\)|\b(?:and|or|not)\b|@[A-Za-z0-9][A-Za-z0-9_-]*/g) ?? []
  const normalized = pipe(expression, Str.replace(/\s+/g, ""))
  const matched = pipe(matches, Arr.join(""))
  return normalized === matched ? matches : undefined
}

const fail = (expression: string, message: string): Effect.Effect<never, DiscoveryError> =>
  Effect.fail(new DiscoveryError({ message: `${message}: ${expression}` }))
