import * as Arr from "../Array.js"
import type * as Cause from "../Cause.js"
import type * as Clock from "../Clock.js"
import type * as Console from "../Console.js"
import * as Duration from "../Duration.js"
import type * as Effect from "../Effect.js"
import * as Equal from "../Equal.js"
import type * as Exit from "../Exit.js"
import type * as Fiber from "../Fiber.js"
import * as Filter from "../Filter.js"
import type { LazyArg } from "../Function.js"
import { constant, constTrue, constVoid, dual, identity } from "../Function.js"
import * as Hash from "../Hash.js"
import { redact, stringifyCircular, toJSON } from "../Inspectable.js"
import type * as Logger from "../Logger.js"
import type * as LogLevel from "../LogLevel.js"
import type * as Metric from "../Metric.js"
import * as Option from "../Option.js"
import * as Order from "../Order.js"
import { pipeArguments } from "../Pipeable.js"
import { hasProperty, isIterable, isString, isTagged } from "../Predicate.js"
import {
  CurrentConcurrency,
  CurrentLogAnnotations,
  CurrentLogLevel,
  CurrentLogSpans,
  MinimumLogLevel,
  TracerEnabled,
  TracerSpanAnnotations,
  TracerSpanLinks
} from "../References.js"
import * as Result from "../Result.js"
import * as Scheduler from "../Scheduler.js"
import type * as Scope from "../Scope.js"
import * as ServiceMap from "../ServiceMap.js"
import * as Tracer from "../Tracer.js"
import type { Concurrency, ExcludeTag, ExtractTag, NoInfer, NotFunction, Simplify, Tags } from "../Types.js"
import type { YieldWrap } from "../Utils.js"
import { internalCall, yieldWrapGet } from "../Utils.js"
import type { Primitive } from "./core.js"
import {
  args,
  causeAnnotate,
  causeDie,
  causeFail,
  causeFromFailures,
  CauseImpl,
  contA,
  contAll,
  contE,
  CurrentSpanKey,
  evaluate,
  exitDie,
  exitFail,
  exitFailCause,
  exitSucceed,
  ExitTypeId,
  FailureBase,
  failureIsDie,
  failureIsFail,
  InterruptorSpanKey,
  isCause,
  isEffect,
  makePrimitive,
  makePrimitiveProto,
  NoSuchElementError,
  TaggedError,
  withFiber,
  Yield
} from "./core.js"
import * as doNotation from "./doNotation.js"
import * as InternalMetric from "./metric.js"
import { addSpanStackTrace } from "./tracer.js"
import { version } from "./version.js"

// ----------------------------------------------------------------------------
// Cause
// ----------------------------------------------------------------------------

class Interrupt extends FailureBase<"Interrupt"> implements Cause.Interrupt {
  constructor(
    readonly fiberId: Option.Option<number>,
    annotations = new Map<string, unknown>()
  ) {
    super("Interrupt", annotations, "Interrupted")
  }
  toJSON(): unknown {
    return {
      _tag: "Interrupt",
      fiberId: this.fiberId
    }
  }
  annotate<I, S>(key: ServiceMap.Key<I, S>, value: S, options?: {
    readonly overwrite?: boolean | undefined
  }): this {
    if (options?.overwrite !== true && this.annotations.has(key.key)) {
      return this
    }
    return new Interrupt(
      this.fiberId,
      new Map([...this.annotations, [key.key, value]])
    ) as this
  }
  [Equal.symbol](that: any): boolean {
    return (
      failureIsInterrupt(that) &&
      Equal.equals(this.fiberId, that.fiberId) &&
      Equal.equals(this.annotations, that.annotations)
    )
  }
  [Hash.symbol](): number {
    return Hash.cached(this, () =>
      Hash.combine(Hash.string(this._tag))(
        Hash.combine(Hash.hash(this.fiberId))(Hash.hash(this.annotations))
      ))
  }
}

/** @internal */
export const causeInterrupt = (
  fiberId?: number | undefined
): Cause.Cause<never> => new CauseImpl([new Interrupt(Option.fromNullable(fiberId))])

/** @internal */
export const causeHasFail = <E>(self: Cause.Cause<E>): boolean => self.failures.some(failureIsFail)

/** @internal */
export const causeFilterFail = <E>(self: Cause.Cause<E>): Cause.Fail<E> | Filter.fail<Cause.Cause<never>> => {
  const failure = self.failures.find(failureIsFail)
  return failure ? failure : Filter.fail(self as Cause.Cause<never>)
}

/** @internal */
export const causeFilterError = <E>(self: Cause.Cause<E>): E | Filter.fail<Cause.Cause<never>> => {
  const failure = self.failures.find(failureIsFail)
  return failure ? failure.error : Filter.fail(self as Cause.Cause<never>)
}

/** @internal */
export const causeHasDie = <E>(self: Cause.Cause<E>): boolean => self.failures.some(failureIsDie)

/** @internal */
export const causeFilterDie = <E>(self: Cause.Cause<E>): Cause.Die | Filter.fail<Cause.Cause<E>> => {
  const failure = self.failures.find(failureIsDie)
  return failure ? failure : Filter.fail(self)
}

const causeFilterDefect = <E>(self: Cause.Cause<E>): unknown | Filter.fail<Cause.Cause<E>> => {
  const failure = self.failures.find(failureIsDie)
  return failure ? failure.defect : Filter.fail(self)
}

/** @internal */
export const causeHasInterrupt = <E>(self: Cause.Cause<E>): boolean => self.failures.some(failureIsInterrupt)

/** @internal */
export const causeFilterInterrupt = <E>(self: Cause.Cause<E>): Cause.Interrupt | Filter.fail<Cause.Cause<E>> => {
  const failure = self.failures.find(failureIsInterrupt)
  return failure ? failure : Filter.fail(self)
}

/** @internal */
export const causeFilterInterruptor: <E>(self: Cause.Cause<E>) => number | Filter.fail<Cause.Cause<E>> = Filter
  .unsafeCompose(
    causeFilterInterrupt,
    (_) => _.fiberId._tag === "Some" ? _.fiberId.value : Filter.fail(_)
  )

/** @internal */
export const causeFilterInterruptors = <E>(self: Cause.Cause<E>): ReadonlySet<number> | Filter.fail<Cause.Cause<E>> => {
  const interruptors = new Set<number>()
  for (const f of self.failures) {
    if (f._tag === "Interrupt" && f.fiberId._tag === "Some") {
      interruptors.add(f.fiberId.value)
    }
  }
  return interruptors.size > 0 ? interruptors : Filter.fail(self)
}

/** @internal */
export const causeIsInterruptedOnly = <E>(self: Cause.Cause<E>): boolean => self.failures.every(failureIsInterrupt)

/** @internal */
export const failureIsInterrupt = <E>(
  self: Cause.Failure<E>
): self is Cause.Interrupt => isTagged(self, "Interrupt")

/** @internal */
export const failureAnnotations = <E>(
  self: Cause.Failure<E>
): ServiceMap.ServiceMap<never> => ServiceMap.unsafeMake(self.annotations)

/** @internal */
export const causeAnnotations = <E>(
  self: Cause.Cause<E>
): ServiceMap.ServiceMap<never> => {
  const map = new Map<string, unknown>()
  for (const f of self.failures) {
    if (f.annotations.size > 0) {
      for (const [key, value] of f.annotations) {
        map.set(key, value)
      }
    }
  }
  return ServiceMap.unsafeMake(map)
}

/** @internal */
export const causeMerge: {
  <E2>(that: Cause.Cause<E2>): <E>(self: Cause.Cause<E>) => Cause.Cause<E | E2>
  <E, E2>(self: Cause.Cause<E>, that: Cause.Cause<E2>): Cause.Cause<E | E2>
} = dual(
  2,
  <E, E2>(self: Cause.Cause<E>, that: Cause.Cause<E2>): Cause.Cause<E | E2> => {
    const newCause = new CauseImpl<E | E2>(
      Arr.union(self.failures, that.failures)
    )
    return self[Equal.symbol](newCause) ? self : newCause
  }
)

/** @internal */
export const causePartition = <E>(
  self: Cause.Cause<E>
): {
  readonly Fail: ReadonlyArray<Cause.Fail<E>>
  readonly Die: ReadonlyArray<Cause.Die>
  readonly Interrupt: ReadonlyArray<Cause.Interrupt>
} => {
  const obj = {
    Fail: [] as Array<Cause.Fail<E>>,
    Die: [] as Array<Cause.Die>,
    Interrupt: [] as Array<Cause.Interrupt>
  }
  for (let i = 0; i < self.failures.length; i++) {
    obj[self.failures[i]._tag].push(self.failures[i] as any)
  }
  return obj
}

/** @internal */
export const causeSquash = <E>(self: Cause.Cause<E>): unknown => {
  const partitioned = causePartition(self)
  if (partitioned.Fail.length > 0) {
    return partitioned.Fail[0].error
  } else if (partitioned.Die.length > 0) {
    return partitioned.Die[0].defect
  } else if (partitioned.Interrupt.length > 0) {
    return new globalThis.Error("All fibers interrupted without error")
  }
  return new globalThis.Error("Empty cause")
}

/** @internal */
export const causePrettyErrors = <E>(self: Cause.Cause<E>): Array<Error> => {
  const errors: Array<Error> = []
  const interrupts: Array<Cause.Interrupt> = []
  if (self.failures.length === 0) return errors

  const prevStackLimit = Error.stackTraceLimit
  Error.stackTraceLimit = 1

  for (const failure of self.failures) {
    if (failure._tag === "Interrupt") {
      interrupts.push(failure)
      continue
    }
    errors.push(
      causePrettyError(
        failure._tag === "Die" ? failure.defect : failure.error as any,
        failure.annotations.get(CurrentSpanKey.key) as any
      )
    )
  }
  if (errors.length === 0) {
    const cause = new Error("The fiber was interrupted by:")
    cause.name = "InterruptCause"
    cause.stack = interruptCauseStack(cause, interrupts)
    const error = new globalThis.Error("All fibers interrupted without error", { cause })
    error.name = "InterruptError"
    error.stack = `${error.name}: ${error.message}`
    errors.push(causePrettyError(error, interrupts[0].annotations.get(CurrentSpanKey.key) as any))
  }

  Error.stackTraceLimit = prevStackLimit
  return errors
}

const causePrettyError = (original: Record<string, unknown> | Error, span?: Tracer.Span): Error => {
  const kind = typeof original
  let error: Error
  if (original && kind === "object") {
    error = new globalThis.Error(extractErrorMessage(original), {
      cause: original.cause ? causePrettyError(original.cause as any) : undefined
    })
    if (typeof original.name === "string") {
      error.name = original.name
    }
    if (typeof original.stack === "string") {
      error.stack = cleanErrorStack(original.stack, error, span)
    }
    for (const key of Object.keys(original)) {
      if (!(key in error)) {
        ;(error as any)[key] = (original as any)[key]
      }
    }
  } else {
    error = new globalThis.Error(
      !original ? `Unknown error: ${original}` : kind === "string" ? original as any : stringifyCircular(original)
    )
  }
  return error
}

const extractErrorMessage = (u: Record<string, unknown> | Error): string => {
  if (typeof u.message === "string") {
    return u.message
  } else if (
    typeof u.toString === "function"
    && u.toString !== Object.prototype.toString
    && u.toString !== Array.prototype.toString
  ) {
    try {
      return u.toString()
    } catch {
      // something's off, rollback to json
    }
  }
  return stringifyCircular(u)
}

const locationRegex = /\((.*)\)/g

const cleanErrorStack = (stack: string, error: Error, span: Tracer.Span | undefined): string => {
  const message = `${error.name}: ${error.message}`
  const lines = (stack.startsWith(message) ? stack.slice(message.length) : stack).split("\n")
  const out: Array<string> = [message]
  for (let i = 1; i < lines.length; i++) {
    if (/(?:Generator\.next|~effect\/Effect)/.test(lines[i])) {
      break
    }
    out.push(lines[i])
  }
  if (span) pushSpanStack(out, span)
  return out.join("\n")
}

const interruptCauseStack = (error: Error, interrupts: Array<Cause.Interrupt>): string => {
  const out: Array<string> = [`${error.name}: ${error.message}`]
  for (const current of interrupts) {
    const fiberId = current.fiberId._tag === "Some" ? `#${current.fiberId.value}` : "unknown"
    const span = current.annotations.get(InterruptorSpanKey.key) as Tracer.Span | undefined
    out.push(`    at fiber (${fiberId})`)
    if (span) pushSpanStack(out, span)
  }
  return out.join("\n")
}

const pushSpanStack = (out: Array<string>, span: Tracer.Span) => {
  let current: Tracer.AnySpan | undefined = span
  let i = 0
  while (current && current._tag === "Span" && i < 10) {
    const stack = spanToTrace.get(current)?.()
    if (stack) {
      const locationMatchAll = stack.matchAll(locationRegex)
      let match = false
      for (const [, location] of locationMatchAll) {
        match = true
        out.push(`    at ${current.name} (${location})`)
      }
      if (!match) {
        out.push(`    at ${current.name} (${stack.replace(/^at /, "")})`)
      }
    } else {
      out.push(`    at ${current.name}`)
    }
    current = Option.getOrUndefined(current.parent)
    i++
  }
}

/** @internal */
export const causePretty = <E>(cause: Cause.Cause<E>): string =>
  causePrettyErrors<E>(cause).map((e) =>
    e.cause ? `${e.stack} {\n${renderErrorCause(e.cause as Error, "  ")}\n}` : e.stack
  ).join("\n")

const renderErrorCause = (cause: Error, prefix: string) => {
  const lines = cause.stack!.split("\n")
  let stack = `${prefix}[cause]: ${lines[0]}`
  for (let i = 1, len = lines.length; i < len; i++) {
    stack += `\n${prefix}${lines[i]}`
  }
  if (cause.cause) {
    stack += ` {\n${renderErrorCause(cause.cause as Error, `${prefix}  `)}\n${prefix}}`
  }
  return stack
}

// ----------------------------------------------------------------------------
// Fiber
// ----------------------------------------------------------------------------

/** @internal */
export const FiberTypeId: Fiber.TypeId = `~effect/Fiber/${version}` as const

const fiberVariance = {
  _A: identity,
  _E: identity
}

const fiberIdStore = { id: 0 }

const currentFiberUri = "effect/Fiber/currentFiber"

/** @internal */
export const getCurrentFiberOrUndefined = (): Fiber.Fiber<any, any> | undefined => (globalThis as any)[currentFiberUri]

/** @internal */
export const getCurrentFiber = (): Option.Option<Fiber.Fiber<any, any>> =>
  Option.fromNullable((globalThis as any)[currentFiberUri])

const keepAlive = (() => {
  let count = 0
  let running: ReturnType<typeof globalThis.setInterval> | undefined = undefined
  return ({
    increment() {
      count++
      running ??= globalThis.setInterval(constVoid, 2_147_483_647)
    },
    decrement() {
      count--
      if (count === 0 && running !== undefined) {
        globalThis.clearInterval(running)
        running = undefined
      }
    }
  })
})()

/** @internal */
export interface FiberImpl<in out A = any, in out E = any> extends Fiber.Fiber<A, E> {
  id: number
  currentOpCount: number
  readonly services: ServiceMap.ServiceMap<never>
  readonly currentScheduler: Scheduler.Scheduler
  readonly currentTracerContext?: Tracer.Tracer["context"]
  readonly currentSpan?: Tracer.AnySpan | undefined
  readonly currentSpanLocal: Tracer.Span | undefined
  readonly runtimeMetrics?: Metric.FiberRuntimeMetricsService | undefined
  readonly maxOpsBeforeYield: number
  interruptible: boolean
  readonly _stack: Array<Primitive>
  readonly _observers: Array<(exit: Exit.Exit<A, E>) => void>
  _exit: Exit.Exit<A, E> | undefined
  _children: Set<FiberImpl<any, any>> | undefined
  _interruptedCause: Cause.Cause<never> | undefined
  _yielded: Exit.Exit<any, any> | (() => void) | undefined
  evaluate(effect: Primitive): void
  runLoop<A, E>(this: FiberImpl<A, E>, effect: Primitive): Exit.Exit<A, E> | Yield
  getRef<A, E, X>(this: Fiber.Fiber<A, E>, ref: ServiceMap.Reference<X>): X
  addObserver<A, E>(this: FiberImpl<A, E>, cb: (exit: Exit.Exit<A, E>) => void): () => void
  unsafeInterrupt<A, E>(this: FiberImpl<A, E>, fiberId?: number | undefined, span?: Tracer.Span | undefined): void
  unsafePoll<A, E>(this: FiberImpl<A, E>): Exit.Exit<A, E> | undefined
  getCont<A, E, S extends contA | contE>(this: FiberImpl<A, E>, symbol: S):
    | (Primitive & Record<S, (value: any, fiber: FiberImpl) => Primitive>)
    | undefined
  yieldWith<A, E>(this: FiberImpl<A, E>, value: Exit.Exit<any, any> | (() => void)): Yield
  children<A, E>(this: FiberImpl<A, E>): Set<Fiber.Fiber<any, any>>
  setServices(this: FiberImpl<A, E>, services: ServiceMap.ServiceMap<never>): void
}

