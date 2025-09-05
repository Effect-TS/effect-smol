# Memory FileSystem API Design

### Core Interface Structure

```typescript
export interface MemoryFileSystem extends Iterable<[string, INode]>, Pipeable, Inspectable {
  readonly [TypeId]: TypeId
  readonly inodes: Map<number, INode>
  readonly fds: Map<number, FileDescriptor>  
  readonly nextInode: { value: number }
  readonly nextFd: { value: number }
  readonly cwd: string
  readonly root: number 
}
```

### Key Patterns

1. **TypeId for Nominal Typing**
   ```typescript
   const TypeId: TypeId = "~effect/MemoryFileSystem"
   export type TypeId = "~effect/MemoryFileSystem"
   ```

2. **Proto Pattern for Methods**
   ```typescript
   const MemoryFileSystemProto: Omit<MemoryFileSystem, "inodes" | "fds" | "nextInode" | "nextFd" | "cwd" | "root"> = {
     [TypeId]: TypeId,
     toString() {
       return format(this.toJSON())
     },
     toJSON() {
       return {
         _id: "MemoryFileSystem",
         cwd: this.cwd,
         inodes: Array.from(this.inodes.entries()).map(toJSON)
       }
     },
     [NodeInspectSymbol]() {
       return this.toJSON()
     },
     pipe() {
       return pipeArguments(this, arguments)
     }
   }
   ```

3. **Constructor Functions**
   ```typescript
   // Create empty filesystem
   export const empty = (): MemoryFileSystem => {
     const self = Object.create(MemoryFileSystemProto)
     self.inodes = new Map()
     self.fds = new Map() 
     self.nextInode = { value: 2 } // Start after root inode (1)
     self.nextFd = { value: 3 } // Start after stdin/stdout/stderr
     self.cwd = "/"
     self.root = 1
     
     // Create root directory inode
     const root: INode = {
       [TypeId]: INodeTypeId,
       filesystem: self,
       ino: 1,
       mode: 0o755,
       uid: 0,
       gid: 0, 
       nlink: 2, // . and ..
       size: 0,
       atime: new Date(),
       mtime: new Date(),
       ctime: new Date(),
       content: { _tag: "Directory", entries: new Map([[".", 1], ["..", 1]]) }
     }
     self.inodes.set(1, root)
     
     return self
   }
   ```

4. **Dual Function Pattern**
   
   All functions should support both curried and non-curried forms using `dual()`:

   ```typescript
   // File operations
   export const open: {
     (path: string, flags: OpenFlags, mode?: number): (fs: MemoryFileSystem) => Result<FileDescriptor, PosixError>
     (fs: MemoryFileSystem, path: string, flags: OpenFlags, mode?: number): Result<FileDescriptor, PosixError>
   } = dual<
     (path: string, flags: OpenFlags, mode?: number) => (fs: MemoryFileSystem) => Result<FileDescriptor, PosixError>,
     (fs: MemoryFileSystem, path: string, flags: OpenFlags, mode?: number) => Result<FileDescriptor, PosixError>
   >(
     (args) => typeof args[0] !== "string", // First arg is MemoryFileSystem if not curried
     (fs: MemoryFileSystem, path: string, flags: OpenFlags, mode: number = 0o644): Result<FileDescriptor, PosixError> => {
       // Implementation
     }
   )

   export const read: {
     (fd: FileDescriptor, buffer: Uint8Array): Result<number, PosixError>
     (fd: FileDescriptor): (buffer: Uint8Array) => Result<number, PosixError>  
   } = dual<
     (fd: FileDescriptor) => (buffer: Uint8Array) => Result<number, PosixError>,
     (fd: FileDescriptor, buffer: Uint8Array) => Result<number, PosixError>
   >(2, (fd: FileDescriptor, buffer: Uint8Array): Result<number, PosixError> => {
     // Implementation
   })

   export const write: {
     (fd: FileDescriptor, data: Uint8Array): Result<number, PosixError>
     (fd: FileDescriptor): (data: Uint8Array) => Result<number, PosixError>
   } = dual<
     (fd: FileDescriptor) => (data: Uint8Array) => Result<number, PosixError>,
     (fd: FileDescriptor, data: Uint8Array) => Result<number, PosixError>
   >(2, (fd: FileDescriptor, data: Uint8Array): Result<number, PosixError> => {
     // Implementation  
   })

   // Directory operations
   export const mkdir: {
     (path: string, mode?: number): (fs: MemoryFileSystem) => Result<void, PosixError>
     (fs: MemoryFileSystem, path: string, mode?: number): Result<void, PosixError>
   } = dual<
     (path: string, mode?: number) => (fs: MemoryFileSystem) => Result<void, PosixError>,
     (fs: MemoryFileSystem, path: string, mode?: number) => Result<void, PosixError>
   >(
     (args) => typeof args[0] !== "string",
     (fs: MemoryFileSystem, path: string, mode: number = 0o755): Result<void, PosixError> => {
       // Implementation
     }
   )

   export const unlink: {
     (path: string): (fs: MemoryFileSystem) => Result<void, PosixError>
     (fs: MemoryFileSystem, path: string): Result<void, PosixError>
   } = dual<
     (path: string) => (fs: MemoryFileSystem) => Result<void, PosixError>,
     (fs: MemoryFileSystem, path: string) => Result<void, PosixError>
   >(
     (args) => typeof args[0] !== "string",
     (fs: MemoryFileSystem, path: string): Result<void, PosixError> => {
       // Implementation
     }
   )
   ```

### Self-Contained References Pattern

Following the requirement that INode and FileDescriptor should have references back to their MemoryFileSystem:

```typescript
export interface INode {
  readonly [TypeId]: TypeId
  readonly filesystem: MemoryFileSystem  // Self-contained reference
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

export interface FileDescriptor {
  readonly [TypeId]: TypeId
  readonly filesystem: MemoryFileSystem  // Self-contained reference
  readonly fd: number
  readonly inode: number
  readonly flags: OpenFlags
  readonly mode: OpenMode
  readonly position: number
}
```

### Element Access Pattern

```typescript
export const stat: {
  (path: string): (fs: MemoryFileSystem) => Result<File.Info, PosixError>
  (fs: MemoryFileSystem, path: string): Result<File.Info, PosixError>
} = dual<
  (path: string) => (fs: MemoryFileSystem) => Result<File.Info, PosixError>,
  (fs: MemoryFileSystem, path: string) => Result<File.Info, PosixError>
>(
  (args) => typeof args[0] !== "string",
  (fs: MemoryFileSystem, path: string): Result<File.Info, PosixError> => {
    // Path resolution and inode lookup
  }
)

export const exists: {
  (path: string): (fs: MemoryFileSystem) => boolean
  (fs: MemoryFileSystem, path: string): boolean
} = dual<
  (path: string) => (fs: MemoryFileSystem) => boolean,
  (fs: MemoryFileSystem, path: string) => boolean
>(
  (args) => typeof args[0] !== "string", 
  (fs: MemoryFileSystem, path: string): boolean => {
    // Path resolution check
  }
)
```

This API design follows the established Effect library patterns while providing a complete POSIX-compliant memory filesystem implementation.
