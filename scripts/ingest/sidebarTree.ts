import { canonicalUrl } from "./graph.ts"
import type { ResolvedDoc } from "./types.ts"

export interface SidebarLink {
  label: string
  link: string
}
export interface SidebarGroup {
  label: string
  collapsed?: boolean
  items: SidebarEntry[]
}
export type SidebarEntry = SidebarLink | SidebarGroup

/** Parse `in` frontmatter (`["[[Parent]]", "[[Other|alias]]"]`) → parent names. */
export function parseParents(inVal: unknown): string[] {
  const arr = Array.isArray(inVal) ? inVal : inVal != null && inVal !== "" ? [inVal] : []
  return arr
    .map((v) => String(v).trim().replace(/^\[\[/, "").replace(/\]\]$/, ""))
    .map((s) => s.split("|")[0].split("#")[0].trim())
    .filter(Boolean)
}

/**
 * Build the collapsible Notes sidebar tree from the `in` parent property (§10.3).
 * - Edge child→parent for each `in` that resolves to a PUBLISHED note (others ignored).
 * - Roots = notes with no resolvable parent.
 * - Multi-parent: a note appears under EACH parent.
 * - Cycle guard: ancestors block re-entry; notes reachable only via a cycle are
 *   promoted to roots (deterministically) and reported — never infinite-loop.
 * A note with children is a group whose first item is a link to the note itself,
 * unless the note sets `groupOnly: true` — then the group has no self-link and is
 * a pure container. (The page stays published and reachable by URL; only its
 * sidebar self-entry is suppressed.) `groupOnly` has no effect on a childless note.
 */
export function buildNotesSidebar(notes: ResolvedDoc[]): {
  sidebar: SidebarGroup
  warnings: string[]
} {
  const warnings: string[] = []
  const list = notes.filter((n) => n.kind === "note" && canonicalUrl(n.url) !== "/notes")

  const byName = new Map<string, ResolvedDoc>()
  for (const n of list) {
    const k = n.stem.toLowerCase()
    if (!byName.has(k)) byName.set(k, n)
  }
  const urlOf = (n: ResolvedDoc) => canonicalUrl(n.url)
  const labelOf = (n: ResolvedDoc) => (n.data.title ? String(n.data.title) : n.stem)

  const childrenMap = new Map<string, ResolvedDoc[]>()
  const hasParent = new Set<string>()
  for (const n of list) {
    const parents = parseParents(n.data.in)
      .map((p) => byName.get(p.toLowerCase()))
      .filter((p): p is ResolvedDoc => p != null && urlOf(p) !== urlOf(n))
    const uniq = [...new Map(parents.map((p) => [urlOf(p), p])).values()]
    if (uniq.length) {
      hasParent.add(urlOf(n))
      for (const p of uniq) {
        const arr = childrenMap.get(urlOf(p)) ?? []
        arr.push(n)
        childrenMap.set(urlOf(p), arr)
      }
    }
  }

  const roots = list.filter((n) => !hasParent.has(urlOf(n)))

  // Reachability from roots; notes only in a cycle never appear → promote to root.
  const reachable = new Set<string>()
  const stack = roots.map(urlOf)
  while (stack.length) {
    const u = stack.pop()!
    if (reachable.has(u)) continue
    reachable.add(u)
    for (const c of childrenMap.get(u) ?? []) stack.push(urlOf(c))
  }
  const cycleOrphans = list.filter((n) => !reachable.has(urlOf(n)))
  if (cycleOrphans.length) {
    warnings.push(
      `notes sidebar: ${cycleOrphans.length} note(s) reachable only via a cycle, promoted to root ` +
        `(e.g. ${cycleOrphans.slice(0, 3).map(urlOf).join(", ")})`,
    )
  }

  const byLabel = (a: ResolvedDoc, b: ResolvedDoc) => labelOf(a).localeCompare(labelOf(b))

  function node(n: ResolvedDoc, ancestors: Set<string>): SidebarEntry {
    const url = urlOf(n)
    const label = labelOf(n)
    const kids = (childrenMap.get(url) ?? [])
      .filter((c) => urlOf(c) !== url && !ancestors.has(urlOf(c)))
      .sort(byLabel)
    if (!kids.length) return { label, link: url }
    const next = new Set(ancestors).add(url)
    const selfLink: SidebarEntry[] = n.data.groupOnly === true ? [] : [{ label, link: url }]
    return {
      label,
      collapsed: true,
      items: [...selfLink, ...kids.map((c) => node(c, next))],
    }
  }

  const items: SidebarEntry[] = [
    { label: "Overview", link: "/notes" },
    { label: "Graph", link: "/graph" },
    ...[...roots, ...cycleOrphans].sort(byLabel).map((r) => node(r, new Set())),
  ]
  return { sidebar: { label: "Notes", collapsed: true, items }, warnings }
}
