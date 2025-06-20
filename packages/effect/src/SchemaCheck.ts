/**
 * @since 4.0.0
 */

import type { Brand } from "./Brand.js"
import * as Function from "./Function.js"
import { formatUnknown, PipeableClass } from "./internal/schema/util.js"
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
    ) => {
      readonly issue: SchemaIssue.Issue
      readonly abort: boolean
    } | undefined,
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
        {
          issue: new SchemaIssue.InvalidType(ast, Option.some(input)),
          abort: true // after a guard, we always want to abort
        },
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
  return guarded(Function.constTrue as any, { ...annotations, "~brand.type": brand })
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
  ) => undefined | boolean | string | undefined | {
    readonly path: ReadonlyArray<PropertyKey>
    readonly message: string
    readonly abort?: boolean | undefined
  } | {
    readonly issue: SchemaIssue.Issue
    readonly abort: boolean
  },
  annotations?: SchemaAnnotations.Filter | undefined
): Filter<T> {
  return new Filter(
    (input, ast, options) => {
      const out = filter(input, ast, options)
      if (out === undefined) {
        return undefined
      }
      if (Predicate.isBoolean(out)) {
        return out ? undefined : {
          issue: new SchemaIssue.InvalidValue(Option.some(input)),
          abort: false
        }
      }
      if (Predicate.isString(out)) {
        return {
          issue: new SchemaIssue.InvalidValue(Option.some(input), { message: out }),
          abort: false
        }
      }
      if ("issue" in out) {
        return out
      }
      return {
        issue: new SchemaIssue.Pointer(
          out.path,
          new SchemaIssue.InvalidValue(Option.some(input), { message: out.message })
        ),
        abort: out.abort ?? false
      }
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
        const { abort, issue } = out
        return abort ? out : { issue, abort: true }
      }
    },
    filter.annotations
  )
}

const TRIMMED_PATTERN = "^\\S[\\s\\S]*\\S$|^\\S$|^$"

/**
 * @category String checks
 * @since 4.0.0
 */
