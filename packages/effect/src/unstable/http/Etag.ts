/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.js"
import * as Layer from "../../Layer.js"
import type * as FileSystem from "../../platform/FileSystem.js"
import * as ServiceMap from "../../ServiceMap.js"
import type * as Body from "./HttpBody.js"

/**
 * @since 4.0.0
 * @category models
 */
export type Etag = Weak | Strong

/**
 * @since 4.0.0
 * @category models
 */
export interface Weak {
  readonly _tag: "Weak"
  readonly value: string
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Strong {
  readonly _tag: "Strong"
  readonly value: string
}

/**
 * @since 4.0.0
 * @category convertions
 */
export const toString = (self: Etag): string => {
  switch (self._tag) {
    case "Weak":
      return `W/"${self.value}"`
    case "Strong":
      return `"${self.value}"`
  }
}

/**
 * @since 4.0.0
 * @category models
 */
export class Generator extends ServiceMap.Key<Generator, {
  readonly fromFileInfo: (info: FileSystem.File.Info) => Effect.Effect<Etag>
  readonly fromFileWeb: (file: Body.HttpBody.FileLike) => Effect.Effect<Etag>
}>()("effect/http/Etag/Generator") {}

const fromFileInfo = (info: FileSystem.File.Info) => {
  const mtime = info.mtime._tag === "Some"
    ? info.mtime.value.getTime().toString(16)
    : "0"
  return `${info.size.toString(16)}-${mtime}`
}

const fromFileWeb = (file: Body.HttpBody.FileLike) => {
  return `${file.size.toString(16)}-${file.lastModified.toString(16)}`
}

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer: Layer.Layer<Generator> = Layer.succeed(
  Generator,
  Generator.of({
    fromFileInfo(info) {
      return Effect.sync(() => ({ _tag: "Strong", value: fromFileInfo(info) }))
    },
    fromFileWeb(file) {
      return Effect.sync(() => ({ _tag: "Strong", value: fromFileWeb(file) }))
    }
  })
)

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerWeak: Layer.Layer<Generator> = Layer.succeed(
  Generator,
  Generator.of({
    fromFileInfo(info) {
      return Effect.sync(() => ({ _tag: "Weak", value: fromFileInfo(info) }))
    },
    fromFileWeb(file) {
      return Effect.sync(() => ({ _tag: "Weak", value: fromFileWeb(file) }))
    }
  })
)
