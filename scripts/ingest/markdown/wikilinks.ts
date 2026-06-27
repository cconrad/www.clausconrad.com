import { headingSlug, lookup, type LinkIndex } from "./linkIndex.ts"

/** Escape text destined for raw-HTML output (dead-link spans). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Wikilink transform (§8.1) + dead links (§8.4). Operates on code-masked text;
 * matches `[[Target]]`, `[[Target|Title]]`, `[[Target#heading]]`,
 * `[[Target#heading|Title]]` but NOT `![[...]]` (embeds/assets).
 *
 * - Published target → Markdown link `[label](/url#heading)`, label = Title or Target.
 * - Unpublished/unknown target → the label as plain text in a `dead-link` span
 *   (never a broken `<a>`), preserving privacy.
 */
export function transformWikilinks(input: string, index: LinkIndex): string {
  const re = /(?<!!)\[\[([^\]|#\n]*?)(?:#([^\]|\n]*))?(?:\|([^\]\n]*))?\]\]/g
  return input.replace(re, (full, rawTarget: string, heading?: string, title?: string) => {
    const target = rawTarget.trim()
    const head = heading?.trim() ?? ""

    // Same-page heading link `[[#Heading]]` (no target before the `#`).
    if (!target && head) {
      const label = (title?.trim() || head).trim()
      return `[${label}](#${headingSlug(head)})`
    }
    if (!target) return full // nothing usable (e.g. `[[]]`)

    const label = (title?.trim() || target).trim()
    const doc = lookup(index, target)
    if (!doc) {
      return `<span class="dead-link">${escapeHtml(label)}</span>`
    }
    let href = doc.url
    if (head) href += `#${headingSlug(head)}`
    return `[${label}](${href})`
  })
}
