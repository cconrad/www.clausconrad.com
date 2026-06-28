import type { APIRoute } from "astro"
import { noteDocs, toStreamItem } from "../../lib/content.ts"
import { atomFeed } from "../../lib/feeds.ts"

// Notes Atom feed (new, additive) at `/notes/atom.xml` (§9.5). Notes only.
export const GET: APIRoute = async (context) => {
  const site = context.site?.toString() ?? "https://www.clausconrad.com"
  const items = (await noteDocs()).map(toStreamItem)
  const xml = atomFeed({ site, path: "/notes/atom.xml", title: "Claus Conrad — Notes", items })
  return new Response(xml, { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } })
}
