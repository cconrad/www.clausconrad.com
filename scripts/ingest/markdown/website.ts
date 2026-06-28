import type { ResolvedDoc } from "../types.ts"

/**
 * Inject the `website` "Link" block (§8.6) right after the title / before the
 * body. Rendered as an `<h2>` per A2 (Starlight already renders the page title
 * as the only `<h1>`). The `<url>` autolink flows through normal rendering.
 */
export function injectWebsiteLink(body: string, doc: ResolvedDoc): string {
  const website = doc.data.website
  if (typeof website !== "string" || website.trim() === "") return body
  const url = website.trim()
  return `## Link\n\n<${url}>\n\n${body.replace(/^\n+/, "")}`
}
