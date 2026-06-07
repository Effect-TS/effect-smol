import { type PickleStep, PickleStepType } from "@cucumber/messages"
import * as Arr from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"

/** @internal */
export type StepKind = "Step" | "Given" | "When" | "Then"

/** @internal */
export type ConcreteStepKind = "Given" | "When" | "Then"

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
  text: string
): ReadonlyArray<MatchedTransition<Transition>> =>
  pipe(
    transitions,
    Arr.map((transition): Option.Option<MatchedTransition<Transition>> =>
      pipe(
        transition.expression.match(text),
        Option.map((captures) => ({ transition, captures }))
      )
    ),
    Arr.getSomes
  )

/** @internal */
export const matchingKeywordTransitions = <Transition extends MatchableTransition>(
  transitions: ReadonlyArray<MatchedTransition<Transition>>,
  kind: ConcreteStepKind
): ReadonlyArray<MatchedTransition<Transition>> =>
  Arr.filter(transitions, (match) => keywordMatches(match.transition.kind, kind))

/** @internal */
export const keywordMatches = (transition: StepKind, keyword: ConcreteStepKind): boolean =>
  transition === "Step" || transition === keyword

/** @internal */
export const concreteStepKind = (step: PickleStep): Option.Option<ConcreteStepKind> => {
  switch (step.type) {
    case PickleStepType.CONTEXT: {
      return Option.some("Given")
    }
    case PickleStepType.ACTION: {
      return Option.some("When")
    }
    case PickleStepType.OUTCOME: {
      return Option.some("Then")
    }
    default: {
      return Option.none()
    }
  }
}

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
