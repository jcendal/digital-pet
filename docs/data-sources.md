# Catalog and sprite data sources

## Preferred structured source

The user selected [Omnipet Digimon Database](https://digimon-db.omnipet.app.br/)
as the preferred source for species information, device data and attack/sprite
resources on 2026-10-14. Its public [API documentation](https://digimon-db.omnipet.app.br/docs)
and [OpenAPI schema](https://digimon-db.omnipet.app.br/openapi.json) were inspected,
along with Agumon's JSON record, its DM20 detail and the module gathering page.
The Digitama artwork export below is integrated locally. Attack rendering and
bulk species imports remain separate work.

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
uses frame 0 until these assets are reviewed. The three currently selectable
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

[Humulos](https://humulos.com/digimon/) remains the reference used by the current
evolution audit and a cross-check for device conditions. Omnipet's structured
module data should enrich and reconcile that audit, preserving discrepancies for
review rather than silently mixing conditions from different versions.
Official reference links supplied by Omnipet identify species information.
Game balance, region difficulty, token thresholds and manual fusion semantics
remain authored game rules, with their adaptations documented explicitly.
