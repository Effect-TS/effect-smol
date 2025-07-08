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

  *[Symbol.iterator](): IterableIterator<readonly [NodeIndex, N]> {
    for (const [nodeIndex, nodeData] of this.data.nodes) {
      yield [nodeIndex, nodeData] as const
    }
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
 * const outgoingNodes = Array.from(Graph.nodes(graph, [0], "dfs", "outgoing"))
 *
 * // Follow incoming edges (reverse direction)
 * const incomingNodes = Array.from(Graph.nodes(graph, [1], "dfs", "incoming"))
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type Direction = "outgoing" | "incoming"

// =============================================================================
// Simple Iteration Utilities using Visitor Pattern
// =============================================================================

/**
 * Traversal algorithm type for simple iteration.
 *
 * @since 2.0.0
 * @category models
 */
export type TraversalAlgorithm = "dfs" | "bfs"

/**
 * Creates an iterable that yields nodes in the specified traversal order.
 *
 * This function provides a simple interface for node iteration using the powerful
 * visitor pattern under the hood. It supports both DFS and BFS algorithms with
 * bidirectional traversal.
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
 *   Graph.addEdge(mutable, a, c, "A->C")
 * })
 *
 * // DFS traversal
 * for (const node of Graph.nodes(graph, [0], "dfs")) {
 *   console.log(node) // 0, 2, 1 (or similar DFS order)
 * }
 *
 * // BFS traversal
 * const bfsNodes = Array.from(Graph.nodes(graph, [0], "bfs"))
 * console.log(bfsNodes) // [0, 1, 2] (level-by-level)
 *
 * // Reverse traversal
 * const incoming = Array.from(Graph.nodes(graph, [2], "dfs", "incoming"))
 * console.log(incoming) // [2, 1, 0] (reverse direction)
 * ```
 *
 * @since 2.0.0
 * @category traversal
 */
export const nodes = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  starts: Array<NodeIndex>,
  algorithm: TraversalAlgorithm = "dfs",
  direction: Direction = "outgoing"
): Iterable<NodeIndex> => ({
  *[Symbol.iterator]() {
    const discovered: Array<NodeIndex> = []
    const visitor: Visitor<N, E> = (event) => {
      if (event._tag === "DiscoverNode") {
        discovered.push(event.node)
      }
      return "Continue"
    }

    // Direction-aware traversal using custom implementations
    if (algorithm === "dfs") {
      // Custom DFS with direction support
      const discoveredSet = new Set<NodeIndex>()
      const finished = new Set<NodeIndex>()
      const stack: Array<{ node: NodeIndex; neighbors: Array<NodeIndex>; neighborIndex: number }> = []

      for (const start of starts) {
        if (discoveredSet.has(start)) continue

        const startNeighbors = neighborsDirected(graph, start, direction)
        stack.push({ node: start, neighbors: startNeighbors, neighborIndex: 0 })
        discoveredSet.add(start)

        const startNodeData = MutableHashMap.get(graph.data.nodes, start)
        if (Option.isSome(startNodeData)) {
          const discoverEvent: TraversalEvent<N, E> = {
            _tag: "DiscoverNode",
            node: start,
            data: startNodeData.value
          }
          const control = visitor(discoverEvent)
          if (control === "Break") return
          if (control === "Prune") {
            finished.add(start)
            continue
          }
        }

        while (stack.length > 0) {
          const current = stack[stack.length - 1]

          if (current.neighborIndex >= current.neighbors.length) {
            stack.pop()
            finished.add(current.node)
            continue
          }

          const neighbor = current.neighbors[current.neighborIndex]
          current.neighborIndex++

          if (!discoveredSet.has(neighbor)) {
            discoveredSet.add(neighbor)

            const neighborNodeData = MutableHashMap.get(graph.data.nodes, neighbor)
            if (Option.isSome(neighborNodeData)) {
              const discoverEvent: TraversalEvent<N, E> = {
                _tag: "DiscoverNode",
                node: neighbor,
                data: neighborNodeData.value
              }
              const control = visitor(discoverEvent)
              if (control === "Break") return
              if (control === "Prune") {
                finished.add(neighbor)
                continue
              }
            }

            const neighborNeighbors = neighborsDirected(graph, neighbor, direction)
            stack.push({ node: neighbor, neighbors: neighborNeighbors, neighborIndex: 0 })
          }
        }
      }
    } else {
      // Custom BFS with direction support
      const discoveredSet = new Set<NodeIndex>()
      const finished = new Set<NodeIndex>()
      const queue: Array<NodeIndex> = []

      for (const start of starts) {
        if (!discoveredSet.has(start)) {
          discoveredSet.add(start)
          queue.push(start)

          const startNodeData = MutableHashMap.get(graph.data.nodes, start)
          if (Option.isSome(startNodeData)) {
            const discoverEvent: TraversalEvent<N, E> = {
              _tag: "DiscoverNode",
              node: start,
              data: startNodeData.value
            }
            const control = visitor(discoverEvent)
            if (control === "Break") return
            if (control === "Prune") {
              finished.add(start)
              continue
            }
          }
        }
      }

      while (queue.length > 0) {
        const current = queue.shift()!
        const nodeNeighbors = neighborsDirected(graph, current, direction)

        for (const neighbor of nodeNeighbors) {
          if (!discoveredSet.has(neighbor)) {
            discoveredSet.add(neighbor)

            const neighborNodeData = MutableHashMap.get(graph.data.nodes, neighbor)
            if (Option.isSome(neighborNodeData)) {
              const discoverEvent: TraversalEvent<N, E> = {
                _tag: "DiscoverNode",
                node: neighbor,
                data: neighborNodeData.value
              }
              const control = visitor(discoverEvent)
              if (control === "Break") return
              if (control === "Prune") {
                finished.add(neighbor)
                continue
              }
            }

            queue.push(neighbor)
          }
        }

        finished.add(current)
      }
    }

    yield* discovered
  }
})

