export const symbol = "~effect/interfaces/Clonable"

export interface Clonable {
  [symbol]<T extends object>(this: T, patch?: T extends T ? Partial<T> : T): T
}
