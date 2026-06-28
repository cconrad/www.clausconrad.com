import { describe, expect, it } from "vitest"
import { resolveDates } from "./gitDates.ts"

describe("resolveDates (§13 precedence)", () => {
  it("frontmatter created wins over git", () => {
    expect(resolveDates({ created: "2020-01-01" }, { created: "2018-05-05" }).created).toBe(
      "2020-01-01",
    )
  })
  it("falls back to git first-commit for created", () => {
    expect(resolveDates({}, { created: "2018-05-05" }).created).toBe("2018-05-05")
  })
  it("frontmatter updated wins; else git last-commit", () => {
    expect(resolveDates({ updated: "2021-01-01" }, { updated: "2022-02-02" }).updated).toBe(
      "2021-01-01",
    )
    expect(resolveDates({}, { updated: "2022-02-02" }).updated).toBe("2022-02-02")
  })
  it("omits when neither frontmatter nor git has a date", () => {
    expect(resolveDates({}, undefined)).toEqual({ created: undefined, updated: undefined })
  })
})
