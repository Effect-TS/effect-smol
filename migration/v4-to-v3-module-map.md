# v4 to v3 Module Source Map

Mapped modules: 290
No counterpart: 43

## Mapped Modules

```text
packages/effect/src/ChannelSchema.ts -> .repos/effect/packages/platform/src/ChannelSchema.ts
packages/effect/src/FileSystem.ts -> .repos/effect/packages/platform/src/FileSystem.ts
packages/effect/src/JsonSchema.ts -> .repos/effect/packages/effect/src/JSONSchema.ts
packages/effect/src/Path.ts -> .repos/effect/packages/platform/src/Path.ts
packages/effect/src/PlatformError.ts -> .repos/effect/packages/platform/src/Error.ts
packages/effect/src/Result.ts -> .repos/effect/packages/effect/src/Either.ts
packages/effect/src/Terminal.ts -> .repos/effect/packages/platform/src/Terminal.ts
packages/effect/src/TxDeferred.ts -> .repos/effect/packages/effect/src/TDeferred.ts
packages/effect/src/TxHashMap.ts -> .repos/effect/packages/effect/src/TMap.ts
packages/effect/src/TxHashSet.ts -> .repos/effect/packages/effect/src/TSet.ts
packages/effect/src/TxPriorityQueue.ts -> .repos/effect/packages/effect/src/TPriorityQueue.ts
packages/effect/src/TxPubSub.ts -> .repos/effect/packages/effect/src/TPubSub.ts
packages/effect/src/TxQueue.ts -> .repos/effect/packages/effect/src/TQueue.ts
packages/effect/src/TxReentrantLock.ts -> .repos/effect/packages/effect/src/TReentrantLock.ts
packages/effect/src/TxRef.ts -> .repos/effect/packages/effect/src/TRef.ts
packages/effect/src/TxSemaphore.ts -> .repos/effect/packages/effect/src/TSemaphore.ts
packages/effect/src/TxSubscriptionRef.ts -> .repos/effect/packages/effect/src/TSubscriptionRef.ts
packages/effect/src/testing/FastCheck.ts -> .repos/effect/packages/effect/src/FastCheck.ts
packages/effect/src/testing/TestClock.ts -> .repos/effect/packages/effect/src/TestClock.ts
packages/effect/src/unstable/cli/Argument.ts -> .repos/effect/packages/cli/src/Args.ts
packages/effect/src/unstable/cli/CliError.ts -> .repos/effect/packages/cli/src/ValidationError.ts
packages/effect/src/unstable/cli/Command.ts -> .repos/effect/packages/cli/src/Command.ts
packages/effect/src/unstable/cli/Completions.ts -> .repos/effect/packages/cli/src/CommandDescriptor.ts
packages/effect/src/unstable/cli/Flag.ts -> .repos/effect/packages/cli/src/Options.ts
packages/effect/src/unstable/cli/GlobalFlag.ts -> .repos/effect/packages/cli/src/BuiltInOptions.ts
packages/effect/src/unstable/cli/HelpDoc.ts -> .repos/effect/packages/cli/src/HelpDoc.ts
packages/effect/src/unstable/cli/Primitive.ts -> .repos/effect/packages/cli/src/Primitive.ts
packages/effect/src/unstable/cli/Prompt.ts -> .repos/effect/packages/cli/src/Prompt.ts
packages/effect/src/unstable/cluster/ClusterCron.ts -> .repos/effect/packages/cluster/src/ClusterCron.ts
packages/effect/src/unstable/cluster/ClusterError.ts -> .repos/effect/packages/cluster/src/ClusterError.ts
packages/effect/src/unstable/cluster/ClusterMetrics.ts -> .repos/effect/packages/cluster/src/ClusterMetrics.ts
packages/effect/src/unstable/cluster/ClusterSchema.ts -> .repos/effect/packages/cluster/src/ClusterSchema.ts
packages/effect/src/unstable/cluster/ClusterWorkflowEngine.ts -> .repos/effect/packages/cluster/src/ClusterWorkflowEngine.ts
packages/effect/src/unstable/cluster/DeliverAt.ts -> .repos/effect/packages/cluster/src/DeliverAt.ts
packages/effect/src/unstable/cluster/Entity.ts -> .repos/effect/packages/cluster/src/Entity.ts
packages/effect/src/unstable/cluster/EntityAddress.ts -> .repos/effect/packages/cluster/src/EntityAddress.ts
packages/effect/src/unstable/cluster/EntityId.ts -> .repos/effect/packages/cluster/src/EntityId.ts
packages/effect/src/unstable/cluster/EntityProxy.ts -> .repos/effect/packages/cluster/src/EntityProxy.ts
packages/effect/src/unstable/cluster/EntityProxyServer.ts -> .repos/effect/packages/cluster/src/EntityProxyServer.ts
packages/effect/src/unstable/cluster/EntityResource.ts -> .repos/effect/packages/cluster/src/EntityResource.ts
packages/effect/src/unstable/cluster/EntityType.ts -> .repos/effect/packages/cluster/src/EntityType.ts
packages/effect/src/unstable/cluster/Envelope.ts -> .repos/effect/packages/cluster/src/Envelope.ts
packages/effect/src/unstable/cluster/HttpRunner.ts -> .repos/effect/packages/cluster/src/HttpRunner.ts
packages/effect/src/unstable/cluster/K8sHttpClient.ts -> .repos/effect/packages/cluster/src/K8sHttpClient.ts
packages/effect/src/unstable/cluster/MachineId.ts -> .repos/effect/packages/cluster/src/MachineId.ts
packages/effect/src/unstable/cluster/Message.ts -> .repos/effect/packages/cluster/src/Message.ts
packages/effect/src/unstable/cluster/MessageStorage.ts -> .repos/effect/packages/cluster/src/MessageStorage.ts
packages/effect/src/unstable/cluster/Reply.ts -> .repos/effect/packages/cluster/src/Reply.ts
packages/effect/src/unstable/cluster/Runner.ts -> .repos/effect/packages/cluster/src/Runner.ts
packages/effect/src/unstable/cluster/RunnerAddress.ts -> .repos/effect/packages/cluster/src/RunnerAddress.ts
packages/effect/src/unstable/cluster/RunnerHealth.ts -> .repos/effect/packages/cluster/src/RunnerHealth.ts
packages/effect/src/unstable/cluster/RunnerServer.ts -> .repos/effect/packages/cluster/src/RunnerServer.ts
packages/effect/src/unstable/cluster/RunnerStorage.ts -> .repos/effect/packages/cluster/src/RunnerStorage.ts
packages/effect/src/unstable/cluster/Runners.ts -> .repos/effect/packages/cluster/src/Runners.ts
packages/effect/src/unstable/cluster/ShardId.ts -> .repos/effect/packages/cluster/src/ShardId.ts
packages/effect/src/unstable/cluster/Sharding.ts -> .repos/effect/packages/cluster/src/Sharding.ts
packages/effect/src/unstable/cluster/ShardingConfig.ts -> .repos/effect/packages/cluster/src/ShardingConfig.ts
packages/effect/src/unstable/cluster/ShardingRegistrationEvent.ts -> .repos/effect/packages/cluster/src/ShardingRegistrationEvent.ts
packages/effect/src/unstable/cluster/SingleRunner.ts -> .repos/effect/packages/cluster/src/SingleRunner.ts
packages/effect/src/unstable/cluster/Singleton.ts -> .repos/effect/packages/cluster/src/Singleton.ts
packages/effect/src/unstable/cluster/SingletonAddress.ts -> .repos/effect/packages/cluster/src/SingletonAddress.ts
packages/effect/src/unstable/cluster/Snowflake.ts -> .repos/effect/packages/cluster/src/Snowflake.ts
packages/effect/src/unstable/cluster/SocketRunner.ts -> .repos/effect/packages/cluster/src/SocketRunner.ts
packages/effect/src/unstable/cluster/SqlMessageStorage.ts -> .repos/effect/packages/cluster/src/SqlMessageStorage.ts
packages/effect/src/unstable/cluster/SqlRunnerStorage.ts -> .repos/effect/packages/cluster/src/SqlRunnerStorage.ts
packages/effect/src/unstable/cluster/TestRunner.ts -> .repos/effect/packages/cluster/src/TestRunner.ts
packages/effect/src/unstable/devtools/DevTools.ts -> .repos/effect/packages/experimental/src/DevTools.ts
packages/effect/src/unstable/devtools/DevToolsClient.ts -> .repos/effect/packages/experimental/src/DevTools/Client.ts
packages/effect/src/unstable/devtools/DevToolsSchema.ts -> .repos/effect/packages/experimental/src/DevTools/Domain.ts
packages/effect/src/unstable/devtools/DevToolsServer.ts -> .repos/effect/packages/experimental/src/DevTools/Server.ts
packages/effect/src/unstable/encoding/Msgpack.ts -> .repos/effect/packages/platform/src/MsgPack.ts
packages/effect/src/unstable/encoding/Ndjson.ts -> .repos/effect/packages/platform/src/Ndjson.ts
packages/effect/src/unstable/encoding/Sse.ts -> .repos/effect/packages/experimental/src/Sse.ts
packages/effect/src/unstable/ai/AiError.ts -> .repos/effect/packages/ai/ai/src/AiError.ts
packages/effect/src/unstable/ai/Chat.ts -> .repos/effect/packages/ai/ai/src/Chat.ts
packages/effect/src/unstable/ai/EmbeddingModel.ts -> .repos/effect/packages/ai/ai/src/EmbeddingModel.ts
packages/effect/src/unstable/ai/IdGenerator.ts -> .repos/effect/packages/ai/ai/src/IdGenerator.ts
packages/effect/src/unstable/ai/LanguageModel.ts -> .repos/effect/packages/ai/ai/src/LanguageModel.ts
packages/effect/src/unstable/ai/McpSchema.ts -> .repos/effect/packages/ai/ai/src/McpSchema.ts
packages/effect/src/unstable/ai/McpServer.ts -> .repos/effect/packages/ai/ai/src/McpServer.ts
packages/effect/src/unstable/ai/Model.ts -> .repos/effect/packages/ai/ai/src/Model.ts
packages/effect/src/unstable/ai/Prompt.ts -> .repos/effect/packages/ai/ai/src/Prompt.ts
packages/effect/src/unstable/ai/Response.ts -> .repos/effect/packages/ai/ai/src/Response.ts
packages/effect/src/unstable/ai/Telemetry.ts -> .repos/effect/packages/ai/ai/src/Telemetry.ts
packages/effect/src/unstable/ai/Tokenizer.ts -> .repos/effect/packages/ai/ai/src/Tokenizer.ts
packages/effect/src/unstable/ai/Tool.ts -> .repos/effect/packages/ai/ai/src/Tool.ts
packages/effect/src/unstable/ai/Toolkit.ts -> .repos/effect/packages/ai/ai/src/Toolkit.ts
packages/effect/src/unstable/eventlog/Event.ts -> .repos/effect/packages/experimental/src/Event.ts
packages/effect/src/unstable/eventlog/EventGroup.ts -> .repos/effect/packages/experimental/src/EventGroup.ts
packages/effect/src/unstable/eventlog/EventJournal.ts -> .repos/effect/packages/experimental/src/EventJournal.ts
packages/effect/src/unstable/eventlog/EventLog.ts -> .repos/effect/packages/experimental/src/EventLog.ts
packages/effect/src/unstable/eventlog/EventLogEncryption.ts -> .repos/effect/packages/experimental/src/EventLogEncryption.ts
packages/effect/src/unstable/eventlog/EventLogMessage.ts -> .repos/effect/packages/experimental/src/EventLogRemote.ts
packages/effect/src/unstable/eventlog/EventLogRemote.ts -> .repos/effect/packages/experimental/src/EventLogRemote.ts
packages/effect/src/unstable/eventlog/EventLogServer.ts -> .repos/effect/packages/experimental/src/EventLogServer.ts
packages/effect/src/unstable/eventlog/EventLogServerEncrypted.ts -> .repos/effect/packages/experimental/src/EventLogServer.ts
packages/effect/src/unstable/eventlog/SqlEventJournal.ts -> .repos/effect/packages/sql/src/SqlEventJournal.ts
packages/effect/src/unstable/eventlog/SqlEventLogServerEncrypted.ts -> .repos/effect/packages/sql/src/SqlEventLogServer.ts
packages/effect/src/unstable/http/Cookies.ts -> .repos/effect/packages/platform/src/Cookies.ts
packages/effect/src/unstable/http/Etag.ts -> .repos/effect/packages/platform/src/Etag.ts
packages/effect/src/unstable/http/FetchHttpClient.ts -> .repos/effect/packages/platform/src/FetchHttpClient.ts
packages/effect/src/unstable/http/Headers.ts -> .repos/effect/packages/platform/src/Headers.ts
packages/effect/src/unstable/http/HttpBody.ts -> .repos/effect/packages/platform/src/HttpBody.ts
packages/effect/src/unstable/http/HttpClient.ts -> .repos/effect/packages/platform/src/HttpClient.ts
packages/effect/src/unstable/http/HttpClientError.ts -> .repos/effect/packages/platform/src/HttpClientError.ts
packages/effect/src/unstable/http/HttpClientRequest.ts -> .repos/effect/packages/platform/src/HttpClientRequest.ts
packages/effect/src/unstable/http/HttpClientResponse.ts -> .repos/effect/packages/platform/src/HttpClientResponse.ts
packages/effect/src/unstable/http/HttpEffect.ts -> .repos/effect/packages/platform/src/HttpApp.ts
packages/effect/src/unstable/http/HttpIncomingMessage.ts -> .repos/effect/packages/platform/src/HttpIncomingMessage.ts
packages/effect/src/unstable/http/HttpMethod.ts -> .repos/effect/packages/platform/src/HttpMethod.ts
packages/effect/src/unstable/http/HttpMiddleware.ts -> .repos/effect/packages/platform/src/HttpMiddleware.ts
packages/effect/src/unstable/http/HttpPlatform.ts -> .repos/effect/packages/platform/src/HttpPlatform.ts
packages/effect/src/unstable/http/HttpRouter.ts -> .repos/effect/packages/platform/src/HttpRouter.ts
packages/effect/src/unstable/http/HttpServer.ts -> .repos/effect/packages/platform/src/HttpServer.ts
packages/effect/src/unstable/http/HttpServerError.ts -> .repos/effect/packages/platform/src/HttpServerError.ts
packages/effect/src/unstable/http/HttpServerRequest.ts -> .repos/effect/packages/platform/src/HttpServerRequest.ts
packages/effect/src/unstable/http/HttpServerRespondable.ts -> .repos/effect/packages/platform/src/HttpServerRespondable.ts
packages/effect/src/unstable/http/HttpServerResponse.ts -> .repos/effect/packages/platform/src/HttpServerResponse.ts
packages/effect/src/unstable/http/HttpTraceContext.ts -> .repos/effect/packages/platform/src/HttpTraceContext.ts
packages/effect/src/unstable/http/Multipart.ts -> .repos/effect/packages/platform/src/Multipart.ts
packages/effect/src/unstable/http/Template.ts -> .repos/effect/packages/platform/src/Template.ts
packages/effect/src/unstable/http/Url.ts -> .repos/effect/packages/platform/src/Url.ts
packages/effect/src/unstable/http/UrlParams.ts -> .repos/effect/packages/platform/src/UrlParams.ts
packages/effect/src/unstable/httpapi/HttpApi.ts -> .repos/effect/packages/platform/src/HttpApi.ts
packages/effect/src/unstable/httpapi/HttpApiBuilder.ts -> .repos/effect/packages/platform/src/HttpApiBuilder.ts
packages/effect/src/unstable/httpapi/HttpApiClient.ts -> .repos/effect/packages/platform/src/HttpApiClient.ts
packages/effect/src/unstable/httpapi/HttpApiEndpoint.ts -> .repos/effect/packages/platform/src/HttpApiEndpoint.ts
packages/effect/src/unstable/httpapi/HttpApiError.ts -> .repos/effect/packages/platform/src/HttpApiError.ts
packages/effect/src/unstable/httpapi/HttpApiGroup.ts -> .repos/effect/packages/platform/src/HttpApiGroup.ts
packages/effect/src/unstable/httpapi/HttpApiMiddleware.ts -> .repos/effect/packages/platform/src/HttpApiMiddleware.ts
packages/effect/src/unstable/httpapi/HttpApiScalar.ts -> .repos/effect/packages/platform/src/HttpApiScalar.ts
packages/effect/src/unstable/httpapi/HttpApiSchema.ts -> .repos/effect/packages/platform/src/HttpApiSchema.ts
packages/effect/src/unstable/httpapi/HttpApiSecurity.ts -> .repos/effect/packages/platform/src/HttpApiSecurity.ts
packages/effect/src/unstable/httpapi/HttpApiSwagger.ts -> .repos/effect/packages/platform/src/HttpApiSwagger.ts
packages/effect/src/unstable/httpapi/OpenApi.ts -> .repos/effect/packages/platform/src/OpenApi.ts
packages/effect/src/unstable/observability/Otlp.ts -> .repos/effect/packages/opentelemetry/src/Otlp.ts
packages/effect/src/unstable/observability/OtlpExporter.ts -> .repos/effect/packages/opentelemetry/src/internal/otlpExporter.ts
packages/effect/src/unstable/observability/OtlpLogger.ts -> .repos/effect/packages/opentelemetry/src/OtlpLogger.ts
packages/effect/src/unstable/observability/OtlpMetrics.ts -> .repos/effect/packages/opentelemetry/src/OtlpMetrics.ts
packages/effect/src/unstable/observability/OtlpResource.ts -> .repos/effect/packages/opentelemetry/src/OtlpResource.ts
packages/effect/src/unstable/observability/OtlpSerialization.ts -> .repos/effect/packages/opentelemetry/src/OtlpSerialization.ts
packages/effect/src/unstable/observability/OtlpTracer.ts -> .repos/effect/packages/opentelemetry/src/OtlpTracer.ts
packages/effect/src/unstable/persistence/KeyValueStore.ts -> .repos/effect/packages/platform/src/KeyValueStore.ts
packages/effect/src/unstable/persistence/Persistable.ts -> .repos/effect/packages/experimental/src/Persistence.ts
packages/effect/src/unstable/persistence/PersistedCache.ts -> .repos/effect/packages/experimental/src/PersistedCache.ts
packages/effect/src/unstable/persistence/PersistedQueue.ts -> .repos/effect/packages/experimental/src/PersistedQueue.ts
packages/effect/src/unstable/persistence/Persistence.ts -> .repos/effect/packages/experimental/src/Persistence.ts
packages/effect/src/unstable/persistence/RateLimiter.ts -> .repos/effect/packages/experimental/src/RateLimiter.ts
packages/effect/src/unstable/process/ChildProcess.ts -> .repos/effect/packages/platform/src/Command.ts
packages/effect/src/unstable/process/ChildProcessSpawner.ts -> .repos/effect/packages/platform/src/CommandExecutor.ts
packages/effect/src/unstable/reactivity/Reactivity.ts -> .repos/effect/packages/experimental/src/Reactivity.ts
packages/effect/src/unstable/rpc/Rpc.ts -> .repos/effect/packages/rpc/src/Rpc.ts
packages/effect/src/unstable/rpc/RpcClient.ts -> .repos/effect/packages/rpc/src/RpcClient.ts
packages/effect/src/unstable/rpc/RpcClientError.ts -> .repos/effect/packages/rpc/src/RpcClientError.ts
packages/effect/src/unstable/rpc/RpcGroup.ts -> .repos/effect/packages/rpc/src/RpcGroup.ts
packages/effect/src/unstable/rpc/RpcMessage.ts -> .repos/effect/packages/rpc/src/RpcMessage.ts
packages/effect/src/unstable/rpc/RpcMiddleware.ts -> .repos/effect/packages/rpc/src/RpcMiddleware.ts
packages/effect/src/unstable/rpc/RpcSchema.ts -> .repos/effect/packages/rpc/src/RpcSchema.ts
packages/effect/src/unstable/rpc/RpcSerialization.ts -> .repos/effect/packages/rpc/src/RpcSerialization.ts
packages/effect/src/unstable/rpc/RpcServer.ts -> .repos/effect/packages/rpc/src/RpcServer.ts
packages/effect/src/unstable/rpc/RpcTest.ts -> .repos/effect/packages/rpc/src/RpcTest.ts
packages/effect/src/unstable/rpc/RpcWorker.ts -> .repos/effect/packages/rpc/src/RpcWorker.ts
packages/effect/src/unstable/schema/Model.ts -> .repos/effect/packages/sql/src/Model.ts
packages/effect/src/unstable/schema/VariantSchema.ts -> .repos/effect/packages/experimental/src/VariantSchema.ts
packages/effect/src/unstable/socket/Socket.ts -> .repos/effect/packages/platform/src/Socket.ts
packages/effect/src/unstable/socket/SocketServer.ts -> .repos/effect/packages/platform/src/SocketServer.ts
packages/effect/src/unstable/sql/Migrator.ts -> .repos/effect/packages/sql/src/Migrator.ts
packages/effect/src/unstable/sql/SqlClient.ts -> .repos/effect/packages/sql/src/SqlClient.ts
packages/effect/src/unstable/sql/SqlConnection.ts -> .repos/effect/packages/sql/src/SqlConnection.ts
packages/effect/src/unstable/sql/SqlError.ts -> .repos/effect/packages/sql/src/SqlError.ts
packages/effect/src/unstable/sql/SqlModel.ts -> .repos/effect/packages/sql/src/Model.ts
packages/effect/src/unstable/sql/SqlResolver.ts -> .repos/effect/packages/sql/src/SqlResolver.ts
packages/effect/src/unstable/sql/SqlSchema.ts -> .repos/effect/packages/sql/src/SqlSchema.ts
packages/effect/src/unstable/sql/SqlStream.ts -> .repos/effect/packages/sql/src/SqlStream.ts
packages/effect/src/unstable/sql/Statement.ts -> .repos/effect/packages/sql/src/Statement.ts
packages/effect/src/unstable/workers/Transferable.ts -> .repos/effect/packages/platform/src/Transferable.ts
packages/effect/src/unstable/workers/Worker.ts -> .repos/effect/packages/platform/src/Worker.ts
packages/effect/src/unstable/workers/WorkerError.ts -> .repos/effect/packages/platform/src/WorkerError.ts
packages/effect/src/unstable/workers/WorkerRunner.ts -> .repos/effect/packages/platform/src/WorkerRunner.ts
packages/effect/src/unstable/workflow/Activity.ts -> .repos/effect/packages/workflow/src/Activity.ts
packages/effect/src/unstable/workflow/DurableClock.ts -> .repos/effect/packages/workflow/src/DurableClock.ts
packages/effect/src/unstable/workflow/DurableDeferred.ts -> .repos/effect/packages/workflow/src/DurableDeferred.ts
packages/effect/src/unstable/workflow/DurableQueue.ts -> .repos/effect/packages/workflow/src/DurableQueue.ts
packages/effect/src/unstable/workflow/Workflow.ts -> .repos/effect/packages/workflow/src/Workflow.ts
packages/effect/src/unstable/workflow/WorkflowEngine.ts -> .repos/effect/packages/workflow/src/WorkflowEngine.ts
packages/effect/src/unstable/workflow/WorkflowProxy.ts -> .repos/effect/packages/workflow/src/WorkflowProxy.ts
packages/effect/src/unstable/workflow/WorkflowProxyServer.ts -> .repos/effect/packages/workflow/src/WorkflowProxyServer.ts
packages/effect/src/Array.ts -> .repos/effect/packages/effect/src/Array.ts
packages/effect/src/BigDecimal.ts -> .repos/effect/packages/effect/src/BigDecimal.ts
packages/effect/src/BigInt.ts -> .repos/effect/packages/effect/src/BigInt.ts
packages/effect/src/Boolean.ts -> .repos/effect/packages/effect/src/Boolean.ts
packages/effect/src/Brand.ts -> .repos/effect/packages/effect/src/Brand.ts
packages/effect/src/Cache.ts -> .repos/effect/packages/effect/src/Cache.ts
packages/effect/src/Cause.ts -> .repos/effect/packages/effect/src/Cause.ts
packages/effect/src/Channel.ts -> .repos/effect/packages/effect/src/Channel.ts
packages/effect/src/Chunk.ts -> .repos/effect/packages/effect/src/Chunk.ts
packages/effect/src/Clock.ts -> .repos/effect/packages/effect/src/Clock.ts
packages/effect/src/Combiner.ts -> .repos/effect/packages/typeclass/src/Semigroup.ts
packages/effect/src/Config.ts -> .repos/effect/packages/effect/src/Config.ts
packages/effect/src/ConfigProvider.ts -> .repos/effect/packages/effect/src/ConfigProvider.ts
packages/effect/src/Console.ts -> .repos/effect/packages/effect/src/Console.ts
packages/effect/src/Context.ts -> .repos/effect/packages/effect/src/Context.ts
packages/effect/src/Cron.ts -> .repos/effect/packages/effect/src/Cron.ts
packages/effect/src/Data.ts -> .repos/effect/packages/effect/src/Data.ts
packages/effect/src/DateTime.ts -> .repos/effect/packages/effect/src/DateTime.ts
packages/effect/src/Deferred.ts -> .repos/effect/packages/effect/src/Deferred.ts
packages/effect/src/Differ.ts -> .repos/effect/packages/effect/src/Differ.ts
packages/effect/src/Duration.ts -> .repos/effect/packages/effect/src/Duration.ts
packages/effect/src/Effect.ts -> .repos/effect/packages/effect/src/Effect.ts
packages/effect/src/Effectable.ts -> .repos/effect/packages/effect/src/Effectable.ts
packages/effect/src/Encoding.ts -> .repos/effect/packages/effect/src/Encoding.ts
packages/effect/src/Equal.ts -> .repos/effect/packages/effect/src/Equal.ts
packages/effect/src/Equivalence.ts -> .repos/effect/packages/effect/src/Equivalence.ts
packages/effect/src/ExecutionPlan.ts -> .repos/effect/packages/effect/src/ExecutionPlan.ts
packages/effect/src/Exit.ts -> .repos/effect/packages/effect/src/Exit.ts
packages/effect/src/Fiber.ts -> .repos/effect/packages/effect/src/Fiber.ts
packages/effect/src/FiberHandle.ts -> .repos/effect/packages/effect/src/FiberHandle.ts
packages/effect/src/FiberMap.ts -> .repos/effect/packages/effect/src/FiberMap.ts
packages/effect/src/FiberSet.ts -> .repos/effect/packages/effect/src/FiberSet.ts
packages/effect/src/Formatter.ts -> .repos/effect/packages/effect/src/Inspectable.ts
packages/effect/src/Function.ts -> .repos/effect/packages/effect/src/Function.ts
packages/effect/src/Graph.ts -> .repos/effect/packages/effect/src/Graph.ts
packages/effect/src/HKT.ts -> .repos/effect/packages/effect/src/HKT.ts
packages/effect/src/Hash.ts -> .repos/effect/packages/effect/src/Hash.ts
packages/effect/src/HashMap.ts -> .repos/effect/packages/effect/src/HashMap.ts
packages/effect/src/HashRing.ts -> .repos/effect/packages/effect/src/HashRing.ts
packages/effect/src/HashSet.ts -> .repos/effect/packages/effect/src/HashSet.ts
packages/effect/src/Inspectable.ts -> .repos/effect/packages/effect/src/Inspectable.ts
packages/effect/src/Iterable.ts -> .repos/effect/packages/effect/src/Iterable.ts
packages/effect/src/Layer.ts -> .repos/effect/packages/effect/src/Layer.ts
packages/effect/src/LayerMap.ts -> .repos/effect/packages/effect/src/LayerMap.ts
packages/effect/src/LogLevel.ts -> .repos/effect/packages/effect/src/LogLevel.ts
packages/effect/src/Logger.ts -> .repos/effect/packages/effect/src/Logger.ts
packages/effect/src/ManagedRuntime.ts -> .repos/effect/packages/effect/src/ManagedRuntime.ts
packages/effect/src/Match.ts -> .repos/effect/packages/effect/src/Match.ts
packages/effect/src/Metric.ts -> .repos/effect/packages/effect/src/Metric.ts
packages/effect/src/MutableHashMap.ts -> .repos/effect/packages/effect/src/MutableHashMap.ts
packages/effect/src/MutableHashSet.ts -> .repos/effect/packages/effect/src/MutableHashSet.ts
packages/effect/src/MutableList.ts -> .repos/effect/packages/effect/src/MutableList.ts
packages/effect/src/MutableRef.ts -> .repos/effect/packages/effect/src/MutableRef.ts
packages/effect/src/NonEmptyIterable.ts -> .repos/effect/packages/effect/src/NonEmptyIterable.ts
packages/effect/src/Number.ts -> .repos/effect/packages/effect/src/Number.ts
packages/effect/src/Option.ts -> .repos/effect/packages/effect/src/Option.ts
packages/effect/src/Order.ts -> .repos/effect/packages/effect/src/Order.ts
packages/effect/src/Ordering.ts -> .repos/effect/packages/effect/src/Ordering.ts
packages/effect/src/PartitionedSemaphore.ts -> .repos/effect/packages/effect/src/PartitionedSemaphore.ts
packages/effect/src/Pipeable.ts -> .repos/effect/packages/effect/src/Pipeable.ts
packages/effect/src/Pool.ts -> .repos/effect/packages/effect/src/Pool.ts
packages/effect/src/Predicate.ts -> .repos/effect/packages/effect/src/Predicate.ts
packages/effect/src/PrimaryKey.ts -> .repos/effect/packages/effect/src/PrimaryKey.ts
packages/effect/src/PubSub.ts -> .repos/effect/packages/effect/src/PubSub.ts
packages/effect/src/Queue.ts -> .repos/effect/packages/effect/src/Queue.ts
packages/effect/src/Random.ts -> .repos/effect/packages/effect/src/Random.ts
packages/effect/src/RcMap.ts -> .repos/effect/packages/effect/src/RcMap.ts
packages/effect/src/RcRef.ts -> .repos/effect/packages/effect/src/RcRef.ts
packages/effect/src/Record.ts -> .repos/effect/packages/effect/src/Record.ts
packages/effect/src/Redactable.ts -> .repos/effect/packages/effect/src/Inspectable.ts
packages/effect/src/Redacted.ts -> .repos/effect/packages/effect/src/Redacted.ts
packages/effect/src/Reducer.ts -> .repos/effect/packages/typeclass/src/Monoid.ts
packages/effect/src/Ref.ts -> .repos/effect/packages/effect/src/Ref.ts
packages/effect/src/References.ts -> .repos/effect/packages/effect/src/FiberRef.ts
packages/effect/src/RegExp.ts -> .repos/effect/packages/effect/src/RegExp.ts
packages/effect/src/Request.ts -> .repos/effect/packages/effect/src/Request.ts
packages/effect/src/RequestResolver.ts -> .repos/effect/packages/effect/src/RequestResolver.ts
packages/effect/src/Resource.ts -> .repos/effect/packages/effect/src/Resource.ts
packages/effect/src/Runtime.ts -> .repos/effect/packages/effect/src/Runtime.ts
packages/effect/src/Schedule.ts -> .repos/effect/packages/effect/src/Schedule.ts
packages/effect/src/Scheduler.ts -> .repos/effect/packages/effect/src/Scheduler.ts
packages/effect/src/Schema.ts -> .repos/effect/packages/effect/src/Schema.ts
packages/effect/src/SchemaAST.ts -> .repos/effect/packages/effect/src/SchemaAST.ts
packages/effect/src/SchemaIssue.ts -> .repos/effect/packages/effect/src/ParseResult.ts
packages/effect/src/SchemaParser.ts -> .repos/effect/packages/effect/src/ParseResult.ts
packages/effect/src/SchemaTransformation.ts -> .repos/effect/packages/effect/src/Schema.ts
packages/effect/src/Scope.ts -> .repos/effect/packages/effect/src/Scope.ts
packages/effect/src/ScopedCache.ts -> .repos/effect/packages/effect/src/ScopedCache.ts
packages/effect/src/ScopedRef.ts -> .repos/effect/packages/effect/src/ScopedRef.ts
packages/effect/src/Sink.ts -> .repos/effect/packages/effect/src/Sink.ts
packages/effect/src/Stream.ts -> .repos/effect/packages/effect/src/Stream.ts
packages/effect/src/String.ts -> .repos/effect/packages/effect/src/String.ts
packages/effect/src/Struct.ts -> .repos/effect/packages/effect/src/Struct.ts
packages/effect/src/SubscriptionRef.ts -> .repos/effect/packages/effect/src/SubscriptionRef.ts
packages/effect/src/Symbol.ts -> .repos/effect/packages/effect/src/Symbol.ts
packages/effect/src/SynchronizedRef.ts -> .repos/effect/packages/effect/src/SynchronizedRef.ts
packages/effect/src/Take.ts -> .repos/effect/packages/effect/src/Take.ts
packages/effect/src/Tracer.ts -> .repos/effect/packages/effect/src/Tracer.ts
packages/effect/src/Trie.ts -> .repos/effect/packages/effect/src/Trie.ts
packages/effect/src/Tuple.ts -> .repos/effect/packages/effect/src/Tuple.ts
packages/effect/src/Types.ts -> .repos/effect/packages/effect/src/Types.ts
packages/effect/src/Unify.ts -> .repos/effect/packages/effect/src/Unify.ts
packages/effect/src/Utils.ts -> .repos/effect/packages/effect/src/Utils.ts
```

