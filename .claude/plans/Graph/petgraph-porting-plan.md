# Comprehensive Petgraph Porting Plan

## Overview
This document outlines a comprehensive plan to port all features from the Rust petgraph library to our Effect Graph module, maintaining JavaScript/TypeScript idioms while achieving feature parity.

## Research Sources
- [Petgraph Graph Implementation](https://docs.rs/petgraph/latest/src/petgraph/graph_impl/mod.rs.html)
- [Petgraph Visit Module](https://docs.rs/petgraph/latest/petgraph/visit/index.html)  
- [Petgraph Algorithms](https://docs.rs/petgraph/latest/petgraph/algo/index.html)
- [Petgraph Data Structures](https://docs.rs/petgraph/latest/petgraph/data/index.html)
- [Petgraph Dot Export](https://docs.rs/petgraph/latest/petgraph/dot/index.html)

## Current State Analysis

### ✅ Already Implemented
- Basic graph data structures (directed/undirected)
- Node/edge management (add, remove, get, has)
- Basic traversal (DFS/BFS with visitor pattern)
- GraphViz export (basic)
- **Phase 5A algorithms**:
  - `isAcyclic()` - DFS cycle detection
  - `isBipartite()` - BFS coloring algorithm
  - `connectedComponents()` - Component discovery for undirected graphs
  - `topologicalSort()` - Tarjan's algorithm for DAG ordering
  - `stronglyConnectedComponents()` - Kosaraju's two-pass algorithm

### 📋 Planned (Phase 5B)
- `shortestPath()` - Dijkstra's algorithm
- `shortestPaths()` - All shortest paths from source
- `allPairsShortestPaths()` - Floyd-Warshall algorithm
- `hasPath()` - Simple path existence check

## Missing Features from Petgraph

### **Phase 1: Enhanced Core Infrastructure**

#### **1.1 Index System Enhancement**
- **Current**: Plain numbers for NodeIndex/EdgeIndex
- **Petgraph**: Type-safe indices with multiple index types (u8, u16, u32, usize)
- **Gap**: Optional type-safe index system for large graphs
- **Implementation Plan**:
  ```typescript
  // Optional branded types for performance-critical applications
  export type TypeSafeNodeIndex<T extends IndexSize = 'u32'> = Brand<number, `NodeIndex-${T}`>
  export type TypeSafeEdgeIndex<T extends IndexSize = 'u32'> = Brand<number, `EdgeIndex-${T}`>
  export type IndexSize = 'u8' | 'u16' | 'u32' | 'usize'
  ```
- **Priority**: Medium (nice-to-have for large graphs)
- **Effort**: Medium

#### **1.2 Graph Capacity Management**
- **Missing Features**:
  - `reserve(nodeCapacity, edgeCapacity)` - Pre-allocate storage
  - `shrinkToFit()` - Reduce memory footprint
  - `nodeCapacity()`, `edgeCapacity()` - Query current capacity
- **Implementation Plan**:
  ```typescript
  export const reserve: <N, E, T>(graph: MutableGraph<N, E, T>, nodeCapacity: number, edgeCapacity: number) => void
  export const shrinkToFit: <N, E, T>(graph: MutableGraph<N, E, T>) => void
  export const nodeCapacity: <N, E, T>(graph: Graph<N, E, T>) => number
  export const edgeCapacity: <N, E, T>(graph: Graph<N, E, T>) => number
  ```
- **Priority**: Low (optimization feature)
- **Effort**: Low

#### **1.3 Enhanced Edge Management**
- **Missing Features**:
  - `findEdge(source, target)` - Find edge between nodes
  - `edgeWeight(edgeIndex)` - Get edge weight/data
  - `edgeWeightMut(edgeIndex)` - Mutate edge weight/data
  - `updateEdge(source, target, weight)` - Add or update edge
- **Implementation Plan**:
  ```typescript
  export const findEdge: <N, E, T>(graph: Graph<N, E, T>, source: NodeIndex, target: NodeIndex) => EdgeIndex | null
  export const edgeWeight: <N, E, T>(graph: Graph<N, E, T>, edgeIndex: EdgeIndex) => E | null
  export const updateEdgeWeight: <N, E, T>(graph: MutableGraph<N, E, T>, edgeIndex: EdgeIndex, weight: E) => void
  export const updateEdge: <N, E, T>(graph: MutableGraph<N, E, T>, source: NodeIndex, target: NodeIndex, weight: E) => EdgeIndex
  ```
- **Priority**: High (core functionality)
- **Effort**: Medium

### **Phase 2: Visitor System Enhancement**

#### **2.1 Trait-Based Visitor System**
- **Current**: Function-based visitor pattern
- **Petgraph**: Trait-based system (GraphBase, IntoNeighbors, Visitable)
- **Gap**: Composable graph operations through traits
- **Implementation Plan**:
  ```typescript
  export interface GraphBase {
    readonly nodeCount: number
    readonly edgeCount: number
  }
  
  export interface IntoNeighbors<N, E> {
    neighbors(node: NodeIndex): Iterable<NodeIndex>
  }
  
  export interface Visitable<N, E> extends GraphBase, IntoNeighbors<N, E> {
    visitMap(): Map<NodeIndex, boolean>
    resetVisitMap(visitMap: Map<NodeIndex, boolean>): void
  }
  ```
- **Priority**: Medium (architectural improvement)
- **Effort**: High

#### **2.2 Specialized Traversals**
- **Missing Features**:
  - `Topo` walker - Topological order traversal
  - `PostOrder` traversal - Post-order DFS
  - `DfsPostOrder` - Depth-first with post-order events
- **Implementation Plan**:
  ```typescript
  export const topoWalker: <N, E, T>(graph: Graph<N, E, T>) => Iterable<NodeIndex>
  export const postOrderTraversal: <N, E, T>(graph: Graph<N, E, T>, starts: Array<NodeIndex>) => Iterable<NodeIndex>
  export const dfsPostOrder: <N, E, T>(graph: Graph<N, E, T>, start: NodeIndex, visitor: PostOrderVisitor<N, E>) => void
  ```
- **Priority**: Medium
- **Effort**: Medium

#### **2.3 Graph Adaptors**
- **Missing Features**:
  - `NodeFiltered` - Graph view with filtered nodes
  - `EdgeFiltered` - Graph view with filtered edges  
  - `Reversed` - Graph with reversed edge directions
  - `Undirected` - Treat directed graph as undirected
- **Implementation Plan**:
  ```typescript
  export const nodeFiltered: <N, E, T>(graph: Graph<N, E, T>, predicate: (node: NodeIndex, data: N) => boolean) => Graph<N, E, T>
  export const edgeFiltered: <N, E, T>(graph: Graph<N, E, T>, predicate: (edge: EdgeIndex, data: E) => boolean) => Graph<N, E, T>
  export const reversed: <N, E>(graph: Graph<N, E, GraphType.Directed>) => Graph<N, E, GraphType.Directed>
  export const undirected: <N, E>(graph: Graph<N, E, GraphType.Directed>) => Graph<N, E, GraphType.Undirected>
  ```
- **Priority**: Medium (advanced feature)
- **Effort**: High

### **Phase 3: Complete Algorithm Suite**

#### **3.1 Path Finding Algorithms** (Phase 5B - Enhanced)

##### **Currently Planned**:
- ✅ `shortestPath()` - Dijkstra's algorithm
- ✅ `shortestPaths()` - All shortest paths from source
- ✅ `allPairsShortestPaths()` - Floyd-Warshall algorithm
- ✅ `hasPath()` - Simple path existence check

##### **Missing from Petgraph**:
- **A* Search Algorithm**:
  ```typescript
  export const astar: <N, E, T>(
    graph: Graph<N, E, T>,
    start: NodeIndex,
    goal: NodeIndex,
    edgeCost: (edge: EdgeIndex) => number,
    heuristic: (node: NodeIndex) => number
  ) => Array<NodeIndex> | null
  ```

- **Bellman-Ford Algorithm**:
  ```typescript
  export const bellmanFord: <N, E, T>(
    graph: Graph<N, E, T>,
    start: NodeIndex,
    edgeCost: (edge: EdgeIndex) => number
  ) => Map<NodeIndex, number> | "NegativeCycle"
  ```

- **Johnson's Algorithm**:
  ```typescript
  export const johnson: <N, E, T>(
    graph: Graph<N, E, T>,
    edgeCost: (edge: EdgeIndex) => number
  ) => Map<NodeIndex, Map<NodeIndex, number>> | "NegativeCycle"
  ```

- **K-Shortest Paths**:
  ```typescript
  export const kShortestPaths: <N, E, T>(
    graph: Graph<N, E, T>,
    start: NodeIndex,
    goal: NodeIndex,
    k: number,
    edgeCost: (edge: EdgeIndex) => number
  ) => Array<Array<NodeIndex>>
  ```

- **SPFA (Shortest Path Faster Algorithm)**:
  ```typescript
  export const spfa: <N, E, T>(
    graph: Graph<N, E, T>,
    start: NodeIndex,
    edgeCost: (edge: EdgeIndex) => number
  ) => Map<NodeIndex, number> | "NegativeCycle"
  ```

**Priority**: High (commonly requested algorithms)
**Effort**: High

#### **3.2 Advanced Connectivity** (Phase 5C - Enhanced)

##### **Currently Planned**:
- ✅ `bridges()` - Cut edges
- ✅ `articulationPoints()` - Cut vertices  
- ✅ `pageRank()` - PageRank algorithm

##### **Missing from Petgraph**:
- **Dominators Algorithm**:
  ```typescript
  export const dominators: <N, E>(
    graph: Graph<N, E, GraphType.Directed>,
    start: NodeIndex
  ) => Map<NodeIndex, NodeIndex>
  ```

- **Graph Condensation**:
  ```typescript
  export const condensation: <N, E>(
    graph: Graph<N, E, GraphType.Directed>
  ) => Graph<Array<NodeIndex>, Array<EdgeIndex>, GraphType.Directed>
  ```

- **2-Edge-Connected Components**:
  ```typescript
  export const twoEdgeConnectedComponents: <N, E>(
    graph: Graph<N, E, GraphType.Undirected>
  ) => Array<Array<NodeIndex>>
  ```

- **Biconnected Components**:
  ```typescript
  export const biconnectedComponents: <N, E>(
    graph: Graph<N, E, GraphType.Undirected>
  ) => Array<Array<NodeIndex>>
  ```

**Priority**: Medium (advanced connectivity analysis)
**Effort**: High

#### **3.3 Optimization Algorithms** (New Phase 5D)
- **Maximum Matching** (Edmonds' blossom algorithm):
  ```typescript
  export const maximumMatching: <N, E>(
    graph: Graph<N, E, GraphType.Undirected>
  ) => Array<[NodeIndex, NodeIndex]>
  ```

- **Graph Coloring**:
  ```typescript
  export const greedyColoring: <N, E, T>(graph: Graph<N, E, T>) => Map<NodeIndex, number>
  export const chromaticNumber: <N, E, T>(graph: Graph<N, E, T>) => number
  ```

- **Feedback Arc Set**:
  ```typescript
  export const feedbackArcSet: <N, E>(
    graph: Graph<N, E, GraphType.Directed>
  ) => Array<EdgeIndex>
  ```

- **Steiner Tree**:
  ```typescript
  export const steinerTree: <N, E, T>(
    graph: Graph<N, E, T>,
    terminals: Array<NodeIndex>,
    edgeCost: (edge: EdgeIndex) => number
  ) => Graph<N, E, T>
  ```

- **Network Flow Algorithms**:
  ```typescript
  export const maxFlow: <N, E, T>(
    graph: Graph<N, E, T>,
    source: NodeIndex,
    sink: NodeIndex,
    capacity: (edge: EdgeIndex) => number
  ) => number
  
  export const minCut: <N, E, T>(
    graph: Graph<N, E, T>,
    source: NodeIndex,
    sink: NodeIndex,
    capacity: (edge: EdgeIndex) => number
  ) => [number, Array<NodeIndex>, Array<NodeIndex>]
  ```

**Priority**: Medium (specialized optimization)
**Effort**: Very High

#### **3.4 Graph Comparison** (New Phase 5E)
- **Graph Isomorphism Detection**:
  ```typescript
  export const isIsomorphic: <N, E, T>(
    graph1: Graph<N, E, T>,
    graph2: Graph<N, E, T>
  ) => boolean
  
  export const findIsomorphism: <N, E, T>(
    graph1: Graph<N, E, T>,
    graph2: Graph<N, E, T>
  ) => Map<NodeIndex, NodeIndex> | null
  ```

- **Subgraph Isomorphism**:
  ```typescript
  export const isSubgraphIsomorphic: <N, E, T>(
    subgraph: Graph<N, E, T>,
    graph: Graph<N, E, T>
  ) => boolean
  
  export const findSubgraphIsomorphism: <N, E, T>(
    subgraph: Graph<N, E, T>,
    graph: Graph<N, E, T>
  ) => Map<NodeIndex, NodeIndex> | null
  ```

- **Graph Similarity Metrics**:
  ```typescript
  export const graphEditDistance: <N, E, T>(
    graph1: Graph<N, E, T>,
    graph2: Graph<N, E, T>
  ) => number
  
  export const structuralSimilarity: <N, E, T>(
    graph1: Graph<N, E, T>,
    graph2: Graph<N, E, T>
  ) => number
  ```

**Priority**: Low (specialized research/analysis)
**Effort**: Very High

### **Phase 4: Advanced Data Structures**

#### **4.1 Specialized Collections**
- **Priority Queues for Algorithms**:
  ```typescript
  interface PriorityQueue<T> {
    push(item: T, priority: number): void
    pop(): T | undefined
    isEmpty(): boolean
  }
  ```

- **Disjoint Set (Union-Find)**:
  ```typescript
  export class DisjointSet {
    constructor(size: number)
    union(a: number, b: number): void
    find(x: number): number
    connected(a: number, b: number): boolean
  }
  ```

**Priority**: Medium (algorithm support)
**Effort**: Medium

#### **4.2 Graph Properties Tracking**
- **Degree Tracking**:
  ```typescript
  export const inDegree: <N, E, T>(graph: Graph<N, E, T>, node: NodeIndex) => number
  export const outDegree: <N, E, T>(graph: Graph<N, E, T>, node: NodeIndex) => number
  export const degree: <N, E>(graph: Graph<N, E, GraphType.Undirected>, node: NodeIndex) => number
  ```

- **Connectivity Caching**:
  ```typescript
  interface ConnectivityCache {
    isConnected(a: NodeIndex, b: NodeIndex): boolean
    invalidate(): void
  }
  ```

**Priority**: Low (optimization)
**Effort**: Medium

### **Phase 5: Serialization & Import/Export**

#### **5.1 Enhanced GraphViz Export**
- **Current**: Basic dot export
- **Petgraph**: Full customization with Config, RankDir, styling
- **Enhancement Plan**:
  ```typescript
  export interface GraphVizConfig {
    rankDir: "TB" | "BT" | "LR" | "RL"
    nodeAttributes: (node: NodeIndex, data: any) => Record<string, string>
    edgeAttributes: (edge: EdgeIndex, data: any) => Record<string, string>
    graphAttributes: Record<string, string>
  }
  
  export const toGraphVizCustom: <N, E, T>(
    graph: Graph<N, E, T>,
    config: GraphVizConfig
  ) => string
  ```

**Priority**: Medium (improved visualization)
**Effort**: Medium

#### **5.2 Graph Serialization**
- **JSON Serialization**:
  ```typescript
  export const toJSON: <N, E, T>(graph: Graph<N, E, T>) => string
  export const fromJSON: <N, E, T>(json: string) => Graph<N, E, T>
  ```

- **Binary Serialization**:
  ```typescript
  export const toBinary: <N, E, T>(graph: Graph<N, E, T>) => Uint8Array
  export const fromBinary: <N, E, T>(data: Uint8Array) => Graph<N, E, T>
  ```

**Priority**: Medium (data persistence)
**Effort**: Medium

#### **5.3 Graph File Formats**
- **Standard Format Support**:
  ```typescript
  export const toGML: <N, E, T>(graph: Graph<N, E, T>) => string
  export const fromGML: <N, E, T>(gml: string) => Graph<N, E, T>
  
  export const toGraphML: <N, E, T>(graph: Graph<N, E, T>) => string
  export const fromGraphML: <N, E, T>(graphml: string) => Graph<N, E, T>
  
  export const toGEXF: <N, E, T>(graph: Graph<N, E, T>) => string
  export const fromGEXF: <N, E, T>(gexf: string) => Graph<N, E, T>
  ```

**Priority**: Low (specialized use cases)
**Effort**: High

### **Phase 6: Performance Optimizations**

#### **6.1 Parallel Algorithms**
- **Parallel Implementations**:
  ```typescript
  export const shortestPathParallel: <N, E, T>(
    graph: Graph<N, E, T>,
    sources: Array<NodeIndex>,
    edgeCost: (edge: EdgeIndex) => number
  ) => Promise<Map<NodeIndex, Map<NodeIndex, number>>>
  
  export const stronglyConnectedComponentsParallel: <N, E, T>(
    graph: Graph<N, E, T>
  ) => Promise<Array<Array<NodeIndex>>>
  ```

**Priority**: Low (advanced optimization)
**Effort**: Very High

#### **6.2 Memory Optimization**
- **Compact Representations**:
  ```typescript
  export const compactGraph: <N, E, T>(graph: Graph<N, E, T>) => CompactGraph<N, E, T>
  export const fromCompact: <N, E, T>(compact: CompactGraph<N, E, T>) => Graph<N, E, T>
  ```

- **Memory Pools**:
  ```typescript
  interface GraphPool<N, E, T> {
    acquire(): MutableGraph<N, E, T>
    release(graph: MutableGraph<N, E, T>): void
  }
  ```

**Priority**: Low (micro-optimization)
**Effort**: High

## Implementation Priority & Timeline

### **Immediate (Phase 5B - Current Sprint)**
1. ✅ **Complete planned path finding suite**
2. 🔄 **Add A* and Bellman-Ford algorithms**
3. 🔄 **Enhanced edge management** (`findEdge`, weight access)

**Timeline**: 1-2 weeks
**Effort**: Medium-High

### **High Priority (Phase 5C - Next Sprint)**
1. **Advanced connectivity algorithms** (dominators, biconnected components)
2. **Enhanced GraphViz export** with full customization
3. **Specialized traversals** (Topo, PostOrder)

**Timeline**: 2-3 weeks  
**Effort**: High

### **Medium Priority (Phase 5D - Following Sprint)**
1. **Graph optimization algorithms** (matching, coloring, flow)
2. **Trait-based visitor system**
3. **Graph adaptors** (filtered views, reversed)
4. **Graph serialization** (JSON, binary)

**Timeline**: 3-4 weeks
**Effort**: Very High

### **Lower Priority (Phase 5E+ - Future)**
1. **Graph comparison algorithms** (isomorphism)
2. **Standard file format support** (GML, GraphML, GEXF)
3. **Performance optimizations** and parallel algorithms
4. **Type-safe index system**
5. **Memory optimization features**

**Timeline**: 4+ weeks
**Effort**: Very High

## JavaScript/Effect Adaptations

### **1. Error Handling Strategy**
- **Petgraph Approach**: Extensive use of `Result<T, E>` types
- **Our Approach**: 
  - Simple `null` returns for missing elements
  - String literals for error types (`"NegativeCycle"`, `"Cycle"`)
  - Effect types for complex error scenarios when needed
- **Decision**: Maintain simplicity while adding specific error types for algorithm failures

### **2. Memory Management Philosophy**
- **Petgraph Approach**: Manual memory management, compact index representations
- **Our Approach**: 
  - Rely on JavaScript GC for memory management
  - Focus on algorithmic efficiency over micro-optimizations
  - Add capacity management only where significantly beneficial
- **Decision**: Prioritize clean APIs and developer experience

### **3. Type System Utilization**
- **Petgraph Approach**: Extensive trait system for zero-cost abstractions
- **Our Approach**:
  - Use TypeScript interfaces and conditional types effectively
  - Maintain runtime simplicity while providing compile-time safety
  - Optional trait-based system for advanced use cases
- **Decision**: Balance type safety with API simplicity

### **4. Concurrency Model**
- **Petgraph Approach**: Rust's ownership enables safe parallelism
- **Our Approach**:
  - Single-threaded performance optimization first
  - Web Workers/worker threads for CPU-intensive algorithms
  - Promise-based async APIs for parallel operations
- **Decision**: Focus on single-threaded performance, add parallelism selectively

## Success Metrics

### **Feature Completeness**
- [ ] 100% algorithm parity with petgraph
- [ ] All core graph operations supported
- [ ] Comprehensive traversal capabilities
- [ ] Full import/export functionality

### **Performance Benchmarks**
- [ ] Comparable algorithm performance to petgraph (within 2x)
- [ ] Memory usage optimization (within reasonable bounds)
- [ ] Startup time minimization
- [ ] Large graph handling (>100k nodes/edges)

### **Developer Experience**
- [ ] Comprehensive JSDoc documentation with examples
- [ ] TypeScript type safety maintained
- [ ] Simple APIs for common use cases
- [ ] Advanced APIs for complex scenarios

### **Quality Assurance**
- [ ] 100% test coverage for all algorithms
- [ ] Comprehensive edge case testing
- [ ] Performance regression testing
- [ ] Cross-platform compatibility

## Open Questions & Decisions Needed

### **1. Scope Management**
- **Question**: Should we implement ALL petgraph features or focus on the most valuable subset?
- **Recommendation**: Implement core algorithms first, add specialized features based on user demand

### **2. API Design Philosophy**
- **Question**: Maintain current simple API or adopt trait-based system?
- **Recommendation**: Keep simple APIs as primary interface, add trait system for advanced users

### **3. Performance vs Complexity Tradeoff**
- **Question**: How much complexity to add for performance optimizations?
- **Recommendation**: Focus on algorithmic correctness first, optimize hot paths based on profiling

### **4. Breaking Changes Tolerance**
- **Question**: Acceptable to make breaking changes for better petgraph alignment?
- **Recommendation**: Minimize breaking changes, use versioning for major architectural shifts

### **5. Resource Allocation**
- **Question**: Timeline and developer allocation for full implementation?
- **Recommendation**: Implement incrementally over 3-6 months, prioritizing high-impact features

## Next Actions Required

1. **Review and approve** this comprehensive plan
2. **Prioritize specific features** for immediate implementation
3. **Allocate development resources** for each phase
4. **Define success criteria** and acceptance tests
5. **Begin Phase 5B enhancement** with A* and Bellman-Ford algorithms

This plan provides a roadmap to achieve full petgraph feature parity while maintaining our JavaScript/TypeScript-first design philosophy and Effect library integration.