const FiberProto = {
  [FiberTypeId]: fiberVariance,
  getRef<A, E, X>(this: Fiber.Fiber<A, E>, ref: ServiceMap.Reference<X>): X {
    return ServiceMap.unsafeGetReference(this.services, ref)
  },
  addObserver<A, E>(this: FiberImpl<A, E>, cb: (exit: Exit.Exit<A, E>) => void): () => void {
    if (this._exit) {
      cb(this._exit)
      return constVoid
    }
    this._observers.push(cb)
    return () => {
      const index = this._observers.indexOf(cb)
      if (index >= 0) {
        this._observers.splice(index, 1)
      }
    }
  },
  unsafeInterrupt<A, E>(this: FiberImpl<A, E>, fiberId?: number | undefined, span?: Tracer.Span | undefined): void {
    if (this._exit) {
      return
    }
    const interrupted = !!this._interruptedCause
    let cause = causeInterrupt(fiberId)
    if (this.currentSpanLocal) {
      cause = causeAnnotate(cause, CurrentSpanKey, this.currentSpan as Tracer.Span)
    }
    if (span) {
      cause = causeAnnotate(cause, InterruptorSpanKey, span)
    }
    this._interruptedCause = this._interruptedCause && fiberId
      ? causeMerge(this._interruptedCause, cause)
      : cause
    if (!interrupted && this.interruptible) {
      this.evaluate(failCause(this._interruptedCause) as any)
    }
  },
  unsafePoll<A, E>(this: FiberImpl<A, E>): Exit.Exit<A, E> | undefined {
    return this._exit
  },
  evaluate<A, E>(this: FiberImpl<A, E>, effect: Primitive): void {
    this.runtimeMetrics?.recordFiberStart(this.services)
    if (this._exit) {
      return
    } else if (this._yielded !== undefined) {
      const yielded = this._yielded as () => void
      this._yielded = undefined
      yielded()
    }
    const exit = this.runLoop(effect)
    if (exit === Yield) {
      return
    }
    // the interruptChildren middlware is added in Effect.fork, so it can be
    // tree-shaken if not used
    const interruptChildren = fiberMiddleware.interruptChildren &&
      fiberMiddleware.interruptChildren(this)
    if (interruptChildren !== undefined) {
      return this.evaluate(flatMap(interruptChildren, () => exit) as any)
    }

    this._exit = exit
    this.runtimeMetrics?.recordFiberEnd(this.services, this._exit)
    keepAlive.decrement()
    for (let i = 0; i < this._observers.length; i++) {
      this._observers[i](exit)
    }
    this._observers.length = 0
  },
  runLoop<A, E>(this: FiberImpl<A, E>, effect: Primitive): Exit.Exit<A, E> | Yield {
    const prevFiber = (globalThis as any)[currentFiberUri]
    ;(globalThis as any)[currentFiberUri] = this
    let yielding = false
    let current: Primitive | Yield = effect
    this.currentOpCount = 0
    try {
      while (true) {
        this.currentOpCount++
        if (
          !yielding &&
          this.currentScheduler.shouldYield(this as any)
        ) {
          yielding = true
          const prev = current
          current = flatMap(yieldNow, () => prev as any) as any
        }
        current = this.currentTracerContext
          ? this.currentTracerContext(() => (current as any)[evaluate](this), this)
          : (current as any)[evaluate](this)
        if (current === Yield) {
          const yielded = this._yielded!
          if (ExitTypeId in yielded) {
            this._yielded = undefined
            return yielded
          }
          return Yield
        }
      }
    } catch (error) {
      if (!hasProperty(current, evaluate)) {
        return exitDie(`Fiber.runLoop: Not a valid effect: ${String(current)}`)
      }
      return this.runLoop(exitDie(error) as any)
    } finally {
      ;(globalThis as any)[currentFiberUri] = prevFiber
    }
  },
  getCont<A, E, S extends contA | contE>(this: FiberImpl<A, E>, symbol: S):
    | (Primitive & Record<S, (value: any, fiber: FiberImpl) => Primitive>)
    | undefined
  {
    while (true) {
      const op = this._stack.pop()
      if (!op) return undefined
      const cont = op[contAll] && op[contAll](this)
      if (cont) return { [symbol]: cont } as any
      if (op[symbol]) return op as any
    }
  },
  yieldWith<A, E>(this: FiberImpl<A, E>, value: Exit.Exit<any, any> | (() => void)): Yield {
    this._yielded = value
    return Yield
  },
  children<A, E>(this: FiberImpl<A, E>): Set<Fiber.Fiber<any, any>> {
    return (this._children ??= new Set())
  },
  pipe<A, E>(this: FiberImpl<A, E>) {
    return pipeArguments(this, arguments)
  },
  setServices(this: any, services: ServiceMap.ServiceMap<never>): void {
    this.services = services
    this.currentScheduler = this.getRef(Scheduler.Scheduler)
    this.currentSpan = services.unsafeMap.get(Tracer.ParentSpanKey)
    this.maxOpsBeforeYield = this.getRef(Scheduler.MaxOpsBeforeYield)
    this.runtimeMetrics = services.unsafeMap.get(InternalMetric.FiberRuntimeMetricsKey)
    const currentTracer = services.unsafeMap.get(Tracer.TracerKey)
    this.currentTracerContext = currentTracer ? currentTracer["context"] : undefined
  },
  get currentSpanLocal(): Tracer.Span | undefined {
    return (this as any).currentSpan?._tag === "Span" ? (this as any).currentSpan : undefined
  }
}

export const makeFiber = <A, E>(
  services: ServiceMap.ServiceMap<never>,
  interruptible: boolean = true
): FiberImpl<A, E> => {
  const fiber = Object.create(FiberProto)
  fiber.setServices(services)
  fiber.id = ++fiberIdStore.id
  fiber.currentOpCount = 0
  fiber.interruptible = interruptible
  fiber._stack = []
  fiber._observers = []
  fiber._exit = undefined
  fiber._children = undefined
  fiber._interruptedCause = undefined
  fiber._yielded = undefined
  keepAlive.increment()
  return fiber
}

const fiberMiddleware = {
  interruptChildren: undefined as
    | ((fiber: FiberImpl) => Effect.Effect<void> | undefined)
    | undefined
}

const fiberInterruptChildren = (fiber: FiberImpl) => {
  if (fiber._children === undefined || fiber._children.size === 0) {
    return undefined
  }
  return fiberInterruptAll(fiber._children)
}

/** @internal */
export const fiberAwait = <A, E>(
  self: Fiber.Fiber<A, E>
): Effect.Effect<Exit.Exit<A, E>> => {
  const impl = self as FiberImpl<A, E>
  if (impl._exit) return succeed(impl._exit)
  return callback((resume) => sync(self.addObserver((exit) => resume(succeed(exit)))))
}

/** @internal */
export const fiberAwaitAll = <Fiber extends Fiber.Fiber<any, any>>(
  self: Iterable<Fiber>
): Effect.Effect<
  Array<
    Exit.Exit<
      Fiber extends Fiber.Fiber<infer _A, infer _E> ? _A : never,
      Fiber extends Fiber.Fiber<infer _A, infer _E> ? _E : never
    >
  >
> =>
  callback((resume) => {
    const iter = self[Symbol.iterator]() as Iterator<FiberImpl>
    const exits: Array<Exit.Exit<any, any>> = []
    let cancel: (() => void) | undefined = undefined
    function loop() {
      let result = iter.next()
      while (!result.done) {
        if (result.value._exit) {
          exits.push(result.value._exit)
          result = iter.next()
          continue
        }
        cancel = result.value.addObserver((exit) => {
          exits.push(exit)
          loop()
        })
        return
      }
      resume(succeed(exits))
    }
    loop()
    return sync(() => cancel?.())
  })

/** @internal */
export const fiberJoin = <A, E>(self: Fiber.Fiber<A, E>): Effect.Effect<A, E> => flatten(fiberAwait(self))

/** @internal */
export const fiberInterrupt = <A, E>(
  self: Fiber.Fiber<A, E>
): Effect.Effect<void> => withFiber((fiber) => fiberInterruptAs(self, fiber.id))

/** @internal */
export const fiberInterruptAs: {
  (fiberId: number): <A, E>(self: Fiber.Fiber<A, E>) => Effect.Effect<void>
  <A, E>(self: Fiber.Fiber<A, E>, fiberId: number): Effect.Effect<void>
} = dual(2, <A, E>(self: Fiber.Fiber<A, E>, fiberId: number): Effect.Effect<void> =>
  withFiber((parent) => {
    self.unsafeInterrupt(fiberId, parent.currentSpanLocal)
    return asVoid(fiberAwait(self))
  }))

/** @internal */
export const fiberInterruptAll = <A extends Iterable<Fiber.Fiber<any, any>>>(
  fibers: A
): Effect.Effect<void> =>
  withFiber((parent) => {
    const span = parent.currentSpanLocal
    for (const fiber of fibers) {
      fiber.unsafeInterrupt(parent.id, span)
    }
    return asVoid(fiberAwaitAll(fibers))
  })

/** @internal */
export const fiberInterruptAllAs: {
  (fiberId: number): <A extends Iterable<Fiber.Fiber<any, any>>>(fibers: A) => Effect.Effect<void>
  <A extends Iterable<Fiber.Fiber<any, any>>>(fibers: A, fiberId: number): Effect.Effect<void>
} = dual(2, <A extends Iterable<Fiber.Fiber<any, any>>>(
  fibers: A,
  fiberId: number
): Effect.Effect<void> =>
  withFiber((parent) => {
    const span = parent.currentSpanLocal
    for (const fiber of fibers) fiber.unsafeInterrupt(fiberId, span)
    return asVoid(fiberAwaitAll(fibers))
  }))

/** @internal */
export const succeed: <A>(value: A) => Effect.Effect<A> = exitSucceed

/** @internal */
export const failCause: <E>(cause: Cause.Cause<E>) => Effect.Effect<never, E> = exitFailCause

/** @internal */
export const fail: <E>(error: E) => Effect.Effect<never, E> = exitFail

/** @internal */
export const sync: <A>(thunk: LazyArg<A>) => Effect.Effect<A> = makePrimitive({
  op: "Sync",
  [evaluate](fiber): Primitive | Yield {
    const value = this[args]()
    const cont = fiber.getCont(contA)
    return cont
      ? cont[contA](value, fiber)
      : fiber.yieldWith(exitSucceed(value))
  }
})

/** @internal */
export const suspend: <A, E, R>(
  evaluate: LazyArg<Effect.Effect<A, E, R>>
) => Effect.Effect<A, E, R> = makePrimitive({
  op: "Suspend",
  [evaluate](_fiber) {
    return this[args]()
  }
})

/** @internal */
export const fromYieldable = <Self extends Effect.Yieldable.Any, A, E, R>(
  yieldable: Effect.Yieldable<Self, A, E, R>
): Effect.Effect<A, E, R> => yieldable.asEffect()

/** @internal */
export const fromOption: <A>(option: Option.Option<A>) => Effect.Effect<A, Cause.NoSuchElementError> = fromYieldable

/** @internal */
export const fromResult: <A, E>(result: Result.Result<A, E>) => Effect.Effect<A, E> = fromYieldable

/** @internal */
export const yieldNowWith: (priority?: number) => Effect.Effect<void> = makePrimitive({
  op: "Yield",
  [evaluate](fiber) {
    let resumed = false
    fiber.currentScheduler.scheduleTask(() => {
      if (resumed) return
      fiber.evaluate(exitVoid as any)
    }, this[args] ?? 0)
    return fiber.yieldWith(() => {
      resumed = true
    })
  }
})

/** @internal */
export const yieldNow: Effect.Effect<void> = yieldNowWith(0)

/** @internal */
export const succeedSome = <A>(a: A): Effect.Effect<Option.Option<A>> => succeed(Option.some(a))

/** @internal */
export const succeedNone: Effect.Effect<Option.Option<never>> = succeed(
  Option.none()
)

/** @internal */
export const failCauseSync = <E>(
  evaluate: LazyArg<Cause.Cause<E>>
): Effect.Effect<never, E> => suspend(() => failCause(internalCall(evaluate)))

/** @internal */
export const die = (defect: unknown): Effect.Effect<never> => exitDie(defect)

/** @internal */
export const failSync = <E>(error: LazyArg<E>): Effect.Effect<never, E> => suspend(() => fail(internalCall(error)))

const void_: Effect.Effect<void> = succeed(void 0)
export {
  /** @internal */
  void_ as void
}

const try_ = <A, E>(options: {
  try: LazyArg<A>
  catch: (error: unknown) => E
}): Effect.Effect<A, E> =>
  suspend(() => {
    try {
      return succeed(internalCall(options.try))
    } catch (err) {
      return fail(internalCall(() => options.catch(err)))
    }
  })
export {
  /** @internal */
  try_ as try
}

/** @internal */
export const promise = <A>(
  evaluate: (signal: AbortSignal) => PromiseLike<A>
): Effect.Effect<A> =>
  callbackOptions<A>(function(resume, signal) {
    internalCall(() => evaluate(signal!)).then(
      (a) => resume(succeed(a)),
      (e) => resume(die(e))
    )
  }, evaluate.length !== 0)

/** @internal */
export const tryPromise = <A, E = Cause.UnknownError>(
  options: {
    readonly try: (signal: AbortSignal) => PromiseLike<A>
    readonly catch: (error: unknown) => E
  } | ((signal: AbortSignal) => PromiseLike<A>)
): Effect.Effect<A, E> => {
  const f = typeof options === "function" ? options : options.try
  const catcher = typeof options === "function"
    ? ((cause: unknown) => new UnknownError(cause, "An error occurred in Effect.tryPromise"))
    : options.catch
  return callbackOptions<A, E>(function(resume, signal) {
    try {
      internalCall(() => f(signal!)).then(
        (a) => resume(succeed(a)),
        (e) => resume(fail(internalCall(() => catcher(e)) as E))
      )
    } catch (err) {
      resume(fail(internalCall(() => catcher(err)) as E))
    }
  }, eval.length !== 0)
}

