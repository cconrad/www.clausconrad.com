import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import type { ResolvedDoc } from "../types.ts"
import { maskCode, unmaskCode } from "./mask.ts"
import { buildLinkIndex } from "./linkIndex.ts"
import { transformWikilinks } from "./wikilinks.ts"
import { transformYouTube } from "./youtube.ts"
import { injectWebsiteLink } from "./website.ts"
import { expandEmbeds, extractSection, type EmbedContext } from "./embeds.ts"
import { buildAssetResolver, transformAssetEmbeds, transformMarkdownImageAssets } from "./assets.ts"

function doc(stem: string, p: Partial<ResolvedDoc> = {}): ResolvedDoc {
  const slug = p.slug ?? stem.toLowerCase()
  return {
    absPath: `/v/${stem}.md`,
    repoRelPath: `${stem}.md`,
    root: "notes",
    siteRelDir: "",
    stem,
    data: p.data ?? {},
    body: p.body ?? "",
    slug,
    url: p.url ?? `/notes/${slug}`,
    kind: p.kind ?? "note",
    hadSlug: true,
  }
}

const index = buildLinkIndex([
  doc("Vim", { slug: "vim" }),
  doc("Regular Expressions", { slug: "regex" }),
  doc("CV", { slug: "cv", url: "/cv", kind: "page" }),
])

describe("wikilinks (§8.1) + dead links (§8.4)", () => {
  it("plain link", () => {
    expect(transformWikilinks("[[Vim]]", index)).toBe("[Vim](/notes/vim)")
  })
  it("titled link uses the title label", () => {
    expect(transformWikilinks("[[Vim|the editor]]", index)).toBe("[the editor](/notes/vim)")
  })
  it("heading anchor", () => {
    expect(transformWikilinks("[[Vim#Key Bindings]]", index)).toBe("[Vim](/notes/vim#key-bindings)")
  })
  it(".md suffix + case-insensitive", () => {
    expect(transformWikilinks("[[vIm.MD]]", index)).toBe("[vIm.MD](/notes/vim)")
  })
  it("resolves to a site page URL", () => {
    expect(transformWikilinks("[[CV]]", index)).toBe("[CV](/cv)")
  })
  it("unpublished/unknown → dead-link span, no <a>", () => {
    const out = transformWikilinks("[[Secret Note|click]]", index)
    expect(out).toBe('<span class="dead-link">click</span>')
    expect(out).not.toContain("href")
  })
  it("does not touch ![[embeds]]", () => {
    expect(transformWikilinks("![[Vim]]", index)).toBe("![[Vim]]")
  })
  it("same-page heading link [[#Heading]]", () => {
    expect(transformWikilinks("[[#Key Bindings]]", index)).toBe("[Key Bindings](#key-bindings)")
  })
})

describe("code masking", () => {
  it("wikilinks inside code are NOT transformed", () => {
    const input = "see `[[Vim]]` and\n\n```\n[[Vim]]\n```\n"
    const { masked, tokens } = maskCode(input)
    const out = unmaskCode(transformWikilinks(masked, index), tokens)
    expect(out).toContain("`[[Vim]]`")
    expect(out).toContain("```\n[[Vim]]\n```")
  })
  it("wikilinks outside code still transform alongside code", () => {
    const input = "use `code` then [[Vim]]"
    const { masked, tokens } = maskCode(input)
    const out = unmaskCode(transformWikilinks(masked, index), tokens)
    expect(out).toBe("use `code` then [Vim](/notes/vim)")
  })
})

