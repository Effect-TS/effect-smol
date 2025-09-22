## Alpha (current)

Releases are snapshot only

- [ ] Port Channel / Stream / Sink apis
- [ ] Port worker modules
- [ ] Port command execution modules
- [ ] Port platform-browser
- [ ] Add CLI modules
- [ ] Add opentelemetry package
- [ ] Port SubscriptionRef
- [ ] RateLimiter with persistence
- [ ] Reduce nesting of modules

## Beta

Pre-releases to npm from smol repo
- [ ] Comprehensive JSDoc on every exported function
- [ ] Codemod CLI for v3 migration

## RC's

Pre-releases to npm from smol repo

## Release

- [ ] Copy code over to main repo

# Module Audit

The exports under each section are organized as they are in Effect 3.0. The categorization of these modules may not be correct, and should be fixed for 4.0.

### Legend

| Status | Description                                      |
| :----: | :----------------------------------------------- |
|   -    | Not done (default)                               |
|  Done  | Done - successfully ported to Effect 4           |
|   X    | Won't do - not being ported to Effect 4          |
|   ?    | Question - method has questions or uncertainties |

## Channel

### Constructors

|      Effect 3       | Ported |      Effect 4       |                                                        Comments                                                        |
| :-----------------: | :----: | :-----------------: | :--------------------------------------------------------------------------------------------------------------------: |
| `acquireReleaseOut` |  Done  |  `acquireRelease`   |                                                                                                                        |
| `acquireUseRelease` |  Done  | `acquireUseRelease` |                                                                                                                        |
|      `buffer`       |  Done  |                     |                                                                                                                        |
|    `bufferChunk`    |  Done  |                     |                                                                                                                        |
|     `concatAll`     |  Done  |      `concat`       |                                                Category fixed for 4.0.                                                 |
|   `concatAllWith`   |  Done  |    `concatWith`     | Category fixed for 4.0. New method does not have exactly the same semantics as 3.0, but provides similar functionality |
|       `fail`        |  Done  |       `fail`        |                                                                                                                        |
|     `failCause`     |  Done  |     `failCause`     |                                                                                                                        |
|   `failCauseSync`   |  Done  |   `failCauseSync`   |                                                                                                                        |
|     `failSync`      |  Done  |     `failSync`      |                                                                                                                        |
|    `fromEffect`     |  Done  |    `fromEffect`     |                                                                                                                        |
|    `fromEither`     |   X    |                     |                                         Convert to Effect and use `fromEffect`                                         |
|     `fromInput`     |   X    |                     |                                               Scoped variants not needed                                               |
|    `fromOption`     |   X    |                     |                                         Convert to Effect and use `fromEffect`                                         |
|    `fromPubSub`     |  Done  |    `fromPubSub`     |                                                                                                                        |
| `fromPubSubScoped`  |   X    |                     |                                               Scoped variants not needed                                               |
|     `fromQueue`     |  Done  |     `fromQueue`     |                                                                                                                        |
|     `identity`      |  Done  |                     |                                                                                                                        |
|       `never`       |  Done  |       `never`       |                                                                                                                        |
|       `read`        |   X    |                     |                                                      Not required                                                      |
|    `readOrFail`     |   X    |                     |                                                      Not required                                                      |
|     `readWith`      |   X    |                     |                                                      Not required                                                      |
|   `readWithCause`   |   X    |                     |                                                      Not required                                                      |
|      `scoped`       |   X    |                     |                                                      Not required                                                      |
|    `scopedWith`     |   X    |                     |                                                      Not required                                                      |
|      `succeed`      |  Done  |      `succeed`      |                                                                                                                        |
|      `suspend`      |  Done  |      `suspend`      |                                                                                                                        |
|       `sync`        |  Done  |       `sync`        |                                                                                                                        |
|      `unwrap`       |  Done  |      `unwrap`       |                                                                                                                        |
|   `unwrapScoped`    |   X    |                     |                                              Scoped variants not required                                              |
| `unwrapScopedWith`  |   X    |                     |                                              Scoped variants not required                                              |
|       `void`        |   X    |                     |                                                New api is `Channel.end`                                                |
|       `write`       |   X    |                     |                                            `Channel.write` is part of Pull                                             |
|     `writeAll`      |   X    |                     |                                            `Channel.write` is part of Pull                                             |
|    `writeChunk`     |   X    |                     |                                            `Channel.write` is part of Pull                                             |

### Context

