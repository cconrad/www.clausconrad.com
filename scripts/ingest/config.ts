import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

/** Repo root (this file lives at scripts/ingest/config.ts). */
export const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)))

export interface IngestConfig {
  /** Obsidian repo checkout (vault root notes + clausconrad.com/** + assets/). */
  obsidianDir: string
  /** Site-folder name inside the Obsidian repo. */
  siteFolder: string
  /** Output: Starlight `docs` collection. */
  docsDir: string
  /** Output: generated data (graph.json, notesSidebar.gen.ts) — later phases. */
  dataDir: string
  /** Output: single static assets folder (§6.3). */
  publicAssetsDir: string
  /** Output: static root (public/) for _redirects, robots.txt, humans.txt. */
  publicDir: string
  /** Committed frozen legacy redirects (§11). */
  legacyRedirectsPath: string
  /** Committed manual redirect overrides (§11). */
  redirectOverridesPath: string
  /** Canonical site origin. */
  site: string
}

export function loadConfig(): IngestConfig {
  return {
    obsidianDir: process.env.OBSIDIAN_DIR ?? "/Users/claus/Obsidian/personal",
    siteFolder: process.env.SITE_FOLDER ?? "clausconrad.com",
    docsDir: resolve(repoRoot, "src/content/docs"),
    dataDir: resolve(repoRoot, "src/data"),
    publicAssetsDir: resolve(repoRoot, "public/assets"),
    publicDir: resolve(repoRoot, "public"),
    legacyRedirectsPath: resolve(repoRoot, "src/redirects/legacy.json"),
    redirectOverridesPath: resolve(repoRoot, "src/redirects/overrides.json"),
    site: process.env.SITE_URL ?? "https://www.clausconrad.com",
  }
}
