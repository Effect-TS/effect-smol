/**
 * The `Chat` module provides a stateful conversation interface for AI language
 * models.
 *
 * This module enables persistent chat sessions that maintain conversation
 * history, support tool calling, and offer both streaming and non-streaming
 * text generation. It integrates seamlessly with the Effect AI ecosystem,
 * providing type-safe conversational AI capabilities.
 *
 * @example
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { Chat, LanguageModel } from "effect/unstable/ai"
 *
 * // Create a new chat session
 * const program = Effect.gen(function* () {
 *   const chat = yield* Chat.empty
 *
 *   // Send a message and get response
 *   const response = yield* chat.generateText({
 *     prompt: "Hello! What can you help me with?"
 *   })
 *
 *   console.log(response.content)
 *
 *   return response
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { Chat, LanguageModel } from "effect/unstable/ai"
 *
 * // Streaming chat with tool support
 * const streamingChat = Effect.gen(function* () {
 *   const chat = yield* Chat.empty
 *
 *   yield* chat.streamText({
 *     prompt: "Generate a creative story"
 *   }).pipe(Stream.runForEach((part) =>
 *     Effect.sync(() => console.log(part))
 *   ))
 * })
 * ```
 *
 * @since 4.0.0
 */
import * as Option from "../../data/Option.ts"
import * as Predicate from "../../data/Predicate.ts"
import * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as Ref from "../../Ref.ts"
import * as Schema from "../../schema/Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Channel from "../../stream/Channel.ts"
import * as Stream from "../../stream/Stream.ts"
import type { NoExcessProperties } from "../../types/Types.ts"
import type { PersistenceError } from "../persistence/Persistence.ts"
import { BackingPersistence } from "../persistence/Persistence.ts"
import * as AiError from "./AiError.ts"
import * as IdGenerator from "./IdGenerator.ts"
import * as LanguageModel from "./LanguageModel.ts"
import * as Prompt from "./Prompt.ts"
import type * as Response from "./Response.ts"
import type * as Tool from "./Tool.ts"

/**
 * The `Chat` service tag for dependency injection.
 *
 * This tag provides access to chat functionality throughout your application,
 * enabling persistent conversational AI interactions with full context
 * management.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Chat } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function* () {
 *   const chat = yield* Chat.empty
 *   const response = yield* chat.generateText({
 *     prompt: "Explain quantum computing in simple terms"
 *   })
 *   return response.content
 * })
 * ```
 *
 * @since 4.0.0
 * @category services
 */
export class Chat extends ServiceMap.Key<Chat, Service>()(
  "effect/ai/Chat"
) {}

/**
 * Represents the interface that the `Chat` service provides.
 *
 * @since 4.0.0
 * @category models
 */
export interface Service {
  /**
   * Reference to the chat history.
   *
   * Provides direct access to the conversation history for advanced use cases
   * like custom history manipulation or inspection.
   *
   * @example
   * ```ts
   * import { Effect, Ref } from "effect"
   * import { Chat } from "effect/unstable/ai"
   *
   * const inspectHistory = Effect.gen(function* () {
   *   const chat = yield* Chat.empty
   *   const currentHistory = yield* Ref.get(chat.history)
   *   console.log("Current conversation:", currentHistory)
   *   return currentHistory
   * })
   * ```
   */
  readonly history: Ref.Ref<Prompt.Prompt>

  /**
   * Exports the chat history into a structured format.
   *
   * Returns the complete conversation history as a structured object
   * that can be stored, transmitted, or processed by other systems.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import { Chat } from "effect/unstable/ai"
   *
   * const saveChat = Effect.gen(function* () {
   *   const chat = yield* Chat.empty
   *   yield* chat.generateText({ prompt: "Hello!" })
   *
   *   const exportedData = yield* chat.export
   *
   *   // Save to database or file system
   *   return exportedData
   * })
   * ```
   */
  readonly export: Effect.Effect<unknown, AiError.AiError>

