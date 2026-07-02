/**
 * Experimental compiler for Schema validators.
 *
 * @since 4.0.0
 */

import * as Number_ from "./Number.ts"
import * as Schema from "./Schema.ts"
import * as SchemaAST from "./SchemaAST.ts"
import * as SchemaParser from "./SchemaParser.ts"

/**
 * Error thrown when a schema cannot be compiled into a predicate.
 *
 * **When to use**
 *
 * Use when you need to distinguish an unsupported schema compiler input from
 * validation failures produced by a compiled predicate.
 *
 * **Details**
 *
 * `path` identifies the AST location that could not be compiled, `tag`
 * contains the AST node tag at that location, and `reason` describes the
 * unsupported construct.
 *
 * @category errors
 * @since 4.0.0
 */
export class CompilationError extends Error {
  readonly _tag = "CompilationError"
  readonly path: string
  readonly tag: string
  readonly reason: string

  constructor(options: {
    readonly path: string
    readonly tag: string
    readonly reason: string
  }) {
    super(`Cannot compile schema at ${options.path} (${options.tag}): ${options.reason}`)
    this.name = "SchemaCompiler.CompilationError"
    this.path = options.path
    this.tag = options.tag
    this.reason = options.reason
  }
}

/**
 * Options for {@link compileTypeGuard}.
 *
 * @category models
 * @since 4.0.0
 */
export interface CompileTypeGuardOptions {
  /**
   * Rejects object properties not declared by the schema.
   *
   * @since 4.0.0
   */
  readonly strict?: boolean | undefined

  /**
   * Assumes inputs are plain data values, such as values produced by
   * `JSON.parse`.
   *
   * **Details**
   *
   * When enabled, generated checks may use enumerable string keys and skip
   * checks for symbols, non-enumerable properties, accessors, and prototype
   * pollution.
   *
   * @since 4.0.0
   */
  readonly simpleInputs?: boolean | undefined
}

/**
 * Compiles a schema into a cached type guard.
 *
 * **When to use**
 *
 * Use when you need to validate many values against the same schema and only
 * need a boolean type-side result.
 *
 * **Details**
 *
 * The compiler validates `Schema.toType(schema)`, so transformations,
 * decoding, encoding, parse output, and parse diagnostics are not part of the
 * generated predicate. Successful compiles are cached by the type-side AST
 * object and option set. Pass `strict: true` to reject object properties not
 * declared by the schema. Pass `simpleInputs: true` when all inputs are plain
 * data values, such as values produced by `JSON.parse`, to enable faster
 * generated checks. Custom filters and declarations are called through
 * captured runtime references when they cannot be compiled to direct
 * JavaScript checks.
 *
 * **Gotchas**
 *
 * This API uses runtime code generation through `Function`. It can fail in
 * environments that block eval-like code generation through Content Security
 * Policy or equivalent runtime restrictions.
 *
 * @category compilers
 * @since 4.0.0
 */
export function compileTypeGuard<S extends Schema.Top>(
  schema: S,
  options?: CompileTypeGuardOptions
): (input: unknown) => input is S["Type"] {
  const ast = Schema.toType(schema).ast
  const compilerOptions: CompilerOptions = {
    simpleInputs: options?.simpleInputs === true,
    strict: options?.strict === true
  }
  const selectedCache = cacheForOptions(compilerOptions)
  const cached = selectedCache.get(ast)
  if (cached) {
    return cached as (input: unknown) => input is S["Type"]
  }
  const predicate = new Compiler(compilerOptions).compile(ast)
  selectedCache.set(ast, predicate)
  return predicate as (input: unknown) => input is S["Type"]
}

const defaultCache = new WeakMap<SchemaAST.AST, (input: unknown) => boolean>()
const simpleInputsCache = new WeakMap<SchemaAST.AST, (input: unknown) => boolean>()
const strictCache = new WeakMap<SchemaAST.AST, (input: unknown) => boolean>()
const strictSimpleInputsCache = new WeakMap<SchemaAST.AST, (input: unknown) => boolean>()

const numberStringRegExp = new globalThis.RegExp(`(?:${SchemaAST.FINITE_PATTERN}|Infinity|-Infinity|NaN)`)

interface CompilerOptions {
  readonly simpleInputs: boolean
  readonly strict: boolean
}

function cacheForOptions(options: CompilerOptions): WeakMap<SchemaAST.AST, (input: unknown) => boolean> {
  if (options.strict) {
    return options.simpleInputs ? strictSimpleInputsCache : strictCache
  }
  return options.simpleInputs ? simpleInputsCache : defaultCache
}

