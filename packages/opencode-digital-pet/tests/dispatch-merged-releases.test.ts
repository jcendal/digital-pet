import { describe, expect, test } from "bun:test"

import { dispatchSelectedReleases, type DispatchOptions } from "../../../scripts/dispatch-merged-releases.ts"

const options: DispatchOptions = {
  repository: "jcendal/digital-pet",
  token: "token",
  releaseNote: "feat: sidebar",
  opencode: { release: true, bump: "minor" },
  cursor: { release: true, bump: "patch" },
}

const workflowName = (url: string, method: string | undefined): string => {
  if (method === "POST") return url.split("/").at(-2) ?? ""
  return url.endsWith("/11") ? "release-opencode.yml" : "release-cursor.yml"
}

describe("dispatch merged releases", () => {
  test("Given both products When dispatching Then both runs start before either is checked", async () => {
    const calls: string[] = []
    const gets = new Map<string, number>()
    const request = async (url: string, init?: RequestInit): Promise<Response> => {
      const workflow = workflowName(url, init?.method)
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { return_run_details?: boolean }
        calls.push(`POST ${workflow}`)
        expect(body.return_run_details).toBe(true)
        return Response.json({
          workflow_run_id: workflow.includes("opencode") ? 11 : 22,
          html_url: "https://github.com/run",
        })
      }
      const seen = (gets.get(workflow) ?? 0) + 1
      gets.set(workflow, seen)
      if (workflow.includes("cursor") && seen === 1) return new Response("missing", { status: 404 })
      return Response.json({ status: "completed", conclusion: "success", html_url: "https://github.com/run" })
    }

    await dispatchSelectedReleases(
      options,
      request as typeof fetch,
      async () => {},
      () => {},
    )

    expect(calls.slice(0, 2)).toEqual(["POST release-opencode.yml", "POST release-cursor.yml"])
  })

  test("Given an OpenCode failure When both runs start Then Cursor still finishes and the failure is reported", async () => {
    const posts: string[] = []
    const request = async (url: string, init?: RequestInit): Promise<Response> => {
      const workflow = workflowName(url, init?.method)
      if (init?.method === "POST") {
        posts.push(workflow)
        return Response.json({
          workflow_run_id: workflow.includes("opencode") ? 11 : 22,
          html_url: "https://github.com/run",
        })
      }
      const conclusion = workflow.includes("opencode") ? "failure" : "success"
      return Response.json({ status: "completed", conclusion, html_url: "https://github.com/run" })
    }

    await expect(
      dispatchSelectedReleases(
        options,
        request as typeof fetch,
        async () => {},
        () => {},
      ),
    ).rejects.toThrow("release-opencode.yml finished with failure")
    expect(posts).toEqual(["release-opencode.yml", "release-cursor.yml"])
  })
})
