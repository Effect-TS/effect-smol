import type { NonEmptyArray } from "../Array.ts"
import type { Effect } from "../Effect.ts"
import type { Fiber } from "../Fiber.ts"
import { dual } from "../Function.ts"
import type { Entry, Request } from "../Request.ts"
import { makeEntry } from "../Request.ts"
import type { RequestResolver } from "../RequestResolver.ts"
import { exitDie, isEffect } from "./core.ts"
import * as effect from "./effect.ts"

/** @internal */
export const request: {
  <A extends Request<any, any, any>, EX = never, RX = never>(
    resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
  ): (self: A) => Effect<
    Request.Success<A>,
    Request.Error<A> | EX,
    Request.Context<A> | RX
  >
  <A extends Request<any, any, any>, EX = never, RX = never>(
    self: A,
    resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
  ): Effect<
    Request.Success<A>,
    Request.Error<A> | EX,
    Request.Context<A> | RX
  >
} = dual(
  2,
  <A extends Request<any, any, any>, EX = never, RX = never>(
    self: A,
    resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
  ): Effect<
    Request.Success<A>,
    Request.Error<A> | EX,
    Request.Context<A> | RX
  > => {
    const withResolver = (resolver: RequestResolver<A>) =>
      effect.callback<
        Request.Success<A>,
        Request.Error<A>,
        Request.Context<A>
      >((resume) => {
        const entry = addEntry(resolver, self, resume, effect.getCurrentFiberOrUndefined()!)
        return maybeRemoveEntry(resolver, entry)
      })
    return isEffect(resolver) ? effect.flatMap(resolver, withResolver) : withResolver(resolver)
  }
)

interface Batch {
  readonly resolver: RequestResolver<any>
  readonly entrySet: Set<Entry<any>>
  readonly entries: Set<Entry<any>>
  delayFiber?: Fiber<void> | undefined
}

const pendingBatches = new Map<RequestResolver<any>, Batch>()

const addEntry = <A extends Request<any, any, any>>(
  resolver: RequestResolver<A>,
  request: A,
  resume: (effect: Effect<any, any, any>) => void,
  fiber: Fiber<any, any>
) => {
  let batch = pendingBatches.get(resolver)
  if (!batch) {
    batch = {
      resolver,
      entrySet: new Set(),
      entries: new Set()
    }
    pendingBatches.set(resolver, batch)
    batch.delayFiber = effect.runFork(
      effect.andThen(resolver.delay, runBatch(batch)),
      { scheduler: fiber.currentScheduler }
    )
  }

  const entry = makeEntry({
    request,
    context: fiber.context as any,
    unsafeComplete(effect) {
      resume(effect)
      batch.entrySet.delete(entry)
    }
  })

  batch.entrySet.add(entry)
  batch.entries.add(entry)
  if (batch.resolver.collectWhile(batch.entries)) return entry

  batch.delayFiber!.unsafeInterrupt(fiber.id)
  batch.delayFiber = undefined
  effect.runFork(runBatch(batch), { scheduler: fiber.currentScheduler })
  return entry
}

const maybeRemoveEntry = <A extends Request<any, any, any>>(
  resolver: RequestResolver<A>,
  entry: Entry<A>
) =>
  effect.suspend(() => {
    const batch = pendingBatches.get(resolver)
    if (!batch) return effect.void

    batch.entries.delete(entry)
    batch.entrySet.delete(entry)

    if (batch.entries.size === 0) {
      pendingBatches.delete(resolver)
      return batch.delayFiber ? effect.fiberInterrupt(batch.delayFiber) : effect.void
    }
    return effect.void
  })

const runBatch = ({ entries, entrySet, resolver }: Batch) =>
  effect.suspend(() => {
    if (!pendingBatches.has(resolver)) return effect.void
    pendingBatches.delete(resolver)
    return effect.onExit(
      resolver.runAll(Array.from(entries) as NonEmptyArray<Entry<any>>),
      (exit) => {
        for (const entry of entrySet) {
          entry.unsafeComplete(
            exit._tag === "Success"
              ? exitDie(
                new Error("Effect.request: RequestResolver did not complete request", { cause: entry.request })
              )
              : exit
          )
        }
        entries.clear()
        return effect.void
      }
    )
  })
