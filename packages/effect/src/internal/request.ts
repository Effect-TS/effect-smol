import type { NonEmptyArray } from "../Array.js"
import type * as Request from "../batching/Request.js"
import { makeEntry } from "../batching/Request.js"
import type { RequestResolver } from "../batching/RequestResolver.js"
import type { Effect } from "../Effect.js"
import type { Fiber } from "../Fiber.js"
import { dual } from "../Function.js"
import { exitDie, isEffect } from "./core.js"
import * as effect from "./effect.js"

/** @internal */
export const request: {
  <A extends Request.Any, EX = never, RX = never>(
    resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
  ): (self: A) => Effect<
    Request.Success<A>,
    Request.Error<A> | EX,
    Request.Services<A> | RX
  >
  <A extends Request.Any, EX = never, RX = never>(
    self: A,
    resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
  ): Effect<
    Request.Success<A>,
    Request.Error<A> | EX,
    Request.Services<A> | RX
  >
} = dual(
  2,
  <A extends Request.Any, EX = never, RX = never>(
    self: A,
    resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
  ): Effect<
    Request.Success<A>,
    Request.Error<A> | EX,
    Request.Services<A> | RX
  > => {
    const withResolver = (resolver: RequestResolver<A>) =>
      effect.callback<
        Request.Success<A>,
        Request.Error<A>,
        Request.Services<A>
      >((resume) => {
        const entry = addEntry(resolver, self, resume, effect.getCurrentFiber()!)
        return maybeRemoveEntry(resolver, entry)
      })
    return isEffect(resolver) ? effect.flatMap(resolver, withResolver) : withResolver(resolver)
  }
)

interface Batch {
  readonly key: unknown
  readonly resolver: RequestResolver<any>
  readonly entrySet: Set<Request.Entry<any>>
  readonly entries: Set<Request.Entry<any>>
  delayFiber?: Fiber<void, unknown> | undefined
}

const pendingBatches = new Map<RequestResolver<any>, Map<unknown, Batch>>()

const addEntry = <A extends Request.Any>(
  resolver: RequestResolver<A>,
  request: A,
  resume: (effect: Effect<any, any, any>) => void,
  fiber: Fiber<any, any>
) => {
  let batchMap = pendingBatches.get(resolver)
  if (!batchMap) {
    batchMap = new Map<object, Batch>()
    pendingBatches.set(resolver, batchMap)
  }
  let batch: Batch | undefined
  const entry = makeEntry({
    request,
    services: fiber.services as any,
    unsafeComplete(effect) {
      resume(effect)
      batch!.entrySet.delete(entry)
    }
  })
  const key = resolver.batchKey(entry)
  batch = batchMap.get(key)
  if (!batch) {
    batch = {
      key,
      resolver,
      entrySet: new Set(),
      entries: new Set()
    }
    batchMap.set(key, batch)
    batch.delayFiber = effect.runFork(
      effect.andThen(resolver.delay, runBatch(batchMap, batch)),
      { scheduler: fiber.currentScheduler }
    )
  }

  batch.entrySet.add(entry)
  batch.entries.add(entry)
  if (batch.resolver.collectWhile(batch.entries)) return entry

  batch.delayFiber!.unsafeInterrupt(fiber.id)
  batch.delayFiber = undefined
  effect.runFork(runBatch(batchMap, batch), { scheduler: fiber.currentScheduler })
  return entry
}

const maybeRemoveEntry = <A extends Request.Any>(
  resolver: RequestResolver<A>,
  entry: Request.Entry<A>
) =>
  effect.suspend(() => {
    const batchMap = pendingBatches.get(resolver)
    if (!batchMap) return effect.void
    const key = resolver.batchKey(entry.request as any)
    const batch = batchMap.get(key)
    if (!batch) return effect.void

    batch.entries.delete(entry)
    batch.entrySet.delete(entry)

    if (batch.entries.size === 0) {
      pendingBatches.delete(resolver)
      return batch.delayFiber ? effect.fiberInterrupt(batch.delayFiber) : effect.void
    }
    return effect.void
  })

const runBatch = (
  batchMap: Map<unknown, Batch>,
  { entries, entrySet, key, resolver }: Batch
) =>
  effect.suspend(() => {
    if (!batchMap.has(key)) return effect.void
    batchMap.delete(key)
    return effect.onExit(
      resolver.runAll(Array.from(entries) as NonEmptyArray<Request.Entry<any>>, key),
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
