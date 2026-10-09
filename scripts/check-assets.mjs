import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const files = [
  ...new Set(
    execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
      cwd: root,
      encoding: "utf8",
    }).split("\0"),
  ),
].filter((path) => path && existsSync(resolve(root, path)))
const assets = files.filter((path) => /\.(png|jpe?g|gif|webp|avif|svg|ico|ttf|woff2?|otf|wasm)$/i.test(path))
const referenced = new Set()
const errors = []
for (const path of assets)
  if (!/^(assets\/|packages\/[^/]+\/assets\/)/.test(path))
    errors.push(`${path}: static resources must live in their owner's assets directory`)
for (const path of files.filter((path) => path.endsWith(".md"))) {
  const text = readFileSync(resolve(root, path), "utf8")
  for (const match of text.matchAll(/(?:src=["']|\]\()([^"')\s]+\.(?:png|jpe?g|gif|webp|avif|svg|ico))(?:["')])/gi)) {
    const source = match[1]
    const shared = "https://raw.githubusercontent.com/jcendal/digital-pet/main/"
    if (/^https?:/.test(source) && !source.startsWith(shared)) continue
    const target = source.startsWith(shared)
      ? resolve(root, source.slice(shared.length))
      : resolve(root, dirname(path), source)
    if (!existsSync(target)) errors.push(`${path}: missing image ${source}`)
    referenced.add(relative(root, target))
  }
}
for (const path of assets.filter((path) => path.includes("/screenshots/")))
  if (!referenced.has(path)) errors.push(`${path}: screenshot has no documentation reference`)
if (errors.length) throw new Error(`Asset conventions failed:\n${errors.join("\n")}`)
console.log(
  `Asset conventions: ${assets.length} resources under assets; documentation images resolve and screenshots are referenced.`,
)
