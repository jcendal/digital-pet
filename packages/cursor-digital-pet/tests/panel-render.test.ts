import { expect, test } from "bun:test"
import { buildPanelWebviewHtml } from "../src/webview/shared/panel-render.ts"

test("shared panel rendering escapes labels and serializes archive data without executable markup", () => {
  const unsafe = '</script><img src=x onerror="alert(1)">&'
  const html = buildPanelWebviewHtml(
    { message: unsafe },
    { nonce: "testnonce", fontUri: "font.ttf", cspSource: "https://webview.test" },
    {
      title: unsafe,
      heading: unsafe,
      viewClass: "test",
      dataId: "test-data",
      styles: "",
      script: "",
      layout: {
        summaryHtml: "",
        toolbarHtml: "",
        listLabel: unsafe,
        listHeading: unsafe,
        itemsLabel: unsafe,
        detailLabel: unsafe,
        keyboardHint: unsafe,
      },
    },
  )
  expect(html).not.toContain(unsafe)
  expect(html).not.toContain("<img")
  expect(html).toContain("&lt;img")
  expect(html).toContain("script-src 'nonce-testnonce'")
  const data = html.match(/<script id="test-data"[^>]*>(.*?)<\/script>/s)?.[1]
  expect(JSON.parse(data ?? "{}").message).toBe(unsafe)
})
