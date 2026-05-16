import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const sourceDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(sourceDir, "..", "..")
const outputPath = join(root, "effect-schedule-cookbook.html")

const embeddedPublicOutline = String.raw`
# Effect \`Schedule\` Cookbook

## Preface

### Who this cookbook is for
### What this cookbook is not
### A quick mental model of \`Schedule\`

# Part I — Foundations

## 1. What a \`Schedule\` Really Represents

### 1.1 Recurrence policies as data
### 1.2 The input/output view of a schedule
### 1.3 Time, repetition, and decision points
### 1.4 Why \`Schedule\` is more than “retry with delay”
### 1.5 Composability as the core design idea

## 2. \`repeat\` vs \`retry\`

### 2.1 Repeating successful effects
### 2.2 Retrying failed effects
### 2.3 When the distinction matters
### 2.4 Common beginner mistakes
### 2.5 Choosing the right entry point

## 3. Minimal Building Blocks

### 3.1 Repeat a fixed number of times
### 3.2 Retry a fixed number of times
### 3.3 Add a delay between recurrences
### 3.4 Stop after a limit
### 3.5 Build intuition before composing policies

# Part II — Core Retry Recipes

## 4. Retry a Few Times

### 4.1 Retry up to 3 times
### 4.2 Retry up to 5 times
### 4.3 Retry with a small constant delay
### 4.4 Retry immediately, but only briefly
### 4.5 Retry until the first success

## 5. Retry with Fixed Delays

### 5.1 Retry every 100 milliseconds
### 5.2 Retry every second
### 5.3 Retry every 5 seconds
### 5.4 Retry with a delay suitable for external APIs
### 5.5 Retry with different fixed delays for different environments

## 6. Retry with Exponential Backoff

### 6.1 Basic exponential backoff
### 6.2 Backoff for transient network failures
### 6.3 Backoff for overloaded downstream services
### 6.4 Backoff for startup dependency readiness
### 6.5 Backoff with a practical base interval

## 7. Retry with Capped Backoff

### 7.1 Exponential backoff with a maximum delay
### 7.2 Preventing excessively long waits
### 7.3 Capped backoff for user-facing flows
### 7.4 Capped backoff for worker processes
### 7.5 Backoff with both cap and retry limit

## 8. Retry with Jitter

### 8.1 Why jitter matters
### 8.2 Add jitter to exponential backoff
### 8.3 Add jitter to fixed delays
### 8.4 Avoid synchronized retries in clustered systems
### 8.5 Jitter for reconnect storms

## 9. Retry with Deadlines and Budgets

### 9.1 Retry for at most 10 seconds
### 9.2 Retry for at most 1 minute
### 9.3 Retry until a startup deadline
### 9.4 Retry within a fixed operational budget
### 9.5 Prefer time-budget limits over attempt counts

## 10. Retry Only When It Makes Sense

### 10.1 Retry only transient failures
### 10.2 Do not retry validation errors
### 10.3 Retry only on timeouts
### 10.4 Retry only on 5xx responses
### 10.5 Treat rate limits differently from server errors

## 11. Idempotency and Retry Safety

### 11.1 Safe retries for GET requests
### 11.2 Retrying idempotent writes
### 11.3 Why non-idempotent retries are dangerous
### 11.4 Retrying with idempotency keys
### 11.5 When not to retry at all

# Part III — Core Repeat Recipes

## 12. Repeat a Successful Effect

### 12.1 Repeat 5 times
### 12.2 Repeat forever with care
### 12.3 Repeat with a pause
### 12.4 Repeat until a condition becomes true
### 12.5 Repeat while work remains to be done

## 13. Repeat Periodically

### 13.1 Run every second
### 13.2 Run every 10 seconds
### 13.3 Run every minute
### 13.4 Run every 5 minutes
### 13.5 Run every hour

## 14. Repeat with Limits

### 14.1 Repeat at most N times
### 14.2 Repeat only within a time budget
### 14.3 Repeat until a threshold is reached
### 14.4 Repeat until output becomes stable
### 14.5 Repeat until a terminal state is observed

## 15. Repeat with Controlled Spacing

### 15.1 Enforce a pause between iterations
### 15.2 Slow down a tight worker loop
### 15.3 Space expensive maintenance tasks
### 15.4 Avoid saturating a dependency
### 15.5 Use spacing to smooth resource usage

# Part IV — Polling Recipes

## 16. Poll Until Completion

### 16.1 Poll a background job until done
### 16.2 Poll payment status until settled
### 16.3 Poll an export job until ready
### 16.4 Poll a video transcode until complete
### 16.5 Poll cloud provisioning until ready

## 17. Poll with a Timeout

### 17.1 Poll every second for up to 30 seconds
### 17.2 Poll every 5 seconds for up to 2 minutes
### 17.3 Give up when the operation is clearly too slow
### 17.4 Distinguish “still running” from “failed permanently”
### 17.5 Return a timeout error gracefully

## 18. Poll Aggressively at First, Then Slow Down

### 18.1 Fast polling during the first few seconds
### 18.2 Slow polling after initial responsiveness matters less
### 18.3 Warm-up polling for startup tasks
### 18.4 Polling strategy for user-triggered workflows
### 18.5 Polling strategy for long-running back-office jobs

## 19. Poll with Jitter

### 19.1 Polling from many clients without synchronization
### 19.2 Jittered polling for dashboards
### 19.3 Jittered status checks in distributed systems
### 19.4 Jittered polling after deploys
### 19.5 Reduce herd effects in control planes

## 20. Poll Until a Desired Output Appears

### 20.1 Poll until status becomes \`Completed\`
### 20.2 Poll until a resource exists
### 20.3 Poll until a cache entry appears
### 20.4 Poll until replication catches up
### 20.5 Poll until eventual consistency settles

# Part V — Backoff and Delay Strategies

## 21. Choosing a Delay Strategy
## 22. Constant Delay Recipes
## 23. Linear Backoff Recipes
## 24. Exponential Backoff Recipes
## 25. Delay Capping Recipes

# Part VI — Jitter Recipes

## 26. Why Jitter Exists
## 27. Jitter for Retry
## 28. Jitter for Repeat and Polling
## 29. Jitter Tradeoffs

# Part VII — Spacing, Throttling, and Load Smoothing

## 30. Space Requests Intentionally
## 31. Throttle Internal Work
## 32. Space User-Facing Side Effects
## 33. Respect Rate Limits

# Part VIII — Stop Conditions and Termination Policies

## 34. Stop After N Attempts
## 35. Stop After a Time Budget
## 36. Stop on Output Conditions
## 37. Stop on Error Conditions

# Part IX — Composition Recipes

## 38. Combine Attempt Limits and Delays
## 39. Combine Delay Strategies and Stop Conditions
## 40. Warm-up and Steady-State Schedules
## 41. Build Multi-Phase Policies
## 42. Express Operational Intent Through Composition

# Part X — Real-World Recipes

## 43. Backend Recipes
## 44. Frontend and Client Recipes
## 45. Infrastructure and Platform Recipes
## 46. Data and Batch Recipes
## 47. Product and Business Workflow Recipes

# Part XI — Observability and Testing

## 48. Observability, Logging, and Diagnostics
## 49. Testing Recipes

# Part XII — Anti-Patterns

## 50. Retrying Everything
## 51. Retrying Forever
## 52. Polling Too Aggressively
## 53. Misusing Jitter
## 54. Overcomplicating Schedule Composition
## 55. Ignoring Operational Context

# Part XIII — Choosing the Right Recipe

## 56. Recipe Selection Guide
## 57. Decision Matrix by Problem Shape

# Part XIV — Reference Appendices

## 58. Index by Problem
## 59. Index by Operational Goal
## 60. Index by Pattern
## 61. Glossary
## 62. Further Reading
`

