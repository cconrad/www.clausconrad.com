import { defineCollection } from "astro:content"
import { docsLoader } from "@astrojs/starlight/loaders"
import { docsSchema } from "@astrojs/starlight/schema"
import { z } from "astro:content"

// All rendered pages (notes, blog posts, standalone pages) live in Starlight's
// `docs` collection so they share chrome/TOC/sidebar (§7). The ingest step emits
// Markdown into src/content/docs/** with normalized Starlight frontmatter plus a
// small `custom` block carrying ingest-derived data (dates, backlinks, etc.).
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // Ingest-derived, allowlist-safe metadata (§3.4, §13).
        created: z.string().optional(),
        updated: z.string().optional(),
        website: z.string().optional(),
        // Page classification (§12): 'blog' | 'note' | 'page'.
        kind: z.enum(["blog", "note", "page"]).optional(),
        // Original tags (blog category mapping + note tags, §9.2).
        tags: z.array(z.string()).optional(),
        // Short description used for meta/OG (§9.4).
        desc: z.string().optional(),
      }),
    }),
  }),
}
