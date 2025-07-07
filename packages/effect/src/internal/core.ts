import type * as Cause from "../Cause.js"
import type * as Effect from "../Effect.js"
import * as Equal from "../Equal.js"
import type * as Exit from "../Exit.js"
import { dual, identity } from "../Function.js"
import * as Hash from "../Hash.js"
import { format, NodeInspectSymbol } from "../Inspectable.js"
import { pipeArguments } from "../Pipeable.js"
import { hasProperty, isObject } from "../Predicate.js"
import type * as ServiceMap from "../ServiceMap.js"
import type { Span } from "../Tracer.js"
import type { Equals, NoInfer } from "../Types.js"
import { SingleShotGen, YieldWrap } from "../Utils.js"
import type { FiberImpl } from "./effect.js"
import { version } from "./version.js"

/** @internal */
export const TypeId: Effect.TypeId = `~effect/Effect/${version}` as const

/** @internal */
export const ExitTypeId: Exit.TypeId = `~effect/Exit/${version}` as const

const effectVariance = {
  _A: identity,
  _E: identity,
  _R: identity
}

/** @internal */
export const identifier = `${TypeId}/identifier` as const
/** @internal */
export type identifier = typeof identifier

/** @internal */
export const args = `${TypeId}/args` as const
/** @internal */
export type args = typeof args

/** @internal */
export const evaluate = `${TypeId}/evaluate` as const
/** @internal */
export type evaluate = typeof evaluate

/** @internal */
export const successCont = `${TypeId}/successCont` as const
/** @internal */
export type successCont = typeof successCont

/** @internal */
export const failureCont = `${TypeId}/failureCont` as const
/** @internal */
export type failureCont = typeof failureCont

/** @internal */
export const ensureCont = `${TypeId}/ensureCont` as const
/** @internal */
export type ensureCont = typeof ensureCont

/** @internal */
export const Yield = Symbol.for("effect/Effect/Yield")
/** @internal */
export type Yield = typeof Yield

/** @internal */
export const PipeInspectableProto = {
  pipe() {
    return pipeArguments(this, arguments)
  },
  toJSON(this: any) {
    return { ...this }
  },
  toString() {
    return format(this)
  },
  [NodeInspectSymbol]() {
    return this.toJSON()
  }
}

/** @internal */
export const YieldableProto = {
  [Symbol.iterator]() {
    return new SingleShotGen(new YieldWrap(this)) as any
  }
}

/** @internal */
export const EffectProto = {
  [TypeId]: effectVariance,
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(new YieldWrap(this)) as any
  },
  asEffect(): any {
    return this
  },
  toJSON(this: Primitive) {
    return {
      _id: "Effect",
      op: this[identifier],
      ...(args in this ? { args: this[args] } : undefined)
    }
  }
}

/** @internal */
export const StructuralPrototype: Equal.Equal = {
  [Hash.symbol]() {
    return Hash.cached(this, () => Hash.structure(this))
  },
  [Equal.symbol](this: Equal.Equal, that: Equal.Equal) {
    const selfKeys = Object.keys(this)
    const thatKeys = Object.keys(that as object)
    if (selfKeys.length !== thatKeys.length) {
      return false
    }
    for (const key of selfKeys) {
      if (
        !(
          key in (that as object) &&
          Equal.equals((this as any)[key], (that as any)[key])
        )
      ) {
        return false
      }
    }
    return true
  }
}
/** @internal */
export const isEffect = (u: unknown): u is Effect.Effect<any, any, any> => hasProperty(u, TypeId)

/** @internal */
export const isExit = (u: unknown): u is Exit.Exit<unknown, unknown> => hasProperty(u, ExitTypeId)

// ----------------------------------------------------------------------------
// Cause
// ----------------------------------------------------------------------------

/** @internal */
export const CauseTypeId: Cause.TypeId = "~effect/Cause"

/** @internal */
export const isCause = (self: unknown): self is Cause.Cause<unknown> => hasProperty(self, CauseTypeId)

