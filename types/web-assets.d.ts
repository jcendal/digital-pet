/** Source assets are embedded by esbuild and imported as text by Bun tests. */
declare module "*.css" {
  const source: string
  export default source
}

declare module "*.browser.js" {
  const source: string
  export default source
}

declare module "*.browser.js?raw" {
  const source: string
  export default source
}
