import { Effect } from "effect"

export function Demo() {
  const handler = Effect.catchAll((error: string) => Effect.succeed(error))

  return <button onClick={() => Effect.fork(handler)}>Run</button>
}
