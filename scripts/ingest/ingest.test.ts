import { describe, expect, it } from "vitest"
import { isPublished, stripToAllowlist } from "./frontmatter.ts"
import { classify, resolveSlug, resolveUrl } from "./slug.ts"
import { resolvePublished } from "./resolve.ts"
import { computeDates, normalizeDate } from "./dates.ts"
import {
  buildEmittedFrontmatter,
  docOutputPath,
  EMITTED_FRONTMATTER_KEYS,
  renderDoc,
} from "./emit.ts"
import type { ResolvedDoc, SourceDoc } from "./types.ts"

function src(p: Partial<SourceDoc> & { stem: string }): SourceDoc {
  return {
    absPath: `/vault/${p.repoRelPath ?? p.stem + ".md"}`,
    repoRelPath: p.repoRelPath ?? `${p.stem}.md`,
    root: p.root ?? "notes",
    siteRelDir: p.siteRelDir ?? "",
    stem: p.stem,
    data: p.data ?? {},
    body: p.body ?? "body",
  }
}

function resolved(
  p: Partial<SourceDoc> & { stem: string },
  extra: Partial<ResolvedDoc>,
): ResolvedDoc {
  return { ...src(p), slug: "x", url: "/notes/x", kind: "note", hadSlug: true, ...extra }
}

describe("publish gate (§3.1, A1)", () => {
  it("serves only published files; logs excluded site files; counts skipped notes", () => {
    const r = resolvePublished([
      src({ stem: "A", data: { published: true, slug: "a" } }),
      src({ stem: "B", data: {} }), // unpublished note
      src({ stem: "C", data: { published: false } }), // explicit false note
      src({
        stem: "sekret",
        root: "site",
        repoRelPath: "clausconrad.com/sekret.md",
        data: {},
      }), // unpublished site page
    ])
    expect(r.docs.map((d) => d.slug)).toEqual(["a"])
    expect(r.skippedNotes).toBe(2)
    expect(r.excludedSitePaths).toEqual(["clausconrad.com/sekret.md"])
  })

  it("isPublished requires boolean true", () => {
    expect(isPublished({ published: true })).toBe(true)
    expect(isPublished({ published: "true" })).toBe(false)
    expect(isPublished({})).toBe(false)
  })
})

describe("slug resolution (§3.3)", () => {
  it("honors explicit slug, lower-cased", () => {
    expect(resolveSlug("My-Slug", "stem")).toMatchObject({ slug: "my-slug", hadSlug: true })
  })
  it("derives slugified filename + warning when no slug", () => {
    const r = resolveSlug(undefined, "Hello World")
    expect(r.slug).toBe("hello-world")
    expect(r.hadSlug).toBe(false)
    expect(r.warning).toBeDefined()
  })
  it("normalizes an invalid slug (spaces/uppercase) + warns", () => {
    const r = resolveSlug("Has Space", "s")
    expect(r.slug).toBe("has-space")
    expect(r.hadSlug).toBe(true)
    expect(r.warning).toBeDefined()
  })
})

describe("URL + classification (§4, §12)", () => {
  it("builds note + site URLs with no trailing slash", () => {
    expect(resolveUrl("notes", "", "foo")).toBe("/notes/foo")
    expect(resolveUrl("site", "", "cv")).toBe("/cv")
    expect(resolveUrl("site", "blog", "bar")).toBe("/blog/bar")
    expect(resolveUrl("site", "links", "friends")).toBe("/links/friends")
  })
  it("classifies blog/note/page", () => {
    expect(classify("notes", "")).toBe("note")
    expect(classify("site", "blog")).toBe("blog")
    expect(classify("site", "blog/sub")).toBe("blog")
    expect(classify("site", "")).toBe("page")
    expect(classify("site", "links")).toBe("page")
  })
})

describe("collision detection (§3.3 step 4)", () => {
  it("fails the build naming both source files", () => {
    expect(() =>
      resolvePublished([
        src({ stem: "a", repoRelPath: "a.md", data: { published: true, slug: "dup" } }),
        src({ stem: "b", repoRelPath: "b.md", data: { published: true, slug: "dup" } }),
      ]),
    ).toThrow(/collision.*dup.*a\.md.*b\.md/s)
  })
})

