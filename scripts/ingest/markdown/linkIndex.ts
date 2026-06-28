import { slug as githubSlug } from "github-slugger"
import type { ResolvedDoc } from "../types.ts"

/**
 * The authority for link/embed resolution (§6.1.2): only PUBLISHED docs, keyed
 * by filename stem (case-insensitive, mirrors filter_notes.py). Anything not
 * found here resolves as a dead link / empty embed — the privacy guarantee.
 */
export interface LinkIndex {
  byName: Map<string, ResolvedDoc>
}

export function buildLinkIndex(docs: ResolvedDoc[]): LinkIndex {
  const byName = new Map<string, ResolvedDoc>()
  for (const doc of docs) {
    const key = doc.stem.toLowerCase()
    if (!byName.has(key)) byName.set(key, doc)
  }
  return { byName }
}

/** Resolve a wikilink/embed target to a published doc, or undefined. */
export function lookup(index: LinkIndex, target: string): ResolvedDoc | undefined {
  let t = target.trim().replace(/\.md$/i, "")
  const base = t.includes("/") ? (t.split("/").pop() ?? t) : t
  return index.byName.get(base.toLowerCase()) ?? index.byName.get(t.toLowerCase())
}

/** Heading anchor slug — must match Starlight's heading IDs (github-slugger). */
export function headingSlug(heading: string): string {
  return githubSlug(heading.trim())
}