/** @internal */
export const withFiberId = <A, E, R>(
  f: (fiberId: number) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => withFiber((fiber) => f(fiber.id))

const callbackOptions: <A, E = never, R = never>(
  register: (
    this: Scheduler.Scheduler,
    resume: (effect: Effect.Effect<A, E, R>) => void,
    signal?: AbortSignal
  ) => void | Effect.Effect<void, never, R>,
  withSignal: boolean
) => Effect.Effect<A, E, R> = makePrimitive({
  op: "Async",
  single: false,
  [evaluate](fiber) {
    const register = internalCall(() => this[args][0].bind(fiber.currentScheduler))
    let resumed = false
    let yielded: boolean | Primitive = false
    const controller = this[args][1] ? new AbortController() : undefined
    const onCancel = register((effect) => {
      if (resumed) return
      resumed = true
      if (yielded) {
        fiber.evaluate(effect as any)
      } else {
        yielded = effect as any
      }
    }, controller?.signal)
    if (yielded !== false) return yielded
    yielded = true
    fiber._yielded = () => {
      resumed = true
    }
    if (controller === undefined && onCancel === undefined) {
      return Yield
    }
    fiber._stack.push(
      asyncFinalizer(() => {
        resumed = true
        controller?.abort()
        return onCancel ?? exitVoid
      })
    )
    return Yield
  }
})

const asyncFinalizer: (
  onInterrupt: () => Effect.Effect<void, any, any>
) => Primitive = makePrimitive({
  op: "AsyncFinalizer",
  [contAll](fiber) {
    if (fiber.interruptible) {
      fiber.interruptible = false
      fiber._stack.push(setInterruptible(true))
    }
  },
  [contE](cause, _fiber) {
    return causeHasInterrupt(cause)
      ? flatMap(this[args](), () => failCause(cause))
      : failCause(cause)
  }
})

/** @internal */
export const callback = <A, E = never, R = never>(
  register: (
    this: Scheduler.Scheduler,
    resume: (effect: Effect.Effect<A, E, R>) => void,
    signal: AbortSignal
  ) => void | Effect.Effect<void, never, R>
): Effect.Effect<A, E, R> => callbackOptions(register as any, register.length >= 2)

/** @internal */
export const never: Effect.Effect<never> = callback<never>(constVoid)

/** @internal */
export const gen = <
  Self,
  Eff extends YieldWrap<Effect.Yieldable<any, any, any, any>>,
  AEff
>(
  ...args:
    | [self: Self, body: (this: Self) => Generator<Eff, AEff, never>]
    | [body: () => Generator<Eff, AEff, never>]
): Effect.Effect<
  AEff,
  [Eff] extends [never] ? never
    : [Eff] extends [YieldWrap<Effect.Yieldable<infer _A, infer E, infer _R>>] ? E
    : never,
  [Eff] extends [never] ? never
    : [Eff] extends [YieldWrap<Effect.Yieldable<infer _A, infer _E, infer R>>] ? R
    : never
> =>
  suspend(() =>
    unsafeFromIterator(
      args.length === 1 ? args[0]() : (args[1].call(args[0]) as any)
    )
  )

/** @internal */
export const fnUntraced: Effect.fn.Gen = (
  body: Function,
  ...pipeables: Array<any>
) => {
  return pipeables.length === 0
    ? function(this: any, ...args: Array<any>) {
      return suspend(() => unsafeFromIterator(body.apply(this, args)))
    }
    : function(this: any, ...args: Array<any>) {
      let effect = suspend(() => unsafeFromIterator(body.apply(this, args)))
      for (const pipeable of pipeables) {
        effect = pipeable(effect)
      }
      return effect
    }
}

/** @internal */
export const fnUntracedEager: Effect.fn.Gen = (
  body: Function,
  ...pipeables: Array<any>
) => {
  return pipeables.length === 0
    ? function(this: any, ...args: Array<any>) {
      return unsafeFromIteratorEager(() => body.apply(this, args))
    }
    : function(this: any, ...args: Array<any>) {
      let effect = unsafeFromIteratorEager(() => body.apply(this, args))
      for (const pipeable of pipeables) {
        effect = pipeable(effect)
      }
      return effect
    }
}

const unsafeFromIteratorEager = (
  createIterator: () => Iterator<YieldWrap<Effect.Yieldable<any, any, any, any>>>
): Effect.Effect<any, any, any> => {
  try {
    const iterator = createIterator()
    let value: any = undefined

    // Try to resolve synchronously in a loop
    while (true) {
      const state = iterator.next(value)

      if (state.done) {
        return succeed(state.value)
      }

      const yieldable = yieldWrapGet(state.value)
      const effect = yieldable.asEffect()
      const primitive = effect as any

      if (primitive && primitive._tag === "Success") {
        value = primitive.value
        continue
      } else if (primitive && primitive._tag === "Failure") {
        return effect
      } else {
        let isFirstExecution = true

        return suspend(() => {
          if (isFirstExecution) {
            isFirstExecution = false
            return flatMap(effect, (value) => unsafeFromIterator(iterator, value))
          } else {
            return suspend(() => unsafeFromIterator(createIterator()))
          }
        })
      }
    }
  } catch (error) {
    return die(error)
  }
}

const unsafeFromIterator: (
  iterator: Iterator<YieldWrap<Effect.Yieldable<any, any, any, any>>>,
  initial?: undefined
) => Effect.Effect<any, any, any> = makePrimitive({
  op: "Iterator",
  single: false,
  [contA](value, fiber) {
    const state = this[args][0].next(value)
    if (state.done) return succeed(state.value)
    fiber._stack.push(this)
    return yieldWrapGet(state.value).asEffect()
  },
  [evaluate](this: any, fiber: FiberImpl) {
    return this[contA](this[args][1], fiber)
  }
})

// ----------------------------------------------------------------------------
// mapping & sequencing
// ----------------------------------------------------------------------------

/** @internal */
export const as: {
  <A, B>(
    value: B
  ): <E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<B, E, R>
  <A, E, R, B>(self: Effect.Effect<A, E, R>, value: B): Effect.Effect<B, E, R>
} = dual(
  2,
  <A, E, R, B>(
    self: Effect.Effect<A, E, R>,
    value: B
  ): Effect.Effect<B, E, R> => map(self, (_) => value)
)

/** @internal */
export const asSome = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<Option.Option<A>, E, R> => map(self, Option.some)

/** @internal */
export const flip = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<E, A, R> =>
  matchEffect(self, {
    onFailure: succeed,
    onSuccess: fail
  })

/** @internal */
export const andThen: {
  <A, X>(
    f: (a: A) => X
  ): <E, R>(
    self: Effect.Effect<A, E, R>
  ) => [X] extends [Effect.Effect<infer A1, infer E1, infer R1>] ? Effect.Effect<A1, E | E1, R | R1>
    : Effect.Effect<X, E, R>
  <X>(
    f: NotFunction<X>
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => [X] extends [Effect.Effect<infer A1, infer E1, infer R1>] ? Effect.Effect<A1, E | E1, R | R1>
    : Effect.Effect<X, E, R>
  <A, E, R, X>(
    self: Effect.Effect<A, E, R>,
    f: (a: A) => X
  ): [X] extends [Effect.Effect<infer A1, infer E1, infer R1>] ? Effect.Effect<A1, E | E1, R | R1>
    : Effect.Effect<X, E, R>
  <A, E, R, X>(
    self: Effect.Effect<A, E, R>,
    f: NotFunction<X>
  ): [X] extends [Effect.Effect<infer A1, infer E1, infer R1>] ? Effect.Effect<A1, E | E1, R | R1>
    : Effect.Effect<X, E, R>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: any
  ): Effect.Effect<B, E | E2, R | R2> =>
    flatMap(self, (a) => {
      if (isEffect(f)) return f
      const value = typeof f === "function" ? internalCall(() => f(a)) : f
      return isEffect(value) ? value : succeed(value)
    })
)

/** @internal */
export const tap: {
  <A, X>(
    f: (a: NoInfer<A>) => X
  ): <E, R>(
    self: Effect.Effect<A, E, R>
  ) => [X] extends [Effect.Effect<infer _A1, infer E1, infer R1>] ? Effect.Effect<A, E | E1, R | R1>
    : Effect.Effect<A, E, R>
  <X>(
    f: NotFunction<X>
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => [X] extends [Effect.Effect<infer _A1, infer E1, infer R1>] ? Effect.Effect<A, E | E1, R | R1>
    : Effect.Effect<A, E, R>
  <A, E, R, X>(
    self: Effect.Effect<A, E, R>,
    f: (a: NoInfer<A>) => X
  ): [X] extends [Effect.Effect<infer _A1, infer E1, infer R1>] ? Effect.Effect<A, E | E1, R | R1>
    : Effect.Effect<A, E, R>
  <A, E, R, X>(
    self: Effect.Effect<A, E, R>,
    f: NotFunction<X>
  ): [X] extends [Effect.Effect<infer _A1, infer E1, infer R1>] ? Effect.Effect<A, E | E1, R | R1>
    : Effect.Effect<A, E, R>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (a: A) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A, E | E2, R | R2> =>
    flatMap(self, (a) => {
      const value = isEffect(f) ? f : typeof f === "function" ? internalCall(() => f(a)) : f
      return isEffect(value) ? as(value, a) : succeed(a)
    })
)

/** @internal */
export const asVoid = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<void, E, R> => flatMap(self, (_) => exitVoid)

/** @internal */
export const exit = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<Exit.Exit<A, E>, never, R> =>
  matchCauseEager(self, {
    onFailure: exitFailCause,
    onSuccess: exitSucceed
  })

/** @internal */
export const sandbox = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<A, Cause.Cause<E>, R> => catchCause(self, fail)

/** @internal */
export const raceAll = <Eff extends Effect.Effect<any, any, any>>(
  all: Iterable<Eff>,
  options?: {
    readonly onWinner?: (options: {
      readonly fiber: Fiber.Fiber<any, any>
      readonly index: number
      readonly parentFiber: Fiber.Fiber<any, any>
    }) => void
  }
): Effect.Effect<
  Effect.Success<Eff>,
  Effect.Error<Eff>,
  Effect.Services<Eff>
> =>
  withFiber((parent) =>
    callback((resume) => {
      const effects = Arr.fromIterable(all)
      const len = effects.length
      let doneCount = 0
      let done = false
      const fibers = new Set<Fiber.Fiber<any, any>>()
      const failures: Array<Cause.Failure<any>> = []
      const onExit = (exit: Exit.Exit<any, any>, fiber: Fiber.Fiber<any, any>, i: number) => {
        doneCount++
        if (exit._tag === "Failure") {
          // eslint-disable-next-line no-restricted-syntax
          failures.push(...exit.cause.failures)
          if (doneCount >= len) {
            resume(failCause(causeFromFailures(failures)))
          }
          return
        }
        const isWinner = !done
        done = true
        resume(
          fibers.size === 0
            ? exit
            : flatMap(uninterruptible(fiberInterruptAll(fibers)), () => exit)
        )
        if (isWinner && options?.onWinner) {
          options.onWinner({ fiber, index: i, parentFiber: parent })
        }
      }

      for (let i = 0; i < len; i++) {
        if (done) break
        const fiber = unsafeFork(parent, interruptible(effects[i]), true, true)
        fibers.add(fiber)
        fiber.addObserver((exit) => {
          fibers.delete(fiber)
          onExit(exit, fiber, i)
        })
      }

      return fiberInterruptAll(fibers)
    })
  )

/** @internal */
export const raceAllFirst = <Eff extends Effect.Effect<any, any, any>>(
  all: Iterable<Eff>,
  options?: {
    readonly onWinner?: (options: {
      readonly fiber: Fiber.Fiber<any, any>
      readonly index: number
      readonly parentFiber: Fiber.Fiber<any, any>
    }) => void
  }
): Effect.Effect<
  Effect.Success<Eff>,
  Effect.Error<Eff>,
  Effect.Services<Eff>
> =>
  withFiber((parent) =>
    callback((resume) => {
      let done = false
      const fibers = new Set<Fiber.Fiber<any, any>>()
      const onExit = (exit: Exit.Exit<any, any>) => {
        done = true
        resume(
          fibers.size === 0
            ? exit
            : flatMap(fiberInterruptAll(fibers), () => exit)
        )
      }

      let i = 0
      for (const effect of all) {
        if (done) break
        const index = i++
        const fiber = unsafeFork(parent, interruptible(effect), true, true)
        fibers.add(fiber)
        fiber.addObserver((exit) => {
          fibers.delete(fiber)
          const isWinner = !done
          onExit(exit)
          if (isWinner && options?.onWinner) {
            options.onWinner({ fiber, index, parentFiber: parent })
          }
        })
      }

      return fiberInterruptAll(fibers)
    })
  )

/** @internal */
export const race: {
  <A2, E2, R2>(
    that: Effect.Effect<A2, E2, R2>,
    options?: {
      readonly onWinner?: (options: {
        readonly fiber: Fiber.Fiber<any, any>
        readonly index: number
        readonly parentFiber: Fiber.Fiber<any, any>
      }) => void
    }
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect.Effect<A, E, R>,
    that: Effect.Effect<A2, E2, R2>,
    options?: {
      readonly onWinner?: (options: {
        readonly fiber: Fiber.Fiber<any, any>
        readonly index: number
        readonly parentFiber: Fiber.Fiber<any, any>
      }) => void
    }
  ): Effect.Effect<A | A2, E | E2, R | R2>
} = dual(
  (args) => isEffect(args[1]),
  <A, E, R, A2, E2, R2>(
    self: Effect.Effect<A, E, R>,
    that: Effect.Effect<A2, E2, R2>,
    options?: {
      readonly onWinner?: (options: {
        readonly fiber: Fiber.Fiber<any, any>
        readonly index: number
        readonly parentFiber: Fiber.Fiber<any, any>
      }) => void
    }
  ): Effect.Effect<A | A2, E | E2, R | R2> => raceAll([self, that], options)
)

/** @internal */
export const raceFirst: {
  <A2, E2, R2>(
    that: Effect.Effect<A2, E2, R2>,
    options?: {
      readonly onWinner?: (options: {
        readonly fiber: Fiber.Fiber<any, any>
        readonly index: number
        readonly parentFiber: Fiber.Fiber<any, any>
      }) => void
    }
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect.Effect<A, E, R>,
    that: Effect.Effect<A2, E2, R2>,
    options?: {
      readonly onWinner?: (options: {
        readonly fiber: Fiber.Fiber<any, any>
        readonly index: number
        readonly parentFiber: Fiber.Fiber<any, any>
      }) => void
    }
  ): Effect.Effect<A | A2, E | E2, R | R2>
} = dual(
  (args) => isEffect(args[1]),
  <A, E, R, A2, E2, R2>(
    self: Effect.Effect<A, E, R>,
    that: Effect.Effect<A2, E2, R2>,
    options?: {
      readonly onWinner?: (options: {
        readonly fiber: Fiber.Fiber<any, any>
        readonly index: number
        readonly parentFiber: Fiber.Fiber<any, any>
      }) => void
    }
  ): Effect.Effect<A | A2, E | E2, R | R2> => raceAllFirst([self, that], options)
)

/** @internal */
export const flatMap: {
  <A, B, E2, R2>(
    f: (a: A) => Effect.Effect<B, E2, R2>
  ): <E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (a: A) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<B, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (a: A) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<B, E | E2, R | R2> => {
    const onSuccess = Object.create(OnSuccessProto)
    onSuccess[args] = self
    onSuccess[contA] = f.length !== 1 ? (a: A) => f(a) : f
    return onSuccess
  }
)
const OnSuccessProto = makePrimitiveProto({
  op: "OnSuccess",
  [evaluate](this: any, fiber: FiberImpl): Primitive {
    fiber._stack.push(this)
    return this[args]
  }
})

const effectIsExit = <A, E, R>(effect: Effect.Effect<A, E, R>): effect is Exit.Exit<A, E> => ExitTypeId in effect

/** @internal */
export const flatMapEager: {
  <A, B, E2, R2>(
    f: (a: A) => Effect.Effect<B, E2, R2>
  ): <E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (a: A) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<B, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (a: A) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<B, E | E2, R | R2> => {
    if (effectIsExit(self)) {
      return self._tag === "Success" ? f(self.value) : self as Exit.Exit<never, E>
    }
    return flatMap(self, f)
  }
)

// ----------------------------------------------------------------------------
// mapping & sequencing
// ----------------------------------------------------------------------------

/** @internal */
export const flatten = <A, E, R, E2, R2>(
  self: Effect.Effect<Effect.Effect<A, E, R>, E2, R2>
): Effect.Effect<A, E | E2, R | R2> => flatMap(self, identity)

/** @internal */
export const map: {
  <A, B>(
    f: (a: A) => B
  ): <E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<B, E, R>
  <A, E, R, B>(
    self: Effect.Effect<A, E, R>,
    f: (a: A) => B
  ): Effect.Effect<B, E, R>
} = dual(
  2,
  <A, E, R, B>(
    self: Effect.Effect<A, E, R>,
    f: (a: A) => B
  ): Effect.Effect<B, E, R> => flatMap(self, (a) => succeed(internalCall(() => f(a))))
)

/** @internal */
export const mapEager: {
  <A, B>(
    f: (a: A) => B
  ): <E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<B, E, R>
  <A, E, R, B>(
    self: Effect.Effect<A, E, R>,
    f: (a: A) => B
  ): Effect.Effect<B, E, R>
} = dual(
  2,
  <A, E, R, B>(
    self: Effect.Effect<A, E, R>,
    f: (a: A) => B
  ): Effect.Effect<B, E, R> => effectIsExit(self) ? exitMap(self, f) : map(self, f)
)

/** @internal */
export const mapErrorEager: {
  <E, E2>(
    f: (e: E) => E2
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E2, R>
  <A, E, R, E2>(
    self: Effect.Effect<A, E, R>,
    f: (e: E) => E2
  ): Effect.Effect<A, E2, R>
} = dual(
  2,
  <A, E, R, E2>(
    self: Effect.Effect<A, E, R>,
    f: (e: E) => E2
  ): Effect.Effect<A, E2, R> => effectIsExit(self) ? exitMapError(self, f) : mapError(self, f)
)

/** @internal */
export const mapBothEager: {
  <E, E2, A, A2>(
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): <R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A2, E2, R>
  <A, E, R, E2, A2>(
    self: Effect.Effect<A, E, R>,
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): Effect.Effect<A2, E2, R>
} = dual(
  2,
  <A, E, R, E2, A2>(
    self: Effect.Effect<A, E, R>,
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): Effect.Effect<A2, E2, R> => effectIsExit(self) ? exitMapBoth(self, options) : mapBoth(self, options)
)

/** @internal */
export const catchEager: {
  <E, B, E2, R2>(
    f: (e: NoInfer<E>) => Effect.Effect<B, E2, R2>
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A | B, E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (e: NoInfer<E>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A | B, E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (e: NoInfer<E>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A | B, E2, R | R2> => {
    if (effectIsExit(self)) {
      if (self._tag === "Success") return self as Exit.Exit<A>
      const error = causeFilterError(self.cause)
      if (Filter.isFail(error)) return self as Exit.Exit<never>
      return f(error)
    }
    return catch_(self, f)
  }
)

// ----------------------------------------------------------------------------
// Exit
// ----------------------------------------------------------------------------

/** @internal */
export const exitInterrupt = (fiberId: number): Exit.Exit<never> => exitFailCause(causeInterrupt(fiberId))

/** @internal */
export const exitIsSuccess = <A, E>(
  self: Exit.Exit<A, E>
): self is Exit.Success<A, E> => self._tag === "Success"

/** @internal */
export const exitFilterSuccess = <A, E>(
  self: Exit.Exit<A, E>
): Exit.Success<A> | Filter.fail<Exit.Failure<never, E>> =>
  self._tag === "Success" ? self as any : Filter.fail(self as any)

/** @internal */
export const exitFilterValue = <A, E>(self: Exit.Exit<A, E>): A | Filter.fail<Exit.Failure<never, E>> =>
  self._tag === "Success" ? self.value : Filter.fail(self as any)

/** @internal */
export const exitIsFailure = <A, E>(
  self: Exit.Exit<A, E>
): self is Exit.Failure<A, E> => self._tag === "Failure"

/** @internal */
export const exitFilterFailure = <A, E>(
  self: Exit.Exit<A, E>
): Exit.Failure<never, E> | Filter.fail<Exit.Success<A>> =>
  self._tag === "Failure" ? self as any : Filter.fail(self as any)

/** @internal */
export const exitFilterCause = <A, E>(
  self: Exit.Exit<A, E>
): Cause.Cause<E> | Filter.fail<Exit.Success<A>> => self._tag === "Failure" ? self.cause : Filter.fail(self as any)

/** @internal */
export const exitFilterError = Filter.unsafeCompose(
  exitFilterCause,
  (cause) => causeFilterError(cause)
)

/** @internal */
export const exitHasInterrupt = <A, E>(
  self: Exit.Exit<A, E>
): self is Exit.Failure<A, E> => self._tag === "Failure" && causeHasInterrupt(self.cause)

/** @internal */
export const exitHasDie = <A, E>(
  self: Exit.Exit<A, E>
): self is Exit.Failure<A, E> => self._tag === "Failure" && causeHasDie(self.cause)

/** @internal */
export const exitHasFail = <A, E>(
  self: Exit.Exit<A, E>
): self is Exit.Failure<A, E> => self._tag === "Failure" && causeHasFail(self.cause)

/** @internal */
export const exitVoid: Exit.Exit<void> = exitSucceed(void 0)

/** @internal */
export const exitMap: {
  <A, B>(f: (a: A) => B): <E>(self: Exit.Exit<A, E>) => Exit.Exit<B, E>
  <A, E, B>(self: Exit.Exit<A, E>, f: (a: A) => B): Exit.Exit<B, E>
} = dual(
  2,
  <A, E, B>(self: Exit.Exit<A, E>, f: (a: A) => B): Exit.Exit<B, E> =>
    self._tag === "Success" ? exitSucceed(f(self.value)) : (self as any)
)

/** @internal */
export const exitMapError: {
  <E, E2>(f: (a: NoInfer<E>) => E2): <A>(self: Exit.Exit<A, E>) => Exit.Exit<A, E2>
  <A, E, E2>(self: Exit.Exit<A, E>, f: (a: NoInfer<E>) => E2): Exit.Exit<A, E2>
} = dual(
  2,
  <A, E, E2>(self: Exit.Exit<A, E>, f: (a: NoInfer<E>) => E2): Exit.Exit<A, E2> => {
    if (self._tag === "Success") return self as Exit.Exit<A>
    const error = causeFilterError(self.cause)
    if (Filter.isFail(error)) return self as Exit.Exit<never>
    return exitFail(f(error))
  }
)

/** @internal */
export const exitMapBoth: {
  <E, E2, A, A2>(
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): (self: Exit.Exit<A, E>) => Exit.Exit<A2, E2>
  <A, E, E2, A2>(
    self: Exit.Exit<A, E>,
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): Exit.Exit<A2, E2>
} = dual(
  2,
  <A, E, E2, A2>(
    self: Exit.Exit<A, E>,
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): Exit.Exit<A2, E2> => {
    if (self._tag === "Success") return exitSucceed(options.onSuccess(self.value))
    const error = causeFilterError(self.cause)
    if (Filter.isFail(error)) return self as Exit.Exit<never>
    return exitFail(options.onFailure(error))
  }
)

/** @internal */
export const exitAs: {
  <B>(b: B): <A, E>(self: Exit.Exit<A, E>) => Exit.Exit<B, E>
  <A, E, B>(self: Exit.Exit<A, E>, b: B): Exit.Exit<B, E>
} = dual(
  2,
  <A, E, B>(self: Exit.Exit<A, E>, b: B): Exit.Exit<B, E> => exitIsSuccess(self) ? exitSucceed(b) : (self as any)
)

/** @internal */
export const exitZipRight: {
  <A2, E2>(
    that: Exit.Exit<A2, E2>
  ): <A, E>(self: Exit.Exit<A, E>) => Exit.Exit<A2, E | E2>
  <A, E, A2, E2>(
    self: Exit.Exit<A, E>,
    that: Exit.Exit<A2, E2>
  ): Exit.Exit<A2, E | E2>
} = dual(
  2,
  <A, E, A2, E2>(
    self: Exit.Exit<A, E>,
    that: Exit.Exit<A2, E2>
  ): Exit.Exit<A2, E | E2> => (exitIsSuccess(self) ? that : (self as any))
)

/** @internal */
export const exitMatch: {
  <A, E, X1, X2>(options: {
    readonly onSuccess: (a: NoInfer<A>) => X1
    readonly onFailure: (cause: Cause.Cause<NoInfer<E>>) => X2
  }): (self: Exit.Exit<A, E>) => X1 | X2
  <A, E, X1, X2>(
    self: Exit.Exit<A, E>,
    options: {
      readonly onSuccess: (a: A) => X1
      readonly onFailure: (cause: Cause.Cause<E>) => X2
    }
  ): X1 | X2
} = dual(
  2,
  <A, E, X1, X2>(
    self: Exit.Exit<A, E>,
    options: {
      readonly onSuccess: (a: A) => X1
      readonly onFailure: (cause: Cause.Cause<E>) => X2
    }
  ): X1 | X2 =>
    exitIsSuccess(self)
      ? options.onSuccess(self.value)
      : options.onFailure(self.cause)
)

/** @internal */
export const exitAsVoid: <A, E>(self: Exit.Exit<A, E>) => Exit.Exit<void, E> = exitAs(void 0)

/** @internal */
export const exitAsVoidAll = <I extends Iterable<Exit.Exit<any, any>>>(
  exits: I
): Exit.Exit<
  void,
  I extends Iterable<Exit.Exit<infer _A, infer _E>> ? _E : never
> => {
  const failures: Array<Cause.Failure<any>> = []
  for (const exit of exits) {
    if (exit._tag === "Failure") {
      // eslint-disable-next-line no-restricted-syntax
      failures.push(...exit.cause.failures)
    }
  }
  return failures.length === 0 ? exitVoid : exitFailCause(causeFromFailures(failures))
}

// ----------------------------------------------------------------------------
// environment
// ----------------------------------------------------------------------------

/** @internal */
export const service: {
  <I, S>(key: ServiceMap.Key<I, S>): Effect.Effect<S, never, I>
} = fromYieldable as any

/** @internal */
export const serviceOption = <I, S>(
  key: ServiceMap.Key<I, S>
): Effect.Effect<Option.Option<S>> => withFiber((fiber) => succeed(ServiceMap.getOption(fiber.services, key)))

/** @internal */
export const serviceOptional = <I, S>(
  key: ServiceMap.Key<I, S>
): Effect.Effect<S, Cause.NoSuchElementError> =>
  withFiber((fiber) =>
    fiber.services.unsafeMap.has(key.key)
      ? succeed(ServiceMap.unsafeGet(fiber.services, key))
      : fail(new NoSuchElementError())
  )

/** @internal */
export const updateServices: {
  <R2, R>(
    f: (services: ServiceMap.ServiceMap<R2>) => ServiceMap.ServiceMap<NoInfer<R>>
  ): <A, E>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R2>
  <A, E, R, R2>(
    self: Effect.Effect<A, E, R>,
    f: (services: ServiceMap.ServiceMap<R2>) => ServiceMap.ServiceMap<NoInfer<R>>
  ): Effect.Effect<A, E, R2>
} = dual(
  2,
  <A, E, R, R2>(
    self: Effect.Effect<A, E, R>,
    f: (services: ServiceMap.ServiceMap<R2>) => ServiceMap.ServiceMap<NoInfer<R>>
  ): Effect.Effect<A, E, R2> =>
    withFiber<A, E, R2>((fiber) => {
      const prev = fiber.services as ServiceMap.ServiceMap<R2>
      fiber.setServices(f(prev))
      return onExit(self as any, () => {
        fiber.setServices(prev)
        return void_
      })
    })
)

/** @internal */
export const updateService: {
  <I, A>(
    key: ServiceMap.Key<I, A>,
    f: (value: A) => A
  ): <XA, E, R>(self: Effect.Effect<XA, E, R>) => Effect.Effect<XA, E, R | I>
  <XA, E, R, I, A>(
    self: Effect.Effect<XA, E, R>,
    key: ServiceMap.Key<I, A>,
    f: (value: A) => A
  ): Effect.Effect<XA, E, R | I>
} = dual(
  3,
  <XA, E, R, I, A>(
    self: Effect.Effect<XA, E, R>,
    key: ServiceMap.Key<I, A>,
    f: (value: A) => A
  ): Effect.Effect<XA, E, R | I> =>
    withFiber((fiber) => {
      const prev = ServiceMap.unsafeGet(fiber.services, key)
      fiber.setServices(ServiceMap.add(fiber.services, key, f(prev)))
      return onExit(self, () => {
        fiber.setServices(ServiceMap.add(fiber.services, key, prev))
        return void_
      })
    })
)

/** @internal */
export const services = <R = never>(): Effect.Effect<ServiceMap.ServiceMap<R>> => getServiceMap as any
const getServiceMap = withFiber((fiber) => succeed(fiber.services))

/** @internal */
export const servicesWith = <R, A, E, R2>(
  f: (services: ServiceMap.ServiceMap<R>) => Effect.Effect<A, E, R2>
): Effect.Effect<A, E, R | R2> => withFiber((fiber) => f(fiber.services as ServiceMap.ServiceMap<R>))

/** @internal */
export const provideServices: {
  <XR>(
    services: ServiceMap.ServiceMap<XR>
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Exclude<R, XR>>
  <A, E, R, XR>(
    self: Effect.Effect<A, E, R>,
    services: ServiceMap.ServiceMap<XR>
  ): Effect.Effect<A, E, Exclude<R, XR>>
} = dual(
  2,
  <A, E, R, XR>(
    self: Effect.Effect<A, E, R>,
    services: ServiceMap.ServiceMap<XR>
  ): Effect.Effect<A, E, Exclude<R, XR>> => updateServices(self, ServiceMap.merge(services)) as any
)

/** @internal */
export const provideService: {
  <I, S>(
    key: ServiceMap.Key<I, S>
  ): {
    (service: S): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, I>>
    <A, E, R>(self: Effect.Effect<A, E, R>, service: S): Effect.Effect<A, E, Exclude<R, I>>
  }
  <I, S>(
    key: ServiceMap.Key<I, S>,
    service: S
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Exclude<R, I>>
  <A, E, R, I, S>(
    self: Effect.Effect<A, E, R>,
    key: ServiceMap.Key<I, S>,
    service: S
  ): Effect.Effect<A, E, Exclude<R, I>>
} = function(this: any) {
  if (arguments.length === 1) {
    return dual(2, (self, service) => updateServices(self, ServiceMap.add(arguments[0], service))) as any
  }
  return dual(3, (self, tag, service) => updateServices(self, ServiceMap.add(tag, service)))
    .apply(this, arguments as any) as any
}

/** @internal */
export const provideServiceEffect: {
  <I, S, E2, R2>(
    key: ServiceMap.Key<I, S>,
    acquire: Effect.Effect<S, E2, R2>
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | E2, Exclude<R, I> | R2>
  <A, E, R, I, S, E2, R2>(
    self: Effect.Effect<A, E, R>,
    key: ServiceMap.Key<I, S>,
    acquire: Effect.Effect<S, E2, R2>
  ): Effect.Effect<A, E | E2, Exclude<R, I> | R2>
} = dual(
  3,
  <A, E, R, I, S, E2, R2>(
    self: Effect.Effect<A, E, R>,
    key: ServiceMap.Key<I, S>,
    acquire: Effect.Effect<S, E2, R2>
  ): Effect.Effect<A, E | E2, Exclude<R, I> | R2> => flatMap(acquire, (service) => provideService(self, key, service))
)

/** @internal */
export const withConcurrency: {
  (
    concurrency: "unbounded" | number
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    concurrency: "unbounded" | number
  ): Effect.Effect<A, E, R>
} = provideService(CurrentConcurrency)

// ----------------------------------------------------------------------------
// zipping
// ----------------------------------------------------------------------------

/** @internal */
export const zip: {
  <A2, E2, R2>(
    that: Effect.Effect<A2, E2, R2>,
    options?: { readonly concurrent?: boolean | undefined } | undefined
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<[A, A2], E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Effect.Effect<A, E, R>,
    that: Effect.Effect<A2, E2, R2>,
    options?: { readonly concurrent?: boolean | undefined }
  ): Effect.Effect<[A, A2], E | E2, R | R2>
} = dual(
  (args) => isEffect(args[1]),
  <A, E, R, A2, E2, R2>(
    self: Effect.Effect<A, E, R>,
    that: Effect.Effect<A2, E2, R2>,
    options?: { readonly concurrent?: boolean | undefined }
  ): Effect.Effect<[A, A2], E | E2, R | R2> => zipWith(self, that, (a, a2) => [a, a2], options)
)

/** @internal */
export const zipWith: {
  <A2, E2, R2, A, B>(
    that: Effect.Effect<A2, E2, R2>,
    f: (a: A, b: A2) => B,
    options?: { readonly concurrent?: boolean | undefined }
  ): <E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<B, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2, B>(
    self: Effect.Effect<A, E, R>,
    that: Effect.Effect<A2, E2, R2>,
    f: (a: A, b: A2) => B,
    options?: { readonly concurrent?: boolean | undefined }
  ): Effect.Effect<B, E2 | E, R2 | R>
} = dual(
  (args) => isEffect(args[1]),
  <A, E, R, A2, E2, R2, B>(
    self: Effect.Effect<A, E, R>,
    that: Effect.Effect<A2, E2, R2>,
    f: (a: A, b: A2) => B,
    options?: { readonly concurrent?: boolean | undefined }
  ): Effect.Effect<B, E2 | E, R2 | R> =>
    options?.concurrent
      // Use `all` exclusively for concurrent cases, as it introduces additional overhead due to the management of concurrency
      ? map(all([self, that], { concurrency: 2 }), ([a, a2]) => internalCall(() => f(a, a2)))
      : flatMap(self, (a) => map(that, (a2) => internalCall(() => f(a, a2))))
)

// ----------------------------------------------------------------------------
// filtering & conditionals
// ----------------------------------------------------------------------------

/** @internal */
export const filterOrFailCause: {
  <A, E2, B, X>(
    filter: Filter.Filter<NoInfer<A>, B, X>,
    orFailWith: (a: NoInfer<X>) => Cause.Cause<E2>
  ): <E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<B, E | E2, R>
  <A, E, R, E2, B, X>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<A, B, X>,
    orFailWith: (a: X) => Cause.Cause<E2>
  ): Effect.Effect<B, E2 | E, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R, E2, B, X>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<A, B, X>,
    orFailWith: (a: X) => Cause.Cause<E2>
  ): Effect.Effect<B, E2 | E, R> =>
    filterOrElse(
      self,
      filter,
      (a) => failCause(orFailWith(a))
    )
)

/* @internal */
export const filterOrFail: {
  <A, E2, B, X>(
    filter: Filter.Filter<NoInfer<A>, B, X>,
    orFailWith: (a: X) => E2
  ): <E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<B, E2 | E, R>
  <A, E, R, E2, B, X>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<NoInfer<A>, B, X>,
    orFailWith: (a: X) => E2
  ): Effect.Effect<B, E2 | E, R>
  <A, B, X>(
    filter: Filter.Filter<NoInfer<A>, B, X>
  ): <E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<B, Cause.NoSuchElementError | E, R>
  <A, E, R, B, X>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<NoInfer<A>, B, X>
  ): Effect.Effect<B, E | Cause.NoSuchElementError, R>
} = dual((args) => isEffect(args[0]), <A, E, R, E2>(
  self: Effect.Effect<A, E, R>,
  filter: Filter.Filter<A, A>,
  orFailWith?: (a: A) => E2
): Effect.Effect<A, E | E2 | Cause.NoSuchElementError, R> =>
  filterOrElse(
    self,
    filter,
    (a): Effect.Effect<never, E2 | Cause.NoSuchElementError, never> =>
      failSync(() => orFailWith === undefined ? new NoSuchElementError() : orFailWith(a))
  ))

/** @internal */
export const when: {
  <E2 = never, R2 = never>(
    condition: LazyArg<boolean> | Effect.Effect<boolean, E2, R2>
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<Option.Option<A>, E | E2, R | R2>
  <A, E, R, E2 = never, R2 = never>(
    self: Effect.Effect<A, E, R>,
    condition: LazyArg<boolean> | Effect.Effect<boolean, E2, R2>
  ): Effect.Effect<Option.Option<A>, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, E2 = never, R2 = never>(
    self: Effect.Effect<A, E, R>,
    condition: LazyArg<boolean> | Effect.Effect<boolean, E2, R2>
  ): Effect.Effect<Option.Option<A>, E | E2, R | R2> =>
    flatMap(isEffect(condition) ? condition : sync(condition), (pass) => pass ? asSome(self) : succeedNone)
)

// ----------------------------------------------------------------------------
// repetition
// ----------------------------------------------------------------------------

/** @internal */
export const replicate: {
  (
    n: number
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Array<Effect.Effect<A, E, R>>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    n: number
  ): Array<Effect.Effect<A, E, R>>
} = dual(
  2,
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    n: number
  ): Array<Effect.Effect<A, E, R>> => Array.from({ length: n }, () => self)
)

/** @internal */
export const replicateEffect: {
  (
    n: number,
    options?: {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: false | undefined
    }
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<Array<A>, E, R>
  (
    n: number,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    }
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<void, E, R>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    n: number,
    options?: {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: false | undefined
    }
  ): Effect.Effect<Array<A>, E, R>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    n: number,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    }
  ): Effect.Effect<void, E, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    n: number,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    }
  ): Effect.Effect<void, E, R> => all(replicate(self, n), options)
)

/** @internal */
export const forever: {
  <Arg extends Effect.Effect<any, any, any> | { readonly autoYield?: boolean | undefined } | undefined>(
    effectOrOptions: Arg,
    options?: {
      readonly autoYield?: boolean | undefined
    } | undefined
  ): [Arg] extends [Effect.Effect<infer _A, infer _E, infer _R>] ? Effect.Effect<never, _E, _R>
    : <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<never, E, R>
} = dual((args) => isEffect(args[0]), <A, E, R>(
  self: Effect.Effect<A, E, R>,
  options?: {
    readonly autoYield?: boolean | undefined
  }
): Effect.Effect<never, E, R> =>
  whileLoop({
    while: constTrue,
    body: constant(options?.autoYield ? flatMap(self, () => yieldNow) : self),
    step: constVoid
  }) as any)

// ----------------------------------------------------------------------------
// error handling
// ----------------------------------------------------------------------------

/** @internal */
export const catchCause: {
  <E, B, E2, R2>(
    f: (cause: NoInfer<Cause.Cause<E>>) => Effect.Effect<B, E2, R2>
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A | B, E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (cause: NoInfer<Cause.Cause<E>>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A | B, E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (cause: NoInfer<Cause.Cause<E>>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A | B, E2, R | R2> => {
    const onFailure = Object.create(OnFailureProto)
    onFailure[args] = self
    onFailure[contE] = f.length !== 1 ? (cause: Cause.Cause<E>) => f(cause) : f
    return onFailure
  }
)
const OnFailureProto = makePrimitiveProto({
  op: "OnFailure",
  [evaluate](this: any, fiber: FiberImpl): Primitive {
    fiber._stack.push(this as any)
    return this[args]
  }
})

/** @internal */
export const catchCauseIf: {
  <E, B, E2, R2, EB, X extends Cause.Cause<any>>(
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (failure: EB, cause: Cause.Cause<E>) => Effect.Effect<B, E2, R2>
  ): <A, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A | B, Cause.Cause.Error<X> | E2, R | R2>
  <A, E, R, B, E2, R2, EB, X extends Cause.Cause<any>>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (failure: EB, cause: Cause.Cause<E>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A | B, Cause.Cause.Error<X> | E2, R | R2>
} = dual(
  3,
  <A, E, R, B, E2, R2, EB, X extends Cause.Cause<any>>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (failure: EB, cause: Cause.Cause<E>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A | B, Exclude<E, Cause.Cause.Error<X>> | E2, R | R2> =>
    catchCause(self, (cause): Effect.Effect<B, Cause.Cause.Error<X> | E2, R2> => {
      const eb = filter(cause)
      return !Filter.isFail(eb) ? internalCall(() => f(eb, cause)) : failCause(eb.fail)
    })
)

/** @internal */
export const catch_: {
  <E, B, E2, R2>(
    f: (e: NoInfer<E>) => Effect.Effect<B, E2, R2>
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A | B, E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (e: NoInfer<E>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A | B, E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (a: NoInfer<E>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A | B, E2, R | R2> => catchCauseIf(self, causeFilterError, (e) => f(e))
)

/** @internal */
export const catchDefect: {
  <E, B, E2, R2>(
    f: (defect: unknown) => Effect.Effect<B, E2, R2>
  ): <A, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A | B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (defect: unknown) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A | B, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (defect: unknown) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A | B, E | E2, R | R2> => catchCauseIf(self, causeFilterDefect, f)
)

/** @internal */
export const tapCause: {
  <E, B, E2, R2>(
    f: (cause: NoInfer<Cause.Cause<E>>) => Effect.Effect<B, E2, R2>
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (cause: NoInfer<Cause.Cause<E>>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (cause: NoInfer<Cause.Cause<E>>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A, E | E2, R | R2> =>
    catchCause(self, (cause) => andThen(internalCall(() => f(cause)), failCause(cause)))
)

/** @internal */
export const tapCauseIf: {
  <E, B, E2, R2, EB, X extends Cause.Cause<any>>(
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (a: EB, cause: Cause.Cause<E>) => Effect.Effect<B, E2, R2>
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | E2, R | R2>
  <A, E, R, B, E2, R2, EB, X extends Cause.Cause<any>>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (a: EB, cause: Cause.Cause<E>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A, E | E2, R | R2>
} = dual(
  3,
  <A, E, R, B, E2, R2, EB, X extends Cause.Cause<any>>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (a: EB, cause: Cause.Cause<E>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A, E | E2, R | R2> =>
    catchCauseIf(self, filter, (failure, cause) => andThen(internalCall(() => f(failure, cause)), failCause(cause)))
)

/** @internal */
export const tapError: {
  <E, B, E2, R2>(
    f: (e: NoInfer<E>) => Effect.Effect<B, E2, R2>
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (e: NoInfer<E>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (e: NoInfer<E>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A, E | E2, R | R2> => tapCauseIf(self, causeFilterError, (e) => f(e))
)

/** @internal */
export const tapDefect: {
  <E, B, E2, R2>(
    f: (defect: unknown) => Effect.Effect<B, E2, R2>
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (defect: unknown) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    f: (defect: unknown) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<A, E | E2, R | R2> => tapCauseIf(self, causeFilterDefect, (_) => f(_))
)

/** @internal */
export const catchIf: {
  <E, EB, A2, E2, R2, X>(
    filter: Filter.Filter<NoInfer<E>, EB, X>,
    f: (e: EB) => Effect.Effect<A2, E2, R2>
  ): <A, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A2 | A, E2 | X, R2 | R>
  <A, E, R, EB, A2, E2, R2, X>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<NoInfer<E>, EB, X>,
    f: (e: EB) => Effect.Effect<A2, E2, R2>
  ): Effect.Effect<A | A2, E2 | X, R | R2>
} = dual(
  3,
  <A, E, R, EB, A2, E2, R2, X>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<NoInfer<E>, EB, X>,
    f: (e: EB) => Effect.Effect<A2, E2, R2>
  ): Effect.Effect<A | A2, E2 | X, R | R2> =>
    catchCauseIf(
      self,
      Filter.compose(causeFilterError, Filter.mapFail(filter, causeFail)),
      (e) => f(e)
    )
)

/** @internal */
export const catchTag: {
  <const K extends Tags<E> | Arr.NonEmptyReadonlyArray<Tags<E>>, E, A1, E1, R1>(
    k: K,
    f: (
      e: ExtractTag<NoInfer<E>, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>
    ) => Effect.Effect<A1, E1, R1>
  ): <A, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A1 | A, E1 | ExcludeTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>, R1 | R>
  <
    A,
    E,
    R,
    const K extends Tags<E> | Arr.NonEmptyReadonlyArray<Tags<E>>,
    R1,
    E1,
    A1
  >(
    self: Effect.Effect<A, E, R>,
    k: K,
    f: (e: ExtractTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>) => Effect.Effect<A1, E1, R1>
  ): Effect.Effect<A1 | A, E1 | ExcludeTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>, R1 | R>
} = dual(
  3,
  <
    A,
    E,
    R,
    const K extends Tags<E> | Arr.NonEmptyReadonlyArray<Tags<E>>,
    R1,
    E1,
    A1
  >(
    self: Effect.Effect<A, E, R>,
    k: K,
    f: (e: ExtractTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>) => Effect.Effect<A1, E1, R1>
  ): Effect.Effect<A1 | A, E1 | ExcludeTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>, R1 | R> => {
    const pred = Array.isArray(k)
      ? ((e: E): e is any => hasProperty(e, "_tag") && k.includes(e._tag))
      : isTagged(k as string)
    return catchIf(self, Filter.fromPredicate(pred), f) as any
  }
)

/** @internal */
export const catchTags: {
  <
    E,
    Cases extends (E extends { _tag: string } ? {
        [K in E["_tag"]]+?: (error: Extract<E, { _tag: K }>) => Effect.Effect<any, any, any>
      } :
      {})
  >(
    cases: Cases
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<
    | A
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Effect.Effect<infer A, any, any>) ? A : never
    }[keyof Cases],
    | Exclude<E, { _tag: keyof Cases }>
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Effect.Effect<any, infer E, any>) ? E : never
    }[keyof Cases],
    | R
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Effect.Effect<any, any, infer R>) ? R : never
    }[keyof Cases]
  >
  <
    R,
    E,
    A,
    Cases extends (E extends { _tag: string } ? {
        [K in E["_tag"]]+?: (error: Extract<E, { _tag: K }>) => Effect.Effect<any, any, any>
      } :
      {})
  >(
    self: Effect.Effect<A, E, R>,
    cases: Cases
  ): Effect.Effect<
    | A
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Effect.Effect<infer A, any, any>) ? A : never
    }[keyof Cases],
    | Exclude<E, { _tag: keyof Cases }>
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Effect.Effect<any, infer E, any>) ? E : never
    }[keyof Cases],
    | R
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Effect.Effect<any, any, infer R>) ? R : never
    }[keyof Cases]
  >
} = dual(2, (self, cases) => {
  let keys: Array<string>
  return catchIf(
    self,
    (e) => {
      keys ??= Object.keys(cases)
      return hasProperty(e, "_tag") && isString(e["_tag"]) && keys.includes(e["_tag"]) ? e : Filter.fail(e)
    },
    (e) => internalCall(() => cases[e["_tag"] as string](e))
  )
})

/** @internal */
export const mapErrorCause: {
  <E, E2>(
    f: (e: Cause.Cause<E>) => Cause.Cause<E2>
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E2, R>
  <A, E, R, E2>(
    self: Effect.Effect<A, E, R>,
    f: (e: Cause.Cause<E>) => Cause.Cause<E2>
  ): Effect.Effect<A, E2, R>
} = dual(
  2,
  <A, E, R, E2>(
    self: Effect.Effect<A, E, R>,
    f: (e: Cause.Cause<E>) => Cause.Cause<E2>
  ): Effect.Effect<A, E2, R> => catchCause(self, (cause) => failCauseSync(() => f(cause)))
)

/** @internal */
export const mapError: {
  <E, E2>(
    f: (e: E) => E2
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E2, R>
  <A, E, R, E2>(
    self: Effect.Effect<A, E, R>,
    f: (e: E) => E2
  ): Effect.Effect<A, E2, R>
} = dual(
  2,
  <A, E, R, E2>(
    self: Effect.Effect<A, E, R>,
    f: (e: E) => E2
  ): Effect.Effect<A, E2, R> => catch_(self, (error) => failSync(() => f(error)))
)

/* @internal */
export const mapBoth: {
  <E, E2, A, A2>(
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): <R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A2, E2, R>
  <A, E, R, E2, A2>(
    self: Effect.Effect<A, E, R>,
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): Effect.Effect<A2, E2, R>
} = dual(2, <A, E, R, E2, A2>(
  self: Effect.Effect<A, E, R>,
  options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
): Effect.Effect<A2, E2, R> =>
  matchEffect(self, {
    onFailure: (e) => failSync(() => options.onFailure(e)),
    onSuccess: (a) => sync(() => options.onSuccess(a))
  }))

/** @internal */
export const orDie = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<A, never, R> => catch_(self, die)

/** @internal */
export const orElseSucceed: {
  <B>(
    f: LazyArg<B>
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A | B, never, R>
  <A, E, R, B>(
    self: Effect.Effect<A, E, R>,
    f: LazyArg<B>
  ): Effect.Effect<A | B, never, R>
} = dual(
  2,
  <A, E, R, B>(
    self: Effect.Effect<A, E, R>,
    f: LazyArg<B>
  ): Effect.Effect<A | B, never, R> => catch_(self, (_) => sync(f))
)

/** @internal */
export const ignore = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<void, never, R> => matchEffect(self, { onFailure: (_) => void_, onSuccess: (_) => void_ })

/** @internal */
export const ignoreLogged = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<void, never, R> =>
  matchCauseEffect(self, {
    onFailure: (cause) => logWithLevel("Debug")("Effect.ignoreLogged", cause),
    onSuccess: (_) => void_
  })

/** @internal */
export const option = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<Option.Option<A>, never, R> => match(self, { onFailure: Option.none, onSuccess: Option.some })

/** @internal */
export const result = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<Result.Result<A, E>, never, R> =>
  matchEager(self, { onFailure: Result.fail, onSuccess: Result.succeed })

// ----------------------------------------------------------------------------
// pattern matching
// ----------------------------------------------------------------------------

/** @internal */
export const matchCauseEffect: {
  <E, A2, E2, R2, A, A3, E3, R3>(options: {
    readonly onFailure: (cause: Cause.Cause<E>) => Effect.Effect<A2, E2, R2>
    readonly onSuccess: (a: A) => Effect.Effect<A3, E3, R3>
  }): <R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause.Cause<E>) => Effect.Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect.Effect<A3, E3, R3>
    }
  ): Effect.Effect<A2 | A3, E2 | E3, R2 | R3 | R>
} = dual(
  2,
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause.Cause<E>) => Effect.Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect.Effect<A3, E3, R3>
    }
  ): Effect.Effect<A2 | A3, E2 | E3, R2 | R3 | R> => {
    const primitive = Object.create(OnSuccessAndFailureProto)
    primitive[args] = self
    primitive[contA] = options.onSuccess.length !== 1 ? (a: A) => options.onSuccess(a) : options.onSuccess
    primitive[contE] = options.onFailure.length !== 1
      ? (cause: Cause.Cause<E>) => options.onFailure(cause)
      : options.onFailure
    return primitive
  }
)
const OnSuccessAndFailureProto = makePrimitiveProto({
  op: "OnSuccessAndFailure",
  [evaluate](this: any, fiber: FiberImpl): Primitive {
    fiber._stack.push(this)
    return this[args]
  }
})

/** @internal */
export const matchCause: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (cause: Cause.Cause<E>) => A2
    readonly onSuccess: (a: A) => A3
  }): <R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause.Cause<E>) => A2
      readonly onSuccess: (a: A) => A3
    }
  ): Effect.Effect<A2 | A3, never, R>
} = dual(
  2,
  <A, E, R, A2, A3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause.Cause<E>) => A2
      readonly onSuccess: (a: A) => A3
    }
  ): Effect.Effect<A2 | A3, never, R> =>
    matchCauseEffect(self, {
      onFailure: (cause) => sync(() => options.onFailure(cause)),
      onSuccess: (value) => sync(() => options.onSuccess(value))
    })
)

