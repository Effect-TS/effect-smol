import * as Equal from "../Equal.js"
import { dual } from "../Function.js"
import * as Hash from "../Hash.js"
import type { Option } from "../Option.js"
import { hasProperty } from "../Predicate.js"
import type * as Result from "../Result.js"
import { exitFail, exitSucceed, PipeProto, YieldableProto } from "./core.js"
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
  ...PipeProto,
  ...YieldableProto
}

const OkProto = Object.assign(Object.create(CommonProto), {
  _tag: "Ok",
  _op: "Ok",
  [Equal.symbol]<A, E>(this: Result.Ok<A, E>, that: unknown): boolean {
    return (
      isResult(that) && isOk(that) && Equal.equals(this.ok, that.ok)
    )
  },
  [Hash.symbol]<A, E>(this: Result.Ok<A, E>) {
    return Hash.combine(Hash.hash(this._tag))(Hash.hash(this.ok))
  },
  asEffect<L, R>(this: Result.Ok<L, R>) {
    return exitSucceed(this.ok)
  }
})

const ErrProto = Object.assign(Object.create(CommonProto), {
  _tag: "Err",
  _op: "Err",
  [Equal.symbol]<A, E>(this: Result.Err<A, E>, that: unknown): boolean {
    return isResult(that) && isErr(that) && Equal.equals(this.err, that.err)
  },
  [Hash.symbol]<A, E>(this: Result.Err<A, E>) {
    return Hash.combine(Hash.hash(this._tag))(Hash.hash(this.err))
  },
  asEffect<A, E>(this: Result.Err<A, E>) {
    return exitFail(this.err)
  }
})

/** @internal */
export const isResult = (input: unknown): input is Result.Result<unknown, unknown> => hasProperty(input, TypeId)

/** @internal */
export const isErr = <A, E>(result: Result.Result<A, E>): result is Result.Err<A, E> => result._tag === "Err"

/** @internal */
export const isOk = <A, E>(result: Result.Result<A, E>): result is Result.Ok<A, E> => result._tag === "Ok"

/** @internal */
export const err = <E>(err: E): Result.Result<never, E> => {
  const a = Object.create(ErrProto)
  a.err = err
  return a
}

/** @internal */
export const ok = <A>(ok: A): Result.Result<A> => {
  const a = Object.create(OkProto)
  a.ok = ok
  return a
}

/** @internal */
export const getErr = <A, E>(self: Result.Result<A, E>): Option<E> => isOk(self) ? option.none : option.some(self.err)

/** @internal */
export const getOk = <A, E>(self: Result.Result<A, E>): Option<A> => isErr(self) ? option.none : option.some(self.ok)

/** @internal */
export const fromOption: {
  <E>(onNone: () => E): <A>(self: Option<A>) => Result.Result<A, E>
  <A, E>(self: Option<A>, onNone: () => E): Result.Result<A, E>
} = dual(
  2,
  <A, E>(self: Option<A>, onNone: () => E): Result.Result<A, E> => option.isNone(self) ? err(onNone()) : ok(self.value)
)