  /**
   * Exports the chat history as a JSON string.
   *
   * Provides a convenient way to serialize the entire conversation
   * for storage or transmission in JSON format.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import { Chat } from "effect/unstable/ai"
   *
   * const backupChat = Effect.gen(function* () {
   *   const chat = yield* Chat.empty
   *
   *   yield* chat.generateText({ prompt: "Explain photosynthesis" })
   *
   *   const jsonBackup = yield* chat.exportJson
   *
   *   yield* Effect.sync(() =>
   *     localStorage.setItem("chat-backup", jsonBackup)
   *   )
   *
   *   return jsonBackup
   * })
   * ```
   */
  readonly exportJson: Effect.Effect<string, AiError.MalformedOutput>

  /**
   * Generate text using a language model for the specified prompt.
   *
   * If a toolkit is specified, the language model will have access to tools
   * for function calling and enhanced capabilities. Both input and output
   * messages are automatically added to the chat history.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import { Chat } from "effect/unstable/ai"
   *
   * const chatWithAI = Effect.gen(function* () {
   *   const chat = yield* Chat.empty
   *
   *   const response1 = yield* chat.generateText({
   *     prompt: "What is the capital of France?"
   *   })
   *
   *   const response2 = yield* chat.generateText({
   *     prompt: "What's the population of that city?",
   *   })
   *
   *   return [response1.content, response2.content]
   * })
   * ```
   */
  readonly generateText: <
    Options extends NoExcessProperties<LanguageModel.GenerateTextOptions<any>, Options>,
    Tools extends Record<string, Tool.Any> = {}
  >(options: Options & LanguageModel.GenerateTextOptions<Tools>) => Effect.Effect<
    LanguageModel.GenerateTextResponse<Tools>,
    LanguageModel.ExtractError<Options>,
    LanguageModel.LanguageModel | LanguageModel.ExtractServices<Options>
  >

  /**
   * Generate text using a language model with streaming output.
   *
   * Returns a stream of response parts that are emitted as soon as they're
   * available from the model. Supports tool calling and maintains chat history.
   *
   * @example
   * ```ts
   * import { Console, Effect } from "effect"
   * import { Stream } from "effect/stream"
   * import { Chat } from "effect/unstable/ai"
   *
   * const streamingChat = Effect.gen(function* () {
   *   const chat = yield* Chat.empty
   *
   *   const stream = yield* chat.streamText({
   *     prompt: "Write a short story about space exploration"
   *   })
   *
   *   yield* Stream.runForEach(stream, (part) =>
   *     part.type === "text-delta"
   *       ? Effect.sync(() => process.stdout.write(part.delta))
   *       : Effect.void
   *   )
   * })
   * ```
   */
  readonly streamText: <
    Options extends NoExcessProperties<LanguageModel.GenerateTextOptions<any>, Options>,
    Tools extends Record<string, Tool.Any> = {}
  >(options: Options & LanguageModel.GenerateTextOptions<Tools>) => Stream.Stream<
    Response.StreamPart<Tools>,
    LanguageModel.ExtractError<Options>,
    LanguageModel.LanguageModel | LanguageModel.ExtractServices<Options>
  >

  /**
   * Generate a structured object using a language model and schema.
   *
   * Forces the model to return data that conforms to the specified schema,
   * enabling structured data extraction and type-safe responses. The
   * conversation history is maintained across calls.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import { Schema } from "effect/schema"
   * import { Chat } from "effect/unstable/ai"
   *
   * const ContactSchema = Schema.Struct({
   *   name: Schema.String,
   *   email: Schema.String,
   *   phone: Schema.optional(Schema.String)
   * })
   *
   * const extractContact = Effect.gen(function* () {
   *   const chat = yield* Chat.empty
   *
   *   const contact = yield* chat.generateObject({
   *     prompt: "Extract contact info: John Doe, john@example.com, 555-1234",
   *     schema: ContactSchema
   *   })
   *
   *   console.log(contact.object)
   *   // { name: "John Doe", email: "john@example.com", phone: "555-1234" }
   *
   *   return contact.object
   * })
   * ```
   */
  readonly generateObject: <
    ObjectEncoded extends Record<string, any>,
    ObjectSchema extends Schema.Codec<any, ObjectEncoded, any, any>,
    Options extends NoExcessProperties<LanguageModel.GenerateObjectOptions<any, ObjectSchema>, Options>,
    Tools extends Record<string, Tool.Any> = {}
  >(options: Options & LanguageModel.GenerateObjectOptions<Tools, ObjectSchema>) => Effect.Effect<
    LanguageModel.GenerateObjectResponse<Tools, ObjectSchema["Type"]>,
    LanguageModel.ExtractError<Options>,
    LanguageModel.ExtractServices<Options> | ObjectSchema["DecodingServices"] | LanguageModel.LanguageModel
  >
}

