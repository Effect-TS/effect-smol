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

  describe("beginMutation", () => {
    it("should create a mutable graph from an immutable graph", () => {
      const graph = Graph.empty<string, number>()
      const mutable = Graph.beginMutation(graph)

      expect(mutable[Graph.TypeId]).toBe("~effect/Graph")
      expect(mutable._mutable).toBe(true)
      expect(mutable.type._tag).toBe("Directed")
    })

    it("should copy all data structures properly", () => {
      const graph = Graph.empty<string, number>()
      const mutable = Graph.beginMutation(graph)

      expect(mutable.data.nodeCount).toBe(graph.data.nodeCount)
      expect(mutable.data.edgeCount).toBe(graph.data.edgeCount)
      expect(mutable.data.nextNodeIndex).toBe(graph.data.nextNodeIndex)
      expect(mutable.data.nextEdgeIndex).toBe(graph.data.nextEdgeIndex)
      expect(mutable.data.nodeAllocator.nextIndex).toBe(graph.data.nodeAllocator.nextIndex)
      expect(mutable.data.edgeAllocator.nextIndex).toBe(graph.data.edgeAllocator.nextIndex)
    })

    it("should create independent copies of mutable data structures", () => {
      const graph = Graph.empty<string, number>()
      const mutable = Graph.beginMutation(graph)

      // Verify that the data structures are different instances
      expect(mutable.data.nodes).not.toBe(graph.data.nodes)
      expect(mutable.data.edges).not.toBe(graph.data.edges)
      expect(mutable.data.adjacency).not.toBe(graph.data.adjacency)
      expect(mutable.data.reverseAdjacency).not.toBe(graph.data.reverseAdjacency)
    })

    it("should deep copy allocator recycled arrays", () => {
      const graph = Graph.empty<string, number>()
      const mutable = Graph.beginMutation(graph)

      expect(mutable.data.nodeAllocator.recycled).not.toBe(graph.data.nodeAllocator.recycled)
      expect(mutable.data.edgeAllocator.recycled).not.toBe(graph.data.edgeAllocator.recycled)
      expect(mutable.data.nodeAllocator.recycled).toEqual(graph.data.nodeAllocator.recycled)
      expect(mutable.data.edgeAllocator.recycled).toEqual(graph.data.edgeAllocator.recycled)
    })
  })

  describe("endMutation", () => {
    it("should convert a mutable graph back to immutable", () => {
      const graph = Graph.empty<string, number>()
      const mutable = Graph.beginMutation(graph)
      const result = Graph.endMutation(mutable)

      expect(result[Graph.TypeId]).toBe("~effect/Graph")
      expect(result._mutable).toBe(false)
      expect(result.type._tag).toBe("Directed")
    })

    it("should preserve all data from mutable graph", () => {
      const graph = Graph.empty<string, number>()
      const mutable = Graph.beginMutation(graph)
      const result = Graph.endMutation(mutable)

      expect(result.data.nodeCount).toBe(mutable.data.nodeCount)
      expect(result.data.edgeCount).toBe(mutable.data.edgeCount)
      expect(result.data.nextNodeIndex).toBe(mutable.data.nextNodeIndex)
      expect(result.data.nextEdgeIndex).toBe(mutable.data.nextEdgeIndex)
    })

    it("should use the same internal data structures", () => {
      const graph = Graph.empty<string, number>()
      const mutable = Graph.beginMutation(graph)
      const result = Graph.endMutation(mutable)

      expect(result.data).toBe(mutable.data)
    })
  })

  describe("mutate", () => {
    it("should perform scoped mutations with dual interface (curried)", () => {
      const graph = Graph.empty<string, number>()
      const mutationFn = (mutable: Graph.MutableGraph<string, number>) => {
        // We can't add nodes yet, but we can verify the function is called
        expect(mutable._mutable).toBe(true)
        expect(mutable[Graph.TypeId]).toBe("~effect/Graph")
      }

      const result = Graph.mutate(mutationFn)(graph)
      expect(result._mutable).toBe(false)
    })

    it("should perform scoped mutations with dual interface (data-last)", () => {
      const graph = Graph.empty<string, number>()
      const mutationFn = (mutable: Graph.MutableGraph<string, number>) => {
        expect(mutable._mutable).toBe(true)
        expect(mutable[Graph.TypeId]).toBe("~effect/Graph")
      }

      const result = Graph.mutate(graph, mutationFn)
      expect(result._mutable).toBe(false)
    })

    it("should isolate mutations from original graph", () => {
      const graph = Graph.empty<string, number>()

      const result = Graph.mutate(graph, (mutable) => {
        // Verify isolation - mutation scope should not affect original
        expect(mutable.data.nodes).not.toBe(graph.data.nodes)
        expect(mutable.data.edges).not.toBe(graph.data.edges)
      })

      expect(result._mutable).toBe(false)
      expect(graph._mutable).toBe(false)
    })

    it("should create a new graph instance", () => {
      const graph = Graph.empty<string, number>()

      const result = Graph.mutate(graph, () => {
        // No mutations performed
      })

      expect(result).not.toBe(graph)
      expect(Equal.equals(result, graph)).toBe(true) // Structural equality
    })

    it("should handle empty mutation function", () => {
      const graph = Graph.empty<string, number>()

      const result = Graph.mutate(graph, () => {
        // Do nothing
      })

      expect(result._mutable).toBe(false)
      expect(result.data.nodeCount).toBe(0)
      expect(result.data.edgeCount).toBe(0)
    })
  })

  describe("addNode", () => {
    it("should add a node to a mutable graph and return its index", () => {
      const graph = Graph.empty<string, number>()
      let nodeIndex: Graph.NodeIndex

      const result = Graph.mutate(graph, (mutable) => {
        nodeIndex = Graph.addNode(mutable, "Node A")
      })

      expect(nodeIndex!).toBe(0)
      expect(result.data.nodeCount).toBe(1)
    })

    it("should add multiple nodes with sequential indices", () => {
      const graph = Graph.empty<string, number>()
      let nodeA: Graph.NodeIndex
      let nodeB: Graph.NodeIndex
      let nodeC: Graph.NodeIndex

      const result = Graph.mutate(graph, (mutable) => {
        nodeA = Graph.addNode(mutable, "Node A")
        nodeB = Graph.addNode(mutable, "Node B")
        nodeC = Graph.addNode(mutable, "Node C")
      })

      expect(nodeA!).toBe(0)
      expect(nodeB!).toBe(1)
      expect(nodeC!).toBe(2)
      expect(result.data.nodeCount).toBe(3)
    })

    it("should initialize adjacency lists for new nodes", () => {
      const graph = Graph.empty<string, number>()

      const result = Graph.mutate(graph, (mutable) => {
        const nodeIndex = Graph.addNode(mutable, "Node A")

        // Check adjacency lists are initialized
        const adjacencyList = MutableHashMap.get(mutable.data.adjacency, nodeIndex)
        const reverseAdjacencyList = MutableHashMap.get(mutable.data.reverseAdjacency, nodeIndex)

        expect(Option.isSome(adjacencyList)).toBe(true)
        expect(Option.isSome(reverseAdjacencyList)).toBe(true)

        if (Option.isSome(adjacencyList) && Option.isSome(reverseAdjacencyList)) {
          expect(adjacencyList.value).toEqual([])
          expect(reverseAdjacencyList.value).toEqual([])
        }
      })

      expect(result.data.nodeCount).toBe(1)
    })

    it("should update nextNodeIndex correctly", () => {
      const graph = Graph.empty<string, number>()

      const result = Graph.mutate(graph, (mutable) => {
        expect(mutable.data.nextNodeIndex).toBe(0)
        Graph.addNode(mutable, "Node A")
        expect(mutable.data.nextNodeIndex).toBe(1)
        Graph.addNode(mutable, "Node B")
        expect(mutable.data.nextNodeIndex).toBe(2)
      })

      expect(result.data.nextNodeIndex).toBe(2)
    })

    it("should handle different data types", () => {
      const graph = Graph.empty<{ name: string; value: number }, string>()

      const result = Graph.mutate(graph, (mutable) => {
        const nodeA = Graph.addNode(mutable, { name: "Alice", value: 42 })
        const nodeB = Graph.addNode(mutable, { name: "Bob", value: 100 })

        expect(nodeA).toBe(0)
        expect(nodeB).toBe(1)
      })

      expect(result.data.nodeCount).toBe(2)
    })
  })

  describe("getNode", () => {
    it("should return the node data for existing nodes", () => {
      const graph = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
      })

      const nodeA = Graph.getNode(graph, Graph.makeNodeIndex(0))
      const nodeB = Graph.getNode(graph, Graph.makeNodeIndex(1))

      expect(Option.isSome(nodeA)).toBe(true)
      expect(Option.isSome(nodeB)).toBe(true)

      if (Option.isSome(nodeA) && Option.isSome(nodeB)) {
        expect(nodeA.value).toBe("Node A")
        expect(nodeB.value).toBe("Node B")
      }
    })

    it("should return None for non-existent nodes", () => {
      const graph = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A")
      })

      const nonExistent = Graph.getNode(graph, Graph.makeNodeIndex(999))
      expect(Option.isNone(nonExistent)).toBe(true)
    })

    it("should work on both Graph and MutableGraph", () => {
      const graph = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A")
      })

      // Test on immutable graph
      const nodeFromGraph = Graph.getNode(graph, Graph.makeNodeIndex(0))
      expect(Option.isSome(nodeFromGraph)).toBe(true)

      // Test on mutable graph
      Graph.mutate(graph, (mutable) => {
        const nodeFromMutable = Graph.getNode(mutable, Graph.makeNodeIndex(0))
        expect(Option.isSome(nodeFromMutable)).toBe(true)

        if (Option.isSome(nodeFromGraph) && Option.isSome(nodeFromMutable)) {
          expect(nodeFromGraph.value).toBe(nodeFromMutable.value)
        }
      })
    })

    it("should handle empty graph", () => {
      const graph = Graph.empty<string, number>()
      const result = Graph.getNode(graph, Graph.makeNodeIndex(0))
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe("hasNode", () => {
    it("should return true for existing nodes", () => {
      const graph = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
      })

      expect(Graph.hasNode(graph, Graph.makeNodeIndex(0))).toBe(true)
      expect(Graph.hasNode(graph, Graph.makeNodeIndex(1))).toBe(true)
    })

    it("should return false for non-existent nodes", () => {
      const graph = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A")
      })

      expect(Graph.hasNode(graph, Graph.makeNodeIndex(999))).toBe(false)
      expect(Graph.hasNode(graph, Graph.makeNodeIndex(-1))).toBe(false)
    })

    it("should work on both Graph and MutableGraph", () => {
      const graph = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A")
      })

      // Test on immutable graph
      expect(Graph.hasNode(graph, Graph.makeNodeIndex(0))).toBe(true)

      // Test on mutable graph
      Graph.mutate(graph, (mutable) => {
        expect(Graph.hasNode(mutable, Graph.makeNodeIndex(0))).toBe(true)
        expect(Graph.hasNode(mutable, Graph.makeNodeIndex(999))).toBe(false)
      })
    })

    it("should handle empty graph", () => {
      const graph = Graph.empty<string, number>()
      expect(Graph.hasNode(graph, Graph.makeNodeIndex(0))).toBe(false)
    })
  })

  describe("nodeCount", () => {
    it("should return 0 for empty graph", () => {
      const graph = Graph.empty<string, number>()
      expect(Graph.nodeCount(graph)).toBe(0)
    })

    it("should return correct count after adding nodes", () => {
      const graph = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
        expect(Graph.nodeCount(mutable)).toBe(0)
        Graph.addNode(mutable, "Node A")
        expect(Graph.nodeCount(mutable)).toBe(1)
        Graph.addNode(mutable, "Node B")
        expect(Graph.nodeCount(mutable)).toBe(2)
        Graph.addNode(mutable, "Node C")
        expect(Graph.nodeCount(mutable)).toBe(3)
      })

      expect(Graph.nodeCount(graph)).toBe(3)
    })

    it("should work on both Graph and MutableGraph", () => {
      const graph = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
      })

      expect(Graph.nodeCount(graph)).toBe(2)

      Graph.mutate(graph, (mutable) => {
        expect(Graph.nodeCount(mutable)).toBe(2)
        Graph.addNode(mutable, "Node C")
        expect(Graph.nodeCount(mutable)).toBe(3)
      })
    })

    it("should be consistent with data.nodeCount", () => {
      const graph = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
        Graph.addNode(mutable, "Node C")
      })

      expect(Graph.nodeCount(graph)).toBe(graph.data.nodeCount)
      expect(Graph.nodeCount(graph)).toBe(3)
    })
  })
})
