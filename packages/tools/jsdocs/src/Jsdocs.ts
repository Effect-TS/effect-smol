/*
AI prompt for writing Effect public API JSDoc:

This package owns Effect public API JSDoc parsing, extraction, and model generation.
*/

import * as Effect from "effect/Effect"
import { globSync } from "glob"
import * as crypto from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"
import * as ts from "typescript"

type ExportBucket = "value" | "type"
type DocScope = "declaration" | "namespace" | "namespace-declaration" | "member"

type Result<A, E> =
  | { readonly _tag: "Success"; readonly value: A }
  | { readonly _tag: "Failure"; readonly error: E }

/**
 * Result type returned by the JSDoc parser helpers.
 *
 * @category utility types
 * @since 4.0.0
 */
export type JSDocResult<A, E> = Result<A, E>

/**
 * Diagnostic emitted when a JSDoc block does not follow the standard shape.
 *
 * @category models
 * @since 4.0.0
 */
export interface JSDocDiagnostic {
  readonly code: string
  readonly message: string
}

/**
 * Parse error containing all diagnostics collected for a JSDoc block or file.
 *
 * @category models
 * @since 4.0.0
 */
export interface JSDocParseError {
  readonly diagnostics: ReadonlyArray<JSDocDiagnostic>
}

/**
 * Parsed `@see` tag text and any inline links it contains.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedSeeTag {
  readonly text: string
  readonly links: ReadonlyArray<ParsedInlineLink>
}

/**
 * Parsed inline JSDoc link target and optional display text.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedInlineLink {
  readonly raw: string
  readonly target: string
  readonly text: string | null
}

/**
 * Parsed JSDoc description sections.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedDescription {
  readonly short: string
  readonly whenToUse: string | null
  readonly details: string | null
  readonly gotchas: string | null
}

/**
 * Parsed example section from a JSDoc block.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedExample {
  readonly title: string
  readonly body: string | null
  readonly code: string
}

/**
 * Parsed tags required for a root public declaration.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedDeclarationTags {
  readonly category: string
  readonly since: string
  readonly deprecated: string | null
  readonly see: ReadonlyArray<ParsedSeeTag>
}

/**
 * Parsed tags allowed for namespace JSDoc.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedNamespaceTags {
  readonly category: string | null
  readonly since: string
  readonly deprecated: string | null
  readonly see: ReadonlyArray<ParsedSeeTag>
}

/**
 * Parsed tags allowed for documented members.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedMemberTags {
  readonly since: string | null
  readonly default: string | null
  readonly deprecated: string | null
  readonly see: ReadonlyArray<ParsedSeeTag>
}

/**
 * Parsed documented member within a declaration or another member.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedMember {
  readonly name: string
  readonly description: ParsedDescription
  readonly examples: ReadonlyArray<ParsedExample>
  readonly tags: ParsedMemberTags
  readonly members: ReadonlyArray<ParsedMember>
}

/**
 * Parsed root declaration exported from a checked file.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedRootDeclaration {
  readonly name: string
  readonly bucket: ExportBucket
  readonly description: ParsedDescription
  readonly examples: ReadonlyArray<ParsedExample>
  readonly tags: ParsedDeclarationTags
  readonly members: ReadonlyArray<ParsedMember>
}

/**
 * Parsed type declaration exported from inside a namespace.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedNamespaceDeclaration {
  readonly name: string
  readonly description: ParsedDescription
  readonly examples: ReadonlyArray<ParsedExample>
  readonly tags: ParsedNamespaceTags
  readonly members: ReadonlyArray<ParsedMember>
}

/**
 * Parsed namespace and its documented exported type declarations.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedNamespace {
  readonly name: string
  readonly description: ParsedDescription
  readonly examples: ReadonlyArray<ParsedExample>
  readonly tags: ParsedNamespaceTags
  readonly declarations: ReadonlyArray<ParsedNamespaceDeclaration>
  readonly namespaces: ReadonlyArray<ParsedNamespace>
}

/**
 * Parsed public JSDoc data collected from one checked file.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedJSDocFile {
  readonly declarations: ReadonlyArray<ParsedRootDeclaration>
  readonly namespaces: ReadonlyArray<ParsedNamespace>
}

/**
 * Barrel import metadata for a public module included in the JSDoc dump.
 *
 * @category models
 * @since 4.0.0
 */
export type ParsedJSDocBarrelImport =
  | {
    readonly type: "namespace"
    readonly module: string
    readonly name: string
  }
  | {
    readonly type: "flat"
    readonly module: string
  }

/**
 * Import specifiers for a public module included in the JSDoc dump.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedJSDocImports {
  readonly module: string
  readonly barrel: ParsedJSDocBarrelImport | null
}

interface ParsedBarrelExports {
  readonly namespace: ReadonlyMap<string, string>
  readonly flat: ReadonlySet<string>
}

/**
 * Parsed public JSDoc data paired with the normalized source file path.
 *
 * @category models
 * @since 4.0.0
 */
export interface ParsedJSDocFileDumpEntry extends ParsedJSDocFile {
  readonly file: string
  readonly imports: ParsedJSDocImports
}

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

interface JSDocBlock {
  readonly range: [number, number]
  readonly raw: string
  readonly lines: Array<string>
  readonly tags: Array<JSDocTag>
  readonly parsed?: ParsedCoreJSDoc
  readonly diagnostics: Array<JSDocDiagnostic>
  readonly internal: boolean
}

interface ParsedCoreJSDoc {
  readonly description: ParsedDescription
  readonly examples: ReadonlyArray<ParsedExample>
  readonly tags: ReadonlyArray<JSDocTag>
}

interface ProgramCacheEntry {
  readonly program?: ts.Program
  readonly modulesByName?: ReadonlyMap<string, ts.Symbol>
  readonly error?: string
  reported: boolean
}

interface PackageMetadata {
  readonly root: string
  readonly sourceRoot: string
  readonly name: string
  readonly exports: unknown
}

interface PackageExportMatch {
  readonly key: string
  readonly value: unknown
  readonly star: string | null
  readonly specificity: number
  readonly prefixLength: number
}

interface ParsedConfigResult {
  readonly parsed?: ts.ParsedCommandLine
  readonly error?: string
}

const programCache = new Map<string, ProgramCacheEntry>()
const packageMetadataCache = new Map<string, Result<PackageMetadata, string>>()
const barrelExportCache = new Map<string, Result<ParsedBarrelExports, string>>()
const tagOrder = new Map([
  ["deprecated", 0],
  ["default", 1],
  ["see", 2],
  ["category", 3],
  ["since", 4]
])

const stableSemverRegex = /^\d+\.\d+\.\d+$/
const urlRegex = /^https?:\/\//

function diagnostic(code: string, message: string): JSDocDiagnostic {
  return { code, message }
}

function normalizePathName(filePath: string): string {
  return filePath.replaceAll(path.sep, "/")
}

