// Created/Updated date resolution (§13). Git fallback is added in a later phase;
// this module covers frontmatter-derived dates and lenient parsing.

/**
 * Parse any standard date value (ISO date, datetime, JS Date from YAML) into a
 * single internal representation (ISO 8601 string). Throws on an unparseable
 * value (§13: "fail loudly only on an unparseable value").
 */
export function normalizeDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`Unparseable date: ${String(value)}`)
    return value.toISOString()
  }
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) throw new Error(`Unparseable date: "${String(value)}"`)
  return parsed.toISOString()
}

/**
 * Resolve Created/Updated from frontmatter only (§13). Frontmatter `created`/`date`
 * ALWAYS win over git; `date` is the blog fallback for `created`.
 * Returns ISO strings or undefined when absent.
 */
export function computeDates(data: Record<string, unknown>): {
  created?: string
  updated?: string
} {
  const created = normalizeDate(data.created ?? data.date)
  const updated = normalizeDate(data.updated)
  return { created, updated }
}
