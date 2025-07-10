# Graph Module Implementation Plan

## Overview
Design and implement a comprehensive Graph module for the Effect library that provides immutable graph data structures, stack-safe algorithms, and efficient scoped mutable operations.

## Phase 1: Core Data Structure Design

### 1.1 Graph Representation
Internal data structure is always mutable for performance, with immutability guaranteed through API design:

```typescript
// Core graph structure - always mutable internally
interface GraphData<N, E> {
  readonly nodes: MutableHashMap<NodeIndex, N>
  readonly edges: MutableHashMap<EdgeIndex, EdgeData<E>>
  readonly adjacency: MutableHashMap<NodeIndex, Array<EdgeIndex>>
  readonly reverseAdjacency: MutableHashMap<NodeIndex, Array<EdgeIndex>> // For undirected graphs
  readonly nodeCount: number
  readonly edgeCount: number
  readonly nextNodeIndex: NodeIndex
  readonly nextEdgeIndex: EdgeIndex
  readonly indexAllocator: IndexAllocator
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
Immutable and mutable graph interfaces with controlled access:

```typescript
// Immutable graph interface - read-only access
interface Graph<N, E, T extends GraphType = GraphType.Mixed> {
  readonly [TypeId]: TypeId
  readonly data: GraphData<N, E>
  readonly type: T
  readonly _mutable: false  // Type-level marker for immutable
}

