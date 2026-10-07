# Web Digital Pet

A local browser companion for Digital Pet. It uses the same partner, Digidex, and generation history as the Cursor extension and OpenCode plugin. The interface fills a phone screen; on a large display, its 430 × 880 pixel device is centered over an original lake-and-mountains Digital World background. The navigation stays at the bottom while Dex and History scroll inside the device.

## Run locally

From the repository root, with Node 24.11.0 or newer and npm installed:

```sh
npm ci
npm run web
```

Open `http://localhost:4173`. The server listens on `127.0.0.1`, reads the shared `pet.db` without changing it, and refreshes the partner automatically. Cursor or OpenCode must be running to record new token usage and advance the pet. The browser can be closed without affecting either integration.

The site includes a web app manifest, install icons, and a service worker. In a browser that supports PWA installation, use its **Install app** or **Add to Home Screen** action while visiting the local site. Partner, Dex, and History stay mounted as you navigate, so switching sections does not reload the page. The installed app still needs this local server running for live archive data. Remote installation requires an HTTPS address connected to the server.

Use `DIGITAL_PET_DATABASE_PATH` to select another database file, or `PORT` to choose another local port. For example:

```sh
DIGITAL_PET_DATABASE_PATH=/path/to/pet.db PORT=4174 npm run web
```

The server is local to the computer running it. To view it on a separate phone, use a trusted local tunnel or proxy that you control; the server is not configured for public hosting.