/** @internal */
export const matchEffect: {
  <E, A2, E2, R2, A, A3, E3, R3>(options: {
    readonly onFailure: (e: E) => Effect.Effect<A2, E2, R2>
    readonly onSuccess: (a: A) => Effect.Effect<A3, E3, R3>
  }): <R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (e: E) => Effect.Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect.Effect<A3, E3, R3>
    }
  ): Effect.Effect<A2 | A3, E2 | E3, R2 | R3 | R>
} = dual(
  2,
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (e: E) => Effect.Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect.Effect<A3, E3, R3>
    }
  ): Effect.Effect<A2 | A3, E2 | E3, R2 | R3 | R> =>
    matchCauseEffect(self, {
      onFailure: (cause) => {
        const fail = cause.failures.find(failureIsFail)
        return fail
          ? internalCall(() => options.onFailure(fail.error))
          : failCause(cause as Cause.Cause<never>)
      },
      onSuccess: options.onSuccess
    })
)

/** @internal */
export const match: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (error: E) => A2
    readonly onSuccess: (value: A) => A3
  }): <R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (error: E) => A2
      readonly onSuccess: (value: A) => A3
    }
  ): Effect.Effect<A2 | A3, never, R>
} = dual(
  2,
  <A, E, R, A2, A3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (error: E) => A2
      readonly onSuccess: (value: A) => A3
    }
  ): Effect.Effect<A2 | A3, never, R> =>
    matchEffect(self, {
      onFailure: (error) => sync(() => options.onFailure(error)),
      onSuccess: (value) => sync(() => options.onSuccess(value))
    })
)

