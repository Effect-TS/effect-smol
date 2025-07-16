# HashMap vs TxHashMap Function Parity Audit Plan

## Executive Summary

This plan ensures complete functional parity between HashMap and TxHashMap by systematically auditing all HashMap exports and implementing missing TxHashMap equivalents. The goal is to provide TxHashMap users with all the functionality they expect from HashMap, adapted for transactional semantics.

## Current Status Analysis

### **HashMap Total Exports: 45 functions**
### **TxHashMap Current Functions: 23 functions** ✅ **Phase 1 Complete**
### **Missing Functions: 21 functions** (unsafe operations excluded for transactional safety) 

## Detailed Function Audit

### ✅ **Already Implemented in TxHashMap (23 functions)**

#### Constructors (3/3)
- ✅ `empty` - Creates empty TxHashMap
- ✅ `make` - Creates TxHashMap from entries
- ✅ `fromIterable` - Creates TxHashMap from iterable

#### Basic Operations (5/5)  
- ✅ `get` - Safe key lookup returning Option
- ✅ `set` - Sets key-value pair
- ✅ `has` - Checks key existence
- ✅ `remove` - Removes key
- ✅ `clear` - Removes all entries

#### Query Operations (3/3)
- ✅ `size` - Returns number of entries
- ✅ `isEmpty` - Checks if map is empty
- ✅ `isNonEmpty` - Checks if map has entries

#### Advanced Operations (6/6)
- ✅ `modify` - Modifies existing value
- ✅ `modifyAt` - Modifies with Option handling
- ✅ `keys` - Returns array of keys
- ✅ `values` - Returns array of values  
- ✅ `entries` - Returns array of key-value pairs
- ✅ `snapshot` - Returns immutable HashMap copy

#### Bulk Operations (3/3)
- ✅ `union` - Merges with another HashMap
- ✅ `removeMany` - Removes multiple keys
- ✅ `setMany` - Sets multiple key-value pairs

#### Phase 1: Essential Functions (3/3) ✅ **COMPLETED**
- ✅ `isTxHashMap` - Type guard for TxHashMap instances
- ✅ `getHash` - Hash-optimized value lookup 
- ✅ `hasHash` - Hash-optimized existence check

### 🔴 **Missing from TxHashMap (21 functions)** (unsafe operations excluded)

## Implementation Plan by Priority

### **📋 Phase 1: Essential Missing Functions (High Priority)**

#### **Type Guards & Utilities (1 function)**

**1. `isTxHashMap` - Type Guard Function**
```typescript
export const isTxHashMap = <K, V>(value: unknown): value is TxHashMap<K, V>
```
- **Priority**: HIGH
- **Complexity**: LOW  
- **Rationale**: Essential for defensive programming and type safety
- **Implementation**: Simple TypeId check, follows HashMap pattern

#### **Hash-Optimized Operations (2 functions)**

**2. `getHash` - Hash-Optimized Lookup**
```typescript
export const getHash: {
  <K1 extends K, K>(key: K1, hash: number): <V>(self: TxHashMap<K, V>) => Effect<Option<V>>
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1, hash: number): Effect<Option<V>>
}
```
- **Priority**: MEDIUM-HIGH
- **Complexity**: LOW
- **Rationale**: Performance optimization for pre-computed hash scenarios
- **Implementation**: Delegate to HashMap.getHash

**3. `hasHash` - Hash-Optimized Existence Check**
```typescript
export const hasHash: {
  <K1 extends K, K>(key: K1, hash: number): <V>(self: TxHashMap<K, V>) => Effect<boolean>
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1, hash: number): Effect<boolean>
}
```
- **Priority**: MEDIUM-HIGH  
- **Complexity**: LOW
- **Rationale**: Performance optimization companion to getHash
- **Implementation**: Delegate to HashMap.hasHash

### **📋 Phase 2: Functional Programming Operations (Medium Priority)**

#### **Transformation Functions (4 functions)**

**4. `map` - Transform Values**
```typescript
export const map: {
  <A, V, K>(f: (value: V, key: K) => A): (self: TxHashMap<K, V>) => Effect<TxHashMap<K, A>>
  <K, V, A>(self: TxHashMap<K, V>, f: (value: V, key: K) => A): Effect<TxHashMap<K, A>>
}
```
- **Priority**: HIGH
- **Complexity**: MEDIUM
- **Rationale**: Core functional programming operation, commonly needed
- **Implementation**: Get snapshot, map over HashMap, create new TxHashMap

**5. `filter` - Filter Entries**
```typescript
export const filter: {
  <K, V, B extends V>(predicate: (value: NoInfer<V>, key: NoInfer<K>) => value is B): (self: TxHashMap<K, V>) => Effect<TxHashMap<K, B>>
  <K, V>(predicate: (value: NoInfer<V>, key: NoInfer<K>) => boolean): (self: TxHashMap<K, V>) => Effect<TxHashMap<K, V>>
  <K, V, B extends V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => value is B): Effect<TxHashMap<K, B>>
  <K, V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => boolean): Effect<TxHashMap<K, V>>
}
```
- **Priority**: HIGH
- **Complexity**: MEDIUM
- **Rationale**: Essential for data processing workflows
- **Implementation**: Get snapshot, filter HashMap, create new TxHashMap

