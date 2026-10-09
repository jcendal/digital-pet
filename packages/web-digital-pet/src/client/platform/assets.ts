import assets from "virtual:pet-assets"

export const webAsset = (path: string): string => {
  const url = assets[path]
  if (!url) throw new Error(`Unknown web asset: ${path}`)
  return url
}
