# Deploying the web backend

The implementation is web-only. The game stays in IndexedDB; Google only supplies
identity. AWS holds session metadata, social decisions, live routing and requested
private backup JSON. No DynamoDB, relational database, VM, VPC or NAT gateway is used.
There is exactly one AWS environment: **production**, using the existing website.
Automated tests run locally/CI with isolated fixtures; they create no AWS test
infrastructure. Nothing in local validation deploys resources or changes an existing
distribution. After deployment, verify the real integration using controlled
accounts on the production site before announcing availability.

## Infrastructure as code

The backend uses AWS CDK in TypeScript, which synthesizes CloudFormation. The
pinned local CDK CLI is installed by `npm ci`; no Terraform state or globally
installed CDK is required. AWS owns stack state in CloudFormation. The existing
static hosting distribution remains owned by `infra/web-digital-pet.yml`. The
commands below prepare and execute a CloudFormation change set against that
existing hosting stack; they never call `UpdateDistribution` directly. The
hosting template declares the API routes and the release role's scoped output
permission together. No distribution, website bucket, DNS or certificate is
imported into the backend stack or recreated by this integration.

Use Node/npm/Bun versions from CONTRIBUTING.md and AWS CLI v2. AWS credentials must
already be available through an SSO profile or short-lived role session. Commands
other than `synth` verify the caller's account against the configuration before
performing any operation. Local synthesis needs neither credentials nor AWS CLI.

1. Copy `packages/web-digital-pet-backend/deployment/production.example.json` to
   `production.local.json` in the same directory. Fill in the actual account, region,
   HTTPS website origin, distribution ID, hosting stack name/region, unique Cognito
   domain prefix, Google client ID, secret ARN and alert email. The backend region
   and hosting region are separate: this hosting template creates its CloudFront
   certificate in `us-east-1`. Local configuration and `.backend-deploy/` artifacts
   are ignored by Git. Example account IDs and domains are placeholders.
2. Create a Google **web** OAuth client with only `openid email`. Its authorized
   redirect is `https://<cognitoDomainPrefix>.auth.<region>.amazoncognito.com/oauth2/idpresponse`.
   Store the raw client secret (not a JSON wrapper) in Secrets Manager in the same
   account and region. The secret value must never enter repository variables,
   command history or browser bundles. Use Secrets Manager's secure console input
   or AWS CLI `--secret-string file://<private-file>` and remove the private file
   afterwards. Google client creation/consent is the external, one-time setup;
   AWS resource setup and deployments do not require using the AWS web console.
3. Reuse the existing production website, bucket, distribution and hosting stack.
   There is no additional domain, hosting stack, Cognito pool or backend for tests.
   The backend stack is `DigitalPetBackend-production`, with termination protection.
   The unified web release deploys only production and serializes publication. Do not rename an already deployed stack without a migration plan.
4. Authenticate to the target AWS account, then run the commands below from the
   repository root. `bootstrap` is needed once per account/region; it creates CDK
   deployment roles, an asset bucket and an ECR repository. These are deployment
   resources, not an application database or always-on server. Bootstrap requires
   elevated setup permissions; review CDK's execution-role policy before production
   use (its default is AdministratorAccess). Restrict deployment-role trust to the
   intended operators/workflow, and scope runtime permissions independently.

```sh
npm ci
npm run validate
npm run backend -- synth --environment production --config packages/web-digital-pet-backend/deployment/production.local.json
npm run backend -- bootstrap --environment production --config packages/web-digital-pet-backend/deployment/production.local.json
npm run backend -- preflight --environment production --config packages/web-digital-pet-backend/deployment/production.local.json
npm run backend -- plan --environment production --config packages/web-digital-pet-backend/deployment/production.local.json
# After reviewing the CloudFormation/IAM diff:
npm run backend -- deploy --environment production --config packages/web-digital-pet-backend/deployment/production.local.json
npm run backend -- cdn-plan --environment production --config packages/web-digital-pet-backend/deployment/production.local.json
# Review the AWS change set and .backend-deploy/production/hosting-changes.json before applying:
npm run backend -- cdn-apply --environment production --config packages/web-digital-pet-backend/deployment/production.local.json
```

