## Alpha (current)

Releases are snapshot only

- [x] Port Channel apis
- [x] Port worker modules
- [x] Port command execution modules
- [x] Port platform-browser
- [x] Add CLI modules
- [x] Port SubscriptionRef
- [x] RateLimiter with persistence
- [x] Reduce nesting of modules
- [x] Effect.fn call site trace
- [x] Port Stream / Sink apis
- [ ] Add opentelemetry package
- [ ] Add AI provider packages

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

## Stream

### Error Handling

|      Effect 3       | Ported | Effect 4 | Comments |
| :-----------------: | :----: | :------: | :------: |
| `withExecutionPlan` |  Done  |          |          |

### Combinators

|    Effect 3    | Ported |   Effect 4   | Comments |
| :------------: | :----: | :----------: | :------: |
| `mergeWithTag` |   X    |              |          |
|  `splitLines`  |  Done  | `splitLines` |          |

### Constants

|      Effect 3      | Ported |      Effect 4      | Comments |
| :----------------: | :----: | :----------------: | :------: |
| `DefaultChunkSize` |  Done  | `DefaultChunkSize` |          |

### Constructors

|          Effect 3          | Ported |               Effect 4               | Comments |
| :------------------------: | :----: | :----------------------------------: | :------: |
|      `acquireRelease`      |   X    |               `unwrap`               |          |
|          `async`           |  Done  |              `callback`              |          |
|       `asyncEffect`        |  Done  |              `callback`              |          |
|        `asyncPush`         |  Done  |              `callback`              |          |
|       `asyncScoped`        |  Done  |                                      |          |
|        `concatAll`         |   X    |          `make` + `flatten`          |          |
|           `die`            |  Done  |                `die`                 |          |
|        `dieMessage`        |   X    |                                      |          |
|         `dieSync`          |   X    |                                      |          |
|          `empty`           |  Done  |               `empty`                |          |
|         `execute`          |  Done  |          `fromEffectDrain`           |          |
|           `fail`           |  Done  |                `fail`                |          |
|        `failCause`         |  Done  |             `failCause`              |          |
|      `failCauseSync`       |  Done  |           `failCauseSync`            |          |
|         `failSync`         |  Done  |              `failSync`              |          |
|        `finalizer`         |   X    |                                      |          |
|    `fromAsyncIterable`     |  Done  |         `fromAsyncIterable`          |          |
|       `fromChannel`        |  Done  |            `fromChannel`             |          |
|        `fromChunk`         |  Done  |             `fromArray`              |          |
|     `fromChunkPubSub`      |   X    |                                      |          |
|      `fromChunkQueue`      |   X    |                                      |          |
|        `fromChunks`        |  Done  |             `fromArrays`             |          |
|        `fromEffect`        |  Done  |             `fromEffect`             |          |
|     `fromEffectOption`     |   X    |                                      |          |
|       `fromIterable`       |  Done  |            `fromIterable`            |          |
|    `fromIterableEffect`    |  Done  |         `fromIterableEffect`         |          |
|   `fromIteratorSucceed`    |  Done  |        `fromIteratorSucceed`         |          |
|        `fromPubSub`        |  Done  |                                      |          |
|         `fromPull`         |  Done  |              `fromPull`              |          |
|        `fromQueue`         |  Done  |             `fromQueue`              |          |
|    `fromReadableStream`    |  Done  |         `fromReadableStream`         |          |
|  `fromReadableStreamByob`  |   X    |                                      |          |
|       `fromSchedule`       |  Done  |            `fromSchedule`            |          |
|       `fromTPubSub`        |   -    |                                      |          |
|        `fromTQueue`        |   -    |            `fromTxQueue`             |          |
|         `iterate`          |  Done  |                                      |          |
|           `make`           |  Done  |                `make`                |          |
|          `never`           |  Done  |               `never`                |          |
|         `paginate`         |  Done  |              `paginate`              |          |
|      `paginateChunk`       |  Done  |                                      |          |
|   `paginateChunkEffect`    |  Done  |           `paginateArray`            |          |
|      `paginateEffect`      |  Done  |              `paginate`              |          |
|          `range`           |  Done  |               `range`                |          |
|       `repeatEffect`       |  Done  |          `fromEffectRepeat`          |          |
|    `repeatEffectChunk`     |  Done  |      `fromIterableEffectRepeat`      |          |
| `repeatEffectChunkOption`  |   X    |              `fromPull`              |          |
|    `repeatEffectOption`    |   X    | `fromEffectRepeat` + `Pull.haltVoid` |          |
| `repeatEffectWithSchedule` |  Done  |         `fromEffectSchedule`         |          |
|       `repeatValue`        |   X    |                                      |          |
|          `scoped`          |  Done  |               `scoped`               |          |
|        `scopedWith`        |   X    |                                      |          |
|         `succeed`          |  Done  |              `succeed`               |          |
|         `suspend`          |  Done  |              `suspend`               |          |
|           `sync`           |  Done  |                `sync`                |          |
|           `tick`           |  Done  |                                      |          |
|        `toChannel`         |  Done  |             `toChannel`              |          |
|          `unfold`          |  Done  |                                      |          |
|       `unfoldChunk`        |  Done  |                                      |          |
|    `unfoldChunkEffect`     |  Done  |         `unfoldArrayEffect`          |          |
|       `unfoldEffect`       |  Done  |                                      |          |
|          `unwrap`          |  Done  |               `unwrap`               |          |
|       `unwrapScoped`       |   X    |                                      |          |
|     `unwrapScopedWith`     |   X    |                                      |          |
|           `void`           |   X    |                                      |          |
|         `whenCase`         |   X    |                                      |          |

