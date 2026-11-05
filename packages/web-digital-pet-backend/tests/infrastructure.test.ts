import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { App, Stack } from "aws-cdk-lib"
import { Match, Template } from "aws-cdk-lib/assertions"
import { CfnInclude } from "aws-cdk-lib/cloudformation-include"
import { BackendStack } from "../infrastructure/stack.ts"

test("synthesized infrastructure keeps data private, credentials rotated and authorization uncached", () => {
  const stack = new BackendStack(new App(), "TestBackend", {
    publicOrigin: "https://game.example",
    alertEmail: "operator@example.com",
    cognitoDomainPrefix: "digital-pet-test",
    googleClientId: "google-id",
    googleSecretArn: "arn:aws:secretsmanager:eu-west-1:123456789012:secret:google-abcdef",
    assetPath: fileURLToPath(new URL("../src/handlers", import.meta.url)),
  })
  const template = Template.fromStack(stack)
  // Five application handlers plus CDK's deployment-only bucket notification installer.
  template.resourceCountIs("AWS::Lambda::Function", 6)
  template.allResourcesProperties("AWS::Lambda::Function", { ReservedConcurrentExecutions: Match.absent() })
  template.resourceCountIs("AWS::Logs::MetricFilter", 5)
  template.resourceCountIs("AWS::CloudWatch::Alarm", 10)
  template.hasResourceProperties("AWS::SNS::Subscription", { Protocol: "email", Endpoint: "operator@example.com" })
  template.allResourcesProperties("AWS::CloudWatch::Alarm", {
    AlarmActions: Match.arrayWith([{ Ref: Match.anyValue() }]),
  })
  template.allResourcesProperties("AWS::Logs::MetricFilter", {
    FilterPattern: '{ $.event = "backend-failure" }',
  })
  template.resourceCountIs("AWS::DynamoDB::Table", 0)
  template.resourceCountIs("AWS::EC2::Instance", 0)
  template.resourceCountIs("AWS::S3::Bucket", 3)
  template.hasResourceProperties("AWS::Cognito::UserPool", { UserPoolTier: "ESSENTIALS" })
  template.allResourcesProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  })
  template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
    AccessTokenValidity: 120,
    RefreshTokenValidity: 525600,
    GenerateSecret: true,
    RefreshTokenRotation: { Feature: "ENABLED", RetryGracePeriodSeconds: 60 },
    SupportedIdentityProviders: ["Google"],
    AllowedOAuthScopes: ["openid", "email"],
    AllowedOAuthFlows: ["code"],
    ExplicitAuthFlows: [],
  })
  template.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
    AuthorizerResultTtlInSeconds: 0,
    EnableSimpleResponses: true,
  })
  template.resourceCountIs("AWS::Cognito::UserPoolIdentityProvider", 1)
  template.hasResourceProperties("AWS::Cognito::UserPoolIdentityProvider", {
    ProviderType: "Google",
    ProviderDetails: { authorize_scopes: "openid email" },
  })
  const handlers = Object.values(template.findResources("AWS::Lambda::Function")).filter((resource) =>
    /^(auth|authorizer|saves|social|realtime)\.handler$/.test(String(resource.Properties.Handler)),
  )
  expect(handlers).toHaveLength(5)
  for (const handler of handlers) {
    expect(handler.Properties.Timeout).toBe(30)
    expect(handler.Properties.ReservedConcurrentExecutions).toBeUndefined()
    expect(handler.Properties.Architectures).toEqual(["arm64"])
  }
  const notifications = Object.values(template.findResources("Custom::S3BucketNotifications"))[0]
  expect(notifications?.Properties.NotificationConfiguration.LambdaFunctionConfigurations).toHaveLength(4)

  const policies = template.findResources("AWS::IAM::Policy")
  const authorizerPolicy = Object.entries(policies).find(([name]) => name.startsWith("authorizerFunction"))?.[1]
  expect(JSON.stringify(authorizerPolicy)).not.toContain("kms:Decrypt")
  expect(JSON.stringify(authorizerPolicy)).not.toContain("s3:PutObject")
})

test("the hosting template owns uncached API routes and grants only the selected backend output read", () => {
  const stack = new Stack(new App(), "Hosting")
  new CfnInclude(stack, "ExistingHosting", {
    templateFile: fileURLToPath(new URL("../../../infra/web-digital-pet.yml", import.meta.url)),
  })
  const template = Template.fromStack(stack)
  template.resourceCountIs("AWS::CloudFront::Distribution", 1)
  template.resourceCountIs("AWS::S3::Bucket", 1)
  const resources = template.toJSON().Resources
  const config = resources.WebDistribution.Properties.DistributionConfig
  expect(config.DefaultCacheBehavior.FunctionAssociations).toHaveLength(1)
  expect(config.DefaultCacheBehavior.TargetOriginId).toBe("web-bucket")
  expect(config.CustomErrorResponses).toBeUndefined()
  const routes = config.CacheBehaviors["Fn::If"][1]
  expect(routes.map((route: { PathPattern: string }) => route.PathPattern)).toEqual(["/auth/*", "/api/v1/*"])
  for (const route of routes) {
    expect(route.CachePolicyId).toBe("4135ea2d-6df8-44a3-9df3-4b5a84be39ad")
    expect(route.OriginRequestPolicyId).toBe("b689b0a8-53d0-40ab-baf2-68738e2966ac")
    expect(route.FunctionAssociations).toBeUndefined()
    expect(route.AllowedMethods).toContain("POST")
  }
  const statement = resources.WebDeployRole.Properties.Policies[0].PolicyDocument.Statement[0]["Fn::If"][1]
  expect(statement).toEqual({
    Effect: "Allow",
    Action: "cloudformation:DescribeStacks",
    Resource: { Ref: "BackendStackArn" },
  })
  // The production site and physical resource names remain unchanged.
  expect(config.Aliases).toEqual(["digital-pet.rebase.es"])
  expect(resources.WebRoutes.Properties.Name).toBe("digital-pet-web-routes")
  expect(resources.WebOriginAccessControl.Properties.OriginAccessControlConfig.Name).toBe("digital-pet-web-s3")
})