// =============================================================================
// Event-driven traversal with user programs (Phase 4C)
// =============================================================================

/**
 * Events that occur during graph traversal, allowing user programs to react to different stages.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const visitor = (event: Graph.TraversalEvent<string, number>) => {
 *   switch (event._tag) {
 *     case "DiscoverNode":
 *       console.log(`Discovered node: ${event.data}`)
 *       return "Continue"
 *     case "FinishNode":
 *       console.log(`Finished node: ${event.data}`)
 *       return "Continue"
 *     case "TreeEdge":
 *       console.log(`Tree edge: ${event.data}`)
 *       return "Continue"
 *   }
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type TraversalEvent<N, E> =
  | { readonly _tag: "DiscoverNode"; readonly node: NodeIndex; readonly data: N }
  | { readonly _tag: "FinishNode"; readonly node: NodeIndex; readonly data: N }
  | {
    readonly _tag: "TreeEdge"
    readonly edge: EdgeIndex
    readonly data: E
    readonly source: NodeIndex
    readonly target: NodeIndex
  }
  | {
    readonly _tag: "BackEdge"
    readonly edge: EdgeIndex
    readonly data: E
    readonly source: NodeIndex
    readonly target: NodeIndex
  }
  | {
    readonly _tag: "CrossEdge"
    readonly edge: EdgeIndex
    readonly data: E
    readonly source: NodeIndex
    readonly target: NodeIndex
  }

/**
 * Control flow instructions that user programs can return to control traversal behavior.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const visitor = (event: Graph.TraversalEvent<string, number>) => {
 *   if (event._tag === "DiscoverNode" && event.data === "stop") {
 *     return "Break" // Stop traversal completely
 *   }
 *   if (event._tag === "DiscoverNode" && event.data === "skip") {
 *     return "Prune" // Skip this subtree
 *   }
 *   return "Continue" // Continue normal traversal
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type ControlFlow = "Continue" | "Break" | "Prune"

/**
 * User-defined visitor function that receives traversal events and returns control flow instructions.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const visitor: Graph.Visitor<string, number> = (event) => {
 *   switch (event._tag) {
 *     case "DiscoverNode":
 *       console.log(`Visiting node: ${event.data}`)
 *       return "Continue"
 *     case "TreeEdge":
 *       console.log(`Following edge with weight: ${event.data}`)
 *       return "Continue"
 *     default:
 *       return "Continue"
 *   }
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type Visitor<N, E> = (event: TraversalEvent<N, E>) => ControlFlow

/**
 * Performs a depth-first search with user-defined visitor program for event-driven traversal.
 *
 * This function provides fine-grained control over traversal behavior by calling a user-defined
 * visitor function at key points during the search, allowing custom logic and early termination.
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
 * const visitor: Graph.Visitor<string, number> = (event) => {
 *   switch (event._tag) {
 *     case "DiscoverNode":
 *       console.log(`Discovered: ${event.data}`)
 *       return "Continue"
 *     case "TreeEdge":
 *       console.log(`Edge weight: ${event.data}`)
 *       return "Continue"
 *     default:
 *       return "Continue"
 *   }
 * }
 *
 * Graph.depthFirstSearch(graph, [0], visitor)
 * ```
 *
 * @since 2.0.0
 * @category traversal
 */
