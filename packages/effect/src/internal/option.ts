/**
 * @since 2.0.0
 */
import type * as Option from "../data/Option.ts"
import { hasProperty } from "../data/Predicate.ts"
import * as Equal from "../interfaces/Equal.ts"
import * as Hash from "../interfaces/Hash.ts"
import { format, toJson } from "../interfaces/Inspectable.ts"
import { exitFail, exitSucceed, NoSuchElementError, PipeInspectableProto, YieldableProto } from "./core.ts"

const TypeId = "~effect/data/Option"

const CommonProto = {
  [TypeId]: {
    _A: (_: never) => _
  },
  ...PipeInspectableProto,
  ...YieldableProto
}

const SomeProto = Object.assign(Object.create(CommonProto), {
  _tag: "Some",
  _op: "Some",
  [Equal.symbol]<A>(this: Option.Some<A>, that: unknown): boolean {
    return (
      isOption(that) && isSome(that) && Equal.equals(this.value, that.value)
    )
  },
  [Hash.symbol]<A>(this: Option.Some<A>, context: Hash.HashContext) {
    return context.combine(context.hash(this._tag))(context.hash(this.value))
  },
  toString<A>(this: Option.Some<A>) {
    return `some(${format(this.value)})`
  },
  toJSON<A>(this: Option.Some<A>) {
    return {
      _id: "Option",
      _tag: this._tag,
      value: toJson(this.value)
    }
  },
  asEffect(this: Option.Some<unknown>) {
    return exitSucceed(this.value)
  }
})

const NoneProto = Object.assign(Object.create(CommonProto), {
  _tag: "None",
  _op: "None",
  [Equal.symbol]<A>(this: Option.None<A>, that: unknown): boolean {
    return isOption(that) && isNone(that)
  },
  [Hash.symbol]<A>(this: Option.None<A>, context: Hash.HashContext) {
    return context.hash("None")
  },
  toString<A>(this: Option.None<A>) {
    return `none()`
  },
  toJSON<A>(this: Option.None<A>) {
    return {
      _id: "Option",
      _tag: this._tag
    }
  },
  asEffect<A>(this: Option.None<A>) {
    return exitFail(new NoSuchElementError())
  }
})

/** @internal */
export const isOption = (input: unknown): input is Option.Option<unknown> => hasProperty(input, TypeId)

/** @internal */
export const isNone = <A>(fa: Option.Option<A>): fa is Option.None<A> => fa._tag === "None"

/** @internal */
export const isSome = <A>(fa: Option.Option<A>): fa is Option.Some<A> => fa._tag === "Some"

/** @internal */
export const none: Option.Option<never> = Object.create(NoneProto)

/** @internal */
export const some = <A>(value: A): Option.Option<A> => {
  const a = Object.create(SomeProto)
  a.value = value
  return a
}