const outlineCandidates = [
  join(sourceDir, "effect-schedule-cookbook-public.md"),
  join(root, "effect-schedule-cookbook-public.md")
]

const publicOutlinePath = outlineCandidates.find((path) => existsSync(path))
const publicOutline = publicOutlinePath
  ? readFileSync(publicOutlinePath, "utf8")
  : embeddedPublicOutline

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const escapeAttr = (value) => escapeHtml(value).replaceAll("\n", " ")

const normalizeWhitespace = (value) => value.replace(/\s+/g, " ").trim()

const romanToNumber = (roman) => {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100 }
  let total = 0
  let previous = 0
  for (const char of roman.toUpperCase().split("").reverse()) {
    const value = map[char] ?? 0
    if (value < previous) {
      total -= value
    } else {
      total += value
      previous = value
    }
  }
  return total
}

const slugify = (value) =>
  String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/`/g, "")
    .replace(/[“”]/g, "")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

const stripChapterNumber = (title) => title.replace(/^\d+\.\s*/, "")
const stripPartPrefix = (title) => title.replace(/^Part\s+[IVXLCDM]+\s+—\s+/i, "")

const partId = (title) => {
  const match = title.match(/^Part\s+([IVXLCDM]+)\s+—\s+(.+)$/i)
  if (!match) {
    return `part-${slugify(title)}`
  }
  return `part-${romanToNumber(match[1])}-${slugify(match[2])}`
}

const chapterId = (title) => {
  const match = title.match(/^(\d+)\.\s+(.+)$/)
  return match ? `chapter-${match[1]}-${slugify(match[2])}` : `chapter-${slugify(title)}`
}

const sectionId = (number, title) =>
  number ? `section-${number.replace(/\./g, "-")}-${slugify(title)}` : `section-${slugify(title)}`

const normalizeSectionNumber = (value) => {
  if (!value) {
    return ""
  }
  const match = String(value).match(/^0*(\d+)\.(\d+)$/)
  return match ? `${Number(match[1])}.${match[2]}` : String(value)
}

const parseOutline = (outline) => {
  const model = {
    title: "Effect `Schedule` Cookbook",
    frontMatter: [],
    parts: []
  }
  let currentPart = null
  let currentChapter = null

  const addSubsection = (rawTitle) => {
    if (!currentChapter) {
      return
    }
    const match = rawTitle.match(/^(\d+\.\d+)\s+(.+)$/)
    const number = match ? normalizeSectionNumber(match[1]) : ""
    const title = match ? match[2] : rawTitle
    const id = sectionId(number, title)
    const exists = currentChapter.subsections.some((subsection) =>
      subsection.id === id || (number !== "" && subsection.number === number)
    )
    if (!exists) {
      currentChapter.subsections.push({ id, number, title })
    }
  }

  for (const rawLine of outline.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.length === 0) {
      continue
    }

    if (line.startsWith("# Effect")) {
      model.title = line.replace(/^#\s+/, "")
      continue
    }

    if (line.startsWith("# Part ")) {
      const title = line.replace(/^#\s+/, "")
      currentPart = {
        id: partId(title),
        title,
        chapters: []
      }
      model.parts.push(currentPart)
      currentChapter = null
      continue
    }

    if (line.startsWith("## ")) {
      const title = line.replace(/^##\s+/, "")
      currentChapter = {
        id: chapterId(title),
        title,
        number: title.match(/^(\d+)\./)?.[1] ?? "",
        subsections: []
      }
      if (currentPart) {
        currentPart.chapters.push(currentChapter)
      } else {
        model.frontMatter.push(currentChapter)
      }
      continue
    }

    if (line.startsWith("### ") && currentChapter) {
      addSubsection(line.replace(/^###\s+/, ""))
      continue
    }

    const linkedSubsection = line.match(/^-\s+\[(.+?)\]\(#[^)]+\)$/)
    if (linkedSubsection && currentChapter) {
      addSubsection(linkedSubsection[1])
    }
  }

  return model
}

const parseFrontmatter = (raw) => {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) {
    return { metadata: {}, body: raw }
  }

  const metadata = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!pair) {
      continue
    }
    let value = pair[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (value === "true") {
      metadata[pair[1]] = true
    } else if (value === "false") {
      metadata[pair[1]] = false
    } else {
      metadata[pair[1]] = value
    }
  }

  return { metadata, body: raw.slice(match[0].length) }
}

const stripTopHeading = (markdown) => {
  const lines = markdown.split(/\r?\n/)
  const index = lines.findIndex((line) => line.trim().length > 0)
  if (index >= 0 && /^#\s+/.test(lines[index])) {
    lines.splice(index, 1)
    while (lines[index]?.trim() === "") {
      lines.splice(index, 1)
    }
  }
  return lines.join("\n").trim()
}

const splitTableRow = (line) => {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "")
  return trimmed.split("|").map((cell) => cell.trim())
}

const isTableDelimiter = (line) =>
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)

let codeBlockCount = 0

const renderInline = (raw) => {
  const codeSpans = []
  let text = String(raw).replace(/`([^`]+)`/g, (_match, code) => {
    const index = codeSpans.push(code) - 1
    return `%%CODESPAN${index}%%`
  })

  text = escapeHtml(text)
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_match, label, href) => {
    const safeHref = escapeAttr(href)
    const target = /^(https?:)?\/\//.test(href) ? ' target="_blank" rel="noreferrer"' : ""
    return `<a href="${safeHref}"${target}>${label}</a>`
  })
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>")
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
  text = text.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>")
  text = text.replace(/%%CODESPAN(\d+)%%/g, (_match, index) => `<code>${escapeHtml(codeSpans[Number(index)])}</code>`)
  return text
}

