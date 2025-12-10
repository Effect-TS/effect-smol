/**
 * This module provides a POSIX-compliant memory filesystem implementation that operates entirely in memory.
 * It offers a mutable, tree-shakable API following Effect library patterns for file and directory operations
 * without requiring native filesystem dependencies.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 *
 * // Create a memory filesystem
 * const fs = MemoryFs.empty()
 *
 * // File operations
 * const program = Effect.gen(function* () {
 *   // Create a file
 *   const fd = yield* MemoryFs.open(fs, "/hello.txt", { create: true, write: true })
 *
 *   // Write content
 *   const data = new TextEncoder().encode("Hello, Virtual World!")
 *   yield* MemoryFs.write(fd, data)
 *
 *   // Read it back
 *   yield* MemoryFs.lseek(fd, 0, "SEEK_SET")
 *   const buffer = new Uint8Array(50)
 *   const bytesRead = yield* MemoryFs.read(fd, buffer)
 *
 *   // Close the file
 *   yield* MemoryFs.close(fd)
 *
 *   console.log(new TextDecoder().decode(buffer.slice(0, bytesRead)))
 * })
 * ```
 *
 * @since 4.0.0
 */
import * as Data from "../data/Data.ts"
import * as Option from "../data/Option.ts"
import * as Result from "../data/Result.ts"
import { dual } from "../Function.ts"
import type * as Inspectable from "../interfaces/Inspectable.ts"
import { format, NodeInspectSymbol } from "../interfaces/Inspectable.ts"
import type { Pipeable } from "../interfaces/Pipeable.ts"
import { pipeArguments } from "../interfaces/Pipeable.ts"
import type { File } from "../platform/FileSystem.ts"
import { Size } from "../platform/FileSystem.ts"
import type * as Types from "../types/Types.ts"

/**
 * The unique type identifier for MemoryFileSystem.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 *
 * const fs = MemoryFs.empty()
 * console.log(fs[MemoryFs.TypeId]) // Symbol(effect/collections/MemoryFileSystem)
 * ```
 *
 * @category symbols
 * @since 4.0.0
 */
export const TypeId: unique symbol = Symbol.for("effect/collections/MemoryFileSystem")

/**
 * The unique type identifier for MemoryFileSystem.
 *
 * @category symbols
 * @since 4.0.0
 */
export type TypeId = typeof TypeId

/**
 * The unique type identifier for INode.
 *
 * @category symbols
 * @since 4.0.0
 */
export const INodeTypeId: unique symbol = Symbol.for("effect/collections/MemoryFileSystem/Inode")

/**
 * The unique type identifier for INode.
 *
 * @category symbols
 * @since 4.0.0
 */
export type INodeTypeId = typeof INodeTypeId

/**
 * The unique type identifier for FileDescriptor.
 *
 * @category symbols
 * @since 4.0.0
 */
export const FileDescriptorTypeId: unique symbol = Symbol.for("effect/collections/MemoryFileSystem/FileDescriptor")

/**
 * The unique type identifier for FileDescriptor.
 *
 * @category symbols
 * @since 4.0.0
 */
export type FileDescriptorTypeId = typeof FileDescriptorTypeId

// =============================================================================
// Error Types
// =============================================================================

/**
 * POSIX error codes for filesystem operations.
 *
 * @category models
 * @since 4.0.0
 */
export type PosixErrorCode =
  | "ENOENT" // No such file or directory
  | "EACCES" // Permission denied
  | "EEXIST" // File exists
  | "ENOTDIR" // Not a directory
  | "EISDIR" // Is a directory
  | "EINVAL" // Invalid argument
  | "ENOSPC" // No space left on device
  | "EROFS" // Read-only file system
  | "ENAMETOOLONG" // File name too long
  | "ELOOP" // Too many symbolic links
  | "ENOTEMPTY" // Directory not empty
  | "EBADF" // Bad file descriptor
  | "EMFILE" // Too many open files
  | "ESPIPE" // Illegal seek
  | "EBUSY" // Device or resource busy

/**
 * POSIX-compliant error for memory filesystem operations.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 *
 * const error = new MemoryFs.PosixError({
 *   code: "ENOENT",
 *   message: "No such file or directory",
 *   path: "/nonexistent/file.txt"
 * })
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export class PosixError extends Data.TaggedError("PosixError")<{
  readonly code: PosixErrorCode
  readonly message: string
  readonly path?: string
}> {}

// =============================================================================
// File System Types
// =============================================================================

/**
 * Content types for different inode types.
 *
 * @category models
 * @since 4.0.0
 */
export type INodeContent =
  | { readonly _tag: "RegularFile"; data: Uint8Array }
  | { readonly _tag: "Directory"; entries: Map<string, number> }
  | { readonly _tag: "SymbolicLink"; readonly target: string }

/**
 * Represents a filesystem inode with POSIX-compliant metadata.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 *
 * // Inodes are created internally by filesystem operations
 * const fs = MemoryFs.empty()
 * // File creation will generate appropriate inodes
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export interface INode extends Pipeable, Inspectable.Inspectable {
  readonly [INodeTypeId]: INodeTypeId
  readonly fs: MemoryFileSystem
  readonly ino: number
  mode: number
  readonly uid: number
  readonly gid: number
  nlink: number
  size: number
  atime: Date
  mtime: Date
  ctime: Date
  readonly birthtime: Date
  content: INodeContent
}

/**
 * File access flags for open operations.
 *
 * @category models
 * @since 4.0.0
 */
export interface OpenFlags {
  readonly read?: boolean
  readonly write?: boolean
  readonly append?: boolean
  readonly create?: boolean
  readonly excl?: boolean
  readonly trunc?: boolean
}

