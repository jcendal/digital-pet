import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { checkCapacity } from "../infrastructure/capacity.ts"
import {
  configFromEnvironment,
  deploymentConfig,
  stackName,
  webEnvironment,
} from "../infrastructure/deployment-config.ts"
import {
  type HostingChangeSet,
  type HostingStack,
  hostingParameters,
  verifyHosting,
  verifyHostingChanges,
} from "../infrastructure/hosting.ts"

const root = fileURLToPath(new URL("../../../", import.meta.url))
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { environment: { type: "string" }, config: { type: "string" }, help: { type: "boolean" } },
})
const action = positionals[0]
if (values.help || !action) {
  console.log(
    "npm run backend -- <synth|preflight|plan|bootstrap|deploy|cdn-plan|cdn-apply|outputs> [--environment production] [--config file.json]",
  )
  process.exit(0)
}
if (
  positionals.length !== 1 ||
  !["synth", "preflight", "plan", "bootstrap", "deploy", "cdn-plan", "cdn-apply", "outputs"].includes(action)
)
  throw new Error("Unknown backend action; use --help")
const environment = values.environment ?? "production"
if (environment !== "production") throw new Error("Only the production AWS environment is supported")
const config = values.config
  ? deploymentConfig(JSON.parse(await readFile(resolve(values.config), "utf8")))
  : configFromEnvironment(environment, process.env)
if (config.environment !== environment) throw new Error("Configuration does not match --environment")
const directory = resolve(root, ".backend-deploy", config.environment)
await mkdir(directory, { recursive: true, mode: 0o700 })
const assembly = resolve(directory, "assembly")
const target = stackName(config)
const env = {
  ...process.env,
  AWS_REGION: config.region,
  AWS_DEFAULT_REGION: config.region,
  DEPLOY_ENV: config.environment,
  AWS_ACCOUNT_ID: config.account,
  PUBLIC_ORIGIN: config.publicOrigin,
  COGNITO_DOMAIN_PREFIX: config.cognitoDomainPrefix,
  GOOGLE_CLIENT_ID: config.googleClientId,
  GOOGLE_SECRET_ARN: config.googleSecretArn,
  WEB_DISTRIBUTION_ID: config.webDistributionId,
  WEB_STACK_NAME: config.webStackName,
  WEB_STACK_REGION: config.webStackRegion,
  ALERT_EMAIL: config.alertEmail ?? "",
  CDK_OUTDIR: assembly,
  AWS_PAGER: "",
}
const run = (command: string, args: string[], capture = false, allowFailure = false): string => {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
  })
  if (result.error) throw result.error
  if (result.status !== 0 && !allowFailure) throw new Error(`${command} failed (${result.status ?? result.signal})`)
  return result.stdout ?? ""
}
const aws = (args: string[], region = config.region) => {
  const output = run("aws", [...args, "--region", region, "--output", "json"], true)
  return output.trim() ? JSON.parse(output) : {}
}
const hostingAws = (args: string[]) => aws(["cloudformation", ...args], config.webStackRegion)
const hostingStack = (): HostingStack => {
  const stack = hostingAws(["describe-stacks", "--stack-name", config.webStackName]).Stacks?.[0] as
    | HostingStack
    | undefined
  if (!stack) throw new Error("Hosting stack not found")
  verifyHosting(config, stack)
  return stack
}
const cdk = (...args: string[]) =>
  run(process.execPath, [createRequire(import.meta.url).resolve("aws-cdk/bin/cdk"), ...args])
