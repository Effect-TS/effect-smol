# Graph Module Implementation Plan

## Overview
Design and implement a comprehensive Graph module for the Effect library that provides immutable graph data structures, stack-safe algorithms, and efficient scoped mutable operations.

## Phase 1: Core Data Structure Design

### 1.1 Graph Representation
Based on petgraph analysis, we'll implement a hybrid approach using adjacency lists with efficient indexing:

```typescript
// Core graph structure - immutable by default
interface GraphData<N, E> {
  readonly nodes: HashMap<NodeIndex, N>
  readonly edges: HashMap<EdgeIndex, EdgeData<E>>
  readonly adjacency: HashMap<NodeIndex, Array<EdgeIndex>>
  readonly nodeCount: number
  readonly edgeCount: number
  readonly nextNodeIndex: NodeIndex
  readonly nextEdgeIndex: EdgeIndex
}

// Edge data includes source, target, and weight/data
interface EdgeData<E> {
  readonly source: NodeIndex
  readonly target: NodeIndex
  readonly data: E
}

// Index types for type safety and performance
interface NodeIndex {
  readonly _tag: "NodeIndex"
  readonly value: number
}

interface EdgeIndex {
  readonly _tag: "EdgeIndex"
  readonly value: number
}
```

### 1.2 Graph Type Variants
Support for different graph types through type-level constraints:

```typescript
// Base graph interface
interface Graph<N, E, T extends GraphType = GraphType.Mixed> {
  readonly [TypeId]: TypeId
  readonly data: GraphData<N, E>
  readonly type: T
}

// Graph type markers
namespace GraphType {
  export interface Directed extends GraphType.Base {}
  export interface Undirected extends GraphType.Base {}
  export interface Mixed extends GraphType.Base {}
}

// Specific graph types
export type DirectedGraph<N, E> = Graph<N, E, GraphType.Directed>
export type UndirectedGraph<N, E> = Graph<N, E, GraphType.Undirected>
export type MixedGraph<N, E> = Graph<N, E, GraphType.Mixed>
```

### 1.3 Index Management
Efficient index allocation and recycling:

```typescript
// Index allocator for efficient memory usage
interface IndexAllocator {
  readonly nextIndex: number
  readonly recycled: Array<number>
}

// Methods for index management
const allocateIndex: (allocator: IndexAllocator) => [number, IndexAllocator]
const recycleIndex: (allocator: IndexAllocator, index: number) => IndexAllocator
```

## Phase 2: Basic Graph Operations

### 2.1 Graph Construction
```typescript
// Graph creation
export const empty: <N, E>() => Graph<N, E>
export const make: <N, E>(nodes: Array<N>, edges: Array<[number, number, E]>) => Graph<N, E>

// Node operations
export const addNode: <N, E>(graph: Graph<N, E>, data: N) => Graph<N, E>
export const removeNode: <N, E>(graph: Graph<N, E>, index: NodeIndex) => Graph<N, E>
export const getNode: <N, E>(graph: Graph<N, E>, index: NodeIndex) => Option<N>
export const hasNode: <N, E>(graph: Graph<N, E>, index: NodeIndex) => boolean

// Edge operations
export const addEdge: <N, E>(graph: Graph<N, E>, source: NodeIndex, target: NodeIndex, data: E) => Graph<N, E>
export const removeEdge: <N, E>(graph: Graph<N, E>, index: EdgeIndex) => Graph<N, E>
export const getEdge: <N, E>(graph: Graph<N, E>, index: EdgeIndex) => Option<EdgeData<E>>
export const hasEdge: <N, E>(graph: Graph<N, E>, source: NodeIndex, target: NodeIndex) => boolean
```

