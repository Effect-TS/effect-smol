/**
 * @since 4.0.0
 */

import type { NoSuchElementError } from "../../Cause.ts"
import * as Arr from "../../collections/Array.ts"
import * as Data from "../../data/Data.ts"
import * as Option from "../../data/Option.ts"
import * as Redacted from "../../data/Redacted.ts"
import * as Effect from "../../Effect.ts"
import { dual, identity, pipe } from "../../Function.ts"
import * as Pipeable from "../../interfaces/Pipeable.ts"
import { YieldableProto } from "../../internal/core.ts"
import * as Match from "../../match/Match.ts"
import * as FileSystem from "../../platform/FileSystem.ts"
import * as Path from "../../platform/Path.ts"
import * as Terminal from "../../platform/Terminal.ts"
import * as EffectNumber from "../../primitives/Number.ts"
import * as Queue from "../../Queue.ts"
import * as Ansi from "./internal/ansi.ts"
import type * as Primitive from "./Primitive.js"

const TypeId = "~@effect/cli/Prompt"

/**
 * @since 4.0.0
 * @category models
 */
export interface Prompt<Output>
  extends Prompt.Variance<Output>, Pipeable.Pipeable, Effect.Effect<Output, Terminal.QuitException, Terminal>
{}

/**
 * @since 4.0.0
 */
export declare namespace Prompt {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Variance<Output> {
    readonly [TypeId]: Prompt.VarianceStruct<Output>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface VarianceStruct<Output> {
    readonly _Output: (_: never) => Output
  }

  /**
   * Represents the services available to a custom `Prompt`.
   *
   * @since 4.0.0
   * @category models
   */
  export type Environment = FileSystem | Path.Path | Terminal

  /**
   * Represents the action that should be taken by a `Prompt` based upon the
   * user input received during the current frame.
   *
   * @since 4.0.0
   * @category models
   */
  export type Action<State, Output> = Data.TaggedEnum<{
    readonly Beep: {}
    readonly NextFrame: { readonly state: State }
    readonly Submit: { readonly value: Output }
  }>

  /**
   * Represents the definition of an `Action`.
   *
   * Required to create a `Data.TaggedEnum` with generic type arguments.
   *
   * @since 4.0.0
   * @category models
   */
  export interface ActionDefinition extends Data.TaggedEnum.WithGenerics<2> {
    readonly taggedEnum: Action<this["A"], this["B"]>
  }

