import { expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"

test("web publishing uploads clean legal URLs with explicit MIME types and invalidates old documents", () => {
  const root = mkdtempSync(resolve(tmpdir(), "digital-pet-publish-"))
  try {
    const callsPath = resolve(root, "calls.jsonl")
    const aws = resolve(root, "aws")
    writeFileSync(
      aws,
      `#!/usr/bin/env node\nrequire("node:fs").appendFileSync(${JSON.stringify(callsPath)}, JSON.stringify(process.argv.slice(2)) + "\\n")\n`,
    )
    chmodSync(aws, 0o755)
    for (const file of [
      "index.html",
      "service-worker.js",
      "manifest.webmanifest",
      "api/browser.json",
      "legal/privacy.html",
      "legal/privacy.pdf",
      "legal/terms.html",
      "legal/terms.pdf",
    ]) {
      const path = resolve(root, "packages/web-digital-pet/dist-static", file)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, "fixture")
    }
    execFileSync("bash", [resolve(import.meta.dir, "../publish-web.sh")], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${root}:${process.env.PATH}`,
        AWS_REGION: "us-east-1",
        WEB_BUCKET_NAME: "test-bucket",
        WEB_DISTRIBUTION_ID: "test-distribution",
      },
    })
    const calls: string[][] = readFileSync(callsPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    for (const slug of ["privacy", "terms"]) {
      for (const [extension, type] of [
        ["", "text/html; charset=utf-8"],
        [".pdf", "application/pdf"],
      ]) {
        const upload = calls.find((args) => args[3] === `s3://test-bucket/legal/${slug}${extension}`)
        expect(upload?.[0]).toBe("s3")
        expect(upload?.[1]).toBe("cp")
        expect(upload).toContain(type)
        expect(upload).toContain("no-cache")
      }
    }
    expect(calls.at(-1)).toContain("/legal/*")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