### 2.2 Graph Queries
```typescript
// Basic properties
export const size: <N, E>(graph: Graph<N, E>) => number
export const nodeCount: <N, E>(graph: Graph<N, E>) => number
export const edgeCount: <N, E>(graph: Graph<N, E>) => number
export const isEmpty: <N, E>(graph: Graph<N, E>) => boolean

// Adjacency queries
export const neighbors: <N, E>(graph: Graph<N, E>, node: NodeIndex) => Array<NodeIndex>
export const inNeighbors: <N, E>(graph: Graph<N, E>, node: NodeIndex) => Array<NodeIndex>
export const outNeighbors: <N, E>(graph: Graph<N, E>, node: NodeIndex) => Array<NodeIndex>
export const degree: <N, E>(graph: Graph<N, E>, node: NodeIndex) => number
export const inDegree: <N, E>(graph: Graph<N, E>, node: NodeIndex) => number
export const outDegree: <N, E>(graph: Graph<N, E>, node: NodeIndex) => number
```

## Phase 3: Stack-Safe Traversal Primitives

### 3.1 Core Traversal Building Blocks
All traversal operations must be stack-safe using Effect's capabilities:

```typescript
// Stack-safe traversal state
interface TraversalState<S> {
  readonly stack: Array<S>
  readonly visited: HashSet<NodeIndex>
  readonly current: Option<S>
}

// Generic traversal framework
export const traverse: <N, E, S, A>(
  graph: Graph<N, E>,
  start: NodeIndex,
  initialState: S,
  step: (state: S, node: NodeIndex) => Effect.Effect<[S, Array<NodeIndex>], never, never>
) => Effect.Effect<Array<A>, never, never>

// Specific traversal implementations
export const depthFirstSearch: <N, E>(
  graph: Graph<N, E>,
  start: NodeIndex,
  visitor: (node: NodeIndex) => Effect.Effect<void, never, never>
) => Effect.Effect<void, never, never>

export const breadthFirstSearch: <N, E>(
  graph: Graph<N, E>,
  start: NodeIndex,
  visitor: (node: NodeIndex) => Effect.Effect<void, never, never>
) => Effect.Effect<void, never, never>
```

### 3.2 Path Finding Primitives
```typescript
// Path representation
export interface Path {
  readonly nodes: Array<NodeIndex>
  readonly edges: Array<EdgeIndex>
  readonly totalWeight: number
}

// Path finding building blocks
export const findPath: <N, E>(
  graph: Graph<N, E>,
  source: NodeIndex,
  target: NodeIndex,
  heuristic?: (from: NodeIndex, to: NodeIndex) => number
) => Effect.Effect<Option<Path>, never, never>

export const findAllPaths: <N, E>(
  graph: Graph<N, E>,
  source: NodeIndex,
  target: NodeIndex,
  maxDepth?: number
) => Effect.Effect<Array<Path>, never, never>
```

### 3.3 Cycle Detection
```typescript
// Cycle detection for different graph types
export const hasCycle: <N, E>(graph: Graph<N, E>) => Effect.Effect<boolean, never, never>
export const findCycle: <N, E>(graph: Graph<N, E>) => Effect.Effect<Option<Array<NodeIndex>>, never, never>
export const findStronglyConnectedComponents: <N, E>(
  graph: Graph<N, E>
) => Effect.Effect<Array<Array<NodeIndex>>, never, never>
```

## Phase 4: Scoped Mutable API

### 4.1 Mutable Graph Interface
Copy-based mutable API optimized for both read and write operations:

```typescript
// Mutable graph is a copy of the original graph optimized for mutations
// It shares the same interface as Graph so all traversal functions work
interface MutableGraph<N, E> extends Graph<N, E> {
  readonly [TypeId]: TypeId
  readonly data: MutableGraphData<N, E>  // Mutable version of GraphData
  readonly _mutable: true  // Marker for mutable state
}

// Mutable version of graph data optimized for writes
interface MutableGraphData<N, E> {
  readonly nodes: MutableHashMap<NodeIndex, N>           // Mutable for efficient writes
  readonly edges: MutableHashMap<EdgeIndex, EdgeData<E>> // Mutable for efficient writes
  readonly adjacency: MutableHashMap<NodeIndex, Array<EdgeIndex>> // Mutable adjacency lists
  readonly reverseAdjacency: MutableHashMap<NodeIndex, Array<EdgeIndex>> // For undirected graphs
  readonly nodeCount: number
  readonly edgeCount: number
  readonly nextNodeIndex: NodeIndex
  readonly nextEdgeIndex: EdgeIndex
  readonly indexAllocator: IndexAllocator
}
```

