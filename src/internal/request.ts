import type { NonEmptyArray } from "effect/Array"
import type { Effect } from "../Effect.js"
import type { Fiber } from "../Fiber.js"
import { dual } from "../Function.js"
import { globalValue } from "../GlobalValue.js"
import type { Entry, Request } from "../Request.js"
import { makeEntry } from "../Request.js"
import type { RequestResolver } from "../RequestResolver.js"
import * as core from "./core.js"
import { exitDie, isEffect } from "./primitive.js"

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
      core.async<
        Request.Success<A>,
        Request.Error<A>,
        Request.Context<A>
      >((resume) => {
        const entry = addEntry(resolver, self, resume, core.getCurrentFiberOrUndefined()!)
        return maybeRemoveEntry(resolver, entry)
      })
    return isEffect(resolver) ? core.flatMap(resolver, withResolver) : withResolver(resolver)
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
    batch.delayFiber = core.runFork(
      core.andThen(resolver.delay, runBatch(batch)),
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
  core.runFork(runBatch(batch), { scheduler: fiber.currentScheduler })
  return entry
}

const maybeRemoveEntry = <A extends Request<any, any, any>>(
  resolver: RequestResolver<A>,
  entry: Entry<A>
) =>
  core.suspend(() => {
    const batch = pendingBatches.get(resolver)
    if (!batch) return core.void

    const index = batch.entries.indexOf(entry)
    if (index < 0) return core.void
    batch.entries.splice(index, 1)
    batch.entrySet.delete(entry)

    if (batch.entries.length === 0) {
      pendingBatches.delete(resolver)
      return batch.delayFiber ? core.fiberInterrupt(batch.delayFiber) : core.void
    }
    return core.void
  })

const runBatch = ({ entries, entrySet, resolver }: Batch) =>
  core.suspend(() => {
    if (!pendingBatches.has(resolver)) return core.void
    pendingBatches.delete(resolver)
    return core.onExit(
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
        return core.void
      }
    )
  })
