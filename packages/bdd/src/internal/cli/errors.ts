import * as Data from "effect/Data"

/** @internal */
export class DiscoveryError extends Data.TaggedError("DiscoveryError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** @internal */
export class ModuleLoadError extends Data.TaggedError("ModuleLoadError")<{
  readonly path: string
  readonly message: string
  readonly cause?: unknown
}> {}

/** @internal */
export class ReporterError extends Data.TaggedError("ReporterError")<{
  readonly message: string
  readonly cause?: unknown
}> {}