/**
 * Seek whence constants for lseek operations.
 *
 * @category models
 * @since 4.0.0
 */
export type SeekWhence = "SEEK_SET" | "SEEK_CUR" | "SEEK_END"

/**
 * Represents an open file descriptor.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 *
 * const fs = MemoryFs.empty()
 * // File descriptors are returned by open operations
 * const fd = MemoryFs.open(fs, "/file.txt", { create: true, write: true })
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export interface FileDescriptor extends Pipeable, Inspectable.Inspectable {
  readonly [FileDescriptorTypeId]: FileDescriptorTypeId
  readonly fs: MemoryFileSystem
  readonly fd: number
  readonly inode: number
  readonly flags: OpenFlags
  position: number
}

/**
 * A POSIX-compliant memory filesystem that operates entirely in memory.
 *
 * @category models
 * @since 4.0.0
 */
export interface MemoryFileSystem extends Iterable<[string, INode]>, Pipeable, Inspectable.Inspectable {
  readonly [TypeId]: TypeId
  readonly inodes: Map<number, INode>
  readonly fds: Map<number, FileDescriptor>
  readonly cwd: string
  readonly root: number
  nextInode: number
  nextFd: number
}

// =============================================================================
// Proto Patterns
// =============================================================================

const INodeProto = {
  [INodeTypeId]: INodeTypeId,
  toString(this: INode) {
    return format(this.toJSON())
  },
  toJSON(this: INode) {
    return {
      _id: "INode",
      ino: this.ino,
      mode: this.mode.toString(8),
      size: this.size,
      content: this.content._tag
    }
  },
  [NodeInspectSymbol](this: INode) {
    return this.toJSON()
  },
  pipe(this: INode) {
    return pipeArguments(this, arguments)
  }
}

const _FileDescriptorProto = {
  [FileDescriptorTypeId]: FileDescriptorTypeId,
  toString(this: FileDescriptor) {
    return format(this.toJSON())
  },
  toJSON(this: FileDescriptor) {
    return {
      _id: "FileDescriptor",
      fd: this.fd,
      inode: this.inode,
      position: this.position,
      flags: this.flags
    }
  },
  [NodeInspectSymbol](this: FileDescriptor) {
    return this.toJSON()
  },
  pipe(this: FileDescriptor) {
    return pipeArguments(this, arguments)
  }
}

const MemoryFsProto = {
  [TypeId]: TypeId,
  toString(this: MemoryFileSystem) {
    return format(this.toJSON())
  },
  toJSON(this: MemoryFileSystem) {
    return {
      _id: "MemoryFileSystem",
      cwd: this.cwd,
      inodeCount: this.inodes.size,
      fdCount: this.fds.size
    }
  },
  [NodeInspectSymbol](this: MemoryFileSystem) {
    return this.toJSON()
  },
  pipe(this: MemoryFileSystem) {
    return pipeArguments(this, arguments)
  }
}

// =============================================================================
// Constructors
// =============================================================================

/**
 * Creates an empty memory filesystem with just a root directory.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 *
 * const fs = MemoryFs.empty()
 * console.log(fs.cwd) // "/"
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const empty = (): MemoryFileSystem => {
  const self: Types.Mutable<MemoryFileSystem> = Object.create(MemoryFsProto)
  self.inodes = new Map()
  self.fds = new Map()
  self.cwd = "/"
  self.root = 1
  self.nextInode = 2 // Start after root inode (1)
  self.nextFd = 3 // Start after stdin/stdout/stderr

  // Create root directory inode
  const now = new Date()
  const root: Types.Mutable<INode> = Object.create(INodeProto)
  root.fs = self
  root.ino = 1
  root.mode = 0o755 | 0o040000 // S_IFDIR | permissions
  root.uid = 0
  root.gid = 0
  root.nlink = 2 // . and ..
  root.size = 0
  root.atime = now
  root.mtime = now
  root.birthtime = now
  root.content = {
    _tag: "Directory" as const,
    entries: new Map([[".", 1], ["..", 1]])
  }

  self.inodes.set(1, root)
  return self
}

// =============================================================================
// Path Resolution
// =============================================================================

/**
 * Splits a path into its component parts, removing empty components.
 *
 * @internal
 */
const splitPath = (path: string): Array<string> => {
  if (path === "/") return []
  return path.split("/").filter((component) => component !== "")
}

/**
 * Normalizes a path by resolving . and .. components.
 *
 * @internal
 */
const normalizePath = (components: Array<string>): Array<string> => {
  const result: Array<string> = []

  for (const component of components) {
    if (component === ".") {
      continue
    } else if (component === "..") {
      if (result.length > 0) {
        result.pop()
      }
    } else {
      result.push(component)
    }
  }

  return result
}

/**
 * Resolves a path to an inode, following symbolic links.
 *
 * @internal
 */
