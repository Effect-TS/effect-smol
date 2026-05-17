---
book: "Effect `Schedule` Cookbook"
section_number: "13.4"
section_title: "Poll until eventual consistency settles"
part_title: "Part IV — Polling Recipes"
chapter_title: "13. Poll for Resource State"
status: "draft"
code_included: true
---

# 13.4 Poll until eventual consistency settles

Eventually consistent reads can succeed while still showing an old view. Treat
those stale reads as observations and poll until a concrete condition says the
view has caught up.

## Problem

After a write, the caller may know the expected revision, version, cursor, or
checksum. The read side may lag for a short time, so the first few reads can be
valid but stale.

The polling loop should stop when the expected state is visible, keep stale
observations separate from read failures, and avoid polling forever after the
view has advanced far enough to prove the expected data is absent.

## When to use it

Use this when stale reads are normal temporary observations and the caller has a
specific condition for "settled."

This fits command acceptance followed by asynchronous projection updates, event
publication followed by a read model, or search indexing that exposes enough
state to verify the write has appeared.

## When not to use it

Do not use polling to claim strict read-after-write consistency. It can wait for
an eventually consistent view; it does not make the dependency strongly
consistent.

Do not turn read failures into "not settled yet" unless the domain deliberately
models them that way.

Do not keep polling after the view revision has passed the expected revision but
the expected record is still missing. That is a domain inconsistency, not a
stale read.

## Schedule shape

Represent each successful read as `Behind`, `Settled`, or `Inconsistent`. Use
`Schedule.spaced`, `Schedule.passthrough`, and `Schedule.while` to repeat only
while the latest observation is `Behind`.

After polling, interpret `Settled` as success, `Inconsistent` as a domain
failure, and a bounded final `Behind` as "not settled in time."

## Example

```ts
import { Console, Effect, Schedule } from "effect"

interface OrderSummary {
  readonly orderId: string
  readonly revision: number
  readonly totalCents: number
}

interface AccountOrdersView {
  readonly accountId: string
  readonly revision: number
  readonly orders: ReadonlyArray<OrderSummary>
}

type ProjectionObservation =
  | {
    readonly _tag: "Behind"
    readonly view: AccountOrdersView
    readonly expectedRevision: number
  }
  | {
    readonly _tag: "Settled"
    readonly view: AccountOrdersView
    readonly order: OrderSummary
  }
  | {
    readonly _tag: "Inconsistent"
    readonly view: AccountOrdersView
    readonly reason: string
  }

type ProjectionWaitError =
  | {
    readonly _tag: "ProjectionDidNotSettleInTime"
    readonly expectedRevision: number
    readonly observedRevision: number
  }
  | {
    readonly _tag: "ProjectionDidNotContainExpectedOrder"
    readonly reason: string
  }

const scriptedViews: ReadonlyArray<AccountOrdersView> = [
  { accountId: "account-1", revision: 8, orders: [] },
  { accountId: "account-1", revision: 9, orders: [] },
  {
    accountId: "account-1",
    revision: 10,
    orders: [{ orderId: "order-7", revision: 10, totalCents: 2599 }]
  }
]

let readIndex = 0

const findOrder = (
  view: AccountOrdersView,
  orderId: string
): OrderSummary | undefined =>
  view.orders.find((order) => order.orderId === orderId)

const readAccountOrders = (
  accountId: string
): Effect.Effect<AccountOrdersView> =>
  Effect.sync(() => {
    const view = scriptedViews[
      Math.min(readIndex, scriptedViews.length - 1)
    ]!
    readIndex += 1
    return view
  }).pipe(
    Effect.tap((view) =>
      Console.log(`[${accountId}] read revision ${view.revision}`)
    )
  )

const observeAccountOrders = (
  accountId: string,
  expectedRevision: number,
  orderId: string
): Effect.Effect<ProjectionObservation> =>
  readAccountOrders(accountId).pipe(
    Effect.map((view): ProjectionObservation => {
      const order = findOrder(view, orderId)

      if (order !== undefined && view.revision >= expectedRevision) {
        return { _tag: "Settled", view, order }
      }

      if (view.revision < expectedRevision) {
        return { _tag: "Behind", view, expectedRevision }
      }

      return {
        _tag: "Inconsistent",
        view,
        reason: "Projection reached the expected revision without the order"
      }
    }),
    Effect.tap((observation) =>
      Console.log(`observation: ${observation._tag}`)
    )
  )

const pollUntilProjectionSettles = Schedule.spaced("15 millis").pipe(
  Schedule.satisfiesInputType<ProjectionObservation>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Behind"),
  Schedule.take(10)
)

const requireSettled = (
  expectedRevision: number,
  observation: ProjectionObservation
): Effect.Effect<OrderSummary, ProjectionWaitError> => {
  switch (observation._tag) {
    case "Settled":
      return Effect.succeed(observation.order)
    case "Inconsistent":
      return Effect.fail({
        _tag: "ProjectionDidNotContainExpectedOrder",
        reason: observation.reason
      })
    case "Behind":
      return Effect.fail({
        _tag: "ProjectionDidNotSettleInTime",
        expectedRevision,
        observedRevision: observation.view.revision
      })
  }
}

const expectedRevision = 10

const program = observeAccountOrders(
  "account-1",
  expectedRevision,
  "order-7"
).pipe(
  Effect.repeat(pollUntilProjectionSettles),
  Effect.flatMap((observation) => requireSettled(expectedRevision, observation)),
  Effect.tap((order) => Console.log(`settled order total: ${order.totalCents}`))
)

Effect.runPromise(program).then((order) => {
  console.log("result:", order)
})
```

The first read runs immediately. While the projection is behind the expected
revision, later reads wait for the schedule delay. Once the expected order is
visible at the expected revision or later, polling stops.

## Variants

Add `Schedule.jittered` when many callers may poll the same projection and
aligned reads would add load.

If you do not have an expected revision, use a stricter stability signal such
as the same projection version or checksum appearing in consecutive reads. That
is weaker than checking a known target, so keep the wait bounded.

If the view advances beyond the expected revision without the expected data,
return a domain inconsistency instead of continuing to poll.

## Notes and caveats

`Schedule.while` sees successful observations only. It does not inspect read
failures.

`Effect.repeat` repeats successes. Retry transient failed reads separately when
that is appropriate.

Prefer a concrete expected revision, version, or checksum over vague "looks
settled" checks. The schedule should not encode replication internals.