const decodeHistory = Schema.decodeUnknownEffect(Prompt.Prompt)
const encodeHistory = Schema.encodeUnknownEffect(Prompt.Prompt)
const decodeHistoryJson = Schema.decodeUnknownEffect(Schema.fromJsonString(Prompt.Prompt))
const encodeHistoryJson = Schema.encodeUnknownEffect(Schema.fromJsonString(Prompt.Prompt))

// =============================================================================
// Constructors
// =============================================================================

/**
 * Creates a new Chat service with empty conversation history.
 *
 * This is the most common way to start a fresh chat session without
 * any initial context or system prompts.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Chat } from "effect/unstable/ai"
 *
 * const freshChat = Effect.gen(function* () {
 *   const chat = yield* Chat.empty
 *
 *   const response = yield* chat.generateText({
 *     prompt: "Hello! Can you introduce yourself?"
 *   })
 *
 *   console.log(response.content)
 *
 *   return chat
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const empty: Effect.Effect<Service> = Effect.gen(function*() {
  const history = yield* Ref.make(Prompt.empty)
  const services = yield* Effect.services<never>()
  const semaphore = yield* Effect.makeSemaphore(1)

  const provideContext = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.updateServices(effect, (existing) => ServiceMap.merge(services, existing))
  const provideContextStream = <A, E, R>(stream: Stream.Stream<A, E, R>): Stream.Stream<A, E, R> =>
    Stream.updateServices(stream, (existing) => ServiceMap.merge(services, existing))

  return Chat.of({
    history,
    export: Ref.get(history).pipe(
      Effect.flatMap(encodeHistory),
      Effect.catchTag("SchemaError", (error) =>
        Effect.fail(AiError.MalformedOutput.fromSchemaError({
          module: "Chat",
          method: "exportJson",
          description: "Failed to encode chat history",
          error
        }))),
      Effect.withSpan("Chat.export")
    ),
    exportJson: Ref.get(history).pipe(
      Effect.flatMap(encodeHistoryJson),
      Effect.catchTag("SchemaError", (error) =>
        Effect.fail(AiError.MalformedOutput.fromSchemaError({
          module: "Chat",
          method: "exportJson",
          description: "Failed to encode chat history into JSON",
          error
        }))),
      Effect.withSpan("Chat.exportJson")
    ),
    generateText: Effect.fnUntraced(
      function*(options) {
        const newPrompt = Prompt.make(options.prompt)
        const oldPrompt = yield* Ref.get(history)
        const prompt = Prompt.concat(oldPrompt, newPrompt)

        const response = yield* LanguageModel.generateText({ ...options, prompt })

        const newHistory = Prompt.concat(prompt, Prompt.fromResponseParts(response.content))
        yield* Ref.set(history, newHistory)

        return response
      },
      provideContext,
      semaphore.withPermits(1),
      (effect) => Effect.withSpan(effect, "Chat.generateText", { captureStackTrace: false })
    ),
    streamText: Effect.fnUntraced(
      function*(options) {
        let combined: Prompt.Prompt = Prompt.empty
        return Stream.fromChannel(Channel.acquireUseRelease(
          semaphore.take(1).pipe(
            Effect.flatMap(() => Ref.get(history)),
            Effect.map((history) => Prompt.concat(history, Prompt.make(options.prompt)))
          ),
          (prompt) =>
            LanguageModel.streamText({ ...options, prompt }).pipe(
              Stream.mapArrayEffect(Effect.fnUntraced(function*(parts) {
                combined = Prompt.concat(combined, Prompt.fromResponseParts(parts))
                return parts
              })),
              Stream.toChannel
            ),
          (parts) =>
            Ref.set(history, Prompt.concat(parts, combined)).pipe(
              Effect.flatMap(() => semaphore.release(1))
            )
        )).pipe(
          provideContextStream,
          Stream.withSpan("Chat.streamText", {
            captureStackTrace: false
          })
        )
      },
      Stream.unwrap
    ),
    generateObject: Effect.fnUntraced(
      function*(options) {
        const newPrompt = Prompt.make(options.prompt)
        const oldPrompt = yield* Ref.get(history)
        const prompt = Prompt.concat(oldPrompt, newPrompt)

        const response = yield* LanguageModel.generateObject({ ...options, prompt })

        const newHistory = Prompt.concat(prompt, Prompt.fromResponseParts(response.content))
        yield* Ref.set(history, newHistory)

        return response
      },
      provideContext,
      semaphore.withPermits(1),
      (effect, options) =>
        Effect.withSpan(effect, "Chat.generateObject", {
          attributes: {
            objectName: LanguageModel.getObjectName(options.objectName, options.schema)
          },
          captureStackTrace: false
        })
    )
  })
})

/**
 * Creates a new Chat service from an initial prompt.
 *
 * This is the primary constructor for creating chat instances. It initializes
 * a new conversation with the provided prompt as the starting context.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Chat, Prompt } from "effect/unstable/ai"
 *
 * const chatWithSystemPrompt = Effect.gen(function* () {
 *   const chat = yield* Chat.fromPrompt([{
 *     role: "system",
 *     content: "You are a helpful assistant specialized in mathematics."
 *   }])
 *
 *   const response = yield* chat.generateText({
 *     prompt: "What is 2+2?"
 *   })
 *
 *   return response.content
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Chat, Prompt } from "effect/unstable/ai"
 *
 * // Initialize with conversation history
 * const existingChat = Effect.gen(function* () {
 *   const chat = yield* Chat.fromPrompt([
 *     { role: "user", content: [{ type: "text", text: "What's the weather like?" }] },
 *     { role: "assistant", content: [{ type: "text", text: "I don't have access to weather data." }] },
 *     { role: "user", content: [{ type: "text", text: "Can you help me with coding?" }] }
 *   ])
 *
 *   const response = yield* chat.generateText({
 *     prompt: "I need help with TypeScript"
 *   })
 *
 *   return response
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromPrompt = Effect.fnUntraced(
  function*(prompt: Prompt.RawInput) {
    const chat = yield* empty
    yield* Ref.set(chat.history, Prompt.make(prompt))
    return chat
  }
)

/**
 * Creates a Chat service from previously exported chat data.
 *
 * Restores a chat session from structured data that was previously exported
 * using the `export` method. Useful for persisting and restoring conversation
 * state.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Chat } from "effect/unstable/ai"
 *
 * declare const loadFromDatabase: (sessionId: string) => Effect.Effect<unknown>
 *
 * const restoreChat = Effect.gen(function* () {
 *   // Assume we have previously exported data
 *   const savedData = yield* loadFromDatabase("chat-session-123")
 *
 *   const restoredChat = yield* Chat.fromExport(savedData)
 *
 *   // Continue the conversation from where it left off
 *   const response = yield* restoredChat.generateText({
 *     prompt: "Let's continue our discussion"
 *   })
 * }).pipe(
 *   Effect.catchTag("SchemaError", (error) => {
 *     console.log("Failed to restore chat:", error.message)
 *     return Effect.void
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromExport = (data: unknown): Effect.Effect<
  Service,
  Schema.SchemaError,
  LanguageModel.LanguageModel
> => Effect.flatMap(decodeHistory(data), fromPrompt)

/**
 * Creates a Chat service from previously exported JSON chat data.
 *
 * Restores a chat session from JSON string that was previously exported
 * using the `exportJson` method. This is the most convenient way to
 * persist and restore chat sessions to/from storage systems.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Chat } from "effect/unstable/ai"
 *
 * const restoreFromJson = Effect.gen(function* () {
 *   // Load JSON from localStorage or file system
 *   const jsonData = localStorage.getItem("my-chat-backup")
 *   if (!jsonData) return yield* Chat.empty
 *
 *   const restoredChat = yield* Chat.fromJson(jsonData)
 *
 *   // Chat history is now restored
 *   const response = yield* restoredChat.generateText({
 *     prompt: "What were we talking about?"
 *   })
 *
 *   return response
 * }).pipe(
 *   Effect.catchTag("SchemaError", (error) => {
 *     console.log("Invalid JSON format:", error.message)
 *     return Chat.empty // Fallback to empty chat
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromJson = (data: string): Effect.Effect<
  Service,
  Schema.SchemaError,
  LanguageModel.LanguageModel
> => Effect.flatMap(decodeHistoryJson(data), fromPrompt)

// =============================================================================
// Chat Persistence
// =============================================================================

/**
 * An error that occurs when attempting to retrieve a persisted `Chat` that
 * does not exist in the backing persistence store.
 *
 * @since 4.0.0
 * @category errors
 */
