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
  let working = false
  let preview: { transfer: PetTransfer; context: OnlineContext } | undefined
  const status = (text: string) => {
    el("online-status").textContent = text
  }
  const refresh = async () => {
    const session = currentOnlineSession()
    const context = await readOnlineContext()
    const bound = Boolean(session && session.accountId === context.accountId)
    el("online-login").hidden = Boolean(session)
    el("online-login-hint").hidden = Boolean(session)
    el("online-login-legal").hidden = Boolean(session)
    el("online-connection").hidden = !session || bound
    el("online-session-status").hidden = !context.accountId || bound
    el("backup-file-label").hidden = !session
    el("online-logout").hidden = !session
    el("online-adopt").hidden = !session || bound
    el("online-adopt-hint").hidden = !session || bound
    el("online-copies").hidden = !bound
    el<HTMLFieldSetElement>("online-copies").disabled = !bound || !browserSaveSelected()
    el("online-session-status").textContent = t(
      !session ? "signIn" : bound ? "connected" : context.accountId ? "differentAccount" : "adoptHint",
    )
  }
  const run = (task: () => Promise<void>) => {
    if (working) return
    working = true
    el("online-account").setAttribute("aria-busy", "true")
    const controls = ["online-save", "online-list", "online-adopt", "online-logout"].map((id) =>
      el<HTMLButtonElement>(id),
    )
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
    const context = await onlineContext()
    const data = await api<{ backups: BackupSummary[]; pending: Array<BackupSummary & { status: string }> }>(
      "/api/v1/me/backups",
      "GET",
      undefined,
      context.accountId,
    )
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
        control.append(text, icon)
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
          el("online-preview-text").textContent =
            `${t("restoreWarning")} ${new Date(transfer.state.createdAt).toLocaleDateString(IntlModule.locale)}`
          el("online-preview").hidden = false
          el("online-cancel-restore").focus()
          status(t("review"))
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
        button("confirmDelete", async () => {
          await api(`/api/v1/me/backups/${item.id}`, "DELETE", {}, context.accountId)
          await onlineTransaction(async (store) => {
            store.delete(uploadKey(context.accountId, item.id))
          })
          await list()
          status(t("deleted"))
        })
        button("cancel", list)
        actions.querySelector<HTMLButtonElement>("button:last-child")?.focus()
        status("")
      })
      root.append(row)
    }
    if (!root.childElementCount) root.textContent = t("noCopies")
    status("")
  }
  el("online-adopt").addEventListener("click", () =>
    run(async () => {
      if (otherBusy()) throw new Error("online.busy")
      const active = await loadOnlineSession()
      if (!active) throw new Error("online.signIn")
      await adoptAccount(active.accountId)
      window.dispatchEvent(new Event("digital-pet:account-changed"))
      await refresh()
      status(t("adopted"))
    }),
  )
  el("online-logout").addEventListener("click", () =>
    run(async () => {
      await logoutOnline()
      preview = undefined
      el("online-preview").hidden = true
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
  el("online-list").addEventListener("click", () => run(list))
  el("online-cancel-restore").addEventListener("click", () => {
    preview = undefined
    el("online-preview").hidden = true
  })
  el("online-restore").addEventListener("click", () =>
    run(async () => {
      if (!preview || otherBusy() || !browserSaveSelected()) throw new Error("online.busy")
      const active = await onlineContext()
      if (active.accountId !== preview.context.accountId) throw new Error("online.saveChanged")
      await replaceLocalState(preview.transfer.state, preview.context)
      preview = undefined
      el("online-preview").hidden = true
      refreshBrowserViews()
      status(t("restored"))
    }),
  )
  window.addEventListener("digital-pet:account-changed", () => {
    void refresh()
  })
  window.addEventListener("digital-pet:save-updated", () => {
    void refresh()
  })
  window.addEventListener("online", () => {
    void loadOnlineSession()
      .then(refresh)
      .catch(() => {})
  })
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden)
      void loadOnlineSession()
        .then(refresh)
        .catch(() => {})
  })
  el("online-migration").addEventListener("close", () => localStorage.setItem("online:migration-dismissed", "1"))
  await readOnlineContext()
  try {
    const active = await loadOnlineSession()
    await refresh()
    if (!active && !localStorage.getItem("online:migration-dismissed"))
      el<HTMLDialogElement>("online-migration").showModal()
    else if (active && (await readOnlineContext()).accountId !== active.accountId)
      el<HTMLDialogElement>("options-dialog").showModal()
  } catch {
    status(t("offline"))
  }
}
