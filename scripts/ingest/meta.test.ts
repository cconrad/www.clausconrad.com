import { describe, expect, it } from "vitest"
import { computeExcerpt, plainText, readingMinutes, wordCount } from "./meta.ts"

describe("plainText", () => {
  it("strips code, html, images; keeps link text", () => {
    const md =
      "# Title\n\nSome `code` and ```\nblock\n``` and <iframe></iframe> " +
      "[link](/x) ![img](/y.png)"
    const t = plainText(md)
    expect(t).toContain("link")
    expect(t).not.toContain("iframe")
    expect(t).not.toContain("block")
    expect(t).not.toContain("/y.png")
  })
})

describe("reading time (§9.3, 220 wpm)", () => {
  it("counts words", () => {
    expect(wordCount("one two three")).toBe(3)
    expect(wordCount("")).toBe(0)
  })
  it("rounds to whole minutes, min 1", () => {
    expect(readingMinutes(0)).toBe(1)
    expect(readingMinutes(220)).toBe(1)
    expect(readingMinutes(440)).toBe(2)
    expect(readingMinutes(330)).toBe(2) // 1.5 → 2
  })
})

describe("computeExcerpt (§9.6)", () => {
  it("prefers desc, then excerpt, then teaser", () => {
    expect(computeExcerpt({ desc: "D", excerptFm: "E", teaser: "T", body: "b" })).toBe("D")
    expect(computeExcerpt({ excerptFm: "E", teaser: "T", body: "b" })).toBe("E")
    expect(computeExcerpt({ teaser: "T", body: "b" })).toBe("T")
  })
  it("uses Excerpt Start/End markers", () => {
    expect(
      computeExcerpt({ body: "intro <!-- Excerpt Start -->the bit<!-- Excerpt End --> rest" }),
    ).toBe("the bit")
  })
  it("falls back to first plain-text paragraph, truncated", () => {
    const body = "First sentence here. " + "word ".repeat(80)
    const ex = computeExcerpt({ body, max: 50 })
    expect(ex.length).toBeLessThanOrEqual(53)
    expect(ex.endsWith("…")).toBe(true)
  })
  it("short body returned whole, no ellipsis", () => {
    expect(computeExcerpt({ body: "Just a short note." })).toBe("Just a short note.")
  })
})
