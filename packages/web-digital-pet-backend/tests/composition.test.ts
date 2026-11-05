import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

test("deployed handlers include only their own service composition", async () => {
  const result = await build({
    absWorkingDir: fileURLToPath(new URL("../", import.meta.url)),
    entryPoints: ["auth", "authorizer", "saves", "social", "realtime"].map((name) => `src/handlers/${name}.ts`),
    outdir: "dist",
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    metafile: true,
  })
  for (const [output, metadata] of Object.entries(result.metafile.outputs)) {
    const inputs = Object.entries(metadata.inputs)
      .filter(([, entry]) => entry.bytesInOutput > 0)
      .map(([path]) => path)
      .join("\n")
    if (!output.endsWith("/auth.js")) {
      expect(inputs).not.toContain("@aws-sdk/client-cognito-identity-provider/")
      expect(inputs).not.toContain("@aws-sdk/client-kms/")
    }
    if (!output.endsWith("/saves.js")) expect(inputs).not.toContain("src/backups.ts")
    if (!output.endsWith("/social.js")) expect(inputs).not.toContain("src/social.ts")
    if (output.endsWith("/authorizer.js")) {
      expect(inputs).not.toContain("src/auth.ts")
      expect(inputs).not.toContain("src/realtime.ts")
    }
  }
})
