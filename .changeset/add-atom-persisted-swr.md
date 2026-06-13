---
"effect": minor
---

Add `Atom.persistedSwr` to combine key-value persistence with stale-while-revalidate, preferring valid registry values over fresh persisted cache for SSR and hydration, and `Atom.invalidatePersisted` to clear persisted SWR cache entries and refetch.
