import * as Data from "../Data.ts"

/**
 * Error returned by `join` when an actor is stopped before producing an output.
 *
 * @category errors
 * @since 4.0.0
 */
export class ActorStoppedError extends Data.TaggedError("ActorStoppedError") {}

/**
 * Error returned by `spawn` when a child actor with the same id already exists.
 *
 * @category errors
 * @since 4.0.0
 */
export class ActorChildAlreadyExistsError extends Data.TaggedError("ActorChildAlreadyExistsError")<{
  readonly id: string
}> {}

/**
 * Error returned by `spawn` when an actor with the same system id already exists.
 *
 * @category errors
 * @since 4.0.0
 */
export class ActorSystemIdAlreadyExistsError extends Data.TaggedError("ActorSystemIdAlreadyExistsError")<{
  readonly systemId: string
}> {}
