import * as Option from "../../data/Option.ts"
import * as Effect from "../../Effect.ts"
import * as Fiber from "../../Fiber.ts"
import * as Num from "../../primitives/Number.ts"
import * as Schedule from "../../Schedule.ts"
import * as Scope from "../../Scope.ts"
import * as Duration from "../../time/Duration.ts"
import * as Headers from "../../unstable/http/Headers.ts"
import * as HttpClient from "../../unstable/http/HttpClient.ts"
import * as HttpClientError from "../../unstable/http/HttpClientError.ts"
import * as HttpClientRequest from "../../unstable/http/HttpClientRequest.ts"

const policy = Schedule.forever.pipe(
  Schedule.passthrough,
  Schedule.addDelay((error) => {
    if (
      HttpClientError.isHttpClientError(error)
      && error._tag === "ResponseError"
      && error.response.status === 429
    ) {
      const retryAfter = Option.fromNullable(error.response.headers["retry-after"]).pipe(
        Option.flatMap(Num.parse),
        Option.getOrElse(() => 5)
      )
      return Duration.seconds(retryAfter)
    }
    return Duration.seconds(1)
  })
)

/** @internal */
export const make: (
  options: {
    readonly url: string
    readonly headers: Headers.Input | undefined
    readonly label: string
    readonly exportInterval: Duration.DurationInput
    readonly maxBatchSize: number | "disabled"
    readonly body: (data: Array<any>) => unknown
    readonly shutdownTimeout: Duration.DurationInput
  }
) => Effect.Effect<
  { readonly push: (data: unknown) => void },
  never,
  HttpClient.HttpClient | Scope.Scope
> = Effect.fnUntraced(function*(options) {
  const scope = yield* Effect.scope
  const exportInterval = Duration.decode(options.exportInterval)

  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient).pipe(
    HttpClient.tapError((error) => {
      if (error._tag !== "ResponseError" || error.response.status !== 429) {
        return Effect.void
      }
      const retryAfter = error.response.headers["retry-after"]
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 5
      return Effect.sleep(Duration.seconds(retryAfterSeconds))
    }),
    HttpClient.retryTransient({ schedule: policy })
  )

  let headers = Headers.unsafeFromRecord({
    "user-agent": `effect-opentelemetry-${options.label}/0.0.0`
  })
  if (options.headers) {
    headers = Headers.merge(Headers.fromInput(options.headers), headers)
  }

  const request = HttpClientRequest.post(options.url, { headers })
  let buffer: Array<any> = []
  const runExport = Effect.suspend(() => {
    const items = buffer
    if (options.maxBatchSize !== "disabled") {
      if (buffer.length === 0) {
        return Effect.void
      }
      buffer = []
    }
    return client.execute(
      HttpClientRequest.bodyUnsafeJson(request, options.body(items))
    ).pipe(
      Effect.asVoid,
      Effect.withTracerEnabled(false)
    )
  })

  yield* Scope.addFinalizer(
    scope,
    runExport.pipe(
      Effect.ignore,
      Effect.interruptible,
      Effect.timeoutOption(options.shutdownTimeout)
    )
  )

  let disabled = false

  yield* Effect.sleep(exportInterval).pipe(
    Effect.andThen(runExport),
    Effect.forever,
    Effect.catchCause((cause) => {
      disabled = true
      return Effect.logDebug("Failed to export", cause)
    }),
    Effect.annotateLogs({
      package: "@effect/opentelemetry",
      module: options.label
    }),
    Effect.forkIn(scope)
  )

  return {
    push(data) {
      if (disabled) return
      buffer.push(data)
      if (options.maxBatchSize !== "disabled" && buffer.length >= options.maxBatchSize) {
        Fiber.runIn(Effect.runFork(runExport), scope)
      }
    }
  }
})