function normalizePackagePath(filePath: string): string {
  return normalizePathName(filePath).replace(/^\.\//, "./")
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

/**
 * Creates a predicate that checks whether a filename is included by the configured JSDoc globs.
 *
 * @category constructors
 * @since 4.0.0
 */
export function createJSDocFileMatcher(options: {
  readonly cwd: string
  readonly include?: ReadonlyArray<string>
  readonly exclude?: ReadonlyArray<string>
}): (filename: string) => boolean {
  const include = options.include?.map(globToRegExp)
  const exclude = options.exclude?.map(globToRegExp)
  return (filename) => {
    const normalizedFilename = normalizePathName(filename)
    const relativeFilename = normalizePathName(path.relative(options.cwd, filename))
    const matches = (regexp: RegExp) => regexp.test(normalizedFilename) || regexp.test(relativeFilename)
    if (include !== undefined && !include.some(matches)) {
      return false
    }
    if (exclude !== undefined && exclude.some(matches)) {
      return false
    }
    return true
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function findPackageRoot(filename: string): string | undefined {
  let directory = path.dirname(path.resolve(filename))
  while (true) {
    const packageJsonPath = path.join(directory, "package.json")
    if (fs.existsSync(packageJsonPath)) {
      return directory
    }
    const parent = path.dirname(directory)
    if (parent === directory) {
      return undefined
    }
    directory = parent
  }
}

function readPackageMetadata(root: string): Result<PackageMetadata, string> {
  const normalizedRoot = path.resolve(root)
  const cached = packageMetadataCache.get(normalizedRoot)
  if (cached !== undefined) {
    return cached
  }
  const packageJsonPath = path.join(normalizedRoot, "package.json")
  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
  } catch (error) {
    const result = {
      _tag: "Failure",
      error: `unable to read package.json at ${packageJsonPath}: ${String(error)}`
    } as const
    packageMetadataCache.set(normalizedRoot, result)
    return result
  }
  if (!isRecord(parsed)) {
    const result = { _tag: "Failure", error: `package.json at ${packageJsonPath} must be an object` } as const
    packageMetadataCache.set(normalizedRoot, result)
    return result
  }
  if (typeof parsed.name !== "string" || parsed.name.length === 0) {
    const result = {
      _tag: "Failure",
      error: `package.json at ${packageJsonPath} must include a non-empty name`
    } as const
    packageMetadataCache.set(normalizedRoot, result)
    return result
  }
  if (parsed.exports === undefined) {
    const result = { _tag: "Failure", error: `package.json at ${packageJsonPath} must include exports` } as const
    packageMetadataCache.set(normalizedRoot, result)
    return result
  }
  const result = {
    _tag: "Success",
    value: {
      root: normalizedRoot,
      sourceRoot: path.join(normalizedRoot, "src"),
      name: parsed.name,
      exports: parsed.exports
    }
  } as const
  packageMetadataCache.set(normalizedRoot, result)
  return result
}

function parseBarrelExports(indexPath: string): Result<ParsedBarrelExports, string> {
  const normalizedIndexPath = path.resolve(indexPath)
  const cached = barrelExportCache.get(normalizedIndexPath)
  if (cached !== undefined) {
    return cached
  }
  let source: string
  try {
    source = fs.readFileSync(normalizedIndexPath, "utf8")
  } catch (error) {
    const result = {
      _tag: "Failure",
      error: `unable to read barrel file ${normalizedIndexPath}: ${String(error)}`
    } as const
    barrelExportCache.set(normalizedIndexPath, result)
    return result
  }
  const sourceFile = ts.createSourceFile(normalizedIndexPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const namespace = new Map<string, string>()
  const flat = new Set<string>()
  for (const statement of sourceFile.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      const moduleSpecifier = normalizePathName(statement.moduleSpecifier.text)
      if (statement.exportClause === undefined) {
        flat.add(moduleSpecifier)
      } else if (ts.isNamespaceExport(statement.exportClause)) {
        namespace.set(moduleSpecifier, statement.exportClause.name.text)
      }
    }
  }
  const result = { _tag: "Success", value: { namespace, flat } } as const
  barrelExportCache.set(normalizedIndexPath, result)
  return result
}

function getPackageExportMatch(exports: unknown, subpath: string): PackageExportMatch | undefined {
  if (!isRecord(exports)) {
    return subpath === "." ? { key: ".", value: exports, star: null, specificity: 1, prefixLength: 1 } : undefined
  }
  if (Object.hasOwn(exports, subpath)) {
    return {
      key: subpath,
      value: exports[subpath],
      star: null,
      specificity: Number.MAX_SAFE_INTEGER,
      prefixLength: subpath.length
    }
  }
  const matches: Array<PackageExportMatch> = []
  for (const [key, value] of Object.entries(exports)) {
    const starIndex = key.indexOf("*")
    if (!key.startsWith(".") || starIndex === -1) {
      continue
    }
    const prefix = key.slice(0, starIndex)
    const suffix = key.slice(starIndex + 1)
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) {
      continue
    }
    matches.push({
      key,
      value,
      star: subpath.slice(prefix.length, subpath.length - suffix.length),
      specificity: prefix.length + suffix.length,
      prefixLength: prefix.length
    })
  }
  return matches.sort((a, b) =>
    b.specificity - a.specificity || b.prefixLength - a.prefixLength || b.key.length - a.key.length
  )[0]
}

function packageExportTargetMatches(value: unknown, star: string | null, expectedTarget: string): boolean {
  if (typeof value === "string") {
    const target = normalizePackagePath(star === null ? value : value.replaceAll("*", star))
    return target === expectedTarget
  }
  if (value === null || value === undefined) {
    return false
  }
  if (Array.isArray(value)) {
    return value.some((item) => packageExportTargetMatches(item, star, expectedTarget))
  }
  if (isRecord(value)) {
    return Object.values(value).some((item) => packageExportTargetMatches(item, star, expectedTarget))
  }
  return false
}

function isPackageSubpathExported(
  packageExports: unknown,
  subpath: string,
  expectedTarget: string
): boolean {
  const match = getPackageExportMatch(packageExports, subpath)
  return match !== undefined && packageExportTargetMatches(match.value, match.star, expectedTarget)
}

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function packageSpecifier(packageName: string, subpath: string): string {
  return subpath === "" ? packageName : `${packageName}/${subpath}`
}

function resolveBarrelImport(
  metadata: PackageMetadata,
  filename: string
): Result<ParsedJSDocBarrelImport | null, string> {
  let directory = path.dirname(filename)
  while (isPathInside(metadata.sourceRoot, directory)) {
    const indexPath = path.join(directory, "index.ts")
    if (indexPath !== filename && fs.existsSync(indexPath)) {
      const expectedExport = `./${normalizePathName(path.relative(directory, filename))}`
      const parsed = parseBarrelExports(indexPath)
      if (parsed._tag === "Failure") {
        return parsed
      }
      const barrelSubpath = normalizePathName(path.relative(metadata.sourceRoot, directory))
      const exportSubpath = barrelSubpath === "" ? "." : `./${barrelSubpath}`
      const exportTarget = barrelSubpath === "" ? "./src/index.ts" : `./src/${barrelSubpath}/index.ts`
      if (isPackageSubpathExported(metadata.exports, exportSubpath, exportTarget)) {
        const moduleSpecifier = packageSpecifier(metadata.name, barrelSubpath)
        const namespace = parsed.value.namespace.get(expectedExport)
        if (namespace !== undefined) {
          return {
            _tag: "Success",
            value: { type: "namespace", module: moduleSpecifier, name: namespace }
          }
        }
        if (parsed.value.flat.has(expectedExport)) {
          return {
            _tag: "Success",
            value: { type: "flat", module: moduleSpecifier }
          }
        }
      }
    }
    if (directory === metadata.sourceRoot) {
      break
    }
    directory = path.dirname(directory)
  }
  return { _tag: "Success", value: null }
}

function resolveJSDocImports(
  cwd: string,
  filename: string
): Result<ParsedJSDocImports, string> {
  const absoluteFilename = path.resolve(filename)
  const packageRoot = findPackageRoot(absoluteFilename)
  const relativeFilename = normalizePathName(path.relative(cwd, absoluteFilename))
  if (packageRoot === undefined) {
    return { _tag: "Failure", error: `no package.json found for ${relativeFilename}` }
  }
  const metadata = readPackageMetadata(packageRoot)
  if (metadata._tag === "Failure") {
    return metadata
  }
  const relativeToSourceRoot = normalizePathName(path.relative(metadata.value.sourceRoot, absoluteFilename))
  if (!isPathInside(metadata.value.sourceRoot, absoluteFilename)) {
    return {
      _tag: "Failure",
      error: `${relativeFilename} is not under ${normalizePathName(path.relative(cwd, metadata.value.sourceRoot))}`
    }
  }
  if (path.basename(absoluteFilename) === "index.ts") {
    return {
      _tag: "Failure",
      error: `${relativeFilename} is a barrel file; exclude it from jsdocs`
    }
  }
  if (path.extname(absoluteFilename) !== ".ts" || absoluteFilename.endsWith(".d.ts")) {
    return {
      _tag: "Failure",
      error: `${relativeFilename} is not a TypeScript source module`
    }
  }
  const moduleSubpath = relativeToSourceRoot.slice(0, -".ts".length)
  const moduleExportSubpath = `./${moduleSubpath}`
  const moduleExportTarget = `./src/${relativeToSourceRoot}`
  if (!isPackageSubpathExported(metadata.value.exports, moduleExportSubpath, moduleExportTarget)) {
    return {
      _tag: "Failure",
      error: `package.json exports do not expose ${
        packageSpecifier(metadata.value.name, moduleSubpath)
      } for ${relativeFilename}`
    }
  }
  const barrel = resolveBarrelImport(metadata.value, absoluteFilename)
  if (barrel._tag === "Failure") {
    return barrel
  }
  return {
    _tag: "Success",
    value: {
      module: packageSpecifier(metadata.value.name, moduleSubpath),
      barrel: barrel.value
    }
  }
}

export function getSourceText(context: {
  readonly sourceCode: { readonly text?: string; getText(node?: unknown): string }
}): string {
  return context.sourceCode.text ?? context.sourceCode.getText()
}

export function getCwd(context: { readonly cwd?: string; getCwd?: () => string }): string {
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

export function findLeadingJSDoc(
  source: string,
  node: AstNode,
  ignoredRange?: [number, number]
): JSDocBlock | undefined {
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
  return parseJSDocBlock(source.slice(start, end), range)
}

/**
 * Parses one raw JSDoc block into the standard description, example, and tag structure.
 *
 * **Details**
 *
 * The block must have one short description paragraph, optional `When to use`, `Details`, and `Gotchas` sections in that order, then any example sections before tags. Example titles must be unique after trimming and lowercasing, each example must contain exactly one non-empty TypeScript code fence, and boundaries between sections, examples, and tags must use exactly one blank line.
 *
 * **Example** (Parsing a block)
 *
 * ```ts
 * const rawBlock = [
 *   "/" + "**",
 *   " * A value.",
 *   " *",
 *   " * @category models",
 *   " * @since 4.0.0",
 *   " *" + "/"
 * ].join("\n")
 * const result = parseJSDoc(rawBlock)
 * ```
 *
 * @category parsing
 * @since 4.0.0
 */
export function parseJSDoc(raw: string): Result<ParsedCoreJSDoc, JSDocParseError> {
  const block = parseJSDocBlock(raw, [0, raw.length])
  if (block.internal) {
    return { _tag: "Failure", error: { diagnostics: [diagnostic("internal", "Internal JSDoc blocks are ignored")] } }
  }
  if (block.diagnostics.length > 0 || block.parsed === undefined) {
    return { _tag: "Failure", error: { diagnostics: block.diagnostics } }
  }
  return { _tag: "Success", value: block.parsed }
}

function parseJSDocBlock(raw: string, range: [number, number]): JSDocBlock {
  const body = raw.replace(/^\/\*\*/, "").replace(/\*\/$/, "")
  const rawLines = body.split(/\r\n|\r|\n/)
  const lines = rawLines.map((line) => line.replace(/^\s*\* ?/, "").trimEnd())
  const normalized = trimStructuralBlankLines(lines)
  const tags = parseTags(normalized)
  const internal = tags.some((tag) => tag.name === "internal")
  if (internal) {
    return { range, raw, lines: normalized, tags, diagnostics: [], internal }
  }
  const result = parseCoreJSDoc(normalized, tags)
  const block: JSDocBlock = {
    range,
    raw,
    lines: normalized,
    tags,
    diagnostics: result._tag === "Failure" ? Array.from(result.error.diagnostics) : [],
    internal
  }
  return result._tag === "Success" ? { ...block, parsed: result.value } : block
}

function trimStructuralBlankLines(lines: Array<string>): Array<string> {
  let start = 0
  let end = lines.length
  if (lines[start]?.trim() === "") {
    start++
  }
  if (end > start && lines[end - 1]?.trim() === "") {
    end--
  }
  return lines.slice(start, end)
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

function parseCoreJSDoc(lines: Array<string>, tags: Array<JSDocTag>): Result<ParsedCoreJSDoc, JSDocParseError> {
  const diagnostics: Array<JSDocDiagnostic> = []
  const firstTagLine = tags[0]?.line ?? lines.length
  const content = lines.slice(0, firstTagLine)

  if (lines.length === 0) {
    diagnostics.push(diagnostic("missing-description", "JSDoc must include a short description"))
  }
  if (content.at(-1)?.trim() === "" && tags.length > 0) {
    // exactly one blank before tags is validated by ensuring the last content line is blank and the previous is not blank
    if (content.length < 2 || content[content.length - 2]?.trim() === "") {
      diagnostics.push(
        diagnostic("invalid-spacing", "JSDoc tags must be separated from description content by exactly one blank line")
      )
    }
  } else if (tags.length > 0 && content.length > 0) {
    diagnostics.push(
      diagnostic("invalid-spacing", "JSDoc tags must be separated from description content by exactly one blank line")
    )
  }

  if (content[0]?.trim() === "") {
    diagnostics.push(diagnostic("leading-blank", "JSDoc must not start with a blank line"))
  }
  const contentWithoutTagBlank = tags.length > 0 && content.at(-1)?.trim() === "" ? content.slice(0, -1) : content
  if (contentWithoutTagBlank.at(-1)?.trim() === "") {
    diagnostics.push(diagnostic("trailing-blank", "JSDoc description must not end with a blank line"))
  }

  const parsedContent = parseDescriptionContent(contentWithoutTagBlank)
  diagnostics.push(...parsedContent.diagnostics)

  if (diagnostics.length > 0 || parsedContent.value === undefined) {
    return { _tag: "Failure", error: { diagnostics: uniqueDiagnostics(diagnostics) } }
  }
  return {
    _tag: "Success",
    value: {
      description: parsedContent.value.description,
      examples: parsedContent.value.examples,
      tags
    }
  }
}

function uniqueDiagnostics(
  diagnostics: ReadonlyArray<JSDocDiagnostic>
): ReadonlyArray<JSDocDiagnostic> {
  const seen = new Set<string>()
  return diagnostics.filter((item) => {
    const key = `${item.code}:${item.message}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const standardHeadings = ["**When to use**", "**Details**", "**Gotchas**"] as const

type StandardHeading = typeof standardHeadings[number]

interface ParsedContentResult {
  readonly value?: {
    readonly description: ParsedDescription
    readonly examples: ReadonlyArray<ParsedExample>
  }
  readonly diagnostics: ReadonlyArray<JSDocDiagnostic>
}

function parseDescriptionContent(lines: Array<string>): ParsedContentResult {
  const diagnostics: Array<JSDocDiagnostic> = []
  const sections: Record<StandardHeading, string | null> = {
    "**When to use**": null,
    "**Details**": null,
    "**Gotchas**": null
  }
  const examples: Array<ParsedExample> = []
  const exampleTitles = new Set<string>()
  let index = 0
  let currentSectionOrder = -1
  let examplesStarted = false

  while (index < lines.length && lines[index].trim() !== "" && !isHeadingLine(lines[index])) {
    if (isForbiddenMarkdownHeading(lines[index], false)) {
      diagnostics.push(diagnostic("invalid-heading", "Markdown headings are not allowed in JSDoc descriptions"))
    }
    index++
  }

  const shortLines = lines.slice(0, index)
  if (shortLines.length === 0 || joinBody(shortLines).trim() === "") {
    diagnostics.push(diagnostic("missing-description", "JSDoc must include a short description"))
  }
  if (index < lines.length && lines[index].trim() === "") {
    const next = lines[index + 1]
    if (next !== undefined && !isHeadingLine(next)) {
      diagnostics.push(diagnostic("multiple-description-paragraphs", "JSDoc short description must be one paragraph"))
    }
  }

  while (index < lines.length) {
    if (lines[index].trim() !== "") {
      diagnostics.push(diagnostic("invalid-spacing", "JSDoc sections must be separated by exactly one blank line"))
      break
    }
    if (lines[index + 1]?.trim() === "") {
      diagnostics.push(diagnostic("invalid-spacing", "JSDoc sections must be separated by exactly one blank line"))
      while (lines[index + 1]?.trim() === "") index++
    }
    index++
    if (index >= lines.length) {
      break
    }

    const line = lines[index].trim()
    if (line.startsWith("**Example**")) {
      examplesStarted = true
      const parsed = parseExample(lines, index)
      diagnostics.push(...parsed.diagnostics)
      if (parsed.example !== undefined) {
        const key = parsed.example.title.trim().toLowerCase()
        if (exampleTitles.has(key)) {
          diagnostics.push(diagnostic("duplicate-example", `Duplicate example title: ${parsed.example.title.trim()}`))
        }
        exampleTitles.add(key)
        examples.push(parsed.example)
      }
      index = parsed.nextIndex
      continue
    }

    const heading = standardHeadings.find((candidate) => candidate === line)
    if (heading !== undefined) {
      if (examplesStarted) {
        diagnostics.push(diagnostic("section-after-example", `${heading} must appear before examples`))
      }
      const order = standardHeadings.indexOf(heading)
      if (order <= currentSectionOrder) {
        diagnostics.push(diagnostic("section-out-of-order", `${heading} is out of order or duplicated`))
      }
      currentSectionOrder = Math.max(currentSectionOrder, order)
      if (sections[heading] !== null) {
        diagnostics.push(diagnostic("duplicate-section", `${heading} may appear at most once`))
      }
      const parsed = parseSection(lines, index)
      diagnostics.push(...parsed.diagnostics)
      sections[heading] = parsed.body
      index = parsed.nextIndex
      continue
    }

    if (isNearMissHeading(line)) {
      diagnostics.push(diagnostic("invalid-heading", `Invalid JSDoc section heading: ${line}`))
      index++
      continue
    }
    if (isBoldOnlyLine(line)) {
      diagnostics.push(diagnostic("unknown-heading", `Unknown JSDoc section heading: ${line}`))
      index++
      continue
    }
    if (isForbiddenMarkdownHeading(line, false)) {
      diagnostics.push(diagnostic("invalid-heading", "Markdown headings are not allowed in JSDoc descriptions"))
      index++
      continue
    }
    diagnostics.push(
      diagnostic("invalid-description", "JSDoc description content must appear under a standard section heading")
    )
    index++
  }

  if (diagnostics.length > 0) {
    return { diagnostics }
  }
  return {
    value: {
      description: {
        short: joinBody(shortLines),
        whenToUse: sections["**When to use**"],
        details: sections["**Details**"],
        gotchas: sections["**Gotchas**"]
      },
      examples
    },
    diagnostics
  }
}

function parseSection(lines: Array<string>, headingIndex: number): {
  readonly body: string | null
  readonly nextIndex: number
  readonly diagnostics: ReadonlyArray<JSDocDiagnostic>
} {
  const diagnostics: Array<JSDocDiagnostic> = []
  if (lines[headingIndex + 1]?.trim() !== "") {
    diagnostics.push(
      diagnostic("invalid-spacing", `${lines[headingIndex].trim()} must be followed by exactly one blank line`)
    )
  }
  let index = headingIndex + 2
  const bodyStart = index
  let inFence = false
  while (index < lines.length) {
    const trimmed = lines[index].trim()
    if (trimmed.startsWith("```")) {
      if (trimmed === "```ts") {
        diagnostics.push(diagnostic("loose-ts-fence", "TypeScript examples must use **Example** (Title) sections"))
      }
      inFence = !inFence
    }
    if (!inFence && trimmed === "" && isHeadingLine(lines[index + 1])) {
      break
    }
    if (!inFence && trimmed !== "" && isForbiddenMarkdownHeading(trimmed, false)) {
      diagnostics.push(diagnostic("invalid-heading", "Markdown headings are not allowed in JSDoc descriptions"))
    }
    if (
      !inFence && isBoldOnlyLine(trimmed) && !standardHeadings.includes(trimmed as StandardHeading) &&
      !trimmed.startsWith("**Example**")
    ) {
      diagnostics.push(diagnostic("unknown-heading", `Unknown JSDoc section heading: ${trimmed}`))
    }
    index++
  }
  const bodyLines = lines.slice(bodyStart, index)
  if (joinBody(bodyLines).trim() === "") {
    diagnostics.push(diagnostic("empty-section", `${lines[headingIndex].trim()} must have a non-empty body`))
  }
  if (bodyLines.at(-1)?.trim() === "") {
    diagnostics.push(diagnostic("invalid-spacing", "Section bodies must not end with extra blank lines"))
  }
  return { body: joinBody(bodyLines), nextIndex: index, diagnostics }
}

function parseExample(lines: Array<string>, headingIndex: number): {
  readonly example?: ParsedExample
  readonly nextIndex: number
  readonly diagnostics: ReadonlyArray<JSDocDiagnostic>
} {
  const diagnostics: Array<JSDocDiagnostic> = []
  const heading = lines[headingIndex].trim()
  const match = /^\*\*Example\*\* \((.+)\)$/.exec(heading)
  if (!match || match[1].trim() === "") {
    diagnostics.push(diagnostic("malformed-example", "TypeScript examples must use **Example** (Title)"))
  }
  if (lines[headingIndex + 1]?.trim() !== "") {
    diagnostics.push(diagnostic("invalid-spacing", "Example headings must be followed by exactly one blank line"))
  }

  let index = headingIndex + 2
  const bodyStart = index
  let fenceIndex = -1
  while (index < lines.length) {
    const trimmed = lines[index].trim()
    if (trimmed === "```ts") {
      fenceIndex = index
      break
    }
    if (trimmed.startsWith("```")) {
      diagnostics.push(diagnostic("malformed-example", "Examples may only contain one TypeScript code fence"))
    }
    if (trimmed === "" && isHeadingLine(lines[index + 1])) {
      break
    }
    if (trimmed.startsWith("@")) {
      break
    }
    index++
  }

  if (fenceIndex === -1) {
    diagnostics.push(diagnostic("malformed-example", "Examples must include a non-empty ```ts fence"))
    return { nextIndex: index, diagnostics }
  }

  const bodyLines = lines.slice(bodyStart, fenceIndex)
  const nonEmptyBody = joinBody(bodyLines).trim() !== ""
  if (nonEmptyBody && bodyLines.at(-1)?.trim() !== "") {
    diagnostics.push(
      diagnostic("invalid-spacing", "Example prose must be separated from code by exactly one blank line")
    )
  }
  const prose = nonEmptyBody ? joinBody(bodyLines.slice(0, bodyLines.at(-1)?.trim() === "" ? -1 : undefined)) : null

  index = fenceIndex + 1
  const codeStart = index
  while (index < lines.length && lines[index].trim() !== "```") {
    if (lines[index].trim() === "```ts") {
      diagnostics.push(diagnostic("malformed-example", "Examples must contain exactly one TypeScript code fence"))
    }
    index++
  }
  const codeLines = lines.slice(codeStart, index)
  if (index >= lines.length) {
    diagnostics.push(diagnostic("malformed-example", "Examples must close the TypeScript code fence"))
  }
  if (joinBody(codeLines).trim() === "") {
    diagnostics.push(diagnostic("malformed-example", "Examples must include non-empty TypeScript code"))
  }
  index++
  if (index < lines.length && lines[index].trim() !== "" && !lines[index].trim().startsWith("@")) {
    diagnostics.push(
      diagnostic("invalid-spacing", "Examples must be separated from following content by exactly one blank line")
    )
  }

  const result = { nextIndex: index, diagnostics }
  return match
    ? { ...result, example: { title: match[1].trim(), body: prose, code: joinBody(codeLines) } }
    : result
}

function joinBody(lines: ReadonlyArray<string>): string {
  let start = 0
  let end = lines.length
  while (start < end && lines[start]?.trim() === "") start++
  while (end > start && lines[end - 1]?.trim() === "") end--
  return lines.slice(start, end).join("\n")
}

function isHeadingLine(line: string | undefined): boolean {
  if (line === undefined) return false
  const trimmed = line.trim()
  return standardHeadings.includes(trimmed as StandardHeading) || trimmed.startsWith("**Example**") ||
    isNearMissHeading(trimmed) || isBoldOnlyLine(trimmed) || isForbiddenMarkdownHeading(trimmed, false)
}

function isNearMissHeading(line: string): boolean {
  return /^\*\*(When to use|When To Use|Details|Gotchas).*\*\*/.test(line) &&
    !standardHeadings.includes(line as StandardHeading)
}

function isBoldOnlyLine(line: string): boolean {
  return /^\*\*[^*]+\*\*(?:\s*)$/.test(line)
}

function isForbiddenMarkdownHeading(line: string, inFence: boolean): boolean {
  return !inFence && /^#{1,6}\s+/.test(line.trim())
}

function parseSeeTag(value: string): ParsedSeeTag {
  return { text: value, links: extractParsedInlineLinks(value) }
}

function extractParsedInlineLinks(source: string): ReadonlyArray<ParsedInlineLink> {
  const links: Array<ParsedInlineLink> = []
  let index = source.indexOf("{@link")
  while (index !== -1) {
    if (!isInlineLinkStart(source, index)) {
      index = source.indexOf("{@link", index + 1)
      continue
    }
    const end = source.indexOf("}", index + "{@link".length)
    if (end === -1) {
      break
    }
    const raw = source.slice(index, end + 1)
    const content = raw.slice("{@link".length, -1).trim()
    const pipeIndex = content.indexOf("|")
    const beforeLabel = pipeIndex === -1 ? content : content.slice(0, pipeIndex).trim()
    const target = beforeLabel.split(/\s+/)[0] ?? ""
    const text = pipeIndex === -1
      ? beforeLabel.slice(target.length).trim() || null
      : content.slice(pipeIndex + 1).trim() || null
    links.push({ raw, target, text })
    index = source.indexOf("{@link", end + 1)
  }
  return links
}

function buildTags(
  scope: DocScope,
  tags: ReadonlyArray<JSDocTag>
): Result<ParsedDeclarationTags | ParsedNamespaceTags | ParsedMemberTags, JSDocParseError> {
  const diagnostics: Array<JSDocDiagnostic> = []
  const allowed = scope === "declaration"
    ? new Set(["deprecated", "see", "category", "since"])
    : scope === "member"
    ? new Set(["deprecated", "default", "see", "since"])
    : new Set(["deprecated", "see", "category", "since"])
  let previousOrder = -1
  const values = new Map<string, Array<string>>()

  for (const tag of tags) {
    if (tag.name === "internal") {
      continue
    }
    if (tag.name === "example") {
      diagnostics.push(
        diagnostic("forbidden-tag", "@example is not allowed; use a canonical **Example** (Title) section")
      )
      continue
    }
    if (!allowed.has(tag.name)) {
      diagnostics.push(
        diagnostic(
          "forbidden-tag",
          `@${tag.name} is not allowed in ${scope === "namespace-declaration" ? "namespace" : scope} JSDoc`
        )
      )
      continue
    }
    const order = tagOrder.get(tag.name) ?? previousOrder
    if (order < previousOrder) {
      diagnostics.push(diagnostic("tag-out-of-order", `@${tag.name} is out of order in JSDoc`))
    }
    previousOrder = Math.max(previousOrder, order)
    values.set(tag.name, [...values.get(tag.name) ?? [], tag.value.trim()])
  }

  const singletonTags = scope === "member" ? ["deprecated", "default", "since"] : ["deprecated", "category", "since"]
  for (const tag of singletonTags) {
    if ((values.get(tag)?.length ?? 0) > 1) {
      diagnostics.push(diagnostic("duplicate-tag", `JSDoc blocks may contain at most one @${tag} tag`))
    }
  }

  const see = values.get("see") ?? []
  for (const value of see) {
    if (value === "") {
      diagnostics.push(diagnostic("empty-tag", "@see must include a value"))
    }
  }
  const deprecated = values.get("deprecated")?.[0] ?? null
  if (deprecated === "") diagnostics.push(diagnostic("empty-tag", "@deprecated must include a message"))
  const since = values.get("since")?.[0] ?? null
  if ((scope === "declaration" || scope === "namespace" || scope === "namespace-declaration") && since === null) {
    diagnostics.push(
      diagnostic(
        "missing-tag",
        scope === "declaration" ? "Public JSDoc must include @since" : "Namespace JSDoc must include @since"
      )
    )
  }
  if (since !== null && !stableSemverRegex.test(since)) {
    diagnostics.push(diagnostic("invalid-since", "@since must be a stable semver version like 1.2.3"))
  }

  if (scope === "declaration") {
    const category = values.get("category")?.[0] ?? null
    if (category === null) diagnostics.push(diagnostic("missing-tag", "Public JSDoc must include @category"))
    if (category === "") diagnostics.push(diagnostic("empty-tag", "@category must include a value"))
    if (diagnostics.length > 0 || category === null || since === null) {
      return { _tag: "Failure", error: { diagnostics } }
    }
    return { _tag: "Success", value: { category, since, deprecated, see: see.map(parseSeeTag) } }
  }

  if (scope === "member") {
    const defaultValue = values.get("default")?.[0] ?? null
    if (defaultValue === "") diagnostics.push(diagnostic("empty-tag", "@default must include a value"))
    if (diagnostics.length > 0) return { _tag: "Failure", error: { diagnostics } }
    return { _tag: "Success", value: { since, default: defaultValue, deprecated, see: see.map(parseSeeTag) } }
  }

  const category = values.get("category")?.[0] ?? null
  if (category === "") diagnostics.push(diagnostic("empty-tag", "@category must include a value"))
  if (diagnostics.length > 0 || since === null) return { _tag: "Failure", error: { diagnostics } }
  return { _tag: "Success", value: { category, since, deprecated, see: see.map(parseSeeTag) } }
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
}

function parseTsConfig(tsconfigPath: string): ParsedConfigResult {
  const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
  if (config.error !== undefined) {
    return { error: `Unable to read TypeScript config ${tsconfigPath}: ${formatDiagnostic(config.error)}` }
  }

  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(tsconfigPath))
  if (parsed.errors.length > 0) {
    return {
      error: `Unable to parse TypeScript config ${tsconfigPath}: ${parsed.errors.map(formatDiagnostic).join("; ")}`
    }
  }
  return { parsed }
}

function collectTsConfigFiles(tsconfigPath: string, seen: Set<string>, fileNames: Set<string>): ParsedConfigResult {
  if (seen.has(tsconfigPath)) return {}
  seen.add(tsconfigPath)
  const result = parseTsConfig(tsconfigPath)
  if (result.error !== undefined || result.parsed === undefined) return result
  for (const fileName of result.parsed.fileNames) fileNames.add(fileName)
  for (const reference of result.parsed.projectReferences ?? []) {
    const referenceResult = collectTsConfigFiles(ts.resolveProjectReferencePath(reference), seen, fileNames)
    if (referenceResult.error !== undefined) return referenceResult
  }
  return result
}

export function getProgram(tsconfigPath: string): ProgramCacheEntry {
  const cached = programCache.get(tsconfigPath)
  if (cached !== undefined) return cached
  const fileNames = new Set<string>()
  const result = collectTsConfigFiles(tsconfigPath, new Set(), fileNames)
  if (result.error !== undefined || result.parsed === undefined) {
    const entry = { error: result.error ?? `Unable to parse TypeScript config ${tsconfigPath}`, reported: false }
    programCache.set(tsconfigPath, entry)
    return entry
  }
  const program = ts.createProgram(Array.from(fileNames), result.parsed.options)
  const entry = { program, ...createProgramSymbolIndex(program), reported: false }
  programCache.set(tsconfigPath, entry)
  return entry
}

function createProgramSymbolIndex(program: ts.Program) {
  const checker = program.getTypeChecker()
  const modulesByName = new Map<string, ts.Symbol>()
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
    if (moduleSymbol === undefined) continue
    const moduleName = path.basename(sourceFile.fileName, path.extname(sourceFile.fileName))
    modulesByName.set(moduleName, moduleSymbol)
    modulesByName.set(`${moduleName}_`, moduleSymbol)
  }
  return { modulesByName }
}

function getExport(symbol: ts.Symbol, name: string, checker: ts.TypeChecker, location: ts.Node): ts.Symbol | undefined {
  const target = (symbol.flags & ts.SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol)
  if (target.exports?.has(name as ts.__String)) return target.exports.get(name as ts.__String)
  if (target.members?.has(name as ts.__String)) return target.members.get(name as ts.__String)
  return checker.getTypeOfSymbolAtLocation(target, location).getProperty(name) ??
    checker.getDeclaredTypeOfSymbol(target).getProperty(name)
}

function resolveDottedSymbol(
  root: ts.Symbol | undefined,
  parts: ReadonlyArray<string>,
  checker: ts.TypeChecker,
  location: ts.Node
): ts.Symbol | undefined {
  let current = root
  for (const part of parts) {
    if (current === undefined) return undefined
    current = getExport(current, part, checker, location)
  }
  return current
}

function resolveJSDocLinkSymbol(
  link: ts.JSDocLink,
  target: string,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  entry: ProgramCacheEntry
): ts.Symbol | undefined {
  if (link.name !== undefined) {
    const symbol = checker.getSymbolAtLocation(link.name)
    if (symbol !== undefined) return symbol
  }
  const parts = target.split(".")
  if (parts.some((part) => part === "")) return undefined
  const [root, ...members] = parts
  if (root === undefined) return undefined
  const sourceModule = checker.getSymbolAtLocation(sourceFile)
  const lexical = checker.resolveName(root, sourceFile, ts.SymbolFlags.All, false)
  const candidates = [
    lexical,
    sourceModule === undefined ? undefined : getExport(sourceModule, root, checker, sourceFile),
    entry.modulesByName?.get(root)
  ]
  return candidates.map((candidate) => resolveDottedSymbol(candidate, members, checker, sourceFile)).find((symbol) =>
    symbol !== undefined
  )
}

function isInlineLinkStart(source: string, index: number): boolean {
  if (!source.startsWith("{@link", index)) return false
  const next = source[index + "{@link".length]
  return next === undefined || /\s|}/.test(next)
}

function hasInlineLink(block: JSDocBlock): boolean {
  return block.lines.some((line) => {
    let index = line.indexOf("{@link")
    while (index !== -1) {
      if (isInlineLinkStart(line, index)) return true
      index = line.indexOf("{@link", index + 1)
    }
    return false
  })
}

function extractInlineLinkTarget(linkText: string): string {
  const content = linkText.slice("{@link".length, linkText.endsWith("}") ? -1 : undefined).trim()
  const pipeIndex = content.indexOf("|")
  const beforeLabel = pipeIndex === -1 ? content : content.slice(0, pipeIndex).trim()
  return beforeLabel.split(/\s+/)[0] ?? ""
}

function malformedInlineLinks(block: JSDocBlock): Array<string> {
  const source = block.lines.join("\n")
  const malformed: Array<string> = []
  let index = source.indexOf("{@link")
  while (index !== -1) {
    if (!isInlineLinkStart(source, index)) {
      index = source.indexOf("{@link", index + 1)
      continue
    }
    const end = source.indexOf("}", index + "{@link".length)
    const text = end === -1 ? source.slice(index).split(/\r?\n/, 1)[0] : source.slice(index, end + 1)
    if (end === -1 || extractInlineLinkTarget(text) === "") malformed.push(text)
    index = source.indexOf("{@link", end === -1 ? index + 1 : end + 1)
  }
  return malformed
}

function collectJSDocLinks(sourceFile: ts.SourceFile, block: JSDocBlock): Array<ts.JSDocLink> {
  const links: Array<ts.JSDocLink> = []
  function inspectJSDoc(node: ts.Node) {
    for (const jsdoc of (node as { readonly jsDoc?: ReadonlyArray<ts.JSDoc> }).jsDoc ?? []) {
      if (jsdoc.pos !== block.range[0] || jsdoc.end !== block.range[1]) continue
      ts.forEachChild(jsdoc, function visit(child) {
        if (ts.isJSDocLink(child)) links.push(child)
        ts.forEachChild(child, visit)
      })
    }
  }
  function visit(node: ts.Node) {
    inspectJSDoc(node)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return links
}

export interface JSDocModelDiagnostic extends JSDocDiagnostic {
  readonly range: readonly [number, number]
}

export interface JSDocModelFile extends ParsedJSDocFile {
  readonly file: string
  readonly hash: string
  readonly diagnostics: ReadonlyArray<JSDocModelDiagnostic>
  readonly imports?: ParsedJSDocImports
}

export interface JSDocModel {
  readonly version: 1
  readonly generatedBy: "@effect/jsdocs"
  readonly generatedAt: string
  readonly files: ReadonlyArray<JSDocModelFile>
}

export interface JSDocConfig {
  readonly tsconfig: string
  readonly include: ReadonlyArray<string>
  readonly exclude?: ReadonlyArray<string>
  readonly output: string
}

export interface ExtractJSDocsOptions extends JSDocConfig {
  readonly cwd?: string
}

function nodeRange(node: ts.Node): [number, number] {
  return [node.getStart(), node.getEnd()]
}

function normalizeFile(cwd: string, filename: string): string {
  return normalizePathName(path.relative(cwd, filename))
}

function hashSource(source: string): string {
  return crypto.createHash("sha256").update(source).digest("hex")
}

function getNodeJSDoc(node: ts.Node): JSDocBlock | undefined {
  const jsDocs = (node as { readonly jsDoc?: ReadonlyArray<ts.JSDoc> }).jsDoc
  const jsDoc = jsDocs?.[jsDocs.length - 1]
  if (jsDoc === undefined) return undefined
  const source = node.getSourceFile().text
  return parseJSDocBlock(source.slice(jsDoc.pos, jsDoc.end), [jsDoc.pos, jsDoc.end])
}

function addModelDiagnostics(
  out: Array<JSDocModelDiagnostic>,
  range: [number, number],
  diagnostics: ReadonlyArray<JSDocDiagnostic>
) {
  for (const item of diagnostics) out.push({ ...item, range })
}

function parseDocumentedTs(
  node: ts.Node,
  scope: DocScope,
  diagnostics: Array<JSDocModelDiagnostic>,
  required = true,
  linkContext?: { readonly checker: ts.TypeChecker; readonly entry: ProgramCacheEntry }
) {
  const block = getNodeJSDoc(node)
  if (block?.internal) return undefined
  if (block === undefined) {
    if (required) {
      diagnostics.push({
        ...diagnostic("missing-jsdoc", scope === "member" ? "Member JSDoc is required" : "Public JSDoc is required"),
        range: nodeRange(node)
      })
    }
    return undefined
  }
  addModelDiagnostics(diagnostics, block.range, block.diagnostics)
  if (block.parsed === undefined) return undefined
  const tags = buildTags(scope, block.parsed.tags)
  if (tags._tag === "Failure") {
    addModelDiagnostics(diagnostics, block.range, tags.error.diagnostics)
    return undefined
  }
  if (hasInlineLink(block) && linkContext !== undefined) {
    for (const link of malformedInlineLinks(block)) {
      diagnostics.push({ ...diagnostic("malformed-link", `Malformed JSDoc inline link: ${link}`), range: block.range })
    }
    for (const link of collectJSDocLinks(node.getSourceFile(), block)) {
      const text = link.getText(node.getSourceFile())
      const target = extractInlineLinkTarget(text)
      if (target === "") continue
      if (urlRegex.test(target)) {
        diagnostics.push({
          ...diagnostic("url-link", `JSDoc inline link must target a TypeScript symbol: ${text}`),
          range: [link.pos, link.end]
        })
      } else if (
        resolveJSDocLinkSymbol(link, target, node.getSourceFile(), linkContext.checker, linkContext.entry) === undefined
      ) {
        diagnostics.push({
          ...diagnostic("unresolved-link", `Unresolved JSDoc inline link: ${text}`),
          range: [link.pos, link.end]
        })
      }
    }
  }
  return { core: block.parsed, tags: tags.value }
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false)
}

function hasDefaultModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false)
}

