/**
 * This module provides types and utility functions to create and work with
 * branded types, which are TypeScript types with an added type tag to prevent
 * accidental usage of a value in the wrong context.
 *
 * The `refined` and `nominal` functions are both used to create branded types
 * in TypeScript. The main difference between them is that `refined` allows for
 * validation of the data, while `nominal` does not.
 *
 * The `nominal` function is used to create a new branded type that has the same
 * underlying type as the input, but with a different name. This is useful when
 * you want to distinguish between two values of the same type that have
 * different meanings. The `nominal` function does not perform any validation of
 * the input data.
 *
 * On the other hand, the `refined` function is used to create a new branded
 * type that has the same underlying type as the input, but with a different
 * name, and it also allows for validation of the input data. The `refined`
 * function takes a predicate that is used to validate the input data. If the
 * input data fails the validation, a `BrandErrors` is returned, which provides
 * information about the specific validation failure.
 *
 * @since 2.0.0
 */
import * as Arr from "../collections/Array.ts"
import { identity } from "../Function.ts"
import * as AST from "../schema/AST.ts"
import * as Check from "../schema/Check.ts"
import * as Formatter from "../schema/Formatter.ts"
import * as Issue from "../schema/Issue.ts"
import * as ToParser from "../schema/ToParser.ts"
import type * as Types from "../types/Types.ts"
import * as Data from "./Data.ts"
import * as Option from "./Option.ts"
import * as Result from "./Result.ts"

/**
 * @category symbols
 * @since 2.0.0
 */
export const TypeId: TypeId = "~effect/Brand"

/**
 * @category symbols
 * @since 2.0.0
 */
export type TypeId = "~effect/Brand"

/**
 * A generic interface that defines a branded type.
 *
 * **Example**
 *
 * ```ts
 * import { Brand } from "effect/data"
 *
 * type UserId = number & Brand.Brand<"UserId">
 * type ProductId = number & Brand.Brand<"ProductId">
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Brand<in out K extends string | symbol> {
  readonly [TypeId]: {
    readonly [k in K]: K
  }
}

/**
 * A constructor for a branded type that provides validation and safe
 * construction methods.
 *
 * @category models
 * @since 2.0.0
 */
export interface Constructor<in out A extends Brand<any>> {
  /**
   * Constructs a branded type from a value of type `A`, throwing an error if
   * the provided `A` is not valid.
   */
  (args: Brand.Unbranded<A>): A
  /**
   * Constructs a branded type from a value of type `A`, returning `Some<A>`
   * if the provided `A` is valid, `None` otherwise.
   */
  option(args: Brand.Unbranded<A>): Option.Option<A>
  /**
   * Constructs a branded type from a value of type `A`, returning `Ok<A>` if
   * the provided `A` is valid, `Err<BrandError>` otherwise.
   */
  result(args: Brand.Unbranded<A>): Result.Result<A, BrandError>
  /**
   * Attempts to refine the provided value of type `A`, returning `true` if
   * the provided `A` is valid, `false` otherwise.
   */
  is(a: Brand.Unbranded<A>): a is Brand.Unbranded<A> & A

  /**
   * The checks that are applied to the branded type.
   *
   * @internal
   */
  checks: readonly [Check.Check<Brand.Unbranded<A>>, ...ReadonlyArray<Check.Check<Brand.Unbranded<A>>>]
}

/**
 * @category models
 * @since 4.0.0
 */
export class BrandError extends Data.TaggedError("BrandError")<{
  readonly issue: Issue.Issue
}> {
  /**
   * @since 4.0.0
   */
  override get message() {
    return Formatter.makeDefault().format(this.issue)
  }
}

/**
 * @category models
 * @since 2.0.0
 */
export declare namespace Brand {
  /**
   * A utility type to extract a branded type from a `Constructor`.
   *
   * @category models
   * @since 2.0.0
   */
  export type FromConstructor<A> = A extends Constructor<infer B> ? B : never

  /**
   * A utility type to extract the value type from a brand.
   *
   * @category models
   * @since 2.0.0
   */
  export type Unbranded<P> = P extends infer Q & Brands<P> ? Q : P

  /**
   * A utility type to extract the brands from a branded type.
   *
   * @category models
   * @since 2.0.0
   */
  export type Brands<P> = P extends Brand<any> ? Types.UnionToIntersection<
      {
        [k in keyof P[TypeId]]: k extends string | symbol ? Brand<k>
          : never
      }[keyof P[TypeId]]
    >
    : never

