import { expect, it } from "bun:test"
import { Script } from "node:vm"
import { IntlModule as runtime } from "@jcendal/digital-pet-intl"
import { IntlModule } from "@jcendal/digital-pet-webviews/i18n"

import { DEX_SCRIPT } from "@jcendal/digital-pet-webviews/panels/dex/dex-script.ts"

class Node {
  children: Node[] = []
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}
  textContent = ""
  value = ""
  scrollTop = 0
  fragment = false
  focused = false
  listeners: Record<string, () => void> = {}
  get childElementCount() {
    return this.children.length
  }
  setAttribute() {}
  append(...nodes: Node[]) {
    for (const node of nodes) this.children.push(...(node.fragment ? node.children : [node]))
  }
  replaceChildren(...nodes: Node[]) {
    this.children = []
    this.append(...nodes)
  }
  addEventListener(name: string, callback: () => void) {
    this.listeners[name] = callback
  }
  focus() {
    this.focused = true
  }
  scrollIntoView() {}
}

const entry = (id: string, discovered: boolean) => ({
  id,
  discovered,
  name: id,
  alternateName: "",
  stage: "Baby",
  stageNumber: 1,
  artwork: "",
  previousIds: [],
  nextIds: [],
  generations: 1,
  firstSeen: null,
  url: "",
})
const preview = () => {
  const elements = new Map<string, Node>()
  const node = (id: string) => {
    if (!elements.has(id)) elements.set(id, new Node())
    return elements.get(id)!
  }
  const model = {
    status: "available",
    discovered: 1,
    message: "",
    entries: [entry("1-001", true), entry("2-001", false), entry("2-002", false)],
  }
  node("dex-data").textContent = JSON.stringify(model)
  let receive!: (event: { data: unknown }) => void
  let selection = ""
  new Script(DEX_SCRIPT).runInNewContext({
    IntlModule,
    getIntlModule: () => runtime,
    window: {
      digitalPetBridge: {
        getState: () => ({ selectedId: "1-001" }),
        setState: (value: { selectedId: string }) => {
          selection = value.selectedId
        },
        postMessage() {},
      },
      addEventListener: (_name: string, callback: typeof receive) => {
        receive = callback
      },
    },
    document: {
      getElementById: node,
      createElement: () => new Node(),
      createElementNS: () => new Node(),
      createDocumentFragment: () => Object.assign(new Node(), { fragment: true }),
    },
  })
  return {
    node,
    selected: () => selection,
    send: (data: unknown) => receive({ data }),
    refresh: () =>
      receive({
        data: {
          type: "dex-model",
          model: { ...model, discovered: 3, entries: model.entries.map((item) => ({ ...item, discovered: true })) },
        },
      }),
  }
}

it("opens the evolved record when History navigation arrives before the refreshed discoveries", () => {
  const dex = preview()
  dex.node("search").value = "previous companion"
  dex.send({ type: "dex-select", id: "2-001" })
  expect(dex.selected()).toBe("1-001")
  dex.refresh()
  expect(dex.selected()).toBe("2-001")
  expect(dex.node("search").value).toBe("")
  expect(dex.node("entries").children.find((item) => item.dataset.id === "2-001")?.focused).toBe(true)
})

it("honors the latest requested record and does not override a later manual selection", () => {
  const dex = preview()
  dex.send({ type: "dex-select", id: "2-001" })
  dex.send({ type: "dex-select", id: "2-002" })
  dex.refresh()
  expect(dex.selected()).toBe("2-002")
  dex.send({ type: "dex-select", id: "missing" })
  dex.node("entries").children.find((item) => item.dataset.id === "1-001")!.listeners.click!()
  dex.refresh()
  expect(dex.selected()).toBe("1-001")
})