  /**
   * Represents the set of handlers used by a `Prompt` to:
   *
   *   - Render the current frame of the prompt
   *   - Process user input and determine the next `Prompt.Action` to take
   *   - Clear the terminal screen before the next frame
   *
   * @since 4.0.0
   * @category models
   */
  export interface Handlers<State, Output> {
    /**
     * A function that is called to render the current frame of the `Prompt`.
     *
     * @param state The current state of the prompt.
     * @param action The `Prompt.Action` for the current frame.
     * @returns An ANSI escape code sequence to display in the terminal screen.
     */
    readonly render: (
      state: State,
      action: Action<State, Output>
    ) => Effect.Effect<string, never, Environment>
    /**
     * A function that is called to process user input and determine the next
     * `Prompt.Action` that should be taken.
     *
     * @param input The input the user provided for the current frame.
     * @param state The current state of the prompt.
     * @returns The next `Prompt.Action` that should be taken.
     */
    readonly process: (
      input: Terminal.UserInput,
      state: State
    ) => Effect.Effect<Action<State, Output>, never, Environment>
    /**
     * A function that is called to clear the terminal screen before rendering
     * the next frame of the `Prompt`.
     *
     * @param action The `Prompt.Action` for the current frame.
     * @param columns The current number of columns available in the `Terminal`.
     * @returns An ANSI escape code sequence used to clear the terminal screen.
     */
    readonly clear: (
      state: State,
      action: Action<State, Output>
    ) => Effect.Effect<string, never, Environment>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface ConfirmOptions {
    /**
     * The message to display in the prompt.
     */
    readonly message: string
    /**
     * The intitial value of the confirm prompt (defaults to `false`).
     */
    readonly initial?: boolean
    /**
     * The label to display after a user has responded to the prompt.
     */
    readonly label?: {
      /**
       * The label used if the prompt is confirmed (defaults to `"yes"`).
       */
      readonly confirm: string
      /**
       * The label used if the prompt is not confirmed (defaults to `"no"`).
       */
      readonly deny: string
    }
    /**
     * The placeholder to display when a user is responding to the prompt.
     */
    readonly placeholder?: {
      /**
       * The placeholder to use if the `initial` value of the prompt is `true`
       * (defaults to `"(Y/n)"`).
       */
      readonly defaultConfirm?: string
      /**
       * The placeholder to use if the `initial` value of the prompt is `false`
       * (defaults to `"(y/N)"`).
       */
      readonly defaultDeny?: string
    }
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface DateOptions {
    /**
     * The message to display in the prompt.
     */
    readonly message: string
    /**
     * The initial date value to display in the prompt (defaults to the current
     * date).
     */
    readonly initial?: globalThis.Date
    /**
     * The format mask of the date (defaults to `YYYY-MM-DD HH:mm:ss`).
     */
    readonly dateMask?: string
    /**
     * An effectful function that can be used to validate the value entered into
     * the prompt before final submission.
     */
    readonly validate?: (value: globalThis.Date) => Effect.Effect<globalThis.Date, string>
    /**
     * Custom locales that can be used in place of the defaults.
     */
    readonly locales?: {
      /**
       * The full names of each month of the year.
       */
      readonly months: [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
      /**
       * The short names of each month of the year.
       */
      readonly monthsShort: [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
      /**
       * The full names of each day of the week.
       */
      readonly weekdays: [string, string, string, string, string, string, string]
      /**
       * The short names of each day of the week.
       */
      readonly weekdaysShort: [string, string, string, string, string, string, string]
    }
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface IntegerOptions {
    /**
     * The message to display in the prompt.
     */
    readonly message: string
    /**
     * The minimum value that can be entered by the user (defaults to `-Infinity`).
     */
    readonly min?: number
    /**
     * The maximum value that can be entered by the user (defaults to `Infinity`).
     */
    readonly max?: number
    /**
     * The value that will be used to increment the prompt value when using the
     * up arrow key (defaults to `1`).
     */
    readonly incrementBy?: number
    /**
     * The value that will be used to decrement the prompt value when using the
     * down arrow key (defaults to `1`).
     */
    readonly decrementBy?: number
    /**
     * An effectful function that can be used to validate the value entered into
     * the prompt before final submission.
     */
    readonly validate?: (value: number) => Effect.Effect<number, string>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface FloatOptions extends IntegerOptions {
    /**
     * The precision to use for the floating point value (defaults to `2`).
     */
    readonly precision?: number
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface ListOptions extends TextOptions {
    /**
     * The delimiter that separates list entries.
     */
    readonly delimiter?: string
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface FileOptions {
    /**
     * The path type that will be selected.
     *
     * Defaults to `"file"`.
     */
    readonly type?: Primitive.PathType
    /**
     * The message to display in the prompt.
     *
     * Defaults to `"Choose a file"`.
     */
    readonly message?: string
    /**
     * Where the user will initially be prompted to select files from.
     *
     * Defaults to the current working directory.
     */
    readonly startingPath?: string
    /**
     * The number of choices to display at one time
     *
     * Defaults to `10`.
     */
    readonly maxPerPage?: number
    /**
     * A function which removes any file from the prompt display where the
     * specified predicate returns `true`.
     *
     * Defaults to returning all files.
     */
    readonly filter?: (file: string) => boolean | Effect.Effect<boolean, never, Environment>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface SelectOptions<A> {
    /**
     * The message to display in the prompt.
     */
    readonly message: string
    /**
     * The choices to display to the user.
     */
    readonly choices: ReadonlyArray<SelectChoice<A>>
    /**
     * The number of choices to display at one time (defaults to `10`).
     */
    readonly maxPerPage?: number
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface MultiSelectOptions {
    /**
     * Text for the "Select All" option (defaults to "Select All").
     */
    readonly selectAll?: string
    /**
     * Text for the "Select None" option (defaults to "Select None").
     */
    readonly selectNone?: string
    /**
     * Text for the "Inverse Selection" option (defaults to "Inverse Selection").
     */
    readonly inverseSelection?: string
    /**
     * The minimum number of choices that must be selected.
     */
    readonly min?: number
    /**
     * The maximum number of choices that can be selected.
     */
    readonly max?: number
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface SelectChoice<A> {
    /**
     * The name of the select option that is displayed to the user.
     */
    readonly title: string
    /**
     * The underlying value of the select option.
     */
    readonly value: A
    /**
     * An optional description for the select option which will be displayed
     * to the user.
     */
    readonly description?: string
    /**
     * Whether or not this select option is disabled.
     */
    readonly disabled?: boolean
    /**
     * Whether this option should be selected by default (only used by MultiSelect).
     */
    readonly selected?: boolean
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface TextOptions {
    /**
     * The message to display in the prompt.
     */
    readonly message: string
    /**
     * The default value of the text option.
     */
    readonly default?: string
    /**
     * An effectful function that can be used to validate the value entered into
     * the prompt before final submission.
     */
    readonly validate?: (value: string) => Effect.Effect<string, string>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface ToggleOptions {
    /**
     * The message to display in the prompt.
     */
    readonly message: string
    /**
     * The intitial value of the toggle prompt (defaults to `false`).
     */
    readonly initial?: boolean
    /**
     * The text to display when the toggle is in the active state (defaults to
     * `on`).
     */
    readonly active?: string
    /**
     * The text to display when the toggle is in the inactive state (defaults to
     * `off`).
     */
    readonly inactive?: string
  }
}

const defaultFigures = {
  arrowUp: "↑",
  arrowDown: "↓",
  arrowLeft: "←",
  arrowRight: "→",
  radioOn: "◉",
  radioOff: "◯",
  checkboxOn: "☒",
  checkboxOff: "☐",
  tick: "✔",
  cross: "✖",
  ellipsis: "…",
  pointerSmall: "›",
  line: "─",
  pointer: "❯"
}

const windowsFigures = {
  arrowUp: defaultFigures.arrowUp,
  arrowDown: defaultFigures.arrowDown,
  arrowLeft: defaultFigures.arrowLeft,
  arrowRight: defaultFigures.arrowRight,
  radioOn: "(*)",
  radioOff: "( )",
  checkboxOn: "[*]",
  checkboxOff: "[ ]",
  tick: "√",
  cross: "×",
  ellipsis: "...",
  pointerSmall: "»",
  line: "─",
  pointer: ">"
}

/** @internal */
export const platformFigures = Effect.map(
  Effect.sync(() => process.platform === "win32"),
  (isWindows) => isWindows ? windowsFigures : defaultFigures
)

/**
 * @since 4.0.0
 */
export declare namespace All {
  /**
   * @since 4.0.0
   */
  export type PromptAny = Prompt<any>

  /**
   * @since 4.0.0
   */
  export type ReturnIterable<T extends Iterable<PromptAny>> = [T] extends [Iterable<Prompt.Variance<infer A>>] ?
    Prompt<Array<A>>
    : never

  /**
   * @since 4.0.0
   */
  export type ReturnTuple<T extends ReadonlyArray<unknown>> = Prompt<
    T[number] extends never ? []
      : { -readonly [K in keyof T]: [T[K]] extends [Prompt.Variance<infer _A>] ? _A : never }
  > extends infer X ? X : never

  /**
   * @since 4.0.0
   */
  export type ReturnObject<T> = [T] extends [{ [K: string]: PromptAny }] ? Prompt<
      {
        -readonly [K in keyof T]: [T[K]] extends [Prompt.Variance<infer _A>] ? _A : never
      }
    >
    : never

  /**
   * @since 4.0.0
   */
  export type Return<
    Arg extends Iterable<PromptAny> | Record<string, PromptAny>
  > = [Arg] extends [ReadonlyArray<PromptAny>] ? ReturnTuple<Arg>
    : [Arg] extends [Iterable<PromptAny>] ? ReturnIterable<Arg>
    : [Arg] extends [Record<string, PromptAny>] ? ReturnObject<Arg>
    : never
}

/**
 * Runs all the provided prompts in sequence respecting the structure provided
 * in input.
 *
 * Supports either a tuple / iterable of prompts or a record / struct of prompts
 * as an argument.
 *
 * **Example**
 *
 * ```ts
 * import * as Prompt from "@effect/cli/Prompt"
 * import * as Effect from "effect/Effect"
 *
 * const username = Prompt.text({
 *   message: "Enter your username: "
 * })
 *
 * const password = Prompt.password({
 *   message: "Enter your password: ",
 *   validate: (value) =>
 *     value.length === 0
 *       ? Effect.fail("Password cannot be empty")
 *       : Effect.succeed(value)
 * })
 *
 * const allWithTuple = Prompt.all([username, password])
 *
 * const allWithRecord = Prompt.all({ username, password })
 * ```
 *
 * @since 4.0.0
 * @category collecting & elements
 */
export const all: <
  const Arg extends Iterable<Prompt<any>> | Record<string, Prompt<any>>
>(arg: Arg) => All.Return<Arg> = function() {
  if (arguments.length === 1) {
    if (isPrompt(arguments[0])) {
      return map(arguments[0], (x) => [x]) as any
    } else if (Array.isArray(arguments[0])) {
      return allTupled(arguments[0]) as any
    } else {
      const entries = Object.entries(arguments[0] as Readonly<{ [K: string]: Prompt<any> }>)
      let result = map(entries[0][1], (value) => ({ [entries[0][0]]: value }))
      if (entries.length === 1) {
        return result as any
      }
      const rest = entries.slice(1)
      for (const [key, prompt] of rest) {
        result = result.pipe(
          flatMap((record) =>
            prompt.pipe(map((value) => ({
              ...record,
              [key]: value
            })))
          )
        )
      }
      return result as any
    }
  }
  return allTupled(arguments[0]) as any
}

const annotateLine = (line: string): string => Ansi.annotate(line, Ansi.bold)
const annotateErrorLine = (line: string): string => Ansi.annotate(line, Ansi.combine(Ansi.italicized, Ansi.red))

/**
 * @since 4.0.0
 * @category constructors
 */
export const confirm = (options: Prompt.ConfirmOptions): Prompt<boolean> => {
  const opts: Required<Prompt.ConfirmOptions> = {
    initial: false,
    ...options,
    label: {
      confirm: "yes",
      deny: "no",
      ...options.label
    },
    placeholder: {
      defaultConfirm: "(Y/n)",
      defaultDeny: "(y/N)",
      ...options.placeholder
    }
  }
  const initialState: ConfirmState = { value: opts.initial }
  return custom(initialState, {
    render: handleConfirmRender(opts),
    process: (input) => handleConfirmProcess(input, opts.initial),
    clear: () => handleConfirmClear(opts)
  })
}

/**
 * Creates a custom `Prompt` from the specified initial state and handlers.
 *
 * The initial state can either be a pure value or an `Effect`. This is
 * particularly useful when the initial state of the `Prompt` must be computed
 * by performing some effectful computation, such as reading data from the file
 * system.
 *
 * A `Prompt` is essentially a render loop where user input triggers a new frame
 * to be rendered to the `Terminal`. The `handlers` of a custom prompt are used
 * to control what is rendered to the `Terminal` each frame. During each frame,
 * the following occurs:
 *
 *   1. The `render` handler is called with this frame's prompt state and prompt
 *      action and returns an ANSI escape string to be rendered to the
 *      `Terminal`
 *   2. The `Terminal` obtains input from the user
 *   3. The `process` handler is called with the input obtained from the user
 *      and this frame's prompt state and returns the next prompt action that
 *      should be performed
 *   4. The `clear` handler is called with this frame's prompt state and prompt
 *      action and returns an ANSI escape string used to clear the screen of
 *      the `Terminal`
 *
 * @since 4.0.0
 * @category constructors
 */
export const custom = <State, Output>(
  initialState: State | Effect.Effect<State, never, Prompt.Environment>,
  handlers: Prompt.Handlers<State, Output>
): Prompt<Output> => {
  const op = Object.create(proto)
  op._tag = "Loop"
  op.initialState = initialState
  op.render = handlers.render
  op.process = handlers.process
  op.clear = handlers.clear
  return op
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const date = (options: Prompt.DateOptions): Prompt<Date> => {
  const opts: Required<Prompt.DateOptions> = {
    initial: new Date(),
    dateMask: "YYYY-MM-DD HH:mm:ss",
    validate: Effect.succeed,
    ...options,
    locales: {
      ...defaultLocales,
      ...options.locales
    }
  }
  const dateParts = makeDateParts(opts.dateMask, opts.initial, opts.locales)
  const initialCursorPosition = dateParts.findIndex((part) => !part.isToken())
  const initialState: DateState = {
    dateParts,
    typed: "",
    cursor: initialCursorPosition,
    value: opts.initial,
    error: Option.none()
  }
  return custom(initialState, {
    render: handleDateRender(opts),
    process: handleDateProcess(opts),
    clear: handleDateClear(opts)
  })
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const file = (options: Prompt.FileOptions = {}): Prompt<string> => {
  const opts: FileOptions = {
    type: options.type ?? "file",
    message: options.message ?? `Choose a file`,
    startingPath: Option.fromNullishOr(options.startingPath),
    maxPerPage: options.maxPerPage ?? 10,
    filter: options.filter ?? (() => Effect.succeed(true))
  }
  const initialState: Effect.Effect<
    FileState,
    never,
    Prompt.Environment
  > = Effect.gen(function*() {
    const path = Option.none<string>()
    const currentPath = yield* resolveCurrentPath(path, opts)
    const files = yield* getFileList(currentPath, opts)
    const confirm = Confirm.Hide()
    return { cursor: 0, files, path, confirm }
  })
  return custom(initialState, {
    render: handleFileRender(opts),
    process: handleFileProcess(opts),
    clear: handleFileClear(opts)
  })
}

/**
 * @since 4.0.0
 * @category combinators
 */
export const flatMap = dual<
  <Output, Output2>(
    f: (output: Output) => Prompt<Output2>
  ) => (
    self: Prompt<Output>
  ) => Prompt<Output2>,
  <Output, Output2>(
    self: Prompt<Output>,
    f: (output: Output) => Prompt<Output2>
  ) => Prompt<Output2>
>(2, (self, f) => {
  const op = Object.create(proto)
  op._tag = "OnSuccess"
  op.prompt = self
  op.onSuccess = f
  return op
})

/**
 * @since 4.0.0
 * @category constructors
 */
export const float = (options: Prompt.FloatOptions): Prompt<number> => {
  const opts: FloatOptions = {
    min: Number.NEGATIVE_INFINITY,
    max: Number.POSITIVE_INFINITY,
    incrementBy: 1,
    decrementBy: 1,
    precision: 2,
    validate: (n) => {
      if (n < opts.min) {
        return Effect.fail(`${n} must be greater than or equal to ${opts.min}`)
      }
      if (n > opts.max) {
        return Effect.fail(`${n} must be less than or equal to ${opts.max}`)
      }
      return Effect.succeed(n)
    },
    ...options
  }
  const initialState: NumberState = {
    cursor: 0,
    value: "",
    error: Option.none()
  }
  return custom(initialState, {
    render: handleRenderFloat(opts),
    process: handleProcessFloat(opts),
    clear: handleNumberClear(opts)
  })
}
/**
 * @since 4.0.0
 * @category constructors
 */
export const hidden = (
  options: Prompt.TextOptions
): Prompt<Redacted.Redacted> => basePrompt(options, "hidden").pipe(map(Redacted.make))

/**
 * @since 4.0.0
 * @category constructors
 */
export const integer = (options: Prompt.IntegerOptions): Prompt<number> => {
  const opts: IntegerOptions = {
    min: Number.NEGATIVE_INFINITY,
    max: Number.POSITIVE_INFINITY,
    incrementBy: 1,
    decrementBy: 1,
    validate: (n) => {
      if (n < opts.min) {
        return Effect.fail(`${n} must be greater than or equal to ${opts.min}`)
      }
      if (n > opts.max) {
        return Effect.fail(`${n} must be less than or equal to ${opts.max}`)
      }
      return Effect.succeed(n)
    },
    ...options
  }
  const initialState: NumberState = {
    cursor: 0,
    value: "",
    error: Option.none()
  }
  return custom(initialState, {
    render: handleRenderInteger(opts),
    process: handleProcessInteger(opts),
    clear: handleNumberClear(opts)
  })
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const list = (options: Prompt.ListOptions): Prompt<Array<string>> =>
  text(options).pipe(
    map((output) => output.split(options.delimiter || ","))
  )

/**
 * @since 4.0.0
 * @category combinators
 */
export const map = dual<
  <Output, Output2>(
    f: (output: Output) => Output2
  ) => (
    self: Prompt<Output>
  ) => Prompt<Output2>,
  <Output, Output2>(
    self: Prompt<Output>,
    f: (output: Output) => Output2
  ) => Prompt<Output2>
>(2, (self, f) => flatMap(self, (a) => succeed(f(a))))

/**
 * @since 4.0.0
 * @category constructors
 */
export const password = (
  options: Prompt.TextOptions
): Prompt<Redacted.Redacted> => basePrompt(options, "password").pipe(map(Redacted.make))

/**
 * Executes the specified `Prompt`.
 *
 * @since 4.0.0
 * @category execution
 */
export const run: <Output>(
  self: Prompt<Output>
) => Effect.Effect<
  Output,
  Terminal.QuitException,
  Prompt.Environment
> = Effect.fnUntraced(
  function*<Output>(self: Prompt<Output>) {
    const terminal = yield* Terminal.Terminal
    const input = yield* terminal.readInput
    return yield* runWithInput(self, terminal, input)
  },
  Effect.mapError(() => new Terminal.QuitException()),
  Effect.scoped
)

/**
 * @since 4.0.0
 * @category constructors
 */
export const select = <const A>(options: Prompt.SelectOptions<A>): Prompt<A> => {
  const opts: SelectOptions<A> = {
    maxPerPage: 10,
    ...options
  }
  // Validate and seed initial index from any choice marked selected: true
  let initialIndex = 0
  let seenSelected = -1
  for (let i = 0; i < opts.choices.length; i++) {
    const choice = opts.choices[i] as Prompt.SelectChoice<A>
    if (choice.selected === true) {
      if (seenSelected !== -1) {
        throw new Error("InvalidArgumentException: only a single choice can be selected by default for Prompt.select")
      }
      seenSelected = i
    }
  }
  if (seenSelected !== -1) {
    initialIndex = seenSelected
  }
  return custom(initialIndex, {
    render: handleSelectRender(opts),
    process: handleSelectProcess(opts),
    clear: () => handleSelectClear(opts)
  })
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const multiSelect = <const A>(
  options: Prompt.SelectOptions<A> & Prompt.MultiSelectOptions
): Prompt<Array<A>> => {
  const opts: SelectOptions<A> & MultiSelectOptions = {
    maxPerPage: 10,
    ...options
  }
  // Seed initial selection from choices marked as selected: true
  const initialSelected = new Set<number>()
  for (let i = 0; i < opts.choices.length; i++) {
    const choice = opts.choices[i] as Prompt.SelectChoice<A>
    if (choice.selected === true) {
      initialSelected.add(i)
    }
  }
  return custom({ index: 0, selectedIndices: initialSelected, error: Option.none() }, {
    render: handleMultiSelectRender(opts),
    process: handleMultiSelectProcess(opts),
    clear: () => handleMultiSelectClear(opts)
  })
}

/**
 * Creates a `Prompt` which immediately succeeds with the specified value.
 *
 * **NOTE**: This method will not attempt to obtain user input or render
 * anything to the screen.
 *
 * @since 4.0.0
 * @category constructors
 */
export const succeed = <A>(value: A): Prompt<A> => {
  const op = Object.create(proto)
  op._tag = "Succeed"
  op.value = value
  return op
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const text = (
  options: Prompt.TextOptions
): Prompt<string> => basePrompt(options, "text")

/**
 * @since 4.0.0
 * @category constructors
 */
export const toggle = (options: Prompt.ToggleOptions): Prompt<boolean> => {
  const opts: ToggleOptions = {
    initial: false,
    active: "on",
    inactive: "off",
    ...options
  }
  return custom(opts.initial, {
    render: handleToggleRender(opts),
    process: handleToggleProcess,
    clear: () => handleToggleClear(opts)
  })
}

/** @internal */
const proto = {
  ...YieldableProto,
  [TypeId]: {
    _Output: (_: never) => _
  },
  commit(): Effect.Effect<Terminal.Terminal, Terminal.QuitException, unknown> {
    return run(this as any)
  },
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  }
}

/** @internal */
type Op<Tag extends string, Body = {}> = Prompt<never> & Body & {
  readonly _tag: Tag
}

/** @internal */
export type PromptPrimitive = Loop | OnSuccess | Succeed

/** @internal */
export interface Loop extends
  Op<"Loop", {
    readonly initialState: unknown | Effect.Effect<unknown, never, Prompt.Environment>
    readonly render: Prompt.Handlers<unknown, unknown>["render"]
    readonly process: Prompt.Handlers<unknown, unknown>["process"]
    readonly clear: Prompt.Handlers<unknown, unknown>["clear"]
  }>
{}

/** @internal */
export interface OnSuccess extends
  Op<"OnSuccess", {
    readonly prompt: PromptPrimitive
    readonly onSuccess: (value: unknown) => Prompt<unknown>
  }>
{}

/** @internal */
export interface Succeed extends
  Op<"Succeed", {
    readonly value: unknown
  }>
{}

/** @internal */
export const isPrompt = (u: unknown): u is Prompt<unknown> => typeof u === "object" && u != null && TypeId in u

const allTupled = <const T extends ArrayLike<Prompt<any>>>(arg: T): Prompt<
  {
    [K in keyof T]: [T[K]] extends [Prompt<infer A>] ? A : never
  }
> => {
  if (arg.length === 0) {
    return succeed([]) as any
  }
  if (arg.length === 1) {
    return map(arg[0], (x) => [x]) as any
  }
  let result = map(arg[0], (x) => [x])
  for (let i = 1; i < arg.length; i++) {
    const curr = arg[i]
    result = flatMap(result, (tuple) => map(curr, (a) => [...tuple, a]))
  }
  return result as any
}

const runWithInput = <Output>(
  prompt: Prompt<Output>,
  terminal: Terminal.Terminal,
  input: Queue.Dequeue<Terminal.UserInput>
): Effect.Effect<Output, NoSuchElementError, Prompt.Environment> =>
  Effect.suspend(() => {
    const op = prompt as PromptPrimitive
    switch (op._tag) {
      case "Loop": {
        return runLoop(op, terminal, input)
      }
      case "OnSuccess": {
        return Effect.flatMap(
          runWithInput(op.prompt, terminal, input),
          (a) => runWithInput(op.onSuccess(a), terminal, input)
        ) as any
      }
      case "Succeed": {
        return Effect.succeed(op.value)
      }
    }
  })

const runLoop = Effect.fnUntraced(
  function*(
    loop: Loop,
    terminal: Terminal.Terminal,
    input: Queue.Dequeue<Terminal.UserInput>
  ) {
    let state = Effect.isEffect(loop.initialState) ? yield* loop.initialState : loop.initialState
    let action: Prompt.Action<unknown, unknown> = Action.NextFrame({ state })
    while (true) {
      const msg = yield* loop.render(state, action)
      yield* Effect.orDie(terminal.display(msg))
      const event = yield* Queue.take(input)
      action = yield* loop.process(event, state)
      switch (action._tag) {
        case "Beep":
          continue
        case "NextFrame": {
          yield* Effect.orDie(terminal.display(yield* loop.clear(state, action)))
          state = action.state
          continue
        }
        case "Submit": {
          yield* Effect.orDie(terminal.display(yield* loop.clear(state, action)))
          const msg = yield* loop.render(state, action)
          yield* Effect.orDie(terminal.display(msg))
          return action.value
        }
      }
    }
  },
  (effect, _, terminal) => Effect.ensuring(effect, Effect.orDie(terminal.display(Ansi.cursorShow)))
)

/** @internal */
export const Action = Data.taggedEnum<Prompt.ActionDefinition>()

/**
 * Clears all lines taken up by the specified `text`.
 *
 * @internal
 */
export function eraseText(text: string, columns: number): string {
  if (columns === 0) {
    return Ansi.eraseLine + Ansi.cursorTo(0)
  }
  let rows = 0
  const lines = text.split(NEWLINE_REGEX)
  for (const line of lines) {
    rows += 1 + Math.floor(Math.max(line.length - 1, 0) / columns)
  }
  return Ansi.eraseLines(rows)
}

/** @internal */
export function lines(prompt: string, columns: number): number {
  const lines = prompt.split(NEWLINE_REGEX)
  return columns === 0
    ? lines.length
    : pipe(
      Arr.map(lines, (line) => Math.ceil(line.length / columns)),
      Arr.reduce(0, (left, right) => left + right)
    )
}

interface ConfirmOptions extends Required<Prompt.ConfirmOptions> {}

interface ConfirmState {
  readonly value: boolean
}

const renderBeep = Ansi.beep

function handleConfirmClear(options: ConfirmOptions) {
  return Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const columns = yield* terminal.columns
    const clearOutput = eraseText(options.message, columns)
    const resetCurrentLine = Ansi.eraseLine + Ansi.cursorLeft
    return clearOutput + resetCurrentLine
  })
}

const NEWLINE_REGEX = /\r?\n/

function renderConfirmOutput(
  confirm: string,
  leadingSymbol: string,
  trailingSymbol: string,
  options: ConfirmOptions
) {
  const prefix = leadingSymbol + " "
  return Arr.match(options.message.split(NEWLINE_REGEX), {
    onEmpty: () => prefix + " " + trailingSymbol + " " + confirm,
    onNonEmpty: (promptLines) => {
      const lines = Arr.map(promptLines, (line) => annotateLine(line))
      return prefix + lines.join("\n") + " " + trailingSymbol + " " + confirm
    }
  })
}

function renderConfirmNextFrame(state: ConfirmState, options: ConfirmOptions) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const leadingSymbol = Ansi.annotate("?", Ansi.cyanBright)
    const trailingSymbol = Ansi.annotate(figures.pointerSmall, Ansi.blackBright)
    // Marking these explicitly as present with `!` because they always will be
    // and there is really no value in adding a `DeepRequired` type helper just
    // for these internal cases
    const confirmMessage = state.value
      ? options.placeholder.defaultConfirm!
      : options.placeholder.defaultDeny!
    const confirm = Ansi.annotate(confirmMessage, Ansi.blackBright)
    const promptMsg = renderConfirmOutput(confirm, leadingSymbol, trailingSymbol, options)
    return Ansi.cursorHide + promptMsg
  })
}

function renderConfirmSubmission(value: boolean, options: ConfirmOptions) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const leadingSymbol = Ansi.annotate(figures.tick, Ansi.green)
    const trailingSymbol = Ansi.annotate(figures.ellipsis, Ansi.blackBright)
    const confirmMessage = value ? options.label.confirm : options.label.deny
    const promptMsg = renderConfirmOutput(confirmMessage, leadingSymbol, trailingSymbol, options)
    return promptMsg + "\n"
  })
}

function handleConfirmRender(options: ConfirmOptions) {
  return (_: ConfirmState, action: Prompt.Action<ConfirmState, boolean>) => {
    return Action.$match(action, {
      Beep: () => Effect.succeed(renderBeep),
      NextFrame: ({ state }) => renderConfirmNextFrame(state, options),
      Submit: ({ value }) => renderConfirmSubmission(value, options)
    })
  }
}

const TRUE_VALUE_REGEX = /^y|t$/
const FALSE_VALUE_REGEX = /^n|f$/

function handleConfirmProcess(input: Terminal.UserInput, defaultValue: boolean) {
  const value = Option.getOrElse(input.input, () => "")
  if (input.key.name === "enter" || input.key.name === "return") {
    return Effect.succeed(Action.Submit({ value: defaultValue }))
  }
  if (TRUE_VALUE_REGEX.test(value.toLowerCase())) {
    return Effect.succeed(Action.Submit({ value: true }))
  }
  if (FALSE_VALUE_REGEX.test(value.toLowerCase())) {
    return Effect.succeed(Action.Submit({ value: false }))
  }
  return Effect.succeed(Action.Beep())
}

interface DateOptions extends Required<Prompt.DateOptions> {}

interface DateState {
  readonly typed: string
  readonly cursor: number
  readonly value: globalThis.Date
  readonly dateParts: ReadonlyArray<DatePart>
  readonly error: Option.Option<string>
}

function handleDateClear(options: DateOptions) {
  return (state: DateState, _: Prompt.Action<DateState, globalThis.Date>) => {
    return Effect.gen(function*() {
      const terminal = yield* Terminal.Terminal
      const columns = yield* terminal.columns
      const resetCurrentLine = Ansi.eraseLine + Ansi.cursorLeft
      const clearError = Option.match(state.error, {
        onNone: () => "",
        onSome: (error) => Ansi.cursorDown(lines(error, columns)) + eraseText(`\n${error}`, columns)
      })
      const clearOutput = eraseText(options.message, columns)
      return clearError + clearOutput + resetCurrentLine
    })
  }
}

function renderDateError(state: DateState, pointer: string) {
  return Option.match(state.error, {
    onNone: () => "",
    onSome: (error) => {
      const errorLines = error.split(NEWLINE_REGEX)
      if (Arr.isReadonlyArrayNonEmpty(errorLines)) {
        const prefix = Ansi.annotate(pointer, Ansi.red) + " "
        const lines = Arr.map(errorLines, (str) => annotateErrorLine(str))
        return Ansi.cursorSavePosition + "\n" + prefix + lines.join("\n") + Ansi.cursorRestorePosition
      }
      return ""
    }
  })
}

function renderParts(state: DateState, submitted: boolean = false) {
  return Arr.reduce(
    state.dateParts,
    "",
    (doc, part, currentIndex) => {
      const partDoc = part.toString()
      if (currentIndex === state.cursor && !submitted) {
        const annotation = Ansi.combine(Ansi.underlined, Ansi.cyanBright)
        return doc + Ansi.annotate(partDoc, annotation)
      }
      return doc + partDoc
    }
  )
}

function renderDateOutput(
  leadingSymbol: string,
  trailingSymbol: string,
  parts: string,
  options: DateOptions
) {
  const prefix = leadingSymbol + " "
  return Arr.match(options.message.split(NEWLINE_REGEX), {
    onEmpty: () => prefix + " " + trailingSymbol + " " + parts,
    onNonEmpty: (promptLines) => {
      const lines = Arr.map(promptLines, (line) => annotateLine(line))
      return prefix + lines.join("\n") + " " + trailingSymbol + " " + parts
    }
  })
}

function renderDateNextFrame(state: DateState, options: DateOptions) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const leadingSymbol = Ansi.annotate("?", Ansi.cyanBright)
    const trailingSymbol = Ansi.annotate(figures.pointerSmall, Ansi.blackBright)
    const parts = renderParts(state)
    const promptMsg = renderDateOutput(leadingSymbol, trailingSymbol, parts, options)
    const errorMsg = renderDateError(state, figures.pointerSmall)
    return Ansi.cursorHide + promptMsg + errorMsg
  })
}

function renderDateSubmission(state: DateState, options: DateOptions) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const leadingSymbol = Ansi.annotate(figures.tick, Ansi.green)
    const trailingSymbol = Ansi.annotate(figures.ellipsis, Ansi.blackBright)
    const parts = renderParts(state, true)
    const promptMsg = renderDateOutput(leadingSymbol, trailingSymbol, parts, options)
    return promptMsg + "\n"
  })
}

function processUp(state: DateState) {
  state.dateParts[state.cursor].increment()
  return Action.NextFrame({
    state: { ...state, typed: "" }
  })
}

function processDown(state: DateState) {
  state.dateParts[state.cursor].decrement()
  return Action.NextFrame({
    state: { ...state, typed: "" }
  })
}

function processDateCursorLeft(state: DateState) {
  const previousPart = state.dateParts[state.cursor].previousPart()
  return Option.match(previousPart, {
    onNone: () => Action.Beep(),
    onSome: (previous) =>
      Action.NextFrame({
        state: {
          ...state,
          typed: "",
          cursor: state.dateParts.indexOf(previous)
        }
      })
  })
}

function processDateCursorRight(state: DateState) {
  const nextPart = state.dateParts[state.cursor].nextPart()
  return Option.match(nextPart, {
    onNone: () => Action.Beep(),
    onSome: (next) =>
      Action.NextFrame({
        state: {
          ...state,
          typed: "",
          cursor: state.dateParts.indexOf(next)
        }
      })
  })
}

function processDateNext(state: DateState) {
  const nextPart = state.dateParts[state.cursor].nextPart()
  const cursor = Option.match(nextPart, {
    onNone: () => state.dateParts.findIndex((part) => !part.isToken()),
    onSome: (next) => state.dateParts.indexOf(next)
  })
  return Action.NextFrame({
    state: { ...state, cursor }
  })
}

function defaultDateProcessor(value: string, state: DateState) {
  if (/\d/.test(value)) {
    const typed = state.typed + value
    state.dateParts[state.cursor].setValue(typed)
    return Action.NextFrame({
      state: { ...state, typed }
    })
  }
  return Action.Beep()
}

const defaultLocales: Prompt.DateOptions["locales"] = {
  months: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ],
  monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
}

function handleDateRender(options: DateOptions) {
  return (state: DateState, action: Prompt.Action<DateState, globalThis.Date>) => {
    return Action.$match(action, {
      Beep: () => Effect.succeed(renderBeep),
      NextFrame: ({ state }) => renderDateNextFrame(state, options),
      Submit: () => renderDateSubmission(state, options)
    })
  }
}

function handleDateProcess(options: DateOptions) {
  return (input: Terminal.UserInput, state: DateState) => {
    switch (input.key.name) {
      case "left": {
        return Effect.succeed(processDateCursorLeft(state))
      }
      case "right": {
        return Effect.succeed(processDateCursorRight(state))
      }
      case "k":
      case "up": {
        return Effect.succeed(processUp(state))
      }
      case "j":
      case "down": {
        return Effect.succeed(processDown(state))
      }
      case "tab": {
        return Effect.succeed(processDateNext(state))
      }
      case "enter":
      case "return": {
        return Effect.match(options.validate(state.value), {
          onFailure: (error) =>
            Action.NextFrame({
              state: {
                ...state,
                error: Option.some(error)
              }
            }),
          onSuccess: (value) => Action.Submit({ value })
        })
      }
      default: {
        const value = Option.getOrElse(input.input, () => "")
        return Effect.succeed(defaultDateProcessor(value, state))
      }
    }
  }
}

const DATE_PART_REGEX =
  /\\(.)|"((?:\\["\\]|[^"])+)"|(D[Do]?|d{3,4}|d)|(M{1,4})|(YY(?:YY)?)|([aA])|([Hh]{1,2})|(m{1,2})|(s{1,2})|(S{1,4})|./g

const regexGroups: Record<number, (params: DatePartParams) => DatePart> = {
  1: ({ token, ...opts }) => new Token({ token: token.replace(/\\(.)/g, "$1"), ...opts }),
  2: (opts) => new Day(opts),
  3: (opts) => new Month(opts),
  4: (opts) => new Year(opts),
  5: (opts) => new Meridiem(opts),
  6: (opts) => new Hours(opts),
  7: (opts) => new Minutes(opts),
  8: (opts) => new Seconds(opts),
  9: (opts) => new Milliseconds(opts)
}

const makeDateParts = (
  dateMask: string,
  date: globalThis.Date,
  locales: Prompt.DateOptions["locales"]
) => {
  const parts: Array<DatePart> = []
  let result: RegExpExecArray | null = null
  // eslint-disable-next-line no-cond-assign
  while (result = DATE_PART_REGEX.exec(dateMask)) {
    const match = result.shift()
    const index = result.findIndex((group) => group !== undefined)
    if (index in regexGroups) {
      const token = (result[index] || match)!
      parts.push(regexGroups[index]({ token, date, parts, locales }))
    } else {
      parts.push(new Token({ token: (result[index] || match)!, date, parts, locales }))
    }
  }
  const orderedParts = parts.reduce((array, element) => {
    const lastElement = array[array.length - 1]
    if (element.isToken() && lastElement !== undefined && lastElement.isToken()) {
      lastElement.setValue(element.token)
    } else {
      array.push(element)
    }
    return array
  }, Arr.empty<DatePart>())
  parts.splice(0, parts.length, ...orderedParts)
  return parts
}

interface DatePartParams {
  readonly token: string
  readonly locales: Prompt.DateOptions["locales"]
  readonly date?: globalThis.Date
  readonly parts?: ReadonlyArray<DatePart>
}

abstract class DatePart {
  token: string
  readonly date: globalThis.Date
  readonly parts: ReadonlyArray<DatePart>
  readonly locales: Prompt.DateOptions["locales"]

  constructor(params: DatePartParams) {
    this.token = params.token
    this.locales = params.locales
    this.date = params.date || new Date()
    this.parts = params.parts || [this]
  }

  /**
   * Increments this date part.
   */
  abstract increment(): void

  /**
   * Decrements this date part.
   */
  abstract decrement(): void

  /**
   * Sets the current value of this date part to the provided value.
   */
  abstract setValue(value: string): void

  /**
   * Returns `true` if this `DatePart` is a `Token`, `false` otherwise.
   */
  isToken(): this is Token {
    return false
  }

  /**
   * Retrieves the next date part in the list of parts.
   */
  nextPart(): Option.Option<DatePart> {
    return Option.some(Arr.findFirstIndex(this.parts, (part) => part === this)).pipe(
      Option.flatMap((currentPartIndex) =>
        Arr.findFirst(this.parts.slice((currentPartIndex || 0) + 1), (part) => !part.isToken())
      )
    )
  }

  /**
   * Retrieves the previous date part in the list of parts.
   */
  previousPart(): Option.Option<DatePart> {
    return Option.some(Arr.findFirstIndex(this.parts, (part) => part === this)).pipe(
      Option.flatMap((currentPartIndex) =>
        Arr.findLast(this.parts.slice(0, currentPartIndex), (part) => !part.isToken())
      )
    )
  }

  toString() {
    return String(this.date)
  }
}

class Token extends DatePart {
  increment(): void {}

  decrement(): void {}

  setValue(value: string): void {
    this.token = this.token + value
  }

  override isToken(): this is Token {
    return true
  }

  override toString() {
    return this.token
  }
}

class Milliseconds extends DatePart {
  increment(): void {
    this.date.setMilliseconds(this.date.getMilliseconds() + 1)
  }

  decrement(): void {
    this.date.setMilliseconds(this.date.getMilliseconds() - 1)
  }

  setValue(value: string): void {
    this.date.setMilliseconds(Number.parseInt(value.slice(-this.token.length)))
  }

  override toString() {
    const millis = `${this.date.getMilliseconds()}`
    return millis.padStart(4, "0").substring(0, this.token.length)
  }
}

class Seconds extends DatePart {
  increment(): void {
    this.date.setSeconds(this.date.getSeconds() + 1)
  }

  decrement(): void {
    this.date.setSeconds(this.date.getSeconds() - 1)
  }

  setValue(value: string): void {
    this.date.setSeconds(Number.parseInt(value.slice(-2)))
  }

  override toString() {
    const seconds = `${this.date.getSeconds()}`
    return this.token.length > 1
      ? seconds.padStart(2, "0")
      : seconds
  }
}

class Minutes extends DatePart {
  increment(): void {
    this.date.setMinutes(this.date.getMinutes() + 1)
  }

  decrement(): void {
    this.date.setMinutes(this.date.getMinutes() - 1)
  }

  setValue(value: string): void {
    this.date.setMinutes(Number.parseInt(value.slice(-2)))
  }

  override toString() {
    const minutes = `${this.date.getMinutes()}`
    return this.token.length > 1
      ? minutes.padStart(2, "0") :
      minutes
  }
}

class Hours extends DatePart {
  increment(): void {
    this.date.setHours(this.date.getHours() + 1)
  }

  decrement(): void {
    this.date.setHours(this.date.getHours() - 1)
  }

  setValue(value: string): void {
    this.date.setHours(Number.parseInt(value.slice(-2)))
  }

  override toString() {
    const hours = /h/.test(this.token)
      ? this.date.getHours() % 12 || 12
      : this.date.getHours()
    return this.token.length > 1
      ? `${hours}`.padStart(2, "0")
      : `${hours}`
  }
}

class Day extends DatePart {
  increment(): void {
    this.date.setDate(this.date.getDate() + 1)
  }

  decrement(): void {
    this.date.setDate(this.date.getDate() - 1)
  }

  setValue(value: string): void {
    this.date.setDate(Number.parseInt(value.slice(-2)))
  }

  override toString() {
    const date = this.date.getDate()
    const day = this.date.getDay()
    return Match.value(this.token).pipe(
      Match.when("DD", () => `${date}`.padStart(2, "0")),
      Match.when("Do", () => `${date}${this.ordinalIndicator(date)}`),
      Match.when("d", () => `${day + 1}`),
      Match.when("ddd", () => this.locales!.weekdaysShort[day]!),
      Match.when("dddd", () => this.locales!.weekdays[day]!),
      Match.orElse(() => `${date}`)
    )
  }

  private ordinalIndicator(day: number): string {
    return Match.value(day % 10).pipe(
      Match.when(1, () => "st"),
      Match.when(2, () => "nd"),
      Match.when(3, () => "rd"),
      Match.orElse(() => "th")
    )
  }
}

class Month extends DatePart {
  increment(): void {
    this.date.setMonth(this.date.getMonth() + 1)
  }

  decrement(): void {
    this.date.setMonth(this.date.getMonth() - 1)
  }

  setValue(value: string): void {
    const month = Number.parseInt(value.slice(-2)) - 1
    this.date.setMonth(month < 0 ? 0 : month)
  }

  override toString() {
    const month = this.date.getMonth()
    return Match.value(this.token.length).pipe(
      Match.when(2, () => `${month + 1}`.padStart(2, "0")),
      Match.when(3, () => this.locales!.monthsShort[month]!),
      Match.when(4, () => this.locales!.months[month]!),
      Match.orElse(() => `${month + 1}`)
    )
  }
}

class Year extends DatePart {
  increment(): void {
    this.date.setFullYear(this.date.getFullYear() + 1)
  }

  decrement(): void {
    this.date.setFullYear(this.date.getFullYear() - 1)
  }

  setValue(value: string): void {
    this.date.setFullYear(Number.parseInt(value.slice(-4)))
  }

  override toString() {
    const year = `${this.date.getFullYear()}`.padStart(4, "0")
    return this.token.length === 2
      ? year.substring(-2)
      : year
  }
}

class Meridiem extends DatePart {
  increment(): void {
    this.date.setHours((this.date.getHours() + 12) % 24)
  }

  decrement(): void {
    this.increment()
  }

  setValue(_value: string): void {}

  override toString() {
    const meridiem = this.date.getHours() > 12 ? "pm" : "am"
    return /A/.test(this.token)
      ? meridiem.toUpperCase()
      : meridiem
  }
}

interface FileOptions extends Required<Omit<Prompt.FileOptions, "startingPath">> {
  readonly startingPath: Option.Option<string>
}

interface FileState {
  readonly cursor: number
  readonly files: ReadonlyArray<string>
  readonly path: Option.Option<string>
  readonly confirm: Confirm
}

const CONFIRM_MESSAGE = "The selected directory contains files. Would you like to traverse the selected directory?"
type Confirm = Data.TaggedEnum<{
  readonly Show: {}
  readonly Hide: {}
}>
const Confirm = Data.taggedEnum<Confirm>()

const showConfirmation = Confirm.$is("Show")

function resolveCurrentPath(
  path: Option.Option<string>,
  options: FileOptions
): Effect.Effect<string, never, FileSystem.FileSystem> {
  return Option.match(path, {
    onNone: () =>
      Option.match(options.startingPath, {
        onNone: () => Effect.sync(() => process.cwd()),
        onSome: (path) =>
          Effect.flatMap(FileSystem.FileSystem, (fs) =>
            // Ensure the user provided starting path exists
            Effect.orDie(fs.exists(path)).pipe(
              Effect.filterOrDieMessage(
                identity,
                `The provided starting path '${path}' does not exist`
              ),
              Effect.as(path)
            ))
      }),
    onSome: (path) => Effect.succeed(path)
  })
}

function getFileList(directory: string, options: FileOptions) {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const files = yield* Effect.orDie(fs.readDirectory(directory)).pipe(
      // Always prepend the `".."` option to the file list but allow it
      // to be filtered out if the user so desires
      Effect.map((files) => ["..", ...files])
    )
    return yield* Effect.filter(files, (file) => {
      const result = options.filter(file)
      const userDefinedFilter = Effect.isEffect(result)
        ? result
        : Effect.succeed(result)
      const directoryFilter = options.type === "directory"
        ? Effect.map(
          Effect.orDie(fs.stat(path.join(directory, file))),
          (info) => info.type === "Directory"
        )
        : Effect.succeed(true)
      return Effect.zipWith(userDefinedFilter, directoryFilter, (a, b) => a && b)
    }, { concurrency: files.length })
  })
}

function handleFileClear(options: FileOptions) {
  return (state: FileState, _: Prompt.Action<FileState, string>) => {
    return Effect.gen(function*() {
      const terminal = yield* Terminal.Terminal
      const columns = yield* terminal.columns
      const currentPath = yield* resolveCurrentPath(state.path, options)
      const text = "\n".repeat(Math.min(state.files.length, options.maxPerPage))
      const clearPath = eraseText(currentPath, columns)
      const message = showConfirmation(state.confirm) ? CONFIRM_MESSAGE : options.message
      const clearPrompt = eraseText(`\n${message}`, columns)
      const clearOptions = eraseText(text, columns)
      return clearOptions + clearPath + clearPrompt
    })
  }
}

function renderPrompt(
  confirm: string,
  message: string,
  leadingSymbol: string,
  trailingSymbol: string
) {
  const prefix = leadingSymbol + " "
  return Arr.match(message.split(NEWLINE_REGEX), {
    onEmpty: () => prefix + " " + trailingSymbol + " " + confirm,
    onNonEmpty: (promptLines) => {
      const lines = Arr.map(promptLines, (line) => annotateLine(line))
      return prefix + lines.join("\n") + " " + trailingSymbol + " " + confirm
    }
  })
}

function renderPrefix(
  state: FileState,
  toDisplay: { readonly startIndex: number; readonly endIndex: number },
  currentIndex: number,
  length: number,
  figures: Effect.Success<typeof platformFigures>
) {
  let prefix = " "
  if (currentIndex === toDisplay.startIndex && toDisplay.startIndex > 0) {
    prefix = figures.arrowUp
  } else if (currentIndex === toDisplay.endIndex - 1 && toDisplay.endIndex < length) {
    prefix = figures.arrowDown
  }
  return state.cursor === currentIndex
    ? Ansi.annotate(figures.pointer, Ansi.cyanBright) + prefix
    : prefix + " "
}

function renderFileName(file: string, isSelected: boolean) {
  return isSelected
    ? Ansi.annotate(file, Ansi.combine(Ansi.underlined, Ansi.cyanBright))
    : file
}

function renderFiles(
  state: FileState,
  files: ReadonlyArray<string>,
  figures: Effect.Success<typeof platformFigures>,
  options: FileOptions
) {
  const length = files.length
  const toDisplay = entriesToDisplay(state.cursor, length, options.maxPerPage)
  const documents: Array<string> = []
  for (let index = toDisplay.startIndex; index < toDisplay.endIndex; index++) {
    const isSelected = state.cursor === index
    const prefix = renderPrefix(state, toDisplay, index, length, figures)
    const fileName = renderFileName(files[index], isSelected)
    documents.push(prefix + fileName)
  }
  return documents.join("\n")
}

function renderFileNextFrame(state: FileState, options: FileOptions) {
  return Effect.gen(function*() {
    const path = yield* Path.Path
    const figures = yield* platformFigures
    const currentPath = yield* resolveCurrentPath(state.path, options)
    const selectedPath = state.files[state.cursor]
    const resolvedPath = path.resolve(currentPath, selectedPath)
    const resolvedPathMsg = Ansi.annotate(figures.pointerSmall + " " + resolvedPath, Ansi.blackBright)

    if (showConfirmation(state.confirm)) {
      const leadingSymbol = Ansi.annotate("?", Ansi.cyanBright)
      const trailingSymbol = Ansi.annotate(figures.pointerSmall, Ansi.blackBright)
      const confirm = Ansi.annotate("(Y/n)", Ansi.blackBright)
      const promptMsg = renderPrompt(confirm, CONFIRM_MESSAGE, leadingSymbol, trailingSymbol)
      return Ansi.cursorHide + promptMsg + "\n" + resolvedPathMsg
    }
    const leadingSymbol = Ansi.annotate(figures.tick, Ansi.green)
    const trailingSymbol = Ansi.annotate(figures.ellipsis, Ansi.blackBright)
    const promptMsg = renderPrompt("", options.message, leadingSymbol, trailingSymbol)
    const files = renderFiles(state, state.files, figures, options)
    return Ansi.cursorHide + promptMsg + "\n" + resolvedPathMsg + "\n" + files
  })
}

function renderFileSubmission(value: string, options: FileOptions) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const leadingSymbol = Ansi.annotate(figures.tick, Ansi.green)
    const trailingSymbol = Ansi.annotate(figures.ellipsis, Ansi.blackBright)
    const promptMsg = renderPrompt("", options.message, leadingSymbol, trailingSymbol)
    return promptMsg + " " + Ansi.annotate(value, Ansi.white) + "\n"
  })
}

