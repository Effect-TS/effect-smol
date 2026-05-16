import * as path from "node:path"
import type { CreateRule, ESTree, Visitor } from "oxlint"

type ExamplePolicy = "required" | "optional" | "forbidden"

interface RuleChecks {
  readonly description?: boolean
  readonly tags?: boolean
  readonly category?: boolean
  readonly since?: boolean
  readonly examples?: boolean
}

interface RuleOptions {
  readonly include?: Array<string>
  readonly exclude?: Array<string>
  readonly checks?: RuleChecks
  readonly examples?: {
    readonly values?: ExamplePolicy
    readonly types?: ExamplePolicy
  }
}

type ExportBucket = "value" | "type"
type JSDocKind = "declaration" | "member" | "module" | "namespace"

interface AstNode {
  readonly type: string
  readonly range: [number, number]
  readonly [key: string]: any
}

interface JSDocTag {
  readonly name: string
  value: string
  readonly line: number
}

interface ExampleAnalysis {
  readonly count: number
  readonly hasExampleHeading: boolean
  readonly hasMalformedExample: boolean
  readonly hasLooseTsFence: boolean
  readonly hasTsFence: boolean
}

interface JSDocBlock {
  readonly range: [number, number]
  readonly lines: Array<string>
  readonly tags: Array<JSDocTag>
  readonly examples: ExampleAnalysis
  readonly hasDescription: boolean
}

const masterTagOrder = new Map([
  ["deprecated", 0],
  ["default", 1],
  ["see", 2],
  ["category", 3],
  ["since", 4]
])

const declarationTags = new Set(["deprecated", "default", "see", "category", "since", "internal"])
const namespaceTags = new Set(["deprecated", "default", "see", "since", "internal"])
const memberTags = new Set(["deprecated", "default", "see", "since", "internal"])
const moduleTags = new Set(["deprecated", "see", "since"])
const onePerBlockTags = new Set(["deprecated", "default", "category", "since", "internal"])

const stableSemverRegex = /^\d+\.\d+\.\d+$/
const seeRegex = /(?:\{@link\s+[^}]+\}|https?:\/\/\S+)/

function normalizePathName(filePath: string): string {
  return filePath.replaceAll(path.sep, "/")
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
}

function globToRegExp(glob: string): RegExp {
  let source = "^"
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index]
    const next = glob[index + 1]
    if (char === "*") {
      if (next === "*") {
        source += ".*"
        index++
      } else {
        source += "[^/]*"
      }
    } else if (char === "?") {
      source += "[^/]"
    } else {
      source += escapeRegExp(char)
    }
  }
  return new RegExp(`${source}$`)
}

function createPathMatcher(patterns: ReadonlyArray<string> | undefined) {
  if (patterns === undefined) {
    return undefined
  }
  const regexps = patterns.map(globToRegExp)
  return (filename: string, relativeFilename: string): boolean =>
    regexps.some((regexp) => regexp.test(filename) || regexp.test(relativeFilename))
}

function shouldCheckFile(options: RuleOptions, filename: string, cwd: string): boolean {
  const normalizedFilename = normalizePathName(filename)
  const relativeFilename = normalizePathName(path.relative(cwd, filename))
  const include = createPathMatcher(options.include)
  const exclude = createPathMatcher(options.exclude)

  if (include !== undefined && !include(normalizedFilename, relativeFilename)) {
    return false
  }
  if (exclude !== undefined && exclude(normalizedFilename, relativeFilename)) {
    return false
  }
  return true
}

function getSourceText(context: {
  readonly sourceCode: { readonly text?: string; getText(node?: unknown): string }
}): string {
  return context.sourceCode.text ?? context.sourceCode.getText()
}

function getCwd(context: { readonly cwd?: string; getCwd?: () => string }): string {
  return context.cwd ?? context.getCwd?.() ?? process.cwd()
}

function skipWhitespace(source: string, end: number): number {
  while (end > 0 && /\s/.test(source[end - 1])) {
    end--
  }
  return end
}