export class ChatNotFoundError extends Schema.ErrorClass<ChatNotFoundError>(
  "effect/ai/Chat/ChatNotFoundError"
)({
  _tag: Schema.tag("ChatNotFoundError"),
  chatId: Schema.String
}) {}

/**
 * The context tag for chat persistence.
 *
 * @since 4.0.0
 * @category services
 */
// @effect-diagnostics effect/leakingRequirements:off
export class Persistence extends ServiceMap.Key<Persistence, Persistence.Service>()(
  "effect/ai/Chat/Persisted"
) {}

/**
 * @since 4.0.0
 * @category models
 */
export declare namespace Persistence {
  /**
   * Represents the backing persistence for a persisted `Chat`. Allows for
   * creating and retrieving chats that have been saved to a persistence store.
   *
   * @since 4.0.0
   * @category models
   */
  export interface Service {
    /**
     * Attempts to retrieve the persisted chat from the backing persistence
     * store with the specified chat identifer. If the chat does not exist in
     * the persistence store, a `ChatNotFoundError` will be returned.
     */
    readonly get: (chatId: string, options?: {
      readonly timeToLive?: Duration.DurationInput | undefined
    }) => Effect.Effect<Persisted, ChatNotFoundError | PersistenceError>

    /**
     * Attempts to retrieve the persisted chat from the backing persistence
     * store with the specified chat identifer. If the chat does not exist in
     * the persistence store, an empty chat will be created, saved, and
     * returned.
     */
    readonly getOrCreate: (chatId: string, options?: {
      readonly timeToLive?: Duration.DurationInput | undefined
    }) => Effect.Effect<Persisted, AiError.MalformedOutput | PersistenceError>
  }
}