function handleFileRender(options: FileOptions) {
  return (_: FileState, action: Prompt.Action<FileState, string>) => {
    return Action.$match(action, {
      Beep: () => Effect.succeed(renderBeep),
      NextFrame: ({ state }) => renderFileNextFrame(state, options),
      Submit: ({ value }) => renderFileSubmission(value, options)
    })
  }
}

function processFileCursorUp(state: FileState) {
  const cursor = state.cursor - 1
  return Effect.succeed(Action.NextFrame({
    state: { ...state, cursor: cursor < 0 ? state.files.length - 1 : cursor }
  }))
}

function processFileCursorDown(state: FileState) {
  return Effect.succeed(Action.NextFrame({
    state: { ...state, cursor: (state.cursor + 1) % state.files.length }
  }))
}

function processSelection(state: FileState, options: FileOptions) {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const currentPath = yield* resolveCurrentPath(state.path, options)
    const selectedPath = state.files[state.cursor]
    const resolvedPath = path.resolve(currentPath, selectedPath)
    const info = yield* Effect.orDie(fs.stat(resolvedPath))
    if (info.type === "Directory") {
      const files = yield* getFileList(resolvedPath, options)
      const filesWithoutParent = files.filter((file) => file !== "..")
      // If the user selected a directory AND the prompt type can result with
      // a directory, we must confirm:
      //  - If the selected directory has any files
      //  - Confirm whether or not the user wants to traverse those files
      if (options.type === "directory" || options.type === "either") {
        return filesWithoutParent.length === 0
          // Directory is empty so it's safe to select it
          ? Action.Submit({ value: resolvedPath })
          // Directory has contents - show confirmation to user
          : Action.NextFrame({
            state: { ...state, confirm: Confirm.Show() }
          })
      }
      return Action.NextFrame({
        state: {
          cursor: 0,
          files,
          path: Option.some(resolvedPath),
          confirm: Confirm.Hide()
        }
      })
    }
    return Action.Submit({ value: resolvedPath })
  })
}

