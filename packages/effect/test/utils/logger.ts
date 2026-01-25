import { type Cause, Logger, type LogLevel } from "effect"

export const makeTestLogger = () => {
  const capturedLogs: Array<{
    readonly logLevel: LogLevel.LogLevel
    readonly cause: Cause.Cause<unknown>
  }> = []
  const testLogger = Logger.make<unknown, void>((options) => {
    capturedLogs.push({ logLevel: options.logLevel, cause: options.cause })
  })
  return { capturedLogs, testLogger }
}
