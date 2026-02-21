import { Cause, Effect, Scope } from "effect";

const run = Effect.die("defect").pipe(
  Effect.catchCause((cause) => Effect.succeed(cause))
);

const fiber = Effect.forkDetach(run);
const combined = Cause.combine(Cause.fail("a"), Cause.fail("b"));
const provided = Scope.provide({})(run);
