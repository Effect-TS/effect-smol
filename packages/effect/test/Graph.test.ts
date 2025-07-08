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
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A")
      })

      const nonExistent = Graph.getNode(graph, Graph.makeNodeIndex(999))
      expect(Option.isNone(nonExistent)).toBe(true)
    })

    it("should work on both Graph and MutableGraph", () => {
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const graph = Graph.directed<string, number>()
      const result = Graph.getNode(graph, Graph.makeNodeIndex(0))
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe("hasNode", () => {
    it("should return true for existing nodes", () => {
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
      })

      expect(Graph.hasNode(graph, Graph.makeNodeIndex(0))).toBe(true)
      expect(Graph.hasNode(graph, Graph.makeNodeIndex(1))).toBe(true)
    })

    it("should return false for non-existent nodes", () => {
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A")
      })

      expect(Graph.hasNode(graph, Graph.makeNodeIndex(999))).toBe(false)
      expect(Graph.hasNode(graph, Graph.makeNodeIndex(-1))).toBe(false)
    })

    it("should work on both Graph and MutableGraph", () => {
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const graph = Graph.directed<string, number>()
      expect(Graph.hasNode(graph, Graph.makeNodeIndex(0))).toBe(false)
    })
  })

  describe("nodeCount", () => {
    it("should return 0 for empty graph", () => {
      const graph = Graph.directed<string, number>()
      expect(Graph.nodeCount(graph)).toBe(0)
    })

    it("should return correct count after adding nodes", () => {
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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

      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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

      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
        Graph.mutate(Graph.directed<string, number>(), (mutable) => {
          const nodeB = Graph.addNode(mutable, "Node B")
          const nonExistentNode = Graph.makeNodeIndex(999)
          Graph.addEdge(mutable, nonExistentNode, nodeB, 42)
        })
      }).toThrow("Source node 999 does not exist")
    })

    it("should throw error when target node doesn't exist", () => {
      expect(() => {
        Graph.mutate(Graph.directed<string, number>(), (mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nonExistentNode = Graph.makeNodeIndex(999)
          Graph.addEdge(mutable, nodeA, nonExistentNode, 42)
        })
      }).toThrow("Target node 999 does not exist")
    })

    it("should update nextEdgeIndex correctly", () => {
      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
        Graph.addNode(mutable, "Node A") // Just need one node for count
        const nonExistentNode = Graph.makeNodeIndex(999)

        expect(mutable.data.nodeCount).toBe(1)
        Graph.removeNode(mutable, nonExistentNode) // Should not throw
        expect(mutable.data.nodeCount).toBe(1) // Should remain unchanged
      })

      expect(result.data.nodeCount).toBe(1)
    })

    it("should invalidate cycle flag when removing nodes", () => {
      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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

      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        Graph.addEdge(mutable, nodeA, nodeB, 42)

        const nonExistentEdge = Graph.makeEdgeIndex(999)

        expect(mutable.data.edgeCount).toBe(1)
        Graph.removeEdge(mutable, nonExistentEdge) // Should not throw
        expect(mutable.data.edgeCount).toBe(1) // Should remain unchanged
      })

      expect(result.data.edgeCount).toBe(1)
    })

    it("should invalidate cycle flag when removing edges", () => {
      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
        const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nodeB = Graph.addNode(mutable, "Node B")
          Graph.addEdge(mutable, nodeA, nodeB, 42)
        })

        const edgeIndex = Graph.makeEdgeIndex(0)
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
        const edgeIndex = Graph.makeEdgeIndex(999)
        const edgeData = Graph.getEdge(graph, edgeIndex)

        expect(Option.isNone(edgeData)).toBe(true)
      })
    })

    describe("hasEdge", () => {
      it("should return true for existing edge", () => {
        const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nodeB = Graph.addNode(mutable, "Node B")
          Graph.addEdge(mutable, nodeA, nodeB, 42)
        })

        const nodeA = Graph.makeNodeIndex(0)
        const nodeB = Graph.makeNodeIndex(1)

        expect(Graph.hasEdge(graph, nodeA, nodeB)).toBe(true)
      })

      it("should return false for non-existent edge", () => {
        const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nodeB = Graph.addNode(mutable, "Node B")
          Graph.addNode(mutable, "Node C")
          Graph.addEdge(mutable, nodeA, nodeB, 42)
        })

        const nodeA = Graph.makeNodeIndex(0)
        const nodeC = Graph.makeNodeIndex(2)

        expect(Graph.hasEdge(graph, nodeA, nodeC)).toBe(false)
      })

      it("should return false for non-existent source node", () => {
        const graph = Graph.directed<string, number>()
        const nodeA = Graph.makeNodeIndex(0)
        const nodeB = Graph.makeNodeIndex(1)

        expect(Graph.hasEdge(graph, nodeA, nodeB)).toBe(false)
      })
    })

    describe("edgeCount", () => {
      it("should return 0 for empty graph", () => {
        const graph = Graph.directed<string, number>()
        expect(Graph.edgeCount(graph)).toBe(0)
      })

      it("should return correct edge count", () => {
        const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
        const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
          Graph.addNode(mutable, "Node A")
        })

        const nodeA = Graph.makeNodeIndex(0)
        const neighbors = Graph.neighbors(graph, nodeA)

        expect(neighbors).toEqual([])
      })

      it("should return correct neighbors for directed graph", () => {
        const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
          const nodeA = Graph.addNode(mutable, "Node A")
          const nodeB = Graph.addNode(mutable, "Node B")
          const nodeC = Graph.addNode(mutable, "Node C")
          Graph.addEdge(mutable, nodeA, nodeB, 1)
          Graph.addEdge(mutable, nodeA, nodeC, 2)
        })

        const nodeA = Graph.makeNodeIndex(0)
        const nodeB = Graph.makeNodeIndex(1)
        const nodeC = Graph.makeNodeIndex(2)

        const neighborsA = Graph.neighbors(graph, nodeA)
        expect(neighborsA).toContain(nodeB)
        expect(neighborsA).toContain(nodeC)
        expect(neighborsA).toHaveLength(2)

        const neighborsB = Graph.neighbors(graph, nodeB)
        expect(neighborsB).toEqual([])
      })

      it("should return empty array for non-existent node", () => {
        const graph = Graph.directed<string, number>()
        const nodeA = Graph.makeNodeIndex(999)
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
        const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
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
        const graph = Graph.mutate(Graph.undirected<string, number>(), (mutable) => {
          const nodeA = Graph.addNode(mutable, "A")
          const nodeB = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, nodeA, nodeB, 1)
        })

        const dot = Graph.toGraphViz(graph)

        expect(dot).toContain("graph G {")
        expect(dot).toContain("\"0\" -- \"1\" [label=\"1\"];")
      })

      it("should support custom node and edge labels", () => {
        const graph = Graph.mutate(Graph.directed<{ name: string }, { weight: number }>(), (mutable) => {
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
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
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
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
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
        const graph = Graph.mutate(Graph.undirected<string, string>(), (mutable) => {
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

  describe("Walker interfaces and traversal primitives", () => {
    describe("DfsWalker", () => {
      it("should traverse nodes in depth-first order", () => {
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
          Graph.addEdge(mutable, b, d, "B->D")
        })

        const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))
        const visited: Array<Graph.NodeIndex> = []

        let current = walker.next(graph)
        while (Option.isSome(current)) {
          visited.push(current.value)
          current = walker.next(graph)
        }

        // Should visit all nodes
        expect(visited).toHaveLength(4)
        expect(visited).toContain(Graph.makeNodeIndex(0)) // A
        expect(visited).toContain(Graph.makeNodeIndex(1)) // B
        expect(visited).toContain(Graph.makeNodeIndex(2)) // C
        expect(visited).toContain(Graph.makeNodeIndex(3)) // D

        // First node should be the starting node
        expect(visited[0]).toBe(Graph.makeNodeIndex(0))
      })

      it("should handle disconnected graphs", () => {
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addNode(mutable, "D") // Isolated node
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))
        const visited: Array<Graph.NodeIndex> = []

        let current = walker.next(graph)
        while (Option.isSome(current)) {
          visited.push(current.value)
          current = walker.next(graph)
        }

        // Should only visit connected component
        expect(visited).toHaveLength(3)
        expect(visited).toContain(Graph.makeNodeIndex(0)) // A
        expect(visited).toContain(Graph.makeNodeIndex(1)) // B
        expect(visited).toContain(Graph.makeNodeIndex(2)) // C
        expect(visited).not.toContain(Graph.makeNodeIndex(3)) // Isolated D
      })

      it("should support reset functionality", () => {
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, "A->B")
        })

        const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))

        // First traversal
        const first = walker.next(graph)
        expect(Option.isSome(first)).toBe(true)
        if (Option.isSome(first)) {
          expect(first.value).toBe(Graph.makeNodeIndex(0))
        }

        // Reset and traverse again
        walker.reset()
        expect(walker.discovered.size).toBe(0)
        expect(walker.stack).toHaveLength(0)

        walker.moveTo(Graph.makeNodeIndex(0))
        const second = walker.next(graph)
        expect(Option.isSome(second)).toBe(true)
        if (Option.isSome(second)) {
          expect(second.value).toBe(Graph.makeNodeIndex(0))
        }
      })

      it("should support moveTo functionality", () => {
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))

        // Start from different node
        walker.moveTo(Graph.makeNodeIndex(1))
        const first = walker.next(graph)
        expect(Option.isSome(first)).toBe(true)
        if (Option.isSome(first)) {
          expect(first.value).toBe(Graph.makeNodeIndex(1))
        }
      })

      it("should avoid revisiting nodes", () => {
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
          Graph.addEdge(mutable, b, c, "B->C") // Creates multiple paths to C
        })

        const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))
        const visited: Array<Graph.NodeIndex> = []

        let current = walker.next(graph)
        while (Option.isSome(current)) {
          visited.push(current.value)
          current = walker.next(graph)
        }

        // Should visit each node exactly once
        expect(visited).toHaveLength(3)
        expect(new Set(visited).size).toBe(3) // No duplicates
      })
    })

    describe("BfsWalker", () => {
      it("should traverse nodes in breadth-first order", () => {
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
          Graph.addEdge(mutable, b, d, "B->D")
        })

        const walker = new Graph.BfsWalker(Graph.makeNodeIndex(0))
        const visited: Array<Graph.NodeIndex> = []

        let current = walker.next(graph)
        while (Option.isSome(current)) {
          visited.push(current.value)
          current = walker.next(graph)
        }

        // Should visit all nodes
        expect(visited).toHaveLength(4)
        expect(visited).toContain(Graph.makeNodeIndex(0)) // A
        expect(visited).toContain(Graph.makeNodeIndex(1)) // B
        expect(visited).toContain(Graph.makeNodeIndex(2)) // C
        expect(visited).toContain(Graph.makeNodeIndex(3)) // D

        // First node should be the starting node
        expect(visited[0]).toBe(Graph.makeNodeIndex(0))

        // BFS should visit level by level - B and C should come before D
        const indexA = visited.indexOf(Graph.makeNodeIndex(0))
        const indexB = visited.indexOf(Graph.makeNodeIndex(1))
        const indexC = visited.indexOf(Graph.makeNodeIndex(2))
        const indexD = visited.indexOf(Graph.makeNodeIndex(3))

        expect(indexA).toBe(0) // A is first
        expect(Math.min(indexB, indexC)).toBeLessThan(indexD) // B or C before D
      })

      it("should support reset functionality", () => {
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, "A->B")
        })

        const walker = new Graph.BfsWalker(Graph.makeNodeIndex(0))

        // First traversal
        const first = walker.next(graph)
        expect(Option.isSome(first)).toBe(true)
        if (Option.isSome(first)) {
          expect(first.value).toBe(Graph.makeNodeIndex(0))
        }

        // Reset and traverse again
        walker.reset()
        expect(walker.discovered.size).toBe(0)
        expect(walker.stack).toHaveLength(0)

        walker.moveTo(Graph.makeNodeIndex(0))
        const second = walker.next(graph)
        expect(Option.isSome(second)).toBe(true)
        if (Option.isSome(second)) {
          expect(second.value).toBe(Graph.makeNodeIndex(0))
        }
      })

      it("should support moveTo functionality", () => {
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, b, c, "B->C")
        })

        const walker = new Graph.BfsWalker(Graph.makeNodeIndex(0))

        // Start from different node
        walker.moveTo(Graph.makeNodeIndex(1))
        const first = walker.next(graph)
        expect(Option.isSome(first)).toBe(true)
        if (Option.isSome(first)) {
          expect(first.value).toBe(Graph.makeNodeIndex(1))
        }
      })

      it("should work with empty graphs", () => {
        const graph = Graph.directed<string, string>()
        const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))

        const result = walker.next(graph)
        expect(Option.isNone(result)).toBe(true)
      })

      it("should work with single node", () => {
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
          Graph.addNode(mutable, "A")
        })

        const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))
        const visited: Array<Graph.NodeIndex> = []

        let current = walker.next(graph)
        while (Option.isSome(current)) {
          visited.push(current.value)
          current = walker.next(graph)
        }

        expect(visited).toEqual([Graph.makeNodeIndex(0)])
      })
    })

    describe("walkNodes utility", () => {
      it("should convert DfsWalker to iterable", () => {
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A->B")
          Graph.addEdge(mutable, a, c, "A->C")
        })

        const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))
        const iterable = Graph.walkNodes(graph, walker)

        // Use for-of loop
        const visited: Array<Graph.NodeIndex> = []
        for (const node of iterable) {
          visited.push(node)
        }

        expect(visited).toHaveLength(3)
        expect(visited).toContain(Graph.makeNodeIndex(0))
        expect(visited).toContain(Graph.makeNodeIndex(1))
        expect(visited).toContain(Graph.makeNodeIndex(2))
      })

      it("should work with Array.from", () => {
        const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, "A->B")
        })

        const walker = new Graph.BfsWalker(Graph.makeNodeIndex(0))
        const nodes = Array.from(Graph.walkNodes(graph, walker))

        expect(nodes).toEqual([Graph.makeNodeIndex(0), Graph.makeNodeIndex(1)])
      })

      it("should handle empty traversal", () => {
        const graph = Graph.directed<string, string>()
        const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))
        const nodes = Array.from(Graph.walkNodes(graph, walker))

        expect(nodes).toEqual([])
      })
    })

    describe("walker with undirected graphs", () => {
      it("should traverse undirected graph correctly", () => {
        const graph = Graph.mutate(Graph.undirected<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, "A-B")
          Graph.addEdge(mutable, b, c, "B-C")
        })

        const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))
        const visited = Array.from(Graph.walkNodes(graph, walker))

        expect(visited).toHaveLength(3)
        expect(visited).toContain(Graph.makeNodeIndex(0))
        expect(visited).toContain(Graph.makeNodeIndex(1))
        expect(visited).toContain(Graph.makeNodeIndex(2))
      })

      it("should traverse BFS on undirected graph", () => {
        const graph = Graph.mutate(Graph.undirected<string, string>(), (mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")
          Graph.addEdge(mutable, a, b, "A-B")
          Graph.addEdge(mutable, a, c, "A-C")
          Graph.addEdge(mutable, b, d, "B-D")
        })

        const walker = new Graph.BfsWalker(Graph.makeNodeIndex(0))
        const visited = Array.from(Graph.walkNodes(graph, walker))

        expect(visited).toHaveLength(4)
        expect(visited[0]).toBe(Graph.makeNodeIndex(0)) // Should start with A
      })
    })
  })
})
