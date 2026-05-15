/**
 * @since 1.0.0
 */
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"

const TypeId = "~@effect/platform-browser/Geolocation"
const ErrorTypeId = "~@effect/platform-browser/Geolocation/GeolocationError"

/**
 * @category Models
 * @since 1.0.0
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
 * @category Service
 * @since 1.0.0
 */
export const Geolocation: Context.Service<Geolocation, Geolocation> = Context.Service<Geolocation>(TypeId)

/**
 * @category Errors
 * @since 1.0.0
 */
export class GeolocationError extends Data.TaggedError("GeolocationError")<{
  readonly reason: GeolocationErrorReason
}> {
  constructor(props: {
    readonly reason: GeolocationErrorReason
  }) {
    super({
      ...props,
      cause: props.reason.cause
    } as any)
  }

  readonly [ErrorTypeId] = ErrorTypeId

  override get message(): string {
    return this.reason.message
  }
}

/**
 * @category Errors
 * @since 1.0.0
 */
export class PositionUnavailable extends Data.TaggedError("PositionUnavailable")<{
  readonly cause: unknown
}> {
  override get message(): string {
    return this._tag
  }
}

/**
 * @category Errors
 * @since 1.0.0
 */
export class PermissionDenied extends Data.TaggedError("PermissionDenied")<{
  readonly cause: unknown
}> {
  override get message(): string {
    return this._tag
  }
}

/**
 * @category Errors
 * @since 1.0.0
 */
export class Timeout extends Data.TaggedError("Timeout")<{
  readonly cause: unknown
}> {
  override get message(): string {
    return this._tag
  }
}

/**
 * @category Errors
 * @since 1.0.0
 */
export type GeolocationErrorReason = PositionUnavailable | PermissionDenied | Timeout

const makeQueue = (
  options:
    | PositionOptions & {
      readonly bufferSize?: number | undefined
    }
    | undefined
) =>
  Queue.sliding<GeolocationPosition, GeolocationError>(options?.bufferSize ?? 16).pipe(
    Effect.tap((queue) =>
      Effect.acquireRelease(
        Effect.sync(() =>
          navigator.geolocation.watchPosition(
            (position) => Queue.offerUnsafe(queue, position),
            (cause) => {
              if (cause.code === cause.PERMISSION_DENIED) {
                const error = new GeolocationError({
                  reason: new PermissionDenied({ cause })
                })
                Queue.failCauseUnsafe(queue, Cause.fail(error))
              } else if (cause.code === cause.TIMEOUT) {
                const error = new GeolocationError({
                  reason: new Timeout({ cause })
                })
                Queue.failCauseUnsafe(queue, Cause.fail(error))
              } else if (cause.code === cause.POSITION_UNAVAILABLE) {
                const error = new GeolocationError({
                  reason: new PositionUnavailable({ cause })
                })
                Queue.failCauseUnsafe(queue, Cause.fail(error))
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
 * @category Layers
 * @since 1.0.0
 */
export const layer: Layer.Layer<Geolocation> = Layer.succeed(
  Geolocation,
  Geolocation.of({
    [TypeId]: TypeId,
    getCurrentPosition: (options) =>
      makeQueue(options).pipe(
        Effect.flatMap(Queue.take),
        Effect.scoped
      ),
    watchPosition: (options) =>
      makeQueue(options).pipe(
        Effect.map(Stream.fromQueue),
        Stream.unwrap
      )
  })
)

/**
 * @category Accessors
 * @since 1.0.0
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
