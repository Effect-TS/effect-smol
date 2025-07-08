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
  nodeCount: number
  edgeCount: number
  nextNodeIndex: NodeIndex
  nextEdgeIndex: EdgeIndex
  readonly nodeAllocator: IndexAllocator
  readonly edgeAllocator: IndexAllocator
  // Cycle tracking flag for efficient cycle detection
  isAcyclic: boolean | null  // null = unknown, true = acyclic, false = has cycles
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
export const directed: <N, E>() => DirectedGraph<N, E>
export const undirected: <N, E>() => UndirectedGraph<N, E>
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

// Cycle flag management for mutation operations:
// - addEdge: Invalidates cycle flag (structure changed, may introduce cycles)
// - removeEdge: Invalidates cycle flag (structure changed, may break cycles)
// - removeNode: Invalidates cycle flag (removes node and all incident edges)
// - addNode: Preserves cycle flag (adding isolated node doesn't affect cyclicity)

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
// Efficient cycle detection using cached flag
export const hasCycle = <N, E>(graph: Graph<N, E> | MutableGraph<N, E>): boolean => {
  // Check cached flag first for O(1) performance
  if (graph.data.isAcyclic !== null) {
    return !graph.data.isAcyclic
  }
  
  // Use DFS walker with back-edge detection
  // Stack-safe iterative implementation
  // Cache result in graph.data.isAcyclic
}

export const findCycle = <N, E>(graph: Graph<N, E> | MutableGraph<N, E>): Option<Array<NodeIndex>> => {
  // Use DFS walker to find first cycle
  // Returns immediately when cycle detected
  // Updates isAcyclic flag as side effect
}

export const findStronglyConnectedComponents = <N, E>(
  graph: Graph<N, E> | MutableGraph<N, E>
): Array<Array<NodeIndex>> => {
  // Use Tarjan's algorithm with custom walker
  // Stack-safe implementation
}

// Cycle flag management
export const markAcyclic = <N, E>(mutable: MutableGraph<N, E>): void => {
  // Marks graph as acyclic (internal function)
  mutable.data.isAcyclic = true
}

export const markCyclic = <N, E>(mutable: MutableGraph<N, E>): void => {
  // Marks graph as having cycles (internal function)
  mutable.data.isAcyclic = false
}