## No Counterpart

```text
packages/effect/src/ErrorReporter.ts
packages/effect/src/Filter.ts
packages/effect/src/JsonPatch.ts
packages/effect/src/JsonPointer.ts
packages/effect/src/Latch.ts
packages/effect/src/Newtype.ts
packages/effect/src/Optic.ts
packages/effect/src/Pull.ts
packages/effect/src/SchemaGetter.ts
packages/effect/src/SchemaRepresentation.ts
packages/effect/src/SchemaUtils.ts
packages/effect/src/Semaphore.ts
packages/effect/src/Stdio.ts
packages/effect/src/TxChunk.ts
packages/effect/src/UndefinedOr.ts
packages/effect/src/testing/TestConsole.ts
packages/effect/src/testing/TestSchema.ts
packages/effect/src/unstable/ai/AnthropicStructuredOutput.ts
packages/effect/src/unstable/ai/OpenAiStructuredOutput.ts
packages/effect/src/unstable/ai/ResponseIdTracker.ts
packages/effect/src/unstable/cli/CliOutput.ts
packages/effect/src/unstable/cli/Param.ts
packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts
packages/effect/src/unstable/eventlog/EventLogSessionAuth.ts
packages/effect/src/unstable/eventlog/SqlEventLogServerUnencrypted.ts
packages/effect/src/unstable/http/FindMyWay.ts
packages/effect/src/unstable/http/HttpStaticServer.ts
packages/effect/src/unstable/http/Multipasta.ts
packages/effect/src/unstable/http/Multipasta/HeadersParser.ts
packages/effect/src/unstable/http/Multipasta/Node.ts
packages/effect/src/unstable/http/Multipasta/Search.ts
packages/effect/src/unstable/http/Multipasta/Web.ts
packages/effect/src/unstable/httpapi/HttpApiTest.ts
packages/effect/src/unstable/observability/PrometheusMetrics.ts
packages/effect/src/unstable/persistence/Redis.ts
packages/effect/src/unstable/reactivity/AsyncResult.ts
packages/effect/src/unstable/reactivity/Atom.ts
packages/effect/src/unstable/reactivity/AtomHttpApi.ts
packages/effect/src/unstable/reactivity/AtomRef.ts
packages/effect/src/unstable/reactivity/AtomRegistry.ts
packages/effect/src/unstable/reactivity/AtomRpc.ts
packages/effect/src/unstable/reactivity/Hydration.ts
packages/effect/src/unstable/rpc/Utils.ts
```