const renderMarkdown = (markdown) => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  const html = []
  let index = 0

  const isSpecial = (line, nextLine) =>
    line.startsWith('```') ||
    /^(#{1,6})\s+/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^>\s?/.test(line) ||
    (line.includes("|") && nextLine !== undefined && isTableDelimiter(nextLine))

  while (index < lines.length) {
    const line = lines[index]

    if (line.trim() === "") {
      index += 1
      continue
    }

    const fence = line.match(/^```([A-Za-z0-9_-]*)\s*$/)
    if (fence) {
      const language = fence[1] || "text"
      const code = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index])
        index += 1
      }
      if (index < lines.length) {
        index += 1
      }
      const codeId = `code-block-${++codeBlockCount}`
      html.push(`<figure class="code-card" data-language="${escapeAttr(language)}">`)
      html.push(`<figcaption><span>${escapeHtml(language)}</span><button class="copy-button" type="button" data-copy-target="${codeId}">Copy</button></figcaption>`)
      html.push(`<pre><code id="${codeId}" class="language-${escapeAttr(language)}">${escapeHtml(code.join("\n"))}</code></pre>`)
      html.push("</figure>")
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = Math.min(6, heading[1].length + 3)
      html.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`)
      index += 1
      continue
    }

    if (line.includes("|") && lines[index + 1] !== undefined && isTableDelimiter(lines[index + 1])) {
      const header = splitTableRow(line)
      index += 2
      const rows = []
      while (index < lines.length && lines[index].includes("|") && lines[index].trim() !== "") {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }
      html.push('<div class="table-scroll"><table>')
      html.push(`<thead><tr>${header.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>`)
      html.push(`<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`)
      html.push("</table></div>")
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""))
        index += 1
      }
      html.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`)
      continue
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/)
    if (unordered) {
      const items = []
      while (index < lines.length) {
        const item = lines[index].match(/^\s*[-*]\s+(.+)$/)
        if (!item) {
          break
        }
        items.push(item[1])
        index += 1
      }
      html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`)
      continue
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/)
    if (ordered) {
      const items = []
      while (index < lines.length) {
        const item = lines[index].match(/^\s*\d+\.\s+(.+)$/)
        if (!item) {
          break
        }
        items.push(item[1])
        index += 1
      }
      html.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`)
      continue
    }

    const paragraph = [line.trim()]
    index += 1
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !isSpecial(lines[index], lines[index + 1])
    ) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`)
  }

  return html.join("\n")
}

const markdownToPlainText = (markdown) =>
  normalizeWhitespace(
    markdown
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
      .replace(/```[A-Za-z0-9_-]*\n([\s\S]*?)```/g, " $1 ")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*_>#|-]/g, " ")
  )

const extractCodeText = (markdown) => {
  const code = []
  for (const match of markdown.matchAll(/```[A-Za-z0-9_-]*\n([\s\S]*?)```/g)) {
    code.push(match[1])
  }
  return code.join("\n\n")
}