export function trimmed(annotations?: SchemaAnnotations.Filter) {
  return make((s: string) => s.trim() === s, {
    title: "trimmed",
    description: "a string with no leading or trailing whitespace",
    jsonSchema: {
      type: "fragment",
      fragment: {
        pattern: TRIMMED_PATTERN
      }
    },
    meta: {
      id: "trimmed"
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "string",
        patterns: [TRIMMED_PATTERN]
      }
    },
    ...annotations
  })
}

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
  if (process.env.NODE_ENV !== "production") {
    if (regex.flags !== "") {
      throw new Error("regex flags are not supported")
    }
  }
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
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "string",
        patterns: [regex.source]
      }
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
export function uuid(version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) {
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
export function base64(annotations?: SchemaAnnotations.Filter) {
  return regex(/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, {
    meta: {
      id: "base64"
    },
    ...annotations
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export function base64url(annotations?: SchemaAnnotations.Filter) {
  return regex(/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, {
    meta: {
      id: "base64url"
    },
    ...annotations
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export function startsWith(startsWith: string, annotations?: SchemaAnnotations.Filter) {
  const formatted = JSON.stringify(startsWith)
  return make((s: string) => s.startsWith(startsWith), {
    title: `startsWith(${formatted})`,
    description: `a string starting with ${formatted}`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        pattern: `^${startsWith}`
      }
    },
    meta: {
      id: "startsWith",
      startsWith
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "string",
        patterns: [`^${startsWith}`]
      }
    },
    ...annotations
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export function endsWith(endsWith: string, annotations?: SchemaAnnotations.Filter) {
  const formatted = JSON.stringify(endsWith)
  return make((s: string) => s.endsWith(endsWith), {
    title: `endsWith(${formatted})`,
    description: `a string ending with ${formatted}`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        pattern: `${endsWith}$`
      }
    },
    meta: {
      id: "endsWith",
      endsWith
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "string",
        patterns: [`${endsWith}$`]
      }
    },
    ...annotations
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export function includes(includes: string, annotations?: SchemaAnnotations.Filter) {
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
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "string",
        patterns: [includes]
      }
    },
    ...annotations
  })
}

const UPPERCASED_PATTERN = "^[^a-z]*$"

/**
 * @category String checks
 * @since 4.0.0
 */
export function uppercased(annotations?: SchemaAnnotations.Filter) {
  return make((s: string) => s.toUpperCase() === s, {
    title: "uppercased",
    description: "a string with all characters in uppercase",
    jsonSchema: {
      type: "fragment",
      fragment: {
        pattern: UPPERCASED_PATTERN
      }
    },
    meta: {
      id: "uppercased"
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "string",
        patterns: [UPPERCASED_PATTERN]
      }
    },
    ...annotations
  })
}

const LOWERCASED_PATTERN = "^[^A-Z]*$"

/**
 * @category String checks
 * @since 4.0.0
 */
export function lowercased(annotations?: SchemaAnnotations.Filter) {
  return make((s: string) => s.toLowerCase() === s, {
    title: "lowercased",
    description: "a string with all characters in lowercase",
    jsonSchema: {
      type: "fragment",
      fragment: {
        pattern: LOWERCASED_PATTERN
      }
    },
    meta: {
      id: "lowercased"
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "string",
        patterns: [LOWERCASED_PATTERN]
      }
    },
    ...annotations
  })
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export function finite(annotations?: SchemaAnnotations.Filter) {
  return make((n: number) => globalThis.Number.isFinite(n), {
    title: "finite",
    description: "a finite number",
    meta: {
      id: "finite"
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "number",
        noDefaultInfinity: true,
        noNaN: true
      }
    },
    ...annotations
  })
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export function deriveGreaterThan<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMinimum: T) => SchemaAnnotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const greaterThan = Order.greaterThan(options.order)
  const format = options.format ?? formatUnknown
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
export function deriveGreaterThanOrEqualTo<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMinimum: T) => SchemaAnnotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const greaterThanOrEqualTo = Order.greaterThanOrEqualTo(options.order)
  const format = options.format ?? formatUnknown
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
export function deriveLessThan<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMaximum: T) => SchemaAnnotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const lessThan = Order.lessThan(options.order)
  const format = options.format ?? formatUnknown
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
export function deriveLessThanOrEqualTo<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMaximum: T) => SchemaAnnotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const lessThanOrEqualTo = Order.lessThanOrEqualTo(options.order)
  const format = options.format ?? formatUnknown
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
export function deriveBetween<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((minimum: T, maximum: T) => SchemaAnnotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const greaterThanOrEqualTo = Order.greaterThanOrEqualTo(options.order)
  const lessThanOrEqualTo = Order.lessThanOrEqualTo(options.order)
  const format = options.format ?? formatUnknown
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
export function deriveMultipleOf<T>(options: {
  readonly remainder: (input: T, divisor: T) => T
  readonly zero: NoInfer<T>
  readonly annotate?: ((divisor: T) => SchemaAnnotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  return (divisor: T, annotations?: SchemaAnnotations.Filter) => {
    const format = options.format ?? formatUnknown
    return make<T>((input) => options.remainder(input, divisor) === options.zero, {
      title: `multipleOf(${format(divisor)})`,
      description: `a value that is a multiple of ${format(divisor)}`,
      ...options.annotate?.(divisor),
      ...annotations
    })
  }
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
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "number",
        min: exclusiveMinimum,
        minExcluded: true
      }
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
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "number",
        min: minimum
      }
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
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "number",
        max: exclusiveMaximum,
        maxExcluded: true
      }
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
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "number",
        max: maximum
      }
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
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "number",
        min: minimum,
        max: maximum
      }
    }
  })
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export function positive(annotations?: SchemaAnnotations.Filter) {
  return greaterThan(0, annotations)
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export function negative(annotations?: SchemaAnnotations.Filter) {
  return lessThan(0, annotations)
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export function nonNegative(annotations?: SchemaAnnotations.Filter) {
  return greaterThanOrEqualTo(0, annotations)
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export function nonPositive(annotations?: SchemaAnnotations.Filter) {
  return lessThanOrEqualTo(0, annotations)
}

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
export function int(annotations?: SchemaAnnotations.Filter) {
  return make((n: number) => Number.isSafeInteger(n), {
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
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "number",
        isInteger: true
      }
    },
    ...annotations
  })
}

/**
 * @category Integer checks
 * @since 4.0.0
 */
export function int32(annotations?: SchemaAnnotations.Filter) {
  return new FilterGroup([
    int(annotations),
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
    },
    ...annotations
  })
}

