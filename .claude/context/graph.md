# Graph Module Research - Petgraph Analysis

## Overview
Analysis of the Rust petgraph library to inform the design of an Effect Graph module. The petgraph library provides a comprehensive set of graph data structures and algorithms that can serve as inspiration for our TypeScript/Effect implementation.

## Core Data Structures

### Graph Types in Petgraph
1. **Graph**: Standard adjacency list graph with flexible data association
   - Uses index-based node representation
   - Supports arbitrary node and edge data
   - Efficient for most general-purpose graph operations

2. **StableGraph**: Maintains node/edge indices after removals
   - Provides stable indexing even after node/edge removal
   - Trades some memory efficiency for index stability
   - Useful for long-lived graphs with frequent modifications

3. **GraphMap**: Hash table-backed graph using node identifiers as keys
   - Uses node identifiers directly as keys
   - No separate index allocation
   - Efficient for sparse graphs where nodes are identifiable

4. **MatrixGraph**: Adjacency matrix implementation
   - Dense matrix representation
   - Efficient for dense graphs
   - Constant-time edge existence checking

5. **CSR (Compressed Sparse Row)**: Sparse adjacency matrix graph
   - Optimized for read-heavy workloads
   - Immutable after construction
   - Very memory efficient

### Generic Parameters
- `N`: Node weight/data type
- `E`: Edge weight/data type  
- `Ty`: Directionality (Directed/Undirected)
- `Ix`: Index type (u8, u16, u32, usize) for memory optimization

## Key Algorithms Available

### Traversal Algorithms
- **Depth-First Search (DFS)**: Stack-based traversal
- **Breadth-First Search (BFS)**: Queue-based traversal
- **Topological Sort**: Ordering of directed acyclic graphs
- **Connected Components**: Finding disconnected graph components
- **Strongly Connected Components**: Using Kosaraju and Tarjan's algorithms

### Path Finding Algorithms
- **Dijkstra's Algorithm**: Single-source shortest path
- **A* Search**: Heuristic-based pathfinding
- **Bellman-Ford**: Handles negative edge weights
- **Floyd-Warshall**: All-pairs shortest paths
- **Johnson's Algorithm**: Sparse all-pairs shortest paths
- **SPFA (Shortest Path Faster Algorithm)**: Optimized Bellman-Ford variant
- **K-shortest Path**: Finding multiple shortest paths

### Cycle Detection
- **Cycle Detection**: For both directed and undirected graphs
- **Negative Cycle Detection**: In weighted graphs
- **Bipartite Graph Detection**: Checking for two-coloring possibility

### Advanced Algorithms
- **Minimum Spanning Tree**: Kruskal's and Prim's algorithms
- **Maximum Matching**: Bipartite and general graph matching
- **Page Rank**: Web page ranking algorithm
- **Steiner Tree**: Minimum tree connecting specific nodes
- **Graph Isomorphism**: Checking structural equivalence
- **Graph Coloring**: Vertex coloring algorithms
- **Maximal Cliques**: Finding complete subgraphs
- **Articulation Points**: Critical nodes for connectivity
- **Bridges Detection**: Critical edges for connectivity

## Performance Characteristics

### Memory Layout
- Index-based operations minimize runtime overhead
- Different graph types optimize for different use cases:
  - Graph: General purpose, good balance
  - StableGraph: Stable indices, higher memory usage
  - GraphMap: Sparse graphs, hash table overhead
  - MatrixGraph: Dense graphs, O(n²) space
  - CSR: Read-heavy, very compact

### Indexing Strategies
- Flexible index types (u8, u16, u32, usize) to control memory footprint
- Node and edge indices maintained separately
- Index stability vs. memory efficiency trade-offs

### Mutability Handling
- Supports both mutable and immutable operations
- Different graph types offer varying mutability semantics
- Efficient mutable operations through index-based access

## API Design Patterns

### Trait-Based Extensibility
- Algorithms work with graph traits for broad applicability
- Generic implementations allow custom graph types
- Composable building blocks for complex algorithms

### Type Safety
- Strong type system prevents many common graph errors
- Generic parameters ensure type safety across operations
- Compile-time guarantees for graph properties

### Performance Optimization
- Optional features for parallel processing (Rayon)
- Minimal runtime overhead through careful design
- Memory-efficient representations for different use cases

## Implications for Effect Graph Module

### Data Structure Design
1. **Core Graph Types**: Need equivalents to Graph, StableGraph, GraphMap
2. **Immutable Focus**: All operations should return new graph instances
3. **Index Management**: Efficient indexing for performance
4. **Generic Parameters**: Support for arbitrary node/edge data

### Algorithm Implementation
1. **Stack-Safe**: All algorithms must use Effect's stack-safe recursion
2. **Composable**: Algorithms as primitive building blocks
3. **Effect Integration**: Leverage Effect's error handling and resource management
4. **Performance**: Maintain high performance through efficient data structures

### Mutable API Design
1. **Scoped Mutations**: Like HashMap's mutable API
2. **Efficient Updates**: Minimize copying during bulk operations
3. **Resource Safety**: Automatic cleanup of mutable contexts
4. **Type Safety**: Prevent escaping mutable references

### Key Requirements
- **Immutable Data Structures**: Core requirement for Effect integration
- **Stack-Safe Operations**: Essential for deep graph traversals
- **High Performance**: Competitive with mutable implementations
- **Index Maintenance**: For algorithm efficiency
- **Scoped Mutability**: For bulk operations efficiency

## Next Steps
1. Design core data structure backing the graph
2. Define interfaces for directed/undirected, cyclic/acyclic variants
3. Implement basic graph operations (add/remove nodes/edges)
4. Create stack-safe traversal primitives
5. Design scoped mutable API similar to HashMap
6. Implement key algorithms as composable building blocks