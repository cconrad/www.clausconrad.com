// Shared types for the ingest pipeline (PRD §5, §6).

/** Which content root a source file came from (§3.1). */
export type Root = "site" | "notes"

/** Page classification driving features + routing (§12). */
export type Kind = "blog" | "note" | "page"

/** A raw source Markdown file discovered in the Obsidian repo. */
export interface SourceDoc {
  /** Absolute path on disk. */
  absPath: string
  /** Path relative to the Obsidian repo root (used for git dates, §13). */
  repoRelPath: string
  /** Content root this file belongs to. */
  root: Root
  /**
   * For site-root files: the directory path below `clausconrad.com/`
   * (e.g. '' for cv.md, 'blog' for blog/x.md, 'links' for links/friends.md).
   * Empty string for notes.
   */
  siteRelDir: string
  /** Filename stem (without `.md`). */
  stem: string
  /** Parsed frontmatter (raw, before allowlist stripping). */
  data: Record<string, unknown>
  /** Markdown body after frontmatter. */
  body: string
}

/** A published source file with resolved slug/URL/kind. */
export interface ResolvedDoc extends SourceDoc {
  /** Final URL path segment. */
  slug: string
  /** Final absolute URL (no trailing slash), e.g. /notes/foo, /blog/bar, /cv. */
  url: string
  /** Page classification. */
  kind: Kind
  /** True when the slug came from frontmatter; false when derived from the stem. */
  hadSlug: boolean
}
