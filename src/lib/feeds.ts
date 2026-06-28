import type { StreamItem } from "./content.ts"

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function iso(ms: number): string {
  return new Date(ms === -Infinity ? 0 : ms).toISOString()
}

/**
 * Render an Atom 1.0 feed (§9.5). `updated` is the newest item date (deterministic
 * — no build-time `now`). Item URLs are absolute and already in canonical form.
 */
export function atomFeed(opts: {
  site: string
  path: string
  title: string
  items: StreamItem[]
}): string {
  const site = opts.site.replace(/\/$/, "")
  const self = site + opts.path
  const newest = opts.items.reduce((m, i) => Math.max(m, i.dateMs === -Infinity ? 0 : i.dateMs), 0)

  const entries = opts.items
    .map((i) => {
      const url = site + i.url
      return [
        "  <entry>",
        `    <title>${esc(i.title)}</title>`,
        `    <link href="${url}"/>`,
        `    <id>${url}</id>`,
        `    <updated>${iso(i.dateMs)}</updated>`,
        i.description ? `    <summary>${esc(i.description)}</summary>` : "",
        "  </entry>",
      ]
        .filter(Boolean)
        .join("\n")
    })
    .join("\n")

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(opts.title)}</title>
  <link href="${self}" rel="self"/>
  <link href="${site}/"/>
  <id>${self}</id>
  <updated>${iso(newest)}</updated>
${entries}
</feed>
`
}
