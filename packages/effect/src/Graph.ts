/**
 * @since 2.0.0
 */

import * as Equal from "./Equal.js"
import { dual } from "./Function.js"
import * as Hash from "./Hash.js"
import type { Inspectable } from "./Inspectable.js"
import { format, NodeInspectSymbol, toJSON } from "./Inspectable.js"
import * as MutableHashMap from "./MutableHashMap.js"
import * as Option from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"

/**
 * Unique identifier for Graph instances.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * // The TypeId constant can be used for runtime identification
 * console.log(Graph.TypeId) // "~effect/Graph"
 * ```
 *
 * @since 2.0.0
 * @category symbol
 */
export const TypeId: "~effect/Graph" = "~effect/Graph" as const

/**
 * Type identifier for Graph instances.
 *
 * @since 2.0.0
 * @category symbol
 */
export type TypeId = typeof TypeId

/**
 * Node index for node identification using plain numbers.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const nodeIndex = 42
 * console.log(nodeIndex) // 42
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type NodeIndex = number

/**
 * Edge index for edge identification using plain numbers.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const edgeIndex = 123
 * console.log(edgeIndex) // 123
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type EdgeIndex = number

/**
 * Edge data containing source, target, and user data.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const edge: Graph.EdgeData<string> = {
 *   source: 0,
 *   target: 1,
 *   data: "connection"
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface EdgeData<E> {
  readonly source: NodeIndex
  readonly target: NodeIndex
  readonly data: E
}

/**
 * Index allocator for efficient index management.
 *
 * @since 2.0.0
 * @category models
 */
export interface IndexAllocator {
  readonly nextIndex: number
  readonly recycled: Array<number>
}

/**
 * Internal graph data structure - always mutable for performance.
 *
 * @since 2.0.0
 * @category models
 */
export interface GraphData<N, E> {
  readonly nodes: MutableHashMap.MutableHashMap<NodeIndex, N>
  readonly edges: MutableHashMap.MutableHashMap<EdgeIndex, EdgeData<E>>
  readonly adjacency: MutableHashMap.MutableHashMap<NodeIndex, Array<EdgeIndex>>
  readonly reverseAdjacency: MutableHashMap.MutableHashMap<NodeIndex, Array<EdgeIndex>>
  nodeCount: number
  edgeCount: number
  nextNodeIndex: NodeIndex
  nextEdgeIndex: EdgeIndex
  readonly nodeAllocator: IndexAllocator
  readonly edgeAllocator: IndexAllocator
  isAcyclic: boolean | null
}

/**
 * Graph type markers for compile-time constraints.
 *
 * @since 2.0.0
 * @category models
 */
export declare namespace GraphType {
  /**
   * @since 2.0.0
   */
  export interface Base {
    readonly _tag: string
  }
  /**
   * @since 2.0.0
   */
  export interface Directed extends Base {
    readonly _tag: "Directed"
  }
  /**
   * @since 2.0.0
   */
  export interface Undirected extends Base {
    readonly _tag: "Undirected"
  }
}

/**
 * Immutable graph interface - read-only access through API.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * // Graph interface represents an immutable graph
 * declare const graph: Graph.Graph<string, number>
 * console.log(graph[Graph.TypeId]) // "~effect/Graph"
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Graph<out N, out E, T extends GraphType.Base = GraphType.Directed>
  extends Iterable<readonly [NodeIndex, N]>, Equal.Equal, Pipeable, Inspectable
{
  readonly [TypeId]: TypeId
  readonly data: GraphData<N, E>
  readonly type: T
  readonly _mutable: false
}

/**
 * Mutable graph interface - allows modifications through dedicated functions.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * // MutableGraph interface allows modifications through dedicated functions
 * declare const mutable: Graph.MutableGraph<string, number>
 * console.log(mutable._mutable) // true
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface MutableGraph<out N, out E, T extends GraphType.Base = GraphType.Directed> {
  readonly [TypeId]: TypeId
  readonly data: GraphData<N, E>
  readonly type: T
  readonly _mutable: true
}

/**
 * Directed graph type alias.
 *
 * @since 2.0.0
 * @category models
 */
export type DirectedGraph<N, E> = Graph<N, E, GraphType.Directed>

/**
 * Undirected graph type alias.
 *
 * @since 2.0.0
 * @category models
 */
export type UndirectedGraph<N, E> = Graph<N, E, GraphType.Undirected>

/**
 * Mutable directed graph type alias.
 *
 * @since 2.0.0
 * @category models
 */
export type MutableDirectedGraph<N, E> = MutableGraph<N, E, GraphType.Directed>

/**
 * Mutable undirected graph type alias.
 *
 * @since 2.0.0
 * @category models
 */
export type MutableUndirectedGraph<N, E> = MutableGraph<N, E, GraphType.Undirected>

// =============================================================================
// Constructors
// =============================================================================

/** @internal */
class GraphImpl<N, E, T extends GraphType.Base = GraphType.Directed> implements Graph<N, E, T> {
  readonly [TypeId]: TypeId = TypeId
  readonly _mutable = false as const

  constructor(
    readonly data: GraphData<N, E>,
    readonly type: T
  ) {}

  [Symbol.iterator](): Iterator<readonly [NodeIndex, N]> {
    return this.data.nodes[Symbol.iterator]()
  }

  [Equal.symbol](that: Equal.Equal): boolean {
    if (isGraph(that)) {
      const thatImpl = that as GraphImpl<N, E, T>
      if (
        this.data.nodeCount !== thatImpl.data.nodeCount ||
        this.data.edgeCount !== thatImpl.data.edgeCount ||
        this.type._tag !== thatImpl.type._tag
      ) {
        return false
      }
      // Compare nodes
      for (const [nodeIndex, nodeData] of this.data.nodes) {
        if (!MutableHashMap.has(thatImpl.data.nodes, nodeIndex)) {
          return false
        }
        const otherNodeData = MutableHashMap.get(thatImpl.data.nodes, nodeIndex)
        if (Option.isNone(otherNodeData) || !Equal.equals(nodeData, otherNodeData.value)) {
          return false
        }
      }
      // Compare edges
      for (const [edgeIndex, edgeData] of this.data.edges) {
        if (!MutableHashMap.has(thatImpl.data.edges, edgeIndex)) {
          return false
        }
        const otherEdgeData = MutableHashMap.get(thatImpl.data.edges, edgeIndex)
        if (Option.isNone(otherEdgeData) || !Equal.equals(edgeData, otherEdgeData.value)) {
          return false
        }
      }
      return true
    }
    return false
  }

  [Hash.symbol](): number {
    let hash = Hash.string("Graph")
    hash = hash ^ Hash.string(this.type._tag)
    hash = hash ^ Hash.number(this.data.nodeCount)
    hash = hash ^ Hash.number(this.data.edgeCount)
    for (const [nodeIndex, nodeData] of this.data.nodes) {
      hash = hash ^ (Hash.hash(nodeIndex) + Hash.hash(nodeData))
    }
    for (const [edgeIndex, edgeData] of this.data.edges) {
      hash = hash ^ (Hash.hash(edgeIndex) + Hash.hash(edgeData))
    }
    return hash
  }

  [NodeInspectSymbol](): unknown {
    return toJSON(this)
  }

  toJSON(): unknown {
    return {
      _id: "Graph",
      nodeCount: this.data.nodeCount,
      edgeCount: this.data.edgeCount,
      type: this.type._tag
    }
  }

  toString(): string {
    return format(this)
  }

  pipe() {
    return pipeArguments(this, arguments)
  }
}

/** @internal */
export const isGraph = (u: unknown): u is Graph<unknown, unknown> => typeof u === "object" && u !== null && TypeId in u

