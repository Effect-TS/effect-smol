# Memory FileSystem Implementation Specification

## Overview

This document specifies the implementation of a POSIX-compliant memory filesystem for the Effect library. The filesystem operates entirely in memory and provides a mutable, tree-shakable API similar to MutableHashMap.

## Design Principles

1. **POSIX Compliance**: Strict adherence to POSIX.1-2017 filesystem specifications
2. **Mutable API**: Tree-shakable mutable operations following MutableHashMap patterns
3. **Self-Contained References**: INode and FileDescriptor maintain references to their MemoryFileSystem
4. **Effect Patterns**: Use Effect standard APIs (Result types) without requiring Effect runtime
5. **Absolute Correctness**: Zero tolerance for implementation shortcuts that violate POSIX semantics

## Core Data Structures

### INode Interface

```typescript
interface INode {
  readonly [TypeId]: TypeId
  readonly filesystem: MemoryFileSystem
  readonly ino: number
  readonly mode: number
  readonly uid: number
  readonly gid: number
  readonly nlink: number
  readonly size: number
  readonly atime: Date
  readonly mtime: Date
  readonly ctime: Date
  readonly content: INodeContent
}

type INodeContent = 
  | { readonly _tag: "RegularFile"; readonly data: Uint8Array }
  | { readonly _tag: "Directory"; readonly entries: Map<string, number> }
  | { readonly _tag: "SymbolicLink"; readonly target: string }
```

### FileDescriptor Interface

```typescript
interface FileDescriptor {
  readonly [TypeId]: TypeId
  readonly filesystem: MemoryFileSystem
  readonly fd: number
  readonly inode: number
  readonly flags: OpenFlags
  readonly mode: OpenMode
  readonly position: number
}

interface OpenFlags {
  readonly read: boolean
  readonly write: boolean
  readonly append: boolean
  readonly create: boolean
  readonly excl: boolean
  readonly trunc: boolean
}

type OpenMode = "readonly" | "writeonly" | "readwrite"
```

### MemoryFileSystem Class

```typescript
export interface MemoryFileSystem extends Pipeable, Inspectable {
  readonly [TypeId]: TypeId
  
  // Internal state
  readonly inodes: Map<number, INode>
  readonly fds: Map<number, FileDescriptor>
  readonly nextInode: { value: number }
  readonly nextFd: { value: number }
  readonly cwd: string
  readonly root: number // Root directory inode
}
```

## API Design

### Constructor Functions

Following MutableHashMap patterns:

```typescript
// Create empty filesystem
export const empty: () => MemoryFileSystem
```

### File Operations

```typescript
// File management
export const open: {
  (path: string, flags: OpenFlags, mode?: number): (fs: MemoryFileSystem) => Result<FileDescriptor, PosixError>
  (fs: MemoryFileSystem, path: string, flags: OpenFlags, mode?: number): Result<FileDescriptor, PosixError>
}

export const read: {
  (fd: FileDescriptor, buffer: Uint8Array): Result<number, PosixError>
  (fd: FileDescriptor): (buffer: Uint8Array) => Result<number, PosixError>
}

export const write: {
  (fd: FileDescriptor, data: Uint8Array): Result<number, PosixError>
  (fd: FileDescriptor): (data: Uint8Array) => Result<number, PosixError>
}

export const lseek: {
  (fd: FileDescriptor, offset: number, whence: SeekWhence): Result<number, PosixError>
  (fd: FileDescriptor): (offset: number, whence: SeekWhence) => Result<number, PosixError>
}

export const close: {
  (fd: FileDescriptor): Result<void, PosixError>
}

export const unlink: {
  (path: string): (fs: MemoryFileSystem) => Result<void, PosixError>
  (fs: MemoryFileSystem, path: string): Result<void, PosixError>
}
```

### Directory Operations

```typescript
export const mkdir: {
  (path: string, mode?: number): (fs: MemoryFileSystem) => Result<void, PosixError>
  (fs: MemoryFileSystem, path: string, mode?: number): Result<void, PosixError>
}

export const rmdir: {
  (path: string): (fs: MemoryFileSystem) => Result<void, PosixError>
  (fs: MemoryFileSystem, path: string): Result<void, PosixError>
}

export const readdir: {
  (path: string): (fs: MemoryFileSystem) => Result<ReadonlyArray<string>, PosixError>
  (fs: MemoryFileSystem, path: string): Result<ReadonlyArray<string>, PosixError>
}
```

### Link Operations

```typescript
export const symlink: {
  (target: string, linkpath: string): (fs: MemoryFileSystem) => Result<void, PosixError>
  (fs: MemoryFileSystem, target: string, linkpath: string): Result<void, PosixError>
}

export const readlink: {
  (path: string): (fs: MemoryFileSystem) => Result<string, PosixError>
  (fs: MemoryFileSystem, path: string): Result<string, PosixError>
}
```

### Metadata Operations

```typescript
export const stat: {
  (path: string): (fs: MemoryFileSystem) => Result<File.Info, PosixError>
  (fs: MemoryFileSystem, path: string): Result<File.Info, PosixError>
}

export const chmod: {
  (path: string, mode: number): (fs: MemoryFileSystem) => Result<void, PosixError>
  (fs: MemoryFileSystem, path: string, mode: number): Result<void, PosixError>
}
```

