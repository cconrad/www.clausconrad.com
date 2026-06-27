import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import matter from "gray-matter"
import { computeDates } from "./dates.ts"
import { resolveDates, type GitDates } from "./gitDates.ts"
import { computeExcerpt, plainText, readingMinutes, wordCount } from "./meta.ts"
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
  "words",
  "readingMinutes",
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
export function buildEmittedFrontmatter(
  doc: ResolvedDoc,
  gitDates?: GitDates,
): Record<string, unknown> {
  const fm: Record<string, unknown> = {
    title: typeof doc.data.title === "string" && doc.data.title.trim() ? doc.data.title : doc.stem,
    kind: doc.kind,
  }

  // Description / excerpt (§9.6): every page gets one (also used for OG, §9.4).
  const description = computeExcerpt({
    desc: doc.data.desc,
    excerptFm: doc.data.excerpt,
    teaser: doc.data.teaser,
    body: doc.body,
  })
  if (description) fm.description = description

  // Reading time + word count on ALL pages (§9.3, D4).
  const words = wordCount(plainText(doc.body))
  fm.words = words
  fm.readingMinutes = readingMinutes(words)

  // Created/Updated: frontmatter wins, else git fallback (§13).
  const { created, updated } = resolveDates(computeDates(doc.data), gitDates)
  if (created) fm.created = created
  if (updated) fm.updated = updated

  if (typeof doc.data.website === "string" && doc.data.website.trim()) fm.website = doc.data.website

  if (Array.isArray(doc.data.tags) && doc.data.tags.length > 0) {
    fm.tags = doc.data.tags.map((t) => String(t))
  }

  return fm
}

/** Serialize one doc to a Markdown string with normalized frontmatter. */
export function renderDoc(doc: ResolvedDoc, gitDates?: GitDates): string {
  return matter.stringify(doc.body, buildEmittedFrontmatter(doc, gitDates))
}

/** Emit all resolved docs into the Starlight `docs` collection, replacing prior output. */
export function emit(
  docsDir: string,
  docs: ResolvedDoc[],
  gitByPath?: Map<string, GitDates>,
): void {
  rmSync(docsDir, { recursive: true, force: true })
  for (const doc of docs) {
    const path = docOutputPath(docsDir, doc)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, renderDoc(doc, gitByPath?.get(doc.repoRelPath)), "utf8")
  }
}
