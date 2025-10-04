export const symbol = "~effect/interfaces/Opticable"
export const symbolRemove = "~effect/interfaces/OpticableRemove"

export interface Opticable {
  [symbol]<T extends object>(this: T, patch?: Partial<T> ): T
}

export const isOpticable = (u: unknown): u is Opticable => {
  return typeof u === "object" && u != null && symbol in u
}

export const patch = <T extends Opticable>(opticable: T, patchObj?: Partial<T> | undefined): T => {
  return opticable[symbol](patchObj )
}

