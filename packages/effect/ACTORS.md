# Actors

An actor is defined by the `ActorLogic` interface:

```ts
export interface ActorLogic<
  State,
  Event,
  out Error = never,
  out Requirements = never,
  out Output = never,
  out InitialError = never
> {
  readonly initial: (scope: ActorScope<Event>) => Effect.Effect<State, InitialError, Requirements>
  readonly run: (context: ActorContext<State, Event>) => Effect.Effect<Output, Error, Requirements>
}
```

An actor is a process that contains a `State` and communicates with other actor processes with `Event`s.

`initial` allows to effectfully initialize the `State`, while also interacting with other actors as part of the initialization (`self`, `parent`, spawned children, or other actors in a `system`):

```ts
export interface ActorScope<Event> {
  readonly self: ActorRef<Event>
  readonly parent: ActorRef<unknown> | undefined
  readonly system: ActorSystemModule.ActorSystem
  readonly spawn: Spawn
  readonly sendTo: <Address extends string>(id: Address, event: ChildAddress.Event<Address>) => Effect.Effect<void>
  readonly stopChild: (id: string) => Effect.Effect<void>
}
```

`run` is the **internal** runtime behavior of the actor. It allows the same external communication as `initial` (with `ActorScope`), but also access to read/update its own internal `state` and react to external messages (`receive`):

```ts
export interface ActorContext<State, Event> extends ActorScope<Event> {
  readonly receive: Effect.Effect<Event>
  readonly state: Effect.Effect<State>
  readonly setState: (state: State) => Effect.Effect<void>
  readonly updateState: <E, R>(
    f: (state: State) => Effect.Effect<State, E, R>
  ) => Effect.Effect<void, E, R>
}
```

## Actor runtime

Executing the `start` method creates a runtime instance of an `ActorLogic` defined by the `Actor` interface:

```ts
export interface ActorRef<in Event> {
  readonly id: string
  readonly sessionId: string
  readonly systemId: string | undefined
  readonly send: (event: Event) => Effect.Effect<void>
}

export interface Actor<out State, in Event, out Error = never, out Output = never> extends ActorRef<Event> {
  readonly system: ActorSystemModule.ActorSystem
  readonly state: Effect.Effect<State>
  readonly snapshot: Effect.Effect<Snapshot<State, Error, Output>>
  readonly changes: Stream.Stream<Snapshot<State, Error, Output>>
  readonly join: Effect.Effect<Output, Error | ActorStoppedError>
  readonly stop: Effect.Effect<void>
}
```

`ActorRef` is the addressable handle of the actor (identity and sending to it). The full `Actor` gives access to the internal runtime state.

### Sending to an actor (Queue)

An actor contains a `Queue<Event>` internally to store (and expose) received messages:

```ts
const queue = yield * Queue.unbounded<Event>()
```

Calling `send` on an `ActorRef` adds an event to the queue:

```ts
const self: Actor.ActorRef<Event> = {
  id,
  sessionId,
  systemId: options.systemId,
  send: (event: Event) => Queue.offer(queue, event).pipe(Effect.asVoid)
}
```

The queue is `shutdown` when the actor is stopped or finalized.

`receive` (`ActorContext`) exposes elements of the queue:

```ts
receive: Queue.take(queue)
```

### Actor snapshot (SynchronizedRef)

The internal state of an actor is represented by `Snapshot`:

```ts
export type Snapshot<State, Error = never, Output = never> =
  | {
    readonly status: "active"
    readonly state: State
  }
  | {
    readonly status: "done"
    readonly state: State
    readonly output: Output
  }
  | {
    readonly status: "error"
    readonly state: State
    readonly cause: Cause.Cause<Error>
  }
  | {
    readonly status: "stopped"
    readonly state: State
  }
```

When started, an actor enters the `active` state with the `State` value from the `initial` effect (`ActorLogic`).

```ts
const current = yield * SynchronizedRef.make<Actor.Snapshot<State, Error | InitialError, Output>>({
  status: "active",
  state: initial
})
```

`snapshot` (`Actor`) exposes the current snapshot:

```ts
snapshot: SynchronizedRef.get(current)
```

`state` (`ActorContext`) extracts the `state` value from the snapshot:

```ts
state: SynchronizedRef.get(current).pipe(Effect.map((snapshot) => snapshot.state))
```

Updates to the state are only allowed when the actor is `active`.

### Publishing snapshots (PubSub)

An actor exposes a `changes` stream to listen to snapshot updates:

```ts
const changes = yield * PubSub.unbounded<Take.Take<Actor.Snapshot<State, Error | InitialError, Output>>>({
  replay: 1
})
```

Every time the snapshot changes, the change is published in the `PubSub`:

