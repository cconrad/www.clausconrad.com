import { getCollection, type CollectionEntry } from "astro:content"

export type Doc = CollectionEntry<"docs">

/** Links per index page (§3). Mirror this in scripts/ingest/index.ts (pageN count). */
export const PAGE_SIZE = 25

/** Category → tag mapping (§9.2), in menu order. */
export const CATEGORIES = [
  { slug: "personal", tag: "personal", title: "Personal" },
  { slug: "howto/development", tag: "development", title: "Development" },
  {
    slug: "howto/system-administration",
    tag: "system-administration",
    title: "System administration",
  },
] as const

/** Canonical route for a docs entry (no trailing slash; index collapses). */
export function docUrl(d: Doc): string {
  let u = "/" + d.id
  u = u.replace(/\/index$/, "")
  if (u === "/index" || u === "") u = "/"
  return u
}

/** Effective date in ms for ordering (§13). Undated → sorts last (oldest). */
export function docDateMs(d: Doc): number {
  const s = d.data.created ?? d.data.updated
  const t = s ? new Date(s).getTime() : NaN
  return Number.isNaN(t) ? -Infinity : t
}

export interface StreamItem {
  url: string
  title: string
  kind: "blog" | "note"
  dateMs: number
  date?: string
  description?: string
  readingMinutes?: number
}

export function toStreamItem(d: Doc): StreamItem {
  return {
    url: docUrl(d),
    title: d.data.title,
    kind: d.data.kind === "blog" ? "blog" : "note",
    dateMs: docDateMs(d),
    date: d.data.created ?? d.data.updated,
    description: d.data.description,
    readingMinutes: d.data.readingMinutes,
  }
}

/** Blog posts only, newest first. */
export async function blogPosts(): Promise<Doc[]> {
  const docs = await getCollection("docs")
  return docs.filter((d) => d.data.kind === "blog").sort((a, b) => docDateMs(b) - docDateMs(a))
}

/** Published notes only (excludes the /notes landing index), newest first. */
export async function noteDocs(): Promise<Doc[]> {
  const docs = await getCollection("docs")
  return docs
    .filter((d) => d.data.kind === "note" && docUrl(d) !== "/notes")
    .sort((a, b) => docDateMs(b) - docDateMs(a))
}

/** Merged blog + notes stream for the homepage/pagination (§9.1), newest first. */
export async function streamItems(): Promise<StreamItem[]> {
  const docs = await getCollection("docs")
  return docs
    .filter((d) => (d.data.kind === "blog" || d.data.kind === "note") && docUrl(d) !== "/notes")
    .map(toStreamItem)
    .sort((a, b) => b.dateMs - a.dateMs)
}

/** Posts in a category (by tag), newest first. */
export async function categoryItems(tag: string): Promise<StreamItem[]> {
  const docs = await getCollection("docs")
  return docs
    .filter((d) => d.data.kind === "blog" && (d.data.tags ?? []).includes(tag))
    .map(toStreamItem)
    .sort((a, b) => b.dateMs - a.dateMs)
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE))
}
