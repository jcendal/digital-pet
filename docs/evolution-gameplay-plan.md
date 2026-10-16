# Remaining evolution, companions and discovery work

Status reviewed on 2026-10-16. This plan retains unfinished work and product
constraints. Completed implementation instructions and historical audit tables
have been removed; current catalog counts, source evidence and refresh commands
live in [data sources](data-sources.md).

## Implemented baseline

The game already has targetless threshold duels, current-pile care rules,
current-form victories, principal/reserve storage and switching, Team as the
second Dex tab, the New Journey egg carousel, ten regional egg origins and
Easy/Medium/Hard boss tiers. Reserve food/hygiene and growth clocks pause;
adventure cooldowns continue. Cursor/OpenCode remain token-driven companion
experiences rather than full web-game management interfaces.

The latest fixes restore the LoaderLeomon and Crowmon branches, correct
DoneDevimon while retaining its saved ID, deduplicate DORUguremon's automatic
selection, and exclude named tag-battle partner routes from EXP. Final forms also
fight at 100%; SQLite migration 12 and browser normalization resume old final
flags. Existing history and fixed pending targets remain compatible. The catalog
still contains 650 IDs, and this delivery adds no species.

## Pending work

| Area | Remaining implementation |
| --- | --- |
| Route predicates | Typed origin, permanent objective and fusion-pair rules with per-device alternatives and evidence. |
| Recruitment | Choose principal/reserve or an empty reserve using revisioned slot commands; acceptance currently replaces the principal. |
| Manual Jogress | Pair eligibility, confirmation, atomic fusion, reserve consumption, two-parent lineage, transfer and animation. |
| Objective unlocks | Map specific boss/exploration achievements to evolution rules with stable reward IDs and grant-once receipts. Existing boss stars currently unlock regional eggs. |
| Origin-specific later routes | Preserve egg provenance and apply reviewed family predicates beyond the first hatch. The carousel and regional egg unlocks are already implemented. |
| Victory policy | PvP wins currently do not count; inclusion needs a product decision. No separate effort/training activity or win-ratio stat. |
| Source reconciliation | Review additional Omnipet connections and missing destination species separately. Do not enable incomplete rules or expand the catalog as part of the current fixes. |

Implement recruitment slot selection first, then reviewed objective/origin
predicates and manual fusion. None of this work should reintroduce an Eggs tab,
an achievements page or a redesigned main companion screen.

## Product decisions

| Area | Agreed behavior |
| --- | --- |
| Normal evolution | At 100%, fight even without an eligible evolution. A win counts before route evaluation. With no result, show the notice, keep the species and victory, and reset EXP; preserve loss behavior. |
| Route information | Read requirements in the Dex. No target selection or reservation. |
| Care | Count the 0–3 unclean piles when selecting the evolution, not accumulated mistakes throughout the stage. |
| Team | One principal companion and one reserve; either can originate from an egg or recruitment. |
| Jogress | Manual action when the pair meets its requirements, as explicitly selected by the user. |
| Victories | Accumulate adventure and evolution-duel wins within the current form. Show numeric victory requirements in the Dex only where relevant. PvP inclusion remains to be clarified. |
| Training | Adventure provides training. Do not introduce a separate training activity. |
| Bosses | Achievements belong to the save and permanently unlock associated routes. |
| Eggs | One family available initially; discover additional origin families in regions. |
| Companion view | Preserve the existing pet view. Add a circular reserve-face button with a switch indicator below the companion name; clicking switches the pets directly. |
| Dex navigation | Dex / Team / History. Team is the second tab; egg information remains in the New Journey carousel, without new top-level navigation destinations. |
| New companion | Open an egg carousel when creating a new companion through the existing new-journey action; ordinary adventure exploration does not choose an egg. |
| Achievement UI | Keep achievements internal for now. Existing regional stars show boss victories; no standalone achievement screen. |
| Regional difficulty | Easy to hard ordering; for now difficulty changes only the two boss tiers. |
| Native hosts | Cursor/OpenCode remain token-driven companion experiences; preserve compatible data without full web-game feature parity. |

The user confirmed that `Supremo I` refers to the catalog's existing `Supremo`
stage, not a new stage. Therefore Easy uses stages 5 and 6, Medium uses 6 and 6,
and Hard uses 7 and 7. Keep the shared stage model at 0–7.

