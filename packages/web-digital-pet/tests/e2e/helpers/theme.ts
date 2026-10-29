/** Apply the same host preference to regular and explicit multiplayer contexts. */
export const themeContextOptions =
  process.env.PLAYWRIGHT_THEME === "color"
    ? {
        storageState: {
          cookies: [],
          origins: [4175, 4176, 4177].map((port) => ({
            origin: `http://127.0.0.1:${port}`,
            localStorage: [{ name: "digital-pet:theme", value: "color" }],
          })),
        },
      }
    : {}
