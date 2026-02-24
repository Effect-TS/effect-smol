/**
 * @title Acquiring resources with Effect.acquireRelease
 *
 * Define a service method that acquires a short-lived resource with
 * `Effect.acquireRelease`, then execute it with `Effect.scoped` so finalizers
 * always run.
 */

import { Effect, Exit, Layer, ServiceMap } from "effect"

interface SmtpSession {
  readonly send: (message: {
    readonly to: string
    readonly subject: string
    readonly body: string
  }) => Effect.Effect<void, Error>
  readonly quit: Effect.Effect<void>
  readonly reset: Effect.Effect<void>
}

declare const connectSmtpSession: Effect.Effect<SmtpSession, Error>
declare const persistDeliveryMetric: (message: string) => Effect.Effect<void>

export class Mailer extends ServiceMap.Service<Mailer, {
  readonly sendWelcomeEmail: (to: string) => Effect.Effect<void, Error>
}>()("app/Mailer") {
  static readonly layer = Layer.effect(
    Mailer,
    Effect.succeed(
      Mailer.of({
        sendWelcomeEmail: (to) =>
          Effect.scoped(
            Effect.acquireRelease(
              // Open an SMTP session at the start of the scoped workflow.
              connectSmtpSession,
              (session, exit) =>
                Effect.gen(function*() {
                  // When the workflow fails, reset the session before quitting so
                  // partial SMTP transactions are discarded server-side.
                  if (Exit.isFailure(exit)) {
                    yield* session.reset
                  }

                  // Finalizers run on both success and failure.
                  yield* session.quit
                  yield* persistDeliveryMetric(
                    `smtp session closed (${Exit.isSuccess(exit) ? "success" : "failure"})`
                  )
                })
            ).pipe(
              Effect.flatMap((session) =>
                session.send({
                  to,
                  subject: "Welcome to Acme Cloud",
                  body: "Thanks for signing up. Reply to this email if you need help."
                })
              ),
              Effect.tap(() => persistDeliveryMetric(`welcome email sent to ${to}`))
            )
          )
      })
    )
  )
}

export const sendWelcome = Effect.gen(function*() {
  const mailer = yield* Mailer
  yield* mailer.sendWelcomeEmail("dev@example.com")
}).pipe(Effect.provide(Mailer.layer))
