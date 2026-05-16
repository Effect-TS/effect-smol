/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Effect from "../../Effect.ts"
import { hasProperty, isTagged } from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import { EntityAddress } from "./EntityAddress.ts"
import { RunnerAddress } from "./RunnerAddress.ts"
import { SnowflakeFromString } from "./Snowflake.ts"

const TypeId = "~effect/cluster/ClusterError"

/**
 * Represents an error that occurs when a Runner receives a message for an entity
 * that it is not assigned to it.
 *
 * @category errors
 * @since 4.0.0
 */
export class EntityNotAssignedToRunner
  extends Schema.ErrorClass<EntityNotAssignedToRunner>(`${TypeId}/EntityNotAssignedToRunner`)({
    _tag: Schema.tag("EntityNotAssignedToRunner"),
    address: EntityAddress
  })
{
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Returns `true` when the value is an `EntityNotAssignedToRunner` error.
   *
   * @since 4.0.0
   */
  static is(u: unknown): u is EntityNotAssignedToRunner {
    return hasProperty(u, TypeId) && isTagged(u, "EntityNotAssignedToRunner")
  }
}

/**
 * Represents an error that occurs when a message fails to be properly
 * deserialized by an entity.
 *
 * @category errors
 * @since 4.0.0
 */
export class MalformedMessage extends Schema.ErrorClass<MalformedMessage>(`${TypeId}/MalformedMessage`)({
  _tag: Schema.tag("MalformedMessage"),
  cause: Schema.Defect
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Returns `true` when the value is a `MalformedMessage` error.
   *
   * @since 4.0.0
   */
  static is(u: unknown): u is MalformedMessage {
    return hasProperty(u, TypeId) && isTagged(u, "MalformedMessage")
  }

  /**
   * Maps failures from the supplied effect into `MalformedMessage` errors.
   *
   * @since 4.0.0
   */
  static refail: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<
    A,
    MalformedMessage,
    R
  > = Effect.mapError((cause) => new MalformedMessage({ cause }))
}

/**
 * Represents an error that occurs when a message fails to be persisted into
 * cluster's mailbox storage.
 *
 * @category errors
 * @since 4.0.0
 */
export class PersistenceError extends Schema.ErrorClass<PersistenceError>(`${TypeId}/PersistenceError`)({
  _tag: Schema.tag("PersistenceError"),
  cause: Schema.Defect
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Maps failures from the supplied effect into `PersistenceError` values.
   *
   * @since 4.0.0
   */
  static refail<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, PersistenceError, R> {
    return Effect.catchCause(effect, (cause) => Effect.fail(new PersistenceError({ cause: Cause.squash(cause) })))
  }
}

/**
 * Represents an error that occurs when a Runner is not registered with the shard
 * manager.
 *
 * @category errors
 * @since 4.0.0
 */
export class RunnerNotRegistered extends Schema.ErrorClass<RunnerNotRegistered>(`${TypeId}/RunnerNotRegistered`)({
  _tag: Schema.tag("RunnerNotRegistered"),
  address: RunnerAddress
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId
}

/**
 * Represents an error that occurs when a Runner is unresponsive.
 *
 * @category errors
 * @since 4.0.0
 */
export class RunnerUnavailable extends Schema.ErrorClass<RunnerUnavailable>(`${TypeId}/RunnerUnavailable`)({
  _tag: Schema.tag("RunnerUnavailable"),
  address: RunnerAddress
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Returns `true` when the value is a `RunnerUnavailable` error.
   *
   * @since 4.0.0
   */
  static is(u: unknown): u is RunnerUnavailable {
    return hasProperty(u, TypeId) && isTagged(u, "RunnerUnavailable")
  }
}

/**
 * Represents an error that occurs when the entities mailbox is full.
 *
 * @category errors
 * @since 4.0.0
 */
export class MailboxFull extends Schema.ErrorClass<MailboxFull>(`${TypeId}/MailboxFull`)({
  _tag: Schema.tag("MailboxFull"),
  address: EntityAddress
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Returns `true` when the value is a `MailboxFull` error.
   *
   * @since 4.0.0
   */
  static is(u: unknown): u is MailboxFull {
    return hasProperty(u, TypeId) && isTagged(u, "MailboxFull")
  }
}

/**
 * Represents an error that occurs when the entity is already processing a
 * request.
 *
 * @category errors
 * @since 4.0.0
 */
export class AlreadyProcessingMessage
  extends Schema.ErrorClass<AlreadyProcessingMessage>(`${TypeId}/AlreadyProcessingMessage`)({
    _tag: Schema.tag("AlreadyProcessingMessage"),
    envelopeId: SnowflakeFromString,
    address: EntityAddress
  })
{
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Returns `true` when the value is an `AlreadyProcessingMessage` error.
   *
   * @since 4.0.0
   */
  static is(u: unknown): u is AlreadyProcessingMessage {
    return hasProperty(u, TypeId) && isTagged(u, "AlreadyProcessingMessage")
  }
}
