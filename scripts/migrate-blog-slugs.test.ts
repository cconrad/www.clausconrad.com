import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parseFrontmatter } from "./ingest/frontmatter.ts"
import { blogSlug, deDate, migrateContent } from "./migrate-blog-slugs.ts"

describe("blogSlug (Eleventy slugify parity)", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(blogSlug("Positive passwords")).toBe("positive-passwords")
  })
  it("maps apostrophes, dots, slashes, '+' to single hyphens", () => {
    expect(blogSlug("What’s new in Telligent Community 5.0?")).toBe(
      "what-s-new-in-telligent-community-5-0",
    )
    expect(blogSlug("Improve your iPhone 3G's battery life")).toBe(
      "improve-your-iphone-3g-s-battery-life",
    )
    expect(blogSlug("CoffeeScript support for JetBrains PhpStorm/WebStorm/PyCharm")).toBe(
      "coffeescript-support-for-jetbrains-phpstorm-webstorm-pycharm",
    )
    expect(blogSlug("Meta description do's and don'ts")).toBe("meta-description-do-s-and-don-ts")
    expect(blogSlug("Personalize your Google+ URL")).toBe("personalize-your-google-url")
  })
  it("trims leading/trailing separators from punctuation", () => {
    expect(blogSlug('"Try this search on Google" for startpage.com')).toBe(
      "try-this-search-on-google-for-startpage-com",
    )
  })
})

describe("deDate", () => {
  it("strips the date prefix", () => {
    expect(deDate("2014-10-06-positive-passwords")).toBe("positive-passwords")
  })
})

describe("migrateContent", () => {
  const post = (fm: string, body = "Body.") => `---\n${fm}\n---\n${body}`

  it("adds slug + leaves existing published:true", () => {
    const r = migrateContent(post("title: Positive passwords\npublished: true"), "2014-10-06-x")
    expect(r.changed).toBe(true)
    expect(r.addedSlug).toBe(true)
    expect(r.addedPublished).toBe(false)
    const { data } = parseFrontmatter(r.content)
    expect(data.slug).toBe("positive-passwords")
    expect(data.published).toBe(true)
  })

  it("adds published:true when no published key exists", () => {
    const r = migrateContent(post("title: Hello World"), "f")
    expect(r.addedPublished).toBe(true)
    const { data } = parseFrontmatter(r.content)
    expect(data.published).toBe(true)
    expect(data.slug).toBe("hello-world")
  })

  it("NEVER overwrites an existing slug (D2)", () => {
    const r = migrateContent(post("title: Hello World\nslug: custom-slug\npublished: true"), "f")
    expect(r.changed).toBe(false)
    expect(r.addedSlug).toBe(false)
    const { data } = parseFrontmatter(r.content)
    expect(data.slug).toBe("custom-slug")
  })

  it("is idempotent (second run is a no-op)", () => {
    const once = migrateContent(post("title: Hello World"), "f")
    const twice = migrateContent(once.content, "f")
    expect(twice.changed).toBe(false)
    expect(twice.content).toBe(once.content)
  })

  it("leaves an existing published:false untouched (no draft flipping)", () => {
    const r = migrateContent(post("title: Draft\npublished: false"), "f")
    const { data } = parseFrontmatter(r.content)
    expect(data.published).toBe(false)
    expect(r.addedPublished).toBe(false)
  })

  it("preserves the body and other frontmatter", () => {
    const r = migrateContent(post("title: T\ndate: 2014-10-06\ntags:\n  - x\npublished: true"), "f")
    expect(r.content).toContain("date: 2014-10-06")
    expect(r.content).toContain("tags:")
    expect(r.content.endsWith("Body.")).toBe(true)
  })

  it("creates frontmatter when none exists", () => {
    const r = migrateContent("Just body, no frontmatter.", "2014-10-06-some-post")
    expect(r.content.startsWith("---\n")).toBe(true)
    const { data } = parseFrontmatter(r.content)
    expect(data.published).toBe(true)
    expect(data.slug).toBe("some-post")
  })
})

// Parity assertion against the live _site/blog oracle (§16.1). Skipped when the
// local reference checkouts are absent (e.g. CI).
const BLOG_DIR = "/Users/claus/Sites/cconrad.github.io/content/blog"
const SITE_BLOG = "/Users/claus/Sites/clausconrad-com-v2/.sources/cconrad.github.io/_site/blog"

describe.skipIf(!existsSync(BLOG_DIR) || !existsSync(SITE_BLOG))(
  "parity vs _site/blog oracle",
  () => {
    it("every computed slug exists in _site/blog", () => {
      const siteSlugs = new Set(
        readdirSync(SITE_BLOG, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name),
      )
      const mismatches: string[] = []
      for (const f of readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"))) {
        const { data } = parseFrontmatter(readFileSync(join(BLOG_DIR, f), "utf8"))
        const title = typeof data.title === "string" ? data.title : ""
        if (!title) continue
        const slug = blogSlug(title)
        if (!siteSlugs.has(slug)) mismatches.push(`${f} → ${slug}`)
      }
      expect(mismatches).toEqual([])
    })
  },
)
