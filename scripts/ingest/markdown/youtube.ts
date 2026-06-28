// YouTube embeds (§8.5). The Obsidian convention here is an image-link:
// `![Title](https://www.youtube.com/watch?v=ID)` or `![](https://youtu.be/ID)`.
// Detect those → responsive privacy-friendly (youtube-nocookie) iframe.
// Plain (non-image) YouTube links are left as normal links.

const YT_IMAGE =
  /!\[([^\]]*)\]\(\s*(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?(?:[^)\s]*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})[^)\s]*)\s*\)/g

function iframe(id: string, title: string): string {
  const label = title.trim() ? ` title="${title.replace(/"/g, "&quot;")}"` : ""
  return (
    `<div class="youtube-embed">` +
    `<iframe src="https://www.youtube-nocookie.com/embed/${id}"${label} ` +
    `loading="lazy" frameborder="0" ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
    `allowfullscreen></iframe></div>`
  )
}

/** Operates on code-masked text. */
export function transformYouTube(input: string): string {
  // Surround the emitted block-level <div> with blank lines: an HTML block that
  // isn't followed by a blank line swallows the subsequent Markdown (e.g. the
  // text after the video), leaving it unparsed (§10).
  return input.replace(
    YT_IMAGE,
    (_full, title: string, _url: string, id: string) => `\n\n${iframe(id, title ?? "")}\n\n`,
  )
}
