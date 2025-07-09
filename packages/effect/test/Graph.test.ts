import * as Equal from "effect/Equal"
import * as Graph from "effect/Graph"
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

    it("should work as map keys", () => {
      const map = new Map<Graph.NodeIndex, string>()
      const nodeIndex1 = 42
      const nodeIndex2 = 42 // Same value

      map.set(nodeIndex1, "first")
      map.set(nodeIndex2, "second") // Should overwrite

      expect(map.size).toBe(1)

      const result1 = map.get(nodeIndex1)
      const result2 = map.get(nodeIndex2)

      expect(result1).toBe("second")
      expect(result2).toBe("second")
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

    it("should work as map keys", () => {
      const map = new Map<Graph.EdgeIndex, string>()
      const edgeIndex1 = 123
      const edgeIndex2 = 123 // Same value

      map.set(edgeIndex1, "first")
      map.set(edgeIndex2, "second") // Should overwrite

      expect(map.size).toBe(1)

      const result1 = map.get(edgeIndex1)
      const result2 = map.get(edgeIndex2)

      expect(result1).toBe("second")
      expect(result2).toBe("second")
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

      expect(graph.type).toBe("directed")
    })

    it("should create an empty graph with correct mutable marker", () => {
      const graph = Graph.directed<string, number>()

      expect(graph._mutable).toBe(false)
    })

    it("should create an empty graph with initialized data structures", () => {
      const graph = Graph.directed<string, number>()

      expect(graph.data.nextNodeIndex).toBe(0)
      expect(graph.data.nextEdgeIndex).toBe(0)
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
      expect(graph.type).toBe("undirected")
      expect(graph._mutable).toBe(false)
      expect(graph.data.nodeCount).toBe(0)
      expect(graph.data.edgeCount).toBe(0)
      expect(graph.data.isAcyclic).toBe(true)
    })

    it("should distinguish between directed and undirected graphs", () => {
      const directedGraph = Graph.directed<string, number>()
      const undirectedGraph = Graph.undirected<string, number>()

      expect(directedGraph.type).toBe("directed")
      expect(undirectedGraph.type).toBe("undirected")
      expect(directedGraph).not.toEqual(undirectedGraph)
    })
  })

  describe("beginMutation", () => {
    it("should create a mutable graph from an immutable graph", () => {
      const graph = Graph.directed<string, number>()
      const mutable = Graph.beginMutation(graph)

      expect(mutable[Graph.TypeId]).toBe("~effect/Graph")
      expect(mutable._mutable).toBe(true)
      expect(mutable.type).toBe("directed")
    })

    it("should copy all data structures properly", () => {
      const graph = Graph.directed<string, number>()
      const mutable = Graph.beginMutation(graph)

      expect(mutable.data.nodeCount).toBe(graph.data.nodeCount)
      expect(mutable.data.edgeCount).toBe(graph.data.edgeCount)
      expect(mutable.data.nextNodeIndex).toBe(graph.data.nextNodeIndex)
      expect(mutable.data.nextEdgeIndex).toBe(graph.data.nextEdgeIndex)
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
  })

  describe("endMutation", () => {
    it("should convert a mutable graph back to immutable", () => {
      const graph = Graph.directed<string, number>()
      const mutable = Graph.beginMutation(graph)
      const result = Graph.endMutation(mutable)

      expect(result[Graph.TypeId]).toBe("~effect/Graph")
      expect(result._mutable).toBe(false)
      expect(result.type).toBe("directed")
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
        const adjacencyList = mutable.data.adjacency.get(nodeIndex)
        const reverseAdjacencyList = mutable.data.reverseAdjacency.get(nodeIndex)

        expect(adjacencyList).toEqual([])
        expect(reverseAdjacencyList).toEqual([])
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

  describe("findNode", () => {
    it("should find node by predicate", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
        Graph.addNode(mutable, "Node C")
      })

      const result = Graph.findNode(graph, (data) => data === "Node B")
      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value).toBe(1)
      }
    })

    it("should return None when no node matches", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
      })

      const result = Graph.findNode(graph, (data) => data === "Node C")
      expect(Option.isNone(result)).toBe(true)
    })

    it("should find first matching node when multiple match", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Start A")
        Graph.addNode(mutable, "Start B")
        Graph.addNode(mutable, "Start C")
      })

      const result = Graph.findNode(graph, (data) => data.startsWith("Start"))
      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value).toBe(0) // First matching node
      }
    })

    it("should work with complex predicates", () => {
      const graph = Graph.directed<{ name: string; value: number }, number>((mutable) => {
        Graph.addNode(mutable, { name: "A", value: 10 })
        Graph.addNode(mutable, { name: "B", value: 20 })
        Graph.addNode(mutable, { name: "C", value: 30 })
      })

      const result = Graph.findNode(graph, (data) => data.value > 15 && data.value < 25)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value).toBe(1)
        const nodeData = Graph.getNode(graph, result.value)
        if (Option.isSome(nodeData)) {
          expect(nodeData.value.name).toBe("B")
          expect(nodeData.value.value).toBe(20)
        }
      }
    })

    it("should work on empty graph", () => {
      const graph = Graph.directed<string, number>()
      const result = Graph.findNode(graph, () => true)
      expect(Option.isNone(result)).toBe(true)
    })

    it("should work on both Graph and MutableGraph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
      })

      // Test on immutable graph
      const result1 = Graph.findNode(graph, (data) => data === "Node A")
      expect(Option.isSome(result1)).toBe(true)

      // Test on mutable graph
      Graph.mutate(graph, (mutable) => {
        const result2 = Graph.findNode(mutable, (data) => data === "Node B")
        expect(Option.isSome(result2)).toBe(true)
        if (Option.isSome(result2)) {
          expect(result2.value).toBe(1)
        }
      })
    })
  })

  describe("findNodes", () => {
    it("should find all matching nodes", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Start A")
        Graph.addNode(mutable, "Node B")
        Graph.addNode(mutable, "Start C")
        Graph.addNode(mutable, "Start D")
      })

      const result = Graph.findNodes(graph, (data) => data.startsWith("Start"))
      expect(result).toEqual([0, 2, 3])
    })

    it("should return empty array when no nodes match", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
      })

      const result = Graph.findNodes(graph, (data) => data === "Node C")
      expect(result).toEqual([])
    })

    it("should return all nodes when predicate is always true", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
        Graph.addNode(mutable, "Node C")
      })

      const result = Graph.findNodes(graph, () => true)
      expect(result).toEqual([0, 1, 2])
    })

    it("should work with complex predicates", () => {
      const graph = Graph.directed<{ name: string; value: number }, number>((mutable) => {
        Graph.addNode(mutable, { name: "A", value: 10 })
        Graph.addNode(mutable, { name: "B", value: 20 })
        Graph.addNode(mutable, { name: "C", value: 30 })
        Graph.addNode(mutable, { name: "D", value: 25 })
      })

      const result = Graph.findNodes(graph, (data) => data.value >= 20)
      expect(result).toEqual([1, 2, 3])
    })

    it("should return empty array for empty graph", () => {
      const graph = Graph.directed<string, number>()
      const result = Graph.findNodes(graph, () => true)
      expect(result).toEqual([])
    })

    it("should work on both Graph and MutableGraph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Type A")
        Graph.addNode(mutable, "Type B")
        Graph.addNode(mutable, "Type A")
      })

      // Test on immutable graph
      const result1 = Graph.findNodes(graph, (data) => data === "Type A")
      expect(result1).toEqual([0, 2])

      // Test on mutable graph
      Graph.mutate(graph, (mutable) => {
        const result2 = Graph.findNodes(mutable, (data) => data === "Type A")
        expect(result2).toEqual([0, 2])
      })
    })
  })

  describe("findEdge", () => {
    it("should find edge by predicate", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const nodeC = Graph.addNode(mutable, "Node C")
        Graph.addEdge(mutable, nodeA, nodeB, 10)
        Graph.addEdge(mutable, nodeB, nodeC, 20)
      })

      const result = Graph.findEdge(graph, (data) => data === 20)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value).toBe(1)
      }
    })

    it("should return None when no edge matches", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        Graph.addEdge(mutable, nodeA, nodeB, 10)
      })

      const result = Graph.findEdge(graph, (data) => data === 99)
      expect(Option.isNone(result)).toBe(true)
    })

    it("should find first matching edge when multiple match", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const nodeC = Graph.addNode(mutable, "Node C")
        Graph.addEdge(mutable, nodeA, nodeB, 15)
        Graph.addEdge(mutable, nodeB, nodeC, 25)
        Graph.addEdge(mutable, nodeC, nodeA, 35)
      })

      const result = Graph.findEdge(graph, (data) => data > 20)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value).toBe(1) // First matching edge
      }
    })

    it("should work with complex predicates using source and target", () => {
      const graph = Graph.directed<string, { value: number; name: string }>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const nodeC = Graph.addNode(mutable, "Node C")
        Graph.addEdge(mutable, nodeA, nodeB, { value: 10, name: "edge1" })
        Graph.addEdge(mutable, nodeB, nodeC, { value: 20, name: "edge2" })
      })

      const result = Graph.findEdge(graph, (data, source, target) => data.value > 15 && source === 1 && target === 2)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value).toBe(1)
        const edgeData = Graph.getEdge(graph, result.value)
        if (Option.isSome(edgeData)) {
          expect(edgeData.value.data.name).toBe("edge2")
        }
      }
    })

    it("should work on empty graph", () => {
      const graph = Graph.directed<string, number>()
      const result = Graph.findEdge(graph, () => true)
      expect(Option.isNone(result)).toBe(true)
    })

    it("should work on both Graph and MutableGraph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        Graph.addEdge(mutable, nodeA, nodeB, 42)
      })

      // Test on immutable graph
      const result1 = Graph.findEdge(graph, (data) => data === 42)
      expect(Option.isSome(result1)).toBe(true)

      // Test on mutable graph
      Graph.mutate(graph, (mutable) => {
        const result2 = Graph.findEdge(mutable, (data) => data === 42)
        expect(Option.isSome(result2)).toBe(true)
        if (Option.isSome(result2)) {
          expect(result2.value).toBe(0)
        }
      })
    })
  })

  describe("findEdges", () => {
    it("should find all matching edges", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const nodeC = Graph.addNode(mutable, "Node C")
        Graph.addEdge(mutable, nodeA, nodeB, 10)
        Graph.addEdge(mutable, nodeB, nodeC, 20)
        Graph.addEdge(mutable, nodeC, nodeA, 30)
        Graph.addEdge(mutable, nodeA, nodeC, 25)
      })

      const result = Graph.findEdges(graph, (data) => data >= 20)
      expect(result).toEqual([1, 2, 3])
    })

    it("should return empty array when no edges match", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        Graph.addEdge(mutable, nodeA, nodeB, 10)
      })

      const result = Graph.findEdges(graph, (data) => data > 100)
      expect(result).toEqual([])
    })

    it("should return all edges when predicate is always true", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const nodeC = Graph.addNode(mutable, "Node C")
        Graph.addEdge(mutable, nodeA, nodeB, 10)
        Graph.addEdge(mutable, nodeB, nodeC, 20)
        Graph.addEdge(mutable, nodeC, nodeA, 30)
      })

      const result = Graph.findEdges(graph, () => true)
      expect(result).toEqual([0, 1, 2])
    })

    it("should work with complex predicates using source and target", () => {
      const graph = Graph.directed<string, { value: number; name: string }>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const nodeC = Graph.addNode(mutable, "Node C")
        Graph.addEdge(mutable, nodeA, nodeB, { value: 10, name: "edge1" })
        Graph.addEdge(mutable, nodeB, nodeC, { value: 20, name: "edge2" })
        Graph.addEdge(mutable, nodeC, nodeA, { value: 30, name: "edge3" })
      })

      const result = Graph.findEdges(
        graph,
        (data, source, target) => data.value >= 20 && (source === 1 || target === 0)
      )
      expect(result).toEqual([1, 2])
    })

    it("should work on empty graph", () => {
      const graph = Graph.directed<string, number>()
      const result = Graph.findEdges(graph, () => true)
      expect(result).toEqual([])
    })

    it("should work on both Graph and MutableGraph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const nodeC = Graph.addNode(mutable, "Node C")
        Graph.addEdge(mutable, nodeA, nodeB, 42)
        Graph.addEdge(mutable, nodeB, nodeC, 42)
      })

      // Test on immutable graph
      const result1 = Graph.findEdges(graph, (data) => data === 42)
      expect(result1).toEqual([0, 1])

      // Test on mutable graph
      Graph.mutate(graph, (mutable) => {
        const result2 = Graph.findEdges(mutable, (data) => data === 42)
        expect(result2).toEqual([0, 1])
      })
    })
  })

  describe("updateNode", () => {
    it("should update node data", () => {
      const updated = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
        Graph.updateNode(mutable, 0, (data) => data.toUpperCase())
      })

      const nodeData = Graph.getNode(updated, 0)
      expect(Option.isSome(nodeData)).toBe(true)
      if (Option.isSome(nodeData)) {
        expect(nodeData.value).toBe("NODE A")
      }
    })

    it("should do nothing if node doesn't exist", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.updateNode(mutable, 999, (data) => data.toUpperCase())
      })

      // Original node should be unchanged
      const nodeData = Graph.getNode(graph, 0)
      expect(Option.isSome(nodeData)).toBe(true)
      if (Option.isSome(nodeData)) {
        expect(nodeData.value).toBe("Node A")
      }
    })

    it("should work with complex node data", () => {
      const graph = Graph.directed<{ name: string; value: number }, number>((mutable) => {
        Graph.addNode(mutable, { name: "Node A", value: 10 })
        Graph.addNode(mutable, { name: "Node B", value: 20 })
        Graph.updateNode(mutable, 1, (data) => ({
          ...data,
          value: data.value * 2
        }))
      })

      const nodeData = Graph.getNode(graph, 1)
      expect(Option.isSome(nodeData)).toBe(true)
      if (Option.isSome(nodeData)) {
        expect(nodeData.value.name).toBe("Node B")
        expect(nodeData.value.value).toBe(40)
      }
    })

    it("should preserve other nodes", () => {
      const updated = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B")
        Graph.addNode(mutable, "Node C")
        Graph.updateNode(mutable, 1, (data) => data.toLowerCase())
      })

      // Check that node 1 is updated
      const node1Data = Graph.getNode(updated, 1)
      expect(Option.isSome(node1Data)).toBe(true)
      if (Option.isSome(node1Data)) {
        expect(node1Data.value).toBe("node b")
      }

      // Check that other nodes are unchanged
      const node0Data = Graph.getNode(updated, 0)
      const node2Data = Graph.getNode(updated, 2)
      expect(Option.isSome(node0Data)).toBe(true)
      expect(Option.isSome(node2Data)).toBe(true)
      if (Option.isSome(node0Data) && Option.isSome(node2Data)) {
        expect(node0Data.value).toBe("Node A")
        expect(node2Data.value).toBe("Node C")
      }
    })

    it("should preserve edges", () => {
      const updated = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        Graph.addEdge(mutable, nodeA, nodeB, 42)
        Graph.updateNode(mutable, 0, (data) => data.toUpperCase())
      })

      // Check that edge still exists
      const edgeData = Graph.getEdge(updated, 0)
      expect(Option.isSome(edgeData)).toBe(true)
      if (Option.isSome(edgeData)) {
        expect(edgeData.value.source).toBe(0)
        expect(edgeData.value.target).toBe(1)
        expect(edgeData.value.data).toBe(42)
      }
    })

    it("should work on empty graph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.updateNode(mutable, 0, (data) => data.toUpperCase())
      })

      // Should still be empty since node 0 doesn't exist
      expect(Graph.nodeCount(graph)).toBe(0)
    })
  })

  describe("updateEdge", () => {
    it("should update edge data", () => {
      const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const edgeIndex = Graph.addEdge(mutable, nodeA, nodeB, 10)
        Graph.updateEdge(mutable, edgeIndex, (data) => data * 2)
      })

      const edgeData = Graph.getEdge(result, 0)
      expect(Option.isSome(edgeData)).toBe(true)
      if (Option.isSome(edgeData)) {
        expect(edgeData.value.source).toBe(0)
        expect(edgeData.value.target).toBe(1)
        expect(edgeData.value.data).toBe(20)
      }
    })

    it("should do nothing if edge doesn't exist", () => {
      Graph.mutate(Graph.directed<string, number>(), (mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        const nodeB = Graph.addNode(mutable, "Node B")
        const edgeIndex = Graph.addEdge(mutable, nodeA, nodeB, 10)

        // Try to update non-existent edge
        Graph.updateEdge(mutable, 999, (data) => data * 2)

        // Original edge should be unchanged
        const edgeData = Graph.getEdge(mutable, edgeIndex)
        expect(Option.isSome(edgeData)).toBe(true)
        if (Option.isSome(edgeData)) {
          expect(edgeData.value.data).toBe(10)
        }
      })
    })

    //     it("should work with complex edge data", () => {
    //       const graph = Graph.directed<string, { weight: number; label: string }>((mutable) => {
    //         const nodeA = Graph.addNode(mutable, "Node A")
    //         const nodeB = Graph.addNode(mutable, "Node B")
    //         Graph.addEdge(mutable, nodeA, nodeB, { weight: 10, label: "edge1" })
    //       })
    //
    //       const updated = Graph.updateEdge(graph, 0, 1, (data) => ({
    //         ...data,
    //         weight: data.weight * 3
    //       }))
    //
    //       const edgeData = Graph.getEdge(updated, 0)
    //       expect(Option.isSome(edgeData)).toBe(true)
    //       if (Option.isSome(edgeData)) {
    //         expect(edgeData.value.data.weight).toBe(30)
    //         expect(edgeData.value.data.label).toBe("edge1")
    //       }
    //     })
    //
    //     it("should preserve other edges", () => {
    //       const graph = Graph.directed<string, number>((mutable) => {
    //         const nodeA = Graph.addNode(mutable, "Node A")
    //         const nodeB = Graph.addNode(mutable, "Node B")
    //         const nodeC = Graph.addNode(mutable, "Node C")
    //         Graph.addEdge(mutable, nodeA, nodeB, 10)
    //         Graph.addEdge(mutable, nodeB, nodeC, 20)
    //         Graph.addEdge(mutable, nodeC, nodeA, 30)
    //       })
    //
    //       const updated = Graph.updateEdge(graph, 1, 2, (data) => data * 2)
    //
    //       // Check that edge 1 is updated
    //       const edge1Data = Graph.getEdge(updated, 1)
    //       expect(Option.isSome(edge1Data)).toBe(true)
    //       if (Option.isSome(edge1Data)) {
    //         expect(edge1Data.value.data).toBe(40)
    //       }
    //
    //       // Check that other edges are unchanged
    //       const edge0Data = Graph.getEdge(updated, 0)
    //       const edge2Data = Graph.getEdge(updated, 2)
    //       expect(Option.isSome(edge0Data)).toBe(true)
    //       expect(Option.isSome(edge2Data)).toBe(true)
    //       if (Option.isSome(edge0Data) && Option.isSome(edge2Data)) {
    //         expect(edge0Data.value.data).toBe(10)
    //         expect(edge2Data.value.data).toBe(30)
    //       }
    //     })
    //
    //     it("should preserve nodes", () => {
    //       const graph = Graph.directed<string, number>((mutable) => {
    //         const nodeA = Graph.addNode(mutable, "Node A")
    //         const nodeB = Graph.addNode(mutable, "Node B")
    //         Graph.addEdge(mutable, nodeA, nodeB, 42)
    //       })
    //
    //       const updated = Graph.updateEdge(graph, 0, 1, (data) => data * 2)
    //
    //       // Check that nodes are unchanged
    //       const nodeAData = Graph.getNode(updated, 0)
    //       const nodeBData = Graph.getNode(updated, 1)
    //       expect(Option.isSome(nodeAData)).toBe(true)
    //       expect(Option.isSome(nodeBData)).toBe(true)
    //       if (Option.isSome(nodeAData) && Option.isSome(nodeBData)) {
    //         expect(nodeAData.value).toBe("Node A")
    //         expect(nodeBData.value).toBe("Node B")
    //       }
    //     })
    //
    //     it("should work with multiple edges between same nodes", () => {
    //       const graph = Graph.directed<string, number>((mutable) => {
    //         const nodeA = Graph.addNode(mutable, "Node A")
    //         const nodeB = Graph.addNode(mutable, "Node B")
    //         Graph.addEdge(mutable, nodeA, nodeB, 10)
    //         Graph.addEdge(mutable, nodeA, nodeB, 20)
    //       })
    //
    //       // Should update the first edge found
    //       const updated = Graph.updateEdge(graph, 0, 1, (data) => data * 2)
    //       const edge0Data = Graph.getEdge(updated, 0)
    //       const edge1Data = Graph.getEdge(updated, 1)
    //
    //       expect(Option.isSome(edge0Data)).toBe(true)
    //       expect(Option.isSome(edge1Data)).toBe(true)
    //       if (Option.isSome(edge0Data) && Option.isSome(edge1Data)) {
    //         expect(edge0Data.value.data).toBe(20) // First edge updated
    //         expect(edge1Data.value.data).toBe(20) // Second edge unchanged
    //       }
    //     })
    //
    //     it("should work on empty graph", () => {
    //       const graph = Graph.directed<string, number>()
    //       const updated = Graph.updateEdge(graph, 0, 1, (data) => data * 2)
    //       expect(updated).toBe(graph)
    //     })
  })

  describe("mapNodes", () => {
    it("should transform all node data", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "node a")
        Graph.addNode(mutable, "node b")
        Graph.addNode(mutable, "node c")
        Graph.mapNodes(mutable, (data) => data.toUpperCase())
      })

      const nodeA = Graph.getNode(graph, 0)
      const nodeB = Graph.getNode(graph, 1)
      const nodeC = Graph.getNode(graph, 2)

      expect(Option.isSome(nodeA)).toBe(true)
      expect(Option.isSome(nodeB)).toBe(true)
      expect(Option.isSome(nodeC)).toBe(true)

      if (Option.isSome(nodeA) && Option.isSome(nodeB) && Option.isSome(nodeC)) {
        expect(nodeA.value).toBe("NODE A")
        expect(nodeB.value).toBe("NODE B")
        expect(nodeC.value).toBe("NODE C")
      }
    })

    it("should preserve graph structure", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "node a")
        const nodeB = Graph.addNode(mutable, "node b")
        Graph.addEdge(mutable, nodeA, nodeB, 42)
        Graph.mapNodes(mutable, (data) => data.toUpperCase())
      })

      // Check that edges are preserved
      const edgeData = Graph.getEdge(graph, 0)
      expect(Option.isSome(edgeData)).toBe(true)
      if (Option.isSome(edgeData)) {
        expect(edgeData.value.source).toBe(0)
        expect(edgeData.value.target).toBe(1)
        expect(edgeData.value.data).toBe(42)
      }

      // Check that graph metadata is preserved
      expect(Graph.nodeCount(graph)).toBe(2)
      expect(Graph.edgeCount(graph)).toBe(1)
    })

    it("should apply transformation to all nodes", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "first")
        Graph.addNode(mutable, "second")
        Graph.addNode(mutable, "third")
        Graph.mapNodes(mutable, (data) => data + " (transformed)")
      })

      const node0 = Graph.getNode(graph, 0)
      const node1 = Graph.getNode(graph, 1)
      const node2 = Graph.getNode(graph, 2)

      expect(Option.isSome(node0)).toBe(true)
      expect(Option.isSome(node1)).toBe(true)
      expect(Option.isSome(node2)).toBe(true)

      if (Option.isSome(node0) && Option.isSome(node1) && Option.isSome(node2)) {
        expect(node0.value).toBe("first (transformed)")
        expect(node1.value).toBe("second (transformed)")
        expect(node2.value).toBe("third (transformed)")
      }
    })

    it("should work with complex data types", () => {
      const graph = Graph.directed<{ name: string; value: number }, number>((mutable) => {
        Graph.addNode(mutable, { name: "A", value: 10 })
        Graph.addNode(mutable, { name: "B", value: 20 })
        Graph.mapNodes(mutable, (data) => ({
          ...data,
          value: data.value * 2
        }))
      })

      const nodeA = Graph.getNode(graph, 0)
      const nodeB = Graph.getNode(graph, 1)

      expect(Option.isSome(nodeA)).toBe(true)
      expect(Option.isSome(nodeB)).toBe(true)

      if (Option.isSome(nodeA) && Option.isSome(nodeB)) {
        expect(nodeA.value).toEqual({ name: "A", value: 20 })
        expect(nodeB.value).toEqual({ name: "B", value: 40 })
      }
    })

    it("should handle empty graph", () => {
      const mapped = Graph.directed<string, number>((mutable) => {
        Graph.mapNodes(mutable, (data) => data.toUpperCase())
      })

      expect(Graph.nodeCount(mapped)).toBe(0)
      expect(Graph.edgeCount(mapped)).toBe(0)
    })

    it("should modify graph in place during construction", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "original")
        // Before transformation
        const beforeData = Graph.getNode(mutable, 0)
        expect(Option.isSome(beforeData)).toBe(true)
        if (Option.isSome(beforeData)) {
          expect(beforeData.value).toBe("original")
        }

        // Apply transformation
        Graph.mapNodes(mutable, (data) => data.toUpperCase())
      })

      // After transformation
      const afterData = Graph.getNode(graph, 0)
      expect(Option.isSome(afterData)).toBe(true)
      if (Option.isSome(afterData)) {
        expect(afterData.value).toBe("ORIGINAL")
      }
    })
  })

  describe("mapEdges", () => {
    it("should transform all edge data", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        const c = Graph.addNode(mutable, "C")
        Graph.addEdge(mutable, a, b, 10)
        Graph.addEdge(mutable, b, c, 20)
        Graph.addEdge(mutable, c, a, 30)
        Graph.mapEdges(mutable, (data) => data * 2)
      })

      const edge0 = Graph.getEdge(graph, 0)
      const edge1 = Graph.getEdge(graph, 1)
      const edge2 = Graph.getEdge(graph, 2)

      expect(Option.isSome(edge0)).toBe(true)
      expect(Option.isSome(edge1)).toBe(true)
      expect(Option.isSome(edge2)).toBe(true)

      if (Option.isSome(edge0) && Option.isSome(edge1) && Option.isSome(edge2)) {
        expect(edge0.value.data).toBe(20)
        expect(edge1.value.data).toBe(40)
        expect(edge2.value.data).toBe(60)
      }
    })

    it("should preserve graph structure", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        Graph.addEdge(mutable, a, b, 42)
        Graph.mapEdges(mutable, (data) => data + 100)
      })

      // Check that edge structure is preserved
      const edgeData = Graph.getEdge(graph, 0)
      expect(Option.isSome(edgeData)).toBe(true)
      if (Option.isSome(edgeData)) {
        expect(edgeData.value.source).toBe(0)
        expect(edgeData.value.target).toBe(1)
        expect(edgeData.value.data).toBe(142)
      }

      // Check that nodes are preserved
      expect(Graph.nodeCount(graph)).toBe(2)
      expect(Graph.edgeCount(graph)).toBe(1)

      const nodeA = Graph.getNode(graph, 0)
      const nodeB = Graph.getNode(graph, 1)
      expect(Option.isSome(nodeA)).toBe(true)
      expect(Option.isSome(nodeB)).toBe(true)
      if (Option.isSome(nodeA) && Option.isSome(nodeB)) {
        expect(nodeA.value).toBe("A")
        expect(nodeB.value).toBe("B")
      }
    })

    it("should work with complex data types", () => {
      const graph = Graph.directed<string, { weight: number; type: string }>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        Graph.addEdge(mutable, a, b, { weight: 10, type: "primary" })
        Graph.mapEdges(mutable, (data) => ({
          ...data,
          weight: data.weight * 3
        }))
      })

      const edgeData = Graph.getEdge(graph, 0)
      expect(Option.isSome(edgeData)).toBe(true)
      if (Option.isSome(edgeData)) {
        expect(edgeData.value.data).toEqual({ weight: 30, type: "primary" })
      }
    })

    it("should handle empty graph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.mapEdges(mutable, (data) => data * 2)
      })

      expect(Graph.nodeCount(graph)).toBe(0)
      expect(Graph.edgeCount(graph)).toBe(0)
    })

    it("should modify graph in place during construction", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        Graph.addEdge(mutable, a, b, 10)

        // Before transformation
        const beforeData = Graph.getEdge(mutable, 0)
        expect(Option.isSome(beforeData)).toBe(true)
        if (Option.isSome(beforeData)) {
          expect(beforeData.value.data).toBe(10)
        }

        // Apply transformation
        Graph.mapEdges(mutable, (data) => data * 5)
      })

      // After transformation
      const afterData = Graph.getEdge(graph, 0)
      expect(Option.isSome(afterData)).toBe(true)
      if (Option.isSome(afterData)) {
        expect(afterData.value.data).toBe(50)
      }
    })
  })

  describe("reverse", () => {
    it("should reverse all edge directions", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        const c = Graph.addNode(mutable, "C")
        Graph.addEdge(mutable, a, b, 1) // A -> B
        Graph.addEdge(mutable, b, c, 2) // B -> C
        Graph.addEdge(mutable, c, a, 3) // C -> A
        Graph.reverse(mutable) // Now B -> A, C -> B, A -> C
      })

      const edge0 = Graph.getEdge(graph, 0)
      const edge1 = Graph.getEdge(graph, 1)
      const edge2 = Graph.getEdge(graph, 2)

      expect(Option.isSome(edge0)).toBe(true)
      expect(Option.isSome(edge1)).toBe(true)
      expect(Option.isSome(edge2)).toBe(true)

      if (Option.isSome(edge0) && Option.isSome(edge1) && Option.isSome(edge2)) {
        // Edge 0: was A(0) -> B(1), now B(1) -> A(0)
        expect(edge0.value.source).toBe(1)
        expect(edge0.value.target).toBe(0)
        expect(edge0.value.data).toBe(1)

        // Edge 1: was B(1) -> C(2), now C(2) -> B(1)
        expect(edge1.value.source).toBe(2)
        expect(edge1.value.target).toBe(1)
        expect(edge1.value.data).toBe(2)

        // Edge 2: was C(2) -> A(0), now A(0) -> C(2)
        expect(edge2.value.source).toBe(0)
        expect(edge2.value.target).toBe(2)
        expect(edge2.value.data).toBe(3)
      }
    })

    it("should update adjacency lists correctly", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        const c = Graph.addNode(mutable, "C")
        Graph.addEdge(mutable, a, b, 1) // A -> B
        Graph.addEdge(mutable, a, c, 2) // A -> C
        Graph.reverse(mutable) // Now B -> A, C -> A
      })

      // After reversal:
      // - Node A should have no outgoing edges
      // - Node B should have edge to A
      // - Node C should have edge to A

      const neighborsA = Graph.neighbors(graph, 0)
      const neighborsB = Graph.neighbors(graph, 1)
      const neighborsC = Graph.neighbors(graph, 2)

      expect(Array.from(neighborsA)).toEqual([]) // A has no outgoing edges
      expect(Array.from(neighborsB)).toEqual([0]) // B -> A
      expect(Array.from(neighborsC)).toEqual([0]) // C -> A
    })

    it("should preserve edge data", () => {
      const graph = Graph.directed<string, { weight: number; type: string }>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        Graph.addEdge(mutable, a, b, { weight: 42, type: "primary" })
        Graph.reverse(mutable)
      })

      const edgeData = Graph.getEdge(graph, 0)
      expect(Option.isSome(edgeData)).toBe(true)
      if (Option.isSome(edgeData)) {
        expect(edgeData.value.source).toBe(1) // Now B -> A
        expect(edgeData.value.target).toBe(0)
        expect(edgeData.value.data).toEqual({ weight: 42, type: "primary" })
      }
    })

    it("should handle empty graph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.reverse(mutable)
      })

      expect(Graph.nodeCount(graph)).toBe(0)
      expect(Graph.edgeCount(graph)).toBe(0)
    })

    it("should handle graph with nodes but no edges", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "A")
        Graph.addNode(mutable, "B")
        Graph.reverse(mutable)
      })

      expect(Graph.nodeCount(graph)).toBe(2)
      expect(Graph.edgeCount(graph)).toBe(0)

      const neighborsA = Graph.neighbors(graph, 0)
      const neighborsB = Graph.neighbors(graph, 1)
      expect(Array.from(neighborsA)).toEqual([])
      expect(Array.from(neighborsB)).toEqual([])
    })

    it("should handle self-loops", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        Graph.addEdge(mutable, a, a, 42) // A -> A (self-loop)
        Graph.reverse(mutable) // Still A -> A
      })

      const edgeData = Graph.getEdge(graph, 0)
      expect(Option.isSome(edgeData)).toBe(true)
      if (Option.isSome(edgeData)) {
        expect(edgeData.value.source).toBe(0) // Still A -> A
        expect(edgeData.value.target).toBe(0)
        expect(edgeData.value.data).toBe(42)
      }
    })

    it("should invalidate cycle flag", () => {
      Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        Graph.addEdge(mutable, a, b, 1)

        // Force cycle flag to be computed (making it non-null)
        Graph.isAcyclic(mutable)

        // Now the flag should be set to true (since A -> B is acyclic)
        expect(mutable.data.isAcyclic).toBe(true)

        Graph.reverse(mutable)

        // The cycle flag should be invalidated (null) after reversal
        expect(mutable.data.isAcyclic).toBe(null)
      })
    })
  })

  describe("filterMapNodes", () => {
    it("should filter and transform nodes", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "active")
        Graph.addNode(mutable, "inactive")
        Graph.addNode(mutable, "active")
        Graph.addNode(mutable, "pending")

        // Keep only "active" nodes and transform to uppercase
        Graph.filterMapNodes(mutable, (data) => data === "active" ? Option.some(data.toUpperCase()) : Option.none())
      })

      // Should only have 2 nodes remaining (the "active" ones)
      expect(Graph.nodeCount(graph)).toBe(2)

      // Check the remaining nodes have been transformed
      const nodeData0 = Graph.getNode(graph, 0)
      const nodeData2 = Graph.getNode(graph, 2)

      expect(Option.isSome(nodeData0)).toBe(true)
      expect(Option.isSome(nodeData2)).toBe(true)

      if (Option.isSome(nodeData0) && Option.isSome(nodeData2)) {
        expect(nodeData0.value).toBe("ACTIVE")
        expect(nodeData2.value).toBe("ACTIVE")
      }

      // Filtered out nodes should not exist
      expect(Option.isNone(Graph.getNode(graph, 1))).toBe(true)
      expect(Option.isNone(Graph.getNode(graph, 3))).toBe(true)
    })

    it("should remove edges connected to filtered nodes", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "keep")
        const b = Graph.addNode(mutable, "remove")
        const c = Graph.addNode(mutable, "keep")

        Graph.addEdge(mutable, a, b, 1) // keep -> remove
        Graph.addEdge(mutable, b, c, 2) // remove -> keep
        Graph.addEdge(mutable, a, c, 3) // keep -> keep

        // Filter out "remove" nodes
        Graph.filterMapNodes(mutable, (data) => data === "keep" ? Option.some(data) : Option.none())
      })

      // Should have 2 nodes and 1 edge remaining
      expect(Graph.nodeCount(graph)).toBe(2)
      expect(Graph.edgeCount(graph)).toBe(1)

      // Only the keep -> keep edge should remain
      const remainingEdge = Graph.getEdge(graph, 2)
      expect(Option.isSome(remainingEdge)).toBe(true)
      if (Option.isSome(remainingEdge)) {
        expect(remainingEdge.value.source).toBe(0)
        expect(remainingEdge.value.target).toBe(2)
        expect(remainingEdge.value.data).toBe(3)
      }

      // Edges involving removed node should be gone
      expect(Option.isNone(Graph.getEdge(graph, 0))).toBe(true)
      expect(Option.isNone(Graph.getEdge(graph, 1))).toBe(true)
    })

    it("should handle transformation without filtering", () => {
      const graph = Graph.directed<number, string>((mutable) => {
        Graph.addNode(mutable, 1)
        Graph.addNode(mutable, 2)
        Graph.addNode(mutable, 3)

        // Transform all nodes by doubling them
        Graph.filterMapNodes(mutable, (data) => Option.some(data * 2))
      })

      expect(Graph.nodeCount(graph)).toBe(3)

      const node0 = Graph.getNode(graph, 0)
      const node1 = Graph.getNode(graph, 1)
      const node2 = Graph.getNode(graph, 2)

      expect(Option.isSome(node0)).toBe(true)
      expect(Option.isSome(node1)).toBe(true)
      expect(Option.isSome(node2)).toBe(true)

      if (Option.isSome(node0) && Option.isSome(node1) && Option.isSome(node2)) {
        expect(node0.value).toBe(2)
        expect(node1.value).toBe(4)
        expect(node2.value).toBe(6)
      }
    })

    it("should handle filtering without transformation", () => {
      const graph = Graph.directed<number, string>((mutable) => {
        Graph.addNode(mutable, 1)
        Graph.addNode(mutable, 2)
        Graph.addNode(mutable, 3)
        Graph.addNode(mutable, 4)

        // Keep only even numbers
        Graph.filterMapNodes(mutable, (data) => data % 2 === 0 ? Option.some(data) : Option.none())
      })

      expect(Graph.nodeCount(graph)).toBe(2)

      const node1 = Graph.getNode(graph, 1)
      const node3 = Graph.getNode(graph, 3)

      expect(Option.isSome(node1)).toBe(true)
      expect(Option.isSome(node3)).toBe(true)

      if (Option.isSome(node1) && Option.isSome(node3)) {
        expect(node1.value).toBe(2)
        expect(node3.value).toBe(4)
      }

      // Odd numbers should be removed
      expect(Option.isNone(Graph.getNode(graph, 0))).toBe(true)
      expect(Option.isNone(Graph.getNode(graph, 2))).toBe(true)
    })

    it("should handle removing all nodes", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "A")
        Graph.addNode(mutable, "B")
        Graph.addEdge(mutable, 0, 1, 42)

        // Remove all nodes
        Graph.filterMapNodes(mutable, (_) => Option.none())
      })

      expect(Graph.nodeCount(graph)).toBe(0)
      expect(Graph.edgeCount(graph)).toBe(0)
    })

    it("should handle empty graph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.filterMapNodes(mutable, (data) => Option.some(data.toUpperCase()))
      })

      expect(Graph.nodeCount(graph)).toBe(0)
      expect(Graph.edgeCount(graph)).toBe(0)
    })
  })

  describe("filterMapEdges", () => {
    it("should filter and transform edges", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        const c = Graph.addNode(mutable, "C")
        Graph.addEdge(mutable, a, b, 5) // Remove (< 10)
        Graph.addEdge(mutable, b, c, 15) // Keep and double (30)
        Graph.addEdge(mutable, c, a, 25) // Keep and double (50)

        // Keep only edges with weight >= 10 and double their weight
        Graph.filterMapEdges(mutable, (data) => data >= 10 ? Option.some(data * 2) : Option.none())
      })

      // Should have 2 edges remaining
      expect(Graph.edgeCount(graph)).toBe(2)
      expect(Graph.nodeCount(graph)).toBe(3) // All nodes should remain

      // Check that remaining edges have been transformed
      const edge1 = Graph.getEdge(graph, 1)
      const edge2 = Graph.getEdge(graph, 2)

      expect(Option.isSome(edge1)).toBe(true)
      expect(Option.isSome(edge2)).toBe(true)

      if (Option.isSome(edge1) && Option.isSome(edge2)) {
        expect(edge1.value.data).toBe(30) // 15 * 2
        expect(edge2.value.data).toBe(50) // 25 * 2
      }

      // Filtered out edge should not exist
      expect(Option.isNone(Graph.getEdge(graph, 0))).toBe(true)
    })

    it("should update adjacency lists when removing edges", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        const c = Graph.addNode(mutable, "C")

        Graph.addEdge(mutable, a, b, 1) // Keep
        Graph.addEdge(mutable, a, c, 2) // Remove
        Graph.addEdge(mutable, b, c, 3) // Keep

        // Keep only odd numbers
        Graph.filterMapEdges(mutable, (data) => data % 2 === 1 ? Option.some(data) : Option.none())
      })

      // Should have 2 edges remaining (1 and 3)
      expect(Graph.edgeCount(graph)).toBe(2)

      // Check adjacency: A should only connect to B now
      const neighborsA = Array.from(Graph.neighbors(graph, 0))
      expect(neighborsA).toEqual([1]) // A -> B only

      // Check that B still connects to C
      const neighborsB = Array.from(Graph.neighbors(graph, 1))
      expect(neighborsB).toEqual([2]) // B -> C

      // Check that C has no outgoing edges
      const neighborsC = Array.from(Graph.neighbors(graph, 2))
      expect(neighborsC).toEqual([]) // C has no outgoing edges
    })

    it("should handle transformation without filtering", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        const c = Graph.addNode(mutable, "C")
        Graph.addEdge(mutable, a, b, 10)
        Graph.addEdge(mutable, b, c, 20)
        Graph.addEdge(mutable, c, a, 30)

        // Transform all edges by adding 100
        Graph.filterMapEdges(mutable, (data) => Option.some(data + 100))
      })

      expect(Graph.edgeCount(graph)).toBe(3)

      const edge0 = Graph.getEdge(graph, 0)
      const edge1 = Graph.getEdge(graph, 1)
      const edge2 = Graph.getEdge(graph, 2)

      expect(Option.isSome(edge0)).toBe(true)
      expect(Option.isSome(edge1)).toBe(true)
      expect(Option.isSome(edge2)).toBe(true)

      if (Option.isSome(edge0) && Option.isSome(edge1) && Option.isSome(edge2)) {
        expect(edge0.value.data).toBe(110)
        expect(edge1.value.data).toBe(120)
        expect(edge2.value.data).toBe(130)
      }
    })

    it("should handle filtering without transformation", () => {
      const graph = Graph.directed<string, { weight: number; type: string }>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        const c = Graph.addNode(mutable, "C")
        Graph.addEdge(mutable, a, b, { weight: 10, type: "primary" })
        Graph.addEdge(mutable, b, c, { weight: 20, type: "secondary" })
        Graph.addEdge(mutable, c, a, { weight: 30, type: "primary" })

        // Keep only "primary" edges
        Graph.filterMapEdges(mutable, (data) => data.type === "primary" ? Option.some(data) : Option.none())
      })

      expect(Graph.edgeCount(graph)).toBe(2)

      const edge0 = Graph.getEdge(graph, 0)
      const edge2 = Graph.getEdge(graph, 2)

      expect(Option.isSome(edge0)).toBe(true)
      expect(Option.isSome(edge2)).toBe(true)

      if (Option.isSome(edge0) && Option.isSome(edge2)) {
        expect(edge0.value.data.type).toBe("primary")
        expect(edge2.value.data.type).toBe("primary")
      }

      // Secondary edge should be removed
      expect(Option.isNone(Graph.getEdge(graph, 1))).toBe(true)
    })

    it("should handle removing all edges", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        Graph.addEdge(mutable, a, b, 42)
        Graph.addEdge(mutable, b, a, 24)

        // Remove all edges
        Graph.filterMapEdges(mutable, (_) => Option.none())
      })

      expect(Graph.nodeCount(graph)).toBe(2) // Nodes remain
      expect(Graph.edgeCount(graph)).toBe(0) // All edges removed

      // No neighbor connections should exist
      expect(Array.from(Graph.neighbors(graph, 0))).toEqual([])
      expect(Array.from(Graph.neighbors(graph, 1))).toEqual([])
    })

    it("should handle empty graph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.filterMapEdges(mutable, (data) => Option.some(data * 2))
      })

      expect(Graph.nodeCount(graph)).toBe(0)
      expect(Graph.edgeCount(graph)).toBe(0)
    })

    it("should preserve node data when filtering edges", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "Node A")
        const b = Graph.addNode(mutable, "Node B")
        Graph.addEdge(mutable, a, b, 100)

        // Remove all edges but keep nodes
        Graph.filterMapEdges(mutable, (_) => Option.none())
      })

      expect(Graph.nodeCount(graph)).toBe(2)
      expect(Graph.edgeCount(graph)).toBe(0)

      const nodeA = Graph.getNode(graph, 0)
      const nodeB = Graph.getNode(graph, 1)

      expect(Option.isSome(nodeA)).toBe(true)
      expect(Option.isSome(nodeB)).toBe(true)

      if (Option.isSome(nodeA) && Option.isSome(nodeB)) {
        expect(nodeA.value).toBe("Node A")
        expect(nodeB.value).toBe("Node B")
      }
    })
  })

  describe("filterNodes", () => {
    it("should filter nodes by predicate", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.addNode(mutable, "active")
        Graph.addNode(mutable, "inactive")
        Graph.addNode(mutable, "active")
        Graph.addNode(mutable, "pending")

        // Keep only "active" nodes
        Graph.filterNodes(mutable, (data) => data === "active")
      })

      expect(Graph.nodeCount(graph)).toBe(2)

      const node0 = Graph.getNode(graph, 0)
      const node2 = Graph.getNode(graph, 2)

      expect(Option.isSome(node0)).toBe(true)
      expect(Option.isSome(node2)).toBe(true)

      if (Option.isSome(node0) && Option.isSome(node2)) {
        expect(node0.value).toBe("active")
        expect(node2.value).toBe("active")
      }

      // Filtered out nodes should be removed
      expect(Option.isNone(Graph.getNode(graph, 1))).toBe(true) // "inactive"
      expect(Option.isNone(Graph.getNode(graph, 3))).toBe(true) // "pending"
    })

    it("should remove connected edges when filtering nodes", () => {
      const graph = Graph.directed<string, string>((mutable) => {
        const a = Graph.addNode(mutable, "keep")
        const b = Graph.addNode(mutable, "remove")
        const c = Graph.addNode(mutable, "keep")

        Graph.addEdge(mutable, a, b, "A-B")
        Graph.addEdge(mutable, b, c, "B-C")
        Graph.addEdge(mutable, a, c, "A-C")

        // Remove node "remove"
        Graph.filterNodes(mutable, (data) => data === "keep")
      })

      expect(Graph.nodeCount(graph)).toBe(2) // Only "keep" nodes remain
      expect(Graph.edgeCount(graph)).toBe(1) // Only A-C edge remains

      // Check remaining edge
      const edge2 = Graph.getEdge(graph, 2)
      expect(Option.isSome(edge2)).toBe(true)
      if (Option.isSome(edge2)) {
        expect(edge2.value.data).toBe("A-C")
      }

      // Check removed edges
      expect(Option.isNone(Graph.getEdge(graph, 0))).toBe(true) // A-B removed
      expect(Option.isNone(Graph.getEdge(graph, 1))).toBe(true) // B-C removed
    })

    it("should handle removing all nodes", () => {
      const graph = Graph.directed<string, string>((mutable) => {
        Graph.addNode(mutable, "A")
        Graph.addNode(mutable, "B")
        const a = 0
        const b = 1
        Graph.addEdge(mutable, a, b, "edge")

        // Remove all nodes
        Graph.filterNodes(mutable, () => false)
      })

      expect(Graph.nodeCount(graph)).toBe(0)
      expect(Graph.edgeCount(graph)).toBe(0)
    })

    it("should handle empty graph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.filterNodes(mutable, (data) => data.length > 0)
      })

      expect(Graph.nodeCount(graph)).toBe(0)
      expect(Graph.edgeCount(graph)).toBe(0)
    })

    it("should keep all nodes when predicate returns true", () => {
      const graph = Graph.directed<number, string>((mutable) => {
        Graph.addNode(mutable, 1)
        Graph.addNode(mutable, 2)
        Graph.addNode(mutable, 3)

        // Keep all nodes
        Graph.filterNodes(mutable, () => true)
      })

      expect(Graph.nodeCount(graph)).toBe(3)

      const node0 = Graph.getNode(graph, 0)
      const node1 = Graph.getNode(graph, 1)
      const node2 = Graph.getNode(graph, 2)

      expect(Option.isSome(node0)).toBe(true)
      expect(Option.isSome(node1)).toBe(true)
      expect(Option.isSome(node2)).toBe(true)

      if (Option.isSome(node0) && Option.isSome(node1) && Option.isSome(node2)) {
        expect(node0.value).toBe(1)
        expect(node1.value).toBe(2)
        expect(node2.value).toBe(3)
      }
    })
  })

  describe("filterEdges", () => {
    it("should filter edges by predicate", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        const c = Graph.addNode(mutable, "C")

        Graph.addEdge(mutable, a, b, 5)
        Graph.addEdge(mutable, b, c, 15)
        Graph.addEdge(mutable, c, a, 25)

        // Keep only edges with weight >= 10
        Graph.filterEdges(mutable, (data) => data >= 10)
      })

      expect(Graph.nodeCount(graph)).toBe(3) // All nodes remain
      expect(Graph.edgeCount(graph)).toBe(2) // Edge with weight 5 removed

      const edge1 = Graph.getEdge(graph, 1)
      const edge2 = Graph.getEdge(graph, 2)

      expect(Option.isSome(edge1)).toBe(true)
      expect(Option.isSome(edge2)).toBe(true)

      if (Option.isSome(edge1) && Option.isSome(edge2)) {
        expect(edge1.value.data).toBe(15)
        expect(edge2.value.data).toBe(25)
      }

      // Edge with weight 5 should be removed
      expect(Option.isNone(Graph.getEdge(graph, 0))).toBe(true)
    })

    it("should update adjacency lists when filtering edges", () => {
      const graph = Graph.directed<string, string>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        const c = Graph.addNode(mutable, "C")

        Graph.addEdge(mutable, a, b, "primary")
        Graph.addEdge(mutable, a, c, "secondary")
        Graph.addEdge(mutable, b, c, "primary")

        // Keep only "primary" edges
        Graph.filterEdges(mutable, (data) => data === "primary")
      })

      expect(Graph.edgeCount(graph)).toBe(2)

      // Check adjacency - A should only connect to B now
      const neighborsA = Array.from(Graph.neighbors(graph, 0))
      expect(neighborsA).toEqual([1]) // A -> B only

      const neighborsB = Array.from(Graph.neighbors(graph, 1))
      expect(neighborsB).toEqual([2]) // B -> C

      const neighborsC = Array.from(Graph.neighbors(graph, 2))
      expect(neighborsC).toEqual([]) // C has no outgoing edges
    })

    it("should handle removing all edges", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        Graph.addEdge(mutable, a, b, 10)
        Graph.addEdge(mutable, b, a, 20)

        // Remove all edges
        Graph.filterEdges(mutable, () => false)
      })

      expect(Graph.nodeCount(graph)).toBe(2) // Nodes remain
      expect(Graph.edgeCount(graph)).toBe(0) // All edges removed

      // No neighbor connections should exist
      expect(Array.from(Graph.neighbors(graph, 0))).toEqual([])
      expect(Array.from(Graph.neighbors(graph, 1))).toEqual([])
    })

    it("should handle empty graph", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        Graph.filterEdges(mutable, (data) => data > 0)
      })

      expect(Graph.nodeCount(graph)).toBe(0)
      expect(Graph.edgeCount(graph)).toBe(0)
    })

    it("should keep all edges when predicate returns true", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "A")
        const b = Graph.addNode(mutable, "B")
        const c = Graph.addNode(mutable, "C")

        Graph.addEdge(mutable, a, b, 10)
        Graph.addEdge(mutable, b, c, 20)
        Graph.addEdge(mutable, c, a, 30)

        // Keep all edges
        Graph.filterEdges(mutable, () => true)
      })

      expect(Graph.edgeCount(graph)).toBe(3)

      const edge0 = Graph.getEdge(graph, 0)
      const edge1 = Graph.getEdge(graph, 1)
      const edge2 = Graph.getEdge(graph, 2)

      expect(Option.isSome(edge0)).toBe(true)
      expect(Option.isSome(edge1)).toBe(true)
      expect(Option.isSome(edge2)).toBe(true)

      if (Option.isSome(edge0) && Option.isSome(edge1) && Option.isSome(edge2)) {
        expect(edge0.value.data).toBe(10)
        expect(edge1.value.data).toBe(20)
        expect(edge2.value.data).toBe(30)
      }
    })

    it("should preserve node data when filtering edges", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const a = Graph.addNode(mutable, "Node A")
        const b = Graph.addNode(mutable, "Node B")
        Graph.addEdge(mutable, a, b, 100)

        // Remove all edges
        Graph.filterEdges(mutable, () => false)
      })

      expect(Graph.edgeCount(graph)).toBe(0)

      const nodeA = Graph.getNode(graph, 0)
      const nodeB = Graph.getNode(graph, 1)

      expect(Option.isSome(nodeA)).toBe(true)
      expect(Option.isSome(nodeB)).toBe(true)

      if (Option.isSome(nodeA) && Option.isSome(nodeB)) {
        expect(nodeA.value).toBe("Node A")
        expect(nodeB.value).toBe("Node B")
      }
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
        const sourceAdjacency = mutable.data.adjacency.get(nodeA)
        const targetReverseAdjacency = mutable.data.reverseAdjacency.get(nodeB)

        expect(sourceAdjacency).toContain(edgeIndex)
        expect(targetReverseAdjacency).toContain(edgeIndex)
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

        // Reset for testing - set to acyclic state
        mutable.data.isAcyclic = true

        Graph.removeNode(mutable, nodeA)

        expect(mutable.data.isAcyclic).toBe(true) // Not invalidated - removing from acyclic graph stays acyclic
      })

      expect(result.data.isAcyclic).toBe(true)
    })

    it("should remove adjacency lists for the removed node", () => {
      const graph = Graph.directed<string, number>((mutable) => {
        const nodeA = Graph.addNode(mutable, "Node A")
        Graph.addNode(mutable, "Node B") // Just need second node for final count

        // Verify adjacency lists exist
        expect(mutable.data.adjacency.has(nodeA)).toBe(true)
        expect(mutable.data.reverseAdjacency.has(nodeA)).toBe(true)

        Graph.removeNode(mutable, nodeA)

        // Verify adjacency lists are removed
        expect(mutable.data.adjacency.has(nodeA)).toBe(false)
        expect(mutable.data.reverseAdjacency.has(nodeA)).toBe(false)
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
        const sourceAdjacency = mutable.data.adjacency.get(nodeA)
        const targetReverseAdjacency = mutable.data.reverseAdjacency.get(nodeB)

        expect(sourceAdjacency).toContain(edgeIndex)
        expect(targetReverseAdjacency).toContain(edgeIndex)

        Graph.removeEdge(mutable, edgeIndex)

        // Verify edge is removed from adjacency lists
        const sourceAdjacencyAfter = mutable.data.adjacency.get(nodeA)
        const targetReverseAdjacencyAfter = mutable.data.reverseAdjacency.get(nodeB)

        expect(sourceAdjacencyAfter).not.toContain(edgeIndex)
        expect(targetReverseAdjacencyAfter).not.toContain(edgeIndex)
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
        const edge2Data = mutable.data.edges.get(edge2)
        expect(edge2Data).toBeDefined()
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

    describe("dijkstra", () => {
      it("should find shortest path in simple graph", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 5)
          Graph.addEdge(mutable, a, c, 10)
          Graph.addEdge(mutable, b, c, 2)
        })

        const result = Graph.dijkstra(graph, 0, 2, (edgeData) => edgeData)
        expect(result).not.toBeNull()
        expect(result!.path).toEqual([0, 1, 2])
        expect(result!.distance).toBe(7)
        expect(result!.edgeWeights).toEqual([5, 2])
      })

      it("should return null for unreachable nodes", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          // No path from A to C
        })

        const result = Graph.dijkstra(graph, 0, 2, (edgeData) => edgeData)
        expect(result).toBeNull()
      })

      it("should handle same source and target", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          Graph.addNode(mutable, "A")
        })

        const result = Graph.dijkstra(graph, 0, 0, (edgeData) => edgeData)
        expect(result).not.toBeNull()
        expect(result!.path).toEqual([0])
        expect(result!.distance).toBe(0)
        expect(result!.edgeWeights).toEqual([])
      })

      it("should throw for negative weights", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, -1)
        })

        expect(() => Graph.dijkstra(graph, 0, 1, (edgeData) => edgeData)).toThrow(
          "Dijkstra's algorithm requires non-negative edge weights"
        )
      })

      it("should throw for non-existent nodes", () => {
        const graph = Graph.directed<string, number>()

        expect(() => Graph.dijkstra(graph, 0, 1, (edgeData) => edgeData)).toThrow(
          "Source node 0 does not exist"
        )
      })
    })

    describe("astar", () => {
      it("should find shortest path with heuristic", () => {
        const graph = Graph.directed<{ x: number; y: number }, number>((mutable) => {
          const a = Graph.addNode(mutable, { x: 0, y: 0 })
          const b = Graph.addNode(mutable, { x: 1, y: 0 })
          const c = Graph.addNode(mutable, { x: 2, y: 0 })
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 1)
        })

        const heuristic = (source: { x: number; y: number }, target: { x: number; y: number }) =>
          Math.abs(source.x - target.x) + Math.abs(source.y - target.y)

        const result = Graph.astar(graph, 0, 2, (edgeData) => edgeData, heuristic)
        expect(result).not.toBeNull()
        expect(result!.path).toEqual([0, 1, 2])
        expect(result!.distance).toBe(2)
        expect(result!.edgeWeights).toEqual([1, 1])
      })

      it("should return null for unreachable nodes", () => {
        const graph = Graph.directed<{ x: number; y: number }, number>((mutable) => {
          const a = Graph.addNode(mutable, { x: 0, y: 0 })
          const b = Graph.addNode(mutable, { x: 1, y: 0 })
          Graph.addNode(mutable, { x: 2, y: 0 })
          Graph.addEdge(mutable, a, b, 1)
          // No path from A to C
        })

        const heuristic = (source: { x: number; y: number }, target: { x: number; y: number }) =>
          Math.abs(source.x - target.x) + Math.abs(source.y - target.y)

        const result = Graph.astar(graph, 0, 2, (edgeData) => edgeData, heuristic)
        expect(result).toBeNull()
      })

      it("should handle same source and target", () => {
        const graph = Graph.directed<{ x: number; y: number }, number>((mutable) => {
          Graph.addNode(mutable, { x: 0, y: 0 })
        })

        const heuristic = (source: { x: number; y: number }, target: { x: number; y: number }) =>
          Math.abs(source.x - target.x) + Math.abs(source.y - target.y)

        const result = Graph.astar(graph, 0, 0, (edgeData) => edgeData, heuristic)
        expect(result).not.toBeNull()
        expect(result!.path).toEqual([0])
        expect(result!.distance).toBe(0)
        expect(result!.edgeWeights).toEqual([])
      })

      it("should throw for negative weights", () => {
        const graph = Graph.directed<{ x: number; y: number }, number>((mutable) => {
          const a = Graph.addNode(mutable, { x: 0, y: 0 })
          const b = Graph.addNode(mutable, { x: 1, y: 0 })
          Graph.addEdge(mutable, a, b, -1)
        })

        const heuristic = (source: { x: number; y: number }, target: { x: number; y: number }) =>
          Math.abs(source.x - target.x) + Math.abs(source.y - target.y)

        expect(() => Graph.astar(graph, 0, 1, (edgeData) => edgeData, heuristic)).toThrow(
          "A* algorithm requires non-negative edge weights"
        )
      })
    })

    describe("bellmanFord", () => {
      it("should find shortest path with negative weights", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, -1)
          Graph.addEdge(mutable, b, c, 3)
          Graph.addEdge(mutable, a, c, 5)
        })

        const result = Graph.bellmanFord(graph, 0, 2, (edgeData) => edgeData)
        expect(result).not.toBeNull()
        expect(result!.path).toEqual([0, 1, 2])
        expect(result!.distance).toBe(2)
        expect(result!.edgeWeights).toEqual([-1, 3])
      })

      it("should return null for unreachable nodes", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          // No path from A to C
        })

        const result = Graph.bellmanFord(graph, 0, 2, (edgeData) => edgeData)
        expect(result).toBeNull()
      })

      it("should handle same source and target", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          Graph.addNode(mutable, "A")
        })

        const result = Graph.bellmanFord(graph, 0, 0, (edgeData) => edgeData)
        expect(result).not.toBeNull()
        expect(result!.path).toEqual([0])
        expect(result!.distance).toBe(0)
        expect(result!.edgeWeights).toEqual([])
      })

      it("should detect negative cycles", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, -3)
          Graph.addEdge(mutable, c, a, 1)
        })

        const result = Graph.bellmanFord(graph, 0, 2, (edgeData) => edgeData)
        expect(result).toBeNull()
      })
    })

    describe("floydWarshall", () => {
      it("should find all-pairs shortest paths", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 3)
          Graph.addEdge(mutable, b, c, 2)
          Graph.addEdge(mutable, a, c, 7)
        })

        const result = Graph.floydWarshall(graph, (edgeData) => edgeData)

        // Check distance A to C (should be 5 via B, not 7 direct)
        expect(result.distances.get(0)?.get(2)).toBe(5)
        expect(result.paths.get(0)?.get(2)).toEqual([0, 1, 2])
        expect(result.edgeWeights.get(0)?.get(2)).toEqual([3, 2])

        // Check distance A to B
        expect(result.distances.get(0)?.get(1)).toBe(3)
        expect(result.paths.get(0)?.get(1)).toEqual([0, 1])

        // Check distance B to C
        expect(result.distances.get(1)?.get(2)).toBe(2)
        expect(result.paths.get(1)?.get(2)).toEqual([1, 2])
      })

      it("should handle unreachable nodes", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          // No path from A to C
        })

        const result = Graph.floydWarshall(graph, (edgeData) => edgeData)

        expect(result.distances.get(0)?.get(2)).toBe(Infinity)
        expect(result.paths.get(0)?.get(2)).toBeNull()
      })

      it("should handle same source and target", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          Graph.addNode(mutable, "A")
        })

        const result = Graph.floydWarshall(graph, (edgeData) => edgeData)

        expect(result.distances.get(0)?.get(0)).toBe(0)
        expect(result.paths.get(0)?.get(0)).toEqual([0])
        expect(result.edgeWeights.get(0)?.get(0)).toEqual([])
      })

      it("should detect negative cycles", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, -3)
          Graph.addEdge(mutable, c, a, 1)
        })

        expect(() => Graph.floydWarshall(graph, (edgeData) => edgeData)).toThrow("Negative cycle detected")
      })

      it("should handle empty graph", () => {
        const graph = Graph.directed<string, number>()

        const result = Graph.floydWarshall(graph, (edgeData) => edgeData)

        expect(result.distances.size).toBe(0)
        expect(result.paths.size).toBe(0)
        expect(result.edgeWeights.size).toBe(0)
      })
    })

    describe("Iterator Base Methods", () => {
      it("should provide values() method for DFS iterator", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
        })

        const dfsIterator = Graph.dfs(graph, { startNodes: [0] })
        const values = Array.from(Graph.values(dfsIterator))

        expect(values).toEqual(["A", "B", "C"])
      })

      it("should provide entries() method for DFS iterator", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
        })

        const dfsIterator = Graph.dfs(graph, { startNodes: [0] })
        const entries = Array.from(Graph.entries(dfsIterator))

        expect(entries).toEqual([[0, "A"], [1, "B"], [2, "C"]])
      })

      it("should provide values() method for BFS iterator", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, a, c, 2)
        })

        const bfsIterator = Graph.bfs(graph, { startNodes: [0] })
        const values = Array.from(Graph.values(bfsIterator))

        expect(values).toEqual(["A", "B", "C"])
      })

      it("should provide entries() method for BFS iterator", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, a, c, 2)
        })

        const bfsIterator = Graph.bfs(graph, { startNodes: [0] })
        const entries = Array.from(Graph.entries(bfsIterator))

        expect(entries).toEqual([[0, "A"], [1, "B"], [2, "C"]])
      })

      it("should provide values() method for Topo iterator", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
        })

        const topoIterator = Graph.topo(graph)

        const values = Array.from(Graph.values(topoIterator))
        expect(values).toEqual(["A", "B", "C"])
      })

      it("should provide entries() method for Topo iterator", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
        })

        const topoIterator = Graph.topo(graph)

        const entries = Array.from(Graph.entries(topoIterator))
        expect(entries).toEqual([[0, "A"], [1, "B"], [2, "C"]])
      })

      it("should throw for cyclic graphs", () => {
        const cyclicGraph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, a, 2) // Creates cycle
        })

        expect(() => Graph.topo(cyclicGraph)).toThrow("Cannot perform topological sort on cyclic graph")
      })

      it("should provide values() method for DfsPostOrder iterator", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
        })

        const dfsPostIterator = Graph.dfsPostOrder(graph, { startNodes: [0] })
        const values = Array.from(Graph.values(dfsPostIterator))

        expect(values).toEqual(["C", "B", "A"]) // Postorder: children before parents
      })

      it("should provide entries() method for DfsPostOrder iterator", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
        })

        const dfsPostIterator = Graph.dfsPostOrder(graph, { startNodes: [0] })
        const entries = Array.from(Graph.entries(dfsPostIterator))

        expect(entries).toEqual([[2, "C"], [1, "B"], [0, "A"]]) // Postorder: children before parents
      })
    })

    describe("DfsPostOrder Iterator", () => {
      it("should traverse in postorder for simple chain", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
        })

        const postOrder = Array.from(Graph.indices(Graph.dfsPostOrder(graph, { startNodes: [0] })))
        expect(postOrder).toEqual([2, 1, 0]) // Children before parents
      })

      it("should traverse in postorder for branching tree", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const root = Graph.addNode(mutable, "root") // 0
          const left = Graph.addNode(mutable, "left") // 1
          const right = Graph.addNode(mutable, "right") // 2
          const leaf1 = Graph.addNode(mutable, "leaf1") // 3
          const leaf2 = Graph.addNode(mutable, "leaf2") // 4

          Graph.addEdge(mutable, root, left, 1)
          Graph.addEdge(mutable, root, right, 2)
          Graph.addEdge(mutable, left, leaf1, 3)
          Graph.addEdge(mutable, right, leaf2, 4)
        })

        const postOrder = Array.from(Graph.indices(Graph.dfsPostOrder(graph, { startNodes: [0] })))
        // Should visit leaves first, then parents
        expect(postOrder).toEqual([3, 1, 4, 2, 0])
      })

      it("should handle empty start nodes", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          Graph.addNode(mutable, "A")
        })

        const postOrder = Array.from(Graph.dfsPostOrder(graph, { startNodes: [] }))
        expect(postOrder).toEqual([])
      })

      it("should handle single node", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          Graph.addNode(mutable, "A")
        })

        const postOrder = Array.from(Graph.indices(Graph.dfsPostOrder(graph, { startNodes: [0] })))
        expect(postOrder).toEqual([0])
      })

      it("should handle disconnected components with multiple start nodes", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          const d = Graph.addNode(mutable, "D")

          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, c, d, 2)
          // No connection between (A,B) and (C,D)
        })

        const postOrder = Array.from(Graph.indices(Graph.dfsPostOrder(graph, { startNodes: [0, 2] })))
        expect(postOrder).toEqual([1, 0, 3, 2]) // Each component in postorder
      })

      it("should support incoming direction", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
        })

        // Starting from C, going backwards
        const postOrder = Array.from(
          Graph.indices(Graph.dfsPostOrder(graph, {
            startNodes: [2],
            direction: "incoming"
          }))
        )
        expect(postOrder).toEqual([0, 1, 2]) // A, B, C in reverse postorder
      })

      it("should handle cycles correctly", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
          Graph.addEdge(mutable, c, a, 3) // Creates cycle
        })

        const postOrder = Array.from(Graph.indices(Graph.dfsPostOrder(graph, { startNodes: [0] })))
        // Should handle cycle without infinite loop, visiting each node once
        expect(postOrder.length).toBe(3)
        expect(new Set(postOrder)).toEqual(new Set([0, 1, 2]))
      })

      it("should throw error for non-existent start node", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          Graph.addNode(mutable, "A")
        })

        expect(() => Graph.dfsPostOrder(graph, { startNodes: [99] }))
          .toThrow("Start node 99 does not exist")
      })

      it("should be iterable multiple times with fresh state", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, 1)
        })

        const iterator = Graph.dfsPostOrder(graph, { startNodes: [0] })

        const firstRun = Array.from(Graph.indices(iterator))
        const secondRun = Array.from(Graph.indices(iterator))

        expect(firstRun).toEqual([1, 0])
        expect(secondRun).toEqual([1, 0])
        expect(firstRun).toEqual(secondRun)
      })
    })

    describe("Graph Element Iterators", () => {
      describe("nodes", () => {
        it("should iterate over all node indices", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            Graph.addNode(mutable, "A")
            Graph.addNode(mutable, "B")
            Graph.addNode(mutable, "C")
          })

          const indices = Array.from(Graph.indices(Graph.nodes(graph)))
          expect(indices).toEqual([0, 1, 2])
        })

        it("should handle empty graph", () => {
          const graph = Graph.directed<string, number>()
          const indices = Array.from(Graph.indices(Graph.nodes(graph)))
          expect(indices).toEqual([])
        })

        it("should work with manual iterator control", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            Graph.addNode(mutable, "A")
            Graph.addNode(mutable, "B")
          })

          const iterator = Graph.indices(Graph.nodes(graph))[Symbol.iterator]()
          expect(iterator.next().value).toBe(0)
          expect(iterator.next().value).toBe(1)
          expect(iterator.next().done).toBe(true)
        })
      })

      describe("edges", () => {
        it("should iterate over all edge indices", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            const c = Graph.addNode(mutable, "C")
            Graph.addEdge(mutable, a, b, 1)
            Graph.addEdge(mutable, b, c, 2)
            Graph.addEdge(mutable, c, a, 3)
          })

          const indices = Array.from(Graph.indices(Graph.edges(graph)))
          expect(indices).toEqual([0, 1, 2])
        })

        it("should handle graph with no edges", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            Graph.addNode(mutable, "A")
            Graph.addNode(mutable, "B")
          })

          const indices = Array.from(Graph.indices(Graph.edges(graph)))
          expect(indices).toEqual([])
        })
      })

      describe("externals", () => {
        it("should find nodes with no outgoing edges (sinks)", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const source = Graph.addNode(mutable, "source") // 0
            const middle = Graph.addNode(mutable, "middle") // 1
            const sink = Graph.addNode(mutable, "sink") // 2
            Graph.addNode(mutable, "isolated") // 3

            Graph.addEdge(mutable, source, middle, 1)
            Graph.addEdge(mutable, middle, sink, 2)
            // No outgoing edges from sink (2) or isolated (3)
          })

          const sinks = Array.from(Graph.indices(Graph.externals(graph, { direction: "outgoing" })))
          expect(sinks.sort()).toEqual([2, 3])
        })

        it("should find nodes with no incoming edges (sources)", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const source = Graph.addNode(mutable, "source") // 0
            const middle = Graph.addNode(mutable, "middle") // 1
            const sink = Graph.addNode(mutable, "sink") // 2
            Graph.addNode(mutable, "isolated") // 3

            Graph.addEdge(mutable, source, middle, 1)
            Graph.addEdge(mutable, middle, sink, 2)
            // No incoming edges to source (0) or isolated (3)
          })

          const sources = Array.from(Graph.indices(Graph.externals(graph, { direction: "incoming" })))
          expect(sources.sort()).toEqual([0, 3])
        })

        it("should default to outgoing direction", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            Graph.addEdge(mutable, a, b, 1)
            // b has no outgoing edges
          })

          const externalsDefault = Array.from(Graph.indices(Graph.externals(graph)))
          const externalsExplicit = Array.from(Graph.indices(Graph.externals(graph, { direction: "outgoing" })))

          expect(externalsDefault).toEqual(externalsExplicit)
          expect(externalsDefault).toEqual([1])
        })

        it("should handle fully connected components", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            const c = Graph.addNode(mutable, "C")
            Graph.addEdge(mutable, a, b, 1)
            Graph.addEdge(mutable, b, c, 2)
            Graph.addEdge(mutable, c, a, 3) // Creates cycle
          })

          const outgoingExternals = Array.from(Graph.indices(Graph.externals(graph, { direction: "outgoing" })))
          const incomingExternals = Array.from(Graph.indices(Graph.externals(graph, { direction: "incoming" })))

          expect(outgoingExternals).toEqual([]) // All nodes have outgoing edges
          expect(incomingExternals).toEqual([]) // All nodes have incoming edges
        })

        it("should handle single node", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            Graph.addNode(mutable, "A")
          })

          const outgoingExternals = Array.from(Graph.indices(Graph.externals(graph, { direction: "outgoing" })))
          const incomingExternals = Array.from(Graph.indices(Graph.externals(graph, { direction: "incoming" })))

          expect(outgoingExternals).toEqual([0]) // No outgoing edges
          expect(incomingExternals).toEqual([0]) // No incoming edges
        })

        it("should work with manual iterator control", () => {
          const graph = Graph.directed<string, number>((mutable) => {
            const a = Graph.addNode(mutable, "A")
            const b = Graph.addNode(mutable, "B")
            Graph.addNode(mutable, "C")
            Graph.addEdge(mutable, a, b, 1)
            // b and c have no outgoing edges
          })

          const iterator = Graph.indices(Graph.externals(graph, { direction: "outgoing" }))[Symbol.iterator]()

          const first = iterator.next().value
          const second = iterator.next().value
          const third = iterator.next()

          expect([first, second].sort()).toEqual([1, 2])
          expect(third.done).toBe(true)
        })
      })

      it("should allow combining different element iterators", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, 100)
        })

        // Combine different iterators
        const nodeCount = Array.from(Graph.indices(Graph.nodes(graph))).length
        const edgeCount = Array.from(Graph.indices(Graph.edges(graph))).length
        const nodeData = Array.from(Graph.values(Graph.nodes(graph)))
        const edgeData = Array.from(Graph.values(Graph.edges(graph)))

        expect(nodeCount).toBe(2)
        expect(edgeCount).toBe(1)
        expect(nodeData).toEqual(["A", "B"])
        expect(edgeData).toEqual([{ source: 0, target: 1, data: 100 }])
      })
    })

    describe("GraphIterable abstraction", () => {
      it("should provide graph access for all iterables", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, 1)
        })

        // All these should implement GraphIterable and have graph reference
        const dfsIterable = Graph.dfs(graph, { startNodes: [0] })
        const nodesIterable = Graph.nodes(graph)
        const edgesIterable = Graph.edges(graph)
        const externalsIterable = Graph.externals(graph)

        // All should be proper iterable objects
        expect(dfsIterable._tag).toBe("Walker")
        expect(nodesIterable._tag).toBe("Walker")
        expect(edgesIterable._tag).toBe("Walker")
        expect(externalsIterable._tag).toBe("Walker")
      })

      it("should enable iteration over different types", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
        })

        // Should work with different iterator types
        const dfsIterable = Graph.dfs(graph, { startNodes: [0] })
        const nodesIterable = Graph.nodes(graph)
        const externalsIterable = Graph.externals(graph)

        // All should be iterable and have expected structure
        expect(Array.from(dfsIterable)).toHaveLength(3)
        expect(Array.from(nodesIterable)).toHaveLength(3)
        expect(Array.from(externalsIterable)).toHaveLength(1) // Only one node with no outgoing edges
      })
    })

    describe("NodeIterable abstraction", () => {
      it("should provide common interface for node index iterables", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
        })

        // Utility function that works with any NodeWalker
        function collectNodes<N>(
          nodeIterable: Graph.NodeWalker<N>
        ): Array<number> {
          return Array.from(Graph.indices(nodeIterable)).sort()
        }

        // Both traversal and element iterators implement NodeWalker
        const dfsNodes = Graph.dfs(graph, { startNodes: [0] })
        const allNodes = Graph.nodes(graph)
        const externalNodes = Graph.externals(graph, { direction: "outgoing" })

        // All should work with the same utility function
        expect(collectNodes(dfsNodes)).toEqual([0, 1, 2])
        expect(collectNodes(allNodes)).toEqual([0, 1, 2])
        expect(collectNodes(externalNodes)).toEqual([2]) // Only node 2 has no outgoing edges
      })

      it("should allow type-safe node iterable operations", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, 1)
        })

        // NodeIterable types are properly constrained
        const nodeIterable: Graph.NodeWalker<string> = Graph.nodes(graph)

        const traversalIterable: Graph.NodeWalker<string> = Graph.dfs(graph, {
          startNodes: [0]
        })

        // Both have the same interface
        expect(Array.from(Graph.indices(nodeIterable))).toEqual([0, 1])
        expect(Array.from(Graph.indices(traversalIterable))).toEqual([0, 1])
        expect(nodeIterable._tag).toBe("Walker")
        expect(traversalIterable._tag).toBe("Walker")
      })
    })

    describe("Standalone utility functions", () => {
      it("should work with values() function on any NodeIterable", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          const c = Graph.addNode(mutable, "C")
          Graph.addEdge(mutable, a, b, 1)
          Graph.addEdge(mutable, b, c, 2)
        })

        // Test with traversal iterators
        const dfsIterable = Graph.dfs(graph, { startNodes: [0] })
        const dfsValues = Array.from(Graph.values(dfsIterable))
        expect(dfsValues).toEqual(["A", "B", "C"])

        // Test with element iterators
        const nodesIterable = Graph.nodes(graph)
        const nodeValues = Array.from(Graph.values(nodesIterable))
        expect(nodeValues.sort()).toEqual(["A", "B", "C"])

        // Test with externals iterator
        const externalsIterable = Graph.externals(graph, { direction: "outgoing" })
        const externalValues = Array.from(Graph.values(externalsIterable))
        expect(externalValues).toEqual(["C"]) // Only C has no outgoing edges
      })

      it("should work with entries() function on any NodeIterable", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, 1)
        })

        // Test with traversal iterator
        const dfsIterable = Graph.dfs(graph, { startNodes: [0] })
        const dfsEntries = Array.from(Graph.entries(dfsIterable))
        expect(dfsEntries).toEqual([[0, "A"], [1, "B"]])

        // Test with element iterator
        const nodesIterable = Graph.nodes(graph)
        const nodeEntries = Array.from(Graph.entries(nodesIterable))
        expect(nodeEntries.sort()).toEqual([[0, "A"], [1, "B"]])

        // Test with externals iterator
        const externalsIterable = Graph.externals(graph, { direction: "outgoing" })
        const externalEntries = Array.from(Graph.entries(externalsIterable))
        expect(externalEntries).toEqual([[1, "B"]]) // Only B has no outgoing edges
      })

      it("should work with instance methods", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, 1)
        })

        const dfs = Graph.dfs(graph, { startNodes: [0] })

        // Instance methods should work
        const instanceValues = Array.from(Graph.values(dfs))
        const instanceEntries = Array.from(Graph.entries(dfs))

        expect(instanceValues).toEqual(["A", "B"])
        expect(instanceEntries).toEqual([[0, "A"], [1, "B"]])
      })

      it("should work with mapEntry for NodeIterable", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, 1)
        })

        const dfs = Graph.dfs(graph, { startNodes: [0] })

        // Test mapEntry with custom mapping
        const custom = Array.from(dfs.visit((index, data) => ({ id: index, name: data })))
        expect(custom).toEqual([{ id: 0, name: "A" }, { id: 1, name: "B" }])

        // Test that values() is implemented using mapEntry
        const values = Array.from(Graph.values(dfs))
        expect(values).toEqual(["A", "B"])

        // Test that entries() is implemented using mapEntry
        const entries = Array.from(Graph.entries(dfs))
        expect(entries).toEqual([[0, "A"], [1, "B"]])
      })

      it("should work with mapEntry for EdgeIterable", () => {
        const graph = Graph.directed<string, number>((mutable) => {
          const a = Graph.addNode(mutable, "A")
          const b = Graph.addNode(mutable, "B")
          Graph.addEdge(mutable, a, b, 42)
        })

        const edgesIterable = Graph.edges(graph)

        // Test mapEntry with custom mapping
        const connections = Array.from(edgesIterable.visit((index, edgeData) => ({
          id: index,
          from: edgeData.source,
          to: edgeData.target,
          weight: edgeData.data
        })))
        expect(connections).toEqual([{ id: 0, from: 0, to: 1, weight: 42 }])

        // Test that values() is implemented using mapEntry
        const weights = Array.from(edgesIterable.visit((_, edgeData) => edgeData.data))
        expect(weights).toEqual([42])

        // Test that entries() is implemented using mapEntry
        const entries = Array.from(Graph.entries(edgesIterable))
        expect(entries).toEqual([[0, { source: 0, target: 1, data: 42 }]])
      })
    })
  })
})
