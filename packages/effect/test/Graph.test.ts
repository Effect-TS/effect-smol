import * as Equal from "effect/Equal"
import * as Graph from "effect/Graph"
import * as MutableHashMap from "effect/MutableHashMap"
import * as Option from "effect/Option"
import { describe, expect, it } from "vitest"

describe("Graph", () => {
  describe("TypeId", () => {
    it("should have correct TypeId", () => {
      expect(Graph.TypeId).toBe("~effect/Graph")
    })
  })

  describe("NodeIndex type", () => {
    it("should be a branded number type", () => {
      const nodeIndex = Graph.makeNodeIndex(42)
      expect(typeof nodeIndex).toBe("number")
      expect(nodeIndex).toBe(42)
    })
  })

  describe("EdgeIndex type", () => {
    it("should be a branded number type", () => {
      const edgeIndex = Graph.makeEdgeIndex(123)
      expect(typeof edgeIndex).toBe("number")
      expect(edgeIndex).toBe(123)
    })
  })

  describe("EdgeData", () => {
    it("should create EdgeData with correct structure", () => {
      const source = Graph.makeNodeIndex(0)
      const target = Graph.makeNodeIndex(1)
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

  describe("makeNodeIndex", () => {
    it("should create NodeIndex with correct value", () => {
      const nodeIndex = Graph.makeNodeIndex(42)

      expect(typeof nodeIndex).toBe("number")
      expect(nodeIndex).toBe(42)
    })

    it("should create different NodeIndex instances for different values", () => {
      const nodeIndex1 = Graph.makeNodeIndex(0)
      const nodeIndex2 = Graph.makeNodeIndex(100)

      expect(nodeIndex1).toBe(0)
      expect(nodeIndex2).toBe(100)
      expect(nodeIndex1).not.toBe(nodeIndex2)
    })

    it("should handle negative values", () => {
      const nodeIndex = Graph.makeNodeIndex(-1)

      expect(typeof nodeIndex).toBe("number")
      expect(nodeIndex).toBe(-1)
    })

    it("should support structural equality", () => {
      const nodeIndex1 = Graph.makeNodeIndex(42)
      const nodeIndex2 = Graph.makeNodeIndex(42)
      const nodeIndex3 = Graph.makeNodeIndex(43)

      expect(Equal.equals(nodeIndex1, nodeIndex2)).toBe(true)
      expect(Equal.equals(nodeIndex1, nodeIndex3)).toBe(false)
    })

    it("should work as hash map keys", () => {
      const map = MutableHashMap.empty<Graph.NodeIndex, string>()
      const nodeIndex1 = Graph.makeNodeIndex(42)
      const nodeIndex2 = Graph.makeNodeIndex(42) // Same value, different instance

      MutableHashMap.set(map, nodeIndex1, "first")
      MutableHashMap.set(map, nodeIndex2, "second") // Should overwrite due to structural equality

      expect(MutableHashMap.size(map)).toBe(1)

      const result1 = MutableHashMap.get(map, nodeIndex1)
      const result2 = MutableHashMap.get(map, nodeIndex2)

      expect(Option.isSome(result1)).toBe(true)
      expect(Option.isSome(result2)).toBe(true)

      if (Option.isSome(result1) && Option.isSome(result2)) {
        expect(result1.value).toBe("second")
        expect(result2.value).toBe("second")
      }
    })
  })

  describe("makeEdgeIndex", () => {
    it("should create EdgeIndex with correct value", () => {
      const edgeIndex = Graph.makeEdgeIndex(123)

      expect(typeof edgeIndex).toBe("number")
      expect(edgeIndex).toBe(123)
    })

    it("should create different EdgeIndex instances for different values", () => {
      const edgeIndex1 = Graph.makeEdgeIndex(0)
      const edgeIndex2 = Graph.makeEdgeIndex(999)

      expect(edgeIndex1).toBe(0)
      expect(edgeIndex2).toBe(999)
      expect(edgeIndex1).not.toBe(edgeIndex2)
    })

    it("should handle negative values", () => {
      const edgeIndex = Graph.makeEdgeIndex(-5)

      expect(typeof edgeIndex).toBe("number")
      expect(edgeIndex).toBe(-5)
    })

    it("should support structural equality", () => {
      const edgeIndex1 = Graph.makeEdgeIndex(123)
      const edgeIndex2 = Graph.makeEdgeIndex(123)
      const edgeIndex3 = Graph.makeEdgeIndex(124)

      expect(Equal.equals(edgeIndex1, edgeIndex2)).toBe(true)
      expect(Equal.equals(edgeIndex1, edgeIndex3)).toBe(false)
    })

    it("should work as hash map keys", () => {
      const map = MutableHashMap.empty<Graph.EdgeIndex, string>()
      const edgeIndex1 = Graph.makeEdgeIndex(123)
      const edgeIndex2 = Graph.makeEdgeIndex(123) // Same value, different instance

      MutableHashMap.set(map, edgeIndex1, "first")
      MutableHashMap.set(map, edgeIndex2, "second") // Should overwrite due to structural equality

      expect(MutableHashMap.size(map)).toBe(1)

      const result1 = MutableHashMap.get(map, edgeIndex1)
      const result2 = MutableHashMap.get(map, edgeIndex2)

      expect(Option.isSome(result1)).toBe(true)
      expect(Option.isSome(result2)).toBe(true)

      if (Option.isSome(result1) && Option.isSome(result2)) {
        expect(result1.value).toBe("second")
        expect(result2.value).toBe("second")
      }
    })
  })

  describe("empty", () => {
    it("should create an empty graph with correct TypeId", () => {
      const graph = Graph.empty<string, number>()

      expect(graph[Graph.TypeId]).toBe("~effect/Graph")
    })

    it("should create an empty graph with zero nodes and edges", () => {
      const graph = Graph.empty<string, number>()

      expect(graph.data.nodeCount).toBe(0)
      expect(graph.data.edgeCount).toBe(0)
    })

    it("should create an empty graph with correct type", () => {
      const graph = Graph.empty<string, number>()

      expect(graph.type._tag).toBe("Directed")
    })

    it("should create an empty graph with correct mutable marker", () => {
      const graph = Graph.empty<string, number>()

      expect(graph._mutable).toBe(false)
    })

    it("should create an empty graph with initialized data structures", () => {
      const graph = Graph.empty<string, number>()

      expect(graph.data.nextNodeIndex).toBe(0)
      expect(graph.data.nextEdgeIndex).toBe(0)
      expect(graph.data.nodeAllocator.nextIndex).toBe(0)
      expect(graph.data.edgeAllocator.nextIndex).toBe(0)
      expect(graph.data.nodeAllocator.recycled).toEqual([])
      expect(graph.data.edgeAllocator.recycled).toEqual([])
    })

    it("should create an empty graph that is iterable", () => {
      const graph = Graph.empty<string, number>()
      const nodes = Array.from(graph)

      expect(nodes).toEqual([])
    })

    it("should create graphs with different type parameters", () => {
      const stringNumberGraph = Graph.empty<string, number>()
      const booleanStringGraph = Graph.empty<boolean, string>()

      expect(stringNumberGraph[Graph.TypeId]).toBe("~effect/Graph")
      expect(booleanStringGraph[Graph.TypeId]).toBe("~effect/Graph")
    })
  })
})
