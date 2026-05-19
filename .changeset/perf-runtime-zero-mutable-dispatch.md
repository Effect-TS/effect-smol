---
"effect": patch
---

perf(runtime): per-instance [evaluate] dispatch via shared protos; zero module-level mutable dispatch state. Closes a JIT-friendliness gap in the run-loop's primary dispatch site: evaluator references now flow by closure capture (parenthood) instead of through a module-level mutable registry, enabling JSC to const-fold the call target. -39% on succeed-flatMap chains, -31% on deep service-yield, -19% on fork-join, with 9/10 benchmark scenarios improving and no regressions at n=300 pooled samples.
