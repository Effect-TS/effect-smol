import { Effect, Layer } from "effect"
import { FileSystem } from "effect/platform"
import * as Path from "effect/platform/Path"
import { Stream } from "effect/stream"

// Create mock implementations for testing CLI commands
export const MockFileSystem = Layer.mock(FileSystem.FileSystem)(FileSystem.make({
  access: () => Effect.succeed(void 0),
  copy: () => Effect.die("Not implemented"),
  copyFile: () => Effect.die("Not implemented"),
  chmod: () => Effect.die("Not implemented"),
  chown: () => Effect.die("Not implemented"),
  link: () => Effect.die("Not implemented"),
  makeDirectory: () => Effect.die("Not implemented"),
  makeTempDirectory: () => Effect.succeed("/tmp/test"),
  makeTempDirectoryScoped: () => Effect.succeed("/tmp/test"),
  makeTempFile: () => Effect.succeed("/tmp/test.txt"),
  makeTempFileScoped: () => Effect.succeed("/tmp/test.txt"),
  open: () => Effect.die("Not implemented"),
  readDirectory: () => Effect.succeed([]),
  readFile: () => Effect.succeed(new Uint8Array()),
  readLink: () => Effect.succeed(""),
  realPath: (path: string) => Effect.succeed(path),
  remove: () => Effect.die("Not implemented"),
  rename: () => Effect.die("Not implemented"),
  stat: (path) => Effect.succeed({ type: path.match(/\.[a-z]+$/) ? "File" : "Directory" } as FileSystem.File.Info),
  symlink: () => Effect.die("Not implemented"),
  truncate: () => Effect.die("Not implemented"),
  utimes: () => Effect.die("Not implemented"),
  writeFile: () => Effect.die("Not implemented"),
  watch: () => Stream.die("Not implemented")
}))

export const MockPath = Layer.mock(Path.Path)({
  basename: (path: string) => path.split("/").pop() || "",
  dirname: (path: string) => path.split("/").slice(0, -1).join("/") || "/",
  extname: (path: string) => {
    const parts = path.split(".")
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : ""
  },
  format: ({ dir, ext, name }: { dir?: string; ext?: string; name?: string }) => `${dir}/${name}${ext || ""}`,
  fromFileUrl: (url: URL) => Effect.succeed(url.pathname),
  isAbsolute: (path: string) => path.startsWith("/"),
  join: (...paths: Array<string>) => paths.join("/"),
  normalize: (path: string) => path,
  parse: (path: string) => ({
    dir: path.split("/").slice(0, -1).join("/") || "/",
    name: path.split("/").pop()?.split(".").slice(0, -1).join(".") || "",
    ext: path.split(".").pop() || "",
    base: path.split("/").pop() || "",
    root: "/"
  }),
  relative: (from: string, to: string) => to,
  resolve: (...paths: Array<string>) => paths.join("/"),
  sep: "/",
  toFileUrl: (path: string) => Effect.succeed(new URL(`file://${path}`))
} as any as Path.Path)

export const MockEnvironmentLayer = Layer.mergeAll(MockFileSystem, Path.layer)
