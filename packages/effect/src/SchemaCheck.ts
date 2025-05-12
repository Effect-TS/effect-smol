/**
 * @since 4.0.0
 */

import * as Num from "./Number.js"
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
export class FilterGroup<T> {
  readonly _tag = "FilterGroup"
  constructor(
    readonly checks: readonly [SchemaCheck<T>, ...ReadonlyArray<SchemaCheck<T>>],
    readonly annotations: SchemaAST.Annotations.Documentation | undefined
  ) {}
  annotate(annotations: SchemaAST.Annotations.Documentation): FilterGroup<T> {
    return new FilterGroup(this.checks, { ...this.annotations, ...annotations })
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type SchemaCheck<T> = Filter<T> | FilterGroup<T>

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
export const deriveGreaterThan = <T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMinimum: T) => Annotations) | undefined
  readonly format?: (value: T) => string | undefined
}) => {
  const greaterThan = Order.greaterThan(options.order)
  const format = options.format ?? globalThis.String
  return (exclusiveMinimum: T, annotations?: Annotations) => {
    return make<T>((input) => greaterThan(input, exclusiveMinimum), {
      title: `greaterThan(${format(exclusiveMinimum)})`,
      description: `a value greater than ${format(exclusiveMinimum)}`,
      ...options.annotate?.(exclusiveMinimum),
      ...annotations
    })
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export const deriveGreaterThanOrEqualTo = <T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMinimum: T) => Annotations) | undefined
  readonly format?: (value: T) => string | undefined
}) => {
  const greaterThanOrEqualTo = Order.greaterThanOrEqualTo(options.order)
  const format = options.format ?? globalThis.String
  return (minimum: T, annotations?: Annotations) => {
    return make<T>((input) => greaterThanOrEqualTo(input, minimum), {
      title: `greaterThanOrEqualTo(${format(minimum)})`,
      description: `a value greater than or equal to ${format(minimum)}`,
      ...options.annotate?.(minimum),
      ...annotations
    })
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export const deriveLessThan = <T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMaximum: T) => Annotations) | undefined
  readonly format?: (value: T) => string | undefined
}) => {
  const lessThan = Order.lessThan(options.order)
  const format = options.format ?? globalThis.String
  return (exclusiveMaximum: T, annotations?: Annotations) => {
    return make<T>((input) => lessThan(input, exclusiveMaximum), {
      title: `lessThan(${format(exclusiveMaximum)})`,
      description: `a value less than ${format(exclusiveMaximum)}`,
      ...options.annotate?.(exclusiveMaximum),
      ...annotations
    })
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export const deriveLessThanOrEqualTo = <T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMaximum: T) => Annotations) | undefined
  readonly format?: (value: T) => string | undefined
}) => {
  const lessThanOrEqualTo = Order.lessThanOrEqualTo(options.order)
  const format = options.format ?? globalThis.String
  return (maximum: T, annotations?: Annotations) => {
    return make<T>((input) => lessThanOrEqualTo(input, maximum), {
      title: `lessThanOrEqualTo(${format(maximum)})`,
      description: `a value less than or equal to ${format(maximum)}`,
      ...options.annotate?.(maximum),
      ...annotations
    })
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export const deriveBetween = <T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((minimum: T, maximum: T) => Annotations) | undefined
  readonly format?: (value: T) => string | undefined
}) => {
  const greaterThanOrEqualTo = Order.greaterThanOrEqualTo(options.order)
  const lessThanOrEqualTo = Order.lessThanOrEqualTo(options.order)
  const format = options.format ?? globalThis.String
  return (minimum: T, maximum: T, annotations?: Annotations) => {
    return make<T>((input) => greaterThanOrEqualTo(input, minimum) && lessThanOrEqualTo(input, maximum), {
      title: `between(${format(minimum)}, ${format(maximum)})`,
      description: `a value between ${format(minimum)} and ${format(maximum)}`,
      ...options.annotate?.(minimum, maximum),
      ...annotations
    })
  }
}

/**
 * @category Numeric checks
 * @since 4.0.0
 */
export const deriveMultipleOf = <T>(options: {
  readonly remainder: (input: T, divisor: T) => T
  readonly zero: NoInfer<T>
  readonly annotate?: ((divisor: T) => Annotations) | undefined
  readonly format?: (value: T) => string | undefined
}) =>
(divisor: T) => {
  const format = options.format ?? globalThis.String
  return make<T>((input) => options.remainder(input, divisor) === options.zero, {
    title: `multipleOf(${format(divisor)})`,
    description: `a value that is a multiple of ${format(divisor)}`,
    ...options.annotate?.(divisor)
  })
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export const greaterThan = deriveGreaterThan({
  order: Order.number,
  annotate: (exclusiveMinimum) => ({
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
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export const greaterThanOrEqualTo = deriveGreaterThanOrEqualTo({
  order: Order.number,
  annotate: (minimum) => ({
    jsonSchema: {
      type: "fragment",
      fragment: {
        minimum
      }
    },
    meta: {
      id: "greaterThanOrEqualTo",
      minimum
    }
  })
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export const lessThan = deriveLessThan({
  order: Order.number,
  annotate: (exclusiveMaximum) => ({
    jsonSchema: {
      type: "fragment",
      fragment: {
        exclusiveMaximum
      }
    },
    meta: {
      id: "lessThan",
      exclusiveMaximum
    }
  })
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export const lessThanOrEqualTo = deriveLessThanOrEqualTo({
  order: Order.number,
  annotate: (maximum) => ({
    jsonSchema: {
      type: "fragment",
      fragment: {
        maximum
      }
    },
    meta: {
      id: "lessThanOrEqualTo",
      maximum
    }
  })
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export const between = deriveBetween({
  order: Order.number,
  annotate: (minimum, maximum) => ({
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
    }
  })
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export const positive = greaterThan(0)

/**
 * @category Number checks
 * @since 4.0.0
 */
export const negative = lessThan(0)

/**
 * @category Number checks
 * @since 4.0.0
 */
export const nonNegative = greaterThanOrEqualTo(0)

/**
 * @category Number checks
 * @since 4.0.0
 */
export const nonPositive = lessThanOrEqualTo(0)

/**
 * @category Number checks
 * @since 4.0.0
 */
export const multipleOf = deriveMultipleOf({
  remainder: Num.remainder,
  zero: 0,
  annotate: (divisor) => ({
    title: `multipleOf(${divisor})`,
    description: `a value that is a multiple of ${divisor}`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        multipleOf: Math.abs(divisor) // JSON Schema only supports positive divisors
      }
    }
  })
})

/**
 * Restricts to safe integer range
 *
 * @category Integer checks
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
 * @category Integer checks
 * @since 4.0.0
 */
export const int32 = new FilterGroup([
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
  ...checks: readonly [SchemaCheck<T>, ...ReadonlyArray<SchemaCheck<T>>]
) =>
<S extends Schema.Schema<T>>(self: S): S["~rebuild.out"] => {
  return self.rebuild(SchemaAST.appendChecks(self.ast, checks))
}

/**
 * @since 4.0.0
 */
export const asCheckEncoded = <E>(
  ...checks: readonly [SchemaCheck<E>, ...ReadonlyArray<SchemaCheck<E>>]
) =>
<S extends Schema.Top & { readonly "Encoded": E }>(self: S): S["~rebuild.out"] => {
  return self.rebuild(SchemaAST.appendEncodedChecks(self.ast, checks))
}
