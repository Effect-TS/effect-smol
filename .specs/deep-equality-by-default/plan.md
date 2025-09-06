# Deep Equality by Default - Implementation Plan

## Current State Analysis

### Equal.ts Current Behavior

- **Plain objects**: `Equal.equals({a: 1}, {a: 1})` → `false` (reference equality only)
- **Plain arrays**: `Equal.equals([1, 2], [1, 2])` → `false` (reference equality only)
- **Custom Equal types**: Uses `[Equal.symbol]()` method for structural equality
- **Dates**: Special case with ISO string comparison
- **Primitives**: Reference/value equality works correctly

### Hash.ts Current Behavior

- **Plain objects/arrays**: Uses `Hash.random()` - assigns random cached hash per instance
- **Custom Hash types**: Uses `[Hash.symbol]()` method
- **Structural hashing available**: `Hash.structure()` and `Hash.array()` functions exist but aren't used by default

### Key Issue

The `compareBoth()` function in Equal.ts (lines 87-105) only performs structural comparison for:

1. Values implementing `Equal` interface
2. Date objects
3. Falls back to reference equality for plain objects/arrays

## Proposed Solution

### Phase 1: Enhanced Equal.equals() Logic

Modify the `compareBoth()` function to detect and handle plain objects and arrays structurally:

```typescript
function compareBoth(self: unknown, that: unknown): boolean {
  if (self === that) {
    return true
  }
  const selfType = typeof self
  if (selfType !== typeof that) {
    return false
  }
  if (selfType === "object" || selfType === "function") {
    if (self !== null && that !== null) {
      if (isEqual(self) && isEqual(that)) {
        return Hash.hash(self) === Hash.hash(that) && self[symbol](that)
      } else if (self instanceof Date && that instanceof Date) {
        return self.toISOString() === that.toISOString()
      } else if (Array.isArray(self) && Array.isArray(that)) {
        return structuralArrayEquals(self, that)
      } else if (isPlainObject(self) && isPlainObject(that)) {
        return structuralObjectEquals(self, that)
      }
    }
  }
  return false
}
```

### Phase 2: Structural Comparison Helpers

#### Array Structural Equality

```typescript
function structuralArrayEquals(self: unknown[], that: unknown[]): boolean {
  if (self.length !== that.length) {
    return false
  }
  for (let i = 0; i < self.length; i++) {
    if (!equals(self[i], that[i])) {
      return false
    }
  }
  return true
}
```

#### Object Structural Equality

```typescript
function structuralObjectEquals(self: object, that: object): boolean {
  const selfKeys = Object.keys(self).sort()
  const thatKeys = Object.keys(that).sort()

  if (selfKeys.length !== thatKeys.length) {
    return false
  }

  for (let i = 0; i < selfKeys.length; i++) {
    if (selfKeys[i] !== thatKeys[i]) {
      return false
    }
    if (!equals((self as any)[selfKeys[i]], (that as any)[thatKeys[i]])) {
      return false
    }
  }
  return true
}
```

#### Plain Object Detection

```typescript
function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  if (obj === null || typeof obj !== "object") {
    return false
  }

  // Not plain if it has a custom constructor or prototype
  const proto = Object.getPrototypeOf(obj)
  return proto === null || proto === Object.prototype
}
```

### Phase 3: Enhanced Hash.hash() Logic

Modify the main `hash()` function to use structural hashing for plain objects/arrays:

```typescript
export const hash: <A>(self: A) => number = <A>(self: A) => {
  switch (typeof self) {
    // ... existing primitive cases ...
    case "function":
    case "object": {
      if (self === null) {
        return string("null")
      } else if (self instanceof Date) {
        return hash(self.toISOString())
      } else if (isHash(self)) {
        return self[symbol]()
      } else if (Array.isArray(self)) {
        return array(self) // Use structural array hashing
      } else if (isPlainObject(self)) {
        return structure(self) // Use structural object hashing
      } else {
        return random(self) // Fallback for other object types
      }
    }
  }
}
```

## Implementation Strategy

### Files to Modify

1. **`packages/effect/src/interfaces/Equal.ts`**
   - Update `compareBoth()` function
   - Add structural comparison helpers
   - Add plain object detection utility

2. **`packages/effect/src/interfaces/Hash.ts`**
   - Update main `hash()` function
   - Reuse existing `array()` and `structure()` functions

