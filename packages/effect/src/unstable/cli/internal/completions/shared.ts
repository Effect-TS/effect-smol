import * as Param from "../../Param.ts"
import type { FlagDescriptor } from "./types.ts"

/** @internal */
export const getSingles = (flags: ReadonlyArray<Param.Any>): ReadonlyArray<FlagDescriptor> =>
  flags
    .flatMap(Param.extractSingleParams)
    .filter((s) => s.kind === "flag")
    .map((s) => {
      const description = s.description
      const base = {
        name: s.name,
        aliases: s.aliases,
        primitiveTag: s.primitiveType._tag,
        ...(s.typeName !== undefined ? { typeName: s.typeName } : {})
      }

      return typeof description === "string" ? { ...base, description } : base
    })
