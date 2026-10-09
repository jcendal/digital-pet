# Digital Pet Fields

Private, reusable Digital World catalog for Digital Pet. Hosts choose how to display and save a visit. The package contains no DOM code, IndexedDB, SQLite, network calls, or evolution rules.

## Layers

| Layer | Responsibility |
| --- | --- |
| `src/domain/world.ts` | Field, Region, WorldLocation, WorldVisit, and asynchronous WorldVisitStore port |
| `src/data/fields.ts` | Ten active Fields; four future Fields documented as comments |
| `src/data/regions.ts` | Destinations, locations, scene references, photo filenames, and fallback atmosphere |
| `src/data/habitats.ts` | Complete habitat rosters, combining reference Fields and explicit game choices |
| `src/application/world.ts` | Visit validation, defaults, residents, overlapping habitats, and discovery counts |
| `assets/scenes` | Eleven original LCD pixel landscapes, rendered as SVG |
| `assets/backgrounds` | Large page background photographs or illustrations |

`digital-pet-core` supplies the species catalog. `digital-pet-webviews` builds the guide model and renders the region panel. `web-digital-pet` serves assets, handles travel, and implements persistence. This catalog can also be reused by other hosts without depending on a browser.

## Active destinations

| Field | Region / primary location | Photo filename |
| --- | --- | --- |
| Nature Spirits | Gear Savannah | `gear-savannah.png` |
| Deep Savers | Digital Ocean | `digital-ocean.png` |
| Nightmare Soldiers | Wasteland | `wasteland.png` |
| Wind Guardians | Digital Forest | `digital-forest.png` |
| Metal Empire | Digital City | `digital-city.png` |
| Virus Busters | Village of Beginnings | `village-of-beginnings.png` |
| Dragon's Roar | Ancient Dino Region | `ancient-dino-region.png` |
| Jungle Troopers | Tropical Jungle | `tropical-jungle.png` |
| Dark Area | Vamdemon Castle | `vamdemon-castle.png` |
| Unknown | Upside-Down Pyramid | `upside-down-pyramid.png` |

**Dragon Eye Lake** is the initial location, with the existing lake illustration in `assets/backgrounds/dragon-eye-lake.png`. It is grouped under Digital Ocean for this game's navigation. Regions can contain several locations; this grouping and the Field-to-place correspondence are product choices, not a claim of official geography.

All **650 catalog records** have at least one habitat. A species can inhabit several regions, and catalog variants remain separate records, matching the Dex.

- `field-reference.json` stores Field memberships for 529 records, consulted from [Digi-API](https://digi-api.com/) on 2026-10-07. Its `apiId` links each catalog record to `https://digi-api.com/api/v1/digimon/<apiId>`. This is a community reference, not an official canonical classification. No API calls are made at runtime.
- `habitat-fallbacks.ts` records explicit thematic assignments for the other 121 records, including eggs, infants, and variants without published Fields. Infants without reference Fields have a nursery in Village of Beginnings; recognizable species themes can provide an additional home.
- `habitats.ts` preserves the original game assignments and merges these sources without duplicate IDs. Unknown is a real Field and never an automatic destination for missing data.

Coverage tests fail when a catalog record lacks a habitat or a roster references a missing record. `auditHabitatCoverage` reports both cases. Registered counts use existing save history; browsing the guide never unlocks a Dex entry. The web guide initially shows five residents, with a disclosure arrow to reveal the rest; the arrow disappears when expanded.

## Add background images

Put the supplied PNG in `assets/backgrounds/` using the filename above, then rebuild the web app. Available files are included by the Vite resource inventory. The web background uses the image when present and the location's atmosphere gradient otherwise. No changes to application logic are needed.

Pixel landscapes live in `assets/scenes/<scene>.svg`. Keep the `160 × 160` viewBox, crisp square pixels, and muted LCD palette. Leave the center open for the animated companion. Multiple locations can reuse a scene, or add a new SceneId and SVG for a distinct environment.

## Visits and progression

The initial implementation affects exploration and appearance only. Travel changes neither evolution candidates nor experience requirements. A browser visit is part of its transferable save and survives a new egg. Computer-save travel is a web preference stored separately and never writes to the shared SQLite archive.

## Development

From the repository root:

```sh
npm run typecheck --workspace @jcendal/digital-pet-fields
npm run test --workspace @jcendal/digital-pet-fields
```
