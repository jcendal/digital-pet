# LCD and Color theme implementation plan

Add an **Options → Theme → LCD / Color** setting to Web, Cursor and
OpenCode. The selected theme must apply to the whole Digital Pet presentation:
creatures, eggs, attacks, effects, portraits, controls, panels, scenery and maps
where those surfaces exist. Keep the current LCD version available and make
Color a complete presentation of the same game.

This is the full implementation plan. The shared foundation and a first Web
integration are implemented below. Cursor and native OpenCode integration remain
incomplete; this is not yet a complete cross-host release. Baseline:
`bb92bc263d1447de67a44a756ce5127796ff72c9`, reviewed on 2026-10-29. Work branch:
`feat/lcd-color-implementation-plan`. Repository documentation is in English as
required by `CONTRIBUTING.md`.

Implementation branches must use `feat/` or another user-approved prefix, never
`codex/`. Keep Git transport on SSH. If authentication fails, open the user's
terminal and provide the exact command to execute; do not switch Git to HTTP/HTTPS.

## Product decisions

1. Use the shared values `lcd` and `color`, with **LCD as the migration and initial
   default**. Missing or invalid settings resolve to LCD. The user can always
   switch back without resetting a companion.
2. The setting is a **host presentation preference**, not a property of a Digimon
   or its save. Web, Cursor and OpenCode each expose and persist it. Two hosts may
   display the same SQLite companion in different themes simultaneously.
3. Apply changes live, including already open panels. A visual change must not
   restart a battle, resolve an evolution, consume food, award EXP, alter RNG,
   interrupt an exchange, or reset timers. Preserve the current animation pose,
   direction, position and elapsed presentation time.
4. Cover browser saves, the web app's computer-save mode, installed PWA/offline
   use, Cursor webviews and OpenCode's native terminal UI. Opening the web app from
   OpenCode does not substitute for color inside OpenCode.
5. Preserve catalog IDs, evolution rules, stage assignments, canonical aliases,
   attack damage, save formats and peer protocols. The upstream release is an art
   source; replacing this repository's game catalog is outside this change.
6. Preserve existing feature availability per host. Web-only maps, team flows and
   multiplayer receive both themes; this work does not introduce those features
   into hosts that do not currently have them. Every host still gets its own
   accessible Options control and full styling for its existing surfaces.
7. Every visual consumer must explicitly handle both themes. Runtime fallback for
   a damaged/missing asset is a resilience feature, not evidence of completed
   color coverage. Known unresolved art must be visible in the coverage report
   and resolved or explicitly documented before release.

## Findings from the repository and sources

### The current pipeline discards color

[`monster-frame-catalog.ts`](../packages/digital-pet-core/src/data/monster-frame-catalog.ts)
stores each frame as `content: string`. Half-block glyphs encode a 16 × 16 image
in 16 columns and 8 text rows. Animation composition and mirroring manipulate
those strings. The browser reconstructs rectangles with `fill="currentColor"`;
portraits usually collapse the image into one SVG path. The terminal assigns
plain strings to `TextRenderable.content`.

Changing the catalog alone cannot deliver color. Color needs to survive idle
animation, battle composition, evolution, defeat, exchanges, messages, model
generation and final rendering. CSS tinting cannot recover the lost palette.

| Workspace | Current responsibility and concrete change points |
| --- | --- |
| `digital-pet-core` | `src/config/{types,defaults,normalize}.ts`; stable species and attack identities in `src/data/`; legacy `MonsterFrameCatalog`. Define the theme identifier/normalization and reviewed identity crosswalk without changing gameplay data. |
| `digital-pet-animation` | `src/idle/monster-animation.ts`, `monster-artwork-mirror.ts`, `src/render/`, all `src/sequences/` and `src/sessions/`. Introduce color-preserving assets and scenes, retain LCD art and shared timing. |
| `digital-pet-webviews` | `src/sidebar/`, `src/panels/{dex,history,team,world}/`, `src/shared/{pixel-artwork,companion-portrait,exchange-artwork,theme}.*`. Replace monochrome-only contracts and paint both modes. |
| `digital-pet-fields` | `src/data/{regions,world-map}.ts`, `assets/scenes/`, `assets/maps/`, `assets/backgrounds/`. Own paired scenery/map art, keeping region IDs and geography. |
| `digital-pet-intl` | Shared localization machinery and matching-key checks. Add host/package copy to the existing four locale catalogs; no new translation system. |
| `web-digital-pet` | Options, shell/iframe bridge, browser sessions, server-side computer-save models, combat/social viewers, resource inventory and service worker. Own browser preference and synchronization. |
| `cursor-digital-pet` | Settings contributions, command registration, container, sidebar provider/orchestrator/animation host, open Dex/History panels and esbuild packaging. Own native setting and webview propagation. |
| `opencode-digital-pet` | Global JSON settings, `src/tui.tsx`, `src/tui/sidebar-card.tsx`, command layer and dialogs. Add native Options and terminal color rendering. |
| Root tooling/docs | Asset importers/checks, CI, attribution, design prototypes and release documentation. Generate and verify both themes rather than hand-editing generated output. |

### Upstream color catalog