### 4.2 Scoped Mutation API
```typescript
// Core mutation lifecycle
export const beginMutation: <N, E>(graph: Graph<N, E>) => MutableGraph<N, E>
export const endMutation: <N, E>(mutable: MutableGraph<N, E>) => Graph<N, E>

// Scoped mutation function (similar to HashMap.mutate)
export const mutate: {
  <N, E>(f: (mutable: MutableGraph<N, E>) => void): (graph: Graph<N, E>) => Graph<N, E>
  <N, E>(graph: Graph<N, E>, f: (mutable: MutableGraph<N, E>) => void): Graph<N, E>
}

// Mutable operations (operate directly on mutable copy)
export const addNode: <N, E>(mutable: MutableGraph<N, E>, data: N) => NodeIndex
export const removeNode: <N, E>(mutable: MutableGraph<N, E>, index: NodeIndex) => void
export const addEdge: <N, E>(mutable: MutableGraph<N, E>, source: NodeIndex, target: NodeIndex, data: E) => EdgeIndex
export const removeEdge: <N, E>(mutable: MutableGraph<N, E>, index: EdgeIndex) => void
export const updateNode: <N, E>(mutable: MutableGraph<N, E>, index: NodeIndex, data: N) => void
export const updateEdge: <N, E>(mutable: MutableGraph<N, E>, index: EdgeIndex, data: E) => void

// All standard traversal functions work on MutableGraph since it extends Graph
// Examples:
// - depthFirstSearch(mutableGraph, startNode, visitor)
// - breadthFirstSearch(mutableGraph, startNode, visitor)
// - findPath(mutableGraph, source, target)
// - neighbors(mutableGraph, node)
```

### 4.3 Implementation Strategy
```typescript
// beginMutation creates optimized mutable copy
const beginMutation = <N, E>(graph: Graph<N, E>): MutableGraph<N, E> => {
  return {
    [TypeId]: TypeId,
    _mutable: true,
    data: {
      // Convert immutable HashMaps to MutableHashMaps for efficient writes
      nodes: MutableHashMap.fromIterable(HashMap.entries(graph.data.nodes)),
      edges: MutableHashMap.fromIterable(HashMap.entries(graph.data.edges)),
      adjacency: MutableHashMap.fromIterable(HashMap.entries(graph.data.adjacency)),
      reverseAdjacency: MutableHashMap.fromIterable(HashMap.entries(graph.data.reverseAdjacency || HashMap.empty())),
      nodeCount: graph.data.nodeCount,
      edgeCount: graph.data.edgeCount,
      nextNodeIndex: graph.data.nextNodeIndex,
      nextEdgeIndex: graph.data.nextEdgeIndex,
      indexAllocator: { ...graph.data.indexAllocator }
    },
    // Inherit all Graph methods through prototype chain or explicit delegation
    type: graph.type
  }
}

// endMutation converts back to immutable structure
const endMutation = <N, E>(mutable: MutableGraph<N, E>): Graph<N, E> => {
  return makeGraph({
    nodes: HashMap.fromIterable(MutableHashMap.entries(mutable.data.nodes)),
    edges: HashMap.fromIterable(MutableHashMap.entries(mutable.data.edges)),
    adjacency: HashMap.fromIterable(MutableHashMap.entries(mutable.data.adjacency)),
    nodeCount: mutable.data.nodeCount,
    edgeCount: mutable.data.edgeCount,
    nextNodeIndex: mutable.data.nextNodeIndex,
    nextEdgeIndex: mutable.data.nextEdgeIndex,
    indexAllocator: mutable.data.indexAllocator
  })
}
```

