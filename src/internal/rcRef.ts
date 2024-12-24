import * as Context from "../Context.js"
import * as Duration from "../Duration.js"
import * as Effect from "../Effect.js"
import * as Exit from "../Exit.js"
import * as Fiber from "../Fiber.js"
import { identity } from "../Function.js"
import type * as RcRef from "../RcRef.js"
import * as Scope from "../Scope.js"

/** @internal */
export const TypeId: RcRef.TypeId = Symbol.for("effect/RcRef") as RcRef.TypeId

type State<A> = State.Empty | State.Acquired<A> | State.Closed

declare namespace State {
  interface Empty {
    readonly _tag: "Empty"
  }

  interface Acquired<A> {
    readonly _tag: "Acquired"
    readonly value: A
    readonly scope: Scope.Scope
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

  constructor(
    readonly acquire: Effect.Effect<A, E>,
    readonly context: Context.Context<never>,
    readonly scope: Scope.Scope,
    readonly idleTimeToLive: Duration.Duration | undefined
  ) {}
}

/** @internal */
export const make = <A, E, R>(options: {
  readonly acquire: Effect.Effect<A, E, R>
  readonly idleTimeToLive?: Duration.DurationInput | undefined
}) =>
  Effect.withFiber<RcRef.RcRef<A, E>, never, R>((fiber) => {
    const context = fiber.context as Context.Context<R>
    const scope = Context.get(context, Scope.Scope)
    const ref = new RcRefImpl<A, E>(
      options.acquire as Effect.Effect<A, E>,
      context,
      scope,
      options.idleTimeToLive ? Duration.decode(options.idleTimeToLive) : undefined
    )
    return Effect.as(
      Scope.addFinalizer(scope, () =>
        ref.semaphore.withPermits(1)(Effect.suspend(() => {
          const close = ref.state._tag === "Acquired"
            ? Scope.close(ref.state.scope, Exit.void)
            : Effect.void
          ref.state = stateClosed
          return close
        }))),
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
          return restore(Effect.provideContext(
            self.acquire as Effect.Effect<A, E>,
            Context.add(self.context, Scope.Scope, scope)
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
  const scope = yield* Effect.service(Scope.Scope)
  yield* Scope.addFinalizer(scope, () =>
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
