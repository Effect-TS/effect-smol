---
"effect": patch
---

Added `-v` as a short alias for the built-in `--version` global flag in `effect/unstable/cli`, matching how `--help` aliases `-h`. This is a breaking change for any CLI that already defined `-v` as a local flag alias at any command in its tree — the global pass now consumes `-v` first and exits. Re-alias such flags (e.g. to `-V` or no short) to restore previous behavior.
