import type { NonEmptyArray } from "effect/Array"
import type { Effect } from "../Effect.js"
import type { Fiber } from "../Fiber.js"
import { dual } from "../Function.js"
import { globalValue } from "../GlobalValue.js"
import type { Entry, Request } from "../Request.js"
import { makeEntry } from "../Request.js"
import type { RequestResolver } from "../RequestResolver.js"
import { exitDie, isEffect } from "./core.js"
import * as effect from "./effect.js"

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
      effect.async<
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
  readonly entries: NonEmptyArray<Entry<any>>
  delayFiber?: Fiber<void> | undefined
}

const pendingBatches = globalValue(
  "effect/Request/pendingBatches",
  () => new Map<RequestResolver<any>, Batch>()
)

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
      entries: [] as any
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
  batch.entries.push(entry)
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

    const index = batch.entries.indexOf(entry)
    if (index < 0) return effect.void
    batch.entries.splice(index, 1)
    batch.entrySet.delete(entry)

    if (batch.entries.length === 0) {
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
      resolver.runAll(entries),
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
        entries.length = 0
        return effect.void
      }
    )
  })
