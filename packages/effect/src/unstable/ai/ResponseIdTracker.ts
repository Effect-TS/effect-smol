/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Option from "../../Option.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Prompt from "./Prompt.ts"

/**
 * @since 4.0.0
 * @category models
 */
export interface PrepareResult {
  readonly previousResponseId: string
  readonly prompt: Prompt.Prompt
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Service {
  clearUnsafe(): void
  readonly markParts: (parts: ReadonlyArray<object>, responseId: string) => void
  readonly prepareUnsafe: (prompt: Prompt.Prompt) => Option.Option<PrepareResult>
}

/**
 * @since 4.0.0
 * @category Services
 */
export class ResponseIdTracker
  extends ServiceMap.Service<ResponseIdTracker, Service>()("effect/ai/ResponseIdTracker")
{}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make: Effect.Effect<Service> = Effect.sync(() => {
  let sentParts = new WeakMap<object, string>()

  return {
    clearUnsafe() {
      sentParts = new WeakMap<object, string>()
    },
    markParts: (parts, responseId) => {
      for (const part of parts) {
        sentParts.set(part, responseId)
      }
    },
    prepareUnsafe: (prompt) => {
      const messages = prompt.content

      let anyTracked = false
      for (let i = 0; i < messages.length; i++) {
        if (sentParts.has(messages[i])) {
          anyTracked = true
          break
        }
      }
      if (!anyTracked) return Option.none()

      let lastAssistantIndex = -1
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          lastAssistantIndex = i
          break
        }
      }
      if (lastAssistantIndex === -1) return Option.none()

      let responseId: string | undefined
      for (let i = 0; i < lastAssistantIndex; i++) {
        const id = sentParts.get(messages[i])
        if (id === undefined) return Option.none()
        responseId = id
      }
      if (responseId === undefined) return Option.none()

      const partsAfterLastAssistant = messages.slice(lastAssistantIndex + 1)
      if (partsAfterLastAssistant.length === 0) {
        return Option.none()
      }

      return Option.some({
        previousResponseId: responseId,
        prompt: Prompt.fromMessages(partsAfterLastAssistant)
      })
    }
  }
})
