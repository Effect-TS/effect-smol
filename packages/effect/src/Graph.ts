/**
 * @since 2.0.0
 */

import * as Brand from "./Brand.js"
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
 * Node index for type-safe node identification using branded numbers.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const nodeIndex = Graph.makeNodeIndex(42)
 * console.log(nodeIndex) // 42 (runtime value is just a number)
 * // TypeScript treats it as NodeIndex, not number
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type NodeIndex = number & Brand.Brand<"NodeIndex">

/**
 * Edge index for type-safe edge identification using branded numbers.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const edgeIndex = Graph.makeEdgeIndex(123)
 * console.log(edgeIndex) // 123 (runtime value is just a number)
 * // TypeScript treats it as EdgeIndex, not number
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type EdgeIndex = number & Brand.Brand<"EdgeIndex">

/**
 * Edge data containing source, target, and user data.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const edge: Graph.EdgeData<string> = {
 *   source: Graph.makeNodeIndex(0),
 *   target: Graph.makeNodeIndex(1),
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

/**
 * Creates a new NodeIndex with the specified value.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const nodeIndex = Graph.makeNodeIndex(42)
 * console.log(nodeIndex) // 42 (runtime value is just a number)
 * // TypeScript treats it as NodeIndex, not number
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const makeNodeIndex = Brand.nominal<NodeIndex>()

/**
 * Creates a new EdgeIndex with the specified value.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const edgeIndex = Graph.makeEdgeIndex(123)
 * console.log(edgeIndex) // 123 (runtime value is just a number)
 * // TypeScript treats it as EdgeIndex, not number
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const makeEdgeIndex = Brand.nominal<EdgeIndex>()

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
    nextNodeIndex: makeNodeIndex(0),
    nextEdgeIndex: makeEdgeIndex(0),
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
    nextNodeIndex: makeNodeIndex(0),
    nextEdgeIndex: makeEdgeIndex(0),
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
  mutable.data.nextNodeIndex = makeNodeIndex(mutable.data.nextNodeIndex + 1)

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
 * const nodeIndex = Graph.makeNodeIndex(0)
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
 * const nodeIndex = Graph.makeNodeIndex(0)
 * const exists = Graph.hasNode(graph, nodeIndex)
 * console.log(exists) // true
 *
 * const nonExistentIndex = Graph.makeNodeIndex(999)
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
  mutable.data.nextEdgeIndex = makeEdgeIndex(mutable.data.nextEdgeIndex + 1)

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
 * const edgeIndex = Graph.makeEdgeIndex(0)
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
 * const nodeA = Graph.makeNodeIndex(0)
 * const nodeB = Graph.makeNodeIndex(1)
 * const nodeC = Graph.makeNodeIndex(2)
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
 * const nodeA = Graph.makeNodeIndex(0)
 * const nodeB = Graph.makeNodeIndex(1)
 * const nodeC = Graph.makeNodeIndex(2)
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
// Walker Interfaces and Traversal Primitives
// =============================================================================

/**
 * Base walker interface for stack-safe traversal without Effect overhead.
 *
 * Walkers provide iterator-like traversal over graph elements using an
 * external iterator pattern. They maintain their own state and can be
 * used with any graph instance.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, b, c, "B->C")
 * })
 *
 * const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))
 * let current = walker.next(graph)
 * while (Option.isSome(current)) {
 *   console.log(current.value) // NodeIndex values in DFS order
 *   current = walker.next(graph)
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Walker<T> {
  /**
   * Gets the next item in the traversal sequence.
   *
   * @param graph - The graph to traverse
   * @returns Some(T) if there are more items, None if traversal is complete
   */
  readonly next: <N, E, U extends GraphType.Base>(
    graph: Graph<N, E, U> | MutableGraph<N, E, U>
  ) => Option.Option<T>

  /**
   * Resets the walker to its initial state.
   */
  readonly reset: () => void
}

/**
 * Node walker interface for traversing graph nodes.
 *
 * Provides DFS or BFS traversal over nodes with state management
 * and the ability to move to specific starting positions.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "edge")
 *   Graph.addEdge(mutable, b, c, "edge")
 * })
 *
 * const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))
 * console.log(walker.discovered.size) // 0 initially
 *
 * // Move to different starting position
 * walker.moveTo(Graph.makeNodeIndex(1))
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface NodeWalker extends Walker<NodeIndex> {
  /**
   * Internal stack for maintaining traversal state.
   */
  readonly stack: Array<NodeIndex>

  /**
   * Set of discovered nodes to avoid revisiting.
   */
  readonly discovered: Set<NodeIndex>

  /**
   * Moves the walker to start from a specific node.
   *
   * @param node - The node to start traversal from
   */
  readonly moveTo: (node: NodeIndex) => void
}

/**
 * Edge walker interface for traversing graph edges.
 *
 * Similar to NodeWalker but operates on edges instead of nodes.
 * Useful for algorithms that need to traverse edge relationships.
 *
 * @since 2.0.0
 * @category models
 */
export interface EdgeWalker extends Walker<EdgeIndex> {
  /**
   * Internal stack for maintaining traversal state.
   */
  readonly stack: Array<EdgeIndex>

  /**
   * Set of discovered edges to avoid revisiting.
   */
  readonly discovered: Set<EdgeIndex>

  /**
   * Moves the walker to start from a specific edge.
   *
   * @param edge - The edge to start traversal from
   */
  readonly moveTo: (edge: EdgeIndex) => void
}

