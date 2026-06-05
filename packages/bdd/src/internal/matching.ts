import * as Arr from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type * as Parser from "./parser.ts"

/** @internal */
export type StepKind = "Step" | "Given" | "When" | "Then"

/** @internal */
export interface MatchableTransition {
  readonly kind: StepKind
  readonly expression: {
    readonly source: string
    readonly match: (text: string) => Option.Option<unknown>
  }
}

/** @internal */
export interface MatchedTransition<Transition extends MatchableTransition> {
  readonly transition: Transition
  readonly captures: unknown
}

/** @internal */
export const matchingTextTransitions = <Transition extends MatchableTransition>(
  transitions: ReadonlyArray<Transition>,
  step: Parser.ParsedStep
): ReadonlyArray<MatchedTransition<Transition>> =>
  pipe(
    transitions,
    Arr.map((transition): Option.Option<MatchedTransition<Transition>> =>
      pipe(
        transition.expression.match(step.text),
        Option.map((captures) => ({ transition, captures }))
      )
    ),
    Arr.getSomes
  )

/** @internal */
export const matchingKeywordTransitions = <Transition extends MatchableTransition>(
  transitions: ReadonlyArray<MatchedTransition<Transition>>,
  step: Parser.ParsedStep
): ReadonlyArray<MatchedTransition<Transition>> =>
  Arr.filter(transitions, (match) => keywordMatches(match.transition.kind, step.kind))

/** @internal */
export const keywordMatches = (transition: StepKind, keyword: Parser.StepKind): boolean =>
  transition === "Step" || transition === keyword

/** @internal */
export const renderTransitionKinds = <Transition extends MatchableTransition>(
  transitions: ReadonlyArray<Transition>
): string =>
  pipe(
    transitions,
    Arr.map((transition) => transition.kind),
    Arr.dedupe,
    Arr.join(", ")
  )