const loadSections = () => {
  const files = readdirSync(sourceDir).filter((file) => /^schedule-cookbook__.+\.md$/.test(file))
  const byNumber = new Map()
  const malformed = []

  for (const file of files) {
    const raw = readFileSync(join(sourceDir, file), "utf8")
    const { metadata, body } = parseFrontmatter(raw)
    const sectionNumber = normalizeSectionNumber(metadata.section_number ?? file.match(/__(\d+\.\d+)__/)?.[1] ?? "")
    if (!sectionNumber) {
      malformed.push(file)
      continue
    }
    const existing = byNumber.get(sectionNumber)
    const candidate = {
      file,
      metadata,
      body,
      content: stripTopHeading(body),
      text: markdownToPlainText(body),
      codeText: extractCodeText(body)
    }
    if (!existing || metadata.section_title) {
      byNumber.set(sectionNumber, candidate)
    }
  }

  return { byNumber, malformed, files }
}

const jsonForScript = (value) =>
  JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029")

const titleHtml = (title) => renderInline(title)

const outline = parseOutline(publicOutline)
const loaded = loadSections()
const sectionEntries = []
const searchIndex = []

const allOutlineSubsections = []
for (const chapter of outline.frontMatter) {
  for (const subsection of chapter.subsections) {
    allOutlineSubsections.push({ ...subsection, chapter, part: null })
  }
}
for (const part of outline.parts) {
  for (const chapter of part.chapters) {
    for (const subsection of chapter.subsections) {
      allOutlineSubsections.push({ ...subsection, chapter, part })
    }
  }
}

const previousNext = new Map()
for (let index = 0; index < allOutlineSubsections.length; index += 1) {
  previousNext.set(allOutlineSubsections[index].id, {
    previous: allOutlineSubsections[index - 1] ?? null,
    next: allOutlineSubsections[index + 1] ?? null
  })
}

const renderPlaceholder = (kind) =>
  `<div class="missing-content"><strong>Source content unavailable.</strong><span>${kind === "chapter" ? "This chapter is present in the public outline, but no generated subsection file exists in the current source corpus." : "This subsection is present in the public outline, but no generated Markdown file exists in the current source corpus."}</span></div>`

const renderSubsection = (part, chapter, subsection) => {
  const loadedSection = subsection.number ? loaded.byNumber.get(subsection.number) : undefined
  const metadata = loadedSection?.metadata ?? {}
  const codeIncluded = Boolean(metadata.code_included)
  const title = metadata.section_title || subsection.title
  const number = subsection.number || ""
  const id = subsection.id
  const nav = previousNext.get(id) ?? { previous: null, next: null }
  const bodyHtml = loadedSection ? renderMarkdown(loadedSection.content) : renderPlaceholder("subsection")
  const label = number ? `${number} ${title}` : title
  const entry = {
    id,
    number,
    title,
    label,
    chapterTitle: chapter.title,
    partTitle: part?.title ?? "Preface",
    codeIncluded,
    missing: !loadedSection
  }
  sectionEntries.push(entry)
  if (loadedSection) {
    searchIndex.push({
      id,
      number,
      title,
      chapterTitle: chapter.title,
      partTitle: part?.title ?? "Preface",
      codeIncluded,
      text: loadedSection.text,
      codeText: loadedSection.codeText
    })
  }

  return `
<article class="subsection${loadedSection ? "" : " is-missing"}" id="${id}" data-section-id="${id}" data-title="${escapeAttr(label)}" data-chapter="${escapeAttr(chapter.title)}" data-part="${escapeAttr(part?.title ?? "Preface")}">
  <header class="subsection-header">
    <p class="kicker">${escapeHtml(part?.title ?? "Preface")} / ${escapeHtml(chapter.title)}</p>
    <h4>${number ? `<span>${escapeHtml(number)}</span> ` : ""}${titleHtml(title)}${codeIncluded ? '<span class="code-pill">code</span>' : ""}</h4>
  </header>
  <div class="section-body">
    ${bodyHtml}
  </div>
  <nav class="section-nav" aria-label="Section navigation">
    ${nav.previous ? `<a href="#${nav.previous.id}" class="prev-link"><span>Previous</span><strong>${escapeHtml(nav.previous.number ? `${nav.previous.number} ${nav.previous.title}` : nav.previous.title)}</strong></a>` : '<span class="nav-placeholder"></span>'}
    ${nav.next ? `<a href="#${nav.next.id}" class="next-link"><span>Next</span><strong>${escapeHtml(nav.next.number ? `${nav.next.number} ${nav.next.title}` : nav.next.title)}</strong></a>` : '<span class="nav-placeholder"></span>'}
  </nav>
</article>`
}

const renderChapter = (part, chapter) => {
  const hasSubsections = chapter.subsections.length > 0
  const chapterBody = hasSubsections
    ? chapter.subsections.map((subsection) => renderSubsection(part, chapter, subsection)).join("\n")
    : renderPlaceholder("chapter")

  return `
<section class="chapter-section" id="${chapter.id}" data-chapter-id="${chapter.id}">
  <header class="chapter-header">
    <h3>${titleHtml(chapter.title)}</h3>
  </header>
  ${chapterBody}
</section>`
}

const renderPart = (part) => `
<section class="part-section" id="${part.id}" data-part-id="${part.id}">
  <header class="part-header">
    <p>${escapeHtml(part.title.split("—")[0]?.trim() ?? "Part")}</p>
    <h2>${titleHtml(stripPartPrefix(part.title))}</h2>
  </header>
  ${part.chapters.map((chapter) => renderChapter(part, chapter)).join("\n")}
</section>`

const renderFrontMatter = () => outline.frontMatter.map((chapter) => `
<section class="part-section front-matter" id="${chapter.id}">
  <header class="part-header">
    <p>Front matter</p>
    <h2>${titleHtml(chapter.title)}</h2>
  </header>
  ${chapter.subsections.map((subsection) => renderSubsection(null, chapter, subsection)).join("\n")}
</section>`).join("\n")