**6. `reduce` - Fold Over Entries**
```typescript
export const reduce: {
  <A, V, K>(zero: A, f: (accumulator: A, value: V, key: K) => A): (self: TxHashMap<K, V>) => Effect<A>
  <K, V, A>(self: TxHashMap<K, V>, zero: A, f: (accumulator: A, value: V, key: K) => A): Effect<A>
}
```
- **Priority**: HIGH
- **Complexity**: LOW
- **Rationale**: Core functional programming operation
- **Implementation**: Get snapshot, reduce over HashMap

**7. `filterMap` - Filter and Transform**
```typescript
export const filterMap: {
  <A, V, K>(f: (value: V, key: K) => Option<A>): (self: TxHashMap<K, V>) => Effect<TxHashMap<K, A>>
  <K, V, A>(self: TxHashMap<K, V>, f: (value: V, key: K) => Option<A>): Effect<TxHashMap<K, A>>
}
```
- **Priority**: MEDIUM
- **Complexity**: MEDIUM
- **Rationale**: Efficient combined filter and map operation
- **Implementation**: Get snapshot, filterMap over HashMap, create new TxHashMap

#### **Specialized Query Operations (3 functions)**

**8. `hasBy` - Conditional Existence Check**
```typescript
export const hasBy: {
  <K, V>(predicate: (value: NoInfer<V>, key: NoInfer<K>) => boolean): (self: TxHashMap<K, V>) => Effect<boolean>
  <K, V>(self: TxHashMap<K, V>, predicate: (value: NoInfer<V>, key: NoInfer<K>) => boolean): Effect<boolean>
}
```
- **Priority**: MEDIUM
- **Complexity**: LOW
- **Rationale**: Useful for conditional logic
- **Implementation**: Get snapshot, use HashMap.hasBy

**9. `findFirst` - Find First Matching Entry**
```typescript
export const findFirst: {
  <A, V, K>(f: (value: V, key: K) => Option<A>): (self: TxHashMap<K, V>) => Effect<Option<A>>
  <K, V, A>(self: TxHashMap<K, V>, f: (value: V, key: K) => Option<A>): Effect<Option<A>>
}
```
- **Priority**: MEDIUM
- **Complexity**: LOW
- **Rationale**: Efficient search operation
- **Implementation**: Get snapshot, use HashMap.findFirst

**10. `some` - Any Predicate Match**
```typescript
export const some: {
  <V, K>(predicate: (value: NoInfer<V>, key: NoInfer<K>) => boolean): (self: TxHashMap<K, V>) => Effect<boolean>
  <K, V>(self: TxHashMap<K, V>, predicate: (value: NoInfer<V>, key: NoInfer<K>) => boolean): Effect<boolean>
}
```
- **Priority**: MEDIUM  
- **Complexity**: LOW
- **Rationale**: Useful for validation and conditional logic
- **Implementation**: Get snapshot, use HashMap.some

**11. `every` - All Predicate Match**
```typescript
export const every: {
  <V, K>(predicate: (value: NoInfer<V>, key: NoInfer<K>) => boolean): (self: TxHashMap<K, V>) => Effect<boolean>
  <K, V>(self: TxHashMap<K, V>, predicate: (value: NoInfer<V>, key: NoInfer<K>) => boolean): Effect<boolean>
}
```
- **Priority**: MEDIUM
- **Complexity**: LOW  
- **Rationale**: Useful for validation and conditional logic
- **Implementation**: Get snapshot, use HashMap.every

### **📋 Phase 3: Specialized Operations (Lower Priority)**

#### **Alternative Access Patterns (2 functions)**

**12. `toEntries` - Iterator to Entries**
```typescript
export const toEntries = <K, V>(self: TxHashMap<K, V>): Effect<Array<readonly [K, V]>>
```
- **Priority**: LOW
- **Complexity**: LOW
- **Rationale**: Alternative API for entries access, may be redundant with existing `entries`
- **Implementation**: Alias to existing entries function or get snapshot + HashMap.toEntries

**13. `toValues` - Iterator to Values**  
```typescript
export const toValues = <K, V>(self: TxHashMap<K, V>): Effect<Array<V>>
```
- **Priority**: LOW
- **Complexity**: LOW
- **Rationale**: Alternative API for values access, may be redundant with existing `values`
- **Implementation**: Alias to existing values function or get snapshot + HashMap.toValues

#### **Effect-Based Operations (4 functions)**

**14. `forEach` - Side Effects Iteration**
```typescript
export const forEach: {
  <V, K, R, E>(f: (value: V, key: K) => Effect<void, E, R>): (self: TxHashMap<K, V>) => Effect<void, E, R>
  <K, V, R, E>(self: TxHashMap<K, V>, f: (value: V, key: K) => Effect<void, E, R>): Effect<void, E, R>
}
```
- **Priority**: MEDIUM
- **Complexity**: HIGH
- **Rationale**: Essential for side-effect operations in Effect context
- **Implementation**: Get snapshot, iterate with Effect.forEach
- **Note**: Should maintain transactional context

