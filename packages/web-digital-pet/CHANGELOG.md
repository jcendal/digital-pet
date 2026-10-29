# Web Digital Pet changelog

Changes to the browser site are recorded here. OpenCode and Cursor releases have their own changelogs.

## [Unreleased]

## [0.15.0] - 2026-10-29

### Changed

- Feat/multiplayer product design


## [0.14.0] - 2026-10-21

- Repair DoneDevimon's identity, missing LoaderLeomon/Crowmon branches and eight pair-only routes without adding species or changing saved IDs.
- Count duplicate DORUguremon IDs once in automatic evolution selection, preserve legacy pending duels, and let final forms keep earning EXP and fighting threshold duels.

### Changed

- Show the principal's unclean-pile and current-form victory counts alongside the EXP value below the progress bar in the pet viewer, updating after cleaning and switches and hiding them on eggs or during combat.
- Adapt device evolution victory minimums to game pacing (12→3, 24→5, 50→7, 200→10) in shared rules and the Dex, preserving care alternatives and existing counters.
- Show compact pixel care and combat-victory indicators on Dex routes, with full accessible requirement labels.
- Use locally bundled, species-specific projectiles in shared battles: all 109 PENOG sprites and reviewed assignments for 526 catalog entries; retain the existing fallback where source data is missing.

## [0.13.1] - 2026-10-15

### Changed

- Restore Lopmon and other omitted evolution branches from reviewed device detail cards, keep fusion/special routes out of ordinary EXP selection and preserve withdrawn targets for pending saves.
- Give each companion its own adventure cooldown, preserve the principal's legacy timer and keep adventure waits advancing in reserve while apple and care timers pause.
- Mark the app and embedded panels as non-translatable by browser services while keeping the built-in language selector. Preserve both adventure timers in v4 backups and transfers, with v1/v2/v3 import compatibility.

## [0.13.0] - 2026-10-14

### Changed

- Start the evolution duel at 100% even without an eligible route. Count a win before choosing the target; without a result, retain the companion and victory, show the notice and reset EXP.
- Persist adventure and evolution-duel victories per form, prevent replayed rewards and show numeric Dex requirements only on applicable routes.
- Choose experience evolution routes from referenced normal branches using 0–3 unclean piles as care mistakes. Keep Jogress and other special routes separate in the Dex.
- Put Team second in Dex / Team / History. Link each member to its Dex record, use a circular-arrow Change Principal action and keep egg selection in New Journey.
- Move the reserve switch below the companion name, omit success text and the New Companion action from Team, and hide unrestricted care labels.
- Integrate local Omnipet Digitama sprites, preserve egg animation, refine the circular reserve control and anchor Team actions at the bottom.
- Offer one visually matched egg per region, unlock nine through regional boss victories and reduce Digitama display sizes.
- Add Next beside All Regions and expand reviewed jungle/dark habitat affinities.
- Preserve two browser companions, reserve care clocks, adventure handoff and stable History numbers. Transfer v3 includes the reserve, form victories and targetless duels, and still imports v1/v2 backups.
- Start with Botamon eggs and discover Forest/Yuramon and Aquatic/Pichimon origins through regional boss victories.
- Order regions by Easy/Medium/Hard difficulty with boss stages 5/6, 6/6 and 7/7 while preserving existing stars and saved boss encounters.
- Keep adventure victory counters out of presentation messages.

## [0.12.1] - 2026-10-13

### Changed

- Group Dex and History in one view with keyboard-accessible tabs.
- Keep save selectors square and remove the evolution experience slider's outer border.
- Scroll the landscape opposite the companion's steps during ordinary walks, as in adventures.

## [0.12.0] - 2026-10-13

### Changed

- feat(web): move regions into tabbed map view


## [0.11.0] - 2026-10-12

### Changed

- Feat/pixel world map


## [0.10.0] - 2026-10-11

### Changed

- Feat/music loop sections


## [0.9.0] - 2026-10-11

### Changed

- Feat/adventure pixel controls


## [0.8.0] - 2026-10-11

### Changed

- feat: add adventure bosses and refine pet care UI


## [0.7.0] - 2026-10-11

### Changed

- feat: add persistent adventures and companion recruitment


## [0.6.0] - 2026-10-11

### Changed

- feat: add pet affection, scale battle rewards and refine Dex UI


## [0.5.3] - 2026-10-10

### Changed

- fix: improve Safari battles, installation and pet care visuals


## [0.5.2] - 2026-10-10

### Changed

- fix: defer battle rewards and preserve feeding position


## [0.5.1] - 2026-10-10

### Changed

- fix(web): show player battles in the pet viewer


## [0.5.0] - 2026-10-10

### Changed

- feat: add egg petting rewards in web and Cursor


## [0.4.0] - 2026-10-10

### Changed

- feat: add shared translations and persistent web language selection


## [0.3.0] - 2026-10-10

### Changed

- feat: add player battles and shared pet care


## [0.2.0] - 2026-10-09

### Changed

- Feat/gameplay combat evolution feeding


## [0.1.0] - 2026-10-07

### Changed

- feat(web): version and tag site releases like the other products

