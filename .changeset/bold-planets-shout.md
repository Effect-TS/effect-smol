---
"effect": minor
---

add support for merging external events into `Prompt.custom` render loops via an optional `events` dequeue and `receive` handler.

The prompt races user input against events from the dequeue, allowing background events to trigger re-renders without waiting for a keypress:

```ts
const eventQueue = yield * Queue.make<number>()

const prompt = Prompt.custom(
  { count: 0 },
  {
    render: (state) => Effect.succeed(`Count: ${state.count}`),
    process: (_input, state) => Effect.succeed(Action.Submit({ value: state.count })),
    clear: () => Effect.succeed(""),
    receive: (value, state) => Effect.succeed(Action.NextFrame({ state: { count: state.count + value } })) // <-- handle events from the dequeue
  },
  Queue.asDequeue(eventQueue) // <-- provide the event queue as a dequeue to the prompt
)
```
