import { expect, test } from "bun:test"
import { checkCapacity } from "../infrastructure/capacity.ts"
import { deploymentConfig, stackName, webEnvironment } from "../infrastructure/deployment-config.ts"
import {
  type HostingChangeSet,
  type HostingStack,
  hostingParameters,
  verifyHosting,
  verifyHostingChanges,
} from "../infrastructure/hosting.ts"

const config = deploymentConfig({
  environment: "production",
  account: "123456789012",
  region: "eu-west-1",
  publicOrigin: "https://production.game.example",
  cognitoDomainPrefix: "digital-pet-production",
  googleClientId: "123-example.apps.googleusercontent.com",
  googleSecretArn: "arn:aws:secretsmanager:eu-west-1:123456789012:secret:google-abcdef",
  webDistributionId: "EXAMPLE12345",
  webStackName: "web-production",
  webStackRegion: "us-east-1",
})
const apiOrigin = "https://abc123.execute-api.eu-west-1.amazonaws.com"
const outputs = () => [
  { OutputKey: "WebSocketUrl", OutputValue: "wss://abc123.execute-api.eu-west-1.amazonaws.com/v1" },
  { OutputKey: "BackupOrigin", OutputValue: "https://private-backups.s3.eu-west-1.amazonaws.com" },
]

test("deployment targets require an explicit environment and matching secret account/region", () => {
  expect(stackName(config)).toBe("DigitalPetBackend-production")
  for (const change of [
    { environment: "prod" },
    { environment: "staging" },
    { account: "999999999999" },
    { region: "us-east-1" },
    { publicOrigin: "http://production.game.example" },
    { publicOrigin: "https://production.game.example/path" },
    { publicOrigin: "https://user@production.game.example" },
    { googleClientId: "123-example.apps.googleusercontent.com\n" },
  ])
    expect(() => deploymentConfig({ ...config, ...change })).toThrow()
})

test("web exports accept only unique expected public AWS outputs", () => {
  expect(webEnvironment([...outputs(), { OutputKey: "Unrelated", OutputValue: "ignored" }])).toEqual({
    DIGITAL_PET_WEBSOCKET_URL: "wss://abc123.execute-api.eu-west-1.amazonaws.com/v1",
    DIGITAL_PET_BACKUP_ORIGIN: "https://private-backups.s3.eu-west-1.amazonaws.com",
  })
  for (const input of [null, [null], [], [outputs()[0]], [...outputs(), outputs()[0]]])
    expect(() => webEnvironment(input)).toThrow()
  for (const value of [
    "wss://attacker.example/v1",
    "wss://abc123.execute-api.eu-west-1.amazonaws.com/v1\n",
    "wss://abc123.execute-api.eu-west-1.amazonaws.com/v1\nNODE_OPTIONS=--import=malicious",
  ])
    expect(() => webEnvironment([{ ...outputs()[0], OutputValue: value }, outputs()[1]])).toThrow()
})

const hosting: HostingStack = {
  StackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/web-production/uuid",
  StackStatus: "UPDATE_COMPLETE",
  CreationTime: "2026-01-01",
  Parameters: [{ ParameterKey: "RebaseHostedZoneId" }, { ParameterKey: "BackendApiOrigin" }],
  Outputs: [
    { OutputKey: "SiteUrl", OutputValue: config.publicOrigin },
    { OutputKey: "DistributionId", OutputValue: config.webDistributionId },
  ],
}
const backendArn = "arn:aws:cloudformation:eu-west-1:123456789012:stack/DigitalPetBackend-production/uuid"
const change = (): HostingChangeSet => ({
  StackId: hosting.StackId,
  Status: "CREATE_COMPLETE",
  ExecutionStatus: "AVAILABLE",
  Parameters: [
    { ParameterKey: "BackendApiOrigin", ParameterValue: apiOrigin },
    { ParameterKey: "BackendStackArn", ParameterValue: backendArn },
  ],
  Changes: [
    {
      ResourceChange: {
        LogicalResourceId: "WebDistribution",
        ResourceType: "AWS::CloudFront::Distribution",
        Action: "Modify",
        Replacement: "False",
      },
    },
  ],
})

test("hosting integration verifies account, region, site and distribution ownership", () => {
  expect(() => verifyHosting(config, hosting)).not.toThrow()
  for (const mutation of [
    { account: "999999999999" },
    { webStackRegion: "eu-west-1" },
    { webDistributionId: "OTHER12345" },
    { publicOrigin: "https://production.example" },
  ])
    expect(() => verifyHosting({ ...config, ...mutation }, hosting)).toThrow()
  expect(hostingParameters(hosting, apiOrigin, backendArn)).toEqual([
    { ParameterKey: "RebaseHostedZoneId", UsePreviousValue: true },
    { ParameterKey: "BackendApiOrigin", ParameterValue: apiOrigin },
    { ParameterKey: "BackendStackArn", ParameterValue: backendArn },
  ])
})

test("hosting change sets reject destructive, unrelated or cross-backend updates", () => {
  expect(verifyHostingChanges(change(), hosting.StackId, apiOrigin, backendArn)).toBe(true)
  for (const mutation of [
    { Replacement: "True" },
    { Replacement: "Conditional" },
    { Action: "Remove" },
    { LogicalResourceId: "WebBucket", ResourceType: "AWS::S3::Bucket" },
  ]) {
    const modified = change()
    modified.Changes = [{ ResourceChange: { ...modified.Changes?.[0]?.ResourceChange, ...mutation } }]
    expect(() => verifyHostingChanges(modified, hosting.StackId, apiOrigin, backendArn)).toThrow()
  }
  expect(() => verifyHostingChanges(change(), hosting.StackId, apiOrigin, "different-backend")).toThrow()
  expect(() =>
    verifyHostingChanges({ ...change(), ExecutionStatus: "OBSOLETE" }, hosting.StackId, apiOrigin, backendArn),
  ).toThrow()
})

test("only explicit empty CloudFormation change sets are accepted as no-ops", () => {
  const empty = {
    ...change(),
    Status: "FAILED",
    ExecutionStatus: "UNAVAILABLE",
    Changes: [],
    StatusReason: "The submitted information didn't contain changes.",
  }
  expect(verifyHostingChanges(empty, hosting.StackId, apiOrigin, backendArn)).toBe(false)
  expect(() =>
    verifyHostingChanges({ ...empty, StatusReason: "Access denied" }, hosting.StackId, apiOrigin, backendArn),
  ).toThrow()
})

test("Lambda preflight accepts the existing shared pool without requiring reserved capacity", () => {
  expect(checkCapacity(10)).toBe(10)
  expect(checkCapacity(1)).toBe(1)
  expect(() => checkCapacity(0)).toThrow("No shared Lambda concurrency")
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5])
    expect(() => checkCapacity(invalid)).toThrow("Invalid Lambda")
})