`plan` reads the deployed stack and uses `cdk diff --change-set=false`; it does not
create a change set or deploy resources. `deploy` prints that diff again and then
applies it without an interactive confirmation. It is an explicit write command,
not a dry run. The CDN plan requires the backend's deployed `ApiOrigin`, so the
first deployment necessarily creates the backend before preparing CDN routing.
`cdn-plan` creates a reviewable CloudFormation change set but does not execute it.
It preserves existing hosting parameters and sets `BackendApiOrigin` and the exact
`BackendStackArn`. It accepts only in-place modifications to `WebDistribution`
and `WebDeployRole`, plus the dependent `WebDnsA`/`WebDnsAAAA` alias refreshes that
CloudFormation reports for `WebDistribution.DomainName`. DNS changes must be dynamic,
non-replacing resource-attribute dependencies affecting only `AliasTarget`; direct
DNS edits, additions, removals, replacements and unrelated resources
require a separate hosting review. Preserve the backend parameter values on all
future hosting updates. Clearing both intentionally disables the backend routes.

`preflight` is read-only and also runs before `plan` and `deploy`. It verifies the
AWS account, ownership of the hosting stack/site/distribution, optional publication
bucket, secret metadata and the shared Lambda concurrency pool. It never reads the
Google secret value. Production uses the account's existing **10 unreserved
concurrent executions**, shared by all backend handlers, the deployment helper
and any other unreserved functions in the region. No per-function reservations,
provisioned concurrency or quota increase are requested. Preflight accepts this
pool and only rejects invalid responses or zero shared capacity. It does not
require 100 spare units because it creates no reservations.

API Gateway route throttles and application quotas remain enabled. At the shared
limit, synchronous requests may be throttled and asynchronous delivery may be
retried. Measure real workflow latency and throttles after deployment; the quota
is not a limit on connected players and this configuration does not guarantee
capacity for an unmeasured workload. Never automatically replay an ambiguous
mutation with a new operation ID.

`alertEmail` / `ALERT_EMAIL` is required by online preflight. The backend creates
an SNS email subscription and connects all ten application/execution error alarms.
The recipient must confirm the SNS subscription after deployment. Alarms exist
before confirmation but cannot deliver email until it is confirmed. Missing-data
and billing policies remain operational choices; configure AWS Budgets for the
actual spending threshold separately.

`deploy` also writes validated public outputs to
`.backend-deploy/production/outputs.json` and `web.env`. To refresh them later,
use `npm run backend -- outputs` with the same production/config arguments.
For a local static build, source the generated file and export its two values:

```sh
set -a
. .backend-deploy/production/web.env
set +a
npm run build:static --workspace @jcendal/web-digital-pet
# Set AWS_REGION, WEB_BUCKET_NAME and WEB_DISTRIBUTION_ID for the same site:
bash scripts/publish-web.sh
```

The outputs include `ApiOrigin`, `WebSocketUrl`, `BackupOrigin`, `BackupBucket`,
`IdentityRedirect` and `PublicOrigin`. Only `WebSocketUrl` and `BackupOrigin` become
public web build settings. The exporter checks their expected AWS URL formats and
rejects duplicate/missing outputs and newline injection. Secrets and refresh tokens
never enter the browser. The backend does not continuously back up local progress.

## GitHub Actions

`release-web.yml` is the single publication entry point for both the frontend and
backend. Merging a relevant PR into `main` triggers `release-after-merge.yml`, which
selects the web product and starts and monitors its release automatically. Changes
to the backend, frontend, online contracts, shared browser dependencies, deployment
scripts or hosting template all select this release. Documentation-only and
unrelated host changes do not select it. Direct pushes are not the release trigger;
use the reviewed PR merge flow. Bot version commits therefore do not create release
loops. Manual dispatch remains available for a version bump or a `retry_tag`.

