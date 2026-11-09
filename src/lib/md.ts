import { inline } from './article'
import type { Run } from './types'

/** Inline markup for our own writing (field-note cards, threads): the article dialect, see article.ts. */
export function inlineRuns(s: string): Run[] {
  return inline(s)
}
