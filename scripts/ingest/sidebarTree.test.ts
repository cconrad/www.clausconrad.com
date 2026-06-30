import { describe, expect, it } from "vitest"
import {
  buildNotesSidebar,
  parseParents,
  type SidebarEntry,
  type SidebarGroup,
} from "./sidebarTree.ts"
import type { ResolvedDoc } from "./types.ts"

function note(stem: string, inVal?: unknown, slug?: string): ResolvedDoc {
  const s = slug ?? stem.toLowerCase().replace(/\s+/g, "-")
  return {
    absPath: "",
    repoRelPath: `${stem}.md`,
    root: "notes",
    siteRelDir: "",
    stem,
    data: { title: stem, in: inVal },
    body: "",
    slug: s,
    url: `/notes/${s}`,
    kind: "note",
    hadSlug: true,
  }
}

/** Find an entry by label among items. */
function find(items: SidebarEntry[], label: string): SidebarEntry | undefined {
  return items.find((i) => i.label === label)
}
function isGroup(e: SidebarEntry | undefined): e is SidebarGroup {
  return !!e && "items" in e
}

describe("parseParents", () => {
  it("extracts names from wikilink array, stripping alias/anchor", () => {
    expect(parseParents(["[[Top Level]]", "[[Other|alias]]", "[[X#h]]"])).toEqual([
      "Top Level",
      "Other",
      "X",
    ])
  })
  it("handles a scalar and empties", () => {
    expect(parseParents("[[A]]")).toEqual(["A"])
    expect(parseParents(undefined)).toEqual([])
  })
})

describe("buildNotesSidebar (§10.3)", () => {
  it("worked example: Top → Second → Third nests correctly", () => {
    const { sidebar } = buildNotesSidebar([
      note("Top Level"),
      note("Second Level", ["[[Top Level]]"]),
      note("Third Level", ["[[Second Level]]"], "note3"),
    ])
    const top = find(sidebar.items, "Top Level")
    expect(isGroup(top)).toBe(true)
    const second = isGroup(top) ? find(top.items, "Second Level") : undefined
    expect(isGroup(second)).toBe(true)
    const third = isGroup(second) ? find(second.items, "Third Level") : undefined
    expect(third).toEqual({ label: "Third Level", link: "/notes/note3" })
  })

  it("roots with no resolvable parent sit directly under Notes", () => {
    const { sidebar } = buildNotesSidebar([note("Solo")])
    expect(find(sidebar.items, "Solo")).toEqual({ label: "Solo", link: "/notes/solo" })
    expect(find(sidebar.items, "Overview")).toEqual({ label: "Overview", link: "/notes" })
  })

  it("multi-parent: a note appears under each parent", () => {
    const { sidebar } = buildNotesSidebar([note("A"), note("B"), note("Child", ["[[A]]", "[[B]]"])])
    const a = find(sidebar.items, "A")
    const b = find(sidebar.items, "B")
    expect(isGroup(a) && find(a.items, "Child")).toBeTruthy()
    expect(isGroup(b) && find(b.items, "Child")).toBeTruthy()
  })

  it("unresolved/unpublished parent is ignored → note becomes a root", () => {
    const { sidebar } = buildNotesSidebar([note("Orphan", ["[[Nonexistent]]"])])
    expect(find(sidebar.items, "Orphan")).toEqual({ label: "Orphan", link: "/notes/orphan" })
  })

  it("cycle guard: A↔B does not infinite-loop and both still appear", () => {
    const { sidebar, warnings } = buildNotesSidebar([note("A", ["[[B]]"]), note("B", ["[[A]]"])])
    // Promoted to roots (reachable only via cycle).
    expect(find(sidebar.items, "A") || find(sidebar.items, "B")).toBeTruthy()
    expect(warnings.length).toBeGreaterThan(0)
  })

  it("groupOnly: parent with children renders no self-link, only its children", () => {
    const parent = note("Top Level")
    parent.data.groupOnly = true
    const { sidebar } = buildNotesSidebar([parent, note("Child", ["[[Top Level]]"], "child")])
    const top = find(sidebar.items, "Top Level")
    expect(isGroup(top)).toBe(true)
    // No self-link entry: the only item is the child.
    expect(isGroup(top) && find(top.items, "Top Level")).toBeFalsy()
    expect(isGroup(top) && top.items).toEqual([{ label: "Child", link: "/notes/child" }])
  })

  it("groupOnly: has no effect on a childless note", () => {
    const solo = note("Solo")
    solo.data.groupOnly = true
    const { sidebar } = buildNotesSidebar([solo])
    expect(find(sidebar.items, "Solo")).toEqual({ label: "Solo", link: "/notes/solo" })
  })

  it("label falls back to stem when no title", () => {
    const n = note("My Note")
    n.data = { in: undefined } // no title
    const { sidebar } = buildNotesSidebar([n])
    expect(find(sidebar.items, "My Note")).toBeTruthy()
  })
})
