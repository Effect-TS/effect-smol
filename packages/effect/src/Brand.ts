/**
 * This module provides types and utility functions to create and work with branded types,
 * which are TypeScript types with an added type tag to prevent accidental usage of a value in the wrong context.
 *
 * The `refined` and `nominal` functions are both used to create branded types in TypeScript.
 * The main difference between them is that `refined` allows for validation of the data, while `nominal` does not.
 *
 * The `nominal` function is used to create a new branded type that has the same underlying type as the input, but with a different name.
 * This is useful when you want to distinguish between two values of the same type that have different meanings.
 * The `nominal` function does not perform any validation of the input data.
 *
 * On the other hand, the `refined` function is used to create a new branded type that has the same underlying type as the input,
 * but with a different name, and it also allows for validation of the input data.
 * The `refined` function takes a predicate that is used to validate the input data.
 * If the input data fails the validation, a `BrandErrors` is returned, which provides information about the specific validation failure.
 *
 * @since 2.0.0
 */
import * as Arr from "./Array.ts"
import { identity } from "./Function.ts"
import * as Option from "./Option.ts"
import type { Predicate } from "./Predicate.ts"
import * as Result from "./Result.ts"
import type * as Types from "./Types.ts"

/**
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * // TypeId is used internally for branded type identification
 * console.log(Brand.TypeId) // "~effect/Brand"
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/Brand"

/**
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * // TypeId represents the branded type identifier
 * type BrandTypeId = Brand.TypeId
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export type TypeId = "~effect/Brand"

/**
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * // RefinedConstructorsTypeId is used internally for refined constructor identification
 * console.log(Brand.RefinedConstructorsTypeId) // "~effect/Brand/Refined"
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export const RefinedConstructorsTypeId: RefinedConstructorsTypeId = "~effect/Brand/Refined"

/**
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * // RefinedConstructorsTypeId represents the refined constructor identifier
 * type RefineTypeId = Brand.RefinedConstructorsTypeId
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export type RefinedConstructorsTypeId = "~effect/Brand/Refined"

/**
 * A generic interface that defines a branded type.
 *
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * // Brand interface is used to create branded types
 * type UserId = string & Brand.Brand<"UserId">
 * type ProductId = number & Brand.Brand<"ProductId">
 *
 * // These types are now distinct from their base types
 * declare const userId: UserId
 * declare const productId: ProductId
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
 * A namespace providing utilities for working with branded types and their validation.
 *
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * // Define a branded type
 * type UserId = string & Brand.Brand<"UserId">
 *
 * // Create a constructor with validation
 * const UserId = Brand.refined<UserId>(
 *   (s) => s.length > 0,
 *   () => Brand.error("UserId cannot be empty")
 * )
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export declare namespace Brand {
  /**
   * Represents a list of refinement errors.
   *
   * @example
   * ```ts
   * import { Brand } from "effect"
   *
   * // BrandErrors represents validation failures
   * const error1 = Brand.error("Invalid value", { value: 42 })
   * const error2 = Brand.error("Out of range", { min: 0, max: 100 })
   * const combined = Brand.errors(error1, error2)
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export interface BrandErrors extends Array<RefinementError> {}

  /**
   * Represents an error that occurs when the provided value of the branded type does not pass the refinement predicate.
   *
   * @example
   * ```ts
   * import { Brand } from "effect"
   *
   * // RefinementError represents a validation failure
   * const error = Brand.error("Value must be positive", { value: -5, expected: "> 0" })
   * console.log(error[0].message) // "Value must be positive"
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export interface RefinementError {
    readonly meta: unknown
    readonly message: string
  }

  /**
   * A constructor for a branded type that provides validation and safe construction methods.
   *
   * @example
   * ```ts
   * import { Brand } from "effect"
   *
   * type PositiveNumber = number & Brand.Brand<"Positive">
   * const PositiveNumber = Brand.refined<PositiveNumber>(
   *   (n) => n > 0,
   *   (n) => Brand.error(`Expected ${n} to be positive`)
   * )
   *
   * const result = PositiveNumber(5) // PositiveNumber
   * const optional = PositiveNumber.option(-1) // None
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export interface Constructor<in out A extends Brand<any>> {
    readonly [RefinedConstructorsTypeId]: RefinedConstructorsTypeId
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
     * Constructs a branded type from a value of type `A`, returning `Ok<A>`
     * if the provided `A` is valid, `Err<BrandError>` otherwise.
     */
    result(args: Brand.Unbranded<A>): Result.Result<A, Brand.BrandErrors>
    /**
     * Attempts to refine the provided value of type `A`, returning `true` if
     * the provided `A` is valid, `false` otherwise.
     */
    is(a: Brand.Unbranded<A>): a is Brand.Unbranded<A> & A
  }

  /**
   * A utility type to extract a branded type from a `Brand.Constructor`.
   *
   * @example
   * ```ts
   * import { Brand } from "effect"
   *
   * type PositiveNumber = number & Brand.Brand<"Positive">
   * const PositiveNumber = Brand.refined<PositiveNumber>(
   *   (n) => n > 0,
   *   (n) => Brand.error(`Expected ${n} to be positive`)
   * )
   *
   * // FromConstructor utility is used internally for type operations
   * const validNumber = PositiveNumber(5)
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export type FromConstructor<A> = A extends Brand.Constructor<infer B> ? B : never

  /**
   * A utility type to extract the value type from a brand.
   *
   * @example
   * ```ts
   * import { Brand } from "effect"
   *
   * type UserId = string & Brand.Brand<"UserId">
   * const UserId = Brand.nominal<UserId>()
   *
   * // Unbranded utility extracts the base type
   * const id: string = UserId("user-123")
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export type Unbranded<P> = P extends infer Q & Brands<P> ? Q : P

  /**
   * A utility type to extract the brands from a branded type.
   *
   * @example
   * ```ts
   * import { Brand } from "effect"
   *
   * type UserId = string & Brand.Brand<"UserId">
   * const UserId = Brand.nominal<UserId>()
   *
   * // Brands utility extracts brand information
   * const id = UserId("user-123")
   * ```
   *
   * @since 2.0.0
   * @category models
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
   * @example
   * ```ts
   * import { Brand } from "effect"
   *
   * type Int = number & Brand.Brand<"Int">
   * type Positive = number & Brand.Brand<"Positive">
   * const Int = Brand.refined<Int>((n) => Number.isInteger(n), (n) => Brand.error("Not an integer"))
   * const Positive = Brand.refined<Positive>((n) => n > 0, (n) => Brand.error("Not positive"))
   *
   * // This ensures both constructors have same base type
   * const both = Brand.all(Int, Positive)
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export type EnsureCommonBase<
    Brands extends readonly [Brand.Constructor<any>, ...Array<Brand.Constructor<any>>]
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
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * type UserId = Brand.Branded<string, "UserId">
 * // Equivalent to: string & Brand.Brand<"UserId">
 * ```
 *
 * @category alias
 * @since 2.0.0
 */