/**
 * Creates a directed graph, optionally with initial mutations.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * // Empty directed graph
 * const emptyGraph = Graph.directed<string, number>()
 * console.log(emptyGraph[Graph.TypeId]) // "~effect/Graph"
 * console.log(emptyGraph.type._tag) // "Directed"
 *
 * // Directed graph with initial nodes and edges
 * const graph = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, b, c, "B->C")
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const directed = <N, E>(mutate?: (mutable: MutableDirectedGraph<N, E>) => void): DirectedGraph<N, E> => {
  const graph = new GraphImpl({
    nodes: MutableHashMap.empty(),
    edges: MutableHashMap.empty(),
    adjacency: MutableHashMap.empty(),
    reverseAdjacency: MutableHashMap.empty(),
    nodeCount: 0,
    edgeCount: 0,
    nextNodeIndex: 0,
    nextEdgeIndex: 0,
    nodeAllocator: { nextIndex: 0, recycled: [] },
    edgeAllocator: { nextIndex: 0, recycled: [] },
    isAcyclic: true
  }, { _tag: "Directed" } as GraphType.Directed) as DirectedGraph<N, E>

  if (mutate) {
    const mutable = beginMutation(graph)
    mutate(mutable as MutableDirectedGraph<N, E>)
    return endMutation(mutable) as DirectedGraph<N, E>
  }

  return graph
}

/**
 * Creates an undirected graph, optionally with initial mutations.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * // Empty undirected graph
 * const emptyGraph = Graph.undirected<string, number>()
 * console.log(emptyGraph[Graph.TypeId]) // "~effect/Graph"
 * console.log(emptyGraph.type._tag) // "Undirected"
 *
 * // Undirected graph with initial nodes and edges
 * const graph = Graph.undirected<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A-B")
 *   Graph.addEdge(mutable, b, c, "B-C")
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const undirected = <N, E>(mutate?: (mutable: MutableUndirectedGraph<N, E>) => void): UndirectedGraph<N, E> => {
  const graph = new GraphImpl({
    nodes: MutableHashMap.empty(),
    edges: MutableHashMap.empty(),
    adjacency: MutableHashMap.empty(),
    reverseAdjacency: MutableHashMap.empty(),
    nodeCount: 0,
    edgeCount: 0,
    nextNodeIndex: 0,
    nextEdgeIndex: 0,
    nodeAllocator: { nextIndex: 0, recycled: [] },
    edgeAllocator: { nextIndex: 0, recycled: [] },
    isAcyclic: true
  }, { _tag: "Undirected" } as GraphType.Undirected) as UndirectedGraph<N, E>

  if (mutate) {
    const mutable = beginMutation(graph)
    mutate(mutable as MutableUndirectedGraph<N, E>)
    return endMutation(mutable) as UndirectedGraph<N, E>
  }

  return graph
}

// =============================================================================
// Scoped Mutable API
// =============================================================================

/**
 * Creates a mutable scope for safe graph mutations by copying the data structure.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>()
 * const mutable = Graph.beginMutation(graph)
 * // Now mutable can be safely modified without affecting original graph
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const beginMutation = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T>
): MutableGraph<N, E, T> => {
  // Copy adjacency maps with deep cloned arrays
  const adjacency = MutableHashMap.empty<NodeIndex, Array<EdgeIndex>>()
  const reverseAdjacency = MutableHashMap.empty<NodeIndex, Array<EdgeIndex>>()

  for (const [nodeIndex, edges] of graph.data.adjacency) {
    MutableHashMap.set(adjacency, nodeIndex, [...edges])
  }

  for (const [nodeIndex, edges] of graph.data.reverseAdjacency) {
    MutableHashMap.set(reverseAdjacency, nodeIndex, [...edges])
  }

  return {
    [TypeId]: TypeId,
    _mutable: true,
    type: graph.type,
    data: {
      // Copy the mutable data structures to create an isolated mutation scope
      nodes: MutableHashMap.fromIterable(graph.data.nodes),
      edges: MutableHashMap.fromIterable(graph.data.edges),
      adjacency,
      reverseAdjacency,
      nodeCount: graph.data.nodeCount,
      edgeCount: graph.data.edgeCount,
      nextNodeIndex: graph.data.nextNodeIndex,
      nextEdgeIndex: graph.data.nextEdgeIndex,
      nodeAllocator: { ...graph.data.nodeAllocator, recycled: [...graph.data.nodeAllocator.recycled] },
      edgeAllocator: { ...graph.data.edgeAllocator, recycled: [...graph.data.edgeAllocator.recycled] },
      isAcyclic: graph.data.isAcyclic
    }
  }
}

/**
 * Converts a mutable graph back to an immutable graph, ending the mutation scope.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>()
 * const mutable = Graph.beginMutation(graph)
 * // ... perform mutations on mutable ...
 * const newGraph = Graph.endMutation(mutable)
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const endMutation = <N, E, T extends GraphType.Base = GraphType.Directed>(
  mutable: MutableGraph<N, E, T>
): Graph<N, E, T> => new GraphImpl(mutable.data, mutable.type)

/**
 * Performs scoped mutations on a graph, automatically managing the mutation lifecycle.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>()
 * const newGraph = Graph.mutate(graph, (mutable) => {
 *   // Safe mutations go here
 *   // mutable gets automatically converted back to immutable
 * })
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const mutate: {
  <N, E, T extends GraphType.Base = GraphType.Directed>(
    f: (mutable: MutableGraph<N, E, T>) => void
  ): (graph: Graph<N, E, T>) => Graph<N, E, T>
  <N, E, T extends GraphType.Base = GraphType.Directed>(
    graph: Graph<N, E, T>,
    f: (mutable: MutableGraph<N, E, T>) => void
  ): Graph<N, E, T>
} = dual(2, <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T>,
  f: (mutable: MutableGraph<N, E, T>) => void
): Graph<N, E, T> => {
  const mutable = beginMutation(graph)
  f(mutable)
  return endMutation(mutable)
})

// =============================================================================
// Basic Node Operations
// =============================================================================

/**
 * Adds a new node to a mutable graph and returns its index.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   console.log(nodeA) // NodeIndex with value 0
 *   console.log(nodeB) // NodeIndex with value 1
 * })
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const addNode = <N, E, T extends GraphType.Base = GraphType.Directed>(
  mutable: MutableGraph<N, E, T>,
  data: N
): NodeIndex => {
  const nodeIndex = mutable.data.nextNodeIndex

  // Add node data
  MutableHashMap.set(mutable.data.nodes, nodeIndex, data)

  // Initialize empty adjacency lists
  MutableHashMap.set(mutable.data.adjacency, nodeIndex, [])
  MutableHashMap.set(mutable.data.reverseAdjacency, nodeIndex, [])

  // Update graph counters and allocators
  mutable.data.nodeCount++
  mutable.data.nextNodeIndex = mutable.data.nextNodeIndex + 1

  return nodeIndex
}

/**
 * Gets the data associated with a node index, if it exists.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   Graph.addNode(mutable, "Node A")
 * })
 *
 * const nodeIndex = 0
 * const nodeData = Graph.getNode(graph, nodeIndex)
 *
 * if (Option.isSome(nodeData)) {
 *   console.log(nodeData.value) // "Node A"
 * }
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const getNode = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  nodeIndex: NodeIndex
): Option.Option<N> => MutableHashMap.get(graph.data.nodes, nodeIndex)

/**
 * Checks if a node with the given index exists in the graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   Graph.addNode(mutable, "Node A")
 * })
 *
 * const nodeIndex = 0
 * const exists = Graph.hasNode(graph, nodeIndex)
 * console.log(exists) // true
 *
 * const nonExistentIndex = 999
 * const notExists = Graph.hasNode(graph, nonExistentIndex)
 * console.log(notExists) // false
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const hasNode = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  nodeIndex: NodeIndex
): boolean => MutableHashMap.has(graph.data.nodes, nodeIndex)

/**
 * Returns the number of nodes in the graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const emptyGraph = Graph.directed<string, number>()
 * console.log(Graph.nodeCount(emptyGraph)) // 0
 *
 * const graphWithNodes = Graph.mutate(emptyGraph, (mutable) => {
 *   Graph.addNode(mutable, "Node A")
 *   Graph.addNode(mutable, "Node B")
 *   Graph.addNode(mutable, "Node C")
 * })
 *
 * console.log(Graph.nodeCount(graphWithNodes)) // 3
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const nodeCount = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>
): number => graph.data.nodeCount

// =============================================================================
// Cycle Flag Management (Internal)
// =============================================================================

/** @internal */
const invalidateCycleFlag = <N, E, T extends GraphType.Base = GraphType.Directed>(
  mutable: MutableGraph<N, E, T>
): void => {
  mutable.data.isAcyclic = null
}

// =============================================================================
// Edge Operations
// =============================================================================

/**
 * Adds a new edge to a mutable graph and returns its index.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const edge = Graph.addEdge(mutable, nodeA, nodeB, 42)
 *   console.log(edge) // EdgeIndex with value 0
 * })
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const addEdge = <N, E, T extends GraphType.Base = GraphType.Directed>(
  mutable: MutableGraph<N, E, T>,
  source: NodeIndex,
  target: NodeIndex,
  data: E
): EdgeIndex => {
  // Validate that both nodes exist
  if (!MutableHashMap.has(mutable.data.nodes, source)) {
    throw new Error(`Source node ${source} does not exist`)
  }
  if (!MutableHashMap.has(mutable.data.nodes, target)) {
    throw new Error(`Target node ${target} does not exist`)
  }

  const edgeIndex = mutable.data.nextEdgeIndex

  // Create edge data
  const edgeData: EdgeData<E> = { source, target, data }
  MutableHashMap.set(mutable.data.edges, edgeIndex, edgeData)

  // Update adjacency lists
  const sourceAdjacency = MutableHashMap.get(mutable.data.adjacency, source)
  if (Option.isSome(sourceAdjacency)) {
    sourceAdjacency.value.push(edgeIndex)
  }

  const targetReverseAdjacency = MutableHashMap.get(mutable.data.reverseAdjacency, target)
  if (Option.isSome(targetReverseAdjacency)) {
    targetReverseAdjacency.value.push(edgeIndex)
  }

  // For undirected graphs, add reverse connections
  if (mutable.type._tag === "Undirected") {
    const targetAdjacency = MutableHashMap.get(mutable.data.adjacency, target)
    if (Option.isSome(targetAdjacency)) {
      targetAdjacency.value.push(edgeIndex)
    }

    const sourceReverseAdjacency = MutableHashMap.get(mutable.data.reverseAdjacency, source)
    if (Option.isSome(sourceReverseAdjacency)) {
      sourceReverseAdjacency.value.push(edgeIndex)
    }
  }

  // Update counters and allocators
  mutable.data.edgeCount++
  mutable.data.nextEdgeIndex = mutable.data.nextEdgeIndex + 1

  // Invalidate cycle flag since adding edges may introduce cycles
  invalidateCycleFlag(mutable)

  return edgeIndex
}

/**
 * Removes a node and all its incident edges from a mutable graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   Graph.addEdge(mutable, nodeA, nodeB, 42)
 *
 *   // Remove nodeA and all edges connected to it
 *   Graph.removeNode(mutable, nodeA)
 * })
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const removeNode = <N, E, T extends GraphType.Base = GraphType.Directed>(
  mutable: MutableGraph<N, E, T>,
  nodeIndex: NodeIndex
): void => {
  // Check if node exists
  if (!MutableHashMap.has(mutable.data.nodes, nodeIndex)) {
    return // Node doesn't exist, nothing to remove
  }

  // Collect all incident edges for removal
  const edgesToRemove: Array<EdgeIndex> = []

  // Get outgoing edges
  const outgoingEdges = MutableHashMap.get(mutable.data.adjacency, nodeIndex)
  if (Option.isSome(outgoingEdges)) {
    for (const edge of outgoingEdges.value) {
      edgesToRemove.push(edge)
    }
  }

  // Get incoming edges
  const incomingEdges = MutableHashMap.get(mutable.data.reverseAdjacency, nodeIndex)
  if (Option.isSome(incomingEdges)) {
    for (const edge of incomingEdges.value) {
      edgesToRemove.push(edge)
    }
  }

  // Remove all incident edges
  for (const edgeIndex of edgesToRemove) {
    removeEdgeInternal(mutable, edgeIndex)
  }

  // Remove the node itself
  MutableHashMap.remove(mutable.data.nodes, nodeIndex)
  MutableHashMap.remove(mutable.data.adjacency, nodeIndex)
  MutableHashMap.remove(mutable.data.reverseAdjacency, nodeIndex)

  // Update node count
  mutable.data.nodeCount--

  // Invalidate cycle flag since removing nodes changes graph structure
  invalidateCycleFlag(mutable)
}

/**
 * Removes an edge from a mutable graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const edge = Graph.addEdge(mutable, nodeA, nodeB, 42)
 *
 *   // Remove the edge
 *   Graph.removeEdge(mutable, edge)
 * })
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const removeEdge = <N, E, T extends GraphType.Base = GraphType.Directed>(
  mutable: MutableGraph<N, E, T>,
  edgeIndex: EdgeIndex
): void => {
  removeEdgeInternal(mutable, edgeIndex)

  // Invalidate cycle flag since removing edges changes graph structure
  invalidateCycleFlag(mutable)
}

/** @internal */
const removeEdgeInternal = <N, E, T extends GraphType.Base = GraphType.Directed>(
  mutable: MutableGraph<N, E, T>,
  edgeIndex: EdgeIndex
): void => {
  // Get edge data
  const edge = MutableHashMap.get(mutable.data.edges, edgeIndex)
  if (Option.isNone(edge)) {
    return // Edge doesn't exist
  }

  const { source, target } = edge.value

  // Remove from adjacency lists
  const sourceAdjacency = MutableHashMap.get(mutable.data.adjacency, source)
  if (Option.isSome(sourceAdjacency)) {
    const index = sourceAdjacency.value.indexOf(edgeIndex)
    if (index !== -1) {
      sourceAdjacency.value.splice(index, 1)
    }
  }

  const targetReverseAdjacency = MutableHashMap.get(mutable.data.reverseAdjacency, target)
  if (Option.isSome(targetReverseAdjacency)) {
    const index = targetReverseAdjacency.value.indexOf(edgeIndex)
    if (index !== -1) {
      targetReverseAdjacency.value.splice(index, 1)
    }
  }

  // For undirected graphs, remove reverse connections
  if (mutable.type._tag === "Undirected") {
    const targetAdjacency = MutableHashMap.get(mutable.data.adjacency, target)
    if (Option.isSome(targetAdjacency)) {
      const index = targetAdjacency.value.indexOf(edgeIndex)
      if (index !== -1) {
        targetAdjacency.value.splice(index, 1)
      }
    }

    const sourceReverseAdjacency = MutableHashMap.get(mutable.data.reverseAdjacency, source)
    if (Option.isSome(sourceReverseAdjacency)) {
      const index = sourceReverseAdjacency.value.indexOf(edgeIndex)
      if (index !== -1) {
        sourceReverseAdjacency.value.splice(index, 1)
      }
    }
  }

  // Remove edge data
  MutableHashMap.remove(mutable.data.edges, edgeIndex)

  // Update edge count
  mutable.data.edgeCount--
}

