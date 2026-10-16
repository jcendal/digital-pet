# Evolution, companions and discovery implementation plan

Status: partially implemented; implementation reviewed against the code on
2026-10-15. The progress and remaining-work sections distinguish shipped code
from design-only proposals. The evolution audit is included in this delivery.

## Scope clarification — 2026-10-14

At 100% EXP, start the evolution duel even when no evolution is currently
eligible. After a win, count that victory before evaluating the available
experience routes: the duel itself may unlock one. If a route is eligible,
evolve; otherwise keep the species, show `No evolutions available`, reset EXP
to zero and retain the victory. A loss keeps the existing behavior: no evolution,
EXP reset and no added win. Making the duel cosmetic was an agent interpretation
and is not part of the plan. Existing Digitama hatching keeps its direct hatch path.

Keep gameplay inputs limited to EXP as the trigger, 0–3 current unclean piles,
origin egg, specific permanent boss/exploration unlocks, combat
victories, and the reserve partner for manual fusion. Import original conditions
as evidence and adapt supported routes to these inputs; this does not require
recreating every device's mechanics. Attribute checks, if a reviewed Jogress
rule needs them, are part of pair matching, not a new player-managed stat.

The agreed simplified progression uses one victory counter
per current form, spanning trips and preserved while in reserve. Do not add a
separate effort score, training activity, timer requirement or win ratio in this
slice. A new form starts a new counter. Authoritative adventure and evolution-duel
wins count, including a successful duel that finds no eligible evolution. The
Dex displays the numeric victory requirement only on routes that have one, just
as it displays relevant care counts. This replaces the earlier requirement to
hide victory thresholds. A separate HUD/training panel is not requested.
Imported device minimums are adapted once in shared core: 12 → 3, 24 → 5,
50 → 7 and 200 → 10. Zero and each care alternative retain their meaning. The Dex
uses the adapted values; existing saved victory counters are not rescaled.
Whether player-versus-player wins also count is awaiting clarification; the
current planning assumption is adventure plus evolution-duel wins.

The expanded Team, recruitment selection, regional egg collection and manual
fusion experience belongs to the web game. Cursor and OpenCode remain companion
experiences with token-driven growth and care. Preserve shared-save compatibility
and the active companion without requiring full web-game UI or native Team,
egg-carousel, recruitment-management or fusion commands. Existing native features
remain available; feature parity is not the target.

## Implementation progress

The team foundation and browser interface are implemented in the working tree.
SQLite migration 9 provides principal/reserve membership, revision checks,
independent care clocks, atomic replacement and active-only token attribution.
Browser saves now preserve two live companions, resting clocks, paused adventure
state and stable History generation numbering. Transfer v4 includes the reserve, independent adventure timers, per-form combat victories and targetless duels;
v1/v2/v3 backups remain readable, and unsupported live peers reject the request.

The web Dex now has Dex, Team and History tabs. The existing companion view
adds one small circular switch control below the companion name. New Journey opens an egg
carousel with keyboard/swipe navigation, unlock hints, slot selection and an
explicit replacement preview. Creating the empty reserve preserves the principal.
Team members link directly to their Dex records. The switch button has a circular
arrow icon and no success text or New Companion action. The standalone Eggs tab
has been removed. The starter family hatches Botamon; Forest and Aquatic families hatch Yuramon and
Pichimon and unlock after regional boss victories. Legacy eggs retain their
original hatch choices. Computer saves remain read-only in the web interface.