/**
 * Depth-First Search walker implementation for stack-safe node traversal.
 *
 * Implements the NodeWalker interface using DFS algorithm with iterative
 * approach to avoid stack overflow on large graphs.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, a, c, "A->C")
 *   Graph.addEdge(mutable, b, c, "B->C")
 * })
 *
 * const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))
 * const visited: Array<Graph.NodeIndex> = []
 *
 * let current = walker.next(graph)
 * while (Option.isSome(current)) {
 *   visited.push(current.value)
 *   current = walker.next(graph)
 * }
 *
 * console.log(visited) // DFS order: [0, 2, 1] (may vary based on adjacency order)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export class DfsWalker implements NodeWalker {
  readonly stack: Array<NodeIndex>
  readonly discovered: Set<NodeIndex>

  constructor(start: NodeIndex) {
    this.stack = [start]
    this.discovered = new Set()
  }

  next<N, E, U extends GraphType.Base>(
    graph: Graph<N, E, U> | MutableGraph<N, E, U>
  ): Option.Option<NodeIndex> {
    while (this.stack.length > 0) {
      const current = this.stack.pop()!

      // Check if the node exists in the graph
      if (!hasNode(graph, current)) {
        continue // Skip non-existent nodes
      }

      if (!this.discovered.has(current)) {
        this.discovered.add(current)

        // Add neighbors to stack in reverse order for proper DFS
        const nodeNeighbors = neighbors(graph, current)
        for (let i = nodeNeighbors.length - 1; i >= 0; i--) {
          if (!this.discovered.has(nodeNeighbors[i])) {
            this.stack.push(nodeNeighbors[i])
          }
        }

        return Option.some(current)
      }
    }

    return Option.none()
  }

  reset(): void {
    this.stack.length = 0
    this.discovered.clear()
  }

  moveTo(node: NodeIndex): void {
    this.stack.length = 0
    this.stack.push(node)
  }
}

/**
 * Breadth-First Search walker implementation for stack-safe node traversal.
 *
 * Implements the NodeWalker interface using BFS algorithm with queue-based
 * approach to ensure level-by-level traversal.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
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
 * const walker = new Graph.BfsWalker(Graph.makeNodeIndex(0))
 * const visited: Array<Graph.NodeIndex> = []
 *
 * let current = walker.next(graph)
 * while (Option.isSome(current)) {
 *   visited.push(current.value)
 *   current = walker.next(graph)
 * }
 *
 * console.log(visited) // BFS order: [0, 1, 2, 3]
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export class BfsWalker implements NodeWalker {
  readonly stack: Array<NodeIndex> // Used as queue (FIFO)
  readonly discovered: Set<NodeIndex>
  private head: number = 0 // Queue head pointer

  constructor(start: NodeIndex) {
    this.stack = [start]
    this.discovered = new Set()
    this.head = 0
  }

  next<N, E, U extends GraphType.Base>(
    graph: Graph<N, E, U> | MutableGraph<N, E, U>
  ): Option.Option<NodeIndex> {
    while (this.head < this.stack.length) {
      const current = this.stack[this.head++]

      // Check if the node exists in the graph
      if (!hasNode(graph, current)) {
        continue // Skip non-existent nodes
      }

      if (!this.discovered.has(current)) {
        this.discovered.add(current)

        // Add neighbors to end of queue for BFS
        const nodeNeighbors = neighbors(graph, current)
        for (const neighbor of nodeNeighbors) {
          if (!this.discovered.has(neighbor)) {
            this.stack.push(neighbor)
          }
        }

        return Option.some(current)
      }
    }

    return Option.none()
  }

  reset(): void {
    this.stack.length = 0
    this.head = 0
    this.discovered.clear()
  }

  moveTo(node: NodeIndex): void {
    this.stack.length = 0
    this.head = 0
    this.stack.push(node)
  }
}

/**
 * Converts a node walker to an iterable for ergonomic usage.
 *
 * This function allows walkers to be used with standard JavaScript
 * iteration patterns like for-of loops and Array.from().
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, a, c, "A->C")
 * })
 *
 * const walker = new Graph.DfsWalker(Graph.makeNodeIndex(0))
 *
 * // Use with for-of loop
 * for (const node of Graph.walkNodes(graph, walker)) {
 *   console.log(node) // NodeIndex values in DFS order
 * }
 *
 * // Convert to array
 * const allNodes = Array.from(Graph.walkNodes(graph, walker))
 * console.log(allNodes) // Array<NodeIndex>
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const walkNodes = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  walker: NodeWalker
): Iterable<NodeIndex> => ({
  *[Symbol.iterator]() {
    let current = walker.next(graph)
    while (Option.isSome(current)) {
      yield current.value
      current = walker.next(graph)
    }
  }
})

/**
 * Converts an edge walker to an iterable for ergonomic usage.
 *
 * Similar to `walkNodes` but operates on edge walkers instead of node walkers.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, string>(), (mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, b, c, "B->C")
 * })
 *
 * // Note: EdgeWalker implementation would be similar to NodeWalker
 * // but operating on edges - implementation pending in next phase
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const walkEdges = <N, E, T extends GraphType.Base = GraphType.Directed>(
  graph: Graph<N, E, T> | MutableGraph<N, E, T>,
  walker: EdgeWalker
): Iterable<EdgeIndex> => ({
  *[Symbol.iterator]() {
    let current = walker.next(graph)
    while (Option.isSome(current)) {
      yield current.value
      current = walker.next(graph)
    }
  }
})