/** @internal */
export class CauseImpl<E> implements Cause.Cause<E> {
  readonly [CauseTypeId]: Cause.TypeId
  constructor(
    readonly failures: ReadonlyArray<
      Cause.Fail<E> | Cause.Die | Cause.Interrupt
    >
  ) {
    this[CauseTypeId] = CauseTypeId
  }
  pipe() {
    return pipeArguments(this, arguments)
  }
  toJSON(): unknown {
    return {
      _id: "Cause",
      failures: this.failures.map((f) => f.toJSON())
    }
  }
  toString() {
    return format(this)
  }
  [NodeInspectSymbol]() {
    return this.toJSON()
  }
  [Equal.symbol](that: any): boolean {
    return (
      isCause(that) &&
      this.failures.length === that.failures.length &&
      this.failures.every((e, i) => Equal.equals(e, that.failures[i]))
    )
  }
  [Hash.symbol](): number {
    return Hash.cached(this, () => Hash.array(this.failures))
  }
}

const errorAnnotations = new WeakMap<object, ReadonlyMap<string, unknown>>()

/** @internal */
export abstract class FailureBase<Tag extends string> implements Cause.Cause.FailureProto<Tag> {
  readonly annotations: ReadonlyMap<string, unknown>

  constructor(
    readonly _tag: Tag,
    annotations: ReadonlyMap<string, unknown>,
    originalError: unknown
  ) {
    if (isObject(originalError)) {
      if (errorAnnotations.has(originalError)) {
        annotations = new Map([
          ...errorAnnotations.get(originalError)!,
          ...annotations
        ])
      }
      errorAnnotations.set(originalError, annotations)
    }
    this.annotations = annotations
  }

  abstract annotate<I, S>(this: any, tag: ServiceMap.Key<I, S>, value: S): this

  pipe() {
    return pipeArguments(this, arguments)
  }

  abstract toJSON(): unknown
  abstract [Equal.symbol](that: any): boolean
  abstract [Hash.symbol](): number

  toString() {
    return format(this)
  }

  [NodeInspectSymbol]() {
    return this.toString()
  }
}

class Fail<E> extends FailureBase<"Fail"> implements Cause.Fail<E> {
  constructor(
    readonly error: E,
    annotations = new Map<string, unknown>()
  ) {
    super("Fail", annotations, error)
  }
  toJSON(): unknown {
    return {
      _tag: "Fail",
      error: this.error
    }
  }
  annotate<I, S>(tag: ServiceMap.Key<I, S>, value: S): this {
    return new Fail(
      this.error,
      new Map([...this.annotations, [tag.key, value]])
    ) as this
  }
  [Equal.symbol](that: any): boolean {
    return (
      failureIsFail(that) &&
      Equal.equals(this.error, that.error) &&
      Equal.equals(this.annotations, that.annotations)
    )
  }
  [Hash.symbol](): number {
    return Hash.cached(this, () =>
      Hash.combine(Hash.string(this._tag))(
        Hash.combine(Hash.hash(this.error))(Hash.hash(this.annotations))
      ))
  }
}

/** @internal */
export const causeFromFailures = <E>(
  failures: ReadonlyArray<Cause.Failure<E>>
): Cause.Cause<E> => new CauseImpl(failures)

/** @internal */
export const causeFail = <E>(error: E): Cause.Cause<E> => new CauseImpl([new Fail(error)])

class Die extends FailureBase<"Die"> implements Cause.Die {
  constructor(
    readonly defect: unknown,
    annotations = new Map<string, unknown>()
  ) {
    super("Die", annotations, defect)
  }
  toJSON(): unknown {
    return {
      _tag: "Die",
      defect: this.defect
    }
  }
  annotate<I, S>(tag: ServiceMap.Key<I, S>, value: S): this {
    return new Die(
      this.defect,
      new Map([...this.annotations, [tag.key, value]])
    ) as this
  }
  [Equal.symbol](that: any): boolean {
    return (
      failureIsDie(that) &&
      Equal.equals(this.defect, that.defect) &&
      Equal.equals(this.annotations, that.annotations)
    )
  }
  [Hash.symbol](): number {
    return Hash.cached(this, () =>
      Hash.combine(Hash.string(this._tag))(
        Hash.combine(Hash.hash(this.defect))(Hash.hash(this.annotations))
      ))
  }
}

/** @internal */
export const causeDie = (defect: unknown): Cause.Cause<never> => new CauseImpl([new Die(defect)])

