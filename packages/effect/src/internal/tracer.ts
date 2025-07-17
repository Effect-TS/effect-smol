import type * as Tracer from "../Tracer.ts"

export interface ErrorWithStackTraceLimit {
  stackTraceLimit?: number | undefined
}

/** @internal */
export const addSpanStackTrace = (options: Tracer.SpanOptions | undefined): Tracer.SpanOptions => {
  if (options?.captureStackTrace === false) {
    return options
  } else if (options?.captureStackTrace !== undefined && typeof options.captureStackTrace !== "boolean") {
    return options
  }
  const limit = (Error as ErrorWithStackTraceLimit).stackTraceLimit
  ;(Error as ErrorWithStackTraceLimit).stackTraceLimit = 3
  const traceError = new Error()
  ;(Error as ErrorWithStackTraceLimit).stackTraceLimit = limit
  let cache: false | string = false
  return {
    ...options,
    captureStackTrace: () => {
      if (cache !== false) {
        return cache
      }
      if (traceError.stack !== undefined) {
        const stack = traceError.stack.split("\n")
        if (stack[3] !== undefined) {
          cache = stack[3].trim()
          return cache
        }
      }
    }
  }
}
