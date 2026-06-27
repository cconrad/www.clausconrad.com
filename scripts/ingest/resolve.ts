import { isPublished } from "./frontmatter.ts"
import { classify, resolveSlug, resolveUrl } from "./slug.ts"
import type { ResolvedDoc, SourceDoc } from "./types.ts"

export interface ResolveResult {
  /** Published, slug/URL/kind-resolved docs (no URL collisions). */
  docs: ResolvedDoc[]
  /** Slug warnings (missing slug → derived; invalid slug → normalized). */
  warnings: string[]
  /** Unpublished `clausconrad.com/**` files, logged so omissions are visible (A1). */
  excludedSitePaths: string[]
  /** Count of unpublished vault-root notes skipped. */
  skippedNotes: number
}

/**
 * Pure transform: filter by the universal publish gate (§3.1, A1), resolve
 * slug/URL/kind for every published file, and fail on any URL collision
 * (§3.3 step 4).
 */
export function resolvePublished(sources: SourceDoc[]): ResolveResult {
  const docs: ResolvedDoc[] = []
  const warnings: string[] = []
  const excludedSitePaths: string[] = []
  let skippedNotes = 0

  for (const src of sources) {
    if (!isPublished(src.data)) {
      if (src.root === "site") excludedSitePaths.push(src.repoRelPath)
      else skippedNotes++
      continue
    }
    const sr = resolveSlug(src.data.slug, src.stem)
    if (sr.warning) warnings.push(`${src.repoRelPath}: ${sr.warning}`)
    const url = resolveUrl(src.root, src.siteRelDir, sr.slug)
    const kind = classify(src.root, src.siteRelDir)
    docs.push({ ...src, slug: sr.slug, url, kind, hadSlug: sr.hadSlug })
  }

  // Collision detection: two pages resolving to the same URL → fail the build,
  // naming both source files (§3.3).
  const byUrl = new Map<string, ResolvedDoc>()
  for (const doc of docs) {
    const existing = byUrl.get(doc.url)
    if (existing) {
      throw new Error(
        `URL collision: "${doc.url}" is produced by both ` +
          `"${existing.repoRelPath}" and "${doc.repoRelPath}".`,
      )
    }
    byUrl.set(doc.url, doc)
  }

  return { docs, warnings, excludedSitePaths, skippedNotes }
}