export const depthFirstSearch = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  starts: Array<NodeIndex>,
  visitor: Visitor<N, E>
): void => {
  // State tracking for different edge types
  const discovered = new Set<NodeIndex>()
  const finished = new Set<NodeIndex>()
  const stack: Array<{ node: NodeIndex; neighbors: Array<NodeIndex>; neighborIndex: number }> = []

  // Process each starting node
  for (const start of starts) {
    if (discovered.has(start)) continue

    // Initialize stack with starting node
    const startNeighbors = neighborsDirected(graph, start, "outgoing")
    stack.push({ node: start, neighbors: startNeighbors, neighborIndex: 0 })
    discovered.add(start)

    // Emit discover event for start node
    const startNodeData = MutableHashMap.get(graph.data.nodes, start)
    if (Option.isSome(startNodeData)) {
      const discoverEvent: TraversalEvent<N, E> = {
        _tag: "DiscoverNode",
        node: start,
        data: startNodeData.value
      }
      const control = visitor(discoverEvent)
      if (control === "Break") return
      if (control === "Prune") {
        finished.add(start)
        continue
      }
    }

    // Iterative DFS
    while (stack.length > 0) {
      const current = stack[stack.length - 1]

      if (current.neighborIndex >= current.neighbors.length) {
        // Finished with this node
        stack.pop()
        finished.add(current.node)

        // Emit finish event
        const currentNodeData = MutableHashMap.get(graph.data.nodes, current.node)
        if (Option.isSome(currentNodeData)) {
          const finishEvent: TraversalEvent<N, E> = {
            _tag: "FinishNode",
            node: current.node,
            data: currentNodeData.value
          }
          const control = visitor(finishEvent)
          if (control === "Break") return
        }
        continue
      }

      const neighbor = current.neighbors[current.neighborIndex]
      current.neighborIndex++

      // Find the edge connecting current node to neighbor
      const edges = Option.getOrElse(MutableHashMap.get(graph.data.adjacency, current.node), () => [])
      let edgeIndex: EdgeIndex | null = null
      for (const edge of edges) {
        const edgeData = MutableHashMap.get(graph.data.edges, edge)
        if (Option.isSome(edgeData) && edgeData.value.target === neighbor) {
          edgeIndex = edge
          break
        }
      }

      if (edgeIndex !== null) {
        const edgeData = MutableHashMap.get(graph.data.edges, edgeIndex)
        if (Option.isSome(edgeData)) {
          let edgeEvent: TraversalEvent<N, E>

          if (!discovered.has(neighbor)) {
            // Tree edge
            edgeEvent = {
              _tag: "TreeEdge",
              edge: edgeIndex,
              data: edgeData.value.data,
              source: current.node,
              target: neighbor
            }
          } else if (!finished.has(neighbor)) {
            // Back edge (cycle)
            edgeEvent = {
              _tag: "BackEdge",
              edge: edgeIndex,
              data: edgeData.value.data,
              source: current.node,
              target: neighbor
            }
          } else {
            // Cross edge
            edgeEvent = {
              _tag: "CrossEdge",
              edge: edgeIndex,
              data: edgeData.value.data,
              source: current.node,
              target: neighbor
            }
          }

          const edgeControl = visitor(edgeEvent)
          if (edgeControl === "Break") return
          if (edgeControl === "Prune") continue
        }
      }

      // Process neighbor if it's a tree edge
      if (!discovered.has(neighbor)) {
        discovered.add(neighbor)

        // Emit discover event for neighbor
        const neighborNodeData = MutableHashMap.get(graph.data.nodes, neighbor)
        if (Option.isSome(neighborNodeData)) {
          const discoverEvent: TraversalEvent<N, E> = {
            _tag: "DiscoverNode",
            node: neighbor,
            data: neighborNodeData.value
          }
          const control = visitor(discoverEvent)
          if (control === "Break") return
          if (control === "Prune") {
            finished.add(neighbor)
            continue
          }
        }

        // Add neighbor to stack
        const neighborNeighbors = neighborsDirected(graph, neighbor, "outgoing")
        stack.push({ node: neighbor, neighbors: neighborNeighbors, neighborIndex: 0 })
      }
    }
  }
}

