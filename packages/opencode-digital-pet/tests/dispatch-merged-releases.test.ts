import { describe, expect, test } from "bun:test"

import { dispatchSelectedReleases, type DispatchOptions } from "../../../scripts/dispatch-merged-releases.ts"

const options: DispatchOptions = {
  repository: "jcendal/digital-pet",
  token: "token",
  releaseNote: "feat: sidebar",
  opencode: { release: true, bump: "minor" },
  cursor: { release: true, bump: "patch" },
}

const workflowName = (url: string): string => url.split("/").at(-2) ?? ""

describe("dispatch merged releases", () => {
  test("Given both products When OpenCode succeeds Then Cursor is dispatched with the run id request", async () => {
    const posts: Array<{ workflow: string; body: { return_run_details?: boolean } }> = []
    const request = async (url: string, init?: RequestInit): Promise<Response> => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { return_run_details?: boolean }
        const workflow = workflowName(url)
        posts.push({ workflow, body })
        expect(body.return_run_details).toBe(true)
        return Response.json({
          workflow_run_id: workflow.includes("opencode") ? 11 : 22,
          html_url: "https://github.com/run",
        })
      }
      return Response.json({ status: "completed", conclusion: "success", html_url: "https://github.com/run" })
    }

    await dispatchSelectedReleases(
      options,
      request as typeof fetch,
      async () => {},
      () => {},
    )

    expect(posts.map((post) => post.workflow)).toEqual(["release-opencode.yml", "release-cursor.yml"])
  })

  test("Given an OpenCode failure When dispatching Then Cursor is not started", async () => {
    const posts: string[] = []
    const request = async (url: string, init?: RequestInit): Promise<Response> => {
      if (init?.method === "POST") {
        posts.push(workflowName(url))
        return Response.json({ workflow_run_id: 11, html_url: "https://github.com/run" })
      }
      return Response.json({ status: "completed", conclusion: "failure", html_url: "https://github.com/run" })
    }

    await expect(
      dispatchSelectedReleases(
        options,
        request as typeof fetch,
        async () => {},
        () => {},
      ),
    ).rejects.toThrow("release-opencode.yml finished with failure")
    expect(posts).toEqual(["release-opencode.yml"])
  })
})