const resolvePath = (
  fs: MemoryFileSystem,
  path: string,
  followSymlinks = true,
  symlinkDepth = 0
): Result.Result<INode, PosixError> => {
  if (symlinkDepth > 40) {
    return Result.fail(
      new PosixError({
        code: "ELOOP",
        message: "Too many levels of symbolic links",
        path
      })
    )
  }

  // Start from root or current directory
  let currentInode: INode
  let components: Array<string>

  if (path.startsWith("/")) {
    // Absolute path
    const root = fs.inodes.get(fs.root)
    if (!root) {
      return Result.fail(
        new PosixError({
          code: "ENOENT",
          message: "Root directory not found"
        })
      )
    }
    currentInode = root
    components = splitPath(path)
  } else {
    // Relative path - resolve current working directory
    const cwdResult = resolvePath(fs, fs.cwd, true, symlinkDepth)
    if (Result.isFailure(cwdResult)) return cwdResult
    currentInode = cwdResult.success
    components = splitPath(path)
  }

  // Normalize path components
  components = normalizePath(components)

  // Traverse path components
  for (let i = 0; i < components.length; i++) {
    const component = components[i]
    const isLastComponent = i === components.length - 1

    // Check if current is directory
    if (currentInode.content._tag !== "Directory") {
      return Result.fail(
        new PosixError({
          code: "ENOTDIR",
          message: "Not a directory",
          path: `/${components.slice(0, i).join("/")}`
        })
      )
    }

    // Look up component in directory
    const childInodeNumber = currentInode.content.entries.get(component)
    if (childInodeNumber === undefined) {
      return Result.fail(
        new PosixError({
          code: "ENOENT",
          message: "No such file or directory",
          path: `/${components.slice(0, i + 1).join("/")}`
        })
      )
    }

    const childInode = fs.inodes.get(childInodeNumber)
    if (!childInode) {
      return Result.fail(
        new PosixError({
          code: "ENOENT",
          message: "Inode not found",
          path: `/${components.slice(0, i + 1).join("/")}`
        })
      )
    }

    // Handle symbolic links
    if (childInode.content._tag === "SymbolicLink" && (followSymlinks || !isLastComponent)) {
      const target = childInode.content.target
      const remainingComponents = components.slice(i + 1)

      // Resolve symlink target
      const targetResult = resolvePath(fs, target, followSymlinks, symlinkDepth + 1)
      if (Result.isFailure(targetResult)) return targetResult

      // Continue with remaining components if any
      if (remainingComponents.length > 0) {
        const remainingPath = remainingComponents.join("/")
        const targetPath = target.endsWith("/") ? `${target}${remainingPath}` : `${target}/${remainingPath}`
        return resolvePath(fs, targetPath, followSymlinks, symlinkDepth + 1)
      } else {
        return targetResult
      }
    }

    currentInode = childInode
  }

  return Result.succeed(currentInode)
}

// =============================================================================
// File Operations
// =============================================================================

/**
 * Creates a new inode and adds it to the filesystem.
 *
 * @internal
 */
const createInode = (
  fs: MemoryFileSystem,
  mode: number,
  content: INodeContent
): INode => {
  const now = new Date()
  const ino = fs.nextInode
  fs.nextInode++

  const inode = Object.create(INodeProto)
  inode.fs = fs
  inode.ino = ino
  inode.mode = mode
  inode.uid = 0
  inode.gid = 0
  inode.nlink = content._tag === "Directory" ? 2 : 1
  inode.size = content._tag === "RegularFile" ? Size(content.data.length) : Size(0)
  inode.atime = now
  inode.mtime = now
  inode.birthtime = now
  inode.content = content

  fs.inodes.set(ino, inode)
  return inode
}

/**
 * Opens a file and returns a file descriptor.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 *
 * // Create and open a new file for writing
 * const result = MemoryFs.open(fs, "/hello.txt", { create: true, write: true })
 * if (Result.isSuccess(result)) {
 *   const fd = result.success
 *   console.log(`Opened file with fd: ${fd.fd}`)
 * }
 * ```
 *
 * @category file operations
 * @since 4.0.0
 */
export const open: {
  (
    path: string,
    flags: OpenFlags,
    mode?: number
  ): (fs: MemoryFileSystem) => Result.Result<FileDescriptor, PosixError>
  (
    fs: MemoryFileSystem,
    path: string,
    flags: OpenFlags,
    mode?: number
  ): Result.Result<FileDescriptor, PosixError>
} = dual<
  (
    path: string,
    flags: OpenFlags,
    mode?: number
  ) => (fs: MemoryFileSystem) => Result.Result<FileDescriptor, PosixError>,
  (
    fs: MemoryFileSystem,
    path: string,
    flags: OpenFlags,
    mode?: number
  ) => Result.Result<FileDescriptor, PosixError>
>(
  (args: IArguments) => typeof args[0] !== "string",
  (
    fs: MemoryFileSystem,
    path: string,
    flags: OpenFlags,
    mode = 0o644
  ): Result.Result<FileDescriptor, PosixError> => {
    const pathComponents = splitPath(path)
    if (pathComponents.length === 0) {
      return Result.fail(
        new PosixError({
          code: "EISDIR",
          message: "Is a directory",
          path
        })
      )
    }

    const filename = pathComponents[pathComponents.length - 1]
    const parentPath = pathComponents.length === 1 ? "/" : `/${pathComponents.slice(0, -1).join("/")}`

    // Resolve parent directory
    const parentResult = resolvePath(fs, parentPath)
    if (Result.isFailure(parentResult)) return Result.fail(parentResult.failure)

    const parentInode = parentResult.success
    if (parentInode.content._tag !== "Directory") {
      return Result.fail(
        new PosixError({
          code: "ENOTDIR",
          message: "Not a directory",
          path: parentPath
        })
      )
    }

    // Check if file exists
    const existingInodeNumber = parentInode.content.entries.get(filename)
    let inode: INode

    if (existingInodeNumber !== undefined) {
      // File exists
      if (flags.excl) {
        return Result.fail(
          new PosixError({
            code: "EEXIST",
            message: "File exists",
            path
          })
        )
      }

      const existingInode = fs.inodes.get(existingInodeNumber)
      if (!existingInode) {
        return Result.fail(
          new PosixError({
            code: "ENOENT",
            message: "Inode not found",
            path
          })
        )
      }

      if (existingInode.content._tag === "Directory") {
        return Result.fail(
          new PosixError({
            code: "EISDIR",
            message: "Is a directory",
            path
          })
        )
      }

      inode = existingInode

      // Truncate if requested
      if (flags.trunc && flags.write) {
        inode.content = { _tag: "RegularFile", data: new Uint8Array(0) }
        inode.size = 0
        inode.mtime = new Date()
        inode.ctime = new Date()
      }
    } else {
      // File doesn't exist
      if (!flags.create) {
        return Result.fail(
          new PosixError({
            code: "ENOENT",
            message: "No such file or directory",
            path
          })
        )
      }

      // Create new file
      inode = createInode(fs, mode | 0o100000, { // S_IFREG
        _tag: "RegularFile",
        data: new Uint8Array(0)
      })

      // Add to parent directory
      parentInode.content.entries.set(filename, inode.ino)
      parentInode.mtime = new Date()
      parentInode.ctime = new Date()
    }

    // Create file descriptor
    const fd = fs.nextFd++
    const descriptor = Object.create(_FileDescriptorProto)
    descriptor.fs = fs
    descriptor.fd = fd
    descriptor.inode = inode.ino
    descriptor.flags = flags
    descriptor.position = flags.append ? inode.size : 0

    fs.fds.set(fd, descriptor)
    return Result.succeed(descriptor)
  }
)