class Compiler {
  private readonly refs: Array<unknown> = []
  private readonly names = new WeakMap<SchemaAST.AST, string>()
  private readonly bodies: Array<string> = []
  private readonly options: CompilerOptions
  private nextName = 0
  private nextVar = 0

  constructor(options: CompilerOptions) {
    this.options = options
  }

  compile(ast: SchemaAST.AST): (input: unknown) => boolean {
    const root = this.ensure(ast, "$")
    const source = `${this.bodies.join("\n")}\nreturn ${root}`
    return new globalThis.Function("refs", source)(this.refs) as (input: unknown) => boolean
  }

  private ensure(ast: SchemaAST.AST, path: string): string {
    const existing = this.names.get(ast)
    if (existing) {
      return existing
    }
    const name = `f${this.nextName++}`
    this.names.set(ast, name)
    const body = this.emitBody(ast, path)
    this.bodies.push(`function ${name}(input) {\n${body}\n}`)
    return name
  }

  private emitBody(ast: SchemaAST.AST, path: string): string {
    switch (ast._tag) {
      case "Null":
        return this.returnWithChecks(ast, "input === null", path)
      case "Undefined":
      case "Void":
        return this.returnWithChecks(ast, "input === undefined", path)
      case "Never":
        return "return false"
      case "Any":
      case "Unknown":
        return this.returnWithChecks(ast, "true", path)
      case "ObjectKeyword":
        return this.returnWithChecks(
          ast,
          `((typeof input === "object" && input !== null) || typeof input === "function")`,
          path
        )
      case "String":
        return this.returnWithChecks(ast, `typeof input === "string"`, path)
      case "Number":
        return this.returnWithChecks(ast, `typeof input === "number"`, path)
      case "Boolean":
        return this.returnWithChecks(ast, `typeof input === "boolean"`, path)
      case "Symbol":
        return this.returnWithChecks(ast, `typeof input === "symbol"`, path)
      case "BigInt":
        return this.returnWithChecks(ast, `typeof input === "bigint"`, path)
      case "Literal":
        return this.returnWithChecks(ast, `input === ${this.literal(ast.literal)}`, path)
      case "UniqueSymbol":
        return this.returnWithChecks(ast, `input === ${this.ref(ast.symbol)}`, path)
      case "Enum":
        return this.returnWithChecks(ast, `${this.ref(new Set(ast.enums.map(([, value]) => value)))}.has(input)`, path)
      case "TemplateLiteral":
        return this.returnWithChecks(
          ast,
          `typeof input === "string" && ${this.ref(SchemaAST.getTemplateLiteralRegExp(ast))}.test(input)`,
          path
        )
      case "Arrays":
        return this.emitArray(ast, path)
      case "Objects":
        return this.emitObject(ast, path)
      case "Union":
        return this.emitUnion(ast, path)
      case "Suspend":
        return this.returnWithChecks(ast, `${this.ensure(ast.thunk(), `${path}.thunk()`)}(input)`, path)
      case "Declaration":
        return `return ${this.ref(SchemaParser._is(ast))}(input)`
      default:
        throw new CompilationError({
          path,
          tag: (ast as { readonly _tag?: string })._tag ?? "<unknown>",
          reason: "unsupported AST node"
        })
    }
  }

  private emitArray(ast: SchemaAST.Arrays, path: string): string {
    const lines: Array<string> = [
      "if (!Array.isArray(input)) return false",
      "const len = input.length"
    ]
    const elementLen = ast.elements.length
    for (let i = 0; i < elementLen; i++) {
      const element = ast.elements[i]
      const value = this.variable()
      lines.push(`if (${i} < len) {`)
      lines.push(`const ${value} = input[${i}]`)
      lines.push(
        `if (!(${this.callExpression(element, value, `${path}.elements[${i}]`)})) return false`
      )
      lines.push(`} else if (${SchemaAST.isOptional(element) ? "false" : "true"}) return false`)
    }
    if (ast.rest.length === 0) {
      lines.push(`if (len > ${elementLen}) return false`)
    } else {
      const [head, ...tail] = ast.rest
      const tailThreshold = tail.length > 0 ? this.variable() : undefined
      if (tailThreshold) {
        lines.push(`const ${tailThreshold} = Math.max(${elementLen}, len - ${tail.length})`)
      }
      if (head) {
        const index = this.variable()
        const value = this.variable()
        if (tailThreshold) {
          lines.push(`for (let ${index} = ${elementLen}; ${index} < ${tailThreshold}; ${index}++) {`)
        } else {
          lines.push(`for (let ${index} = ${elementLen}; ${index} < len; ${index}++) {`)
        }
        lines.push(`const ${value} = input[${index}]`)
        lines.push(`if (!(${this.callExpression(head, value, `${path}.rest[0]`)})) return false`)
        lines.push("}")
      }
      for (let i = 0; i < tail.length; i++) {
        const element = tail[i]
        const index = this.variable()
        const value = this.variable()
        lines.push(`const ${index} = ${tailThreshold} + ${i}`)
        lines.push(`if (${index} < len) {`)
        lines.push(`const ${value} = input[${index}]`)
        lines.push(
          `if (!(${this.callExpression(element, value, `${path}.rest[${i + 1}]`)})) return false`
        )
        lines.push(`} else if (${SchemaAST.isOptional(element) ? "false" : "true"}) return false`)
      }
    }
    lines.push(this.returnChecks(ast, path))
    return lines.join("\n")
  }

