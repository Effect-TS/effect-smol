import { getSingles, handlerName, idFromTrail } from "../shared.ts"
import type { CommandRow } from "../types.ts"
import { optionRequiresValue } from "../types.ts"

export const generateRouter = (
  rows: ReadonlyArray<CommandRow>,
  executableName: string,
  rootCmd: any
): Array<string> => {
  const routerName = `_${executableName}_zsh_route`
  const rootCtx = idFromTrail([rootCmd.name])

  // Precompute value-taking tokens and subcommands by context
  const valueTakingTokensByCtx: Record<string, Array<string>> = {}
  const subcommandsByCtx: Record<string, Array<string>> = {}

  for (const { cmd, trail } of rows) {
    const ctx = idFromTrail(trail)
    const singles = getSingles(
      (cmd.parsedConfig.flags as ReadonlyArray<any>).filter((f: any) => f.kind === "flag")
    )
    const tokens: Array<string> = []
    for (const s of singles) {
      if (!optionRequiresValue(s)) continue
      tokens.push(`--${s.name}`)
      for (const a of s.aliases) tokens.push(a.length === 1 ? `-${a}` : `--${a}`)
    }
    valueTakingTokensByCtx[ctx] = tokens
    subcommandsByCtx[ctx] = cmd.subcommands.map((c: any) => c.name)
  }

  // Build case blocks for value-taking options per context
  const optionSkipCases: Array<string> = []
  for (const [ctx, toks] of Object.entries(valueTakingTokensByCtx)) {
    if (toks.length === 0) continue
    optionSkipCases.push(
      `    ${ctx})`,
      `      case "$w" in`,
      `        ${toks.map((t) => `"${t}"`).join("|")}) ((i++));;`,
      "      esac",
      "      ;;"
    )
  }

  // Build dispatch cases for subcommand recognition
  const subDispatchCases: Array<string> = []
  for (const { cmd, trail } of rows) {
    const ctx = idFromTrail(trail)
    for (const sc of cmd.subcommands) {
      const nextCtx = idFromTrail([...trail, sc.name])
      subDispatchCases.push(
        `    "${ctx}:${sc.name}")`,
        `      ctx="${nextCtx}"`,
        `      handler="${handlerName([...trail, sc.name], executableName)}"`,
        `      shift_index=$i`,
        "      ;;"
      )
    }
  }

  return [
    `function ${routerName}() {`,
    "  local -i i=2",
    "  local w",
    `  local ctx="${rootCtx}"`,
    `  local handler="${handlerName([rootCmd.name], executableName)}"`,
    "  local -i shift_index=0",
    "",
    "  # Walk through words to find the deepest subcommand,",
    "  # skipping option values for the current context.",
    "  while (( i <= $#words )); do",
    "    w=${words[i]}",
    "    if [[ $w == -* ]]; then",
    "      case \"$ctx\" in",
    ...optionSkipCases,
    "      esac",
    "    else",
    "      case \"$ctx:$w\" in",
    ...subDispatchCases,
    "      esac",
    "    fi",
    "    (( i++ ))",
    "  done",
    "",
    "  # If we matched a subcommand, drop everything up to it so the child",
    "  # handler sees only its own argv (avoids parent options confusing _arguments).",
    "  if (( shift_index > 0 )); then",
    "    (( CURRENT -= shift_index - 1 ))", // Fix: subtract 1 to keep the subcommand name
    "    if (( CURRENT < 1 )); then CURRENT=1; fi",
    "    shift $(( shift_index - 1 )) words", // Fix: subtract 1 to keep the subcommand name
    "  fi",
    "",
    "  # Call the most specific handler for the current context",
    "  $handler",
    "}"
  ]
}
