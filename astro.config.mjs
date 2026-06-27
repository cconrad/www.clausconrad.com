// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"
import cleanUrls from "./src/integrations/clean-urls.ts"

// https://astro.build/config
export default defineConfig({
  site: "https://www.clausconrad.com",
  output: "static",
  // D1: canonical URLs have no trailing slash and no `.html`.
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [
    starlight({
      title: "Claus Conrad",
      // Social links (§7). Starlight 0.41 takes an array of link objects.
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/cconrad" },
        {
          icon: "linkedin",
          label: "LinkedIn",
          href: "https://www.linkedin.com/in/clausconrad",
        },
        { icon: "mastodon", label: "Mastodon", href: "https://mstdn.social/@clausc" },
      ],
      // Top-level menu (§7). Notes subtree is generated in a later phase (§10.3);
      // blog category + standalone pages come online with the blog/site ingest.
      sidebar: [
        {
          label: "Blog",
          items: [
            { label: "Development", link: "/blog/category/howto/development" },
            {
              label: "System administration",
              link: "/blog/category/howto/system-administration",
            },
            { label: "Personal", link: "/blog/category/personal" },
          ],
        },
        { label: "Friends", link: "/links/friends" },
        { label: "Notes", link: "/notes" },
        { label: "CV", link: "/cv" },
      ],
      // Disable Starlight's own edit/last-updated chrome; dates come from ingest (§13).
      lastUpdated: false,
      pagination: false,
      // Component overrides: site-wide OG image + JSON-LD (§9.4) and a byline
      // with dates + reading time (§9.3, §13).
      components: {
        Head: "./src/components/Head.astro",
        PageTitle: "./src/components/PageTitle.astro",
        SiteTitle: "./src/components/SiteTitle.astro",
      },
      // Favicons generated from the sidebar photo (§7); referenced by known paths.
      head: [
        { tag: "link", attrs: { rel: "icon", href: "/favicon.ico", sizes: "any" } },
        {
          tag: "link",
          attrs: { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
        },
        {
          tag: "link",
          attrs: { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
        },
        {
          tag: "link",
          attrs: { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        },
        { tag: "link", attrs: { rel: "manifest", href: "/site.webmanifest" } },
      ],
    }),
    // Post-build: rewrite emitted URLs to the D1 canonical form (no `.html`).
    cleanUrls(),
  ],
})