export type Branded<A, K extends string | symbol> = A & Brand<K>

/**
 * Returns a `BrandErrors` that contains a single `RefinementError`.
 *
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * const validationError = Brand.error("Value must be positive", { value: -5 })
 * console.log(validationError)
 * // [{ message: "Value must be positive", meta: { value: -5 } }]
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const error = (message: string, meta?: unknown): Brand.BrandErrors => [{
  message,
  meta
}]

/**
 * Takes a variable number of `BrandErrors` and returns a single `BrandErrors` that contains all refinement errors.
 *
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * const error1 = Brand.error("Must be positive")
 * const error2 = Brand.error("Must be integer")
 * const combined = Brand.errors(error1, error2)
 * console.log(combined)
 * // [
 * //   { message: "Must be positive", meta: undefined },
 * //   { message: "Must be integer", meta: undefined }
 * // ]
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const errors: (...errors: Array<Brand.BrandErrors>) => Brand.BrandErrors = (
  ...errors: Array<Brand.BrandErrors>
): Brand.BrandErrors => Arr.flatten(errors)

/**
 * Returns a `Brand.Constructor` that can construct a branded type from an unbranded value using the provided `refinement`
 * predicate as validation of the input data.
 *
 * If you don't want to perform any validation but only distinguish between two values of the same type but with different meanings,
 * see {@link nominal}.
 *
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * type Int = number & Brand.Brand<"Int">
 *
 * const Int = Brand.refined<Int>(
 *   (n) => Number.isInteger(n),
 *   (n) => Brand.error(`Expected ${n} to be an integer`)
 * )
 *
 * console.log(Int(1)) // 1
 * console.log(Int.option(1.1)) // { _tag: "None" }
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export function refined<A extends Brand<any>>(
  f: (unbranded: Brand.Unbranded<A>) => Option.Option<Brand.BrandErrors>
): Brand.Constructor<A>
export function refined<A extends Brand<any>>(
  refinement: Predicate<Brand.Unbranded<A>>,
  onFailure: (unbranded: Brand.Unbranded<A>) => Brand.BrandErrors
): Brand.Constructor<A>
export function refined<A extends Brand<any>>(
  ...args: [(unbranded: Brand.Unbranded<A>) => Option.Option<Brand.BrandErrors>] | [
    Predicate<Brand.Unbranded<A>>,
    (unbranded: Brand.Unbranded<A>) => Brand.BrandErrors
  ]
): Brand.Constructor<A> {
  const result: (unbranded: Brand.Unbranded<A>) => Result.Result<A, Brand.BrandErrors> = args.length === 2 ?
    (unbranded) => args[0](unbranded) ? Result.succeed(unbranded as A) : Result.fail(args[1](unbranded)) :
    (unbranded) => {
      return Option.match(args[0](unbranded), {
        onNone: () => Result.succeed(unbranded as A),
        onSome: Result.fail
      })
    }
  return Object.assign((unbranded: Brand.Unbranded<A>) => Result.getOrThrowWith(result(unbranded), identity), {
    [RefinedConstructorsTypeId]: RefinedConstructorsTypeId,
    option: (args: any) => Option.getOk(result(args)),
    result,
    is: (args: any): args is Brand.Unbranded<A> & A => Result.isSuccess(result(args))
  }) as any
}

/**
 * This function returns a `Brand.Constructor` that **does not apply any runtime checks**, it just returns the provided value.
 * It can be used to create nominal types that allow distinguishing between two values of the same type but with different meanings.
 *
 * If you also want to perform some validation, see {@link refined}.
 *
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * type UserId = string & Brand.Brand<"UserId">
 * type ProductId = string & Brand.Brand<"ProductId">
 *
 * const UserId = Brand.nominal<UserId>()
 * const ProductId = Brand.nominal<ProductId>()
 *
 * const userId = UserId("user-123")
 * const productId = ProductId("prod-456")
 *
 * // These are now distinct types at compile time
 * console.log(userId) // "user-123"
 * console.log(productId) // "prod-456"
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const nominal = <A extends Brand<any>>(): Brand.Constructor<
  A
> => {
  // @ts-expect-error
  return Object.assign((args) => args, {
    [RefinedConstructorsTypeId]: RefinedConstructorsTypeId,
    option: (args: any) => Option.some(args),
    result: (args: any) => Result.succeed(args),
    is: (_args: any): _args is Brand.Unbranded<A> & A => true
  })
}

/**
 * Combines two or more brands together to form a single branded type.
 * This API is useful when you want to validate that the input data passes multiple brand validators.
 *
 * @example
 * ```ts
 * import { Brand } from "effect"
 *
 * type Int = number & Brand.Brand<"Int">
 * const Int = Brand.refined<Int>(
 *   (n) => Number.isInteger(n),
 *   (n) => Brand.error(`Expected ${n} to be an integer`)
 * )
 * type Positive = number & Brand.Brand<"Positive">
 * const Positive = Brand.refined<Positive>(
 *   (n) => n > 0,
 *   (n) => Brand.error(`Expected ${n} to be positive`)
 * )
 *
 * const PositiveInt = Brand.all(Int, Positive)
 *
 * console.log(PositiveInt(1)) // 1
 * console.log(PositiveInt.option(-1)) // { _tag: "None" }
 * console.log(PositiveInt.option(1.1)) // { _tag: "None" }
 * ```
 *
 * @since 2.0.0
 * @category combining
 */
