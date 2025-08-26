import type { FiberId } from "../../FiberId.ts"

/** @internal */
export const internalInterruptors = new WeakSet<FiberId>()
