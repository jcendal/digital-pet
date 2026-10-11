import adventure from "./adventure-client.browser.js" with { type: "text" }
import source from "./sidebar-client.browser.js" with { type: "text" }

export const SIDEBAR_SCRIPT = `${adventure}\n${source}`
