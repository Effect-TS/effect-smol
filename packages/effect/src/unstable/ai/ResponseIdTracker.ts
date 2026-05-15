/**
 * @since 4.0.0
 */
import * as Context from "../../Context.ts"
import * as Effect from "../../Effect.ts"
import * as Option from "../../Option.ts"
import * as Prompt from "./Prompt.ts"

/**
 * @category models
 * @since 4.0.0
 */
export interface PrepareResult {
  readonly previousResponseId: string
  readonly prompt: Prompt.Prompt
}

/**
 * @category models
 * @since 4.0.0
 */
export interface Service {
  clearUnsafe(): void
  markParts(parts: ReadonlyArray<object>, responseId: string): void
  prepareUnsafe(prompt: Prompt.Prompt): Option.Option<PrepareResult>
}

/**
 * @category Services
 * @since 4.0.0
 */
export class ResponseIdTracker extends Context.Service<ResponseIdTracker, Service>()("effect/ai/ResponseIdTracker") {}

/**
 * @category constructors
 * @since 4.0.0
 */
export const make: Effect.Effect<Service> = Effect.sync(() => {
  const sentParts = new Map<object, string>()

  const none = () => {
    sentParts.clear()
    return Option.none<PrepareResult>()
  }

  return {
    clearUnsafe() {
      sentParts.clear()
    },
    markParts(parts, responseId) {
      for (let i = 0; i < parts.length; i++) {
        sentParts.set(parts[i], responseId)
      }
    },
    prepareUnsafe(prompt) {
      const messages = prompt.content

      let anyTracked = false
      for (let i = 0; i < messages.length; i++) {
        if (sentParts.has(messages[i])) {
          anyTracked = true
          break
        }
      }
      if (!anyTracked) return none()

      let lastAssistantIndex = -1
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          lastAssistantIndex = i
          break
        }
      }
      if (lastAssistantIndex === -1) return none()

      let responseId: string | undefined
      for (let i = 0; i < lastAssistantIndex; i++) {
        const id = sentParts.get(messages[i])
        if (id === undefined) return none()
        responseId = id
      }
      if (responseId === undefined) return none()

      const partsAfterLastAssistant = messages.slice(lastAssistantIndex + 1)
      if (partsAfterLastAssistant.length === 0) {
        return none()
      }

      return Option.some({
        previousResponseId: responseId,
        prompt: Prompt.fromMessages(partsAfterLastAssistant)
      })
    }
  }
})
