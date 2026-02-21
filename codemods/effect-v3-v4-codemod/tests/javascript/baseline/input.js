import { Cause, Effect, Scope } from "effect";

const run = Effect.die("defect").pipe(
  Effect.catchAllCause((cause) => Effect.succeed(cause))
);

const fiber = Effect.forkDaemon(run);
const combined = Cause.parallel(Cause.fail("a"), Cause.fail("b"));
const provided = Scope.extend(run, {});