const tocSubsection = (subsection) => {
  const loadedSection = subsection.number ? loaded.byNumber.get(subsection.number) : undefined
  const code = loadedSection?.metadata?.code_included === true
  const label = subsection.number ? `${subsection.number} ${subsection.title}` : subsection.title
  return `<li><a class="toc-section${loadedSection ? "" : " is-missing"}" href="#${subsection.id}" data-target="${subsection.id}"><span>${titleHtml(label)}</span>${code ? '<span class="toc-code" title="Contains code">{}</span>' : ""}</a></li>`
}

const tocChapter = (chapter) => {
  if (chapter.subsections.length === 0) {
    return `<li><a class="toc-chapter-link" href="#${chapter.id}">${titleHtml(chapter.title)}</a></li>`
  }
  return `
<li>
  <details class="toc-chapter" open>
    <summary><a href="#${chapter.id}">${titleHtml(chapter.title)}</a></summary>
    <ol>${chapter.subsections.map(tocSubsection).join("")}</ol>
  </details>
</li>`
}

const tocPart = (part) => `
<details class="toc-part" open>
  <summary><a href="#${part.id}">${titleHtml(part.title)}</a></summary>
  <ol>${part.chapters.map(tocChapter).join("")}</ol>
</details>`

const tocFrontMatter = () => outline.frontMatter.map((chapter) => `
<details class="toc-part front-toc" open>
  <summary><a href="#${chapter.id}">${titleHtml(chapter.title)}</a></summary>
  <ol>${chapter.subsections.map(tocSubsection).join("")}</ol>
</details>`).join("")

const generatedCount = loaded.byNumber.size
const expectedSubsectionCount = allOutlineSubsections.length