function declarationName(node: ts.Node): string | undefined {
  if (
    (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node) ||
      ts.isFunctionDeclaration(node) || ts.isModuleDeclaration(node)) && node.name !== undefined
  ) return node.name.text
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.map((declaration) => {
      if (ts.isIdentifier(declaration.name)) return declaration.name.text
      if (ts.isObjectBindingPattern(declaration.name)) {
        return declaration.name.elements.map((element) =>
          element.propertyName?.getText(element.getSourceFile()) ?? element.name.getText(element.getSourceFile())
        ).join(", ")
      }
      return ""
    }).filter(Boolean).join(", ")
  }
  return undefined
}

function bucketOfTs(node: ts.Node): ExportBucket | undefined {
  if (ts.isVariableStatement(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) return "value"
  if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) return "type"
  return undefined
}

function parseMembersFromTsType(
  type: ts.TypeNode | undefined,
  diagnostics: Array<JSDocModelDiagnostic>,
  linkContext: { readonly checker: ts.TypeChecker; readonly entry: ProgramCacheEntry }
): Array<ParsedMember> {
  if (!type) return []
  if (ts.isTypeLiteralNode(type)) return parseTsMembers(type.members, diagnostics, linkContext)
  if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type)) {
    return type.types.flatMap((item) => parseMembersFromTsType(item, diagnostics, linkContext))
  }
  if (ts.isParenthesizedTypeNode(type) || ts.isTypeOperatorNode(type)) {
    return parseMembersFromTsType(type.type, diagnostics, linkContext)
  }
  if (ts.isArrayTypeNode(type)) return parseMembersFromTsType(type.elementType, diagnostics, linkContext)
  if (ts.isConditionalTypeNode(type)) {
    return [
      ...parseMembersFromTsType(type.checkType, diagnostics, linkContext),
      ...parseMembersFromTsType(type.extendsType, diagnostics, linkContext),
      ...parseMembersFromTsType(type.trueType, diagnostics, linkContext),
      ...parseMembersFromTsType(type.falseType, diagnostics, linkContext)
    ]
  }
  if (ts.isTypeReferenceNode(type)) {
    return type.typeArguments?.flatMap((item) => parseMembersFromTsType(item, diagnostics, linkContext)) ?? []
  }
  if (ts.isMappedTypeNode(type)) return parseMembersFromTsType(type.type, diagnostics, linkContext)
  if (ts.isIndexedAccessTypeNode(type)) {
    return [
      ...parseMembersFromTsType(type.objectType, diagnostics, linkContext),
      ...parseMembersFromTsType(type.indexType, diagnostics, linkContext)
    ]
  }
  if (ts.isFunctionTypeNode(type) || ts.isConstructorTypeNode(type)) {
    return parseMembersFromTsType(type.type, diagnostics, linkContext)
  }
  return []
}