## Phase 5: High-Level Algorithms

### 5.1 Path Finding Algorithms
```typescript
// Dijkstra's algorithm
export const dijkstra: <N, E>(
  graph: Graph<N, E>,
  source: NodeIndex,
  weightFn: (edge: EdgeData<E>) => number
) => Effect.Effect<HashMap<NodeIndex, number>, never, never>

// A* search
export const aStar: <N, E>(
  graph: Graph<N, E>,
  source: NodeIndex,
  target: NodeIndex,
  heuristic: (from: NodeIndex, to: NodeIndex) => number,
  weightFn: (edge: EdgeData<E>) => number
) => Effect.Effect<Option<Path>, never, never>

// Bellman-Ford algorithm
export const bellmanFord: <N, E>(
  graph: Graph<N, E>,
  source: NodeIndex,
  weightFn: (edge: EdgeData<E>) => number
) => Effect.Effect<Either<HashMap<NodeIndex, number>, Array<NodeIndex>>, never, never>
```

### 5.2 Graph Analysis Algorithms
```typescript
// Topological sort
export const topologicalSort: <N, E>(
  graph: Graph<N, E>
) => Effect.Effect<Option<Array<NodeIndex>>, never, never>

// Minimum spanning tree
export const minimumSpanningTree: <N, E>(
  graph: Graph<N, E>,
  weightFn: (edge: EdgeData<E>) => number
) => Effect.Effect<Graph<N, E>, never, never>

// Connected components
export const connectedComponents: <N, E>(
  graph: Graph<N, E>
) => Effect.Effect<Array<Array<NodeIndex>>, never, never>
```

## Phase 6: Performance Optimization

### 6.1 Indexing Strategy
- Use efficient HashMap-based adjacency lists
- Maintain reverse adjacency for undirected graphs
- Implement index recycling for frequent additions/removals
- Cache frequently accessed graph properties

### 6.2 Memory Management
- Structural sharing between graph versions
- Lazy evaluation of expensive computations
- Efficient batch operations through mutable API
- Memory-efficient representation of sparse graphs

### 6.3 Algorithm Optimization
- Use specialized data structures for specific algorithms
- Implement early termination conditions
- Optimize for common graph patterns
- Provide both generic and specialized algorithm variants

## Phase 7: Testing and Documentation

### 7.1 Test Coverage
- Unit tests for all basic operations
- Property-based testing for graph invariants
- Performance benchmarks against reference implementations
- Stack-safety tests for deep graph traversals
- Time-dependent tests using TestClock

### 7.2 Documentation
- Comprehensive JSDoc with examples
- Algorithm complexity documentation
- Usage patterns and best practices
- Migration guide from other graph libraries

## Implementation Order

1. **Phase 1**: Core data structures and type definitions
2. **Phase 2**: Basic graph operations (add/remove nodes/edges)
3. **Phase 3**: Stack-safe traversal primitives (DFS, BFS)
4. **Phase 4**: Scoped mutable API implementation
5. **Phase 5**: High-level algorithms (pathfinding, analysis)
6. **Phase 6**: Performance optimization and indexing
7. **Phase 7**: Testing and documentation

## Key Design Principles

1. **Immutability First**: All operations return new graph instances
2. **Stack Safety**: All algorithms must be stack-safe using Effect
3. **Type Safety**: Strong typing prevents common graph errors
4. **Performance**: Competitive with mutable implementations
5. **Composability**: Algorithms as building blocks for complex operations
6. **Effect Integration**: Leverage Effect's error handling and concurrency
7. **Memory Efficiency**: Structural sharing and efficient representations

## Success Criteria

- All automated checks pass (lint, typecheck, tests, docgen)
- Performance comparable to reference implementations
- Stack-safe operation on large graphs (>10k nodes)
- Comprehensive test coverage (>95%)
- Clear documentation with working examples
- Efficient memory usage through structural sharing