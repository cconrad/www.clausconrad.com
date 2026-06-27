import { existsSync } from "node:fs"
import { loadConfig } from "./config.ts"
import { discover } from "./discover.ts"
import { resolvePublished } from "./resolve.ts"
import { emit } from "./emit.ts"

/**
 * Ingest CLI entry (§6). Wired as `prebuild`, so `astro build` runs after.
 *
 * Phase-2 scope: discover → filter (publish gating + privacy asserts) →
 * slug/URL resolve + collision error → emit notes/pages to the Starlight `docs`
 * collection. Markdown transform (wikilinks/embeds/assets/dead-links/YouTube/
 * website block), link graph, sidebar tree, git dates, and asset copying are
 * added in later phases.
 */
function main(): void {
  const config = loadConfig()
  const t0 = Date.now()

  if (!existsSync(config.obsidianDir)) {
    console.error(`[ingest] ERROR: OBSIDIAN_DIR not found: ${config.obsidianDir}`)
    process.exit(1)
  }

  console.log(`[ingest] source: ${config.obsidianDir}`)

  const { docs: sources, parseErrors } = discover(config.obsidianDir, config.siteFolder)
  const notesSources = sources.filter((s) => s.root === "notes")
  const siteSources = sources.filter((s) => s.root === "site")
  console.log(
    `[ingest] discovered ${sources.length} markdown files ` +
      `(${notesSources.length} vault-root, ${siteSources.length} site-folder)`,
  )

  for (const e of parseErrors) {
    console.warn(`[ingest] WARN unparseable frontmatter, skipped: ${e.repoRelPath} — ${e.reason}`)
  }
  if (parseErrors.length) {
    console.warn(`[ingest] WARN ${parseErrors.length} file(s) skipped due to frontmatter errors`)
  }

  // Filter + resolve (throws on URL collision, §3.3).
  const { docs, warnings, excludedSitePaths, skippedNotes } = resolvePublished(sources)

  for (const w of warnings) console.warn(`[ingest] WARN ${w}`)

  // A1: log every excluded clausconrad.com/** file so an accidental omission is visible.
  for (const p of excludedSitePaths) {
    console.log(`[ingest] excluded (no published:true): ${p}`)
  }

  const emittedNotes = docs.filter((d) => d.kind === "note").length
  const publishedNotes = notesSources.filter((s) => s.data.published === true).length

  // Privacy invariant (§6.2): emitted notes must not exceed published notes.
  if (emittedNotes !== publishedNotes) {
    console.error(
      `[ingest] ERROR: emitted notes (${emittedNotes}) != published notes (${publishedNotes}).`,
    )
    process.exit(1)
  }

  emit(config.docsDir, docs)

  const ratio = notesSources.length
    ? ((publishedNotes / notesSources.length) * 100).toFixed(1)
    : "0"
  console.log(
    `[ingest] emitted ${docs.length} pages → ${config.docsDir}\n` +
      `[ingest]   notes: ${emittedNotes} published of ${notesSources.length} (${ratio}%)\n` +
      `[ingest]   site pages: ${docs.length - emittedNotes} (skipped notes: ${skippedNotes})\n` +
      `[ingest] done in ${Date.now() - t0}ms`,
  )
}

main()
