import type * as Cause from "../Cause.ts"
import type * as Context from "../Context.ts"
import type * as Effect from "../Effect.ts"
import * as Equal from "../Equal.ts"
import type * as Exit from "../Exit.ts"
import { format } from "../Formatter.ts"
import { dual, identity } from "../Function.ts"
import * as Hash from "../Hash.ts"
import { NodeInspectSymbol } from "../Inspectable.ts"
import { pipeArguments } from "../Pipeable.ts"
import { hasProperty } from "../Predicate.ts"
import type { StackFrame } from "../References.ts"
import type * as Types from "../Types.ts"
import { SingleShotGen } from "../Utils.ts"
import type { FiberImpl } from "./effect.ts"

/** @internal */
export const EffectTypeId = `~effect/Effect` as const

/** @internal */
export const ExitTypeId = `~effect/Exit` as const

const effectVariance = {
  _A: identity,
  _E: identity,
  _R: identity
}

/** @internal */
export const identifier = `${EffectTypeId}/identifier` as const
/** @internal */
export type identifier = typeof identifier

/** @internal */
export const args = `${EffectTypeId}/args` as const
/** @internal */
export type args = typeof args

/** @internal */
export const evaluate = `${EffectTypeId}/evaluate` as const
/** @internal */
export type evaluate = typeof evaluate

/** @internal */
export const contA = `${EffectTypeId}/successCont` as const
/** @internal */
export type contA = typeof contA

/** @internal */
export const contE = `${EffectTypeId}/failureCont` as const
/** @internal */
export type contE = typeof contE

/** @internal */
export const contAll = `${EffectTypeId}/ensureCont` as const
/** @internal */
export type contAll = typeof contAll

// ----------------------------------------------------------------------------
// Unified op-tag dispatch (Candidate B-v1: pure switch, no registry indirection)
//
// All 14 internal computation primitives share ONE prototype
// (SharedComputationProto in effect.ts). Success / Failure exit primitives
// share ANOTHER prototype (SharedExitProto below). The dispatch site
// `(current)[evaluate](this)` in runLoop therefore observes at most TWO
// hidden classes => stays within polymorphic IC threshold (V8 <=4, JSC
// similar) instead of going megamorphic over 14+ distinct prototypes.
//
// Critically (in contrast to candidate B-v0): the per-op evaluator bodies
// are inlined in a `switch (this[opTag])` directly on the shared proto's
// `[evaluate]` method. There is no per-call registry-array load and no
// per-call accessor getter for [contA] / [contE] / [contAll]. Continuation
// handlers are stored as instance own-properties with a fixed add-order so
// every instance shares a single hidden class.
// ----------------------------------------------------------------------------

/** @internal */
export const opTag = Symbol.for("effect/runtime/opTag")
/** @internal */
export type opTag = typeof opTag

// Dense integer ops. Order matches the historical primitives so existing
// reading paths remain consistent. Reserve 0 for "unknown" sentinel.
/** @internal */
export const OP_Sync = 1
/** @internal */
export const OP_Suspend = 2
/** @internal */
export const OP_Yield = 3
/** @internal */
export const OP_Async = 4
/** @internal */
export const OP_AsyncFinalizer = 5
/** @internal */
export const OP_Iterator = 6
/** @internal */
export const OP_OnSuccess = 7
/** @internal */
export const OP_OnFailure = 8
/** @internal */
export const OP_OnSuccessAndFailure = 9
/** @internal */
export const OP_Exit = 10
/** @internal */
export const OP_OnExit = 11
/** @internal */
export const OP_SetInterruptible = 12
/** @internal */
export const OP_While = 13
/** @internal */
export const OP_WithFiber = 14
// Exits live on a separate shared proto:
/** @internal */
export const OP_Success = 15
/** @internal */
export const OP_Failure = 16

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
    return format(this.toJSON(), { ignoreToString: true, space: 2 })
  },
  [NodeInspectSymbol]() {
    return this.toJSON()
  }
}

/** @internal */
export const StructuralProto = {
  [Hash.symbol](this: any): number {
    return Hash.structureKeys(this, Object.keys(this))
  },
  [Equal.symbol](this: any, that: any): boolean {
    const selfKeys = Object.keys(this)
    const thatKeys = Object.keys(that)
    if (selfKeys.length !== thatKeys.length) return false
    for (let i = 0; i < selfKeys.length; i++) {
      if (selfKeys[i] !== thatKeys[i] && !Equal.equals(this[selfKeys[i]], that[selfKeys[i]])) {
        return false
      }
    }
    return true
  }
}