The quick switch now uses a larger circular portrait and an integrated rotation
badge. Team's switch action and rest explanation sit at the bottom of the panel.
There are ten regional origins with distinct locally imported Omnipet sprites
across the carousel, Team and browser pet view. The village egg starts unlocked;
the other nine unlock through a boss victory in their respective region. All 44
source designs remain in the animation package. Selection and hatch assignments
are documented in [data sources](data-sources.md#imported-digitama-designs).

Regions display Easy, Medium and Hard difficulty and ordered 5/6, 6/6 and 7/7
boss pairs. Canonical species stages stay unchanged. Per-slot legacy aliases
preserve earned stars, transfers and pending boss fights; new encounters use the
new bosses. Adventure victory counters are omitted from shared presentation data.

Actual implemented screenshots are recorded in the
[design evidence](design/evolution-gameplay/README.md#implemented-interface).
Validation includes unit/persistence checks, production builds and browser tests
for creation/cancellation, switches, stale commands, locked origins, active
adventure rejection, offline navigation, translations, legacy stars and boss
tiers. The end-of-turn report records the final results.

Threshold duels now start without a preselected target. Their result is committed
before presentation: a win increments the per-form counter, then evaluates care
and numeric victory requirements. With no eligible route, the companion retains
the win and gets the no-evolution notice with EXP reset to zero. Existing pending
targets remain fixed. SQLite migration 10 persists per-form victories and unique
duel identities; browser transactions bind results to the pending companion/form
and timestamp. Adventure wins count once, reserve switches retain each counter,
and a new form starts at zero. The Dex shows numeric thresholds only on applicable
routes, including 44 source-backed route requirement groups.

Still pending: web recruitment slot selection, origin/objective-specific later
routes, and manual Jogress eligibility, transactions, lineage and animations.
This delivery does not unlock all special routes. No achievements
screen or alternative main companion layout has been introduced.

## Remaining-work review — 2026-10-15

This review checks the actual domain, persistence and presentation sources;
the existence of a prototype or imported route does not mark its gameplay done.

| Workstream | Verified implementation | Remaining work |
| --- | --- | --- |
| Route rules and Dex | Normal/Jogress/special classification, source URLs, 0–3 current unclean-pile masks, combined care/victory alternatives and numeric Dex requirements; unrestricted care labels omitted. | Review origin, permanent objective and fusion pair predicates and retain distinct rules per trigger. Do not build a device emulator or new player-managed stats. |
| Automatic evolution | Targetless threshold duels, atomic post-win care/victory selection, no-evolution notice and EXP reset, replay protection and compatibility with fixed legacy pending targets. | No outstanding work for the agreed threshold-duel behavior. |
| Principal and reserve | SQLite migration 9 and transactional team commands; browser Team UI, quick switch, independent rest/care/food/adventure state, active-only token attribution and transfer v4 with v1/v2/v3 compatibility. | Complete the web slot workflows and preserve compatibility with simplified native companions. Full native Team controls are outside the revised scope. |
| Recruitment | Existing encounter offer and decline/accept behavior; accepting preserves the browser reserve. | Choose principal/reserve or an empty reserve through a revisioned slot command. Accepting still replaces the principal through `replacement` / `replaceLocalPartner`; the accepted recruitment screen is a design only. |
| Manual Jogress | Referenced Jogress connections are excluded from normal EXP and shown locked in the Dex. | Pair eligibility, manual fusion use case, confirmation UI, transaction/race protection, reserve consumption, both-parent lineage/history/export and two-parent animation. The fusion screen is a design only. |
| Combat victories and training | Per-form adventure/evolution wins persist across trips, restarts and reserve switches, reset on form changes and cannot be counted twice. Numeric route requirements are shown in the Dex. | PvP wins currently do not count. No independent effort/training score or ratios. |
| Boss/exploration achievements | Save-wide boss victories, regional stars, legacy boss aliases and regional egg unlocks. | Map reviewed objectives to specific evolution rules, exploration-clear objectives, stable reward/achievement IDs, grant-once receipts and unlock feedback. Boss victories currently unlock eggs, not the blocked special evolution routes. |
| Origin eggs | Ten distinct animated eggs for ten regions; village available initially, nine regional boss unlocks; carousel/slot preview, origin-specific first forms and browser persistence/transfer. | Origin-specific later evolution predicates and discovery feedback in the web game; preserve origin metadata where save compatibility requires it. Full native egg creation/collection is outside the revised scope. |
| Difficulty | Easy/Medium/Hard gallery order, stages 5/6, 6/6 and 7/7, distinct bosses, compatible old stars and pending fights. | No outstanding gameplay work for the agreed difficulty scope. No extra enemy/reward multipliers or difficulty selector are planned. |

The previous full-gauge waiting policy is replaced by threshold combat. A win can
legitimately finish without evolving; that result retains the win and resets EXP.
Legacy pending targets are preserved, while new targetless saves and transfers
are accepted. Losing still clears EXP without adding a victory.

A care-only review on 2026-10-14, before the victory predicates were applied,
found **46 of 453 non-egg species with normal routes**
missing an eligible normal result for at least one care value: 3 at care 0,
3 at care 1, 9 at care 2 and 43 at care 3; these groups overlap. Another **92**
non-egg species have outgoing connections but no usable normal route. These
counts are a content review inventory, not a requirement to invent fallback
evolutions or to force a result after every victory. A successful threshold duel
may legitimately finish without evolving. These historical counts describe the
care-only catalog snapshot, not current victory eligibility or source-wide coverage.

Recommended next sequence:

1. Finish web recruitment slot selection with revisioned team commands.
2. Add permanent objective-to-route
   unlocks, using the existing boss achievements as evidence.
3. Implement manual Jogress end to end once pair/attribute/origin rules are
   verified, including lineage, transfers, confirmation and animation.

The rejected Eggs tab and achievements screen are not pending deliverables.
Egg information lives in the New Journey carousel; existing regional stars
remain the public boss-achievement signal. The previously approved Fusion and
Recruitment prototypes still require production implementation.

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
| Companion view | Preserve the existing pet view. Add a circular reserve-face button with a switch indicator at the upper left; clicking switches the pets directly. |
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

## Current UI evidence and pending designs

The [design index](design/evolution-gameplay/README.md) links the actual implemented
companion switch, Dex Team tab, New Journey carousel, regional difficulty and
post-combat evolution captures. The superseded interactive preview has been
removed. Keep the existing Silkscreen font, LCD colors, pixel sprites, brown shell
and Companion / Dex / Map / Battle / More navigation.

Recruitment slot selection and manual fusion retain their approved content
references, but still require production implementation. Their screenshots do
not prove persistence or route eligibility. Place management inside the Dex;
do not reintroduce the rejected screen selector or achievements screen. Cursor
and OpenCode remain compact companion experiences rather than full web-game
management interfaces.

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

The current `EvolutionRoute` contains `targetId`, `kind`, `careMask` and `sources`.
It cannot express pairs, attributes, origin eggs or achievements. Add a typed,
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

Introduce a shared team model: `activePartnerId`, optional `reservePartnerId`,
`revision` and independent partner states. Save-wide progress holds achievements,
egg unlocks and world discoveries. Partner progress holds current-form counters,
care, food, origin and evolution history. Reserve is a live owned partner, not a
retired partner.

## Workstream 1: threshold combat and readable requirements

### Gameplay

For a companion using the evolution-duel flow, reaching 100% starts a combat
regardless of the current number of eligible evolutions. The pending combat may
have an opponent without a selected evolution target; do not encode a fake
self-evolution or unrelated target just to satisfy old validation.

Resolve a win in this order, in one authoritative transaction:

1. Add the victory to the companion's current-form counter exactly once.
2. Advance hygiene and evaluate the current unclean piles, updated victories,
   origin and permanent unlocks against reviewed experience rules.
3. If a result is eligible, choose automatically and evolve. Reset EXP and the
   new form's victory counter while preserving origin and save-wide unlocks.
4. If no result is eligible, retain the species and updated victory counter,
   reset EXP to zero and display `No evolutions available`.

The victory that completes a requirement can therefore unlock and trigger a
route in the same resolution. Losing keeps the species, resets EXP and adds no
victory. A no-evolution win does not retire the companion or reset its prior wins.
Keep existing Digitama hatching separate from this combat flow.

Missing care coverage is an audit fact, not a mandate to invent a fallback or
force every victory to evolve. A route may legitimately remain unavailable.
Jogress stays manual and is excluded from automatic experience selection.

### Implementation

- Extend `domain/evolution-options.ts`, `domain/evolution.ts` and
  `domain/evolution-battle.ts`; introduce a pure rule evaluator with combat
  victories and explicit duel outcomes, including a win without evolution.
- Reuse the evaluator in `application/use-cases/record-usage.ts`,
  `care-for-partner.ts`, `explore-adventure.ts` and battle resolution. Threshold
  inputs open the duel; winning resolution increments the counter and chooses
  the target atomically. Animation projects the committed outcome.
- Replace browser-only eligibility decisions in
  `web-digital-pet/src/domain/pet/progress.ts` with the same core rule inputs.
- Extend `digital-pet-webviews/src/panels/dex/dex-model.ts` and
  `dex-client.browser.js`. Requirements show care, origin, achievement,
  compatible partner or numeric victory requirements only when relevant.
- Update SQLite/IndexedDB pending-state handling, transfer validation and battle
  presentation to accept a pending duel without an evolution target. Persist a
  battle receipt bound to partner ID and form revision so replay/reload cannot
  add a second victory, reroll a route or apply it to another companion.
- Migrate old full-gauge states on the next authoritative tick. Existing pending
  evolution targets finish through a versioned legacy path, with no second target
  choice or duplicate reward.

### Acceptance

Threshold crossing initiates one duel even when no route is eligible. The win
that completes a victory requirement evolves in that same resolution. A win
without an eligible result gives the notice and resets EXP, retaining the win;
a loss resets EXP without adding a win. Care is sampled at authoritative target
selection. Reload, offline catch-up and replay cannot count or select twice.
Numeric Dex requirements match the implemented rules; manual/unverified routes
never enter automatic experience selection.

## Workstream 2: principal, reserve and recruitment

### Gameplay

`Dex → Equipo` shows two slots, each with species, stage and its own normal experience.
Switching changes which companion receives token, browser-time and adventure
progress. Food, hygiene, origin, experience and history stay with their owner.
Reserve food and hygiene clocks pause with their remaining durations; existing
poop does not disappear. Adventure cooldowns continue advancing. The reserve does
not receive token experience or silently train.

An empty reserve can receive a recruited pet or an unlocked egg. A recruitment
offer with two pets asks whether to replace the principal or reserve, then names
the companion moving into History. Replacing the reserve preserves the current
principal. Replacing the principal ends the departing pet's adventure, as today.
Declining changes nothing. Replacing either slot preserves Dex registrations.

Switching is disabled during combat, evolution, an unresolved encounter or another
pending team operation. A running adventure must be paused before switching;
each pet keeps its paused adventure and its own cooldown. The adventure cooldown
continues in reserve, while food and hygiene clocks pause. New companions start
with their own ready timer; replacing one does not transfer the previous pet's
wait. An egg in reserve starts its existing hatching interactions only when activated.

The companion view has only a circular thumbnail of the reserve's face and a
small switch indicator in its area below the companion name. One click switches the pets;
do not navigate to another screen for this action. Use a native button with the
accessible name `Switch to {name}`, an effective 44px touch target, and pending
and disabled states derived from the same authoritative command as the Team tab.
Show nothing when reserve is empty. Preserve the main arena, name, care buttons,
adventure action and experience layout. Generate/cache a portrait from the
existing sprite artwork; the face crops to the circle while the main pet remains
pixelated. Keep the circle visually small without shrinking its touch target.

### Implementation

- Add core team ports/use cases for reading, switching and replacing a slot.
  Extend `application/ports/partner-lifecycle.ts` and `sidebar-snapshot.ts`;
  return revisioned team snapshots and explicit rejection reasons.
- Add SQLite team membership and active-pointer migrations after the latest
  schema version (baseline 8; team migration 9 is implemented). Backfill the existing live pet as principal,
  reserve empty. Preserve archived records and partner IDs.
- Replace the implicit `retired_at IS NULL LIMIT 1` active lookup in
  `sqlite-digital-pet-schema.ts`. Update partner lifecycle so creation no longer
  automatically retires whichever pet happens to be returned by that query.
- Make active-pointer changes, retirement, new pet creation, clock transitions
  and relevant adventure changes one SQLite transaction. Commands carry expected
  team revision and affected partner IDs; stale offers fail safely.
- Introduce a browser save envelope with team plus independent partner states in
  `src/domain/pet/` and `client/persistence/pet-store.ts`. Use one IndexedDB
  transaction per team change. Keep archival history separate from reserve.
- Replace the recruitment `SpawnPartnerInput` result in `explore-adventure.ts`
  with an explicit slot operation; update `sqlite-adventure-store.ts` and the
  browser adventure adapter to commit that operation exactly once.
- Keep Cursor/OpenCode active-pointer reads and shared-save compatibility intact.
  Full native Team presentation and commands are outside the revised scope;
  implement the expanded management flows in the web game.
- Extend the existing Dex panel navigation to include Team as the second tab. Keep
  History's deep link compatible and use one active tab state rather than nested
  tab bars. At 320px, fit all three short labels with consistent 44px targets;
  keep cursor/focus/selected states and keyboard navigation accessible.
- Put the switch control in shared `sidebar-document.ts` / sidebar browser
  behavior and styles, with portrait data delivered in the sidebar model. Do not
  duplicate switch logic in the browser app and Cursor provider.

### Acceptance

Alternating twice restores the original principal without retiring either pet.
Each pet keeps its own gauge and care. Inactive time adds no progress or new care
decay. Recruitment into reserve does not reset principal progress. Duplicate or
stale confirmations cannot archive the wrong partner or create a third live pet.

## Workstream 3: manual Jogress

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

## Workstream 4: combat victories and adventure training

### Gameplay

Use combat victories as the sole training input, including adventure wins and
evolution-duel wins. PvP inclusion remains to be clarified. Paused time,
unattended wall-clock jumps, ordinary EXP and repeated battle presentation do not
count as victories. A defeat does not remove earlier wins. Counters span multiple
trips within the same form and reset on committed evolution, recruitment or
fusion. Switching preserves them.

Display the numeric required victories in the Dex when a route has that
condition, using the same requirement layout as care. Omit the row when there
is no victory requirement. No separate training activity, effort score or win
ratio is introduced. Care, origin, boss achievements and compatible partners
remain readable.

### Implementation

- Add typed per-form combat victories in core, separate from the current per-trip
  `AdventureState.victories`. Do not infer lifetime progression from a single
  trip that disappears when the next trip begins.
- Accumulate bounded victories through authoritative adventure and evolution-duel
  resolution; checkpoint them with partner state. Account for battles only when
  the authoritative outcome is committed, not when an animation completes.
- Persist deduplication by encounter/outcome ID and form revision with both
  SQLite and IndexedDB adapters. Keep token receipt attribution on the active
  pet at receipt time, preventing replay after a team switch.
- Map supported device victory/training conditions to the single reviewed victory
  predicate; avoid copying device numbers indiscriminately into a much shorter
  adventure. Balance in configuration with reproducible seeded simulations.

### Acceptance

Multiple adventures and evolution duels accumulate wins once; reload and
checkpoint replay add nothing twice. Pausing/reserve adds no victories. A win
without an evolution retains the accumulated victories; successful evolution
starts the new form's counter at zero. The Dex displays the numeric requirement
only where relevant. Failure to meet a requirement never holds EXP at 100%:
the duel can resolve without evolution and clear EXP.

## Workstream 5: permanent boss and exploration achievements

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

## Workstream 6: origin eggs and regional discovery

### Gameplay

New saves begin with one unlocked egg family and one principal egg. Reserve starts
empty. Additional families are permanent collection unlocks discovered through
authored regional encounters/objectives or first boss clears. Avoid a mandatory
rare random drop as the only way to unlock a family.

An unlocked family can be hatched again without an item inventory. The New Journey
carousel shows available origins and hints for undiscovered ones. Select a family and a
free slot; if both are occupied, choose a slot and confirm archival of its pet.
Initial hatch possibilities depend on the selected family, rather than the
current generic egg randomly choosing among all 31 starting forms.

The existing new-journey/new-companion action opens a dedicated egg carousel.
Display one centered egg with its origin name and unlock state, previous/next
controls, and a primary `Choose this egg` action. Include locked eggs with a
region hint and disabled selection. Support keyboard arrows and swipe as a
supplement to visible controls. After selecting an unlocked egg, choose an empty
slot or explicitly confirm which occupied slot to replace. Canceling at either
step leaves the save untouched. With just the starter unlocked, preselect it;
do not bypass the requested selection screen. Ordinary Adventure start resumes
exploration with the current pet and never creates another egg.

Store the family as immutable per-pet origin. Evolution and switching retain it;
recruitment assigns a reviewed origin or explicit unknown origin. Unknown origin
does not satisfy an origin-specific route. Fusion preserves both parent origins
for history; future eligibility uses an explicit rule policy, never an accidental
union of every egg-exclusive route. Default: retain the principal origin.

### Implementation

- Add stable core egg-family definitions with validated first-form IDs and
  origin predicates. Regional placement belongs to fields. Reuse existing egg
  sprites/animation before commissioning family-specific assets.
- Extend the import pipeline for the source egg requirements currently adapted
  away, such as Dracomon's blue/green Coredramon alternatives. Map source device
  variants to named game families with documented adaptation.
- Add unlocked-family state and discovery receipts save-wide; attach origin to
  partner creation, recruitment and fusion provenance in the web game; preserve
  compatible metadata on native hosts without adding native egg collection UI.
- Change default spawning and the current options `new egg` flow to use the
  team-slot creation use case. Use the new-journey carousel and region
  discovery feedback; do not introduce a separate item-inventory screen.
- Existing saves keep their current species and progress. Backfill origin as
  legacy/unknown when it cannot be proven, grant the starter family, and do not
  guess a rare origin from the current evolved species. Version existing route
  adaptations so migration does not remove a pending selected target.

### Acceptance

Only one family is available in a clean save. Discovered families persist across
both pet slots, retirement and transfer. Family-specific hatching uses only its
allowed first forms. No duplicate discovery grants or silent overwrites. Old
saves load without losing their current companion or history.

## Workstream 7: regional difficulty and boss tiers

### Gameplay

Assign each region one authored difficulty and order the region gallery from
Easy to Medium to Hard, preserving a stable order inside each group. All
locations in a region inherit that region's difficulty. Travel remains available.
For this release difficulty changes only boss tier selection; ordinary residents,
encounter probabilities, adventure timing, rewards and egg drop/unlock rules
retain their existing behavior.

| Difficulty | First boss | Second boss | Catalog stages |
| --- | --- | --- | --- |
| Easy | Perfecto | Supremo | 5 / 6 |
| Medium | Supremo | Supremo I (same existing stage) | 6 / 6 |
| Hard | Supremo II | Supremo II | 7 / 7 |

Do not introduce a separate Supremo I stage or change the catalog's canonical
stages. Select two distinct, region-appropriate boss species at the required
stages. Do not relabel an Adult as Perfecto or mutate a shared catalog node's
stage to make an existing boss fit. Changing the species can change its existing
combat stats naturally, but do not add an extra difficulty multiplier.

Suggested initial assignment, subject to content review:

| Difficulty | Regions, in suggested display order |
| --- | --- |
| Easy | Village of Beginnings, Gear Savannah, Coela Beach |
| Medium | Digital Forest, Digital City, Ancient Dino Region, Tropical Jungle |
| Hard | Wasteland, Vamdemon Castle, Upside-down Pyramid |

Show a short localized difficulty label in existing region card metadata and
details. Keep the map geography and main pet view intact. This does not create a
new difficulty selector, progression lock or achievements screen.

### Implementation

- Define `RegionDifficulty` and `Region.difficulty` in
  `digital-pet-fields/src/domain/world.ts`; author assignments in `data/regions.ts`.
  Centralize the 5/6, 6/6, 7/7 boss-tier policy in fields.
- Replace raw boss ID pairs in `data/bosses.ts` with reviewed slot definitions,
  keeping stable region/slot objective IDs and an explicit legacy-species mapping.
  Validate unique species, required tier and catalog membership for every slot.
- Pass selected boss nodes through existing core adventure ports. Core combat
  continues to use each opponent's actual stage and stats; it must not embed a
  second region-to-boss table.
- Extend shared world models/rendering to expose difficulty and order the
  overview by difficulty. Update en/es/gl/ko labels and the Cursor/OpenCode/world
  composition paths together.
- Preserve existing boss stars and unlocks when a boss species changes. Migrate
  old `(regionId, nodeId)` victories to stable boss objectives through the authored
  legacy mapping; do not grant unearned wins or erase already-earned ones.
- Saved pending fights keep their original opponent and outcome semantics.
  Resolve them through a versioned legacy definition rather than rejecting them
  because a regional boss pair changed. New encounters use the new definitions.

### Acceptance

All Easy boss pairs are stages 5/6, Medium 6/6 and Hard 7/7, with two distinct
species each. The gallery sorts Easy before Medium before Hard. Existing victories
and pending fights survive migration. Ordinary encounter pools/probabilities,
timers, rewards and travel access remain unchanged. The visible difficulty label
agrees with the actual boss definitions on every host.

## Persistence, transfer and host parity

Use versioned migrations for SQLite and browser saves. Validate two distinct owned
partner IDs, one active ID, at most one reserve, bounded histories/counters,
known egg/achievement/route IDs and valid provenance. Reserve food and hygiene
preserve their remaining time; adventure cooldowns retain absolute deadlines.
Save-wide experience
settings, discoveries and achievements must not reset on switching. Adventure
schedules, food, hygiene and pending state belong to each pet. SQLite migration 11
assigns the previous global cooldown only to the principal; browser migration
consumes its legacy global timer once before switching or replacing a save.

The current `web-digital-pet/src/domain/transfer/protocol.ts` uses a v4 envelope
for team state, independent adventure timers, counters and targetless duels. Keep
v1/v2/v3 import compatibility. Update
backup export/import, pairing negotiation, server-backed reads and host bridges
to include both pets and save unlocks; older clients must reject unsupported
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

## Delivery sequence and checks

| Slice | Concrete deliverable | Dependencies / required checks |
| --- | --- | --- |
| Route rules | Reviewed rule alternatives for the limited inputs, source snapshots, numeric care/victory requirements and coverage inventory. | Parser fixtures; dangling target/unknown predicate tests; absent requirements omitted. |
| Automatic evolution | Threshold combat even without a target, atomic post-win route selection, no-evolution notice/EXP reset and legacy compatibility. | Win unlocks a route; win without route; loss; targetless save/transfer; receipt replay and native companion checks. |
| Team foundation | Migrations, explicit active pointer, two pet states, clocks, transfer v4 and host read/write contracts. | v1/v2/v3/v4 round trips; migration/transaction rollback; stale revisions; no double attribution. |
| Team UI and recruitment | Web Dex Team tab, below-name face switch, replacement selection and egg slot creation. | Narrow/mobile/desktop E2E; keyboard, pending states, history and native-save compatibility. |
| Combat progression | Per-form adventure/evolution-duel victories and deduplicated outcome receipts. | Pause/offline/reserve tests, retained wins without evolution, form reset and numeric Dex requirement checks. |
| Achievements and eggs | Permanent boss/exploration rewards, starter family, regional unlocks and egg UI. | Backfill, grant-once, first-form/region mapping, transfer and server-host tests. |
| Jogress | Verified pair rules, transactional manual fusion, lineage, result animation and confirmation UI. | Pair/attribute/origin tests, race/replay tests, reduced motion, History/export verification. |
| Regional difficulty | Authored Easy/Medium/Hard order and reviewed 5/6, 6/6, 7/7 boss pairs; preserve existing stars. | Tier/uniqueness validation, pending-fight compatibility, legacy victory mapping, unchanged ordinary encounters. |

Each slice runs `npm run check` and the relevant workspace Bun tests from the
root. SQLite changes run `npm run test:persistence`; rendering/asset changes run
`npm run build` and focused Playwright browser tests. Multi-package delivery runs
`npm run validate`. Do not release a shared persistence change without updating
all hosts and transfer readers together.

The original eight proposals were rendered at 320, 390 and 1024 pixels and checked
for overflow and interaction errors; those checks do not make the rejected layouts
approved. Future design verification must inspect the retained Team, Recruitment
and Fusion content inside the revised navigation, the minimal face switch, the
Dex Team tab and the new-journey carousel. Product
implementation tests listed above are future acceptance checks, not tests claimed
to have run for unimplemented features.

## Content boundaries and release gates

The current reviewed connection counts and remaining lower-stage gaps are listed
in the [evolution reference inventory](data-sources.md#reference-import-and-game-adaptations).
The importer now reads Pendulum 20th's structured targets and modern guides' full
detail cards, restoring Lopmon and distinguishing fusion requirements from normal
EXP routes. This data audit does not implement the remaining special-route
predicates or unlock every referenced special connection. Unverified legacy
connections still require evidence, and withdrawn targets remain addressable only
to finish already pending saves.

Before the remaining special-route gameplay ships, finish reviewed
pair/attribute/origin definitions and regional reward mapping. Device connection/slot requirements need individual adaptations
(for example, a specific achievement or egg discovery); unsupported requirements
stay unavailable with an honest explanation. Same-stage or backward-stage
transformations need explicit manual rules and loop protection, not inclusion in
normal threshold selection.

This plan introduces egg collections, team storage, achievements and fusion;
it does not assume that a consumable-object inventory alone solves these gates.
If a future audited route truly requires a consumable object, add its own typed
predicate and acquisition/consumption design then. Do not invent objects to
unlock routes whose actual requirement is a pair, origin or regional achievement.
