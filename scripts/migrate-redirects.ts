/**
 * One-off migration helper (§11): freeze the old Netlify `_redirects` into a
 * committed `src/redirects/legacy.json` that the ingest step consumes on every
 * build (the old file is a local reference, not available in CI).
 *
 * It splits the legacy rules:
 *   - path rules (`.html`→clean, apex/netlify splats) → `paths`, with targets
 *     normalized to the no-slash canonical form (D1);
 *   - `/?p=NNN` WordPress query rules → `wordpress` (Cloudflare Pages `_redirects`
 *     can't match query strings; ingest renders these into a Pages Function);
 *   - `/pageN/index.html` rules are dropped (ingest regenerates `/pageN` from the
 *     real page count).
 *
 * Ingest resolves every internal target against the live URL set, so stale slugs
 * are repaired or reported there — not here. Run once after the content migration.
 *
 * Usage: tsx scripts/migrate-redirects.ts <old _redirects path>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

/** Normalize a redirect target to the no-slash canonical form (D1). */
export function normalizeTarget(to: string): string {
  if (/^https?:\/\//i.test(to)) return to // external / splat destination — leave as-is
  // Split off #fragment / ?query, strip trailing slash from the path, reassemble.
  const m = to.match(/^([^#?]*)([#?].*)?$/)
  let path = m?.[1] ?? to
  const suffix = m?.[2] ?? ""
  if (path.length > 1) path = path.replace(/\/+$/, "")
  return (path || "/") + suffix
}

export interface PathRule {
  from: string
  to: string
  status: string
}

export interface LegacyRedirects {
  paths: PathRule[]
  wordpress: Record<string, string>
}

/** Parse + transform an old Netlify `_redirects` file into the frozen legacy set. */
export function transformRedirects(oldText: string): LegacyRedirects {
  const paths: PathRule[] = []
  const wordpress: Record<string, string> = {}

  for (const raw of oldText.split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const tok = line.split(/\s+/)

    // WordPress query rule: `/ p=NNN /target [status]`
    if (tok[0] === "/" && /^p=\d+$/.test(tok[1] ?? "") && tok[2]) {
      wordpress[tok[1].slice(2)] = normalizeTarget(tok[2])
      continue
    }

    // Old paginated rules are regenerated from the real page count at build time.
    if (/^\/page\d+\/index\.html$/.test(tok[0])) continue

    // Standard `from to [status]`.
    if (tok.length >= 2) {
      paths.push({ from: tok[0], to: normalizeTarget(tok[1]), status: tok[2] ?? "301" })
    }
  }

  return { paths, wordpress }
}

function run(oldPath: string): void {
  const oldText = readFileSync(oldPath, "utf8")
  const legacy = transformRedirects(oldText)

  const out = join(repoRoot, "src/redirects/legacy.json")
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(legacy, null, 2) + "\n", "utf8")

  console.log(
    `[redirects] ${legacy.paths.length} path rules + ${Object.keys(legacy.wordpress).length} WordPress ?p= rules → ${out}`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const oldPath = process.argv[2]
  if (!oldPath) {
    console.error("Usage: tsx scripts/migrate-redirects.ts <old _redirects path>")
    process.exit(1)
  }
  run(oldPath)
}
