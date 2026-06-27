import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import matter from "gray-matter"
import { computeDates } from "./dates.ts"
import type { ResolvedDoc } from "./types.ts"

/**
 * Frontmatter keys allowed to appear in EMITTED docs: the §3.4 allowlist plus
 * build-generated Starlight fields. Used by the privacy assertion (§6.2) to
 * guarantee no arbitrary source key leaks into output.
 */
export const EMITTED_FRONTMATTER_KEYS = new Set([
  // Starlight-required / build-generated (from allowlisted inputs only).
  "title",
  "description",
  "kind",
  // Allowlisted source-derived (§3.4).
  "created",
  "updated",
  "website",
  "tags",
])

/** Output file path for a resolved doc under the Starlight `docs` collection (§6.1.8). */
export function docOutputPath(docsDir: string, doc: ResolvedDoc): string {
  if (doc.root === "notes") return join(docsDir, "notes", `${doc.slug}.md`)
  return doc.siteRelDir
    ? join(docsDir, doc.siteRelDir, `${doc.slug}.md`)
    : join(docsDir, `${doc.slug}.md`)
}

/**
 * Build the emitted Starlight frontmatter ENTIRELY from allowlisted inputs
 * (never a passthrough of source frontmatter) — guarantees §3.4 by construction.
 */
export function buildEmittedFrontmatter(doc: ResolvedDoc): Record<string, unknown> {
  const fm: Record<string, unknown> = {
    title: typeof doc.data.title === "string" && doc.data.title.trim() ? doc.data.title : doc.stem,
    kind: doc.kind,
  }

  const desc = doc.data.desc
  if (typeof desc === "string" && desc.trim()) fm.description = desc

  const { created, updated } = computeDates(doc.data)
  if (created) fm.created = created
  if (updated) fm.updated = updated

  if (typeof doc.data.website === "string" && doc.data.website.trim()) fm.website = doc.data.website

  if (Array.isArray(doc.data.tags) && doc.data.tags.length > 0) {
    fm.tags = doc.data.tags.map((t) => String(t))
  }

  return fm
}

/** Serialize one doc to a Markdown string with normalized frontmatter. */
export function renderDoc(doc: ResolvedDoc): string {
  return matter.stringify(doc.body, buildEmittedFrontmatter(doc))
}

/** Emit all resolved docs into the Starlight `docs` collection, replacing prior output. */
export function emit(docsDir: string, docs: ResolvedDoc[]): void {
  rmSync(docsDir, { recursive: true, force: true })
  for (const doc of docs) {
    const path = docOutputPath(docsDir, doc)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, renderDoc(doc), "utf8")
  }
}