function memberName(member: ts.TypeElement | ts.ClassElement): string {
  if (
    ts.isPropertySignature(member) || ts.isMethodSignature(member) || ts.isPropertyDeclaration(member) ||
    ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)
  ) {
    const name = member.name
    if (ts.isComputedPropertyName(name)) return name.expression.getText(member.getSourceFile())
    return name.getText(member.getSourceFile()).replace(/^[']|[']$/g, "")
  }
  return ""
}

function memberType(member: ts.TypeElement | ts.ClassElement): ts.TypeNode | undefined {
  if (
    ts.isPropertySignature(member) || ts.isMethodSignature(member) || ts.isPropertyDeclaration(member) ||
    ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)
  ) return member.type
  return undefined
}

function parseTsMembers(
  members: ts.NodeArray<ts.TypeElement | ts.ClassElement>,
  diagnostics: Array<JSDocModelDiagnostic>,
  linkContext: { readonly checker: ts.TypeChecker; readonly entry: ProgramCacheEntry }
): Array<ParsedMember> {
  const out: Array<ParsedMember> = []
  for (const member of members) {
    if (
      ts.isCallSignatureDeclaration(member) || ts.isConstructSignatureDeclaration(member) ||
      ts.isIndexSignatureDeclaration(member) || member.kind === ts.SyntaxKind.Constructor
    ) continue
    const documented = parseDocumentedTs(member, "member", diagnostics, false, linkContext)
    if (documented === undefined) continue
    const name = memberName(member)
    if (name === "") continue
    const nested = parseMembersFromTsType(memberType(member), diagnostics, linkContext)
    out.push({
      name,
      description: documented.core.description,
      examples: documented.core.examples,
      tags: documented.tags as ParsedMemberTags,
      members: nested
    })
  }
  return out
}

