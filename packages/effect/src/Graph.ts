/**
 * @since 2.0.0
 */

import type { Equal } from "./Equal.js"
import type { Inspectable } from "./Inspectable.js"
import type { MutableHashMap } from "./MutableHashMap.js"
import type { Pipeable } from "./Pipeable.js"

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
 * Node index for type-safe node identification.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const nodeIndex: Graph.NodeIndex = { _tag: "NodeIndex", value: 0 }
 * console.log(nodeIndex.value) // 0
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface NodeIndex {
  readonly _tag: "NodeIndex"
  readonly value: number
}

/**
 * Edge index for type-safe edge identification.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const edgeIndex: Graph.EdgeIndex = { _tag: "EdgeIndex", value: 0 }
 * console.log(edgeIndex.value) // 0
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface EdgeIndex {
  readonly _tag: "EdgeIndex"
  readonly value: number
}

/**
 * Edge data containing source, target, and user data.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const edge: Graph.EdgeData<string> = {
 *   source: { _tag: "NodeIndex", value: 0 },
 *   target: { _tag: "NodeIndex", value: 1 },
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
  readonly nodes: MutableHashMap<NodeIndex, N>
  readonly edges: MutableHashMap<EdgeIndex, EdgeData<E>>
  readonly adjacency: MutableHashMap<NodeIndex, Array<EdgeIndex>>
  readonly reverseAdjacency: MutableHashMap<NodeIndex, Array<EdgeIndex>>
  readonly nodeCount: number
  readonly edgeCount: number
  readonly nextNodeIndex: NodeIndex
  readonly nextEdgeIndex: EdgeIndex
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
  extends Iterable<readonly [NodeIndex, N]>, Equal, Pipeable, Inspectable
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
