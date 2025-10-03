import * as Option from "../../../../data/Option.ts"
import type { Command } from "../../Command.ts"
import * as Param from "../../Param.ts"
import type { CommandRow, SingleFlagMeta } from "./types.ts"

export const getSingles = (flags: ReadonlyArray<Param.Param<any>>): ReadonlyArray<SingleFlagMeta> =>
  flags
    .flatMap(Param.extractSingleParams)
    .filter((s: any) => s.kind === "flag")
    .map((s: any) => {
      const description = Option.getOrUndefined(s.description)
      const base = {
        name: s.name,
        aliases: s.aliases,
        primitiveTag: s.primitiveType._tag,
        ...(s.typeName !== undefined ? { typeName: s.typeName } : {})
      }

      return typeof description === "string" ? { ...base, description } : base
    })

export const flattenCommand = <Name extends string, I, E, R>(
  cmd: Command<Name, I, E, R>,
  parents: Array<string> = []
): Array<CommandRow<any, any, any, any>> => {
  const here = [...parents, cmd.name]
  const rows = [{ trail: here, cmd }]
  for (const c of cmd.subcommands) {
    const nested = flattenCommand(c as Command<any, any, any, any>, here)
    for (const row of nested) rows.push(row)
  }
  return rows
}

export const idFromTrail = (trail: Array<string>): string => trail.map((p) => p.replace(/-/g, "_")).join("_")

export const handlerName = (trail: Array<string>, executableName: string): string =>
  `_${executableName}_${idFromTrail(trail)}_handler`
