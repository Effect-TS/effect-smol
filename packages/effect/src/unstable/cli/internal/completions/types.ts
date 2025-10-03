import type { Command } from "../../Command.ts"

/** @internal */
export type Shell = "bash" | "zsh" | "fish"

/** @internal */
export interface SingleFlagMeta {
  readonly name: string
  readonly aliases: ReadonlyArray<string>
  readonly primitiveTag: string
  readonly typeName?: string
  readonly description?: string
}

/** @internal */
export interface CommandRow<
  Name extends string = string,
  I = any,
  E = any,
  R = any
> {
  readonly trail: Array<string>
  readonly cmd: Command<Name, I, E, R>
}

/** @internal */
export const isDirType = (s: SingleFlagMeta): boolean => s.typeName === "directory"

/** @internal */
export const isFileType = (s: SingleFlagMeta): boolean => s.typeName === "file"

/** @internal */
export const isEitherPath = (s: SingleFlagMeta): boolean =>
  s.typeName === "path" || s.typeName === "either" || s.primitiveTag === "Path"

/** @internal */
export const optionRequiresValue = (s: SingleFlagMeta): boolean => s.primitiveTag !== "Boolean"
