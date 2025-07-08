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
 * Creates an empty graph with no nodes or edges.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.empty<string, number>()
 * console.log(graph[Graph.TypeId]) // "~effect/Graph"
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const empty = <N, E>(): Graph<N, E> =>
  new GraphImpl({
    nodes: MutableHashMap.empty(),
    edges: MutableHashMap.empty(),
    adjacency: MutableHashMap.empty(),
    reverseAdjacency: MutableHashMap.empty(),
    nodeCount: 0,
    edgeCount: 0,
    nextNodeIndex: makeNodeIndex(0),
    nextEdgeIndex: makeEdgeIndex(0),
    nodeAllocator: { nextIndex: 0, recycled: [] },
    edgeAllocator: { nextIndex: 0, recycled: [] }
  }, { _tag: "Directed" } as GraphType.Directed)

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
 * const graph = Graph.empty<string, number>()
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
      edgeAllocator: { ...graph.data.edgeAllocator, recycled: [...graph.data.edgeAllocator.recycled] }
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
 * const graph = Graph.empty<string, number>()
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
 * const graph = Graph.empty<string, number>()
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
 * const result = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
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
 * const graph = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
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
 * const graph = Graph.mutate(Graph.empty<string, number>(), (mutable) => {
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
 * const emptyGraph = Graph.empty<string, number>()
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
