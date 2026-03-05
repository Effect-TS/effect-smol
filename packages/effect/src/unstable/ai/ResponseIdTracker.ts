/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as Option from "../../Option.ts"
import * as Ref from "../../Ref.ts"
import * as ServiceMap from "../../ServiceMap.ts"

/**
 * @since 4.0.0
 * @category services
 */
export class ResponseIdTracker extends ServiceMap.Service<ResponseIdTracker, Service>()(
  "effect/unstable/ai/ResponseIdTracker"
) {}

/**
 * @since 4.0.0
 * @category models
 */
export interface Service {
  readonly get: Effect.Effect<Option.Option<string>>
  readonly set: (id: string) => Effect.Effect<void>
  readonly clear: Effect.Effect<void>
  readonly onSessionDrop: Effect.Effect<void>
  readonly markParts: (parts: ReadonlyArray<object>) => void
  readonly hasPart: (part: object) => boolean
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make: Effect.Effect<ResponseIdTracker["Service"]> = Effect.sync(() => {
  const ref = Ref.makeUnsafe<Option.Option<string>>(Option.none())
  const sentParts = new WeakSet<object>()

  return ResponseIdTracker.of({
    get: Ref.get(ref),
    set: (id) => Ref.set(ref, Option.some(id)),
    clear: Ref.set(ref, Option.none()),
    onSessionDrop: Ref.set(ref, Option.none()),
    markParts: (parts) => {
      for (const part of parts) {
        sentParts.add(part)
      }
    },
    hasPart: (part) => sentParts.has(part)
  })
})

/**
 * @since 4.0.0
 * @category constructors
 */
export const layer: Layer.Layer<ResponseIdTracker> = Layer.effect(ResponseIdTracker)(make)
