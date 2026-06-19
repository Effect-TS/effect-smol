// `svelte-package` rewrites relative `.ts` import specifiers to `.js` in the
// emitted JavaScript, but leaves them untouched in the generated declaration
// files. Published declarations must not reference `.ts` paths (consumers hit
// TS5097), so rewrite relative `*.ts` specifiers to `*.js` across the emitted
// `.d.ts` files. `.svelte.ts` becomes `.svelte.js`, matching the runtime emit.
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const dist = fileURLToPath(new URL("../dist", import.meta.url))

const relativeTsImport = /(from\s+["']\.\.?\/[^"']+)\.ts(["'])/g

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(path)
    } else if (entry.name.endsWith(".d.ts")) {
      const source = await readFile(path, "utf8")
      const rewritten = source.replace(relativeTsImport, "$1.js$2")
      if (rewritten !== source) {
        await writeFile(path, rewritten)
      }
    }
  }
}

await walk(dist)
