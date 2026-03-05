/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Option from "../../Option.ts"
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
  readonly clear: Effect.Effect<void>
  readonly onSessionDrop: Effect.Effect<void>
  readonly markParts: (parts: ReadonlyArray<object>, responseId: string) => void
  readonly prepare: (prompt: Prompt.Prompt) => Effect.Effect<Option.Option<PrepareResult>>
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make: Effect.Effect<Service> = Effect.sync(() => {
  let sentParts = new WeakMap<object, string>()

  const clear = Effect.sync(() => {
    sentParts = new WeakMap<object, string>()
  })

  return {
    clear,
    onSessionDrop: clear,
    markParts: (parts, responseId) => {
      for (const part of parts) {
        sentParts.set(part, responseId)
      }
    },
    prepare: (prompt) =>
      Effect.sync(() => {
        const messages = prompt.content

        let anyTracked = false
        for (const msg of messages) {
          if (sentParts.has(msg)) {
            anyTracked = true
            break
          }
        }
        if (!anyTracked) {
          return Option.none()
        }

        let lastAssistantIndex = -1
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "assistant") {
            lastAssistantIndex = i
            break
          }
        }
        if (lastAssistantIndex === -1) {
          return Option.none()
        }

        let responseId: string | undefined
        for (let i = 0; i < lastAssistantIndex; i++) {
          const id = sentParts.get(messages[i])
          if (id === undefined) {
            return Option.none()
          }
          responseId = id
        }
        if (responseId === undefined) {
          return Option.none()
        }

        const partsAfterLastAssistant = messages.slice(lastAssistantIndex + 1)
        if (partsAfterLastAssistant.length === 0) {
          return Option.none()
        }

        return Option.some({
          previousResponseId: responseId,
          prompt: Prompt.fromMessages(partsAfterLastAssistant)
        })
      })
  }
})