### Context

|        Effect 3        | Ported |     Effect 4      | Comments |
| :--------------------: | :----: | :---------------: | :------: |
|       `context`        |   X    |     `unwrap`      |          |
|     `contextWith`      |   X    |     `unwrap`      |          |
|  `contextWithEffect`   |   X    |     `unwrap`      |          |
|  `contextWithStream`   |   X    |     `unwrap`      |          |
|   `mapInputContext`    |  Done  | `updateServices`  |          |
|    `provideContext`    |  Done  | `provideServices` |          |
|     `provideLayer`     |  Done  |     `provide`     |          |
|    `provideService`    |  Done  |                   |          |
| `provideServiceEffect` |  Done  |                   |          |
| `provideServiceStream` |   X    |                   |          |
|  `provideSomeContext`  |  Done  | `provideServices` |          |
|   `provideSomeLayer`   |  Done  |     `provide`     |          |
|    `updateService`     |  Done  |                   |          |

### Destructors

|           Effect 3           | Ported |         Effect 4         | Comments |
| :--------------------------: | :----: | :----------------------: | :------: |
|            `run`             |  Done  |          `run`           |          |
|         `runCollect`         |  Done  |       `runCollect`       |          |
|          `runCount`          |  Done  |        `runCount`        |          |
|          `runDrain`          |  Done  |        `runDrain`        |          |
|          `runFold`           |  Done  |        `runFold`         |          |
|       `runFoldEffect`        |  Done  |                          |          |
|       `runFoldScoped`        |   X    |                          |          |
|    `runFoldScopedEffect`     |   X    |                          |          |
|        `runFoldWhile`        |   X    |                          |          |
|     `runFoldWhileEffect`     |   X    |                          |          |
|     `runFoldWhileScoped`     |   X    |                          |          |
|  `runFoldWhileScopedEffect`  |   X    |                          |          |
|         `runForEach`         |  Done  |       `runForEach`       |          |
|      `runForEachChunk`       |  Done  |    `runForEachArray`     |          |
|   `runForEachChunkScoped`    |   X    |                          |          |
|      `runForEachScoped`      |   X    |                          |          |
|      `runForEachWhile`       |  Done  |                          |          |
|   `runForEachWhileScoped`    |   X    |                          |          |
|          `runHead`           |  Done  |        `runHead`         |          |
|       `runIntoPubSub`        |  Done  |                          |          |
|    `runIntoPubSubScoped`     |   X    |                          |          |
|        `runIntoQueue`        |  Done  |                          |          |
| `runIntoQueueElementsScoped` |   X    |                          |          |
|     `runIntoQueueScoped`     |   X    |                          |          |
|          `runLast`           |  Done  |        `runLast`         |          |
|         `runScoped`          |   X    |                          |          |
|           `runSum`           |  Done  |                          |          |
|      `toAsyncIterable`       |  Done  |    `toAsyncIterable`     |          |
|   `toAsyncIterableEffect`    |  Done  |                          |          |
|   `toAsyncIterableRuntime`   |  Done  |  `toAsyncIterableWith`   |          |
|          `toPubSub`          |  Done  |        `toPubSub`        |          |
|           `toPull`           |  Done  |         `toPull`         |          |
|          `toQueue`           |  Done  |                          |          |
|     `toQueueOfElements`      |   X    |                          |          |
|      `toReadableStream`      |  Done  |    `toReadableStream`    |          |
|   `toReadableStreamEffect`   |  Done  | `toReadableStreamEffect` |          |
|  `toReadableStreamRuntime`   |  Done  |  `toReadableStreamWith`  |          |