function isSkippableDirectiveComment(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith("// @ts-expect-error") ||
    trimmed.startsWith("// @ts-ignore") ||
    trimmed.startsWith("// @effect-diagnostics") ||
    trimmed.startsWith("// eslint-disable-next-line") ||
    trimmed.startsWith("// oxlint-disable-next-line")
}

function skipDirectiveComments(source: string, end: number): number {
  while (end > 0) {
    const lineStart = source.lastIndexOf("\n", end - 1) + 1
    if (!isSkippableDirectiveComment(source.slice(lineStart, end))) {
      return end
    }
    end = skipWhitespace(source, lineStart)
  }
  return end
}

function findLeadingJSDoc(source: string, node: AstNode, ignoredRange?: [number, number]): JSDocBlock | undefined {
  const end = skipDirectiveComments(source, skipWhitespace(source, node.range[0]))
  if (!source.slice(0, end).endsWith("*/")) {
    return undefined
  }

  const start = source.lastIndexOf("/*", end)
  if (start === -1 || source[start + 2] !== "*") {
    return undefined
  }
  const range: [number, number] = [start, end]
  if (ignoredRange !== undefined && range[0] === ignoredRange[0] && range[1] === ignoredRange[1]) {
    return undefined
  }
  return parseJSDoc(source.slice(start, end), range)
}

function findModuleJSDoc(source: string, program: ESTree.Program): JSDocBlock | undefined {
  const firstImportOrExport = program.body.find((statement) =>
    statement.type === "ImportDeclaration" ||
    statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration" ||
    statement.type === "ExportAllDeclaration" ||
    statement.type === "TSExportAssignment" ||
    statement.type === "TSNamespaceExportDeclaration" ||
    statement.type === "TSModuleDeclaration"
  )
  if (!firstImportOrExport) {
    return undefined
  }

  const prefix = source.slice(0, firstImportOrExport.range[0])
  const start = prefix.indexOf("/**")
  if (start === -1) {
    return undefined
  }

  const end = prefix.indexOf("*/", start)
  if (end === -1) {
    return undefined
  }

  const range: [number, number] = [start, end + 2]
  return parseJSDoc(source.slice(range[0], range[1]), range)
}

function parseJSDoc(raw: string, range: [number, number]): JSDocBlock {
  const body = raw.replace(/^\/\*\*/, "").replace(/\*\/$/, "")
  const lines = body.split(/\r\n|\r|\n/).map((line) => line.replace(/^\s*\* ?/, "").trimEnd())
  const tags = parseTags(lines)
  const examples = analyzeExamples(lines)
  return {
    range,
    lines,
    tags,
    examples,
    hasDescription: hasDescription(lines, tags, examples)
  }
}

function parseTags(lines: Array<string>): Array<JSDocTag> {
  const tags: Array<JSDocTag> = []
  let current: JSDocTag | undefined
  let inFence = false

  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim()
    if (trimmed.startsWith("```")) {
      inFence = !inFence
      current = undefined
      continue
    }
    if (inFence) {
      continue
    }

    const match = /^@([A-Za-z][\w-]*)(?:\s+(.*))?$/.exec(trimmed)
    if (match) {
      current = { name: match[1], value: match[2]?.trim() ?? "", line: index }
      tags.push(current)
      continue
    }

    if (current !== undefined && trimmed !== "") {
      current.value = current.value === "" ? trimmed : `${current.value}\n${trimmed}`
    } else if (trimmed === "") {
      current = undefined
    }
  }

  return tags
}

function hasDescription(lines: Array<string>, tags: Array<JSDocTag>, examples: ExampleAnalysis): boolean {
  const firstTagLine = tags[0]?.line ?? lines.length
  const firstExampleLine = examples.hasExampleHeading
    ? lines.findIndex((line) => line.trim().startsWith("**Example**"))
    : lines.length
  const descriptionEnd = Math.min(firstTagLine, firstExampleLine === -1 ? lines.length : firstExampleLine)

  for (let index = 0; index < descriptionEnd; index++) {
    const trimmed = lines[index].trim()
    if (trimmed !== "" && !trimmed.startsWith("```")) {
      return true
    }
  }
  return false
}

