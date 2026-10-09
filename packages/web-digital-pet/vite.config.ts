import { execFile } from "node:child_process"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { defineConfig, type Plugin, type UserConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

import { entries } from "./src/server/rendering/build-resources.ts"
import { resourceFiles, resourcesPlugin, textImportsPlugin } from "./tooling/resources.ts"

const root = fileURLToPath(new URL(".", import.meta.url))
const files = resourceFiles(root)

export default defineConfig(
  ({ isSsrBuild }): UserConfig => ({
    root,
    publicDir: false,
    appType: "custom",
    resolve: { alias: Object.entries(files).map(([find, replacement]) => ({ find, replacement })) },
    ssr: { noExternal: [/^@jcendal\//] },
    plugins: [
      textImportsPlugin(),
      {
        name: "digital-pet-preview-routes",
        configurePreviewServer(server) {
          server.middlewares.use((request, _response, next) => {
            const url = new URL(request.url ?? "/", "http://localhost")
            if (["/", "/dex", "/history"].includes(url.pathname)) url.pathname = "/index.html"
            else if (/^\/view\/(sidebar|dex|history)$/.test(url.pathname)) url.pathname += ".html"
            else if (/^\/api\/(mode|sidebar|dex|history|world)$/.test(url.pathname)) url.pathname = "/api/browser.json"
            request.url = url.pathname + url.search
            next()
          })
        },
      },
      ...(isSsrBuild
        ? []
        : [
            resourcesPlugin(files),
            {
              name: "digital-pet-static-pages",
              apply: "build",
              closeBundle: {
                order: "pre",
                sequential: true,
                async handler(error?: Error) {
                  if (error) return
                  await promisify(execFile)(process.execPath, [resolve(root, "dist/export.js")], {
                    env: { ...process.env, DIGITAL_PET_DATABASE_PATH: resolve(root, "dist/.no-host-database") },
                  })
                },
              },
            } satisfies Plugin,
            VitePWA({
              strategies: "injectManifest",
              srcDir: "src/worker",
              filename: "service-worker.ts",
              manifest: false,
              injectRegister: false,
              integration: { closeBundleOrder: "post" },
              injectManifest: {
                globPatterns: ["assets/**/*.{js,css,html,png,svg,ico,ttf}", "index.html", "manifest.webmanifest"],
                // The pixel catalog and lake artwork currently exceed Workbox's 2 MiB default.
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
                dontCacheBustURLsMatching: /^assets\//,
                rollupFormat: "iife",
              },
            }),
          ]),
    ],
    build: {
      outDir: isSsrBuild ? "dist" : "dist/client",
      emptyOutDir: true,
      target: isSsrBuild ? "node24" : "es2022",
      assetsInlineLimit: 0,
      manifest: !isSsrBuild,
      modulePreload: { polyfill: false },
      rolldownOptions: {
        input: isSsrBuild
          ? { server: resolve(root, "src/server/main.ts"), export: resolve(root, "tooling/render-static.ts") }
          : Object.fromEntries(Object.entries(entries).map(([name, path]) => [name, resolve(root, path)])),
        output: isSsrBuild ? { entryFileNames: "[name].js", chunkFileNames: "[name].js" } : {},
      },
    },
  }),
)
