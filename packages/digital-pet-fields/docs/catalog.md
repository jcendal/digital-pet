# Maintaining the world catalog

World data and scenery belong to `digital-pet-fields`. Shared encounter odds and
rewards belong to core, battle introductions to animation, and map cards to
webviews. Hosts own travel preferences and persistence.

## Habitats and sources

All 650 catalog records have at least one habitat; species can inhabit several
regions, and variants remain separate records.

- `src/data/field-reference.json` records Field memberships for 529 records,
  consulted from [Digi-API](https://digi-api.com/) on 2026-10-07. Each `apiId`
  identifies its reference record. This is a community source; there are no
  runtime API calls.
- `src/data/habitat-fallbacks.ts` supplies thematic assignments for the remaining
  121 records. Infants without reference Fields have a nursery in Village of
  Beginnings; species themes can provide another home.
- `src/data/habitats.ts` merges reference memberships and game assignments
  without duplicate IDs. Unknown is a Field, not a fallback for missing data.

Field-to-place correspondences are game choices rather than official geography.
Coverage tests reject missing habitats and references to absent catalog records.
Guide registration counts come from save history; browsing does not unlock entries.

## Scenery

Background images live in `assets/backgrounds`; their filenames are declared in
`src/data/regions.ts`. Add them through the existing resource inventory and rebuild
the web app. Missing backgrounds use the location's atmosphere gradient.

LCD landscapes live in `assets/scenes`. Preserve the 160 × 160 viewBox, square
pixels, muted palette, and space for the companion. Locations can share a scene.

## LCD atlas

`assets/maps/file-island.svg` is original vector pixel artwork inspired by the
[File Island map in the Adventure Digivice](https://humulos.com/digimon/dvc/adventure/):
central Infinity Mountain, a western lake, southern rainforest, and stepped coast.
It has one zone marker for each of our ten habitats, including Server and
Spiral Mountain habitats; it is not a canonical map of the series or a copied sprite.
`src/data/world-map.ts` owns positions in its 160 × 176 coordinate system.
Coverage tests require exactly one marker per habitat. A marker opens a dropdown
for its habitat's locations. Shared webviews own markers,
the traveler and location picker; the web host owns navigation and saves through the existing
world store. Browser visits remain in the transferable save, while computer visits
remain a separate web preference.

## Bosses

`src/data/bosses.ts` assigns two existing catalog species to each region. These
are thematic assignments inspired by [Adventure](https://lineup.toei-anim.co.jp/ja/tv/dejimon/episode/),
[Frontier](https://lineup.toei-anim.co.jp/ja/tv/digimon_4th/episode/44/),
[Frontier's film](https://lineup.toei-anim.co.jp/ja/movie/digimon_kodai/staff/),
[The Revenge of Diaboromon](https://lineup.toei-anim.co.jp/ja/movie/digimon_diavolo/story/),
and *Last Evolution Kizuna*. Keep existing catalog IDs and walking/attack sprites;
do not edit generated species data. Tests verify every zone and required sprite.


Regions have authored Easy, Medium and Hard difficulties. `REGION_BOSS_TIERS`
requires stages 5/6, 6/6 and 7/7 respectively. The gallery uses
`REGIONS_BY_DIFFICULTY`; map geography, residence assignments, travel access,
encounter odds and reward fractions remain unchanged. Species use their real
catalog stage and combat statistics, with no extra regional multiplier.

Boss slots carry previous-species aliases. Their victory projection preserves
stars earned before the boss lineup changed, and `getLegacyRegionBosses` lets
saved encounters finish against the original opponent. Legacy bosses are not
added to the new encounter pool. Transfer validation accepts both current and
legacy boss IDs for their actual region.

`egg-discoveries.ts` maps authored regional victories to egg families defined in
core. Browser origins currently include Starter/Botamon, Forest/Yuramon and
Aquatic/Pichimon. Only Starter begins unlocked; prior regional wins unlock their
families without granting any new boss achievement. Origins use the generic
Digitama sprite and constrain only the first form; legacy eggs keep their original
hatch options. Native origin persistence and further egg families remain pending.


## Reviewed game affinities (2026-10-14)

`habitat-affinities.ts` supplements source Field memberships with explicit game
placements. The review used Omnipet's [Field lists](https://digimon-db.omnipet.app.br/api/fields)
and its species lists for [Insectoid](https://digimon-db.omnipet.app.br/api/digimon?type=66&limit=216),
[Vegetation](https://digimon-db.omnipet.app.br/api/digimon?type=54&limit=216),
[Demon](https://digimon-db.omnipet.app.br/api/digimon?type=27&limit=216),
[Dark Angel](https://digimon-db.omnipet.app.br/api/digimon?type=76&limit=216) and
[Evil King](https://digimon-db.omnipet.app.br/api/digimon?type=11&limit=216).

The new affinities place insects/plants in Tropical Jungle and demons/dark angels
in Vamdemon Castle, even when their documented Field is another category. They
are authored game placements inferred from those types, not claims that Omnipet
classifies every added species as Jungle Troopers or Dark Area. Existing source
memberships remain intact and a species can live in multiple regions.

| Region / Field | Before | After | Added game affinities |
| --- | --- | --- | --- |
| Vamdemon Castle / Dark Area | 55 | 62 | Fugamon, Ogremon X, DoneDevimon, LadyDevimon, NeoDevimon, Murmukusmon, Beelzemon X |
| Tropical Jungle / Jungle Troopers | 45 | 60 | Morphomon, Hudiemon, Roachmon, Shadramon, JewelBeemon, Okuwamon, SkullScorpiomon, Palmon X, Pomumon, RedVegiemon, Togemon X, Blossomon, Entmon, Jagamon, Toropiamon |

The review records explicit catalog/source IDs. Generic aliases and empty sprite
names cannot stand in for an exact form: ordinary Ophanimon is not its Falldown
form, and a base species is not its X variant. No species were removed or added
to the 650-record catalog. Tests verify membership, no duplicate assignments and
retention of all existing source Fields.
