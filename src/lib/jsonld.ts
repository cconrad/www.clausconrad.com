// Per-page JSON-LD (§9.4), built ONLY from allowlisted frontmatter so nothing
// sensitive leaks into structured data.

const SAME_AS = [
  "https://github.com/cconrad",
  "https://www.linkedin.com/in/clausconrad",
  "https://mstdn.social/@clausc",
]

export interface JsonLdInput {
  kind?: "blog" | "note" | "page"
  pathname: string
  url: string
  site: string
  title: string
  description?: string
  created?: string
  updated?: string
}

export function buildJsonLd(i: JsonLdInput): object {
  const author = { "@type": "Person", name: "Claus Conrad", url: i.site + "/" }

  // Home page → Person + WebSite (§9.4).
  if (i.pathname === "/" || i.pathname === "/index.html") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Person", name: "Claus Conrad", url: i.site + "/", sameAs: SAME_AS },
        { "@type": "WebSite", name: "Claus Conrad", url: i.site + "/" },
      ],
    }
  }

  // Blog post / note → BlogPosting / Article.
  if (i.kind === "blog" || i.kind === "note") {
    const obj: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": i.kind === "blog" ? "BlogPosting" : "Article",
      headline: i.title,
      url: i.url,
      author,
      publisher: author,
      mainEntityOfPage: i.url,
    }
    if (i.description) obj.description = i.description
    if (i.created) obj.datePublished = i.created
    if (i.updated) obj.dateModified = i.updated
    return obj
  }

  // Standalone pages + list/category pages → WebPage.
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: i.title,
    url: i.url,
  }
  if (i.description) obj.description = i.description
  return obj
}