### Do Notation

|   Effect 3   | Ported |   Effect 4   | Comments |
| :----------: | :----: | :----------: | :------: |
|     `Do`     |  Done  |     `Do`     |          |
|    `bind`    |  Done  |    `bind`    |          |
| `bindEffect` |  Done  | `bindEffect` |          |
|   `bindTo`   |  Done  |   `bindTo`   |          |
|    `let`     |  Done  |    `let`     |          |

### Elements

|   Effect 3   | Ported | Effect 4 | Comments |
| :----------: | :----: | :------: | :------: |
|    `find`    |   X    |          |          |
| `findEffect` |   X    |          |          |

### Encoding

|   Effect 3   | Ported |   Effect 4   | Comments |
| :----------: | :----: | :----------: | :------: |
| `decodeText` |  Done  | `decodeText` |          |
| `encodeText` |  Done  | `encodeText` |          |

### Error Handling

|       Effect 3        | Ported |       Effect 4        | Comments |
| :-------------------: | :----: | :-------------------: | :------: |
|      `catchAll`       |  Done  |        `catch`        |          |
|    `catchAllCause`    |  Done  |     `catchCause`      |          |
|      `catchSome`      |  Done  |     `catchFilter`     |          |
|   `catchSomeCause`    |  Done  |  `catchCauseFilter`   |          |
|      `catchTag`       |  Done  |                       |          |
|      `catchTags`      |  Done  |                       |          |
|        `orDie`        |  Done  |        `orDie`        |          |
|      `orDieWith`      |   X    |                       |          |
|       `orElse`        |   X    |        `catch`        |          |
|    `orElseEither`     |   X    |                       |          |
|     `orElseFail`      |   X    |                       |          |
|    `orElseIfEmpty`    |  Done  |                       |          |
| `orElseIfEmptyChunk`  |   X    |                       |          |
| `orElseIfEmptyStream` |   X    |    `orElseIfEmpty`    |          |
|    `orElseSucceed`    |  Done  |                       |          |
|     `refineOrDie`     |   X    | `catchFilter` + `die` |          |
|   `refineOrDieWith`   |   X    |                       |          |

### Filtering

|    Effect 3    | Ported | Effect 4 | Comments |
| :------------: | :----: | :------: | :------: |
|    `filter`    |  Done  | `filter` |          |
| `filterEffect` |  Done  |          |          |

### Grouping

|     Effect 3      | Ported |   Effect 4   | Comments |
| :---------------: | :----: | :----------: | :------: |
| `groupAdjacentBy` |  Done  |              |          |
|     `groupBy`     |  Done  |  `groupBy`   |          |
|   `groupByKey`    |  Done  | `groupByKey` |          |
|     `grouped`     |  Done  |              |          |
|  `groupedWithin`  |  Done  |              |          |

### Mapping

|        Effect 3        | Ported |     Effect 4     | Comments |
| :--------------------: | :----: | :--------------: | :------: |
|          `as`          |   X    |                  |          |
|         `map`          |  Done  |      `map`       |          |
|       `mapAccum`       |  Done  |    `mapAccum`    |          |
|    `mapAccumEffect`    |  Done  | `mapAccumEffect` |          |
|      `mapChunks`       |  Done  |    `mapArray`    |          |
|   `mapChunksEffect`    |  Done  | `mapArrayEffect` |          |
|      `mapConcat`       |   X    |                  |          |
|    `mapConcatChunk`    |   X    |                  |          |
| `mapConcatChunkEffect` |   X    |                  |          |
|   `mapConcatEffect`    |   X    |                  |          |
|      `mapEffect`       |  Done  |   `mapEffect`    |          |
|       `mapError`       |  Done  |    `mapError`    |          |
|    `mapErrorCause`     |  Done  |    `mapCause`    |          |

