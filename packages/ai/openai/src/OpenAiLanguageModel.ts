/**
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"
import * as ServiceMap from "effect/ServiceMap"
import type * as Types from "effect/Types"
import type * as LanguageModel from "effect/unstable/ai/LanguageModel"
import * as AiModel from "effect/unstable/ai/Model"
import type * as Generated from "./Generated.ts"
import type { OpenAiClient } from "./OpenAiClient.ts"

/**
 * @since 1.0.0
 * @category Models
 */
export type Model = typeof Generated.ModelIdsResponses.Encoded

// =============================================================================
// Configuration
// =============================================================================

/**
 * @since 1.0.0
 * @category Services
 */
export class Config extends ServiceMap.Service<Config, ConfigShape>()(
  "@effect/ai-openai/OpenAiLanguageModel/Config"
) {
  /**
   * @since 1.0.0
   */
  static readonly getOrUndefined: Effect.Effect<ConfigShape | undefined> = Effect.map(
    Effect.services<never>(),
    (context) => context.mapUnsafe.get(Config.key)
  )
}

/**
 * @since 1.0.0
 * @category Services
 */
export interface ConfigShape extends
  Types.Simplify<
    Partial<
      Omit<
        typeof Generated.CreateResponse.Encoded,
        "input" | "tools" | "tool_choice" | "stream" | "text"
      >
    >
  >
{
  /**
   * File ID prefixes used to identify file IDs in Responses API.
   * When undefined, all file data is treated as base64 content.
   *
   * Examples:
   * - OpenAI: ['file-'] for IDs like 'file-abc123'
   * - Azure OpenAI: ['assistant-'] for IDs like 'assistant-abc123'
   */
  readonly fileIdPrefixes?: ReadonlyArray<string>
  /**
   * Configuration options for a text response from the model.
   */
  readonly text?: {
    /**
     * Constrains the verbosity of the model's response. Lower values will
     * result in more concise responses, while higher values will result in
     * more verbose responses.
     *
     * Defaults to `"medium"`.
     */
    readonly verbosity?: "low" | "medium" | "high"
  }
}

// =============================================================================
// OpenAI Provider Options / Metadata
// =============================================================================

declare module "effect/unstable/ai/Prompt" {
  export interface FilePartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.
       */
      readonly imageDetail?:
        | typeof Generated.MessageContentImageFileObject.Encoded["image_file"]["detail"]
        | typeof Generated.MessageContentImageUrlObject.Encoded["image_url"]["detail"]
        | undefined
    } | undefined
  }

  export interface ReasoningPartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The ID of the item to reference.
       */
      readonly itemId?: string | undefined
      /**
       * The encrypted content of the reasoning item - populated when a response
       * is generated with `reasoning.encrypted_content` in the `include`
       * parameter.
       */
      readonly encryptedContent?: string | undefined
    } | undefined
  }

  export interface ToolCallPartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The ID of the item to reference.
       */
      readonly itemId?: string | undefined
    } | undefined
  }

  export interface TextPartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The ID of the item to reference.
       */
      readonly itemId?: string | undefined
    } | undefined
  }
}

declare module "effect/unstable/ai/Response" {
  export interface TextPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | undefined
      /**
       * If the model emits a refusal content part, the refusal explanation
       * from the model will be contained in the metadata of an empty text
       * part.
       */
      readonly refusal?: string | undefined
    } | undefined
  }

  export interface TextStartPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | undefined
    } | undefined
  }

  export interface ReasoningPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | undefined
      readonly encryptedContent?: string | undefined
    } | undefined
  }

  export interface ReasoningStartPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | undefined
      readonly encryptedContent?: string | undefined
    } | undefined
  }

  export interface ReasoningDeltaPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | undefined
    } | undefined
  }

  export interface ReasoningEndPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | undefined
      readonly encryptedContent?: string | undefined
    } | undefined
  }

  export interface ToolCallPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | undefined
    } | undefined
  }

  export interface DocumentSourcePartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly type: "file_citation"
      /**
       * The index of the file in the list of files.
       */
      readonly index: number
    } | undefined
  }

  export interface UrlSourcePartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly type: "url_citation"
      /**
       * The index of the first character of the URL citation in the message.
       */
      readonly startIndex: number
      /**
       * The index of the last character of the URL citation in the message.
       */
      readonly endIndex: number
    } | undefined
  }

  export interface FinishPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly serviceTier?: "default" | "auto" | "flex" | "scale" | "priority" | undefined
    } | undefined
  }
}

// =============================================================================
// OpenAI Language Model
// =============================================================================

/**
 * @since 1.0.0
 * @category Ai Models
 */
export const model = (
  model: (string & {}) | Model,
  config?: Omit<ConfigShape, "model">
): AiModel.Model<"openai", LanguageModel.LanguageModel, OpenAiClient> =>
  AiModel.make("openai", layer({ model, config }))
