/**
 * @title Using Effect.gen
 *
 * How to use `Effect.gen` to write effectful code in a more imperative style.
 */

import { Console, Effect } from "effect"

Effect.gen(function*() {
  yield* Console.log("Starting the file processing...")
  yield* Console.log("Starting the file processing...")
})
