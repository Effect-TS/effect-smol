import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const Prism = require("prismjs")
require("prismjs/components/prism-typescript")

const sourceDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(sourceDir, "..", "..")
const outputPath = join(sourceDir, "effect-schedule-cookbook.html")

const embeddedPublicOutline = String.raw`
# Effect \`Schedule\` Cookbook

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

# Part II — Retry Recipes

## 4. Retry Limits and Simple Delays

### 4.1 Retry up to 3 times
### 4.2 Retry with a small constant delay
### 4.3 Retry immediately, but only briefly
### 4.4 Retry until the first success
### 4.5 Retry with a delay suitable for external APIs
### 4.6 Retry with different fixed delays for different environments

## 5. Exponential and Capped Backoff

### 5.1 Basic exponential backoff
### 5.2 Backoff for transient network failures
### 5.3 Backoff for overloaded downstream services
### 5.4 Backoff for startup dependency readiness
### 5.5 Backoff with a practical base interval
### 5.6 Exponential backoff with a maximum delay
### 5.7 Preventing excessively long waits
### 5.8 Backoff with both cap and retry limit

## 6. Retry Budgets and Deadlines

### 6.1 Retry for at most 10 seconds
### 6.2 Retry for at most 1 minute
### 6.3 Retry until a startup deadline
### 6.4 Retry within a fixed operational budget
### 6.5 Prefer time-budget limits over attempt counts

## 7. Error-Aware Retries

### 7.1 Retry only transient failures
### 7.2 Do not retry validation errors
### 7.3 Retry only on timeouts
### 7.4 Retry only on 5xx responses
### 7.5 Treat rate limits differently from server errors

## 8. Idempotency and Retry Safety

### 8.1 Safe retries for GET requests
### 8.2 Retrying idempotent writes
### 8.3 Why non-idempotent retries are dangerous
### 8.4 Retrying with idempotency keys
### 8.5 When not to retry at all

# Part III — Repeat Recipes

## 9. Repeat Successful Work

### 9.1 Repeat 5 times
### 9.2 Repeat forever with care
### 9.3 Repeat with a pause
### 9.4 Repeat until a condition becomes true
### 9.5 Repeat while work remains to be done

## 10. Periodic and Spaced Repeat

### 10.1 Run every minute
### 10.2 Run every hour
### 10.3 Enforce a pause between iterations
### 10.4 Slow down a tight worker loop
### 10.5 Use spacing to smooth resource usage

## 11. Repeat with Limits

### 11.1 Repeat at most N times
### 11.2 Repeat only within a time budget
### 11.3 Repeat until a threshold is reached
### 11.4 Repeat until output becomes stable
### 11.5 Repeat until a terminal state is observed

# Part IV — Polling Recipes

## 12. Poll Until Completion

### 12.1 Poll a background job until done
### 12.2 Poll payment status until settled
### 12.3 Poll an export job until ready
### 12.4 Poll cloud provisioning until ready
### 12.5 Poll until status becomes \`Completed\`

## 13. Poll for Resource State

### 13.1 Poll until a resource exists
### 13.2 Poll until a cache entry appears
### 13.3 Poll until replication catches up
### 13.4 Poll until eventual consistency settles

## 14. Poll with Timeouts

### 14.1 Poll every second for up to 30 seconds
### 14.2 Give up when the operation is clearly too slow
### 14.3 Distinguish “still running” from “failed permanently”
### 14.4 Return a timeout error gracefully

## 15. Adaptive and Fleet-Safe Polling

### 15.1 Fast polling during the first few seconds
### 15.2 Slow polling after initial responsiveness matters less
### 15.3 Polling strategy for user-triggered workflows
### 15.4 Polling strategy for long-running back-office jobs
### 15.5 Polling from many clients without synchronization
### 15.6 Jittered status checks in distributed systems
### 15.7 Reduce herd effects in control planes

# Part V — Delay, Backoff, and Load Control

## 16. Choose a Delay Strategy

### 16.1 Constant delays
### 16.2 Linear backoff
### 16.3 Exponential backoff
### 16.4 Capped exponential backoff

## 17. Operational Backoff Recipes

### 17.1 Backoff for unstable remote APIs
### 17.2 Backoff for queue reconnection
### 17.3 Backoff for cold-start dependencies
### 17.4 Cap long tails in retry behavior
### 17.5 Cap delays without losing backoff benefits

## 18. Spacing and Throttling

### 18.1 At least one request per second
### 18.2 Process a batch with gaps between items
### 18.3 Avoid hammering an external API
### 18.4 Smooth demand over time
### 18.5 Drain a queue slowly

## 19. Rate Limits and User-Facing Effects

### 19.1 Send emails with controlled spacing
### 19.2 Respect provider quotas
### 19.3 Space calls to a third-party API
### 19.4 Slow down after a 429 response
### 19.5 Coordinate retry and rate-limit handling

## 20. Jitter Concepts and Tradeoffs

### 20.1 Thundering herds
### 20.2 Coordinated clients
### 20.3 Recovery spikes
### 20.4 Add jitter to exponential backoff
### 20.5 Avoid synchronized retries in clustered systems
### 20.6 More stability, less predictability
### 20.7 When not to add jitter

## 21. Jitter in Real Systems

### 21.1 Jittered retries for HTTP clients
### 21.2 Jittered retries for Redis reconnects
### 21.3 Jittered retries for WebSocket reconnect
### 21.4 Jittered periodic refresh
### 21.5 Jittered cache warming

# Part VI — Composition and Termination

## 22. Stop Conditions

### 22.1 Stop when status becomes terminal
### 22.2 Stop when no more work remains
### 22.3 Stop when data becomes available
### 22.4 Stop when a value stabilizes
### 22.5 Stop on fatal errors
### 22.6 Classify errors before retrying

## 23. Combine Limits and Delays

### 23.1 Retry 5 times with fixed spacing
### 23.2 Retry 5 times with exponential backoff
### 23.3 Retry 10 times with jittered backoff
### 23.4 Poll with both interval and deadline
### 23.5 Exponential backoff plus time budget
### 23.6 Retry with cap plus max attempts

## 24. Multi-Phase Policies

### 24.1 Aggressive at startup, relaxed afterward
### 24.2 Fast checks during initialization
### 24.3 Slow background cadence after readiness
### 24.4 Immediate retries first, backoff later
### 24.5 Fast polling first, slower polling later
### 24.6 Phase-based control for long workflows

## 25. Express Operational Intent

### 25.1 “Try hard, but only briefly”
### 25.2 “Keep trying, but never aggressively”
### 25.3 “Be responsive first, conservative later”
### 25.4 “Avoid overload at all costs”
### 25.5 “Keep background work steady and predictable”

# Part VII — Real-World Recipes

## 26. Backend Recipes

### 26.1 Retry HTTP GET on timeout
### 26.2 Retry HTTP GET on 503
### 26.3 Retry HTTP POST with idempotency key
### 26.4 Retry rate-limited requests carefully
### 26.5 Poll a job-based HTTP API

## 27. Frontend and Client Recipes

### 27.1 Retry config fetch at startup
### 27.2 Retry profile loading on transient network failure
### 27.3 Retry token refresh briefly
### 27.4 Reconnect WebSocket with backoff
### 27.5 Reconnect WebSocket with jitter

## 28. Infrastructure and Platform Recipes

### 28.1 Retry dependency checks during startup
### 28.2 Poll until all required services are ready
### 28.3 Poll rollout status
### 28.4 Retry deployment hooks
### 28.5 Retry infrastructure API calls

## 29. Data and Batch Recipes

### 29.1 Poll ETL status until completion
### 29.2 Retry export generation
### 29.3 Retry file upload to object storage
### 29.4 Retry import processing after transient failures
### 29.5 Pace reprocessing of failed records

## 30. Product and Business Workflow Recipes

### 30.1 Poll payment settlement status
### 30.2 Retry payment-status fetches
### 30.3 Poll order fulfillment progress
### 30.4 Retry notification delivery
### 30.5 Repeat CRM sync every few minutes

# Part VIII — Observability and Testing

## 31. Observability, Logging, and Diagnostics

### 31.1 Log each retry attempt
### 31.2 Log computed delays
### 31.3 Track total retry duration
### 31.4 Surface termination reasons
### 31.5 Measure schedule effectiveness

## 32. Testing Recipes

### 32.1 Assert retry count
### 32.2 Assert delays between retries
### 32.3 Simulate transient failures
### 32.4 Verify no retry on fatal errors
### 32.5 Test capped backoff behavior

# Part IX — Anti-Patterns

## 33. Retrying Everything

### 33.1 Retry on validation errors
### 33.2 Retry on authorization failures
### 33.3 Retry on malformed requests
### 33.4 Retry non-idempotent side effects blindly
### 33.5 Retry without error classification

## 34. Retrying Forever

### 34.1 Missing retry limits
### 34.2 Missing time budgets
### 34.3 Unbounded backoff chains
### 34.4 Operationally invisible infinite retries
### 34.5 Background loops with no escape hatch

## 35. Polling and Jitter Mistakes

### 35.1 Poll every 100ms without need
### 35.2 Poll large fleets in sync
### 35.3 Poll when a push-based model would be better
### 35.4 Adding jitter where precise cadence matters
### 35.5 Using jitter to mask a deeper overload problem

# Part X — Choosing the Right Recipe

## 36. Recipe Selection Guide

### 36.1 “I need to retry a flaky call”
### 36.2 “I need to poll until something finishes”
### 36.3 “I need a periodic background loop”
### 36.4 “I need to avoid overload”
### 36.5 “I need to stop after a reasonable limit”

## 37. Decision Matrix by Problem Shape

### 37.1 Transient failure vs permanent failure
### 37.2 Immediate responsiveness vs infrastructure safety
### 37.3 Fixed cadence vs adaptive cadence
### 37.4 User-facing workflow vs background process
### 37.5 Single-instance behavior vs fleet-wide behavior

## 38. Glossary

### 38.1 Retry
### 38.2 Repeat
### 38.3 Polling
### 38.4 Backoff
### 38.5 Idempotency
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
  text = text.replace(/%%CODESPAN(\d+)%%/g, (_match, index) => {
    const code = codeSpans[Number(index)]
    return code === "Schedule" ? escapeHtml(code) : `<code>${escapeHtml(code)}</code>`
  })
  return text
}

const highlightCode = (source) => {
  const grammar = Prism.languages.typescript
  return grammar ? Prism.highlight(source, grammar, "typescript") : escapeHtml(source)
}

const compactCode = (source) =>
  source
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "")

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
      html.push('<figure class="code-card">')
      html.push(`<figcaption><span class="code-file"><span class="code-file-icon" aria-hidden="true">TS</span></span><button class="copy-button" type="button" data-copy-target="${codeId}" aria-label="Copy code" title="Copy code"><svg class="copy-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15"></path></svg><svg class="check-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg></button></figcaption>`)
      html.push(`<pre><code id="${codeId}" class="language-typescript">${highlightCode(compactCode(code.join("\n")))}</code></pre>`)
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
      content: stripTopHeading(body)
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