// =============================================================================
// Edge Query Operations
// =============================================================================

/**
 * Gets the edge data associated with an edge index, if it exists.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   Graph.addEdge(mutable, nodeA, nodeB, 42)
 * })
 *
 * const edgeIndex = 0
 * const edgeData = Graph.getEdge(graph, edgeIndex)
 *
 * if (Option.isSome(edgeData)) {
 *   console.log(edgeData.value.data) // 42
 *   console.log(edgeData.value.source) // NodeIndex(0)
 *   console.log(edgeData.value.target) // NodeIndex(1)
 * }
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const getEdge = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  edgeIndex: EdgeIndex
): Option.Option<EdgeData<E>> => MutableHashMap.get(graph.data.edges, edgeIndex)

/**
 * Checks if an edge exists between two nodes in the graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const nodeC = Graph.addNode(mutable, "Node C")
 *   Graph.addEdge(mutable, nodeA, nodeB, 42)
 * })
 *
 * const nodeA = 0
 * const nodeB = 1
 * const nodeC = 2
 *
 * const hasAB = Graph.hasEdge(graph, nodeA, nodeB)
 * console.log(hasAB) // true
 *
 * const hasAC = Graph.hasEdge(graph, nodeA, nodeC)
 * console.log(hasAC) // false
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const hasEdge = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  source: NodeIndex,
  target: NodeIndex
): boolean => {
  const adjacencyList = MutableHashMap.get(graph.data.adjacency, source)
  if (Option.isNone(adjacencyList)) {
    return false
  }

  // Check if any edge in the adjacency list connects to the target
  for (const edgeIndex of adjacencyList.value) {
    const edge = MutableHashMap.get(graph.data.edges, edgeIndex)
    if (Option.isSome(edge) && edge.value.target === target) {
      return true
    }
  }

  return false
}

/**
 * Returns the number of edges in the graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const emptyGraph = Graph.directed<string, number>()
 * console.log(Graph.edgeCount(emptyGraph)) // 0
 *
 * const graphWithEdges = Graph.mutate(emptyGraph, (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const nodeC = Graph.addNode(mutable, "Node C")
 *   Graph.addEdge(mutable, nodeA, nodeB, 1)
 *   Graph.addEdge(mutable, nodeB, nodeC, 2)
 *   Graph.addEdge(mutable, nodeC, nodeA, 3)
 * })
 *
 * console.log(Graph.edgeCount(graphWithEdges)) // 3
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const edgeCount = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>
): number => graph.data.edgeCount

/**
 * Returns the neighboring nodes (targets of outgoing edges) for a given node.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const nodeC = Graph.addNode(mutable, "Node C")
 *   Graph.addEdge(mutable, nodeA, nodeB, 1)
 *   Graph.addEdge(mutable, nodeA, nodeC, 2)
 * })
 *
 * const nodeA = 0
 * const nodeB = 1
 * const nodeC = 2
 *
 * const neighborsA = Graph.neighbors(graph, nodeA)
 * console.log(neighborsA) // [NodeIndex(1), NodeIndex(2)]
 *
 * const neighborsB = Graph.neighbors(graph, nodeB)
 * console.log(neighborsB) // []
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const neighbors = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  nodeIndex: NodeIndex
): Array<NodeIndex> => {
  const adjacencyList = MutableHashMap.get(graph.data.adjacency, nodeIndex)
  if (Option.isNone(adjacencyList)) {
    return []
  }

  const result: Array<NodeIndex> = []
  for (const edgeIndex of adjacencyList.value) {
    const edge = MutableHashMap.get(graph.data.edges, edgeIndex)
    if (Option.isSome(edge)) {
      result.push(edge.value.target)
    }
  }

  return result
}

/**
 * Get neighbors of a node in a specific direction for bidirectional traversal.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, "A->B")
 * })
 *
 * const nodeA = 0
 * const nodeB = 1
 *
 * // Get outgoing neighbors (nodes that nodeA points to)
 * const outgoing = Graph.neighborsDirected(graph, nodeA, "outgoing")
 *
 * // Get incoming neighbors (nodes that point to nodeB)
 * const incoming = Graph.neighborsDirected(graph, nodeB, "incoming")
 * ```
 *
 * @since 2.0.0
 * @category queries
 */
export const neighborsDirected = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  nodeIndex: NodeIndex,
  direction: Direction
): Array<NodeIndex> => {
  const adjacencyMap = direction === "incoming"
    ? graph.data.reverseAdjacency
    : graph.data.adjacency

  const adjacencyList = MutableHashMap.get(adjacencyMap, nodeIndex)
  if (Option.isNone(adjacencyList)) {
    return []
  }

  const result: Array<NodeIndex> = []
  for (const edgeIndex of adjacencyList.value) {
    const edge = MutableHashMap.get(graph.data.edges, edgeIndex)
    if (Option.isSome(edge)) {
      // For incoming direction, we want the source node instead of target
      const neighborNode = direction === "incoming"
        ? edge.value.source
        : edge.value.target
      result.push(neighborNode)
    }
  }

  return result
}

// =============================================================================
// GraphViz Export
// =============================================================================

/**
 * Exports a graph to GraphViz DOT format for visualization.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const nodeC = Graph.addNode(mutable, "Node C")
 *   Graph.addEdge(mutable, nodeA, nodeB, 1)
 *   Graph.addEdge(mutable, nodeB, nodeC, 2)
 *   Graph.addEdge(mutable, nodeC, nodeA, 3)
 * })
 *
 * const dot = Graph.toGraphViz(graph)
 * console.log(dot)
 * // digraph G {
 * //   "0" [label="Node A"];
 * //   "1" [label="Node B"];
 * //   "2" [label="Node C"];
 * //   "0" -> "1" [label="1"];
 * //   "1" -> "2" [label="2"];
 * //   "2" -> "0" [label="3"];
 * // }
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const toGraphViz = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  options?: {
    readonly nodeLabel?: (data: N) => string
    readonly edgeLabel?: (data: E) => string
    readonly graphName?: string
  }
): string => {
  const {
    edgeLabel = (data: E) => String(data),
    graphName = "G",
    nodeLabel = (data: N) => String(data)
  } = options ?? {}

  const isDirected = graph.type._tag === "Directed"
  const graphType = isDirected ? "digraph" : "graph"
  const edgeOperator = isDirected ? "->" : "--"

  const lines: Array<string> = []
  lines.push(`${graphType} ${graphName} {`)

  // Add nodes
  for (const [nodeIndex, nodeData] of graph.data.nodes) {
    const label = nodeLabel(nodeData).replace(/"/g, "\\\"")
    lines.push(`  "${nodeIndex}" [label="${label}"];`)
  }

  // Add edges
  for (const [, edgeData] of graph.data.edges) {
    const label = edgeLabel(edgeData.data).replace(/"/g, "\\\"")
    lines.push(`  "${edgeData.source}" ${edgeOperator} "${edgeData.target}" [label="${label}"];`)
  }

  lines.push("}")
  return lines.join("\n")
}

// =============================================================================
// Direction Types for Bidirectional Traversal
// =============================================================================

/**
 * Direction for graph traversal, indicating which edges to follow.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, "A->B")
 * })
 *
 * // Follow outgoing edges (normal direction)
 * const outgoingNodes = Array.from(Graph.dfs(graph, { startNodes: [0], direction: "outgoing" }).indices())
 *
 * // Follow incoming edges (reverse direction)
 * const incomingNodes = Array.from(Graph.dfs(graph, { startNodes: [1], direction: "incoming" }).indices())
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type Direction = "outgoing" | "incoming"

// =============================================================================

// =============================================================================
// Graph Structure Analysis Algorithms (Phase 5A)
// =============================================================================

/**
 * Checks if the graph is acyclic (contains no cycles).
 *
 * Uses depth-first search to detect back edges, which indicate cycles.
 * For directed graphs, any back edge creates a cycle. For undirected graphs,
 * a back edge that doesn't go to the immediate parent creates a cycle.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * // Acyclic directed graph (DAG)
 * const dag = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, b, c, "B->C")
 * })
 * console.log(Graph.isAcyclic(dag)) // true
 *
 * // Cyclic directed graph
 * const cyclic = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, b, a, "B->A") // Creates cycle
 * })
 * console.log(Graph.isAcyclic(cyclic)) // false
 * ```
 *
 * @since 2.0.0
 * @category algorithms
 */
