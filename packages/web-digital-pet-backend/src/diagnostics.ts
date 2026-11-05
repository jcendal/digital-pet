import { OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import { digest } from "./identity.ts"
export type FailureContext = {
  requestId?: string | undefined
  connectionId?: string | undefined
  commandId?: string | undefined
}
export const reportFailure = (operation: string, error: unknown, context: FailureContext = {}): void => {
  if (error instanceof OnlineError && error.status < 500) return
  const dependency = error && typeof error === "object" && "$metadata" in error ? error.$metadata : undefined
  const dependencyStatus =
    dependency &&
    typeof dependency === "object" &&
    "httpStatusCode" in dependency &&
    typeof dependency.httpStatusCode === "number"
      ? dependency.httpStatusCode
      : undefined
  console.error(
    JSON.stringify({
      event: "backend-failure",
      operation,
      category: error instanceof OnlineError ? "application" : "unexpected",
      status: error instanceof OnlineError ? error.status : 500,
      ...(dependencyStatus === undefined ? {} : { dependencyStatus }),
      ...(context.requestId && /^[a-zA-Z0-9_=-]{1,100}$/.test(context.requestId)
        ? { requestId: context.requestId }
        : {}),
      ...(context.connectionId ? { connection: digest(context.connectionId).slice(0, 16) } : {}),
      ...(context.commandId ? { command: digest(context.commandId).slice(0, 16) } : {}),
    }),
  )
}
