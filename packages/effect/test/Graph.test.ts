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
    it("should be plain numbers", () => {
      const nodeIndex = 42
      expect(typeof nodeIndex).toBe("number")
      expect(nodeIndex).toBe(42)
    })
  })

  describe("EdgeIndex type", () => {
    it("should be plain numbers", () => {
      const edgeIndex = 123
      expect(typeof edgeIndex).toBe("number")
      expect(edgeIndex).toBe(123)
    })
  })

  describe("EdgeData", () => {
    it("should create EdgeData with correct structure", () => {
      const source = 0
      const target = 1
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

  describe("NodeIndex type", () => {
    it("should be plain numbers", () => {
      const nodeIndex = 42

      expect(typeof nodeIndex).toBe("number")
      expect(nodeIndex).toBe(42)
    })

    it("should handle different values", () => {
      const nodeIndex1 = 0
      const nodeIndex2 = 100

      expect(nodeIndex1).toBe(0)
      expect(nodeIndex2).toBe(100)
      expect(nodeIndex1).not.toBe(nodeIndex2)
    })

    it("should handle negative values", () => {
      const nodeIndex = -1

      expect(typeof nodeIndex).toBe("number")
      expect(nodeIndex).toBe(-1)
    })

    it("should support structural equality", () => {
      const nodeIndex1 = 42
      const nodeIndex2 = 42
      const nodeIndex3 = 43

      expect(Equal.equals(nodeIndex1, nodeIndex2)).toBe(true)
      expect(Equal.equals(nodeIndex1, nodeIndex3)).toBe(false)
    })

    it("should work as hash map keys", () => {
      const map = MutableHashMap.empty<Graph.NodeIndex, string>()
      const nodeIndex1 = 42
      const nodeIndex2 = 42 // Same value

      MutableHashMap.set(map, nodeIndex1, "first")
      MutableHashMap.set(map, nodeIndex2, "second") // Should overwrite

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

  describe("EdgeIndex type", () => {
    it("should be plain numbers", () => {
      const edgeIndex = 123

      expect(typeof edgeIndex).toBe("number")
      expect(edgeIndex).toBe(123)
    })

    it("should handle different values", () => {
      const edgeIndex1 = 0
      const edgeIndex2 = 999

      expect(edgeIndex1).toBe(0)
      expect(edgeIndex2).toBe(999)
      expect(edgeIndex1).not.toBe(edgeIndex2)
    })

    it("should handle negative values", () => {
      const edgeIndex = -5

      expect(typeof edgeIndex).toBe("number")
      expect(edgeIndex).toBe(-5)
    })

    it("should support structural equality", () => {
      const edgeIndex1 = 123
      const edgeIndex2 = 123
      const edgeIndex3 = 124

      expect(Equal.equals(edgeIndex1, edgeIndex2)).toBe(true)
      expect(Equal.equals(edgeIndex1, edgeIndex3)).toBe(false)
    })

    it("should work as hash map keys", () => {
      const map = MutableHashMap.empty<Graph.EdgeIndex, string>()
      const edgeIndex1 = 123
      const edgeIndex2 = 123 // Same value

      MutableHashMap.set(map, edgeIndex1, "first")
      MutableHashMap.set(map, edgeIndex2, "second") // Should overwrite

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
      const graph = Graph.directed<string, number>()

      expect(graph[Graph.TypeId]).toBe("~effect/Graph")
    })

    it("should create an empty graph with zero nodes and edges", () => {
      const graph = Graph.directed<string, number>()

      expect(graph.data.nodeCount).toBe(0)
      expect(graph.data.edgeCount).toBe(0)
    })

    it("should create an empty graph with correct type", () => {
      const graph = Graph.directed<string, number>()

      expect(graph.type._tag).toBe("Directed")
    })

    it("should create an empty graph with correct mutable marker", () => {
      const graph = Graph.directed<string, number>()

      expect(graph._mutable).toBe(false)
    })

    it("should create an empty graph with initialized data structures", () => {
      const graph = Graph.directed<string, number>()

      expect(graph.data.nextNodeIndex).toBe(0)
      expect(graph.data.nextEdgeIndex).toBe(0)
      expect(graph.data.nodeAllocator.nextIndex).toBe(0)
      expect(graph.data.edgeAllocator.nextIndex).toBe(0)
      expect(graph.data.nodeAllocator.recycled).toEqual([])
      expect(graph.data.edgeAllocator.recycled).toEqual([])
    })

    it("should create an empty graph that is iterable", () => {
      const graph = Graph.directed<string, number>()
      const nodes = Array.from(graph)

      expect(nodes).toEqual([])
    })

    it("should create graphs with different type parameters", () => {
      const stringNumberGraph = Graph.directed<string, number>()
      const booleanStringGraph = Graph.directed<boolean, string>()

      expect(stringNumberGraph[Graph.TypeId]).toBe("~effect/Graph")
      expect(booleanStringGraph[Graph.TypeId]).toBe("~effect/Graph")
    })

    it("should create undirected graph with correct type", () => {
      const graph = Graph.undirected<string, number>()

      expect(graph[Graph.TypeId]).toBe("~effect/Graph")
      expect(graph.type._tag).toBe("Undirected")
      expect(graph._mutable).toBe(false)
      expect(graph.data.nodeCount).toBe(0)
      expect(graph.data.edgeCount).toBe(0)
      expect(graph.data.isAcyclic).toBe(true)
    })

    it("should distinguish between directed and undirected graphs", () => {
      const directedGraph = Graph.directed<string, number>()
      const undirectedGraph = Graph.undirected<string, number>()

      expect(directedGraph.type._tag).toBe("Directed")
      expect(undirectedGraph.type._tag).toBe("Undirected")
      expect(directedGraph).not.toEqual(undirectedGraph)
    })
  })

  describe("beginMutation", () => {
    it("should create a mutable graph from an immutable graph", () => {
      const graph = Graph.directed<string, number>()
      const mutable = Graph.beginMutation(graph)

      expect(mutable[Graph.TypeId]).toBe("~effect/Graph")
      expect(mutable._mutable).toBe(true)
      expect(mutable.type._tag).toBe("Directed")
    })

    it("should copy all data structures properly", () => {
      const graph = Graph.directed<string, number>()
      const mutable = Graph.beginMutation(graph)

      expect(mutable.data.nodeCount).toBe(graph.data.nodeCount)
      expect(mutable.data.edgeCount).toBe(graph.data.edgeCount)
      expect(mutable.data.nextNodeIndex).toBe(graph.data.nextNodeIndex)
      expect(mutable.data.nextEdgeIndex).toBe(graph.data.nextEdgeIndex)
      expect(mutable.data.nodeAllocator.nextIndex).toBe(graph.data.nodeAllocator.nextIndex)
      expect(mutable.data.edgeAllocator.nextIndex).toBe(graph.data.edgeAllocator.nextIndex)
    })

    it("should create independent copies of mutable data structures", () => {
      const graph = Graph.directed<string, number>()
      const mutable = Graph.beginMutation(graph)

      // Verify that the data structures are different instances
      expect(mutable.data.nodes).not.toBe(graph.data.nodes)
      expect(mutable.data.edges).not.toBe(graph.data.edges)
      expect(mutable.data.adjacency).not.toBe(graph.data.adjacency)
      expect(mutable.data.reverseAdjacency).not.toBe(graph.data.reverseAdjacency)
    })

    it("should deep copy allocator recycled arrays", () => {
      const graph = Graph.directed<string, number>()
      const mutable = Graph.beginMutation(graph)

      expect(mutable.data.nodeAllocator.recycled).not.toBe(graph.data.nodeAllocator.recycled)
      expect(mutable.data.edgeAllocator.recycled).not.toBe(graph.data.edgeAllocator.recycled)
      expect(mutable.data.nodeAllocator.recycled).toEqual(graph.data.nodeAllocator.recycled)
      expect(mutable.data.edgeAllocator.recycled).toEqual(graph.data.edgeAllocator.recycled)
    })
  })

  describe("endMutation", () => {
    it("should convert a mutable graph back to immutable", () => {
      const graph = Graph.directed<string, number>()
      const mutable = Graph.beginMutation(graph)
      const result = Graph.endMutation(mutable)

      expect(result[Graph.TypeId]).toBe("~effect/Graph")
      expect(result._mutable).toBe(false)
      expect(result.type._tag).toBe("Directed")
    })

    it("should preserve all data from mutable graph", () => {
      const graph = Graph.directed<string, number>()
      const mutable = Graph.beginMutation(graph)
      const result = Graph.endMutation(mutable)

      expect(result.data.nodeCount).toBe(mutable.data.nodeCount)
      expect(result.data.edgeCount).toBe(mutable.data.edgeCount)
      expect(result.data.nextNodeIndex).toBe(mutable.data.nextNodeIndex)
      expect(result.data.nextEdgeIndex).toBe(mutable.data.nextEdgeIndex)
    })

    it("should use the same internal data structures", () => {
      const graph = Graph.directed<string, number>()
      const mutable = Graph.beginMutation(graph)
      const result = Graph.endMutation(mutable)

      expect(result.data).toBe(mutable.data)
    })
  })

  describe("mutate", () => {
    it("should perform scoped mutations with dual interface (curried)", () => {
      const graph = Graph.directed<string, number>()
      const mutationFn = (mutable: Graph.MutableGraph<string, number>) => {
        // We can't add nodes yet, but we can verify the function is called
        expect(mutable._mutable).toBe(true)
        expect(mutable[Graph.TypeId]).toBe("~effect/Graph")
      }

      const result = Graph.mutate(mutationFn)(graph)
      expect(result._mutable).toBe(false)
    })

    it("should perform scoped mutations with dual interface (data-last)", () => {
      const graph = Graph.directed<string, number>()
      const mutationFn = (mutable: Graph.MutableGraph<string, number>) => {
        expect(mutable._mutable).toBe(true)
        expect(mutable[Graph.TypeId]).toBe("~effect/Graph")
      }

      const result = Graph.mutate(graph, mutationFn)
      expect(result._mutable).toBe(false)
    })

    it("should isolate mutations from original graph", () => {
      const graph = Graph.directed<string, number>()

      const result = Graph.mutate(graph, (mutable) => {
        // Verify isolation - mutation scope should not affect original
        expect(mutable.data.nodes).not.toBe(graph.data.nodes)
        expect(mutable.data.edges).not.toBe(graph.data.edges)
      })

      expect(result._mutable).toBe(false)
      expect(graph._mutable).toBe(false)
    })

    it("should create a new graph instance", () => {
      const graph = Graph.directed<string, number>()

      const result = Graph.mutate(graph, () => {
        // No mutations performed
      })

      expect(result).not.toBe(graph)
      expect(Equal.equals(result, graph)).toBe(true) // Structural equality
    })

    it("should handle empty mutation function", () => {
      const graph = Graph.directed<string, number>()

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
      const graph = Graph.directed<string, number>()
      let nodeIndex: Graph.NodeIndex

      const result = Graph.mutate(graph, (mutable) => {
        nodeIndex = Graph.addNode(mutable, "Node A")
      })

      expect(nodeIndex!).toBe(0)
      expect(result.data.nodeCount).toBe(1)
    })

    it("should add multiple nodes with sequential indices", () => {
      const graph = Graph.directed<string, number>()
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
      const graph = Graph.directed<string, number>()

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
      const graph = Graph.directed<string, number>()

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
      const graph = Graph.directed<{ name: string; value: number }, string>()

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
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
      })

      const nodeA = Graph.getNode(graph, 0)
      const nodeB = Graph.getNode(graph, 1)

      expect(Option.isSome(nodeA)).toBe(true)
      expect(Option.isSome(nodeB)).toBe(true)

      if (Option.isSome(nodeA) && Option.isSome(nodeB)) {
        expect(nodeA.value).toBe("Node A")
        expect(nodeB.value).toBe("Node B")
      }
    })

    it("should return None for non-existent nodes", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
      })

      const nonExistent = Graph.getNode(graph, 999)
      expect(Option.isNone(nonExistent)).toBe(true)
    })

    it("should work on both Graph and MutableGraph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
      })

      // Test on immutable graph
      const nodeFromGraph = Graph.getNode(graph, 0)
      expect(Option.isSome(nodeFromGraph)).toBe(true)

      // Test on mutable graph
      Graph.mutate(graph, (mutable) => {
        const nodeFromMutable = Graph.getNode(mutable, 0)
        expect(Option.isSome(nodeFromMutable)).toBe(true)

        if (Option.isSome(nodeFromGraph) && Option.isSome(nodeFromMutable)) {
          expect(nodeFromGraph.value).toBe(nodeFromMutable.value)
        }
      })
    })

    it("should handle empty graph", () => {
      const graph = Graph.directed<string, number>()
      const result = Graph.getNode(graph, 0)
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe("hasNode", () => {
    it("should return true for existing nodes", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
      })

      expect(Graph.hasNode(graph, 0)).toBe(true)
      expect(Graph.hasNode(graph, 1)).toBe(true)
    })

    it("should return false for non-existent nodes", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
      })

      expect(Graph.hasNode(graph, 999)).toBe(false)
      expect(Graph.hasNode(graph, -1)).toBe(false)
    })

    it("should work on both Graph and MutableGraph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
      })

      // Test on immutable graph
      expect(Graph.hasNode(graph, 0)).toBe(true)

      // Test on mutable graph
      Graph.mutate(graph, (mutable) => {
        expect(Graph.hasNode(mutable, 0)).toBe(true)
        expect(Graph.hasNode(mutable, 999)).toBe(false)
      })
    })

    it("should handle empty graph", () => {
      const graph = Graph.directed<string, number>()
      expect(Graph.hasNode(graph, 0)).toBe(false)
    })
  })

  describe("nodeCount", () => {
    it("should return 0 for empty graph", () => {
      const graph = Graph.directed<string, number>()
      expect(Graph.nodeCount(graph)).toBe(0)
    })

    it("should return correct count after adding nodes", () => {
      const graph = Graph.directed<string, number>((mutable) => {
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
      const graph = Graph.directed<string, number>((mutable) => {
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
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
        Graph.addNode(mutable, "Node C")
      })

      expect(Graph.nodeCount(graph)).toBe(graph.data.nodeCount)
      expect(Graph.nodeCount(graph)).toBe(3)
    })
  })

  describe("addEdge", () => {
    it("should add an edge between two existing nodes", () => {
      let edgeIndex: Graph.EdgeIndex

      const result = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        edgeIndex = Graph.addEdge(mutable, nodeA, nodeB, 42)
      })

      expect(edgeIndex!).toBe(0)
      expect(result.data.edgeCount).toBe(1)
    })

    it("should add multiple edges with sequential indices", () => {
      let edgeA: Graph.EdgeIndex
      let edgeB: Graph.EdgeIndex
      let edgeC: Graph.EdgeIndex

      const result = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const nodeC = Graph.addNode(mutable, "Node C")

        edgeA = Graph.addEdge(mutable, nodeA, nodeB, 10)
        edgeB = Graph.addEdge(mutable, nodeB, nodeC, 20)
        edgeC = Graph.addEdge(mutable, nodeA, nodeC, 30)
      })

      expect(edgeA!).toBe(0)
      expect(edgeB!).toBe(1)
      expect(edgeC!).toBe(2)
      expect(result.data.edgeCount).toBe(3)
    })

    it("should update adjacency lists correctly", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const edgeIndex = Graph.addEdge(mutable, nodeA, nodeB, 42)

        // Check adjacency lists are updated
        const sourceAdjacency = MutableHashMap.get(mutable.data.adjacency, nodeA)
        const targetReverseAdjacency = MutableHashMap.get(mutable.data.reverseAdjacency, nodeB)

        expect(Option.isSome(sourceAdjacency)).toBe(true)
        expect(Option.isSome(targetReverseAdjacency)).toBe(true)

        if (Option.isSome(sourceAdjacency) && Option.isSome(targetReverseAdjacency)) {
          expect(sourceAdjacency.value).toContain(edgeIndex)
          expect(targetReverseAdjacency.value).toContain(edgeIndex)
        }
      })

      expect(graph.data.edgeCount).toBe(1)
    })

    it("should invalidate cycle flag when adding edges", () => {
      const result = Graph.directed<string, number>((mutable) => {
        expect(mutable.data.isAcyclic).toBe(true) // Initially true for empty graph

        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")

        expect(mutable.data.isAcyclic).toBe(true) // Still true after adding nodes

        Graph.addEdge(mutable, nodeA, nodeB, 42)

        expect(mutable.data.isAcyclic).toBe(null) // Invalidated after adding edge
      })

      expect(result.data.isAcyclic).toBe(null)
    })

    it("should throw error when source node doesn't exist", () => {
      expect(() => {
        Graph.directed<string, number>((mutable) => {
          const nodeB = Graph.addNode(mutable, "Node B")
          const nonExistentNode = 999
          Graph.addEdge(mutable, nonExistentNode, nodeB, 42)
        })
      }).toThrow("Source node 999 does not exist")
    })

    it("should throw error when target node doesn't exist", () => {
      expect(() => {
        Graph.directed<string, number>((mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nonExistentNode = 999
          Graph.addEdge(mutable, nodeA, nonExistentNode, 42)
        })
      }).toThrow("Target node 999 does not exist")
    })

    it("should update nextEdgeIndex correctly", () => {
      const result = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")

        expect(mutable.data.nextEdgeIndex).toBe(0)
        Graph.addEdge(mutable, nodeA, nodeB, 42)
        expect(mutable.data.nextEdgeIndex).toBe(1)
        Graph.addEdge(mutable, nodeB, nodeA, 24)
        expect(mutable.data.nextEdgeIndex).toBe(2)
      })

      expect(result.data.nextEdgeIndex).toBe(2)
    })
  })

  describe("removeNode", () => {
    it("should remove a node and all its incident edges", () => {
      const result = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const nodeC = Graph.addNode(mutable, "Node C")

        Graph.addEdge(mutable, nodeA, nodeB, 10)
        Graph.addEdge(mutable, nodeB, nodeC, 20)
        Graph.addEdge(mutable, nodeC, nodeA, 30)

        expect(mutable.data.nodeCount).toBe(3)
        expect(mutable.data.edgeCount).toBe(3)

        // Remove nodeB which has 2 incident edges
        Graph.removeNode(mutable, nodeB)

        expect(mutable.data.nodeCount).toBe(2)
        expect(mutable.data.edgeCount).toBe(1) // Only nodeC -> nodeA edge remains
      })

      expect(result.data.nodeCount).toBe(2)
      expect(result.data.edgeCount).toBe(1)
    })

    it("should handle removing non-existent node gracefully", () => {
      const result = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A") // Just need one node for count
        const nonExistentNode = 999

        expect(mutable.data.nodeCount).toBe(1)
        Graph.removeNode(mutable, nonExistentNode) // Should not throw
        expect(mutable.data.nodeCount).toBe(1) // Should remain unchanged
      })

      expect(result.data.nodeCount).toBe(1)
    })

    it("should invalidate cycle flag when removing nodes", () => {
      const result = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        Graph.addEdge(mutable, nodeA, nodeB, 42)

        expect(mutable.data.isAcyclic).toBe(null) // Invalidated by addEdge

        // Reset for testing
        mutable.data.isAcyclic = true

        Graph.removeNode(mutable, nodeA)

        expect(mutable.data.isAcyclic).toBe(null) // Invalidated by removeNode
      })

      expect(result.data.isAcyclic).toBe(null)
    })

    it("should remove adjacency lists for the removed node", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B") // Just need second node for final count

        // Verify adjacency lists exist
        expect(MutableHashMap.has(mutable.data.adjacency, nodeA)).toBe(true)
        expect(MutableHashMap.has(mutable.data.reverseAdjacency, nodeA)).toBe(true)

        Graph.removeNode(mutable, nodeA)

        // Verify adjacency lists are removed
        expect(MutableHashMap.has(mutable.data.adjacency, nodeA)).toBe(false)
        expect(MutableHashMap.has(mutable.data.reverseAdjacency, nodeA)).toBe(false)
      })

      expect(graph.data.nodeCount).toBe(1)
    })

    it("should handle isolated node removal", () => {
      const result = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A") // Keep for final count
        const nodeB = Graph.addNode(mutable, "Node B") // Isolated node to remove

        expect(mutable.data.nodeCount).toBe(2)
        expect(mutable.data.edgeCount).toBe(0)

        Graph.removeNode(mutable, nodeB)

        expect(mutable.data.nodeCount).toBe(1)
        expect(mutable.data.edgeCount).toBe(0)
      })

      expect(result.data.nodeCount).toBe(1)
    })
  })

  describe("removeEdge", () => {
    it("should remove an edge between two nodes", () => {
      let edgeIndex: Graph.EdgeIndex

      const result = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        edgeIndex = Graph.addEdge(mutable, nodeA, nodeB, 42)

        expect(mutable.data.edgeCount).toBe(1)

        Graph.removeEdge(mutable, edgeIndex)

        expect(mutable.data.edgeCount).toBe(0)
      })

      expect(result.data.edgeCount).toBe(0)
    })

    it("should remove edge from adjacency lists", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const edgeIndex = Graph.addEdge(mutable, nodeA, nodeB, 42)

        // Verify edge is in adjacency lists
        const sourceAdjacency = MutableHashMap.get(mutable.data.adjacency, nodeA)
        const targetReverseAdjacency = MutableHashMap.get(mutable.data.reverseAdjacency, nodeB)

        expect(Option.isSome(sourceAdjacency)).toBe(true)
        expect(Option.isSome(targetReverseAdjacency)).toBe(true)

        if (Option.isSome(sourceAdjacency) && Option.isSome(targetReverseAdjacency)) {
          expect(sourceAdjacency.value).toContain(edgeIndex)
          expect(targetReverseAdjacency.value).toContain(edgeIndex)
        }

        Graph.removeEdge(mutable, edgeIndex)

        // Verify edge is removed from adjacency lists
        const sourceAdjacencyAfter = MutableHashMap.get(mutable.data.adjacency, nodeA)
        const targetReverseAdjacencyAfter = MutableHashMap.get(mutable.data.reverseAdjacency, nodeB)

        if (Option.isSome(sourceAdjacencyAfter) && Option.isSome(targetReverseAdjacencyAfter)) {
          expect(sourceAdjacencyAfter.value).not.toContain(edgeIndex)
          expect(targetReverseAdjacencyAfter.value).not.toContain(edgeIndex)
        }
      })

      expect(graph.data.edgeCount).toBe(0)
    })

    it("should handle removing non-existent edge gracefully", () => {
      const result = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        Graph.addEdge(mutable, nodeA, nodeB, 42)

        const nonExistentEdge = 999

        expect(mutable.data.edgeCount).toBe(1)
        Graph.removeEdge(mutable, nonExistentEdge) // Should not throw
        expect(mutable.data.edgeCount).toBe(1) // Should remain unchanged
      })

      expect(result.data.edgeCount).toBe(1)
    })

    it("should invalidate cycle flag when removing edges", () => {
      const result = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const edgeIndex = Graph.addEdge(mutable, nodeA, nodeB, 42)

        expect(mutable.data.isAcyclic).toBe(null) // Invalidated by addEdge

        // Reset for testing
        mutable.data.isAcyclic = false

        Graph.removeEdge(mutable, edgeIndex)

        expect(mutable.data.isAcyclic).toBe(null) // Invalidated by removeEdge
      })

      expect(result.data.isAcyclic).toBe(null)
    })

    it("should handle multiple edges between same nodes", () => {
      const result = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")

        const edge1 = Graph.addEdge(mutable, nodeA, nodeB, 10)
        const edge2 = Graph.addEdge(mutable, nodeA, nodeB, 20)

        expect(mutable.data.edgeCount).toBe(2)

        Graph.removeEdge(mutable, edge1)

        expect(mutable.data.edgeCount).toBe(1)

        // Verify second edge still exists
        const edge2Data = MutableHashMap.get(mutable.data.edges, edge2)
        expect(Option.isSome(edge2Data)).toBe(true)
      })

      expect(result.data.edgeCount).toBe(1)
    })
  })

  describe("cycle flag integration", () => {
    it("should initialize with acyclic flag for empty graph", () => {
      const graph = Graph.directed<string, number>()
      expect(graph.data.isAcyclic).toBe(true)
    })

    it("should preserve acyclic flag when adding nodes", () => {
      const result = Graph.directed<string, number>((mutable) => {
        expect(mutable.data.isAcyclic).toBe(true)
        Graph.addNode(mutable, "Node A")
        expect(mutable.data.isAcyclic).toBe(true) // Should remain true
        Graph.addNode(mutable, "Node B")
        expect(mutable.data.isAcyclic).toBe(true) // Should remain true
      })

      expect(result.data.isAcyclic).toBe(true)
    })

    it("should copy cycle flag in mutation scope", () => {
      const graph = Graph.directed<string, number>()
      expect(graph.data.isAcyclic).toBe(true)

      const result = Graph.mutate(graph, (mutable) => {
        expect(mutable.data.isAcyclic).toBe(true) // Should copy from original
        Graph.addNode(mutable, "Node A")
        expect(mutable.data.isAcyclic).toBe(true) // Should remain true
      })

      expect(result.data.isAcyclic).toBe(true)
      expect(graph.data.isAcyclic).toBe(true) // Original should be unchanged
    })
  })

  describe("Edge query operations", () => {
    describe("getEdge", () => {
      it("should return edge data for existing edge", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nodeB = Graph.addNode(mutable, "Node B")
          Graph.addEdge(mutable, nodeA, nodeB, 42)
        })

        const edgeIndex = 0
        const edgeData = Graph.getEdge(graph, edgeIndex)

        expect(Option.isSome(edgeData)).toBe(true)
        if (Option.isSome(edgeData)) {
          expect(edgeData.value.source).toBe(0)
          expect(edgeData.value.target).toBe(1)
          expect(edgeData.value.data).toBe(42)
        }
      })

      it("should return None for non-existent edge", () => {
        const graph = Graph.directed<string, number>()
        const edgeIndex = 999
        const edgeData = Graph.getEdge(graph, edgeIndex)

        expect(Option.isNone(edgeData)).toBe(true)
      })
    })

    describe("hasEdge", () => {
      it("should return true for existing edge", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nodeB = Graph.addNode(mutable, "Node B")
          Graph.addEdge(mutable, nodeA, nodeB, 42)
        })

        const nodeA = 0
        const nodeB = 1

        expect(Graph.hasEdge(graph, nodeA, nodeB)).toBe(true)
      })

      it("should return false for non-existent edge", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nodeB = Graph.addNode(mutable, "Node B")
          Graph.addNode(mutable, "Node C")
          Graph.addEdge(mutable, nodeA, nodeB, 42)
        })

        const nodeA = 0
        const nodeC = 2

        expect(Graph.hasEdge(graph, nodeA, nodeC)).toBe(false)
      })

      it("should return false for non-existent source node", () => {
        const graph = Graph.directed<string, number>()
        const nodeA = 0
        const nodeB = 1

        expect(Graph.hasEdge(graph, nodeA, nodeB)).toBe(false)
      })
    })

    describe("edgeCount", () => {
      it("should return 0 for empty graph", () => {
        const graph = Graph.directed<string, number>()
        expect(Graph.edgeCount(graph)).toBe(0)
      })

      it("should return correct edge count", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nodeB = Graph.addNode(mutable, "Node B")
          const nodeC = Graph.addNode(mutable, "Node C")
          Graph.addEdge(mutable, nodeA, nodeB, 1)
          Graph.addEdge(mutable, nodeB, nodeC, 2)
          Graph.addEdge(mutable, nodeC, nodeA, 3)
        })

        expect(Graph.edgeCount(graph)).toBe(3)
      })
    })

    describe("neighbors", () => {
      it("should return empty array for node with no outgoing edges", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          Graph.addNode(mutable, "Node A")
        })

        const nodeA = 0
        const neighbors = Graph.neighbors(graph, nodeA)

        expect(neighbors).toEqual([])
      })

      it("should return correct neighbors for directed graph", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nodeB = Graph.addNode(mutable, "Node B")
          const nodeC = Graph.addNode(mutable, "Node C")
          Graph.addEdge(mutable, nodeA, nodeB, 1)
          Graph.addEdge(mutable, nodeA, nodeC, 2)
        })

        const nodeA = 0
        const nodeB = 1
        const nodeC = 2

        const neighborsA = Graph.neighbors(graph, nodeA)
        expect(neighborsA).toContain(nodeB)
        expect(neighborsA).toContain(nodeC)
        expect(neighborsA).toHaveLength(2)

        const neighborsB = Graph.neighbors(graph, nodeB)
        expect(neighborsB).toEqual([])
      })

      it("should return empty array for non-existent node", () => {
        const graph = Graph.directed<string, number>()
        const nodeA = 999
        const neighbors = Graph.neighbors(graph, nodeA)

        expect(neighbors).toEqual([])
      })
    })
  })

  describe("GraphViz export", () => {
    describe("toGraphViz", () => {
      it("should export empty directed graph", () => {
        const graph = Graph.directed<string, number>()
        const dot = Graph.toGraphViz(graph)

        expect(dot).toBe("digraph G {\n}")
      })

      it("should export empty undirected graph", () => {
        const graph = Graph.undirected<string, number>()
        const dot = Graph.toGraphViz(graph)

        expect(dot).toBe("graph G {\n}")
      })

      it("should export directed graph with nodes and edges", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nodeB = Graph.addNode(mutable, "Node B")
          const nodeC = Graph.addNode(mutable, "Node C")
          Graph.addEdge(mutable, nodeA, nodeB, 1)
          Graph.addEdge(mutable, nodeB, nodeC, 2)
          Graph.addEdge(mutable, nodeC, nodeA, 3)
        })

        const dot = Graph.toGraphViz(graph)

        expect(dot).toContain("digraph G {")
        expect(dot).toContain("\"0\" [label=\"Node A\"];")
        expect(dot).toContain("\"1\" [label=\"Node B\"];")
        expect(dot).toContain("\"2\" [label=\"Node C\"];")
        expect(dot).toContain("\"0\" -> \"1\" [label=\"1\"];")
        expect(dot).toContain("\"1\" -> \"2\" [label=\"2\"];")
        expect(dot).toContain("\"2\" -> \"0\" [label=\"3\"];")
        expect(dot).toContain("}")
      })

      it("should export undirected graph with correct edge format", () => {
        const graph = Graph.undirected<string, number>((mutable) => {
          const nodeA = Graph.addNode(mutable, "A")
          const nodeB = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, nodeA, nodeB, 1)
        })

        const dot = Graph.toGraphViz(graph)

        expect(dot).toContain("graph G {")
        expect(dot).toContain("\"0\" -- \"1\" [label=\"1\"];")
      })

      it("should support custom node and edge labels", () => {
        const graph = Graph.directed<{ name: string }, { weight: number }>((mutable) => {
          const nodeA = Graph.addNode(mutable, { name: "Alice" })
          const nodeB = Graph.addNode(mutable, { name: "Bob" })
          Graph.addEdge(mutable, nodeA, nodeB, { weight: 42 })
        })

        const dot = Graph.toGraphViz(graph, {
          nodeLabel: (data) => data.name,
          edgeLabel: (data) => `weight: ${data.weight}`,
          graphName: "MyGraph"
        })

        expect(dot).toContain("digraph MyGraph {")
        expect(dot).toContain("\"0\" [label=\"Alice\"];")
        expect(dot).toContain("\"1\" [label=\"Bob\"];")
        expect(dot).toContain("\"0\" -> \"1\" [label=\"weight: 42\"];")
      })

      it("should escape quotes in labels", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const nodeA = Graph.addNode(mutable, "Node \"A\"")
          const nodeB = Graph.addNode(mutable, "Node \"B\"")
          Graph.addEdge(mutable, nodeA, nodeB, "Edge \"1\"")
        })

        const dot = Graph.toGraphViz(graph)

        expect(dot).toContain("\"0\" [label=\"Node \\\"A\\\"\"];")
        expect(dot).toContain("\"1\" [label=\"Node \\\"B\\\"\"];")
        expect(dot).toContain("\"0\" -> \"1\" [label=\"Edge \\\"1\\\"\"];")
      })

      it("should demonstrate graph visualization", () => {
        // Create a simple directed graph representing a dependency graph
        const graph = Graph.directed<string, string>((mutable) => {
          const app = Graph.addNode(mutable, "App")
          const auth = Graph.addNode(mutable, "Auth")
          const db = Graph.addNode(mutable, "Database")
          const cache = Graph.addNode(mutable, "Cache")

          Graph.addEdge(mutable, app, auth, "uses")
          Graph.addEdge(mutable, app, db, "stores")
          Graph.addEdge(mutable, auth, db, "validates")
          Graph.addEdge(mutable, app, cache, "caches")
        })

        const dot = Graph.toGraphViz(graph, {
          graphName: "DependencyGraph"
        })

        // Uncomment the next line to see the GraphViz output in test console
        // console.log("\nDependency Graph DOT format:\n" + dot)

        expect(dot).toContain("digraph DependencyGraph {")
        expect(dot).toContain("\"0\" [label=\"App\"];")
        expect(dot).toContain("\"0\" -> \"1\" [label=\"uses\"];")
        expect(dot).toContain("\"0\" -> \"2\" [label=\"stores\"];")
        expect(dot).toContain("\"1\" -> \"2\" [label=\"validates\"];")
        expect(dot).toContain("\"0\" -> \"3\" [label=\"caches\"];")
      })

      it("should demonstrate undirected graph visualization", () => {
        // Create a simple social network graph
        const graph = Graph.undirected<string, string>((mutable) => {
          const alice = Graph.addNode(mutable, "Alice")
          const bob = Graph.addNode(mutable, "Bob")
          const charlie = Graph.addNode(mutable, "Charlie")
          const diana = Graph.addNode(mutable, "Diana")

          Graph.addEdge(mutable, alice, bob, "friends")
          Graph.addEdge(mutable, bob, charlie, "friends")
          Graph.addEdge(mutable, charlie, diana, "friends")
          Graph.addEdge(mutable, alice, diana, "friends")
        })

        const dot = Graph.toGraphViz(graph, {
          graphName: "SocialNetwork"
        })

        // Uncomment the next line to see the GraphViz output in test console
        // console.log("\nSocial Network DOT format:\n" + dot)

        expect(dot).toContain("graph SocialNetwork {")
        expect(dot).toContain("\"0\" [label=\"Alice\"];")
        expect(dot).toContain("\"0\" -- \"1\" [label=\"friends\"];")
        expect(dot).toContain("\"1\" -- \"2\" [label=\"friends\"];")
        expect(dot).toContain("\"2\" -- \"3\" [label=\"friends\"];")
        expect(dot).toContain("\"0\" -- \"3\" [label=\"friends\"];")
      })
    })
  })

  describe("Simple iteration utilities", () => {
    describe("nodes function", () => {
      it("should traverse nodes in depth-first order", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
          Graph.addEdge(mutable, b, d, "B->D")
        })

        const visited = Array.from(Graph.nodes(graph, [0], "dfs"))

        // Should visit all nodes
        expect(visited).toHaveLength(4)
        expect(visited).toContain(0) // A
        expect(visited).toContain(1) // B
        expect(visited).toContain(2) // C
        expect(visited).toContain(3) // D

        // First node should be the starting node
        expect(visited[0]).toBe(0)
      })

      it("should handle disconnected graphs", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addNode(mutable, "D") // Isolated node
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        const visited = Array.from(Graph.nodes(graph, [0], "dfs"))

        // Should only visit connected component
        expect(visited).toHaveLength(3)
        expect(visited).toContain(0) // A
        expect(visited).toContain(1) // B
        expect(visited).toContain(2) // C
        expect(visited).not.toContain(3) // Isolated D
      })

      it("should support multiple traversals", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, "A->B")
        })

        // First traversal
        const first = Array.from(Graph.nodes(graph, [0], "dfs"))
        expect(first).toHaveLength(2)
        expect(first[0]).toBe(0)

        // Second traversal (nodes function is stateless)
        const second = Array.from(Graph.nodes(graph, [0], "dfs"))
        expect(second).toHaveLength(2)
        expect(second[0]).toBe(0)
        expect(first).toEqual(second)
      })

      it("should support different starting nodes", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        // Start from different node
        const visited = Array.from(Graph.nodes(graph, [1], "dfs"))
        expect(visited).toHaveLength(2)
        expect(visited[0]).toBe(1) // B
        expect(visited[1]).toBe(2) // C
      })

      it("should avoid revisiting nodes", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
          Graph.addEdge(mutable, b, c, "B->C") // Creates multiple paths to C
        })

        const visited = Array.from(Graph.nodes(graph, [0], "dfs"))

        // Should visit each node exactly once
        expect(visited).toHaveLength(3)
        expect(new Set(visited).size).toBe(3) // No duplicates
      })
    })

    // BFS tests are already covered by nodes function with "bfs" algorithm
    describe("BFS algorithm using nodes function", () => {
      it("should traverse nodes in breadth-first order", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
          Graph.addEdge(mutable, b, d, "B->D")
        })

        const visited = Array.from(Graph.nodes(graph, [0], "bfs"))

        // Should visit all nodes
        expect(visited).toHaveLength(4)
        expect(visited).toContain(0) // A
        expect(visited).toContain(1) // B
        expect(visited).toContain(2) // C
        expect(visited).toContain(3) // D

        // First node should be the starting node
        expect(visited[0]).toBe(0)
      })

      it("should support multiple traversals", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, "A->B")
        })

        // First traversal
        const first = Array.from(Graph.nodes(graph, [0], "bfs"))
        expect(first).toHaveLength(2)
        expect(first[0]).toBe(0)

        // Second traversal (nodes function is stateless)
        const second = Array.from(Graph.nodes(graph, [0], "bfs"))
        expect(second).toHaveLength(2)
        expect(second[0]).toBe(0)
        expect(first).toEqual(second)
      })

      it("should support different starting nodes", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        // Start from different node
        const visited = Array.from(Graph.nodes(graph, [1], "bfs"))
        expect(visited).toHaveLength(2)
        expect(visited[0]).toBe(1) // B
        expect(visited[1]).toBe(2) // C
      })

      it("should work with empty graphs", () => {
        const graph = Graph.directed<string, string>()
        const visited = Array.from(Graph.nodes(graph, [0], "bfs"))
        expect(visited).toEqual([])
      })

      it("should work with single node", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          Graph.addNode(mutable, "A")
        })

        const visited = Array.from(Graph.nodes(graph, [0], "bfs"))
        expect(visited).toEqual([0])
      })
    })

    // walkNodes utility is replaced by nodes function which is already iterable
    describe("nodes function as iterable utility", () => {
      it("should work with for-of loops", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
        })

        // Use for-of loop
        const visited: Array<Graph.NodeIndex> = []
        for (const node of Graph.nodes(graph, [0])) {
          visited.push(node)
        }

        expect(visited).toHaveLength(3)
        expect(visited).toContain(0)
        expect(visited).toContain(1)
        expect(visited).toContain(2)
      })

      it("should work with Array.from", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, "A->B")
        })

        const nodes = Array.from(Graph.nodes(graph, [0], "bfs"))
        expect(nodes).toEqual([0, 1])
      })

      it("should handle empty traversal", () => {
        const graph = Graph.directed<string, string>()
        const nodes = Array.from(Graph.nodes(graph, [0]))
        expect(nodes).toEqual([])
      })
    })

    describe("nodes function with undirected graphs", () => {
      it("should traverse undirected graph correctly", () => {
        const graph = Graph.undirected<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A-B")
          Graph.addEdge(mutable, b, c, "B-C")
        })

        const visited = Array.from(Graph.nodes(graph, [0]))

        expect(visited).toHaveLength(3)
        expect(visited).toContain(0)
        expect(visited).toContain(1)
        expect(visited).toContain(2)
      })

      it("should traverse BFS on undirected graph", () => {
        const graph = Graph.undirected<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A-B")
          Graph.addEdge(mutable, a, c, "A-C")
          Graph.addEdge(mutable, b, d, "B-D")
        })

        const visited = Array.from(Graph.nodes(graph, [0], "bfs"))

        expect(visited).toHaveLength(4)
        expect(visited[0]).toBe(0) // Should start with A
      })
    })

    describe("bidirectional traversal using nodes function", () => {
      it("should traverse outgoing direction by default", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        const visited = Array.from(Graph.nodes(graph, [0], "dfs"))
        expect(visited).toEqual([0, 1, 2])
      })

      it("should traverse outgoing direction explicitly", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        const visited = Array.from(Graph.nodes(graph, [0], "dfs", "outgoing"))
        expect(visited).toEqual([0, 1, 2])
      })

      it("should traverse incoming direction for DFS", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        const visited = Array.from(Graph.nodes(graph, [2], "dfs", "incoming"))
        expect(visited).toEqual([2, 1, 0])
      })

      it("should traverse incoming direction for BFS", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        const visited = Array.from(Graph.nodes(graph, [2], "bfs", "incoming"))
        expect(visited).toEqual([2, 1, 0])
      })

      it("should work with branching graph structure", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
          Graph.addEdge(mutable, b, d, "B->D")
          Graph.addEdge(mutable, c, d, "C->D")
        })

        // Outgoing from A should reach all nodes
        const outgoingVisited = Array.from(Graph.nodes(graph, [0], "dfs", "outgoing"))
        expect(outgoingVisited).toHaveLength(4)
        expect(outgoingVisited[0]).toBe(0)

        // Incoming from D should reach all nodes
        const incomingVisited = Array.from(Graph.nodes(graph, [3], "dfs", "incoming"))
        expect(incomingVisited).toHaveLength(4)
        expect(incomingVisited[0]).toBe(3)
      })
    })

    describe("neighborsDirected", () => {
      it("should return outgoing neighbors", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
        })

        const neighbors = Graph.neighborsDirected(graph, 0, "outgoing")
        expect(neighbors).toHaveLength(2)
        expect(neighbors).toContain(1)
        expect(neighbors).toContain(2)
      })

      it("should return incoming neighbors", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, c, "A->C")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        const neighbors = Graph.neighborsDirected(graph, 2, "incoming")
        expect(neighbors).toHaveLength(2)
        expect(neighbors).toContain(0)
        expect(neighbors).toContain(1)
      })

      it("should work with function call", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, "A->B")
        })

        const neighbors = Graph.neighborsDirected(graph, 0, "outgoing")
        expect(neighbors).toEqual([1])
      })

      it("should return empty array for nodes with no neighbors", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          Graph.addNode(mutable, "A")
          Graph.addNode(mutable, "B")
          // No edges
        })

        const outgoing = Graph.neighborsDirected(graph, 0, "outgoing")
        const incoming = Graph.neighborsDirected(graph, 0, "incoming")
        expect(outgoing).toEqual([])
        expect(incoming).toEqual([])
      })
    })

    describe("event-driven traversal (Phase 4C)", () => {
      describe("depthFirstSearch", () => {
        it("should emit correct events during DFS traversal", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            const c = Graph.addNode(mutable, "C")
            Graph.addEdge(mutable, a, b, 1)
            Graph.addEdge(mutable, b, c, 2)
          })

          const events: Array<Graph.TraversalEvent<string, number>> = []
          const visitor: Graph.Visitor<string, number> = (event) => {
            events.push(event)
            return "Continue"
          }

          Graph.depthFirstSearch(graph, [0], visitor)

          // Should have discovered all nodes
          const discoverEvents = events.filter((e) => e._tag === "DiscoverNode")
          expect(discoverEvents).toHaveLength(3)
          expect(discoverEvents.map((e) => e.data)).toEqual(["A", "B", "C"])

          // Should have tree edges
          const treeEdges = events.filter((e) => e._tag === "TreeEdge")
          expect(treeEdges).toHaveLength(2)
          expect(treeEdges.map((e) => e.data)).toEqual([1, 2])

          // Should have finish events
          const finishEvents = events.filter((e) => e._tag === "FinishNode")
          expect(finishEvents).toHaveLength(3)
        })

        it("should respect Break control flow", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            const c = Graph.addNode(mutable, "C")
            Graph.addEdge(mutable, a, b, 1)
            Graph.addEdge(mutable, b, c, 2)
          })

          const events: Array<Graph.TraversalEvent<string, number>> = []
          const visitor: Graph.Visitor<string, number> = (event) => {
            events.push(event)
            if (event._tag === "DiscoverNode" && event.data === "B") {
              return "Break"
            }
            return "Continue"
          }

          Graph.depthFirstSearch(graph, [0], visitor)

          // Should stop early
          const discoverEvents = events.filter((e) => e._tag === "DiscoverNode")
          expect(discoverEvents).toHaveLength(2) // Only A and B
          expect(discoverEvents.map((e) => e.data)).toEqual(["A", "B"])
        })

        it("should respect Prune control flow", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            const c = Graph.addNode(mutable, "C")
            const d = Graph.addNode(mutable, "D")
            Graph.addEdge(mutable, a, b, 1)
            Graph.addEdge(mutable, a, c, 2)
            Graph.addEdge(mutable, b, d, 3)
          })

          const events: Array<Graph.TraversalEvent<string, number>> = []
          const visitor: Graph.Visitor<string, number> = (event) => {
            events.push(event)
            if (event._tag === "DiscoverNode" && event.data === "B") {
              return "Prune" // Skip B's subtree
            }
            return "Continue"
          }

          Graph.depthFirstSearch(graph, [0], visitor)

          const discoverEvents = events.filter((e) => e._tag === "DiscoverNode")
          expect(discoverEvents.map((e) => e.data)).toContain("A")
          expect(discoverEvents.map((e) => e.data)).toContain("B")
          expect(discoverEvents.map((e) => e.data)).toContain("C")
          expect(discoverEvents.map((e) => e.data)).not.toContain("D") // Pruned
        })

        it("should detect back edges in cyclic graphs", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            const c = Graph.addNode(mutable, "C")
            Graph.addEdge(mutable, a, b, 1)
            Graph.addEdge(mutable, b, c, 2)
            Graph.addEdge(mutable, c, a, 3) // Back edge creating cycle
          })

          const events: Array<Graph.TraversalEvent<string, number>> = []
          const visitor: Graph.Visitor<string, number> = (event) => {
            events.push(event)
            return "Continue"
          }

          Graph.depthFirstSearch(graph, [0], visitor)

          const backEdges = events.filter((e) => e._tag === "BackEdge")
          expect(backEdges).toHaveLength(1)
          expect(backEdges[0].data).toBe(3)
        })

        it("should handle multiple start nodes", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            Graph.addNode(mutable, "C") // Isolated
            Graph.addEdge(mutable, a, b, 1)
          })

          const events: Array<Graph.TraversalEvent<string, number>> = []
          const visitor: Graph.Visitor<string, number> = (event) => {
            events.push(event)
            return "Continue"
          }

          Graph.depthFirstSearch(graph, [0, 2], visitor) // Start from A and C

          const discoverEvents = events.filter((e) => e._tag === "DiscoverNode")
          expect(discoverEvents).toHaveLength(3)
          expect(discoverEvents.map((e) => e.data)).toEqual(["A", "B", "C"])
        })
      })

      describe("breadthFirstSearch", () => {
        it("should emit correct events during BFS traversal", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            const c = Graph.addNode(mutable, "C")
            const d = Graph.addNode(mutable, "D")
            Graph.addEdge(mutable, a, b, 1)
            Graph.addEdge(mutable, a, c, 2)
            Graph.addEdge(mutable, b, d, 3)
          })

          const events: Array<Graph.TraversalEvent<string, number>> = []
          const visitor: Graph.Visitor<string, number> = (event) => {
            events.push(event)
            return "Continue"
          }

          Graph.breadthFirstSearch(graph, [0], visitor)

          // Should discover nodes in BFS order
          const discoverEvents = events.filter((e) => e._tag === "DiscoverNode")
          expect(discoverEvents).toHaveLength(4)
          expect(discoverEvents[0].data).toBe("A") // Root first

          // B and C should come before D (level by level)
          const nodeDataOrder = discoverEvents.map((e) => e.data)
          const indexA = nodeDataOrder.indexOf("A")
          const indexB = nodeDataOrder.indexOf("B")
          const indexC = nodeDataOrder.indexOf("C")
          const indexD = nodeDataOrder.indexOf("D")

          expect(indexA).toBe(0) // A is first
          expect(Math.min(indexB, indexC)).toBeLessThan(indexD) // B or C before D
        })

        it("should respect Break control flow", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            const c = Graph.addNode(mutable, "C")
            Graph.addEdge(mutable, a, b, 1)
            Graph.addEdge(mutable, a, c, 2)
          })

          const events: Array<Graph.TraversalEvent<string, number>> = []
          const visitor: Graph.Visitor<string, number> = (event) => {
            events.push(event)
            if (event._tag === "DiscoverNode" && event.data === "B") {
              return "Break"
            }
            return "Continue"
          }

          Graph.breadthFirstSearch(graph, [0], visitor)

          const discoverEvents = events.filter((e) => e._tag === "DiscoverNode")
          expect(discoverEvents.map((e) => e.data)).toContain("A")
          expect(discoverEvents.map((e) => e.data)).toContain("B")
          // Should stop after discovering B
        })

        it("should respect Prune control flow", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            const c = Graph.addNode(mutable, "C")
            const d = Graph.addNode(mutable, "D")
            Graph.addEdge(mutable, a, b, 1)
            Graph.addEdge(mutable, a, c, 2)
            Graph.addEdge(mutable, b, d, 3)
          })

          const events: Array<Graph.TraversalEvent<string, number>> = []
          const visitor: Graph.Visitor<string, number> = (event) => {
            events.push(event)
            if (event._tag === "DiscoverNode" && event.data === "B") {
              return "Prune"
            }
            return "Continue"
          }

          Graph.breadthFirstSearch(graph, [0], visitor)

          const discoverEvents = events.filter((e) => e._tag === "DiscoverNode")
          expect(discoverEvents.map((e) => e.data)).toContain("A")
          expect(discoverEvents.map((e) => e.data)).toContain("B")
          expect(discoverEvents.map((e) => e.data)).toContain("C")
          expect(discoverEvents.map((e) => e.data)).not.toContain("D") // Pruned
        })

        it("should handle empty graph", () => {
          const graph = Graph.directed<string, number>()

          const events: Array<Graph.TraversalEvent<string, number>> = []
          const visitor: Graph.Visitor<string, number> = (event) => {
            events.push(event)
            return "Continue"
          }

          Graph.breadthFirstSearch(graph, [0], visitor)

          expect(events).toHaveLength(0)
        })
      })

      describe("TraversalEvent types", () => {
        it("should provide all necessary event information", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            Graph.addEdge(mutable, a, b, 42)
          })

          let discoverEvent: Graph.TraversalEvent<string, number> | undefined
          let treeEdgeEvent: Graph.TraversalEvent<string, number> | undefined
          let finishEvent: Graph.TraversalEvent<string, number> | undefined

          const visitor: Graph.Visitor<string, number> = (event) => {
            if (event._tag === "DiscoverNode" && !discoverEvent) {
              discoverEvent = event
            }
            if (event._tag === "TreeEdge") {
              treeEdgeEvent = event
            }
            if (event._tag === "FinishNode" && !finishEvent) {
              finishEvent = event
            }
            return "Continue"
          }

          Graph.depthFirstSearch(graph, [0], visitor)

          // Check DiscoverNode event
          expect(discoverEvent).toBeDefined()
          expect(discoverEvent!._tag).toBe("DiscoverNode")
          if (discoverEvent!._tag === "DiscoverNode") {
            expect(discoverEvent!.node).toBe(0)
            expect(discoverEvent!.data).toBe("A")
          }

          // Check TreeEdge event
          expect(treeEdgeEvent).toBeDefined()
          expect(treeEdgeEvent!._tag).toBe("TreeEdge")
          if (treeEdgeEvent!._tag === "TreeEdge") {
            expect(treeEdgeEvent!.edge).toBe(0)
            expect(treeEdgeEvent!.data).toBe(42)
            expect(treeEdgeEvent!.source).toBe(0)
            expect(treeEdgeEvent!.target).toBe(1)
          }

          // Check FinishNode event
          expect(finishEvent).toBeDefined()
          expect(finishEvent!._tag).toBe("FinishNode")
          if (finishEvent!._tag === "FinishNode") {
            expect(finishEvent!.node).toBe(1) // B finishes first (leaf)
            expect(finishEvent!.data).toBe("B")
          }
        })
      })
    })
  })

  describe("Graph Structure Analysis Algorithms (Phase 5A)", () => {
    describe("isAcyclic", () => {
      it("should detect acyclic directed graphs (DAGs)", () => {
        const dag = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
          Graph.addEdge(mutable, b, d, "B->D")
          Graph.addEdge(mutable, c, d, "C->D")
        })

        expect(Graph.isAcyclic(dag)).toBe(true)
      })

      it("should detect cycles in directed graphs", () => {
        const cyclic = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
          Graph.addEdge(mutable, c, a, "C->A") // Creates cycle
        })

        expect(Graph.isAcyclic(cyclic)).toBe(false)
      })

      it("should handle self-loops", () => {
        const selfLoop = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          Graph.addEdge(mutable, a, a, "A->A") // Self-loop
        })

        expect(Graph.isAcyclic(selfLoop)).toBe(false)
      })

      it("should handle disconnected components", () => {
        const disconnected = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A->B") // Component 1: A->B (acyclic)
          Graph.addEdge(mutable, c, d, "C->D") // Component 2: C->D (acyclic)
          // No connections between components
        })

        expect(Graph.isAcyclic(disconnected)).toBe(true)
      })

      it("should detect cycles in one component of disconnected graph", () => {
        const mixedComponents = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A->B") // Component 1: A->B (acyclic)
          Graph.addEdge(mutable, c, d, "C->D") // Component 2: C->D->C (cyclic)
          Graph.addEdge(mutable, d, c, "D->C")
        })

        expect(Graph.isAcyclic(mixedComponents)).toBe(false)
      })

      it("should handle empty graphs", () => {
        const empty = Graph.directed<string, string>()
        expect(Graph.isAcyclic(empty)).toBe(true)
      })

      it("should handle single node graphs", () => {
        const single = Graph.directed<string, string>((mutable) => {
          Graph.addNode(mutable, "A")
        })
        expect(Graph.isAcyclic(single)).toBe(true)
      })
    })

    describe("isBipartite", () => {
      it("should detect bipartite undirected graphs", () => {
        const bipartite = Graph.undirected<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "edge") // Set 1: {A, C}, Set 2: {B, D}
          Graph.addEdge(mutable, b, c, "edge")
          Graph.addEdge(mutable, c, d, "edge")
          Graph.addEdge(mutable, d, a, "edge")
        })

        expect(Graph.isBipartite(bipartite)).toBe(true)
      })

      it("should detect non-bipartite graphs (odd cycles)", () => {
        const triangle = Graph.undirected<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "edge")
          Graph.addEdge(mutable, b, c, "edge")
          Graph.addEdge(mutable, c, a, "edge") // Triangle (3-cycle)
        })

        expect(Graph.isBipartite(triangle)).toBe(false)
      })

      it("should handle path graphs (always bipartite)", () => {
        const path = Graph.undirected<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "edge")
          Graph.addEdge(mutable, b, c, "edge")
          Graph.addEdge(mutable, c, d, "edge")
        })

        expect(Graph.isBipartite(path)).toBe(true)
      })

      it("should handle disconnected components", () => {
        const disconnected = Graph.undirected<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "edge") // Component 1: A-B (bipartite)
          Graph.addEdge(mutable, c, d, "edge") // Component 2: C-D (bipartite)
          // No connections between components
        })

        expect(Graph.isBipartite(disconnected)).toBe(true)
      })

      it("should detect non-bipartite component in disconnected graph", () => {
        const mixedComponents = Graph.undirected<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          const e = Graph.addNode(mutable, "E")
          Graph.addEdge(mutable, a, b, "edge") // Component 1: A-B (bipartite)
          Graph.addEdge(mutable, c, d, "edge") // Component 2: triangle (non-bipartite)
          Graph.addEdge(mutable, d, e, "edge")
          Graph.addEdge(mutable, e, c, "edge")
        })

        expect(Graph.isBipartite(mixedComponents)).toBe(false)
      })

      it("should handle empty graphs", () => {
        const empty = Graph.undirected<string, string>()
        expect(Graph.isBipartite(empty)).toBe(true)
      })

      it("should handle single node graphs", () => {
        const single = Graph.undirected<string, string>((mutable) => {
          Graph.addNode(mutable, "A")
        })
        expect(Graph.isBipartite(single)).toBe(true)
      })

      it("should handle star graphs (always bipartite)", () => {
        const star = Graph.undirected<string, string>((mutable) => {
          const center = Graph.addNode(mutable, "Center")
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, center, a, "edge")
          Graph.addEdge(mutable, center, b, "edge")
          Graph.addEdge(mutable, center, c, "edge")
        })

        expect(Graph.isBipartite(star)).toBe(true)
      })
    })

    describe("connectedComponents", () => {
      it("should find connected components in disconnected undirected graph", () => {
        const graph = Graph.undirected<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addNode(mutable, "E")
          Graph.addEdge(mutable, a, b, "edge") // Component 1: A-B
          Graph.addEdge(mutable, c, d, "edge") // Component 2: C-D
          // E is isolated - Component 3: E
        })

        const components = Graph.connectedComponents(graph)
        expect(components).toHaveLength(3)

        // Sort components by size and first element for deterministic testing
        components.sort((a, b) => a.length - b.length || a[0] - b[0])
        expect(components[0]).toEqual([4]) // E isolated
        expect(components[1]).toHaveLength(2) // A-B or C-D
        expect(components[2]).toHaveLength(2) // A-B or C-D
      })

      it("should handle fully connected component", () => {
        const graph = Graph.undirected<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "edge")
          Graph.addEdge(mutable, b, c, "edge")
          Graph.addEdge(mutable, c, a, "edge")
        })

        const components = Graph.connectedComponents(graph)
        expect(components).toHaveLength(1)
        expect(components[0]).toHaveLength(3)
        expect(components[0].sort()).toEqual([0, 1, 2])
      })

      it("should handle empty graphs", () => {
        const empty = Graph.undirected<string, string>()
        const components = Graph.connectedComponents(empty)
        expect(components).toEqual([])
      })

      it("should handle single node graphs", () => {
        const single = Graph.undirected<string, string>((mutable) => {
          Graph.addNode(mutable, "A")
        })

        const components = Graph.connectedComponents(single)
        expect(components).toEqual([[0]])
      })
    })

    describe("topologicalSort", () => {
      it("should provide valid topological ordering for DAG", () => {
        const dag = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
          Graph.addEdge(mutable, b, d, "B->D")
          Graph.addEdge(mutable, c, d, "C->D")
        })

        const order = Graph.topologicalSort(dag)
        expect(order).not.toBeNull()
        expect(order).toHaveLength(4)

        // Verify topological property: for each edge (u,v), u comes before v
        const indexOf = (node: number) => order!.indexOf(node)
        expect(indexOf(0)).toBeLessThan(indexOf(1)) // A before B
        expect(indexOf(0)).toBeLessThan(indexOf(2)) // A before C
        expect(indexOf(1)).toBeLessThan(indexOf(3)) // B before D
        expect(indexOf(2)).toBeLessThan(indexOf(3)) // C before D
      })

      it("should return null for cyclic graphs", () => {
        const cycle = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
          Graph.addEdge(mutable, c, a, "C->A") // Creates cycle
        })

        const order = Graph.topologicalSort(cycle)
        expect(order).toBeNull()
      })

      it("should handle empty graphs", () => {
        const empty = Graph.directed<string, string>()
        const order = Graph.topologicalSort(empty)
        expect(order).toEqual([])
      })

      it("should handle single node graphs", () => {
        const single = Graph.directed<string, string>((mutable) => {
          Graph.addNode(mutable, "A")
        })

        const order = Graph.topologicalSort(single)
        expect(order).toEqual([0])
      })

      it("should handle disconnected DAG", () => {
        const dag = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A->B") // Component 1: A->B
          Graph.addEdge(mutable, c, d, "C->D") // Component 2: C->D
        })

        const order = Graph.topologicalSort(dag)
        expect(order).not.toBeNull()
        expect(order).toHaveLength(4)

        // Verify topological property
        const indexOf = (node: number) => order!.indexOf(node)
        expect(indexOf(0)).toBeLessThan(indexOf(1)) // A before B
        expect(indexOf(2)).toBeLessThan(indexOf(3)) // C before D
      })
    })

    describe("stronglyConnectedComponents", () => {
      it("should find strongly connected components in directed graph", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
          Graph.addEdge(mutable, c, a, "C->A") // SCC: A-B-C
          Graph.addEdge(mutable, b, d, "B->D") // D is separate
        })

        const sccs = Graph.stronglyConnectedComponents(graph)
        expect(sccs).toHaveLength(2)

        // Sort SCCs by size for deterministic testing
        sccs.sort((a, b) => a.length - b.length)
        expect(sccs[0]).toEqual([3]) // D is alone
        expect(sccs[1]).toHaveLength(3) // A-B-C cycle
        expect(sccs[1].sort()).toEqual([0, 1, 2])
      })

      it("should handle acyclic directed graph (each node is its own SCC)", () => {
        const dag = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        const sccs = Graph.stronglyConnectedComponents(dag)
        expect(sccs).toHaveLength(3)
        // Each SCC should contain exactly one node
        sccs.forEach((scc) => {
          expect(scc).toHaveLength(1)
        })
      })

      it("should handle fully connected components", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          // Create bidirectional edges (fully connected)
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, a, "B->A")
          Graph.addEdge(mutable, b, c, "B->C")
          Graph.addEdge(mutable, c, b, "C->B")
          Graph.addEdge(mutable, a, c, "A->C")
          Graph.addEdge(mutable, c, a, "C->A")
        })

        const sccs = Graph.stronglyConnectedComponents(graph)
        expect(sccs).toHaveLength(1)
        expect(sccs[0]).toHaveLength(3)
        expect(sccs[0].sort()).toEqual([0, 1, 2])
      })

      it("should handle empty graphs", () => {
        const empty = Graph.directed<string, string>()
        const sccs = Graph.stronglyConnectedComponents(empty)
        expect(sccs).toEqual([])
      })

      it("should handle single node graphs", () => {
        const single = Graph.directed<string, string>((mutable) => {
          Graph.addNode(mutable, "A")
        })

        const sccs = Graph.stronglyConnectedComponents(single)
        expect(sccs).toEqual([[0]])
      })

      it("should handle disconnected components with cycles", () => {
        const graph = Graph.directed<string, string>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          // First SCC: A->B->A
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, a, "B->A")
          // Second SCC: C->D->C
          Graph.addEdge(mutable, c, d, "C->D")
          Graph.addEdge(mutable, d, c, "D->C")
        })

        const sccs = Graph.stronglyConnectedComponents(graph)
        expect(sccs).toHaveLength(2)
        sccs.forEach((scc) => {
          expect(scc).toHaveLength(2)
        })
      })
    })
  })
})
