import { expect, test } from "bun:test"
import { buildPanelWebviewHtml } from "../src/webview/shared/panel-render.ts"

test("shared panel rendering escapes labels and serializes archive data without executable markup", () => {
  const unsafe = '</script><img src=x onerror="alert(1)">&'
  const html = buildPanelWebviewHtml(
    { message: unsafe },
    { nonce: "testnonce", fontUri: "font.ttf", cspSource: "https://webview.test" },
    {
      titleKey: unsafe,
      headingKey: unsafe,
      viewClass: "test",
      dataId: "test-data",
      styles: "",
      script: "",
      layout: {
        summaryHtml: "",
        toolbarHtml: '<input id="search" type="search">',
        listLabelKey: unsafe,
        listHeadingKey: unsafe,
        itemsLabelKey: unsafe,
        detailLabelKey: unsafe,
        keyboardHintKey: unsafe,
      },
    },
  )
  expect(html).not.toContain(unsafe)
  expect(html).not.toContain("<img")
  expect(html).toContain("&lt;img")
  expect(html).toContain("script-src 'nonce-testnonce'")
  expect(html).toContain(
    '<details id="filters" class="panel-filters"><summary data-i18n="webviews:panelRender.filters">FILTERS</summary>',
  )
  expect(html).toContain('<div class="toolbar"><input id="search" type="search"></div></details>')
  const data = html.match(/<script id="test-data"[^>]*>(.*?)<\/script>/s)?.[1]
  expect(JSON.parse(data ?? "{}").message).toBe(unsafe)
})