### Racing

| Effect 3  | Ported | Effect 4 | Comments |
| :-------: | :----: | :------: | :------: |
|  `race`   |  Done  |          |          |
| `raceAll` |  Done  |          |          |

### Sequencing

|      Effect 3       | Ported |        Effect 4         | Comments |
| :-----------------: | :----: | :---------------------: | :------: |
|    `branchAfter`    |   X    | `collect` + `flatMap` ? |          |
|      `flatMap`      |  Done  |        `flatMap`        |          |
|      `flatten`      |  Done  |        `flatten`        |          |
|   `flattenChunks`   |  Done  |     `flattenArray`      |          |
|   `flattenEffect`   |  Done  |                         |          |
| `flattenExitOption` |   X    |                         |          |
| `flattenIterables`  |  Done  |    `flattenIterable`    |          |
|    `flattenTake`    |  Done  |      `flattenTake`      |          |
|       `onEnd`       |  Done  |                         |          |
|      `onStart`      |  Done  |                         |          |
|        `tap`        |  Done  |          `tap`          |          |
|      `tapBoth`      |  Done  |                         |          |
|     `tapError`      |  Done  |                         |          |
|      `tapSink`      |  Done  |                         |          |

### Tracing

|  Effect 3  | Ported |  Effect 4  | Comments |
| :--------: | :----: | :--------: | :------: |
| `withSpan` |  Done  | `withSpan` |          |

### Utils

