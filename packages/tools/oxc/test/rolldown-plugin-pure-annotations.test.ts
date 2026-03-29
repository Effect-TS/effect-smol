import { parseSync } from "oxc-parser"
import { describe, expect, it } from "vitest"
import { collectAnnotationPositions, pureAnnotations, setParents } from "../src/rolldown-plugin-pure-annotations.ts"

/**
 * Helper: parse source code, set parent pointers, and return the collected
 * annotation positions together with the annotated source string.
 */
function annotate(source: string): string {
  const result = parseSync("test.ts", source, { sourceType: "module" }) as any
  const program = result.program
  setParents(program, null)
  const positions = collectAnnotationPositions(program, source)
  // positions are sorted descending, so inserting from right to left preserves offsets
  let out = source
  for (const pos of positions) {
    out = out.slice(0, pos) + "/* @__PURE__ */ " + out.slice(pos)
  }
  return out
}

describe("rolldown-plugin-pure-annotations", () => {
  it("annotates basic variable assignment call expression", () => {
    const input = "const x = foo()"
    const output = annotate(input)
    expect(output).toBe("const x = /* @__PURE__ */ foo()")
  })

  it("annotates NewExpression", () => {
    const input = "const x = new Foo()"
    const output = annotate(input)
    expect(output).toBe("const x = /* @__PURE__ */ new Foo()")
  })

  it("annotates class extends", () => {
    const input = "class Foo extends bar() {}"
    const output = annotate(input)
    expect(output).toBe("class Foo extends /* @__PURE__ */ bar() {}")
  })

  it("skips calls inside functions (not executed during initialization)", () => {
    const input = "function f() { return bar() }"
    const output = annotate(input)
    expect(output).toBe(input)
  })

  it("annotates IIFE and inner call", () => {
    const input = "const x = (() => foo())()"
    const output = annotate(input)
    // The IIFE call itself and the inner foo() call should both be annotated
    expect(output).toContain("/* @__PURE__ */")
    // The inner foo() should be annotated
    expect(output).toContain("/* @__PURE__ */ foo()")
    // The outer IIFE should also be annotated
    expect(output).toContain("/* @__PURE__ */ (() =>")
  })

  it("does not double-annotate already annotated code", () => {
    const input = "const x = /* @__PURE__ */ foo()"
    const output = annotate(input)
    // Should not add another annotation
    expect(output).toBe(input)
  })

  it("handles #__PURE__ annotation too", () => {
    const input = "const x = /* #__PURE__ */ foo()"
    const output = annotate(input)
    expect(output).toBe(input)
  })

  it("only annotates outer call in factory()() pattern (callee skipping)", () => {
    const input = "const x = factory()()"
    const output = annotate(input)
    // factory() is the callee of the outer call, so only the outer call is annotated
    // The outer call starts at "factory", the inner factory() is used as callee
    expect(output).toBe("const x = /* @__PURE__ */ factory()()")
  })

  it("annotates export default", () => {
    const input = "export default foo()"
    const output = annotate(input)
    expect(output).toBe("export default /* @__PURE__ */ foo()")
  })

  it("annotates assignment expression", () => {
    const input = "let x; x = foo()"
    const output = annotate(input)
    expect(output).toContain("/* @__PURE__ */ foo()")
  })

  it("does not annotate bare call expressions (not in assignment context)", () => {
    const input = "foo()"
    const output = annotate(input)
    expect(output).toBe(input)
  })

  it("annotates multiple declarations", () => {
    const input = "const a = foo(); const b = bar()"
    const output = annotate(input)
    expect(output).toBe(
      "const a = /* @__PURE__ */ foo(); const b = /* @__PURE__ */ bar()"
    )
  })

  it("annotates new expression in class declaration", () => {
    const input = "class Foo extends new Bar() {}"
    const output = annotate(input)
    expect(output).toContain("/* @__PURE__ */ new Bar()")
  })

  describe("plugin filtering", () => {
    const callTransform = (code: string, id: string) => {
      const plugin = pureAnnotations()
      const transform = (plugin as any).transform as (
        code: string,
        id: string
      ) => { code: string; map: unknown } | null
      return transform(code, id)
    }

    it("skips node_modules", () => {
      const result = callTransform(
        "const x = foo()",
        "/path/node_modules/foo.js"
      )
      expect(result).toBeNull()
    })

    it("skips non-JS files", () => {
      const result = callTransform("const x = foo()", "/path/data.json")
      expect(result).toBeNull()
    })

    it("processes .ts files", () => {
      const result = callTransform("const x = foo()", "/path/file.ts")
      expect(result).not.toBeNull()
      expect(result!.code).toContain("/* @__PURE__ */")
    })

    it("processes .jsx files", () => {
      const result = callTransform("const x = foo()", "/path/file.jsx")
      expect(result).not.toBeNull()
      expect(result!.code).toContain("/* @__PURE__ */")
    })
  })
})
