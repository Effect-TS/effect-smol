import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterAll, describe, expect, it } from "vitest"

const workspaceRoot = resolve(import.meta.dirname, "../../../../")
const fixtureRoot = mkdtempSync(join(tmpdir(), "annotate-pure-"))

afterAll(() => {
  rmSync(fixtureRoot, { force: true, recursive: true })
})

function runAnnotation(name: string, source: string): string {
  const packageDir = join(fixtureRoot, name)
  const distDir = join(packageDir, "dist")
  mkdirSync(distDir, { recursive: true })
  writeFileSync(join(distDir, "index.js"), source)
  execFileSync("node", [join(workspaceRoot, "scripts/annotate-pure.mjs")], {
    cwd: packageDir,
    stdio: "inherit"
  })
  return readFileSync(join(distDir, "index.js"), "utf8")
}

describe("annotate-pure", () => {
  it("adds pure annotations to top-level call expressions", () => {
    const result = runAnnotation(
      "top-level-call",
      "const value = makeValue();\n"
    )
    expect(result).toContain("/* @__PURE__ */ makeValue()")
  })

  it("adds pure annotations to NewExpression", () => {
    const result = runAnnotation(
      "new-expression",
      "const instance = new MyClass();\n"
    )
    expect(result).toContain("/* @__PURE__ */ new MyClass()")
  })

  it("annotates class extends expressions", () => {
    const result = runAnnotation(
      "class-extends",
      "class Foo extends mixin(Base) {}\n"
    )
    expect(result).toContain("/* @__PURE__ */ mixin(Base)")
  })

  it("annotates export default call expression", () => {
    const result = runAnnotation(
      "export-default",
      "export default createThing();\n"
    )
    expect(result).toContain("/* @__PURE__ */ createThing()")
  })

  it("does not annotate calls inside non-IIFE functions", () => {
    const result = runAnnotation(
      "inside-function",
      "function foo() { return bar(); }\n"
    )
    expect(result).not.toContain("/* @__PURE__ */")
  })

  it("annotates calls inside IIFEs", () => {
    const result = runAnnotation(
      "iife",
      "const x = (() => foo())();\n"
    )
    expect(result).toContain("/* @__PURE__ */ (() => /* @__PURE__ */ foo())()")
  })

  it("does not double-annotate already pure-annotated calls", () => {
    const source = "const value = /* @__PURE__ */ makeValue();\n"
    const result = runAnnotation("already-annotated", source)
    const count = (result.match(/@__PURE__/g) || []).length
    expect(count).toBe(1)
  })

  it("annotates the outer call in a chained call, not the inner callee", () => {
    const result = runAnnotation(
      "call-as-callee",
      "const x = factory()();\n"
    )
    // Both calls share start position, so one annotation covers the outer call
    expect(result).toContain("/* @__PURE__ */ factory()()")
  })

  it("annotates multiple independent calls", () => {
    const result = runAnnotation(
      "multiple-calls",
      "const a = foo();\nconst b = bar();\n"
    )
    expect(result).toContain("/* @__PURE__ */ foo()")
    expect(result).toContain("/* @__PURE__ */ bar()")
  })

  it("updates source map to reflect inserted annotations", () => {
    const name = "sourcemap-update"
    const packageDir = join(fixtureRoot, name)
    const distDir = join(packageDir, "dist")
    const sourceMap = {
      version: 3,
      file: "index.js",
      names: ["value", "makeValue"],
      sources: ["../src/index.ts"],
      sourcesContent: ["const value = makeValue()\n"],
      mappings: "AAAA,MAAM,CAACA,KAAK,GAAGC,SAAS,EAAE"
    }

    mkdirSync(distDir, { recursive: true })
    writeFileSync(
      join(distDir, "index.js"),
      [
        "const value = makeValue();",
        "//# sourceMappingURL=index.js.map",
        ""
      ].join("\n")
    )
    writeFileSync(join(distDir, "index.js.map"), JSON.stringify(sourceMap))

    execFileSync("node", [join(workspaceRoot, "scripts/annotate-pure.mjs")], {
      cwd: packageDir,
      stdio: "inherit"
    })

    const code = readFileSync(join(distDir, "index.js"), "utf8")
    expect(code).toContain("/* @__PURE__ */ makeValue()")

    const updatedMap = JSON.parse(readFileSync(join(distDir, "index.js.map"), "utf8"))
    // Map should still point to the original .ts source
    expect(updatedMap.sources).toContain("../src/index.ts")
    // Mappings should have changed to account for the inserted comment
    expect(updatedMap.mappings).not.toBe(sourceMap.mappings)
  })

  it("preserves sourceMappingURL comment in output", () => {
    const result = runAnnotation(
      "sourcemap-url",
      "const value = makeValue();\n//# sourceMappingURL=index.js.map\n"
    )
    expect(result).toContain("//# sourceMappingURL=index.js.map")
    expect(result).toContain("/* @__PURE__ */ makeValue()")
  })

  it("skips empty files", () => {
    const result = runAnnotation("empty-file", "   \n")
    expect(result).toBe("   \n")
  })

  it("handles assignment expressions", () => {
    const result = runAnnotation(
      "assignment",
      "let x;\nx = makeValue();\n"
    )
    expect(result).toContain("/* @__PURE__ */ makeValue()")
  })

  it("leaves .js.map untouched when no annotations are needed", () => {
    const name = "no-annotations"
    const packageDir = join(fixtureRoot, name)
    const distDir = join(packageDir, "dist")
    const sourceMap = JSON.stringify({
      version: 3,
      file: "index.js",
      names: [],
      sources: ["../src/index.ts"],
      sourcesContent: ["export const x = 1\n"],
      mappings: "AAAA"
    })

    mkdirSync(distDir, { recursive: true })
    writeFileSync(join(distDir, "index.js"), "export const x = 1;\n")
    writeFileSync(join(distDir, "index.js.map"), sourceMap)

    execFileSync("node", [join(workspaceRoot, "scripts/annotate-pure.mjs")], {
      cwd: packageDir,
      stdio: "inherit"
    })

    // No annotations means map should be untouched
    expect(readFileSync(join(distDir, "index.js.map"), "utf8")).toBe(sourceMap)
  })
})
