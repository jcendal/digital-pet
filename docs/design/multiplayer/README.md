# Multiplayer design reference

The multiplayer feature is implemented in the web app. Its current behavior,
identity, storage, peer protocol, exchange recovery and verification are documented
in [Browser multiplayer](../../../packages/web-digital-pet/docs/multiplayer.md).
See [Link previews and invitations](../../../packages/web-digital-pet/docs/sharing.md)
for metadata and sharing behavior.

## Prototype

The [interactive prototype](../../../assets/design/multiplayer/index.html) remains
the visual reference. Serve the repository root and open it locally:

```sh
python3 -m http.server 4188 --bind 127.0.0.1
```

Open `http://127.0.0.1:4188/assets/design/multiplayer/`. The prototype uses isolated
fixtures, does not read real saves and does not contact players. Its exchange
playback is illustrative; the implemented animation is the approved reference.
Regenerate its catalog sprite sheet with
`bun scripts/build-multiplayer-design-artwork.ts`.

## Implemented behavior

Completed visual review captures and recordings are not retained. The browser
tests exercise the implementation and can generate fresh captures when needed.

Arena selects its own fighter without switching the active care companion. Profile
and Friends thumbnails continue to use the active companion. The approved exchange
animation remains unchanged.