/** @internal */
export const causeAnnotate: {
  <I, S>(
    key: ServiceMap.Key<I, S>,
    value: NoInfer<S>
  ): <E>(self: Cause.Cause<E>) => Cause.Cause<E>
  <E, I, S>(
    self: Cause.Cause<E>,
    key: ServiceMap.Key<I, S>,
    value: NoInfer<S>
  ): Cause.Cause<E>
} = dual(
  3,
  <E, I, S>(
    self: Cause.Cause<E>,
    key: ServiceMap.Key<I, S>,
    value: NoInfer<S>
  ): Cause.Cause<E> => new CauseImpl(self.failures.map((f) => f.annotate(key, value)))
)

/** @internal */
export const failureIsFail = <E>(
  self: Cause.Failure<E>
): self is Cause.Fail<E> => self._tag === "Fail"

/** @internal */
export const failureIsDie = <E>(self: Cause.Failure<E>): self is Cause.Die => self._tag === "Die"

/** @internal */
export const failureIsInterrupt = <E>(self: Cause.Failure<E>): self is Cause.Interrupt => self._tag === "Interrupt"

/** @internal */
export interface Primitive {
  readonly [identifier]: string
  readonly [successCont]:
    | ((value: unknown, fiber: FiberImpl) => Primitive | Yield)
    | undefined
  readonly [failureCont]:
    | ((cause: Cause.Cause<unknown>, fiber: FiberImpl) => Primitive | Yield)
    | undefined
  readonly [ensureCont]:
    | ((
      fiber: FiberImpl
    ) =>
      | ((value: unknown, fiber: FiberImpl) => Primitive | Yield)
      | undefined)
    | undefined
  [evaluate](fiber: FiberImpl): Primitive | Yield
}

function defaultEvaluate(_fiber: FiberImpl): Primitive | Yield {
  return exitDie(`Effect.evaluate: Not implemented`) as any
}