/**
 * Reads data from a file descriptor into a buffer.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * const fdResult = MemoryFs.open(fs, "/file.txt", { read: true })
 *
 * if (Result.isSuccess(fdResult)) {
 *   const fd = fdResult.success
 *   const buffer = new Uint8Array(1024)
 *   const readResult = MemoryFs.read(fd, buffer)
 *
 *   if (Result.isSuccess(readResult)) {
 *     console.log(`Read ${readResult.success} bytes`)
 *   }
 * }
 * ```
 *
 * @category file operations
 * @since 4.0.0
 */
export const read: {
  (fd: FileDescriptor, buffer: Uint8Array): Result.Result<number, PosixError>
  (fd: FileDescriptor): (buffer: Uint8Array) => Result.Result<number, PosixError>
} = dual<
  (fd: FileDescriptor) => (buffer: Uint8Array) => Result.Result<number, PosixError>,
  (fd: FileDescriptor, buffer: Uint8Array) => Result.Result<number, PosixError>
>(2, (fd: FileDescriptor, buffer: Uint8Array): Result.Result<number, PosixError> => {
  if (!fd.flags.read) {
    return Result.fail(
      new PosixError({
        code: "EBADF",
        message: "Bad file descriptor"
      })
    )
  }

  const inode = fd.fs.inodes.get(fd.inode)
  if (!inode) {
    return Result.fail(
      new PosixError({
        code: "EBADF",
        message: "Invalid file descriptor"
      })
    )
  }

  if (inode.content._tag !== "RegularFile") {
    return Result.fail(
      new PosixError({
        code: "EISDIR",
        message: "Is a directory"
      })
    )
  }

  const data = inode.content.data
  const start = fd.position
  const end = Math.min(start + buffer.length, data.length)
  const bytesToRead = Math.max(0, end - start)

  if (bytesToRead > 0) {
    buffer.set(data.subarray(start, end))
    fd.position = end
    inode.atime = new Date()
  }

  return Result.succeed(bytesToRead)
})

/**
 * Writes data from a buffer to a file descriptor.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * const fdResult = MemoryFs.open(fs, "/file.txt", { create: true, write: true })
 *
 * if (Result.isSuccess(fdResult)) {
 *   const fd = fdResult.success
 *   const data = new TextEncoder().encode("Hello, World!")
 *   const writeResult = MemoryFs.write(fd, data)
 *
 *   if (Result.isSuccess(writeResult)) {
 *     console.log(`Wrote ${writeResult.success} bytes`)
 *   }
 * }
 * ```
 *
 * @category file operations
 * @since 4.0.0
 */
export const write: {
  (fd: FileDescriptor, data: Uint8Array): Result.Result<number, PosixError>
  (fd: FileDescriptor): (data: Uint8Array) => Result.Result<number, PosixError>
} = dual<
  (fd: FileDescriptor) => (data: Uint8Array) => Result.Result<number, PosixError>,
  (fd: FileDescriptor, data: Uint8Array) => Result.Result<number, PosixError>
>(2, (fd: FileDescriptor, data: Uint8Array): Result.Result<number, PosixError> => {
  if (!fd.flags.write) {
    return Result.fail(
      new PosixError({
        code: "EBADF",
        message: "Bad file descriptor"
      })
    )
  }

  const inode = fd.fs.inodes.get(fd.inode)
  if (!inode) {
    return Result.fail(
      new PosixError({
        code: "EBADF",
        message: "Invalid file descriptor"
      })
    )
  }

  if (inode.content._tag !== "RegularFile") {
    return Result.fail(
      new PosixError({
        code: "EISDIR",
        message: "Is a directory"
      })
    )
  }

  const position = fd.flags.append ? inode.size : fd.position
  const existingData = inode.content.data
  const newSize = Math.max(existingData.length, position + data.length)

  // Create new buffer if we need to grow
  const newData = new Uint8Array(newSize)
  newData.set(existingData)
  newData.set(data, position)

  inode.content.data = newData
  inode.size = newSize
  inode.mtime = new Date()
  inode.ctime = new Date()

  if (!fd.flags.append) {
    fd.position = position + data.length
  } else {
    fd.position = newSize
  }

  return Result.succeed(data.length)
})