function analyzeExamples(lines: Array<string>): ExampleAnalysis {
  const tsFenceLines = new Set<number>()
  const canonicalTsFenceLines = new Set<number>()
  let count = 0
  let hasExampleHeading = false
  let hasMalformedExample = false

  for (let index = 0; index < lines.length; index++) {
    if (lines[index].trim() === "```ts") {
      tsFenceLines.add(index)
    }
  }

  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim()
    if (!trimmed.startsWith("**Example**")) {
      continue
    }

    hasExampleHeading = true
    const match = /^\*\*Example\*\* \((.+)\)$/.exec(trimmed)
    if (!match || match[1].trim() === "") {
      hasMalformedExample = true
      continue
    }

    if (lines[index + 1]?.trim() !== "" || lines[index + 2]?.trim() !== "```ts") {
      hasMalformedExample = true
      continue
    }

    let cursor = index + 3
    let hasCode = false
    while (cursor < lines.length && lines[cursor].trim() !== "```") {
      if (lines[cursor].trim() !== "") {
        hasCode = true
      }
      cursor++
    }

    if (cursor >= lines.length || !hasCode) {
      hasMalformedExample = true
      continue
    }

    count++
    canonicalTsFenceLines.add(index + 2)
    index = cursor
  }

  return {
    count,
    hasExampleHeading,
    hasMalformedExample,
    hasLooseTsFence: Array.from(tsFenceLines).some((line) => !canonicalTsFenceLines.has(line)),
    hasTsFence: tsFenceLines.size > 0
  }
}

function tagCount(block: JSDocBlock, tagName: string): number {
  return block.tags.filter((tag) => tag.name === tagName).length
}

function hasTag(block: JSDocBlock, tagName: string): boolean {
  return block.tags.some((tag) => tag.name === tagName)
}

function isInternal(block: JSDocBlock | undefined): boolean {
  return block !== undefined && hasTag(block, "internal")
}

function isAllowedTag(tagName: string, allowedTags: ReadonlySet<string>): boolean {
  return allowedTags.has(tagName)
}

function resolveChecks(checks: RuleChecks | undefined): Required<RuleChecks> {
  return {
    description: checks?.description ?? true,
    tags: checks?.tags ?? true,
    category: checks?.category ?? true,
    since: checks?.since ?? true,
    examples: checks?.examples ?? true
  }
}

