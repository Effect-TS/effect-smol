/**
 * @since 1.0.0
 */
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

const TypeId = "~@effect/platform-browser/Permissions"
const ErrorTypeId = "~@effect/platform-browser/Permissions/PermissionsError"

/**
 * Wrapper on the Permission API (`navigator.permissions`) with methods for
 * querying status of permissions.
 *
 * @category Models
 * @since 1.0.0
 */
export interface Permissions {
  readonly [TypeId]: typeof TypeId

  /**
   * Returns the state of a user permission on the global scope.
   */
  readonly query: <Name extends PermissionName>(
    name: Name
  ) => Effect.Effect<
    // `name` is identical to the name passed to Permissions.query
    // https://developer.mozilla.org/en-US/docs/Web/API/PermissionStatus
    Omit<PermissionStatus, "name"> & { name: Name },
    PermissionsError
  >
}

/**
 * Error reason for an `InvalidStateError` raised by the browser Permissions API.
 *
 * @category errors
 * @since 1.0.0
 */
export class PermissionsInvalidStateError extends Data.TaggedError("InvalidStateError")<{
  readonly cause: unknown
}> {
  override get message(): string {
    return this._tag
  }
}

/**
 * Error reason for a `TypeError` raised by the browser Permissions API.
 *
 * @category errors
 * @since 1.0.0
 */
export class PermissionsTypeError extends Data.TaggedError("TypeError")<{
  readonly cause: unknown
}> {
  override get message(): string {
    return this._tag
  }
}

/**
 * Union of browser Permissions API error reasons represented by the service.
 *
 * @category errors
 * @since 1.0.0
 */
export type PermissionsErrorReason = PermissionsInvalidStateError | PermissionsTypeError

/**
 * Tagged error wrapping a browser Permissions API failure reason.
 *
 * @category errors
 * @since 1.0.0
 */
export class PermissionsError extends Data.TaggedError("PermissionsError")<{
  readonly reason: PermissionsErrorReason
}> {
  constructor(props: { readonly reason: PermissionsErrorReason }) {
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
 * Service tag for the browser `Permissions` service.
 *
 * @category Service
 * @since 1.0.0
 */
export const Permissions: Context.Service<Permissions, Permissions> = Context.Service<Permissions>(TypeId)

/**
 * A layer that directly interfaces with the `navigator.permissions` api
 *
 * @category Layers
 * @since 1.0.0
 */
export const layer: Layer.Layer<Permissions> = Layer.succeed(
  Permissions,
  Permissions.of({
    [TypeId]: TypeId,
    query: (name) =>
      Effect.tryPromise({
        try: () => navigator.permissions.query({ name }) as Promise<any>,
        catch: (cause) =>
          new PermissionsError({
            reason: cause instanceof DOMException
              ? new PermissionsInvalidStateError({ cause })
              : new PermissionsTypeError({ cause })
          })
      })
  })
)
