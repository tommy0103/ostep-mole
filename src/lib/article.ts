import type { Run } from './types'

/**
 * Long-form articles behind the field notes ("the full story"), written by us in both languages.
 *
 * Source: `src/content/articles/<id>.<en|zh>.md`, a small Markdown dialect (see docs/articles.md):
 *   front matter     ---\ndeck: one-line standfirst\n---
 *   ## / ###         headings
 *   paragraphs, - / 1. lists, > quotes, ``` code fences, | tables |, --- rules
 *   ::lab Name {"prop": 1}     embed an interactive lab from the registry
 *   ::chapter slug             link card to a book chapter
 *   ::scene state              from here on the article's scene (its running figure) shows this state
 *   :::fold Title ... :::      a fold: collapsed deeper material (may nest)
 *   :::aside Title ... :::     a boxed side remark
 * Inline: `code`, **bold**, *italic*, [text](url), ^sup^, ~sub~, [[term-id|text]] (a glossary term).
 *
 * The English and Chinese files of one article share the same block skeleton, so parallel view can
 * pair them block by block (enforced by tests/articles.test.ts).
 */
export type ABlock =
  | { t: 'h'; level: 2 | 3; runs: Run[]; id: string }
  | { t: 'p'; runs: Run[] }
  | { t: 'ul' | 'ol'; items: Run[][] }
  | { t: 'code'; lang: string; text: string }
  | { t: 'quote'; runs: Run[] }
  | { t: 'table'; head: Run[][]; rows: Run[][][] }
  | { t: 'hr' }
  | { t: 'lab'; name: string; props?: Record<string, unknown> }
  | { t: 'chapter'; slug: string }
  | { t: 'scene'; state: string }
  | { t: 'fold' | 'aside'; title: Run[]; blocks: ABlock[] }

export interface Article {
  deck: string
  title?: string
  blocks: ABlock[]
}

