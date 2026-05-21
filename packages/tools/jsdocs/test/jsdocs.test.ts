import { extractJSDocsSync, parseJSDoc } from "@effect/jsdocs"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { describe, expect, it } from "vitest"

describe("jsdocs", () => {
  it("parses a raw JSDoc block", () => {
    const result = parseJSDoc(`/**
 * Creates a value.
 *
 * @category constructors
 * @since 1.0.0
 */`)
    expect(result._tag).toBe("Success")
    if (result._tag === "Success") {
      expect(result.value.description.short).toBe("Creates a value.")
    }
  })

  it("extracts docs with TypeScript", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "jsdocs-"))
    fs.mkdirSync(path.join(cwd, "src"), { recursive: true })
    fs.writeFileSync(
      path.join(cwd, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022" },
        include: ["src/**/*.ts"]
      })
    )
    fs.writeFileSync(
      path.join(cwd, "package.json"),
      JSON.stringify({
        name: "@effect/sample",
        type: "module",
        exports: { ".": "./src/index.ts", "./*": "./src/*.ts" }
      })
    )
    fs.writeFileSync(path.join(cwd, "src/index.ts"), `export * as Foo from "./Foo.ts"\n`)
    fs.writeFileSync(
      path.join(cwd, "src/Foo.ts"),
      `/**
 * Creates a value.
 *
 * @category constructors
 * @since 1.0.0
 */
export const makeValue = () => 1
`
    )
    const model = extractJSDocsSync({
      cwd,
      tsconfig: "tsconfig.json",
      include: ["src/**/*.ts"],
      output: ".data/jsdocs.json"
    })
    expect(model.files).toHaveLength(1)
    expect(model.files[0]?.declarations[0]?.name).toBe("makeValue")
  })
})
