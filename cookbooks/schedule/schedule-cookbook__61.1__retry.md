---
book: Effect `Schedule` Cookbook
section_number: "61.1"
section_title: "Retry"
part_title: "Part XIV — Reference Appendices"
chapter_title: "61. Glossary"
status: "draft"
code_included: false
---

# 61.1 Retry

Retry is the use of a `Schedule` to decide whether, when, and how often to re-run an effect after it fails. In Effect terms, the failure value is the input to the schedule. Each failed attempt steps the schedule; the schedule either halts, causing the original failure path to continue, or continues after the delay it computes.

## What this section is about

This glossary entry focuses on the boundary between retry and other recurrence.
It names the schedule input, halt behavior, and safety concerns that make a
retry policy recovery logic rather than normal repetition.

## Why it matters

Retry is easy to confuse with repeat because both reuse `Schedule`. The difference is the signal that advances the schedule. Retry advances after failure. Repeat advances after success. That distinction determines what the schedule sees as input, what the surrounding effect returns, and whether the policy is handling recovery or normal recurrence.

## Core idea

A `Schedule` is a policy that receives an input and decides to continue or halt, along with a delay for the next recurrence. For retry, that input is the failure from the attempted effect. This is why retry schedules can inspect, filter, log, or classify failures with input-aware combinators, while still using the same timing and limiting combinators as any other schedule.

## Practical guidance

Use retry for operations where a later attempt may succeed because the failure is transient or externally caused. Bound the policy with attempt limits, elapsed-time limits, or both. Add backoff and jitter when retries can amplify load across many fibers or processes. For effects with visible or irreversible side effects, only retry when duplicate execution is safe or explicitly guarded.