**15. `flatMap` - Flat Map Operation**
```typescript
export const flatMap: {
  <A, V, K>(f: (value: V, key: K) => TxHashMap<K, A>): (self: TxHashMap<K, V>) => Effect<TxHashMap<K, A>>
  <K, V, A>(self: TxHashMap<K, V>, f: (value: V, key: K) => TxHashMap<K, A>): Effect<TxHashMap<K, A>>
}
```
- **Priority**: LOW-MEDIUM
- **Complexity**: HIGH
- **Rationale**: Advanced functional programming operation
- **Implementation**: Complex - requires merging multiple TxHashMaps
- **Note**: May require careful consideration of transactional semantics

**16. `compact` - Remove None Values**
```typescript
export const compact = <K, A>(self: TxHashMap<K, Option<A>>): Effect<TxHashMap<K, A>>
```
- **Priority**: LOW
- **Complexity**: MEDIUM
- **Rationale**: Convenience function for Option-valued maps
- **Implementation**: Get snapshot, use HashMap.compact, create new TxHashMap

#### **Mutation Performance Helpers (5 functions)**

**18-22. `beginMutation`, `endMutation`, `mutate`, `modifyHash`, `mutate`**
- **Priority**: LOW
- **Complexity**: N/A
- **Rationale**: HashMap mutation optimization - not applicable to TxHashMap
- **Implementation**: N/A - TxHashMap uses transactional semantics instead
- **Alternative**: Transactional batching could provide similar performance benefits

### **📋 Phase 4: Type-Only Exports (3 functions)**

These are already covered by TxHashMap's type system:
- `TypeId` ✅ - Already implemented
- `TypeId` (type) ✅ - Already implemented  
- `HashMap` interface ✅ - TxHashMap interface serves this purpose
- `UpdateFn` type ✅ - Covered by function parameters
- Type extractors (Key, Value, Entry) ✅ - Already implemented in TxHashMap namespace

## Implementation Strategy

### **Phase 1: Essential Functions (Week 1)**
1. Implement `isTxHashMap` type guard
2. Implement `getHash` and `hasHash` for hash optimization
3. Add comprehensive tests for new functions
4. Update documentation with examples

### **Phase 2: Core Functional Operations (Week 2)**  
1. Implement `map`, `filter`, `reduce` 
2. Implement `filterMap` for combined operations
3. Implement query operations: `hasBy`, `findFirst`, `some`, `every`
4. Add comprehensive tests and documentation
5. Performance optimization review

### **Phase 3: Advanced Operations (Week 3)**
1. Implement `forEach` with proper Effect integration
2. Implement alternative access: `toEntries`, `toValues`
3. Implement `compact` for Option handling
4. Consider `flatMap` complexity and implementation
5. Final documentation and example review

### **Phase 4: Performance and Polish (Week 4)**
1. Performance benchmarking against HashMap equivalents
2. Memory usage optimization review
3. Documentation completeness audit
4. Example quality review and enhancement
5. Final testing and edge case coverage

## Success Criteria

### **Functional Parity**
- ✅ All applicable HashMap functions have TxHashMap equivalents
- ✅ All functions maintain transactional semantics
- ✅ Performance comparable to HashMap where applicable
- ✅ Type safety maintained throughout

### **Quality Standards**
- ✅ 100% test coverage for new functions
- ✅ 100% documentation coverage with working examples
- ✅ All automated quality checks passing
- ✅ Performance benchmarks within acceptable ranges

### **Developer Experience**
- ✅ Consistent API patterns with existing TxHashMap functions
- ✅ Clear documentation with practical examples
- ✅ Proper error messages and type safety
- ✅ Smooth migration path from HashMap usage

## Risk Assessment

### **Low Risk**
- Type guards and basic operations (Phase 1)
- Query operations that don't modify state
- Simple transformations using existing HashMap functions

### **Medium Risk**  
- Complex transformations that create new TxHashMaps
- Performance optimization for bulk operations
- Effect integration for side-effect operations

### **High Risk**
- `flatMap` operation complexity with transactional semantics
- Memory usage optimization for large transformations
- Performance parity with mutable HashMap operations

## Conclusion

This comprehensive audit identifies 21 remaining missing functions that would complete TxHashMap's parity with HashMap (excluding unsafe operations that conflict with transactional safety principles). **Phase 1 has been completed** with 3 essential functions implemented and tested. The phased implementation approach ensures:

1. **Quick value delivery** with essential functions in Phase 1
2. **Core functionality** completion in Phase 2  
3. **Advanced features** for power users in Phase 3
4. **Production readiness** with performance optimization in Phase 4

The implementation will significantly enhance TxHashMap's utility while maintaining its transactional guarantees and performance characteristics.