export const isAcyclic = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>
): boolean => {
  // Use existing cycle flag if available
  if (graph.data.isAcyclic !== null) {
    return graph.data.isAcyclic
  }

  // Stack-safe DFS cycle detection using iterative approach
  const visited = new Set<NodeIndex>()
  const recursionStack = new Set<NodeIndex>()

  // Stack entry: [node, neighbors, neighborIndex, isFirstVisit]
  type DfsStackEntry = [NodeIndex, Array<NodeIndex>, number, boolean]

  // Get all nodes to handle disconnected components
  const allNodes = Array.from(MutableHashMap.keys(graph.data.nodes))

  for (const startNode of allNodes) {
    if (visited.has(startNode)) {
      continue // Already processed this component
    }

    // Iterative DFS with explicit stack
    const stack: Array<DfsStackEntry> = [[startNode, [], 0, true]]

    while (stack.length > 0) {
      const [node, neighbors, neighborIndex, isFirstVisit] = stack[stack.length - 1]

      // First visit to this node
      if (isFirstVisit) {
        if (recursionStack.has(node)) {
          // Back edge found - cycle detected
          graph.data.isAcyclic = false
          return false
        }

        if (visited.has(node)) {
          stack.pop()
          continue
        }

        visited.add(node)
        recursionStack.add(node)

        // Get neighbors for this node
        const nodeNeighbors = Array.from(neighborsDirected(graph, node, "outgoing"))
        stack[stack.length - 1] = [node, nodeNeighbors, 0, false]
        continue
      }

      // Process next neighbor
      if (neighborIndex < neighbors.length) {
        const neighbor = neighbors[neighborIndex]
        stack[stack.length - 1] = [node, neighbors, neighborIndex + 1, false]

        if (recursionStack.has(neighbor)) {
          // Back edge found - cycle detected
          graph.data.isAcyclic = false
          return false
        }

        if (!visited.has(neighbor)) {
          stack.push([neighbor, [], 0, true])
        }
      } else {
        // Done with this node - backtrack
        recursionStack.delete(node)
        stack.pop()
      }
    }
  }

  // Cache the result
  graph.data.isAcyclic = true
  return true
}

/**
 * Checks if an undirected graph is bipartite.
 *
 * A bipartite graph is one whose vertices can be divided into two disjoint sets
 * such that no two vertices within the same set are adjacent. Uses BFS coloring
 * to determine bipartiteness.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * // Bipartite graph (alternating coloring possible)
 * const bipartite = Graph.undirected<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   const d = Graph.addNode(mutable, "D")
 *   Graph.addEdge(mutable, a, b, "edge") // Set 1: {A, C}, Set 2: {B, D}
 *   Graph.addEdge(mutable, b, c, "edge")
 *   Graph.addEdge(mutable, c, d, "edge")
 * })
 * console.log(Graph.isBipartite(bipartite)) // true
 *
 * // Non-bipartite graph (odd cycle)
 * const triangle = Graph.undirected<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "edge")
 *   Graph.addEdge(mutable, b, c, "edge")
 *   Graph.addEdge(mutable, c, a, "edge") // Triangle (3-cycle)
 * })
 * console.log(Graph.isBipartite(triangle)) // false
 * ```
 *
 * @since 2.0.0
 * @category algorithms
 */
export const isBipartite = <N, E>(
  graph: Graph<N, E, GraphType.Undirected> | MutableGraph<N, E, GraphType.Undirected>
): boolean => {
  const coloring = new Map<NodeIndex, 0 | 1>()
  const discovered = new Set<NodeIndex>()
  let isBipartiteGraph = true

  // Get all nodes to handle disconnected components
  const allNodes = Array.from(MutableHashMap.keys(graph.data.nodes))

  for (const startNode of allNodes) {
    if (!discovered.has(startNode)) {
      // Start BFS coloring from this component
      const queue: Array<NodeIndex> = [startNode]
      coloring.set(startNode, 0) // Color start node with 0
      discovered.add(startNode)

      while (queue.length > 0 && isBipartiteGraph) {
        const current = queue.shift()!
        const currentColor = coloring.get(current)!
        const neighborColor: 0 | 1 = currentColor === 0 ? 1 : 0

        // Get all neighbors for undirected graph
        const nodeNeighbors = getUndirectedNeighbors(graph, current)
        for (const neighbor of nodeNeighbors) {
          if (!discovered.has(neighbor)) {
            // Color unvisited neighbor with opposite color
            coloring.set(neighbor, neighborColor)
            discovered.add(neighbor)
            queue.push(neighbor)
          } else {
            // Check if neighbor has the same color (conflict)
            if (coloring.get(neighbor) === currentColor) {
              isBipartiteGraph = false
              break
            }
          }
        }
      }

      // Early exit if not bipartite
      if (!isBipartiteGraph) {
        break
      }
    }
  }

  return isBipartiteGraph
}

/**
 * Get neighbors for undirected graphs by checking both adjacency and reverse adjacency.
 * For undirected graphs, we need to find the other endpoint of each edge incident to the node.
 */
const getUndirectedNeighbors = <N, E>(
  graph: Graph<N, E, GraphType.Undirected> | MutableGraph<N, E, GraphType.Undirected>,
  nodeIndex: NodeIndex
): Array<NodeIndex> => {
  const neighbors = new Set<NodeIndex>()

  // Check edges where this node is the source
  const adjacencyList = MutableHashMap.get(graph.data.adjacency, nodeIndex)
  if (Option.isSome(adjacencyList)) {
    for (const edgeIndex of adjacencyList.value) {
      const edge = MutableHashMap.get(graph.data.edges, edgeIndex)
      if (Option.isSome(edge)) {
        // For undirected graphs, the neighbor is the other endpoint
        const otherNode = edge.value.source === nodeIndex ? edge.value.target : edge.value.source
        neighbors.add(otherNode)
      }
    }
  }

  return Array.from(neighbors)
}

/**
 * Find connected components in an undirected graph.
 * Each component is represented as an array of node indices.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.undirected<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   const d = Graph.addNode(mutable, "D")
 *   Graph.addEdge(mutable, a, b, "edge") // Component 1: A-B
 *   Graph.addEdge(mutable, c, d, "edge") // Component 2: C-D
 * })
 *
 * const components = Graph.connectedComponents(graph)
 * console.log(components) // [[0, 1], [2, 3]]
 * ```
 *
 * @since 2.0.0
 * @category algorithms
 */
export const connectedComponents = <N, E>(
  graph: Graph<N, E, GraphType.Undirected> | MutableGraph<N, E, GraphType.Undirected>
): Array<Array<NodeIndex>> => {
  const visited = new Set<NodeIndex>()
  const components: Array<Array<NodeIndex>> = []
  const allNodes = Array.from(MutableHashMap.keys(graph.data.nodes))

  for (const startNode of allNodes) {
    if (!visited.has(startNode)) {
      // DFS to find all nodes in this component
      const component: Array<NodeIndex> = []
      const stack: Array<NodeIndex> = [startNode]

      while (stack.length > 0) {
        const current = stack.pop()!
        if (!visited.has(current)) {
          visited.add(current)
          component.push(current)

          // Add all unvisited neighbors to stack
          const nodeNeighbors = getUndirectedNeighbors(graph, current)
          for (const neighbor of nodeNeighbors) {
            if (!visited.has(neighbor)) {
              stack.push(neighbor)
            }
          }
        }
      }

      components.push(component)
    }
  }

  return components
}

/**
 * Find strongly connected components in a directed graph using Kosaraju's algorithm.
 * Each SCC is represented as an array of node indices.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, b, c, "B->C")
 *   Graph.addEdge(mutable, c, a, "C->A") // Creates SCC: A-B-C
 * })
 *
 * const sccs = Graph.stronglyConnectedComponents(graph)
 * console.log(sccs) // [[0, 1, 2]]
 * ```
 *
 * @since 2.0.0
 * @category algorithms
 */
export const stronglyConnectedComponents = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>
): Array<Array<NodeIndex>> => {
  const visited = new Set<NodeIndex>()
  const finishOrder: Array<NodeIndex> = []
  const allNodes = Array.from(MutableHashMap.keys(graph.data.nodes))

  // Step 1: Stack-safe DFS on original graph to get finish times
  // Stack entry: [node, neighbors, neighborIndex, isFirstVisit]
  type DfsStackEntry = [NodeIndex, Array<NodeIndex>, number, boolean]

  for (const startNode of allNodes) {
    if (visited.has(startNode)) {
      continue
    }

    const stack: Array<DfsStackEntry> = [[startNode, [], 0, true]]

    while (stack.length > 0) {
      const [node, nodeNeighbors, neighborIndex, isFirstVisit] = stack[stack.length - 1]

      if (isFirstVisit) {
        if (visited.has(node)) {
          stack.pop()
          continue
        }

        visited.add(node)
        const nodeNeighborsList = Array.from(neighbors(graph, node))
        stack[stack.length - 1] = [node, nodeNeighborsList, 0, false]
        continue
      }

      // Process next neighbor
      if (neighborIndex < nodeNeighbors.length) {
        const neighbor = nodeNeighbors[neighborIndex]
        stack[stack.length - 1] = [node, nodeNeighbors, neighborIndex + 1, false]

        if (!visited.has(neighbor)) {
          stack.push([neighbor, [], 0, true])
        }
      } else {
        // Done with this node - add to finish order (post-order)
        finishOrder.push(node)
        stack.pop()
      }
    }
  }

  // Step 2: Stack-safe DFS on transpose graph in reverse finish order
  visited.clear()
  const sccs: Array<Array<NodeIndex>> = []

  for (let i = finishOrder.length - 1; i >= 0; i--) {
    const startNode = finishOrder[i]
    if (visited.has(startNode)) {
      continue
    }

    const scc: Array<NodeIndex> = []
    const stack: Array<NodeIndex> = [startNode]

    while (stack.length > 0) {
      const node = stack.pop()!

      if (visited.has(node)) {
        continue
      }

      visited.add(node)
      scc.push(node)

      // Use reverse adjacency (transpose graph)
      const reverseAdjacency = MutableHashMap.get(graph.data.reverseAdjacency, node)
      if (Option.isSome(reverseAdjacency)) {
        for (const edgeIndex of reverseAdjacency.value) {
          const edge = MutableHashMap.get(graph.data.edges, edgeIndex)
          if (Option.isSome(edge)) {
            const predecessor = edge.value.source
            if (!visited.has(predecessor)) {
              stack.push(predecessor)
            }
          }
        }
      }
    }

    sccs.push(scc)
  }

  return sccs
}

// =============================================================================
// Path Finding Algorithms (Phase 5B)
// =============================================================================

/**
 * Result of a shortest path computation containing the path and total distance.
 *
 * @since 2.0.0
 * @category models
 */
export interface PathResult<E> {
  readonly path: Array<NodeIndex>
  readonly distance: number
  readonly edgeWeights: Array<E>
}

/**
 * Find the shortest path between two nodes using Dijkstra's algorithm.
 *
 * Dijkstra's algorithm works with non-negative edge weights and finds the shortest
 * path from a source node to a target node in O((V + E) log V) time complexity.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 5)
 *   Graph.addEdge(mutable, a, c, 10)
 *   Graph.addEdge(mutable, b, c, 2)
 * })
 *
 * const result = Graph.dijkstra(graph, 0, 2, (edgeData) => edgeData)
 * if (result !== null) {
 *   console.log(result.path) // [0, 1, 2] - shortest path A->B->C
 *   console.log(result.distance) // 7 - total distance
 * }
 * ```
 *
 * @since 2.0.0
 * @category algorithms
 */
