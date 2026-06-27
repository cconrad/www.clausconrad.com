import type { ResolvedDoc } from "../types.ts"
import { maskCode, unmaskCode } from "./mask.ts"
import { injectWebsiteLink } from "./website.ts"
import { expandEmbeds, type EmbedContext } from "./embeds.ts"
import { transformWikilinks } from "./wikilinks.ts"
import { transformYouTube } from "./youtube.ts"
import { transformAssetEmbeds, transformMarkdownImageAssets, type AssetResolver } from "./assets.ts"
import type { LinkIndex } from "./linkIndex.ts"

export interface TransformContext {
  index: LinkIndex
  assets: AssetResolver
  warnings: string[]
}

/**
 * Run the full Obsidian → Markdown transform for one published doc (§8):
 *   website Link block → expand embeds → YouTube → assets → wikilinks/dead-links.
 * Code regions are masked around each pass so none of these touch code.
 */
export function transformDoc(doc: ResolvedDoc, ctx: TransformContext): string {
  let body = injectWebsiteLink(doc.body, doc)

  // Pass 1: expand note embeds (recursive, cycle-guarded).
  {
    const { masked, tokens } = maskCode(body)
    const embedCtx: EmbedContext = { index: ctx.index, warnings: ctx.warnings }
    body = unmaskCode(expandEmbeds(masked, embedCtx, [doc.slug]), tokens)
  }

  // Pass 2: YouTube embeds, asset rewrites, wikilinks + dead links.
  {
    const { masked, tokens } = maskCode(body)
    let m = masked
    m = transformYouTube(m)
    m = transformAssetEmbeds(m, ctx.assets)
    m = transformMarkdownImageAssets(m, ctx.assets)
    m = transformWikilinks(m, ctx.index)
    body = unmaskCode(m, tokens)
  }

  return body
}