/** @internal */
export const EffectProto = {
  [EffectTypeId]: effectVariance,
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this) as any
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
export const isEffect = (u: unknown): u is Effect.Effect<any, any, any> => hasProperty(u, EffectTypeId)

/** @internal */
export const isExit = (u: unknown): u is Exit.Exit<unknown, unknown> => hasProperty(u, ExitTypeId)

// ----------------------------------------------------------------------------
// Cause
// ----------------------------------------------------------------------------

/** @internal */
export const CauseTypeId = "~effect/Cause"

/** @internal */
export const CauseReasonTypeId = "~effect/Cause/Reason"

/** @internal */
export const isCause = (self: unknown): self is Cause.Cause<unknown> => hasProperty(self, CauseTypeId)

/** @internal */
export const isCauseReason = (self: unknown): self is Cause.Reason<unknown> => hasProperty(self, CauseReasonTypeId)

/** @internal */
export class CauseImpl<E> implements Cause.Cause<E> {
  readonly [CauseTypeId]: typeof CauseTypeId
  readonly reasons: ReadonlyArray<
    Cause.Fail<E> | Cause.Die | Cause.Interrupt
  >
  constructor(
    failures: ReadonlyArray<
      Cause.Fail<E> | Cause.Die | Cause.Interrupt
    >
  ) {
    this[CauseTypeId] = CauseTypeId
    this.reasons = failures
  }
  pipe() {
    return pipeArguments(this, arguments)
  }
  toJSON(): unknown {
    return {
      _id: "Cause",
      failures: this.reasons.map((f) => f.toJSON())
    }
  }
  toString() {
    return `Cause(${format(this.reasons)})`
  }
  [NodeInspectSymbol]() {
    return this.toJSON()
  }
  [Equal.symbol](that: any): boolean {
    return (
      isCause(that) &&
      this.reasons.length === that.reasons.length &&
      this.reasons.every((e, i) => Equal.equals(e, that.reasons[i]))
    )
  }
  [Hash.symbol](): number {
    return Hash.array(this.reasons)
  }
}

const annotationsMap = new WeakMap<object, ReadonlyMap<string, unknown>>()

/** @internal */
export abstract class ReasonBase<Tag extends string> implements Cause.Cause.ReasonProto<Tag> {
  readonly [CauseReasonTypeId]: typeof CauseReasonTypeId
  readonly annotations: ReadonlyMap<string, unknown>
  readonly _tag: Tag

  constructor(
    _tag: Tag,
    annotations: ReadonlyMap<string, unknown>,
    originalError: unknown
  ) {
    this[CauseReasonTypeId] = CauseReasonTypeId
    this._tag = _tag
    if (
      annotations !== constEmptyAnnotations && typeof originalError === "object" && originalError !== null &&
      annotations.size > 0
    ) {
      const prevAnnotations = annotationsMap.get(originalError)
      if (prevAnnotations) {
        annotations = new Map([
          ...prevAnnotations,
          ...annotations
        ])
      }
      annotationsMap.set(originalError, annotations)
    }
    this.annotations = annotations
  }