const renderPlaceholder = (kind) =>
  `<div class="missing-content"><strong>Source content unavailable.</strong><span>${kind === "chapter" ? "This chapter is present in the public outline, but no generated subsection file exists in the current source corpus." : "This subsection is present in the public outline, but no generated Markdown file exists in the current source corpus."}</span></div>`

const renderSubsection = (part, chapter, subsection) => {
  const loadedSection = subsection.number ? loaded.byNumber.get(subsection.number) : undefined
  const metadata = loadedSection?.metadata ?? {}
  const codeIncluded = Boolean(metadata.code_included)
  const title = metadata.section_title || subsection.title
  const number = subsection.number || ""
  const id = subsection.id
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

  return `
<article class="subsection${loadedSection ? "" : " is-missing"}" id="${id}" data-section-id="${id}" data-title="${escapeAttr(label)}" data-chapter="${escapeAttr(chapter.title)}" data-part="${escapeAttr(part?.title ?? "Preface")}">
  <header class="subsection-header">
    <p class="kicker">${escapeHtml(part?.title ?? "Preface")} / ${escapeHtml(chapter.title)}</p>
    <h4>${number ? `<span>${escapeHtml(number)}</span> ` : ""}${titleHtml(title)}</h4>
  </header>
  <div class="section-body">
    ${bodyHtml}
  </div>
</article>`
}