// Mutable graph interface - allows modifications
interface MutableGraph<N, E, T extends GraphType = GraphType.Mixed> {
  readonly [TypeId]: TypeId
  readonly data: GraphData<N, E>  // Same underlying structure
  readonly type: T
  readonly _mutable: true  // Type-level marker for mutable
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

export type MutableDirectedGraph<N, E> = MutableGraph<N, E, GraphType.Directed>
export type MutableUndirectedGraph<N, E> = MutableGraph<N, E, GraphType.Undirected>
export type MutableMixedGraph<N, E> = MutableGraph<N, E, GraphType.Mixed>
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

### 2.1 Graph Construction and Read Operations
```typescript
// Graph creation - always returns immutable graphs
export const empty: <N, E>() => Graph<N, E>
export const make: <N, E>(nodes: Array<N>, edges: Array<[number, number, E]>) => Graph<N, E>

// Read-only operations work on both Graph and MutableGraph
export const getNode: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>, index: NodeIndex) => Option<N>
export const hasNode: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>, index: NodeIndex) => boolean
export const getEdge: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>, index: EdgeIndex) => Option<EdgeData<E>>
export const hasEdge: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>, source: NodeIndex, target: NodeIndex) => boolean

// Basic properties - work on both types
export const size: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>) => number
export const nodeCount: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>) => number
export const edgeCount: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>) => number
export const isEmpty: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>) => boolean

// Adjacency queries - work on both types
export const neighbors: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>, node: NodeIndex) => Array<NodeIndex>
export const inNeighbors: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>, node: NodeIndex) => Array<NodeIndex>
export const outNeighbors: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>, node: NodeIndex) => Array<NodeIndex>
export const degree: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>, node: NodeIndex) => number
export const inDegree: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>, node: NodeIndex) => number
export const outDegree: <N, E>(graph: Graph<N, E> | MutableGraph<N, E>, node: NodeIndex) => number
```

### 2.2 Mutable Operations (Only Accept MutableGraph)
```typescript
// Mutation operations - ONLY accept MutableGraph, never Graph
export const addNode: <N, E>(mutable: MutableGraph<N, E>, data: N) => NodeIndex
export const removeNode: <N, E>(mutable: MutableGraph<N, E>, index: NodeIndex) => void
export const addEdge: <N, E>(mutable: MutableGraph<N, E>, source: NodeIndex, target: NodeIndex, data: E) => EdgeIndex
export const removeEdge: <N, E>(mutable: MutableGraph<N, E>, index: EdgeIndex) => void
export const updateNode: <N, E>(mutable: MutableGraph<N, E>, index: NodeIndex, data: N) => void
export const updateEdge: <N, E>(mutable: MutableGraph<N, E>, index: EdgeIndex, data: E) => void

// No Graph.addNode, Graph.removeNode, etc. - these functions don't exist!
// Immutable graphs can only be modified through the mutable API
```

## Phase 3: Stack-Safe Traversal Primitives

### 3.1 Core Walker Primitives
Stack-safe traversal without Effect overhead, following petgraph's walker pattern:

```typescript
// Base walker interface - iterator pattern without graph references
interface Walker<T> {
  readonly next: (graph: Graph<any, any> | MutableGraph<any, any>) => Option<T>
  readonly reset: () => void
}

// Node walker for traversing nodes
export interface NodeWalker extends Walker<NodeIndex> {
  readonly stack: Array<NodeIndex>
  readonly discovered: HashSet<NodeIndex>
  readonly moveTo: (node: NodeIndex) => void
}

// Edge walker for traversing edges
export interface EdgeWalker extends Walker<EdgeIndex> {
  readonly stack: Array<EdgeIndex>
  readonly discovered: HashSet<EdgeIndex>
  readonly moveTo: (edge: EdgeIndex) => void
}

// DFS walker implementation
export class DfsWalker implements NodeWalker {
  readonly stack: Array<NodeIndex> = []
  readonly discovered: HashSet<NodeIndex> = HashSet.empty()
  
  constructor(start: NodeIndex) {
    this.stack.push(start)
  }
  
  next(graph: Graph<any, any> | MutableGraph<any, any>): Option<NodeIndex> {
    // Stack-safe iterative implementation
    while (this.stack.length > 0) {
      const current = this.stack.pop()!
      if (!HashSet.has(this.discovered, current)) {
        this.discovered = HashSet.add(this.discovered, current)
        
        // Add neighbors to stack (reverse order for proper DFS)
        const neighbors = getNeighbors(graph, current)
        for (let i = neighbors.length - 1; i >= 0; i--) {
          this.stack.push(neighbors[i])
        }
        
        return Option.some(current)
      }
    }
    return Option.none()
  }
  
  reset(): void {
    this.stack.length = 0
    this.discovered = HashSet.empty()
  }
  
  moveTo(node: NodeIndex): void {
    this.stack.length = 0
    this.stack.push(node)
  }
}

// BFS walker implementation
export class BfsWalker implements NodeWalker {
  readonly queue: Array<NodeIndex> = []  // Use as queue (FIFO)
  readonly discovered: HashSet<NodeIndex> = HashSet.empty()
  
  // Similar implementation but using queue semantics
  next(graph: Graph<any, any> | MutableGraph<any, any>): Option<NodeIndex> {
    // Implementation using queue for BFS
  }
}
```

### 3.2 Traversal Events and User Programs
Event-driven traversal allowing user programs without Effect overhead:

```typescript
// Traversal events (similar to petgraph's DfsEvent)
export type TraversalEvent<N, E> =
  | { readonly _tag: "DiscoverNode"; readonly node: NodeIndex; readonly data: N }
  | { readonly _tag: "FinishNode"; readonly node: NodeIndex; readonly data: N }
  | { readonly _tag: "TreeEdge"; readonly edge: EdgeIndex; readonly data: E }
  | { readonly _tag: "BackEdge"; readonly edge: EdgeIndex; readonly data: E }
  | { readonly _tag: "CrossEdge"; readonly edge: EdgeIndex; readonly data: E }

// Control flow for user programs
export type ControlFlow = 
  | { readonly _tag: "Continue" }
  | { readonly _tag: "Break" }
  | { readonly _tag: "Prune" }  // Skip subtree

// User visitor function type
export type Visitor<N, E, A> = (event: TraversalEvent<N, E>) => ControlFlow

// High-level traversal function with user programs
export const depthFirstSearch = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>,
  starts: Array<NodeIndex>,
  visitor: Visitor<N, E, void>
): void => {
  // Stack-safe implementation using iterative approach
  // Calls user visitor with appropriate events
  // Respects control flow for early termination/pruning
}

export const breadthFirstSearch = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>,
  starts: Array<NodeIndex>,
  visitor: Visitor<N, E, void>
): void => {
  // Similar pattern but with BFS ordering
}
```

### 3.3 Walker-to-Iterator Conversion
Convert walkers to standard iterators for ergonomic usage:

```typescript
// Convert walker to iterable
export const walkNodes = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>,
  walker: NodeWalker
): Iterable<NodeIndex> => ({
  [Symbol.iterator]: function* () {
    let current = walker.next(graph)
    while (Option.isSome(current)) {
      yield current.value
      current = walker.next(graph)
    }
  }
})

// Usage examples:
// for (const node of walkNodes(graph, new DfsWalker(startNode))) {
//   console.log(node)
// }
//
// const allNodes = Array.from(walkNodes(graph, new BfsWalker(startNode)))
```

### 3.4 Path Finding Using Walkers
```typescript
// Path representation
export interface Path {
  readonly nodes: Array<NodeIndex>
  readonly edges: Array<EdgeIndex>
  readonly totalWeight: number
}

// Path finding using walker primitives
export const findPath = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>,
  source: NodeIndex,
  target: NodeIndex,
  heuristic?: (from: NodeIndex, to: NodeIndex) => number
): Option<Path> => {
  // Use custom walker with path tracking
  // Stack-safe implementation without Effect
  // Returns immediately when target found
}

export const findAllPaths = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>,
  source: NodeIndex,
  target: NodeIndex,
  maxDepth?: number
): Array<Path> => {
  // Use DFS walker with path collection
  // Stack-safe with depth limiting
}
```

### 3.5 Cycle Detection Using Walkers
```typescript
// Cycle detection using walker primitives
export const hasCycle = <N, E>(graph: Graph<N, E> | MutableGraph<N, E>): boolean => {
  // Use DFS walker with back-edge detection
  // Stack-safe iterative implementation
}

export const findCycle = <N, E>(graph: Graph<N, E> | MutableGraph<N, E>): Option<Array<NodeIndex>> => {
  // Use DFS walker to find first cycle
  // Returns immediately when cycle detected
}

export const findStronglyConnectedComponents = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>
): Array<Array<NodeIndex>> => {
  // Use Tarjan's algorithm with custom walker
  // Stack-safe implementation
}
```

## Phase 4: Scoped Mutable API

### 4.1 Mutable Graph Interface
Internally mutable data structure with controlled API access:

```typescript
// Both Graph and MutableGraph use the same internal structure
// The difference is in API access control, not the data structure itself
// Already defined above with MutableHashMap-based GraphData

// The key insight: there's no "MutableGraphData" vs "GraphData"
// There's only GraphData which is always mutable internally
// The API controls whether you can modify it or not
```

### 4.2 Scoped Mutation API
```typescript
// Core mutation lifecycle - creates a copy for safe mutation
export const beginMutation: <N, E>(graph: Graph<N, E>) => MutableGraph<N, E>
export const endMutation: <N, E>(mutable: MutableGraph<N, E>) => Graph<N, E>

// Scoped mutation function (similar to HashMap.mutate)
export const mutate: {
  <N, E>(f: (mutable: MutableGraph<N, E>) => void): (graph: Graph<N, E>) => Graph<N, E>
  <N, E>(graph: Graph<N, E>, f: (mutable: MutableGraph<N, E>) => void): Graph<N, E>
}

// Example usage:
// const newGraph = Graph.mutate(graph, (mutable) => {
//   const nodeA = Graph.addNode(mutable, "A")
//   const nodeB = Graph.addNode(mutable, "B") 
//   Graph.addEdge(mutable, nodeA, nodeB, "edge-data")
// })

// Mutation operations already defined above - they ONLY accept MutableGraph
// Read operations work on both Graph and MutableGraph
// Traversal functions work on both Graph and MutableGraph
```

### 4.3 Implementation Strategy
```typescript
// beginMutation creates a shallow copy with new _mutable marker
const beginMutation = <N, E>(graph: Graph<N, E>): MutableGraph<N, E> => {
  // Since the underlying data is already mutable (MutableHashMap),
  // we create a copy of the data structure to allow safe mutations
  return {
    [TypeId]: TypeId,
    _mutable: true,
    data: {
      // Copy the mutable data structures to create an isolated mutation scope
      nodes: MutableHashMap.fromIterable(MutableHashMap.entries(graph.data.nodes)),
      edges: MutableHashMap.fromIterable(MutableHashMap.entries(graph.data.edges)),
      adjacency: MutableHashMap.fromIterable(MutableHashMap.entries(graph.data.adjacency)),
      reverseAdjacency: MutableHashMap.fromIterable(MutableHashMap.entries(graph.data.reverseAdjacency)),
      nodeCount: graph.data.nodeCount,
      edgeCount: graph.data.edgeCount,
      nextNodeIndex: graph.data.nextNodeIndex,
      nextEdgeIndex: graph.data.nextEdgeIndex,
      indexAllocator: { ...graph.data.indexAllocator }
    },
    type: graph.type
  }
}

// endMutation changes the type marker back to immutable
const endMutation = <N, E>(mutable: MutableGraph<N, E>): Graph<N, E> => {
  return {
    [TypeId]: TypeId,
    _mutable: false,
    data: mutable.data,  // Same data structure, just different API access
    type: mutable.type
  }
}

// The key insight: both Graph and MutableGraph share the same internal
// structure (always MutableHashMap-based), but the API prevents
// mutations on Graph through type-level constraints
```

## Phase 5: High-Level Algorithms

### 5.1 Path Finding Algorithms Built on Walker Primitives
```typescript
// Dijkstra's algorithm using custom priority queue walker
export const dijkstra = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>,
  source: NodeIndex,
  weightFn: (edge: EdgeData<E>) => number
): HashMap<NodeIndex, number> => {
  // Custom walker with priority queue for shortest paths
  // Stack-safe implementation without Effect
  // Returns distance map
}

// A* search using heuristic-guided walker
export const aStar = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>,
  source: NodeIndex,
  target: NodeIndex,
  heuristic: (from: NodeIndex, to: NodeIndex) => number,
  weightFn: (edge: EdgeData<E>) => number
): Option<Path> => {
  // Custom walker with A* heuristic guidance
  // Stack-safe, returns immediately when target found
}

// Bellman-Ford algorithm using relaxation walker
export const bellmanFord = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>,
  source: NodeIndex,
  weightFn: (edge: EdgeData<E>) => number
): Either<HashMap<NodeIndex, number>, Array<NodeIndex>> => {
  // Custom walker for edge relaxation
  // Returns Left(distances) or Right(negative_cycle)
}
```

### 5.2 Graph Analysis Algorithms Built on Walker Primitives
```typescript
// Topological sort using DFS walker with post-order
export const topologicalSort = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>
): Option<Array<NodeIndex>> => {
  // Custom DFS walker with cycle detection
  // Returns None if graph has cycles
}

// Minimum spanning tree using custom edge walker  
export const minimumSpanningTree = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>,
  weightFn: (edge: EdgeData<E>) => number
): Graph<N, E> => {
  // Kruskal's or Prim's algorithm with edge walker
  // Stack-safe implementation
}

// Connected components using DFS walker
export const connectedComponents = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>
): Array<Array<NodeIndex>> => {
  // DFS walker to find all components
  // Stack-safe traversal of all nodes
}
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
7. **Phase 7**: Final integration testing and documentation

## MANDATORY DEVELOPMENT WORKFLOW

### For EVERY Function Created (Zero Tolerance Policy):

1. **Create function** in source file
2. **LINT FILE**: `pnpm lint --fix <file_path>` 
3. **Check compilation**: `pnpm check`
4. **LINT FILES AGAIN**: `pnpm lint --fix <file_path>` (NEVER skip this)
5. **Verify compilation**: `pnpm check` (MUST pass)
6. **Write test** for the function
7. **LINT TEST FILE**: `pnpm lint --fix <test_file_path>` (MANDATORY)
8. **Check test compilation**: `pnpm check` (MUST pass)
9. **Run test**: `pnpm test <test_file>` (MUST pass)
10. **DOCGEN CHECK**: `pnpm docgen` (MUST pass if JSDoc examples added)

### Workflow Rules (NEVER BREAK THESE):

- **NEVER move to next function** until current function passes ALL steps
- **NEVER commit** until ALL linting, compilation, and tests pass
- **ALWAYS lint after ANY file modification** - this is NOT optional
- **IMMEDIATELY test** every function as soon as it's created
- **NO BATCH TESTING** - test each function individually as created
- **ZERO TOLERANCE** for skipping linting or compilation checks

### Test Requirements:

- **Unit test for EVERY function** - no exceptions
- **Test edge cases** and error conditions
- **Use `it.effect` pattern** for Effect-based tests (if any)
- **Use `TestClock`** for time-dependent tests
- **Property-based tests** for complex algorithms
- **Performance benchmarks** for critical paths

## Key Design Principles

1. **Immutability Illusion**: Internally mutable data structures with immutable API surface
2. **Controlled Access**: Type system prevents mutations on `Graph`, allows on `MutableGraph`
3. **Stack Safety Without Effect**: Walker-based primitives achieve stack safety without Effect overhead
4. **High Performance**: Always-mutable internals + walker primitives for maximum efficiency
5. **Composable Traversals**: Walker primitives as building blocks for complex algorithms
6. **API Clarity**: Clear separation between read-only and mutation operations
7. **Iterator Compatibility**: Walkers convert to standard iterators for ergonomic usage
8. **Zero-Cost Abstraction**: No performance penalty for immutability or stack safety

### Core API Design Rules

- **No mutation functions for `Graph`**: Functions like `Graph.addNode(graph, data)` don't exist
- **Mutation functions only accept `MutableGraph`**: `Graph.addNode(mutable, data)` is the only form
- **Read functions accept both**: `Graph.getNode(graph | mutable, index)` works on both types
- **Walker primitives accept both**: All traversal algorithms work on both `Graph` and `MutableGraph`
- **Scoped mutations**: Use `Graph.mutate()` for safe, controlled mutation access
- **Stack-safe walkers**: Use walker primitives (DfsWalker, BfsWalker) instead of Effect for performance
- **User programs**: Pass visitor functions to traversal primitives for customization

## Success Criteria

- All automated checks pass (lint, typecheck, tests, docgen)
- Performance comparable to reference implementations
- Stack-safe operation on large graphs (>10k nodes)
- Comprehensive test coverage (>95%)
- Clear documentation with working examples
- Efficient memory usage through structural sharing