# POSIX Filesystem Specifications

This document provides comprehensive POSIX.1-2017 specifications relevant to implementing a compliant virtual filesystem.

## Table of Contents

1. [File Types](#file-types)
2. [File Descriptors](#file-descriptors)
3. [File Operations](#file-operations)
4. [Directory Operations](#directory-operations)
5. [Permissions and Mode Bits](#permissions-and-mode-bits)
6. [Path Resolution](#path-resolution)
7. [Symbolic Links](#symbolic-links)
8. [Error Handling](#error-handling)

## File Types

POSIX defines seven standard file types that must be supported:

### 1. Regular File (S_IFREG = 0100000)
- Contains arbitrary data interpreted by applications
- Most common file type for storing text, binary data, executables
- Supports read, write, seek, and truncate operations
- Size can grow or shrink dynamically

### 2. Directory (S_IFDIR = 0040000)
- Special file containing a list of directory entries
- Each entry maps a filename to an inode
- Always contains "." (self) and ".." (parent) entries
- Can be read with readdir(), created with mkdir(), removed with rmdir()

### 3. Character Device (S_IFCHR = 0020000)
- Interface to character-oriented devices (terminals, serial ports)
- Data transferred one character at a time
- Supports read/write but not seek operations
- Device-specific behavior through driver interface

### 4. Block Device (S_IFBLK = 0060000)
- Interface to block-oriented devices (disk drives, memory)
- Data transferred in fixed-size blocks (typically 512B-4KB)
- Supports random access with seek operations
- Buffered I/O for performance optimization

### 5. FIFO/Named Pipe (S_IFIFO = 0010000)
- First-in-first-out communication channel
- Created with mkfifo(), accessed like regular files
- Supports read/write but data flows through, not stored
- Blocks readers until data available, blocks writers until space available

### 6. Socket (S_IFSOCK = 0140000)
- Communication endpoint for inter-process communication
- Supports various protocols (Unix domain, TCP, UDP)
- Not directly accessible through regular file operations
- Special APIs for socket creation and communication

### 7. Symbolic Link (S_IFLNK = 0120000)
- File containing a path string pointing to another file
- Transparent redirection during path resolution
- Can point to files, directories, or other symlinks
- Can create dangling links (target doesn't exist)

### File Type Detection Macros

```c
#include <sys/stat.h>

S_ISREG(mode)   // Regular file
S_ISDIR(mode)   // Directory
S_ISCHR(mode)   // Character device
S_ISBLK(mode)   // Block device
S_ISFIFO(mode)  // FIFO/named pipe
S_ISLNK(mode)   // Symbolic link
S_ISSOCK(mode)  // Socket
```

## File Descriptors

File descriptors are non-negative integers that identify open files within a process.

### Standard File Descriptors
- **0 (STDIN_FILENO)**: Standard input
- **1 (STDOUT_FILENO)**: Standard output
- **2 (STDERR_FILENO)**: Standard error

### File Descriptor Table
- Per-process table mapping FDs to open file descriptions
- System-wide file table tracks open modes and current positions
- Multiple FDs can refer to same file (via dup())
- FDs are automatically closed when process exits

### File Descriptor Allocation
- Lowest available non-negative integer is assigned
- FDs 0, 1, 2 are reserved for standard streams
- Maximum number per process is limited (typically 1024-65536)
- Failed operations return -1 with errno set

## File Operations

### open() - Open or Create File

**Signature**: `int open(const char *pathname, int flags, mode_t mode)`

**Flags**:
- **O_RDONLY (0)**: Open for reading only
- **O_WRONLY (1)**: Open for writing only
- **O_RDWR (2)**: Open for reading and writing
- **O_CREAT (0100)**: Create file if it doesn't exist
- **O_EXCL (0200)**: Fail if file exists (with O_CREAT)
- **O_TRUNC (01000)**: Truncate to zero length if exists
- **O_APPEND (02000)**: Always write at end of file

**Behavior**:
- Returns file descriptor on success, -1 on error
- File position initially at start (except O_APPEND)
- Created files inherit directory's group ID or process effective GID
- Mode parameter specifies permissions for new files

### read() - Read from File

**Signature**: `ssize_t read(int fd, void *buf, size_t count)`

**Behavior**:
- Reads up to count bytes into buffer
- Updates file position by number of bytes read
- Returns number of bytes read, 0 for EOF, -1 for error
- May read fewer bytes than requested (not an error)

### write() - Write to File

**Signature**: `ssize_t write(int fd, const void *buf, size_t count)`

**Behavior**:
- Writes up to count bytes from buffer
- Updates file position by number of bytes written
- Returns number of bytes written, -1 for error
- May write fewer bytes than requested (not an error)
- O_APPEND files always write at end regardless of position

### lseek() - Set File Position

**Signature**: `off_t lseek(int fd, off_t offset, int whence)`

**Whence Values**:
- **SEEK_SET (0)**: Set position to offset
- **SEEK_CUR (1)**: Set position to current + offset
- **SEEK_END (2)**: Set position to end + offset

**Behavior**:
- Returns new file position on success, -1 on error
- Can seek beyond end of file (creates "hole" on write)
- Some file types (pipes, FIFOs) don't support seeking

### close() - Close File Descriptor

**Signature**: `int close(int fd)`

**Behavior**:
- Releases file descriptor for reuse
- Closes file if no other FDs reference it
- Flushes buffered data to storage
- Returns 0 on success, -1 on error

### unlink() - Remove File or Symbolic Link

**Signature**: `int unlink(const char *pathname)`

**Behavior**:
- Removes directory entry and decrements link count
- File deleted when link count reaches 0 and no processes have it open  
- If processes have file open, deletion deferred until all FDs closed
- Can remove symbolic links (removes link itself, not target)
- **Cannot remove directories** - use rmdir() instead
- Requires write permission on containing directory
- Returns 0 on success, -1 on error

**Error Conditions**:
- **ENOENT**: File does not exist
- **EACCES**: Write permission denied on directory
- **EISDIR**: Pathname refers to a directory
- **EROFS**: File system is read-only
- **EBUSY**: File is being used by system or another process

## Directory Operations

### mkdir() - Create Directory

**Signature**: `int mkdir(const char *pathname, mode_t mode)`

**Behavior**:
- Creates new directory with specified permissions
- Parent directory must exist (unless recursive)
- Directory created with "." and ".." entries
- Returns 0 on success, -1 on error

### rmdir() - Remove Directory

**Signature**: `int rmdir(const char *pathname)`

**Behavior**:
- Removes empty directory (only "." and ".." entries)
- Fails if directory contains other files
- Cannot remove "." or ".." entries
- Returns 0 on success, -1 on error

### opendir() - Open Directory Stream

**Signature**: `DIR *opendir(const char *name)`

**Behavior**:
- Opens directory for reading entries
- Returns directory stream pointer or NULL on error
- Directory must have read permission

### readdir() - Read Directory Entry

**Signature**: `struct dirent *readdir(DIR *dirp)`

**Behavior**:
- Returns next directory entry or NULL at end
- Entry contains name and optionally inode number
- Order of entries is implementation-defined
- Not guaranteed to be reentrant

### closedir() - Close Directory Stream

**Signature**: `int closedir(DIR *dirp)`

**Behavior**:
- Closes directory stream and frees resources
- Returns 0 on success, -1 on error

## Permissions and Mode Bits

### Permission Bits Structure
```
15  12  11   9   8   6   5   3   2   0
+---+---+---+---+---+---+---+---+---+
|typ|sug| - | u | g | o | u | g | o |
+---+---+---+---+---+---+---+---+---+
                r w x   r w x   r w x
```

### File Type Bits (bits 15-12)
- **S_IFREG (0100000)**: Regular file
- **S_IFDIR (0040000)**: Directory
- **S_IFCHR (0020000)**: Character device
- **S_IFBLK (0060000)**: Block device
- **S_IFIFO (0010000)**: FIFO/named pipe
- **S_IFLNK (0120000)**: Symbolic link
- **S_IFSOCK (0140000)**: Socket

### Special Mode Bits (bits 11-9)
- **S_ISUID (04000)**: Set user ID on execution
- **S_ISGID (02000)**: Set group ID on execution
- **S_ISVTX (01000)**: Sticky bit (restricted deletion)

### Permission Bits (bits 8-0)
- **S_IRUSR (0400)**: User read
- **S_IWUSR (0200)**: User write
- **S_IXUSR (0100)**: User execute
- **S_IRGRP (0040)**: Group read
- **S_IWGRP (0020)**: Group write
- **S_IXGRP (0010)**: Group execute
- **S_IROTH (0004)**: Other read
- **S_IWOTH (0002)**: Other write
- **S_IXOTH (0001)**: Other execute

### Permission Checking Algorithm
1. **Root User**: All permissions granted (uid == 0)
2. **File Owner**: Check user permission bits (uid == file.uid)
3. **Group Member**: Check group permission bits (gid == file.gid or in supplementary groups)
4. **Other**: Check other permission bits

### chmod() - Change File Permissions

**Signature**: `int chmod(const char *pathname, mode_t mode)`

**Behavior**:
- Changes file permission bits
- Only owner or privileged process can change permissions
- Special bits may be cleared automatically in some cases
- Returns 0 on success, -1 on error

## Path Resolution

Path resolution converts pathname to file location through systematic component processing.

### Resolution Algorithm
1. Start at root (/) or current working directory
2. For each pathname component:
   - Look up name in current directory
   - Check permissions (execute for directories)
   - Follow symbolic links if encountered
   - Move to target location
3. Return final inode and remaining path

### Special Components
- **"."**: Current directory (no-op)
- **".."**: Parent directory
- **""**: Empty component (ignored)

### Symbolic Link Resolution
- Maximum 40 symbolic link resolutions per pathname
- Loop detection prevents infinite recursion
- Links can contain absolute or relative paths
- Relative links resolved from link's directory

### Trailing Slash Behavior
- Forces preceding component to be directory
- "/path/to/file/" fails if file is not directory
- "/path/to/dir/" succeeds if dir is directory

## Symbolic Links

Symbolic links provide transparent redirection during pathname resolution.

### symlink() - Create Symbolic Link

**Signature**: `int symlink(const char *target, const char *linkpath)`

**Behavior**:
- Creates symbolic link pointing to target path
- Target need not exist (dangling link allowed)
- Link contains target path string, not resolved path
- Returns 0 on success, -1 on error

### readlink() - Read Symbolic Link

**Signature**: `ssize_t readlink(const char *pathname, char *buf, size_t bufsiz)`

**Behavior**:
- Reads target path from symbolic link
- Does not append null terminator
- Returns number of bytes read, -1 on error
- Fails if pathname is not a symbolic link

### Link Resolution Rules
1. **Absolute Links**: Start resolution from root directory
2. **Relative Links**: Start resolution from link's directory
3. **".." in Links**: Resolved relative to link's directory
4. **Trailing Components**: Continue resolution after link expansion

## Error Handling

POSIX defines specific error codes (errno values) for filesystem operations:

### Common Error Codes
- **ENOENT (2)**: No such file or directory
- **EACCES (13)**: Permission denied
- **EEXIST (17)**: File exists
- **ENOTDIR (20)**: Not a directory
- **EISDIR (21)**: Is a directory
- **EINVAL (22)**: Invalid argument
- **EMFILE (24)**: Too many open files (per process)
- **ENFILE (23)**: Too many open files (system-wide)
- **ENOSPC (28)**: No space left on device
- **EROFS (30)**: Read-only file system
- **ENAMETOOLONG (36)**: File name too long
- **ELOOP (40)**: Too many symbolic links

### Error Handling Rules
1. **Atomic Operations**: Operations either complete fully or fail with no side effects
2. **Early Validation**: Check parameters and permissions before making changes
3. **Consistent State**: Filesystem remains in consistent state after any error
4. **Error Propagation**: Return appropriate error codes with descriptive messages

### File System Limits
- **NAME_MAX**: Maximum filename length (typically 255)
- **PATH_MAX**: Maximum pathname length (typically 4096)
- **LINK_MAX**: Maximum hard links to file (typically 65000)
- **SYMLINK_MAX**: Maximum symlink resolution depth (40)

This specification provides the foundation for implementing a POSIX-compliant virtual filesystem with proper behavior, error handling, and compatibility with existing POSIX systems.