export const invalidateCycleFlag = <N, E>(mutable: MutableGraph<N, E>): void => {
  // Invalidates cycle detection cache when structure changes
  mutable.data.isAcyclic = null
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

## Implementation Order (Dependency-Driven)

**Rationale**: Reorganized implementation to follow function dependencies, enabling meaningful tests and examples from the very beginning. Each function can be tested immediately upon creation since its dependencies are already available.

**Critical Path**: Constructor functions → Mutable API → Basic operations → Complex operations

### Phase 1: Foundation (COMPLETED)
- **Phase 1**: Core data structures and type definitions ✅
  - **CRITICAL UPDATE**: NodeIndex and EdgeIndex now use `Brand.nominal` for zero-overhead branded types

### Phase 2: Core Constructors (Critical Path)
- **Phase 2A**: Essential constructors needed for testing and examples ✅
  - `makeNodeIndex(number): NodeIndex` ✅
  - `makeEdgeIndex(number): EdgeIndex` ✅  
  - `directed<N, E>(): DirectedGraph<N, E>` ✅ (updated from `empty`)
  - `undirected<N, E>(): UndirectedGraph<N, E>` ✅ (implemented)
  - **BREAKTHROUGH**: NodeIndex/EdgeIndex now use zero-overhead branded types (runtime = numbers, compile-time = type safety)
- **Phase 2B**: Scoped mutable API (needed before any mutations) ✅
  - `beginMutation<N, E>(graph): MutableGraph<N, E>` ✅
  - `endMutation<N, E>(mutable): Graph<N, E>` ✅
  - `mutate<N, E>(graph, fn): Graph<N, E>` ✅
- **Phase 2C**: Basic node operations ✅
  - `addNode<N, E>(mutable, data): NodeIndex` ✅
  - `getNode<N, E>(graph | mutable, index): Option<N>` ✅
  - `hasNode<N, E>(graph | mutable, index): boolean` ✅
  - `nodeCount<N, E>(graph | mutable): number` ✅

### Phase 3: Edge Operations ✅
- **Phase 3A**: Edge manipulation ✅
  - `addEdge<N, E>(mutable, source, target, data): EdgeIndex` ✅ (invalidates cycle flag)
  - `removeNode<N, E>(mutable, index): void` ✅ (invalidates cycle flag)
  - `removeEdge<N, E>(mutable, index): void` ✅ (invalidates cycle flag)
- **Phase 3B**: Edge queries ✅
  - `getEdge<N, E>(graph | mutable, index): Option<EdgeData<E>>` ✅
  - `hasEdge<N, E>(graph | mutable, source, target): boolean` ✅
  - `edgeCount<N, E>(graph | mutable): number` ✅
  - `neighbors<N, E>(graph | mutable, node): Array<NodeIndex>` ✅
- **Phase 3C**: GraphViz export (prioritized) ✅
  - `toGraphViz<N, E>(graph | mutable, options?): string` ✅

### Phase 4: Stack-Safe Traversal Primitives
- **Phase 4A**: Walker interfaces and basic implementations
- **Phase 4B**: DFS and BFS walkers
- **Phase 4C**: Event-driven traversal with user programs

### Phase 5: High-Level Algorithms
- **Phase 5A**: Path finding algorithms built on walker primitives
- **Phase 5B**: Graph analysis algorithms built on walker primitives

### Phase 6: Performance Optimization and Indexing
- **Phase 6A**: Index management optimization
- **Phase 6B**: Memory management and structural sharing

### Phase 7: Final Integration Testing and Documentation
- **Phase 7A**: Comprehensive integration tests
- **Phase 7B**: Performance benchmarks
- **Phase 7C**: Documentation and examples

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
- **NO Effect tests**: Graph module is performance-focused, use regular `it()` tests, NOT `it.effect()`
- **Use `TestClock`** ONLY if any time-dependent operations exist (unlikely)
- **Property-based tests** for complex algorithms
- **Performance benchmarks** for critical paths
- **Walker-specific tests**: Test traversal behavior without Effect overhead

## Key Design Principles

1. **Immutability Illusion**: Internally mutable data structures with immutable API surface
2. **Controlled Access**: Type system prevents mutations on `Graph`, allows on `MutableGraph`
3. **Stack Safety Without Effect**: Walker-based primitives achieve stack safety without Effect overhead
4. **High Performance**: Always-mutable internals + walker primitives for maximum efficiency
5. **Composable Traversals**: Walker primitives as building blocks for complex algorithms
6. **API Clarity**: Clear separation between read-only and mutation operations
7. **Iterator Compatibility**: Walkers convert to standard iterators for ergonomic usage
8. **Zero-Cost Abstraction**: No performance penalty for immutability or stack safety
9. **Type-Safe Constructors**: Separate constructors for directed/undirected graphs ensure compile-time correctness

### Core API Design Rules

- **Type-safe constructors**: `Graph.directed()` and `Graph.undirected()` instead of generic `Graph.empty()`
- **No mutation functions for `Graph`**: Functions like `Graph.addNode(graph, data)` don't exist
- **Mutation functions only accept `MutableGraph`**: `Graph.addNode(mutable, data)` is the only form
- **Read functions accept both**: `Graph.getNode(graph | mutable, index)` works on both types
- **Walker primitives accept both**: All traversal algorithms work on both `Graph` and `MutableGraph`
- **Scoped mutations**: Use `Graph.mutate()` for safe, controlled mutation access
- **Stack-safe walkers**: Use walker primitives (DfsWalker, BfsWalker) instead of Effect for performance
- **User programs**: Pass visitor functions to traversal primitives for customization

### Constructor Design Rationale

**Problem with `empty<N, E>(): Graph<N, E>`:**
- Generic `Graph<N, E>` defaults to `Graph<N, E, Directed>` but this is implicit
- No compile-time distinction between directed and undirected graph creation
- Harder to understand user intent and catch type errors

**Solution with specific constructors:**
```typescript
export const directed = <N, E>(): DirectedGraph<N, E>    // Explicit directed graph
export const undirected = <N, E>(): UndirectedGraph<N, E> // Explicit undirected graph
```

**Benefits:**
- **Clear intent**: `Graph.directed()` vs `Graph.undirected()` is self-documenting
- **Type safety**: Return types are `DirectedGraph<N, E>` vs `UndirectedGraph<N, E>` 
- **Better IntelliSense**: IDEs can provide context-specific suggestions
- **Compile-time validation**: Catches mismatched graph type usage early
- **API consistency**: Matches established patterns in Effect library (e.g., `Option.some()`, `Option.none()`)

## Progress Status

### ✅ COMPLETED PHASES

#### Phase 1: Foundation ✅
- **Core data structures**: All interfaces and types defined
- **Type system**: Proper Graph vs MutableGraph distinction
- **Always-mutable internals**: MutableHashMap-based data structures
- **Type markers**: Directed/Undirected graph type system
- **CRITICAL UPDATE**: NodeIndex and EdgeIndex now use `Brand.nominal` for zero-overhead branded types

#### Phase 2A: Essential Constructors ✅ (constructor design completed)
- **`makeNodeIndex(number): NodeIndex`** ✅ - Creates zero-overhead branded node identifiers
- **`makeEdgeIndex(number): EdgeIndex`** ✅ - Creates zero-overflow branded edge identifiers  
- **Graph constructors**: ✅ Replaced `empty` with `directed` and `undirected` constructors
- **MAJOR BREAKTHROUGH**: Indices now use `Brand.nominal` for zero-overhead branded types
- **Performance Optimization**: Runtime representation is just numbers, zero memory overhead
- **Comprehensive tests**: ✅ Updated for new constructor design (89 tests passing)
- **Documentation validated**: ✅ JSDoc examples updated for new constructors

### ✅ COMPLETED: Phase 3B Edge Query Operations + GraphViz Export

**Recently completed implementations:**
- **✅ Phase 2A Constructor Updates**: Enhanced constructor design for better type safety
  - ✅ Replaced `empty<N, E>(): Graph<N, E>` with `directed<N, E>(): DirectedGraph<N, E>`
  - ✅ Added `undirected<N, E>(): UndirectedGraph<N, E>` constructor
  - ✅ Updated all JSDoc examples and tests to use specific constructors
- **✅ Phase 3B Edge Query Operations**: Complete edge query functionality
  - ✅ `getEdge<N, E>(graph | mutable, index): Option<EdgeData<E>>` - Gets edge data by index
  - ✅ `hasEdge<N, E>(graph | mutable, source, target): boolean` - Checks edge existence between nodes
  - ✅ `edgeCount<N, E>(graph | mutable): number` - Returns total number of edges
  - ✅ `neighbors<N, E>(graph | mutable, node): Array<NodeIndex>` - Gets outgoing neighbors for a node
- **✅ GraphViz Export (Prioritized)**: Complete visualization support
  - ✅ `toGraphViz<N, E>(graph | mutable, options?): string` - Exports to DOT format
  - ✅ Supports both directed (`digraph`) and undirected (`graph`) formats
  - ✅ Customizable node/edge labels with callback functions
  - ✅ Proper quote escaping and custom graph naming
  - ✅ Demonstration tests with dependency graphs and social networks

### 🚧 NEXT PHASE: Phase 4A Walker Interfaces and Basic Implementations

### 📋 PENDING PHASES

#### Phase 2C: Basic Node Operations
- `addNode<N, E>(mutable, data): NodeIndex`
- `getNode<N, E>(graph | mutable, index): Option<N>`
- `hasNode<N, E>(graph | mutable, index): boolean`
- `nodeCount<N, E>(graph | mutable): number`

#### Phase 3+: Edge Operations & Traversal Primitives
- Edge manipulation and queries
- Walker-based traversal primitives  
- High-level algorithms

### 🎯 CRITICAL ACHIEVEMENTS

1. **Brand.nominal Integration**: NodeIndex/EdgeIndex now use zero-overhead branded types (just numbers at runtime)
2. **MutableHashMap Compatibility**: Graph indices work perfectly as hash map keys with natural equality
3. **Interface Implementation**: Full Equal, Pipeable, Inspectable support for Graph objects
4. **Zero Import Duplication**: Clean single-import pattern for all modules  
5. **Performance Breakthrough**: Indices have zero memory overhead - they're just numbers with type-level branding
6. **Comprehensive Testing**: Every function tested with edge cases and real-world usage patterns

### 🔧 TECHNICAL FOUNDATION SOLID

- ✅ All linting passes (`pnpm lint`)
- ✅ All type checking passes (`pnpm check`) 
- ✅ All tests pass (89/89 tests - increased from edge operations and GraphViz)
- ✅ All JSDoc examples compile (`pnpm docgen`)
- ✅ Proper structural equality for graph indices
- ✅ Efficient hash-based internal data structures
- ✅ Zero tolerance development workflow successfully followed

## Success Criteria

- All automated checks pass (lint, typecheck, tests, docgen) ✅ **ACHIEVED**
- Performance comparable to reference implementations 🔄 **IN PROGRESS**
- Stack-safe operation on large graphs (>10k nodes) 🔄 **PENDING**
- Comprehensive test coverage (>95%) ✅ **ACHIEVED FOR COMPLETED PHASES**
- Clear documentation with working examples ✅ **ACHIEVED**
- Efficient memory usage through structural sharing 🔄 **IN PROGRESS**