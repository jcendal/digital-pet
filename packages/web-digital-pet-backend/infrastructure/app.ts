import { App, Tags } from "aws-cdk-lib"
import { configFromEnvironment, stackName } from "./deployment-config.ts"
import { BackendStack } from "./stack.ts"

const config = configFromEnvironment(process.env.DEPLOY_ENV ?? "production", process.env)
const app = new App({ outdir: process.env.CDK_OUTDIR ?? "cdk.out" })
const stack = new BackendStack(app, stackName(config), {
  env: { account: config.account, region: config.region },
  terminationProtection: true,
  publicOrigin: config.publicOrigin,
  cognitoDomainPrefix: config.cognitoDomainPrefix,
  googleClientId: config.googleClientId,
  googleSecretArn: config.googleSecretArn,
  ...(config.alertEmail ? { alertEmail: config.alertEmail } : {}),
})
Tags.of(stack).add("Application", "digital-pet")
Tags.of(stack).add("Environment", config.environment)
app.synth()