/**
 * Represents a `Chat` that is backed by persistence.
 *
 * When calling a text generation method (e.g. `generateText`), the previous
 * chat history as well as the relevent response parts will be saved to the
 * backing persistence store.
 *
 * @since 4.0.0
 * @category models
 */
export interface Persisted extends Service {
  /**
   * The identifier for the chat in the backing persistence store.
   */
  readonly id: string

  /**
   * Saves the current chat history into the backing persistence store.
   */
  readonly save: Effect.Effect<void, AiError.MalformedOutput | PersistenceError>
}

/**
 * Creates a new chat persistence service.
 *
 * The provided store identifier will be used to indicate which "store" the
 * backing persistence should load chats from.
 *
 * @since 4.0.0
 * @category constructors
 */
export const makePersisted = Effect.fnUntraced(function*(options: {
  readonly storeId: string
}) {
  const persistence = yield* BackingPersistence
  const store = yield* persistence.make(options.storeId)

  const toPersisted = Effect.fnUntraced(
    function*(chatId: string, chat: Service, ttl: Duration.DurationInput | undefined) {
      const idGenerator = yield* Effect.serviceOption(IdGenerator.IdGenerator).pipe(
        Effect.map(Option.getOrElse(() => IdGenerator.defaultIdGenerator))
      )

      const saveChat = Effect.fnUntraced(
        function*(prevHistory: Prompt.Prompt) {
          // Get the current chat history
          const history = yield* Ref.get(chat.history)
          // Get the most recent message stored in the previous chat history
          const lastMessage = prevHistory.content[prevHistory.content.length - 1]
          // Determine the correct message identifier to use:
          let messageId: string | undefined = undefined
          // If the most recent message in the chat history is an assistant message,
          // use the message identifer stored in that message
          if (Predicate.isNotUndefined(lastMessage) && lastMessage.role === "assistant") {
            messageId = (lastMessage.options[Persistence.key] as any)?.messageId
          }
          // If the chat history is empty or a message identifier did not exist on
          // the most recent message in the chat history, generate a new identifier
          if (Predicate.isUndefined(messageId)) {
            messageId = yield* idGenerator.generateId()
          }
          // Mutate the new messages to add the generated message identifier
          for (let i = prevHistory.content.length; i < history.content.length; i++) {
            const message = history.content[i]
            ;(message.options as any)[Persistence.key] = { messageId }
          }
          // Save the mutated history back to the ref
          yield* Ref.set(chat.history, history)
          // Export the chat history
          const exported = yield* Effect.orDie(chat.export)
          const timeToLive = Predicate.isNotUndefined(ttl) ? Duration.fromDurationInput(ttl) : undefined
          // Save the chat to the backing store
          yield* store.set(chatId, exported as object, timeToLive)
        }
      )

      const persisted: Persisted = {
        ...chat,
        id: chatId,
        save: Effect.flatMap(Ref.get(chat.history), saveChat),
        generateText: Effect.fnUntraced(function*(options) {
          const history = yield* Ref.get(chat.history)
          return yield* chat.generateText(options).pipe(
            Effect.ensuring(Effect.orDie(saveChat(history)))
          )
        }),
        generateObject: Effect.fnUntraced(function*(options) {
          const history = yield* Ref.get(chat.history)
          return yield* chat.generateObject(options).pipe(
            Effect.ensuring(Effect.orDie(saveChat(history)))
          )
        }),
        streamText: Effect.fnUntraced(function*(options) {
          const history = yield* Ref.get(chat.history)
          const stream = chat.streamText(options).pipe(
            Stream.ensuring(Effect.orDie(saveChat(history)))
          )
          return stream
        }, Stream.unwrap)
      }

      return persisted
    }
  )

  const createChat = Effect.fnUntraced(
    function*(chatId: string, ttl: Duration.DurationInput | undefined) {
      // Create an empty chat
      const chat = yield* empty
      // Export the chat history
      const history = yield* Effect.orDie(chat.export)
      // Save the history for the newly created chat
      const timeToLive = Predicate.isNotUndefined(ttl) ? Duration.fromDurationInput(ttl) : undefined
      yield* store.set(chatId, history as object, timeToLive)
      // Convert the chat to a persisted chat
      return yield* toPersisted(chatId, chat, ttl)
    }
  )

  const getChat = Effect.fnUntraced(
    function*(chatId: string, ttl: Duration.DurationInput | undefined) {
      // Create an empty chat
      const chat = yield* empty
      // Attempt to retrieve the previous history from the store
      const previousHistory = yield* store.get(chatId)
      // If the previous history was not found, raise an error
      if (Predicate.isUndefined(previousHistory)) {
        return yield* new ChatNotFoundError({ chatId })
      }
      // Decode the encoded previous history
      const history = yield* decodeHistory(previousHistory)
      // Hydrate the chat history
      yield* Ref.set(chat.history, history)
      // Convert the chat to a persisted chat
      return yield* toPersisted(chatId, chat, ttl)
    },
    Effect.catchTag("SchemaError", Effect.die)
  )

  const get = Effect.fnUntraced(
    function*(chatId: string, options?: {
      readonly timeToLive?: Duration.DurationInput | undefined
    }) {
      return yield* getChat(chatId, options?.timeToLive)
    },
    (effect) =>
      Effect.withSpan(effect, "PersistedChat.get", {
        captureStackTrace: false
      })
  )

  const getOrCreate = Effect.fnUntraced(
    function*(chatId: string, options?: {
      readonly timeToLive?: Duration.DurationInput | undefined
    }) {
      return yield* getChat(chatId, options?.timeToLive).pipe(
        Effect.catchTag("ChatNotFoundError", () => createChat(chatId, options?.timeToLive))
      )
    },
    (effect) =>
      Effect.withSpan(effect, "PersistedChat.getOrCreate", {
        captureStackTrace: false
      })
  )

  return Persistence.of({
    get,
    getOrCreate
  })
})

/**
 * Creates a `Layer` new chat persistence service.
 *
 * The provided store identifier will be used to indicate which "store" the
 * backing persistence should load chats from.
 *
 * @since 4.0.0
 * @category constructors
 */
export const layerPersisted = (options: {
  readonly storeId: string
}): Layer.Layer<Persistence, never, BackingPersistence> => Layer.effect(Persistence)(makePersisted(options))
