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
export const optionRequiresValue = (s: SingleFlagMeta): boolean => s.primitiveTag !== "Boolean"
