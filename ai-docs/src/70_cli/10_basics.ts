/**
 * @title Getting started with Effect CLI modules
 *
 * Build a command-line app with typed arguments and flags, then wire subcommand
 * handlers into a single executable command.
 */
import { Console, Effect } from "effect"
import { Argument, Command, Flag } from "effect/unstable/cli"

// Start with a root command that holds options you want available to all
// subcommands.
const tasks = Command.make("tasks", {
  workspace: Flag.string("workspace").pipe(
    Flag.withAlias("w"),
    Flag.withDescription("Workspace to operate on"),
    Flag.withDefault("personal")
  ),
  verbose: Flag.boolean("verbose").pipe(
    Flag.withAlias("v"),
    Flag.withDescription("Print diagnostic output")
  )
}).pipe(
  Command.withDescription("Track and manage tasks"),
  Command.withExamples([
    {
      command: "tasks create \"Ship 4.0\" --priority high",
      description: "Create a high-priority task"
    },
    {
      command: "tasks --workspace team-a list --status open",
      description: "List open tasks in a specific workspace"
    }
  ])
)

const create = Command.make(
  "create",
  {
    title: Argument.string("title").pipe(
      Argument.withDescription("Task title")
    ),
    priority: Flag.choice("priority", ["low", "normal", "high"]).pipe(
      Flag.withDescription("Priority for the new task"),
      Flag.withDefault("normal")
    )
  },
  Effect.fnUntraced(function*({ title, priority }) {
    // Subcommands can read parent command input by yielding the parent command.
    const root = yield* tasks

    if (root.verbose) {
      yield* Console.log(`workspace=${root.workspace} action=create`)
    }

    yield* Console.log(`Created "${title}" in ${root.workspace} with ${priority} priority`)
  })
).pipe(
  Command.withDescription("Create a task")
)

const list = Command.make(
  "list",
  {
    status: Flag.choice("status", ["open", "done", "all"]).pipe(
      Flag.withDescription("Filter tasks by status"),
      Flag.withDefault("open")
    ),
    json: Flag.boolean("json").pipe(
      Flag.withDescription("Print machine-readable output")
    )
  },
  Effect.fnUntraced(function*({ status, json }) {
    const root = yield* tasks

    if (root.verbose) {
      yield* Console.log(`workspace=${root.workspace} action=list`)
    }

    if (json) {
      yield* Console.log(JSON.stringify(
        {
          workspace: root.workspace,
          status,
          items: [
            { title: "Ship 4.0", status: "open" },
            { title: "Update onboarding guide", status: "done" }
          ]
        },
        null,
        2
      ))
      return
    }

    yield* Console.log(`Listing ${status} tasks in ${root.workspace}`)
    yield* Console.log("- Ship 4.0")
    yield* Console.log("- Update onboarding guide")
  })
).pipe(
  Command.withDescription("List tasks")
)

export const taskCli = tasks.pipe(
  Command.withSubcommands([create, list])
)

// In production, use `Command.run` to parse `process.argv`.
// `runWith` is useful when testing or embedding CLI execution.
export const runTaskCli = Command.runWith(taskCli, {
  version: "1.0.0"
})