/**
 * Changes the file position for a file descriptor.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * const fdResult = MemoryFs.open(fs, "/file.txt", { read: true })
 *
 * if (Result.isSuccess(fdResult)) {
 *   const fd = fdResult.success
 *   const seekResult = MemoryFs.lseek(fd, 10, "SEEK_SET")
 *
 *   if (Result.isSuccess(seekResult)) {
 *     console.log(`New position: ${seekResult.success}`)
 *   }
 * }
 * ```
 *
 * @category file operations
 * @since 4.0.0
 */
export const lseek: {
  (fd: FileDescriptor, offset: number, whence: SeekWhence): Result.Result<number, PosixError>
  (fd: FileDescriptor): (offset: number, whence: SeekWhence) => Result.Result<number, PosixError>
} = dual<
  (fd: FileDescriptor) => (offset: number, whence: SeekWhence) => Result.Result<number, PosixError>,
  (fd: FileDescriptor, offset: number, whence: SeekWhence) => Result.Result<number, PosixError>
>(3, (fd: FileDescriptor, offset: number, whence: SeekWhence): Result.Result<number, PosixError> => {
  const inode = fd.fs.inodes.get(fd.inode)
  if (!inode) {
    return Result.fail(
      new PosixError({
        code: "EBADF",
        message: "Invalid file descriptor"
      })
    )
  }

  if (inode.content._tag !== "RegularFile") {
    return Result.fail(
      new PosixError({
        code: "ESPIPE",
        message: "Illegal seek"
      })
    )
  }

  let newPosition: number
  switch (whence) {
    case "SEEK_SET":
      newPosition = offset
      break
    case "SEEK_CUR":
      newPosition = fd.position + offset
      break
    case "SEEK_END":
      newPosition = inode.size + offset
      break
    default:
      return Result.fail(
        new PosixError({
          code: "EINVAL",
          message: "Invalid argument"
        })
      )
  }

  if (newPosition < 0) {
    return Result.fail(
      new PosixError({
        code: "EINVAL",
        message: "Invalid argument"
      })
    )
  }

  fd.position = newPosition
  return Result.succeed(newPosition)
})

/**
 * Closes a file descriptor.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * const fdResult = MemoryFs.open(fs, "/file.txt", { create: true, write: true })
 *
 * if (Result.isSuccess(fdResult)) {
 *   const fd = fdResult.success
 *   const closeResult = MemoryFs.close(fd)
 *
 *   if (Result.isSuccess(closeResult)) {
 *     console.log("File closed successfully")
 *   }
 * }
 * ```
 *
 * @category file operations
 * @since 4.0.0
 */
export const close = (fd: FileDescriptor): Result.Result<void, PosixError> => {
  const success = fd.fs.fds.delete(fd.fd)
  if (!success) {
    return Result.fail(
      new PosixError({
        code: "EBADF",
        message: "Bad file descriptor"
      })
    )
  }
  return Result.succeed(undefined)
}

/**
 * Removes a file from the filesystem.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * // Create a file first
 * const fdResult = MemoryFs.open(fs, "/temp.txt", { create: true, write: true })
 * if (Result.isSuccess(fdResult)) {
 *   MemoryFs.close(fdResult.success)
 *
 *   // Now remove it
 *   const unlinkResult = MemoryFs.unlink(fs, "/temp.txt")
 *   if (Result.isSuccess(unlinkResult)) {
 *     console.log("File removed successfully")
 *   }
 * }
 * ```
 *
 * @category file operations
 * @since 4.0.0
 */
export const unlink: {
  (path: string): (fs: MemoryFileSystem) => Result.Result<void, PosixError>
  (fs: MemoryFileSystem, path: string): Result.Result<void, PosixError>
} = dual<
  (path: string) => (fs: MemoryFileSystem) => Result.Result<void, PosixError>,
  (fs: MemoryFileSystem, path: string) => Result.Result<void, PosixError>
>(
  (args: IArguments) => typeof args[0] !== "string",
  (fs: MemoryFileSystem, path: string): Result.Result<void, PosixError> => {
    const pathComponents = splitPath(path)
    if (pathComponents.length === 0) {
      return Result.fail(
        new PosixError({
          code: "EISDIR",
          message: "Is a directory",
          path
        })
      )
    }

    const filename = pathComponents[pathComponents.length - 1]
    const parentPath = pathComponents.length === 1 ? "/" : `/${pathComponents.slice(0, -1).join("/")}`

    // Resolve parent directory
    const parentResult = resolvePath(fs, parentPath)
    if (Result.isFailure(parentResult)) return Result.fail(parentResult.failure)

    const parentInode = parentResult.success
    if (parentInode.content._tag !== "Directory") {
      return Result.fail(
        new PosixError({
          code: "ENOTDIR",
          message: "Not a directory",
          path: parentPath
        })
      )
    }

    // Check if file exists
    const targetInodeNumber = parentInode.content.entries.get(filename)
    if (targetInodeNumber === undefined) {
      return Result.fail(
        new PosixError({
          code: "ENOENT",
          message: "No such file or directory",
          path
        })
      )
    }

    const targetInode = fs.inodes.get(targetInodeNumber)
    if (!targetInode) {
      return Result.fail(
        new PosixError({
          code: "ENOENT",
          message: "Inode not found",
          path
        })
      )
    }

    // Cannot unlink directories
    if (targetInode.content._tag === "Directory") {
      return Result.fail(
        new PosixError({
          code: "EISDIR",
          message: "Is a directory",
          path
        })
      )
    }

    // Remove from parent directory
    parentInode.content.entries.delete(filename)
    parentInode.mtime = new Date()
    parentInode.ctime = new Date()

    // Decrement link count
    targetInode.nlink--

    // If no more links, remove inode
    if (targetInode.nlink <= 0) {
      fs.inodes.delete(targetInodeNumber)
    }

    return Result.succeed(undefined)
  }
)