|       Effect 3       | Ported |     Effect 4      | Comments |
| :------------------: | :----: | :---------------: | :------: |
|      `context`       |   X    |                   |          |
|    `contextWith`     |  Done  |  `servicesWith`   |          |
| `contextWithChannel` |  Done  |  `servicesWith`   |          |
| `contextWithEffect`  |  Done  | `servicesWith`    |          |
|  `mapInputContext`   |  Done  | `updateServices`  |          |
|   `provideContext`   |  Done  | `provideServices` |          |
|    `provideLayer`    |   -    |                   |          |
|   `provideService`   |   -    |                   |          |
|  `provideSomeLayer`  |   X    |                   |          |
|   `updateService`    |   -    |                   |          |

### Destructors

|   Effect 3   | Ported |       Effect 4       | Comments |
| :----------: | :----: | :------------------: | :------: |
|    `run`     |  Done  |      `runDone`       |          |
| `runCollect` |  Done  |     `runCollect`     |          |
|  `runDrain`  |  Done  |      `runDrain`      |          |
| `runScoped`  |   X    |                      |          |
|  `toPubSub`  |   -    |                      |          |
|   `toPull`   |  Done  |       `toPull`       |          |
|  `toPullIn`  |  Done  |    `toPullScoped`    |          |
|  `toQueue`   |  Done  |      `toQueue`       |          |
|   `toSink`   |   X    |  `Sink.fromChannel`  |          |
|  `toStream`  |   X    | `Stream.fromChannel` |          |

### Error Handling

|    Effect 3     | Ported |   Effect 4   | Comments        |
| :-------------: | :----: | :----------: | :-------------: |
|   `catchAll`    |  Done  |   `catch`    |                 |
| `catchAllCause` |  Done  | `catchCause` |                 |
|     `orDie`     |  Done  |   `orDie`    |                 |
|   `orDieWith`   |   X    |              | `catch` + `die` |
|    `orElse`     |   X    |   `catch`    |                 |

### Mapping

|     Effect 3      | Ported |    Effect 4     |           Comments           |
| :---------------: | :----: | :-------------: | :--------------------------: |
|       `as`        |   X    |                 | `mapDone` takes care of this |
|     `asVoid`      |   X    |                 | `mapDone` takes care of this |
|       `map`       |  Done  |    `mapDone`    |                              |
|    `mapEffect`    |  Done  | `mapDoneEffect` |                              |
|    `mapError`     |  Done  |   `mapError`    |                              |
|  `mapErrorCause`  |   -    |   `mapCause`    |                              |
|     `mapOut`      |  Done  |      `map`      |                              |
|  `mapOutEffect`   |  Done  |   `mapEffect`   |                              |
| `mapOutEffectPar` |  Done  |   `mapEffect`   |  With concurrency specified  |
|    `mergeMap`     |   -    |                 |                              |

### Sequencing

| Effect 3  | Ported | Effect 4  | Comments |
| :-------: | :----: | :-------: | :------: |
| `flatMap` |  Done  | `flatMap` |          |
| `flatten` |  Done  | `flatten` |          |

### Refinements

|       Effect 3       | Ported |  Effect 4   | Comments |
| :------------------: | :----: | :---------: | :------: |
|     `isChannel`      |  Done  | `isChannel` |          |
| `isChannelException` |   X    |             |          |

### Tracing

|  Effect 3  | Ported |  Effect 4  | Comments |
| :--------: | :----: | :--------: | :------: |
| `withSpan` |  Done  | `withSpan` |          |

### Utility Functions

|        Effect 3         | Ported |   Effect 4   |      Comments       |
| :---------------------: | :----: | :----------: | :-----------------: |
|        `collect`        |  Done  |   `filter`   |                     |
|       `concatMap`       |   -    |              |                     |
|     `concatMapWith`     |   -    |              |                     |
|  `concatMapWithCustom`  |   -    |              |                     |
|       `concatOut`       |   -    |              |                     |
|      `doneCollect`      |   -    |              |                     |
|         `drain`         |  Done  |              |                     |
|      `embedInput`       |  Done  | `embedInput` |                     |
|      `emitCollect`      |   -    |              |                     |
|       `ensuring`        |  Done  |  `ensuring`  |                     |
|     `ensuringWith`      |  Done  |   `onExit`   |                     |
|   `foldCauseChannel`    |   -    |              |                     |
|      `foldChannel`      |   -    |              |                     |
|     `interruptWhen`     |  Done  |              |                     |
| `interruptWhenDeferred` |   X    |              | Use `interruptWhen` |
|       `mapInput`        |   -    |              |                     |
|    `mapInputEffect`     |   -    |              |                     |
|     `mapInputError`     |   -    |              |                     |
