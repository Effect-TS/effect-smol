---
book: Effect `Schedule` Cookbook
section_number: "20.5"
section_title: "Poll until eventual consistency settles"
part_title: "Part IV — Polling Recipes"
chapter_title: "20. Poll Until a Desired Output Appears"
status: "draft"
code_included: true
---

# 20.5 Poll until eventual consistency settles

Eventually consistent reads often answer successfully before they answer with
the value a caller expects. Treat those reads as observations, not failures,
and let the schedule focus on whether the view has caught up.

## Problem

You have performed a write, received an expected version or revision, and now need to read from an eventually consistent
view. The first few reads may succeed but still show an older observation.

The polling loop should:

- run the first read immediately
- wait between later reads
- stop as soon as the read model has caught up to the expected state
- keep stale observations separate from transport, authorization, or decoding failures

## When to use it

Use this when a stale read is a normal temporary observation and the caller has a concrete condition that means "the view
has caught up".

This is a good fit after command acceptance, event publication, or asynchronous projection updates where the write path
can tell you the expected revision and the read side exposes enough data to verify it.

## When not to use it

Do not use this when the caller requires a strict read-after-write guarantee. Polling can hide latency, but it does not
turn an eventually consistent dependency into a strongly consistent one.

Do not treat read failures as "not caught up yet". A stale observation should be a successful value. Network failures,
authorization failures, and malformed responses should remain effect failures unless your domain deliberately recovers
them before the repeat.

Do not keep polling after the observation proves the expected value should already be present. If a projection revision
has advanced beyond the expected revision but the expected record is still missing, return a domain inconsistency instead
of polling forever.

## Schedule shape

Poll again only while the latest successful observation is still behind the expected state:

```ts
Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<ProjectionObservation>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Behind")
)
```

`Schedule.spaced("1 second")` supplies the delay between later reads. `Schedule.satisfiesInputType<ProjectionObservation>()`
constrains the timing schedule before `Schedule.while` reads `metadata.input`. `Schedule.passthrough` keeps the latest
successful observation as the schedule output, so `Effect.repeat` returns the final observed `ProjectionObservation`.

The schedule stops when the observation is no longer behind. The code after polling decides whether that final observation
is the expected settled value or a domain inconsistency.

## Code

```ts
import { Effect, Schedule } from "effect"

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

type ProjectionReadError = {
  readonly _tag: "ProjectionReadError"
  readonly message: string
}

type ProjectionWaitError =
  | ProjectionReadError
  | {
    readonly _tag: "ProjectionDidNotContainExpectedOrder"
    readonly reason: string
  }

declare const readAccountOrders: (
  accountId: string
) => Effect.Effect<AccountOrdersView, ProjectionReadError>

const findOrder = (
  view: AccountOrdersView,
  orderId: string
): OrderSummary | undefined => view.orders.find((order) => order.orderId === orderId)

const observeAccountOrders = (
  accountId: string,
  expectedRevision: number,
  orderId: string
): Effect.Effect<ProjectionObservation, ProjectionReadError> =>
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
    })
  )

const pollUntilProjectionSettles = Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<ProjectionObservation>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Behind")
)

const waitForOrderProjection = (
  accountId: string,
  expectedRevision: number,
  orderId: string
): Effect.Effect<OrderSummary, ProjectionWaitError> =>
  observeAccountOrders(accountId, expectedRevision, orderId).pipe(
    Effect.repeat(pollUntilProjectionSettles),
    Effect.flatMap((observation) => {
      switch (observation._tag) {
        case "Settled":
          return Effect.succeed(observation.order)
        case "Inconsistent":
          return Effect.fail({
            _tag: "ProjectionDidNotContainExpectedOrder",
            reason: observation.reason
          })
        case "Behind":
          return Effect.never
      }
    })
  )
```

The first read runs immediately. If the view revision is still below `expectedRevision`, the schedule waits one second
before reading again. If the view contains the expected order at or beyond that revision, polling stops and the order is
returned.

The `Inconsistent` case is intentionally terminal. It represents a successful observation that has caught up far enough
to decide the expected state is absent, not a transient stale read.

## Variants

Add a recurrence cap when the caller needs a bounded wait:

```ts
const pollUntilProjectionSettlesAtMostTwentyTimes = pollUntilProjectionSettles.pipe(
  Schedule.bothLeft(
    Schedule.recurs(20).pipe(
      Schedule.satisfiesInputType<ProjectionObservation>()
    )
  )
)
```

With a cap, the final observed value can still be `Behind` because the recurrence limit stopped the schedule before the
projection caught up. Interpret that case explicitly as a timeout or "not settled in time" domain result.

When many callers may poll the same projection, add jitter to avoid aligned reads:

```ts
const jitteredPollUntilProjectionSettles = pollUntilProjectionSettles.pipe(
  Schedule.jittered
)
```

`Schedule.jittered` randomly adjusts each delay to between 80% and 120% of the original delay.

If you do not have an expected revision, use a stricter stability signal such as the same projection version or checksum
appearing in consecutive reads. That is weaker than checking a known expected state, so combine it with a bounded wait
when a stale but unchanged value would be misleading.

## Notes and caveats

`Schedule.while` sees successful observations only. It does not inspect failures from `readAccountOrders`.

`Effect.repeat` repeats after success. A failed read stops the repeat unless you retry or recover that failure before the
repeat.

The first read is not delayed by the schedule. Delays apply only before later recurrences.

Prefer a concrete expected revision, version, or checksum over vague "looks settled" checks. Eventual consistency is an
observation problem here; the schedule should not encode replication internals.
