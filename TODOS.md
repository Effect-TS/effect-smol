## Alpha (current)

Releases are snapshot only

- [x] Port Channel apis
- [ ] Port Stream / Sink apis
- [ ] Port worker modules
- [ ] Port command execution modules
- [ ] Port platform-browser
- [ ] Add CLI modules
- [ ] Add opentelemetry package
- [ ] Port SubscriptionRef
- [ ] RateLimiter with persistence
- [x] Reduce nesting of modules

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

|      Effect 3       | Ported |      Effect 4       |                Comments                |
| :-----------------: | :----: | :-----------------: | :------------------------------------: |
| `acquireReleaseOut` |  Done  |  `acquireRelease`   |                                        |
| `acquireUseRelease` |  Done  | `acquireUseRelease` |                                        |
|      `buffer`       |  Done  |                     |                                        |
|    `bufferChunk`    |  Done  |                     |                                        |
|     `concatAll`     |  Done  |      `concat`       |                                        |
|   `concatAllWith`   |  Done  |    `concatWith`     |                                        |
|       `fail`        |  Done  |       `fail`        |                                        |
|     `failCause`     |  Done  |     `failCause`     |                                        |
|   `failCauseSync`   |  Done  |   `failCauseSync`   |                                        |
|     `failSync`      |  Done  |     `failSync`      |                                        |
|    `fromEffect`     |  Done  |    `fromEffect`     |                                        |
|    `fromEither`     |   X    |                     | Convert to Effect and use `fromEffect` |
|     `fromInput`     |   X    |                     |       Scoped variants not needed       |
|    `fromOption`     |   X    |                     | Convert to Effect and use `fromEffect` |
|    `fromPubSub`     |  Done  |    `fromPubSub`     |                                        |
| `fromPubSubScoped`  |   X    |                     |       Scoped variants not needed       |
|     `fromQueue`     |  Done  |     `fromQueue`     |                                        |
|     `identity`      |  Done  |                     |                                        |
|       `never`       |  Done  |       `never`       |                                        |
|       `read`        |   X    |                     |              Not required              |
|    `readOrFail`     |   X    |                     |              Not required              |
|     `readWith`      |   X    |                     |              Not required              |
|   `readWithCause`   |   X    |                     |              Not required              |
|      `scoped`       |   X    |                     |              Not required              |
|    `scopedWith`     |   X    |                     |              Not required              |
|      `succeed`      |  Done  |      `succeed`      |                                        |
|      `suspend`      |  Done  |      `suspend`      |                                        |
|       `sync`        |  Done  |       `sync`        |                                        |
|      `unwrap`       |  Done  |      `unwrap`       |                                        |
|   `unwrapScoped`    |   X    |                     |      Scoped variants not required      |
| `unwrapScopedWith`  |   X    |                     |      Scoped variants not required      |
|       `void`        |   X    |                     |        New api is `Channel.end`        |
|       `write`       |   X    |                     |    `Channel.write` is part of Pull     |
|     `writeAll`      |   X    |                     |    `Channel.write` is part of Pull     |
|    `writeChunk`     |   X    |                     |    `Channel.write` is part of Pull     |

### Context

|       Effect 3       | Ported |     Effect 4      | Comments |
| :------------------: | :----: | :---------------: | :------: |
|      `context`       |   X    |                   |          |
|    `contextWith`     |  Done  |  `servicesWith`   |          |
| `contextWithChannel` |  Done  |  `servicesWith`   |          |
| `contextWithEffect`  |  Done  |  `servicesWith`   |          |
|  `mapInputContext`   |  Done  | `updateServices`  |          |
|   `provideContext`   |  Done  | `provideServices` |          |
|    `provideLayer`    |  Done  |     `provide`     |          |
|   `provideService`   |  Done  |                   |          |
|  `provideSomeLayer`  |   X    |                   |          |
|   `updateService`    |  Done  |                   |          |

### Destructors

|   Effect 3   | Ported |       Effect 4       | Comments |
| :----------: | :----: | :------------------: | :------: |
|    `run`     |  Done  |      `runDone`       |          |
| `runCollect` |  Done  |     `runCollect`     |          |
|  `runDrain`  |  Done  |      `runDrain`      |          |
| `runScoped`  |   X    |                      |          |
|  `toPubSub`  |  Done  |                      |          |
|   `toPull`   |  Done  |       `toPull`       |          |
|  `toPullIn`  |  Done  |    `toPullScoped`    |          |
|  `toQueue`   |  Done  |      `toQueue`       |          |
|   `toSink`   |   X    |  `Sink.fromChannel`  |          |
|  `toStream`  |   X    | `Stream.fromChannel` |          |