const save = (name: string, value: unknown) =>
  writeFile(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
const backendStack = () => {
  const result = aws(["cloudformation", "describe-stacks", "--stack-name", target])
  const stack = result.Stacks?.[0] as
    | { StackId: string; Outputs: Array<{ OutputKey: string; OutputValue: string }> }
    | undefined
  if (
    !stack?.StackId?.startsWith(`arn:aws:cloudformation:${config.region}:${config.account}:stack/${target}/`) ||
    !stack.Outputs?.some((item) => item.OutputKey === "PublicOrigin" && item.OutputValue === config.publicOrigin)
  )
    throw new Error("Deployed backend does not match the configured account/site")
  return stack
}
const preflight = () => {
  const hosting = hostingStack()
  const bucket = hosting.Outputs.find((item) => item.OutputKey === "BucketName")?.OutputValue
  if (process.env.WEB_BUCKET_NAME && process.env.WEB_BUCKET_NAME !== bucket)
    throw new Error("WEB_BUCKET_NAME is not the bucket owned by the configured hosting stack")
  aws(["secretsmanager", "describe-secret", "--secret-id", config.googleSecretArn, "--query", "ARN"])
  if (!config.alertEmail)
    throw new Error("Set alertEmail / ALERT_EMAIL before deployment; confirm the SNS email subscription afterwards")
  const unreserved = aws(["lambda", "get-account-settings"]).AccountLimit?.UnreservedConcurrentExecutions
  const available = checkCapacity(unreserved)
  console.log(
    `Preflight passed: account/site/secret checked; sharing ${available} unreserved Lambda executions. No reservations or quota increase requested.`,
  )
}

if (action !== "synth") {
  const identity = aws(["sts", "get-caller-identity"])
  if (identity.Account !== config.account) throw new Error("AWS credentials belong to another account")
}
if (["preflight", "plan", "deploy"].includes(action)) preflight()
if (action === "bootstrap") {
  cdk("bootstrap", `aws://${config.account}/${config.region}`)
} else if (["synth", "plan", "deploy"].includes(action)) {
  run("npm", ["run", "build", "--workspace", "@jcendal/web-digital-pet-backend"])
  run(process.execPath, ["--experimental-strip-types", "packages/web-digital-pet-backend/infrastructure/app.ts"])
  if (action !== "synth") cdk("diff", target, "--app", assembly, "--change-set=false")
  if (action === "deploy") {
    cdk(
      "deploy",
      target,
      "--app",
      assembly,
      "--require-approval",
      "never",
      "--outputs-file",
      resolve(directory, "cdk-outputs.json"),
    )
  }
} else if (action === "cdn-plan" || action === "cdn-apply") {
  const hosting = hostingStack()
  const backend = backendStack()
  const apiOrigin = backend.Outputs.find((item) => item.OutputKey === "ApiOrigin")?.OutputValue
  if (!apiOrigin) throw new Error("Missing backend API origin")
  const distribution = aws(["cloudfront", "get-distribution", "--id", config.webDistributionId])
  const stamp = hosting.LastUpdatedTime ?? hosting.CreationTime
  const binding = {
    environment: config.environment,
    stackId: hosting.StackId,
    stamp,
    distributionId: config.webDistributionId,
    etag: distribution.ETag,
    apiOrigin,
    backendArn: backend.StackId,
  }
  if (action === "cdn-plan") {
    const parameters = hostingParameters(hosting, apiOrigin, backend.StackId)
    const change = hostingAws([
      "create-change-set",
      "--stack-name",
      hosting.StackId,
      "--change-set-name",
      `digital-pet-${randomUUID()}`,
      "--change-set-type",
      "UPDATE",
      "--template-body",
      `file://${resolve(root, "infra/web-digital-pet.yml")}`,
      "--parameters",
      JSON.stringify(parameters),
      "--capabilities",
      "CAPABILITY_IAM",
    ])
    // AWS reports a no-op as FAILED; inspect the result rather than treating every waiter error as a no-op.
    run(
      "aws",
      [
        "cloudformation",
        "wait",
        "change-set-create-complete",
        "--change-set-name",
        change.Id,
        "--region",
        config.webStackRegion,
      ],
      false,
      true,
    )
    const details = hostingAws(["describe-change-set", "--change-set-name", change.Id]) as HostingChangeSet
    // Preserve diagnostics even when the safety check refuses the plan.
    await save("hosting-changes.json", details)
    console.log(`Review hosting change set: ${change.Id}`)
    const changes = verifyHostingChanges(details, hosting.StackId, apiOrigin, backend.StackId)
    await save("hosting-plan.json", { ...binding, changeSetId: change.Id })
    console.log(changes ? "Hosting changes passed safety checks." : "No hosting changes required.")
  } else {
    const plan = JSON.parse(await readFile(resolve(directory, "hosting-plan.json"), "utf8"))
    for (const [key, value] of Object.entries(binding))
      if (plan[key] !== value) throw new Error("Hosting/backend changed since review; prepare a new CDN plan")
    if (
      typeof plan.changeSetId !== "string" ||
      !plan.changeSetId.startsWith(`arn:aws:cloudformation:${config.webStackRegion}:${config.account}:changeSet/`)
    )
      throw new Error("Invalid hosting change set")
    const details = hostingAws(["describe-change-set", "--change-set-name", plan.changeSetId]) as HostingChangeSet
    if (verifyHostingChanges(details, hosting.StackId, apiOrigin, backend.StackId)) {
      hostingAws(["execute-change-set", "--change-set-name", plan.changeSetId])
      run("aws", [
        "cloudformation",
        "wait",
        "stack-update-complete",
        "--stack-name",
        hosting.StackId,
        "--region",
        config.webStackRegion,
      ])
    }
    run("aws", [
      "cloudfront",
      "wait",
      "distribution-deployed",
      "--id",
      config.webDistributionId,
      "--region",
      config.webStackRegion,
    ])
  }
}

if (action === "outputs" || action === "deploy") {
  const outputs = backendStack().Outputs
  await save("outputs.json", outputs)
  const settings = webEnvironment(outputs)
  await writeFile(
    resolve(directory, "web.env"),
    Object.entries(settings)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(""),
    { mode: 0o600 },
  )
  console.log(`Web build settings: ${resolve(directory, "web.env")}`)
}
