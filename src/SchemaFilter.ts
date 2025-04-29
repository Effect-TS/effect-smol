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
export type FilterOut<R> = SchemaIssue.Issue | undefined | Effect.Effect<SchemaIssue.Issue | undefined, never, R>

/**
 * @category model
 * @since 4.0.0
 */
export class Filter<T, R = never> {
  declare readonly "Context": R
  readonly _tag = "Filter"
  constructor(
    readonly run: (input: T, self: SchemaAST.AST, options: SchemaAST.ParseOptions) => FilterOut<R>,
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
export function make<T>(
  filter: (input: T, ast: SchemaAST.AST, options: SchemaAST.ParseOptions) => MakeOut,
  annotations?: Annotations | undefined,
  bail: boolean = false
): Filter<T> {
  return new Filter<T>(
    (input, ast, options) => fromMakeOut(filter(input, ast, options), input),
    bail,
    annotations
  )
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makeEffect<T, R>(
  filter: (input: T, ast: SchemaAST.AST, options: SchemaAST.ParseOptions) => Effect.Effect<MakeOut, never, R>,
  annotations?: Annotations | undefined,
  bail: boolean = false
): Filter<T, R> {
  return new Filter<T, R>(
    (input, ast, options) => Effect.map(filter(input, ast, options), (out) => fromMakeOut(out, input)),
    bail,
    annotations
  )
}

/**
 * @category String filters
 * @since 4.0.0
 */
export const trimmed = make((s: string) => s.trim() === s, {
  title: "trimmed",
  description: "a string with no leading or trailing whitespace",
  jsonSchema: {
    type: "fragment",
    fragment: {
      pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$" // TODO: can be improved?
    }
  },
  meta: {
    id: "trimmed"
  }
})

/**
 * @category String filters
 * @since 4.0.0
 */
export function regex(regex: RegExp) {
  const source = regex.source
  return make((s: string) => regex.test(s), {
    title: `regex(${source})`,
    description: `a string matching the pattern ${source}`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        pattern: regex.source
      }
    },
    meta: {
      id: "regex",
      regex
    }
  })
}

/**
 * @category String filters
 * @since 4.0.0
 */
export function startsWith(startsWith: string) {
  const formatted = JSON.stringify(startsWith)
  return make((s: string) => s.startsWith(startsWith), {
    title: `startsWith(${formatted})`,
    description: `a string starting with ${formatted}`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        prefix: formatted
      }
    },
    meta: {
      id: "startsWith",
      startsWith
    }
  })
}

/**
 * @category String filters
 * @since 4.0.0
 */
export function endsWith(endsWith: string) {
  const formatted = JSON.stringify(endsWith)
  return make((s: string) => s.endsWith(endsWith), {
    title: `endsWith(${formatted})`,
    description: `a string ending with ${formatted}`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        suffix: formatted
      }
    },
    meta: {
      id: "endsWith",
      endsWith
    }
  })
}

/**
 * @category String filters
 * @since 4.0.0
 */
export function includes(includes: string) {
  const formatted = JSON.stringify(includes)
  return make((s: string) => s.includes(includes), {
    title: `includes(${formatted})`,
    description: `a string including ${formatted}`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        pattern: formatted
      }
    },
    meta: {
      id: "includes",
      includes
    }
  })
}

/**
 * @category String filters
 * @since 4.0.0
 */
export const uppercased = make((s: string) => s.toUpperCase() === s, {
  title: "uppercased",
  description: "a string with all characters in uppercase",
  jsonSchema: {
    type: "fragment",
    fragment: {
      pattern: "^[^a-z]*$"
    }
  },
  meta: {
    id: "uppercased"
  }
})

/**
 * @category String filters
 * @since 4.0.0
 */
export const lowercased = make((s: string) => s.toLowerCase() === s, {
  title: "lowercased",
  description: "a string with all characters in lowercase",
  jsonSchema: {
    type: "fragment",
    fragment: {
      pattern: "^[^A-Z]*$"
    }
  },
  meta: {
    id: "lowercased"
  }
})

/**
 * @category Number filters
 * @since 4.0.0
 */
export const finite = make((n: number) => globalThis.Number.isFinite(n), {
  title: "finite",
  meta: {
    id: "finite"
  }
})

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
      jsonSchema: {
        type: "fragment",
        fragment: {
          exclusiveMinimum
        }
      },
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
export const minLength = (
  minLength: number
) => {
  minLength = Math.max(0, Math.floor(minLength))
  return make<{ readonly length: number }>((input) => input.length >= minLength, {
    title: `minLength(${minLength})`,
    description: `a value with a length of at least ${minLength}`,
    jsonSchema: {
      type: "fragment",
      fragment: [
        {
          type: "string",
          minLength
        },
        {
          type: "array",
          minItems: minLength
        }
      ]
    },
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
export const maxLength = (
  maxLength: number
) => {
  maxLength = Math.max(0, Math.floor(maxLength))
  return make<{ readonly length: number }>((input) => input.length <= maxLength, {
    title: `maxLength(${maxLength})`,
    description: `a value with a length of at most ${maxLength}`,
    jsonSchema: {
      type: "fragment",
      fragment: [
        {
          type: "string",
          maxLength
        },
        {
          type: "array",
          maxItems: maxLength
        }
      ]
    },
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
export const length = (
  length: number
) => {
  length = Math.max(0, Math.floor(length))
  return make<{ readonly length: number }>((input) => input.length === length, {
    title: `length(${length})`,
    description: `a value with a length of ${length}`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        length
      }
    },
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
