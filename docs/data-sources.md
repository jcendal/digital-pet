# Catalog and sprite data sources

## Preferred structured source

The user selected [Omnipet Digimon Database](https://digimon-db.omnipet.app.br/)
as the preferred source for species information, device data and attack/sprite
resources on 2026-10-14. Its public [API documentation](https://digimon-db.omnipet.app.br/docs)
and [OpenAPI schema](https://digimon-db.omnipet.app.br/openapi.json) were inspected,
along with Agumon's JSON record, its DM20 detail and the module gathering page.
The Digitama and attack artwork exports below are integrated locally. Other bulk
species/rule imports remain separate work.

| Resource | Verified public read endpoint |
| --- | --- |
| Search | `/api/digimon` with name, level, type, attribute, field, group, official, offset and limit filters |
| Species record | `/api/digimon/{digimon_id}` |
| Classification metadata | `/api/metadata`, `/api/attributes`, `/api/levels`, `/api/fields` |
| Per-device data | `/api/digimon/{digimon_id}/{module}` |
| Resolved module and provenance | `/api/gathering/{module}` and `/api/gathering/{module}/entries/{target}` |
| Sprite sheet | `/api/digimon/{digimon_id}/sheet/{fmt}`; formats include color, dot and hd |
| Individual frame | `/api/digimon/{digimon_id}/sheet/{fmt}/frame/{frame}` with optional module selection |
| Origin egg resources | `/api/digitamas` and `/api/digitamas/{name}/sheet/{fmt}/frame/{frame}` |
| Change detection | `/api/sprites/checksum` |

Search has a maximum page size of 216 according to the inspected schema. Use
bounded pagination and cache exports; do not assume the first page is complete.

## Information verified in the sample

[Agumon's record](https://digimon-db.omnipet.app.br/api/digimon/agumon) contains
names and aliases, levels, attributes, fields, groups, named special moves,
official reference links and `extra_data` keyed by device module. Its DM20 entry
contains attack references (`atk_main`, `atk_alt`) and evolution alternatives with
care, training and overfeeding conditions. Module `slots` can contain their own
evolution alternatives and version/index information.

The [DM20 gathering view](https://digimon-db.omnipet.app.br/gathering/dm20)
distinguishes device versions and data provenance such as battle capture,
observation and community reference. Consult its resolved data alongside the
generic species record when importing a particular device's rule.

The DM20 Agumon UI displays attack indices 1 and 26, whereas the inspected generic
JSON contains `atk_main: 2` and `atk_alt: 27`. Do not assume numbering is identical:
verify the attack-set index conversion against the resolved module and actual
resource before rendering a projectile. The special-move name, the creature's
attack-pose frame, and the projectile sprite are separate concepts. Frame 15 is
documented as a special frame; it is not automatically the projectile.

## Integration rules

- Keep existing game node IDs and save references stable. Maintain a reviewed
  crosswalk to Omnipet IDs; English/dub/Japanese names and aliases can differ, and
  variants must remain distinct. Match neither by array position nor by an
  unchecked sprite slug.
- Preserve module, device/version, slot, source URL and retrieval time. Keep each
  full condition group together: all requirements within an alternative must
  hold, while separate alternatives remain alternatives. Do not flatten device
  rules into one universal evolution list.
- Prefer resolved, evidenced module data for device-specific attributes,
  evolution rules and attack identifiers. Preserve global species classifications
  separately when module-specific values differ. Unknown or alternative
  attributes do not become invented Vaccine/Data/Virus assignments.
- Keep original source requirements separate from game adaptations: current
  unclean piles represent care, adventures represent effort, and save-wide boss
  achievements represent applicable unlocks. Display numeric combat-victory requirements in the Dex only where applicable,
  following the revised gameplay plan.
- Generate shared metadata and rule data under `digital-pet-core`; regional
  placements belong in `digital-pet-fields`. Import projectile and animation
  resources into their owner in `digital-pet-animation`, with manifest entries
  for source module, index and local file checksum. Reuse shared renderers in
  Cursor, OpenCode and the browser.
- Download and validate resources during an explicit import step. Bundle local
  outputs so gameplay works offline and keeps its current CSP. Do not hotlink
  sprites or call the third-party API from every animation frame.
- Inspect frame ordering, dimensions, transparency and facing before assigning
  animation states. Preserve crisp pixel rendering and current LCD presentation.
  Report unavailable assets and use the existing fallback instead of a broken
  URL or an unrelated species' artwork.
- Review missing/partial source fields rather than interpreting absence as zero,
  no requirement or confirmation that a route is valid. Keep source attribution
  from Omnipet's [Sources & Tools](https://digimon-db.omnipet.app.br/sources).

## Imported attack projectiles and Dex indicators

On 2026-10-16, the [PENOG protocol page](https://digimon-db.omnipet.app.br/protocols/penog)
lists **109** projectiles numbered **0–108**. All are bundled under
`digital-pet-animation/assets/attacks/`, along with the other device projectiles
needed by reviewed species assignments: **265** local PNGs in total. Each manifest
entry records its bank, zero-based index, source URL, original PNG checksum,
dimensions and derived LCD artwork. Original files retain their alpha and colour;
classic 24×24 exports become 8×8 LCD pixels, while colour-device projectiles are
adapted to that canvas with nearest-neighbour sampling and white highlights.

Assignments use the resolved `/api/gathering/{module}` records, not the generic
one-based `atk_main` values or a guessed protocol Shot mapping. For example,
Agumon's resolved PENOG sprite is **1**, Ikkakumon's is **91**; neither is the raw
Shot field. Device/version and evidence kind are retained for every chosen
assignment. Preference is explicit in the generated `modulePriority` array: the
original Pendulum first, followed by the other classic devices and then bracelets.
Evidenced assignments take precedence over assumed/unknown entries. The first
available evidenced device/version in the preferred module supplies the main attack;
this does not assert a universal projectile across all versions or add strong-shot
damage rules to this game's combat.

All 649 non-egg catalog identities match species records through official
reference identity or unambiguous names, with stages used for duplicate identities.
**526 of the 650 entries** have an available resolved assignment and sprite.
The other **124**, including the generic egg, are listed in `unavailable` in
`digital-pet-core/src/data/attack-assignments.json`. They keep the existing flame
fallback; missing source data is not filled with another species' supposed attack.
The shared combat renderer selects the firing species' projectile, mirrors the
opponent's shot and preserves the existing travel, hit and recovery behavior in
the web app, Cursor and OpenCode. Rendering makes no network requests.

To refresh, cache complete paginated `/api/digimon?limit=216&offset=...` results
as one `species.json` array and export `DIGIMON_DATA` to `catalog.json` under an
external input directory. Save each module named in the importer's `MODULES`
tuple from `/api/gathering/{module}` as `{module}.json` in that directory. Then,
with Pillow and curl installed, run:

```sh
python3 scripts/import-attack-artwork.py --input /path/to/input --cache /path/to/png-cache --download
npx biome format --write packages/digital-pet-core/src/data/attack-assignments.json packages/digital-pet-animation/assets/attacks/catalog.json
python3 -m unittest discover -s scripts/tests -p 'test_*.py'
```

Omit `--download` for a fully offline regeneration. The exporter owns its generated
attack directory and removes obsolete exported PNGs. Review assignment changes
and evidence kinds before updating the bundled snapshot.

In the shared web/extension Dex, a pixel pile and a training-style dumbbell label
the exact care and combat-victory values on a route. Values such as `0/1` still
mean either count; they are not a progress meter. Tooltips and accessible labels
retain the full localized requirement. Unrestricted care stays hidden and
separate condition alternatives remain separate groups. These icons change
presentation only; combat victories and care rules are unchanged.

The pet viewer reuses these same icons for current values: unclean piles and
combat victories in the principal's current form. They sit to the right of the EXP value
below the progress bar, update after cleaning or switching, and are hidden for eggs,
debug overrides and combat/evolution presentation. The browser reads the selected
companion's own saved counter; Cursor's sidebar snapshot reads the active
partner/form combat row, with legacy snapshots defaulting to zero. Displayed
counts are not route requirements and do not use the `+` suffix.

## Imported Digitama designs

On 2026-10-14, `/api/digitamas` returned **44** designs named Digitama 1–44,
each with color and dot formats. Frames 0 and 1 of every dot design are stored under
`packages/digital-pet-animation/assets/digitamas/`. The generated `catalog.json`
records each source URL, original PNG SHA-256, dimensions, format, frame index,
LCD path and terminal artwork. The source PNGs retain their original alpha;
transparent green guide pixels and opaque white do not become dark LCD pixels.
The importer validates PNG checksums, RGBA dimensions and the 16×16 pixel grid.
All 44 first frames pass these checks. There are 35 valid second frames; the
second frames for designs 27–34 and 37 are not aligned to the source pixel grid.
Their original PNGs and checksums are retained in `alternateReview`; the renderer
uses frame 0 until these assets are reviewed. All ten selectable regional
origins have valid animated pairs.

To refresh this reviewed export from the repository root:

```sh
curl -fsSL --max-time 25 'https://digimon-db.omnipet.app.br/api/digitamas/Digitama%20[1-44]/sheet/dot/frame/0' -o 'packages/digital-pet-animation/assets/digitamas/digitama-#1.png'
curl -fsSL --max-time 25 'https://digimon-db.omnipet.app.br/api/digitamas/Digitama%20[1-44]/sheet/dot/frame/1' -o 'packages/digital-pet-animation/assets/digitamas/digitama-#1-frame-1.png'
python3 scripts/import-digitama-artwork.py
npx biome format --write packages/digital-pet-animation/assets/digitamas/catalog.json
```

The game selects **ten** distinct animated designs, one for each region, after
reviewing all 44 color and LCD sprites. The selection is illustrated in the
[regional egg board](../assets/design/evolution-gameplay/regional-eggs/selection.png).
The same design appears in the carousel, Team, quick switch and browser pet view.
Collection and Team previews use the same 32-pixel canvas as other species;
the principal egg uses 75% of the usual pixel size.

| Region / Field | Origin ID | Design | Visual fit | First form |
| --- | --- | --- | --- | --- |
| Village of Beginnings / Virus Busters | starter | Digitama 10 | Bright star | Botamon |
| Gear Savannah / Nature Spirits | savannah | Digitama 1 | Organic green patches | Punimon |
| Coela Beach / Deep Savers | aquatic | Digitama 4 | Blue bubble shapes | Pitchmon |
| Digital Forest / Wind Guardians | forest | Digitama 14 | Flowing green bands | Yuramon |
| Digital City / Metal Empire | machine | Digitama 20 | Grey plates and rivets | Choromon |
| Ancient Dino Region / Dragon's Roar | dragon | Digitama 8 | Red flame | Petitmon |
| Tropical Jungle / Jungle Troopers | jungle | Digitama 43 | Green overlapping leaves/scales | Bubbmon |
| Wasteland / Nightmare Soldiers | nightmare | Digitama 21 | Skull | Mokumon |
| Vamdemon Castle / Dark Area | dark | Digitama 9 | Purple bat-like shape | Kiimon |
| Upside-Down Pyramid / Unknown | mystery | Digitama 23 | Angular maze | Kuramon |

The village origin is available initially. A victory over either boss in each
other region permanently unlocks that region's egg. Duplicate and legacy boss
victories retain unlocks without adding duplicate eggs. The existing starter,
forest and aquatic saved IDs and hatch targets are preserved; unknown/legacy
origins retain their existing generic artwork. New origins are supported by
backup/transfer validation through the shared family catalog.

These are authored visual, hatch and regional-unlock assignments. Omnipet's list
supplies designs and formats, **not hatch species or regional unlock rules**.
The remaining source designs are retained as an offline resource archive.

## Evolution references

[Humulos](https://humulos.com/digimon/) supplies the generated evolution reference
snapshot and device-condition evidence. Omnipet's structured module data should
enrich and reconcile that snapshot, preserving discrepancies for review rather
than silently mixing conditions from different versions.
Official reference links supplied by Omnipet identify species information.
Game balance, region difficulty, token thresholds and manual fusion semantics
remain authored game rules, with their adaptations documented explicitly.


### Reference import and game adaptations

The 2026-10-15 reviewed snapshot in `digital-pet-core/src/data/evolution-reference.json`
contains 2,235 connections: 1,291 normal, 582 Jogress, 360 special and two withdrawn
connections retained as unverified for pending saves. It retains guide URLs, 834
individual detail-card URLs, care masks and 93 normal connections with numeric
victory conditions. Pendulum 20th routes come from its embedded species/target
dataset; modern guides use their full detail cards rather than icon-only chart
connectors. Imports fail when a required modern card or previous guide is missing.
The importer combines the supported devices' confirmed routes; this is not an
emulator of one device. Stage and official-reference identity disambiguate names;
unresolved names and unmatched species are excluded. Separate historical IDs for
the same species retain their routes. Negative slot/album guards describing a
device's default branch do not invent unlock requirements; positive unlocks,
collection conditions, DigiXros and mode changes remain special.
Unverified legacy branches cannot be chosen for new EXP evolutions, but remain
valid for finishing an already pending target. Species IDs and history stay stable.

The audit adds 337 verified connections and reclassifies 292 previous normal
connections as special or Jogress. Two inferred Gallantmon X connections from
NoblePumpkinmon and TigerVespamon are withdrawn from automatic selection. Lopmon
now evolves normally into Turuiemon. Turuiemon's Antylamon alternative requires
0–2 unclean piles and at least 3 form victories under the adaptations below;
Angewomon's HerculesKabuterimon and MetalEtemon connections remain Jogress.

Coverage of the 650 saved catalog IDs (including the generic egg) is:

| Verified outgoing connections | Catalog entries |
| --- | ---: |
| At least one normal EXP route | 478 |
| Only special/Jogress routes | 65 |
| No verified outgoing route in the imported sources | 107 |

Most entries in the last group are final stages. The following lower-stage gaps
remain explicit; absence in these device sources does **not** establish that a
species has no evolution in every Digimon continuity. Do not invent EXP routes
to fill them without evidence.

| Below stage VI | Species |
| --- | --- |
| No verified outgoing route | Moonmon, Sunmon, Tylomon, Fugamon, Rhinomon, Giromon, Tekkamon, Vademon |
| Only special/Jogress outgoing routes | Minotarumon, Omekamon, Peckmon, Datamon, Garbagemon, Jagamon |

Care uses the current 0–3 unclean piles at post-win target selection. Source
care-mistake ranges are clamped to that scale; documented care takes precedence
over alternatives that omit it. Unrestricted care labels are omitted in the Dex.
The generated snapshot retains original device victory minimums. At catalog load,
the shared `evolution-victory-policy.ts` adapts them to game pacing: **12 → 3,
24 → 5, 50 → 7 and 200 → 10**. Zero stays zero, including alternatives that permit
no prior victories for particular care counts. Thus a source window such as
12–15 victories becomes a game minimum of 3 within the current form. Gameplay
and the Dex consume the same adapted routes; saved counters are not rescaled,
and fixed legacy pending targets stay fixed. Care and victories within one alternative both have
to hold; separate alternatives remain OR groups. An unrestricted alternative
covering a care category does not invent a victory requirement for that category.
Device timing, level and effort are adapted to EXP, without separate training or
win-ratio systems.

Non-egg threshold duels start at 100% without selecting a target. A win adds a
victory before evaluating routes. With no eligible result, keep the species and
victory, show the notice and reset EXP. A loss resets EXP without adding a win.
Adventure and evolution-duel wins count per form, survive reserve switches and
save transfers, and reset on a form change. PvP wins currently do not count.
Existing pending targets stay fixed. SQLite migration 10 and browser transactions
prevent duplicate or stale resolution; transfer v4 preserves counters, targetless duels and each pet's adventure timer
while accepting v1/v2/v3 backups. SQLite migration 11 separates adventure schedules
by companion, assigning the previous global timer only to the principal.

Jogress, slot/connection unlocks, permanent objectives and same/backward-stage
changes remain separate from automatic EXP evolution. Garurumon → Orochimon is
referenced for Vital Bracelet as Jogress with a Virus Adult, not an ordinary EXP
choice. Manual fusion and the remaining objective/origin adaptations are tracked
in the [remaining implementation plan](evolution-gameplay-plan.md).

To regenerate the snapshot, download the guides named in its `sources` map using
`digital-pet-humulos-<guide>.html` filenames, export `DIGIMON_DATA` as JSON, and run
from the repository root with BeautifulSoup 4 and curl installed. Keep downloaded
HTML, catalog exports and detail caches outside the repository:

```sh
python3 scripts/download-evolution-details.py --html-dir /path/to/html --catalog /path/to/catalog.json --output /path/to/details
python3 scripts/import-evolution-reference.py --html-dir /path/to/html --details-dir /path/to/details --catalog /path/to/catalog.json
npx biome format --write packages/digital-pet-core/src/data/evolution-reference.json
python3 -m unittest discover -s scripts/tests -p 'test_*.py'
```

The importer reads only the local snapshots. By default it compares against the
existing output, preserving withdrawn targets as unverified for pending saves;
`--previous` supplies that baseline when writing to another path. Synthetic parser
tests cover full alternatives, singular care mistakes, target stages, fusion
conditions and missing evidence. Gameplay uses the bundled JSON without network
requests. Omnipet was unavailable during this audit; no unavailable response was
treated as evolution evidence.