// =============================================================================
// Directory Operations
// =============================================================================

/**
 * Creates a new directory.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * const result = MemoryFs.mkdir(fs, "/tmp", 0o755)
 *
 * if (Result.isSuccess(result)) {
 *   console.log("Directory created successfully")
 * }
 * ```
 *
 * @category directory operations
 * @since 4.0.0
 */
export const mkdir: {
  (path: string, mode?: number): (fs: MemoryFileSystem) => Result.Result<void, PosixError>
  (fs: MemoryFileSystem, path: string, mode?: number): Result.Result<void, PosixError>
} = dual<
  (path: string, mode?: number) => (fs: MemoryFileSystem) => Result.Result<void, PosixError>,
  (fs: MemoryFileSystem, path: string, mode?: number) => Result.Result<void, PosixError>
>(
  (args: IArguments) => typeof args[0] !== "string",
  (fs: MemoryFileSystem, path: string, mode = 0o755): Result.Result<void, PosixError> => {
    const pathComponents = splitPath(path)
    if (pathComponents.length === 0) {
      return Result.fail(
        new PosixError({
          code: "EEXIST",
          message: "File exists",
          path
        })
      )
    }

    const dirname = pathComponents[pathComponents.length - 1]
    const parentPath = pathComponents.length === 1 ? "/" : `/${pathComponents.slice(0, -1).join("/")}`

    // Resolve parent directory
    const parentResult = resolvePath(fs, parentPath)
    if (Result.isFailure(parentResult)) return Result.fail(parentResult.failure)

    const parentInode = parentResult.success
    if (parentInode.content._tag !== "Directory") {
      return Result.fail(
        new PosixError({
          code: "ENOTDIR",
          message: "Not a directory",
          path: parentPath
        })
      )
    }

    // Check if directory already exists
    if (parentInode.content.entries.has(dirname)) {
      return Result.fail(
        new PosixError({
          code: "EEXIST",
          message: "File exists",
          path
        })
      )
    }

    // Create new directory inode
    const dirInode = createInode(fs, mode | 0o040000, { // S_IFDIR
      _tag: "Directory",
      entries: new Map([[".", 0], ["..", parentInode.ino]]) // Will set . to correct ino after creation
    })

    // Set . to point to itself
    if (dirInode.content._tag === "Directory") {
      dirInode.content.entries.set(".", dirInode.ino)
    }

    // Add to parent directory
    parentInode.content.entries.set(dirname, dirInode.ino)
    parentInode.mtime = new Date()
    parentInode.ctime = new Date()

    // Increment parent's link count (for ..)
    parentInode.nlink++

    return Result.succeed(undefined)
  }
)

/**
 * Removes an empty directory.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * MemoryFs.mkdir(fs, "/temp")
 *
 * const result = MemoryFs.rmdir(fs, "/temp")
 * if (Result.isSuccess(result)) {
 *   console.log("Directory removed successfully")
 * }
 * ```
 *
 * @category directory operations
 * @since 4.0.0
 */
export const rmdir: {
  (path: string): (fs: MemoryFileSystem) => Result.Result<void, PosixError>
  (fs: MemoryFileSystem, path: string): Result.Result<void, PosixError>
} = dual<
  (path: string) => (fs: MemoryFileSystem) => Result.Result<void, PosixError>,
  (fs: MemoryFileSystem, path: string) => Result.Result<void, PosixError>
>(
  (args: IArguments) => typeof args[0] !== "string",
  (fs: MemoryFileSystem, path: string): Result.Result<void, PosixError> => {
    // Cannot remove root directory
    if (path === "/") {
      return Result.fail(
        new PosixError({
          code: "EBUSY",
          message: "Device or resource busy",
          path
        })
      )
    }

    const pathComponents = splitPath(path)
    if (pathComponents.length === 0) {
      return Result.fail(
        new PosixError({
          code: "EBUSY",
          message: "Device or resource busy",
          path
        })
      )
    }

    const dirname = pathComponents[pathComponents.length - 1]
    const parentPath = pathComponents.length === 1 ? "/" : `/${pathComponents.slice(0, -1).join("/")}`

    // Resolve parent directory
    const parentResult = resolvePath(fs, parentPath)
    if (Result.isFailure(parentResult)) return Result.fail(parentResult.failure)

    const parentInode = parentResult.success
    if (parentInode.content._tag !== "Directory") {
      return Result.fail(
        new PosixError({
          code: "ENOTDIR",
          message: "Not a directory",
          path: parentPath
        })
      )
    }

    // Check if directory exists
    const targetInodeNumber = parentInode.content.entries.get(dirname)
    if (targetInodeNumber === undefined) {
      return Result.fail(
        new PosixError({
          code: "ENOENT",
          message: "No such file or directory",
          path
        })
      )
    }

    const targetInode = fs.inodes.get(targetInodeNumber)
    if (!targetInode) {
      return Result.fail(
        new PosixError({
          code: "ENOENT",
          message: "Inode not found",
          path
        })
      )
    }

    // Must be a directory
    if (targetInode.content._tag !== "Directory") {
      return Result.fail(
        new PosixError({
          code: "ENOTDIR",
          message: "Not a directory",
          path
        })
      )
    }

    // Directory must be empty (only . and .. entries)
    if (targetInode.content.entries.size > 2) {
      return Result.fail(
        new PosixError({
          code: "ENOTEMPTY",
          message: "Directory not empty",
          path
        })
      )
    }

    // Remove from parent directory
    parentInode.content.entries.delete(dirname)
    parentInode.mtime = new Date()
    parentInode.ctime = new Date()
    parentInode.nlink-- // Decrement for removed .. entry

    // Remove inode
    fs.inodes.delete(targetInodeNumber)

    return Result.succeed(undefined)
  }
)

