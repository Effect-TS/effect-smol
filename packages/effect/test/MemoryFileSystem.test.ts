import { assertEquals, assertFalse, assertTrue } from "@effect/vitest/utils"
import * as MemoryFs from "effect/collections/MemoryFileSystem"
import * as Option from "effect/data/Option"
import * as Result from "effect/data/Result"
import * as FileSystem from "effect/platform/FileSystem"
import { it } from "vitest"

it("should create, write, read and close files", () => {
  const fs = MemoryFs.empty()

  // Open new file for reading and writing
  const open = MemoryFs.open(fs, "/test.txt", { create: true, read: true, write: true })
  assertTrue(Result.isSuccess(open))

  // Verify file descriptor properties
  assertEquals(open.success.fd, 3)
  assertEquals(open.success.flags.create, true)
  assertEquals(open.success.flags.read, true)
  assertEquals(open.success.flags.write, true)

  // Write data
  const data = new TextEncoder().encode("Hello, World!")
  const write = MemoryFs.write(open.success, data)
  assertTrue(Result.isSuccess(write))
  assertEquals(write.success, data.length)

  // Seek back to beginning
  const seek = MemoryFs.lseek(open.success, 0, "SEEK_SET")
  assertTrue(Result.isSuccess(seek))
  assertEquals(seek.success, 0)

  // Read data back
  const buffer = new Uint8Array(50)
  const read = MemoryFs.read(open.success, buffer)
  assertTrue(Result.isSuccess(read))
  assertEquals(read.success, data.length)
  const content = buffer.slice(0, data.length)
  for (let i = 0; i < data.length; i++) {
    assertEquals(content[i], data[i])
  }

  // Close file
  const closeResult = MemoryFs.close(open.success)
  assertTrue(Result.isSuccess(closeResult))

  // File should exist
  assertTrue(MemoryFs.exists(fs, "/test.txt"))
})

