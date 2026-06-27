// Code-region masking so the Obsidian transforms (wikilinks, embeds, assets,
// YouTube) never touch `[[...]]`/`![[...]]`/links inside fenced or inline code.
// filter_notes.py rewrote inside code blocks by mistake; masking fixes that.

// ASCII sentinel that no Markdown construct or transform regex will produce or
// match (real content containing `@@MASK<n>@@` is effectively impossible).
const TOKEN = (i: number) => `@@MASK${i}@@`
const TOKEN_RE = /@@MASK(\d+)@@/g

// Single combined matcher scanned ONCE left-to-right: a fenced block OR an inline
// code span, whichever starts first. A single pass is essential — masking fenced
// and inline in two passes lets an inline span swallow a fenced placeholder,
// producing nested tokens that a single unmask can't fully restore.
// Inline alternative forbids newlines in the span: a stray/escaped backtick
// (e.g. `\`` in a heading) must not open a span that eats across lines and
// swallows following prose. Genuine multi-line inline code is vanishingly rare.
const CODE_RE =
  /(?:(?:^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*\1[ \t]*(?=\n|$))|(?:(`+)(?:[^`\n]|(?!\2)`)*\2)/g

export interface Masked {
  masked: string
  tokens: string[]
}

/** Replace fenced + inline code with opaque placeholders, in one pass. */
export function maskCode(input: string): Masked {
  const tokens: string[] = []
  const masked = input.replace(CODE_RE, (m) => {
    const t = TOKEN(tokens.length)
    tokens.push(m)
    return t
  })
  return { masked, tokens }
}

/** Restore code regions previously masked by {@link maskCode}. */
export function unmaskCode(masked: string, tokens: string[]): string {
  let out = masked
  let prev: string
  do {
    prev = out
    out = out.replace(TOKEN_RE, (_m, i: string) => tokens[Number(i)] ?? "")
  } while (out !== prev)
  return out
}