  /**
   * A utility type that checks that all brands have the same base type.
   *
   * @category models
   * @since 2.0.0
   */
  export type EnsureCommonBase<
    Brands extends readonly [Constructor<any>, ...Array<Constructor<any>>]
  > = {
    [B in keyof Brands]: Brand.Unbranded<Brand.FromConstructor<Brands[0]>> extends
      Brand.Unbranded<Brand.FromConstructor<Brands[B]>>
      ? Brand.Unbranded<Brand.FromConstructor<Brands[B]>> extends Brand.Unbranded<Brand.FromConstructor<Brands[0]>>
        ? Brands[B]
      : Brands[B]
      : "ERROR: All brands should have the same base type"
  }
}

/**
 * A type alias for creating branded types more concisely.
 *
 * @category alias
 * @since 2.0.0
 */
export type Branded<A, K extends string | symbol> = A & Brand<K>

const nominal_ = make<any>(() => undefined)

/**
 * This function returns a `Constructor` that **does not apply any runtime
 * checks**, it just returns the provided value. It can be used to create
 * nominal types that allow distinguishing between two values of the same type
 * but with different meanings.
 *
 * If you also want to perform some validation, see {@link make} or
 * {@link check} or {@link refine}.
 *
 * @category constructors
 * @since 2.0.0
 */
export function nominal<A extends Brand<any>>(): Constructor<A> {
  return nominal_
}

/**
 * Returns a `Constructor` that can construct a branded type from an
 * unbranded value using the provided `refinement` predicate as validation of
 * the input data.
 *
 * If you don't want to perform any validation but only distinguish between two
 * values of the same type but with different meanings, see {@link nominal}.
 *
 * @category constructors
 * @since 2.0.0
 */
export function make<A extends Brand<any>>(
  f: (unbranded: Brand.Unbranded<A>) => undefined | boolean | string | Issue.Issue | {
    readonly path: ReadonlyArray<PropertyKey>
    readonly message: string
  }
): Constructor<A> {
  return check(Check.make(f))
}

/**
 * @since 4.0.0
 */
export function check<A extends Brand<any>>(
  ...checks: readonly [
    Check.Check<Brand.Unbranded<A>>,
    ...ReadonlyArray<Check.Check<Brand.Unbranded<A>>>
  ]
): Constructor<A> {
  const result = (input: Brand.Unbranded<A>): Result.Result<A, BrandError> => {
    const issues: Array<Issue.Issue> = []
    ToParser.runChecks(checks, input, issues, AST.unknownKeyword, { errors: "all" })
    const issue = Arr.isNonEmptyArray(issues) ?
      issues.length === 1 ?
        issues[0] :
        new Issue.Composite(AST.unknownKeyword, Option.some(input), issues) :
      undefined
    return issue ? Result.fail(new BrandError({ issue })) : Result.succeed(input as A)
  }
  return Object.assign((input: Brand.Unbranded<A>) => Result.getOrThrowWith(result(input), identity), {
    option: (input: Brand.Unbranded<A>) => Option.getSuccess(result(input)),
    result,
    is: (input: Brand.Unbranded<A>): input is Brand.Unbranded<A> & A => Result.isSuccess(result(input)),
    checks
  })
}

/**
 * @since 4.0.0
 */
export function refine<B extends string | symbol, T>(
  refine: Check.Refine<T & Brand<B>, T>
): Constructor<T & Brand<B>> {
  return check(refine as any)
}

/**
 * Combines two or more brands together to form a single branded type. This API
 * is useful when you want to validate that the input data passes multiple brand
 * validators.
 *
 * @category combining
 * @since 2.0.0
 */
export function all<Brands extends readonly [Constructor<any>, ...Array<Constructor<any>>]>(
  ...brands: Brand.EnsureCommonBase<Brands>
): Constructor<
  Types.UnionToIntersection<{ [B in keyof Brands]: Brand.FromConstructor<Brands[B]> }[number]> extends
    infer X extends Brand<any> ? X : Brand<any>
> {
  const checks = brands.flatMap((brand) => brand.checks)
  return Arr.isNonEmptyArray(checks) ?
    check(...checks) :
    nominal()
}