function handleFileProcess(options: FileOptions) {
  return (input: Terminal.UserInput, state: FileState) =>
    Effect.gen(function*() {
      switch (input.key.name) {
        case "k":
        case "up": {
          return yield* processFileCursorUp(state)
        }
        case "j":
        case "down":
        case "tab": {
          return yield* processFileCursorDown(state)
        }
        case "enter":
        case "return": {
          return yield* processSelection(state, options)
        }
        case "y":
        case "t": {
          if (showConfirmation(state.confirm)) {
            const path = yield* Path.Path
            const currentPath = yield* resolveCurrentPath(state.path, options)
            const selectedPath = state.files[state.cursor]
            const resolvedPath = path.resolve(currentPath, selectedPath)
            const files = yield* getFileList(resolvedPath, options)
            return Action.NextFrame({
              state: {
                cursor: 0,
                files,
                path: Option.some(resolvedPath),
                confirm: Confirm.Hide()
              }
            })
          }
          return Action.Beep()
        }
        case "n":
        case "f": {
          if (showConfirmation(state.confirm)) {
            const path = yield* Path.Path
            const currentPath = yield* resolveCurrentPath(state.path, options)
            const selectedPath = state.files[state.cursor]
            const resolvedPath = path.resolve(currentPath, selectedPath)
            return Action.Submit({ value: resolvedPath })
          }
          return Action.Beep()
        }
        default: {
          return Action.Beep()
        }
      }
    })
}

