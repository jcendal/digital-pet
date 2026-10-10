# Contributing

## Set up the workspace

Use Node **24.11.0**, npm **11.6.1**, and Bun **1.3.5** as specified in
`package.json`. Install dependencies with `npm ci` from the repository root and
open that root folder in Cursor or VS Code.

Install the workspace's recommended **Biome** extension (`biomejs.biome`) and
**EditorConfig** extension (`editorconfig.editorconfig`). Select **Use Workspace
Version** when the editor asks which TypeScript version to use. Biome uses the
version installed in this repository, so editor formatting matches CI.

The shared `.vscode/settings.json` enables formatting on save and paste for
JavaScript, TypeScript, JSX/TSX, JSON/JSONC, and CSS. Saving explicitly also applies
Biome's safe lint fixes and organizes imports with the same Biome rule checked
by CI. The workspace uses the Biome-specific import action. The shared settings
select Biome for these
languages, so a globally installed formatter does not take over this workspace.
Markdown and YAML retain their own editor support; Biome does not own their
formatting here.

The workspace selects **Material Icon Theme** (`pkief.material-icon-theme`) for
folder and file icons, matching mobility. Install the recommended extension if
it is missing; the theme setting applies only to this workspace.

Optional recommendations adapted from the mobility workspace include path
completion, GitLens, GitHub Actions, YAML validation, and SVG preview. Each has a
use in this repository; Angular, Nx, Cucumber, and the mobility-specific tooling
are not needed here. Extension recommendations do not install extensions globally.

The **Run Task** menu exposes workspace checks, tests, and builds. The included
Extension Host launch configuration builds and opens the Cursor extension for
development with source maps and without minification. Use `npm run build:dev
--workspace cursor-digital-pet` for that build, or `npm run watch --workspace
cursor-digital-pet` to rebuild it on changes. Production and packaging retain
their minified build.

## Code conventions

`biome.json` is the source of truth for code style: two spaces, LF line endings,
120-column wrapping, double quotes, and semicolons only when needed. EditorConfig
also applies whitespace conventions in tools that do not use Biome. Do not
manually arrange code against the formatter.

- Write identifiers, comments, and repository documentation in English. Use
  `kebab-case` for files, `PascalCase` for types/classes, and `camelCase` for
  functions and variables. Use `SCREAMING_SNAKE_CASE` for fixed shared constants.
- Keep TypeScript strict. Prefer precise types and `unknown` at external
  boundaries; narrow values before use. Explicit `any`, unused imports/variables,
  `var`, loose equality, and type-only value imports are lint errors. Use `const`
  when a binding does not change and `import type` for type dependencies.
- Use package imports (`@jcendal/...`) across workspaces and relative imports
  within a workspace. Preserve explicit `.ts` extensions. Keep side effects at
  composition/entry points rather than in domain modules.
  Biome sorts imports by module source and imported names, merging compatible
  imports. Bare side-effect imports retain their order.
- Keep domain and application code independent of Cursor, OpenCode, and browser
  APIs. Use ports and adapters for host APIs and persistence. Extend existing
  shared modules rather than copying logic into each app.
- Keep user-facing copy in each package's `assets/i18n/en.json`, `ko.json`,
  `es.json`, and `gl.json`. Use a package-scoped `IntlModule` from
  `digital-pet-intl`; keep matching keys and `{name}` placeholders across all
  languages. Keep markup in renderers, not translation files. See
  [Digital Pet Intl](packages/digital-pet-intl/README.md) for the shared API and
  browser integration.
- Reuse shared CSS custom properties for colors and typography. Keep styles next
  to their view and preserve accessibility, keyboard interactions, reduced
  motion, and narrow-screen layouts.
- Add or update behavioral tests when logic changes. Keep tests in the affected
  workspace and use the existing Bun runner. Generated files and build output
  are not hand-authored sources.

Biome's recommended rules also report advisory warnings. Warnings remain visible
without blocking CI; configured errors and formatting differences block it. A
suppression must name one rule and explain the local exception. Do not disable
linting for entire browser sources.

## Browser scripts and styles

The shared views and web shell author styles in `.css` files and classic browser
scripts in `.browser.js` files. These are normal source files: Cursor can highlight
them and Biome can format and lint them. The browser scripts are plain JavaScript;
TypeScript checks the renderer imports, not the script bodies. Biome additionally
checks undeclared variables in these scripts. `acquireVsCodeApi` is supplied by
the editor host, and `createPanelHelpers` is composed with the Dex/History scripts.

Renderers import those assets as text:

```typescript
import styles from "./panel-styles.css" with { type: "text" }
import script from "./sidebar-client.browser.js" with { type: "text" }
```

Bun supports these imports in tests. esbuild embeds them in extension bundles;
the web Vite configuration translates them to raw imports. Web-only browser entry
points use normal module imports, and their CSS is processed by Vite. `types/web-assets.d.ts` supplies their TypeScript declarations; any new
workspace that consumes these renderers must include that file in its tsconfig.

Keep executable logic out of TypeScript template strings. A small renderer glue
string may call a browser initializer with JSON-serialized runtime configuration.
HTML templates remain in renderers: escape dynamic text with `escapeHtml`, escape
serialized JSON against script-tag termination, and use `textContent` when adding
user/catalog text to the DOM. Preserve existing CSP directives and script nonces.

## Validate changes

Run these commands from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run format` | Format all configured source and editor files |
| `npm run format:check` | Check formatting without writing |
| `npm run lint` | Check code rules without writing |
| `npm run lint:fix` | Apply safe lint fixes; review the resulting diff |
| `npm run imports:fix` | Organize imports with the same rule used on save and in CI |
| `npm run typecheck` | Check TypeScript across the workspace |
| `npm run check` | Check format, lint, workspace dependencies, and types |
| `npm run test` | Run workspace unit tests |
| `npm run test:persistence` | Run OpenCode SQLite persistence tests |
| `npm run build` | Build OpenCode, Cursor, and the web app |
| `npm run validate` | Run checks, unit tests, and builds together |

For focused work, run `npm run test --workspace <package-name>`. Pull request CI
checks formatting, lint, types, unit/persistence tests, all builds, and packaging.
In particular, changes to browser assets must pass both Bun tests and production
builds because both load the assets through different runtimes.

## Shared editor files

Git tracks only the workspace's settings, extension recommendations, tasks,
launch configuration, and `.cursor/rules/`. Cursor hooks, local MCP configuration,
editor history, credentials, and personal state remain ignored. Shared agent
guidance lives in `AGENTS.md`; the Cursor rule points to the same conventions so
the two cannot develop different code standards.

## Tooling references

- [Biome editor integration](https://biomejs.dev/reference/vscode/)
- [Biome configuration](https://biomejs.dev/reference/configuration/)
- [esbuild text loader](https://esbuild.github.io/content-types/#text)