The release creates a version tag, then checks out that exact tag for validation,
backend deployment and the connected frontend build. It runs the Chromium suite
against local fixtures before obtaining AWS credentials; a failed game, migration,
backup, social or connection check stops publication. These checks create no AWS
test environment. The job authenticates through the `web-production` OIDC role,
creates/updates the backend with CDK, prepares CDN routing, exports the deployed
backend outputs, builds the connected web, applies routing and waits for CloudFront
before publishing the web. CDK leaves unchanged resources in place. There is no
second frontend-only publishing job and no optional fallback to empty backend URLs.
The publication lock serializes releases; backend/CDN/S3 publication is not atomic.

`plan-web-infrastructure.yml` is an optional manual diagnostic workflow on `main`.
It runs preflight and the infrastructure plan, never deploys or publishes the website, and
uses the same lock so it does not inspect a partially completed release. Bootstrap
remains a one-time administrator CLI operation, outside the deployment workflow.
No permanent AWS access keys are stored in GitHub.

Use the GitHub environment `web-production` to hold these variables. This is a
GitHub deployment configuration, not an additional AWS environment:

| Variable | Value |
| --- | --- |
| `AWS_ACCOUNT_ID`, `AWS_REGION` | Explicit target account and backend region |
| `PUBLIC_ORIGIN` | Exact HTTPS site origin, without trailing slash |
| `COGNITO_DOMAIN_PREFIX` | Unique environment-specific prefix |
| `GOOGLE_CLIENT_ID`, `GOOGLE_SECRET_ARN` | Client identifier and existing secret ARN; no secret value |
| `WEB_DISTRIBUTION_ID`, `WEB_BUCKET_NAME` | The existing production static hosting |
| `WEB_STACK_NAME`, `WEB_STACK_REGION` | Stack that owns that site; hosting template uses `us-east-1` |
| `ALERT_EMAIL` | Operator email; SNS subscription confirmation required |
| `BACKEND_DEPLOY_ROLE_ARN` | OIDC role allowed to deploy this environment |

Configure the role's OIDC trust for this repository and the selected GitHub
**environment**, including audience `sts.amazonaws.com`; an environment job has a
different subject from the existing branch-based release job. Apply GitHub
environment branch restrictions (main) and production protection rules as needed.
The role needs CDK deployment/bootstrap-role access, CloudFormation read access,
Secrets Manager **DescribeSecret** for the supplied ARN and Lambda
GetAccountSettings for preflight. Hosting integration needs DescribeStacks, CreateChangeSet,
DescribeChangeSet and ExecuteChangeSet on the hosting stack/change sets, plus
CloudFront GetDistribution/CreateInvalidation and list/upload access to the static
bucket. Resolving existing hosting attributes also requires scoped read access to
its origin access control, CloudFront function, ACM certificate and hosted zone.
CloudFormation needs authorization to refresh the existing A/AAAA aliases with
UPSERT, limited to `digital-pet.rebase.es` in that zone, and to update the hosting distribution and
release-role policy (through the stack execution role, or the invoking identity
when the existing stack has no execution role). Do not assume the static publishing
role has these deployment permissions. The backend execution role must resolve the
Google secret and create the resources/IAM policies declared by the CDK stack. Bootstrap should initially be run
locally by an administrator; do not grant the normal CI role blanket administrative
access solely to allow recurring bootstrap. No role or account trust is created by
the workflow itself.