interface SelectOptions<A> extends Required<Prompt.SelectOptions<A>> {}
interface MultiSelectOptions extends Prompt.MultiSelectOptions {}

type MultiSelectState = {
  index: number
  selectedIndices: Set<number>
  error: Option.Option<string>
}

function renderMultiSelectError(state: MultiSelectState, pointer: string) {
  return Option.match(state.error, {
    onNone: () => "",
    onSome: (error) =>
      Arr.match(error.split(NEWLINE_REGEX), {
        onEmpty: () => "",
        onNonEmpty: (errorLines) => {
          const prefix = Ansi.annotate(pointer, Ansi.red) + " "
          const lines = Arr.map(errorLines, (str) => annotateErrorLine(str))
          return Ansi.cursorSavePosition + "\n" + prefix + lines.join("\n") + Ansi.cursorRestorePosition
        }
      })
  })
}

function renderChoiceDescription<A>(
  choice: Prompt.SelectChoice<A>,
  isActive: boolean
) {
  if (!choice.disabled && choice.description && isActive) {
    return Ansi.annotate("-" + " " + choice.description, Ansi.blackBright)
  }
  return ""
}

const metaOptionsCount = 2

function renderMultiSelectChoices<A>(
  state: MultiSelectState,
  options: SelectOptions<A> & MultiSelectOptions,
  figures: Effect.Success<typeof platformFigures>
) {
  const choices = options.choices
  const totalChoices = choices.length
  const selectedCount = state.selectedIndices.size
  const allSelected = selectedCount === totalChoices

  const selectAllText = allSelected
    ? options?.selectNone ?? "Select None"
    : options?.selectAll ?? "Select All"

  const inverseSelectionText = options?.inverseSelection ?? "Inverse Selection"

  const metaOptions = [
    { title: selectAllText },
    { title: inverseSelectionText }
  ]
  const allChoices = [...metaOptions, ...choices]
  const toDisplay = entriesToDisplay(state.index, allChoices.length, options.maxPerPage)
  const documents: Array<string> = []
  for (let index = toDisplay.startIndex; index < toDisplay.endIndex; index++) {
    const choice = allChoices[index]
    const isHighlighted = state.index === index
    let prefix = " "
    if (index === toDisplay.startIndex && toDisplay.startIndex > 0) {
      prefix = figures.arrowUp
    } else if (index === toDisplay.endIndex - 1 && toDisplay.endIndex < allChoices.length) {
      prefix = figures.arrowDown
    }
    if (index < metaOptions.length) {
      // Meta options
      const title = isHighlighted
        ? Ansi.annotate(choice.title, Ansi.cyanBright)
        : choice.title
      documents.push(prefix + " " + title)
    } else {
      // Regular choices
      const choiceIndex = index - metaOptions.length
      const isSelected = state.selectedIndices.has(choiceIndex)
      const checkbox = isSelected ? figures.checkboxOn : figures.checkboxOff
      const annotatedCheckbox = isHighlighted
        ? Ansi.annotate(checkbox, Ansi.cyanBright)
        : checkbox
      const title = choice.title
      const description = renderChoiceDescription(choice as Prompt.SelectChoice<A>, isHighlighted)
      documents.push(prefix + " " + annotatedCheckbox + " " + title + " " + description)
    }
  }
  return documents.join("\n")
}