  annotate(
    annotations: Context.Context<never>,
    options?: { readonly overwrite?: boolean | undefined }
  ): this {
    if (annotations.mapUnsafe.size === 0) return this
    const newAnnotations = new Map(this.annotations)
    annotations.mapUnsafe.forEach((value, key) => {
      if (options?.overwrite !== true && newAnnotations.has(key)) return
      newAnnotations.set(key, value)
    })
    const self = Object.assign(Object.create(Object.getPrototypeOf(this)), this)
    self.annotations = newAnnotations
    return self
  }

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

/** @internal */
export const constEmptyAnnotations = new Map<string, unknown>()

/** @internal */
export class Fail<E> extends ReasonBase<"Fail"> implements Cause.Fail<E> {
  readonly error: E
  constructor(
    error: E,
    annotations = constEmptyAnnotations
  ) {
    super("Fail", annotations, error)
    this.error = error
  }
  override toString() {
    return `Fail(${format(this.error)})`
  }
  toJSON(): unknown {
    return {
      _tag: "Fail",
      error: this.error
    }
  }
  [Equal.symbol](that: any): boolean {
    return (
      isFailReason(that) &&
      Equal.equals(this.error, that.error) &&
      Equal.equals(this.annotations, that.annotations)
    )
  }
  [Hash.symbol](): number {
    return Hash.combine(Hash.string(this._tag))(
      Hash.combine(Hash.hash(this.error))(Hash.hash(this.annotations))
    )
  }
}

/** @internal */
export const causeFromReasons = <E>(
  reasons: ReadonlyArray<Cause.Reason<E>>
): Cause.Cause<E> => new CauseImpl(reasons)

/** @internal */
export const causeEmpty: Cause.Cause<never> = new CauseImpl([])

/** @internal */
export const causeFail = <E>(error: E): Cause.Cause<E> => new CauseImpl([new Fail(error)])

/** @internal */
export class Die extends ReasonBase<"Die"> implements Cause.Die {
  readonly defect: unknown
  constructor(
    defect: unknown,
    annotations = constEmptyAnnotations
  ) {
    super("Die", annotations, defect)
    this.defect = defect
  }
  override toString() {
    return `Die(${format(this.defect)})`
  }
  toJSON(): unknown {
    return {
      _tag: "Die",
      defect: this.defect
    }
  }
  [Equal.symbol](that: any): boolean {
    return (
      isDieReason(that) &&
      Equal.equals(this.defect, that.defect) &&
      Equal.equals(this.annotations, that.annotations)
    )
  }
  [Hash.symbol](): number {
    return Hash.combine(Hash.string(this._tag))(
      Hash.combine(Hash.hash(this.defect))(Hash.hash(this.annotations))
    )
  }
}

/** @internal */
export const causeDie = (defect: unknown): Cause.Cause<never> => new CauseImpl([new Die(defect)])

/** @internal */
export const causeAnnotate: {
  (
    annotations: Context.Context<never>,
    options?: {
      readonly overwrite?: boolean | undefined
    }
  ): <E>(self: Cause.Cause<E>) => Cause.Cause<E>
  <E>(
    self: Cause.Cause<E>,
    annotations: Context.Context<never>,
    options?: {
      readonly overwrite?: boolean | undefined
    }
  ): Cause.Cause<E>
} = dual(
  (args) => isCause(args[0]),
  <E>(
    self: Cause.Cause<E>,
    annotations: Context.Context<never>,
    options?: {
      readonly overwrite?: boolean | undefined
    }
  ): Cause.Cause<E> => {
    if (annotations.mapUnsafe.size === 0) return self
    return new CauseImpl(self.reasons.map((f) => f.annotate(annotations, options)))
  }
)

/** @internal */
export const isFailReason = <E>(
  self: Cause.Reason<E>
): self is Cause.Fail<E> => self._tag === "Fail"

/** @internal */
export const isDieReason = <E>(self: Cause.Reason<E>): self is Cause.Die => self._tag === "Die"

/** @internal */
export const isInterruptReason = <E>(self: Cause.Reason<E>): self is Cause.Interrupt => self._tag === "Interrupt"

/** @internal */
export interface Primitive {
  readonly [identifier]: string
  readonly [contA]:
    | ((value: unknown, fiber: FiberImpl, exit?: Exit.Exit<any, any>) => Primitive | Yield)
    | undefined
  readonly [contE]:
    | ((cause: Cause.Cause<unknown>, fiber: FiberImpl, exit?: Exit.Exit<any, any>) => Primitive | Yield)
    | undefined
  readonly [contAll]:
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

// ---------------------------------------------------------------------------
// V1.3 — per-instance [evaluate].
//
// V1 used a shared [evaluate] on SharedComputationProto that switched on
// this[opTag] and dispatched through module-level `let` slots. The switch +
// indirection cost an extra branch + an indirect call through a mutable
// binding per run-loop step. V1.3 stores the evaluator as an own-property
// on each instance, set at construction time, so the run loop reads
// `current[evaluate]` directly at proto-chain level 0 and calls it.
//
// Trade-off: call IC at the dispatch site goes from 1 target (monomorphic)
// to N targets (polymorphic-by-op). JSC's polymorphic call IC handles small
// N cheaply; the switch's load + mutable-let indirection was per-step cost
// the IC could never amortize.
// ---------------------------------------------------------------------------

type EvalFn = (this: any, fiber: FiberImpl) => Primitive | Yield
type ContAFn = (this: any, value: any, fiber: FiberImpl, exit?: Exit.Exit<any, any>) => Primitive | Yield
type ContEFn = (
  this: any,
  cause: Cause.Cause<any>,
  fiber: FiberImpl,
  exit?: Exit.Exit<any, any>
) => Primitive | Yield
type ContAllFn = (this: any, fiber: FiberImpl) => void | ((value: any, fiber: FiberImpl) => void)

// Stack-push evaluator: OnSuccess, OnFailure, and OnSuccessAndFailure all
// share this body. Their semantic distinction lives in their continuation
// handlers ([contA] / [contE] / [contAll]), not in their evaluator. Sharing
// one function reference also collapses three distinct call-IC targets at
// the dispatch site down to one.
const evaluateStackPush: EvalFn = function(this: any, fiber: FiberImpl): Primitive {
  fiber._stack.push(this)
  return this[args]
}

/** @internal */
export const SharedComputationProto: object = {
  ...EffectProto
}

/** @internal */
export const makePrimitiveProto = <Op extends string>(options: {
  readonly op: Op
  readonly [evaluate]?: (
    fiber: FiberImpl
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly [contA]?: (
    this: Primitive,
    value: any,
    fiber: FiberImpl
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly [contE]?: (
    this: Primitive,
    cause: Cause.Cause<any>,
    fiber: FiberImpl
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly [contAll]?: (
    this: Primitive,
    fiber: FiberImpl
  ) => void | ((value: any, fiber: FiberImpl) => void)
}): Primitive =>
  ({
    ...EffectProto,
    [identifier]: options.op,
    [evaluate]: options[evaluate] ?? defaultEvaluate,
    [contA]: options[contA],
    [contE]: options[contE],
    [contAll]: options[contAll]
  }) as any

/** @internal */
export const makePrimitive = <
  Fn extends (...args: Array<any>) => any,
  Single extends boolean = true
>(options: {
  readonly op: string
  readonly opTag: number
  readonly single?: Single
  readonly [evaluate]?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    fiber: FiberImpl
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly [contA]?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    value: any,
    fiber: FiberImpl,
    exit?: Exit.Exit<any, any>
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly [contE]?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    cause: Cause.Cause<any>,
    fiber: FiberImpl,
    exit?: Exit.Exit<any, any>
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly [contAll]?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    fiber: FiberImpl
  ) => void | ((value: any, fiber: FiberImpl) => void)
}): Fn => {
  const opTagValue = options.opTag
  const opName = options.op
  const single = options.single !== false
  const evalFn: EvalFn = (options[evaluate] as EvalFn | undefined) ?? defaultEvaluate
  const cA = options[contA] as ContAFn | undefined
  const cE = options[contE] as ContEFn | undefined
  const cAll = options[contAll] as ContAllFn | undefined
  // Unified instance factory. Property add-order is FIXED across all 14
  // internal computation primitives to keep a single hidden class:
  //   [identifier], [opTag], [args], [contA], [contE], [contAll], [evaluate]
  // Handlers default to undefined; ops with a handler overwrite the slot
  // *after* the undefined assignment (same slot, same shape).
  return function() {
    const self = Object.create(SharedComputationProto)
    self[identifier] = opName
    self[opTag] = opTagValue
    self[args] = single ? arguments[0] : arguments
    self[contA] = undefined
    self[contE] = undefined
    self[contAll] = undefined
    self[evaluate] = evalFn
    if (cA !== undefined) self[contA] = cA
    if (cE !== undefined) self[contE] = cE
    if (cAll !== undefined) self[contAll] = cAll
    return self
  } as Fn
}

/**
 * @internal
 *
 * Allocate a fresh OnSuccess primitive without going through `makePrimitive`.
 * Used by hot factories (`flatMap`, `catchCause`, `matchCauseEffect`) that need
 * to attach a user-supplied callback per-instance. Property add-order matches
 * `makePrimitive` exactly so all SharedComputationProto instances share one
 * hidden class.
 */
export const makeOnSuccess = <A>(
  self: Effect.Effect<A, any, any>,
  onSuccess: (value: A) => Effect.Effect<any, any, any>
): Primitive => {
  const out: any = Object.create(SharedComputationProto)
  out[identifier] = "OnSuccess"
  out[opTag] = OP_OnSuccess
  out[args] = self
  out[contA] = onSuccess
  out[contE] = undefined
  out[contAll] = undefined
  out[evaluate] = evaluateStackPush
  return out
}

/**
 * @internal
 *
 * Allocate a fresh OnFailure primitive without going through `makePrimitive`.
 * Matches the canonical add-order so all instances share one hidden class.
 */
export const makeOnFailure = <E>(
  self: Effect.Effect<any, E, any>,
  onFailure: (cause: Cause.Cause<E>) => Effect.Effect<any, any, any>
): Primitive => {
  const out: any = Object.create(SharedComputationProto)
  out[identifier] = "OnFailure"
  out[opTag] = OP_OnFailure
  out[args] = self
  out[contA] = undefined
  out[contE] = onFailure
  out[contAll] = undefined
  out[evaluate] = evaluateStackPush
  return out
}

/**
 * @internal
 *
 * Allocate a fresh OnSuccessAndFailure primitive without going through
 * `makePrimitive`. Matches the canonical add-order.
 */
export const makeOnSuccessAndFailure = <A, E>(
  self: Effect.Effect<A, E, any>,
  onSuccess: (value: A) => Effect.Effect<any, any, any>,
  onFailure: (cause: Cause.Cause<E>) => Effect.Effect<any, any, any>
): Primitive => {
  const out: any = Object.create(SharedComputationProto)
  out[identifier] = "OnSuccessAndFailure"
  out[opTag] = OP_OnSuccessAndFailure
  out[args] = self
  out[contA] = onSuccess
  out[contE] = onFailure
  out[contAll] = undefined
  out[evaluate] = evaluateStackPush
  return out
}


// ---------------------------------------------------------------------------
// SharedExitProto: ONE prototype shared by both Success and Failure instances.
//
// Both exits expose `value` (Success) AND `cause` (Failure) on the shared
// proto as getters returning this[args]. The selector is purely conventional;
// the instance shape is identical. `_tag` is the discriminant.
// ---------------------------------------------------------------------------

let EVAL_Success: EvalFn = defaultEvaluate
let EVAL_Failure: EvalFn = defaultEvaluate

/** @internal */
export const SharedExitProto: object = (() => {
  const proto: any = {
    ...EffectProto,
    [ExitTypeId]: ExitTypeId,
    toString(this: any) {
      return `${this._tag}(${format(this[args])})`
    },
    toJSON(this: any) {
      return {
        _id: "Exit",
        _tag: this._tag,
        [this._tag === "Success" ? "value" : "cause"]: this[args]
      }
    },
    [Equal.symbol](this: any, that: any): boolean {
      return (
        isExit(that) &&
        that._tag === this._tag &&
        Equal.equals(this[args], (that as any)[args])
      )
    },
    [Hash.symbol](this: any): number {
      return Hash.combine(Hash.string(this._tag), Hash.hash(this[args]))
    }
  }
  // Both `value` and `cause` accessors live on the shared proto, each reading
  // from this[args]. The non-matching name is harmless: Success.cause and
  // Failure.value both return the underlying payload, but callers consult
  // _tag before reading.
  Object.defineProperty(proto, "value", {
    get(this: any) {
      return this[args]
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(proto, "cause", {
    get(this: any) {
      return this[args]
    },
    enumerable: true,
    configurable: true
  })
  return proto
})()

/** @internal */
export const exitSucceed: <A>(a: A) => Exit.Exit<A> = (() => {
  EVAL_Success = function(this: any, fiber) {
    const cont = fiber.getCont(contA)
    return cont ? cont[contA](this[args], fiber, this) : fiber.yieldWith(this)
  }
  return function(value: unknown): Exit.Exit<any> {
    const self: any = Object.create(SharedExitProto)
    self[identifier] = "Success"
    self[opTag] = OP_Success
    self[args] = value
    self._tag = "Success"
    self[evaluate] = EVAL_Success
    return self
  } as any
})()

/** @internal */
export const StackTraceKey = {
  key: "effect/Cause/StackTrace" satisfies typeof Cause.StackTrace.key
} as Context.Service<Cause.StackTrace, StackFrame>

/** @internal */
export const InterruptorStackTrace = {
  key: "effect/Cause/InterruptorStackTrace" satisfies typeof Cause.InterruptorStackTrace.key
} as Context.Service<Cause.InterruptorStackTrace, StackFrame>

/** @internal */
export const exitFailCause: <E>(cause: Cause.Cause<E>) => Exit.Exit<never, E> = (() => {
  EVAL_Failure = function(this: any, fiber) {
    let cause = this[args]
    let annotated = false
    if (fiber.currentStackFrame) {
      cause = causeAnnotate(cause, { mapUnsafe: new Map([[StackTraceKey.key, fiber.currentStackFrame]]) } as any)
      annotated = true
    }
    let cont = fiber.getCont(contE)
    while (fiber.interruptible && fiber._interruptedCause && cont) {
      cont = fiber.getCont(contE)
    }
    return cont
      ? cont[contE](cause, fiber, annotated ? undefined : this)
      : fiber.yieldWith(annotated ? this : exitFailCause(cause))
  }
  return function(cause: unknown): Exit.Exit<never, any> {
    const self: any = Object.create(SharedExitProto)
    self[identifier] = "Failure"
    self[opTag] = OP_Failure
    self[args] = cause
    self._tag = "Failure"
    self[evaluate] = EVAL_Failure
    return self
  } as any
})()

/** @internal */
export const exitFail = <E>(e: E): Exit.Exit<never, E> => exitFailCause(causeFail(e))

/** @internal */
export const exitDie = (defect: unknown): Exit.Exit<never> => exitFailCause(causeDie(defect))

/** @internal */
export const withFiber: <A, E = never, R = never>(
  evaluate: (fiber: FiberImpl<unknown, unknown>) => Effect.Effect<A, E, R>
) => Effect.Effect<A, E, R> = makePrimitive({
  op: "WithFiber",
  opTag: OP_WithFiber,
  [evaluate](fiber) {
    return this[args](fiber)
  }
})

/** @internal */
export const YieldableError: new(
  message?: string,
  options?: ErrorOptions
) => Cause.YieldableError = (function() {
  class YieldableError extends globalThis.Error {}
  const proto = makePrimitiveProto({
    op: "YieldableError",
    [evaluate]() {
      return exitFail(this)
    }
  })
  delete (proto as any).toString
  Object.assign(
    YieldableError.prototype,
    proto
  )
  return YieldableError as any
})()

/** @internal */
export const Error: new<A extends Record<string, any> = {}>(
  args: Types.VoidIfEmpty<{ readonly [P in keyof A]: A[P] }>
) => Cause.YieldableError & Readonly<A> = (function() {
  const plainArgsSymbol = Symbol.for("effect/Data/Error/plainArgs")
  return class Base extends YieldableError {
    constructor(args: any) {
      super(args?.message, args?.cause ? { cause: args.cause } : undefined)
      if (args) {
        Object.assign(this, args)
        // @effect-diagnostics-next-line floatingEffect:off
        Object.defineProperty(this, plainArgsSymbol, {
          value: args,
          enumerable: false
        })
      }
    }
    override toJSON() {
      return { ...(this as any)[plainArgsSymbol], ...this }
    }
  } as any
})()

/** @internal */
export const TaggedError = <Tag extends string>(
  tag: Tag
): new<A extends Record<string, any> = {}>(
  args: Types.VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>
) => Cause.YieldableError & { readonly _tag: Tag } & Readonly<A> => {
  class Base extends Error<{}> {
    readonly _tag = tag
  }
  ;(Base.prototype as any).name = tag
  return Base as any
}

/** @internal */
export const NoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError"

/** @internal */
export const isNoSuchElementError = (
  u: unknown
): u is Cause.NoSuchElementError => hasProperty(u, NoSuchElementErrorTypeId)

/** @internal */
export class NoSuchElementError extends TaggedError("NoSuchElementError") {
  readonly [NoSuchElementErrorTypeId] = NoSuchElementErrorTypeId
  constructor(message?: string) {
    super({ message } as any)
  }
}

/** @internal */
export const DoneTypeId = "~effect/Cause/Done"

/** @internal */
export const isDone = (
  u: unknown
): u is Cause.Done => hasProperty(u, DoneTypeId)

const DoneVoid: Cause.Done<void> = {
  [DoneTypeId]: DoneTypeId,
  _tag: "Done",
  value: undefined
}

/** @internal */
export const Done = <A = void>(value?: A): Cause.Done<A> => {
  if (value === undefined) return DoneVoid as Cause.Done<A>
  return {
    [DoneTypeId]: DoneTypeId,
    _tag: "Done",
    value
  }
}

const doneVoid = exitFail(DoneVoid)

/** @internal */
export const done = <A = void>(value?: A): Effect.Effect<never, Cause.Done<A>> => {
  if (value === undefined) return doneVoid as any
  return exitFail(Done(value))
}