### Error Handling

|    Effect 3     | Ported |   Effect 4   |    Comments     |
| :-------------: | :----: | :----------: | :-------------: |
|   `catchAll`    |  Done  |   `catch`    |                 |
| `catchAllCause` |  Done  | `catchCause` |                 |
|     `orDie`     |  Done  |   `orDie`    |                 |
|   `orDieWith`   |   X    |              | `catch` + `die` |
|    `orElse`     |   X    |   `catch`    |                 |

### Mapping

|     Effect 3      | Ported |        Effect 4         |           Comments           |
| :---------------: | :----: | :---------------------: | :--------------------------: |
|       `as`        |   X    |                         | `mapDone` takes care of this |
|     `asVoid`      |   X    |                         | `mapDone` takes care of this |
|       `map`       |  Done  |        `mapDone`        |                              |
|    `mapEffect`    |  Done  |     `mapDoneEffect`     |                              |
|    `mapError`     |  Done  |       `mapError`        |                              |
|  `mapErrorCause`  |   X    |                         |    Use `catchCause` apis     |
|     `mapOut`      |  Done  |          `map`          |                              |
|  `mapOutEffect`   |  Done  |       `mapEffect`       |                              |
| `mapOutEffectPar` |  Done  |       `mapEffect`       |  With concurrency specified  |
|    `mergeMap`     |  Done  | `flatMap` + concurrency |                              |

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
|       `concatMap`       |  Done  |  `flatMap`   |                     |
|     `concatMapWith`     |   X    |              |                     |
|  `concatMapWithCustom`  |   X    |              |                     |
|       `concatOut`       |  Done  |  `flatten`   |                     |
|      `doneCollect`      |   X    |              |    `runCollect`     |
|         `drain`         |  Done  |              |                     |
|      `embedInput`       |  Done  | `embedInput` |                     |
|      `emitCollect`      |   X    |              |    `runCollect`     |
|       `ensuring`        |  Done  |  `ensuring`  |                     |
|     `ensuringWith`      |  Done  |   `onExit`   |                     |
|   `foldCauseChannel`    |   X    |              |                     |
|      `foldChannel`      |   X    |              |                     |
|     `interruptWhen`     |  Done  |              |                     |
| `interruptWhenDeferred` |   X    |              | Use `interruptWhen` |
|       `mapInput`        |  Done  |              |                     |
|    `mapInputEffect`     |  Done  |  `mapInput`  |                     |
|     `mapInputError`     |  Done  |              |                     |


## Stream

### Error Handling

|     Effect 3      | Ported | Effect 4 | Comments |
| :---------------: | :----: | :------: | :------: |
| `withExecutionPlan` |   -    |          |          |

### Combinators

|     Effect 3      | Ported | Effect 4 | Comments |
| :---------------: | :----: | :------: | :------: |
| `mergeWithTag`    |   -    |          |          |
| `splitLines`      |   Done    | `splitLines`   |          |

### Constants

|     Effect 3      | Ported | Effect 4 | Comments |
| :---------------: | :----: | :------: | :------: |
| `DefaultChunkSize` |   Done    | `DefaultChunkSize`          |          |

### Constructors