function renderMultiSelectNextFrame<A>(state: MultiSelectState, options: SelectOptions<A>) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const choices = renderMultiSelectChoices(state, options, figures)
    const leadingSymbol = Ansi.annotate("?", Ansi.cyanBright)
    const trailingSymbol = Ansi.annotate(figures.pointerSmall, Ansi.blackBright)
    const promptMsg = renderSelectOutput(leadingSymbol, trailingSymbol, options)
    const error = renderMultiSelectError(state, figures.pointer)
    return Ansi.cursorHide + promptMsg + "\n" + choices + error
  })
}

function renderMultiSelectSubmission<A>(state: MultiSelectState, options: SelectOptions<A>) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const selectedChoices = Array.from(state.selectedIndices).sort(EffectNumber.Order).map((index) =>
      options.choices[index].title
    )
    const selectedText = selectedChoices.join(", ")
    const leadingSymbol = Ansi.annotate(figures.tick, Ansi.green)
    const trailingSymbol = Ansi.annotate(figures.ellipsis, Ansi.blackBright)
    const promptMsg = renderSelectOutput(leadingSymbol, trailingSymbol, options)
    return promptMsg + " " + Ansi.annotate(selectedText, Ansi.white) + "\n"
  })
}

function processMultiSelectCursorUp(state: MultiSelectState, totalChoices: number) {
  const newIndex = state.index === 0 ? totalChoices - 1 : state.index - 1
  return Effect.succeed(Action.NextFrame({ state: { ...state, index: newIndex } }))
}

function processMultiSelectCursorDown(state: MultiSelectState, totalChoices: number) {
  const newIndex = (state.index + 1) % totalChoices
  return Effect.succeed(Action.NextFrame({ state: { ...state, index: newIndex } }))
}

function processSpace<A>(
  state: MultiSelectState,
  options: SelectOptions<A>
) {
  const selectedIndices = new Set(state.selectedIndices)
  if (state.index === 0) {
    if (state.selectedIndices.size === options.choices.length) {
      selectedIndices.clear()
    } else {
      for (let i = 0; i < options.choices.length; i++) {
        selectedIndices.add(i)
      }
    }
  } else if (state.index === 1) {
    for (let i = 0; i < options.choices.length; i++) {
      if (state.selectedIndices.has(i)) {
        selectedIndices.delete(i)
      } else {
        selectedIndices.add(i)
      }
    }
  } else {
    const choiceIndex = state.index - metaOptionsCount
    if (selectedIndices.has(choiceIndex)) {
      selectedIndices.delete(choiceIndex)
    } else {
      selectedIndices.add(choiceIndex)
    }
  }
  return Effect.succeed(Action.NextFrame({ state: { ...state, selectedIndices } }))
}

export function handleMultiSelectClear<A>(options: SelectOptions<A>) {
  return Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const columns = yield* terminal.columns
    const clearPrompt = Ansi.eraseLine + Ansi.cursorLeft
    const text = "\n".repeat(Math.min(options.choices.length + 2, options.maxPerPage)) + options.message + 1
    const clearOutput = eraseText(text, columns)
    return clearOutput + clearPrompt
  })
}

function handleMultiSelectProcess<A>(options: SelectOptions<A> & MultiSelectOptions) {
  return (input: Terminal.UserInput, state: MultiSelectState) => {
    const totalChoices = options.choices.length + metaOptionsCount
    switch (input.key.name) {
      case "k":
      case "up": {
        return processMultiSelectCursorUp({ ...state, error: Option.none() }, totalChoices)
      }
      case "j":
      case "down":
      case "tab": {
        return processMultiSelectCursorDown({ ...state, error: Option.none() }, totalChoices)
      }
      case "space": {
        return processSpace(state, options)
      }
      case "enter":
      case "return": {
        const selectedCount = state.selectedIndices.size
        if (options.min !== undefined && selectedCount < options.min) {
          return Effect.succeed(
            Action.NextFrame({ state: { ...state, error: Option.some(`At least ${options.min} are required`) } })
          )
        }
        if (options.max !== undefined && selectedCount > options.max) {
          return Effect.succeed(
            Action.NextFrame({ state: { ...state, error: Option.some(`At most ${options.max} choices are allowed`) } })
          )
        }
        const selectedValues = Array.from(state.selectedIndices).sort(EffectNumber.Order).map((index) =>
          options.choices[index].value
        )
        return Effect.succeed(Action.Submit({ value: selectedValues }))
      }
      default: {
        return Effect.succeed(Action.Beep())
      }
    }
  }
}

function handleMultiSelectRender<A>(options: SelectOptions<A>) {
  return (state: MultiSelectState, action: Prompt.Action<MultiSelectState, Array<A>>) => {
    return Action.$match(action, {
      Beep: () => Effect.succeed(renderBeep),
      NextFrame: ({ state }) => renderMultiSelectNextFrame(state, options),
      Submit: () => renderMultiSelectSubmission(state, options)
    })
  }
}

interface IntegerOptions extends Required<Prompt.IntegerOptions> {}
interface FloatOptions extends Required<Prompt.FloatOptions> {}

interface NumberState {
  readonly cursor: number
  readonly value: string
  readonly error: Option.Option<string>
}

function handleNumberClear(options: IntegerOptions) {
  return (state: NumberState, _: Prompt.Action<NumberState, number>) => {
    return Effect.gen(function*() {
      const terminal = yield* Terminal.Terminal
      const columns = yield* terminal.columns
      const resetCurrentLine = Ansi.eraseLine + Ansi.cursorLeft
      const clearError = Option.match(state.error, {
        onNone: () => "",
        onSome: (error) => Ansi.cursorDown(lines(error, columns)) + eraseText(`\n${error}`, columns)
      })
      const clearOutput = eraseText(options.message, columns)
      return clearError + clearOutput + resetCurrentLine
    })
  }
}

function renderNumberInput(state: NumberState, submitted: boolean) {
  const annotation = Option.match(state.error, {
    onNone: () => Ansi.combine(Ansi.underlined, Ansi.cyanBright),
    onSome: () => Ansi.red
  })
  const value = state.value === "" ? "" : `${state.value}`
  return submitted ? value : Ansi.annotate(value, annotation)
}

function renderNumberError(state: NumberState, pointer: string) {
  return Option.match(state.error, {
    onNone: () => "",
    onSome: (error) =>
      Arr.match(error.split(NEWLINE_REGEX), {
        onEmpty: () => "",
        onNonEmpty: (errorLines) => {
          const prefix = Ansi.annotate(pointer, Ansi.red) + " "
          const lines = Arr.map(errorLines, (str) => annotateErrorLine(str))
          return Ansi.cursorSavePosition + "\n" + prefix + lines.join("\n") + Ansi.cursorRestorePosition
        }
      })
  })
}

function renderNumberOutput(
  state: NumberState,
  leadingSymbol: string,
  trailingSymbol: string,
  options: IntegerOptions,
  submitted: boolean = false
) {
  const prefix = leadingSymbol + " "
  return Arr.match(options.message.split(NEWLINE_REGEX), {
    onEmpty: () => prefix + " " + trailingSymbol + " " + renderNumberInput(state, submitted),
    onNonEmpty: (promptLines) => {
      const lines = Arr.map(promptLines, (line) => annotateLine(line))
      return prefix + lines.join("\n") + " " + trailingSymbol + " " + renderNumberInput(state, submitted)
    }
  })
}

function renderNumberNextFrame(state: NumberState, options: IntegerOptions) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const leadingSymbol = Ansi.annotate("?", Ansi.cyanBright)
    const trailingSymbol = Ansi.annotate(figures.pointerSmall, Ansi.blackBright)
    const errorMsg = renderNumberError(state, figures.pointerSmall)
    const promptMsg = renderNumberOutput(state, leadingSymbol, trailingSymbol, options)
    return promptMsg + errorMsg
  })
}

function renderNumberSubmission(nextState: NumberState, options: IntegerOptions) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const leadingSymbol = Ansi.annotate(figures.tick, Ansi.green)
    const trailingSymbol = Ansi.annotate(figures.ellipsis, Ansi.blackBright)
    const promptMsg = renderNumberOutput(nextState, leadingSymbol, trailingSymbol, options, true)
    return promptMsg + "\n"
  })
}

