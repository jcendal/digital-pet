import { fileURLToPath } from "node:url"
import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack, type StackProps } from "aws-cdk-lib"
import { HttpApi, HttpMethod, WebSocketApi, WebSocketStage } from "aws-cdk-lib/aws-apigatewayv2"
import { HttpLambdaAuthorizer, HttpLambdaResponseType } from "aws-cdk-lib/aws-apigatewayv2-authorizers"
import { HttpLambdaIntegration, WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations"
import { ComparisonOperator } from "aws-cdk-lib/aws-cloudwatch"
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions"
import {
  type CfnUserPoolClient,
  FeaturePlan,
  OAuthScope,
  ProviderAttribute,
  UserPool,
  UserPoolClientIdentityProvider,
  UserPoolIdentityProviderGoogle,
} from "aws-cdk-lib/aws-cognito"
import { PolicyStatement } from "aws-cdk-lib/aws-iam"
import { Key } from "aws-cdk-lib/aws-kms"
import { Architecture, Code, Function as Lambda, Runtime } from "aws-cdk-lib/aws-lambda"
import { FilterPattern, LogGroup, MetricFilter, RetentionDays } from "aws-cdk-lib/aws-logs"
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  EventType,
  HttpMethods,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3"
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications"
import { Topic } from "aws-cdk-lib/aws-sns"
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions"
import type { Construct } from "constructs"
import { HANDLERS } from "./capacity.ts"

export type BackendProps = StackProps & {
  publicOrigin: string
  cognitoDomainPrefix: string
  googleClientId: string
  googleSecretArn: string
  assetPath?: string
  alertEmail?: string
}

export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props: BackendProps) {
    super(scope, id, props)
    const origin = new URL(props.publicOrigin)
    if (origin.protocol !== "https:" || origin.origin !== props.publicOrigin)
      throw new Error("publicOrigin must be an HTTPS origin without a trailing slash")
    const bucketProps = {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.RETAIN,
    }
    const data = new Bucket(this, "Data", {
      ...bucketProps,
      lifecycleRules: [{ prefix: "realtime/", expiration: Duration.days(1) }],
    })
    const auth = new Bucket(this, "Auth", {
      ...bucketProps,
      lifecycleRules: [
        { prefix: "oauth/", expiration: Duration.days(1) },
        { prefix: "tickets/", expiration: Duration.days(1) },
        { prefix: "sessions/", expiration: Duration.days(400) },
      ],
    })
    const backups = new Bucket(this, "Backups", {
      ...bucketProps,
      lifecycleRules: [
        { prefix: "staging/", expiration: Duration.days(1), abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
      cors: [
        {
          allowedOrigins: [props.publicOrigin],
          allowedMethods: [HttpMethods.POST, HttpMethods.GET],
          allowedHeaders: ["Content-Type"],
          maxAge: 300,
        },
      ],
    })
    const sessionKey = new Key(this, "SessionKey", { enableKeyRotation: true, removalPolicy: RemovalPolicy.RETAIN })
    const pool = new UserPool(this, "Users", {
      selfSignUpEnabled: false,
      featurePlan: FeaturePlan.ESSENTIALS,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })
    const google = new UserPoolIdentityProviderGoogle(this, "Google", {
      userPool: pool,
      clientId: props.googleClientId,
      clientSecretValue: SecretValue.secretsManager(props.googleSecretArn),
      scopes: ["openid", "email"],
      attributeMapping: { email: ProviderAttribute.GOOGLE_EMAIL },
    })
    const client = pool.addClient("Web", {
      generateSecret: true,
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(2),
      idTokenValidity: Duration.hours(2),
      refreshTokenValidity: Duration.days(365),
      // Exceed the refresh claim / Lambda timeout so a lost publication can retry.
      refreshTokenRotationGracePeriod: Duration.seconds(60),
      authFlows: {},
      supportedIdentityProviders: [UserPoolClientIdentityProvider.GOOGLE],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL],
        callbackUrls: [`${props.publicOrigin}/auth/callback`],
        logoutUrls: [props.publicOrigin],
      },
    })
    client.node.addDependency(google)
    // Omission enables Cognito's default refresh auth flow, incompatible with rotation.
    const cfnClient = client.node.defaultChild as CfnUserPoolClient
    cfnClient.explicitAuthFlows = []
    const domain = pool.addDomain("Domain", { cognitoDomain: { domainPrefix: props.cognitoDomainPrefix } })
    const environment = {
      PUBLIC_ORIGIN: props.publicOrigin,
      AUTH_BUCKET: auth.bucketName,
      DATA_BUCKET: data.bucketName,
      BACKUP_BUCKET: backups.bucketName,
      SESSION_KEY: sessionKey.keyArn,
      COGNITO_POOL_ID: pool.userPoolId,
      COGNITO_ISSUER: pool.userPoolProviderUrl,
      COGNITO_DOMAIN: domain.baseUrl(),
      COGNITO_CLIENT_ID: client.userPoolClientId,
    }
    const alerts = props.alertEmail ? new Topic(this, "Alerts") : undefined
    if (alerts && props.alertEmail) {
      alerts.addSubscription(new EmailSubscription(props.alertEmail))
      new CfnOutput(this, "AlertsTopicArn", { value: alerts.topicArn })
    }
    const functions = Object.fromEntries(
      HANDLERS.map((name) => {
        const logs = new LogGroup(this, `${name}Logs`, {
          retention: RetentionDays.TWO_WEEKS,
          removalPolicy: RemovalPolicy.DESTROY,
        })
        const fn = new Lambda(this, `${name}Function`, {
          runtime: Runtime.NODEJS_24_X,
          architecture: Architecture.ARM_64,
          code: Code.fromAsset(props.assetPath ?? fileURLToPath(new URL("../dist", import.meta.url))),
          handler: `${name}.handler`,
          memorySize: 256,
          timeout: Duration.seconds(30),
          // Omit reservations: all handlers share the account's existing concurrency pool.
          environment,
          logGroup: logs,
        })
        const failures = new MetricFilter(this, `${name}ApplicationFailures`, {
          logGroup: logs,
          filterPattern: FilterPattern.stringValue("$.event", "=", "backend-failure"),
          metricNamespace: "DigitalPet/Backend",
          metricName: `${this.stackName}-${name}-ApplicationFailures`,
          metricValue: "1",
        })
        const applicationAlarm = failures.metric().createAlarm(this, `${name}ApplicationErrors`, {
          threshold: 5,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        })
        const executionAlarm = fn.metricErrors().createAlarm(this, `${name}Errors`, {
          threshold: 5,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        })
        if (alerts) {
          applicationAlarm.addAlarmAction(new SnsAction(alerts))
          executionAlarm.addAlarmAction(new SnsAction(alerts))
        }
        return [name, fn]
      }),
    ) as Record<"auth" | "authorizer" | "saves" | "social" | "realtime", Lambda>
    auth.grantReadWrite(functions.auth, "oauth/*")
    auth.grantReadWrite(functions.auth, "sessions/*")
    auth.grantReadWrite(functions.auth, "tickets/*")
    auth.grantReadWrite(functions.realtime, "tickets/*")
    auth.grantRead(functions.realtime, "sessions/*")
    data.grantReadWrite(functions.realtime, "realtime/*")
    data.grantRead(functions.social, "realtime/*")
    auth.grantRead(functions.social, "sessions/*")
    for (const prefix of ["profiles", "social-index", "relationships", "battle-decisions"])
      data.grantRead(functions.realtime, `${prefix}/*`)
    data.grantReadWrite(functions.social, "battle-decisions/*")
    auth.grantRead(functions.authorizer, "sessions/*")
    sessionKey.grantEncryptDecrypt(functions.auth)
    functions.auth.addToRolePolicy(
      new PolicyStatement({ actions: ["cognito-idp:DescribeUserPoolClient"], resources: [pool.userPoolArn] }),
    )
    data.grantReadWrite(functions.saves, "backups/*")
    backups.grantReadWrite(functions.saves)
    for (const prefix of ["profiles", "codes", "social-index", "relationships"])
      data.grantReadWrite(functions.social, `${prefix}/*`)
    const authorizer = new HttpLambdaAuthorizer("Sessions", functions.authorizer, {
      responseTypes: [HttpLambdaResponseType.SIMPLE],
      resultsCacheTtl: Duration.seconds(0),
      identitySource: ["$request.header.Cookie"],
    })
    const api = new HttpApi(this, "Api", { createDefaultStage: true })
    api.defaultStage?.node.defaultChild?.node.addMetadata(
      "purpose",
      "Private web backend; forward only /auth/* and /api/v1/* from CloudFront",
    )
    api.addRoutes({
      path: "/auth/{proxy+}",
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: new HttpLambdaIntegration("AuthIntegration", functions.auth),
    })
    const saves = new HttpLambdaIntegration("SavesIntegration", functions.saves)
    for (const path of ["/api/v1/me/backups", "/api/v1/me/backups/{proxy+}"])
      api.addRoutes({
        path,
        methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.DELETE],
        integration: saves,
        authorizer,
      })
    api.addRoutes({
      path: "/api/v1/{proxy+}",
      methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("SocialIntegration", functions.social),
      authorizer,
    })
    const stage = api.defaultStage?.node.defaultChild
    if (stage && "addPropertyOverride" in stage && typeof stage.addPropertyOverride === "function") {
      stage.addPropertyOverride("DefaultRouteSettings.ThrottlingBurstLimit", 40)
      stage.addPropertyOverride("DefaultRouteSettings.ThrottlingRateLimit", 20)
    }
    new CfnOutput(this, "ApiOrigin", { value: api.apiEndpoint })
    new CfnOutput(this, "PublicOrigin", { value: props.publicOrigin })
    new CfnOutput(this, "BackupBucket", { value: backups.bucketName })
    new CfnOutput(this, "BackupOrigin", { value: `https://${backups.bucketRegionalDomainName}` })
    new CfnOutput(this, "IdentityRedirect", { value: `${domain.baseUrl()}/oauth2/idpresponse` })
    const websocket = new WebSocketApi(this, "Realtime", {
      connectRouteOptions: { integration: new WebSocketLambdaIntegration("Connect", functions.realtime) },
      disconnectRouteOptions: { integration: new WebSocketLambdaIntegration("Disconnect", functions.realtime) },
      defaultRouteOptions: { integration: new WebSocketLambdaIntegration("Relay", functions.realtime) },
    })
    websocket.addRoute("social", { integration: new WebSocketLambdaIntegration("SocialCommands", functions.social) })
    const websocketStage = new WebSocketStage(this, "RealtimeStage", {
      webSocketApi: websocket,
      stageName: "v1",
      autoDeploy: true,
      throttle: { rateLimit: 20, burstLimit: 40 },
    })
    websocket.grantManageConnections(functions.realtime)
    websocket.grantManageConnections(functions.social)
    for (const fn of [functions.realtime, functions.social])
      fn.addEnvironment(
        "SOCKET_MANAGEMENT_URL",
        `https://${websocket.apiId}.execute-api.${this.region}.${this.urlSuffix}/v1`,
      )
    for (const prefix of ["relationships/", "profiles/", "battle-decisions/", "realtime/subscribers/"])
      data.addEventNotification(EventType.OBJECT_CREATED, new LambdaDestination(functions.realtime), { prefix })
    new CfnOutput(this, "WebSocketUrl", { value: websocketStage.url })
  }
}
