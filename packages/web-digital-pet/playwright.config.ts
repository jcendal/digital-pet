import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:4175",
    browserName: "chromium",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
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