export const dijkstra = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  source: NodeIndex,
  target: NodeIndex,
  edgeWeight: (edgeData: E) => number
): PathResult<E> | null => {
  // Validate that source and target nodes exist
  if (!MutableHashMap.has(graph.data.nodes, source)) {
    throw new Error(`Source node ${source} does not exist`)
  }
  if (!MutableHashMap.has(graph.data.nodes, target)) {
    throw new Error(`Target node ${target} does not exist`)
  }

  // Early return if source equals target
  if (source === target) {
    return {
      path: [source],
      distance: 0,
      edgeWeights: []
    }
  }

  // Distance tracking and priority queue simulation
  const distances = new Map<NodeIndex, number>()
  const previous = new Map<NodeIndex, { node: NodeIndex; edgeData: E } | null>()
  const visited = new Set<NodeIndex>()

  // Initialize distances
  const allNodes = Array.from(MutableHashMap.keys(graph.data.nodes))
  for (const node of allNodes) {
    distances.set(node, node === source ? 0 : Infinity)
    previous.set(node, null)
  }

  // Simple priority queue using array (can be optimized with proper heap)
  const priorityQueue: Array<{ node: NodeIndex; distance: number }> = [
    { node: source, distance: 0 }
  ]

  while (priorityQueue.length > 0) {
    // Find minimum distance node (priority queue extract-min)
    let minIndex = 0
    for (let i = 1; i < priorityQueue.length; i++) {
      if (priorityQueue[i].distance < priorityQueue[minIndex].distance) {
        minIndex = i
      }
    }

    const current = priorityQueue.splice(minIndex, 1)[0]
    const currentNode = current.node

    // Skip if already visited (can happen with duplicate entries)
    if (visited.has(currentNode)) {
      continue
    }

    visited.add(currentNode)

    // Early termination if we reached the target
    if (currentNode === target) {
      break
    }

    // Get current distance
    const currentDistance = distances.get(currentNode)!

    // Examine all outgoing edges
    const adjacencyList = MutableHashMap.get(graph.data.adjacency, currentNode)
    if (Option.isSome(adjacencyList)) {
      for (const edgeIndex of adjacencyList.value) {
        const edge = MutableHashMap.get(graph.data.edges, edgeIndex)
        if (Option.isSome(edge)) {
          const neighbor = edge.value.target
          const weight = edgeWeight(edge.value.data)

          // Validate non-negative weights
          if (weight < 0) {
            throw new Error(`Dijkstra's algorithm requires non-negative edge weights, found ${weight}`)
          }

          const newDistance = currentDistance + weight
          const neighborDistance = distances.get(neighbor)!

          // Relaxation step
          if (newDistance < neighborDistance) {
            distances.set(neighbor, newDistance)
            previous.set(neighbor, { node: currentNode, edgeData: edge.value.data })

            // Add to priority queue if not visited
            if (!visited.has(neighbor)) {
              priorityQueue.push({ node: neighbor, distance: newDistance })
            }
          }
        }
      }
    }
  }

  // Check if target is reachable
  const targetDistance = distances.get(target)!
  if (targetDistance === Infinity) {
    return null // No path exists
  }

  // Reconstruct path
  const path: Array<NodeIndex> = []
  const edgeWeights: Array<E> = []
  let currentNode: NodeIndex | null = target

  while (currentNode !== null) {
    path.unshift(currentNode)
    const prev: { node: NodeIndex; edgeData: E } | null = previous.get(currentNode)!
    if (prev !== null) {
      edgeWeights.unshift(prev.edgeData)
      currentNode = prev.node
    } else {
      currentNode = null
    }
  }

  return {
    path,
    distance: targetDistance,
    edgeWeights
  }
}

/**
 * Result of all-pairs shortest path computation.
 *
 * @since 2.0.0
 * @category models
 */
export interface AllPairsResult<E> {
  readonly distances: Map<NodeIndex, Map<NodeIndex, number>>
  readonly paths: Map<NodeIndex, Map<NodeIndex, Array<NodeIndex> | null>>
  readonly edgeWeights: Map<NodeIndex, Map<NodeIndex, Array<E>>>
}

/**
 * Find shortest paths between all pairs of nodes using Floyd-Warshall algorithm.
 *
 * Floyd-Warshall algorithm computes shortest paths between all pairs of nodes in O(V³) time.
 * It can handle negative edge weights and detect negative cycles.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 3)
 *   Graph.addEdge(mutable, b, c, 2)
 *   Graph.addEdge(mutable, a, c, 7)
 * })
 *
 * const result = Graph.floydWarshall(graph, (edgeData) => edgeData)
 * const distanceAToC = result.distances.get(0)?.get(2) // 5 (A->B->C)
 * const pathAToC = result.paths.get(0)?.get(2) // [0, 1, 2]
 * ```
 *
 * @since 2.0.0
 * @category algorithms
 */
export const floydWarshall = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  edgeWeight: (edgeData: E) => number
): AllPairsResult<E> => {
  const allNodes = Array.from(MutableHashMap.keys(graph.data.nodes))

  // Initialize distance matrix
  const dist = new Map<NodeIndex, Map<NodeIndex, number>>()
  const next = new Map<NodeIndex, Map<NodeIndex, NodeIndex | null>>()
  const edgeMatrix = new Map<NodeIndex, Map<NodeIndex, E | null>>()

  // Initialize with infinity for all pairs
  for (const i of allNodes) {
    dist.set(i, new Map())
    next.set(i, new Map())
    edgeMatrix.set(i, new Map())

    for (const j of allNodes) {
      dist.get(i)!.set(j, i === j ? 0 : Infinity)
      next.get(i)!.set(j, null)
      edgeMatrix.get(i)!.set(j, null)
    }
  }

  // Set edge weights
  for (const [, edgeData] of graph.data.edges) {
    const weight = edgeWeight(edgeData.data)
    const i = edgeData.source
    const j = edgeData.target

    // Use minimum weight if multiple edges exist
    const currentWeight = dist.get(i)!.get(j)!
    if (weight < currentWeight) {
      dist.get(i)!.set(j, weight)
      next.get(i)!.set(j, j)
      edgeMatrix.get(i)!.set(j, edgeData.data)
    }
  }

  // Floyd-Warshall main loop
  for (const k of allNodes) {
    for (const i of allNodes) {
      for (const j of allNodes) {
        const distIK = dist.get(i)!.get(k)!
        const distKJ = dist.get(k)!.get(j)!
        const distIJ = dist.get(i)!.get(j)!

        if (distIK !== Infinity && distKJ !== Infinity && distIK + distKJ < distIJ) {
          dist.get(i)!.set(j, distIK + distKJ)
          next.get(i)!.set(j, next.get(i)!.get(k)!)
        }
      }
    }
  }

  // Check for negative cycles
  for (const i of allNodes) {
    if (dist.get(i)!.get(i)! < 0) {
      throw new Error(`Negative cycle detected involving node ${i}`)
    }
  }

  // Build result paths and edge weights
  const paths = new Map<NodeIndex, Map<NodeIndex, Array<NodeIndex> | null>>()
  const resultEdgeWeights = new Map<NodeIndex, Map<NodeIndex, Array<E>>>()

  for (const i of allNodes) {
    paths.set(i, new Map())
    resultEdgeWeights.set(i, new Map())

    for (const j of allNodes) {
      if (i === j) {
        paths.get(i)!.set(j, [i])
        resultEdgeWeights.get(i)!.set(j, [])
      } else if (dist.get(i)!.get(j)! === Infinity) {
        paths.get(i)!.set(j, null)
        resultEdgeWeights.get(i)!.set(j, [])
      } else {
        // Reconstruct path
        const path: Array<NodeIndex> = []
        const weights: Array<E> = []
        let current = i

        while (current !== j) {
          path.push(current)
          const nextNode = next.get(current)!.get(j)!
          if (nextNode === null) break

          const edgeData = edgeMatrix.get(current)!.get(nextNode)!
          if (edgeData !== null) {
            weights.push(edgeData)
          }

          current = nextNode
        }

        if (current === j) {
          path.push(j)
          paths.get(i)!.set(j, path)
          resultEdgeWeights.get(i)!.set(j, weights)
        } else {
          paths.get(i)!.set(j, null)
          resultEdgeWeights.get(i)!.set(j, [])
        }
      }
    }
  }

  return {
    distances: dist,
    paths,
    edgeWeights: resultEdgeWeights
  }
}

/**
 * Find the shortest path between two nodes using A* pathfinding algorithm.
 *
 * A* is an extension of Dijkstra's algorithm that uses a heuristic function to guide
 * the search towards the target, potentially finding paths faster than Dijkstra's.
 * The heuristic must be admissible (never overestimate the actual cost).
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<{x: number, y: number}, number>((mutable) => {
 *   const a = Graph.addNode(mutable, {x: 0, y: 0})
 *   const b = Graph.addNode(mutable, {x: 1, y: 0})
 *   const c = Graph.addNode(mutable, {x: 2, y: 0})
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * // Manhattan distance heuristic
 * const heuristic = (nodeData: {x: number, y: number}, targetData: {x: number, y: number}) =>
 *   Math.abs(nodeData.x - targetData.x) + Math.abs(nodeData.y - targetData.y)
 *
 * const result = Graph.astar(graph, 0, 2, (edgeData) => edgeData, heuristic)
 * if (result !== null) {
 *   console.log(result.path) // [0, 1, 2] - shortest path
 *   console.log(result.distance) // 2 - total distance
 * }
 * ```
 *
 * @since 2.0.0
 * @category algorithms
 */