/**
 * Reads the contents of a directory.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * MemoryFs.mkdir(fs, "/docs")
 *
 * const result = MemoryFs.readdir(fs, "/")
 * if (Result.isSuccess(result)) {
 *   console.log("Directory contents:", result.success)
 * }
 * ```
 *
 * @category directory operations
 * @since 4.0.0
 */
export const readdir: {
  (path: string): (fs: MemoryFileSystem) => Result.Result<ReadonlyArray<string>, PosixError>
  (fs: MemoryFileSystem, path: string): Result.Result<ReadonlyArray<string>, PosixError>
} = dual<
  (path: string) => (fs: MemoryFileSystem) => Result.Result<ReadonlyArray<string>, PosixError>,
  (fs: MemoryFileSystem, path: string) => Result.Result<ReadonlyArray<string>, PosixError>
>(
  (args: IArguments) => typeof args[0] !== "string",
  (fs: MemoryFileSystem, path: string): Result.Result<ReadonlyArray<string>, PosixError> => {
    // Resolve directory
    const dirResult = resolvePath(fs, path)
    if (Result.isFailure(dirResult)) return Result.fail(dirResult.failure)

    const dirInode = dirResult.success
    if (dirInode.content._tag !== "Directory") {
      return Result.fail(
        new PosixError({
          code: "ENOTDIR",
          message: "Not a directory",
          path
        })
      )
    }

    // Return directory entries (excluding . and ..)
    const entries = Array.from(dirInode.content.entries.keys()).filter(
      (name) => name !== "." && name !== ".."
    )

    return Result.succeed(entries)
  }
)

// =============================================================================
// Symbolic Link Operations
// =============================================================================

/**
 * Creates a symbolic link.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * // Create a file first
 * const fdResult = MemoryFs.open(fs, "/target.txt", { create: true, write: true })
 * if (Result.isSuccess(fdResult)) {
 *   MemoryFs.close(fdResult.success)
 *
 *   // Create a symbolic link to it
 *   const symlinkResult = MemoryFs.symlink(fs, "/target.txt", "/link.txt")
 *   if (Result.isSuccess(symlinkResult)) {
 *     console.log("Symbolic link created successfully")
 *   }
 * }
 * ```
 *
 * @category symbolic link operations
 * @since 4.0.0
 */
export const symlink: {
  (target: string, linkpath: string): (fs: MemoryFileSystem) => Result.Result<void, PosixError>
  (fs: MemoryFileSystem, target: string, linkpath: string): Result.Result<void, PosixError>
} = dual<
  (target: string, linkpath: string) => (fs: MemoryFileSystem) => Result.Result<void, PosixError>,
  (fs: MemoryFileSystem, target: string, linkpath: string) => Result.Result<void, PosixError>
>(
  (args: IArguments) => typeof args[0] !== "string",
  (fs: MemoryFileSystem, target: string, linkpath: string): Result.Result<void, PosixError> => {
    const pathComponents = splitPath(linkpath)
    if (pathComponents.length === 0) {
      return Result.fail(
        new PosixError({
          code: "EEXIST",
          message: "File exists",
          path: linkpath
        })
      )
    }

    const linkname = pathComponents[pathComponents.length - 1]
    const parentPath = pathComponents.length === 1 ? "/" : `/${pathComponents.slice(0, -1).join("/")}`

    // Resolve parent directory
    const parentResult = resolvePath(fs, parentPath)
    if (Result.isFailure(parentResult)) return Result.fail(parentResult.failure)

    const parentInode = parentResult.success
    if (parentInode.content._tag !== "Directory") {
      return Result.fail(
        new PosixError({
          code: "ENOTDIR",
          message: "Not a directory",
          path: parentPath
        })
      )
    }

    // Check if link already exists
    if (parentInode.content.entries.has(linkname)) {
      return Result.fail(
        new PosixError({
          code: "EEXIST",
          message: "File exists",
          path: linkpath
        })
      )
    }

    // Create symbolic link inode
    const symlinkInode = createInode(fs, 0o777 | 0o120000, { // S_IFLNK with full permissions
      _tag: "SymbolicLink",
      target
    })

    // Add to parent directory
    parentInode.content.entries.set(linkname, symlinkInode.ino)
    parentInode.mtime = new Date()
    parentInode.ctime = new Date()

    return Result.succeed(undefined)
  }
)

/**
 * Reads the target of a symbolic link.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * MemoryFs.symlink(fs, "/target.txt", "/link.txt")
 *
 * const result = MemoryFs.readlink(fs, "/link.txt")
 * if (Result.isSuccess(result)) {
 *   console.log("Link target:", result.success) // "/target.txt"
 * }
 * ```
 *
 * @category symbolic link operations
 * @since 4.0.0
 */
export const readlink: {
  (path: string): (fs: MemoryFileSystem) => Result.Result<string, PosixError>
  (fs: MemoryFileSystem, path: string): Result.Result<string, PosixError>
} = dual<
  (path: string) => (fs: MemoryFileSystem) => Result.Result<string, PosixError>,
  (fs: MemoryFileSystem, path: string) => Result.Result<string, PosixError>
