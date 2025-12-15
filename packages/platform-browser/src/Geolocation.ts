/**
 * @since 1.0.0
 */
import * as Data from "effect/data/Data"
import * as Result from "effect/data/Result"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/stream/Stream"

const TypeId = "~@effect/platform-browser/Geolocation"
const ErrorTypeId = "~@effect/platform-browser/Geolocation/GeolocationError"

/**
 * @since 1.0.0
 * @category Models
 */
export interface Geolocation {
  readonly [TypeId]: typeof TypeId
  readonly getCurrentPosition: (
    options?: PositionOptions | undefined
  ) => Effect.Effect<GeolocationPosition, GeolocationError>
  readonly watchPosition: (
    options?:
      | PositionOptions & {
        readonly bufferSize?: number | undefined
      }
      | undefined
  ) => Stream.Stream<GeolocationPosition, GeolocationError>
}

/**
 * @since 1.0.0
 * @category Service
 */
export const Geolocation: ServiceMap.Service<Geolocation, Geolocation> = ServiceMap.Service<Geolocation>(TypeId)

/**
 * @since 1.0.0
 * @category Errors
 */
export class GeolocationError extends Data.TaggedError("GeolocationError")<{
  readonly reason: "PositionUnavailable" | "PermissionDenied" | "Timeout"
  readonly cause: unknown
}> {
  readonly [ErrorTypeId] = ErrorTypeId

  override get message(): string {
    return this.reason
  }
}

const makeQueue = (
  options:
    | PositionOptions & {
      readonly bufferSize?: number | undefined
    }
    | undefined
) =>
  Queue.sliding<Result.Result<GeolocationPosition, GeolocationError>>(options?.bufferSize ?? 16).pipe(
    Effect.tap((queue) =>
      Effect.acquireRelease(
        Effect.sync(() =>
          navigator.geolocation.watchPosition(
            (position) => Queue.offerUnsafe(queue, Result.succeed(position)),
            (cause) => {
              if (cause.code === cause.PERMISSION_DENIED) {
                const result = Result.fail(new GeolocationError({ reason: "PermissionDenied", cause }))
                Queue.offerUnsafe(queue, result)
              } else if (cause.code === cause.TIMEOUT) {
                const result = Result.fail(new GeolocationError({ reason: "Timeout", cause }))
                Queue.offerUnsafe(queue, result)
              }
            },
            options
          )
        ),
        (handleId) => Effect.sync(() => navigator.geolocation.clearWatch(handleId))
      )
    )
  )

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer: Layer.Layer<Geolocation> = Layer.succeed(
  Geolocation,
  Geolocation.of({
    [TypeId]: TypeId,
    getCurrentPosition: (options) =>
      makeQueue(options).pipe(
        Effect.flatMap(Queue.take),
        Effect.flatMap(Effect.fromResult),
        Effect.scoped
      ),
    watchPosition: (options) =>
      makeQueue(options).pipe(
        Effect.map(Stream.fromQueue),
        Stream.unwrap,
        Stream.mapEffect(Effect.fromResult)
      )
  })
)

/**
 * @since 1.0.0
 * @category Accessors
 */
export const watchPosition = (
  options?:
    | PositionOptions & {
      readonly bufferSize?: number | undefined
    }
    | undefined
): Stream.Stream<GeolocationPosition, GeolocationError, Geolocation> =>
  Stream.unwrap(Effect.map(
    Effect.service(Geolocation),
    (geolocation) => geolocation.watchPosition(options)
  ))