function parseDeclarationMembersTs(
  node: ts.Node,
  diagnostics: Array<JSDocModelDiagnostic>,
  linkContext: { readonly checker: ts.TypeChecker; readonly entry: ProgramCacheEntry }
): Array<ParsedMember> {
  if (ts.isInterfaceDeclaration(node)) return parseTsMembers(node.members, diagnostics, linkContext)
  if (ts.isClassDeclaration(node)) return parseTsMembers(node.members, diagnostics, linkContext)
  if (ts.isTypeAliasDeclaration(node)) return parseMembersFromTsType(node.type, diagnostics, linkContext)
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.flatMap((d) => parseMembersFromTsType(d.type, diagnostics, linkContext))
  }
  if (ts.isFunctionDeclaration(node)) return parseMembersFromTsType(node.type, diagnostics, linkContext)
  return []
}

function hasDeclareModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword) ?? false)
}

function parseNamespaceTs(
  node: ts.ModuleDeclaration,
  diagnostics: Array<JSDocModelDiagnostic>,
  linkContext: { readonly checker: ts.TypeChecker; readonly entry: ProgramCacheEntry },
  isInsideDeclare = false
): ParsedNamespace | undefined {
  if (!ts.isIdentifier(node.name)) return undefined
  if (!isInsideDeclare && !hasDeclareModifier(node)) {
    diagnostics.push({
      ...diagnostic("namespace-declare", "Namespaces must be declared with declare namespace"),
      range: nodeRange(node)
    })
    return undefined
  }
  const documented = parseDocumentedTs(node, "namespace", diagnostics, true, linkContext)
  if (documented === undefined) return undefined
  const declarations: Array<ParsedNamespaceDeclaration> = []
  const namespaces: Array<ParsedNamespace> = []
  if (node.body !== undefined && ts.isModuleBlock(node.body)) {
    for (const statement of node.body.statements) {
      if (!hasExportModifier(statement)) continue
      if (ts.isModuleDeclaration(statement)) {
        const nested = parseNamespaceTs(statement, diagnostics, linkContext, true)
        if (nested !== undefined) namespaces.push(nested)
        continue
      }
      if (ts.isEnumDeclaration(statement)) {
        diagnostics.push({ ...diagnostic("enum", "Enums are not allowed"), range: nodeRange(statement) })
        continue
      }
      const bucket = bucketOfTs(statement)
      if (bucket !== "type") {
        diagnostics.push({
          ...diagnostic("namespace-value", "Namespace exports must be type declarations"),
          range: nodeRange(statement)
        })
        continue
      }
      const nestedDocumented = parseDocumentedTs(statement, "namespace-declaration", diagnostics, true, linkContext)
      if (nestedDocumented === undefined) continue
      const name = declarationName(statement)
      if (name === undefined || name.length === 0) {
        diagnostics.push({
          ...diagnostic("missing-name", "Namespace declaration name could not be determined"),
          range: nodeRange(statement)
        })
        continue
      }
      declarations.push({
        name,
        description: nestedDocumented.core.description,
        examples: nestedDocumented.core.examples,
        tags: nestedDocumented.tags as ParsedNamespaceTags,
        members: parseDeclarationMembersTs(statement, diagnostics, linkContext)
      })
    }
  }
  return {
    name: node.name.text,
    description: documented.core.description,
    examples: documented.core.examples,
    tags: documented.tags as ParsedNamespaceTags,
    declarations,
    namespaces
  }
}