|          Effect 3          | Ported |           Effect 4            | Comments |
| :------------------------: | :----: | :---------------------------: | :------: |
|        `accumulate`        |  Done  |                               |          |
|     `accumulateChunks`     |   X    | `accumulate` + `flattenArray` |          |
|        `aggregate`         |  Done  |                               |          |
|     `aggregateWithin`      |  Done  |                               |          |
|  `aggregateWithinEither`   |   X    |                               |          |
|        `broadcast`         |  Done  |          `broadcast`          |          |
|     `broadcastDynamic`     |   X    |          `broadcast`          |          |
|    `broadcastedQueues`     |   X    |          `broadcast`          |          |
| `broadcastedQueuesDynamic` |   X    |          `broadcast`          |          |
|          `buffer`          |  Done  |           `buffer`            |          |
|       `bufferChunks`       |  Done  |         `bufferArray`         |          |
|         `changes`          |  Done  |                               |          |
|       `changesWith`        |  Done  |                               |          |
|    `changesWithEffect`     |  Done  |                               |          |
|          `chunks`          |  Done  |           `chunks`            |          |
|        `chunksWith`        |   X    |                               |          |
|         `combine`          |  Done  |                               |          |
|      `combineChunks`       |  Done  |                               |          |
|          `concat`          |  Done  |           `concat`            |          |
|          `cross`           |  Done  |                               |          |
|        `crossLeft`         |   X    |                               |          |
|        `crossRight`        |   X    |                               |          |
|        `crossWith`         |  Done  |                               |          |
|         `debounce`         |  Done  |                               |          |
|     `distributedWith`      |   X    |                               |          |
|  `distributedWithDynamic`  |   X    |                               |          |
|          `drain`           |  Done  |            `drain`            |          |
|        `drainFork`         |  Done  |                               |          |
|           `drop`           |  Done  |            `drop`             |          |
|        `dropRight`         |  Done  |                               |          |
|        `dropUntil`         |  Done  |                               |          |
|     `dropUntilEffect`      |  Done  |                               |          |
|        `dropWhile`         |  Done  |                               |          |
|     `dropWhileEffect`      |  Done  |                               |          |
|          `either`          |  Done  |           `result`            |          |
|         `ensuring`         |  Done  |          `ensuring`           |          |
|       `ensuringWith`       |  Done  |           `onExit`            |          |
|        `filterMap`         |   X    |           `filter`            |          |
|     `filterMapEffect`      |   X    |        `filterEffect`         |          |
|      `filterMapWhile`      |   X    |                               |          |
|   `filterMapWhileEffect`   |   X    |                               |          |
|         `forever`          |  Done  |                               |          |
|    `fromEventListener`     |  Done  |                               |          |
|        `haltAfter`         |   X    |                               |          |
|         `haltWhen`         |  Done  |                               |          |
|     `haltWhenDeferred`     |   X    |                               |          |
|         `identity`         |   X    |                               |          |
|        `interleave`        |  Done  |                               |          |
|      `interleaveWith`      |  Done  |                               |          |
|      `interruptAfter`      |   X    |                               |          |
|      `interruptWhen`       |  Done  |                               |          |
|  `interruptWhenDeferred`   |   X    |                               |          |
|       `intersperse`        |  Done  |                               |          |
|    `intersperseAffixes`    |  Done  |                               |          |
|         `mapBoth`          |  Done  |                               |          |
|          `merge`           |  Done  |                               |          |
|         `mergeAll`         |  Done  |                               |          |
|       `mergeEither`        |  Done  |         `mergeResult`         |          |
|        `mergeLeft`         |  Done  |                               |          |
|        `mergeRight`        |  Done  |                               |          |
|        `mergeWith`         |   X    |                               |          |
|         `mkString`         |  Done  |          `mkString`           |          |
|          `onDone`          |   X    |                               |          |
|         `onError`          |  Done  |                               |          |
|        `partition`         |  Done  |                               |          |
|     `partitionEither`      |  Done  |       `partitionEffect`       |          |
|           `peel`           |  Done  |                               |          |
|       `pipeThrough`        |  Done  |                               |          |
|    `pipeThroughChannel`    |  Done  |     `pipeThroughChannel`      |          |
| `pipeThroughChannelOrFail` |  Done  |  `pipeThroughChannelOrFail`   |          |
|         `prepend`          |  Done  |                               |          |
|         `rechunk`          |  Done  |           `rechunk`           |          |
|          `repeat`          |  Done  |                               |          |
|       `repeatEither`       |   X    |                               |          |
|      `repeatElements`      |  Done  |                               |          |
|    `repeatElementsWith`    |   X    |                               |          |
|        `repeatWith`        |   X    |                               |          |
|          `retry`           |  Done  |                               |          |
|           `scan`           |  Done  |            `scan`             |          |
|        `scanEffect`        |  Done  |         `scanEffect`          |          |
|        `scanReduce`        |   X    |                               |          |
|     `scanReduceEffect`     |   X    |                               |          |
|         `schedule`         |  Done  |                               |          |
|       `scheduleWith`       |   X    |                               |          |
|          `share`           |  Done  |            `share`            |          |
|         `sliding`          |  Done  |                               |          |
|       `slidingSize`        |  Done  |                               |          |
|           `some`           |   X    |                               |          |
|        `someOrElse`        |   X    |                               |          |
|        `someOrFail`        |   X    |                               |          |
|          `split`           |  Done  |                               |          |
|       `splitOnChunk`       |   X    |                               |          |
|           `take`           |  Done  |            `take`             |          |
|        `takeRight`         |  Done  |                               |          |
|        `takeUntil`         |  Done  |          `takeUntil`          |          |
|     `takeUntilEffect`      |  Done  |       `takeUntilEffect`       |          |
|        `takeWhile`         |  Done  |          `takeWhile`          |          |
|      `tapErrorCause`       |  Done  |          `tapCause`           |          |
|         `throttle`         |  Done  |                               |          |
|      `throttleEffect`      |  Done  |                               |          |
|         `timeout`          |  Done  |               -               |          |
|       `timeoutFail`        |  Done  |        `timeoutOrElse`        |          |
|     `timeoutFailCause`     |   X    |                               |          |
|        `timeoutTo`         |   X    |                               |          |
|        `transduce`         |  Done  |          `transduce`          |          |
|           `when`           |  Done  |                               |          |
|      `whenCaseEffect`      |   X    |                               |          |
|        `whenEffect`        |   X    |            `when`             |          |

### Zipping

