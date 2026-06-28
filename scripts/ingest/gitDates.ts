import { execFileSync } from "node:child_process"

export interface GitDates {
  /** First-commit author date (ISO) — git fallback for Created (§13). */
  created?: string
  /** Last-commit author date (ISO) — git fallback for Updated (§13). */
  updated?: string
}

/**
 * One `git log` pass over the source repo → first/last author date per file
 * path (relative to the repo). Used as the Created/Updated fallback when
 * frontmatter has no date (§13); frontmatter always wins. CI must check out full
 * history (`fetch-depth: 0`). Returns an empty map if the dir isn't a git repo.
 */
export function loadGitDates(repoDir: string): Map<string, GitDates> {
  const map = new Map<string, GitDates>()
  let out: string
  try {
    out = execFileSync(
      "git",
      ["-C", repoDir, "log", "--no-renames", "--name-only", "--format=\x01%aI"],
      { encoding: "utf8", maxBuffer: 1 << 30 },
    )
  } catch {
    return map // not a git repo / git unavailable → frontmatter-only dates
  }

  let date = ""
  for (const line of out.split("\n")) {
    if (line.startsWith("\x01")) {
      date = line.slice(1).trim()
      continue
    }
    const file = line.trim()
    if (!file) continue
    const entry = map.get(file) ?? {}
    // Commits stream newest → oldest: first sighting = last modified;
    // the oldest sighting (last overwrite) = created.
    if (!entry.updated) entry.updated = date
    entry.created = date
    map.set(file, entry)
  }
  return map
}

/**
 * Resolve final Created/Updated for a doc (§13): frontmatter `created`/`date`
 * (then git first-commit) for Created; frontmatter `updated` (then git
 * last-commit) for Updated. `fm*` are the already-normalized frontmatter values.
 */
export function resolveDates(
  fm: { created?: string; updated?: string },
  git: GitDates | undefined,
): GitDates {
  return {
    created: fm.created ?? git?.created,
    updated: fm.updated ?? git?.updated,
  }
}
