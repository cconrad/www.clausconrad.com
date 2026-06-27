import { existsSync, readdirSync } from "node:fs"
import { extname, join } from "node:path"

/**
 * Asset resolution (§8.3), mirroring filter_notes.py:
 * - `![alt](assets/rel)` → exact path under the vault `assets/` dir.
 * - `![[name.ext]]` → exact path, else recursive filename match (first hit).
 * Only referenced assets are recorded for copying (§6.3). Output URLs live under
 * a single static tree at `/assets/notes/...`.
 */
export interface AssetResolver {
  /** Resolve a reference to its output URL, recording it for copy. Undefined if missing. */
  resolve(ref: string): string | undefined
  /** rel-path-within-assets → output URL, for every referenced asset. */
  referenced: Map<string, string>
}

function walkRel(dir: string, base = ""): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...walkRel(join(dir, entry.name), rel))
    else if (entry.isFile()) out.push(rel)
  }
  return out
}

function outUrl(rel: string): string {
  return "/assets/notes/" + rel.split("/").map(encodeURIComponent).join("/")
}

export function buildAssetResolver(assetsDir: string): AssetResolver {
  const referenced = new Map<string, string>()
  const relSet = new Set<string>()
  const byName = new Map<string, string>() // basename.lc → rel (first hit)

  if (existsSync(assetsDir)) {
    for (const rel of walkRel(assetsDir)) {
      relSet.add(rel)
      const base = (rel.split("/").pop() ?? rel).toLowerCase()
      if (!byName.has(base)) byName.set(base, rel)
    }
  }

  function findRel(ref: string): string | undefined {
    let r = ref.trim().replace(/^\.\//, "")
    if (r.startsWith("assets/")) r = r.slice("assets/".length)
    if (relSet.has(r)) return r
    const base = (r.split("/").pop() ?? r).toLowerCase()
    return byName.get(base)
  }

  return {
    referenced,
    resolve(ref: string): string | undefined {
      const rel = findRel(ref)
      if (!rel) return undefined
      const url = outUrl(rel)
      referenced.set(rel, url)
      return url
    },
  }
}

/** Asset embeds `![[file.ext]]` (non-Markdown extension). Operates on masked text. */
export function transformAssetEmbeds(input: string, resolver: AssetResolver): string {
  const re = /!\[\[([^\]|#\n]+?)(?:#[^\]|\n]*)?(?:\|([^\]\n]*))?\]\]/g
  return input.replace(re, (full, rawRef: string, _opt?: string) => {
    const ref = rawRef.trim()
    const ext = extname(ref).toLowerCase()
    if (!ext || ext === ".md") return full // not an asset (note embed handled earlier)
    const url = resolver.resolve(ref)
    if (!url) return full
    const alt = ref.split("/").pop() ?? ref
    return `![${alt}](${url})`
  })
}

/** Standard Markdown image assets `![alt](assets/...)`. Operates on masked text. */
export function transformMarkdownImageAssets(input: string, resolver: AssetResolver): string {
  const re = /!\[([^\]]*)\]\(\s*((?:\.\/)?assets\/[^)\s]+?)\s*\)/g
  return input.replace(re, (full, alt: string, ref: string) => {
    const url = resolver.resolve(ref)
    if (!url) return full
    return `![${alt}](${url})`
  })
}