The following defaults make implementation concrete: only the principal gains
experience; reserve care and growth clocks pause; recruiting or creating an egg
with a full team requires selecting the replaced slot; fusion consumes the reserve
and keeps both parents' provenance. These are proposed defaults rather than
additional user decisions.

## Interface references

The [design index](design/evolution-gameplay/README.md) contains current interface
captures and the retained Recruitment and Fusion designs. Those two prototypes
still need production implementation. Use their content inside the existing
navigation, with the established font, LCD palette, pixel sprites and brown shell.
Full native recruitment, egg collection and fusion management are outside scope.

## Architecture and shared contracts

Use the user-selected [Omnipet Digimon Database](https://digimon-db.omnipet.app.br/)
as the preferred structured source for attributes, named attacks, sprite resources
and device/version evolution conditions. The verified API fields and import
policy are recorded in [data sources](data-sources.md). Enrich the current
Humulos audit with module/slot-specific JSON rather than discarding those
conditions or merging all device alternatives into one rule. Attack-pose frames,
named special moves and projectile resource IDs need separate mappings.

Keep authoritative eligibility, team transitions, care and progression in
`digital-pet-core`. Hosts persist and deliver commands; they do not implement
their own evolution rules. World placements and regional reward mappings belong
in `digital-pet-fields`. Shared HTML/CSS/browser behavior belongs in
`digital-pet-webviews`; fusion artwork and timing belong in
`digital-pet-animation`.

The current `EvolutionRoute` contains a target, optional canonical selection ID,
kind, care mask, sources and optional care/victory alternatives. It cannot express
pairs, attributes, origin eggs or achievements. Add a typed,
versioned route-rule model with:

- A stable rule ID, source/version, target, trigger (`experience` or `manual-fusion`)
  and reviewed priority.
- Alternative condition groups: OR between source alternatives, AND within each
  complete alternative. Keep conditions together; never combine one device's
  care range with another device's unrelated victory requirement.
- Care masks; egg family IDs; achievement IDs; verified partner species or
  stage/attribute predicates; and combat victory predicates.
- Explicit source requirements and their gameplay adaptation. Separate
  unsupported/unverified rules from implemented conditions.
- A safe presentation projection of applicable route requirements, including
  numeric care and victory requirements. Internal deduplication/provenance data
  and unused requirements do not belong in the presentation.

Preserve multiple rules for the same source and target. A target can be reachable
normally in one device and through Jogress in another; one `kind` per edge loses
that distinction. In particular, the current reference collapses MetalGarurumon
and WarGreymon → Omnimon to normal routes, so manual fusion needs its own rule.

Extend `scripts/import-evolution-reference.py` and its generated reference schema,
with source snapshots and parser tests. Add an Omnipet JSON import adapter that
preserves full condition groups and provenance; validate the source crosswalk
before replacing existing rule evidence. Do not edit generated catalog data by
hand. Add verified Digimon attributes where an attribute-based pair requires them;
the current node model does not contain those attributes. A rule without complete
evidence remains unavailable rather than being unlocked by a generic flag.

Reuse the implemented principal/reserve team model, revision and independent
partner states. Save-wide progress holds achievements,
egg unlocks and world discoveries. Partner progress holds current-form counters,
care, food, origin and evolution history. Reserve is a live owned partner, not a
retired partner.

## Recruitment slot selection

The current encounter offer supports accepting/declining and preserves the
reserve, but acceptance still replaces the principal through `replacement` /
`replaceLocalPartner`. Extend this existing flow rather than building new Team
storage or another navigation destination.

- Let an empty reserve receive a recruited companion. With both slots occupied,
  choose which named pet to archive. Preserve the other companion's state and
  Dex registrations. Declining or canceling changes nothing.
- Replace the recruitment `SpawnPartnerInput` result in `explore-adventure.ts`
  with an explicit slot operation. Update the shared SQLite adventure store and
  browser adapter to commit the offer result exactly once.
- Carry expected team revision, offer/operation ID and affected partner IDs.
  Validate again inside the transaction; duplicate/stale confirmations cannot
  create a third live pet or archive a different companion.
- Replacing the principal ends its adventure; replacing the reserve leaves the
  principal's progress intact. The recruit starts its own gauge, victories and
  adventure cooldown. Preserve the replaced pet in History.
- Reuse existing core team commands and browser Team/slot presentation, including
  pending and rejected states. Preserve simplified native-host compatibility.

Acceptance: placing a recruit in either slot survives reload/export, preserves
the other pet's care/food/gauge/timers, and rejects stale, duplicate and busy
operations without partial writes.

## Manual Jogress

### Gameplay

`Dex → Equipo → Fusión` lists results that have fully implemented rules. Check exact
species pairs or verified stage/attribute pairs and any origin/achievement
requirements. Confirm the two named parents, result and empty reserve slot before
performing the fusion. No experience threshold is required unless a specific
reviewed rule explicitly uses it; reaching normal 100% never waits for this action.

The principal becomes the result. The reserve is archived with a fusion-parent
reason and releases its slot. The result preserves both parents' histories and
origins through explicit provenance, without retaining both active histories as
duplicate game states. Reset form counters and gauge; retain principal care and
save-wide unlocks. Fusion itself grants no victory and cannot trigger an immediate
second normal evolution from leftover gauge.

The sample design uses Garurumon with a Virus Adult for Orochimon. Humulos' source
rules vary by device and distinguish generic attribute Jogress from exact special
pairs. Consuming the reserve and making fusion manual are our proposed game
adaptations, not claims about the Vital Bracelet's original behavior. See the
[Vital Series guide](https://humulos.com/digimon/vbdm/all/) and the local
[evolution reference and adaptations](data-sources.md#evolution-references).

### Implementation

- Add a core fusion evaluator and `fuse-partners` use case. Validate again inside
  the write transaction against both current partner IDs and team revision.
- Persist the result, reserve retirement, lineage event and released slot
  atomically. Preserve parent IDs and distinguish retirement from ordinary loss.
- Reuse evolution presentation in `digital-pet-animation`; add a two-parent
  composition and result reveal. Respect reduced motion and narrow layouts.
- Add a shared panel in `digital-pet-webviews/src/panels/` with a renderer,
  `.css` and `.browser.js`, composed into the web game. Shared domain rules remain
  host-independent; native fusion management is outside the revised scope.
- A normal threshold transition and fusion command compete on team revision.
  Whichever commits first invalidates the other's old preview. Never fuse a pet
  whose stage changed after the confirmation opened.

### Acceptance

Both pair ordering and active-role requirements follow the rule. Wrong attribute,
stage, origin or achievement prevents fusion. Double clicks, reconnects and
replays produce one result. A completed fusion survives reload/export and
History can identify both parents.

## Evolution objectives and permanent unlocks

### Gameplay

Defeating an assigned boss permanently records an achievement for this save. The
region displays its existing star and a concise unlock notification. Associated
routes become usable by either pet, including later eggs and recruits. Unlocking
a route does not transform a companion immediately; the route participates in
its next normal threshold or becomes available as a manual fusion rule.

Use explicit exploration objectives rather than an opaque generic visited flag
for source area-clear requirements. A region may grant an egg unlock and a route
unlock together, but each has a stable, distinct reward ID. Achievement state stays
internal for now. Existing regional boss stars remain the public victory signal;
there is no achievements page, new tab or achievement dashboard. Route requirements
may identify a relevant boss/zone without exposing the internal achievement ledger.

### Implementation

- Reuse the existing save-wide `boss_victories` table and `BossVictory` domain.
  Derive boss achievement IDs from valid region/node pairs; backfill achievements
  from existing victories idempotently, with no requirement to repeat old wins.
- Place region objectives, boss assignments and egg reward mappings in
  `digital-pet-fields`, near `data/bosses.ts` and `data/regions.ts`. Core receives
  resolved typed objective definitions through composition to avoid importing a
  host or world-renderer into domain logic.
- Persist battle outcome, achievement and reward receipt in one transaction.
  Keep a unique reward grant key to prevent farming repeated boss wins.
- Add save-wide internal read models and preserve
  `panels/world/world-render.ts` region details and existing boss stars. Do not
  create a shared achievements panel or an entry in More.
- Review each area's mapping individually. Current region bosses are themed game
  assignments; beating any arbitrary boss must not unlock every special route.

### Acceptance

Old victories unlock their mapped achievements after migration. New rewards grant
once and survive team replacement, new eggs and save transfer. An unrelated
region or uncommitted battle outcome never unlocks the route.

## Origin-specific later evolution routes

The ten regional origins, boss unlocks, family-specific hatch targets and New
Journey carousel are complete. Remaining work concerns origin predicates on
later forms and provenance in recruitment/fusion.

- Keep family immutable per pet through evolution and switching. Recruitment
  gets a reviewed origin or explicit unknown; unknown does not satisfy a
  family-specific rule. Never guess an old save's origin from its current form.
- Preserve both parent origins in fusion history. Eligibility follows an
  explicit rule policy; retaining the principal origin is the proposed default,
  not an automatic union of all egg-exclusive routes.
- Extend source imports for device egg/version conditions currently adapted
  away, such as Dracomon's blue/green Coredramon alternatives. Map each reviewed
  condition to a named existing game family with documented adaptation.
- Add discovery feedback and origin predicates through the shared typed rules.
  Preserve existing discoveries across retirement, replacement and transfers.
  Unlocked eggs remain reusable without an item inventory.
- Keep native metadata compatible without adding native collection screens or
  full web-game management commands. Version rule changes so fixed pending
  targets and existing species/progress remain valid.

Acceptance: only a matching proven origin unlocks its route, legacy unknown
origins remain valid saves, and reload/export preserves origin and discoveries.

## Persistence, transfer and host parity

Use versioned migrations for SQLite and browser saves. Validate two distinct owned
partner IDs, one active ID, at most one reserve, bounded histories/counters,
known egg/achievement/route IDs and valid provenance. Reserve food and hygiene
preserve their remaining time; adventure cooldowns retain absolute deadlines.
Save-wide experience settings, discoveries and achievements must not reset on
switching. Adventure schedules, food, hygiene and pending state belong to each pet. SQLite migration 11
assigns the previous global cooldown only to the principal; browser migration
consumes its legacy global timer once before switching or replacing a save.

The current `web-digital-pet/src/domain/transfer/protocol.ts` uses a v4 envelope
for team state, independent adventure timers, counters and targetless duels. Keep
v1/v2/v3 import compatibility. Future backup export/import, pairing negotiation,
server-backed read and host-bridge changes must
preserve both pets and save unlocks; older clients must reject unsupported
team export rather than silently dropping reserve. Re-evaluate the current
64 KiB transfer limit with realistic two-pet histories; keep bounded validation
and the separate 4 MiB backup policy.

Both Cursor and OpenCode SQLite adapters must select the active pointer. The web
browser adapter must use the same core command semantics. Keep token collectors
and Cursor hook refresh behavior intact while changing attribution. New commands
must include host validation, operation IDs, team revision and acknowledgements;
buttons stay pending until the host confirms the write.

New user-facing strings belong in matching `en`, `es`, `gl` and `ko` i18n files.
Escape renderer text with `escapeHtml`; DOM updates use `textContent`. Preserve
CSP/nonces. Runtime resources remain renderer configuration; scripts and styles
are `.browser.js`/`.css` text imports. Do not copy the documentation preview into
production or edit catalog/build output manually.

## Validation and release gates

For each remaining slice, run `npm run check` and relevant workspace tests.
Persistence changes require SQLite and transfer/migration checks; rendering or
asset-loading changes require production builds and focused browser tests.
Use `npm run validate` for changes spanning packages.

| Slice | Required behavior to verify |
| --- | --- |
| Recruitment | Both slots, empty reserve, cancellation, retirement/history, stale revisions, duplicate offers, busy state and save transfers. |
| Typed predicates | AND within alternatives, OR between complete source alternatives, omitted irrelevant requirements and unavailable unknown predicates. |
| Objective/origin unlocks | Existing earned rewards, grant-once behavior, unrelated bosses, proven/unknown origins, both slots and transfer compatibility. |
| Manual fusion | Correct pair/order/attribute, confirmation, single atomic result, normal-evolution races, two-parent lineage, reserve release, reload/export and reduced motion. |

Imported special/Jogress connections alone do not implement their gameplay.
The current model keeps one kind per source/target pair; distinct normal and
manual rules must survive the next schema. Unknown partner/origin/objective
requirements remain unavailable. Same-stage and backward-stage transformations
need explicit manual semantics and loop protection.

Do not add a generic inventory to bypass missing predicates. If a reviewed route
actually requires a consumable, design its typed condition and acquisition/
consumption policy separately. Do not add destination species merely to remove
an empty route list; the remaining catalog gaps need their own reviewed scope.