export const astar = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  source: NodeIndex,
  target: NodeIndex,
  edgeWeight: (edgeData: E) => number,
  heuristic: (sourceNodeData: N, targetNodeData: N) => number
): PathResult<E> | null => {
  // Validate that source and target nodes exist
  if (!MutableHashMap.has(graph.data.nodes, source)) {
    throw new Error(`Source node ${source} does not exist`)
  }
  if (!MutableHashMap.has(graph.data.nodes, target)) {
    throw new Error(`Target node ${target} does not exist`)
  }

  // Early return if source equals target
  if (source === target) {
    return {
      path: [source],
      distance: 0,
      edgeWeights: []
    }
  }

  // Get target node data for heuristic calculations
  const targetNodeData = MutableHashMap.get(graph.data.nodes, target)
  if (Option.isNone(targetNodeData)) {
    throw new Error(`Target node ${target} data not found`)
  }

  // Distance tracking (g-score) and f-score (g + h)
  const gScore = new Map<NodeIndex, number>()
  const fScore = new Map<NodeIndex, number>()
  const previous = new Map<NodeIndex, { node: NodeIndex; edgeData: E } | null>()
  const visited = new Set<NodeIndex>()

  // Initialize scores
  const allNodes = Array.from(MutableHashMap.keys(graph.data.nodes))
  for (const node of allNodes) {
    gScore.set(node, node === source ? 0 : Infinity)
    fScore.set(node, Infinity)
    previous.set(node, null)
  }

  // Calculate initial f-score for source
  const sourceNodeData = MutableHashMap.get(graph.data.nodes, source)
  if (Option.isSome(sourceNodeData)) {
    const h = heuristic(sourceNodeData.value, targetNodeData.value)
    fScore.set(source, h)
  }

  // Priority queue using f-score (total estimated cost)
  const openSet: Array<{ node: NodeIndex; fScore: number }> = [
    { node: source, fScore: fScore.get(source)! }
  ]

  while (openSet.length > 0) {
    // Find node with lowest f-score
    let minIndex = 0
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].fScore < openSet[minIndex].fScore) {
        minIndex = i
      }
    }

    const current = openSet.splice(minIndex, 1)[0]
    const currentNode = current.node

    // Skip if already visited
    if (visited.has(currentNode)) {
      continue
    }

    visited.add(currentNode)

    // Early termination if we reached the target
    if (currentNode === target) {
      break
    }

    // Get current g-score
    const currentGScore = gScore.get(currentNode)!

    // Examine all outgoing edges
    const adjacencyList = MutableHashMap.get(graph.data.adjacency, currentNode)
    if (Option.isSome(adjacencyList)) {
      for (const edgeIndex of adjacencyList.value) {
        const edge = MutableHashMap.get(graph.data.edges, edgeIndex)
        if (Option.isSome(edge)) {
          const neighbor = edge.value.target
          const weight = edgeWeight(edge.value.data)

          // Validate non-negative weights
          if (weight < 0) {
            throw new Error(`A* algorithm requires non-negative edge weights, found ${weight}`)
          }

          const tentativeGScore = currentGScore + weight
          const neighborGScore = gScore.get(neighbor)!

          // If this path to neighbor is better than any previous one
          if (tentativeGScore < neighborGScore) {
            // Update g-score and previous
            gScore.set(neighbor, tentativeGScore)
            previous.set(neighbor, { node: currentNode, edgeData: edge.value.data })

            // Calculate f-score using heuristic
            const neighborNodeData = MutableHashMap.get(graph.data.nodes, neighbor)
            if (Option.isSome(neighborNodeData)) {
              const h = heuristic(neighborNodeData.value, targetNodeData.value)
              const f = tentativeGScore + h
              fScore.set(neighbor, f)

              // Add to open set if not visited
              if (!visited.has(neighbor)) {
                openSet.push({ node: neighbor, fScore: f })
              }
            }
          }
        }
      }
    }
  }

  // Check if target is reachable
  const targetGScore = gScore.get(target)!
  if (targetGScore === Infinity) {
    return null // No path exists
  }

  // Reconstruct path
  const path: Array<NodeIndex> = []
  const edgeWeights: Array<E> = []
  let currentNode: NodeIndex | null = target

  while (currentNode !== null) {
    path.unshift(currentNode)
    const prev: { node: NodeIndex; edgeData: E } | null = previous.get(currentNode)!
    if (prev !== null) {
      edgeWeights.unshift(prev.edgeData)
      currentNode = prev.node
    } else {
      currentNode = null
    }
  }

  return {
    path,
    distance: targetGScore,
    edgeWeights
  }
}

/**
 * Find the shortest path between two nodes using Bellman-Ford algorithm.
 *
 * Bellman-Ford algorithm can handle negative edge weights and detects negative cycles.
 * It has O(VE) time complexity, slower than Dijkstra's but more versatile.
 * Returns null if a negative cycle is detected that affects the path.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, -1)  // Negative weight allowed
 *   Graph.addEdge(mutable, b, c, 3)
 *   Graph.addEdge(mutable, a, c, 5)
 * })
 *
 * const result = Graph.bellmanFord(graph, 0, 2, (edgeData) => edgeData)
 * if (result !== null) {
 *   console.log(result.path) // [0, 1, 2] - shortest path A->B->C
 *   console.log(result.distance) // 2 - total distance
 * }
 * ```
 *
 * @since 2.0.0
 * @category algorithms
 */
export const bellmanFord = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  source: NodeIndex,
  target: NodeIndex,
  edgeWeight: (edgeData: E) => number
): PathResult<E> | null => {
  // Validate that source and target nodes exist
  if (!MutableHashMap.has(graph.data.nodes, source)) {
    throw new Error(`Source node ${source} does not exist`)
  }
  if (!MutableHashMap.has(graph.data.nodes, target)) {
    throw new Error(`Target node ${target} does not exist`)
  }

  // Early return if source equals target
  if (source === target) {
    return {
      path: [source],
      distance: 0,
      edgeWeights: []
    }
  }

  // Initialize distances and predecessors
  const distances = new Map<NodeIndex, number>()
  const previous = new Map<NodeIndex, { node: NodeIndex; edgeData: E } | null>()
  const allNodes = Array.from(MutableHashMap.keys(graph.data.nodes))

  for (const node of allNodes) {
    distances.set(node, node === source ? 0 : Infinity)
    previous.set(node, null)
  }

  // Collect all edges for relaxation
  const edges: Array<{ source: NodeIndex; target: NodeIndex; weight: number; edgeData: E }> = []
  for (const [, edgeData] of graph.data.edges) {
    const weight = edgeWeight(edgeData.data)
    edges.push({
      source: edgeData.source,
      target: edgeData.target,
      weight,
      edgeData: edgeData.data
    })
  }

  // Relax edges up to V-1 times
  const nodeCount = allNodes.length
  for (let i = 0; i < nodeCount - 1; i++) {
    let hasUpdate = false

    for (const edge of edges) {
      const sourceDistance = distances.get(edge.source)!
      const targetDistance = distances.get(edge.target)!

      // Relaxation step
      if (sourceDistance !== Infinity && sourceDistance + edge.weight < targetDistance) {
        distances.set(edge.target, sourceDistance + edge.weight)
        previous.set(edge.target, { node: edge.source, edgeData: edge.edgeData })
        hasUpdate = true
      }
    }

    // Early termination if no updates
    if (!hasUpdate) {
      break
    }
  }

  // Check for negative cycles
  for (const edge of edges) {
    const sourceDistance = distances.get(edge.source)!
    const targetDistance = distances.get(edge.target)!

    if (sourceDistance !== Infinity && sourceDistance + edge.weight < targetDistance) {
      // Negative cycle detected - check if it affects the path to target
      const affectedNodes = new Set<NodeIndex>()
      const queue = [edge.target]

      while (queue.length > 0) {
        const node = queue.shift()!
        if (affectedNodes.has(node)) continue
        affectedNodes.add(node)

        // Add all nodes reachable from this node
        const adjacencyList = MutableHashMap.get(graph.data.adjacency, node)
        if (Option.isSome(adjacencyList)) {
          for (const edgeIndex of adjacencyList.value) {
            const edge = MutableHashMap.get(graph.data.edges, edgeIndex)
            if (Option.isSome(edge)) {
              queue.push(edge.value.target)
            }
          }
        }
      }

      // If target is affected by negative cycle, return null
      if (affectedNodes.has(target)) {
        return null
      }
    }
  }

  // Check if target is reachable
  const targetDistance = distances.get(target)!
  if (targetDistance === Infinity) {
    return null // No path exists
  }

  // Reconstruct path
  const path: Array<NodeIndex> = []
  const edgeWeights: Array<E> = []
  let currentNode: NodeIndex | null = target

  while (currentNode !== null) {
    path.unshift(currentNode)
    const prev: { node: NodeIndex; edgeData: E } | null = previous.get(currentNode)!
    if (prev !== null) {
      edgeWeights.unshift(prev.edgeData)
      currentNode = prev.node
    } else {
      currentNode = null
    }
  }

  return {
    path,
    distance: targetDistance,
    edgeWeights
  }
}

/**
 * Iterator Structs (Core Traversal)
 *
 * Stateful iterator objects for graph traversal, providing lazy evaluation and
 * fine-grained control over traversal state. These iterators can be paused,
 * resumed, and restarted, offering more flexibility than callback-based approaches.
 */

/**
 * Concrete class for iterables that produce [NodeIndex, NodeData] tuples.
 *
 * This class provides a common abstraction for all iterables that return node data,
 * including traversal iterators (DFS, BFS, etc.) and element iterators (nodes, externals).
 * It uses a mapEntry function pattern for flexible iteration and transformation.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, 1)
 * })
 *
 * // Both traversal and element iterators return NodeIterable
 * const dfsNodes: Graph.NodeIterable<string> = Graph.dfs(graph, { startNodes: [0] })
 * const allNodes: Graph.NodeIterable<string> = Graph.nodes(graph)
 *
 * // Common interface for working with node iterables
 * function processNodes<N>(nodeIterable: Graph.NodeIterable<N>): Array<number> {
 *   return Array.from(nodeIterable.indices())
 * }
 *
 * // Access node data using values() or entries()
 * const nodeData = Array.from(dfsNodes.values()) // ["A", "B"]
 * const nodeEntries = Array.from(allNodes.entries()) // [[0, "A"], [1, "B"]]
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export class NodeIterable<N> implements Iterable<[NodeIndex, N]> {
  readonly _tag = "NodeIterable" as const

  constructor(
    readonly mapEntryFn: <T>(f: (nodeIndex: NodeIndex, nodeData: N) => T) => Iterable<T>
  ) {}

  /**
   * Maps each node to a value using the provided function.
   *
   * Takes a function that receives the node index and node data,
   * and returns an iterable of the mapped values. Skips nodes that
   * no longer exist in the graph.
   *
   * @example
   * ```ts
   * import { Graph } from "effect"
   *
   * const graph = Graph.directed<string, number>((mutable) => {
   *   const a = Graph.addNode(mutable, "A")
   *   const b = Graph.addNode(mutable, "B")
   *   Graph.addEdge(mutable, a, b, 1)
   * })
   *
   * const dfs = Graph.dfs(graph, { startNodes: [0] })
   *
   * // Map to just the node data
   * const values = Array.from(dfs.mapEntry((index, data) => data))
   * console.log(values) // ["A", "B"]
   *
   * // Map to custom objects
   * const custom = Array.from(dfs.mapEntry((index, data) => ({ id: index, name: data })))
   * console.log(custom) // [{ id: 0, name: "A" }, { id: 1, name: "B" }]
   * ```
   *
   * @since 2.0.0
   * @category iterators
   */
  mapEntry<T>(f: (nodeIndex: NodeIndex, nodeData: N) => T): Iterable<T> {
    return this.mapEntryFn(f)
  }

  /**
   * Returns an iterator over the node indices in traversal order.
   *
   * @since 2.0.0
   * @category iterators
   */
  indices(): Iterable<NodeIndex> {
    return this.mapEntry((nodeIndex, _) => nodeIndex)
  }

  /**
   * Returns an iterator over the node values (data) in traversal order.
   *
   * @since 2.0.0
   * @category iterators
   */
  values(): Iterable<N> {
    return this.mapEntry((_, nodeData) => nodeData)
  }

  /**
   * Returns an iterator over [nodeIndex, nodeData] entries in traversal order.
   *
   * @since 2.0.0
   * @category iterators
   */
  entries(): Iterable<[NodeIndex, N]> {
    return this.mapEntry((nodeIndex, nodeData) => [nodeIndex, nodeData])
  }

  /**
   * Default iterator implementation that delegates to entries().
   *
   * @since 2.0.0
   * @category iterators
   */
  [Symbol.iterator](): Iterator<[NodeIndex, N]> {
    return this.entries()[Symbol.iterator]()
  }
}