/** @internal */
export const makePrimitiveProto = <Op extends string>(options: {
  readonly op: Op
  readonly eval?: (
    fiber: FiberImpl
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly contA?: (
    this: Primitive,
    value: any,
    fiber: FiberImpl
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly contE?: (
    this: Primitive,
    cause: Cause.Cause<any>,
    fiber: FiberImpl
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly ensure?: (
    this: Primitive,
    fiber: FiberImpl
  ) => void | ((value: any, fiber: FiberImpl) => void)
}): Primitive =>
  ({
    ...EffectProto,
    [identifier]: options.op,
    [evaluate]: options.eval ?? defaultEvaluate,
    [successCont]: options.contA,
    [failureCont]: options.contE,
    [ensureCont]: options.ensure
  }) as any

/** @internal */
export const makePrimitive = <
  Fn extends (...args: Array<any>) => any,
  Single extends boolean = true
>(options: {
  readonly op: string
  readonly single?: Single
  readonly eval?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    fiber: FiberImpl
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly contA?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    value: any,
    fiber: FiberImpl
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly contE?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    cause: Cause.Cause<any>,
    fiber: FiberImpl
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly ensure?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    fiber: FiberImpl
  ) => void | ((value: any, fiber: FiberImpl) => void)
}): Fn => {
  const Proto = makePrimitiveProto(options as any)
  return function() {
    const self = Object.create(Proto)
    self[args] = options.single === false ? arguments : arguments[0]
    return self
  } as Fn
}

/** @internal */
export const makeExit = <
  Fn extends (...args: Array<any>) => any,
  Prop extends string
>(options: {
  readonly op: "Success" | "Failure"
  readonly prop: Prop
  readonly eval: (
    this: Exit.Exit<unknown, unknown> & { [args]: Parameters<Fn>[0] },
    fiber: FiberImpl<unknown, unknown>
  ) => Primitive | Yield
}): Fn => {
  const Proto = {
    ...makePrimitiveProto(options),
    [ExitTypeId]: ExitTypeId,
    _tag: options.op,
    get [options.prop](): any {
      return (this as any)[args]
    },
    toJSON(this: any) {
      return {
        _id: "Exit",
        _tag: options.op,
        [options.prop]: this[args]
      }
    },
    [Equal.symbol](this: any, that: any): boolean {
      return (
        isExit(that) &&
        that._tag === options.op &&
        Equal.equals(this[args], (that as any)[args])
      )
    },
    [Hash.symbol](this: any): number {
      return Hash.cached(this, () => Hash.combine(Hash.string(options.op))(Hash.hash(this[args])))
    }
  }
  return function(value: unknown) {
    const self = Object.create(Proto)
    self[args] = value
    self[successCont] = undefined
    self[failureCont] = undefined
    self[ensureCont] = undefined
    return self
  } as Fn
}

/** @internal */
export const exitSucceed: <A>(a: A) => Exit.Exit<A> = makeExit({
  op: "Success",
  prop: "value",
  eval(fiber) {
    const cont = fiber.getCont(successCont)
    return cont ? cont[successCont](this[args], fiber) : fiber.yieldWith(this)
  }
})

const CurrentSpanKey = {
  key: "effect/Cause/CurrentSpan" satisfies typeof Cause.CurrentSpan.key
} as ServiceMap.Key<Cause.CurrentSpan, Span>

/** @internal */
export const exitFailCause: <E>(cause: Cause.Cause<E>) => Exit.Exit<never, E> = makeExit({
  op: "Failure",
  prop: "cause",
  eval(fiber) {
    let cause = this[args]
    if (fiber.currentSpan && fiber.currentSpan._tag === "Span") {
      cause = causeAnnotate(cause, CurrentSpanKey, fiber.currentSpan)
    }
    let cont = fiber.getCont(failureCont)
    while (fiber.interruptible && fiber._interruptedCause && cont) {
      cont = fiber.getCont(failureCont)
    }
    return cont ? cont[failureCont](cause, fiber) : fiber.yieldWith(this[args] === cause ? this : exitFailCause(cause))
  }
})

/** @internal */
export const exitFail = <E>(e: E): Exit.Exit<never, E> => exitFailCause(causeFail(e))

/** @internal */
export const exitDie = (defect: unknown): Exit.Exit<never> => exitFailCause(causeDie(defect))

/** @internal */
export const withFiber: <A, E = never, R = never>(
  evaluate: (fiber: FiberImpl<unknown, unknown>) => Effect.Effect<A, E, R>
) => Effect.Effect<A, E, R> = makePrimitive({
  op: "WithFiber",
  eval(fiber) {
    return this[args](fiber)
  }
})

/** @internal */
export const YieldableError: new(
  message?: string,
  options?: ErrorOptions
) => Cause.YieldableError = (function() {
  class YieldableError extends globalThis.Error {
    asEffect() {
      return exitFail(this)
    }
  }
  Object.assign(YieldableError.prototype, StructuralPrototype, YieldableProto)
  return YieldableError as any
})()

/** @internal */
export const Error: new<A extends Record<string, any> = {}>(
  args: Equals<A, {}> extends true ? void : { readonly [P in keyof A]: A[P] }
) => Cause.YieldableError & Readonly<A> = (function() {
  const plainArgsSymbol = Symbol.for("effect/Data/Error/plainArgs")
  return class Base extends YieldableError {
    constructor(args: any) {
      super(args?.message, args?.cause ? { cause: args.cause } : undefined)
      if (args) {
        Object.assign(this, args)
        Object.defineProperty(this, plainArgsSymbol, {
          value: args,
          enumerable: false
        })
      }
    }
    toJSON() {
      return { ...(this as any)[plainArgsSymbol], ...this }
    }
  } as any
})()

/** @internal */
export const TaggedError = <Tag extends string>(
  tag: Tag
): new<A extends Record<string, any> = {}>(
  args: Equals<A, {}> extends true ? void
    : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }
) => Cause.YieldableError & { readonly _tag: Tag } & Readonly<A> => {
  class Base extends Error<{}> {
    readonly _tag = tag
  }
  ;(Base.prototype as any).name = tag
  return Base as any
}

/** @internal */
export const NoSuchElementErrorTypeId: Cause.NoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError"

/** @internal */
export const isNoSuchElementError = (
  u: unknown
): u is Cause.NoSuchElementError => hasProperty(u, NoSuchElementErrorTypeId)

/** @internal */
export class NoSuchElementError extends TaggedError("NoSuchElementError") {
  readonly [NoSuchElementErrorTypeId]: Cause.NoSuchElementErrorTypeId = NoSuchElementErrorTypeId
  constructor(message?: string) {
    super({ message } as any)
  }
}