>(
  (args: IArguments) => typeof args[0] !== "string",
  (fs: MemoryFileSystem, path: string): Result.Result<string, PosixError> => {
    // Resolve symlink without following it
    const symlinkResult = resolvePath(fs, path, false)
    if (Result.isFailure(symlinkResult)) return Result.fail(symlinkResult.failure)

    const symlinkInode = symlinkResult.success
    if (symlinkInode.content._tag !== "SymbolicLink") {
      return Result.fail(
        new PosixError({
          code: "EINVAL",
          message: "Invalid argument",
          path
        })
      )
    }

    return Result.succeed(symlinkInode.content.target)
  }
)

// =============================================================================
// Metadata Operations
// =============================================================================

/**
 * Gets file information (stat).
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * const fdResult = MemoryFs.open(fs, "/info.txt", { create: true, write: true })
 * if (Result.isSuccess(fdResult)) {
 *   MemoryFs.close(fdResult.success)
 *
 *   const statResult = MemoryFs.stat(fs, "/info.txt")
 *   if (Result.isSuccess(statResult)) {
 *     console.log("File size:", statResult.success.size)
 *     console.log("File type:", statResult.success.type)
 *   }
 * }
 * ```
 *
 * @category metadata operations
 * @since 4.0.0
 */
export const stat: {
  (path: string): (fs: MemoryFileSystem) => Result.Result<File.Info, PosixError>
  (fs: MemoryFileSystem, path: string): Result.Result<File.Info, PosixError>
} = dual<
  (path: string) => (fs: MemoryFileSystem) => Result.Result<File.Info, PosixError>,
  (fs: MemoryFileSystem, path: string) => Result.Result<File.Info, PosixError>
>(
  (args: IArguments) => typeof args[0] !== "string",
  (fs: MemoryFileSystem, path: string): Result.Result<File.Info, PosixError> => {
    // Resolve path following symlinks
    const inodeResult = resolvePath(fs, path)
    if (Result.isFailure(inodeResult)) return Result.fail(inodeResult.failure)

    const inode = inodeResult.success
    const type: File.Type = inode.content._tag === "RegularFile" ?
      "File" :
      inode.content._tag === "Directory" ?
      "Directory" :
      "SymbolicLink"

    const fileInfo: File.Info = {
      type,
      dev: 1,
      ino: Option.some(inode.ino),
      mode: inode.mode,
      nlink: Option.some(inode.nlink),
      uid: Option.some(inode.uid),
      gid: Option.some(inode.gid),
      rdev: Option.some(0),
      size: Size(inode.size),
      blksize: Option.some(Size(4096)),
      blocks: Option.some(Math.ceil(Number(inode.size) / 512)),
      atime: Option.some(inode.atime),
      mtime: Option.some(inode.mtime),
      birthtime: Option.some(inode.birthtime)
    }

    return Result.succeed(fileInfo)
  }
)

/**
 * Gets file information without following symbolic links (lstat).
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 * import * as Result from "effect/data/Result"
 *
 * const fs = MemoryFs.empty()
 * MemoryFs.symlink(fs, "/target.txt", "/link.txt")
 *
 * const statResult = MemoryFs.lstat(fs, "/link.txt")
 * if (Result.isSuccess(statResult)) {
 *   console.log("File type:", statResult.success.type) // "symlink"
 * }
 * ```
 *
 * @category metadata operations
 * @since 4.0.0
 */
export const lstat: {
  (path: string): (fs: MemoryFileSystem) => Result.Result<File.Info, PosixError>
  (fs: MemoryFileSystem, path: string): Result.Result<File.Info, PosixError>
} = dual<
  (path: string) => (fs: MemoryFileSystem) => Result.Result<File.Info, PosixError>,
  (fs: MemoryFileSystem, path: string) => Result.Result<File.Info, PosixError>
>(
  (args: IArguments) => typeof args[0] !== "string",
  (fs: MemoryFileSystem, path: string): Result.Result<File.Info, PosixError> => {
    // Resolve path without following final symlink
    const inodeResult = resolvePath(fs, path, false)
    if (Result.isFailure(inodeResult)) return Result.fail(inodeResult.failure)

    const inode = inodeResult.success

    const fileType: File.Type = inode.content._tag === "RegularFile" ?
      "File" :
      inode.content._tag === "Directory" ?
      "Directory" :
      "SymbolicLink"

    const fileInfo: File.Info = {
      type: fileType,
      dev: 1,
      ino: Option.some(inode.ino),
      mode: inode.mode,
      nlink: Option.some(inode.nlink),
      uid: Option.some(inode.uid),
      gid: Option.some(inode.gid),
      rdev: Option.some(0),
      size: Size(inode.size),
      blksize: Option.some(Size(4096)),
      blocks: Option.some(Math.ceil(Number(inode.size) / 512)),
      atime: Option.some(inode.atime),
      mtime: Option.some(inode.mtime),
      birthtime: Option.some(inode.birthtime)
    }

    return Result.succeed(fileInfo)
  }
)

/**
 * Checks if a file or directory exists.
 *
 * @example
 * ```ts
 * import * as MemoryFs from "effect/collections/MemoryFileSystem"
 *
 * const fs = MemoryFs.empty()
 *
 * console.log(MemoryFs.exists(fs, "/")) // true (root exists)
 * console.log(MemoryFs.exists(fs, "/nonexistent")) // false
 * ```
 *
 * @category metadata operations
 * @since 4.0.0
 */
export const exists: {
  (path: string): (fs: MemoryFileSystem) => boolean
  (fs: MemoryFileSystem, path: string): boolean
} = dual<
  (path: string) => (fs: MemoryFileSystem) => boolean,
  (fs: MemoryFileSystem, path: string) => boolean
>(
  (args: IArguments) => typeof args[0] !== "string",
  (fs: MemoryFileSystem, path: string): boolean => {
    const result = resolvePath(fs, path)
    return Result.isSuccess(result)
  }
)