/**
 * Performs a breadth-first search with user-defined visitor program for event-driven traversal.
 *
 * This function provides fine-grained control over traversal behavior by calling a user-defined
 * visitor function at key points during the search, allowing custom logic and early termination.
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
 *   Graph.addEdge(mutable, a, c, 2)
 * })
 *
 * const visitor: Graph.Visitor<string, number> = (event) => {
 *   switch (event._tag) {
 *     case "DiscoverNode":
 *       console.log(`Discovered: ${event.data}`)
 *       return "Continue"
 *     case "TreeEdge":
 *       console.log(`Edge weight: ${event.data}`)
 *       return "Continue"
 *     default:
 *       return "Continue"
 *   }
 * }
 *
 * Graph.breadthFirstSearch(graph, [0], visitor)
 * ```
 *
 * @since 2.0.0
 * @category traversal
 */
export const breadthFirstSearch = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  starts: Array<NodeIndex>,
  visitor: Visitor<N, E>
): void => {
  // State tracking for different edge types
  const discovered = new Set<NodeIndex>()
  const finished = new Set<NodeIndex>()
  const queue: Array<NodeIndex> = []

  // Add all starting nodes to queue
  for (const start of starts) {
    if (!discovered.has(start)) {
      discovered.add(start)
      queue.push(start)

      // Emit discover event for start node
      const startNodeData = MutableHashMap.get(graph.data.nodes, start)
      if (Option.isSome(startNodeData)) {
        const discoverEvent: TraversalEvent<N, E> = {
          _tag: "DiscoverNode",
          node: start,
          data: startNodeData.value
        }
        const control = visitor(discoverEvent)
        if (control === "Break") return
        if (control === "Prune") {
          finished.add(start)
          continue
        }
      }
    }
  }

  // Iterative BFS
  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = neighborsDirected(graph, current, "outgoing")

    for (const neighbor of neighbors) {
      // Find the edge connecting current node to neighbor
      const edges = Option.getOrElse(MutableHashMap.get(graph.data.adjacency, current), () => [])
      let edgeIndex: EdgeIndex | null = null
      for (const edge of edges) {
        const edgeData = MutableHashMap.get(graph.data.edges, edge)
        if (Option.isSome(edgeData) && edgeData.value.target === neighbor) {
          edgeIndex = edge
          break
        }
      }

      if (edgeIndex !== null) {
        const edgeData = MutableHashMap.get(graph.data.edges, edgeIndex)
        if (Option.isSome(edgeData)) {
          let edgeEvent: TraversalEvent<N, E>

          if (!discovered.has(neighbor)) {
            // Tree edge
            edgeEvent = {
              _tag: "TreeEdge",
              edge: edgeIndex,
              data: edgeData.value.data,
              source: current,
              target: neighbor
            }
          } else if (!finished.has(neighbor)) {
            // Back edge (cycle)
            edgeEvent = {
              _tag: "BackEdge",
              edge: edgeIndex,
              data: edgeData.value.data,
              source: current,
              target: neighbor
            }
          } else {
            // Cross edge
            edgeEvent = {
              _tag: "CrossEdge",
              edge: edgeIndex,
              data: edgeData.value.data,
              source: current,
              target: neighbor
            }
          }

          const edgeControl = visitor(edgeEvent)
          if (edgeControl === "Break") return
          if (edgeControl === "Prune") continue
        }
      }

      // Process neighbor if it's a tree edge
      if (!discovered.has(neighbor)) {
        discovered.add(neighbor)

        // Emit discover event for neighbor
        const neighborNodeData = MutableHashMap.get(graph.data.nodes, neighbor)
        if (Option.isSome(neighborNodeData)) {
          const discoverEvent: TraversalEvent<N, E> = {
            _tag: "DiscoverNode",
            node: neighbor,
            data: neighborNodeData.value
          }
          const control = visitor(discoverEvent)
          if (control === "Break") return
          if (control === "Prune") {
            finished.add(neighbor)
            continue
          }
        }

        // Add neighbor to queue
        queue.push(neighbor)
      }
    }

    // Mark current node as finished
    finished.add(current)

    // Emit finish event
    const currentNodeData = MutableHashMap.get(graph.data.nodes, current)
    if (Option.isSome(currentNodeData)) {
      const finishEvent: TraversalEvent<N, E> = {
        _tag: "FinishNode",
        node: current,
        data: currentNodeData.value
      }
      const control = visitor(finishEvent)
      if (control === "Break") return
    }
  }
}

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

  let hasCycle = false
  const discovered = new Set<NodeIndex>()
  const finished = new Set<NodeIndex>()

  // Visitor that detects back edges (cycles)
  const cycleDetector: Visitor<N, E> = (event) => {
    if (event._tag === "BackEdge") {
      hasCycle = true
      return "Break" // Stop as soon as we find a cycle
    }
    return "Continue"
  }

  // Check all nodes to handle disconnected components
  const allNodes = Array.from(MutableHashMap.keys(graph.data.nodes))

  for (const node of allNodes) {
    if (!discovered.has(node)) {
      depthFirstSearch(graph, [node], (event) => {
        // Track discovery state for proper back edge detection
        if (event._tag === "DiscoverNode") {
          discovered.add(event.node)
        } else if (event._tag === "FinishNode") {
          finished.add(event.node)
        }

        // Check for cycles
        const result = cycleDetector(event)
        if (result === "Break") {
          return "Break"
        }

        return "Continue"
      })

      // Early exit if cycle found
      if (hasCycle) {
        break
      }
    }
  }

  return !hasCycle
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
 * Compute a topological ordering of a directed acyclic graph (DAG).
 * Returns the nodes in an order such that for every directed edge (u, v),
 * vertex u comes before v in the ordering.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const dag = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   const d = Graph.addNode(mutable, "D")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, a, c, "A->C")
 *   Graph.addEdge(mutable, b, d, "B->D")
 *   Graph.addEdge(mutable, c, d, "C->D")
 * })
 *
 * const order = Graph.topologicalSort(dag)
 * console.log(order) // [0, 1, 2, 3] or [0, 2, 1, 3] (valid topological orderings)
 * ```
 *
 * @since 2.0.0
 * @category algorithms
 */
export const topologicalSort = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>
): Array<NodeIndex> | null => {
  // First check if graph is acyclic
  if (!isAcyclic(graph)) {
    return null // Cannot topologically sort a cyclic graph
  }

  const visited = new Set<NodeIndex>()
  const result: Array<NodeIndex> = []
  const allNodes = Array.from(MutableHashMap.keys(graph.data.nodes))

  // DFS-based topological sort (Tarjan's algorithm)
  const dfs = (node: NodeIndex): void => {
    visited.add(node)

    // Visit all neighbors first (post-order)
    const nodeNeighbors = neighbors(graph, node)
    for (const neighbor of nodeNeighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor)
      }
    }

    // Add current node to result (post-order)
    result.push(node)
  }

  // Visit all nodes
  for (const node of allNodes) {
    if (!visited.has(node)) {
      dfs(node)
    }
  }

  // Reverse the result to get correct topological order
  return result.reverse()
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

  // Step 1: DFS on original graph to get finish times
  const dfs1 = (node: NodeIndex): void => {
    visited.add(node)
    const nodeNeighbors = neighbors(graph, node)
    for (const neighbor of nodeNeighbors) {
      if (!visited.has(neighbor)) {
        dfs1(neighbor)
      }
    }
    finishOrder.push(node) // Post-order: higher finish time comes later
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      dfs1(node)
    }
  }

  // Step 2: DFS on transpose graph in reverse finish order
  visited.clear()
  const sccs: Array<Array<NodeIndex>> = []

  const dfs2 = (node: NodeIndex, currentScc: Array<NodeIndex>): void => {
    visited.add(node)
    currentScc.push(node)

    // Use reverse adjacency (transpose graph)
    const reverseAdjacency = MutableHashMap.get(graph.data.reverseAdjacency, node)
    if (Option.isSome(reverseAdjacency)) {
      for (const edgeIndex of reverseAdjacency.value) {
        const edge = MutableHashMap.get(graph.data.edges, edgeIndex)
        if (Option.isSome(edge)) {
          const predecessor = edge.value.source
          if (!visited.has(predecessor)) {
            dfs2(predecessor, currentScc)
          }
        }
      }
    }
  }

  // Process nodes in reverse finish order
  for (let i = finishOrder.length - 1; i >= 0; i--) {
    const node = finishOrder[i]
    if (!visited.has(node)) {
      const scc: Array<NodeIndex> = []
      dfs2(node, scc)
      sccs.push(scc)
    }
  }

  return sccs
}
