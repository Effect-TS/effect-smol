import type { NonEmptyArray } from "../collections/Array.ts"
import type { Effect } from "../Effect.ts"
import type { Exit } from "../Exit.ts"
import type { Fiber } from "../Fiber.ts"
import { dual } from "../Function.ts"
import type * as Request from "../Request.ts"
import { makeEntry } from "../Request.ts"
import type { RequestResolver } from "../RequestResolver.ts"
import { Scheduler } from "../Scheduler.ts"
import * as ServiceMap from "../ServiceMap.ts"
import { exitDie, isEffect } from "./core.ts"
import * as effect from "./effect.ts"

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

/** @internal */
export const requestUnsafe = <A extends Request.Any>(
  self: A,
  options: {
    readonly resolver: RequestResolver<A>
    readonly onExit: (exit: Exit<Request.Success<A>, Request.Error<A>>) => void
    readonly services: ServiceMap.ServiceMap<never>
  }
): () => void => {
  const entry = addEntry(options.resolver, self, options.onExit, {
    services: options.services,
    currentScheduler: ServiceMap.get(options.services, Scheduler)
  })
  return () => removeEntryUnsafe(options.resolver, entry)
}

interface Batch {
  key: unknown
  resolver: RequestResolver<any>
  map: Map<unknown, Batch>
  readonly entrySet: Set<Request.Entry<any>>
  readonly entries: Set<Request.Entry<any>>
  readonly delayEffect: Effect<void>
  readonly run: Effect<void, unknown>
  delayFiber?: Fiber<void, unknown> | undefined
}

const batchPool: Array<Batch> = []
const pendingBatches = new Map<RequestResolver<any>, Map<unknown, Batch>>()

const addEntry = <A extends Request.Any>(
  resolver: RequestResolver<A>,
  request: A,
  resume: (exit: Exit<any, any>) => void,
  fiber: {
    readonly services: ServiceMap.ServiceMap<never>
    readonly currentScheduler: Scheduler
    readonly id?: number
  }
) => {
  let batchMap = pendingBatches.get(resolver)
  if (!batchMap) {
    batchMap = new Map<object, Batch>()
    pendingBatches.set(resolver, batchMap)
  }
  let batch: Batch | undefined
  let completed = false
  const entry = makeEntry({
    request,
    services: fiber.services as any,
    uninterruptible: false,
    completeUnsafe(effect) {
      if (completed) return
      completed = true
      resume(effect)
      batch?.entrySet.delete(entry)
    }
  })
  if (resolver.preCheck !== undefined && !resolver.preCheck(entry)) {
    return entry
  }
  const key = resolver.batchKey(entry)
  batch = batchMap.get(key)
  if (!batch) {
    if (batchPool.length > 0) {
      batch = batchPool.pop()!
      batch.key = key
      batch.resolver = resolver
      batch.map = batchMap
    } else {
      const newBatch: Batch = {
        key,
        resolver,
        map: batchMap,
        entrySet: new Set(),
        entries: new Set(),
        delayEffect: effect.flatMap(
          effect.suspend(() => newBatch.resolver.delay),
          (_) => runBatch(newBatch)
        ) as Effect<void>,
        run: effect.onExit(
          effect.suspend(() =>
            newBatch.resolver.runAll(Array.from(newBatch.entries) as NonEmptyArray<Request.Entry<any>>, newBatch.key)
          ),
          (exit) => {
            for (const entry of newBatch.entrySet) {
              entry.completeUnsafe(
                exit._tag === "Success"
                  ? exitDie(
                    new Error("Effect.request: RequestResolver did not complete request", { cause: entry.request })
                  )
                  : exit
              )
            }
            newBatch.entries.clear()
            if (batchPool.length < 128) {
              newBatch.entrySet.clear()
              newBatch.key = undefined
              newBatch.delayFiber = undefined
              batchPool.push(newBatch)
            }
            return effect.void
          }
        )
      }
      batch = newBatch
    }
    batchMap.set(key, batch)
    batch.delayFiber = effect.runFork(batch.delayEffect, { scheduler: fiber.currentScheduler })
  }

  batch.entrySet.add(entry)
  batch.entries.add(entry)
  if (batch.resolver.collectWhile(batch.entries)) return entry

  batch.delayFiber!.interruptUnsafe(fiber.id)
  batch.delayFiber = undefined
  effect.runFork(runBatch(batch), { scheduler: fiber.currentScheduler })
  return entry
}

const removeEntryUnsafe = <A extends Request.Any>(
  resolver: RequestResolver<A>,
  entry: Request.Entry<A>
) => {
  if (entry.uninterruptible) return
  const batchMap = pendingBatches.get(resolver)
  if (!batchMap) return
  const key = resolver.batchKey(entry.request as any)
  const batch = batchMap.get(key)
  if (!batch) return

  batch.entries.delete(entry)
  batch.entrySet.delete(entry)

  if (batch.entries.size === 0) {
    batchMap.delete(key)
    if (batch.delayFiber) {
      batch.delayFiber.interruptUnsafe()
    }
  }
}

const maybeRemoveEntry = <A extends Request.Any>(
  resolver: RequestResolver<A>,
  entry: Request.Entry<A>
) => effect.sync(() => removeEntryUnsafe(resolver, entry))

function runBatch(batch: Batch) {
  if (!batch.map.has(batch.key)) return effect.void
  batch.map.delete(batch.key)
  return batch.run
}
