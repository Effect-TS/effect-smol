import type { Command } from "../../Command.ts"

export type Shell = "bash" | "zsh" | "fish"

export interface SingleFlagMeta {
  readonly name: string
  readonly aliases: ReadonlyArray<string>
  readonly primitiveTag: string
  readonly typeName?: string
  readonly description?: string
}

export interface CommandRow<
  Name extends string = string,
  I = any,
  E = any,
  R = any
> {
  readonly trail: Array<string>
  readonly cmd: Command<Name, I, E, R>
}

export const isDirType = (s: SingleFlagMeta): boolean => s.typeName === "directory"
export const isFileType = (s: SingleFlagMeta): boolean => s.typeName === "file"
export const isEitherPath = (s: SingleFlagMeta): boolean =>
  s.typeName === "path" || s.typeName === "either" || s.primitiveTag === "Path"

export const optionRequiresValue = (s: SingleFlagMeta): boolean => s.primitiveTag !== "Boolean"
