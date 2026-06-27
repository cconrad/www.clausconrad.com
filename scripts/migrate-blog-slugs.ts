/**
 * One-off migration helper (§6.0), run by the owner on a COPY of the old
 * Eleventy blog posts before they are moved into `obsidian-personal/
 * clausconrad.com/blog/`.
 *
 * For each post it:
 *  - computes `slug = blogSlug(title)` — the exact transform Eleventy's
 *    `permalink: blog/{{title | slugify}}/` produced (verified 148/148 against
 *    the live `_site/blog/*` oracle);
 *  - writes `slug:` into frontmatter (idempotent; NEVER overwrites an existing
 *    slug — D2);
 *  - writes `published: true` when no `published` key exists (idempotent; A1).
 *    Existing `published` values are left untouched (drafts stay drafts).
 *
 * Edits are surgical (keys appended to the existing frontmatter block) so the
 * diff stays minimal. Use `--dry-run` to preview, `--site=<dir>` to assert slug
 * parity against the old `_site/blog` directory.
 *
 * Usage: tsx scripts/migrate-blog-slugs.ts <postsDir> [--dry-run] [--site=<_site/blog>]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { parseFrontmatter } from "./ingest/frontmatter.ts"

/** Eleventy `slugify` filter equivalent: lowercase, non-alphanumeric runs → `-`, trimmed. */
export function blogSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics (accented chars to ascii)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Strip a leading `YYYY-MM-DD-` date prefix from a filename stem. */
export function deDate(stem: string): string {
  return stem.replace(/^\d{4}-\d{2}-\d{2}-/, "")
}

export interface MigrateResult {
  content: string
  changed: boolean
  slug: string
  title: string
  addedSlug: boolean
  addedPublished: boolean
}

/**
 * Apply the idempotent frontmatter edits to one file's raw content.
 * `filenameStem` (without `.md`) is the fallback slug source when a post has no
 * `title`.
 */
export function migrateContent(raw: string, filenameStem: string): MigrateResult {
  const { data } = parseFrontmatter(raw)
  const title = typeof data.title === "string" ? data.title : ""
  const slug = title ? blogSlug(title) : deDate(filenameStem)

  const fm = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/)

  // No frontmatter at all → create one.
  if (!fm) {
    return {
      content: `---\npublished: true\nslug: ${slug}\n---\n${raw}`,
      changed: true,
      slug,
      title,
      addedSlug: true,
      addedPublished: true,
    }
  }

  const [, open, fmText, close, body] = fm
  const hasSlug = /^slug:/m.test(fmText)
  const hasPublished = /^published:/m.test(fmText)

  const additions: string[] = []
  if (!hasSlug) additions.push(`slug: ${slug}`)
  if (!hasPublished) additions.push("published: true")

  if (additions.length === 0) {
    return { content: raw, changed: false, slug, title, addedSlug: false, addedPublished: false }
  }

  const newFmText = `${fmText}\n${additions.join("\n")}`
  return {
    content: `${open}${newFmText}${close}${body}`,
    changed: true,
    slug,
    title,
    addedSlug: !hasSlug,
    addedPublished: !hasPublished,
  }
}

interface Report {
  file: string
  slug: string
  title: string
  addedSlug: boolean
  addedPublished: boolean
  parityMismatch: boolean
}

function run(dir: string, opts: { dryRun: boolean; siteDir?: string }): void {
  if (!existsSync(dir)) {
    console.error(`[migrate] ERROR: directory not found: ${dir}`)
    process.exit(1)
  }
  const siteSlugs =
    opts.siteDir && existsSync(opts.siteDir)
      ? new Set(
          readdirSync(opts.siteDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name),
        )
      : null

  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".md"))
  const reports: Report[] = []
  let written = 0

  for (const file of files) {
    const stem = file.replace(/\.md$/i, "")
    const raw = readFileSync(join(dir, file), "utf8")
    const res = migrateContent(raw, stem)
    const parityMismatch = siteSlugs ? !siteSlugs.has(res.slug) : false
    reports.push({
      file,
      slug: res.slug,
      title: res.title,
      addedSlug: res.addedSlug,
      addedPublished: res.addedPublished,
      parityMismatch,
    })
    if (res.changed && !opts.dryRun) {
      writeFileSync(join(dir, file), res.content, "utf8")
      written++
    }
  }

  console.log(
    `[migrate] ${files.length} files; ${opts.dryRun ? "DRY-RUN (no writes)" : `${written} written`}`,
  )
  console.log("[migrate] filename → slug:")
  for (const r of reports) console.log(`  ${r.file} → ${r.slug}`)

  if (siteSlugs) {
    const mismatches = reports.filter((r) => r.parityMismatch)
    if (mismatches.length === 0) {
      console.log(`[migrate] parity OK: all ${reports.length} slugs match ${opts.siteDir}`)
    } else {
      console.warn(`[migrate] PARITY MISMATCHES (manual fix list, ${mismatches.length}):`)
      for (const r of mismatches) console.warn(`  ${r.file}: computed "${r.slug}" not in _site`)
    }
  }
}

// Run only when invoked directly (so the pure functions can be unit-tested).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2)
  const dir = args.find((a) => !a.startsWith("--"))
  const dryRun = args.includes("--dry-run")
  const siteDir = args.find((a) => a.startsWith("--site="))?.slice("--site=".length)
  if (!dir) {
    console.error("Usage: tsx scripts/migrate-blog-slugs.ts <postsDir> [--dry-run] [--site=<dir>]")
    process.exit(1)
  }
  run(dir, { dryRun, siteDir })
}