## Implementation Phases

### Phase 1: Core Data Structures
- [x] Define INode and FileDescriptor interfaces
- [x] Create MemoryFileSystem class with mutable API pattern
- [x] Implement basic constructor functions (empty)
- [x] Add TypeId and nominal typing support

### Phase 2: Essential File Operations
- [x] Implement file descriptor management
- [x] Add basic read/write operations
- [x] Add unlink() operation for file deletion
- [x] Create path resolution algorithm
- [x] Implement directory operations (mkdir, readdir, rmdir)

### Phase 3: POSIX Compliance
- [x] Add symbolic link support (symlink, readlink)
- [x] Implement comprehensive stat() functionality
- [x] Add permission and timestamp management
- [x] Create proper error handling with POSIX codes

### Phase 4: Advanced Features
- [ ] Implement streaming operations
- [ ] Add file watching capabilities
- [ ] Create temporary file support
- [ ] Optimize performance for large operations

### Phase 5: Testing & Integration
- [ ] Create comprehensive test suite using @effect/vitest
- [ ] Validate POSIX compliance
- [ ] Performance benchmarking
- [ ] Integration with existing FileSystem service

## Error Handling

### POSIX Error Types

```typescript
export class PosixError extends Data.TaggedError("PosixError")<{
  readonly code: PosixErrorCode
  readonly message: string
  readonly path?: string
}> {}

export type PosixErrorCode =
  | "ENOENT"   // No such file or directory
  | "EACCES"   // Permission denied
  | "EEXIST"   // File exists
  | "ENOTDIR"  // Not a directory
  | "EISDIR"   // Is a directory
  | "EINVAL"   // Invalid argument
  | "ENOSPC"   // No space left on device
  | "EROFS"    // Read-only file system
  | "ENAMETOOLONG" // File name too long
  | "ELOOP"    // Too many symbolic links
  | "ENOTEMPTY" // Directory not empty
```

## Path Resolution Algorithm

### Core Resolution Logic

1. **Start Point**: Begin at root (/) or current working directory
2. **Component Processing**: For each pathname component:
   - Look up name in current directory
   - Check execute permission for directories
   - Follow symbolic links if encountered (max 40 levels)
   - Move to target inode
3. **Special Components**:
   - `"."`: Current directory (no-op)
   - `".."`: Parent directory
   - `""`: Empty component (ignored)
4. **Link Resolution**: 
   - Absolute links start from root
   - Relative links start from link's directory
   - Loop detection prevents infinite recursion

### Trailing Slash Handling

- Forces preceding component to be a directory
- `/path/to/file/` fails if file is not directory
- `/path/to/dir/` succeeds if dir is directory

## Testing Strategy

### Test Categories

1. **Unit Tests**: Individual method testing
2. **POSIX Compliance**: Standards adherence verification  
3. **Integration Tests**: Full filesystem operations
4. **Concurrency Tests**: Multi-operation scenarios

### Test Framework

- **MANDATORY**: Use `@effect/vitest` for Effect-based functionality
- **Import Pattern**: `import { assert, describe, it } from "@effect/vitest"`
- **Test Structure**: `it.effect("description", () => Effect.gen(function*() { ... }))`
- **Assertions**: Use `assert.strictEqual()`, `assert.deepStrictEqual()`, `assert.isTrue()`, `assert.isFalse()`

### Test Patterns

```typescript
import { assert, describe, it } from "@effect/vitest"
import * as MemoryFileSystem from "effect/MemoryFileSystem"

describe("MemoryFileSystem", () => {
  describe("file operations", () => {
    it.effect("should create and read files", () =>
      Effect.gen(function*() {
        const fs = MemoryFileSystem.empty()
        const fd = yield* MemoryFileSystem.open(fs, "/test.txt", { 
          create: true, 
          write: true 
        })
        
        const written = yield* MemoryFileSystem.write(fd, new TextEncoder().encode("hello"))
        assert.strictEqual(written, 5)
        
        yield* MemoryFileSystem.lseek(fd, 0, "SEEK_SET")
        
        const buffer = new Uint8Array(10)
        const read = yield* MemoryFileSystem.read(fd, buffer)
        assert.strictEqual(read, 5)
        assert.strictEqual(new TextDecoder().decode(buffer.slice(0, read)), "hello")
      }))
  })
})
```

## Implementation Requirements

### Mandatory Patterns

1. **No try-catch in Effect.gen**: Use Effect error handling, not JavaScript exceptions
2. **No Type Assertions**: Never use `as any`, `as never`, or `as unknown`
3. **Return Yield Pattern**: Always use `return yield*` for errors/interrupts
4. **Proper Imports**: Use correct Effect library import patterns
5. **Linting**: Run `pnpm lint --fix` after every TypeScript file edit

### Development Workflow

1. **Create function** - Write implementation in TypeScript file
2. **Lint TypeScript file** - `pnpm lint --fix <typescript_file.ts>`
3. **Check compilation** - `pnpm tsc`
4. **Lint again** - `pnpm lint --fix <typescript_file.ts>`
5. **Ensure compilation** - `pnpm tsc`
6. **Write test** - Create comprehensive test in test file
7. **Compile & lint test** - `pnpm tsc` then `pnpm lint --fix <test_file.ts>`

This ensures zero compilation errors and clean, properly formatted code at every step.