function parseSourceFileDocs(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  entry: ProgramCacheEntry
): { readonly parsed: ParsedJSDocFile; readonly diagnostics: ReadonlyArray<JSDocModelDiagnostic> } {
  const diagnostics: Array<JSDocModelDiagnostic> = []
  const declarations: Array<ParsedRootDeclaration> = []
  const namespaces: Array<ParsedNamespace> = []
  const linkContext = { checker, entry }
  const checkedFunctionOverloads = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) continue
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause === undefined) continue
      if (ts.isNamedExports(statement.exportClause) && statement.exportClause.elements.length === 0) {
        diagnostics.push({
          ...diagnostic("empty-export", "Empty export declarations are not allowed"),
          range: nodeRange(statement)
        })
      }
      if (ts.isNamedExports(statement.exportClause)) {
        for (const specifier of statement.exportClause.elements) {
          const documented = parseDocumentedTs(specifier, "declaration", diagnostics, true, linkContext)
          if (documented === undefined) continue
          declarations.push({
            name: specifier.name.text,
            bucket: statement.isTypeOnly || specifier.isTypeOnly ? "type" : "value",
            description: documented.core.description,
            examples: documented.core.examples,
            tags: documented.tags as ParsedDeclarationTags,
            members: []
          })
        }
      }
      continue
    }
    if (!hasExportModifier(statement) || hasDefaultModifier(statement)) continue
    if (ts.isModuleDeclaration(statement)) {
      const namespace = parseNamespaceTs(statement, diagnostics, linkContext)
      if (namespace !== undefined) namespaces.push(namespace)
      continue
    }
    if (ts.isEnumDeclaration(statement)) {
      diagnostics.push({ ...diagnostic("enum", "Enums are not allowed"), range: nodeRange(statement) })
      continue
    }
    const bucket = bucketOfTs(statement)
    if (bucket === undefined) continue
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      const name = statement.name.text
      if (statement.body === undefined) {
        if (checkedFunctionOverloads.has(name)) continue
        checkedFunctionOverloads.add(name)
      } else if (checkedFunctionOverloads.has(name)) {
        continue
      }
    }
    const documented = parseDocumentedTs(statement, "declaration", diagnostics, true, linkContext)
    if (documented === undefined) continue
    const name = declarationName(statement)
    if (name === undefined || name.length === 0) {
      diagnostics.push({
        ...diagnostic("missing-name", "Root declaration name could not be determined"),
        range: nodeRange(statement)
      })
      continue
    }
    declarations.push({
      name,
      bucket,
      description: documented.core.description,
      examples: documented.core.examples,
      tags: documented.tags as ParsedDeclarationTags,
      members: parseDeclarationMembersTs(statement, diagnostics, linkContext)
    })
  }
  return {
    parsed: { declarations, namespaces },
    diagnostics: uniqueDiagnostics(diagnostics) as Array<JSDocModelDiagnostic>
  }
}

