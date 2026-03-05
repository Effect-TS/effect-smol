---
"@effect/platform-node-shared": patch
---

Made stdout and stderr sinks from node.js's Stdio be able to take elements from more than one stream, effectively tying them to layer lifecycle. Previously both of them called .end() on underlying process.stdout and process.stdin the moment the first stream finished