### Backward Compatibility

- **Preserved**: All existing behavior for custom Equal/Hash implementations
- **Preserved**: Date comparison behavior
- **Enhanced**: Plain objects/arrays now work structurally instead of failing
- **No breaking changes**: Only false negatives become true positives

### Performance Considerations

- **Objects**: Structural comparison has O(n) complexity vs O(1) reference check
- **Arrays**: Recursive comparison has O(n\*depth) complexity
- **Optimization**: Hash comparison as first gate (fail fast if hashes differ)
- **Caching**: Leverage existing `Hash.cached()` for repeated operations

### Testing Strategy

#### New Test Cases for Equal.ts

```typescript
describe("Plain object/array equality", () => {
  it("should compare plain objects structurally", () => {
    assertTrue(Equal.equals({ a: 1, b: 2 }, { a: 1, b: 2 }))
    assertTrue(Equal.equals({ b: 2, a: 1 }, { a: 1, b: 2 })) // key order independent
    assertFalse(Equal.equals({ a: 1 }, { a: 2 }))
    assertFalse(Equal.equals({ a: 1 }, { a: 1, b: 2 }))
  })

  it("should compare arrays structurally", () => {
    assertTrue(Equal.equals([1, 2, 3], [1, 2, 3]))
    assertFalse(Equal.equals([1, 2, 3], [1, 2]))
    assertFalse(Equal.equals([1, 2], [2, 1])) // order matters
  })

  it("should handle nested structures", () => {
    assertTrue(Equal.equals({ arr: [1, { x: 2 }] }, { arr: [1, { x: 2 }] }))
    assertTrue(Equal.equals([{ a: 1 }, { b: [2, 3] }], [{ a: 1 }, { b: [2, 3] }]))
  })

  it("should not affect custom Equal implementations", () => {
    // Ensure existing behavior preserved
  })
})
```

#### Hash Consistency Tests

```typescript
describe("Hash consistency with structural equality", () => {
  it("should produce same hash for structurally equal objects", () => {
    const obj1 = { a: 1, b: 2 }
    const obj2 = { b: 2, a: 1 }
    assertTrue(Equal.equals(obj1, obj2))
    strictEqual(Hash.hash(obj1), Hash.hash(obj2))
  })

  it("should produce same hash for structurally equal arrays", () => {
    const arr1 = [1, 2, { x: 3 }]
    const arr2 = [1, 2, { x: 3 }]
    assertTrue(Equal.equals(arr1, arr2))
    strictEqual(Hash.hash(arr1), Hash.hash(arr2))
  })
})
```

## Edge Cases & Considerations

### Object Property Ordering

- **Solution**: Sort keys before comparison to ensure consistency
- **Hash consistency**: `Hash.structure()` already handles this correctly

### Circular References

- **Risk**: Infinite recursion in deep comparison
- **Solution**: Track visited objects using WeakSet to detect cycles
- **Alternative**: Limit recursion depth with configurable threshold

### Performance Impact

- **Trade-off**: Correctness vs performance for plain objects/arrays
- **Mitigation**: Hash-based early rejection, optimized comparison paths
- **Future**: Consider opt-in flag if performance becomes critical

### Non-Plain Objects

- **Classes**: Continue using reference equality (avoid breaking encapsulation)
- **Built-ins**: Map, Set, etc. keep reference equality (may add specific support later)
- **Functions**: Keep reference equality

## Success Criteria

1. **Structural Equality**: `Equal.equals({a: 1}, {a: 1})` returns `true`
2. **Hash Consistency**: Equal objects produce equal hashes
3. **Backward Compatibility**: No breaking changes to existing code
4. **Performance**: Reasonable performance characteristics for common cases
5. **Test Coverage**: Comprehensive tests for all edge cases
6. **Documentation**: Clear examples of new behavior

## Future Enhancements

### Phase 4: Advanced Object Support (Future)

- **Map/Set**: Structural comparison support
- **Custom iterables**: Generic iteration-based comparison
- **Nested structures**: Optimized deep comparison algorithms

### Phase 5: Performance Optimizations (Future)

- **Memoization**: Cache comparison results for repeated operations
- **Short-circuiting**: Optimized property comparison orders
- **Parallel comparison**: Worker-based comparison for large structures

This plan provides a robust foundation for making plain objects and arrays comparable by structure while maintaining all existing functionality and performance characteristics.
