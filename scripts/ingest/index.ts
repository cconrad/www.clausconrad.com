import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { loadConfig, repoRoot } from "./config.ts"
import { discover } from "./discover.ts"
import { resolvePublished } from "./resolve.ts"
import { emit } from "./emit.ts"
import { buildLinkIndex } from "./markdown/linkIndex.ts"
import { buildAssetResolver, type AssetResolver } from "./markdown/assets.ts"
import { transformDoc, type TransformContext } from "./markdown/transform.ts"
import { emitAuxFiles, emitRedirects } from "./redirects.ts"
import { buildGraph } from "./graph.ts"
import { buildNotesSidebar } from "./sidebarTree.ts"
import { loadGitDates } from "./gitDates.ts"
import { emitLlmsTxt, emitMarkdownSiblings } from "./markdownSiblings.ts"

/** Copy only the referenced assets into the single output tree at /assets/notes (§6.3). */
function copyAssets(assetsDir: string, publicAssetsDir: string, resolver: AssetResolver): number {
  const notesDir = join(publicAssetsDir, "notes")
  rmSync(notesDir, { recursive: true, force: true })
  let n = 0
  for (const rel of resolver.referenced.keys()) {
    const src = join(assetsDir, rel)
    if (!existsSync(src)) continue
    const dst = join(notesDir, rel)
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(src, dst)
    n++
  }
  return n
}

/**
 * Ingest CLI entry (§6). Wired as `prebuild`, so `astro build` runs after.
 *
 * Pipeline: discover → filter (publish gating + privacy asserts) → slug/URL
 * resolve + collision error → transform Markdown (wikilinks/embeds/dead-links/
 * assets/YouTube/website block) → copy referenced assets → emit to the Starlight
 * `docs` collection. Link graph, sidebar tree, and git dates come in later phases.
 */
function main(): void {
  const config = loadConfig()
  const t0 = Date.now()

  if (!existsSync(config.obsidianDir)) {
    console.error(`[ingest] ERROR: OBSIDIAN_DIR not found: ${config.obsidianDir}`)
    process.exit(1)
  }

  console.log(`[ingest] source: ${config.obsidianDir}`)

  const { docs: discovered, parseErrors } = discover(config.obsidianDir, config.siteFolder)

  // §2: the front-page intro lives in the vault (clausconrad.com/home.md) so the
  // owner can edit it without touching source. Pull it out of the page set (it is
  // never emitted as a standalone page) and stage its body for the home page.
  const homeIntroRel = `${config.siteFolder}/home.md`
  const homeIntro = discovered.find((s) => s.repoRelPath === homeIntroRel)
  const sources = homeIntro ? discovered.filter((s) => s !== homeIntro) : discovered

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

  // Transform Markdown using the published-set as the link/embed authority (§8).
  const index = buildLinkIndex(docs)
  const assetsDir = join(config.obsidianDir, "assets")
  const assets = buildAssetResolver(assetsDir)
  const tctx: TransformContext = { index, assets, warnings: [] }
  const transformed = docs.map((d) => ({ ...d, body: transformDoc(d, tctx) }))
  for (const w of tctx.warnings) console.warn(`[ingest] WARN ${w}`)

  const copied = copyAssets(assetsDir, config.publicAssetsDir, assets)

  // Git Created/Updated fallback (§13) — one log pass over the source repo.
  const gitDates = loadGitDates(config.obsidianDir)
  const gitDated = transformed.filter(
    (d) => !d.data.created && !d.data.date && gitDates.get(d.repoRelPath)?.created,
  ).length

  emit(config.docsDir, transformed, gitDates)

  // Crawler Markdown siblings + llms.txt (§14).
  const siblings = emitMarkdownSiblings(config.publicDir, transformed, gitDates)
  emitLlmsTxt(config.publicDir, config.site, transformed)

  // Link graph + backlinks (§10.2) → src/data/graph.json.
  const graph = buildGraph(transformed)
  mkdirSync(config.dataDir, { recursive: true })
  writeFileSync(join(config.dataDir, "graph.json"), JSON.stringify(graph), "utf8")

  // §2: front-page intro Markdown → src/data/homeIntro.gen.md (rendered by the
  // home page). Absent when the vault has no clausconrad.com/home.md (the page
  // then falls back to its default title).
  if (homeIntro) {
    writeFileSync(join(config.dataDir, "homeIntro.gen.md"), homeIntro.body.trim() + "\n", "utf8")
  }

  // Notes sidebar tree from `in` (§10.3) → src/data/notesSidebar.gen.json.
  const { sidebar, warnings: sidebarWarnings } = buildNotesSidebar(transformed)
  writeFileSync(join(config.dataDir, "notesSidebar.gen.json"), JSON.stringify(sidebar), "utf8")
  for (const w of sidebarWarnings) console.warn(`[ingest] WARN ${w}`)

  // Redirects (§11) + robots/humans (§4). /pageN count = the merged-stream page count.
  const streamCount = transformed.filter(
    (d) => (d.kind === "blog" || d.kind === "note") && d.url !== "/notes",
  ).length
  const blogPageCount = Math.max(1, Math.ceil(streamCount / 5))
  const redir = emitRedirects({
    repoRoot,
    publicDir: config.publicDir,
    legacyPath: config.legacyRedirectsPath,
    overridesPath: config.redirectOverridesPath,
    docs: transformed,
    blogPageCount,
  })
  emitAuxFiles(config.publicDir, config.site)
  for (const r of redir.remapped) console.warn(`[ingest] WARN redirect remapped: ${r}`)
  if (redir.unresolved.length) {
    console.warn(
      `[ingest] WARN ${redir.unresolved.length} legacy redirect target(s) unresolved (dropped):`,
    )
    for (const u of redir.unresolved) console.warn(`[ingest]   ${u}`)
  }
  console.log(
    `[ingest] redirects → ${redir.redirectsFile} (+${redir.pageCount} pageN), ` +
      `WordPress fn ${redir.wordpressCount} rules → ${redir.functionFile}`,
  )

  const ratio = notesSources.length
    ? ((publishedNotes / notesSources.length) * 100).toFixed(1)
    : "0"
  console.log(
    `[ingest] emitted ${transformed.length} pages → ${config.docsDir}\n` +
      `[ingest]   notes: ${emittedNotes} published of ${notesSources.length} (${ratio}%)\n` +
      `[ingest]   site pages: ${transformed.length - emittedNotes} (skipped notes: ${skippedNotes})\n` +
      `[ingest]   assets: ${copied} copied → ${join(config.publicAssetsDir, "notes")}\n` +
      `[ingest]   git dates: ${gitDates.size} files in history, ${gitDated} pages got Created from git\n` +
      `[ingest]   crawler: ${siblings} .md siblings + llms.txt\n` +
      `[ingest] done in ${Date.now() - t0}ms`,
  )
}

main()
