import yaml from "js-yaml"

/**
 * YAML frontmatter parsing configured for resilience over a large vault:
 * `json: true` tolerates duplicate mapping keys (last wins) instead of throwing,
 * which a few real notes contain (e.g. a doubled `aliases:`). Genuine syntax
 * errors still throw and are surfaced per-file by the caller.
 */
const frontmatterPattern = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/

/**
 * The ONLY frontmatter keys that may survive from source into output (§3.4).
 * Some source notes carry sensitive data in other keys (e.g. `country`,
 * `aliases`, `links`) — those must never reach output. This list is exactly the
 * frontmatter contract in §3.2.
 */
export const ALLOWLIST = [
  "published",
  "slug",
  "in",
  "website",
  "title",
  "desc",
  "date",
  "created",
  "updated",
  "tags",
] as const

export type AllowlistedKey = (typeof ALLOWLIST)[number]

/** Parse a raw Markdown string into frontmatter data + body. */
export function parseFrontmatter(raw: string): {
  data: Record<string, unknown>
  body: string
} {
  const match = raw.match(frontmatterPattern)
  if (!match) return { data: {}, body: raw.replace(/^\uFEFF/, "") }

  const parsed = yaml.load(match[1], { json: true })
  const data =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  return { data, body: raw.slice(match[0].length) }
}

/** Serialize a Markdown body with YAML frontmatter. */
export function stringifyFrontmatter(body: string, data: Record<string, unknown>): string {
  const frontmatter = yaml.dump(data, { lineWidth: -1, noRefs: true }).trimEnd()
  return `---\n${frontmatter}\n---\n${body}`
}

/** A page is published iff frontmatter `published === true` (universal gate, A1). */
export function isPublished(data: Record<string, unknown>): boolean {
  return data.published === true
}

/**
 * Return a copy of `data` containing only allowlisted keys (§3.4).
 * Stripping happens in ingest, before emit.
 */
export function stripToAllowlist(
  data: Record<string, unknown>,
): Partial<Record<AllowlistedKey, unknown>> {
  const out: Partial<Record<AllowlistedKey, unknown>> = {}
  for (const key of ALLOWLIST) {
    if (key in data && data[key] !== undefined) out[key] = data[key]
  }
  return out
}