it("should handle file truncation on open", () => {
  const fs = MemoryFs.empty()

  // Create file with content
  const descriptor1 = MemoryFs.open(fs, "/truncate.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor1))

  const originalData = new TextEncoder().encode("Original content")
  MemoryFs.write(descriptor1.success, originalData)
  MemoryFs.close(descriptor1.success)

  // Open with truncate flag
  const descriptor2 = MemoryFs.open(fs, "/truncate.txt", { write: true, trunc: true })
  assertTrue(Result.isSuccess(descriptor2))

  // File should be truncated (size 0)
  const stat = MemoryFs.stat(fs, "/truncate.txt")
  assertTrue(Result.isSuccess(stat))
  assertEquals(stat.success.size, 0n)

  MemoryFs.close(descriptor2.success)
})

it("should handle append mode", () => {
  const fs = MemoryFs.empty()
  const descriptor1 = MemoryFs.open(fs, "/append.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor1))

  const initial = new TextEncoder().encode("Hello")
  MemoryFs.write(descriptor1.success, initial)
  MemoryFs.close(descriptor1.success)

  // Open in append mode
  const descriptor2 = MemoryFs.open(fs, "/append.txt", { write: true, append: true })
  assertTrue(Result.isSuccess(descriptor2))

  // Write additional data
  const append = new TextEncoder().encode(", World!")
  MemoryFs.write(descriptor2.success, append)
  MemoryFs.close(descriptor2.success)

  // Read back complete content
  const descriptor3 = MemoryFs.open(fs, "/append.txt", { read: true })
  assertTrue(Result.isSuccess(descriptor3))

  const buffer = new Uint8Array(50)
  const result = MemoryFs.read(descriptor3.success, buffer)
  MemoryFs.close(descriptor3.success)

  assertTrue(Result.isSuccess(result))
  const content = new TextDecoder().decode(buffer.slice(0, result.success))
  assertEquals(content, "Hello, World!")
})

it("should delete files with unlink", () => {
  const fs = MemoryFs.empty()
  const open = MemoryFs.open(fs, "/delete-me.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(open))

  MemoryFs.write(open.success, new TextEncoder().encode("content"))
  MemoryFs.close(open.success)

  assertTrue(MemoryFs.exists(fs, "/delete-me.txt"))
  const unlink = MemoryFs.unlink(fs, "/delete-me.txt")
  assertTrue(Result.isSuccess(unlink))

  assertFalse(MemoryFs.exists(fs, "/delete-me.txt"))
})

it("should fail to create file that already exists with excl flag", () => {
  const fs = MemoryFs.empty()
  MemoryFs.open(fs, "/existing.txt", { create: true, write: true })

  const result = MemoryFs.open(fs, "/existing.txt", { create: true, excl: true, write: true })
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "EEXIST")
})

it("should fail to read from non-existent file", () => {
  const fs = MemoryFs.empty()
  const result = MemoryFs.open(fs, "/nonexistent.txt", { read: true })
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "ENOENT")
})

it("should create directories", () => {
  const fs = MemoryFs.empty()
  const result = MemoryFs.mkdir(fs, "/testdir")
  assertTrue(Result.isSuccess(result))

  // Directory should exist
  assertTrue(MemoryFs.exists(fs, "/testdir"))

  // Should be a directory
  const stat = MemoryFs.stat(fs, "/testdir")
  assertTrue(Result.isSuccess(stat))
  assertEquals(stat.success.type, "Directory")
  assertEquals(stat.success.mode, 0o40755) // S_IFDIR | 0o755
})

it("should read directory contents", () => {
  const fs = MemoryFs.empty()
  MemoryFs.mkdir(fs, "/testdir")

  const result1 = MemoryFs.open(fs, "/testdir/file1.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(result1))
  MemoryFs.close(result1.success)

  const result2 = MemoryFs.open(fs, "/testdir/file2.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(result2))
  MemoryFs.close(result2.success)
  MemoryFs.mkdir(fs, "/testdir/subdir")

  const entries = MemoryFs.readdir(fs, "/testdir")
  assertTrue(Result.isSuccess(entries))
  assertTrue(entries.success.includes("file1.txt"))
  assertTrue(entries.success.includes("file2.txt"))
  assertTrue(entries.success.includes("subdir"))
})

it("should remove empty directories", () => {
  const fs = MemoryFs.empty()
  MemoryFs.mkdir(fs, "/empty-dir")
  assertTrue(MemoryFs.exists(fs, "/empty-dir"))

  const result = MemoryFs.rmdir(fs, "/empty-dir")
  assertTrue(Result.isSuccess(result))
  assertFalse(MemoryFs.exists(fs, "/empty-dir"))
})

it("should fail to remove non-empty directories", () => {
  const fs = MemoryFs.empty()
  MemoryFs.mkdir(fs, "/non-empty")
  const descriptor = MemoryFs.open(fs, "/non-empty/file.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  MemoryFs.close(descriptor.success)

  const result = MemoryFs.rmdir(fs, "/non-empty")
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "ENOTEMPTY")
})

it("should fail to create directory that already exists", () => {
  const fs = MemoryFs.empty()
  MemoryFs.mkdir(fs, "/existing-dir")

  const result = MemoryFs.mkdir(fs, "/existing-dir")
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "EEXIST")
})

it("should fail to create directory without parent", () => {
  const fs = MemoryFs.empty()
  const result = MemoryFs.mkdir(fs, "/nonexistent/child")
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "ENOENT")
})

it("should fail to read file as directory", () => {
  const fs = MemoryFs.empty()

  const descriptor = MemoryFs.open(fs, "/file.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  MemoryFs.close(descriptor.success)

  const result = MemoryFs.readdir(fs, "/file.txt")
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "ENOTDIR")
})

it("should fail to open directory as file", () => {
  const fs = MemoryFs.empty()
  MemoryFs.mkdir(fs, "/dir")

  const result = MemoryFs.open(fs, "/dir", { read: true })
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "EISDIR")
})

