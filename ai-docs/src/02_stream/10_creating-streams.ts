/**
 * @title Creating streams from common data sources
 *
 * Start with simple constructors, then move to effectful and paginated inputs
 * without changing how you process values.
 */
import { Console, Effect, Schedule, Stream } from "effect"
import * as Option from "effect/Option"

export interface DeploymentJob {
  readonly id: string
  readonly service: string
  readonly status: "queued" | "running" | "succeeded"
}

// `Stream.fromIterable` is the easiest way to create a stream from data you
// already have in memory.
export const seededJobs = Stream.fromIterable<DeploymentJob>([
  { id: "job-100", service: "billing", status: "queued" },
  { id: "job-101", service: "search", status: "running" }
])

// `Stream.fromEffectSchedule` turns a single effect into a polling stream.
// This is useful for metrics, health checks, and cache refresh loops.
export const queueDepthSamples = Stream.fromEffectSchedule(
  Effect.succeed(3),
  Schedule.spaced("30 seconds")
).pipe(
  Stream.take(3)
)

const pages: ReadonlyArray<ReadonlyArray<DeploymentJob>> = [
  [
    { id: "job-102", service: "billing", status: "running" },
    { id: "job-103", service: "search", status: "queued" }
  ],
  [
    { id: "job-104", service: "analytics", status: "queued" }
  ],
  [
    { id: "job-105", service: "billing", status: "succeeded" }
  ]
]

// Use `Stream.paginate` when reading APIs that return one page at a time.
// The function returns the current page of values and optionally the next page.
export const fetchJobsPage = Effect.fnUntraced(function*(page: number) {
  // Simulate network latency to make the flow realistic.
  yield* Effect.sleep("50 millis")

  const jobs = pages[page] ?? []
  const nextPage = page < pages.length - 1
    ? Option.some(page + 1)
    : Option.none<number>()

  return [jobs, nextPage] as const
})

export const jobsFromApi = Stream.paginate(0, fetchJobsPage)

// Downstream processing looks the same regardless of how the stream was created.
export const preview = Effect.gen(function*() {
  const seedPreview = yield* seededJobs.pipe(Stream.runCollect)
  const depthPreview = yield* queueDepthSamples.pipe(Stream.runCollect)
  const apiPreview = yield* jobsFromApi.pipe(Stream.runCollect)

  yield* Console.log({ seedPreview, depthPreview, apiPreview })
})