|          Effect 3          | Ported | Effect 4 | Comments |
| :------------------------: | :----: | :------: | :------: |
| `acquireRelease`           |   -    |          |          |
| `async`                    |   -    |          |          |
| `asyncEffect`              |   -    |          |          |
| `asyncPush`                |   -    |          |          |
| `asyncScoped`              |   -    |          |          |
| `concatAll`                |   -    |          |          |
| `die`                      |   Done    | `die`         |          |
| `dieMessage`               |   -    |          |          |
| `dieSync`                  |   -    |          |          |
| `empty`                    |   Done    | `empty`         |          |
| `execute`                  |   -    |          |          |
| `fail`                     |   Done    | `fail`         |          |
| `failCause`                |   Done    | `failCause`         |          |
| `failCauseSync`            |   Done    | `failCauseSync`         |          |
| `failSync`                 |   Done    | `failSync`         |          |
| `finalizer`                |   -    |          |          |
| `fromAsyncIterable`        |   Done    | `fromAsyncIterable`         |          |
| `fromChannel`              |   Done    | `fromChannel`         |          |
| `fromChunk`                |   Done    | `fromArray`         |          |
| `fromChunkPubSub`          |   -    |          |          |
| `fromChunkQueue`           |   -    |          |          |
| `fromChunks`               |   Done    | `fromArrays`         |          |
| `fromEffect`               |   Done    | `fromEffect`         |          |
| `fromEffectOption`         |   -    |          |          |
| `fromIterable`             |   Done    | `fromIterable`         |          |
| `fromIterableEffect`       |   Done    | `fromIterableEffect`         |          |
| `fromIteratorSucceed`      |   Done    | `fromIteratorSucceed`         |          |
| `fromPubSub`               |   -    |          |          |
| `fromPull`                 |   Done    | `fromPull`         |          |
| `fromQueue`                |   Done    | `fromQueue`         |          |
| `fromReadableStream`       |   Done    | `fromReadableStream`         |          |
| `fromReadableStreamByob`   |   -    |          |          |
| `fromSchedule`             |   Done    | `fromSchedule`         |          |
| `fromTPubSub`              |   -    |          |          |
| `fromTQueue`               |   -    |          |          |
| `iterate`                  |   -    |          |          |
| `make`                     |   Done    | `make`         |          |
| `never`                    |   Done    | `never`         |          |
| `paginate`                 |   Done    | `paginate`         |          |
| `paginateChunk`            |   Done    | `paginateArray`         |          |
| `paginateChunkEffect`      |   Done    | `paginateArrayEffect`         |          |
| `paginateEffect`           |   Done    | `paginateEffect`         |          |
| `range`                    |   Done    | `range`         |          |
| `repeatEffect`             |   -    |          |          |
| `repeatEffectChunk`        |   -    |          |          |
| `repeatEffectChunkOption`  |   -    |          |          |
| `repeatEffectOption`       |   -    |          |          |
| `repeatEffectWithSchedule` |   -    |          |          |
| `repeatValue`              |   -    |          |          |
| `scoped`                   |   Done    | `scoped`         |          |
| `scopedWith`               |   -    |          |          |
| `succeed`                  |   Done    | `succeed`         |          |
| `suspend`                  |   Done    | `suspend`         |          |
| `sync`                     |   Done    | `sync`         |          |
| `tick`                     |   -    |          |          |
| `toChannel`                |   Done    | `toChannel`         |          |
| `unfold`                   |   -    |          |          |
| `unfoldChunk`              |   -    |          |          |
| `unfoldChunkEffect`        |   -    |          |          |
| `unfoldEffect`             |   -    |          |          |
| `unwrap`                   |   Done    | `unwrap`         |          |
| `unwrapScoped`             |   X    |          |          |
| `unwrapScopedWith`         |   X    |          |          |
| `void`                     |   -    |          |          |
| `whenCase`                 |   -    |          |          |

### Context

|       Effect 3       | Ported | Effect 4 | Comments |
| :------------------: | :----: | :------: | :------: |
| `context`            |   -    |          |          |
| `contextWith`        |   -    |          |          |
| `contextWithEffect`  |   -    |          |          |
| `contextWithStream`  |   -    |          |          |
| `mapInputContext`    |   -    |          |          |
| `provideContext`     |   Done    | `provideServices`         |          |
| `provideLayer`       |   -    |          |          |
| `provideService`     |   -    |          |          |
| `provideServiceEffect` |   -    |          |          |
| `provideServiceStream` |   -    |          |          |
| `provideSomeContext` |   -    |          |          |
| `provideSomeLayer`   |   -    |          |          |
| `updateService`      |   -    |          |          |

### Destructors