The one-time access template is `infra/github-backend-deploy.yml`. Apply it as a
separate CloudFormation stack, `digital-pet-github-access`, in the backend region
using an administrator session and `CAPABILITY_NAMED_IAM`. Supply the existing
`WebBucketName`, `WebDistributionId`, `WebDeployRoleName`, `WebOriginAccessControlId`,
`WebCertificateArn` and `WebHostedZoneId`. These identify existing hosting resources,
not secrets. Update an existing access stack with these additional identifiers
before using the unified release. Its output
`BackendDeployRoleArn` becomes the GitHub environment variable
`BACKEND_DEPLOY_ROLE_ARN`. It reuses the existing GitHub OIDC provider and trusts
the repository's immutable subject
`repo:jcendal@29627990/digital-pet@1363502452:environment:web-production`.
Configure the GitHub environment to allow only the `main` branch before applying
the access template. The default metadata permission expects the future Google
secret to be named `digital-pet/production/google-oauth`; use `GoogleSecretName`
to choose a different name. This parameter is a name, never the secret value.

The access role delegates provisioning to the CDK bootstrap roles. The bootstrap
execution role currently uses `AdministratorAccess`, so CI deployment access is
privileged even though direct hosting permissions are scoped. Protect changes to
workflow and infrastructure code accordingly. Direct hosting mutations are limited
to the existing distribution, publishing role and A/AAAA site aliases, through CloudFormation. The
access stack does not change the website, create application resources, or alter
the Lambda concurrency quota. The CI role does not receive permissions to maintain
this access stack or re-bootstrap CDK directly.

Every web release uses `BACKEND_DEPLOY_ROLE_ARN` and the variables in
`web-production`, including hosting variables that were previously repository-only.
The frontend URLs come from that run's validated backend stack outputs. Repository
variables `BACKEND_STACK_NAME`, `DIGITAL_PET_WEBSOCKET_URL`,
`DIGITAL_PET_BACKUP_ORIGIN` and `AWS_ROLE_ARN` are no longer consumed by the web
release. The existing hosting role is retained for compatibility with the hosting
stack; removing that IAM resource is a separate infrastructure migration.

If publication fails after the tag is created, dispatch `Release Digital Pet web`
from `main` with that tag in `retry_tag`; this retries the same frontend and backend
revision without creating another version. Tags predating the deployment scripts
are rejected before AWS authentication. A historical retry can change backend
resources too: review its infrastructure diff and storage/API compatibility first.

## Event-driven infrastructure

There are five application Lambdas. CDK adds a sixth, deployment-only helper for
S3 bucket notification configuration. The metadata bucket has four ObjectCreated
prefixes: `relationships/`, `profiles/`, `battle-decisions/`, and
`realtime/subscribers/`, targeting realtime. Do not configure the entire bucket:
only committed changes should produce hints, and routing writes must not create
notification loops. S3 delivery may repeat or reorder events.

The WebSocket `social` route invokes the social Lambda; register/open/resume/relay
invoke realtime. Both receive the exact `SOCKET_MANAGEMENT_URL` and scoped
ManageConnections permissions. Social also reads session metadata for per-message
authorization; neither handler receives refresh-token decryption rights. Large
reads and backups keep their existing HTTP routes.

Verify all four bucket notifications and Lambda invoke permission after deployment.
Inject a transient hint-delivery failure, verify asynchronous retries, and inspect
Lambda Errors/Throttles/AsyncEventsDropped. Recovery must work by reopening the
social view or reconnecting even when the push is lost. Measure idle connections
for longer than ten minutes: AWS reconnects are expected, repeated inbox polling
or endpoint heartbeats are not. Test concurrent tabs and two devices, including
late disconnect events from an older connection.

## Existing CloudFront distribution

`cdn-plan` checks that the named hosting stack owns the configured distribution
and serves `PUBLIC_ORIGIN`. It stores the immutable AWS change-set ARN, stack
update timestamp, distribution ETag and expected backend outputs in
`.backend-deploy/production/hosting-plan.json`. The detailed resource change
set is saved alongside it as `hosting-changes.json`. Keep these files private.

`cdn-apply` fetches the change set from AWS, rechecks its scope, account, stack,
parameters, timestamp and ETag, and refuses stale or incompatible plans. It runs
CloudFormation and waits for stack completion and CloudFront propagation before
the workflow publishes the web. An explicit empty change set is a no-op; a failed
or obsolete change set is an error. After a completed/failed execution, prepare a
fresh plan before retrying. CloudFormation retains the template as the source of
truth, so future updates preserve the backend routing.