export function loadJSDocConfig(cwd = process.cwd(), configPath = "jsdocs.config.json"): JSDocConfig {
  const absolute = path.resolve(cwd, configPath)
  const parsed = JSON.parse(fs.readFileSync(absolute, "utf8")) as JSDocConfig
  return parsed
}

export function extractJSDocsSync(options: ExtractJSDocsOptions): JSDocModel {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const tsconfigPath = path.resolve(cwd, options.tsconfig)
  const entry = getProgram(tsconfigPath)
  if (entry.error !== undefined || entry.program === undefined) {
    throw new Error(entry.error ?? `Unable to read ${tsconfigPath}`)
  }
  const program = entry.program
  const checker = program.getTypeChecker()
  const sourceByPath = new Map(program.getSourceFiles().map((file) => [path.resolve(file.fileName), file]))
  const files = globSync([...options.include], {
    cwd,
    absolute: true,
    nodir: true,
    ignore: [...options.exclude ?? []]
  }).sort()
  const modelFiles: Array<JSDocModelFile> = []
  for (const filename of files) {
    const source = fs.readFileSync(filename, "utf8")
    const file = normalizeFile(cwd, filename)
    const hash = hashSource(source)
    const sourceFile = sourceByPath.get(path.resolve(filename))
    if (sourceFile === undefined) {
      modelFiles.push({
        file,
        hash,
        diagnostics: [{ ...diagnostic("tsconfig", `${file} is not included in ${options.tsconfig}`), range: [0, 0] }],
        declarations: [],
        namespaces: []
      })
      continue
    }
    const result = parseSourceFileDocs(sourceFile, checker, entry)
    if (
      result.diagnostics.length === 0 && result.parsed.declarations.length === 0 &&
      result.parsed.namespaces.length === 0
    ) continue
    const fileDiagnostics = [...result.diagnostics]
    let importsValue: ParsedJSDocImports | undefined
    if (
      fileDiagnostics.length === 0 && (result.parsed.declarations.length > 0 || result.parsed.namespaces.length > 0)
    ) {
      const imports = resolveJSDocImports(cwd, filename)
      if (imports._tag === "Success") importsValue = imports.value
      else {fileDiagnostics.push({
          ...diagnostic(
            "imports",
            `Unable to resolve jsdocs imports: ${imports.error}. Add the missing barrel/package export or exclude this file from jsdocs.`
          ),
          range: [0, 0]
        })}
    }
    modelFiles.push({
      file,
      hash,
      diagnostics: fileDiagnostics,
      ...(importsValue === undefined ? {} : { imports: importsValue }),
      ...result.parsed
    })
  }
  return { version: 1, generatedBy: "@effect/jsdocs", generatedAt: new Date().toISOString(), files: modelFiles }
}

export const extractJSDocs = (options: ExtractJSDocsOptions): Effect.Effect<JSDocModel> =>
  Effect.sync(() => extractJSDocsSync(options))

export function writeJSDocModel(cwd: string, output: string, model: JSDocModel) {
  const filename = path.resolve(cwd, output)
  fs.mkdirSync(path.dirname(filename), { recursive: true })
  fs.writeFileSync(filename, `${JSON.stringify(model, null, 2)}\n`)
}

export function readJSDocModel(filename: string): Result<JSDocModel, string> {
  if (!fs.existsSync(filename)) return { _tag: "Failure", error: "missing" }
  try {
    const parsed = JSON.parse(fs.readFileSync(filename, "utf8")) as JSDocModel
    if (parsed.version !== 1) return { _tag: "Failure", error: "Unsupported jsdocs model version" }
    if (!Array.isArray(parsed.files)) return { _tag: "Failure", error: "Invalid jsdocs model: files must be an array" }
    return { _tag: "Success", value: parsed }
  } catch (error) {
    return { _tag: "Failure", error: `Invalid jsdocs model: ${error instanceof Error ? error.message : String(error)}` }
  }
}

export function sourceHash(source: string): string {
  return hashSource(source)
}
