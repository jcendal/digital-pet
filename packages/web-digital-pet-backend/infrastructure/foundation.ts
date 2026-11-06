import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { App, BootstraplessSynthesizer, type IStackSynthesizer, Stack, type StackProps } from "aws-cdk-lib"
import { CfnInclude } from "aws-cdk-lib/cloudformation-include"
import type { Construct } from "constructs"
import type { DeploymentConfig } from "./deployment-config.ts"

// CDK's optional bootstrapQualifier declaration predates exactOptionalPropertyTypes.
export const foundationSynthesizer = (): IStackSynthesizer => new BootstraplessSynthesizer() as IStackSynthesizer

/** Adopt existing templates without changing logical IDs, parameters or resource ownership.
 * Keep the YAML as the migration boundary until individual resources can be converted with a no-op diff.
 */
export class HostingStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, { ...props, analyticsReporting: false, synthesizer: foundationSynthesizer() })
    new CfnInclude(this, "HostingResources", {
      templateFile: fileURLToPath(new URL("../../../infra/web-digital-pet.yml", import.meta.url)),
      preserveLogicalIds: true,
    })
  }
}

/** Privileged access is synthesized separately and never deployed by the application release. */
export class DeploymentAccessStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, { ...props, analyticsReporting: false, synthesizer: foundationSynthesizer() })
    new CfnInclude(this, "AccessResources", {
      templateFile: fileURLToPath(new URL("../../../infra/github-backend-deploy.yml", import.meta.url)),
      preserveLogicalIds: true,
    })
  }
}

export const synthesizeFoundation = (config: DeploymentConfig, outdir: string) => {
  const app = new App({
    outdir,
    autoSynth: false,
    analyticsReporting: false,
    context: {
      "aws:cdk:enable-path-metadata": false,
      "aws:cdk:enable-asset-metadata": false,
    },
  })
  const hosting = new HostingStack(app, "Hosting", {
    stackName: config.webStackName,
    env: { account: config.account, region: config.webStackRegion },
  })
  const access = new DeploymentAccessStack(app, "DeploymentAccess", {
    env: { account: config.account, region: config.region },
  })
  const assembly = app.synth()
  return {
    hosting: resolve(outdir, assembly.getStackArtifact(hosting.artifactId).templateFile),
    access: resolve(outdir, assembly.getStackArtifact(access.artifactId).templateFile),
  }
}
