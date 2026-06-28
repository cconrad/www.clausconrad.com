# www.clausconrad.com

The [clausconrad.com](https://www.clausconrad.com) frontend: an Astro 7 +
Starlight site that renders a blog and a collection of Obsidian notes.

No content lives in this repo. At build time the **ingest** step reads the
private `obsidian-personal` vault, gates pages by `published: true`, strips
frontmatter to an allowlist, transforms Obsidian Markdown (wikilinks, embeds,
assets, dead links, YouTube), and emits into Starlight's `docs` collection.

## Local preview

A local build reads the vault straight from disk via `OBSIDIAN_DIR` (CI just
points it at its checkout). It defaults to `~/Obsidian/personal`, so a plain
build works locally; set `OBSIDIAN_DIR` to use a different copy.

```sh
npm install
```

**Visual preview** (theme, pages, graphs):

```sh
npm run build       # prebuild = ingest (reads the vault) + favicons, then astro build
npm run preview     # serves dist/ at http://localhost:4321
# or against another vault:
OBSIDIAN_DIR=/path/to/obsidian-personal npm run build && npm run preview
```

**Cloudflare-accurate preview** — `astro preview` serves the static pages but
does _not_ apply `public/_redirects` or `functions/`. To exercise the legacy
redirects and the WordPress `?p=NNN` Pages Function, use Cloudflare's emulator:

```sh
npm run build
npx wrangler pages dev dist
```

**Fast iteration** while editing components/styles (HMR):

```sh
npm run ingest      # once, to populate src/content/docs from the vault
npm run dev         # http://localhost:4321
```

Re-run `ingest` after vault edits. `dev` does not apply the post-build
clean-URL rewrite or redirects — use `build` + `preview`/`wrangler` for an
accurate result.

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
