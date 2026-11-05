export type DeploymentConfig = {
  environment: "production"
  account: string
  region: string
  publicOrigin: string
  cognitoDomainPrefix: string
  googleClientId: string
  googleSecretArn: string
  webDistributionId: string
  webStackName: string
  webStackRegion: string
  alertEmail?: string
}

export const deploymentConfig = (input: unknown): DeploymentConfig => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected deployment configuration")
  const value = input as Record<string, unknown>
  const text = (key: string, pattern: RegExp): string => {
    const entry = value[key]
    if (typeof entry !== "string" || entry.trim() !== entry || !pattern.test(entry))
      throw new Error(`Invalid deployment setting: ${key}`)
    return entry
  }
  const environment = text("environment", /^production$/) as DeploymentConfig["environment"]
  const account = text("account", /^\d{12}$/)
  const region = text("region", /^(us|eu|ap|sa|ca|me|af|il|mx)-[a-z]+-\d$/)
  const publicOrigin = text("publicOrigin", /^https:\/\//)
  const origin = new URL(publicOrigin)
  if (origin.origin !== publicOrigin)
    throw new Error("publicOrigin must be an HTTPS origin without path or credentials")
  const googleSecretArn = text(
    "googleSecretArn",
    /^arn:aws:secretsmanager:[a-z0-9-]+:\d{12}:secret:[A-Za-z0-9/_+=.@-]+$/,
  )
  if (!googleSecretArn.startsWith(`arn:aws:secretsmanager:${region}:${account}:secret:`))
    throw new Error("Google secret must belong to the deployment account and region")
  return {
    environment,
    account,
    region,
    publicOrigin,
    googleSecretArn,
    cognitoDomainPrefix: text("cognitoDomainPrefix", /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
    googleClientId: text("googleClientId", /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/),
    webDistributionId: text("webDistributionId", /^[A-Z0-9]{8,32}$/),
    webStackName: text("webStackName", /^[A-Za-z][A-Za-z0-9-]{0,127}$/),
    webStackRegion: text("webStackRegion", /^(us|eu|ap|sa|ca|me|af|il|mx)-[a-z]+-\d$/),
    ...(value.alertEmail
      ? { alertEmail: text("alertEmail", /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/) }
      : {}),
  }
}

export const configFromEnvironment = (environment: string, env: NodeJS.ProcessEnv): DeploymentConfig =>
  deploymentConfig({
    environment,
    account: env.AWS_ACCOUNT_ID,
    region: env.AWS_REGION,
    publicOrigin: env.PUBLIC_ORIGIN,
    cognitoDomainPrefix: env.COGNITO_DOMAIN_PREFIX,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleSecretArn: env.GOOGLE_SECRET_ARN,
    webDistributionId: env.WEB_DISTRIBUTION_ID,
    webStackName: env.WEB_STACK_NAME,
    webStackRegion: env.WEB_STACK_REGION,
    alertEmail: env.ALERT_EMAIL,
  })
export const stackName = (config: DeploymentConfig): string => `DigitalPetBackend-${config.environment}`

/** Accept only public output values; never write untrusted lines to GITHUB_ENV. */
export const webEnvironment = (input: unknown): Record<string, string> => {
  if (!Array.isArray(input)) throw new Error("Expected CloudFormation outputs")
  if (input.some((item) => !item || typeof item !== "object" || Array.isArray(item)))
    throw new Error("Expected CloudFormation output objects")
  const entries = input as Array<{ OutputKey?: unknown; OutputValue?: unknown }>
  const read = (key: string, pattern: RegExp) => {
    const matches = entries.filter((item) => item.OutputKey === key)
    const value = matches[0]?.OutputValue
    if (matches.length !== 1 || typeof value !== "string" || value.trim() !== value || !pattern.test(value))
      throw new Error(`Invalid stack output: ${key}`)
    return value
  }
  return {
    DIGITAL_PET_WEBSOCKET_URL: read(
      "WebSocketUrl",
      /^wss:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com\/v1\/?$/,
    ),
    DIGITAL_PET_BACKUP_ORIGIN: read("BackupOrigin", /^https:\/\/[a-z0-9.-]+\.s3\.[a-z0-9-]+\.amazonaws\.com$/),
  }
}