/**
 * @category Integer checks
 * @since 4.0.0
 */
export function uint32(annotations?: SchemaAnnotations.Filter) {
  return new FilterGroup([
    int(),
    between(0, 4294967295)
  ], {
    title: "uint32",
    description: "a 32-bit unsigned integer",
    jsonSchema: {
      type: "fragment",
      fragment: {
        format: "uint32"
      }
    },
    meta: {
      id: "uint32"
    },
    ...annotations
  })
}

/**
 * @category Date checks
 * @since 4.0.0
 */
export function validDate(annotations?: SchemaAnnotations.Filter) {
  return make<Date>((date) => !isNaN(date.getTime()), {
    meta: {
      id: "validDate"
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "date",
        noInvalidDate: true
      }
    },
    ...annotations
  })
}

/**
 * @category Date checks
 * @since 4.0.0
 */
export const greaterThanOrEqualToDate = deriveGreaterThanOrEqualTo({
  order: Order.Date,
  annotate: (minimum) => ({
    meta: {
      id: "greaterThanOrEqualToDate",
      minimum
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "date",
        min: minimum
      }
    }
  })
})

/**
 * @category Date checks
 * @since 4.0.0
 */
export const lessThanOrEqualToDate = deriveLessThanOrEqualTo({
  order: Order.Date,
  annotate: (maximum) => ({
    meta: {
      id: "lessThanOrEqualToDate",
      maximum
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "date",
        max: maximum
      }
    }
  })
})

/**
 * @category Date checks
 * @since 4.0.0
 */
export const betweenDate = deriveBetween({
  order: Order.Date,
  annotate: (minimum, maximum) => ({
    meta: {
      id: "betweenDate",
      minimum,
      maximum
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "date",
        min: minimum,
        max: maximum
      }
    }
  })
})

/**
 * @category BigInt checks
 * @since 4.0.0
 */
export const greaterThanOrEqualToBigInt = deriveGreaterThanOrEqualTo({
  order: Order.bigint,
  annotate: (minimum) => ({
    meta: {
      id: "greaterThanOrEqualToBigInt",
      minimum
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "bigint",
        min: minimum
      }
    }
  })
})

/**
 * @category BigInt checks
 * @since 4.0.0
 */
export const lessThanOrEqualToBigInt = deriveLessThanOrEqualTo({
  order: Order.bigint,
  annotate: (maximum) => ({
    meta: {
      id: "lessThanOrEqualToBigInt",
      maximum
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "bigint",
        max: maximum
      }
    }
  })
})

/**
 * @category BigInt checks
 * @since 4.0.0
 */
export const betweenBigInt = deriveBetween({
  order: Order.bigint,
  annotate: (minimum, maximum) => ({
    meta: {
      id: "betweenBigInt",
      minimum,
      maximum
    },
    arbitrary: {
      type: "fragment",
      fragment: {
        type: "bigint",
        min: minimum,
        max: maximum
      }
    }
  })
})

/**
 * @category Length checks
 * @since 4.0.0
 */