|         Effect 3         | Ported | Effect 4 | Comments |
| :----------------------: | :----: | :------: | :------: |
|          `zip`           |  Done  |          |          |
|         `zipAll`         |   X    |          |          |
|       `zipAllLeft`       |   X    |          |          |
|      `zipAllRight`       |   X    |          |          |
|   `zipAllSortedByKey`    |   X    |          |          |
| `zipAllSortedByKeyLeft`  |   X    |          |          |
| `zipAllSortedByKeyRight` |   X    |          |          |
| `zipAllSortedByKeyWith`  |   X    |          |          |
|       `zipAllWith`       |   X    |          |          |
|       `zipFlatten`       |  Done  |          |          |
|       `zipLatest`        |  Done  |          |          |
|      `zipLatestAll`      |  Done  |          |          |
|     `zipLatestWith`      |  Done  |          |          |
|        `zipLeft`         |  Done  |          |          |
|        `zipRight`        |  Done  |          |          |
|        `zipWith`         |  Done  |          |          |
|     `zipWithChunks`      |  Done  |          |          |
|      `zipWithIndex`      |  Done  |          |          |
|      `zipWithNext`       |  Done  |          |          |
|    `zipWithPrevious`     |  Done  |          |          |
| `zipWithPreviousAndNext` |  Done  |          |          |

## Sink

### Constructors

|           Effect 3            | Ported |         Effect 4         | Comments |
| :---------------------------: | :----: | :----------------------: | :------: |
|         `collectAll`          |  Done  |        `collect`         |          |
|         `collectAllN`         |  Done  |          `take`          |          |
|       `collectAllToMap`       |   X    |                          |          |
|      `collectAllToMapN`       |   X    |                          |          |
|       `collectAllToSet`       |   X    |                          |          |
|      `collectAllToSetN`       |   X    |                          |          |
|       `collectAllUntil`       |  Done  |       `takeUntil`        |          |
|    `collectAllUntilEffect`    |  Done  |                          |          |
|       `collectAllWhile`       |  Done  |       `takeWhile`        |          |
|    `collectAllWhileEffect`    |  Done  |                          |          |
|           `context`           |   X    |                          |          |
|         `contextWith`         |   X    |                          |          |
|      `contextWithEffect`      |   X    |                          |          |
|       `contextWithSink`       |   X    |                          |          |
|            `count`            |  Done  |                          |          |
|             `die`             |  Done  |          `die`           |          |
|           `dieSync`           |   X    |                          |          |
|            `drain`            |  Done  |         `drain`          |          |
|            `drop`             |   X    |                          |          |
|          `dropUntil`          |   X    |                          |          |
|       `dropUntilEffect`       |   X    |                          |          |
|          `dropWhile`          |   X    |                          |          |
|       `dropWhileEffect`       |   X    |                          |          |
|            `every`            |  Done  |                          |          |
|            `fail`             |  Done  |          `fail`          |          |
|          `failCause`          |  Done  |       `failCause`        |          |
|        `failCauseSync`        |  Done  |     `failCauseSync`      |          |
|          `failSync`           |  Done  |        `failSync`        |          |
|         `foldChunks`          |  Done  |    `reduceWhileArray`    |          |
|      `foldChunksEffect`       |  Done  | `reduceWhileArrayEffect` |          |
|         `foldEffect`          |  Done  |   `reduceWhileEffect`    |          |
|          `foldLeft`           |  Done  |      `reduceWhile`       |          |
|       `foldLeftChunks`        |  Done  |      `reduceArray`       |          |
|    `foldLeftChunksEffect`     |  Done  |   `reduceArrayEffect`    |          |
|       `foldLeftEffect`        |  Done  |      `reduceEffect`      |          |
|          `foldUntil`          |  Done  |                          |          |
|       `foldUntilEffect`       |  Done  |                          |          |
|        `foldWeighted`         |   X    |                          |          |
|    `foldWeightedDecompose`    |   X    |                          |          |
| `foldWeightedDecomposeEffect` |   X    |                          |          |
|     `foldWeightedEffect`      |   X    |                          |          |
|           `forEach`           |  Done  |        `forEach`         |          |
|        `forEachChunk`         |  Done  |      `forEachArray`      |          |
|      `forEachChunkWhile`      |  Done  |                          |          |
|        `forEachWhile`         |  Done  |                          |          |
|         `fromChannel`         |  Done  |      `fromChannel`       |          |
|         `fromEffect`          |  Done  |                          |          |
|         `fromPubSub`          |  Done  |                          |          |
|          `fromPush`           |   X    |                          |          |
|          `fromQueue`          |  Done  |                          |          |
|            `head`             |  Done  |          `head`          |          |
|            `last`             |  Done  |          `last`          |          |
|          `leftover`           |   X    |                          |          |
|          `mkString`           |  Done  |        `mkString`        |          |
|            `never`            |  Done  |         `never`          |          |
|            `some`             |  Done  |                          |          |
|           `succeed`           |  Done  |        `succeed`         |          |
|             `sum`             |  Done  |          `sum`           |          |
|           `suspend`           |  Done  |        `suspend`         |          |
|            `sync`             |  Done  |          `sync`          |          |
|            `take`             |  Done  |          `take`          |          |
|            `timed`            |  Done  |                          |          |
|          `toChannel`          |  Done  |       `toChannel`        |          |
|           `unwrap`            |  Done  |         `unwrap`         |          |
|        `unwrapScoped`         |   X    |                          |          |
|      `unwrapScopedWith`       |   X    |                          |          |