/**
 * Concrete class for iterables that produce [EdgeIndex, EdgeData] tuples.
 *
 * This provides a common interface for all edge-based iterators, allowing them
 * to be used interchangeably with utility functions that work on edge collections.
 * It uses a mapEntry function pattern for flexible iteration and transformation.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, 1)
 * })
 *
 * const edgeIterable = Graph.edges(graph)
 *
 * // Access edge indices, data, or entries
 * const indices = Array.from(edgeIterable.indices()) // [0]
 * const data = Array.from(edgeIterable.values()) // [{ source: 0, target: 1, data: 1 }]
 * const entries = Array.from(edgeIterable.entries()) // [[0, { source: 0, target: 1, data: 1 }]]
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export class EdgeIterable<E> implements Iterable<[EdgeIndex, EdgeData<E>]> {
  readonly _tag = "EdgeIterable" as const

  constructor(
    readonly mapEntryFn: <T>(f: (edgeIndex: EdgeIndex, edgeData: EdgeData<E>) => T) => Iterable<T>
  ) {}

  /**
   * Maps each edge to a value using the provided function.
   *
   * Takes a function that receives the edge index and edge data,
   * and returns an iterable of the mapped values. Skips edges that
   * no longer exist in the graph.
   *
   * @example
   * ```ts
   * import { Graph } from "effect"
   *
   * const graph = Graph.directed<string, number>((mutable) => {
   *   const a = Graph.addNode(mutable, "A")
   *   const b = Graph.addNode(mutable, "B")
   *   Graph.addEdge(mutable, a, b, 42)
   * })
   *
   * const edgeIterable = Graph.edges(graph)
   *
   * // Map to just the edge data
   * const weights = Array.from(edgeIterable.mapEntry((index, edgeData) => edgeData.data))
   * console.log(weights) // [42]
   *
   * // Map to custom objects
   * const connections = Array.from(edgeIterable.mapEntry((index, edgeData) => ({
   *   id: index,
   *   from: edgeData.source,
   *   to: edgeData.target,
   *   weight: edgeData.data
   * })))
   * console.log(connections) // [{ id: 0, from: 0, to: 1, weight: 42 }]
   * ```
   *
   * @since 2.0.0
   * @category iterators
   */
  mapEntry<T>(f: (edgeIndex: EdgeIndex, edgeData: EdgeData<E>) => T): Iterable<T> {
    return this.mapEntryFn(f)
  }

  /**
   * Returns an iterator over the edge indices in traversal order.
   *
   * @since 2.0.0
   * @category iterators
   */
  indices(): Iterable<EdgeIndex> {
    return this.mapEntry((edgeIndex, _) => edgeIndex)
  }

  /**
   * Returns an iterator over the edge values (data) in traversal order.
   *
   * @since 2.0.0
   * @category iterators
   */
  values(): Iterable<E> {
    return this.mapEntry((_, edgeData) => edgeData.data)
  }

  /**
   * Returns an iterator over [edgeIndex, edgeData] entries in traversal order.
   *
   * @since 2.0.0
   * @category iterators
   */
  entries(): Iterable<[EdgeIndex, EdgeData<E>]> {
    return this.mapEntry((edgeIndex, edgeData) => [edgeIndex, edgeData])
  }

  /**
   * Default iterator implementation that delegates to entries().
   *
   * @since 2.0.0
   * @category iterators
   */
  [Symbol.iterator](): Iterator<[EdgeIndex, EdgeData<E>]> {
    return this.entries()[Symbol.iterator]()
  }
}

/**
 * Stateful depth-first search iterator.
 *
 * Provides step-by-step DFS traversal with explicit state management.
 * The iterator maintains a stack of nodes to visit and tracks discovered nodes.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * const dfs = Graph.dfsNew(graph, 0)
 * for (const nodeIndex of dfs.indices()) {
 *   console.log(nodeIndex) // 0, 1, 2
 * }
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */

/**
 * Configuration options for DFS iterator.
 *
 * @since 2.0.0
 * @category models
 */
export interface DfsConfig {
  readonly startNodes?: Array<NodeIndex>
  readonly direction?: Direction
}

/**
 * Creates a new DFS iterator with optional configuration.
 *
 * The iterator maintains a stack of nodes to visit and tracks discovered nodes.
 * It provides lazy evaluation of the depth-first search.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * // Start from a specific node
 * const dfs1 = Graph.dfs(graph, { startNodes: [0] })
 * for (const nodeIndex of dfs1.indices()) {
 *   console.log(nodeIndex) // Traverses in DFS order: 0, 1, 2
 * }
 *
 * // Empty iterator (no starting nodes)
 * const dfs2 = Graph.dfs(graph)
 * // Can be used programmatically
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */
export const dfs = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  config: DfsConfig = {}
): NodeIterable<N> => {
  const startNodes = config.startNodes ?? []
  const direction = config.direction ?? "outgoing"

  // Validate that all start nodes exist
  for (const nodeIndex of startNodes) {
    if (!hasNode(graph, nodeIndex)) {
      throw new Error(`Start node ${nodeIndex} does not exist`)
    }
  }

  return new NodeIterable((f) => ({
    [Symbol.iterator]: () => {
      const stack = [...startNodes]
      const discovered = new Set<NodeIndex>()

      const nextMapped = () => {
        while (stack.length > 0) {
          const current = stack.pop()!

          if (discovered.has(current)) {
            continue
          }

          discovered.add(current)

          const nodeDataOption = MutableHashMap.get(graph.data.nodes, current)
          if (Option.isNone(nodeDataOption)) {
            continue
          }

          const neighbors = neighborsDirected(graph, current, direction)
          for (let i = neighbors.length - 1; i >= 0; i--) {
            const neighbor = neighbors[i]
            if (!discovered.has(neighbor)) {
              stack.push(neighbor)
            }
          }

          return { done: false, value: f(current, nodeDataOption.value) }
        }

        return { done: true, value: undefined } as const
      }

      return { next: nextMapped }
    }
  }))
}

/**
 * Stateful breadth-first search iterator.
 *
 * Provides step-by-step BFS traversal with explicit state management.
 * The iterator maintains a queue of nodes to visit and tracks discovered nodes.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * const bfs = Graph.bfsNew(graph, 0)
 * for (const node of bfs) {
 *   console.log(node) // 0, 1, 2 (level-order)
 * }
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */

/**
 * Configuration options for BFS iterator.
 *
 * @since 2.0.0
 * @category models
 */
export interface BfsConfig {
  readonly startNodes?: Array<NodeIndex>
  readonly direction?: Direction
}

/**
 * Creates a new BFS iterator with optional configuration.
 *
 * The iterator maintains a queue of nodes to visit and tracks discovered nodes.
 * It provides lazy evaluation of the breadth-first search.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * // Start from a specific node
 * const bfs1 = Graph.bfs(graph, { startNodes: [0] })
 * for (const nodeIndex of bfs1.indices()) {
 *   console.log(nodeIndex) // Traverses in BFS order: 0, 1, 2
 * }
 *
 * // Empty iterator (no starting nodes)
 * const bfs2 = Graph.bfs(graph)
 * // Can be used programmatically
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */
export const bfs = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  config: BfsConfig = {}
): NodeIterable<N> => {
  const startNodes = config.startNodes ?? []
  const direction = config.direction ?? "outgoing"

  // Validate that all start nodes exist
  for (const nodeIndex of startNodes) {
    if (!hasNode(graph, nodeIndex)) {
      throw new Error(`Start node ${nodeIndex} does not exist`)
    }
  }

  return new NodeIterable((f) => ({
    [Symbol.iterator]: () => {
      const queue = [...startNodes]
      const discovered = new Set<NodeIndex>()

      const nextMapped = () => {
        while (queue.length > 0) {
          const current = queue.shift()!

          if (!discovered.has(current)) {
            discovered.add(current)

            const neighbors = neighborsDirected(graph, current, direction)
            for (const neighbor of neighbors) {
              if (!discovered.has(neighbor)) {
                queue.push(neighbor)
              }
            }

            const nodeData = getNode(graph, current)
            if (Option.isSome(nodeData)) {
              return { done: false, value: f(current, nodeData.value) }
            }
            return nextMapped()
          }
        }

        return { done: true, value: undefined } as const
      }

      return { next: nextMapped }
    }
  }))
}

/**
 * Stateful topological sort iterator.
 *
 * Provides step-by-step topological ordering with explicit state management.
 * The iterator uses Kahn's algorithm to lazily produce nodes in topological order.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A") // 0
 *   const b = Graph.addNode(mutable, "B") // 1
 *   const c = Graph.addNode(mutable, "C") // 2
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * const topo = Graph.topoNew(graph)
 * if (topo) {
 *   for (const nodeIndex of topo.indices()) {
 *     console.log(nodeIndex) // 0, 1, 2 (topological order)
 *   }
 * }
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */

/**
 * Creates a new topological sort iterator for the entire graph.
 *
 * The iterator will produce nodes in topological order using Kahn's algorithm.
 * Returns null if the graph contains cycles.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, 1)
 * })
 *
 * const topo = Graph.topoNew(graph)
 * if (topo !== null) {
 *   for (const nodeIndex of topo.indices()) {
 *     console.log(nodeIndex) // Topological order
 *   }
 * }
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */
/**
 * Configuration options for topological sort iterator.
 *
 * @since 2.0.0
 * @category models
 */
export interface TopoConfig {
  readonly initials?: Array<NodeIndex>
}