export function minLength(minLength: number, annotations?: SchemaAnnotations.Filter) {
  minLength = Math.max(0, Math.floor(minLength))
  return make<{ readonly length: number }>((input) => input.length >= minLength, {
    title: `minLength(${minLength})`,
    description: `a value with a length of at least ${minLength}`,
    jsonSchema: {
      type: "fragments",
      fragments: {
        string: {
          minLength
        },
        array: {
          minItems: minLength
        }
      }
    },
    meta: {
      id: "minLength",
      minLength
    },
    "~structural": true,
    arbitrary: {
      type: "fragments",
      fragments: {
        string: {
          type: "string",
          minLength
        },
        array: {
          type: "array",
          minLength
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Length checks
 * @since 4.0.0
 */
export function nonEmpty(annotations?: SchemaAnnotations.Filter) {
  return minLength(1, annotations)
}

/**
 * @category Length checks
 * @since 4.0.0
 */
export function maxLength(maxLength: number, annotations?: SchemaAnnotations.Filter) {
  maxLength = Math.max(0, Math.floor(maxLength))
  return make<{ readonly length: number }>((input) => input.length <= maxLength, {
    title: `maxLength(${maxLength})`,
    description: `a value with a length of at most ${maxLength}`,
    jsonSchema: {
      type: "fragments",
      fragments: {
        string: {
          maxLength
        },
        array: {
          maxItems: maxLength
        }
      }
    },
    meta: {
      id: "maxLength",
      maxLength
    },
    "~structural": true,
    arbitrary: {
      type: "fragments",
      fragments: {
        string: {
          type: "string",
          maxLength
        },
        array: {
          type: "array",
          maxLength
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Length checks
 * @since 4.0.0
 */
export function length(length: number, annotations?: SchemaAnnotations.Filter) {
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
    },
    "~structural": true,
    arbitrary: {
      type: "fragments",
      fragments: {
        string: {
          type: "string",
          minLength: length,
          maxLength: length
        },
        array: {
          type: "array",
          minLength: length,
          maxLength: length
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Size checks
 * @since 4.0.0
 */
export function minSize(minSize: number, annotations?: SchemaAnnotations.Filter) {
  minSize = Math.max(0, Math.floor(minSize))
  return make<{ readonly size: number }>((input) => input.size >= minSize, {
    title: `minSize(${minSize})`,
    description: `a value with a size of at least ${minSize}`,
    meta: {
      id: "minSize",
      minSize
    },
    "~structural": true,
    arbitrary: {
      type: "fragments",
      fragments: {
        array: {
          type: "array",
          minLength: minSize
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Size checks
 * @since 4.0.0
 */
export function maxSize(maxSize: number, annotations?: SchemaAnnotations.Filter) {
  maxSize = Math.max(0, Math.floor(maxSize))
  return make<{ readonly size: number }>((input) => input.size <= maxSize, {
    title: `maxSize(${maxSize})`,
    description: `a value with a size of at most ${maxSize}`,
    meta: {
      id: "maxSize",
      maxSize
    },
    "~structural": true,
    arbitrary: {
      type: "fragments",
      fragments: {
        array: {
          type: "array",
          maxLength: maxSize
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Size checks
 * @since 4.0.0
 */
export function size(size: number, annotations?: SchemaAnnotations.Filter) {
  size = Math.max(0, Math.floor(size))
  return make<{ readonly size: number }>((input) => input.size === size, {
    title: `size(${size})`,
    description: `a value with a size of ${size}`,
    meta: {
      id: "size",
      size
    },
    "~structural": true,
    arbitrary: {
      type: "fragments",
      fragments: {
        array: {
          type: "array",
          minLength: size,
          maxLength: size
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Entries checks
 * @since 4.0.0
 */
export function minEntries(minEntries: number, annotations?: SchemaAnnotations.Filter) {
  minEntries = Math.max(0, Math.floor(minEntries))
  return make<object>((input) => Object.entries(input).length >= minEntries, {
    title: `minEntries(${minEntries})`,
    description: `an object with at least ${minEntries} entries`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        minProperties: minEntries
      }
    },
    meta: {
      id: "minEntries",
      minEntries
    },
    "~structural": true,
    arbitrary: {
      type: "fragments",
      fragments: {
        array: {
          type: "array",
          minLength: minEntries
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Entries checks
 * @since 4.0.0
 */
export function maxEntries(maxEntries: number, annotations?: SchemaAnnotations.Filter) {
  maxEntries = Math.max(0, Math.floor(maxEntries))
  return make<object>((input) => Object.entries(input).length <= maxEntries, {
    title: `maxEntries(${maxEntries})`,
    description: `an object with at most ${maxEntries} entries`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        maxProperties: maxEntries
      }
    },
    meta: {
      id: "maxEntries",
      maxEntries
    },
    "~structural": true,
    arbitrary: {
      type: "fragments",
      fragments: {
        array: {
          type: "array",
          maxLength: maxEntries
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Entries checks
 * @since 4.0.0
 */
export function entries(entries: number, annotations?: SchemaAnnotations.Filter) {
  entries = Math.max(0, Math.floor(entries))
  return make<object>((input) => Object.entries(input).length === entries, {
    title: `entries(${entries})`,
    description: `an object with exactly ${entries} entries`,
    jsonSchema: {
      type: "fragment",
      fragment: {
        minProperties: entries,
        maxProperties: entries
      }
    },
    meta: {
      id: "entries",
      entries
    },
    "~structural": true,
    arbitrary: {
      type: "fragments",
      fragments: {
        array: {
          type: "array",
          minLength: entries,
          maxLength: entries
        }
      }
    },
    ...annotations
  })
}