### Context

|     Effect 3     | Ported |     Effect 4      | Comments |
| :--------------: | :----: | :---------------: | :------: |
| `provideContext` |  Done  | `provideServices` |          |

### Elements

|   Effect 3   | Ported | Effect 4 | Comments |
| :----------: | :----: | :------: | :------: |
| `findEffect` |  Done  |  `find`  |          |

### Error Handling

|     Effect 3      | Ported | Effect 4 | Comments |
| :---------------: | :----: | :------: | :------: |
|     `orElse`      |  Done  |          |          |
|   `refineOrDie`   |  Done  | `catch`  |          |
| `refineOrDieWith` |   X    |          |          |

### Filtering

|      Effect 3       | Ported | Effect 4 | Comments |
| :-----------------: | :----: | :------: | :------: |
|    `filterInput`    |  Done  |          |          |
| `filterInputEffect` |  Done  |          |          |

### Finalization

|    Effect 3    | Ported | Effect 4 | Comments |
| :------------: | :----: | :------: | :------: |
|   `ensuring`   |  Done  |          |          |
| `ensuringWith` |  Done  | `onExit` |          |

### Folding

|  Effect 3  | Ported | Effect 4 | Comments |
| :--------: | :----: | :------: | :------: |
|   `fold`   |  Done  |  `fold`  |          |
| `foldSink` |   X    |          |          |

### Mapping

|        Effect 3        | Ported |   Effect 4    | Comments |
| :--------------------: | :----: | :-----------: | :------: |
|          `as`          |  Done  |               |          |
|        `dimap`         |   X    |               |          |
|     `dimapChunks`      |   X    |               |          |
|  `dimapChunksEffect`   |   X    |               |          |
|     `dimapEffect`      |   X    |               |          |
|         `map`          |  Done  |     `map`     |          |
|      `mapEffect`       |  Done  |  `mapEffect`  |          |
|       `mapError`       |  Done  |  `mapError`   |          |
|       `mapInput`       |  Done  |               |          |
|    `mapInputChunks`    |  Done  |               |          |
| `mapInputChunksEffect` |  Done  |               |          |
|    `mapInputEffect`    |  Done  |               |          |
|     `mapLeftover`      |  Done  | `mapLeftover` |          |

### Sequencing

| Effect 3  | Ported | Effect 4 | Comments |
| :-------: | :----: | :------: | :------: |
| `flatMap` |  Done  |          |          |

### Utils

|       Effect 3        | Ported |     Effect 4     | Comments |
| :-------------------: | :----: | :--------------: | :------: |
|   `collectAllFrom`    |   X    |                  |          |
| `collectAllWhileWith` |   X    |                  |          |
|   `collectLeftover`   |   X    |                  |          |
|   `ignoreLeftover`    |  Done  | `ignoreLeftover` |          |
|        `race`         |   X    |                  |          |
|      `raceBoth`       |   X    |                  |          |
|      `raceWith`       |   X    |                  |          |
|     `splitWhere`      |   X    |                  |          |
|     `summarized`      |  Done  |                  |          |
|    `withDuration`     |  Done  |                  |          |

### Zipping

|  Effect 3  | Ported | Effect 4 | Comments |
| :--------: | :----: | :------: | :------: |
|   `zip`    |   X    |          |          |
| `zipLeft`  |   X    |          |          |
| `zipRight` |   X    |          |          |
| `zipWith`  |   X    |          |          |
