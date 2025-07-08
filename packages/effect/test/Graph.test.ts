import * as Graph from "effect/Graph"
import { describe, expect, it } from "vitest"

describe("Graph", () => {
  describe("TypeId", () => {
    it("should have correct TypeId", () => {
      expect(Graph.TypeId).toBe("~effect/Graph")
    })
  })

  describe("NodeIndex", () => {
    it("should create NodeIndex with correct structure", () => {
      const nodeIndex: Graph.NodeIndex = { _tag: "NodeIndex", value: 42 }
      expect(nodeIndex._tag).toBe("NodeIndex")
      expect(nodeIndex.value).toBe(42)
    })
  })

  describe("EdgeIndex", () => {
    it("should create EdgeIndex with correct structure", () => {
      const edgeIndex: Graph.EdgeIndex = { _tag: "EdgeIndex", value: 123 }
      expect(edgeIndex._tag).toBe("EdgeIndex")
      expect(edgeIndex.value).toBe(123)
    })
  })

  describe("EdgeData", () => {
    it("should create EdgeData with correct structure", () => {
      const source: Graph.NodeIndex = { _tag: "NodeIndex", value: 0 }
      const target: Graph.NodeIndex = { _tag: "NodeIndex", value: 1 }
      const edgeData: Graph.EdgeData<string> = {
        source,
        target,
        data: "test-edge"
      }

      expect(edgeData.source).toBe(source)
      expect(edgeData.target).toBe(target)
      expect(edgeData.data).toBe("test-edge")
    })
  })

  describe("IndexAllocator", () => {
    it("should create IndexAllocator with correct structure", () => {
      const allocator: Graph.IndexAllocator = {
        nextIndex: 5,
        recycled: [1, 3]
      }

      expect(allocator.nextIndex).toBe(5)
      expect(allocator.recycled).toEqual([1, 3])
    })
  })
})
