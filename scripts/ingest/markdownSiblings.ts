import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { renderDoc } from "./emit.ts"
import { canonicalUrl } from "./graph.ts"
import type { GitDates } from "./gitDates.ts"
import { computeExcerpt } from "./meta.ts"
import type { ResolvedDoc } from "./types.ts"

/** dist path for a page's `.md` sibling: /notes/vim → notes/vim.md, /notes → notes.md. */
function mdRelPath(url: string): string {
  const rel = canonicalUrl(url).replace(/^\//, "")
  return (rel || "index") + ".md"
}

/**
 * Emit a static Markdown sibling next to every content page (§14): the same
 * transformed, allowlist-safe Markdown the page renders from. Served at
 * `<page>.md` (public passthrough); pages link to it via
 * `<link rel="alternate" type="text/markdown">` (added in Head.astro).
 */
export function emitMarkdownSiblings(
  publicDir: string,
  docs: ResolvedDoc[],
  gitByPath?: Map<string, GitDates>,
): number {
  let n = 0
  for (const doc of docs) {
    const out = join(publicDir, mdRelPath(doc.url))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, renderDoc(doc, gitByPath?.get(doc.repoRelPath)), "utf8")
    n++
  }
  return n
}

/** Emit `/llms.txt` — an index of all content pages for LLM crawlers (§14). */
export function emitLlmsTxt(publicDir: string, site: string, docs: ResolvedDoc[]): void {
  const origin = site.replace(/\/$/, "")
  const section = (title: string, items: ResolvedDoc[]) => {
    if (!items.length) return ""
    const lines = items
      .slice()
      .sort((a, b) =>
        (a.data.title ? String(a.data.title) : a.stem).localeCompare(
          b.data.title ? String(b.data.title) : b.stem,
        ),
      )
      .map((d) => {
        const label = d.data.title ? String(d.data.title) : d.stem
        const desc = computeExcerpt({
          desc: d.data.desc,
          excerptFm: d.data.excerpt,
          teaser: d.data.teaser,
          body: d.body,
          max: 120,
        })
        return `- [${label}](${origin}${canonicalUrl(d.url)})${desc ? `: ${desc}` : ""}`
      })
    return `## ${title}\n${lines.join("\n")}\n`
  }

  const body = [
    "# Claus Conrad",
    "",
    "> Personal site: a blog and a collection of Obsidian notes (digital garden).",
    "",
    section(
      "Blog",
      docs.filter((d) => d.kind === "blog"),
    ),
    section(
      "Notes",
      docs.filter((d) => d.kind === "note"),
    ),
    section(
      "Pages",
      docs.filter((d) => d.kind === "page"),
    ),
  ]
    .filter(Boolean)
    .join("\n")

  mkdirSync(publicDir, { recursive: true })
  writeFileSync(join(publicDir, "llms.txt"), body.trimEnd() + "\n", "utf8")
}