function processNumberBackspace(state: NumberState) {
  if (state.value.length <= 0) {
    return Effect.succeed(Action.Beep())
  }
  const value = state.value.slice(0, state.value.length - 1)
  return Effect.succeed(Action.NextFrame({
    state: { ...state, value, error: Option.none() }
  }))
}

function defaultIntProcessor(state: NumberState, input: string) {
  if (state.value.length === 0 && input === "-") {
    return Effect.succeed(Action.NextFrame({
      state: { ...state, value: "-", error: Option.none() }
    }))
  }

  const parsed = Number.parseInt(state.value + input)
  if (Number.isNaN(parsed)) {
    return Action.Beep()
  } else {
    return Action.NextFrame({
      state: { ...state, value: `${parsed}`, error: Option.none() }
    })
  }
}

function defaultFloatProcessor(
  state: NumberState,
  input: string
) {
  if (input === "." && state.value.includes(".")) {
    return Effect.succeed(Action.Beep())
  }
  if (state.value.length === 0 && input === "-") {
    return Effect.succeed(Action.NextFrame({
      state: { ...state, value: "-", error: Option.none() }
    }))
  }

  const parsed = Number.parseFloat(state.value + input)
  if (Number.isNaN(parsed)) {
    return Action.Beep()
  } else {
    return Action.NextFrame({
      state: {
        ...state,
        value: input === "." ? `${parsed}.` : `parsed`,
        error: Option.none()
      }
    })
  }
}

function handleRenderInteger(options: IntegerOptions) {
  return (state: NumberState, action: Prompt.Action<NumberState, number>) => {
    return Action.$match(action, {
      Beep: () => Effect.succeed(renderBeep),
      NextFrame: ({ state }) => renderNumberNextFrame(state, options),
      Submit: () => renderNumberSubmission(state, options)
    })
  }
}

function handleProcessInteger(options: IntegerOptions) {
  return (input: Terminal.UserInput, state: NumberState) => {
    switch (input.key.name) {
      case "backspace": {
        return processNumberBackspace(state)
      }
      case "k":
      case "up": {
        return Effect.succeed(Action.NextFrame({
          state: {
            ...state,
            value: state.value === "" || state.value === "-"
              ? `${options.incrementBy}`
              : `${Number.parseInt(state.value) + options.incrementBy}`,
            error: Option.none()
          }
        }))
      }
      case "j":
      case "down": {
        return Effect.succeed(Action.NextFrame({
          state: {
            ...state,
            value: state.value === "" || state.value === "-"
              ? `-${options.decrementBy}`
              : `${Number.parseInt(state.value) - options.decrementBy}`,
            error: Option.none()
          }
        }))
      }
      case "enter":
      case "return": {
        const parsed = Number.parseInt(state.value)
        if (Number.isNaN(parsed)) {
          return Effect.succeed(Action.NextFrame({
            state: {
              ...state,
              error: Option.some("Must provide an integer value")
            }
          }))
        } else {
          return Effect.match(options.validate(parsed), {
            onFailure: (error) =>
              Action.NextFrame({
                state: {
                  ...state,
                  error: Option.some(error)
                }
              }),
            onSuccess: (value) => Action.Submit({ value })
          })
        }
      }
      default: {
        const value = Option.getOrElse(input.input, () => "")
        return defaultIntProcessor(state, value)
      }
    }
  }
}

function handleRenderFloat(options: FloatOptions) {
  return (state: NumberState, action: Prompt.Action<NumberState, number>) => {
    return Action.$match(action, {
      Beep: () => Effect.succeed(renderBeep),
      NextFrame: ({ state }) => renderNumberNextFrame(state, options),
      Submit: () => renderNumberSubmission(state, options)
    })
  }
}

function handleProcessFloat(options: FloatOptions) {
  return (input: Terminal.UserInput, state: NumberState) => {
    switch (input.key.name) {
      case "backspace": {
        return processNumberBackspace(state)
      }
      case "k":
      case "up": {
        return Effect.succeed(Action.NextFrame({
          state: {
            ...state,
            value: state.value === "" || state.value === "-"
              ? `${options.incrementBy}`
              : `${Number.parseFloat(state.value) + options.incrementBy}`,
            error: Option.none()
          }
        }))
      }
      case "j":
      case "down": {
        return Effect.succeed(Action.NextFrame({
          state: {
            ...state,
            value: state.value === "" || state.value === "-"
              ? `-${options.decrementBy}`
              : `${Number.parseFloat(state.value) - options.decrementBy}`,
            error: Option.none()
          }
        }))
      }
      case "enter":
      case "return": {
        const parsed = Number.parseFloat(state.value)
        if (Number.isNaN(parsed)) {
          return Effect.succeed(Action.NextFrame({
            state: {
              ...state,
              error: Option.some("Must provide a floating point value")
            }
          }))
        } else {
          return Effect.flatMap(
            Effect.sync(() => EffectNumber.round(parsed, options.precision)),
            (rounded) =>
              Effect.match(options.validate(rounded), {
                onFailure: (error) =>
                  Action.NextFrame({
                    state: {
                      ...state,
                      error: Option.some(error)
                    }
                  }),
                onSuccess: (value) => Action.Submit({ value })
              })
          )
        }
      }
      default: {
        const value = Option.getOrElse(input.input, () => "")
        return defaultFloatProcessor(state, value)
      }
    }
  }
}

type SelectState = number

interface SelectOptions<A> extends Required<Prompt.SelectOptions<A>> {}

function renderSelectOutput<A>(
  leadingSymbol: string,
  trailingSymbol: string,
  options: SelectOptions<A>
) {
  const prefix = leadingSymbol + " "
  return Arr.match(options.message.split(NEWLINE_REGEX), {
    onEmpty: () => prefix + " " + trailingSymbol,
    onNonEmpty: (promptLines) => {
      const lines = Arr.map(promptLines, (line) => annotateLine(line))
      return prefix + lines.join("\n") + " " + trailingSymbol + " "
    }
  })
}

function renderChoicePrefix<A>(
  state: SelectState,
  choices: SelectOptions<A>["choices"],
  toDisplay: { readonly startIndex: number; readonly endIndex: number },
  currentIndex: number,
  figures: Effect.Success<typeof platformFigures>
) {
  let prefix = " "
  if (currentIndex === toDisplay.startIndex && toDisplay.startIndex > 0) {
    prefix = figures.arrowUp
  } else if (currentIndex === toDisplay.endIndex - 1 && toDisplay.endIndex < choices.length) {
    prefix = figures.arrowDown
  }
  if (choices[currentIndex].disabled) {
    const annotation = Ansi.combine(Ansi.bold, Ansi.blackBright)
    return state === currentIndex
      ? Ansi.annotate(figures.pointer, annotation) + prefix
      : prefix + " "
  }
  return state === currentIndex
    ? Ansi.annotate(figures.pointer, Ansi.cyanBright) + prefix
    : prefix + " "
}

function renderChoiceTitle<A>(
  choice: Prompt.SelectChoice<A>,
  isSelected: boolean
) {
  const title = choice.title
  if (isSelected) {
    return choice.disabled
      ? Ansi.annotate(title, Ansi.combine(Ansi.underlined, Ansi.blackBright))
      : Ansi.annotate(title, Ansi.combine(Ansi.underlined, Ansi.cyanBright))
  }
  return choice.disabled
    ? Ansi.annotate(title, Ansi.combine(Ansi.strikethrough, Ansi.blackBright))
    : title
}

function renderSelectChoices<A>(
  state: SelectState,
  options: SelectOptions<A>,
  figures: Effect.Success<typeof platformFigures>
) {
  const choices = options.choices
  const toDisplay = entriesToDisplay(state, choices.length, options.maxPerPage)
  const documents: Array<string> = []
  for (let index = toDisplay.startIndex; index < toDisplay.endIndex; index++) {
    const choice = choices[index]
    const isSelected = state === index
    const prefix = renderChoicePrefix(state, choices, toDisplay, index, figures)
    const title = renderChoiceTitle(choice, isSelected)
    const description = renderChoiceDescription(choice, isSelected)
    documents.push(prefix + title + " " + description)
  }
  return documents.join("\n")
}

function renderSelectNextFrame<A>(state: SelectState, options: SelectOptions<A>) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const choices = renderSelectChoices(state, options, figures)
    const leadingSymbol = Ansi.annotate("?", Ansi.cyanBright)
    const trailingSymbol = Ansi.annotate(figures.pointerSmall, Ansi.blackBright)
    const promptMsg = renderSelectOutput(leadingSymbol, trailingSymbol, options)
    return Ansi.cursorHide + promptMsg + "\n" + choices
  })
}

function renderSelectSubmission<A>(state: SelectState, options: SelectOptions<A>) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const selected = options.choices[state].title
    const leadingSymbol = Ansi.annotate(figures.tick, Ansi.green)
    const trailingSymbol = Ansi.annotate(figures.ellipsis, Ansi.blackBright)
    const promptMsg = renderSelectOutput(leadingSymbol, trailingSymbol, options)
    return promptMsg + " " + Ansi.annotate(selected, Ansi.white) + "\n"
  })
}

function processSelectCursorUp<A>(state: SelectState, choices: Prompt.SelectOptions<A>["choices"]) {
  if (state === 0) {
    return Effect.succeed(Action.NextFrame({ state: choices.length - 1 }))
  }
  return Effect.succeed(Action.NextFrame({ state: state - 1 }))
}

function processSelectCursorDown<A>(state: SelectState, choices: Prompt.SelectOptions<A>["choices"]) {
  if (state === choices.length - 1) {
    return Effect.succeed(Action.NextFrame({ state: 0 }))
  }
  return Effect.succeed(Action.NextFrame({ state: state + 1 }))
}

function processSelectNext<A>(state: SelectState, choices: Prompt.SelectOptions<A>["choices"]) {
  return Effect.succeed(Action.NextFrame({ state: (state + 1) % choices.length }))
}

function handleSelectRender<A>(options: SelectOptions<A>) {
  return (state: SelectState, action: Prompt.Action<SelectState, A>) => {
    return Action.$match(action, {
      Beep: () => Effect.succeed(renderBeep),
      NextFrame: ({ state }) => renderSelectNextFrame(state, options),
      Submit: () => renderSelectSubmission(state, options)
    })
  }
}

export function handleSelectClear<A>(options: SelectOptions<A>) {
  return Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const columns = yield* terminal.columns
    const clearPrompt = Ansi.eraseLine + Ansi.cursorLeft
    const text = "\n".repeat(Math.min(options.choices.length, options.maxPerPage)) + options.message
    const clearOutput = eraseText(text, columns)
    return clearOutput + clearPrompt
  })
}

function handleSelectProcess<A>(options: SelectOptions<A>) {
  return (input: Terminal.UserInput, state: SelectState) => {
    switch (input.key.name) {
      case "k":
      case "up": {
        return processSelectCursorUp(state, options.choices)
      }
      case "j":
      case "down": {
        return processSelectCursorDown(state, options.choices)
      }
      case "tab": {
        return processSelectNext(state, options.choices)
      }
      case "enter":
      case "return": {
        const selected = options.choices[state]
        if (selected.disabled) {
          return Effect.succeed(Action.Beep())
        }
        return Effect.succeed(Action.Submit({ value: selected.value }))
      }
      default: {
        return Effect.succeed(Action.Beep())
      }
    }
  }
}

