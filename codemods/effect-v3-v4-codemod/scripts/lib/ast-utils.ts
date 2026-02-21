import type { Edit } from "codemod:ast-grep";

export type AnyNode = any;

export function getMatchText(node: AnyNode, name: string): string | null {
  const match = node.getMatch(name);
  if (!match) {
    return null;
  }

  return match.text();
}

export function getMultipleMatchTexts(node: AnyNode, name: string): Array<string> {
  return node
    .getMultipleMatches(name)
    .map((match: AnyNode) => match.text())
    .map((text: string) => text.trim())
    .filter((text: string) => text.length > 0 && text !== ",");
}

export function replaceNode(node: AnyNode, replacement: string): Edit | null {
  if (replacement === node.text()) {
    return null;
  }

  return node.replace(replacement);
}

function isIdentifierStart(char: string): boolean {
  if (char === "_" || char === "$") {
    return true;
  }

  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

function isIdentifierPart(char: string): boolean {
  if (isIdentifierStart(char)) {
    return true;
  }

  return char >= "0" && char <= "9";
}

export function isSimpleIdentifierText(text: string): boolean {
  if (text.length === 0) {
    return false;
  }

  const first = text[0];
  if (!first || !isIdentifierStart(first)) {
    return false;
  }

  for (let index = 1; index < text.length; index++) {
    const char = text[index];
    if (!char || !isIdentifierPart(char)) {
      return false;
    }
  }

  return true;
}
