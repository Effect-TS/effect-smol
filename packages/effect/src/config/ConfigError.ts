/**
 * @since 4.0.0
 */
import type * as Cause from "../Cause.ts"
import * as Data from "../Data.ts"
import * as Filter from "../Filter.ts"
import { hasProperty } from "../Predicate.ts"

/**
 * @since 4.0.0
 * @category TypeId
 */
export const TypeId: TypeId = "~effect/config/ConfigError"

/**
 * @since 4.0.0
 * @category TypeId
 */
export type TypeId = "~effect/config/ConfigError"

/**
 * @since 4.0.0
 * @category Guards
 */
export const isConfigError = (u: unknown): u is ConfigError => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category Models
 */
export type ConfigError = MissingData | SourceError | InvalidData

/**
 * @since 4.0.0
 * @category Models
 */
export class MissingData extends Data.TaggedError("ConfigError")<{
  readonly path: ReadonlyArray<string>
  readonly fullPath?: string | undefined
  readonly cause?: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
  /**
   * @since 4.0.0
   */
  readonly reason = "MissingData"
  /**
   * @since 4.0.0
   */
  get message(): string {
    const pathString = this.path.join(".")
    const showFullPath = this.fullPath && this.fullPath !== pathString
    return `Missing data at path: ${this.path.join(".")}${showFullPath ? ` (${this.fullPath})` : ""}`
  }
}

/**
 * @since 4.0.0
 * @category Filters
 */
export const filterMissingData: Filter.Filter<ConfigError, MissingData, SourceError | InvalidData> = Filter
  .fromPredicate((e: ConfigError) => e.reason === "MissingData")

/**
 * @since 4.0.0
 * @category Filters
 */
export const filterMissingDataOnly: Filter.Filter<
  Cause.Cause<ConfigError>,
  Cause.Cause<MissingData>,
  Cause.Cause<SourceError | InvalidData>
> = Filter.fromPredicate((cause: Cause.Cause<ConfigError>) =>
  cause.failures.every((f) => f._tag === "Fail" && f.error.reason === "MissingData")
) as any

/**
 * @since 4.0.0
 * @category Models
 */
export class SourceError extends Data.TaggedError("ConfigError")<{
  readonly path: ReadonlyArray<string>
  readonly description: string
  readonly cause?: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
  /**
   * @since 4.0.0
   */
  readonly reason = "SourceError"
  /**
   * @since 4.0.0
   */
  get message(): string {
    return "Source error (" + this.path.join(".") + "): " + this.description
  }
}

/**
 * @since 4.0.0
 * @category Models
 */
export class InvalidData extends Data.TaggedError("ConfigError")<{
  readonly path: ReadonlyArray<string>
  readonly description: string
  readonly cause?: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
  /**
   * @since 4.0.0
   */
  readonly reason = "InvalidData"
  /**
   * @since 4.0.0
   */
  get message(): string {
    return "Invalid data (" + this.path.join(".") + "): " + this.description
  }
}

/**
 * @since 4.0.0
 * @category Filters
 */
export const filterInvalidData: Filter.Filter<
  ConfigError,
  InvalidData,
  MissingData | SourceError
> = Filter.fromPredicate((e: ConfigError) => e.reason === "InvalidData")