|         Effect 3          | Ported | Effect 4 | Comments |
| :-----------------------: | :----: | :------: | :------: |
| `run`                     |   Done    | `run`         |          |
| `runCollect`              |   Done    | `runCollect`         |          |
| `runCount`                |   Done    | `runCount`         |          |
| `runDrain`                |   Done    | `runDrain`         |          |
| `runFold`                 |   Done    | `runFold`         |          |
| `runFoldEffect`           |   -    |          |          |
| `runFoldScoped`           |   -    |          |          |
| `runFoldScopedEffect`     |   -    |          |          |
| `runFoldWhile`            |   -    |          |          |
| `runFoldWhileEffect`      |   -    |          |          |
| `runFoldWhileScoped`      |   -    |          |          |
| `runFoldWhileScopedEffect` |   -    |          |          |
| `runForEach`              |   Done    | `runForEach`         |          |
| `runForEachChunk`         |   Done    | `runForEachArray`         |          |
| `runForEachChunkScoped`   |   -    |          |          |
| `runForEachScoped`        |   -    |          |          |
| `runForEachWhile`         |   -    |          |          |
| `runForEachWhileScoped`   |   -    |          |          |
| `runHead`                 |   Done    | `runHead`          |          |
| `runIntoPubSub`           |   -    |          |          |
| `runIntoPubSubScoped`     |   -    |          |          |
| `runIntoQueue`            |   -    |          |          |
| `runIntoQueueElementsScoped` |   -    |          |          |
| `runIntoQueueScoped`      |   -    |          |          |
| `runLast`                 |   Done    | `runLast`         |          |
| `runScoped`               |   -    |          |          |
| `runSum`                  |   -    |          |          |
| `toAsyncIterable`         |   Done    | `toAsyncIterable`         |          |
| `toAsyncIterableEffect`   |   Done    | toAsyncIterableEffect``         |          |
| `toAsyncIterableRuntime`  |   -    |          |          |
| `toPubSub`                |   Done    | `toPubSub`         |          |
| `toPull`                  |   Done    | `toPull`         |          |
| `toQueue`                 |   -    |          |          |
| `toQueueOfElements`       |   -    |          |          |
| `toReadableStream`        |   Done    | `toReadableStream`         |          |
| `toReadableStreamEffect`  |   Done    | `toReadableStreamEffect`         |          |
| `toReadableStreamRuntime` |   -    |          |          |

### Do Notation

| Effect 3     | Ported | Effect 4 | Comments |
| :----------: | :----: | :------: | :------: |
| `Do`         |   Done    | `Do`         |          |
| `bind`       |   Done    | `bind`         |          |
| `bindEffect` |   Done    | `bindEffect`         |          |
| `bindTo`     |   Done    | `bindTo`         |          |
| `let`        |   Done    | `let`         |          |

### Elements

|    Effect 3     | Ported | Effect 4 | Comments |
| :-------------: | :----: | :------: | :------: |
| `find`          |   -    |          |          |
| `findEffect`    |   -    |          |          |

### Encoding

|    Effect 3     | Ported | Effect 4 | Comments |
| :-------------: | :----: | :------: | :------: |
| `decodeText`    |   Done    | `decodeText`         |          |
| `encodeText`    |   Done    | `encodeText`         |          |

### Error Handling

|      Effect 3       | Ported | Effect 4 | Comments |
| :-----------------: | :----: | :------: | :------: |
| `catchAll`          |   Done    | `catch`         |          |
| `catchAllCause`     |   Done    | `catchCause`         |          |
| `catchSome`         |   -    |          |          |
| `catchSomeCause`    |   -    |          |          |
| `catchTag`          |   -    |          |          |
| `catchTags`         |   -    |          |          |
| `orDie`             |   Done    | `orDie`         |          |
| `orDieWith`         |   -    |          |          |
| `orElse`            |   -    |          |          |
| `orElseEither`      |   -    |          |          |
| `orElseFail`        |   -    |          |          |
| `orElseIfEmpty`     |   -    |          |          |
| `orElseIfEmptyChunk` |   -    |          |          |
| `orElseIfEmptyStream` |   -    |          |          |
| `orElseSucceed`     |   -    |          |          |
| `refineOrDie`       |   -    |          |          |
| `refineOrDieWith`   |   -    |          |          |

### Filtering

|    Effect 3     | Ported | Effect 4 | Comments |
| :-------------: | :----: | :------: | :------: |
| `filter`        |   Done    | `filter`         |          |
| `filterEffect`  |   -    |          |          |

### Grouping

|      Effect 3       | Ported | Effect 4 | Comments |
| :-----------------: | :----: | :------: | :------: |
| `groupAdjacentBy`   |   -    |          |          |
| `groupBy`           |   Done    | `groupBy`         |          |
| `groupByKey`        |   Done    | `groupByKey`         |          |
| `grouped`           |   -    |          |          |
| `groupedWithin`     |   -    |          |          |

### Mapping

