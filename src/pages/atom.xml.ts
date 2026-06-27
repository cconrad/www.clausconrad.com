import type { APIRoute } from "astro"
import { blogPosts, toStreamItem } from "../lib/content.ts"
import { atomFeed } from "../lib/feeds.ts"

// Blog Atom feed at the legacy path `/atom.xml` (§9.5) so subscribers don't break.
export const GET: APIRoute = async (context) => {
  const site = context.site?.toString() ?? "https://www.clausconrad.com"
  const items = (await blogPosts()).map(toStreamItem)
  const xml = atomFeed({ site, path: "/atom.xml", title: "Claus Conrad — Blog", items })
  return new Response(xml, { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } })
}
