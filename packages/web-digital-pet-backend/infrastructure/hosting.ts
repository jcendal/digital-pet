import type { DeploymentConfig } from "./deployment-config.ts"

export type HostingStack = {
  StackId: string
  StackStatus: string
  LastUpdatedTime?: string
  CreationTime: string
  Parameters?: Array<{ ParameterKey: string }>
  Outputs: Array<{ OutputKey: string; OutputValue: string }>
}

export const verifyHosting = (config: DeploymentConfig, stack: HostingStack): void => {
  if (
    !stack.StackId?.startsWith(
      `arn:aws:cloudformation:${config.webStackRegion}:${config.account}:stack/${config.webStackName}/`,
    ) ||
    !["CREATE_COMPLETE", "UPDATE_COMPLETE", "UPDATE_ROLLBACK_COMPLETE"].includes(stack.StackStatus)
  )
    throw new Error("Hosting stack is not ready or belongs to another deployment")
  const output = (key: string) => stack.Outputs?.find((item) => item.OutputKey === key)?.OutputValue
  if (output("DistributionId") !== config.webDistributionId || output("SiteUrl") !== config.publicOrigin)
    throw new Error("Hosting stack does not own the configured distribution/site")
}

export const hostingParameters = (stack: HostingStack, apiOrigin: string, backendArn: string) => {
  if (
    !/^https:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com$/.test(apiOrigin) ||
    apiOrigin.trim() !== apiOrigin
  )
    throw new Error("Invalid backend API origin")
  const updates = { BackendApiOrigin: apiOrigin, BackendStackArn: backendArn }
  return [
    ...(stack.Parameters ?? [])
      .filter((item) => !(item.ParameterKey in updates))
      .map((item) => ({ ParameterKey: item.ParameterKey, UsePreviousValue: true })),
    ...Object.entries(updates).map(([ParameterKey, ParameterValue]) => ({ ParameterKey, ParameterValue })),
  ]
}

export type HostingChangeSet = {
  StackId: string
  Status: string
  StatusReason?: string
  ExecutionStatus: string
  Parameters?: Array<{ ParameterKey: string; ParameterValue: string }>
  Changes?: Array<{
    ResourceChange?: { LogicalResourceId?: string; ResourceType?: string; Action?: string; Replacement?: string }
  }>
}

/** Restrict this integration to in-place routing and release-role policy updates. */
export const verifyHostingChanges = (
  change: HostingChangeSet,
  stackId: string,
  apiOrigin: string,
  backendArn: string,
): boolean => {
  if (change.StackId !== stackId) throw new Error("Change set belongs to another hosting stack")
  for (const [key, value] of Object.entries({ BackendApiOrigin: apiOrigin, BackendStackArn: backendArn }))
    if (change.Parameters?.find((item) => item.ParameterKey === key)?.ParameterValue !== value)
      throw new Error("Change set backend parameters do not match the deployed backend")
  if (
    change.Status === "FAILED" &&
    !change.Changes?.length &&
    /didn't contain changes|No updates are to be performed/.test(change.StatusReason ?? "")
  )
    return false
  if (change.Status !== "CREATE_COMPLETE" || change.ExecutionStatus !== "AVAILABLE")
    throw new Error(`Hosting change set is not executable: ${change.StatusReason ?? change.Status}`)
  const allowed: Record<string, string> = {
    WebDistribution: "AWS::CloudFront::Distribution",
    WebDeployRole: "AWS::IAM::Role",
  }
  if (!change.Changes?.length) throw new Error("Missing hosting resource changes")
  for (const { ResourceChange: resource } of change.Changes) {
    if (
      !resource?.LogicalResourceId ||
      allowed[resource.LogicalResourceId] !== resource.ResourceType ||
      resource.Action !== "Modify" ||
      resource.Replacement !== "False"
    )
      throw new Error(
        "Hosting plan contains an unrelated change or resource replacement; review the hosting template separately",
      )
  }
  return true
}
