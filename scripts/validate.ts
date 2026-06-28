/**
 * Acceptance gates (§16.2, §17) run against a built `dist/` + emitted docs.
 * Exits non-zero on any blocking failure. Run after `npm run build`:
 *   npm run validate
 *
 * Checks:
 *  1. Frontmatter allowlist — no non-allowlisted key in any emitted `.md` (page
 *     source or crawler sibling).
 *  2. Privacy/count — emitted notes == published notes; every internal link in
 *     dist resolves to an emitted page (no dangling/unpublished references).
 *  3. URL parity — the stable live URLs from the `_site` oracle (blog posts,
 *     standalone pages, categories, feeds/aux) exist in dist or via a redirect.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { parseFrontmatter } from "./ingest/frontmatter.ts"
import { EMITTED_FRONTMATTER_KEYS } from "./ingest/emit.ts"

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const dist = join(repoRoot, "dist")
const docsDir = join(repoRoot, "src/content/docs")
const vault = process.env.OBSIDIAN_DIR ?? "/Users/claus/Obsidian/personal"
const siteOracle =
  process.env.SITE_ORACLE ??
  "/Users/claus/Sites/clausconrad-com-v2/.sources/cconrad.github.io/_site"

const errors: string[] = []
const warns: string[] = []
const fail = (m: string): void => {
  errors.push(m)
}
const warn = (m: string): void => {
  warns.push(m)
}

function walk(dir: string, ext: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p, ext))
    else if (e.name.endsWith(ext)) out.push(p)
  }
  return out
}

// 1. Frontmatter allowlist ----------------------------------------------------
function checkAllowlist(): void {
  if (!existsSync(docsDir)) return fail("src/content/docs missing — run the build first")
  let scanned = 0
  for (const f of walk(docsDir, ".md")) {
    const { data } = parseFrontmatter(readFileSync(f, "utf8"))
    for (const key of Object.keys(data)) {
      if (!EMITTED_FRONTMATTER_KEYS.has(key)) {
        fail(`non-allowlisted frontmatter key "${key}" in ${relative(repoRoot, f)}`)
      }
    }
    scanned++
  }
  console.log(`[validate] allowlist: scanned ${scanned} emitted docs`)
}

// 2. Privacy / counts / link integrity ---------------------------------------
function publishedNoteCount(): number {
  let n = 0
  const scan = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if ([".git", ".obsidian", ".trash", "assets", "clausconrad.com"].includes(e.name)) continue
        if (e.name.startsWith(".")) continue
        scan(join(dir, e.name))
      } else if (e.name.endsWith(".md")) {
        const { data } = parseFrontmatter(readFileSync(join(dir, e.name), "utf8"))
        if (data.published === true) n++
      }
    }
  }
  if (existsSync(vault)) scan(vault)
  return n
}

function checkPrivacy(): void {
  // Emitted notes (excluding the /notes landing index) == published vault notes.
  const emittedNotes = existsSync(join(docsDir, "notes"))
    ? walk(join(docsDir, "notes"), ".md").length
    : 0
  if (existsSync(vault)) {
    const published = publishedNoteCount()
    // index.md is a published vault note too, so counts should match exactly.
    if (emittedNotes !== published) {
      fail(`emitted notes (${emittedNotes}) != published vault notes (${published})`)
    } else {
      console.log(`[validate] privacy: ${emittedNotes} emitted notes == ${published} published`)
    }
  } else {
    warn(`vault not found at ${vault}; skipped emitted==published count`)
  }

  // Link integrity: every internal /notes//blog//links/ href in dist resolves.
  if (!existsSync(dist)) return fail("dist/ missing — run the build first")
  const htmlFiles = walk(dist, ".html")
  const pageExists = (url: string): boolean => {
    const u = url.replace(/\/$/, "") || "/"
    return existsSync(join(dist, u + ".html")) || existsSync(join(dist, u, "index.html"))
  }
  const refs = new Set<string>()
  for (const f of htmlFiles) {
    const html = readFileSync(f, "utf8")
    for (const m of html.matchAll(/href="(\/(?:notes|blog|links)\/[^"#?]+)"/g)) {
      const r = m[1]
      // Skip non-page links: crawler `.md` siblings, asset files, category routes.
      if (/\.[a-z0-9]+$/i.test(r.replace(/\/$/, ""))) continue
      if (r.startsWith("/blog/category/")) continue
      refs.add(r)
    }
  }
  let dangling = 0
  for (const r of refs) {
    if (!pageExists(r)) {
      dangling++
      if (dangling <= 10) fail(`dangling internal link in dist: ${r}`)
    }
  }
  console.log(`[validate] link integrity: ${refs.size} internal links, ${dangling} dangling`)
}

// 3. URL parity vs _site oracle ----------------------------------------------
function loadRedirectSources(): Set<string> {
  const f = join(dist, "_redirects")
  const set = new Set<string>()
  if (!existsSync(f)) return set
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    set.add(t.split(/\s+/)[0])
  }
  return set
}

function checkUrlParity(): void {
  if (!existsSync(siteOracle))
    return warn(`_site oracle not found at ${siteOracle}; skipped parity`)
  const blog = join(siteOracle, "blog")
  const redirects = loadRedirectSources()
  const distHas = (url: string) =>
    existsSync(join(dist, url + ".html")) ||
    existsSync(join(dist, url, "index.html")) ||
    existsSync(join(dist, url.replace(/^\//, ""))) // exact file (atom.xml, robots.txt)

  // Blog posts (the strict, stable set — D2 parity).
  let blogChecked = 0
  let blogMissing = 0
  if (existsSync(blog)) {
    for (const e of readdirSync(blog, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === "category") continue
      const url = `/blog/${e.name}`
      blogChecked++
      if (!distHas(url) && !redirects.has(url)) {
        blogMissing++
        fail(`URL parity: blog post missing in dist: ${url}`)
      }
    }
  }
  console.log(`[validate] parity: ${blogChecked} blog posts, ${blogMissing} missing`)

  // Required standalone + aux URLs.
  const required = [
    "/cv",
    "/links/friends",
    "/10-kompisar",
    "/blog/category/personal",
    "/blog/category/howto/development",
    "/blog/category/howto/system-administration",
    "/atom.xml",
    "/notes/atom.xml",
    "/robots.txt",
    "/humans.txt",
    "/404",
    "/sitemap-index.xml",
    "/",
    "/notes",
  ]
  for (const url of required) {
    const ok =
      url === "/" ? existsSync(join(dist, "index.html")) : distHas(url) || redirects.has(url)
    if (!ok) fail(`URL parity: required URL missing in dist: ${url}`)
  }
  console.log(`[validate] parity: checked ${required.length} required URLs`)

  // Notes churn is expected (vault changed); report old notes now absent.
  const oracleNotes = join(siteOracle, "notes")
  if (existsSync(oracleNotes)) {
    let gone = 0
    for (const e of readdirSync(oracleNotes, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      if (!distHas(`/notes/${e.name}`) && !redirects.has(`/notes/${e.name}`)) gone++
    }
    if (gone) warn(`${gone} note URL(s) from the old _site are not in dist (content changed)`)
  }
}

checkAllowlist()
checkPrivacy()
checkUrlParity()

for (const w of warns) console.warn(`[validate] WARN ${w}`)
if (errors.length) {
  console.error(`\n[validate] FAILED with ${errors.length} error(s):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log("\n[validate] all acceptance gates passed ✓")
