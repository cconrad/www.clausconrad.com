import { describe, expect, it } from "vitest"
import { normalizeTarget, transformRedirects } from "./migrate-redirects.ts"

describe("normalizeTarget (D1 no-slash)", () => {
  it("strips trailing slash from internal paths", () => {
    expect(normalizeTarget("/blog/foo/")).toBe("/blog/foo")
    expect(normalizeTarget("/cv/")).toBe("/cv")
  })
  it("keeps root slash", () => {
    expect(normalizeTarget("/")).toBe("/")
  })
  it("leaves external + splat destinations untouched", () => {
    expect(normalizeTarget("https://www.clausconrad.com/:splat")).toBe(
      "https://www.clausconrad.com/:splat",
    )
  })
  it("preserves fragments/queries", () => {
    expect(normalizeTarget("/page2/#frag")).toBe("/page2#frag")
  })
})

describe("transformRedirects (§11)", () => {
  const old = [
    "# comment",
    "",
    "http://cconrad.netlify.app/* https://www.clausconrad.com/:splat 301!",
    "/10-kompisar.html /10-kompisar/ 301",
    "/blog/foo.html /blog/foo/ 301",
    "/ p=148 /blog/foo/ 301",
    "/page5/index.html /page5/ 301!",
  ].join("\n")

  const { paths, wordpress } = transformRedirects(old)
  const flat = paths.map((p) => `${p.from} ${p.to} ${p.status}`)

  it("normalizes .html→clean path rules", () => {
    expect(flat).toContain("/10-kompisar.html /10-kompisar 301")
    expect(flat).toContain("/blog/foo.html /blog/foo 301")
  })
  it("keeps apex/netlify splat rule with forced flag", () => {
    expect(flat).toContain("http://cconrad.netlify.app/* https://www.clausconrad.com/:splat 301!")
  })
  it("routes WordPress ?p=NNN into the wordpress map, not paths", () => {
    expect(wordpress["148"]).toBe("/blog/foo")
    expect(flat.some((l) => l.includes("p=148"))).toBe(false)
  })
  it("drops old /pageN/index.html rules (regenerated at build)", () => {
    expect(flat.some((l) => l.includes("/page5/index.html"))).toBe(false)
  })
})
