import * as OpenAiSchema from "@effect/ai-openai-compat/OpenAiSchema"
import { assert, describe, it } from "@effect/vitest"
import * as Schema from "effect/Schema"

describe("OpenAiSchema", () => {
  it("keeps model literal branches at members[1]", () => {
    const decodeSharedLiteral = Schema.decodeUnknownSync(OpenAiSchema.ModelIdsShared.members[1])
    const decodeResponsesLiteral = Schema.decodeUnknownSync(OpenAiSchema.ModelIdsResponses.members[1])

    assert.strictEqual(decodeSharedLiteral("gpt-4o"), "gpt-4o")
    assert.throws(() => decodeSharedLiteral("ft:custom-model"))

    assert.strictEqual(decodeResponsesLiteral("gpt-5-pro"), "gpt-5-pro")
    assert.throws(() => decodeResponsesLiteral("gpt-4o"))
  })

  it("accepts assistant and tool history in CreateResponse.input", () => {
    const encode = Schema.encodeUnknownSync(OpenAiSchema.CreateResponse)

    const encoded = encode({
      model: "gpt-4o",
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: "hello" }]
        },
        {
          id: "msg_1",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "hi" }]
        },
        {
          type: "function_call",
          call_id: "call_1",
          name: "lookup",
          arguments: "{}",
          status: "completed"
        },
        {
          type: "function_call_output",
          call_id: "call_1",
          output: "{\"ok\":true}",
          status: "completed"
        },
        {
          type: "mcp_approval_response",
          approval_request_id: "approval_1",
          approve: true
        },
        {
          type: "item_reference",
          id: "msg_1"
        },
        {
          type: "shell_call",
          call_id: "shell_1",
          action: { commands: ["ls"] },
          status: "completed"
        },
        {
          type: "shell_call_output",
          call_id: "shell_1",
          output: [],
          status: "completed"
        },
        {
          type: "apply_patch_call",
          call_id: "patch_1",
          status: "completed",
          operation: { type: "delete_file", path: "tmp/file.ts" }
        },
        {
          type: "apply_patch_call_output",
          call_id: "patch_1",
          status: "completed",
          output: "deleted"
        },
        {
          type: "local_shell_call",
          id: "local_1",
          call_id: "local_1",
          action: { type: "exec", command: ["pwd"] },
          status: "completed"
        },
        {
          type: "local_shell_call_output",
          id: "local_output_1",
          call_id: "local_1",
          output: "{}",
          status: "completed"
        },
        {
          type: "custom_tool_call",
          call_id: "custom_1",
          name: "my_custom_tool",
          input: "payload"
        },
        {
          type: "custom_tool_call_output",
          call_id: "custom_1",
          output: "ok"
        }
      ]
    })

    assert.strictEqual(encoded.model, "gpt-4o")
    assert.isTrue(Array.isArray(encoded.input))
    if (Array.isArray(encoded.input)) {
      assert.strictEqual(encoded.input.length, 14)
    }
  })

  it("decodes known and unknown stream events", () => {
    const decode = Schema.decodeUnknownSync(OpenAiSchema.ResponseStreamEvent)

    const known = decode({
      type: "response.output_text.delta",
      item_id: "msg_1",
      output_index: 0,
      content_index: 0,
      delta: "hello",
      sequence_number: 1,
      logprobs: []
    })
    const unknown = decode({
      type: "response.future_event",
      foo: "bar"
    })

    assert.strictEqual((known as any).delta, "hello")
    assert.strictEqual((unknown as any).type, "response.future_event")
  })

  it("exposes provider tool fields and accepts permissive tool values", () => {
    assert.isDefined(OpenAiSchema.FunctionTool.fields.parameters)
    assert.isDefined(OpenAiSchema.FileSearchTool.fields.vector_store_ids)
    assert.isDefined(OpenAiSchema.WebSearchTool.fields.search_context_size)
    assert.isDefined(OpenAiSchema.MCPTool.fields.allowed_tools)

    const decode = Schema.decodeUnknownSync(OpenAiSchema.Tool)
    const decoded = decode({
      type: "function",
      name: "get_weather",
      parameters: { type: "object", properties: { city: { type: "string" } } },
      provider_metadata: { anything: true }
    })

    assert.strictEqual((decoded as any).type, "function")
    assert.strictEqual((decoded as any).name, "get_weather")
  })

  it("supports permissive embedding request/response decoding", () => {
    const encodeRequest = Schema.encodeUnknownSync(OpenAiSchema.CreateEmbeddingRequest)
    const decodeResponse = Schema.decodeUnknownSync(OpenAiSchema.CreateEmbeddingResponse)

    const request = encodeRequest({
      model: "my-custom-embedding-model",
      input: ["a", "b"],
      dimensions: 256,
      encoding_format: "float"
    })

    const response = decodeResponse({
      data: [{ embedding: [0.1, 0.2, 0.3], index: 0, object: "embedding", extra: true }],
      model: "my-custom-embedding-model",
      object: "list",
      usage: { prompt_tokens: 3, total_tokens: 3 }
    })

    assert.strictEqual(request.model, "my-custom-embedding-model")
    assert.strictEqual(response.data[0]!.index, 0)
  })

  it("keeps generated-style alias exports wired", () => {
    assert.strictEqual(OpenAiSchema.CreateResponseRequestJson, OpenAiSchema.CreateResponse)
    assert.strictEqual(OpenAiSchema.CreateResponse200, OpenAiSchema.Response)
    assert.strictEqual(OpenAiSchema.CreateResponse200Sse, OpenAiSchema.ResponseStreamEvent)
    assert.strictEqual(OpenAiSchema.CreateEmbeddingRequestJson, OpenAiSchema.CreateEmbeddingRequest)
    assert.strictEqual(OpenAiSchema.CreateEmbedding200, OpenAiSchema.CreateEmbeddingResponse)
  })
})