const styles = String.raw`
:root {
  color-scheme: light;
  --bg: #f7f7f4;
  --panel: #ffffff;
  --panel-soft: #fbfbf8;
  --text: #20231f;
  --muted: #686d66;
  --faint: #8b9188;
  --border: #dedfd8;
  --border-strong: #c9cbc1;
  --accent: #0f766e;
  --accent-strong: #0b5f59;
  --accent-soft: #dff4ef;
  --warm: #a15c18;
  --code-bg: #151916;
  --code-text: #edf6ef;
  --code-muted: #aab7ae;
  --shadow: 0 18px 48px rgba(32, 35, 31, 0.1);
  --topbar-height: 68px;
  --sidebar-width: 330px;
  --content-width: 850px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: 0;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #111311;
  --panel: #191c19;
  --panel-soft: #151815;
  --text: #edf1ec;
  --muted: #abb4aa;
  --faint: #838d82;
  --border: #30362f;
  --border-strong: #424a40;
  --accent: #5eead4;
  --accent-strong: #99f6e4;
  --accent-soft: rgba(45, 212, 191, 0.14);
  --warm: #f0a45d;
  --code-bg: #0b0e0c;
  --code-text: #eef8f1;
  --code-muted: #99a69d;
  --shadow: 0 20px 56px rgba(0, 0, 0, 0.38);
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  background: var(--bg);
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-soft) 58%, transparent), transparent 34rem),
    linear-gradient(180deg, var(--bg), var(--bg));
  color: var(--text);
}

a {
  color: inherit;
}

button,
input {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel) 92%, transparent);
  backdrop-filter: blur(18px);
  overflow: hidden;
  z-index: 30;
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.sidebar-brand {
  padding: 22px 22px 18px;
  border-bottom: 1px solid var(--border);
}

.sidebar-brand a {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  text-decoration: none;
}

.sidebar-brand strong {
  font-size: 15px;
  line-height: 1.25;
}

.sidebar-brand span {
  color: var(--muted);
  font-size: 12px;
}

.toc {
  overflow: auto;
  padding: 14px 12px 28px;
  scrollbar-width: thin;
}

.toc details {
  margin: 0;
}

.toc summary {
  cursor: pointer;
  list-style: none;
  border-radius: 8px;
}

.toc summary::-webkit-details-marker {
  display: none;
}

.toc summary a,
.toc-chapter-link,
.toc-section {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 6px 8px;
  border-radius: 8px;
  color: var(--muted);
  text-decoration: none;
}

.toc summary a:hover,
.toc-chapter-link:hover,
.toc-section:hover {
  background: var(--panel-soft);
  color: var(--text);
}

.toc-part {
  margin-bottom: 10px;
}

.toc-part > summary a {
  color: var(--text);
  font-weight: 700;
}

.toc-chapter > summary a,
.toc-chapter-link {
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
}

.toc ol {
  list-style: none;
  margin: 0;
  padding: 0 0 0 12px;
}

.toc-part > ol {
  padding-left: 4px;
}

.toc-section {
  justify-content: space-between;
  font-size: 12px;
  line-height: 1.32;
  padding-left: 12px;
}

.toc-section span:first-child {
  min-width: 0;
}

.toc-section.is-active {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
}

.toc-section.is-missing {
  color: var(--faint);
}

.toc-code {
  flex: 0 0 auto;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 5px;
  color: var(--warm);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
}

.main-shell {
  min-width: 0;
}

.topbar {
  position: sticky;
  top: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  height: var(--topbar-height);
  padding: 0 28px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 84%, transparent);
  backdrop-filter: blur(20px);
  z-index: 20;
}

.menu-button,
.theme-button,
.back-to-top {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
}

.menu-button {
  display: none;
}

.top-title {
  min-width: 0;
}

.top-title strong {
  display: block;
  font-size: 14px;
}

.breadcrumb {
  display: block;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-actions {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}

.search-wrap {
  position: relative;
  width: min(420px, 46vw);
}

.search-input {
  width: 100%;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  padding: 0 12px 0 36px;
  outline: none;
}

.search-wrap::before {
  content: "";
  position: absolute;
  left: 13px;
  top: 50%;
  width: 13px;
  height: 13px;
  border: 2px solid var(--faint);
  border-radius: 50%;
  transform: translateY(-55%);
}

.search-wrap::after {
  content: "";
  position: absolute;
  left: 25px;
  top: 25px;
  width: 7px;
  height: 2px;
  border-radius: 2px;
  background: var(--faint);
  transform: rotate(45deg);
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-soft) 70%, transparent);
}

.search-results {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  display: none;
  width: min(620px, calc(100vw - 32px));
  max-height: min(620px, calc(100vh - 96px));
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
  padding: 8px;
  z-index: 50;
}

.search-results.is-open {
  display: block;
}

.search-empty {
  padding: 16px;
  color: var(--muted);
  font-size: 13px;
}

.search-result {
  display: block;
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 12px;
  text-align: left;
}

.search-result:hover,
.search-result:focus {
  background: var(--panel-soft);
  outline: none;
}

.search-result strong {
  display: block;
  color: var(--text);
  font-size: 13px;
  line-height: 1.35;
}

.search-result span {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.search-result mark {
  border-radius: 3px;
  background: color-mix(in srgb, var(--accent-soft) 86%, transparent);
  color: var(--accent-strong);
  padding: 0 2px;
}

.reading {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 48px 28px 96px;
}

.book-hero {
  padding: 26px 0 44px;
  border-bottom: 1px solid var(--border);
}

.eyebrow,
.kicker,
.part-header p {
  margin: 0 0 10px;
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 750;
  text-transform: uppercase;
}

.book-hero h1 {
  margin: 0;
  font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
  font-size: 56px;
  font-weight: 700;
  line-height: 1.05;
}

.book-hero h1 code {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  padding: 0 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.82em;
}

.hero-copy {
  max-width: 680px;
  margin: 18px 0 0;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.65;
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 26px;
}

.hero-stats span {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  padding: 8px 10px;
  color: var(--muted);
  font-size: 12px;
}

.part-section,
.chapter-section,
.subsection {
  scroll-margin-top: calc(var(--topbar-height) + 24px);
}

.part-header {
  margin-top: 72px;
  padding: 34px 0 28px;
  border-bottom: 1px solid var(--border-strong);
}

.part-header h2 {
  margin: 0;
  font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
  font-size: 38px;
  line-height: 1.15;
}

.chapter-header {
  margin-top: 44px;
}

.chapter-header h3 {
  margin: 0;
  color: var(--text);
  font-size: 25px;
  line-height: 1.28;
}

.subsection {
  margin-top: 30px;
  padding-bottom: 34px;
  border-bottom: 1px solid var(--border);
}

.subsection-header {
  margin-bottom: 20px;
}

.subsection-header h4 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 23px;
  line-height: 1.28;
}

.subsection-header h4 > span:first-child {
  color: var(--accent-strong);
  font-variant-numeric: tabular-nums;
}

.code-pill {
  align-self: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--panel-soft);
  color: var(--warm);
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.section-body {
  color: var(--text);
  font-size: 16px;
  line-height: 1.72;
}

.section-body p,
.section-body ul,
.section-body ol,
.section-body blockquote,
.section-body .table-scroll,
.code-card {
  margin: 16px 0;
}

.section-body h5 {
  margin: 30px 0 10px;
  font-size: 18px;
  line-height: 1.35;
}

.section-body h6 {
  margin: 24px 0 8px;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.4;
  text-transform: uppercase;
}

.section-body ul,
.section-body ol {
  padding-left: 24px;
}

.section-body li + li {
  margin-top: 6px;
}

.section-body a {
  color: var(--accent-strong);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.section-body code:not(pre code) {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-soft);
  padding: 0.1em 0.32em;
  color: color-mix(in srgb, var(--warm) 86%, var(--text));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
}

.section-body blockquote {
  border-left: 3px solid var(--accent);
  background: var(--panel-soft);
  border-radius: 0 8px 8px 0;
  padding: 12px 16px;
  color: var(--muted);
}

.table-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: var(--panel);
  font-size: 14px;
}

th,
td {
  border-bottom: 1px solid var(--border);
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
}

th {
  background: var(--panel-soft);
  font-weight: 750;
}

.code-card {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--border) 42%, transparent);
  border-radius: 8px;
  background: var(--code-bg);
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.12);
}

.code-card figcaption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 38px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 10px 0 14px;
  color: var(--code-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.copy-button {
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--code-text);
  cursor: pointer;
  padding: 5px 9px;
  font-size: 12px;
}

.copy-button:hover,
.copy-button:focus {
  background: rgba(255, 255, 255, 0.12);
  outline: none;
}

.code-card pre {
  margin: 0;
  overflow-x: auto;
  padding: 18px;
}

.code-card code {
  color: var(--code-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 1.58;
  tab-size: 2;
}

.missing-content {
  display: flex;
  flex-direction: column;
  gap: 5px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  background: var(--panel-soft);
  padding: 14px 16px;
  color: var(--muted);
}

.missing-content strong {
  color: var(--text);
}

.section-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 28px;
}

.section-nav a {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  padding: 12px;
  text-decoration: none;
}

.section-nav a:hover {
  border-color: var(--accent);
  background: var(--panel-soft);
}

.section-nav span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 750;
  text-transform: uppercase;
}

.section-nav strong {
  overflow: hidden;
  font-size: 13px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.next-link {
  text-align: right;
}

.back-to-top {
  position: fixed;
  right: 22px;
  bottom: 22px;
  opacity: 0;
  pointer-events: none;
  text-decoration: none;
  transition: opacity 160ms ease, transform 160ms ease;
  z-index: 35;
}

.back-to-top.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.sidebar-scrim {
  display: none;
}

@media (max-width: 1080px) {
  :root {
    --sidebar-width: 300px;
    --content-width: 780px;
  }
}

@media (max-width: 860px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    width: min(88vw, 340px);
    transform: translateX(-102%);
    transition: transform 180ms ease;
  }

  body.sidebar-open .sidebar {
    transform: translateX(0);
  }

  .sidebar-scrim {
    position: fixed;
    inset: 0;
    display: block;
    background: rgba(0, 0, 0, 0.36);
    opacity: 0;
    pointer-events: none;
    transition: opacity 180ms ease;
    z-index: 25;
  }

  body.sidebar-open .sidebar-scrim {
    opacity: 1;
    pointer-events: auto;
  }

  .menu-button {
    display: inline-flex;
  }

  .topbar {
    grid-template-columns: auto minmax(0, 1fr) auto;
    padding: 0 14px;
  }

  .top-title strong {
    font-size: 13px;
  }

  .breadcrumb {
    max-width: 40vw;
  }

  .search-wrap {
    width: min(46vw, 300px);
  }

  .reading {
    padding: 30px 18px 80px;
  }

  .book-hero h1 {
    font-size: 40px;
  }

  .part-header h2 {
    font-size: 31px;
  }
}

@media (max-width: 640px) {
  .topbar {
    height: auto;
    min-height: var(--topbar-height);
    grid-template-columns: auto 1fr auto;
    row-gap: 8px;
    padding-bottom: 10px;
  }

  .top-actions {
    grid-column: 1 / -1;
    width: 100%;
  }

  .search-wrap {
    width: 100%;
  }

  .breadcrumb {
    max-width: 58vw;
  }

  .book-hero h1 {
    font-size: 34px;
  }

  .hero-copy,
  .section-body {
    font-size: 15px;
  }

  .subsection-header h4 {
    font-size: 21px;
  }

  .section-nav {
    grid-template-columns: 1fr;
  }

  .next-link {
    text-align: left;
  }
}
`