export const all: <Brands extends readonly [Brand.Constructor<any>, ...Array<Brand.Constructor<any>>]>(
  ...brands: Brand.EnsureCommonBase<Brands>
) => Brand.Constructor<
  Types.UnionToIntersection<{ [B in keyof Brands]: Brand.FromConstructor<Brands[B]> }[number]> extends
    infer X extends Brand<any> ? X : Brand<any>
> = <
  Brands extends readonly [Brand.Constructor<any>, ...Array<Brand.Constructor<any>>]
>(...brands: Brand.EnsureCommonBase<Brands>): Brand.Constructor<
  Types.UnionToIntersection<
    {
      [B in keyof Brands]: Brand.FromConstructor<Brands[B]>
    }[number]
  > extends infer X extends Brand<any> ? X : Brand<any>
> => {
  const result = (args: any): Result.Result<any, Brand.BrandErrors> => {
    let result: Result.Result<any, Brand.BrandErrors> = Result.succeed(args)
    for (const brand of brands) {
      const nextResult = brand.result(args)
      if (Result.isFailure(result) && Result.isFailure(nextResult)) {
        result = Result.fail([...result.failure, ...nextResult.failure])
      } else {
        result = Result.isFailure(result) ? result : nextResult
      }
    }
    return result
  }
  // @ts-expect-error
  return Object.assign((args) =>
    Result.match(result(args), {
      onFailure: (e) => {
        throw e
      },
      onSuccess: identity
    }), {
    [RefinedConstructorsTypeId]: RefinedConstructorsTypeId,
    option: (args: any) => Option.getOk(result(args)),
    result,
    is: (args: any): args is any => Result.isSuccess(result(args))
  })
}