/** @internal */
export const matchEager: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (error: E) => A2
    readonly onSuccess: (value: A) => A3
  }): <R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (error: E) => A2
      readonly onSuccess: (value: A) => A3
    }
  ): Effect.Effect<A2 | A3, never, R>
} = dual(
  2,
  <A, E, R, A2, A3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (error: E) => A2
      readonly onSuccess: (value: A) => A3
    }
  ): Effect.Effect<A2 | A3, never, R> => {
    if (effectIsExit(self)) {
      if (self._tag === "Success") return exitSucceed(options.onSuccess(self.value))
      const error = causeFilterError(self.cause)
      if (Filter.isFail(error)) return self as Exit.Exit<never>
      return exitSucceed(options.onFailure(error))
    }
    return match(self, options)
  }
)

/** @internal */
export const matchCauseEager: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (cause: Cause.Cause<E>) => A2
    readonly onSuccess: (value: A) => A3
  }): <R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause.Cause<E>) => A2
      readonly onSuccess: (value: A) => A3
    }
  ): Effect.Effect<A2 | A3, never, R>
} = dual(
  2,
  <A, E, R, A2, A3>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause.Cause<E>) => A2
      readonly onSuccess: (value: A) => A3
    }
  ): Effect.Effect<A2 | A3, never, R> => {
    if (effectIsExit(self)) {
      if (self._tag === "Success") return exitSucceed(options.onSuccess(self.value))
      return exitSucceed(options.onFailure(self.cause))
    }
    return matchCause(self, options)
  }
)

// ----------------------------------------------------------------------------
// delays & timeouts
// ----------------------------------------------------------------------------

/** @internal */
export const delay: {
  (
    duration: Duration.DurationInput
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    duration: Duration.DurationInput
  ): Effect.Effect<A, E, R>
} = dual(
  2,
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    duration: Duration.DurationInput
  ): Effect.Effect<A, E, R> => andThen(sleep(duration), self)
)

/** @internal */
export const timeoutOrElse: {
  <A2, E2, R2>(options: {
    readonly duration: Duration.DurationInput
    readonly onTimeout: LazyArg<Effect.Effect<A2, E2, R2>>
  }): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly duration: Duration.DurationInput
      readonly onTimeout: LazyArg<Effect.Effect<A2, E2, R2>>
    }
  ): Effect.Effect<A | A2, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(
    self: Effect.Effect<A, E, R>,
    options: {
      readonly duration: Duration.DurationInput
      readonly onTimeout: LazyArg<Effect.Effect<A2, E2, R2>>
    }
  ): Effect.Effect<A | A2, E | E2, R | R2> =>
    raceFirst(
      self,
      flatMap(interruptible(sleep(options.duration)), options.onTimeout),
      {
        onWinner: ({ fiber, index, parentFiber }) => {
          if (index !== 0) return
          ;(parentFiber as FiberImpl).setServices(fiber.services)
        }
      }
    )
)

/** @internal */
export const timeout: {
  (
    duration: Duration.DurationInput
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | Cause.TimeoutError, R>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    duration: Duration.DurationInput
  ): Effect.Effect<A, E | Cause.TimeoutError, R>
} = dual(
  2,
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    duration: Duration.DurationInput
  ): Effect.Effect<A, E | TimeoutError, R> =>
    timeoutOrElse(self, {
      duration,
      onTimeout: () => fail(new TimeoutError())
    })
)

/** @internal */
export const timeoutOption: {
  (
    duration: Duration.DurationInput
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<Option.Option<A>, E, R>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    duration: Duration.DurationInput
  ): Effect.Effect<Option.Option<A>, E, R>
} = dual(
  2,
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    duration: Duration.DurationInput
  ): Effect.Effect<Option.Option<A>, E, R> => raceFirst(asSome(self), as(interruptible(sleep(duration)), Option.none()))
)

// ----------------------------------------------------------------------------
// resources & finalization
// ----------------------------------------------------------------------------

/** @internal */
export const ScopeTypeId: Scope.TypeId = "~effect/Scope"

/** @internal */
export const scopeTag: ServiceMap.Key<Scope.Scope, Scope.Scope> = ServiceMap.Key<Scope.Scope>("effect/Scope")

const ScopeProto = {
  [ScopeTypeId]: ScopeTypeId,
  close: fnUntraced(function*(this: Scope.Scope, exit_: Exit.Exit<any, any>) {
    if (this.state._tag === "Closed") return
    const { finalizers } = this.state
    this.state = { _tag: "Closed", exit: exit_ }
    if (finalizers.size === 0) {
      return
    } else if (finalizers.size === 1) {
      yield* finalizers.values().next().value!(exit_)
      return
    }
    let exits: Array<Exit.Exit<any, never>> = []
    const fibers: Array<Fiber.Fiber<any, never>> = []
    for (const finalizer of Array.from(finalizers.values()).reverse()) {
      if (this.strategy === "sequential") {
        exits.push(yield* exit(finalizer(exit_)))
      } else {
        fibers.push(unsafeFork(getCurrentFiberOrUndefined() as any, finalizer(exit_), true, true))
      }
    }
    if (fibers.length > 0) {
      exits = yield* fiberAwaitAll(fibers)
    }
    return yield* exitAsVoidAll(exits)
  })
} as const

/** @internal */
export const scopeFork = (scope: Scope.Scope, finalizerStrategy?: "sequential" | "parallel") =>
  sync(() => scopeUnsafeFork(scope, finalizerStrategy))

/** @internal */
export const scopeUnsafeFork = (scope: Scope.Scope, finalizerStrategy?: "sequential" | "parallel") => {
  const newScope = scopeUnsafeMake(finalizerStrategy)
  if (scope.state._tag === "Closed") {
    newScope.state = scope.state
    return newScope
  }
  const key = {}
  scope.state.finalizers.set(key, (exit) => newScope.close(exit))
  scopeUnsafeAddFinalizer(newScope, key, (_) => sync(() => scopeUnsafeRemoveFinalizer(scope, key)))
  return newScope
}

/** @internal */
export const scopeAddFinalizerExit = (
  scope: Scope.Scope,
  finalizer: (exit: Exit.Exit<any, any>) => Effect.Effect<unknown>
): Effect.Effect<void> => {
  return suspend(() => {
    if (scope.state._tag === "Open") {
      scope.state.finalizers.set({}, finalizer)
      return void_
    }
    return finalizer(scope.state.exit)
  })
}

/** @internal */
export const scopeAddFinalizer = (
  scope: Scope.Scope,
  finalizer: Effect.Effect<unknown>
): Effect.Effect<void> => scopeAddFinalizerExit(scope, constant(finalizer))

/** @internal */
export const scopeUnsafeAddFinalizer = (
  scope: Scope.Scope,
  key: {},
  finalizer: (exit: Exit.Exit<any, any>) => Effect.Effect<unknown>
): void => {
  if (scope.state._tag === "Open") {
    scope.state.finalizers.set(key, finalizer)
  }
}

/** @internal */
export const scopeUnsafeRemoveFinalizer = (
  scope: Scope.Scope,
  key: {}
): void => {
  if (scope.state._tag === "Open") {
    scope.state.finalizers.delete(key)
  }
}

/** @internal */
export const scopeUnsafeMake = (finalizerStrategy: "sequential" | "parallel" = "sequential"): Scope.Scope.Closeable => {
  const self = Object.create(ScopeProto)
  self.strategy = finalizerStrategy
  self.state = { _tag: "Open", finalizers: new Map() }
  return self
}

/** @internal */
export const scopeMake = (finalizerStrategy?: "sequential" | "parallel"): Effect.Effect<Scope.Scope.Closeable> =>
  sync(() => scopeUnsafeMake(finalizerStrategy))

/** @internal */
export const scope: Effect.Effect<Scope.Scope, never, Scope.Scope> = scopeTag.asEffect()

/** @internal */
export const provideScope: {
  (value: Scope.Scope): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, Scope.Scope>>
  <A, E, R>(self: Effect.Effect<A, E, R>, value: Scope.Scope): Effect.Effect<A, E, Exclude<R, Scope.Scope>>
} = provideService(scopeTag)

/** @internal */
export const scoped = <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, Scope.Scope>> =>
  scopedWith((scope) => provideScope(self, scope))

/** @internal */
export const scopedWith = <A, E, R>(
  f: (scope: Scope.Scope) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  suspend(() => {
    const scope = scopeUnsafeMake()
    return onExit(f(scope), (exit) => scope.close(exit))
  })

/** @internal */
export const acquireRelease = <A, E, R>(
  acquire: Effect.Effect<A, E, R>,
  release: (a: A, exit: Exit.Exit<unknown, unknown>) => Effect.Effect<unknown>
): Effect.Effect<A, E, R | Scope.Scope> =>
  uninterruptible(
    flatMap(scope, (scope) =>
      tap(acquire, (a) => scopeAddFinalizerExit(scope, (exit) => internalCall(() => release(a, exit)))))
  )

/** @internal */
export const addFinalizer = <R>(
  finalizer: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<void, never, R>
): Effect.Effect<void, never, R | Scope.Scope> =>
  flatMap(
    scope,
    (scope) =>
      servicesWith((services: ServiceMap.ServiceMap<R>) =>
        scopeAddFinalizerExit(scope, (exit) => provideServices(finalizer(exit), services))
      )
  )

/** @internal */
export const onExit: {
  <A, E, XE, XR>(
    f: (exit: Exit.Exit<A, E>) => Effect.Effect<void, XE, XR>
  ): <R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(
    self: Effect.Effect<A, E, R>,
    f: (exit: Exit.Exit<A, E>) => Effect.Effect<void, XE, XR>
  ): Effect.Effect<A, E | XE, R | XR>
} = dual(
  2,
  <A, E, R, XE, XR>(
    self: Effect.Effect<A, E, R>,
    f: (exit: Exit.Exit<A, E>) => Effect.Effect<void, XE, XR>
  ): Effect.Effect<A, E | XE, R | XR> =>
    uninterruptibleMask((restore) =>
      matchCauseEffect(restore(self), {
        onFailure: (cause) => flatMap(internalCall(() => f(exitFailCause(cause))), () => failCause(cause)),
        onSuccess: (a) => flatMap(internalCall(() => f(exitSucceed(a))), () => succeed(a))
      })
    )
)

/** @internal */
export const ensuring: {
  <XE, XR>(
    finalizer: Effect.Effect<void, XE, XR>
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(
    self: Effect.Effect<A, E, R>,
    finalizer: Effect.Effect<void, XE, XR>
  ): Effect.Effect<A, E | XE, R | XR>
} = dual(
  2,
  <A, E, R, XE, XR>(
    self: Effect.Effect<A, E, R>,
    finalizer: Effect.Effect<void, XE, XR>
  ): Effect.Effect<A, E | XE, R | XR> => onExit(self, (_) => finalizer)
)

/** @internal */
export const onExitIf: {
  <A, E, XE, XR, B, X>(
    filter: Filter.Filter<Exit.Exit<NoInfer<A>, NoInfer<E>>, B, X>,
    f: (b: B) => Effect.Effect<void, XE, XR>
  ): <R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR, B extends Exit.Exit<A, E>, X>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<Exit.Exit<NoInfer<A>, NoInfer<E>>, B, X>,
    f: (b: B) => Effect.Effect<void, XE, XR>
  ): Effect.Effect<A, E | XE, R | XR>
} = dual(
  3,
  <A, E, R, XE, XR, B extends Exit.Exit<A, E>, X>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<Exit.Exit<NoInfer<A>, NoInfer<E>>, B, X>,
    f: (b: B) => Effect.Effect<void, XE, XR>
  ): Effect.Effect<A, E | XE, R | XR> =>
    onExit(self, (exit) => {
      const b = filter(exit)
      return Filter.isFail(b) ? exitVoid : f(b)
    })
)