const script = String.raw`
const searchIndex = __SEARCH_INDEX__;
const sectionEntries = __SECTION_ENTRIES__;

const root = document.documentElement;
const body = document.body;
const themeButton = document.getElementById("theme-toggle");
const menuButton = document.getElementById("menu-toggle");
const sidebarScrim = document.getElementById("sidebar-scrim");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const breadcrumb = document.getElementById("breadcrumb");
const backToTop = document.getElementById("back-to-top");

const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const storedTheme = localStorage.getItem("effect-schedule-cookbook-theme");

const applyTheme = (theme) => {
  root.dataset.theme = theme;
  localStorage.setItem("effect-schedule-cookbook-theme", theme);
  themeButton.textContent = theme === "dark" ? "Light" : "Dark";
  themeButton.setAttribute("aria-label", theme === "dark" ? "Use light theme" : "Use dark theme");
};

applyTheme(storedTheme || (prefersDark ? "dark" : "light"));

themeButton.addEventListener("click", () => {
  applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
});

const closeSidebar = () => body.classList.remove("sidebar-open");
menuButton.addEventListener("click", () => body.classList.toggle("sidebar-open"));
sidebarScrim.addEventListener("click", closeSidebar);

const copyText = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) {
      return;
    }
    const original = button.textContent;
    try {
      await copyText(target.innerText);
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = original;
      }, 1300);
    } catch {
      button.textContent = "Failed";
      window.setTimeout(() => {
        button.textContent = original;
      }, 1300);
    }
  });
});

const tocLinks = new Map(
  Array.from(document.querySelectorAll("[data-target]")).map((link) => [link.dataset.target, link])
);
const byId = new Map(sectionEntries.map((entry) => [entry.id, entry]));

const setActiveSection = (id) => {
  document.querySelectorAll(".toc-section.is-active").forEach((link) => link.classList.remove("is-active"));
  const link = tocLinks.get(id);
  const entry = byId.get(id);
  if (link) {
    link.classList.add("is-active");
    let parent = link.parentElement;
    while (parent) {
      if (parent.tagName === "DETAILS") {
        parent.open = true;
      }
      parent = parent.parentElement;
    }
  }
  if (entry) {
    breadcrumb.textContent = entry.partTitle + " / " + entry.chapterTitle + " / " + entry.label;
  }
};

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
    if (visible) {
      setActiveSection(visible.target.dataset.sectionId);
    }
  },
  { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.2, 0.6] }
);

document.querySelectorAll(".subsection[data-section-id]").forEach((section) => observer.observe(section));

if (window.location.hash) {
  const initial = window.location.hash.slice(1);
  if (byId.has(initial)) {
    setActiveSection(initial);
  }
}

document.addEventListener("click", (event) => {
  const anchor = event.target.closest("a[href^='#']");
  if (anchor) {
    closeSidebar();
  }
});

const normalize = (value) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const highlight = (text, terms) => {
  let output = text.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
  for (const term of terms.slice(0, 4)) {
    if (term.length < 2) {
      continue;
    }
    output = output.replace(new RegExp("(" + term.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>");
  }
  return output;
};

const snippetFor = (entry, terms) => {
  const haystack = entry.title + " " + entry.chapterTitle + " " + entry.partTitle + " " + entry.text + " " + entry.codeText;
  const normalized = normalize(haystack);
  const firstTerm = terms.find((term) => normalized.includes(term));
  if (!firstTerm) {
    return entry.text.slice(0, 170);
  }
  const index = normalized.indexOf(firstTerm);
  const start = Math.max(0, index - 70);
  const end = Math.min(haystack.length, index + 140);
  return (start > 0 ? "..." : "") + haystack.slice(start, end) + (end < haystack.length ? "..." : "");
};

const scoreEntry = (entry, terms) => {
  const title = normalize(entry.number + " " + entry.title);
  const chapter = normalize(entry.chapterTitle + " " + entry.partTitle);
  const bodyText = normalize(entry.text);
  const codeText = normalize(entry.codeText);
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) {
      score += 10;
    }
    if (chapter.includes(term)) {
      score += 4;
    }
    if (bodyText.includes(term)) {
      score += 2;
    }
    if (codeText.includes(term)) {
      score += 3;
    }
  }
  return score;
};

const closeSearch = () => {
  searchResults.classList.remove("is-open");
  searchResults.innerHTML = "";
};

const renderSearch = () => {
  const query = searchInput.value.trim();
  if (query.length === 0) {
    closeSearch();
    return;
  }
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const results = searchIndex
    .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 18);

  searchResults.classList.add("is-open");
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="search-empty">No matching sections.</div>';
    return;
  }
  searchResults.innerHTML = results
    .map(({ entry }) => {
      const label = entry.number + " " + entry.title;
      const location = entry.partTitle + " / " + entry.chapterTitle;
      const snippet = snippetFor(entry, terms);
      return '<button type="button" class="search-result" data-jump="' + entry.id + '"><strong>' + highlight(label, terms) + '</strong><span>' + highlight(location, terms) + '</span><span>' + highlight(snippet, terms) + '</span></button>';
    })
    .join("");
};

searchInput.addEventListener("input", renderSearch);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    searchInput.blur();
    closeSearch();
  }
});

searchResults.addEventListener("click", (event) => {
  const result = event.target.closest("[data-jump]");
  if (!result) {
    return;
  }
  window.location.hash = result.dataset.jump;
  closeSearch();
  closeSidebar();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-wrap")) {
    closeSearch();
  }
});

window.addEventListener("scroll", () => {
  backToTop.classList.toggle("is-visible", window.scrollY > 900);
}, { passive: true });
`
  .replace("__SEARCH_INDEX__", jsonForScript(searchIndex))
  .replace("__SECTION_ENTRIES__", jsonForScript(sectionEntries))

