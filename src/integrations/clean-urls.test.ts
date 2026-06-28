import { describe, expect, it } from "vitest"
import { rewrite } from "./clean-urls.ts"

describe("rewrite", () => {
  const origin = "https://www.clausconrad.com"

  it("cleans same-origin absolute URLs", () => {
    expect(
      rewrite('<link rel="canonical" href="https://www.clausconrad.com/cv.html">', origin),
    ).toBe('<link rel="canonical" href="https://www.clausconrad.com/cv">')
  })

  it("does not treat lookalike hosts as same-origin", () => {
    const html =
      '<a href="https://wwwXclausconrad.com/cv.html">x</a>' +
      '<a href="https://www.clausconrad.com.evil/cv.html">evil</a>'

    expect(rewrite(html, origin)).toBe(html)
  })
})
