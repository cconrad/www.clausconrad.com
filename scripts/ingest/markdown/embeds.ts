import { extname } from "node:path"
import { headingSlug, lookup, type LinkIndex } from "./linkIndex.ts"
import { maskCode, unmaskCode } from "./mask.ts"

const EMBED = /!\[\[([^\]|#\n]+?)(?:#(\^?[^\]|\n]*))?(?:\|[^\]\n]*)?\]\]/g

/**
 * File extensions treated as embedded ASSETS (handled by the asset pass). Any
 * other suffix — including dotted note names like `x.notes` or `.canvas` — is
 * treated as a note embed so it resolves against the published set (privacy).
 */
const ASSET_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".avif",
  ".bmp",
  ".ico",
  ".pdf",
  ".mp4",
  ".webm",
  ".mov",
  ".mp3",
  ".wav",
  ".ogg",
  ".zip",
  ".csv",
])

export interface EmbedContext {
  index: LinkIndex
  warnings: string[]
}

/**
 * Extract a `#heading` section or `#^block` reference from a note body (§8.2).
 * Heading section = the heading line through the line before the next heading of
 * the same or higher level. Block = the line carrying the `^id` marker.
 */
export function extractSection(body: string, frag: string): string {
  const f = frag.trim()
  const lines = body.split("\n")

  if (f.startsWith("^")) {
    const id = f.slice(1)
    for (const line of lines) {
      const m = line.match(/^(.*?)\s*\^([\w-]+)\s*$/)
      if (m && m[2] === id) return m[1].trim()
    }
    return ""
  }

  const wantSlug = headingSlug(f)
  let start = -1
  let level = 0
  for (let i = 0; i < lines.length; i++) {
    const hm = lines[i].match(/^(#{1,6})\s+(.*?)\s*$/)
    if (hm) {
      const text = hm[2]
      if (headingSlug(text) === wantSlug || text.toLowerCase() === f.toLowerCase()) {
        start = i
        level = hm[1].length
        break
      }
    }
  }
  if (start === -1) return ""

  let end = lines.length
  for (let j = start + 1; j < lines.length; j++) {
    const hm = lines[j].match(/^(#{1,6})\s+/)
    if (hm && hm[1].length <= level) {
      end = j
      break
    }
  }
  return lines.slice(start, end).join("\n").trim()
}

/**
 * Expand note embeds `![[Target]]` / `![[Target#heading]]` / `![[Target#^block]]`
 * (§8.2). Operates on code-masked text.
 * - Published note → inline its (recursively expanded) raw body / section / block.
 * - Unpublished or unknown → render nothing (privacy, §6.2).
 * - `.excalidraw` → skip. Other non-Markdown extensions → left for the asset pass.
 * Cycle-guarded via the slug `stack`.
 */
export function expandEmbeds(masked: string, ctx: EmbedContext, stack: string[]): string {
  return masked.replace(EMBED, (full, rawTarget: string, frag?: string) => {
    const target = rawTarget.trim()
    const ext = extname(target).toLowerCase()
    if (ext === ".excalidraw") return ""
    if (ASSET_EXTS.has(ext)) return full // asset embed → handled by the asset pass

    const doc = lookup(ctx.index, target)
    if (!doc) return "" // unpublished / unknown → nothing
    if (stack.includes(doc.slug)) {
      ctx.warnings.push(`embed cycle skipped: ${[...stack, doc.slug].join(" -> ")}`)
      return ""
    }

    let inner = doc.body
    if (frag && frag.trim()) inner = extractSection(inner, frag.trim())
    if (!inner.trim()) return ""

    const { masked: m2, tokens } = maskCode(inner)
    const expanded = expandEmbeds(m2, ctx, [...stack, doc.slug])
    return unmaskCode(expanded, tokens)
  })
}
