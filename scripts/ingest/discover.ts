import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { parseFrontmatter } from "./frontmatter.ts"
import type { SourceDoc } from "./types.ts"

/** Directories never scanned for content (system/config/assets). */
const SKIP_DIRS = new Set([".git", ".obsidian", ".trash", "node_modules", "assets"])

function walk(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue
      walk(join(dir, entry.name), acc)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      acc.push(join(dir, entry.name))
    }
  }
}

/** Strip a trailing `.md`/`.markdown` (case-insensitive) to get the stem. */
function stemOf(filename: string): string {
  return filename.replace(/\.(md|markdown)$/i, "")
}

export interface DiscoverResult {
  docs: SourceDoc[]
  /** Files whose frontmatter could not be parsed (path → reason). */
  parseErrors: { repoRelPath: string; reason: string }[]
}

/**
 * Discover all source Markdown across both roots (§3.1):
 * - files under `<siteFolder>/` → site root (mirrors folder path)
 * - everything else → notes root (flattened to /notes)
 * Reads + parses frontmatter for each source file. A file with unparseable
 * frontmatter is recorded in `parseErrors` and skipped (surfaced by the caller)
 * so a single malformed file can't break the whole build.
 */
export function discover(repoRoot: string, siteFolder = "clausconrad.com"): DiscoverResult {
  const absFiles: string[] = []
  walk(repoRoot, absFiles)

  const sitePrefix = siteFolder + "/"
  const docs: SourceDoc[] = []
  const parseErrors: { repoRelPath: string; reason: string }[] = []

  for (const absPath of absFiles) {
    const repoRelPath = relative(repoRoot, absPath).split("\\").join("/")
    const filename = repoRelPath.slice(repoRelPath.lastIndexOf("/") + 1)
    const stem = stemOf(filename)

    let data: Record<string, unknown>
    let body: string
    try {
      const raw = readFileSync(absPath, "utf8")
      ;({ data, body } = parseFrontmatter(raw))
    } catch (err) {
      parseErrors.push({ repoRelPath, reason: err instanceof Error ? err.message : String(err) })
      continue
    }

    const isSite = repoRelPath === `${siteFolder}/${filename}` || repoRelPath.startsWith(sitePrefix)
    if (isSite) {
      // siteRelDir = directory path below the site folder ('' for root files).
      const belowSite = repoRelPath.slice(sitePrefix.length) // e.g. blog/x.md, cv.md
      const lastSlash = belowSite.lastIndexOf("/")
      const siteRelDir = lastSlash === -1 ? "" : belowSite.slice(0, lastSlash)
      docs.push({ absPath, repoRelPath, root: "site", siteRelDir, stem, data, body })
    } else {
      docs.push({ absPath, repoRelPath, root: "notes", siteRelDir: "", stem, data, body })
    }
  }

  return { docs, parseErrors }
}