/** @internal */
export const onError: {
  <A, E, XE, XR>(
    f: (cause: Cause.Cause<NoInfer<E>>) => Effect.Effect<void, XE, XR>
  ): <R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(
    self: Effect.Effect<A, E, R>,
    f: (cause: Cause.Cause<NoInfer<E>>) => Effect.Effect<void, XE, XR>
  ): Effect.Effect<A, E | XE, R | XR>
} = dual(
  2,
  <A, E, R, XE, XR>(
    self: Effect.Effect<A, E, R>,
    f: (cause: Cause.Cause<NoInfer<E>>) => Effect.Effect<void, XE, XR>
  ): Effect.Effect<A, E | XE, R | XR> => uninterruptibleMask((restore) => tapCause(restore(self), f))
)

/** @internal */
export const onInterrupt: {
  <XE, XR>(
    finalizer: Effect.Effect<void, XE, XR>
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(
    self: Effect.Effect<A, E, R>,
    finalizer: Effect.Effect<void, XE, XR>
  ): Effect.Effect<A, E | XE, R | XR>
} = dual(
  2,
  <A, E, R, XE, XR>(
    self: Effect.Effect<A, E, R>,
    finalizer: Effect.Effect<void, XE, XR>
  ): Effect.Effect<A, E | XE, R | XR> => onError(self, (cause) => causeHasInterrupt(cause) ? finalizer : void_)
)

/** @internal */
export const acquireUseRelease = <Resource, E, R, A, E2, R2, E3, R3>(
  acquire: Effect.Effect<Resource, E, R>,
  use: (a: Resource) => Effect.Effect<A, E2, R2>,
  release: (a: Resource, exit: Exit.Exit<A, E2>) => Effect.Effect<void, E3, R3>
): Effect.Effect<A, E | E2 | E3, R | R2 | R3> =>
  uninterruptibleMask((restore) =>
    flatMap(
      acquire,
      (a) => flatMap(exit(restore(use(a))), (exit) => flatMap(internalCall(() => release(a, exit)), () => exit))
    )
  )

// ----------------------------------------------------------------------------
// Caching
// ----------------------------------------------------------------------------

/** @internal */
export const cachedInvalidateWithTTL: {
  (timeToLive: Duration.DurationInput): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<[Effect.Effect<A, E>, Effect.Effect<void>], never, R>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    timeToLive: Duration.DurationInput
  ): Effect.Effect<[Effect.Effect<A, E>, Effect.Effect<void>], never, R>
} = dual(2, <A, E, R>(
  self: Effect.Effect<A, E, R>,
  ttl: Duration.DurationInput
): Effect.Effect<[Effect.Effect<A, E>, Effect.Effect<void>], never, R> =>
  withFiber((fiber) => {
    const services = fiber.services as ServiceMap.ServiceMap<R>
    const ttlMillis = Duration.toMillis(ttl)
    const latch = unsafeMakeLatch(false)
    let expiresAt = 0
    let running = false
    let exit: Exit.Exit<A, E> | undefined
    const wait = flatMap(latch.await, () => exit!)
    return succeed([
      withFiber((fiber) => {
        const now = fiber.getRef(ClockRef).unsafeCurrentTimeMillis()
        if (running || now < expiresAt) return exit ?? wait
        running = true
        latch.unsafeClose()
        exit = undefined
        return onExit(provideServices(self, services), (exit_) => {
          running = false
          expiresAt = now + ttlMillis
          exit = exit_
          return latch.open
        })
      }),
      sync(() => {
        expiresAt = 0
        latch.unsafeClose()
        exit = undefined
      })
    ])
  }))

/** @internal */
export const cachedWithTTL: {
  (
    timeToLive: Duration.DurationInput
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<Effect.Effect<A, E>, never, R>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    timeToLive: Duration.DurationInput
  ): Effect.Effect<Effect.Effect<A, E>, never, R>
} = dual(
  2,
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    timeToLive: Duration.DurationInput
  ): Effect.Effect<Effect.Effect<A, E>, never, R> => map(cachedInvalidateWithTTL(self, timeToLive), (tuple) => tuple[0])
)

/** @internal */
export const cached = <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<Effect.Effect<A, E>, never, R> =>
  cachedWithTTL(self, Duration.infinity)

// ----------------------------------------------------------------------------
// interruption
// ----------------------------------------------------------------------------

/** @internal */
export const interrupt: Effect.Effect<never> = withFiber((fiber) => failCause(causeInterrupt(fiber.id)))

/** @internal */
export const uninterruptible = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  withFiber((fiber) => {
    if (!fiber.interruptible) return self
    fiber.interruptible = false
    fiber._stack.push(setInterruptible(true))
    return self
  })

const setInterruptible: (interruptible: boolean) => Primitive = makePrimitive({
  op: "SetInterruptible",
  [contAll](fiber) {
    fiber.interruptible = this[args]
    if (fiber._interruptedCause && fiber.interruptible) {
      return () => failCause(fiber._interruptedCause!)
    }
  }
})

/** @internal */
export const interruptible = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  withFiber((fiber) => {
    if (fiber.interruptible) return self
    fiber.interruptible = true
    fiber._stack.push(setInterruptible(false))
    if (fiber._interruptedCause) return failCause(fiber._interruptedCause)
    return self
  })