const renderChapter = (part, chapter) => {
  const hasSubsections = chapter.subsections.length > 0
  const chapterBody = hasSubsections
    ? chapter.subsections.map((subsection) => renderSubsection(part, chapter, subsection)).join("\n")
    : ""

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

const numberedFrontMatter = () => outline.frontMatter
  .map((chapter) => ({
    ...chapter,
    subsections: chapter.subsections.filter((subsection) => subsection.number)
  }))
  .filter((chapter) => chapter.subsections.length > 0)

const renderFrontMatter = () => numberedFrontMatter().map((chapter) => `
<section class="part-section front-matter" id="${chapter.id}">
  <header class="part-header">
    <p>Front matter</p>
    <h2>${titleHtml(chapter.title)}</h2>
  </header>
  ${chapter.subsections.map((subsection) => renderSubsection(null, chapter, subsection)).join("\n")}
</section>`).join("\n")

const tocSubsection = (subsection) => {
  const loadedSection = subsection.number ? loaded.byNumber.get(subsection.number) : undefined
  const label = subsection.number ? `${subsection.number} ${subsection.title}` : subsection.title
  return `<li><a class="toc-section${loadedSection ? "" : " is-missing"}" href="#${subsection.id}" data-target="${subsection.id}"><span>${titleHtml(label)}</span></a></li>`
}

const tocChapter = (chapter) => {
  if (chapter.subsections.length === 0) {
    return `<li><a class="toc-chapter-link" href="#${chapter.id}">${titleHtml(chapter.title)}</a></li>`
  }
  return `
<li>
  <details class="toc-chapter">
    <summary><a href="#${chapter.id}">${titleHtml(chapter.title)}</a></summary>
    <ol>${chapter.subsections.map(tocSubsection).join("")}</ol>
  </details>
</li>`
}

const tocPart = (part) => `
<details class="toc-part">
  <summary><a href="#${part.id}">${titleHtml(part.title)}</a></summary>
  <ol>${part.chapters.map(tocChapter).join("")}</ol>
</details>`

const tocFrontMatter = () => numberedFrontMatter().map((chapter) => `
<details class="toc-part front-toc">
  <summary><a href="#${chapter.id}">${titleHtml(chapter.title)}</a></summary>
  <ol>${chapter.subsections.map(tocSubsection).join("")}</ol>
</details>`).join("")

const styles = String.raw`
:root {
  color-scheme: light;
  --bg: #ffffff;
  --panel: #ffffff;
  --panel-soft: #f8fafc;
  --text: #0f172a;
  --muted: #475569;
  --faint: #94a3b8;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --accent: #0ea5e9;
  --accent-strong: #0284c7;
  --accent-soft: #e0f2fe;
  --warm: #334155;
  --code-bg: #f8fafc;
  --code-text: #0f172a;
  --code-muted: #64748b;
  --code-line: #e2e8f0;
  --code-button-bg: #ffffff;
  --code-button-hover: #f1f5f9;
  --code-token-comment: #6a737d;
  --code-token-keyword: #d73a49;
  --code-token-string: #0a3069;
  --code-token-number: #0550ae;
  --code-token-type: #8250df;
  --code-token-function: #6f42c1;
  --code-token-operator: #24292f;
  --shadow: 0 18px 48px rgba(15, 23, 42, 0.1);
  --topbar-height: 68px;
  --sidebar-width: 360px;
  --sidebar-gutter: 44px;
  --content-width: 780px;
  --font-body: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-display: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-code: "SF Mono", "Cascadia Code", "Roboto Mono", "IBM Plex Mono", ui-monospace, Menlo, Consolas, "Liberation Mono", monospace;
  font-family: var(--font-body);
  letter-spacing: 0;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #020617;
  --panel: #020617;
  --panel-soft: #0f172a;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --faint: #64748b;
  --border: #1e293b;
  --border-strong: #334155;
  --accent: #38bdf8;
  --accent-strong: #7dd3fc;
  --accent-soft: rgba(56, 189, 248, 0.14);
  --warm: #cbd5e1;
  --code-bg: #0f172a;
  --code-text: #e2e8f0;
  --code-muted: #94a3b8;
  --code-line: rgba(255, 255, 255, 0.08);
  --code-button-bg: rgba(255, 255, 255, 0.06);
  --code-button-hover: rgba(255, 255, 255, 0.12);
  --code-token-comment: #8b949e;
  --code-token-keyword: #ff7b72;
  --code-token-string: #a5d6ff;
  --code-token-number: #79c0ff;
  --code-token-type: #ffa657;
  --code-token-function: #d2a8ff;
  --code-token-operator: #c9d1d9;
  --shadow: 0 20px 56px rgba(0, 0, 0, 0.38);
}

* {
  box-sizing: border-box;
}

html {
  background: var(--bg);
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-soft) 62%, transparent), transparent 32rem),
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
  grid-template-columns: calc(var(--sidebar-width) + var(--sidebar-gutter)) minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  width: var(--sidebar-width);
  height: 100vh;
  border-right: 1px solid var(--border);
  background: var(--panel);
  overflow: visible;
  z-index: 30;
}

.sidebar::after {
  content: "";
  position: absolute;
  top: 0;
  right: calc(-1 * var(--sidebar-gutter));
  width: var(--sidebar-gutter);
  height: 100%;
  border-right: 1px solid var(--border);
  background:
    repeating-linear-gradient(
      135deg,
      transparent 0,
      transparent 8px,
      color-mix(in srgb, var(--border) 55%, transparent) 8px,
      color-mix(in srgb, var(--border) 55%, transparent) 9px
    );
  opacity: 0.52;
  pointer-events: none;
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.sidebar-brand {
  padding: 34px 20px 26px;
}

.sidebar-brand a {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--text);
  text-decoration: none;
}

.sidebar-brand strong {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
}

.sidebar-brand svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.toc {
  overflow: auto;
  padding: 6px 20px 42px;
  scrollbar-width: thin;
}

.toc details {
  margin: 0;
}

.toc summary {
  cursor: pointer;
  list-style: none;
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
  min-height: 28px;
  padding: 4px 0;
  border-radius: 0;
  color: var(--muted);
  text-decoration: none;
}

.toc summary a:hover,
.toc-chapter-link:hover,
.toc-section:hover {
  background: transparent;
  color: var(--accent-strong);
}

.toc-part {
  margin: 0 0 30px;
}

.toc-part + .toc-part {
  margin-top: 34px;
  padding-top: 24px;
  border-top: 1px solid var(--border-strong);
}

.toc-part > summary a {
  color: var(--faint);
  font-family: var(--font-code);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.toc-chapter > summary a,
.toc-chapter-link {
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
}

.toc ol {
  list-style: none;
  margin: 0;
  padding: 8px 0 0 0;
}

.toc-part > ol {
  padding-left: 0;
}

.toc-chapter > ol {
  margin: 2px 0 18px 0;
  padding: 0 0 0 10px;
  border-left: 1px solid var(--border);
}

.toc-section {
  justify-content: space-between;
  position: relative;
  font-size: 14px;
  line-height: 1.45;
  padding: 4px 0 4px 12px;
}

.toc-section span:first-child {
  min-width: 0;
}

.toc-section.is-active {
  background: transparent;
  color: var(--text);
  font-weight: 700;
}

.toc-section.is-active::before {
  content: "";
  position: absolute;
  left: -11px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 999px;
  background: var(--text);
}

.toc-section.is-missing {
  color: var(--faint);
}

.main-shell {
  min-width: 0;
}

.topbar {
  position: sticky;
  top: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  height: var(--topbar-height);
  padding: 0 28px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
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
  border-radius: 10px;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
}

.menu-button {
  display: none;
}

.theme-button {
  border-radius: 10px;
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
}

.theme-button:hover,
.theme-button:focus-visible {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
  outline: none;
}

.theme-icon {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.theme-icon-sun {
  display: none;
}

:root[data-theme="dark"] .theme-icon-sun {
  display: block;
}

:root[data-theme="dark"] .theme-icon-moon {
  display: none;
}

.top-actions {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}

.reading {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 74px 28px 96px;
}

.book-hero {
  padding: 0 0 68px;
  border-bottom: 0;
}

.eyebrow,
.kicker,
.part-header p {
  margin: 0 0 10px;
  color: var(--faint);
  font-family: var(--font-code);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.book-hero h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 44px;
  font-weight: 680;
  line-height: 1.12;
}

.hero-copy {
  max-width: 650px;
  margin: 22px 0 0;
  color: var(--muted);
  font-size: 18px;
  line-height: 1.75;
}

.part-section,
.chapter-section,
.subsection {
  scroll-margin-top: calc(var(--topbar-height) + 24px);
}

.part-header {
  margin-top: 88px;
  padding: 0 0 26px;
  border-bottom: 0;
}

.part-header h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 660;
  line-height: 1.15;
}

.chapter-header {
  margin-top: 46px;
}

.chapter-header h3 {
  margin: 0;
  color: var(--text);
  font-size: 24px;
  font-weight: 650;
  line-height: 1.28;
}

.subsection {
  margin-top: 38px;
  padding-bottom: 38px;
  border-bottom: 0;
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
  font-size: 21px;
  font-weight: 650;
  line-height: 1.28;
}

.subsection-header h4 > span:first-child {
  color: var(--accent-strong);
  font-family: var(--font-code);
  font-variant-numeric: tabular-nums;
}

.section-body {
  color: var(--muted);
  font-size: 14px;
  line-height: 1.82;
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
  margin: 34px 0 12px;
  color: var(--text);
  font-size: 19px;
  font-weight: 650;
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
  text-decoration-color: color-mix(in srgb, var(--accent) 45%, transparent);
  text-decoration-thickness: 1.5px;
  text-underline-offset: 4px;
}

.section-body code:not(pre code) {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-soft);
  padding: 0.1em 0.32em;
  color: var(--accent-strong);
  font-family: var(--font-code);
  font-size: 0.9em;
}

.section-body blockquote {
  border-left: 3px solid var(--accent);
  background: var(--panel-soft);
  border-radius: 0 10px 10px 0;
  padding: 13px 16px;
  color: var(--muted);
}

.table-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
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
  border: 1px solid var(--code-line);
  border-radius: 12px;
  background: var(--code-bg);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
}

.code-card figcaption {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 38px;
  border-bottom: 1px solid var(--code-line);
  padding: 0 10px;
  color: var(--code-muted);
  font-family: var(--font-code);
  font-size: 12px;
}

.copy-button {
  border: 1px solid var(--code-line);
  border-radius: 8px;
  background: var(--code-button-bg);
  color: var(--code-text);
  cursor: pointer;
  padding: 5px 9px;
  font-size: 12px;
}

.copy-button:hover,
.copy-button:focus {
  background: var(--code-button-hover);
  outline: none;
}

.code-card pre {
  margin: 0;
  overflow-x: auto;
  padding: 18px 20px;
}

.code-card code {
  color: var(--code-text);
  font-family: var(--font-code);
  font-size: 13px;
  line-height: 1.58;
  tab-size: 2;
}

.code-card .token.comment,
.code-card .token.prolog,
.code-card .token.doctype,
.code-card .token.cdata {
  color: var(--code-token-comment);
  font-style: italic;
}

.code-card .token.keyword,
.code-card .token.atrule {
  color: var(--code-token-keyword);
}

.code-card .token.string,
.code-card .token.char,
.code-card .token.attr-value {
  color: var(--code-token-string);
}

.code-card .token.number,
.code-card .token.boolean,
.code-card .token.constant,
.code-card .token.symbol {
  color: var(--code-token-number);
}

.code-card .token.class-name,
.code-card .token.builtin {
  color: var(--code-token-type);
}

.code-card .token.function {
  color: var(--code-token-function);
}

.code-card .token.operator,
.code-card .token.punctuation {
  color: var(--code-token-operator);
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
    --sidebar-gutter: 0px;
    --content-width: 780px;
  }

  .sidebar::after {
    display: none;
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
    grid-template-columns: auto minmax(0, 1fr);
    padding: 0 14px;
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

}

/* Vercel docs inspired skin */
:root {
  --bg: #ffffff;
  --panel: #ffffff;
  --panel-soft: #fafafa;
  --topbar-bg: #f7f7f7;
  --text: #000000;
  --muted: #525252;
  --faint: #737373;
  --border: #eaeaea;
  --border-strong: #d4d4d4;
  --accent: #000000;
  --accent-strong: #000000;
  --accent-soft: #f5f5f5;
  --toc-active-bg: rgba(0, 0, 0, 0.06);
  --warm: #171717;
  --code-bg: #ffffff;
  --code-header-bg: #fafafa;
  --inline-code-bg: #f4f4f5;
  --inline-code-border: #d4d4d8;
  --inline-code-text: #09090b;
  --code-text: #171717;
  --code-muted: #737373;
  --code-line: #e5e5e5;
  --code-button-bg: transparent;
  --code-button-hover: #f5f5f5;
  --code-token-comment: #6a737d;
  --code-token-keyword: #d0006f;
  --code-token-string: #007a1f;
  --code-token-number: #0057d9;
  --code-token-type: #7c3aed;
  --code-token-function: #0068d6;
  --code-token-operator: #24292e;
  --shadow: 0 16px 32px rgba(0, 0, 0, 0.08);
  --topbar-height: 48px;
  --sidebar-width: 390px;
  --sidebar-gutter: 0px;
  --content-width: 760px;
  --font-body: Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --font-display: Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --font-code: "Geist Mono", "SF Mono", "Cascadia Code", "Roboto Mono", ui-monospace, Menlo, Consolas, monospace;
}

:root[data-theme="dark"] {
  --bg: #000000;
  --panel: #000000;
  --panel-soft: #0a0a0a;
  --topbar-bg: #0a0a0a;
  --text: #ededed;
  --muted: #a3a3a3;
  --faint: #737373;
  --border: #262626;
  --border-strong: #404040;
  --accent: #ffffff;
  --accent-strong: #ffffff;
  --accent-soft: #171717;
  --toc-active-bg: rgba(255, 255, 255, 0.1);
  --warm: #f5f5f5;
  --code-bg: #0a0a0a;
  --code-header-bg: #0a0a0a;
  --inline-code-bg: #171717;
  --inline-code-border: #404040;
  --inline-code-text: #f5f5f5;
  --code-text: #ededed;
  --code-muted: #a3a3a3;
  --code-line: #262626;
  --code-button-bg: transparent;
  --code-button-hover: #262626;
  --code-token-comment: #7c7c7c;
  --code-token-keyword: #ff7b72;
  --code-token-string: #a5d6ff;
  --code-token-number: #79c0ff;
  --code-token-type: #d2a8ff;
  --code-token-function: #d2a8ff;
  --code-token-operator: #ededed;
  --shadow: 0 16px 32px rgba(0, 0, 0, 0.44);
}

body {
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  text-rendering: optimizeLegibility;
}

.app-shell {
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
}

.sidebar {
  width: var(--sidebar-width);
  border-right-color: var(--border);
  overflow: hidden;
}

.sidebar::after {
  display: none;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: var(--topbar-height);
  min-height: var(--topbar-height);
  max-height: var(--topbar-height);
  padding: 0 24px;
  background: var(--topbar-bg);
  border-bottom: 1px solid var(--border);
}

.sidebar-brand a {
  gap: 10px;
}

.sidebar-brand strong {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.sidebar-brand svg {
  width: 16px;
  height: 16px;
  stroke-width: 1.7;
}

.toc {
  padding: 18px 20px 40px;
}

.toc details {
  margin: 0;
}

.toc summary {
  display: flex;
  align-items: center;
  min-height: 40px;
}

.toc summary::after {
  content: "";
  width: 8px;
  height: 8px;
  margin-left: auto;
  border-right: 2px solid var(--faint);
  border-bottom: 2px solid var(--faint);
  transform: rotate(-45deg);
  transition: transform 120ms ease, border-color 120ms ease;
}

.toc details[open] > summary::after {
  transform: rotate(45deg);
}

.toc summary:hover::after {
  border-color: var(--muted);
}

.toc summary a,
.toc-chapter-link,
.toc-section {
  min-height: 40px;
  border-radius: 8px;
  color: var(--muted);
  font-size: 16px;
  font-weight: 300;
  font-variation-settings: "wght" 300;
  line-height: 1.25;
}

.toc summary a {
  flex: 1;
  min-width: 0;
  padding: 8px 10px 8px 0;
}

.toc-part {
  margin: 0 0 10px;
}

.toc-part + .toc-part {
  margin-top: 10px;
  padding-top: 0;
  border-top: 0;
}

.toc-part > summary a {
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 300;
  font-variation-settings: "wght" 300;
  letter-spacing: 0;
  text-transform: none;
}

.toc-part > ol {
  margin: 6px 0 10px 8px;
  padding: 0 0 0 8px;
  border-left: 1px solid var(--border);
}

.toc-chapter > summary a,
.toc-chapter-link {
  color: var(--muted);
  font-size: 14px;
  font-weight: 300;
  font-variation-settings: "wght" 300;
}

.toc-chapter > ol {
  margin: 6px 0 12px 8px;
  padding: 0 0 0 8px;
  border-left: 1px solid var(--border);
}

.toc-section {
  position: relative;
  z-index: 0;
  min-height: 40px;
  padding: 8px 12px 8px 14px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 300;
  font-variation-settings: "wght" 300;
  line-height: 1.25;
}

.toc summary a:hover,
.toc-chapter-link:hover,
.toc-section:hover {
  color: var(--text);
}

.toc-section.is-active {
  color: var(--text);
  font-weight: 300;
  font-variation-settings: "wght" 300;
}

.toc-section.is-active::before {
  left: -9px;
  top: 8px;
  bottom: 8px;
  width: 1px;
  border-radius: 0;
  z-index: 1;
}

.toc-section.is-active::after {
  content: "";
  position: absolute;
  inset: 0 0 0 -34px;
  z-index: -1;
  border-radius: 8px;
  background: var(--toc-active-bg);
  pointer-events: none;
}

.topbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  box-sizing: border-box;
  height: var(--topbar-height);
  min-height: var(--topbar-height);
  max-height: var(--topbar-height);
  padding: 0 24px;
  background: var(--topbar-bg);
  border-bottom-color: var(--border);
  overflow: visible;
}

.top-actions {
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: flex-end;
}

.menu-button,
.theme-button,
.back-to-top {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
}

.menu-button:hover,
.theme-button:hover,
.theme-button:focus-visible,
.back-to-top:hover {
  border-color: var(--border-strong);
  background: color-mix(in srgb, var(--text) 6%, transparent);
  color: var(--text);
  box-shadow: none;
}

.theme-icon {
  width: 16px;
  height: 16px;
}

.reading {
  max-width: var(--content-width);
  margin: 0 auto 0 72px;
  padding: 64px 32px 110px 0;
}

.book-hero {
  padding-bottom: 52px;
}

.eyebrow,
.kicker,
.part-header p {
  color: var(--faint);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.book-hero h1 {
  font-size: 44px;
  font-weight: 620;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.hero-copy {
  max-width: 620px;
  margin-top: 20px;
  color: var(--muted);
  font-size: 18px;
  line-height: 1.7;
}

.part-header {
  margin-top: 76px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--border);
}

.part-header h2 {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.035em;
}

.chapter-header {
  margin-top: 46px;
}

.chapter-header h3 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.subsection {
  margin-top: 34px;
  padding-bottom: 32px;
}

.subsection-header {
  margin-bottom: 16px;
}

.subsection-header h4 {
  gap: 7px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.subsection-header h4 > span:first-child {
  color: var(--text);
  font-family: var(--font-body);
  font-weight: 600;
}

.section-body {
  color: var(--muted);
  font-size: 16px;
  line-height: 1.78;
}

.section-body p,
.section-body ul,
.section-body ol,
.section-body blockquote,
.section-body .table-scroll,
.code-card {
  margin: 14px 0;
}

.section-body h5 {
  margin: 30px 0 10px;
  color: var(--text);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.015em;
}

.section-body h6 {
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  text-transform: none;
}

.section-body code:not(pre code) {
  border: 1px solid var(--inline-code-border);
  border-radius: 4px;
  background: var(--inline-code-bg);
  color: var(--inline-code-text);
  padding: 0.08em 0.3em;
  font-size: 0.9em;
  font-weight: 400;
}

.section-body a {
  color: var(--text);
  text-decoration-color: var(--border-strong);
}

.section-body a:hover {
  text-decoration-color: var(--text);
}

.table-scroll,
.missing-content {
  border-radius: 8px;
}

th {
  background: var(--panel-soft);
  font-weight: 600;
}

.code-card {
  border-color: var(--code-line);
  border-radius: 8px;
  background: var(--code-bg);
  box-shadow: none;
}

.code-card figcaption {
  min-height: 42px;
  justify-content: space-between;
  padding: 0 18px 0 20px;
  background: var(--code-header-bg);
  color: var(--code-muted);
  font-size: 12px;
}

.code-file {
  display: inline-flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 400;
}

.code-file-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 2px;
  background: #525252;
  color: #ffffff;
  font-family: var(--font-code);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
}

.copy-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 6px;
  background: var(--code-button-bg);
  color: var(--code-text);
  padding: 0;
}

.copy-button:hover,
.copy-button:focus {
  background: var(--code-button-hover);
}

.copy-button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.copy-button .check-icon {
  display: none;
}

.copy-button.is-copied .copy-icon {
  display: none;
}

.copy-button.is-copied .check-icon {
  display: block;
}

.copy-button.is-failed {
  color: #d0006f;
}

.code-card pre {
  background: var(--code-bg);
  font-variant-ligatures: none;
  font-feature-settings: "liga" 0, "calt" 0;
  line-height: 1.54;
  padding: 18px 24px;
}

.code-card code {
  display: block;
  font-size: 13px;
  font-weight: 300;
  font-variation-settings: "wght" 300;
  font-variant-ligatures: none;
  font-feature-settings: "liga" 0, "calt" 0;
  line-height: 1.54;
}

.code-card code * {
  font-weight: 300;
  font-variation-settings: "wght" 300;
}

.code-card .token.property,
.code-card .token.parameter,
.code-card .token.imports,
.code-card .token.exports {
  color: var(--code-token-function);
}

.back-to-top {
  width: auto;
  min-width: 42px;
  padding: 0 10px;
  font-size: 12px;
  text-decoration: none;
}

@media (max-width: 1080px) {
  :root {
    --sidebar-width: 292px;
  }
}

@media (max-width: 860px) {
  .sidebar {
    width: min(88vw, 320px);
  }

  .topbar {
    padding: 0 16px;
    height: var(--topbar-height);
    min-height: var(--topbar-height);
    max-height: var(--topbar-height);
  }

  .reading {
    margin: 0 auto;
    padding: 42px 22px 88px;
  }
}

@media (max-width: 640px) {
  .book-hero h1 {
    font-size: 36px;
  }

  .part-header h2 {
    font-size: 28px;
  }

  .chapter-header h3 {
    font-size: 21px;
  }
}
`

const scriptTemplate = String.raw`
const sectionEntries = __SECTION_ENTRIES__;

const root = document.documentElement;
const body = document.body;
const themeButton = document.getElementById("theme-toggle");
const menuButton = document.getElementById("menu-toggle");
const sidebarScrim = document.getElementById("sidebar-scrim");
const backToTop = document.getElementById("back-to-top");

const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const storedTheme = localStorage.getItem("effect-schedule-cookbook-theme");

const applyTheme = (theme) => {
  root.dataset.theme = theme;
  localStorage.setItem("effect-schedule-cookbook-theme", theme);
  themeButton.setAttribute("aria-label", theme === "dark" ? "Use light theme" : "Use dark theme");
  themeButton.setAttribute("title", theme === "dark" ? "Use light theme" : "Use dark theme");
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
    try {
      await copyText(target.innerText);
      button.classList.add("is-copied");
      button.setAttribute("aria-label", "Copied");
      button.setAttribute("title", "Copied");
      window.setTimeout(() => {
        button.classList.remove("is-copied");
        button.setAttribute("aria-label", "Copy code");
        button.setAttribute("title", "Copy code");
      }, 1300);
    } catch {
      button.classList.add("is-failed");
      button.setAttribute("aria-label", "Copy failed");
      button.setAttribute("title", "Copy failed");
      window.setTimeout(() => {
        button.classList.remove("is-failed");
        button.setAttribute("aria-label", "Copy code");
        button.setAttribute("title", "Copy code");
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

window.addEventListener("scroll", () => {
  backToTop.classList.toggle("is-visible", window.scrollY > 900);
}, { passive: true });
`

const contentHtml = `
${renderFrontMatter()}
${outline.parts.map(renderPart).join("\n")}
`

const script = scriptTemplate
  .replace("__SECTION_ENTRIES__", jsonForScript(sectionEntries))

const sidebarHtml = `
<aside class="sidebar" id="sidebar">
  <div class="sidebar-inner">
    <div class="sidebar-brand">
      <a href="#book-top" aria-label="Effect Schedule Cookbook">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 5.5c2.2-1 4.4-1 6.6 0v13c-2.2-1-4.4-1-6.6 0v-13Z"></path>
          <path d="M12.9 5.5c2.2-1 4.4-1 6.6 0v13c-2.2-1-4.4-1-6.6 0v-13Z"></path>
          <path d="M11.1 5.5c.6.3 1.2.3 1.8 0"></path>
        </svg>
        <strong>Effect Schedule Cookbook</strong>
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${styles}</style>
</head>
<body>
  <div class="sidebar-scrim" id="sidebar-scrim" aria-hidden="true"></div>
  <div class="app-shell">
    ${sidebarHtml}
    <div class="main-shell">
      <header class="topbar">
        <button class="menu-button" id="menu-toggle" type="button" aria-label="Open table of contents">Menu</button>
        <div class="top-actions">
          <button class="theme-button" id="theme-toggle" type="button" aria-label="Toggle theme">
            <svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12.7A8.5 8.5 0 1 1 11.3 3 6.6 6.6 0 0 0 21 12.7Z"></path>
            </svg>
            <svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M12 2v2"></path>
              <path d="M12 20v2"></path>
              <path d="m4.93 4.93 1.41 1.41"></path>
              <path d="m17.66 17.66 1.41 1.41"></path>
              <path d="M2 12h2"></path>
              <path d="M20 12h2"></path>
              <path d="m6.34 17.66-1.41 1.41"></path>
              <path d="m19.07 4.93-1.41 1.41"></path>
            </svg>
          </button>
        </div>
      </header>
      <main class="reading" id="book-top">
        <section class="book-hero" aria-labelledby="book-title">
          <p class="eyebrow">Technical handbook</p>
          <h1 id="book-title">Effect Schedule Cookbook</h1>
          <p class="hero-copy">A practical reading app for recurrence policies in Effect: retries, repeats, polling, backoff, jitter, deadlines, and operational safety.</p>
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

writeFileSync(outputPath, html.replace(/[ \t]+$/gm, "").replace(/\n*$/, "\n"))

process.stdout.write([
  `Wrote ${outputPath}`,
  `Outline source: ${publicOutlinePath ?? "embedded fallback"}`
].join("\n") + "\n")
