import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { type BackupSummary, MAX_BACKUP_BYTES } from "@jcendal/digital-pet-online/contracts.ts"
import { type PetTransfer, parsePetTransfer, TRANSFER_VERSION } from "../../../domain/transfer/protocol.ts"
import { ACTION_ICON_PATHS, type ActionIcon } from "../../../shared/action-icons.ts"
import { IntlModule } from "../../../shared/i18n.ts"
import { resultOf } from "../../persistence/database.ts"
import {
  adoptAccount,
  assertContext,
  type OnlineContext,
  onlineTransaction,
  readOnlineContext,
} from "../../persistence/online-store.ts"
import { readLocalState, replaceLocalState } from "../../persistence/pet-store.ts"
import {
  ApiError,
  api,
  backupOrigin,
  currentOnlineSession,
  loadOnlineSession,
  logoutOnline,
  newOperationId,
  onlineConfigured,
  onlineContext,
} from "../../platform/online-api.ts"
import { browserSaveSelected, refreshBrowserViews } from "../../platform/save-source.ts"

type Upload = { id: string; bytes: number; checksum: string; label: string; json: string; accountId: string }
const t = (key: string) => IntlModule.translate(`online.${key}`)
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const uploadKey = (account: string, id: string) => `online:upload:${account}:${id}`
const allowedUrl = (value: string): string => {
  const url = new URL(value)
  if (url.origin !== backupOrigin()) throw new Error("online.invalid")
  return url.href
}
export const initOnlineAccount = async (otherBusy: () => boolean): Promise<void> => {
  if (!onlineConfigured()) return
  el("online-account").hidden = false
  const restoreDialog = el<HTMLDialogElement>("online-preview")
  let working = false
  const accountDialog = el<HTMLDialogElement>("account-switch-dialog")
  let accountChoice: { accountId: string; context: OnlineContext } | undefined
  let settling: Promise<void> | undefined
  let preview: { transfer: PetTransfer; context: OnlineContext } | undefined
  let listGeneration = 0
  const setCopiesOpen = (open: boolean) => {
    el("online-backups").hidden = !open
    const control = el("online-list")
    control.setAttribute("aria-expanded", String(open))
    const label = control.querySelector("span")
    if (label) {
      const key = open ? "closeList" : "list"
      label.dataset.i18n = `web:online.${key}`
      label.textContent = t(key)
    }
    control.querySelector("path")?.setAttribute("d", ACTION_ICON_PATHS[open ? "cancel" : "list"])
    if (!open) listGeneration++
  }
  const status = (text: string) => {
    el("online-status").textContent = text
    if (accountDialog.open) el("account-switch-status").textContent = text
    if (restoreDialog.open) el("online-preview-status").textContent = text
  }
  const refresh = async () => {
    const session = currentOnlineSession()
    const context = await readOnlineContext()
    const bound = Boolean(session && session.accountId === context.accountId)
    if (!bound) {
      setCopiesOpen(false)
      el("online-backups").replaceChildren()
    }
    el("online-login").hidden = Boolean(session)
    el("online-login-hint").hidden = Boolean(session)
    el("online-login-legal").hidden = Boolean(session)
    el("online-account-settings").hidden = !session
    el("backup-file-label").hidden = !bound
    el("online-logout").hidden = !session
    el("online-copies").hidden = !bound
    el<HTMLFieldSetElement>("online-copies").disabled = !bound || !browserSaveSelected()
    el("online-session-status").textContent = t(!session ? "signIn" : "googleConnected")
  }
  const run = (task: () => Promise<void>) => {
    if (working) return
    working = true
    el("online-account").setAttribute("aria-busy", "true")
    const controls = [
      "online-restore",
      "online-cancel-restore",
      "online-preview-close",
      "online-save",
      "online-list",
      "online-logout",
      "account-switch-confirm",
      "account-switch-cancel",
      "account-switch-close",
    ].map((id) => el<HTMLButtonElement>(id))
    for (const control of controls) control.disabled = true
    status(t("working"))
    void task()
      .catch((error: unknown) => {
        status(
          t(
            error instanceof ApiError && error.code === "backup-limit"
              ? "backupLimit"
              : error instanceof Error && error.message.startsWith("online.")
                ? error.message.slice(7)
                : "failed",
          ),
        )
      })
      .finally(() => {
        working = false
        el("online-account").setAttribute("aria-busy", "false")
        for (const control of controls) control.disabled = false
      })
  }
  const upload = async (intent: Upload) => {
    const reserved = await api<{ upload: { url: string; fields: Record<string, string> } | null }>(
      "/api/v1/me/backups/uploads",
      "POST",
      { id: intent.id, bytes: intent.bytes, checksum: intent.checksum, label: intent.label },
      intent.accountId,
    )
    if (reserved.upload) {
      const form = new FormData()
      for (const [key, value] of Object.entries(reserved.upload.fields)) form.append(key, value)
      form.append("file", new Blob([intent.json], { type: "application/json" }))
      const response = await fetch(allowedUrl(reserved.upload.url), {
        method: "POST",
        body: form,
        credentials: "omit",
        signal: AbortSignal.timeout(60_000),
      })
      if (!response.ok) throw new Error("online.failed")
      await api(`/api/v1/me/backups/${intent.id}/complete`, "POST", {}, intent.accountId)
    }
    await onlineTransaction(async (store) => {
      store.delete(uploadKey(intent.accountId, intent.id))
    })
    status(t("saved"))
  }
  const list = async () => {
    const generation = ++listGeneration
    const context = await onlineContext()
    const data = await api<{ backups: BackupSummary[]; pending: Array<BackupSummary & { status: string }> }>(
      "/api/v1/me/backups",
      "GET",
      undefined,
      context.accountId,
    )
    if (generation !== listGeneration) return
    const root = el("online-backups")
    root.replaceChildren()
    for (const item of [...data.backups, ...data.pending].sort((a, b) => b.createdAt - a.createdAt)) {
      const row = document.createElement("div")
      row.className = "online-backup-row"
      const label = document.createElement("p")
      label.textContent = new Date(item.createdAt).toLocaleString(IntlModule.locale)
      const state = document.createElement("p")
      state.className = "setting-caption"
      state.textContent = t("status" in item ? "pending" : "ready")
      const actions = document.createElement("div")
      actions.className = "online-backup-actions"
      row.append(label, state, actions)
      const button = (key: ActionIcon | "confirmDelete", action: () => Promise<void>) => {
        const control = document.createElement("button")
        control.type = "button"
        if (key === "delete" || key === "confirmDelete") control.className = "danger-action"
        const text = document.createElement("span")
        text.textContent = t(key)
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        icon.setAttribute("class", "action-icon")
        icon.setAttribute("viewBox", "0 0 16 16")
        icon.setAttribute("aria-hidden", "true")
        icon.setAttribute("focusable", "false")
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
        path.setAttribute("fill", "currentColor")
        path.setAttribute("d", ACTION_ICON_PATHS[key === "confirmDelete" ? "delete" : key])
        icon.append(path)
        control.append(icon, text)
        control.addEventListener("click", () => run(action))
        actions.append(control)
      }
      if (!("status" in item))
        button("preview", async () => {
          const active = await onlineContext()
          if (active.accountId !== context.accountId) throw new Error("online.saveChanged")
          const { url } = await api<{ url: string }>(
            `/api/v1/me/backups/${item.id}/download`,
            "GET",
            undefined,
            context.accountId,
          )
          const result = await fetch(allowedUrl(url), {
            credentials: "omit",
            cache: "no-store",
            signal: AbortSignal.timeout(30_000),
          })
          if (!result.ok || Number(result.headers.get("Content-Length")) > MAX_BACKUP_BYTES)
            throw new Error("online.failed")
          const blob = await result.blob()
          if (blob.size > MAX_BACKUP_BYTES) throw new Error("online.failed")
          const transfer = parsePetTransfer(JSON.parse(await blob.text()), MAX_BACKUP_BYTES)
          preview = { transfer, context: active }
          el("online-preview-pet").textContent = DIGIMON_CATALOG.byId.get(transfer.state.currentNodeId)?.nameEn ?? ""
          el("online-preview-text").textContent = new Date(item.createdAt).toLocaleString(IntlModule.locale)
          restoreDialog.showModal()
          el("online-cancel-restore").focus()
          status("")
        })
      else
        button("retry", async () => {
          const intent = await onlineTransaction((store) =>
            resultOf<Upload | undefined>(store.get(uploadKey(context.accountId, item.id))),
          )
          if (!intent) {
            await api(`/api/v1/me/backups/${item.id}/complete`, "POST", {}, context.accountId)
          } else await upload(intent)
          await list()
        })
      button("delete", async () => {
        actions.replaceChildren()
        state.textContent = t("deletePrompt")
        button("cancel", list)
        button("confirmDelete", async () => {
          await api(`/api/v1/me/backups/${item.id}`, "DELETE", {}, context.accountId)
          await onlineTransaction(async (store) => {
            store.delete(uploadKey(context.accountId, item.id))
          })
          await list()
          status(t("deleted"))
        })
        actions.querySelector<HTMLButtonElement>("button:first-child")?.focus()
        status("")
      })
      root.append(row)
    }
    if (!root.childElementCount) root.textContent = t("noCopies")
    setCopiesOpen(true)
    status("")
  }
  const settleSession = (): Promise<void> => {
    if (settling) return settling
    settling = (async () => {
      const active = currentOnlineSession()
      if (!active) {
        accountChoice = undefined
        accountDialog.close()
        await refresh()
        return
      }
      const context = await readOnlineContext()
      if (context.accountId !== active.accountId) {
        if (await adoptAccount(active.accountId, { automatic: true, expected: context })) {
          window.dispatchEvent(new Event("digital-pet:account-changed"))
        } else {
          accountChoice = { accountId: active.accountId, context }
          el("account-switch-description").textContent = t(context.accountId ? "gameOtherAccount" : "legacyContacts")
          el("account-switch-status").textContent = ""
          if (!accountDialog.open) accountDialog.showModal()
          el("account-switch-cancel").focus()
        }
      } else {
        accountChoice = undefined
        accountDialog.close()
      }
      await refresh()
    })().finally(() => {
      settling = undefined
    })
    return settling
  }
  const resumeSession = (): void => {
    void settleSession().catch(() => status(t("offline")))
  }
  accountDialog.addEventListener("cancel", (event) => {
    if (working) event.preventDefault()
  })
  el("account-switch-cancel").addEventListener("click", () => accountDialog.close())
  accountDialog.addEventListener("close", () => {
    if (!accountChoice) return
    const choice = accountChoice
    accountChoice = undefined
    run(async () => {
      try {
        await logoutOnline()
        await refresh()
        el<HTMLDialogElement>("online-migration").showModal()
        status("")
      } catch (error) {
        accountChoice = choice
        accountDialog.showModal()
        throw error
      }
    })
  })
  el("account-switch-confirm").addEventListener("click", () =>
    run(async () => {
      if (!accountChoice || otherBusy()) throw new Error("online.busy")
      const choice = accountChoice
      const active = await loadOnlineSession()
      if (!active || active.accountId !== choice.accountId) throw new Error("online.saveChanged")
      await adoptAccount(active.accountId, { expected: choice.context })
      accountChoice = undefined
      accountDialog.close()
      window.dispatchEvent(new Event("digital-pet:account-changed"))
      await refresh()
      status("")
    }),
  )
  el("online-logout").addEventListener("click", () =>
    run(async () => {
      await logoutOnline()
      preview = undefined
      restoreDialog.close()
      el("online-backups").replaceChildren()
      await refresh()
      status(t("signIn"))
    }),
  )
  el("online-save").addEventListener("click", () =>
    run(async () => {
      if (otherBusy() || !browserSaveSelected()) throw new Error("online.busy")
      const context = await onlineContext()
      const json = JSON.stringify({ version: TRANSFER_VERSION, state: await readLocalState() })
      const bytes = new TextEncoder().encode(json)
      if (bytes.length > MAX_BACKUP_BYTES) throw new Error("online.tooLarge")
      const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")
      const intent: Upload = {
        id: newOperationId(),
        accountId: context.accountId,
        bytes: bytes.length,
        checksum,
        json,
        label: new Date().toLocaleString(IntlModule.locale),
      }
      await onlineTransaction(async (store) => {
        await assertContext(store, context)
        store.put(intent, uploadKey(context.accountId, intent.id))
      })
      await upload(intent)
      await list()
      status(t("saved"))
    }),
  )
  el("online-list").addEventListener("click", () => {
    if (working) return
    if (!el("online-backups").hidden) {
      setCopiesOpen(false)
      status("")
    } else run(list)
  })
  el("options-dialog").addEventListener("close", () => setCopiesOpen(false))
  restoreDialog.addEventListener("close", () => {
    preview = undefined
  })
  restoreDialog.addEventListener("cancel", (event) => {
    if (working) event.preventDefault()
  })
  el("online-cancel-restore").addEventListener("click", () => {
    preview = undefined
    restoreDialog.close()
  })
  el("online-restore").addEventListener("click", () =>
    run(async () => {
      if (!preview || otherBusy() || !browserSaveSelected()) throw new Error("online.busy")
      const candidate = preview
      const active = await onlineContext()
      if (preview !== candidate) return
      if (active.accountId !== candidate.context.accountId) throw new Error("online.saveChanged")
      await replaceLocalState(candidate.transfer.state, candidate.context)
      preview = undefined
      restoreDialog.close()
      refreshBrowserViews()
      status("")
      window.dispatchEvent(new Event("digital-pet:backup-restored"))
    }),
  )
  window.addEventListener("digital-pet:account-changed", resumeSession)
  window.addEventListener("digital-pet:account-connect", resumeSession)
  window.addEventListener("digital-pet:save-updated", () => {
    void refresh()
  })
  window.addEventListener("online", () => {
    void loadOnlineSession()
      .then(settleSession)
      .catch(() => {})
  })
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden)
      void loadOnlineSession()
        .then(settleSession)
        .catch(() => {})
  })
  el("online-migration").addEventListener("close", () => localStorage.setItem("online:migration-dismissed", "1"))
  await readOnlineContext()
  try {
    const active = await loadOnlineSession()
    await settleSession()
    if (!active && !localStorage.getItem("online:migration-dismissed"))
      el<HTMLDialogElement>("online-migration").showModal()
  } catch {
    status(t("offline"))
  }
}
