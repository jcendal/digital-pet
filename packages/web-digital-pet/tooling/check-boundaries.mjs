import { existsSync, readdirSync, readFileSync } from "node:fs"
import { isBuiltin } from "node:module"
import { dirname, extname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const root = fileURLToPath(new URL("..", import.meta.url))
const sourceRoot = resolve(root, "src")
const filesIn = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? filesIn(path) : [path]
  })
const files = filesIn(sourceRoot).filter((path) => /\.(ts|js|css)$/.test(path) && !path.endsWith(".d.ts"))
const graph = new Map()
const errors = []
const areaOf = (path) => relative(sourceRoot, path).split("/")[0]
const allowed = {
  client: new Set(["client", "domain", "shared"]),
  server: new Set(["server", "domain", "shared"]),
  domain: new Set(["domain", "shared"]),
  shared: new Set(["shared", "domain"]),
  worker: new Set(["worker", "domain", "shared"]),
}
const browserGlobals = new Set([
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "process",
])
const inspect = (path) => {
  if (graph.has(path)) return
  const code = readFileSync(path, "utf8")
  const area = areaOf(path)
  const dependencies = []
  const report = (message) => errors.push(`${relative(root, path)}: ${message}`)
  const add = (specifier) => {
    if (isBuiltin(specifier) && ["client", "domain", "shared", "worker"].includes(area))
      report(`Node import ${specifier} crosses the ${area} boundary`)
    if (specifier.includes("/adapters/sqlite/") && area !== "server")
      report("SQLite adapters belong in server/persistence")
    if (!specifier.startsWith(".")) return
    const target = resolve(dirname(path), specifier)
    if (!existsSync(target)) {
      report(`missing dependency ${specifier}`)
      return
    }
    if (allowed[area] && !allowed[area].has(areaOf(target)))
      report(`${area} must not depend on ${relative(root, target)}`)
    dependencies.push(target)
  }
  if (extname(path) === ".css") {
    for (const match of code.matchAll(/@import\s+["']([^"']+)["']/g)) add(match[1])
  } else {
    const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true)
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      )
        add(node.moduleSpecifier.text)
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const argument = node.arguments[0]
        if (argument && ts.isStringLiteralLike(argument)) add(argument.text)
        else report("dynamic imports must have explicit module paths")
      }
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteralLike(node.argument.literal)
      )
        add(node.argument.literal.text)
      if (["domain", "shared"].includes(area) && ts.isIdentifier(node) && browserGlobals.has(node.text))
        report(`${node.text} belongs in a runtime adapter`)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  graph.set(path, dependencies)
}
for (const path of files) inspect(path)
// Entrypoints are read from the same definitions used by Vite and the server.
const { entries } = await import("../src/server/rendering/build-resources.ts")
const roots = [
  ...Object.values(entries),
  "src/server/main.ts",
  "src/worker/service-worker.ts",
  "tooling/render-static.ts",
]
const reachable = new Set()
const visit = (path) => {
  if (reachable.has(path)) return
  reachable.add(path)
  inspect(path)
  for (const dependency of graph.get(path)) visit(dependency)
}
for (const entry of roots) visit(resolve(root, entry))
for (const path of files)
  if (!reachable.has(path)) errors.push(`${relative(root, path)}: unused by all runtime/build entrypoints`)
for (const entry of readdirSync(sourceRoot, { withFileTypes: true }))
  if (entry.isFile()) errors.push(`src/${entry.name}: place source files in their owning area`)
if (errors.length) throw new Error(`Web architecture violations:\n${[...new Set(errors)].join("\n")}`)
console.log(`Web architecture: ${files.length} reachable sources; client/server/domain/worker boundaries respected.`)