const rule: CreateRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce Effect's public API JSDoc structure"
    },
    schema: [
      {
        type: "object",
        properties: {
          include: {
            type: "array",
            items: { type: "string" }
          },
          exclude: {
            type: "array",
            items: { type: "string" }
          },
          checks: {
            type: "object",
            properties: {
              description: { type: "boolean" },
              tags: { type: "boolean" },
              category: { type: "boolean" },
              since: { type: "boolean" },
              examples: { type: "boolean" }
            },
            additionalProperties: false
          },
          examples: {
            type: "object",
            properties: {
              values: { enum: ["required", "optional", "forbidden"] },
              types: { enum: ["required", "optional", "forbidden"] }
            },
            additionalProperties: false
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = (context.options[0] as RuleOptions | undefined) ?? {}
    const source = getSourceText(context)
    const cwd = getCwd(context)

    if (!shouldCheckFile(options, context.filename, cwd)) {
      return {} as Visitor
    }

    const valueExamplePolicy = options.examples?.values ?? "optional"
    const typeExamplePolicy = options.examples?.types ?? "forbidden"
    const checks = resolveChecks(options.checks)
    let moduleBlock: JSDocBlock | undefined
    let hasPublicExport = false
    let firstPublicExport: AstNode | undefined
    const checkedExports = new Set<string>()
    const checkedFunctionOverloads = new Set<string>()
    const checkedNamespaceMemberExports = new Set<string>()

    function report(node: AstNode, message: string) {
      context.report({ node: node as ESTree.Node, message })
    }

    function jsdocNode(block: JSDocBlock): AstNode {
      return {
        type: "JSDocBlock",
        range: block.range
      }
    }

    function getLeadingBlock(node: AstNode): JSDocBlock | undefined {
      return findLeadingJSDoc(source, node, moduleBlock?.range)
    }

    function markPublicExport(node: AstNode) {
      hasPublicExport = true
      firstPublicExport ??= node
    }

    function requiresPublicJSDoc(bucket: ExportBucket): boolean {
      const examplePolicy = bucket === "value" ? valueExamplePolicy : typeExamplePolicy
      return checks.description || checks.category || checks.since ||
        checks.examples && examplePolicy === "required"
    }

    function requiresModuleJSDoc(): boolean {
      return checks.description || checks.since
    }

    function validateInternalBlock(node: AstNode, block: JSDocBlock) {
      const internals = block.tags.filter((tag) => tag.name === "internal")
      if (checks.tags) {
        if (internals.length !== 1) {
          report(node, "JSDoc blocks may contain at most one @internal tag")
        }
        if (internals[0]?.value.trim() !== "") {
          report(node, "@internal must not have a value")
        }
        for (const tag of block.tags) {
          if (tag.name !== "internal") {
            report(node, "JSDoc blocks with @internal must not contain other block tags")
          }
        }
      }
      if (!checks.tags && checks.category && tagCount(block, "category") > 0) {
        report(node, "@category is not allowed in internal JSDoc")
      }
      if (checks.examples && (block.examples.hasExampleHeading || block.examples.hasTsFence)) {
        report(node, "JSDoc blocks with @internal must not contain examples")
      }
    }

    function validateTags(node: AstNode, block: JSDocBlock, allowedTags: ReadonlySet<string>, kind: JSDocKind) {
      const counts = new Map<string, number>()
      let previousOrder = -1
      let previousTag: JSDocTag | undefined

      for (const tag of block.tags) {
        if (tag.name === "example") {
          if (checks.examples) {
            report(node, "@example is not allowed; use a canonical **Example** (Title) section")
          }
          continue
        }

        if (!isAllowedTag(tag.name, allowedTags)) {
          if (tag.name === "category" ? checks.category : checks.tags) {
            const scope = kind === "module" ? "module" : kind
            report(node, `@${tag.name} is not allowed in ${scope} JSDoc`)
          }
          continue
        }

        counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1)

        const order = masterTagOrder.get(tag.name)
        if (order !== undefined) {
          if (order < previousOrder) {
            if (checks.tags) {
              report(node, `@${tag.name} is out of order in JSDoc`)
            } else if (checks.category && (tag.name === "category" || previousTag?.name === "category")) {
              report(node, "@category is out of order in JSDoc")
            }
          } else {
            previousOrder = order
            previousTag = tag
          }
        }

        if (tag.name === "category" && tag.value.trim() === "" && checks.category) {
          report(node, "@category must include a value")
        } else if (!checks.tags) {
          continue
        } else if (tag.name === "deprecated" && tag.value.trim() === "") {
          report(node, "@deprecated must include a message")
        } else if (tag.name === "default" && tag.value.trim() === "") {
          report(node, "@default must include a value")
        } else if (tag.name === "see" && !seeRegex.test(tag.value.trim())) {
          report(node, "@see must include an inline {@link ...} tag or an http(s) URL")
        } else if (tag.name === "since" && !stableSemverRegex.test(tag.value.trim())) {
          report(node, "@since must be a stable semver version like 1.2.3")
        }
      }

      for (const tagName of onePerBlockTags) {
        if ((tagName === "category" ? checks.category : checks.tags) && (counts.get(tagName) ?? 0) > 1) {
          report(node, `JSDoc blocks may contain at most one @${tagName} tag`)
        }
      }
    }

    function validateExamples(node: AstNode, block: JSDocBlock, policy: ExamplePolicy) {
      if (!checks.examples) {
        return
      }
      if (policy === "forbidden") {
        if (block.examples.hasExampleHeading || block.examples.hasTsFence) {
          report(node, "Examples are not allowed in this JSDoc block")
        }
        return
      }

      if (block.examples.hasMalformedExample || block.examples.hasLooseTsFence) {
        report(node, "TypeScript examples must use **Example** (Title), a blank line, and a non-empty ```ts fence")
      }

      if (policy === "required" && block.examples.count === 0 && !block.examples.hasTsFence) {
        report(node, "JSDoc must include a canonical TypeScript example")
      }
    }

    function validatePublicBlock(node: AstNode, block: JSDocBlock, bucket: ExportBucket, isNamespace: boolean) {
      validateTags(
        node,
        block,
        isNamespace ? namespaceTags : declarationTags,
        isNamespace ? "namespace" : "declaration"
      )
      if (checks.description && !block.hasDescription) {
        report(node, "Public JSDoc must include a description")
      }
      if (checks.category && !isNamespace && tagCount(block, "category") === 0) {
        report(node, "Public JSDoc must include @category")
      }
      if (checks.since && tagCount(block, "since") === 0) {
        report(node, "Public JSDoc must include @since")
      }
      validateExamples(node, block, bucket === "value" ? valueExamplePolicy : typeExamplePolicy)
    }

    function validateMemberBlock(node: AstNode, block: JSDocBlock) {
      if (isInternal(block)) {
        validateInternalBlock(node, block)
        return
      }

      validateTags(node, block, memberTags, "member")
      if (checks.description && !block.hasDescription) {
        report(node, "Member JSDoc must include a description")
      }
      validateExamples(node, block, "forbidden")
    }

    function validateModuleBlock(block: JSDocBlock) {
      const node = jsdocNode(block)
      validateTags(node, block, moduleTags, "module")
      if (checks.description && !block.hasDescription) {
        report(node, "Module JSDoc must include a description")
      }
      if (checks.since && tagCount(block, "since") === 0) {
        report(node, "Module JSDoc must include @since")
      }
      validateExamples(node, block, "optional")
    }

    function validateMemberIfPresent(node: AstNode) {
      const block = getLeadingBlock(node)
      if (!block) {
        return false
      }
      validateMemberBlock(node, block)
      return isInternal(block)
    }

    function inspectTypeAnnotation(typeAnnotation: AstNode | null | undefined) {
      if (!typeAnnotation) {
        return
      }
      if (typeAnnotation.type === "TSTypeAnnotation") {
        inspectType(typeAnnotation.typeAnnotation)
      }
    }

    function inspectParam(param: AstNode) {
      if (param.type === "TSParameterProperty") {
        inspectParam(param.parameter)
        return
      }
      inspectTypeAnnotation(param.typeAnnotation)
      if (param.type === "RestElement") {
        inspectTypeAnnotation(param.argument?.typeAnnotation)
      }
    }

    function inspectParams(params: ReadonlyArray<AstNode> | undefined) {
      for (const param of params ?? []) {
        inspectParam(param)
      }
    }

    function inspectFunctionLike(node: AstNode | null | undefined) {
      if (!node) {
        return
      }
      if (
        node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "TSDeclareFunction" ||
        node.type === "TSEmptyBodyFunctionExpression" ||
        node.type === "ArrowFunctionExpression"
      ) {
        inspectParams(node.params)
        inspectTypeAnnotation(node.returnType)
      }
    }

    function inspectType(type: AstNode | null | undefined) {
      if (!type) {
        return
      }

      switch (type.type) {
        case "TSTypeLiteral":
          checkTypeLiteralMembers(type.members)
          break
        case "TSUnionType":
        case "TSIntersectionType":
          for (const item of type.types) {
            inspectType(item)
          }
          break
        case "TSParenthesizedType":
        case "TSTypeOperator":
        case "TSOptionalType":
        case "TSRestType":
          inspectType(type.typeAnnotation)
          break
        case "TSArrayType":
          inspectType(type.elementType)
          break
        case "TSConditionalType":
          inspectType(type.checkType)
          inspectType(type.extendsType)
          inspectType(type.trueType)
          inspectType(type.falseType)
          break
        case "TSTypeReference":
          for (const param of type.typeArguments?.params ?? []) {
            inspectType(param)
          }
          break
        case "TSFunctionType":
        case "TSConstructorType":
          inspectParams(type.params)
          inspectTypeAnnotation(type.returnType)
          break
        case "TSMappedType":
          inspectType(type.typeAnnotation)
          break
      }
    }

    function checkTypeMember(member: AstNode) {
      const internal = validateMemberIfPresent(member)
      if (internal) {
        return
      }

      if (member.type === "TSPropertySignature" || member.type === "TSIndexSignature") {
        inspectTypeAnnotation(member.typeAnnotation)
      } else if (
        member.type === "TSMethodSignature" ||
        member.type === "TSCallSignatureDeclaration" ||
        member.type === "TSConstructSignatureDeclaration"
      ) {
        inspectParams(member.params)
        inspectTypeAnnotation(member.returnType)
      }
    }

    function checkTypeLiteralMembers(members: ReadonlyArray<AstNode> | undefined) {
      for (const member of members ?? []) {
        checkTypeMember(member)
      }
    }

    function checkClassMembers(classNode: AstNode) {
      for (const member of classNode.body?.body ?? []) {
        if (
          member.type !== "MethodDefinition" &&
          member.type !== "TSAbstractMethodDefinition" &&
          member.type !== "PropertyDefinition" &&
          member.type !== "TSAbstractPropertyDefinition" &&
          member.type !== "AccessorProperty" &&
          member.type !== "TSAbstractAccessorProperty"
        ) {
          continue
        }

        if (
          member.key?.type === "PrivateIdentifier" || member.accessibility === "private" ||
          member.accessibility === "protected"
        ) {
          continue
        }

        const internal = validateMemberIfPresent(member)
        if (internal || member.type === "MethodDefinition" && member.kind === "constructor") {
          continue
        }

        if (
          member.type === "MethodDefinition" ||
          member.type === "TSAbstractMethodDefinition"
        ) {
          inspectFunctionLike(member.value)
        } else {
          inspectTypeAnnotation(member.typeAnnotation)
        }
      }
    }

    function checkEnumMembers(enumNode: AstNode) {
      for (const member of enumNode.body?.members ?? []) {
        const block = getLeadingBlock(member)
        if (block) {
          validateMemberBlock(member, block)
        }
      }
    }

    function checkVariableDeclaration(node: AstNode) {
      for (const declarator of node.declarations ?? []) {
        inspectTypeAnnotation(declarator.id?.typeAnnotation)
        inspectFunctionLike(declarator.init)
      }
    }

    function checkDeclarationMembers(declaration: AstNode) {
      switch (declaration.type) {
        case "VariableDeclaration":
          checkVariableDeclaration(declaration)
          break
        case "FunctionDeclaration":
        case "TSDeclareFunction":
          inspectFunctionLike(declaration)
          break
        case "ClassDeclaration":
        case "ClassExpression":
          checkClassMembers(declaration)
          break
        case "TSEnumDeclaration":
          checkEnumMembers(declaration)
          break
        case "TSTypeAliasDeclaration":
          inspectType(declaration.typeAnnotation)
          break
        case "TSInterfaceDeclaration":
          checkTypeLiteralMembers(declaration.body?.body)
          break
        case "TSModuleDeclaration":
          checkNamespaceMembers(declaration)
          break
      }
    }

    function checkNamespaceMembers(namespaceNode: AstNode) {
      for (const statement of namespaceNode.body?.body ?? []) {
        if (statement.type === "ExportNamedDeclaration" && statement.declaration) {
          checkedNamespaceMemberExports.add(getNodeKey(statement))
          checkNamespaceMemberExport(statement, statement.declaration)
        } else if (statement.type === "ExportDefaultDeclaration") {
          checkedNamespaceMemberExports.add(getNodeKey(statement))
          checkNamespaceMemberExport(statement, statement.declaration)
        }
      }
    }

    function checkNamespaceMemberExport(exportNode: AstNode, declaration: AstNode) {
      const bucket = getDeclarationBucket(declaration)
      if (!bucket) {
        checkDeclarationMembers(declaration)
        return
      }
      if (!shouldCheckOverload(declaration)) {
        return
      }

      const block = getLeadingBlock(exportNode)
      if (block && isInternal(block)) {
        validateInternalBlock(exportNode, block)
        return
      }

      if (!block) {
        if (requiresPublicJSDoc(bucket)) {
          report(exportNode, "Public JSDoc is required")
        }
        checkDeclarationMembers(declaration)
        return
      }

      validatePublicBlock(exportNode, block, bucket, declaration.type === "TSModuleDeclaration")
      checkDeclarationMembers(declaration)
    }

    function getDeclarationBucket(declaration: AstNode): ExportBucket | undefined {
      switch (declaration.type) {
        case "VariableDeclaration":
        case "FunctionDeclaration":
        case "TSDeclareFunction":
        case "ClassDeclaration":
        case "ClassExpression":
        case "TSEnumDeclaration":
          return "value"
        case "TSTypeAliasDeclaration":
        case "TSInterfaceDeclaration":
        case "TSModuleDeclaration":
          return "type"
        default:
          return undefined
      }
    }

    function shouldCheckOverload(declaration: AstNode): boolean {
      if (
        declaration.type !== "FunctionDeclaration" &&
        declaration.type !== "TSDeclareFunction"
      ) {
        return true
      }

      const name = declaration.id?.name
      if (typeof name !== "string") {
        return true
      }

      if (declaration.body === null) {
        if (checkedFunctionOverloads.has(name)) {
          return false
        }
        checkedFunctionOverloads.add(name)
        return true
      }

      return !checkedFunctionOverloads.has(name)
    }

    function getNodeKey(node: AstNode): string {
      return `${node.range[0]}:${node.range[1]}`
    }

    function checkExportedDeclaration(exportNode: AstNode, declaration: AstNode) {
      const bucket = getDeclarationBucket(declaration)
      if (!bucket) {
        return
      }
      const key = getNodeKey(exportNode)
      if (checkedNamespaceMemberExports.has(key)) {
        return
      }
      if (checkedExports.has(key)) {
        return
      }
      checkedExports.add(key)
      if (!shouldCheckOverload(declaration)) {
        return
      }

      const block = getLeadingBlock(exportNode)
      if (block && isInternal(block)) {
        validateInternalBlock(exportNode, block)
        return
      }

      markPublicExport(exportNode)

      if (!block) {
        if (requiresPublicJSDoc(bucket)) {
          report(exportNode, "Public JSDoc is required")
        }
        checkDeclarationMembers(declaration)
        return
      }

      validatePublicBlock(exportNode, block, bucket, declaration.type === "TSModuleDeclaration")

      checkDeclarationMembers(declaration)
    }

    return {
      Program(node: ESTree.Program) {
        moduleBlock = findModuleJSDoc(source, node)
      },
      ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
        if (node.source || !node.declaration) {
          return
        }
        checkExportedDeclaration(node as AstNode, node.declaration as AstNode)
      },
      ExportDefaultDeclaration(node: ESTree.ExportDefaultDeclaration) {
        checkExportedDeclaration(node as AstNode, node.declaration as AstNode)
      },
      "Program:exit"() {
        if (!hasPublicExport) {
          return
        }
        if (!moduleBlock) {
          if (requiresModuleJSDoc()) {
            report(firstPublicExport!, "Module JSDoc is required")
          }
          return
        }
        validateModuleBlock(moduleBlock)
      }
    } as Visitor
  }
}

export default rule
