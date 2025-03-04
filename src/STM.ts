import * as Context from "./Context.js"
import * as Data from "./Data.js"
import * as Effect from "./Effect.js"
import * as Either from "./Either.js"
import { identity } from "./Function.js"
import * as Predicate from "./Predicate.js"

const TRetryTag = "TRetry"

export class TRetry extends Data.TaggedError(TRetryTag)<{}> {}

export const retry = new TRetry().asEffect()

export class TRef<A> {
  public version = 0
  public pending = new Map<any, () => void>()
  constructor(public value: A) {}
}

export interface TJournalState {
  readonly changes: Map<TRef<any>, {
    readonly version: number
    readonly value: any
  }>
}

export class TJournal extends Context.Tag<TJournal, TJournalState>()("TJournal") {}

const isConsistent = (state: TJournalState) => {
  for (const [ref, { version }] of state.changes) {
    if (ref.version !== version) {
      return false
    }
  }
  return true
}

export const transaction = Effect.fnUntraced(function*<A, E, R>(effect: Effect.Effect<A, E, R>) {
  const state: TJournalState = { changes: new Map() }
  while (true) {
    const result = yield* Effect.either(Effect.provideService(effect, TJournal, state))
    if (Either.isLeft(result)) {
      if (Predicate.isTagged(result.left, TRetryTag)) {
        const key = {}
        const refs = Array.from(state.changes.keys())
        state.changes.clear()
        yield* Effect.async<void>((resume) => {
          for (const ref of refs) {
            ref.pending.set(key, () => {
              for (const clear of refs) {
                clear.pending.delete(key)
              }
              resume(Effect.void)
            })
          }
        })
        continue
      }
    }
    if (isConsistent(state)) {
      const allPending = new Array<() => void>()
      for (const [ref, { value }] of state.changes) {
        if (value !== ref.value) {
          ref.version = ref.version + 1
          ref.value = value
        }
        for (const pending of ref.pending.values()) {
          allPending.push(pending)
        }
        ref.pending.clear()
      }
      yield* Effect.withFiber((fiber) =>
        Effect.sync(() => {
          fiber.currentScheduler.scheduleTask(() => {
            for (const pending of allPending) {
              pending()
            }
          }, 0)
        })
      )
      return yield* Effect.fromEither(result as Either.Either<A, Exclude<E, TRetry>>)
    } else {
      state.changes.clear()
    }
  }
})

export const makeTRef = <A>(initial: A) => Effect.sync(() => new TRef(initial))

export const modifyTRef = Effect.fnUntraced(function*<A>(self: TRef<A>, f: (current: A) => A) {
  const state = yield* TJournal
  if (!state.changes.has(self)) {
    state.changes.set(self, { version: self.version, value: self.value })
  }
  const current = state.changes.get(self)!
  const updated = f(current.value)
  state.changes.set(self, { version: current.version, value: updated })
  return updated
})

export const getTRef = <A>(self: TRef<A>) => modifyTRef(self, identity)
