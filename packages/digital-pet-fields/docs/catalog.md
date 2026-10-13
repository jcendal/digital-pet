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