interface TextOptions extends Required<Prompt.TextOptions> {
  /**
   * The type of the text option.
   */
  readonly type: "hidden" | "password" | "text"
}

interface TextState {
  readonly cursor: number
  readonly value: string
  readonly error: Option.Option<string>
}

function getValue(state: TextState, options: TextOptions): string {
  return state.value.length > 0 ? state.value : options.default
}

function renderClearScreen(state: TextState, options: TextOptions) {
  return Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const columns = yield* terminal.columns
    // Erase the current line and place the cursor in column one
    const resetCurrentLine = Ansi.eraseLine + Ansi.cursorLeft
    // Check for any error output
    const clearError = Option.match(state.error, {
      onNone: () => "",
      onSome: (error) =>
        // If there was an error, move the cursor down to the final error line and
        // then clear all lines of error output
        // Add a leading newline to the error message to ensure that the corrrect
        // number of error lines are erased
        Ansi.cursorDown(lines(error, columns)) + eraseText(`\n${error}`, columns)
    })
    // Ensure that the prior prompt output is cleaned up
    const clearOutput = eraseText(options.message, columns)
    // Concatenate and render all documents
    return clearError + clearOutput + resetCurrentLine
  })
}

function renderTextInput(nextState: TextState, options: TextOptions, submitted: boolean) {
  const text = getValue(nextState, options)

  const annotation = Option.match(nextState.error, {
    onNone: () => {
      if (submitted) {
        return Ansi.white
      }

      if (nextState.value.length === 0) {
        return Ansi.blackBright
      }

      return Ansi.combine(Ansi.underlined, Ansi.cyanBright)
    },
    onSome: () => Ansi.red
  })

  switch (options.type) {
    case "hidden": {
      return ""
    }
    case "password": {
      return Ansi.annotate("*".repeat(text.length), annotation)
    }
    case "text": {
      return Ansi.annotate(text, annotation)
    }
  }
}

function renderTextError(nextState: TextState, pointer: string) {
  return Option.match(nextState.error, {
    onNone: () => "",
    onSome: (error) =>
      Arr.match(error.split(NEWLINE_REGEX), {
        onEmpty: () => "",
        onNonEmpty: (errorLines) => {
          const prefix = Ansi.annotate(pointer, Ansi.red) + " "
          const lines = Arr.map(errorLines, (str) => annotateErrorLine(str))
          return Ansi.cursorSavePosition + "\n" + prefix + lines.join("\n") + Ansi.cursorRestorePosition
        }
      })
  })
}

function renderTextOutput(
  nextState: TextState,
  leadingSymbol: string,
  trailingSymbol: string,
  options: TextOptions,
  submitted: boolean = false
) {
  const promptLines = options.message.split(NEWLINE_REGEX)
  const prefix = leadingSymbol + " "
  if (Arr.isReadonlyArrayNonEmpty(promptLines)) {
    const lines = Arr.map(promptLines, (line) => annotateLine(line))
    return prefix + lines.join("\n") + " " + trailingSymbol + " " +
      renderTextInput(nextState, options, submitted)
  }
  return prefix + " " + trailingSymbol + " " + renderTextInput(nextState, options, submitted)
}

function renderTextNextFrame(state: TextState, options: TextOptions) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const leadingSymbol = Ansi.annotate("?", Ansi.cyanBright)
    const trailingSymbol = Ansi.annotate(figures.pointerSmall, Ansi.blackBright)
    const promptMsg = renderTextOutput(state, leadingSymbol, trailingSymbol, options)
    const errorMsg = renderTextError(state, figures.pointerSmall)
    const offset = state.cursor - state.value.length
    return promptMsg + errorMsg + Ansi.cursorMove(offset)
  })
}

function renderTextSubmission(state: TextState, options: TextOptions) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const leadingSymbol = Ansi.annotate(figures.tick, Ansi.green)
    const trailingSymbol = Ansi.annotate(figures.ellipsis, Ansi.blackBright)
    const promptMsg = renderTextOutput(state, leadingSymbol, trailingSymbol, options, true)
    return promptMsg + "\n"
  })
}

function processTextBackspace(state: TextState) {
  if (state.cursor <= 0) {
    return Effect.succeed(Action.Beep())
  }
  const beforeCursor = state.value.slice(0, state.cursor - 1)
  const afterCursor = state.value.slice(state.cursor)
  const cursor = state.cursor - 1
  const value = `${beforeCursor}${afterCursor}`
  return Effect.succeed(
    Action.NextFrame({
      state: { ...state, cursor, value, error: Option.none() }
    })
  )
}

function processTextCursorLeft(state: TextState) {
  if (state.cursor <= 0) {
    return Effect.succeed(Action.Beep())
  }
  const cursor = state.cursor - 1
  return Effect.succeed(
    Action.NextFrame({
      state: { ...state, cursor, error: Option.none() }
    })
  )
}

function processTextCursorRight(state: TextState) {
  if (state.cursor >= state.value.length) {
    return Effect.succeed(Action.Beep())
  }
  const cursor = Math.min(state.cursor + 1, state.value.length)
  return Effect.succeed(
    Action.NextFrame({
      state: { ...state, cursor, error: Option.none() }
    })
  )
}

function processTab(state: TextState, options: TextOptions) {
  if (state.value === options.default) {
    return Effect.succeed(Action.Beep())
  }
  const value = getValue(state, options)
  const cursor = value.length
  return Effect.succeed(
    Action.NextFrame({
      state: { ...state, value, cursor, error: Option.none() }
    })
  )
}

function defaultTextProcessor(input: string, state: TextState) {
  const beforeCursor = state.value.slice(0, state.cursor)
  const afterCursor = state.value.slice(state.cursor)
  const value = `${beforeCursor}${input}${afterCursor}`
  const cursor = state.cursor + input.length
  return Effect.succeed(
    Action.NextFrame({
      state: { ...state, cursor, value, error: Option.none() }
    })
  )
}

function handleTextRender(options: TextOptions) {
  return (state: TextState, action: Prompt.Action<TextState, string>) => {
    return Action.$match(action, {
      Beep: () => Effect.succeed(renderBeep),
      NextFrame: ({ state }) => renderTextNextFrame(state, options),
      Submit: () => renderTextSubmission(state, options)
    })
  }
}

function handleTextProcess(options: TextOptions) {
  return (input: Terminal.UserInput, state: TextState) => {
    switch (input.key.name) {
      case "backspace": {
        return processTextBackspace(state)
      }
      case "left": {
        return processTextCursorLeft(state)
      }
      case "right": {
        return processTextCursorRight(state)
      }
      case "enter":
      case "return": {
        const value = getValue(state, options)
        return Effect.match(options.validate(value), {
          onFailure: (error) =>
            Action.NextFrame({
              state: { ...state, value, error: Option.some(error) }
            }),
          onSuccess: (value) => Action.Submit({ value })
        })
      }
      case "tab": {
        return processTab(state, options)
      }
      default: {
        const value = Option.getOrElse(input.input, () => "")
        return defaultTextProcessor(value, state)
      }
    }
  }
}

function handleTextClear(options: TextOptions) {
  return (state: TextState, _: Prompt.Action<TextState, string>) => {
    return renderClearScreen(state, options)
  }
}

function basePrompt(
  options: Prompt.TextOptions,
  type: TextOptions["type"]
): Prompt<string> {
  const opts: TextOptions = {
    default: "",
    type,
    validate: Effect.succeed,
    ...options
  }

  const initialState: TextState = {
    cursor: 0,
    value: "",
    error: Option.none()
  }
  return custom(initialState, {
    render: handleTextRender(opts),
    process: handleTextProcess(opts),
    clear: handleTextClear(opts)
  })
}

interface ToggleOptions extends Required<Prompt.ToggleOptions> {}

type ToggleState = boolean

function handleToggleClear(options: ToggleOptions) {
  return Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const columns = yield* terminal.columns
    const clearPrompt = Ansi.eraseLine + Ansi.cursorLeft
    const clearOutput = eraseText(options.message, columns)
    return clearOutput + clearPrompt
  })
}

function renderToggle(
  value: boolean,
  options: ToggleOptions,
  submitted: boolean = false
) {
  const separator = Ansi.annotate("/", Ansi.blackBright)
  const selectedAnnotation = Ansi.combine(Ansi.underlined, submitted ? Ansi.white : Ansi.cyanBright)
  const inactive = value
    ? options.inactive
    : Ansi.annotate(options.inactive, selectedAnnotation)
  const active = value
    ? Ansi.annotate(options.active, selectedAnnotation)
    : options.active
  return active + " " + separator + " " + inactive
}

function renderToggleOutput(
  toggle: string,
  leadingSymbol: string,
  trailingSymbol: string,
  options: ToggleOptions
) {
  const promptLines = options.message.split(NEWLINE_REGEX)
  const prefix = leadingSymbol + " "
  if (Arr.isReadonlyArrayNonEmpty(promptLines)) {
    const lines = Arr.map(promptLines, (line) => annotateLine(line))
    return prefix + lines.join("\n") + " " + trailingSymbol + " " + toggle
  }
  return prefix + " " + trailingSymbol + " " + toggle
}

function renderToggleNextFrame(state: ToggleState, options: ToggleOptions) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const leadingSymbol = Ansi.annotate("?", Ansi.cyanBright)
    const trailingSymbol = Ansi.annotate(figures.pointerSmall, Ansi.blackBright)
    const toggle = renderToggle(state, options)
    const promptMsg = renderToggleOutput(toggle, leadingSymbol, trailingSymbol, options)
    return Ansi.cursorHide + promptMsg
  })
}

function renderToggleSubmission(value: boolean, options: ToggleOptions) {
  return Effect.gen(function*() {
    const figures = yield* platformFigures
    const leadingSymbol = Ansi.annotate(figures.tick, Ansi.green)
    const trailingSymbol = Ansi.annotate(figures.ellipsis, Ansi.blackBright)
    const toggle = renderToggle(value, options, true)
    const promptMsg = renderToggleOutput(toggle, leadingSymbol, trailingSymbol, options)
    return promptMsg + "\n"
  })
}

const activate = Effect.succeed(Action.NextFrame({ state: true }))
const deactivate = Effect.succeed(Action.NextFrame({ state: false }))

function handleToggleRender(options: ToggleOptions) {
  return (state: ToggleState, action: Prompt.Action<ToggleState, boolean>) => {
    switch (action._tag) {
      case "Beep": {
        return Effect.succeed(renderBeep)
      }
      case "NextFrame": {
        return renderToggleNextFrame(state, options)
      }
      case "Submit": {
        return renderToggleSubmission(state, options)
      }
    }
  }
}

function handleToggleProcess(input: Terminal.UserInput, state: ToggleState) {
  switch (input.key.name) {
    case "0":
    case "j":
    case "delete":
    case "right":
    case "down": {
      return deactivate
    }
    case "1":
    case "k":
    case "left":
    case "up": {
      return activate
    }
    case " ":
    case "tab": {
      return state ? deactivate : activate
    }
    case "enter":
    case "return": {
      return Effect.succeed(Action.Submit({ value: state }))
    }
    default: {
      return Effect.succeed(Action.Beep())
    }
  }
}

/** @internal */
export const entriesToDisplay = (cursor: number, total: number, maxVisible?: number) => {
  const max = maxVisible === undefined ? total : maxVisible
  let startIndex = Math.min(total - max, cursor - Math.floor(max / 2))
  if (startIndex < 0) {
    startIndex = 0
  }
  const endIndex = Math.min(startIndex + max, total)
  return { startIndex, endIndex }
}