const contentHtml = `
${renderFrontMatter()}
${outline.parts.map(renderPart).join("\n")}
`

const sidebarHtml = `
<aside class="sidebar" id="sidebar">
  <div class="sidebar-inner">
    <div class="sidebar-brand">
      <a href="#book-top">
        <strong>Effect <code>Schedule</code> Cookbook</strong>
        <span>${generatedCount} drafted subsections / ${expectedSubsectionCount} outline subsections</span>
      </a>
    </div>
    <nav class="toc" aria-label="Table of contents">
      ${tocFrontMatter()}
      ${outline.parts.map(tocPart).join("\n")}
    </nav>
  </div>
</aside>
`

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Effect Schedule Cookbook</title>
  <style>${styles}</style>
</head>
<body>
  <div class="sidebar-scrim" id="sidebar-scrim" aria-hidden="true"></div>
  <div class="app-shell">
    ${sidebarHtml}
    <div class="main-shell">
      <header class="topbar">
        <button class="menu-button" id="menu-toggle" type="button" aria-label="Open table of contents">Menu</button>
        <div class="top-title">
          <strong>Effect <code>Schedule</code> Cookbook</strong>
          <span class="breadcrumb" id="breadcrumb">Reader</span>
        </div>
        <div class="top-actions">
          <div class="search-wrap">
            <input class="search-input" id="search-input" type="search" placeholder="Search sections and code" autocomplete="off" spellcheck="false" aria-label="Search book">
            <div class="search-results" id="search-results" role="listbox" aria-label="Search results"></div>
          </div>
          <button class="theme-button" id="theme-toggle" type="button">Theme</button>
        </div>
      </header>
      <main class="reading" id="book-top">
        <section class="book-hero" aria-labelledby="book-title">
          <p class="eyebrow">Technical handbook</p>
          <h1 id="book-title">Effect <code>Schedule</code> Cookbook</h1>
          <p class="hero-copy">A practical reading app for recurrence policies in Effect: retries, repeats, polling, backoff, jitter, deadlines, and operational safety. The content below is assembled from the generated subsection Markdown files and ordered by the public outline.</p>
          <div class="hero-stats" aria-label="Book source status">
            <span>${generatedCount} generated subsection files</span>
            <span>${expectedSubsectionCount} outline subsections</span>
            <span>${loaded.malformed.length} malformed files skipped</span>
          </div>
        </section>
        ${contentHtml}
      </main>
    </div>
  </div>
  <a href="#book-top" class="back-to-top" id="back-to-top" aria-label="Back to top">Top</a>
  <script>${script}</script>
</body>
</html>
`

writeFileSync(outputPath, html)

process.stdout.write([
  `Wrote ${outputPath}`,
  `Outline source: ${publicOutlinePath ?? "embedded fallback"}`,
  `Loaded ${generatedCount} generated subsection files`,
  `Expected ${expectedSubsectionCount} outline subsections`,
  `Malformed files skipped: ${loaded.malformed.length}`
].join("\n") + "\n")
