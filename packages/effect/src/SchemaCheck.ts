/**
 * @since 4.0.0
 */

import type { Brand } from "./Brand.js"
import * as Function from "./Function.js"
import { PipeableClass } from "./internal/schema/util.js"
import * as Num from "./Number.js"
import * as Option from "./Option.js"
import * as Order from "./Order.js"
import * as Predicate from "./Predicate.js"
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import type * as SchemaAST from "./SchemaAST.js"
import * as SchemaIssue from "./SchemaIssue.js"

/**
 * @category model
 * @since 4.0.0
 */
export class Filter<in E> extends PipeableClass implements SchemaAnnotations.Annotated {
  readonly _tag = "Filter"
  constructor(
    readonly run: (
      input: E,
      self: SchemaAST.AST,
      options: SchemaAST.ParseOptions
    ) => undefined | readonly [issue: SchemaIssue.Issue, abort: boolean],
    readonly annotations: SchemaAnnotations.Filter | undefined
  ) {
    super()
  }
  annotate(annotations: SchemaAnnotations.Filter): Filter<E> {
    return new Filter(this.run, { ...this.annotations, ...annotations })
  }
  and<T extends E>(other: SchemaRefinement<T, E>, annotations?: SchemaAnnotations.Filter): RefinementGroup<T, E>
  and(other: SchemaCheck<E>, annotations?: SchemaAnnotations.Filter): FilterGroup<E>
  and(other: SchemaCheck<E>, annotations?: SchemaAnnotations.Filter): FilterGroup<E> {
    return new FilterGroup([this, other], annotations)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class FilterGroup<in E> extends PipeableClass implements SchemaAnnotations.Annotated {
  readonly _tag = "FilterGroup"
  constructor(
    readonly checks: readonly [SchemaCheck<E>, ...ReadonlyArray<SchemaCheck<E>>],
    readonly annotations: SchemaAnnotations.Filter | undefined
  ) {
    super()
  }
  annotate(annotations: SchemaAnnotations.Filter): FilterGroup<E> {
    return new FilterGroup(this.checks, { ...this.annotations, ...annotations })
  }
  and<T extends E>(other: SchemaRefinement<T, E>, annotations?: SchemaAnnotations.Filter): RefinementGroup<T, E>
  and(other: SchemaCheck<E>, annotations?: SchemaAnnotations.Filter): FilterGroup<E>
  and(other: SchemaCheck<E>, annotations?: SchemaAnnotations.Filter): FilterGroup<E> {
    return new FilterGroup([this, other], annotations)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type SchemaCheck<T> = Filter<T> | FilterGroup<T>

/**
 * @category model
 * @since 4.0.0
 */
export interface Refinement<out T extends E, in E> extends Filter<E> {
  readonly Type: T
  annotate(annotations: SchemaAnnotations.Filter): Refinement<T, E>
  and<T2 extends E2, E2>(
    other: SchemaRefinement<T2, E2>,
    annotations?: SchemaAnnotations.Filter
  ): RefinementGroup<T & T2, E & E2>
  and(other: SchemaCheck<E>, annotations?: SchemaAnnotations.Filter): RefinementGroup<T, E>
}

/**
 * @category model
 * @since 4.0.0
 */
export interface RefinementGroup<T extends E, E> extends FilterGroup<E> {
  readonly Type: T
  annotate(annotations: SchemaAnnotations.Filter): RefinementGroup<T, E>
  and<T2 extends E2, E2>(
    other: SchemaRefinement<T2, E2>,
    annotations?: SchemaAnnotations.Filter
  ): RefinementGroup<T & T2, E & E2>
  and(other: SchemaCheck<E>, annotations?: SchemaAnnotations.Filter): RefinementGroup<T, E>
}

/**
 * @category model
 * @since 4.0.0
 */
export type SchemaRefinement<T extends E, E> = Refinement<T, E> | RefinementGroup<T, E>

/**
 * @category Constructors
 * @since 4.0.0
 */
export function guarded<T extends E, E>(
  is: (value: E) => value is T,
  annotations?: SchemaAnnotations.Filter
): Refinement<T, E> {
  return new Filter(
    (input: E, ast) =>
      is(input) ?
        undefined :
        [new SchemaIssue.InvalidType(ast, Option.some(input)), true], // after a guard, we always want to abort
    annotations
  ) as any
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function branded<B extends string | symbol, T>(
  brand: B,
  annotations?: SchemaAnnotations.Filter
): Refinement<T & Brand<B>, T> {
  return guarded(Function.constTrue as any, { ...annotations, brand })
}

/**
 * @since 4.0.0
 */
export function guard<T extends E, E>(
  is: (value: E) => value is T,
  annotations?: SchemaAnnotations.Filter
) {
  return (self: SchemaCheck<E>): RefinementGroup<T, E> => {
    return self.and(guarded(is, annotations))
  }
}

/**
 * @since 4.0.0
 */
export function brand<B extends string | symbol>(brand: B, annotations?: SchemaAnnotations.Filter) {
  return <T>(self: SchemaCheck<T>): RefinementGroup<T & Brand<B>, T> => {
    return self.and(branded(brand, annotations))
  }
}

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
  annotations?: SchemaAnnotations.Filter | undefined
): Filter<T> {
  return new Filter(
    (input, ast, options) => {
      const out = filter(input, ast, options)
      if (out === undefined) {
        return undefined
      }
      if (Predicate.isBoolean(out)) {
        return out ? undefined : [new SchemaIssue.InvalidData(Option.some(input), undefined), false]
      }
      if (Predicate.isString(out)) {
        return [new SchemaIssue.InvalidData(Option.some(input), { description: out }), false]
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
        const [issue, b] = out
        return b ? out : [issue, true]
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
      pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$"
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
export function regex(regex: RegExp, options?: {
  readonly title?: string | undefined
  readonly description?: string | undefined
  readonly fragment?: object | undefined
  readonly meta?: object | undefined
}) {
  const source = regex.source
  return make((s: string) => regex.test(s), {
    title: options?.title ?? `regex(${source})`,
    description: options?.description ?? `a string matching the pattern ${source}`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        pattern: regex.source,
        ...options?.fragment
      }
    },
    meta: {
      id: "regex",
      regex,
      ...options?.meta
    }
  })
}

/**
 * Returns a regex for validating an RFC 4122 UUID.
 *
 * Optionally specify a version 1-8. If no version is specified, all versions are supported.
 */
const getUUIDRegex = (version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): RegExp => {
  if (version) {
    return new RegExp(
      `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`
    )
  }
  return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$/
}

/**
 * Universally Unique Identifier (UUID)
 *
 * To specify a particular UUID version, pass the version number as an argument.
 *
 * @category String checks
 * @since 4.0.0
 */
export const uuid = (version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) => {
  return regex(getUUIDRegex(version), {
    title: "uuid",
    fragment: {
      format: "uuid"
    },
    meta: {
      id: "uuid",
      version
    }
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export const base64 = regex(/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, {
  meta: {
    id: "base64"
  }
})

/**
 * @category String checks
 * @since 4.0.0
 */
export const base64url = regex(/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, {
  meta: {
    id: "base64url"
  }
})

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
        prefix: startsWith
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
        suffix: endsWith
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
        pattern: includes
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
  description: "a finite number",
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
  readonly annotate?: ((exclusiveMinimum: T) => SchemaAnnotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) => {
  const greaterThan = Order.greaterThan(options.order)
  const format = options.format ?? globalThis.String
  return (exclusiveMinimum: T, annotations?: SchemaAnnotations.Filter) => {
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
  readonly annotate?: ((exclusiveMinimum: T) => SchemaAnnotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) => {
  const greaterThanOrEqualTo = Order.greaterThanOrEqualTo(options.order)
  const format = options.format ?? globalThis.String
  return (minimum: T, annotations?: SchemaAnnotations.Filter) => {
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
  readonly annotate?: ((exclusiveMaximum: T) => SchemaAnnotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) => {
  const lessThan = Order.lessThan(options.order)
  const format = options.format ?? globalThis.String
  return (exclusiveMaximum: T, annotations?: SchemaAnnotations.Filter) => {
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
  readonly annotate?: ((exclusiveMaximum: T) => SchemaAnnotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) => {
  const lessThanOrEqualTo = Order.lessThanOrEqualTo(options.order)
  const format = options.format ?? globalThis.String
  return (maximum: T, annotations?: SchemaAnnotations.Filter) => {
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
  readonly annotate?: ((minimum: T, maximum: T) => SchemaAnnotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) => {
  const greaterThanOrEqualTo = Order.greaterThanOrEqualTo(options.order)
  const lessThanOrEqualTo = Order.lessThanOrEqualTo(options.order)
  const format = options.format ?? globalThis.String
  return (minimum: T, maximum: T, annotations?: SchemaAnnotations.Filter) => {
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
  readonly annotate?: ((divisor: T) => SchemaAnnotations.Filter) | undefined
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
      type: "fragments",
      fragments: [
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
      type: "fragments",
      fragments: [
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
