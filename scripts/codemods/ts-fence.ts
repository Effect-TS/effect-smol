import type * as cs from "jscodeshift"

export default function transformer(file: cs.FileInfo, api: cs.API) {
  const j = api.jscodeshift
  const root = j(file.source)

  root.find(j.Comment as any).forEach((path) => {
    if (path.value.type === "CommentBlock") {
      const value = (path.value) as any
      const comment = value.value
      const wrapped = wrapExamplesWithFence(comment)
      if (wrapped !== comment) {
        value.value = wrapped
      }
    }
  })

  return root.toSource()
}

function wrapExamplesWithFence(jsdocComment: string) {
  const lines = normalizeJSDocLines(jsdocComment.split("\n"))
  const output: Array<string> = []
  let changed = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    output.push(line)

    if (!isExampleLine(line)) {
      continue
    }

    const nextContentLine = findNextContentLine(lines, i + 1)
    if (nextContentLine !== -1 && isTsFenceLine(lines[nextContentLine])) {
      continue
    }

    changed = true

    const prefix = getJSDocLine(line)?.prefix ?? " * "
    const nextTagLine = findNextTagLine(lines, i + 1)
    const endLine = nextTagLine === -1 ? findClosingPaddingLine(lines) : nextTagLine
    let exampleEnd = endLine === -1 ? lines.length : endLine

    if (nextTagLine !== -1) {
      while (exampleEnd > i + 1 && isBlankJSDocLine(lines[exampleEnd - 1])) {
        exampleEnd--
      }
    }

    output.push(`${prefix}\`\`\`ts`)
    for (let j = i + 1; j < exampleEnd; j++) {
      output.push(lines[j])
    }
    output.push(`${prefix}\`\`\``)

    if (endLine !== -1) {
      for (let j = exampleEnd; j < endLine; j++) {
        output.push(lines[j])
      }
      i = endLine - 1
    } else {
      i = lines.length - 1
    }
  }

  return changed ? output.join("\n") : jsdocComment
}

function normalizeJSDocLines(lines: Array<string>) {
  return lines.map((line, index) => {
    const jsdocLine = getJSDocLine(line)
    if (jsdocLine === null) {
      return isClosingPaddingLine(line) ? " " : line
    }
    if (index === 0 && jsdocLine.text === "") {
      return "*"
    }
    return jsdocLine.text === "" ? " *" : ` * ${jsdocLine.text}`
  })
}

function getJSDocLine(line: string) {
  const match = line.match(/^(\s*\*\s?)(.*)$/)
  if (!match) {
    return null
  }
  return { prefix: match[1], text: match[2] }
}

function isExampleLine(line: string) {
  const jsdocLine = getJSDocLine(line)
  return jsdocLine !== null && /^@example\b/.test(jsdocLine.text.trim())
}

function isTsFenceLine(line: string) {
  const jsdocLine = getJSDocLine(line)
  return jsdocLine !== null && /^```(?:ts|typescript)?\s*$/.test(jsdocLine.text.trim())
}

function isTagLine(line: string) {
  const jsdocLine = getJSDocLine(line)
  return jsdocLine !== null && /^@\w/.test(jsdocLine.text.trim())
}

function isBlankJSDocLine(line: string) {
  const jsdocLine = getJSDocLine(line)
  return jsdocLine !== null && jsdocLine.text.trim() === ""
}

function isClosingPaddingLine(line: string) {
  return getJSDocLine(line) === null && line.trim() === ""
}

function findNextContentLine(lines: Array<string>, start: number) {
  for (let i = start; i < lines.length; i++) {
    if (!isBlankJSDocLine(lines[i])) {
      return i
    }
  }
  return -1
}

function findNextTagLine(lines: Array<string>, start: number) {
  for (let i = start; i < lines.length; i++) {
    if (isTagLine(lines[i])) {
      return i
    }
  }
  return -1
}

function findClosingPaddingLine(lines: Array<string>) {
  const lastLineIndex = lines.length - 1
  if (lastLineIndex >= 0 && isClosingPaddingLine(lines[lastLineIndex])) {
    return lastLineIndex
  }
  return -1
}