describe("embeds (§8.2)", () => {
  const target = doc("Snippet", { slug: "snippet", body: "Reusable **content** with [[Vim]]." })
  const sectioned = doc("Guide", {
    slug: "guide",
    body: "# Intro\n\nhi\n\n## Setup\n\nstep one\n\n## Next\n\nlater",
  })
  const blocky = doc("Facts", { slug: "facts", body: "A fact line. ^fact1\n\nother" })
  const eidx = buildLinkIndex([...[target, sectioned, blocky], doc("Vim", { slug: "vim" })])
  const ctx = (): EmbedContext => ({ index: eidx, warnings: [] })

  it("published note inlines its body (raw; links resolved later)", () => {
    expect(expandEmbeds("![[Snippet]]", ctx(), ["host"])).toBe("Reusable **content** with [[Vim]].")
  })
  it("unpublished/unknown embed renders nothing", () => {
    expect(expandEmbeds("before ![[Unknown]] after", ctx(), ["host"])).toBe("before  after")
  })
  it("section embed extracts the heading block", () => {
    expect(expandEmbeds("![[Guide#Setup]]", ctx(), ["host"])).toBe("## Setup\n\nstep one")
  })
  it("block embed extracts the ^id line content", () => {
    expect(expandEmbeds("![[Facts#^fact1]]", ctx(), ["host"])).toBe("A fact line.")
  })
  it("cycle guard: a note embedding itself yields nothing + warns", () => {
    const self = doc("Loop", { slug: "loop", body: "x ![[Loop]] y" })
    const idx = buildLinkIndex([self])
    const c: EmbedContext = { index: idx, warnings: [] }
    const out = expandEmbeds(self.body, c, ["loop"])
    expect(out).toBe("x  y")
    expect(c.warnings.length).toBe(1)
  })
  it(".excalidraw embed is skipped", () => {
    expect(expandEmbeds("![[Diagram.excalidraw]]", ctx(), ["host"])).toBe("")
  })
  it("dotted note-name embed (unpublished) → nothing, not treated as asset", () => {
    expect(expandEmbeds("![[some.reading.notes]] x", ctx(), ["host"])).toBe(" x")
  })
})

describe("extractSection", () => {
  it("last heading runs to end of file", () => {
    expect(extractSection("# A\n\naaa\n\n# B\n\nbbb", "B")).toBe("# B\n\nbbb")
  })
  it("missing section → empty", () => {
    expect(extractSection("# A\n\naaa", "Nope")).toBe("")
  })
})

describe("YouTube (§8.5)", () => {
  it("image-link → nocookie iframe", () => {
    const out = transformYouTube("![Talk](https://www.youtube.com/watch?v=dQw4w9WgXcQ)")
    expect(out).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ")
    expect(out).toContain("<iframe")
  })
  it("youtu.be short link", () => {
    expect(transformYouTube("![](https://youtu.be/abcdef12345)")).toContain("/embed/abcdef12345")
  })
  it("plain (non-image) YouTube link is unchanged", () => {
    const input = "[watch](https://www.youtube.com/watch?v=dQw4w9WgXcQ)"
    expect(transformYouTube(input)).toBe(input)
  })
})

describe("website Link block (§8.6)", () => {
  it("injects ## Link at the top with the autolink", () => {
    const out = injectWebsiteLink("Body text", doc("X", { data: { website: "https://x.dev" } }))
    expect(out).toBe("## Link\n\n<https://x.dev>\n\nBody text")
  })
  it("no website → unchanged", () => {
    expect(injectWebsiteLink("Body", doc("X"))).toBe("Body")
  })
})

describe("assets (§8.3)", () => {
  const dir = mkdtempSync(join(tmpdir(), "assets-"))
  mkdirSync(join(dir, "images"), { recursive: true })
  writeFileSync(join(dir, "images", "pic.png"), "x")
  writeFileSync(join(dir, "deep.png"), "y")
  mkdirSync(join(dir, "sub"), { recursive: true })
  writeFileSync(join(dir, "sub", "nested.png"), "z")

  it("markdown image: assets/ path → /assets/notes/ url; records ref", () => {
    const r = buildAssetResolver(dir)
    const out = transformMarkdownImageAssets("![alt](assets/images/pic.png)", r)
    expect(out).toBe("![alt](/assets/notes/images/pic.png)")
    expect(r.referenced.has("images/pic.png")).toBe(true)
  })
  it("embed: exact path resolution", () => {
    const r = buildAssetResolver(dir)
    expect(transformAssetEmbeds("![[deep.png]]", r)).toBe("![deep.png](/assets/notes/deep.png)")
  })
  it("embed: recursive filename match", () => {
    const r = buildAssetResolver(dir)
    expect(transformAssetEmbeds("![[nested.png]]", r)).toBe(
      "![nested.png](/assets/notes/sub/nested.png)",
    )
  })
  it("only referenced assets are recorded", () => {
    const r = buildAssetResolver(dir)
    transformAssetEmbeds("![[deep.png]]", r)
    expect([...r.referenced.keys()]).toEqual(["deep.png"])
  })
  it("unresolved asset embed left as-is", () => {
    const r = buildAssetResolver(dir)
    expect(transformAssetEmbeds("![[missing.png]]", r)).toBe("![[missing.png]]")
  })
})