/**
 * Creates a new topological sort iterator with optional configuration.
 *
 * The iterator uses Kahn's algorithm to lazily produce nodes in topological order.
 * Throws an error if the graph contains cycles.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * // Standard topological sort
 * const topo1 = Graph.topo(graph)
 * for (const nodeIndex of topo1.indices()) {
 *   console.log(nodeIndex) // 0, 1, 2 (topological order)
 * }
 *
 * // With initial nodes
 * const topo2 = Graph.topo(graph, { initials: [0] })
 *
 * // Throws error for cyclic graph
 * const cyclicGraph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, a, 2) // Creates cycle
 * })
 *
 * try {
 *   Graph.topo(cyclicGraph) // Throws: "Cannot perform topological sort on cyclic graph"
 * } catch (error) {
 *   console.log((error as Error).message)
 * }
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */
export const topo = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  config: TopoConfig = {}
): NodeIterable<N> => {
  // Check if graph is acyclic first
  if (!isAcyclic(graph)) {
    throw new Error("Cannot perform topological sort on cyclic graph")
  }

  const initials = config.initials ?? []

  // Validate that all initial nodes exist
  for (const nodeIndex of initials) {
    if (!hasNode(graph, nodeIndex)) {
      throw new Error(`Initial node ${nodeIndex} does not exist`)
    }
  }

  return new NodeIterable((f) => ({
    [Symbol.iterator]: () => {
      const inDegree = new Map<NodeIndex, number>()
      const remaining = new Set<NodeIndex>()
      const queue = [...initials]

      // Initialize in-degree counts
      for (const [nodeIndex] of graph.data.nodes) {
        inDegree.set(nodeIndex, 0)
        remaining.add(nodeIndex)
      }

      // Calculate in-degrees
      for (const [, edgeData] of graph.data.edges) {
        const currentInDegree = inDegree.get(edgeData.target) || 0
        inDegree.set(edgeData.target, currentInDegree + 1)
      }

      // Add nodes with zero in-degree to queue if no initials provided
      if (initials.length === 0) {
        for (const [nodeIndex, degree] of inDegree) {
          if (degree === 0) {
            queue.push(nodeIndex)
          }
        }
      }

      const nextMapped = () => {
        while (queue.length > 0) {
          const current = queue.shift()!

          if (remaining.has(current)) {
            remaining.delete(current)

            // Process outgoing edges, reducing in-degree of targets
            const neighbors = neighborsDirected(graph, current, "outgoing")
            for (const neighbor of neighbors) {
              if (remaining.has(neighbor)) {
                const currentInDegree = inDegree.get(neighbor) || 0
                const newInDegree = currentInDegree - 1
                inDegree.set(neighbor, newInDegree)

                // If in-degree becomes 0, add to queue
                if (newInDegree === 0) {
                  queue.push(neighbor)
                }
              }
            }

            const nodeData = getNode(graph, current)
            if (Option.isSome(nodeData)) {
              return { done: false, value: f(current, nodeData.value) }
            }
            return nextMapped()
          }
        }

        return { done: true, value: undefined } as const
      }

      return { next: nextMapped }
    }
  }))
}

/**
 * Stateful depth-first search postorder iterator.
 *
 * Provides step-by-step DFS traversal that emits nodes in postorder
 * (each node is emitted after all its descendants have been processed).
 * Essential for dependency resolution, tree destruction, and algorithms
 * that require processing children before parents.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * const dfsPost = Graph.dfsPostOrder(graph, { startNodes: [0] })
 * for (const nodeIndex of dfsPost.indices()) {
 *   console.log(nodeIndex) // 2, 1, 0 (children before parents)
 * }
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */

/**
 * Configuration options for DFS postorder iterator.
 *
 * @since 2.0.0
 * @category models
 */
export interface DfsPostOrderConfig {
  readonly startNodes?: Array<NodeIndex>
  readonly direction?: Direction
}

/**
 * Creates a new DFS postorder iterator with optional configuration.
 *
 * The iterator maintains a stack with visit state tracking and emits nodes
 * in postorder (after all descendants have been processed). Essential for
 * dependency resolution and tree destruction algorithms.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const root = Graph.addNode(mutable, "root")
 *   const child1 = Graph.addNode(mutable, "child1")
 *   const child2 = Graph.addNode(mutable, "child2")
 *   Graph.addEdge(mutable, root, child1, 1)
 *   Graph.addEdge(mutable, root, child2, 1)
 * })
 *
 * // Postorder: children before parents
 * const postOrder = Graph.dfsPostOrder(graph, { startNodes: [0] })
 * for (const node of postOrder) {
 *   console.log(node) // 1, 2, 0
 * }
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */
export const dfsPostOrder = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  config: DfsPostOrderConfig = {}
): NodeIterable<N> => {
  const startNodes = config.startNodes ?? []
  const direction = config.direction ?? "outgoing"

  // Validate that all start nodes exist
  for (const nodeIndex of startNodes) {
    if (!hasNode(graph, nodeIndex)) {
      throw new Error(`Start node ${nodeIndex} does not exist`)
    }
  }

  return new NodeIterable((f) => ({
    [Symbol.iterator]: () => {
      const stack: Array<{ node: NodeIndex; visitedChildren: boolean }> = []
      const discovered = new Set<NodeIndex>()
      const finished = new Set<NodeIndex>()

      // Initialize stack with start nodes
      for (let i = startNodes.length - 1; i >= 0; i--) {
        stack.push({ node: startNodes[i], visitedChildren: false })
      }

      const nextMapped = () => {
        while (stack.length > 0) {
          const current = stack[stack.length - 1]

          if (!discovered.has(current.node)) {
            discovered.add(current.node)
            current.visitedChildren = false
          }

          if (!current.visitedChildren) {
            current.visitedChildren = true
            const neighbors = neighborsDirected(graph, current.node, direction)

            for (let i = neighbors.length - 1; i >= 0; i--) {
              const neighbor = neighbors[i]
              if (!discovered.has(neighbor) && !finished.has(neighbor)) {
                stack.push({ node: neighbor, visitedChildren: false })
              }
            }
          } else {
            const nodeToEmit = stack.pop()!.node

            if (!finished.has(nodeToEmit)) {
              finished.add(nodeToEmit)

              const nodeData = getNode(graph, nodeToEmit)
              if (Option.isSome(nodeData)) {
                return { done: false, value: f(nodeToEmit, nodeData.value) }
              }
              return nextMapped()
            }
          }
        }

        return { done: true, value: undefined } as const
      }

      return { next: nextMapped }
    }
  }))
}

/**
 * Creates an iterator over all node indices in the graph.
 *
 * The iterator produces node indices in the order they were added to the graph.
 * This provides access to all nodes regardless of connectivity.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 * })
 *
 * const nodeIndices = Array.from(Graph.nodes(graph).indices())
 * console.log(nodeIndices) // [0, 1, 2]
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */
export const nodes = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>
): NodeIterable<N> =>
  new NodeIterable((f) => ({
    [Symbol.iterator]() {
      const nodeMap = graph.data.nodes
      const keys = MutableHashMap.keys(nodeMap)
      const values = MutableHashMap.values(nodeMap)
      let index = 0

      return {
        next() {
          if (index >= keys.length) {
            return { done: true, value: undefined }
          }
          const result = f(keys[index], values[index])
          index++
          return { done: false, value: result }
        }
      }
    }
  }))

/**
 * Creates an iterator over all edge indices in the graph.
 *
 * The iterator produces edge indices in the order they were added to the graph.
 * This provides access to all edges regardless of connectivity.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 2)
 * })
 *
 * const edgeIndices = Array.from(Graph.edges(graph).indices())
 * console.log(edgeIndices) // [0, 1]
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */
export const edges = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>
): EdgeIterable<E> =>
  new EdgeIterable((f) => ({
    [Symbol.iterator]() {
      const edgeMap = graph.data.edges
      const keys = MutableHashMap.keys(edgeMap)
      const values = MutableHashMap.values(edgeMap)
      let index = 0

      return {
        next() {
          if (index >= keys.length) {
            return { done: true, value: undefined }
          }
          const result = f(keys[index], values[index])
          index++
          return { done: false, value: result }
        }
      }
    }
  }))

/**
 * Configuration for externals iterator.
 *
 * @since 2.0.0
 * @category models
 */
export interface ExternalsConfig {
  readonly direction?: Direction
}

/**
 * Iterator class for external nodes (nodes without edges in specified direction).
 *
 * @since 2.0.0
 * @category iterators
 */

/**
 * Creates an iterator over external nodes (nodes without edges in specified direction).
 *
 * External nodes are nodes that have no outgoing edges (direction="outgoing") or
 * no incoming edges (direction="incoming"). These are useful for finding
 * sources, sinks, or isolated nodes.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const source = Graph.addNode(mutable, "source")     // 0 - no incoming
 *   const middle = Graph.addNode(mutable, "middle")     // 1 - has both
 *   const sink = Graph.addNode(mutable, "sink")         // 2 - no outgoing
 *   const isolated = Graph.addNode(mutable, "isolated") // 3 - no edges
 *
 *   Graph.addEdge(mutable, source, middle, 1)
 *   Graph.addEdge(mutable, middle, sink, 2)
 * })
 *
 * // Nodes with no outgoing edges (sinks + isolated)
 * const sinks = Array.from(Graph.externals(graph, { direction: "outgoing" }).indices())
 * console.log(sinks) // [2, 3]
 *
 * // Nodes with no incoming edges (sources + isolated)
 * const sources = Array.from(Graph.externals(graph, { direction: "incoming" }).indices())
 * console.log(sources) // [0, 3]
 * ```
 *
 * @since 2.0.0
 * @category iterators
 */
export const externals = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  config: ExternalsConfig = {}
): NodeIterable<N> => {
  const direction = config.direction ?? "outgoing"

  return new NodeIterable((f) => ({
    [Symbol.iterator]: () => {
      const nodeMap = graph.data.nodes
      const adjacencyMap = direction === "incoming"
        ? graph.data.reverseAdjacency
        : graph.data.adjacency

      const allNodes = Array.from(MutableHashMap.keys(nodeMap))
      let index = 0

      const nextMapped = () => {
        while (index < allNodes.length) {
          const nodeIndex = allNodes[index++]
          const adjacencyList = MutableHashMap.get(adjacencyMap, nodeIndex)

          // Node is external if it has no edges in the specified direction
          if (Option.isNone(adjacencyList) || adjacencyList.value.length === 0) {
            const nodeDataOption = MutableHashMap.get(nodeMap, nodeIndex)
            if (Option.isSome(nodeDataOption)) {
              return { done: false, value: f(nodeIndex, nodeDataOption.value) }
            }
          }
        }

        return { done: true, value: undefined } as const
      }

      return { next: nextMapped }
    }
  }))
}
