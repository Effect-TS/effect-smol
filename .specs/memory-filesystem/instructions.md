# Memory FileSystem Implementation Instructions

## Overview and User Story

As Effect library users, we need a POSIX-compliant memory filesystem that can run entirely in memory without any native dependencies. This enables:

- **Browser Applications**: Full filesystem API in web environments
- **Testing**: Fast, reliable tests without actual disk I/O
- **CI/CD**: Consistent behavior across environments
- **Development**: Filesystem simulation and mocking
- **Cross-Platform**: Identical behavior across Node.js, Bun, and browser

## Core Requirements (Revised)

### 1. Standalone MemoryFileSystem Implementation
- Build standalone MemoryFileSystem module first
- Defer FileSystem service integration to final phase
- Focus on core functionality over complete interface compliance initially
- Support essential file operations for practical use

### 2. Core File Types Only
- Support 3 essential POSIX file types: regular files, directories, symbolic links
- Defer advanced file types (FIFO, socket, block/char devices) to future versions
- Implement simplified permission model (basic user/group/other)
- Handle path resolution including symlinks and basic ".." traversal

### 3. Standalone Testing Strategy
- Create comprehensive test suite for MemoryFileSystem only
- Ensure behavioral consistency between memory, Node.js, and Bun implementations
- Validate POSIX compliance for all operations
- Include performance and concurrency tests

## Technical Specifications

### In-Memory Storage Architecture
```typescript
interface INode {
  id: number
  type: File.Type
  mode: number
  uid: number
  gid: number
  size: Size
  atime: Date
  mtime: Date
  ctime: Date
  birthtime: Date
  nlink: number
  dev: number
  rdev?: number
  blksize: Size
  blocks: number
  
  // Content storage
  content?: Uint8Array      // for regular files
  entries?: Map<string, number>  // for directories (name -> inode)
  target?: string           // for symlinks
}

interface FileDescriptor {
  fd: number
  inode: number
  flags: OpenFlag
  position: Size
  mode: number
}
```

## Acceptance Criteria

### Core Functionality
- [ ] All FileSystem methods implemented and working
- [ ] File operations: create, read, write, delete, truncate, seek
- [ ] Directory operations: mkdir, rmdir, readdir, traversal
- [ ] Metadata operations: stat, chmod, chown, utimes
- [ ] Link operations: symlink, link, readlink

### POSIX Compliance
- [ ] Skip permission checks (uid, gid)
- [ ] Support for all file types and special modes
- [ ] Correct path resolution behavior
- [ ] POSIX-compliant error codes and messages
- [ ] Proper handling of ".." with symlinks

### Test Harness
- [ ] POSIX compliance test suite

### Integration
- [ ] Effect library patterns and error handling

## Out of Scope

- **Network Filesystems**: No remote or distributed filesystem features
- **Persistence**: No saving/loading filesystem state to disk
- **Advanced Features**: No quotas, journaling, or advanced filesystem features
- **Performance Optimization**: Focus on correctness over extreme performance
- **Native Interop**: No interaction with actual filesystem or OS features

## Success Metrics

### Functional Metrics
- 100% API compatibility with existing FileSystem implementations
- All test cases pass on memory filesystem
- Zero behavioral differences between implementations (as measured by test harness)
- Complete POSIX compliance for supported operations

### Performance Metrics
- File operations complete in < 1ms for typical files (< 1MB)
- Directory traversal handles 1000+ entries efficiently
- Memory usage grows linearly with stored content
- Test suite executes in < 5 seconds

### Quality Metrics
- Zero memory leaks in long-running operations
- Full type safety with no `any` types
- Comprehensive error handling for all edge cases

## Testing Requirements

### Test Categories
1. **Unit Tests**: Individual method testing
3. **POSIX Compliance**: Standards adherence verification

### Test Infrastructure
- Use `@effect/vitest` for Effect-based testing
- Comprehensive error condition testing

This implementation will provide a complete, standards-compliant memory filesystem that serves as both a practical tool and a reference implementation for POSIX filesystem behavior in the Effect ecosystem.
