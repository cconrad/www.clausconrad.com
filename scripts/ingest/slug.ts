import { slug as githubSlug } from "github-slugger"
import type { Kind, Root } from "./types.ts"

/** A valid final URL segment: lowercase alphanumerics and hyphens (§3.3). */
const SLUG_RE = /^[a-z0-9-]+$/

export interface SlugResult {
  slug: string
  /** True when a usable `slug` was present in frontmatter. */
  hadSlug: boolean
  /** Non-fatal message to log (missing slug, or invalid slug normalized). */
  warning?: string
}

/**
 * Resolve a page's final URL segment (§3.3).
 * 1. Frontmatter `slug` present → use it, lower-cased + validated `[a-z0-9-]`.
 *    Invalid characters are normalized via github-slugger with a warning.
 * 2. No `slug` → slugify the filename stem and emit a warning.
 */
export function resolveSlug(rawSlug: unknown, stem: string): SlugResult {
  if (rawSlug !== undefined && rawSlug !== null && String(rawSlug).trim() !== "") {
    const lowered = String(rawSlug).trim().toLowerCase()
    if (SLUG_RE.test(lowered)) {
      return { slug: lowered, hadSlug: true }
    }
    const normalized = githubSlug(String(rawSlug))
    return {
      slug: normalized,
      hadSlug: true,
      warning: `slug "${String(rawSlug)}" is not [a-z0-9-]; normalized to "${normalized}"`,
    }
  }
  const derived = githubSlug(stem)
  return {
    slug: derived,
    hadSlug: false,
    warning: `no slug in frontmatter; derived "${derived}" from filename "${stem}"`,
  }
}

/**
 * Compute the final absolute URL (no trailing slash, no `.html`) (§4).
 * - notes  → `/notes/<slug>`
 * - site   → mirror the folder path below `clausconrad.com/`, last segment = slug
 *            (cv.md → `/cv`, blog/x.md → `/blog/<slug>`, links/friends.md → `/links/friends`).
 */
export function resolveUrl(root: Root, siteRelDir: string, slug: string): string {
  if (root === "notes") return `/notes/${slug}`
  return siteRelDir ? `/${siteRelDir}/${slug}` : `/${slug}`
}

/** Classify a page (§12). */
export function classify(root: Root, siteRelDir: string): Kind {
  if (root === "notes") return "note"
  if (siteRelDir === "blog" || siteRelDir.startsWith("blog/")) return "blog"
  return "page"
}
