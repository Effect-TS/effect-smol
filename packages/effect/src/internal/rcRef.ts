import * as Effect from "../Effect.ts"
import * as Exit from "../Exit.ts"
import { identity } from "../Function.ts"
import type * as RcRef from "../resources/RcRef.ts"
import * as Scope from "../resources/Scope.ts"
import * as Fiber from "../runtime/Fiber.ts"
import * as ServiceMap from "../services/ServiceMap.ts"
import * as Duration from "../time/Duration.ts"

/** @internal */
export const TypeId: RcRef.TypeId = "~effect/RcRef"

type State<A> = State.Empty | State.Acquired<A> | State.Closed

declare namespace State {
  interface Empty {
    readonly _tag: "Empty"
  }

  interface Acquired<A> {
    readonly _tag: "Acquired"
    readonly value: A
    readonly scope: Scope.Scope.Closeable
    fiber: Fiber.Fiber<void, never> | undefined
    refCount: number
  }

  interface Closed {
    readonly _tag: "Closed"
  }
}

const stateEmpty: State<never> = { _tag: "Empty" }
const stateClosed: State<never> = { _tag: "Closed" }

const variance: RcRef.RcRef.Variance<any, any> = {
  _A: identity,
  _E: identity
}

class RcRefImpl<A, E> implements RcRef.RcRef<A, E> {
  readonly [TypeId]: RcRef.RcRef.Variance<A, E> = variance

  state: State<A> = stateEmpty
  readonly semaphore = Effect.unsafeMakeSemaphore(1)
  readonly acquire: Effect.Effect<A, E>
  readonly services: ServiceMap.ServiceMap<never>
  readonly scope: Scope.Scope
  readonly idleTimeToLive: Duration.Duration | undefined

  constructor(
    acquire: Effect.Effect<A, E>,
    services: ServiceMap.ServiceMap<never>,
    scope: Scope.Scope,
    idleTimeToLive: Duration.Duration | undefined
  ) {
    this.acquire = acquire
    this.services = services
    this.scope = scope
    this.idleTimeToLive = idleTimeToLive
  }
}

/** @internal */
export const make = <A, E, R>(options: {
  readonly acquire: Effect.Effect<A, E, R>
  readonly idleTimeToLive?: Duration.DurationInput | undefined
}) =>
  Effect.withFiber<RcRef.RcRef<A, E>, never, R | Scope.Scope>((fiber) => {
    const services = fiber.services as ServiceMap.ServiceMap<R | Scope.Scope>
    const scope = ServiceMap.get(services, Scope.Scope)
    const ref = new RcRefImpl<A, E>(
      options.acquire as Effect.Effect<A, E>,
      services,
      scope,
      options.idleTimeToLive ? Duration.decode(options.idleTimeToLive) : undefined
    )
    return Effect.as(
      Scope.addFinalizer(
        scope,
        ref.semaphore.withPermits(1)(Effect.suspend(() => {
          const close = ref.state._tag === "Acquired"
            ? Scope.close(ref.state.scope, Exit.void)
            : Effect.void
          ref.state = stateClosed
          return close
        }))
      ),
      ref
    )
  })

const getState = <A, E>(self: RcRefImpl<A, E>) =>
  self.semaphore.withPermits(1)(Effect.uninterruptibleMask((restore) =>
    Effect.suspend(() => {
      switch (self.state._tag) {
        case "Closed": {
          return Effect.interrupt
        }
        case "Acquired": {
          self.state.refCount++
          return self.state.fiber
            ? Effect.as(Fiber.interrupt(self.state.fiber), self.state)
            : Effect.succeed(self.state)
        }
        case "Empty": {
          const scope = Scope.unsafeMake()
          return restore(Effect.provideServices(
            self.acquire as Effect.Effect<A, E>,
            ServiceMap.add(self.services, Scope.Scope, scope)
          )).pipe(Effect.map((value) => {
            const state: State.Acquired<A> = {
              _tag: "Acquired",
              value,
              scope,
              fiber: undefined,
              refCount: 1
            }
            self.state = state
            return state
          }))
        }
      }
    })
  ))

/** @internal */
export const get = Effect.fnUntraced(function*<A, E>(
  self_: RcRef.RcRef<A, E>
) {
  const self = self_ as RcRefImpl<A, E>
  const state = yield* getState(self)
  const scope = yield* Effect.scope
  yield* Scope.addFinalizerExit(scope, () =>
    Effect.suspend(() => {
      state.refCount--
      if (state.refCount > 0) {
        return Effect.void
      }
      if (self.idleTimeToLive === undefined) {
        self.state = stateEmpty
        return Scope.close(state.scope, Exit.void)
      }
      return Effect.sleep(self.idleTimeToLive).pipe(
        Effect.interruptible,
        Effect.andThen(Effect.suspend(() => {
          if (self.state._tag === "Acquired" && self.state.refCount === 0) {
            self.state = stateEmpty
            return Scope.close(state.scope, Exit.void)
          }
          return Effect.void
        })),
        Effect.ensuring(Effect.sync(() => {
          state.fiber = undefined
        })),
        Effect.forkIn(self.scope),
        Effect.tap((fiber) => {
          state.fiber = fiber
        }),
        self.semaphore.withPermits(1)
      )
    }))
  return state.value
})
