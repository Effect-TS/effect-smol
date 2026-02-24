# Effect library documentation

## Writing basic `Effect`s

### Using Effect.gen

How to use `Effect.gen` to write effectful code in a more imperative style.

```ts
import { Console, Effect } from "effect"

Effect.gen(function*() {
  yield* Console.log("Starting the file processing...")
  yield* Console.log("Starting the file processing...")
})
```

## Writing Effect services

**[ServiceMap.Service](./ai-docs/src/01_effect/02_services/test.ts)**: How to define and use a service using `ServiceMap.Service` in Effect.
