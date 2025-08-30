import * as Effect from "../../../../src/Effect.js"
import * as Layer from "../../../../src/Layer.js"
import * as FileSystem from "../../../../src/platform/FileSystem.js"
import * as Path from "../../../../src/platform/Path.js"

// Create mock implementations for testing CLI commands
export const MockFileSystem = Layer.succeed(FileSystem.FileSystem, FileSystem.make({
  access: () => Effect.succeed(),
  copy: () => Effect.succeed(),
  copyFile: () => Effect.succeed(),
  chmod: () => Effect.succeed(),
  chown: () => Effect.succeed(),
  exists: () => Effect.succeed(true),
  link: () => Effect.succeed(),
  makeDirectory: () => Effect.succeed(),
  makeTempDirectory: () => Effect.succeed("/tmp/test"),
  makeTempDirectoryScoped: () => Effect.succeed("/tmp/test"),
  makeTempFile: () => Effect.succeed("/tmp/test.txt"),
  makeTempFileScoped: () => Effect.succeed("/tmp/test.txt"),
  open: () => Effect.succeed({} as any),
  readDirectory: () => Effect.succeed([]),
  readFile: () => Effect.succeed(new Uint8Array()),
  readFileString: () => Effect.succeed(""),
  readLink: () => Effect.succeed(""),
  realPath: (path: string) => Effect.succeed(path),
  remove: () => Effect.succeed(),
  rename: () => Effect.succeed(),
  sink: () => Effect.succeed({} as any),
  stat: () => Effect.succeed({} as any),
  stream: () => Effect.succeed({} as any),
  symlink: () => Effect.succeed(),
  truncate: () => Effect.succeed(),
  utimes: () => Effect.succeed(),
  watch: () => Effect.succeed({} as any),
  writeFile: () => Effect.succeed(),
  writeFileString: () => Effect.succeed()
}))

export const MockPath = Layer.succeed(Path.Path, Path.make({
  basename: (path: string) => path.split("/").pop() || "",
  dirname: (path: string) => path.split("/").slice(0, -1).join("/") || "/",
  extname: (path: string) => {
    const parts = path.split(".")
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : ""
  },
  format: ({ dir, name, ext }) => `${dir}/${name}${ext || ""}`,
  fromFileUrl: (url: URL) => url.pathname,
  isAbsolute: (path: string) => path.startsWith("/"),
  join: (...paths: string[]) => paths.join("/"),
  normalize: (path: string) => path,
  parse: (path: string) => ({
    dir: path.split("/").slice(0, -1).join("/") || "/",
    name: path.split("/").pop()?.split(".").slice(0, -1).join(".") || "",
    ext: path.split(".").pop() || "",
    base: path.split("/").pop() || "",
    root: "/"
  }),
  relative: (from: string, to: string) => to,
  resolve: (...paths: string[]) => paths.join("/"),
  sep: "/",
  toFileUrl: (path: string) => new URL(`file://${path}`)
}))

export const MockEnvironmentLayer = Layer.mergeAll(MockFileSystem, MockPath)