/**
 * @since 4.0.0
 */

import * as Option from "./Option.js"
import * as Order from "./Order.js"
import * as Predicate from "./Predicate.js"
import type * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaIssue from "./SchemaIssue.js"

/**
 * @category model
 * @since 4.0.0
 */
export type Annotations = SchemaAST.Annotations.Filter

/**
 * @category model
 * @since 4.0.0
 */
export class Filter<T> {
  readonly _tag = "Filter"
  constructor(
    readonly run: (
      input: T,
      self: SchemaAST.AST,
      options: SchemaAST.ParseOptions
    ) => undefined | readonly [issue: SchemaIssue.Issue, abort: boolean],
    readonly annotations: Annotations | undefined
  ) {}
  annotate(annotations: Annotations): Filter<T> {
    return new Filter(this.run, { ...this.annotations, ...annotations })
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Group<T> {
  readonly _tag = "Group"
  constructor(
    readonly checks: readonly [Check<T>, ...ReadonlyArray<Check<T>>],
    readonly annotations: SchemaAST.Annotations.Documentation | undefined
  ) {}
  annotate(annotations: SchemaAST.Annotations.Documentation): Group<T> {
    return new Group(this.checks, { ...this.annotations, ...annotations })
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Check<T> = Filter<T> | Group<T>

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make<T>(
  filter: (
    input: T,
    ast: SchemaAST.AST,
    options: SchemaAST.ParseOptions
  ) => undefined | boolean | string | undefined | readonly [issue: SchemaIssue.Issue, abort: boolean],
  annotations?: Annotations | undefined
): Filter<T> {
  return new Filter<T>(
    (input, ast, options) => {
      const out = filter(input, ast, options)
      if (out === undefined) {
        return undefined
      }
      if (Predicate.isBoolean(out)) {
        return out ? undefined : [new SchemaIssue.InvalidData(Option.some(input)), false]
      }
      if (Predicate.isString(out)) {
        return [new SchemaIssue.InvalidData(Option.some(input), { message: out }), false]
      }
      return out
    },
    annotations
  )
}

/**
 * @since 4.0.0
 */
export function abort<T>(filter: Filter<T>): Filter<T> {
  return new Filter(
    (input, ast, options) => {
      const out = filter.run(input, ast, options)
      if (out) {
        const [issue, _] = out
        return [issue, true]
      }
    },
    filter.annotations
  )
}

/**
 * @category String checks
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
 * @category String checks
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
 * @category String checks
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
 * @category String checks
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
 * @category String checks
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
 * @category String checks
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
 * @category String checks
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
 * @category Number checks
 * @since 4.0.0
 */
export const finite = make((n: number) => globalThis.Number.isFinite(n), {
  title: "finite",
  meta: {
    id: "finite"
  }
})

/**
 * @category Order checks
 * @since 4.0.0
 */
const makeGreaterThan = <T>(O: Order.Order<T>) => {
  const greaterThan = Order.greaterThan(O)
  return (exclusiveMinimum: T, annotations?: Annotations) => {
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
      },
      ...annotations
    })
  }
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export const greaterThan = makeGreaterThan(Order.number)

/**
 * @category Order checks
 * @since 4.0.0
 */
const makeBetween = <T>(O: Order.Order<T>) => {
  const greaterThan = Order.greaterThan(O)
  const lessThan = Order.lessThan(O)
  return (minimum: T, maximum: T, annotations?: Annotations) => {
    return make<T>((input) => greaterThan(input, minimum) && lessThan(input, maximum), {
      title: `between(${minimum}, ${maximum})`,
      description: `a value between ${minimum} and ${maximum}`,
      jsonSchema: {
        type: "fragment",
        fragment: {
          minimum,
          maximum
        }
      },
      meta: {
        id: "between",
        minimum,
        maximum
      },
      ...annotations
    })
  }
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export const between = makeBetween(Order.number)

/**
 * Restricts to safe integer range
 *
 * @category Number checks
 * @since 4.0.0
 */
export const int = make((n: number) => Number.isSafeInteger(n), {
  title: "int",
  description: "an integer",
  jsonSchema: {
    type: "fragment",
    fragment: {
      type: "integer"
    }
  },
  meta: {
    id: "int"
  }
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export const int32 = new Group([
  int,
  between(-2147483648, 2147483647)
], {
  title: "int32",
  description: "a 32-bit integer",
  jsonSchema: {
    type: "fragment",
    fragment: {
      format: "int32"
    }
  },
  meta: {
    id: "int32"
  }
})

/**
 * @category Length checks
 * @since 4.0.0
 */
export const minLength = (minLength: number) => {
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
 * @category Length checks
 * @since 4.0.0
 */
export const nonEmpty = minLength(1)

/**
 * @category Length checks
 * @since 4.0.0
 */
export const maxLength = (maxLength: number) => {
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
 * @category Length checks
 * @since 4.0.0
 */
export const length = (length: number) => {
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

/**
 * @since 4.0.0
 */
export const asCheck = <T>(
  ...checks: readonly [Check<T>, ...ReadonlyArray<Check<T>>]
) =>
<S extends Schema.Schema<T>>(self: S): S["~rebuild.out"] => {
  return self.rebuild(SchemaAST.appendChecks(self.ast, checks))
}

/**
 * @since 4.0.0
 */
export const asCheckEncoded = <E>(
  ...checks: readonly [Check<E>, ...ReadonlyArray<Check<E>>]
) =>
<S extends Schema.Top & { readonly "Encoded": E }>(self: S): S["~rebuild.out"] => {
  return self.rebuild(SchemaAST.appendEncodedChecks(self.ast, checks))
}
