# Cursor Digital Pet changelog

Changes to the Cursor extension are recorded here. OpenCode releases have their own changelog.

## [Unreleased]

### Changed

- Show the companion's unclean-pile and current-form victory counts alongside the EXP value below the progress bar in the pet viewer, using the saved active partner's combat progress.
- Adapt device evolution victory minimums to game pacing (12→3, 24→5, 50→7, 200→10) in shared rules and the Dex, preserving care alternatives and existing counters.
- Show compact pixel care and combat-victory indicators on Dex routes, with full accessible requirement labels.
- Use locally bundled, species-specific projectiles in shared battles: all 109 PENOG sprites and reviewed assignments for 526 catalog entries; retain the existing fallback where source data is missing.
- Restore Lopmon and other omitted evolution branches from reviewed device detail cards, keep fusion/special routes out of ordinary EXP selection and preserve withdrawn targets for pending saves.
- Give each companion its own adventure cooldown, preserve the principal's legacy timer and keep adventure waits advancing in reserve while apple and care timers pause.

## [0.16.0] - 2026-10-14

### Changed

- Start the evolution duel at 100% even without an eligible route. Count a win before choosing the target; without a result, retain the companion and victory, show the notice and reset EXP.
- Persist adventure and evolution-duel victories per form, prevent replayed rewards and show numeric Dex requirements only on applicable routes.
- Prepare shared team persistence for a principal and resting reserve, with atomic slot replacement, revision checks and active-only token attribution. Team controls are not exposed yet.
- Omit unrestricted care labels in the shared Dex and include reviewed jungle/dark habitat affinities.
- Use shared regional boss tiers and preserve pending fights against previous regional bosses.
- Apply referenced normal evolution routes and current unclean-pile care to token usage, adventure rewards and cleaning. Separate special evolution routes in the Dex.

## [0.15.1] - 2026-10-13

### Fixed

- Refresh previously enabled Agent hooks after extension updates so token experience keeps working when old versions are removed.
- Keep the companion above the adventure scenery so its pixels retain their full contrast.
- Advance the adventure landscape with elapsed travel time and preserve its position when pausing or receiving repeated updates.

## [0.15.0] - 2026-10-11

### Changed

- Feat/music loop sections


## [0.14.0] - 2026-10-11

### Changed

- Feat/adventure pixel controls


## [0.13.0] - 2026-10-11

### Changed

- feat: add adventure bosses and refine pet care UI


## [0.12.0] - 2026-10-11

### Changed

- feat: add persistent adventures and companion recruitment


## [0.11.0] - 2026-10-11

### Changed

- feat: add pet affection, scale battle rewards and refine Dex UI


## [0.10.1] - 2026-10-10

### Changed

- fix: defer battle rewards and preserve feeding position


## [0.10.0] - 2026-10-10

### Changed

- feat: add egg petting rewards in web and Cursor


## [0.9.0] - 2026-10-10

### Changed

- feat: add shared translations and persistent web language selection


## [0.8.0] - 2026-10-10

### Changed

- feat: add player battles and shared pet care


## [0.7.0] - 2026-10-09

### Changed

- Feat/gameplay combat evolution feeding


## [0.6.0] - 2026-10-07

### Changed

- Feat/web digital pet


## [0.5.0] - 2026-10-06

### Changed

- Feat/cursor pet display


## [0.4.0] - 2026-10-06

### Changed

- feat(cursor): add generation history panel and shared LCD webview UI


## [0.3.0] - 2026-10-06

### Changed

- Feat/cursor digidex


## [0.2.4] - 2026-10-06

### Changed

- chore(digital-pet-core): mark stages for a release probe


## [0.2.3] - 2026-10-06

### Changed

- fix(cursor-digital-pet): point README images at the package directory


## [0.2.2] - 2026-10-06

### Changed

- fix(cursor-digital-pet): point README images at the package directory


## [0.2.1] - 2026-10-06

### Changed

- fix(cursor-digital-pet): point README images at the package directory


## [0.2.0] - 2026-10-06

### Added

- Cursor extension with an Explorer sidebar, partner controls, and Agent usage tracking.
- Shared pet database support, so Cursor and OpenCode can show the same partner.
