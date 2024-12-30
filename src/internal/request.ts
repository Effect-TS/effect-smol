import type { NonEmptyArray } from "effect/Array"
import type { Effect } from "../Effect.js"
import type { Fiber } from "../Fiber.js"
import { dual } from "../Function.js"
import { globalValue } from "../GlobalValue.js"
import { CurrentScheduler } from "../References.js"
import type { Entry, Request } from "../Request.js"
import { makeEntry } from "../Request.js"
import type { RequestResolver } from "../RequestResolver.js"
import { CompletedRequestMap } from "./completedRequestMap.js"
import * as core from "./core.js"

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
      core.withFiber<
        Request.Success<A>,
        Request.Error<A>,
        Request.Context<A>
      >((fiber) =>
        core.async((resume) => {
          const entry = makeEntry({
            request: self,
            context: fiber.context as any,
            resume
          })
          addEntry(resolver, entry, fiber)
          return maybeRemoveEntry(resolver, entry)
        })
      )
    return core.isEffect(resolver) ? core.flatMap(resolver, withResolver) : withResolver(resolver)
  }
)

interface Batch {
  readonly resolver: RequestResolver<any>
  readonly requestMap: typeof CompletedRequestMap.Service
  readonly requests: NonEmptyArray<any>
  delayFiber?: Fiber<void> | undefined
}

const pendingBatches = globalValue(
  "effect/Request/pendingBatches",
  () => new Map<RequestResolver<any>, Batch>()
)

const addEntry = <A extends Request<any, any, any>>(
  resolver: RequestResolver<A>,
  entry: Entry<A>,
  fiber: Fiber<any, any>
) => {
  let batch = pendingBatches.get(resolver)
  if (!batch) {
    batch = {
      resolver,
      requestMap: new Map([[entry.request, [entry]]]),
      requests: [entry.request]
    }
    pendingBatches.set(resolver, batch)
    batch.delayFiber = core.runFork(
      core.andThen(resolver.delay, runBatch(batch)),
      { scheduler: fiber.getRef(CurrentScheduler) }
    )
    return
  }

  let entries = batch.requestMap.get(entry.request)
  if (!entries) {
    entries = []
    batch.requestMap.set(entry.request, entries)
    batch.requests.push(entry.request)
  }
  entries.push(entry)
  if (batch.resolver.collectWhile(batch.requests)) return

  batch.delayFiber!.unsafeInterrupt(fiber.id)
  batch.delayFiber = undefined
  core.runFork(runBatch(batch), { scheduler: fiber.getRef(CurrentScheduler) })
}

const maybeRemoveEntry = <A extends Request<any, any, any>>(resolver: RequestResolver<A>, entry: Entry<A>) =>
  core.suspend(() => {
    const batch = pendingBatches.get(resolver)
    if (!batch) return core.void
    const entries = batch.requestMap.get(entry.request)
    if (!entries) return core.void

    const index = entries.indexOf(entry)
    if (index < 0) return core.void
    entries.splice(index, 1)

    if (entries.length > 0) return core.void

    const requestIndex = batch.requests.indexOf(entry.request)
    if (requestIndex < 0) return core.void
    batch.requests.splice(requestIndex, 1)
    batch.requestMap.delete(entry.request)

    if (batch.requests.length === 0) {
      pendingBatches.delete(resolver)
      return batch.delayFiber ? core.fiberInterrupt(batch.delayFiber) : core.void
    }
    return core.void
  })

const runBatch = ({ requestMap, requests, resolver }: Batch) =>
  core.suspend(() => {
    if (!pendingBatches.has(resolver)) return core.void
    pendingBatches.delete(resolver)
    return core.onExit(
      core.provideService(resolver.runAll(requests), CompletedRequestMap, requestMap),
      (exit) => {
        for (const entries of requestMap.values()) {
          const request = entries[0].request
          const exit_ = exit._tag === "Success"
            ? core.exitDie(
              new Error("Effect.request: RequestResolver did not complete request", { cause: request })
            )
            : exit
          for (const entry of entries) {
            entry.resume(exit_)
          }
        }
        requests.length = 0
        requestMap.clear()
        return core.void
      }
    )
  })