  private emitObject(ast: SchemaAST.Objects, path: string): string {
    if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
      return this.returnWithChecks(ast, "input !== null && input !== undefined", path)
    }
    const lines: Array<string> = [
      `if (!(typeof input === "object" && input !== null && !Array.isArray(input))) return false`
    ]
    if (this.canUsePlainObjectFastPath(ast)) {
      const condition = this.plainObjectFastPathCondition(ast, "input")
      if (condition) {
        lines.push(`if (${condition}) {`)
      }
      this.pushFastPathPropertyChecks(lines, ast, path)
      this.pushExcessPropertyCheck(lines, ast, "input")
      lines.push(this.returnChecks(ast, path))
      if (!condition) {
        return lines.join("\n")
      }
      lines.push("}")
    }
    for (let i = 0; i < ast.propertySignatures.length; i++) {
      const ps = ast.propertySignatures[i]
      const key = this.propertyKey(ps.name)
      const value = this.variable()
      lines.push(`if (Object.hasOwn(input, ${key})) {`)
      lines.push(`const ${value} = ${this.propertyAccess("input", ps.name)}`)
      lines.push(
        `if (!(${
          this.callExpression(ps.type, value, `${path}.fields[${this.formatPropertyKey(ps.name)}]`)
        })) return false`
      )
      lines.push(`} else if (${SchemaAST.isOptional(ps.type) ? "false" : "true"}) return false`)
    }
    for (let i = 0; i < ast.indexSignatures.length; i++) {
      const index = ast.indexSignatures[i]
      const keys = this.variable()
      const cursor = this.variable()
      const key = this.variable()
      const value = this.variable()
      lines.push(`const ${keys} = ${this.indexKeysExpression(index.parameter)}(input)`)
      lines.push(`for (let ${cursor} = 0; ${cursor} < ${keys}.length; ${cursor}++) {`)
      lines.push(`const ${key} = ${keys}[${cursor}]`)
      const keyPredicate = this.indexKeyPredicate(index.parameter)
      if (keyPredicate) {
        lines.push(`if (!${keyPredicate}(${key})) return false`)
      }
      lines.push(`const ${value} = input[${key}]`)
      lines.push(
        `if (!(${this.callExpression(index.type, value, `${path}.indexSignatures[${i}].type`)})) return false`
      )
      lines.push("}")
    }
    this.pushExcessPropertyCheck(lines, ast, "input")
    lines.push(this.returnChecks(ast, path))
    return lines.join("\n")
  }

  private emitUnion(ast: SchemaAST.Union, path: string): string {
    const discriminator = this.getDiscriminator(ast)
    if (discriminator) {
      const lines: Array<string> = [
        `if (!(typeof input === "object" && input !== null && !Array.isArray(input))) return false`,
        `switch (input[${this.propertyKey(discriminator.key)}]) {`
      ]
      for (let i = 0; i < discriminator.cases.length; i++) {
        const c = discriminator.cases[i]
        const casePath = `${path}.types[${c.index}]`
        const caseLines = this.emitDiscriminatorCase(c.ast, casePath, discriminator.key)
        lines.push(`case ${this.discriminatorLiteral(c.literal)}:`)
        if (caseLines) {
          lines.push(...caseLines)
        } else {
          lines.push(`if (!(${this.callExpression(c.ast, "input", casePath)})) return false`)
        }
        lines.push("break")
      }
      lines.push("default:")
      lines.push("return false")
      lines.push("}")
      lines.push(this.returnChecks(ast, path))
      return lines.join("\n")
    }

    if (ast.mode === "oneOf") {
      const count = this.variable()
      const lines: Array<string> = [`let ${count} = 0`]
      for (let i = 0; i < ast.types.length; i++) {
        lines.push(`if (${this.callExpression(ast.types[i], "input", `${path}.types[${i}]`)}) ${count}++`)
      }
      lines.push(`if (${count} !== 1) return false`)
      lines.push(this.returnChecks(ast, path))
      return lines.join("\n")
    }

    const expression = ast.types.map((type, i) => this.callExpression(type, "input", `${path}.types[${i}]`)).join(
      " || "
    )
    if (expression.length === 0) {
      return "return false"
    }
    return this.returnWithChecks(ast, `(${expression})`, path)
  }

  private emitDiscriminatorCase(
    ast: SchemaAST.AST,
    path: string,
    discriminatorKey: PropertyKey
  ): Array<string> | undefined {
    if (ast._tag !== "Objects" || ast.indexSignatures.length > 0) {
      return undefined
    }
    const lines: Array<string> = []
    if (this.canUsePlainObjectFastPath(ast)) {
      const condition = this.plainObjectFastPathCondition(ast, "input")
      if (condition) {
        lines.push(`if (${condition}) {`)
      }
      this.pushFastPathPropertyChecks(lines, ast, path, discriminatorKey)
      this.pushExcessPropertyCheck(lines, ast, "input")
      this.pushChecks(lines, ast, "input", path)
      if (condition) {
        lines.push("} else {")
        this.pushObjectOwnPropertyChecks(lines, ast, path)
        lines.push("}")
      }
    } else {
      this.pushObjectOwnPropertyChecks(lines, ast, path)
    }
    return lines
  }

  private pushFastPathPropertyChecks(
    lines: Array<string>,
    ast: SchemaAST.Objects,
    path: string,
    skipKey?: PropertyKey
  ): void {
    for (let i = 0; i < ast.propertySignatures.length; i++) {
      const ps = ast.propertySignatures[i]
      if (ps.name === skipKey) {
        continue
      }
      const value = this.variable()
      lines.push(`const ${value} = ${this.propertyAccess("input", ps.name)}`)
      lines.push(
        `if (!(${
          this.fastPathPropertyExpression(
            ps,
            value,
            `${path}.fields[${this.formatPropertyKey(ps.name)}]`
          )
        })) return false`
      )
    }
  }

  private pushObjectOwnPropertyChecks(lines: Array<string>, ast: SchemaAST.Objects, path: string): void {
    for (let i = 0; i < ast.propertySignatures.length; i++) {
      const ps = ast.propertySignatures[i]
      const key = this.propertyKey(ps.name)
      const value = this.variable()
      lines.push(`if (Object.hasOwn(input, ${key})) {`)
      lines.push(`const ${value} = ${this.propertyAccess("input", ps.name)}`)
      lines.push(
        `if (!(${
          this.callExpression(ps.type, value, `${path}.fields[${this.formatPropertyKey(ps.name)}]`)
        })) return false`
      )
      lines.push(`} else if (${SchemaAST.isOptional(ps.type) ? "false" : "true"}) return false`)
    }
    this.pushExcessPropertyCheck(lines, ast, "input")
    this.pushChecks(lines, ast, "input", path)
  }

  private pushChecks(lines: Array<string>, ast: SchemaAST.AST, value: string, path: string): void {
    const checks = this.checksExpression(ast.checks, value, ast, `${path}.checks`)
    if (checks) {
      lines.push(`if (!(${checks})) return false`)
    }
  }

  private callExpression(ast: SchemaAST.AST, value: string, path: string): string {
    return this.validationExpression(ast, value, path) ?? `${this.ensure(ast, path)}(${value})`
  }

  private validationExpression(ast: SchemaAST.AST, value: string, path: string): string | undefined {
    let expression: string | undefined
    switch (ast._tag) {
      case "Null":
        expression = `${value} === null`
        break
      case "Undefined":
      case "Void":
        expression = `${value} === undefined`
        break
      case "Never":
        expression = "false"
        break
      case "Any":
      case "Unknown":
        expression = "true"
        break
      case "ObjectKeyword":
        expression = `((typeof ${value} === "object" && ${value} !== null) || typeof ${value} === "function")`
        break
      case "String":
        expression = `typeof ${value} === "string"`
        break
      case "Number":
        expression = `typeof ${value} === "number"`
        break
      case "Boolean":
        expression = `typeof ${value} === "boolean"`
        break
      case "Symbol":
        expression = `typeof ${value} === "symbol"`
        break
      case "BigInt":
        expression = `typeof ${value} === "bigint"`
        break
      case "Literal":
        expression = `${value} === ${this.literal(ast.literal)}`
        break
      case "UniqueSymbol":
        expression = `${value} === ${this.ref(ast.symbol)}`
        break
      case "Enum":
        expression = `${this.ref(new Set(ast.enums.map(([, value]) => value)))}.has(${value})`
        break
      case "TemplateLiteral":
        expression = `typeof ${value} === "string" && ${
          this.ref(SchemaAST.getTemplateLiteralRegExp(ast))
        }.test(${value})`
        break
      case "Objects":
        expression = this.objectExpression(ast, value, path)
        break
      case "Suspend":
        expression = `${this.ensure(ast.thunk(), `${path}.thunk()`)}(${value})`
        break
      case "Declaration":
        expression = `${this.ref(SchemaParser._is(ast))}(${value})`
        break
    }
    return expression ? this.withChecksExpression(ast, expression, value, path) : undefined
  }

  private objectExpression(ast: SchemaAST.Objects, value: string, path: string): string | undefined {
    if (ast.indexSignatures.length > 0) {
      return undefined
    }
    if (ast.propertySignatures.length === 0) {
      return `${value} !== null && ${value} !== undefined`
    }
    const objectExpression = `typeof ${value} === "object" && ${value} !== null && !Array.isArray(${value})`
    const slowExpressions: Array<string> = [objectExpression]
    const fastPathCondition = this.plainObjectFastPathCondition(ast, value)
    const fastExpressions: Array<string> = [objectExpression]
    if (fastPathCondition) {
      fastExpressions.push(fastPathCondition)
    }
    for (let i = 0; i < ast.propertySignatures.length; i++) {
      const ps = ast.propertySignatures[i]
      const key = this.propertyKey(ps.name)
      const hasOwn = `Object.hasOwn(${value}, ${key})`
      const field = this.propertyAccess(value, ps.name)
      const fieldExpression = this.callExpression(ps.type, field, `${path}.fields[${this.formatPropertyKey(ps.name)}]`)
      slowExpressions.push(
        SchemaAST.isOptional(ps.type) ? `(!${hasOwn} || (${fieldExpression}))` : `${hasOwn} && (${fieldExpression})`
      )
      fastExpressions.push(
        this.fastPathPropertyExpression(ps, field, `${path}.fields[${this.formatPropertyKey(ps.name)}]`)
      )
    }
    const excessPropertyExpression = this.strictExcessPropertyExpression(ast, value)
    if (excessPropertyExpression) {
      slowExpressions.push(excessPropertyExpression)
      fastExpressions.push(excessPropertyExpression)
    }
    const slowExpression = slowExpressions.map((expression) => `(${expression})`).join(" && ")
    if (!this.canUsePlainObjectFastPath(ast)) {
      return slowExpression
    }
    const fastExpression = fastExpressions.map((expression) => `(${expression})`).join(" && ")
    return fastPathCondition ? `((${fastExpression}) || (${slowExpression}))` : fastExpression
  }

  private pushExcessPropertyCheck(lines: Array<string>, ast: SchemaAST.Objects, value: string): void {
    const expression = this.strictExcessPropertyExpression(ast, value)
    if (expression) {
      lines.push(`if (!(${expression})) return false`)
    }
  }

  private strictExcessPropertyExpression(ast: SchemaAST.Objects, value: string): string | undefined {
    if (!this.options.strict || ast.indexSignatures.length > 0) {
      return undefined
    }
    return this.excessPropertyCheckExpression(ast, value)
  }

  private excessPropertyCheckExpression(ast: SchemaAST.Objects, value: string): string {
    return this.exactOwnKeyCountExpression(ast, value) ?? this.ownKeysSubsetExpression(ast, value)
  }

  private exactOwnKeyCountExpression(ast: SchemaAST.Objects, value: string): string | undefined {
    if (ast.propertySignatures.every((ps) => !SchemaAST.isOptional(ps.type) && typeof ps.name === "string")) {
      if (this.options.simpleInputs) {
        return `Object.keys(${value}).length === ${ast.propertySignatures.length}`
      }
      return `Object.getOwnPropertyNames(${value}).length === ${ast.propertySignatures.length} && Object.getOwnPropertySymbols(${value}).length === 0`
    }
    if (ast.propertySignatures.every((ps) => !SchemaAST.isOptional(ps.type))) {
      return `Reflect.ownKeys(${value}).length === ${ast.propertySignatures.length}`
    }
  }

  private ownKeysSubsetExpression(ast: SchemaAST.Objects, value: string): string {
    const stringKeys: Array<string> = []
    const symbolKeys: Array<symbol> = []
    for (let i = 0; i < ast.propertySignatures.length; i++) {
      const key = ast.propertySignatures[i].name
      if (typeof key === "symbol") {
        symbolKeys.push(key)
      } else {
        stringKeys.push(String(key))
      }
    }
    if (this.options.simpleInputs && symbolKeys.length === 0) {
      return stringKeys.length === 0
        ? `Object.keys(${value}).length === 0`
        : `Object.keys(${value}).every((key) => ${
          stringKeys.map((key) => `key === ${JSON.stringify(key)}`).join(" || ")
        })`
    }
    const stringExpression = stringKeys.length === 0
      ? `Object.getOwnPropertyNames(${value}).length === 0`
      : `Object.getOwnPropertyNames(${value}).every((key) => ${
        stringKeys.map((key) => `key === ${JSON.stringify(key)}`).join(" || ")
      })`
    const symbolExpression = symbolKeys.length === 0
      ? `Object.getOwnPropertySymbols(${value}).length === 0`
      : `Object.getOwnPropertySymbols(${value}).every((key) => ${
        symbolKeys.map((key) => `key === ${this.ref(key)}`).join(" || ")
      })`
    return `${stringExpression} && ${symbolExpression}`
  }

  private withChecksExpression(ast: SchemaAST.AST, expression: string, value: string, path: string): string {
    const checks = this.checksExpression(ast.checks, value, ast, `${path}.checks`)
    return checks ? `(${expression}) && (${checks})` : expression
  }

  private plainObjectFastPathCondition(ast: SchemaAST.Objects, value: string): string | undefined {
    if (
      this.options.simpleInputs &&
      ast.propertySignatures.every((ps) => typeof ps.name === "string" && !(ps.name in Object.prototype))
    ) {
      return undefined
    }
    const prototypeGuards = ast.propertySignatures.map((ps) => `!(${this.propertyKey(ps.name)} in Object.prototype)`)
    const protoExpression = `(${value}.__proto__ === Object.prototype || Object.getPrototypeOf(${value}) === null)`
    return prototypeGuards.length === 0 ? protoExpression : `${protoExpression} && ${prototypeGuards.join(" && ")}`
  }

  private fastPathPropertyExpression(
    ps: SchemaAST.PropertySignature,
    value: string,
    path: string
  ): string {
    return this.callExpression(ps.type, value, path)
  }

  private canUsePlainObjectFastPath(ast: SchemaAST.Objects): boolean {
    return ast.indexSignatures.length === 0 &&
      ast.propertySignatures.length > 0 &&
      ast.propertySignatures.every((ps) => {
        if (ps.name === "__proto__") {
          return false
        }
        return SchemaAST.isOptional(ps.type)
          ? this.definitelyMatchesUndefined(ps.type)
          : !this.canMatchUndefined(ps.type)
      })
  }

  private definitelyMatchesUndefined(ast: SchemaAST.AST): boolean {
    if (ast.checks) {
      return false
    }
    switch (ast._tag) {
      case "Undefined":
      case "Void":
      case "Any":
      case "Unknown":
        return true
      case "Union":
        return ast.types.some((type) => this.definitelyMatchesUndefined(type))
      default:
        return false
    }
  }

  private canMatchUndefined(ast: SchemaAST.AST): boolean {
    switch (ast._tag) {
      case "Undefined":
      case "Void":
      case "Any":
      case "Unknown":
        return true
      case "Union":
        return ast.types.some((type) => this.canMatchUndefined(type))
      case "Suspend":
      case "Declaration":
        return true
      default:
        return false
    }
  }

  private getDiscriminator(ast: SchemaAST.Union): Discriminator | undefined {
    if (ast.types.length === 0) {
      return undefined
    }
    const first = ast.types[0]
    if (first._tag !== "Objects") {
      return undefined
    }
    const candidates = first.propertySignatures.filter((ps) =>
      !SchemaAST.isOptional(ps.type) && (ps.type._tag === "Literal" || ps.type._tag === "UniqueSymbol")
    )
    for (const candidate of candidates) {
      const cases: Array<DiscriminatorCase> = []
      const seen = new Set<SchemaAST.LiteralValue | symbol>()
      let ok = true
      for (let i = 0; i < ast.types.length; i++) {
        const type = ast.types[i]
        if (type._tag !== "Objects") {
          ok = false
          break
        }
        const ps = type.propertySignatures.find((ps) => ps.name === candidate.name)
        if (!ps || SchemaAST.isOptional(ps.type) || (ps.type._tag !== "Literal" && ps.type._tag !== "UniqueSymbol")) {
          ok = false
          break
        }
        const literal = ps.type._tag === "Literal" ? ps.type.literal : ps.type.symbol
        if (seen.has(literal)) {
          ok = false
          break
        }
        seen.add(literal)
        cases.push({ ast: type, index: i, literal })
      }
      if (ok) {
        return { key: candidate.name, cases }
      }
    }
    return undefined
  }

  private returnWithChecks(ast: SchemaAST.AST, expression: string, path: string): string {
    const checks = this.checksExpression(ast.checks, "input", ast, `${path}.checks`)
    return checks ? `return (${expression}) && (${checks})` : `return ${expression}`
  }

  private returnChecks(ast: SchemaAST.AST, path: string): string {
    const checks = this.checksExpression(ast.checks, "input", ast, `${path}.checks`)
    return checks ? `return ${checks}` : "return true"
  }

  private checksExpression(
    checks: SchemaAST.Checks | undefined,
    value: string,
    ast: SchemaAST.AST,
    path: string
  ): string | undefined {
    if (!checks) {
      return undefined
    }
    return checks.map((check, i) => this.checkExpression(check, value, ast, `${path}[${i}]`)).join(" && ")
  }

  private checkExpression(
    check: SchemaAST.Check<unknown>,
    value: string,
    ast: SchemaAST.AST,
    path: string
  ): string {
    if (check._tag === "FilterGroup") {
      return check.checks.map((check, i) => this.checkExpression(check, value, ast, `${path}.checks[${i}]`)).join(
        " && "
      )
    }

    const meta = check.annotations?.meta as any
    switch (meta?._tag) {
      case "isTrimmed":
        return `${value}.trim() === ${value}`
      case "isPattern":
      case "isStringFinite":
      case "isStringBigInt":
      case "isStringSymbol":
      case "isUUID":
      case "isGUID":
      case "isULID":
      case "isBase64":
      case "isBase64Url":
        return `${this.ref(meta.regExp)}.test(${value})`
      case "isStartsWith":
        return `${value}.startsWith(${this.literal(meta.startsWith)})`
      case "isEndsWith":
        return `${value}.endsWith(${this.literal(meta.endsWith)})`
      case "isIncludes":
        return `${value}.includes(${this.literal(meta.includes)})`
      case "isUppercased":
        return `${value}.toUpperCase() === ${value}`
      case "isLowercased":
        return `${value}.toLowerCase() === ${value}`
      case "isCapitalized":
        return `${value}.charAt(0).toUpperCase() === ${value}.charAt(0)`
      case "isUncapitalized":
        return `${value}.charAt(0).toLowerCase() === ${value}.charAt(0)`
      case "isFinite":
        return `Number.isFinite(${value})`
      case "isInt":
        return `Number.isSafeInteger(${value})`
      case "isGreaterThan":
        return `${value} > ${this.literal(meta.exclusiveMinimum)}`
      case "isGreaterThanOrEqualTo":
        return `${value} >= ${this.literal(meta.minimum)}`
      case "isLessThan":
        return `${value} < ${this.literal(meta.exclusiveMaximum)}`
      case "isLessThanOrEqualTo":
        return `${value} <= ${this.literal(meta.maximum)}`
      case "isBetween": {
        const lower = meta.exclusiveMinimum
          ? `${value} > ${this.literal(meta.minimum)}`
          : `${value} >= ${this.literal(meta.minimum)}`
        const upper = meta.exclusiveMaximum
          ? `${value} < ${this.literal(meta.maximum)}`
          : `${value} <= ${this.literal(meta.maximum)}`
        return `${lower} && ${upper}`
      }
      case "isMultipleOf":
        return `${this.ref(Number_.remainder)}(${value}, ${this.literal(meta.divisor)}) === 0`
      case "isGreaterThanBigInt":
        return `${value} > ${this.literal(meta.exclusiveMinimum)}`
      case "isGreaterThanOrEqualToBigInt":
        return `${value} >= ${this.literal(meta.minimum)}`
      case "isLessThanBigInt":
        return `${value} < ${this.literal(meta.exclusiveMaximum)}`
      case "isLessThanOrEqualToBigInt":
        return `${value} <= ${this.literal(meta.maximum)}`
      case "isBetweenBigInt": {
        const lower = meta.exclusiveMinimum
          ? `${value} > ${this.literal(meta.minimum)}`
          : `${value} >= ${this.literal(meta.minimum)}`
        const upper = meta.exclusiveMaximum
          ? `${value} < ${this.literal(meta.maximum)}`
          : `${value} <= ${this.literal(meta.maximum)}`
        return `${lower} && ${upper}`
      }
      case "isDateValid":
        return `!Number.isNaN(${value}.getTime())`
      case "isGreaterThanDate":
        return `${value} > ${this.ref(meta.exclusiveMinimum)}`
      case "isGreaterThanOrEqualToDate":
        return `${value} >= ${this.ref(meta.minimum)}`
      case "isLessThanDate":
        return `${value} < ${this.ref(meta.exclusiveMaximum)}`
      case "isLessThanOrEqualToDate":
        return `${value} <= ${this.ref(meta.maximum)}`
      case "isBetweenDate": {
        const lower = meta.exclusiveMinimum
          ? `${value} > ${this.ref(meta.minimum)}`
          : `${value} >= ${this.ref(meta.minimum)}`
        const upper = meta.exclusiveMaximum
          ? `${value} < ${this.ref(meta.maximum)}`
          : `${value} <= ${this.ref(meta.maximum)}`
        return `${lower} && ${upper}`
      }
      case "isMinLength":
        return `${value}.length >= ${meta.minLength}`
      case "isMaxLength":
        return `${value}.length <= ${meta.maxLength}`
      case "isLengthBetween":
        return `${value}.length >= ${meta.minimum} && ${value}.length <= ${meta.maximum}`
      case "isMinSize":
        return `${value}.size >= ${meta.minSize}`
      case "isMaxSize":
        return `${value}.size <= ${meta.maxSize}`
      case "isSizeBetween":
        return `${value}.size >= ${meta.minimum} && ${value}.size <= ${meta.maximum}`
      case "isMinProperties":
        return `Reflect.ownKeys(${value}).length >= ${meta.minProperties}`
      case "isMaxProperties":
        return `Reflect.ownKeys(${value}).length <= ${meta.maxProperties}`
      case "isPropertiesLengthBetween":
        return `Reflect.ownKeys(${value}).length >= ${meta.minimum} && Reflect.ownKeys(${value}).length <= ${meta.maximum}`
      default:
        return `${
          this.ref((input: unknown) => check.run(input, ast, SchemaAST.defaultParseOptions) === undefined)
        }(${value})`
    }
  }

  private indexKeysExpression(parameter: SchemaAST.AST): string {
    switch (parameter._tag) {
      case "String":
        return "Object.keys"
      case "Symbol":
        return "Object.getOwnPropertySymbols"
      case "Number":
        return `${this.ref((input: object) => Object.keys(input).filter((key) => numberStringRegExp.test(key)))}`
      case "TemplateLiteral": {
        const regExp = SchemaAST.getTemplateLiteralRegExp(parameter)
        return `${this.ref((input: object) => Object.keys(input).filter((key) => regExp.test(key)))}`
      }
      default:
        return `${this.ref((input: Record<PropertyKey, unknown>) => SchemaAST.getIndexSignatureKeys(input, parameter))}`
    }
  }

  private indexKeyPredicate(parameter: SchemaAST.AST): string | undefined {
    if (!parameter.checks) {
      switch (parameter._tag) {
        case "String":
        case "Symbol":
        case "Number":
        case "TemplateLiteral":
          return undefined
      }
    }
    const parser = SchemaParser._issue(toIndexSignatureParameter(parameter))
    return `${this.ref((key: PropertyKey) => parser(key, SchemaAST.defaultParseOptions) === undefined)}`
  }

  private ref(value: unknown): string {
    const index = this.refs.length
    this.refs.push(value)
    return `refs[${index}]`
  }

  private variable(): string {
    return `v${this.nextVar++}`
  }

  private literal(value: SchemaAST.LiteralValue): string {
    switch (typeof value) {
      case "string":
        return JSON.stringify(value)
      case "bigint":
        return `${value}n`
      default:
        return String(value)
    }
  }

  private discriminatorLiteral(value: SchemaAST.LiteralValue | symbol): string {
    return typeof value === "symbol" ? this.ref(value) : this.literal(value)
  }

  private propertyKey(key: PropertyKey): string {
    return typeof key === "symbol" ? this.ref(key) : JSON.stringify(key)
  }

  private propertyAccess(value: string, key: PropertyKey): string {
    if (typeof key === "symbol") {
      return `${value}[${this.ref(key)}]`
    }
    return typeof key === "string" && isPropertyAccessor(key) ? `${value}.${key}` : `${value}[${JSON.stringify(key)}]`
  }

  private formatPropertyKey(key: PropertyKey): string {
    return typeof key === "symbol" ? key.toString() : JSON.stringify(key)
  }
}

type Discriminator = {
  readonly key: PropertyKey
  readonly cases: ReadonlyArray<DiscriminatorCase>
}

type DiscriminatorCase = {
  readonly ast: SchemaAST.AST
  readonly index: number
  readonly literal: SchemaAST.LiteralValue | symbol
}

function isPropertyAccessor(value: string): boolean {
  return value !== "__proto__" && /^[$A-Z_a-z][$\w]*$/.test(value)
}

function toIndexSignatureParameter(ast: SchemaAST.AST): SchemaAST.AST {
  switch (ast._tag) {
    case "Number":
      return ast.toCodecStringTree()
    case "Union":
      return new SchemaAST.Union(
        ast.types.map(toIndexSignatureParameter),
        ast.mode,
        ast.annotations,
        ast.checks
      )
    default:
      return ast
  }
}
