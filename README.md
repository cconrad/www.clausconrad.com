# www.clausconrad.com

The [clausconrad.com](https://www.clausconrad.com) frontend: an Astro 7 +
Starlight site that renders a blog and a collection of Obsidian notes.

No content lives in this repo. At build time the **ingest** step reads the
private `obsidian-personal` vault, gates pages by `published: true`, strips
frontmatter to an allowlist, transforms Obsidian Markdown (wikilinks, embeds,
assets, dead links, YouTube), and emits into Starlight's `docs` collection.

## Develop

```sh
npm install
OBSIDIAN_DIR=/path/to/obsidian-personal npm run ingest   # then `npm run dev`
```

`OBSIDIAN_DIR` defaults to the local vault checkout; set it to your copy.

## Scripts

| Script                                      | Purpose                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| `npm run ingest`                            | Read the vault → emit `src/content/docs`, `public/`, `src/data` |
| `npm run build`                             | `prebuild` (ingest + favicons) then `astro build`               |
| `npm run preview`                           | Serve the built `dist/`                                         |
| `npm test`                                  | Vitest unit tests (ingest pipeline)                             |
| `npm run check`                             | `tsc --noEmit` + Prettier                                       |
| `npm run migrate-blog-slugs -- <dir>`       | One-off: add `slug`/`published` to old blog posts (§6.0)        |
| `npm run migrate-redirects -- <_redirects>` | One-off: freeze legacy redirects (§11)                          |

## Deploy

GitHub Actions builds in CI and deploys the artifact to Cloudflare Pages via
Wrangler (so Cloudflare never reads the private vault). See
[.github/workflows](.github/workflows). The implementation spec lives in
`~/prds/clausconrad.com-step-2.md`.
