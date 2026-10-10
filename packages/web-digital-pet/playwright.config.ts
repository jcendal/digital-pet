import { defineConfig, devices } from "@playwright/test"

const safari = process.env.PLAYWRIGHT_WEBKIT === "1"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  use: {
    ...(safari ? devices["iPhone 13"] : {}),
    baseURL: "http://127.0.0.1:4175",
    browserName: safari ? "webkit" : "chromium",
    launchOptions:
      !safari && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {},
  },
  webServer: [
    { command: "node tests/e2e/server.mjs", url: "http://127.0.0.1:4175", reuseExistingServer: false },
    {
      command: "node dist/server.js",
      url: "http://127.0.0.1:4176",
      env: { PORT: "4176", DIGITAL_PET_DATABASE_PATH: "/tmp/digital-pet-browser-tests-absent.sqlite" },
      reuseExistingServer: false,
    },
    {
      command: "node scripts/dev.mjs",
      url: "http://127.0.0.1:4177",
      env: { PORT: "4177", DIGITAL_PET_DATABASE_PATH: "/tmp/digital-pet-browser-tests-absent.sqlite" },
      reuseExistingServer: false,
    },
  ],
})