describe("frontmatter allowlist (§3.4)", () => {
  it("strips non-allowlisted keys", () => {
    const out = stripToAllowlist({
      published: true,
      slug: "x",
      title: "T",
      country: "[[Canada]]",
      aliases: ["y"],
      links: ["secret"],
    })
    expect(Object.keys(out).sort()).toEqual(["published", "slug", "title"])
    expect(out).not.toHaveProperty("country")
    expect(out).not.toHaveProperty("links")
  })
})

describe("emitted frontmatter built from allowlisted inputs only (§3.4, §6.2)", () => {
  const doc = resolved(
    {
      stem: "note",
      data: {
        published: true,
        slug: "n",
        title: "Title",
        desc: "a description",
        website: "https://example.com",
        tags: ["a", "b"],
        date: "2014-10-06",
        created: "2020-01-01",
        country: "[[Canada]]",
        aliases: ["secret-alias"],
      },
    },
    { slug: "n", url: "/notes/n", kind: "note" },
  )

  it("only emits allowed keys; no source leakage", () => {
    const fm = buildEmittedFrontmatter(doc)
    expect(Object.keys(fm).every((k) => EMITTED_FRONTMATTER_KEYS.has(k))).toBe(true)
    expect(fm).not.toHaveProperty("country")
    expect(fm).not.toHaveProperty("aliases")
    expect(fm).not.toHaveProperty("slug")
    expect(fm.title).toBe("Title")
    expect(fm.description).toBe("a description")
    expect(fm.website).toBe("https://example.com")
    expect(fm.tags).toEqual(["a", "b"])
    expect(fm.kind).toBe("note")
  })

  it("frontmatter `created` beats `date`", () => {
    const fm = buildEmittedFrontmatter(doc)
    expect(fm.created).toBe(new Date("2020-01-01").toISOString())
  })

  it("rendered output never contains a stripped key string in frontmatter", () => {
    const out = renderDoc(doc)
    const fmBlock = out.slice(0, out.indexOf("\n---", 3))
    expect(fmBlock).not.toContain("country")
    expect(fmBlock).not.toContain("aliases")
    expect(fmBlock).not.toContain("Canada")
  })

  it("falls back to stem when no title", () => {
    const d = resolved(
      { stem: "My Note", data: { published: true, slug: "m" } },
      { slug: "m", kind: "note" },
    )
    expect(buildEmittedFrontmatter(d).title).toBe("My Note")
  })
})

describe("output paths (§6.1.8)", () => {
  it("notes / root page / blog page", () => {
    const note = resolved({ stem: "n" }, { root: "notes", slug: "n", kind: "note" })
    expect(docOutputPath("/docs", note)).toBe("/docs/notes/n.md")
    const cv = resolved({ stem: "cv" }, { root: "site", siteRelDir: "", slug: "cv", kind: "page" })
    expect(docOutputPath("/docs", cv)).toBe("/docs/cv.md")
    const post = resolved(
      { stem: "x" },
      { root: "site", siteRelDir: "blog", slug: "bar", kind: "blog" },
    )
    expect(docOutputPath("/docs", post)).toBe("/docs/blog/bar.md")
  })
})

describe("dates (§13)", () => {
  it("parses multiple formats; throws on garbage", () => {
    expect(normalizeDate("2014-10-06")).toBe(new Date("2014-10-06").toISOString())
    expect(normalizeDate("2014-10-06T05:42:04.000Z")).toBe(
      new Date("2014-10-06T05:42:04.000Z").toISOString(),
    )
    expect(normalizeDate(new Date("2020-01-01"))).toBe(new Date("2020-01-01").toISOString())
    expect(normalizeDate(undefined)).toBeUndefined()
    expect(normalizeDate("")).toBeUndefined()
    expect(() => normalizeDate("not-a-date")).toThrow(/Unparseable/)
  })
  it("created = created || date; updated from updated; omitted when absent", () => {
    expect(computeDates({ date: "2014-10-06" }).created).toBe(new Date("2014-10-06").toISOString())
    expect(computeDates({ created: "2020-01-01", date: "2014-10-06" }).created).toBe(
      new Date("2020-01-01").toISOString(),
    )
    expect(computeDates({}).created).toBeUndefined()
    expect(computeDates({ updated: "2021-05-05" }).updated).toBe(
      new Date("2021-05-05").toISOString(),
    )
  })
})
