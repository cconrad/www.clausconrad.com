// Page metadata derived at build time (§9.3 reading time, §9.6 excerpts).
// Computed from the already-transformed Markdown body and emitted as
// build-generated frontmatter — only allowlisted source values are consumed.

/** Reduce Markdown/HTML to plain text for word counting + excerpting. */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/<[^>]+>/g, " ") // html tags (iframes, spans, …)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → link text
    .replace(/^[#>\s-]+/gm, " ") // heading/quote/list markers
    .replace(/[*_~]/g, " ") // emphasis markers
    .replace(/\s+/g, " ")
    .trim()
}

export function wordCount(text: string): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0
}

/** Reading time in whole minutes at 220 wpm (matches the old Eleventy filter). */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 220))
}

/**
 * Page excerpt (§9.6): explicit `desc`/`excerpt`/`teaser`, else an
 * `<!-- Excerpt Start/End -->` region, else the first paragraph of plain text
 * (trimmed to ~`max` chars). Only public summary values are consumed.
 */
export function computeExcerpt(opts: {
  desc?: unknown
  excerptFm?: unknown
  teaser?: unknown
  body: string
  max?: number
}): string {
  const explicit = [opts.desc, opts.excerptFm, opts.teaser].find(
    (v) => typeof v === "string" && v.trim() !== "",
  )
  if (explicit) {
    // Old blog excerpts contain inline HTML; strip it for clean meta/llms text.
    return String(explicit)
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  const marker = opts.body.match(/<!--\s*Excerpt Start\s*-->([\s\S]*?)<!--\s*Excerpt End\s*-->/i)
  if (marker) return plainText(marker[1]).trim()

  const text = plainText(opts.body)
  const max = opts.max ?? 200
  if (text.length <= max) return text
  const cut = text.lastIndexOf(" ", max)
  return text.slice(0, cut > 0 ? cut : max).trimEnd() + "…"
}
