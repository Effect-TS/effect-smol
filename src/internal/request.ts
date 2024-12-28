import type { NonEmptyArray } from "effect/Array"
import type { Effect } from "../Effect.js"
import type { Fiber } from "../Fiber.js"
import { dual } from "../Function.js"
import { globalValue } from "../GlobalValue.js"
import * as MutableHashMap from "../MutableHashMap.js"
import * as Option from "../Option.js"
import { CurrentScheduler } from "../References.js"
import type { Entry, Request } from "../Request.js"
import { isRequest, makeEntry } from "../Request.js"
import type { RequestResolver } from "../RequestResolver.js"
import { CompletedRequestMap } from "./completedRequestMap.js"
import * as core from "./core.js"

/** @internal */
export const request: {
  <A extends Request<any, any>, Ds extends RequestResolver<A> | Effect<RequestResolver<A>, any, any>>(
    dataSource: Ds
  ): (
    self: A
  ) => Effect<
    Request.Success<A>,
    Request.Error<A>,
    [Ds] extends [Effect<any, any, any>] ? Effect.Context<Ds> : never
  >
  <
    Ds extends RequestResolver<A> | Effect<RequestResolver<A>, any, any>,
    A extends Request<any, any>
  >(
    self: A,
    dataSource: Ds
  ): Effect<
    Request.Success<A>,
    Request.Error<A>,
    [Ds] extends [Effect<any, any, any>] ? Effect.Context<Ds> : never
  >
} = dual(
  (args) => isRequest(args[0]),
  <
    Ds extends RequestResolver<A> | Effect<RequestResolver<A>, any, any>,
    A extends Request<any, any>
  >(
    self: A,
    dataSource: Ds
  ): Effect<
    Request.Success<A>,
    Request.Error<A>,
    [Ds] extends [Effect<any, any, any>] ? Effect.Context<Ds> : never
  > => {
    const handle = (resolver: RequestResolver<A>) =>
      core.withFiber<
        Request.Success<A>,
        Request.Error<A>,
        [Ds] extends [Effect<any, any, any>] ? Effect.Context<Ds> : never
      >((fiber) =>
        core.async((resume) => {
          const entry = makeEntry({
            request: self,
            resume
          })
          addEntry(resolver, entry, fiber)
          return maybeRemoveEntry(resolver, entry)
        })
      )
    return core.isEffect(dataSource)
      ? core.flatMap(dataSource as Effect<RequestResolver<A>>, handle)
      : handle(dataSource)
  }
)

interface Batch {
  readonly resolver: RequestResolver<any>
  readonly entries: NonEmptyArray<Entry<any>>
  readonly requests: NonEmptyArray<any>
  delayFiber?: Fiber<void> | undefined
}

const pendingBatches = globalValue(
  "effect/Request/pendingBatches",
  () => MutableHashMap.empty<RequestResolver<any>, Batch>()
)

const addEntry = <A>(resolver: RequestResolver<A>, entry: Entry<A>, fiber: Fiber<any, any>) => {
  let batch = Option.getOrUndefined(MutableHashMap.get(pendingBatches, resolver))
  if (!batch) {
    batch = {
      resolver,
      entries: [entry],
      requests: [entry.request]
    }
    MutableHashMap.set(pendingBatches, resolver, batch)
    batch.delayFiber = core.runFork(
      core.andThen(resolver.delay, runBatch(batch)),
      { scheduler: fiber.getRef(CurrentScheduler) }
    )
    return
  }

  batch.entries.push(entry)
  batch.requests.push(entry.request)
  if (batch.resolver.continue(batch.requests)) return

  batch.delayFiber!.unsafeInterrupt(fiber.id)
  batch.delayFiber = undefined
  core.runFork(runBatch(batch), { scheduler: fiber.getRef(CurrentScheduler) })
}

const maybeRemoveEntry = <A>(resolver: RequestResolver<A>, entry: Entry<A>) =>
  core.suspend(() => {
    const batch = Option.getOrUndefined(MutableHashMap.get(pendingBatches, resolver))
    if (!batch) return core.void
    const index = batch.entries.indexOf(entry)
    if (index < 0) return core.void
    batch.entries.splice(index, 1)
    batch.requests.splice(index, 1)
    if (batch.entries.length === 0) {
      MutableHashMap.remove(pendingBatches, resolver)
      return batch.delayFiber ? core.fiberInterrupt(batch.delayFiber) : core.void
    }
    return core.void
  })

const runBatch = ({ entries, requests, resolver }: Batch) =>
  core.suspend(() => {
    if (!MutableHashMap.has(pendingBatches, resolver)) return core.void
    MutableHashMap.remove(pendingBatches, resolver)
    const completedRequestMap = new Map<Request<any, any>, Entry<any>>()
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      completedRequestMap.set(entry.request, entry)
    }
    return core.onExit(
      core.provideService(resolver.runAll(requests), CompletedRequestMap, completedRequestMap),
      (exit) => {
        completedRequestMap.clear()
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]
          const request = entry.request
          if (!entry.completed) {
            entry.completed = true
            entry.resume(
              exit._tag === "Success"
                ? core.exitDie(
                  new Error("Effect.request: RequestResolver did not complete request", { cause: request })
                )
                : exit
            )
          }
        }
        entries.length = 0
        requests.length = 0
        return core.void
      }
    )
  })