it("should handle file positions correctly", () => {
  const fs = MemoryFs.empty()
  const descriptor = MemoryFs.open(fs, "/position-test.txt", { create: true, read: true, write: true })
  assertTrue(Result.isSuccess(descriptor))

  assertTrue(Result.isSuccess(descriptor))
  const content = new TextEncoder().encode("0123456789")
  MemoryFs.write(descriptor.success, content)
  MemoryFs.lseek(descriptor.success, 0, "SEEK_SET") // Reset to beginning

  // Read first 3 bytes
  const buffer1 = new Uint8Array(3)
  const read1 = MemoryFs.read(descriptor.success, buffer1)
  assertTrue(Result.isSuccess(read1))
  assertEquals(read1.success, 3)
  assertEquals(new TextDecoder().decode(buffer1), "012")

  // Read next 3 bytes (position should advance)
  const buffer2 = new Uint8Array(3)
  const read2 = MemoryFs.read(descriptor.success, buffer2)
  assertTrue(Result.isSuccess(read2))
  assertEquals(read2.success, 3)
  assertEquals(new TextDecoder().decode(buffer2), "345")

  MemoryFs.close(descriptor.success)
})

it("should handle seeking with different whence values", () => {
  const fs = MemoryFs.empty()
  const descriptor = MemoryFs.open(fs, "/seek-test.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))

  assertTrue(Result.isSuccess(descriptor))
  const content = new TextEncoder().encode("0123456789") // 10 bytes
  MemoryFs.write(descriptor.success, content)

  // Seek to position 5 from start
  const seek1 = MemoryFs.lseek(descriptor.success, 5, "SEEK_SET")
  assertTrue(Result.isSuccess(seek1))
  assertEquals(seek1.success, 5)

  // Seek 2 positions forward from current
  const seek2 = MemoryFs.lseek(descriptor.success, 2, "SEEK_CUR")
  assertTrue(Result.isSuccess(seek2))
  assertEquals(seek2.success, 7)

  // Seek to 3 positions from end
  const seek3 = MemoryFs.lseek(descriptor.success, -3, "SEEK_END")
  assertTrue(Result.isSuccess(seek3))
  assertEquals(seek3.success, 7) // 10 - 3 = 7

  MemoryFs.close(descriptor.success)
})

it("should handle EOF correctly", () => {
  const fs = MemoryFs.empty()
  const descriptor = MemoryFs.open(fs, "/eof-test.txt", { create: true, read: true, write: true })
  assertTrue(Result.isSuccess(descriptor))

  assertTrue(Result.isSuccess(descriptor))
  const content = new TextEncoder().encode("Short")
  MemoryFs.write(descriptor.success, content)
  MemoryFs.lseek(descriptor.success, 0, "SEEK_SET")

  // Read more than file size
  const buffer = new Uint8Array(100)
  const result = MemoryFs.read(descriptor.success, buffer)
  assertTrue(Result.isSuccess(result))
  assertEquals(result.success, content.length) // Should only read available bytes

  // Second read should return 0 (EOF)
  const readResult2 = MemoryFs.read(descriptor.success, buffer)
  assertTrue(Result.isSuccess(readResult2))
  assertEquals(readResult2.success, 0)

  MemoryFs.close(descriptor.success)
})

it("should fail to use closed file descriptor", () => {
  const fs = MemoryFs.empty()
  const descriptor = MemoryFs.open(fs, "/close-test.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  MemoryFs.close(descriptor.success)

  // Try to use closed descriptor
  const buffer = new Uint8Array(10)
  const result = MemoryFs.read(descriptor.success, buffer)
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "EBADF")
})

it("should fail to read from write-only descriptor", () => {
  const fs = MemoryFs.empty()
  const descriptor = MemoryFs.open(fs, "/write-only.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))

  const buffer = new Uint8Array(10)
  const result = MemoryFs.read(descriptor.success, buffer)
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "EBADF")

  MemoryFs.close(descriptor.success)
})

it("should fail to write to read-only descriptor", () => {
  const fs = MemoryFs.empty()
  const descriptor1 = MemoryFs.open(fs, "/read-only.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor1))
  MemoryFs.write(descriptor1.success, new TextEncoder().encode("content"))
  MemoryFs.close(descriptor1.success)

  const descriptor2 = MemoryFs.open(fs, "/read-only.txt", { read: true })
  assertTrue(Result.isSuccess(descriptor2))

  const data = new TextEncoder().encode("new content")
  const result = MemoryFs.write(descriptor2.success, data)
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "EBADF")

  MemoryFs.close(descriptor2.success)
})

it("should create and read symbolic links", () => {
  const fs = MemoryFs.empty()
  const descriptor = MemoryFs.open(fs, "/target.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  const content = new TextEncoder().encode("target content")
  MemoryFs.write(descriptor.success, content)
  MemoryFs.close(descriptor.success)

  const symlink = MemoryFs.symlink(fs, "/target.txt", "/link.txt")
  assertTrue(Result.isSuccess(symlink))

  const readlink = MemoryFs.readlink(fs, "/link.txt")
  assertTrue(Result.isSuccess(readlink))
  assertEquals(readlink.success, "/target.txt")

  assertTrue(MemoryFs.exists(fs, "/link.txt"))
})

it("should create relative symlinks", () => {
  const fs = MemoryFs.empty()

  MemoryFs.mkdir(fs, "/dir")
  const descriptor = MemoryFs.open(fs, "/dir/target.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  MemoryFs.close(descriptor.success)

  // Create relative symlink
  const symlink = MemoryFs.symlink(fs, "target.txt", "/dir/link.txt")
  assertTrue(Result.isSuccess(symlink))

  const readlink = MemoryFs.readlink(fs, "/dir/link.txt")
  assertTrue(Result.isSuccess(readlink))
  assertEquals(readlink.success, "target.txt")
})

it("should handle dangling symlinks", () => {
  const fs = MemoryFs.empty()

  // Create symlink to non-existent target
  const symlink = MemoryFs.symlink(fs, "/nonexistent.txt", "/dangling.txt")
  assertTrue(Result.isSuccess(symlink))

  // Should be able to read the target path
  const readlink = MemoryFs.readlink(fs, "/dangling.txt")
  assertTrue(Result.isSuccess(readlink))
  assertEquals(readlink.success, "/nonexistent.txt")

  // symlink should be created (but target doesn't exist, so exists may fail)
  // Let's check we can lstat the symlink instead
  const lstat = MemoryFs.lstat(fs, "/dangling.txt")
  assertTrue(Result.isSuccess(lstat))
})

it("should fail to create symlink over existing file", () => {
  const fs = MemoryFs.empty()

  // Create existing file
  const descriptor = MemoryFs.open(fs, "/existing.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  MemoryFs.close(descriptor.success)

  // Try to create symlink with same name
  const result = MemoryFs.symlink(fs, "/target.txt", "/existing.txt")
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "EEXIST")
})

it("should fail to readlink on non-symlinks", () => {
  const fs = MemoryFs.empty()

  // Create regular file
  const descriptor = MemoryFs.open(fs, "/regular.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  MemoryFs.close(descriptor.success)

  // Try to read as symlink
  const result = MemoryFs.readlink(fs, "/regular.txt")
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "EINVAL")
})

it("should fail to readlink on non-existent files", () => {
  const fs = MemoryFs.empty()
  const result = MemoryFs.readlink(fs, "/nonexistent.txt")
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "ENOENT")
})

it("should stat files and directories with correct metadata", () => {
  const fs = MemoryFs.empty()

  // Test file
  const descriptor = MemoryFs.open(fs, "/test.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  const content = new TextEncoder().encode("Hello")
  MemoryFs.write(descriptor.success, content)
  MemoryFs.close(descriptor.success)

  const fileStat = MemoryFs.stat(fs, "/test.txt")
  assertTrue(Result.isSuccess(fileStat))
  assertEquals(fileStat.success.type, "File")
  assertEquals(fileStat.success.mode, 0o100644) // S_IFREG | 0o644
  assertEquals(fileStat.success.size, FileSystem.Size(5))
  assertEquals(fileStat.success.nlink, Option.some(1))

  // Test directory
  MemoryFs.mkdir(fs, "/testdir")
  const stat = MemoryFs.stat(fs, "/testdir")
  assertTrue(Result.isSuccess(stat))
  assertEquals(stat.success.type, "Directory")
  assertEquals(stat.success.mode, 0o40755) // S_IFDIR | 0o755
  assertEquals(stat.success.size, FileSystem.Size(0))
  assertEquals(stat.success.nlink, Option.some(2)) // . and parent
})

it("should lstat symbolic links without following them", () => {
  const fs = MemoryFs.empty()

  // Create target and symlink
  const descriptor = MemoryFs.open(fs, "/target.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  MemoryFs.close(descriptor.success)
  MemoryFs.symlink(fs, "/target.txt", "/link.txt")

  // lstat should show symlink properties
  const lstat = MemoryFs.lstat(fs, "/link.txt")
  assertTrue(Result.isSuccess(lstat))
  assertEquals(lstat.success.type, "SymbolicLink")
  assertEquals(lstat.success.nlink, Option.some(1))

  // stat should follow the link
  const stat = MemoryFs.stat(fs, "/link.txt")
  assertTrue(Result.isSuccess(stat))
  assertEquals(stat.success.type, "File")
})

it("should fail stat on non-existent files", () => {
  const fs = MemoryFs.empty()
  const result = MemoryFs.stat(fs, "/nonexistent.txt")
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "ENOENT")
})

it("should handle empty files correctly", () => {
  const fs = MemoryFs.empty()

  // Create empty file
  const descriptor = MemoryFs.open(fs, "/empty.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  MemoryFs.close(descriptor.success)

  // Check stats
  const stat = MemoryFs.stat(fs, "/empty.txt")
  assertTrue(Result.isSuccess(stat))
  assertEquals(stat.success.type, "File")
  assertEquals(stat.success.size, 0n)

  // Reading should return 0 bytes
  const descriptor2 = MemoryFs.open(fs, "/empty.txt", { read: true })
  assertTrue(Result.isSuccess(descriptor2))
  const buffer = new Uint8Array(10)
  const result = MemoryFs.read(descriptor2.success, buffer)
  assertTrue(Result.isSuccess(result))
  assertEquals(result.success, 0)
  MemoryFs.close(descriptor2.success)
})

it("should handle deep directory paths", () => {
  const fs = MemoryFs.empty()

  // Create nested structure manually (no recursive mkdir in API)
  MemoryFs.mkdir(fs, "/level1")
  MemoryFs.mkdir(fs, "/level1/level2")
  MemoryFs.mkdir(fs, "/level1/level2/level3")

  const path = "/level1/level2/level3"
  assertTrue(MemoryFs.exists(fs, path))

  // Create file in deep path
  const descriptor = MemoryFs.open(fs, `${path}/deep-file.txt`, { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  MemoryFs.write(descriptor.success, new TextEncoder().encode("deep content"))
  MemoryFs.close(descriptor.success)

  assertTrue(MemoryFs.exists(fs, `${path}/deep-file.txt`))
})

it("should handle many files in single directory", () => {
  const fs = MemoryFs.empty()
  MemoryFs.mkdir(fs, "/many-files")

  // Create 100 files
  for (let i = 0; i < 100; i++) {
    const name = `/many-files/file${i.toString().padStart(3, "0")}.txt`
    const descriptor = MemoryFs.open(fs, name, { create: true, write: true })
    assertTrue(Result.isSuccess(descriptor))
    MemoryFs.write(descriptor.success, new TextEncoder().encode(`Content ${i}`))
    MemoryFs.close(descriptor.success)
  }

  // Read directory
  const entries = MemoryFs.readdir(fs, "/many-files")
  assertTrue(Result.isSuccess(entries))
  assertEquals(entries.success.length, 100)
  // Check a few random files exist
  assertTrue(MemoryFs.exists(fs, "/many-files/file000.txt"))
  assertTrue(MemoryFs.exists(fs, "/many-files/file050.txt"))
  assertTrue(MemoryFs.exists(fs, "/many-files/file099.txt"))
})

it("should handle very large file content", () => {
  const fs = MemoryFs.empty()
  const size = 1024 * 1024 // 1MB
  const content = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    content[i] = i % 256
  }

  const descriptor1 = MemoryFs.open(fs, "/large.bin", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor1))

  const write = MemoryFs.write(descriptor1.success, content)
  assertTrue(Result.isSuccess(write))
  assertEquals(write.success, size)
  MemoryFs.close(descriptor1.success)

  // Check file size
  const stat = MemoryFs.stat(fs, "/large.bin")
  assertTrue(Result.isSuccess(stat))
  assertEquals(stat.success.size, FileSystem.Size(size))

  // Read back in chunks
  const descriptor2 = MemoryFs.open(fs, "/large.bin", { read: true })
  assertTrue(Result.isSuccess(descriptor2))

  const buffer = new Uint8Array(4096)
  let progress = 0

  while (progress < size) {
    const result = MemoryFs.read(descriptor2.success, buffer)
    assertTrue(Result.isSuccess(result))
    progress += result.success
  }

  assertEquals(progress, size)
  MemoryFs.close(descriptor2.success)
})

it("should handle all POSIX error codes appropriately", () => {
  const fs = MemoryFs.empty()

  // ENOENT - No such file or directory
  const noent = MemoryFs.open(fs, "/nonexistent.txt", { read: true })
  assertTrue(Result.isFailure(noent))
  assertEquals(noent.failure.code, "ENOENT")

  // EEXIST - File exists
  const descriptor = MemoryFs.open(fs, "/existing.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor))
  MemoryFs.close(descriptor.success)
  const eexist = MemoryFs.open(fs, "/existing.txt", { create: true, excl: true })
  assertTrue(Result.isFailure(eexist))
  assertEquals(eexist.failure.code, "EEXIST")

  // EISDIR - Is a directory
  MemoryFs.mkdir(fs, "/dir")
  const eisdir = MemoryFs.open(fs, "/dir", { read: true })
  assertTrue(Result.isFailure(eisdir))
  assertEquals(eisdir.failure.code, "EISDIR")

  // ENOTDIR - Not a directory
  const descriptor2 = MemoryFs.open(fs, "/file.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor2))
  MemoryFs.close(descriptor2.success)
  const enotdir = MemoryFs.readdir(fs, "/file.txt")
  assertTrue(Result.isFailure(enotdir))
  assertEquals(enotdir.failure.code, "ENOTDIR")

  // ENOTEMPTY - Directory not empty
  MemoryFs.mkdir(fs, "/nonempty")
  const descriptor3 = MemoryFs.open(fs, "/nonempty/file.txt", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor3))
  MemoryFs.close(descriptor3.success)
  const enotemptyResult = MemoryFs.rmdir(fs, "/nonempty")
  assertTrue(Result.isFailure(enotemptyResult))
  assertEquals(enotemptyResult.failure.code, "ENOTEMPTY")
})

it("should provide meaningful error messages", () => {
  const fs = MemoryFs.empty()
  const result = MemoryFs.open(fs, "/path/that/does/not/exist.txt", { read: true })
  assertTrue(Result.isFailure(result))
  assertEquals(result.failure.code, "ENOENT")
  assertTrue(result.failure.message.includes("No such file or directory"))
  assertEquals(result.failure.path, "/path")
})

it("should maintain filesystem consistency across operations", () => {
  const fs = MemoryFs.empty()

  // Create complex structure
  MemoryFs.mkdir(fs, "/project")
  MemoryFs.mkdir(fs, "/project/src")
  MemoryFs.mkdir(fs, "/project/test")

  const descriptor1 = MemoryFs.open(fs, "/project/src/main.ts", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor1))
  MemoryFs.write(descriptor1.success, new TextEncoder().encode("export const main = () => {}"))
  MemoryFs.close(descriptor1.success)

  const descriptor2 = MemoryFs.open(fs, "/project/test/main.test.ts", { create: true, write: true })
  assertTrue(Result.isSuccess(descriptor2))
  MemoryFs.write(descriptor2.success, new TextEncoder().encode("import { main } from '../src/main'"))
  MemoryFs.close(descriptor2.success)

  // Create symlinks
  MemoryFs.symlink(fs, "../src/main.ts", "/project/test/main-link.ts")

  // Verify structure
  const root = MemoryFs.readdir(fs, "/")
  assertTrue(Result.isSuccess(root))
  assertTrue(root.success.includes("project"))
  assertEquals(root.success.length, 1)

  const project = MemoryFs.readdir(fs, "/project")
  assertTrue(Result.isSuccess(project))
  assertTrue(project.success.includes("src"))
  assertTrue(project.success.includes("test"))

  const src = MemoryFs.readdir(fs, "/project/src")
  assertTrue(Result.isSuccess(src))
  assertTrue(src.success.includes("main.ts"))
  assertEquals(src.success.length, 1)

  const test = MemoryFs.readdir(fs, "/project/test")
  assertTrue(Result.isSuccess(test))
  assertTrue(test.success.includes("main.test.ts"))
  assertTrue(test.success.includes("main-link.ts"))

  // Verify symlink
  const link = MemoryFs.readlink(fs, "/project/test/main-link.ts")
  assertTrue(Result.isSuccess(link))
  assertEquals(link.success, "../src/main.ts")

  // All files should exist
  assertTrue(MemoryFs.exists(fs, "/project/src/main.ts"))
  assertTrue(MemoryFs.exists(fs, "/project/test/main.test.ts"))

  // Symlink should exist (can lstat it)
  const lstat = MemoryFs.lstat(fs, "/project/test/main-link.ts")
  assertTrue(Result.isSuccess(lstat))
})

it("should handle concurrent-style operations correctly", () => {
  const fs = MemoryFs.empty()

  // Create files
  for (let i = 0; i < 10; i++) {
    const descriptor = MemoryFs.open(fs, `/file${i}.txt`, { create: true, write: true })
    assertTrue(Result.isSuccess(descriptor))
    MemoryFs.write(descriptor.success, new TextEncoder().encode(`Content ${i}`))
    MemoryFs.close(descriptor.success)
  }

  // Create directories
  for (let i = 0; i < 5; i++) {
    MemoryFs.mkdir(fs, `/dir${i}`)
  }

  // Create symlinks
  for (let i = 0; i < 3; i++) {
    MemoryFs.symlink(fs, `/file${i}.txt`, `/link${i}`)
  }

  // Verify all operations succeeded
  for (let i = 0; i < 10; i++) {
    assertTrue(MemoryFs.exists(fs, `/file${i}.txt`))
  }

  for (let i = 0; i < 5; i++) {
    assertTrue(MemoryFs.exists(fs, `/dir${i}`))
  }

  for (let i = 0; i < 3; i++) {
    assertTrue(MemoryFs.exists(fs, `/link${i}`))
    const target = MemoryFs.readlink(fs, `/link${i}`)
    assertTrue(Result.isSuccess(target))
    assertEquals(target.success, `/file${i}.txt`)
  }

  // Directory listing should show all entries
  const root = MemoryFs.readdir(fs, "/")
  assertTrue(Result.isSuccess(root))
  assertEquals(root.success.length, 18) // 10 files + 5 dirs + 3 links
})
