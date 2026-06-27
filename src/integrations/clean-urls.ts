import type { AstroIntegration } from "astro"
import { readdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { extname, join } from "node:path"

/**
 * Strip the `.html` extension from a URL path so emitted links/canonicals match
 * the D1 canonical form (no trailing slash, no `.html`). The site is built with
 * `build.format: 'file'`, which otherwise bakes `.html` into `Astro.url` (and
 * thus into canonical, og:url, sitemap <loc>, and internal links). Cloudflare
 * Pages serves the `.html` files at their extensionless paths.
 *
 *   /cv.html        → /cv
 *   /notes/vim.html → /notes/vim
 *   /index.html     → /
 *   /foo.html#frag  → /foo#frag
 */
export function cleanUrl(url: string): string {
  const match = url.match(/^([^#?]*)([#?].*)?$/)
  let path = match?.[1] ?? url
  const suffix = match?.[2] ?? ""
  if (path.endsWith("/index.html")) {
    path = path.slice(0, -"index.html".length) // keep trailing slash → root "/"
  } else if (path.endsWith(".html")) {
    path = path.slice(0, -".html".length)
  }
  return path + suffix
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

function rewrite(content: string, origin: string): string {
  // 1) Absolute same-origin URLs (canonical, og:url, twitter:url, sitemap <loc>).
  const originRe = new RegExp(`${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^"'<\\s]*`, "g")
  let out = content.replace(originRe, (m) => cleanUrl(m))
  // 2) Root-relative internal links (nav/sidebar/body). Leaves external + "//" alone.
  out = out.replace(/href="(\/[^/"][^"]*)"/g, (_m, p: string) => `href="${cleanUrl(p)}"`)
  return out
}

/**
 * Post-build integration: rewrite emitted HTML + XML so every internal URL is in
 * the D1 canonical form. Runs once at `astro:build:done` over the final `dist/`.
 */
export default function cleanUrls(): AstroIntegration {
  return {
    name: "clean-urls",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir)
        const origin = "https://www.clausconrad.com"
        let count = 0
        for await (const file of walk(distDir)) {
          const ext = extname(file)
          if (ext !== ".html" && ext !== ".xml") continue
          const before = await readFile(file, "utf8")
          const after = rewrite(before, origin)
          if (after !== before) {
            await writeFile(file, after, "utf8")
            count++
          }
        }
        logger.info(`cleaned .html from URLs in ${count} file(s)`)
      },
    },
  }
}
