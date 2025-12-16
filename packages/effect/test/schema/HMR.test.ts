import { describe, expect, it, vi } from "vitest"

const SCHEMA_MODULE_PATH = "../../src/schema/Schema.ts"

describe("HMR", () => {
  it("sanity check: reload produces distinct constructors", async () => {
    const PATH = "./fixtures/HRM.ts"
    const mod1: any = await vi.importActual(PATH)
    vi.resetModules()
    const mod2: any = await vi.importActual(PATH)

    const a = new mod1.A("a")
    expect(a instanceof mod1.A).toBe(true)

    expect(a instanceof mod2.A).toBe(false)
  })

  it("isAST", async () => {
    const AST_MODULE_PATH = "../../src/schema/AST.ts"
    const mod1: any = await vi.importActual(AST_MODULE_PATH)
    vi.resetModules()
    const mod2: any = await vi.importActual(AST_MODULE_PATH)

    const isAST = mod1.isAST

    const b = mod2.unknown

    expect(isAST(b)).toBe(true)
  })

  it("isSchema", async () => {
    const mod1: any = await vi.importActual(SCHEMA_MODULE_PATH)
    vi.resetModules()
    const mod2: any = await vi.importActual(SCHEMA_MODULE_PATH)

    const isSchema = mod1.isSchema

    const schema = mod2.Unknown

    expect(isSchema(schema)).toBe(true)
  })

  it("Schema.Class", async () => {
    const PATH = "./fixtures/Class.ts"
    const mod1: any = await vi.importActual(PATH)
    vi.resetModules()
    const mod2: any = await vi.importActual(PATH)
    const schema: any = await vi.importActual(SCHEMA_MODULE_PATH)

    const a = new mod1.A({ a: "a" })
    expect(a instanceof mod1.A).toBe(true)

    const b = new mod2.A({ a: "a" })

    expect(b instanceof mod1.A).toBe(false)
    expect(String(schema.encodeUnknownExit(mod1.A)(b))).toBe(`Success({"a":"a"})`)
  })
})