|        Effect 3         | Ported | Effect 4 | Comments |
| :---------------------: | :----: | :------: | :------: |
| `as`                    |   -    |          |          |
| `map`                   |   Done    | `map`         |          |
| `mapAccum`              |   Done    | `mapAccum`         |          |
| `mapAccumEffect`        |   Done    | `mapAccumEffect`         |          |
| `mapChunks`             |   Done    | `mapArray`         |          |
| `mapChunksEffect`       |   Done    | `mapArrayEffect`         |          |
| `mapConcat`             |   -    |          |          |
| `mapConcatChunk`        |   -    |          |          |
| `mapConcatChunkEffect`  |   -    |          |          |
| `mapConcatEffect`       |   -    |          |          |
| `mapEffect`             |   Done    | `mapEffect`         |          |
| `mapError`              |   Done    | `mapError`         |          |
| `mapErrorCause`         |   -    |          |          |

### Racing

|   Effect 3    | Ported | Effect 4 | Comments |
| :-----------: | :----: | :------: | :------: |
| `race`        |   -    |          |          |
| `raceAll`     |   -    |          |          |

### Sequencing

|      Effect 3       | Ported | Effect 4 | Comments |
| :-----------------: | :----: | :------: | :------: |
| `branchAfter`       |   -    |          |          |
| `flatMap`           |   Done    | `flatMap`         |          |
| `flatten`           |   Done    | `flatten`         |          |
| `flattenChunks`     |   Done    | `flattenArray`         |          |
| `flattenEffect`     |   -    |          |          |
| `flattenExitOption` |   -    |          |          |
| `flattenIterables`  |   Done    | `flattenIterable`         |          |
| `flattenTake`       |   Done    | `flattenTake`         |          |
| `onEnd`             |   -    |          |          |
| `onStart`           |   -    |          |          |
| `tap`               |   Done    | `tap`         |          |
| `tapBoth`           |   -    |          |          |
| `tapError`          |   -    |          |          |
| `tapSink`           |   -    |          |          |

### Tracing

|   Effect 3   | Ported | Effect 4 | Comments |
| :-----------: | :----: | :------: | :------: |
| `withSpan`    |   Done    | `withSpan`         |          |

### Utils

