import { Effect } from "effect"

export function Demo() {
  const handler = Effect.catch((error: string) => Effect.succeed(error))

  return <button onClick={() => Effect.forkChild(handler)}>Run</button>
}
