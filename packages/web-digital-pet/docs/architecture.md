# Web package architecture

The package is organized by runtime first, then by feature or responsibility.
Browser code never imports the Node server. Host-independent state and validation
live outside both runtimes. Build orchestration stays outside application source.

```text
src/
  client/
    shell/             Navigation and the browser entrypoint
    bridge/            Integration with the shared iframe clients
    features/
      partner/         Animation, eating and evolution presentation
      options/         Options controller and styles
      pairing/         Pairing controller and AWS WebSocket transport
      world/           World selection and landscape presentation
    persistence/       IndexedDB saves and browser world preferences
    platform/          Resource URLs, local API availability, save selection, PWA registration
    presentation/      Composition of browser-save models for the shared views
    styles/            Common web styling
  server/
    main.ts            Explicit local server startup
    http/              Routes, asset responses and HTTP cache headers
    persistence/       Read-only SQLite adapter
    rendering/         HTML, host models and Vite resource-manifest adapter
  domain/
    pet/               Web save state, progression and archive conversion
    transfer/          Backup/transfer contract and validation
  shared/              Runtime-independent scene-motion data and calculations
  worker/              Workbox service worker, compiled independently
  types/               Ambient Vite and virtual-module declarations
assets/                Source icons, application manifest and documentation screenshots
scripts/               Developer command entrypoints
tooling/              Vite plugins, static rendering and architecture checks
tests/
  unit/               Client, server, domain, shared and integration tests
  e2e/                Compiled-web and service-worker checks in Chromium
```

`client` and `server` can import their own area plus `domain` and `shared`.
`worker` can import its own area plus `domain` and `shared`. `domain` and `shared`
must remain independent of DOM, browser storage, Node and the other runtimes.
Shared game rules, animation and reusable HTML continue to belong to the existing
workspace packages.

The [web backend service design](../../../docs/web-backend-service-design.md)
describes the implemented AWS integration for Google accounts, manual S3 snapshots,
durable social operations and a shared WebSocket for social commands, notifications
and battle/device-transfer channels. The active
game remains local; there is no continuous cloud gameplay synchronization. Online
features are enabled only when the static build supplies the two service origins.
The [deployment runbook](../../../docs/web-backend-deployment.md) covers real Google,
AWS and CDN configuration; local tests do not deploy those resources.

Client features use persistence/platform adapters and shared workspace packages.
`client/presentation/browser-session.ts` composes those pieces for the iframe
bridge and browser panels; it is not a portable domain API. Keep CSS with its
owning feature or entrypoint, using `client/styles` only for common web styles.
Keep executable startup at the shell/frame entries, `server/main.ts`, the worker,
and build/development command entrypoints.

## Online transport layers

`platform/online-wire.ts` owns the single physical connection, browser lock,
session replacement and native WebSocket reconnection through `partysocket/ws`.
`online-requests.ts` correlates promises, assembles bounded fragments and uses
`p-queue` for four concurrent RPCs (32 total, 25-second overall deadline). `online-socket.ts` owns
feature namespaces and logical links; `online-connection.ts` owns ordered frames.
Feature controllers retain their existing battle, exchange and transfer semantics.

`online-api.ts` owns the authenticated API facade. `online-rpc.ts` injects socket
command delivery without a circular import. Social reads and mutations wait for
the socket; large payloads use bounded fragments. Disconnects cancel outstanding
requests; neither the socket library nor the promise queue replays commands. `online-events.ts` distributes small local
invalidation notices across tabs. SocialSession reconciles on these events,
connection/view lifecycle and actual pending deadlines, with no periodic polling.
Local care ticks do not upload progress or unchanged presence.

The backend's `social-application.ts` is shared by HTTP and socket adapters. Domain
services depend on storage/delivery ports, composed with AWS adapters in handlers.
Authentication and S3 backup upload/download remain HTTPS. Detailed contracts and
failure boundaries are in the linked service design, not in rendering templates.

## Adding or removing code

### Public legal documents

`/legal/privacy` and `/legal/terms` are standalone Spanish HTML documents with
matching PDF downloads at the same URLs plus `.pdf`. They need neither JavaScript
nor an account. The game links to them before login and from Options. The online
account notice declares the 18+ eligibility rule; it is not identity or age
verification. The game without an account remains available to all audiences.

The shared editorial source is `src/server/legal/documents.es.json`. To update it,
format the JSON, then run `npm run legal:pdf --workspace @jcendal/web-digital-pet`
with Python 3 and `reportlab==4.4.9` installed. Inspect the resulting PDF pages
before committing the source, both PDFs and `assets/legal/manifest.json`. The
static export checks the source and PDF hashes and fails on stale documents;
deployment does not need Python. Keep the text aligned with actual data handling.

`tooling/export-legal.ts` exports HTML and PDFs. The publisher uploads HTML to
extensionless S3 keys with an explicit HTML MIME type, uploads the PDFs with their
PDF MIME type, and invalidates `/legal/*`. These stable, revalidated documents
are separate from the immutable game asset inventory and service worker cache.
No additional Lambda or CloudFront function is involved. Local HTTP and Vite
preview expose the same public URLs.

The legal text reflects the owner's supplied contact details and the account
eligibility decision. Supporting references: [AEPD information duties](https://www.aepd.es/derechos-y-deberes/conoce-tus-derechos/derecho-de-informacion),
[AEPD on minors](https://www.aepd.es/preguntas-frecuentes/10-menores-y-educacion/FAQ-1002-se-puede-recabar-y-tratar-datos-personales-de-menores),
and [AWS data processing and transfers](https://aws.amazon.com/compliance/gdpr-center/).
Publishing documents alone does not verify compliance or implement an age
verification system. Account erasure requests currently use the public contact
address and require the operator to process them.

### Source boundaries

- Add a file to its owning directory; do not put implementation files in `src/`.
- Prefer direct imports and explicit dynamic imports. Avoid unused barrel exports.
- Add browser features under `client/features/<feature>` and keep Node imports in
  the server or tooling. Read/write browser persistence belongs in its adapter.
- Declare client entries once in `server/rendering/build-resources.ts`; Vite,
  development and production rendering consume that definition.
- Add assets through the existing inventory, not another list in the HTTP router
  or service worker. See [Web caching](../../../docs/web-caching.md).
- Keep unit tests under `tests/unit` and browser tests under `tests/e2e`.

`npm run check` in this package runs the architecture guard and separate client,
server and worker TypeScript checks. The guard parses static/dynamic imports,
checks runtime boundaries and missing local dependencies, and reports runtime
source/CSS files unreachable from the declared entrypoints. Ambient declarations
are excluded from reachability checks. Source files outside the owning areas are
rejected. This is a local dependency check, not a substitute for the workspace's
shared-package boundary checks or browser tests.
