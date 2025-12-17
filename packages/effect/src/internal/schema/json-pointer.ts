/** @internal */
export function escapeToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1")
}

/** @internal */
export function unescapeToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~")
}