const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\*([^*\s][^*]*?)\*|\[\[([\w-]+)\|((?:`[^`]*`|[^\]])+)\]\]|\[([^\]]+)\]\(([^)\s]+)\)|\^([^^\s][^^]*?)\^|~([^~\s][^~]*?)~/g

/** Inline markup to runs. Styles do not nest, except inside link and term text. */
export function inline(s: string): Run[] {
  const out: Run[] = []
  let last = 0
  for (const m of s.matchAll(INLINE)) {
    if (m.index! > last) out.push({ t: s.slice(last, m.index), s: '' })
    if (m[1] !== undefined) out.push({ t: m[1], s: 'c' })
    // bold and italic may contain code (or a link); the inner style wins
    else if (m[2] !== undefined) out.push(...inline(m[2]).map((r) => (r.s ? r : { ...r, s: 'b' as const })))
    else if (m[3] !== undefined) out.push(...inline(m[3]).map((r) => (r.s ? r : { ...r, s: 'i' as const })))
    // a term's text may carry markup too: [[seccomp|`seccomp`]]
    else if (m[4] !== undefined) out.push(...inline(m[5]).map((r) => ({ ...r, term: m[4] })))
    // link text may carry its own markup: [*Title*](url), [`fn`](url)
    else if (m[6] !== undefined) out.push(...inline(m[6]).map((r) => ({ ...r, href: m[7] })))
    else if (m[8] !== undefined) out.push({ t: m[8], s: 'sup' })
    else out.push({ t: m[9], s: 'sub' })
    last = m.index! + m[0].length
  }
  if (last < s.length) out.push({ t: s.slice(last), s: '' })
  return out
}

export const plain = (runs: Run[]) => runs.map((r) => r.t).join('')

/** Heading anchor: latin words and CJK characters survive, everything else becomes a dash. */
export const headingId = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9㐀-鿿]+/g, '-')
    .replace(/^-|-$/g, '')

function frontMatter(src: string): { meta: Record<string, string>; body: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return { meta: {}, body: src }
  const meta: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv) meta[kv[1]] = kv[2].trim()
  }
  return { meta, body: src.slice(m[0].length) }
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
const cells = (l: string) =>
  l
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/\|(?![^[\]]*\]\])/) // the bar inside a [[term|words]] mark does not end a cell
    .map((c) => inline(c.trim()))

export function parseBlocks(lines: string[]): ABlock[] {
  const out: ABlock[] = []
  let i = 0
  const para: string[] = []
  const endPara = () => {
    if (para.length) out.push({ t: 'p', runs: inline(para.join(' ')) })
    para.length = 0
  }
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) {
      endPara()
      i++
      continue
    }
    // ``` code fence
    const fence = trimmed.match(/^```(\S*)/)
    if (fence) {
      endPara()
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++])
      i++
      out.push({ t: 'code', lang: fence[1], text: body.join('\n') })
      continue
    }
    // :::fold / :::aside containers (nesting by counting openers)
    const box = trimmed.match(/^:::(fold|aside)\s*(.*)$/)
    if (box) {
      endPara()
      const body: string[] = []
      let depth = 1
      i++
      while (i < lines.length) {
        const l = lines[i].trim()
        if (/^:::(fold|aside)\b/.test(l)) depth++
        else if (l === ':::' && --depth === 0) break
        body.push(lines[i++])
      }
      i++
      out.push({ t: box[1] as 'fold' | 'aside', title: inline(box[2]), blocks: parseBlocks(body) })
      continue
    }
    const lab = trimmed.match(/^::lab\s+(\w+)\s*(\{.*\})?\s*$/)
    if (lab) {
      endPara()
      out.push(lab[2] ? { t: 'lab', name: lab[1], props: JSON.parse(lab[2]) } : { t: 'lab', name: lab[1] })
      i++
      continue
    }
    const chapter = trimmed.match(/^::chapter\s+([\w-]+)\s*$/)
    if (chapter) {
      endPara()
      out.push({ t: 'chapter', slug: chapter[1] })
      i++
      continue
    }
    const scene = trimmed.match(/^::scene\s+([\w-]+)\s*$/)
    if (scene) {
      endPara()
      out.push({ t: 'scene', state: scene[1] })
      i++
      continue
    }
    const h = trimmed.match(/^(#{2,3})\s+(.*)$/)
    if (h) {
      endPara()
      out.push({ t: 'h', level: h[1].length as 2 | 3, runs: inline(h[2]), id: headingId(h[2]) })
      i++
      continue
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      endPara()
      out.push({ t: 'hr' })
      i++
      continue
    }
    if (trimmed.startsWith('>')) {
      endPara()
      const q: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) q.push(lines[i++].trim().replace(/^>\s?/, ''))
      out.push({ t: 'quote', runs: inline(q.join(' ')) })
      continue
    }
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      endPara()
      const head = cells(line)
      i += 2
      const rows: Run[][][] = []
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]))
      out.push({ t: 'table', head, rows })
      continue
    }
    const li = trimmed.match(/^([-*]|\d+[.)])\s+(.*)$/)
    if (li) {
      endPara()
      const ordered = /\d/.test(li[1])
      const items: string[] = []
      while (i < lines.length) {
        const l = lines[i]
        const m = l.trim().match(/^([-*]|\d+[.)])\s+(.*)$/)
        if (m && /\d/.test(m[1]) === ordered) items.push(m[2])
        else if (l.trim() && /^\s{2,}/.test(l) && items.length) items[items.length - 1] += ' ' + l.trim()
        else break
        i++
      }
      out.push({ t: ordered ? 'ol' : 'ul', items: items.map(inline) })
      continue
    }
    para.push(trimmed)
    i++
  }
  endPara()
  return out
}

export function parseArticle(src: string): Article {
  const { meta, body } = frontMatter(src.replace(/\r\n/g, '\n'))
  return { deck: meta.deck ?? '', title: meta.title, blocks: parseBlocks(body.split('\n')) }
}

/** Block skeleton used to check that the two languages line up: kinds, list lengths, nesting. */
export function skeleton(blocks: ABlock[]): string {
  return blocks
    .map((b) => {
      if (b.t === 'ul' || b.t === 'ol') return `${b.t}${b.items.length}`
      if (b.t === 'table') return `table${b.rows.length}x${b.head.length}`
      if (b.t === 'h') return `h${b.level}`
      if (b.t === 'lab') return `lab:${b.name}`
      if (b.t === 'chapter') return `chapter:${b.slug}`
      if (b.t === 'scene') return `scene:${b.state}`
      if (b.t === 'fold' || b.t === 'aside') return `${b.t}(${skeleton(b.blocks)})`
      return b.t
    })
    .join(' ')
}

/** Plain text, for reading time. */
export function articleText(blocks: ABlock[]): string {
  return blocks
    .map((b) => {
      switch (b.t) {
        case 'h':
        case 'p':
        case 'quote':
          return plain(b.runs)
        case 'ul':
        case 'ol':
          return b.items.map(plain).join(' ')
        case 'code':
          return b.text
        case 'table':
          return [...b.head, ...b.rows.flat()].map(plain).join(' ')
        case 'fold':
        case 'aside':
          return plain(b.title) + ' ' + articleText(b.blocks)
        default:
          return ''
      }
    })
    .join(' ')
}