|           Effect 3            | Ported | Effect 4 | Comments |
| :---------------------------: | :----: | :------: | :------: |
| `accumulate`                  |   -    |          |          |
| `accumulateChunks`            |   -    |          |          |
| `aggregate`                   |   -    |          |          |
| `aggregateWithin`             |   -    |          |          |
| `aggregateWithinEither`       |   -    |          |          |
| `broadcast`                   |   Done    | `broadcast`         |          |
| `broadcastDynamic`            |   -    |          |          |
| `broadcastedQueues`           |   -    |          |          |
| `broadcastedQueuesDynamic`    |   -    |          |          |
| `buffer`                      |   Done    | `buffer`         |          |
| `bufferChunks`                |   Done    | `bufferArray`         |          |
| `changes`                     |   -    |          |          |
| `changesWith`                 |   -    |          |          |
| `changesWithEffect`           |   -    |          |          |
| `chunks`                      |   Done    | `chunks`         |          |
| `chunksWith`                  |   -    |          |          |
| `combine`                     |   -    |          |          |
| `combineChunks`               |   -    |          |          |
| `concat`                      |   Done    | `concat`         |          |
| `cross`                       |   -    |          |          |
| `crossLeft`                   |   -    |          |          |
| `crossRight`                  |   -    |          |          |
| `crossWith`                   |   -    |          |          |
| `debounce`                    |   -    |          |          |
| `distributedWith`             |   -    |          |          |
| `distributedWithDynamic`      |   -    |          |          |
| `drain`                       |   Done    | `drain`         |          |
| `drainFork`                   |   -    |          |          |
| `drop`                        |   Done    | `drop`         |          |
| `dropRight`                   |   -    |          |          |
| `dropUntil`                   |   -    |          |          |
| `dropUntilEffect`             |   -    |          |          |
| `dropWhile`                   |   -    |          |          |
| `dropWhileEffect`             |   -    |          |          |
| `either`                      |   -    |          |          |
| `ensuring`                    |   Done    | `ensuring`         |          |
| `ensuringWith`                |   -    |          |          |
| `filterMap`                   |   -    |          |          |
| `filterMapEffect`             |   -    |          |          |
| `filterMapWhile`              |   -    |          |          |
| `filterMapWhileEffect`        |   -    |          |          |
| `forever`                     |   -    |          |          |
| `fromEventListener`           |   -    |          |          |
| `haltAfter`                   |   -    |          |          |
| `haltWhen`                    |   -    |          |          |
| `haltWhenDeferred`            |   -    |          |          |
| `identity`                    |   -    |          |          |
| `interleave`                  |   -    |          |          |
| `interleaveWith`              |   -    |          |          |
| `interruptAfter`              |   -    |          |          |
| `interruptWhen`               |   -    |          |          |
| `interruptWhenDeferred`       |   -    |          |          |
| `intersperse`                 |   -    |          |          |
| `intersperseAffixes`          |   -    |          |          |
| `mapBoth`                     |   -    |          |          |
| `merge`                       |   -    |          |          |
| `mergeAll`                    |   -    |          |          |
| `mergeEither`                 |   -    |          |          |
| `mergeLeft`                   |   -    |          |          |
| `mergeRight`                  |   -    |          |          |
| `mergeWith`                   |   -    |          |          |
| `mkString`                    |   Done    | `mkString`         |          |
| `onDone`                      |   -    |          |          |
| `onError`                     |   -    |          |          |
| `partition`                   |   -    |          |          |
| `partitionEither`             |   -    |          |          |
| `peel`                        |   -    |          |          |
| `pipeThrough`                 |   -    |          |          |
| `pipeThroughChannel`          |   Done    | `pipeThroughChannel`         |          |
| `pipeThroughChannelOrFail`    |   Done    | `pipeThroughChannelOrFail`         |          |
| `prepend`                     |   -    |          |          |
| `rechunk`                     |   Done    | `rechunk`         |          |
| `repeat`                      |   -    |          |          |
| `repeatEither`                |   -    |          |          |
| `repeatElements`              |   -    |          |          |
| `repeatElementsWith`          |   -    |          |          |
| `repeatWith`                  |   -    |          |          |
| `retry`                       |   -    |          |          |
| `scan`                        |   Done    | `scan`         |          |
| `scanEffect`                  |   Done    | `scanEffect`         |          |
| `scanReduce`                  |   -    |          |          |
| `scanReduceEffect`            |   -    |          |          |
| `schedule`                    |   -    |          |          |
| `scheduleWith`                |   -    |          |          |
| `share`                       |   Done    | `share`         |          |
| `sliding`                     |   -    |          |          |
| `slidingSize`                 |   -    |          |          |
| `some`                        |   -    |          |          |
| `someOrElse`                  |   -    |          |          |
| `someOrFail`                  |   -    |          |          |
| `split`                       |   -    |          |          |
| `splitOnChunk`                |   -    |          |          |
| `take`                        |   Done    | `take`         |          |
| `takeRight`                   |   -    |          |          |
| `takeUntil`                   |   Done    | `takeUntil`         |          |
| `takeUntilEffect`             |   Done    | `takeUntilEffect`         |          |
| `takeWhile`                   |   Done    | `takeWhile`         |          |
| `tapErrorCause`               |   -    |          |          |
| `throttle`                    |   -    |          |          |
| `throttleEffect`              |   -    |          |          |
| `timeout`                     |   -    |          |          |
| `timeoutFail`                 |   -    |          |          |
| `timeoutFailCause`            |   -    |          |          |
| `timeoutTo`                   |   -    |          |          |
| `transduce`                   |   Done    | `transduce`         |          |
| `when`                        |   -    |          |          |
| `whenCaseEffect`              |   -    |          |          |
| `whenEffect`                  |   -    |          |          |

### Zipping

|         Effect 3          | Ported | Effect 4 | Comments |
| :-----------------------: | :----: | :------: | :------: |
| `zip`                     |   -    |          |          |
| `zipAll`                  |   -    |          |          |
| `zipAllLeft`              |   -    |          |          |
| `zipAllRight`             |   -    |          |          |
| `zipAllSortedByKey`       |   -    |          |          |
| `zipAllSortedByKeyLeft`   |   -    |          |          |
| `zipAllSortedByKeyRight`  |   -    |          |          |
| `zipAllSortedByKeyWith`   |   -    |          |          |
| `zipAllWith`              |   -    |          |          |
| `zipFlatten`              |   -    |          |          |
| `zipLatest`               |   -    |          |          |
| `zipLatestAll`            |   -    |          |          |
| `zipLatestWith`           |   -    |          |          |
| `zipLeft`                 |   -    |          |          |
| `zipRight`                |   -    |          |          |
| `zipWith`                 |   -    |          |          |
| `zipWithChunks`           |   -    |          |          |
| `zipWithIndex`            |   -    |          |          |
| `zipWithNext`             |   -    |          |          |
| `zipWithPrevious`         |   -    |          |          |
| `zipWithPreviousAndNext`  |   -    |          |          |


