/**
 * @since 4.0.0
 */

import * as Effect from "./Effect.js"
import * as Option from "./Option.js"
import * as Order from "./Order.js"
import * as Predicate from "./Predicate.js"
import type * as SchemaAST from "./SchemaAST.js"
import * as SchemaIssue from "./SchemaIssue.js"

/**
 * @category model
 * @since 4.0.0
 */
export type Annotations = SchemaAST.Annotations.Documentation

/**
 * @category model
 * @since 4.0.0
 */
export class Filter<T = unknown, R = never> {
  readonly _tag = "Filter"
  constructor(
    readonly run: (
      input: T,
      options: SchemaAST.ParseOptions
    ) => SchemaIssue.Issue | undefined | Effect.Effect<SchemaIssue.Issue | undefined, never, R>,
    readonly bail: boolean,
    readonly annotations: Annotations | undefined
  ) {}
  annotate(annotations: Annotations): Filter<T, R> {
    return new Filter(this.run, this.bail, { ...this.annotations, ...annotations })
  }
  abort(): Filter<T, R> {
    return new Filter(this.run, true, this.annotations)
  }
}

type MakeOut = undefined | boolean | string | SchemaIssue.Issue

/**
 * @category Constructors
 * @since 4.0.0
 */
export const make = <T>(
  filter: (input: T, options: SchemaAST.ParseOptions) => MakeOut,
  annotations?: Annotations
): Filter<T> => {
  return new Filter<T>(
    (input, options) => fromMakeOut(filter(input, options), input),
    false,
    annotations
  )
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export const makeEffect = <T, R>(
  filter: (input: T, options: SchemaAST.ParseOptions) => Effect.Effect<MakeOut, never, R>,
  annotations?: Annotations
): Filter<T, R> => {
  return new Filter<T, R>(
    (input, options) => Effect.map(filter(input, options), (out) => fromMakeOut(out, input)),
    false,
    annotations
  )
}

/**
 * @category String filters
 * @since 4.0.0
 */
export const trimmed = new Filter<string>(
  (s) => fromMakeOut(s.trim() === s, s),
  false,
  {
    title: "trimmed",
    meta: {
      id: "trimmed"
    }
  }
)

/**
 * @category Number filters
 * @since 4.0.0
 */
export const finite = new Filter<number>(
  (n) => fromMakeOut(globalThis.Number.isFinite(n), n),
  false,
  {
    title: "finite",
    meta: {
      id: "finite"
    }
  }
)

/**
 * @category Order filters
 * @since 4.0.0
 */
const makeGreaterThan = <T>(O: Order.Order<T>) => {
  const greaterThan = Order.greaterThan(O)
  return (exclusiveMinimum: T) => {
    return make<T>((input) => greaterThan(input, exclusiveMinimum), {
      title: `greaterThan(${exclusiveMinimum})`,
      description: `a value greater than ${exclusiveMinimum}`,
      meta: {
        id: "greaterThan",
        exclusiveMinimum
      }
    })
  }
}

/**
 * @category Number filters
 * @since 4.0.0
 */
export const greaterThan = makeGreaterThan(Order.number)

/**
 * @category Length filters
 * @since 4.0.0
 */
export const minLength = <T extends { readonly length: number }>(
  minLength: number
) => {
  minLength = Math.max(0, Math.floor(minLength))
  return make<T>((input) => input.length >= minLength, {
    title: `minLength(${minLength})`,
    description: `a value with a length of at least ${minLength}`,
    meta: {
      id: "minLength",
      minLength
    }
  })
}

/**
 * @category Length filters
 * @since 4.0.0
 */
export const nonEmpty = minLength(1)

/**
 * @category Length filters
 * @since 4.0.0
 */
export const maxLength = <T extends { readonly length: number }>(
  maxLength: number
) => {
  maxLength = Math.max(0, Math.floor(maxLength))
  return make<T>((input) => input.length <= maxLength, {
    title: `maxLength(${maxLength})`,
    description: `a value with a length of at most ${maxLength}`,
    meta: {
      id: "maxLength",
      maxLength
    }
  })
}

/**
 * @category Length filters
 * @since 4.0.0
 */
export const length = <T extends { readonly length: number }>(
  length: number
) => {
  length = Math.max(0, Math.floor(length))
  return make<T>((input) => input.length === length, {
    title: `length(${length})`,
    description: `a value with a length of ${length}`,
    meta: {
      id: "length",
      length
    }
  })
}

function fromMakeOut(out: MakeOut, input: unknown): SchemaIssue.Issue | undefined {
  if (out === undefined) {
    return undefined
  }
  if (Predicate.isBoolean(out)) {
    return out ? undefined : new SchemaIssue.InvalidIssue(Option.some(input))
  }
  if (Predicate.isString(out)) {
    return new SchemaIssue.InvalidIssue(Option.some(input), out)
  }
  return out
}
