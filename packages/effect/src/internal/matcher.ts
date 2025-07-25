import * as Option from "../data/Option.ts"
import type * as Predicate from "../data/Predicate.ts"
import * as Result from "../data/Result.ts"
import { dual, identity } from "../Function.ts"
import { pipeArguments } from "../interfaces/Pipeable.ts"
import type {
  Case,
  Matcher,
  MatcherTypeId,
  Not,
  SafeRefinement,
  TypeMatcher,
  Types,
  ValueMatcher,
  When
} from "../match/Match.ts"
import type { Unify } from "../types/Unify.ts"

/** @internal */
export const TypeId: MatcherTypeId = "~effect/Match/Matcher"

const TypeMatcherProto: Omit<TypeMatcher<any, any, any, any>, "cases"> = {
  [TypeId]: {
    _input: identity,
    _filters: identity,
    _remaining: identity,
    _result: identity,
    _return: identity
  },
  _tag: "TypeMatcher",
  add<I, R, RA, A>(
    this: TypeMatcher<any, any, any, any>,
    _case: Case
  ): TypeMatcher<I, R, RA, A> {
    return makeTypeMatcher([...this.cases, _case])
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

function makeTypeMatcher<I, R, RA, A>(
  cases: ReadonlyArray<Case>
): TypeMatcher<I, R, RA, A> {
  const matcher = Object.create(TypeMatcherProto)
  matcher.cases = cases
  return matcher
}

const ValueMatcherProto: Omit<
  ValueMatcher<any, any, any, any, any>,
  "provided" | "value"
> = {
  [TypeId]: {
    _input: identity,
    _filters: identity,
    _result: identity,
    _return: identity
  },
  _tag: "ValueMatcher",
  add<I, R, RA, A, Pr>(
    this: ValueMatcher<any, any, any, any, any>,
    _case: Case
  ): ValueMatcher<I, R, RA, A, Pr> {
    if (Result.isSuccess(this.value)) {
      return this
    }

    if (_case._tag === "When" && _case.guard(this.provided) === true) {
      return makeValueMatcher(
        this.provided,
        Result.succeed(_case.evaluate(this.provided))
      )
    } else if (_case._tag === "Not" && _case.guard(this.provided) === false) {
      return makeValueMatcher(
        this.provided,
        Result.succeed(_case.evaluate(this.provided))
      )
    }

    return this
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

function makeValueMatcher<I, R, RA, A, Pr>(
  provided: Pr,
  value: Result.Result<Pr, RA>
): ValueMatcher<I, R, RA, A, Pr> {
  const matcher = Object.create(ValueMatcherProto)
  matcher.provided = provided
  matcher.value = value
  return matcher
}

const makeWhen = (
  guard: (u: unknown) => boolean,
  evaluate: (input: unknown) => any
): When => ({
  _tag: "When",
  guard,
  evaluate
})

const makeNot = (
  guard: (u: unknown) => boolean,
  evaluate: (input: unknown) => any
): Not => ({
  _tag: "Not",
  guard,
  evaluate
})

const makePredicate = (pattern: unknown): Predicate.Predicate<unknown> => {
  if (typeof pattern === "function") {
    return pattern as Predicate.Predicate<unknown>
  } else if (Array.isArray(pattern)) {
    const predicates = pattern.map(makePredicate)
    const len = predicates.length

    return (u: unknown) => {
      if (!Array.isArray(u)) {
        return false
      }

      for (let i = 0; i < len; i++) {
        if (predicates[i](u[i]) === false) {
          return false
        }
      }

      return true
    }
  } else if (pattern !== null && typeof pattern === "object") {
    const keysAndPredicates = Object.entries(pattern).map(
      ([k, p]) => [k, makePredicate(p)] as const
    )
    const len = keysAndPredicates.length

    return (u: unknown) => {
      if (typeof u !== "object" || u === null) {
        return false
      }

      for (let i = 0; i < len; i++) {
        const [key, predicate] = keysAndPredicates[i]
        if (!(key in u) || predicate((u as any)[key]) === false) {
          return false
        }
      }

      return true
    }
  }

  return (u: unknown) => u === pattern
}

const makeOrPredicate = (
  patterns: ReadonlyArray<unknown>
): Predicate.Predicate<unknown> => {
  const predicates = patterns.map(makePredicate)
  const len = predicates.length

  return (u: unknown) => {
    for (let i = 0; i < len; i++) {
      if (predicates[i](u) === true) {
        return true
      }
    }

    return false
  }
}

const makeAndPredicate = (
  patterns: ReadonlyArray<unknown>
): Predicate.Predicate<unknown> => {
  const predicates = patterns.map(makePredicate)
  const len = predicates.length

  return (u: unknown) => {
    for (let i = 0; i < len; i++) {
      if (predicates[i](u) === false) {
        return false
      }
    }

    return true
  }
}

/** @internal */
export const type = <I>(): Matcher<
  I,
  Types.Without<never>,
  I,
  never,
  never
> => makeTypeMatcher([])

/** @internal */
export const value = <const I>(
  i: I
): Matcher<I, Types.Without<never>, I, never, I> => makeValueMatcher(i, Result.fail(i))

/** @internal */
export const valueTags: {
  <
    const I,
    P extends
      & { readonly [Tag in Types.Tags<"_tag", I> & string]: (_: Extract<I, { readonly _tag: Tag }>) => any }
      & { readonly [Tag in Exclude<keyof P, Types.Tags<"_tag", I>>]: never }
  >(fields: P): (input: I) => Unify<ReturnType<P[keyof P]>>
  <
    const I,
    P extends
      & { readonly [Tag in Types.Tags<"_tag", I> & string]: (_: Extract<I, { readonly _tag: Tag }>) => any }
      & { readonly [Tag in Exclude<keyof P, Types.Tags<"_tag", I>>]: never }
  >(input: I, fields: P): Unify<ReturnType<P[keyof P]>>
} = dual(
  2,
  <
    const I,
    P extends
      & { readonly [Tag in Types.Tags<"_tag", I> & string]: (_: Extract<I, { readonly _tag: Tag }>) => any }
      & { readonly [Tag in Exclude<keyof P, Types.Tags<"_tag", I>>]: never }
  >(input: I, fields: P): Unify<ReturnType<P[keyof P]>> => {
    const match: any = tagsExhaustive(fields as any)(makeTypeMatcher([]))
    return match(input)
  }
)

/** @internal */
export const typeTags = <I>() =>
<
  P extends {
    readonly [Tag in Types.Tags<"_tag", I> & string]: (
      _: Extract<I, { readonly _tag: Tag }>
    ) => any
  }
>(
  fields: P
) => {
  const match: any = tagsExhaustive(fields as any)(makeTypeMatcher([]))
  return (input: I): Unify<ReturnType<P[keyof P]>> => match(input)
}

/** @internal */
export const withReturnType = <Ret>() =>
<I, F, R, A, Pr, _>(self: Matcher<I, F, R, A, Pr, _>): [Ret] extends [
  [A] extends [never] ? any : A
] ? Matcher<I, F, R, A, Pr, Ret>
  : "withReturnType constraint does not extend Result type" => self as any

/** @internal */
export const when = <
  R,
  const P extends Types.PatternPrimitive<R> | Types.PatternBase<R>,
  Ret,
  Fn extends (_: Types.WhenMatch<R, P>) => Ret
>(
  pattern: P,
  f: Fn
) =>
<I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
): Matcher<
  I,
  Types.AddWithout<F, Types.PForExclude<P>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Types.PForExclude<P>>>,
  A | ReturnType<Fn>,
  Pr,
  Ret
> => (self as any).add(makeWhen(makePredicate(pattern), f as any))

/** @internal */
export const whenOr = <
  R,
  const P extends ReadonlyArray<
    Types.PatternPrimitive<R> | Types.PatternBase<R>
  >,
  Ret,
  Fn extends (_: Types.WhenMatch<R, P[number]>) => Ret
>(
  ...args: [...patterns: P, f: Fn]
) =>
<I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
): Matcher<
  I,
  Types.AddWithout<F, Types.PForExclude<P[number]>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Types.PForExclude<P[number]>>>,
  A | ReturnType<Fn>,
  Pr,
  Ret
> => {
  const onMatch = args[args.length - 1] as any
  const patterns = args.slice(0, -1) as unknown as P
  return (self as any).add(makeWhen(makeOrPredicate(patterns), onMatch))
}

/** @internal */
export const whenAnd = <
  R,
  const P extends ReadonlyArray<
    Types.PatternPrimitive<R> | Types.PatternBase<R>
  >,
  Ret,
  Fn extends (_: Types.WhenMatch<R, Types.ArrayToIntersection<P>>) => Ret
>(
  ...args: [...patterns: P, f: Fn]
) =>
<I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
): Matcher<
  I,
  Types.AddWithout<F, Types.PForExclude<Types.ArrayToIntersection<P>>>,
  Types.ApplyFilters<
    I,
    Types.AddWithout<F, Types.PForExclude<Types.ArrayToIntersection<P>>>
  >,
  A | ReturnType<Fn>,
  Pr
> => {
  const onMatch = args[args.length - 1] as any
  const patterns = args.slice(0, -1) as unknown as P
  return (self as any).add(makeWhen(makeAndPredicate(patterns), onMatch))
}

/** @internal */
export const discriminator = <D extends string>(field: D) =>
<
  R,
  P extends Types.Tags<D, R> & string,
  Ret,
  Fn extends (_: Extract<R, Record<D, P>>) => Ret
>(
  ...pattern: [
    first: P,
    ...values: Array<P>,
    f: Fn
  ]
) => {
  const f = pattern[pattern.length - 1]
  const values: Array<P> = pattern.slice(0, -1) as any
  const pred = values.length === 1
    ? (_: any) => _[field] === values[0]
    : (_: any) => values.includes(_[field])

  return <I, F, A, Pr>(
    self: Matcher<I, F, R, A, Pr, Ret>
  ): Matcher<
    I,
    Types.AddWithout<F, Extract<R, Record<D, P>>>,
    Types.ApplyFilters<I, Types.AddWithout<F, Extract<R, Record<D, P>>>>,
    A | ReturnType<Fn>,
    Pr,
    Ret
  > => (self as any).add(makeWhen(pred, f as any)) as any
}

/** @internal */
export const discriminatorStartsWith = <D extends string>(field: D) =>
<
  R,
  P extends string,
  Ret,
  Fn extends (_: Extract<R, Record<D, `${P}${string}`>>) => Ret
>(
  pattern: P,
  f: Fn
) => {
  const pred = (_: any) => typeof _[field] === "string" && _[field].startsWith(pattern)

  return <I, F, A, Pr>(
    self: Matcher<I, F, R, A, Pr, Ret>
  ): Matcher<
    I,
    Types.AddWithout<F, Extract<R, Record<D, `${P}${string}`>>>,
    Types.ApplyFilters<
      I,
      Types.AddWithout<F, Extract<R, Record<D, `${P}${string}`>>>
    >,
    A | ReturnType<Fn>,
    Pr,
    Ret
  > => (self as any).add(makeWhen(pred, f as any)) as any
}

/** @internal */
export const discriminators = <D extends string>(field: D) =>
<
  R,
  Ret,
  P extends
    & {
      readonly [Tag in Types.Tags<D, R> & string]?:
        | ((_: Extract<R, Record<D, Tag>>) => Ret)
        | undefined
    }
    & { readonly [Tag in Exclude<keyof P, Types.Tags<D, R>>]: never }
>(
  fields: P
) => {
  const predicate = makeWhen(
    (arg: any) => arg != null && arg[field] in fields,
    (data: any) => (fields as any)[data[field]](data)
  )

  return <I, F, A, Pr>(
    self: Matcher<I, F, R, A, Pr, Ret>
  ): Matcher<
    I,
    Types.AddWithout<F, Extract<R, Record<D, keyof P>>>,
    Types.ApplyFilters<I, Types.AddWithout<F, Extract<R, Record<D, keyof P>>>>,
    A | ReturnType<P[keyof P] & {}>,
    Pr,
    Ret
  > => (self as any).add(predicate)
}

/** @internal */
export const discriminatorsExhaustive: <D extends string>(
  field: D
) => <
  R,
  Ret,
  P extends
    & {
      readonly [Tag in Types.Tags<D, R> & string]: (
        _: Extract<R, Record<D, Tag>>
      ) => Ret
    }
    & { readonly [Tag in Exclude<keyof P, Types.Tags<D, R>>]: never }
>(
  fields: P
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => [Pr] extends [never] ? (u: I) => Unify<A | ReturnType<P[keyof P]>>
  : Unify<A | ReturnType<P[keyof P]>> = (field: string) => (fields: object) => {
    const addCases = discriminators(field)(fields)
    return (matcher: any) => exhaustive(addCases(matcher))
  }

/** @internal */
export const tag: <
  R,
  P extends Types.Tags<"_tag", R> & string,
  Ret,
  Fn extends (_: Extract<R, Record<"_tag", P>>) => Ret
>(
  ...pattern: [
    first: P,
    ...values: Array<P>,
    f: Fn
  ]
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => Matcher<
  I,
  Types.AddWithout<F, Extract<R, Record<"_tag", P>>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Extract<R, Record<"_tag", P>>>>,
  ReturnType<Fn> | A,
  Pr,
  Ret
> = discriminator("_tag")

/** @internal */
export const tagStartsWith = discriminatorStartsWith("_tag")

/** @internal */
export const tags = discriminators("_tag")

/** @internal */
export const tagsExhaustive = discriminatorsExhaustive("_tag")

/** @internal */
export const not = <
  R,
  const P extends Types.PatternPrimitive<R> | Types.PatternBase<R>,
  Ret,
  Fn extends (_: Types.NotMatch<R, P>) => Ret
>(
  pattern: P,
  f: Fn
) =>
<I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
): Matcher<
  I,
  Types.AddOnly<F, Types.WhenMatch<R, P>>,
  Types.ApplyFilters<I, Types.AddOnly<F, Types.WhenMatch<R, P>>>,
  A | ReturnType<Fn>,
  Pr,
  Ret
> => (self as any).add(makeNot(makePredicate(pattern), f as any))

/** @internal */
export const nonEmptyString: SafeRefinement<string, never> =
  ((u: unknown) => typeof u === "string" && u.length > 0) as any

/** @internal */
export const is: <
  Literals extends ReadonlyArray<string | number | boolean | null | bigint>
>(
  ...literals: Literals
) => SafeRefinement<Literals[number]> = (...literals): any => {
  const len = literals.length
  return (u: unknown) => {
    for (let i = 0; i < len; i++) {
      if (u === literals[i]) {
        return true
      }
    }
    return false
  }
}

/** @internal */
export const any: SafeRefinement<unknown, any> = (() => true) as any

/** @internal */
export const defined = <A>(u: A): u is A & {} => (u !== undefined && u !== null) as any

/** @internal */
export const instanceOf = <A extends abstract new(...args: any) => any>(
  constructor: A
): SafeRefinement<InstanceType<A>, never> => ((u: unknown) => u instanceof constructor) as any

/** @internal */
export const instanceOfUnsafe: <A extends abstract new(...args: any) => any>(
  constructor: A
) => SafeRefinement<InstanceType<A>, InstanceType<A>> = instanceOf

/** @internal */
export const orElse =
  <RA, Ret, F extends (_: RA) => Ret>(f: F) =>
  <I, R, A, Pr>(self: Matcher<I, R, RA, A, Pr, Ret>): [Pr] extends [never] ? (input: I) => Unify<ReturnType<F> | A>
    : Unify<ReturnType<F> | A> =>
  {
    const toResult = result(self)

    if (Result.isResult(toResult)) {
      // @ts-expect-error
      return toResult._tag === "Right" ? toResult.right : f(toResult.left)
    }

    // @ts-expect-error
    return (input: I) => {
      const a = toResult(input)
      return Result.isSuccess(a) ? a.success : f(a.failure)
    }
  }

/** @internal */
export const orElseAbsurd = <I, R, RA, A, Pr, Ret>(
  self: Matcher<I, R, RA, A, Pr, Ret>
): [Pr] extends [never] ? (input: I) => Unify<A> : Unify<A> =>
  orElse(() => {
    throw new Error("effect/Match/orElseAbsurd: absurd")
  })(self)

/** @internal */
export const result: <I, F, R, A, Pr, Ret>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => [Pr] extends [never] ? (input: I) => Result.Result<Unify<A>, R>
  : Result.Result<Unify<A>, R> = (<I, R, RA, A>(self: Matcher<I, R, RA, A, I>) => {
    if (self._tag === "ValueMatcher") {
      return self.value
    }

    const len = self.cases.length
    if (len === 1) {
      const _case = self.cases[0]
      return (input: I): Result.Result<A, RA> => {
        if (_case._tag === "When" && _case.guard(input) === true) {
          return Result.succeed(_case.evaluate(input))
        } else if (_case._tag === "Not" && _case.guard(input) === false) {
          return Result.succeed(_case.evaluate(input))
        }
        return Result.fail(input as any)
      }
    }
    return (input: I): Result.Result<A, RA> => {
      for (let i = 0; i < len; i++) {
        const _case = self.cases[i]
        if (_case._tag === "When" && _case.guard(input) === true) {
          return Result.succeed(_case.evaluate(input))
        } else if (_case._tag === "Not" && _case.guard(input) === false) {
          return Result.succeed(_case.evaluate(input))
        }
      }

      return Result.fail(input as any)
    }
  }) as any

/** @internal */
export const option: <I, F, R, A, Pr, Ret>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => [Pr] extends [never] ? (input: I) => Option.Option<Unify<A>>
  : Option.Option<Unify<A>> = (<I, A>(self: Matcher<I, any, any, A, I>) => {
    const toResult = result(self)
    if (Result.isResult(toResult)) {
      return Result.match(toResult, {
        onFailure: () => Option.none(),
        onSuccess: Option.some
      })
    }
    return (input: I): Option.Option<A> =>
      Result.match((toResult as any)(input), {
        onFailure: () => Option.none(),
        onSuccess: Option.some as any
      })
  }) as any

const getExhaustiveAbsurdErrorMessage = "effect/Match/exhaustive: absurd"

/** @internal */
export const exhaustive: <I, F, A, Pr, Ret>(
  self: Matcher<I, F, never, A, Pr, Ret>
) => [Pr] extends [never] ? (u: I) => Unify<A> : Unify<A> = (<I, F, A>(
  self: Matcher<I, F, never, A, I>
) => {
  const toResult = result(self as any)

  if (Result.isResult(toResult)) {
    if (Result.isSuccess(toResult)) {
      return toResult.success
    }

    throw new Error(getExhaustiveAbsurdErrorMessage)
  }

  return (u: I): A => {
    // @ts-expect-error
    const result = toResult(u)

    if (Result.isSuccess(result)) {
      return result.success as any
    }

    throw new Error(getExhaustiveAbsurdErrorMessage)
  }
}) as any