/** @internal */
export const uninterruptibleMask = <A, E, R>(
  f: (
    restore: <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  withFiber((fiber) => {
    if (!fiber.interruptible) return f(identity)
    fiber.interruptible = false
    fiber._stack.push(setInterruptible(true))
    return f(interruptible)
  })

/** @internal */
export const interruptibleMask = <A, E, R>(
  f: (
    restore: <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  withFiber((fiber) => {
    if (fiber.interruptible) return f(identity)
    fiber.interruptible = true
    fiber._stack.push(setInterruptible(false))
    return f(uninterruptible)
  })

// ========================================================================
// collecting & elements
// ========================================================================

/** @internal */
export const all = <
  const Arg extends
    | Iterable<Effect.Effect<any, any, any>>
    | Record<string, Effect.Effect<any, any, any>>,
  O extends {
    readonly concurrency?: Concurrency | undefined
    readonly discard?: boolean | undefined
  }
>(
  arg: Arg,
  options?: O
): Effect.All.Return<Arg, O> => {
  if (Array.isArray(arg) || isIterable(arg)) {
    return (forEach as any)(arg, identity, options)
  } else if (options?.discard) {
    return (forEach as any)(Object.values(arg), identity, options)
  }
  return suspend(() => {
    const out: Record<string, unknown> = {}
    return as(
      forEach(
        Object.entries(arg),
        ([key, effect]) =>
          map(effect, (value) => {
            out[key] = value
          }),
        {
          discard: true,
          concurrency: options?.concurrency
        }
      ),
      out
    )
  }) as any
}

/** @internal */
export const whileLoop: <A, E, R>(options: {
  readonly while: LazyArg<boolean>
  readonly body: LazyArg<Effect.Effect<A, E, R>>
  readonly step: (a: A) => void
}) => Effect.Effect<void, E, R> = makePrimitive({
  op: "While",
  [contA](value, fiber) {
    this[args].step(value)
    if (this[args].while()) {
      fiber._stack.push(this)
      return this[args].body()
    }
    return exitVoid
  },
  [evaluate](fiber) {
    if (this[args].while()) {
      fiber._stack.push(this)
      return this[args].body()
    }
    return exitVoid
  }
})

/** @internal */
export const forEach: {
  <B, E, R, S extends Iterable<any>>(
    f: (a: Arr.ReadonlyArray.Infer<S>, i: number) => Effect.Effect<B, E, R>,
    options?: {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: false | undefined
    } | undefined
  ): (
    self: S
  ) => Effect.Effect<Arr.ReadonlyArray.With<S, B>, E, R>
  <A, B, E, R>(
    f: (a: A, i: number) => Effect.Effect<B, E, R>,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    }
  ): (self: Iterable<A>) => Effect.Effect<void, E, R>
  <B, E, R, S extends Iterable<any>>(
    self: S,
    f: (a: Arr.ReadonlyArray.Infer<S>, i: number) => Effect.Effect<B, E, R>,
    options?: {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: false | undefined
    } | undefined
  ): Effect.Effect<Arr.ReadonlyArray.With<S, B>, E, R>
  <A, B, E, R>(
    self: Iterable<A>,
    f: (a: A, i: number) => Effect.Effect<B, E, R>,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    }
  ): Effect.Effect<void, E, R>
} = dual((args) => typeof args[1] === "function", <A, B, E, R>(
  iterable: Iterable<A>,
  f: (a: A, index: number) => Effect.Effect<B, E, R>,
  options?: {
    readonly concurrency?: Concurrency | undefined
    readonly discard?: boolean | undefined
  }
): Effect.Effect<any, E, R> =>
  withFiber((parent) => {
    const concurrencyOption = options?.concurrency === "inherit"
      ? parent.getRef(CurrentConcurrency)
      : (options?.concurrency ?? 1)
    const concurrency = concurrencyOption === "unbounded"
      ? Number.POSITIVE_INFINITY
      : Math.max(1, concurrencyOption)

    if (concurrency === 1) {
      return forEachSequential(iterable, f, options)
    }

    const items = Arr.fromIterable(iterable)
    let length = items.length
    if (length === 0) {
      return options?.discard ? void_ : succeed([])
    }

    const out: Array<B> | undefined = options?.discard
      ? undefined
      : new Array(length)
    let index = 0
    const span = parent.currentSpanLocal

    return callback((resume) => {
      const fibers = new Set<Fiber.Fiber<unknown, unknown>>()
      const failures: Array<Cause.Failure<E>> = []
      let failed = false
      let inProgress = 0
      let doneCount = 0
      let pumping = false
      let interrupted = false
      function pump() {
        pumping = true
        while (inProgress < concurrency && index < length) {
          const currentIndex = index
          const item = items[currentIndex]
          index++
          inProgress++
          try {
            const child = unsafeFork(parent, f(item, currentIndex), true, true)
            fibers.add(child)
            child.addObserver((exit) => {
              if (interrupted) {
                return
              }
              fibers.delete(child)
              if (exit._tag === "Failure") {
                if (!failed) {
                  failed = true
                  length = index
                  // eslint-disable-next-line no-restricted-syntax
                  failures.push(...exit.cause.failures)
                  fibers.forEach((fiber) => fiber.unsafeInterrupt())
                  fibers.forEach((fiber) => fiber.unsafeInterrupt(parent.id, span))
                } else {
                  for (const f of exit.cause.failures) {
                    if (f._tag === "Interrupt") continue
                    failures.push(f)
                  }
                }
              } else if (out !== undefined) {
                out[currentIndex] = exit.value
              }
              doneCount++
              inProgress--
              if (doneCount === length) {
                resume(failures.length > 0 ? exitFailCause(causeFromFailures(failures)) : succeed(out))
              } else if (!pumping && !failed && inProgress < concurrency) {
                pump()
              }
            })
          } catch (err) {
            failed = true
            length = index
            failures.push(causeDie(err).failures[0])
            fibers.forEach((fiber) => fiber.unsafeInterrupt(parent.id, span))
          }
        }
        pumping = false
      }
      pump()

      return suspend(() => {
        interrupted = true
        index = length
        return fiberInterruptAll(fibers)
      })
    })
  }))

const forEachSequential = <A, B, E, R>(
  iterable: Iterable<A>,
  f: (a: A, index: number) => Effect.Effect<B, E, R>,
  options?: {
    readonly discard?: boolean | undefined
  }
) =>
  suspend(() => {
    const out: Array<B> | undefined = options?.discard ? undefined : []
    const iterator = iterable[Symbol.iterator]()
    let state = iterator.next()
    let index = 0
    return as(
      whileLoop({
        while: () => !state.done,
        body: () => f(state.value!, index++),
        step: (b) => {
          if (out) out.push(b)
          state = iterator.next()
        }
      }),
      out
    )
  })

/* @internal */
export const filterOrElse: {
  <A, C, E2, R2, B, X>(
    filter: Filter.Filter<NoInfer<A>, B, X>,
    orElse: (a: X) => Effect.Effect<C, E2, R2>
  ): <E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<B | C, E2 | E, R2 | R>
  <A, E, R, C, E2, R2, B, X>(
    self: Effect.Effect<A, E, R>,
    filter: Filter.Filter<NoInfer<A>, B, X>,
    orElse: (a: X) => Effect.Effect<C, E2, R2>
  ): Effect.Effect<B | C, E | E2, R | R2>
} = dual(3, <A, E, R, C, E2, R2, B, X>(
  self: Effect.Effect<A, E, R>,
  filter: Filter.Filter<NoInfer<A>, B, X>,
  orElse: (a: X) => Effect.Effect<C, E2, R2>
): Effect.Effect<B | C, E | E2, R | R2> =>
  flatMap(
    self,
    (a): Effect.Effect<B | C, E2, R2> => {
      const b = filter(a)
      return Filter.isFail(b) ? internalCall(() => orElse(b.fail)) : succeed(b)
    }
  ))

/** @internal */
export const filter = <A, B, X, E, R>(
  iterable: Iterable<A>,
  f: Filter.FilterEffect<NoInfer<A>, B, X, E, R>,
  options?: {
    readonly concurrency?: Concurrency | undefined
  }
): Effect.Effect<Array<B>, E, R> =>
  suspend(() => {
    const out: Array<B> = []
    return as(
      forEach(
        iterable,
        (a) =>
          map(f(a), (o) => {
            if (Filter.isPass(o)) {
              out.push(o)
            }
          }),
        {
          discard: true,
          concurrency: options?.concurrency
        }
      ),
      out
    )
  })

// ----------------------------------------------------------------------------
// do notation
// ----------------------------------------------------------------------------

/** @internal */
export const Do: Effect.Effect<{}> = succeed({})

/** @internal */
export const bindTo: {
  <N extends string>(
    name: N
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<Record<N, A>, E, R>
  <A, E, R, N extends string>(
    self: Effect.Effect<A, E, R>,
    name: N
  ): Effect.Effect<Record<N, A>, E, R>
} = doNotation.bindTo<Effect.EffectTypeLambda>(map)

/** @internal */
export const bind: {
  <N extends string, A extends Record<string, any>, B, E2, R2>(
    name: N,
    f: (a: NoInfer<A>) => Effect.Effect<B, E2, R2>
  ): <E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<Simplify<Omit<A, N> & Record<N, B>>, E | E2, R | R2>
  <A extends Record<string, any>, E, R, B, E2, R2, N extends string>(
    self: Effect.Effect<A, E, R>,
    name: N,
    f: (a: NoInfer<A>) => Effect.Effect<B, E2, R2>
  ): Effect.Effect<Simplify<Omit<A, N> & Record<N, B>>, E | E2, R | R2>
} = doNotation.bind<Effect.EffectTypeLambda>(map, flatMap)

const let_: {
  <N extends string, A extends Record<string, any>, B>(
    name: N,
    f: (a: NoInfer<A>) => B
  ): <E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<Simplify<Omit<A, N> & Record<N, B>>, E, R>
  <A extends Record<string, any>, E, R, B, N extends string>(
    self: Effect.Effect<A, E, R>,
    name: N,
    f: (a: NoInfer<A>) => B
  ): Effect.Effect<Simplify<Omit<A, N> & Record<N, B>>, E, R>
} = doNotation.let_<Effect.EffectTypeLambda>(map)

export {
  /** @internal */
  let_ as let
}

// ----------------------------------------------------------------------------
// fibers & forking
// ----------------------------------------------------------------------------

/** @internal */
export const fork: {
  <
    Arg extends Effect.Effect<any, any, any> | {
      readonly startImmediately?: boolean | undefined
      readonly uninterruptible?: boolean | "inherit" | undefined
    } | undefined
  >(
    effectOrOptions: Arg,
    options?: {
      readonly startImmediately?: boolean | undefined
      readonly uninterruptible?: boolean | "inherit" | undefined
    } | undefined
  ): [Arg] extends [Effect.Effect<infer _A, infer _E, infer _R>] ? Effect.Effect<Fiber.Fiber<_A, _E>, never, _R>
    : <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<Fiber.Fiber<A, E>, never, R>
} = dual((args) => isEffect(args[0]), <A, E, R>(
  self: Effect.Effect<A, E, R>,
  options?: {
    readonly startImmediately?: boolean
    readonly uninterruptible?: boolean | "inherit"
  }
): Effect.Effect<Fiber.Fiber<A, E>, never, R> =>
  withFiber((fiber) => {
    fiberMiddleware.interruptChildren ??= fiberInterruptChildren
    return succeed(unsafeFork(
      fiber,
      self,
      options?.startImmediately,
      false,
      options?.uninterruptible ?? false
    ))
  }))

const unsafeFork = <FA, FE, A, E, R>(
  parent: FiberImpl<FA, FE>,
  effect: Effect.Effect<A, E, R>,
  immediate = false,
  daemon = false,
  uninterruptible: boolean | "inherit" = false
): Fiber.Fiber<A, E> => {
  const interruptible = uninterruptible === "inherit" ? parent.interruptible : !uninterruptible
  const child = makeFiber<A, E>(parent.services, interruptible)
  if (immediate) {
    child.evaluate(effect as any)
  } else {
    parent.currentScheduler.scheduleTask(() => child.evaluate(effect as any), 0)
  }
  if (!daemon && !child._exit) {
    parent.children().add(child)
    child.addObserver(() => parent._children!.delete(child))
  }
  return child
}

/** @internal */
export const forkDaemon: {
  <
    Arg extends Effect.Effect<any, any, any> | {
      readonly startImmediately?: boolean | undefined
      readonly uninterruptible?: boolean | "inherit" | undefined
    } | undefined
  >(
    effectOrOptions: Arg,
    options?: {
      readonly startImmediately?: boolean | undefined
      readonly uninterruptible?: boolean | "inherit" | undefined
    } | undefined
  ): [Arg] extends [Effect.Effect<infer _A, infer _E, infer _R>] ? Effect.Effect<Fiber.Fiber<_A, _E>, never, _R>
    : <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<Fiber.Fiber<A, E>, never, R>
} = dual((args) => isEffect(args[0]), <A, E, R>(
  self: Effect.Effect<A, E, R>,
  options?: {
    readonly startImmediately?: boolean
    readonly uninterruptible?: boolean | "inherit" | undefined
  }
): Effect.Effect<Fiber.Fiber<A, E>, never, R> =>
  withFiber((fiber) => succeed(unsafeFork(fiber, self, options?.startImmediately, true, options?.uninterruptible))))

/** @internal */
export const forkIn: {
  (
    scope: Scope.Scope,
    options?: {
      readonly startImmediately?: boolean | undefined
      readonly uninterruptible?: boolean | "inherit" | undefined
    }
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<Fiber.Fiber<A, E>, never, R>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    scope: Scope.Scope,
    options?: {
      readonly startImmediately?: boolean | undefined
      readonly uninterruptible?: boolean | "inherit" | undefined
    }
  ): Effect.Effect<Fiber.Fiber<A, E>, never, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    scope: Scope.Scope,
    options?: {
      readonly startImmediately?: boolean | undefined
      readonly uninterruptible?: boolean | "inherit" | undefined
    }
  ): Effect.Effect<Fiber.Fiber<A, E>, never, R> =>
    withFiber((parent) => {
      const fiber = unsafeFork(parent, self, options?.startImmediately, true, options?.uninterruptible)
      if (!(fiber as FiberImpl<any, any>)._exit) {
        if (scope.state._tag === "Open") {
          const key = {}
          const finalizer = () => withFiberId((interruptor) => interruptor === fiber.id ? void_ : fiberInterrupt(fiber))
          scopeUnsafeAddFinalizer(scope, key, finalizer)
          fiber.addObserver(() => scopeUnsafeRemoveFinalizer(scope, key))
        } else {
          fiber.unsafeInterrupt(parent.id, parent.currentSpanLocal)
        }
      }
      return succeed(fiber)
    })
)

/** @internal */
export const forkScoped: {
  <
    Arg extends Effect.Effect<any, any, any> | {
      readonly startImmediately?: boolean | undefined
      readonly uninterruptible?: boolean | "inherit" | undefined
    } | undefined
  >(
    effectOrOptions: Arg,
    options?: {
      readonly startImmediately?: boolean | undefined
      readonly uninterruptible?: boolean | "inherit" | undefined
    } | undefined
  ): [Arg] extends [Effect.Effect<infer _A, infer _E, infer _R>] ? Effect.Effect<Fiber.Fiber<_A, _E>, never, _R>
    : <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<Fiber.Fiber<A, E>, never, R | Scope.Scope>
} = dual((args) => isEffect(args[0]), <A, E, R>(
  self: Effect.Effect<A, E, R>,
  options?: {
    readonly startImmediately?: boolean
    readonly uninterruptible?: boolean | "inherit"
  }
): Effect.Effect<Fiber.Fiber<A, E>, never, R | Scope.Scope> => flatMap(scope, (scope) => forkIn(self, scope, options)))

// ----------------------------------------------------------------------------
// execution
// ----------------------------------------------------------------------------

/** @internal */
export const runForkWith = <R>(services: ServiceMap.ServiceMap<R>) =>
<A, E>(
  effect: Effect.Effect<A, E, R>,
  options?: Effect.RunOptions | undefined
): Fiber.Fiber<A, E> => {
  const serviceMap = new Map(services.unsafeMap)
  serviceMap.set(Scheduler.Scheduler.key, options?.scheduler ?? new Scheduler.MixedScheduler())
  const fiber = makeFiber<A, E>(ServiceMap.unsafeMake(serviceMap))
  fiber.evaluate(effect as any)
  if (options?.signal) {
    if (options.signal.aborted) {
      fiber.unsafeInterrupt()
    } else {
      const abort = () => fiber.unsafeInterrupt()
      options.signal.addEventListener("abort", abort, { once: true })
      fiber.addObserver(() => options.signal!.removeEventListener("abort", abort))
    }
  }
  return fiber
}

/** @internal */
export const runFork: <A, E>(
  effect: Effect.Effect<A, E, never>,
  options?: Effect.RunOptions | undefined
) => Fiber.Fiber<A, E> = runForkWith(ServiceMap.empty())

/** @internal */
export const runPromiseExitWith = <R>(services: ServiceMap.ServiceMap<R>) => {
  const runFork = runForkWith(services)
  return <A, E>(
    effect: Effect.Effect<A, E, R>,
    options?: Effect.RunOptions | undefined
  ): Promise<Exit.Exit<A, E>> => {
    const fiber = runFork(effect, options)
    return new Promise((resolve) => {
      fiber.addObserver((exit) => resolve(exit))
    })
  }
}

/** @internal */
export const runPromiseExit = runPromiseExitWith(ServiceMap.empty())

/** @internal */
export const runPromiseWith = <R>(services: ServiceMap.ServiceMap<R>) => {
  const runPromiseExit = runPromiseExitWith(services)
  return <A, E>(
    effect: Effect.Effect<A, E, R>,
    options?:
      | Effect.RunOptions
      | undefined
  ): Promise<A> =>
    runPromiseExit(effect, options).then((exit) => {
      if (exit._tag === "Failure") {
        throw causeSquash(exit.cause)
      }
      return exit.value
    })
}

/** @internal */
export const runPromise: <A, E>(
  effect: Effect.Effect<A, E>,
  options?:
    | Effect.RunOptions
    | undefined
) => Promise<A> = runPromiseWith(ServiceMap.empty())

/** @internal */
export const runSyncExitWith = <R>(services: ServiceMap.ServiceMap<R>) => {
  const runFork = runForkWith(services)
  return <A, E>(effect: Effect.Effect<A, E, R>): Exit.Exit<A, E> => {
    const scheduler = new Scheduler.MixedScheduler("sync")
    const fiber = runFork(effect, { scheduler })
    scheduler.flush()
    return (fiber as FiberImpl<A, E>)._exit ?? exitDie(fiber)
  }
}

/** @internal */
export const runSyncExit: <A, E>(effect: Effect.Effect<A, E>) => Exit.Exit<A, E> = runSyncExitWith(
  ServiceMap.empty()
)

/** @internal */
export const runSyncWith = <R>(services: ServiceMap.ServiceMap<R>) => {
  const runSyncExit = runSyncExitWith(services)
  return <A, E>(effect: Effect.Effect<A, E, R>): A => {
    const exit = runSyncExit(effect)
    if (exit._tag === "Failure") throw causeSquash(exit.cause)
    return exit.value
  }
}

/** @internal */
export const runSync: <A, E>(effect: Effect.Effect<A, E>) => A = runSyncWith(ServiceMap.empty())

// ----------------------------------------------------------------------------
// Semaphore
// ----------------------------------------------------------------------------

/** @internal */
class Semaphore {
  public waiters = new Set<() => void>()
  public taken = 0

  constructor(readonly permits: number) {}

  get free() {
    return this.permits - this.taken
  }

  readonly take = (n: number): Effect.Effect<number> =>
    callback<number>((resume) => {
      if (this.free < n) {
        const observer = () => {
          if (this.free < n) {
            return
          }
          this.waiters.delete(observer)
          this.taken += n
          resume(succeed(n))
        }
        this.waiters.add(observer)
        return sync(() => {
          this.waiters.delete(observer)
        })
      }
      this.taken += n
      return resume(succeed(n))
    })

  readonly updateTaken = (f: (n: number) => number): Effect.Effect<number> =>
    withFiber((fiber) => {
      this.taken = f(this.taken)
      if (this.waiters.size > 0) {
        fiber.currentScheduler.scheduleTask(() => {
          const iter = this.waiters.values()
          let item = iter.next()
          while (item.done === false && this.free > 0) {
            item.value()
            item = iter.next()
          }
        }, 0)
      }
      return succeed(this.free)
    })

  readonly release = (n: number): Effect.Effect<number> => this.updateTaken((taken) => taken - n)

  readonly releaseAll: Effect.Effect<number> = this.updateTaken((_) => 0)

  readonly withPermits = (n: number) => <A, E, R>(self: Effect.Effect<A, E, R>) =>
    uninterruptibleMask((restore) =>
      flatMap(restore(this.take(n)), (permits) => ensuring(restore(self), this.release(permits)))
    )

  readonly withPermitsIfAvailable = (n: number) => <A, E, R>(self: Effect.Effect<A, E, R>) =>
    uninterruptibleMask((restore) =>
      suspend(() => {
        if (this.free < n) {
          return succeedNone
        }
        this.taken += n
        return ensuring(restore(asSome(self)), this.release(n))
      })
    )
}

/** @internal */
export const unsafeMakeSemaphore = (permits: number): Semaphore => new Semaphore(permits)

/** @internal */
export const makeSemaphore = (permits: number) => sync(() => unsafeMakeSemaphore(permits))

const succeedTrue = succeed(true)
const succeedFalse = succeed(false)

class Latch implements Effect.Latch {
  waiters: Array<(_: Effect.Effect<void>) => void> = []
  scheduled = false
  constructor(private isOpen: boolean) {}

  private unsafeSchedule(fiber: Fiber.Fiber<unknown, unknown>) {
    if (this.scheduled || this.waiters.length === 0) {
      return succeedTrue
    }
    this.scheduled = true
    fiber.currentScheduler.scheduleTask(this.flushWaiters, 0)
    return succeedTrue
  }
  private flushWaiters = () => {
    this.scheduled = false
    const waiters = this.waiters
    this.waiters = []
    for (let i = 0; i < waiters.length; i++) {
      waiters[i](exitVoid)
    }
  }

  open = withFiber<boolean>((fiber) => {
    if (this.isOpen) return succeedFalse
    this.isOpen = true
    return this.unsafeSchedule(fiber)
  })
  release = withFiber<boolean>((fiber) => this.open ? succeedFalse : this.unsafeSchedule(fiber))
  unsafeOpen() {
    if (this.isOpen) return false
    this.isOpen = true
    this.flushWaiters()
    return true
  }
  await = callback<void>((resume) => {
    if (this.isOpen) {
      return resume(void_)
    }
    this.waiters.push(resume)
    return sync(() => {
      const index = this.waiters.indexOf(resume)
      if (index !== -1) {
        this.waiters.splice(index, 1)
      }
    })
  })
  unsafeClose() {
    if (!this.isOpen) return false
    this.isOpen = false
    return true
  }
  close = sync(() => this.unsafeClose())
  whenOpen = <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => andThen(this.await, self)
}

/** @internal */
export const unsafeMakeLatch = (open?: boolean | undefined): Effect.Latch => new Latch(open ?? false)

/** @internal */
export const makeLatch = (open?: boolean | undefined) => sync(() => unsafeMakeLatch(open))

// ----------------------------------------------------------------------------
// Tracer
// ----------------------------------------------------------------------------

/** @internal */
export const tracer: Effect.Effect<Tracer.Tracer> = withFiber((fiber) => succeed(fiber.getRef(Tracer.Tracer)))

/** @internal */
export const withTracer: {
  (tracer: Tracer.Tracer): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(effect: Effect.Effect<A, E, R>, tracer: Tracer.Tracer): Effect.Effect<A, E, R>
} = dual(
  2,
  <A, E, R>(effect: Effect.Effect<A, E, R>, tracer: Tracer.Tracer): Effect.Effect<A, E, R> =>
    provideService(effect, Tracer.Tracer, tracer)
)

/** @internal */
export const withTracerEnabled: {
  (enabled: boolean): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(effect: Effect.Effect<A, E, R>, enabled: boolean): Effect.Effect<A, E, R>
} = provideService(TracerEnabled)

const bigint0 = BigInt(0)

const NoopSpanProto: Omit<Tracer.Span, "parent" | "name" | "context"> = {
  _tag: "Span",
  spanId: "noop",
  traceId: "noop",
  sampled: false,
  status: {
    _tag: "Ended",
    startTime: bigint0,
    endTime: bigint0,
    exit: exitVoid
  },
  attributes: new Map(),
  links: [],
  kind: "internal",
  attribute() {},
  event() {},
  end() {}
}

/** @internal */
export const noopSpan = (options: {
  readonly name: string
  readonly parent: Option.Option<Tracer.AnySpan>
  readonly context: ServiceMap.ServiceMap<never>
}): Tracer.Span => Object.assign(Object.create(NoopSpanProto), options)

const filterDisablePropagation: (self: Option.Option<Tracer.AnySpan>) => Option.Option<Tracer.AnySpan> = Option.flatMap(
  (span) =>
    ServiceMap.get(span.context, Tracer.DisablePropagation)
      ? span._tag === "Span" ? filterDisablePropagation(span.parent) : Option.none()
      : Option.some(span)
)

/** @internal */
export const spanToTrace = new WeakMap<Tracer.Span, LazyArg<string | undefined>>()

/** @internal */
export const unsafeMakeSpan = <XA, XE>(
  fiber: Fiber.Fiber<XA, XE>,
  name: string,
  options: Tracer.SpanOptions
) => {
  const disablePropagation = !fiber.getRef(TracerEnabled) ||
    (options.context && ServiceMap.get(options.context, Tracer.DisablePropagation))
  const parent = options.parent
    ? Option.some(options.parent)
    : options.root
    ? Option.none()
    : filterDisablePropagation(Option.fromNullable(fiber.currentSpan))

  let span: Tracer.Span

  if (disablePropagation) {
    span = noopSpan({
      name,
      parent,
      context: ServiceMap.add(
        options.context ?? ServiceMap.empty(),
        Tracer.DisablePropagation,
        true
      )
    })
  } else {
    const tracer = fiber.getRef(Tracer.Tracer)
    const clock = fiber.getRef(ClockRef)
    const annotationsFromEnv = fiber.getRef(TracerSpanAnnotations)
    const linksFromEnv = fiber.getRef(TracerSpanLinks)

    const links = options.links !== undefined ?
      [...linksFromEnv, ...options.links] :
      linksFromEnv

    span = tracer.span(
      name,
      parent,
      options.context ?? ServiceMap.empty(),
      links,
      clock.unsafeCurrentTimeNanos(),
      options.kind ?? "internal"
    )

    for (const [key, value] of Object.entries(annotationsFromEnv)) {
      span.attribute(key, value)
    }
    if (options.attributes !== undefined) {
      for (const [key, value] of Object.entries(options.attributes)) {
        span.attribute(key, value)
      }
    }
  }

  if (typeof options.captureStackTrace === "function") {
    spanToTrace.set(span, options.captureStackTrace)
  }

  return span
}

/** @internal */
export const makeSpan = (
  name: string,
  options?: Tracer.SpanOptions
): Effect.Effect<Tracer.Span> => {
  options = addSpanStackTrace(options)
  return withFiber((fiber) => succeed(unsafeMakeSpan(fiber, name, options)))
}

/** @internal */
export const makeSpanScoped = (
  name: string,
  options?: Tracer.SpanOptions | undefined
): Effect.Effect<Tracer.Span, never, Scope.Scope> => {
  options = addSpanStackTrace(options)
  return uninterruptible(
    withFiber((fiber) => {
      const scope = ServiceMap.unsafeGet(fiber.services, scopeTag)
      const span = unsafeMakeSpan(fiber, name, options)
      const clock = fiber.getRef(ClockRef)
      return as(
        scopeAddFinalizerExit(scope, (exit) => endSpan(span, exit, clock)),
        span
      )
    })
  )
}

/** @internal */
export const withSpanScoped: {
  (
    name: string,
    options?: Tracer.SpanOptions
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, Tracer.ParentSpan> | Scope.Scope>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    name: string,
    options?: Tracer.SpanOptions
  ): Effect.Effect<A, E, Exclude<R, Tracer.ParentSpan> | Scope.Scope>
} = function() {
  const dataFirst = typeof arguments[0] !== "string"
  const name = dataFirst ? arguments[1] : arguments[0]
  const options = addSpanStackTrace(dataFirst ? arguments[2] : arguments[1])
  if (dataFirst) {
    const self = arguments[0]
    return flatMap(
      makeSpanScoped(name, addSpanStackTrace(options)),
      (span) => withParentSpan(self, span)
    )
  }
  return (self: Effect.Effect<any, any, any>) =>
    flatMap(
      makeSpanScoped(name, addSpanStackTrace(options)),
      (span) => withParentSpan(self, span)
    )
} as any

/** @internal */
export const spanAnnotations: Effect.Effect<Readonly<Record<string, unknown>>> = TracerSpanAnnotations.asEffect()

/** @internal */
export const spanLinks: Effect.Effect<ReadonlyArray<Tracer.SpanLink>> = TracerSpanLinks.asEffect()

/** @internal */
export const linkSpans: {
  (
    span: Tracer.AnySpan | ReadonlyArray<Tracer.AnySpan>,
    attributes?: Record<string, unknown>
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    span: Tracer.AnySpan | ReadonlyArray<Tracer.AnySpan>,
    attributes?: Record<string, unknown>
  ): Effect.Effect<A, E, R>
} = dual((args) => isEffect(args[0]), <A, E, R>(
  self: Effect.Effect<A, E, R>,
  span: Tracer.AnySpan | ReadonlyArray<Tracer.AnySpan>,
  attributes: Record<string, unknown> = {}
): Effect.Effect<A, E, R> => {
  const spans: Array<Tracer.AnySpan> = Array.isArray(span) ? span : [span]
  const links = spans.map((span): Tracer.SpanLink => ({ span, attributes }))
  return updateService(self, TracerSpanLinks, (current) => [...current, ...links])
})

/** @internal */
export const endSpan = <A, E>(span: Tracer.Span, exit: Exit.Exit<A, E>, clock: Clock.Clock) =>
  sync(() => {
    if (span.status._tag === "Ended") return
    span.end(clock.unsafeCurrentTimeNanos(), exit)
  })

/** @internal */
export const useSpan: {
  <A, E, R>(name: string, evaluate: (span: Tracer.Span) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R>
  <A, E, R>(
    name: string,
    options: Tracer.SpanOptions,
    evaluate: (span: Tracer.Span) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R>
} = <A, E, R>(
  name: string,
  ...args: [evaluate: (span: Tracer.Span) => Effect.Effect<A, E, R>] | [
    options: any,
    evaluate: (span: Tracer.Span) => Effect.Effect<A, E, R>
  ]
): Effect.Effect<A, E, R> => {
  const options = addSpanStackTrace(args.length === 1 ? undefined : args[0])
  const evaluate: (span: Tracer.Span) => Effect.Effect<A, E, R> = args[args.length - 1]
  return withFiber((fiber) => {
    const span = unsafeMakeSpan(fiber, name, options)
    const clock = fiber.getRef(ClockRef)
    return onExit(internalCall(() => evaluate(span)), (exit) => endSpan(span, exit, clock))
  })
}

/** @internal */
export const withParentSpan: {
  (value: Tracer.AnySpan): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, Tracer.ParentSpan>>
  <A, E, R>(self: Effect.Effect<A, E, R>, value: Tracer.AnySpan): Effect.Effect<A, E, Exclude<R, Tracer.ParentSpan>>
} = provideService(Tracer.ParentSpan)

/** @internal */
export const withSpan: {
  (
    name: string,
    options?: Tracer.SpanOptions | undefined
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, Tracer.ParentSpan>>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    name: string,
    options?: Tracer.SpanOptions | undefined
  ): Effect.Effect<A, E, Exclude<R, Tracer.ParentSpan>>
} = function() {
  const dataFirst = typeof arguments[0] !== "string"
  const name = dataFirst ? arguments[1] : arguments[0]
  const options = addSpanStackTrace(dataFirst ? arguments[2] : arguments[1])
  if (dataFirst) {
    const self = arguments[0]
    return useSpan(name, options, (span) => withParentSpan(self, span))
  }
  return (self: Effect.Effect<any, any, any>) => useSpan(name, options, (span) => withParentSpan(self, span))
} as any

/** @internal */
export const annotateSpans: {
  (key: string, value: unknown): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  (values: Record<string, unknown>): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(effect: Effect.Effect<A, E, R>, key: string, value: unknown): Effect.Effect<A, E, R>
  <A, E, R>(effect: Effect.Effect<A, E, R>, values: Record<string, unknown>): Effect.Effect<A, E, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    ...args: [Record<string, unknown>] | [key: string, value: unknown]
  ): Effect.Effect<A, E, R> =>
    updateService(effect, TracerSpanAnnotations, (annotations) => {
      const newAnnotations = { ...annotations }
      if (args.length === 1) {
        Object.assign(newAnnotations, args[0])
      } else {
        newAnnotations[args[0]] = args[1]
      }
      return newAnnotations
    })
)

/** @internal */
export const annotateCurrentSpan: {
  (key: string, value: unknown): Effect.Effect<void>
  (values: Record<string, unknown>): Effect.Effect<void>
} = (...args: [Record<string, unknown>] | [key: string, value: unknown]) =>
  withFiber((fiber) => {
    const span = fiber.currentSpanLocal
    if (span) {
      if (args.length === 1) {
        for (const [key, value] of Object.entries(args[0])) {
          span.attribute(key, value)
        }
      } else {
        span.attribute(args[0], args[1])
      }
    }
    return void_
  })

/** @internal */
export const currentSpan: Effect.Effect<Tracer.Span, Cause.NoSuchElementError> = withFiber((fiber) => {
  const span = fiber.currentSpanLocal
  return span ? succeed(span) : fail(new NoSuchElementError())
})

/** @internal */
export const currentParentSpan: Effect.Effect<Tracer.AnySpan, Cause.NoSuchElementError> = serviceOptional(
  Tracer.ParentSpan
)

// ----------------------------------------------------------------------------
// Clock
// ----------------------------------------------------------------------------

/** @internal */
export const ClockRef = ServiceMap.Reference<Clock.Clock>("effect/Clock", {
  defaultValue: (): Clock.Clock => new ClockImpl()
})

const MAX_TIMER_MILLIS = 2 ** 31 - 1

class ClockImpl implements Clock.Clock {
  unsafeCurrentTimeMillis(): number {
    return Date.now()
  }
  readonly currentTimeMillis: Effect.Effect<number> = sync(() => this.unsafeCurrentTimeMillis())
  unsafeCurrentTimeNanos(): bigint {
    return processOrPerformanceNow()
  }
  readonly currentTimeNanos: Effect.Effect<bigint> = sync(() => this.unsafeCurrentTimeNanos())
  sleep(duration: Duration.Duration): Effect.Effect<void> {
    const millis = Duration.toMillis(duration)
    return callback((resume) => {
      if (millis > MAX_TIMER_MILLIS) return
      const handle = setTimeout(() => resume(void_), millis)
      return sync(() => clearTimeout(handle))
    })
  }
}

const performanceNowNanos = (function() {
  const bigint1e6 = BigInt(1_000_000)
  if (typeof performance === "undefined") {
    return () => BigInt(Date.now()) * bigint1e6
  } else if (typeof performance.timeOrigin === "number" && performance.timeOrigin === 0) {
    return () => BigInt(Math.round(performance.now() * 1_000_000))
  }
  const origin = (BigInt(Date.now()) * bigint1e6) - BigInt(Math.round(performance.now() * 1_000_000))
  return () => origin + BigInt(Math.round(performance.now() * 1_000_000))
})()
const processOrPerformanceNow = (function() {
  const processHrtime =
    typeof process === "object" && "hrtime" in process && typeof process.hrtime.bigint === "function" ?
      process.hrtime :
      undefined
  if (!processHrtime) {
    return performanceNowNanos
  }
  const origin = performanceNowNanos() - processHrtime.bigint()
  return () => origin + processHrtime.bigint()
})()

/** @internal */
export const clockWith = <A, E, R>(f: (clock: Clock.Clock) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  withFiber((fiber) => f(fiber.getRef(ClockRef)))

/** @internal */
export const sleep = (duration: Duration.DurationInput): Effect.Effect<void> =>
  clockWith((clock) => clock.sleep(Duration.decode(duration)))

/** @internal */
export const currentTimeMillis: Effect.Effect<number> = clockWith((clock) => clock.currentTimeMillis)

/** @internal */
export const currentTimeNanos: Effect.Effect<bigint> = clockWith((clock) => clock.currentTimeNanos)

// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------

/** @internal */
export const TimeoutErrorTypeId: Cause.TimeoutErrorTypeId = "~effect/Cause/TimeoutError"

/** @internal */
export const isTimeoutError = (u: unknown): u is Cause.TimeoutError => hasProperty(u, TimeoutErrorTypeId)

/** @internal */
export class TimeoutError extends TaggedError("TimeoutError") {
  readonly [TimeoutErrorTypeId]: Cause.TimeoutErrorTypeId = TimeoutErrorTypeId
  constructor(message?: string) {
    super({ message } as any)
  }
}

/** @internal */
export const IllegalArgumentErrorTypeId: Cause.IllegalArgumentErrorTypeId = "~effect/Cause/IllegalArgumentError"

/** @internal */
export const isIllegalArgumentError = (
  u: unknown
): u is Cause.IllegalArgumentError => hasProperty(u, IllegalArgumentErrorTypeId)

/** @internal */
export class IllegalArgumentError extends TaggedError("IllegalArgumentError") {
  readonly [IllegalArgumentErrorTypeId]: Cause.IllegalArgumentErrorTypeId = IllegalArgumentErrorTypeId
  constructor(message?: string) {
    super({ message } as any)
  }
}

/** @internal */
export const ExceededCapacityErrorTypeId: Cause.ExceededCapacityErrorTypeId = "~effect/Cause/ExceededCapacityError"

/** @internal */
export const isExceededCapacityError = (
  u: unknown
): u is Cause.ExceededCapacityError => hasProperty(u, ExceededCapacityErrorTypeId)

/** @internal */
export class ExceededCapacityError extends TaggedError("ExceededCapacityError") {
  readonly [ExceededCapacityErrorTypeId]: Cause.ExceededCapacityErrorTypeId = ExceededCapacityErrorTypeId
  constructor(message?: string) {
    super({ message } as any)
  }
}

/** @internal */
export const UnknownErrorTypeId: Cause.UnknownErrorTypeId = "~effect/Cause/UnknownError"

/** @internal */
export const isUnknownError = (
  u: unknown
): u is Cause.UnknownError => hasProperty(u, UnknownErrorTypeId)

/** @internal */
export class UnknownError extends TaggedError("UnknownError") {
  readonly [UnknownErrorTypeId]: Cause.UnknownErrorTypeId = UnknownErrorTypeId
  constructor(cause: unknown, message?: string) {
    super({ message, cause } as any)
  }
}

// ----------------------------------------------------------------------------
// Console
// ----------------------------------------------------------------------------

/** @internal */
export const ConsoleRef = ServiceMap.Reference<Console.Console>(
  "effect/Console/CurrentConsole",
  { defaultValue: (): Console.Console => globalThis.console }
)

// ----------------------------------------------------------------------------
// LogLevel
// ----------------------------------------------------------------------------

const logLevelToOrder = (level: LogLevel.LogLevel) => {
  switch (level) {
    case "All":
      return Number.MIN_SAFE_INTEGER
    case "Fatal":
      return 50_000
    case "Error":
      return 40_000
    case "Warn":
      return 30_000
    case "Info":
      return 20_000
    case "Debug":
      return 10_000
    case "Trace":
      return 0
    case "None":
      return Number.MAX_SAFE_INTEGER
  }
}

/** @internal */
export const LogLevelOrder = Order.mapInput(Order.number, logLevelToOrder)

/** @internal */
export const logLevelGreaterThan = Order.greaterThan(LogLevelOrder)

// ----------------------------------------------------------------------------
// Logger
// ----------------------------------------------------------------------------

/** @internal */
export const CurrentLoggers = ServiceMap.Reference<
  ReadonlySet<Logger.Logger<unknown, any>>
>("effect/Loggers/CurrentLoggers", {
  defaultValue: () => new Set([defaultLogger])
})

/** @internal */
export const LoggerTypeId: Logger.TypeId = "~effect/Logger"

const LoggerProto = {
  [LoggerTypeId]: {
    _Message: identity,
    _Output: identity
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/** @internal */
export const loggerMake = <Message, Output>(
  log: (options: Logger.Logger.Options<Message>) => Output
): Logger.Logger<Message, Output> => {
  const self = Object.create(LoggerProto)
  self.log = log
  return self
}

/**
 * Sanitize a given string by replacing spaces, equal signs, and double quotes
 * with underscores.
 *
 * @internal
 */
export const formatLabel = (key: string) => key.replace(/[\s="]/g, "_")

/**
 * Formats a log span into a `<label>=<value>ms` string.
 *
 * @internal
 */
export const formatLogSpan = (self: [label: string, timestamp: number], now: number): string => {
  const label = formatLabel(self[0])
  return `${label}=${now - self[1]}ms`
}

/** @internal */
export const structuredMessage = (u: unknown): unknown => {
  switch (typeof u) {
    case "bigint":
    case "function":
    case "symbol": {
      return String(u)
    }
    default: {
      return toJSON(u)
    }
  }
}

/** @internal */
export const logWithLevel = (level?: LogLevel.LogLevel) =>
(
  ...message: ReadonlyArray<any>
): Effect.Effect<void> => {
  let cause: Cause.Cause<unknown> | undefined = undefined
  for (let i = 0, len = message.length; i < len; i++) {
    const msg = message[i]
    if (isCause(msg)) {
      if (cause) {
        ;(message as Array<any>).splice(i, 1)
      } else {
        message = message.slice(0, i).concat(message.slice(i + 1))
      }
      cause = cause ? causeFromFailures(cause.failures.concat(msg.failures)) : msg
      i--
    }
  }
  if (cause === undefined) {
    cause = causeFromFailures([])
  }
  return withFiber((fiber) => {
    const logLevel = level ?? fiber.getRef(CurrentLogLevel)
    const minimumLogLevel = fiber.getRef(MinimumLogLevel)
    if (logLevelGreaterThan(minimumLogLevel, logLevel)) {
      return void_
    }
    const clock = fiber.getRef(ClockRef)
    const loggers = fiber.getRef(CurrentLoggers)
    if (loggers.size > 0) {
      const date = new Date(clock.unsafeCurrentTimeMillis())
      for (const logger of loggers) {
        logger.log({
          cause,
          fiber,
          date,
          logLevel,
          message
        })
      }
    }
    return void_
  })
}

const withColor = (text: string, ...colors: ReadonlyArray<string>) => {
  let out = ""
  for (let i = 0; i < colors.length; i++) {
    out += `\x1b[${colors[i]}m`
  }
  return out + text + "\x1b[0m"
}
const withColorNoop = (text: string, ..._colors: ReadonlyArray<string>) => text
const colors = {
  bold: "1",
  red: "31",
  green: "32",
  yellow: "33",
  blue: "34",
  cyan: "36",
  white: "37",
  gray: "90",
  black: "30",
  bgBrightRed: "101"
} as const

const logLevelColors: Record<LogLevel.LogLevel, ReadonlyArray<string>> = {
  None: [],
  All: [],
  Trace: [colors.gray],
  Debug: [colors.blue],
  Info: [colors.green],
  Warn: [colors.yellow],
  Error: [colors.red],
  Fatal: [colors.bgBrightRed, colors.black]
}
const logLevelStyle: Record<LogLevel.LogLevel, string> = {
  None: "",
  All: "",
  Trace: "color:gray",
  Debug: "color:blue",
  Info: "color:green",
  Warn: "color:orange",
  Error: "color:red",
  Fatal: "background-color:red;color:white"
}

const defaultDateFormat = (date: Date): string =>
  `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${
    date.getSeconds().toString().padStart(2, "0")
  }.${date.getMilliseconds().toString().padStart(3, "0")}`

const hasProcessStdout = typeof process === "object" &&
  process !== null &&
  typeof process.stdout === "object" &&
  process.stdout !== null
const processStdoutIsTTY = hasProcessStdout &&
  process.stdout.isTTY === true
const hasProcessStdoutOrDeno = hasProcessStdout || "Deno" in globalThis

/** @internal */
export const consolePretty = (options?: {
  readonly colors?: "auto" | boolean | undefined
  readonly stderr?: boolean | undefined
  readonly formatDate?: ((date: Date) => string) | undefined
  readonly mode?: "browser" | "tty" | "auto" | undefined
}) => {
  const mode_ = options?.mode ?? "auto"
  const mode = mode_ === "auto" ? (hasProcessStdoutOrDeno ? "tty" : "browser") : mode_
  const isBrowser = mode === "browser"
  const showColors = typeof options?.colors === "boolean" ? options.colors : processStdoutIsTTY || isBrowser
  const formatDate = options?.formatDate ?? defaultDateFormat
  return isBrowser
    ? prettyLoggerBrowser({ colors: showColors, formatDate })
    : prettyLoggerTty({ colors: showColors, formatDate, stderr: options?.stderr === true })
}

const prettyLoggerTty = (options: {
  readonly colors: boolean
  readonly stderr: boolean
  readonly formatDate: (date: Date) => string
}) => {
  const processIsBun = typeof process === "object" && "isBun" in process && process.isBun === true
  const color = options.colors && processStdoutIsTTY ? withColor : withColorNoop
  return loggerMake<unknown, void>(
    ({ cause, date, fiber, logLevel, message: message_ }) => {
      const console = fiber.getRef(ConsoleRef)

      const log = options.stderr === true ? console.error : console.log

      const message = Array.isArray(message_) ? message_.slice() : [message_]

      let firstLine = color(`[${options.formatDate(date)}]`, colors.white)
        + ` ${color(logLevel.toUpperCase(), ...logLevelColors[logLevel])}`
        + ` (#${fiber.id})`

      const now = date.getTime()
      const spans = fiber.getRef(CurrentLogSpans)
      for (const span of spans) {
        firstLine += " " + formatLogSpan(span, now)
      }

      firstLine += ":"
      let messageIndex = 0
      if (message.length > 0) {
        const firstMaybeString = structuredMessage(message[0])
        if (typeof firstMaybeString === "string") {
          firstLine += " " + color(firstMaybeString, colors.bold, colors.cyan)
          messageIndex++
        }
      }

      log(firstLine)
      if (!processIsBun) console.group()

      if (cause.failures.length > 0) {
        log(causePretty(cause))
      }

      if (messageIndex < message.length) {
        for (; messageIndex < message.length; messageIndex++) {
          log(redact(message[messageIndex]))
        }
      }

      const annotations = fiber.getRef(CurrentLogAnnotations)
      for (const [key, value] of Object.entries(annotations)) {
        log(color(`${key}:`, colors.bold, colors.white), redact(value))
      }

      if (!processIsBun) console.groupEnd()
    }
  )
}

const prettyLoggerBrowser = (options: {
  readonly colors: boolean
  readonly formatDate: (date: Date) => string
}) => {
  const color = options.colors ? "%c" : ""
  return loggerMake<unknown, void>(
    ({ cause, date, fiber, logLevel, message: message_ }) => {
      const console = fiber.getRef(ConsoleRef)

      const message = Array.isArray(message_) ? message_.slice() : [message_]

      let firstLine = `${color}[${options.formatDate(date)}]`
      const firstParams = []
      if (options.colors) {
        firstParams.push("color:gray")
      }
      firstLine += ` ${color}${logLevel.toUpperCase()}${color} (#${fiber.id})`
      if (options.colors) {
        firstParams.push(logLevelStyle[logLevel], "")
      }

      const now = date.getTime()
      const spans = fiber.getRef(CurrentLogSpans)
      for (const span of spans) {
        firstLine += " " + formatLogSpan(span, now)
      }

      firstLine += ":"

      let messageIndex = 0
      if (message.length > 0) {
        const firstMaybeString = structuredMessage(message[0])
        if (typeof firstMaybeString === "string") {
          firstLine += ` ${color}${firstMaybeString}`
          if (options.colors) {
            firstParams.push("color:deepskyblue")
          }
          messageIndex++
        }
      }

      console.groupCollapsed(firstLine, ...firstParams)

      if (cause.failures.length > 0) {
        console.error(causePretty(cause))
      }

      if (messageIndex < message.length) {
        for (; messageIndex < message.length; messageIndex++) {
          console.log(redact(message[messageIndex]))
        }
      }

      const annotations = fiber.getRef(CurrentLogAnnotations)
      for (const [key, value] of Object.entries(annotations)) {
        const redacted = redact(value)
        if (options.colors) {
          console.log(`%c${key}:`, "color:gray", redacted)
        } else {
          console.log(`${key}:`, redacted)
        }
      }

      console.groupEnd()
    }
  )
}

/** @internal */
export const defaultLogger = loggerMake<unknown, void>(({ cause, date, fiber, logLevel, message }) => {
  const message_ = Array.isArray(message) ? message.slice() : [message]
  if (cause.failures.length > 0) {
    message_.unshift(causePretty(cause))
  }
  const now = date.getTime()
  const spans = fiber.getRef(CurrentLogSpans)
  let spanString = ""
  for (const span of spans) {
    spanString += ` ${formatLogSpan(span, now)}`
  }
  const annotations = fiber.getRef(CurrentLogAnnotations)
  if (Object.keys(annotations).length > 0) {
    message_.push(annotations)
  }
  const console = fiber.getRef(ConsoleRef)
  console.log(`[${defaultDateFormat(date)}] ${logLevel.toUpperCase()} (#${fiber.id})${spanString}:`, ...message_)
})