```ts
const publishSnapshot = (
  snapshot: Actor.Snapshot<State, Error | InitialError, Output>
): Effect.Effect<Actor.Snapshot<State, Error | InitialError, Output>> =>
  PubSub.publish(changes, [snapshot] as const).pipe(Effect.as(snapshot))
```

`changes` extract a subscription from the `PubSub` and exposes it as a `Stream`:

```ts
const subscription = yield * PubSub.subscribe(changes)
```

### Terminalization (Fiber)

At runtime an actor is managed by a `Fiber`:

> `Deferred` is used to define the `stop` method needed to create the `Actor`.
>
> If `stop` runs before the actor fiber has been assigned, it simply waits until the fiber exists, then interrupts it.

```ts
const fiberRef = yield * Deferred.make<Fiber.Fiber<void>>()
```

An actor system uses `Scope` to manage concurrency of parent/children. Calling `Actor.start` creates a fresh `ActorSystem` (exposed as `system` inside `Actor`) which owns the scope of this actor fiber. If the actor spawns children, then those are forked inside the same parent scope.

If the parent/system is stopped, the scope is closed for all the children (all the actors in the system).

### Child Runtime

Each parent actor stores a reference of all its children when spawned (`spawn`):

```ts
const childRegistry = yield * SynchronizedRef.make<HashMap.HashMap<string, ChildEntry>>(HashMap.empty())
```

This also allows to keep track of actor ids and make sure there are no duplicates (reserved ids).

> When an actor is being spawned, the child's id is marked as `Reserved`, waiting for the its initialization. This allows an id to become reserved before the child is fully started.

`sendTo` and `stopChild` read from the registry and execute if the child is `Started`.

`spawn` recursively calls `start` and attaches the parent scope to the child, while also reserving the id if provided.

### Supervision

A supervision policy allows to specify the behavior of child actors:

- `None`: On error, just terminate the actor (default)
- `StopOwner`: On error, stop the parent as well
- `Restart`: On error, try to restart the child based on the provided `Schedule`

## ActorSystem

Every actor is part of a `ActorSystem`. You can either create a system with `ActorSystem.make` and spawn actors inside it (`spawn`), or just start an actor, in which case a system is created automatically with that actor as the root.

```ts
export interface ActorSystem {
  readonly spawn: SystemSpawn
  readonly get: <Event = unknown>(systemId: string) => Effect.Effect<Option.Option<Actor.ActorRef<Event>>>
  readonly getAll: Effect.Effect<HashMap.HashMap<string, Actor.ActorRef<unknown>>>
  readonly send: <Event>(systemId: string, event: Event) => Effect.Effect<void>
  readonly stop: (systemId: string) => Effect.Effect<void>
  readonly events: Stream.Stream<Event>
}
```

A system is similar to a single an actor:

- `spawn` create an actor in the system in the same scope
- Internally a `SynchronizedRef` stores a registry of actor by `sessionId`
- `get`, `getAll`, `send`, `stop` all access the registry
- A `PubSub` keep track of events, exposed as a `Stream` in `events`

# State Machine

A state machine in isolation (without actor) is a data structure that contains a `State` and accepts `Events`.

`make` allows to define the logic of the machine (states, events, handlers):

```ts
import { Schema } from "effect"
import { StateMachine } from "effect/unstable/actors"

class Idle extends Schema.TaggedClass<Idle>("Idle")("Idle", {}) {}
class Loading extends Schema.TaggedClass<Loading>("Loading")("Loading", {}) {}
class Success extends Schema.TaggedClass<Success>("Success")("Success", {}) {}

class Submit extends Schema.TaggedClass<Submit>("Submit")("Submit", {
  userId: Schema.String
}) {}

const machine = StateMachine.make({
  states: [Idle, Loading, Success],
  events: [Submit],
  initial: () => new Idle({})
})
```

Then, internally an interpreter allows to simulate transitions (`plan`, `next` and more).

With `start` a machine becomes an active `Actor`, keeping all the same actor API (e.g. `send` to send a typed event to the machine):

```ts
const machine = StateMachine.make({
  states: [Idle, Loading, Success],
  events: [Submit],
  initial: () => new Idle({})
})

const main = Effect.gen(function*() {
  const actor = yield* StateMachine.start(machine)

  yield* actor.send(new Submit({ userId: "user-1" }))
})
```

## Definition

Defining a machine uses `make`, which takes the static configuration of the machine as config.

Then chaining `handle` calls allows to handle each state of the machine. This allows to react to events with APIs to run effects and manage child actors (`action`, `spawn`, `sendTo` and more).

## Interpreter

Without running a machine, is possible to inspect and plan transitions:

- `planInitial`
- `plan`
- `enabled`
- `isFinal`

## Actor

`toActorLogic` allows to convert a `StateMachine` to `ActorLogic`.

`start` is a convenience wrapper around `Actor.start(toActorLogic)`.
