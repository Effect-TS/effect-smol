import * as Utils from "@effect/openapi-generator/Utils"
import { describe, expect, it } from "vitest"

describe("Utils", () => {
  describe("sanitizeSchemaName", () => {
    it("removes hyphens while preserving casing", () => {
      expect(Utils.sanitizeSchemaName("Conversation-2")).toBe("Conversation2")
      expect(Utils.sanitizeSchemaName("Error-2")).toBe("Error2")
      expect(Utils.sanitizeSchemaName("ConversationParam-2")).toBe("ConversationParam2")
    })

    it("handles multiple hyphens", () => {
      expect(Utils.sanitizeSchemaName("My-Schema-Name")).toBe("MySchemaName")
    })

    it("preserves valid identifiers unchanged", () => {
      expect(Utils.sanitizeSchemaName("ValidName")).toBe("ValidName")
      expect(Utils.sanitizeSchemaName("ValidName123")).toBe("ValidName123")
    })

    it("handles slashes and other special characters", () => {
      expect(Utils.sanitizeSchemaName("hate/threatening")).toBe("HateThreatening")
      expect(Utils.sanitizeSchemaName("self-harm")).toBe("SelfHarm")
    })

    it("handles leading numbers by removing them", () => {
      expect(Utils.sanitizeSchemaName("2Conversation")).toBe("Conversation")
    })

    it("handles single character", () => {
      expect(Utils.sanitizeSchemaName("A")).toBe("A")
      expect(Utils.sanitizeSchemaName("a")).toBe("A")
    })
  })

  describe("camelize", () => {
    it("removes hyphens and capitalizes following letters", () => {
      expect(Utils.camelize("my-operation-id")).toBe("myOperationId")
    })

    it("removes slashes and capitalizes following letters", () => {
      expect(Utils.camelize("my/operation/id")).toBe("myOperationId")
    })

    it("handles numbers", () => {
      expect(Utils.camelize("operation-2")).toBe("operation2")
    })

    it("removes leading numbers", () => {
      expect(Utils.camelize("2operation")).toBe("operation")
    })

    it("handles empty string", () => {
      expect(Utils.camelize("")).toBe("")
    })
  })

  describe("identifier", () => {
    it("capitalizes camelized string", () => {
      expect(Utils.identifier("my-operation")).toBe("MyOperation")
      expect(Utils.identifier("operation-2")).toBe("Operation2")
    })
  })
})
