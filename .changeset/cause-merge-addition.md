---
"effect": minor
---

feat(Cause): add Cause.merge function to merge two causes

Added `Cause.merge` function that merges two causes into a single cause containing failures from both. The function supports both curried and uncurried signatures following the dual pattern used throughout the Effect library.