import { Effect, Schedule } from "effect"

const program = Effect.log("OK").pipe(Effect.repeat({
  schedule: Schedule.cron("* * * * * *")
}))

Effect.runFork(program)
