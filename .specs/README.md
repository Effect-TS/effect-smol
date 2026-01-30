# Specifications

This directory contains specifications for all major features and enhancements in the Effect library, following a structured spec-driven development approach that ensures systematic planning, implementation, and validation.

## Contents

- [worker-error-reason-pattern.md](worker-error-reason-pattern.md) - Refactor WorkerError to use the reason pattern with structured reasons.
- [http-client-error-reason-pattern.md](http-client-error-reason-pattern.md) - Refactor HttpClientError to a reason-based wrapper with per-reason classes.
- [http-server-error-reason-pattern.md](http-server-error-reason-pattern.md) - Refactor HttpServerError to use the reason pattern with per-reason classes.
- [effect-ignore-log.md](effect-ignore-log.md) - Add optional logging to `Effect.ignore` and remove `Effect.ignoreLogged`.
- [effect-jsdoc-improvements.md](effect-jsdoc-improvements.md) - Improve JSDoc clarity and consistency for `Effect.ts`.
- [stream-jsdoc-improvements.md](stream-jsdoc-improvements.md) - Improve JSDoc clarity and consistency for `Stream.ts`.
- [scoped-atom-port.md](scoped-atom-port.md) - Port the legacy ScopedAtom module into `@effect/atom-react`.
