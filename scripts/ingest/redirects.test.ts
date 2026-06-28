import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { emitAuxFiles } from "./redirects.ts"

const tmpDirs: string[] = []

function tempPublicDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "clausconrad-public-"))
  tmpDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe("emitAuxFiles", () => {
  it("emits Cloudflare Pages noindex headers for pages.dev routes", () => {
    const publicDir = tempPublicDir()

    emitAuxFiles(publicDir, "https://www.clausconrad.com")

    expect(readFileSync(join(publicDir, "_headers"), "utf8")).toBe(
      [
        "# Cloudflare Pages: prevent project and preview pages.dev URLs from being indexed.",
        "https://:project.pages.dev/*",
        "  X-Robots-Tag: noindex",
        "",
        "https://:version.:project.pages.dev/*",
        "  X-Robots-Tag: noindex",
        "",
      ].join("\n"),
    )
  })
})
