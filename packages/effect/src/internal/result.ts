import * as Equal from "../Equal.js"
import { dual } from "../Function.js"
import * as Hash from "../Hash.js"
import { toJSON } from "../Inspectable.js"
import type { Option } from "../Option.js"
import { hasProperty } from "../Predicate.js"
import type * as Result from "../Result.js"
import { exitFail, exitSucceed, PipeInspectableProto, YieldableProto } from "./core.js"
import * as option from "./option.js"

/**
 * @internal
 */
export const TypeId: Result.TypeId = Symbol.for(
  "effect/Result"
) as Result.TypeId

const CommonProto = {
  [TypeId]: {
    /* v8 ignore next 2 */
    _A: (_: never) => _,
    _E: (_: never) => _
  },
  ...PipeInspectableProto,
  ...YieldableProto
}

const SuccessProto = Object.assign(Object.create(CommonProto), {
  _tag: "Success",
  _op: "Success",
  [Equal.symbol]<A, E>(this: Result.Success<A, E>, that: unknown): boolean {
    return (
      isResult(that) && isSuccess(that) && Equal.equals(this.success, that.success)
    )
  },
  [Hash.symbol]<A, E>(this: Result.Success<A, E>) {
    return Hash.combine(Hash.hash(this._tag))(Hash.hash(this.success))
  },
  toJSON<A, E>(this: Result.Success<A, E>) {
    return {
      _id: "Result",
      _tag: this._tag,
      value: toJSON(this.success)
    }
  },
  asEffect<L, R>(this: Result.Success<L, R>) {
    return exitSucceed(this.success)
  }
})

const FailureProto = Object.assign(Object.create(CommonProto), {
  _tag: "Failure",
  _op: "Failure",
  [Equal.symbol]<A, E>(this: Result.Failure<A, E>, that: unknown): boolean {
    return isResult(that) && isFailure(that) && Equal.equals(this.failure, that.failure)
  },
  [Hash.symbol]<A, E>(this: Result.Failure<A, E>) {
    return Hash.combine(Hash.hash(this._tag))(Hash.hash(this.failure))
  },
  toJSON<A, E>(this: Result.Failure<A, E>) {
    return {
      _id: "Result",
      _tag: this._tag,
      failure: toJSON(this.failure)
    }
  },
  asEffect<A, E>(this: Result.Failure<A, E>) {
    return exitFail(this.failure)
  }
})

/** @internal */
export const isResult = (input: unknown): input is Result.Result<unknown, unknown> => hasProperty(input, TypeId)

/** @internal */
export const isFailure = <A, E>(result: Result.Result<A, E>): result is Result.Failure<A, E> =>
  result._tag === "Failure"

/** @internal */
export const isSuccess = <A, E>(result: Result.Result<A, E>): result is Result.Success<A, E> =>
  result._tag === "Success"

/** @internal */
export const fail = <E>(failure: E): Result.Result<never, E> => {
  const a = Object.create(FailureProto)
  a.failure = failure
  return a
}

/** @internal */
export const succeed = <A>(success: A): Result.Result<A> => {
  const a = Object.create(SuccessProto)
  a.success = success
  return a
}

/** @internal */
export const getFailure = <A, E>(self: Result.Result<A, E>): Option<E> =>
  isSuccess(self) ? option.none : option.some(self.failure)

/** @internal */
export const getSuccess = <A, E>(self: Result.Result<A, E>): Option<A> =>
  isFailure(self) ? option.none : option.some(self.success)

/** @internal */
export const fromOption: {
  <E>(onNone: () => E): <A>(self: Option<A>) => Result.Result<A, E>
  <A, E>(self: Option<A>, onNone: () => E): Result.Result<A, E>
} = dual(
  2,
  <A, E>(self: Option<A>, onNone: () => E): Result.Result<A, E> =>
    option.isNone(self) ? fail(onNone()) : succeed(self.value)
)
