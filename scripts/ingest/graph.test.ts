import { describe, expect, it } from "vitest"
import { buildGraph, canonicalUrl } from "./graph.ts"
import type { ResolvedDoc } from "./types.ts"

function doc(slug: string, body: string, url?: string): ResolvedDoc {
  return {
    absPath: "",
    repoRelPath: `${slug}.md`,
    root: "notes",
    siteRelDir: "",
    stem: slug,
    data: { title: slug.toUpperCase() },
    body,
    slug,
    url: url ?? `/notes/${slug}`,
    kind: "note",
    hadSlug: true,
  }
}

describe("canonicalUrl", () => {
  it("collapses the notes landing index", () => {
    expect(canonicalUrl("/notes/index")).toBe("/notes")
    expect(canonicalUrl("/notes/vim")).toBe("/notes/vim")
  })
})

describe("buildGraph (§10.2)", () => {
  it("builds forward edges + backlinks from internal links between published docs", () => {
    const docs = [
      doc("a", "links to [B](/notes/b) and [C](/notes/c)"),
      doc("b", "links to [C](/notes/c)"),
      doc("c", "no links"),
    ]
    const g = buildGraph(docs)
    expect(g.nodes.map((n) => n.url).sort()).toEqual(["/notes/a", "/notes/b", "/notes/c"])
    expect(g.edges).toContainEqual({ source: "/notes/a", target: "/notes/b" })
    expect(g.edges).toContainEqual({ source: "/notes/a", target: "/notes/c" })
    expect(g.edges).toContainEqual({ source: "/notes/b", target: "/notes/c" })
    expect(g.backlinks["/notes/c"].sort()).toEqual(["/notes/a", "/notes/b"])
    expect(g.backlinks["/notes/b"]).toEqual(["/notes/a"])
  })

  it("ignores links to non-published targets, anchors, and self-links", () => {
    const docs = [
      doc(
        "a",
        "self [A](/notes/a) ext [x](https://x.com) dead [Z](/notes/zzz) anchor [B](/notes/b#h)",
      ),
      doc("b", ""),
    ]
    const g = buildGraph(docs)
    expect(g.edges).toEqual([{ source: "/notes/a", target: "/notes/b" }])
  })

  it("dedupes repeated links", () => {
    const g = buildGraph([doc("a", "[B](/notes/b) [B again](/notes/b)"), doc("b", "")])
    expect(g.edges).toEqual([{ source: "/notes/a", target: "/notes/b" }])
  })

  it("cross-kind links (note → blog) are edges too", () => {
    const docs = [
      doc("a", "see [post](/blog/foo)"),
      { ...doc("foo", "", "/blog/foo"), kind: "blog" as const, siteRelDir: "blog" },
    ]
    const g = buildGraph(docs)
    expect(g.edges).toContainEqual({ source: "/notes/a", target: "/blog/foo" })
  })
})
