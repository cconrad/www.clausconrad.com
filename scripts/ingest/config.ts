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
  /** Output: single static assets folder (§6.3) — later phase. */
  publicAssetsDir: string
}

export function loadConfig(): IngestConfig {
  return {
    obsidianDir: process.env.OBSIDIAN_DIR ?? "/Users/claus/Obsidian/personal",
    siteFolder: process.env.SITE_FOLDER ?? "clausconrad.com",
    docsDir: resolve(repoRoot, "src/content/docs"),
    dataDir: resolve(repoRoot, "src/data"),
    publicAssetsDir: resolve(repoRoot, "public/assets"),
  }
}