The supplied [v0.4.1 catalog](https://github.com/sbugallo/opencode-vpet/blob/v0.4.1/src/data/digimon-data.ts)
and [color frames](https://github.com/sbugallo/opencode-vpet/blob/v0.4.1/src/data/monster-color-frames.ts)
were read directly. The tag resolved to commit
`ce7b62995b69f0ead1c264626407ad401d6209a6`. The
[planning audit](lcd-color-source-audit.json) records source SHA-256 values and a
candidate match for every local catalog entry. It is **not an approved mapping**.

| Measurement | Result |
| --- | ---: |
| Existing saved catalog identities, including generic egg | 650 |
| Existing distinct sprite keys, including one empty key | 639 |
| Upstream color sprite records | 1,168 |
| Local entries matched by exact sprite key | 499 |
| Local entries without an exact sprite-key match | 151 |
| Local entries with a unique candidate by corrected official-reference directory | 648 |
| Entries without that reference candidate | 2 |
| Upstream records with all 12 published poses | 1,160 |
| Upstream records with only the two walking poses | 8 |

All 1,168 compressed blobs decoded with the expected length and valid palette
indices in the audit. Each contains 16 × 16 palette-indexed frames; index zero is
transparent. Palettes contain 3–195 opaque colors. The source TypeScript file is
1,205,865 bytes, which is not the size of a shipped browser bundle or decoded heap.

The [upstream frame catalog](https://github.com/sbugallo/opencode-vpet/blob/v0.4.1/src/data/monster-frame-catalog.ts)
uses `node:zlib`, `Buffer`, and lazy decompression. Copying it into a browser
dependency would violate the client runtime boundary. Decode at import/build
time and generate a browser-compatible asset representation.

The new catalog also uses IDs such as `A-086` and different stage categories.
Current saves use IDs such as `4-054`. Keep the local IDs and use a separate art
crosswalk. Do not import upstream evolution edges or stage changes with sprites.

### Identity and pose review is required

Exact string replacement of underscores with hyphens is insufficient. Even an
official-reference join is a candidate, because legacy references can distinguish
forms differently from the newer source.

| Local identity | Finding and planned treatment |
| --- | --- |
| Greymon `4-054` | The legacy `directory_name=greymon` joins upstream `greymon-2010`, while classic Greymon uses `greymon-vaccine` and `greymon-first`. Compare current art and intended identity, then record the explicit mapping. Do not auto-accept the URL join. |
| MetalGreymon `5-086` and `5-087` | Both use `metalgreymon_vaccine` locally. The first legacy reference has no exact upstream match; the second maps to `metalgreymon-vaccine`. Preserve both save IDs and review whether they intentionally share art. |
| Whamon `4-141` and `5-141` | Shared legacy sprite/reference joins the Perfect form. Review the Adult/Perfect visual variants separately without changing the local stages. |
| Minomon `2-033` | The legacy sprite key is empty; upstream `minomon` exists. Resolve by node ID rather than an empty sprite-key lookup. LCD's existing missing-art behavior needs an explicit compatibility decision. |
| DoneDevimon `5-033` | Apply `catalog-corrections.json` before matching. Raw generated data still contains the old NeoDevimon identity. |
| DORUguremon legacy alias `5-146` | Preserve its save ID and current canonical mapping; art deduplication must not delete history or routes. |
| Generic egg `0-001` | No species-reference match. Give it an explicit generic color design and separately honor regional origin designs. |
| X forms, modes, Armor/Hybrid categories | Review variant identity independently of upstream stage taxonomy. The audit flags taxonomy differences; these are not instructions to rebalance the game. |

The legacy pose set includes `attack`, `injured_1`, and `injured_2`; upstream has
`attack_1`, `attack_2`, and `sick`. Neither injury pose can be assumed to equal a
particular attack pose. Build a reviewed semantic pose map. Reuse exact matching
walk/eat/sleep/happy/angry/refuse poses; review attack timing and choose a verified
injury/lose source or a deliberate same-species reaction. Never silently call an
attack frame an injury frame. Missing optional poses may reuse another reviewed
pose of the same creature and must appear in the report.

### Omnipet supplies attacks and other color art

Read the [OpenAPI schema](https://digimon-db.omnipet.app.br/openapi.json),
[Agumon's record](https://digimon-db.omnipet.app.br/api/digimon/agumon),
[DMC resolved module](https://digimon-db.omnipet.app.br/api/gathering/dmc),
[PENC resolved module](https://digimon-db.omnipet.app.br/api/gathering/penc) and
[Digitama listing](https://digimon-db.omnipet.app.br/api/digitamas).

| Resource | Verified availability and integration consequence |
| --- | --- |
| Creature frames | `/api/digimon/{id}/sheet/color/frame/{frame}`, optional `module`; full-sheet endpoint also exists. Global and device frame orders differ. Read the module templates instead of assuming frame numbers. |
| DMC/PENC attacks | Both resolved modules expose the `dmc` attack bank with 117 entries. Use each supplied blob URL and resolved `attack_sprite`; there is no basis for inventing `/api/attacks/color/...`. |
| Agumon's projectile | Resolved DMC/PENC `attack_sprite` is 1. Generic species data says `atk_main: 2`. This confirms the existing indexing warning; never apply a blanket guessed offset to every source. |
| Digitamas | 44 designs advertise color and dot formats. Fetch the same numbered designs already assigned to the ten regional origins, including both animation frames. |
| Miscellaneous resources | DMC exposes care, training, battle, animation, menu and background groups; PENC exposes care, battle, animation, menu and background groups. These are source candidates, not yet reviewed game mappings. |
| Provenance | Resolved entries include device, target and source evidence. Preserve those fields and source checksums through import. |

Three PNG samples were decoded and visually inspected: Agumon color frame 0 is
48 × 48 with 10 opaque RGB colors; Digitama 10 color frame 0 is 48 × 48 with 5;
DMC attack 1 is 24 × 24 with 2. All three use alpha values 0 and 255. Ignore RGB
values of fully transparent pixels, including green guide/background pixels.
These samples do not establish dimensions or grid alignment for every resource.

The existing attack importer already retains original color PNGs but derives
monochrome 8 × 8 artwork. The local manifest has **265 projectiles**, including
**28 DMC** images. Existing assignments cover **526/650 nodes**; 124 entries use
the flame fallback. Those numbers describe the current LCD assignment policy,
not proven color coverage. Add independent color assignments and preserve the
current LCD selection, whose priority begins with classic Pendulum.

For color, prefer reviewed color-device assignments (initially DMC/PENC where
evidence exists), then other verified color banks. Keep main/alternate attacks,
bank, device and version distinct. A numeric index in one bank is not a universal
projectile ID. Missing assignments get a documented generic color projectile;
they do not inherit an unrelated creature's supposed attack or change damage.

The upstream [attributions](https://github.com/sbugallo/opencode-vpet/blob/v0.4.1/README.md#attributions)
identify Omnipet and [Tortoiseshel's color sprites](https://withthewill.net/threads/full-color-digimon-dot-sprites.25843/).
Omnipet's [Sources and Tools](https://digimon-db.omnipet.app.br/sources) also names
the DMC Sprite Database. Retain original credits and the upstream code license
when adapting code; do not label every community sprite an official Bandai asset.

## Shared presentation architecture

### Ownership and contracts

Treat LCD and Color as complete **themes** at every layer: configuration,
contracts, asset resolution, CSS tokens, native terminal presentation and Options.
Use `theme` as the preference key and `VisualThemeId` as its type. Do not introduce
a parallel `colorEnabled` flag or conflate this preference with the editor's
light/dark theme. `VisualTheme` groups the theme's identity and presentation tokens;
asset resolvers use that same identity for monsters, attacks, effects and scenery.
Each host persists its own selection of the shared theme contract.

Keep `VisualThemeId = "lcd" | "color"` and normalization in core configuration.
Core owns stable species-to-source and attack assignment metadata; animation owns
visual asset data, palette/frame types, geometry, effects and scene composition.
Webviews owns SVG/DOM painting and shared CSS. Fields owns world art. Host code
owns persistence, UI events and scheduling integration. Do not add a core import
of animation and create a dependency cycle.

Introduce these conceptual contracts under animation (names are proposed):

| Contract | Required information |
| --- | --- |
| `VisualAssetCatalog` | Resolve local node/egg/attack/effect identity plus pose and theme; return a frame and explicit fallback/source status. Resolution by node ID must support empty/duplicate legacy sprite keys. |
| `PixelFrame` | Width, height, palette, row-major pixel indices and transparent index. Stable asset/pose identity belongs to the resolver. Preserve opacity required by effects and transparent source pixels. Validate dimensions and palette bounds. |
| `VisualScene` | Viewport in pixel units, layered assets, integer position, facing, scale, opacity and effect geometry. Keep semantic HUD/captions alongside the scene for localization and accessibility. Creature and projectile palettes remain independent. |
| `PresentationSnapshot` | Current sequence, pose, elapsed time, identities and state needed to repaint the same scene in either theme without replaying game actions. |
| Wire representation | Versioned, bounded, JSON-safe scene/frame descriptors. Define serialization explicitly; do not rely on `Uint8Array` JSON conversion or send executable SVG/HTML from peers. |

The new scene becomes the common visual output. Keep a compatibility adapter for
legacy LCD string output while migrating callers; remove monochrome-only paths
from Color consumers before release. Retain the existing LCD frames as their own
asset set: thresholding new color pixels would change established LCD designs.

At import time decode upstream zlib blobs and PNGs into deterministic portable
palette data. Generate a runtime index containing only approved current-roster
assets and origins; archive unused sources outside the shipped index. Measure
generated bundle size before choosing chunk boundaries. Do not inflate the
complete upstream roster on every frame or include all 1,168 species by accident.

Generate LCD and color representations through one resolver. Cache by at least
theme, asset version, identity, pose and facing; include viewport/scale where
relevant. Color pixels are mirrored spatially, without swapping palette indices.
Keep the native 16 × 16 creature grid, 8 terminal rows and current alignment rules.
Larger sources need declared source-to-game scale and anchors, not implicit
stretching or a forced crop to 16 × 16.

### Scene and animation migration

Refactor all producers before treating the setting as complete:

- Idle/actions: `idle/monster-animation.ts`, action/walking policies and
  `render/positioned-artwork.ts`. Output semantic pose/identity as well as motion
  so a theme change does not reset the controller or consume another random draw.
- Eggs: `render/digitama-artwork.ts`. Replace frame-object identity checks for
  choosing the second egg pose with explicit pose data. Preserve origin designs,
  75% principal-egg scale and centered collection previews.
- Battles: `sequences/evolution-battle-artwork.ts` and `attack-artwork.ts`.
  Compose two creature palettes, independently selected projectiles and impacts;
  preserve mirroring, travel, hit/miss timing, scores and outcome captions.
- Evolution: `sequences/evolution-artwork.ts` and reveal sessions. Replace string
  glow/morph operations with palette-aware pixel operations and explicit alpha;
  preserve the reveal callback and one-time resolution semantics.
- Defeat and boss introductions: `defeat-artwork.ts`, `adventure-boss-intro.ts`.
  Keep reaction/intro timing and readable themed text.
- Exchanges: `partner-exchange.ts`. `ExchangePixel` currently contains only
  position/size; retain source color through gathering, movement and arrival,
  including reduced-motion playback. Theme trails/sparks separately.
- Session sinks: `sessions/{evolution-battle-session,evolution-reveal-session,
  adventure-battle-session,evolution-presentation}.ts`. Propagate scenes and
  presentation snapshots instead of flattening them to strings too early.

Use semantic HUD data outside the pixel image in both browser and terminal
adapters. Preserve localized captions and the existing LCD banner where it is
part of the artwork. A full repaint on a theme change must also refresh a paused
scene, even when animation advancement is suspended by an Options dialog.

### Browser and terminal rendering

Web/Cursor should use the same shared SVG renderer. Group pixel paths by palette
color and opacity rather than rebuilding one DOM rectangle per pixel each tick.
Keep `shape-rendering="crispEdges"`, stable viewboxes and pixel-aligned transforms.
Scale with nearest-neighbor behavior. Ordinary text and accessible labels remain
DOM text, not source sprite lettering.

OpenCode must render upper and lower pixels with separate foreground/background
colors on half-block cells. The upstream
[terminal renderer](https://github.com/sbugallo/opencode-vpet/blob/v0.4.1/src/tui/monster-sprite-renderer.ts)
is a useful reference, but it handles a creature frame rather than this game's
whole composed battle. Adapt the technique for complete scenes using supported
OpenTUI styled text/spans. Coalesce equal-color runs, clear obsolete backgrounds,
preserve transparent cells and avoid raw ANSI strings in unverified text APIs.
Test two opaque pixels of different colors, one transparent half and both halves
transparent. A single solid block loses the lower pixel's color.

For limited-color terminals, quantize to the available palette where supported;
only use monochrome when the terminal cannot display color. Keep the requested
preference separate from that effective capability fallback and explain it in
Options. Capability checks must not disable color in supported terminals.

## Complete visual coverage

The following matrix is the release inventory. “Where present” refers to current
host features, not permission to leave any existing surface in the wrong theme.

| Surface | LCD and Color work | Consumers |
| --- | --- | --- |
| Principal companion | All walking, idle, angry/happy, feed/refuse, sleeping, injured and pet reactions; both facings; resizing | Web, Cursor, OpenCode |
| Eggs and hatching | Generic egg plus all ten origin designs, both poses, selection cards and hatch reveal | All existing egg views; origin carousel/team in Web |
| Combat | Both fighters, main projectile, generic fallback, impact, miss, boss intro, hit pips, outcome and defeat | Shared evolution duels; Web/Cursor adventures; Web PvP/Arena |
| Evolution | Glow, morph, new form, happy reveal, no-evolution notice and terminal-state presentations | Web, Cursor, OpenCode |
| Care | Food/apple, poop and flies, cleanliness icons, pet hearts/stars, speech/feedback, EXP and victory indicators | Existing care surfaces in each host |
| Adventure objects | Food/fragment loot, recruit offers, boss badges, countdowns and scenery | Web/Cursor |
| Dex | Grid/list portraits, detail portrait, route thumbnails, care/training requirement icons, unknown state and filters | Shared Web/Cursor panels; style terminal Dex's existing content |
| History | Current and archived companion portraits, timelines, badges, empty/error states | Web/Cursor; terminal History's existing content |
| Team and recruitment | Principal/reserve cards, quick switch, origin preview, offers and confirmation dialogs | Web |
| World and map | Resident/boss portraits, traveling marker, atlas, terrain, location dropdown, locked/unlocked stars and badges | Web |
| Social and Arena | Local/remote portraits, fighter selection, friend status, gifts, requests, activity cards, outgoing/incoming exchange pixels and result feedback | Web |
| Layout and controls | Case/screen surfaces, panels, dialogs, buttons, focus, disabled/selected states, borders, meters, notifications and empty states | Digital Pet UI in all hosts |
| Design references | Maintained multiplayer prototype and generated artwork sheet, relevant design docs and new reference captures | `assets/design/multiplayer/`, `scripts/build-multiplayer-design-artwork.ts`, `docs/design/` |
| Distribution surfaces | Current screenshots and documentation examples for both themes; review app/social branding separately from gameplay art | Host READMEs, screenshots and release assets |

App icons, the static Open Graph share card and the host editor's own chrome are
product branding or host UI, not per-save sprites. Review their consistency, but
do not make crawlers or the entire editor depend on a local user's preference.
In-game invitation/profile/exchange views must obey the local selected theme.
Unknown/undiscovered silhouettes must remain unknown in Color; do not reveal a
species through an otherwise hidden palette or portrait.

### Scenery and design work

There are 20 current scene SVGs, one File Island map SVG and one bundled raster
background (`dragon-eye-lake.png`). This is not a complete ready-made color
scenery set. Preserve each scene's composition, ground level, 160 × 160 coordinate
space and seamless scrolling. Preserve the map's 160 × 176 coordinates and marker
positions. Add explicit paired assets or generated palette variants owned by
fields, including a complete color version of every used location scene.

Use shared semantic design tokens for case, screen surface, text, borders, focus,
success/warning, meters and effects. Keep existing LCD tokens working during
migration; do not simply redefine `--lcd` to white because it also acts as a
negative-space color in icons and masks. Give food, poop, fragments, impact and
sparkle art deliberate color layers. Preserve outline contrast on every terrain.

Design review must cover 320 px, 390 px and desktop Web; narrow/wide Cursor
sidebars; and narrow/wide OpenCode terminals. Keep typography, interaction targets,
keyboard focus and reduced-motion behavior. Avoid using color as the sole signal
for selection, victory, availability or errors. Update retained prototypes through
their sources and generators; follow the repository's policy against retaining
obsolete captures or editing generated artwork by hand.

## Configuration and live propagation by host

### Web

- Add a labeled two-choice Theme control and a small creature preview to
  `src/server/rendering/options-markup.ts` and
  `src/client/features/options/controller.ts`. Place it outside the
  `browser-options` fieldset: computer-save users must also be able to use it.
- Store `digital-pet.theme` in localStorage through a small preference
  adapter. Catch storage failures, apply the choice for the current session and
  provide feedback instead of claiming it was saved.
- Set the theme before the first visible shell/iframe paint using a CSP-compatible
  external bootstrap or host renderer configuration. Do not add executable logic
  in template strings or weaken CSP to prevent a flash of LCD.
- Coordinate the shell, all loaded/hidden iframes, newly mounted dialogs and other
  tabs. Use a local change event for the current document and `storage` for other
  same-origin documents; send the current preference during frame readiness.
  Keep source/origin checks on `postMessage`.
- Update `browser-session.ts`, partner food/evolution/adventure producers, battle
  playback/viewer and social portrait/exchange paths. Refresh cached models and
  assets by theme while retaining navigation, scroll, selection and focus.
- Update `server/rendering/host-models.ts` and the computer-save API path. It
  currently produces monochrome strings using a process-wide animation object.
  Prefer semantic snapshots rendered with the browser's local preference. Never
  use a mutable server-global theme that allows one browser to change another.
- Keep language, save source, scenery motion and music preferences independent.
  Backup import, pairing, reserve switching and peer exchange must not overwrite
  the recipient's visual preference or add it to gameplay protocol validation.

### Cursor

- Contribute `digital-pet.theme` with enum `lcd`/`color` and default `lcd`
  in `package.json`; normalize it in `config/extension-settings.ts`. Use an
  application-level user preference, not a project/game-save field.
- Add `cursorDigitalPet.options` to the command palette and an Options button in
  the Digital Pet sidebar. The action opens the native options picker with the
  current Theme selection; both this action and Settings use the same
  setting. Save user scope explicitly.
- Pass a live settings accessor through the container and sidebar provider to
  the renderer. Handle `onDidChangeConfiguration` for this key immediately;
  currently the broad handler asks users to reload for every setting change.
- Refresh every open sidebar, Dex and History panel, including hidden panels
  when revealed. Their current factories use `DEFAULT_DIGITAL_PET_SETTINGS`, so
  changing only the sidebar would leave other panels in LCD.
- Extend `webview-messages.ts` with validated settings updates and a versioned
  scene payload. The extension validates values and acknowledges persistence;
  webviews never write arbitrary configuration keys.
- Preserve in-flight sessions, CSP nonces, `asWebviewUri`, local resource roots and
  resource access. Copy paired assets in `esbuild.mjs`; it currently copies only
  the lake scene for the sidebar adventure background.

### OpenCode

- Add `theme` to normalized settings in
  `~/.config/opencode-digital-pet.json` (the existing platform resolver determines
  the Windows path). Preserve support for `opencode-vpet.json` when it is the
  active legacy path. Do not create two competing preference files.
- Add a native **Digital Pet Options** dialog/command (`/digital-pet-options`) to
  `tui/digital-pet-command-layer.tsx`, with keyboard-selectable LCD/Color and a
  preview. Editing JSON must remain supported, but cannot be the only UI.
  Register Options independently of archive-reader availability so it also works
  before a companion exists or when the archive cannot be read.
- The current module only reads settings. Add a focused writer that changes only
  `theme`, retains unrelated/unknown fields, writes atomically and reports
  errors. If an existing file is malformed, do not overwrite it with defaults.
- Replace the startup-only settings value in `tui.tsx` with a live preference
  accessor/signal. Watch or refresh external changes with proper lifecycle cleanup;
  updates through the dialog should repaint immediately without restarting OpenCode.
- Adapt `sidebar-card.tsx` and custom battle/evolution artwork to styled rows.
  The current `customArtwork: string` bypass must not keep combat monochrome.
  Apply theme tokens to Digital Pet dialogs/status UI while respecting the host
  terminal theme and leaving other OpenCode components alone.
- Verify packaged TUI behavior with the supported OpenTUI dependency. Read-only
  config, missing config, invalid values, legacy-path selection and disposal must
  all be tested. Settings failure must not stop the companion or game persistence.

## Asset import and fallback policy

Build a repeatable import pipeline before shipping the selector. Extend existing
`scripts/import-attack-artwork.py` and `scripts/import-digitama-artwork.py`; add a
monster-color importer rather than hand-editing `monster-frame-data.ts` or any
generated manifest.

Each output needs source URL/revision, retrieval date, original SHA-256,
source dimensions/grid, transparent-pixel handling, pose/facing, target identity,
device/bank/index where applicable, transformation policy and output checksum.
Use bounded downloads and a local source cache; regeneration must work offline
and give identical output for pinned inputs. Validate response types and image
sizes before accepting an asset. Deduplicate shared palettes/frames deliberately.

Import the current 650 identities and selected origins through reviewed mappings.
Generate a coverage report by identity × required pose × theme, plus projectile,
effect, origin, scene and UI inventories. The planning audit supplies candidates;
the importer must require reviewed decisions for conflicts. Do not infer new
species, evolve routes or egg hatch targets from an art source.

| Missing or damaged resource | Behavior |
| --- | --- |
| Optional color pose | Use an explicitly reviewed same-species color pose; record which semantic action is approximated. |
| Required creature identity | Block completion of the coverage milestone until mapping/art is resolved. Runtime corruption may show the original LCD sprite with a documented diagnostic; never show a different species or a broken image. |
| Main color attack without source assignment | Use the authored generic color projectile and list the identity as generic. Do not fabricate an official attack association. |
| Color care/effect resource | Use reviewed original game artwork with an authored palette if no suitable external resource exists. |
| Region color scene | Provide a complete authored color counterpart or deliberate color gradient fallback for an unavailable file; missing planned scenes remain a release issue. |
| Unknown origin/old save | Preserve current generic egg semantics and render the explicit generic design for the selected theme. |

Keep source images/credits as maintainable inputs, not runtime third-party URLs.
No animation, Options change, offline view or terminal frame may require a call
to Omnipet or GitHub.

## Delivery sequence and completion gates

These are implementation milestones, not permission to ship partial color support
to only one host. Keep the public selector out of a release until the shared
rendering and host coverage gates pass.

| Milestone | Work | Completion evidence | Depends on |
| --- | --- | --- | --- |
| 1. Review identities and art | Resolve all 650 audit rows, pose semantics, color attack policy, ten origins, source credits and miscellaneous asset inventory. Review Greymon/Whamon/MetalGreymon explicitly. | Approved crosswalk; no accidental catalog replacement; measured coverage and explicit generic assets. | This plan |
| 2. Define both visual designs | Specify Color tokens, effect palettes, 20 scene counterparts, map, Options controls and representative screens for all hosts. | LCD/Color review board with eggs, mixed-palette battle, Dex, map and terminal preview; approved geometry and contrast. | 1 |
| 3. Generate portable assets | Import pinned monster frames, color attacks, eggs and selected effects; generate palettes/manifests and browser-safe runtime index. | Deterministic offline regeneration; frame/alpha/grid/checksum checks; no Node-only decode in browser; bundle-size baseline. | 1 |
| 4. Refactor shared animation | Introduce semantic snapshots/scenes, LCD adapter and color composition across idle, battles, evolution, defeat, boss and exchange sequences. | Same game outcomes/timelines for both modes; preserved original LCD fixtures; correct palettes after mirroring/compositing. | 3 |
| 5. Finish shared browser presentation | Theme and render sidebar, panels, portraits, icons, map and scenery; migrate all monochrome-only model fields and message consumers. | Entire visual inventory handled; no persistent LCD-only effects in Color; responsive/accessibility checks. | 2, 4 |
| 6. Integrate Web preference | Options, boot, frames/tabs, computer-save API, browser sessions, battle/social flows and PWA assets. | Both save sources, offline first switch after installation, live/pause switching and reload persistence pass. | 5 |
| 7. Integrate Cursor preference | Settings contribution, Options command, provider and all open panels, config-change handling and asset packaging. | Native control persists; all panels update; active presentation survives; installed VSIX works without source checkout. | 5 |
| 8. Integrate OpenCode preference | Options dialog, safe settings writer, reactive updates and full-scene terminal renderer. | Native terminal sprites/attacks/effects are colored; config/legacy/error cases pass; packed plugin runs offline. | 2, 4 |
| 9. Complete regression and release | Full tests, packaging, cache upgrade checks, documentation, translations, screenshots and final coverage audit. | All three hosts meet the acceptance checklist; no known unhandled visual consumers. | 6, 7, 8 |

Milestones 2 and 3 can proceed independently after identity decisions; host
integrations can proceed independently once their shared contracts are stable.
Shared animation refactoring is the critical dependency. Estimate implementation
only after milestone 1 establishes unresolved art work and milestone 3 measures
the portable data size; a selector-only estimate would omit most of this scope.

## Development status — shared foundation

Implemented on this branch:

- Core `VisualThemeId` (`lcd` / `color`), default and settings normalization. Theme
  is a presentation preference; no save format or gameplay catalog was replaced.
- Shared `VisualTheme` token definitions, immutable palette-indexed `PixelFrame`,
  versioned/bounded `VisualScene` and JSON input validation. Color tokens remain
  an initial design to evaluate on complete screens in milestone 2.
- Offline importer pinned to the audited upstream commit and SHA-256 inputs.
  It validates all 1,168 source records and generates only 639 selected sprites,
  7,658 source poses and the crosswalk for the 650 existing save identities.
  Greymon, Adult Whamon, the MetalGreymon alias and generic egg use explicit
  decisions in `scripts/color-sprite-source.json`; original IDs remain intact.
- Node/pose-based resolver with independent LCD and Color caches. LCD uses the
  original masks. Color explicitly reports injury-pose substitutions and the
  generic egg's idle substitution; coverage does not imply exact source poses.
- Shared SVG rendering and terminal half-block rendering with independent
  foreground/background colors, compositing, clipping, mirroring and opacity.
  OpenTUI adapter verified through the real test renderer, including clearing a
  previous colored frame. Styled rows must use `TextRenderable.content`, because
  the Solid JSX `content` property stringifies `StyledText`.
- Four-locale theme names and regression tests for all local creature poses,
  source integrity, wire bounds, render geometry and native terminal colors.

The generated monster snapshot is **2,798,919 bytes**, before bundling/compression.
Offline regeneration has been checked byte-for-byte for all three generated files.
A standalone browser bundle of the resolver builds without Node decoding APIs;
its unminified size is approximately 6.9 MiB including the existing LCD/catalog
imports. This is a diagnostic baseline, not the incremental production download
size. Loading/chunk boundaries still need measurement when consumers migrate.

### Web integration and visual comparison

The Web Options selector now persists `lcd` / `color` in host local storage and
updates the shell and embedded panels live. Semantic artwork snapshots retain
pose, direction and animation progress for idle, battles, evolution and defeat;
the existing LCD strings remain independent. Color includes creature portraits,
regional eggs, exchange particles, projectiles, care effects, map and scenery.
The Color module is loaded lazily and included in the service worker precache.

The offline extras importer validates 137 local PNGs from the resolved Omnipet DMC
module: 20 egg poses and 114 attack frames pass; three attacks fail exact 3× pixel
alignment. Ninety upstream identities have an unambiguous exact attack ID; 60 match local
identities in the current catalog.
Other attacks use the authored generic Color projectile. These are explicit
coverage limitations, not inferred artwork assignments. Twenty authored scenery
palettes and one map palette preserve the original vector geometry and need
further artistic review; they are not imported official Color environments.

The browser suite can run with `PLAYWRIGHT_THEME=color`. A paired visual tour
captures the same 48 interfaces/regions/destinations in LCD and Color, including
320 px, 390 px and 1280 px layouts. Separate tests cover persistence, first offline
theme activation and save identity. Existing adventure, evolution, exchange,
Arena, backup and pairing tests exercise Color through the same app flows.
Visual review found and fixed portrait painting before lazy assets finished
loading, and hard-coded LCD screen borders leaking into Color.

Remaining integration includes Cursor settings and all live webviews, native
OpenCode Options and TUI scenes, replacing generic projectiles where source
identity is unresolved, and final artwork review. The existing terminal adapter
unit tests do not establish end-to-end native host coverage. Generic egg portraits
can still appear in history or social views whose model only supplies the creature ID and
not its regional origin. The companion food button still uses the pale LCD
interior while the social ration has an authored red palette; unify both food
consumers in the remaining asset pass. WebKit native theme/language selects
render shorter than Chromium: explicitly normalize their touch target height.
No cross-host milestone is marked complete yet.

See [color asset maintenance and attribution](../packages/digital-pet-animation/assets/themes/color/README.md)
for regeneration and source credits.

## Validation plan

### Behavior and data

- Validate every existing node ID and origin against both asset sets. Test
  corrected identities, empty sprite keys, duplicate names/IDs, X forms, Armor,
  Hybrid, bosses, historical aliases and all required poses. Retain the planning
  report as evidence and generate a separate approved import report.
- Verify malformed/truncated blobs, palette bounds, decompressed length, alpha,
  source scale, white highlights, transparent green RGB, mirroring and anchors.
  Include the 44 egg designs in the source audit; require both reviewed poses for
  all ten playable origins. Recheck known dot-frame anomalies for designs
  27–34 and 37 instead of assuming Color has the same issue or fix.
- Test two different fighter palettes and a third projectile palette in one
  scene, both shot directions, hit/miss, fallback projectile, victory/defeat,
  glow/morph, feeding, sleeping, pet reactions and exchange particles.
- Run identical seeded battle inputs with each theme and compare results, game
  writes, EXP, cooldowns and one-time side effects. Change themes during each
  presentation phase and while paused, hidden, resized or resumed.
- Test configuration absent/valid/invalid, successful persistence, failed writes,
  reload/restart, external changes, multiple tabs/windows and independent host
  preferences over one SQLite save. Backups and peer transactions preserve saves
  without importing another host's visual setting.

### Visual and integration coverage

| Environment | Required scenarios |
| --- | --- |
| Web Chromium and WebKit | LCD/Color at 320 px, 390 px and desktop; shell/iframe consistency; no first-paint theme flash; keyboard and reduced motion. |
| Browser save | Full care, origins/team, evolution, adventure/bosses, world/map, Dex/history, multiplayer exchanges, PvP/Arena and options dialogs. |
| Computer-save web mode | Independent browser theme while reading native save; server response cannot overwrite local preference; multiple clients cannot change each other's theme. |
| PWA | Cold online installation, reopen offline, first offline theme switch, lazy color data available, service-worker update from older LCD build, cache/storage failure. |
| Cursor | Development host and installed VSIX; narrow/wide sidebar; several Dex/History panels; hidden panel reveal; change theme mid-battle and via Settings. |
| OpenCode | Native Options, representative true-color terminals, limited palette behavior, narrow/wide layouts, transparent pixels, clearing old cell backgrounds and live config reload. |

Extend the existing suites instead of testing only string presence:
animation's artwork/mirror/digitama/exchange/session tests; OpenCode's frame,
sidebar, settings/composition and command-layer tests; Cursor's webview/panel,
configuration and animation tests; and Web's `web`, `team`, `adventure`,
`evolution-duel`, `battle`, `arena`, `social`, `world-map`, `feeding`, `hygiene`,
`pet-affection`, `i18n`, `mobile-safari` and computer-host scenarios. Shared
webviews currently has no standalone test script; exercise it through host suites
or deliberately add a package-level suite with root-script wiring.

Record performance before and after: generated/compressed bundle bytes, initial
load and cold start, color-switch latency, decoded heap, cache size, frame time
and terminal render work. Target visual updates within one rendered frame after
assets are ready, zero gameplay network calls for art, and no decoding during the
steady-state frame loop. Establish numeric size/frame-time budgets from the
baseline before accepting the imported representation.

### Build and package checks

Run from the repository root with npm (workspace unit tests use Bun):

```sh
npm run check
npm run test --workspace @jcendal/digital-pet-core
npm run test --workspace @jcendal/digital-pet-animation
npm run test --workspace @jcendal/digital-pet-fields
npm run test --workspace @jcendal/digital-pet-intl
npm run test --workspace cursor-digital-pet
npm run test --workspace @jcendal/opencode-digital-pet
npm run test --workspace @jcendal/web-digital-pet
python3 -m unittest discover -s scripts/tests -p 'test_*.py'
npm run test:persistence
npm run validate
npm run test:browser --workspace @jcendal/web-digital-pet
PLAYWRIGHT_WEBKIT=1 npm run test:browser --workspace @jcendal/web-digital-pet
npm run package --workspace cursor-digital-pet
npm run pack:opencode
```

Use focused suites during each milestone and the aggregate commands for final
cross-package validation. Building alone does not prove the browser works:
text imports take different paths in Bun, Vite and esbuild. Inspect the VSIX and
npm tarball for complete local art, valid declarations and runtime dependencies.

Update Web's `tooling/resources.ts`, Vite resource manifest and precache inventory.
The current Workbox maximum is 4 MiB per file and its glob excludes `.json`/binary
palette formats. If those formats become emitted assets, explicitly include and
route them. Prefer measured chunking over simply raising the limit. Hash both
theme asset sets so old service workers cannot mix incompatible frame schemas.
Preserve the existing worker activation behavior that avoids interrupting saves.

## Release acceptance checklist

- [ ] Web Options, Cursor Options/Settings and OpenCode Options each expose and
  persist LCD/Color; all three work without restarting the host.
- [ ] Every existing visual surface in the inventory responds to the local
  preference, including paused scenes, secondary panels and new dialogs.
- [ ] All current species and playable origin eggs have reviewed color mappings;
  optional pose substitutions and generic attacks are explicitly reported.
- [ ] Color battles contain color creatures, projectiles, impacts and reactions;
  evolution and exchange do not lose their palettes mid-sequence.
- [ ] All used scenery, map elements, care objects and shared UI have complete
  color treatment with crisp geometry and accessible contrast.
- [ ] LCD retains its existing art, dimensions and behavior. Save/gameplay and
  peer-protocol regression tests pass without visual-setting migrations.
- [ ] Both themes work offline and from installed Cursor/OpenCode packages with
  no runtime dependency on the source websites.
- [ ] English, Korean, Spanish and Galician copy is complete in owning packages,
  including Cursor contribution strings generated through the normal build.
- [ ] The full check/build/test matrix passes and package/cache/performance
  evidence is recorded with the final coverage report.
- [ ] `docs/data-sources.md`, host READMEs, design references and screenshots
  describe the implemented behavior and retain the actual asset attribution.

## Planning evidence

The accompanying [source audit](lcd-color-source-audit.json) contains all 650 local
entries, candidate upstream IDs, available pose counts, identity-review flags,
source hashes and the exact repository/upstream revisions. Counts in this plan
come from that snapshot and decoded source samples, not from an assumption that
the newer catalog automatically matches the current one.

The implementation's main unresolved inputs are the reviewed variant crosswalk,
semantic injury/lose pose assignments, complete color attack coverage and authored
scenery/effect palettes. These are concrete work in milestones 1–3. They should
not be hidden by a blanket monochrome fallback or deferred until after exposing
Color as a complete mode.