The template adds `/auth/*` and `/api/v1/*` with caching disabled and AWS's
all-viewer-except-Host policy. Cookies, OAuth query parameters and CSRF/account
headers reach the API. These behaviors have no static-site rewrite function;
`/api/browser.json` remains static. Never introduce global custom error responses
that replace private API errors with cached HTML.

Review a rollback as another hosting change set. Keep backend parameters for a
web-only rollback; intentionally clear **both** `BackendApiOrigin` and
`BackendStackArn` only when removing the API integration. Never restore CDN JSON
outside CloudFormation. Never cache auth, API or signed backup traffic in the
service worker/CDN.

## Verification after production deployment

- Complete real Google login/callback, session refresh and logout. Verify the
  HttpOnly Secure host cookie and the two-hour access window. Sessions are capped
  at 365 days; Google or Cognito can still require a new login.
- Open an existing local save and adopt it. Confirm the game does not change and
  no backup appears until the user requests one. Old public friend codes are not
  ownership proofs; contacts must be added again using account codes.
- Make, preview, restore and delete a private copy. Confirm the previous local
  game is retained and a second account cannot access the first account's URLs
  through the API. Signed URLs are short-lived bearer capabilities.
- Send an invitation and a gift, close the sender, then reconnect the recipient.
  Test removing friendship with a pending gift/prepared exchange, and replaying a
  committed exchange after losing its socket response. Claims require connectivity.
- Complete/decline battles and pair two devices; test reconnect/reload, large
  transfers, account switches, stale codes and two tabs. Check actual API Gateway
  frame limits, S3 conditional writes, origin checks and mobile suspend/resume.
- Inspect Lambda errors/throttles, API Gateway latency and S3 request counts. Set
  AWS Budgets and alarm recipients for the intended account. The templates create
  execution-error alarms and `backend-failure` log metrics/application-failure
  alarms for all five application handlers; verify a confirmed SNS subscription
  to the configured operator email and test delivery. Investigate structured events by operation, status
  and gateway request ID. Client identifiers are hashed, and raw exceptions,
  tokens, payloads and saved games are intentionally absent from diagnostics.
- Run `npm audit` with registry access. Do not treat an offline npm report as an
  audit. Review CDK build-time advisories separately from shipped Lambda code.

Application logout durably revokes the opaque session before attempting Cognito
revocation. If Cognito is unavailable, subsequent app/relay requests still fail;
provider revocation is best effort. Refresh tokens are encrypted with KMS and are
never exposed to web code. This is an explicit availability tradeoff, not an email
or background-job queue.

## Rollback

Roll back through a reviewed PR and the unified release, or retry a known compatible
release tag. Removing GitHub variables no longer disables cloud features: missing
configuration must fail publication. Disabling cloud features requires an explicit
frontend/configuration change that preserves local saves and JSON import/export. Preserve all
three buckets and the KMS key; the stack uses retain policies. Do not roll back the
IndexedDB schema or force old pages to write version-1 storage. Existing cloud
backups remain private and recoverable after services are re-enabled. A rollback
does not silently bring PeerJS back.

The HTTP [OpenAPI inventory](../packages/web-digital-pet-backend/docs/openapi.json)
and shared protocol validators define the versioned API surface. The current
backend test suite also exercises recovery after a rotated-token publication fails;
the 60-second Cognito grace must remain longer than the 30-second refresh claim.

## Tooling references

- [AWS CDK deployment and cloud assemblies](https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-deploy.html)
- [Read-only CDK diff options](https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-diff.html)
- [CDK bootstrap permissions](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html)
- [GitHub OIDC with AWS and environment subjects](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

The [Lambda concurrency guard](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html)
checks that the regional shared pool has nonzero capacity without requesting reservations. Hosting
updates follow [CloudFormation change-set review](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets-view.html).
