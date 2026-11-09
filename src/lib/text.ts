import type { Block, Run } from './types'

export const runsText = (runs: Run[] | undefined): string => (runs ?? []).map((r) => r.t).join('')

/** Plain text of a block (used for alignment, search and reading-time estimates). */
export function blockText(b: Block): string {
  switch (b.t) {
    case 'h':
      return `${b.num ?? ''} ${b.text}`.trim()
    case 'p':
    case 'ref':
    case 'note':
    case 'li':
      return runsText(b.runs)
    case 'code':
      return b.text
    case 'fig':
      return [runsText(b.caption), b.code ?? '', (b.table ?? []).flat(2).map((r) => r.t).join(' ')].join(' ')
    case 'aside':
      return [b.title, ...b.blocks.map(blockText)].join(' ')
  }
}

const CJK = /[㐀-鿿]/g

/** Number of "reading units": CJK characters count individually, latin text by words. */
export function readingUnits(s: string): { cjk: number; words: number } {
  const cjk = (s.match(CJK) ?? []).length
  const words = (s.replace(CJK, ' ').match(/[A-Za-z0-9]+/g) ?? []).length
  return { cjk, words }
}

/** Estimated minutes to read: ~230 English words/min, ~400 Chinese chars/min. */
export function readingMinutes(blocks: Block[]): number {
  let cjk = 0
  let words = 0
  for (const b of blocks) {
    const u = readingUnits(blockText(b))
    cjk += u.cjk
    words += u.words
  }
  return Math.max(1, Math.round(words / 230 + cjk / 400))
}

/** Latin "anchor" tokens: technical terms, identifiers and numbers that survive translation. */
export function anchorTokens(s: string): string[] {
  const out: string[] = []
  for (const m of s.matchAll(/\[[A-Z][A-Za-z+]*\d{2}[a-z]?\]|[A-Za-z_][A-Za-z0-9_]*(?:\(\))?|\d+(?:\.\d+)?/g)) {
    const tok = m[0].toLowerCase()
    if (tok.length < 2 && !/\d/.test(tok)) continue
    out.push(tok)
  }
  return out
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9㐀-鿿]+/g, '-')
    .replace(/^-|-$/g, '')
}

const ACRONYMS = /\b(cpus?|oses|os|i\/o|tlbs?|apis?|pcs?|ip|pids?|lru|mlfq|rr|sjf|stcf|fifo|vms?|mmu|ptes?|vpns?|pfns?|unix|ram|ssds?|nfs|raid|cfs|vax|xv6|asid|lde)\b/gi
/**
 * The book sets aside titles in small caps (“TIP: USE TIME SHARING”). We recover a natural casing
 * so CSS `font-variant: small-caps` can reproduce the typography without shouting.
 */
export function smallCapsTitle(s: string): string {
  if (/[a-z]/.test(s)) return s
  return s
    .toLowerCase()
    .replace(/(^|[\s(“"—-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
    .replace(ACRONYMS, (m) => {
      const lower = m.toLowerCase()
      if (lower === 'oses') return 'OSes'
      const plural = lower.endsWith('s') && !['os', 'nfs', 'cfs'].includes(lower)
      return plural ? m.slice(0, -1).toUpperCase() + 's' : m.toUpperCase()
    })
}
