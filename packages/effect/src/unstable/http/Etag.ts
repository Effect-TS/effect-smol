/**
 * @since 4.0.0
 */
import * as Context from "../../Context.ts"
import * as Effect from "../../Effect.ts"
import type * as FileSystem from "../../FileSystem.ts"
import * as Layer from "../../Layer.ts"
import * as Option from "../../Option.ts"
import type * as Body from "./HttpBody.ts"

/**
 * @category models
 * @since 4.0.0
 */
export type Etag = Weak | Strong

/**
 * @category models
 * @since 4.0.0
 */
export interface Weak {
  readonly _tag: "Weak"
  readonly value: string
}

/**
 * @category models
 * @since 4.0.0
 */
export interface Strong {
  readonly _tag: "Strong"
  readonly value: string
}

/**
 * @category convertions
 * @since 4.0.0
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
 * @category models
 * @since 4.0.0
 */
export class Generator extends Context.Service<Generator, {
  readonly fromFileInfo: (info: FileSystem.File.Info) => Effect.Effect<Etag>
  readonly fromFileWeb: (file: Body.HttpBody.FileLike) => Effect.Effect<Etag>
}>()("effect/http/Etag/Generator") {}

const fromFileInfo = (info: FileSystem.File.Info) => {
  const mtime = Option.match(info.mtime, {
    onNone: () => "0",
    onSome: (mtime) => mtime.getTime().toString(16)
  })
  return `${info.size.toString(16)}-${mtime}`
}

const fromFileWeb = (file: Body.HttpBody.FileLike) => {
  return `${file.size.toString(16)}-${file.lastModified.toString(16)}`
}

/**
 * @category Layers
 * @since 4.0.0
 */
export const layer: Layer.Layer<Generator> = Layer.succeed(
  Generator
)({
  fromFileInfo(info) {
    return Effect.sync(() => ({ _tag: "Strong", value: fromFileInfo(info) }))
  },
  fromFileWeb(file) {
    return Effect.sync(() => ({ _tag: "Strong", value: fromFileWeb(file) }))
  }
})

/**
 * @category Layers
 * @since 4.0.0
 */
export const layerWeak: Layer.Layer<Generator> = Layer.succeed(
  Generator
)({
  fromFileInfo(info) {
    return Effect.sync(() => ({ _tag: "Weak", value: fromFileInfo(info) }))
  },
  fromFileWeb(file) {
    return Effect.sync(() => ({ _tag: "Weak", value: fromFileWeb(file) }))
  }
})
