import type { Block, FigureBlock } from './types'
import { anchorTokens, blockText } from './text'

/**
 * Bilingual alignment of an English chapter with its Chinese translation.
 *
 * The translation is of an older edition, so paragraphs are sometimes split, merged, added or
 * dropped. We run a Gale–Church style dynamic program over the two block sequences, scoring
 * candidate pairs with (a) structural anchors that survive translation: section numbers, figure
 * numbers and citation keys; (b) latin tokens (terms in parentheses, identifiers, numbers) that the
 * Chinese text keeps verbatim; and (c) a length-ratio prior. Moves allowed: 1–1, 1–0, 0–1, and
 * k–1 / 1–k merges of up to four paragraphs or list items.
 *
 * Figures, asides and footnotes are "floats": the two typesettings put them in different places
 * (English figures float to the top of a page, Chinese ones sit after the paragraph that cites them).
 * They are aligned among themselves and then slotted into the main text: a figure after the first
 * paragraph that cites it, anything else after the paragraph it follows in the source.
 */
export interface AlignedRow {
  en: number[]
  zh: number[]
}

interface Feat {
  b: Block
  text: string
  len: number
  tokens: Set<string>
  tokenList: string[]
  key: string | null
  /** for a numbered figure: the main row whose text (in its own language) first cites it, or -1 */
  cite?: number
}

function features(b: Block): Feat {
  const text = blockText(b)
  const tokenList = anchorTokens(text)
  let key: string | null = null
  if (b.t === 'h' && b.num && !isSummary(b.text)) key = 'h:' + b.num
  else if (b.t === 'h' && (b.special || isSummary(b.text))) key = 'h:' + specialKey(b.text)
  else if (b.t === 'fig' && b.num) key = (b.label === '表' ? 'tab:' : 'fig:') + b.num + (b.cont ? '+' : '')
  else if (b.t === 'ref') key = 'ref:' + (text.match(/^\[([^\]]+)\]/)?.[1] ?? '')
  return { b, text, len: Math.max(1, text.replace(/\s+/g, '').length), tokens: new Set(tokenList), tokenList, key }
}

// Sections are renumbered between editions, but the closing summary is always the summary.
const isSummary = (t: string) => /^(Summary|小结|总结|本章小结)$/.test(t.trim())

function specialKey(t: string): string {
  if (isSummary(t)) return 'sum'
  if (/References|参考/.test(t)) return 'refs'
  if (/Homework|作业/.test(t)) return 'hw'
  if (/Questions|问题/.test(t)) return 'q'
  return t
}

const PROSE = new Set(['p', 'li', 'note', 'ref'])
const MERGEABLE = new Set(['p', 'li'])
const FLOATS = ['fig', 'aside', 'note'] as const
const isFloat = (b: Block) => (FLOATS as readonly string[]).includes(b.t)

const jaccard = (a: Set<string>, b: Set<string>) => {
  const inter = [...a].filter((t) => b.has(t)).length
  return inter / (new Set([...a, ...b]).size || 1)
}

/** Share of the Chinese block's latin anchors found in the English one, damped when there are fewer than `full`. */
function coverage(e: Feat, z: Feat, full = 4): number {
  if (!z.tokenList.length) return 0
  let hit = 0
  for (const t of z.tokenList) if (e.tokens.has(t)) hit++
  return (hit / z.tokenList.length) * Math.min(1, z.tokenList.length / full)
}

/** How well zh block z translates en block e (higher is better; < 0 means "don't pair"). */
function pairScore(e: Feat, z: Feat, ratio: number): number {
  const te = e.b.t
  const tz = z.b.t
  if (e.key && z.key) {
    if (e.key === z.key) return 8
    if (e.key.split(':')[0] === z.key.split(':')[0] && te !== 'ref') return -4
  }
  let typePenalty = 0
  if (te !== tz) {
    if (PROSE.has(te) && PROSE.has(tz)) typePenalty = 0.6
    else return -Infinity
  }
  if (te === 'h' && (e.b as { level: number }).level !== (z.b as { level: number }).level) typePenalty += 0.5

  // anchor overlap measured from the Chinese side (it carries few latin tokens, all meaningful)
  let anchor = 0
  if (z.tokenList.length) {
    let hit = 0
    for (const t of z.tokenList) if (e.tokens.has(t)) hit++
    anchor = hit / z.tokenList.length
  }
  const weight = Math.min(1, z.tokenList.length / 4)
  if (te === 'code') return 0.5 + 4 * jaccard(e.tokens, z.tokens) - typePenalty
  const lenDev = Math.abs(Math.log(z.len / e.len / ratio))
  return 1.2 + 2.2 * anchor * weight - 0.25 * (1 - weight) - 1.4 * lenDev - typePenalty
}

/**
 * How well a Chinese float (figure, aside, footnote) matches an English one. Floats move around
 * between the two typesettings, so instead of their order we look at where they sit in the aligned
 * text (`d`, in main rows), what they share, and for figures their kind, number and citation.
 */
function floatScore(e: Feat, z: Feat, d: number, ratio: number): number {
  const near = d <= 1 ? 2 : d <= 3 ? 1 : d <= 8 ? 0 : -1.5
  // floats are few and far apart, so even two shared terms ("VAX-11") are telling
  const sim = 4 * coverage(e, z, 2)
  if (e.b.t === 'fig' && z.b.t === 'fig') {
    const fe = e.b
    const fz = z.b
    const ke = figKind(fe)
    const kz = figKind(fz)
    // either side may be a cropped image of a table or of code; code read as a table is rarer
    let s = (ke === kz ? 1 : ke === 'img' || kz === 'img' ? 0.4 : -3) + sim + near
    // same number: a hint, not proof (the Chinese edition sometimes splits a figure in two and
    // every later number shifts by one)
    if (e.key && z.key) s += e.key === z.key ? 3 : -1
    if (!fe.num !== !fz.num) s -= 1
    // cited from the same stretch of aligned text: the best evidence there is
    if (e.cite !== undefined && e.cite >= 0 && z.cite !== undefined && z.cite >= 0) s += Math.abs(e.cite - z.cite) <= 1 ? 3 : -3
    return s
  }
  if (e.b.t === 'aside' && z.b.t === 'aside') {
    // the "key terms" summaries came after the translated edition
    if (/^ASIDE: KEY .*TERMS/.test(e.b.title)) return -Infinity
    return sim + near + (e.b.kind === z.b.kind ? 1.5 : -1)
  }
  // footnotes: right after the paragraph that cites them, and of proportionate length
  return 1 + sim + near - Math.abs(Math.log(z.len / e.len / ratio))
}

/** Maximum-weight one-to-one assignment (Hungarian algorithm): the column of each row, or -1. */
function assign(w: number[][]): number[] {
  const n = w.length
  const m = n ? w[0].length : 0
  const N = Math.max(n, m)
  // minimise cost = -weight over a square matrix padded with zeros (1-indexed, as in the textbook)
  const cost = (i: number, j: number) => (i <= n && j <= m ? -w[i - 1][j - 1] : 0)
  const u = new Array(N + 1).fill(0)
  const v = new Array(N + 1).fill(0)
  const p = new Array(N + 1).fill(0)
  const way = new Array(N + 1).fill(0)
  for (let i = 1; i <= N; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array(N + 1).fill(Infinity)
    const used = new Array(N + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= N; j++) {
        if (used[j]) continue
        const cur = cost(i0, j) - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= N; j++) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else minv[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }
  const out = new Array(n).fill(-1)
  for (let j = 1; j <= m; j++) if (p[j] >= 1 && p[j] <= n) out[p[j] - 1] = j - 1
  return out
}

const figKind = (f: FigureBlock) => (f.kind === 'table' || f.label === '表' ? 'table' : f.code ? 'code' : 'img')

function merged(fs: Feat[]): Feat {
  const tokenList = fs.flatMap((f) => f.tokenList)
  return {
    b: fs[0].b,
    text: fs.map((f) => f.text).join(' '),
    len: fs.reduce((s, f) => s + f.len, 0),
    tokens: new Set(tokenList),
    tokenList,
    key: null,
  }
}

const MAX_MERGE = 4

/** Dynamic program over two subsequences (given as block indices); returns rows of block indices. */
function dp(E: Feat[], Z: Feat[], ei: number[], zi: number[], ratio: number): AlignedRow[] {
  const n = ei.length
  const m = zi.length
  const NEG = -1e9
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG))
  const back: [number, number][][] = Array.from({ length: n + 1 }, () => new Array(m + 1))
  score[0][0] = 0
  const SKIP = -0.15
  const e = (k: number) => E[ei[k]]
  const z = (k: number) => Z[zi[k]]
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      const cur = score[i][j]
      if (cur <= NEG / 2) continue
      const relax = (di: number, dj: number, s: number) => {
        const v = cur + s
        if (v > score[i + di][j + dj]) {
          score[i + di][j + dj] = v
          back[i + di][j + dj] = [di, dj]
        }
      }
      if (i < n) relax(1, 0, SKIP)
      if (j < m) relax(0, 1, SKIP)
      if (i < n && j < m) {
        const s = pairScore(e(i), z(j), ratio)
        if (s > 0) relax(1, 1, s)
      }
      // k–1 and 1–k merges of consecutive paragraphs / list items
      if (i < n && j < m && MERGEABLE.has(e(i).b.t) && MERGEABLE.has(z(j).b.t)) {
        for (let k = 2; k <= MAX_MERGE; k++) {
          const penalty = 0.9 + 0.4 * (k - 2)
          if (i + k <= n && MERGEABLE.has(e(i + k - 1).b.t)) {
            const s = pairScore(merged(Array.from({ length: k }, (_, d) => e(i + d))), z(j), ratio) - penalty
            if (s > 0) relax(k, 1, s)
          }
          if (j + k <= m && MERGEABLE.has(z(j + k - 1).b.t)) {
            const s = pairScore(e(i), merged(Array.from({ length: k }, (_, d) => z(j + d))), ratio) - penalty
            if (s > 0) relax(1, k, s)
          }
        }
      }
    }
  }
  const rows: AlignedRow[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const [di, dj] = back[i][j]
    rows.push({ en: ei.slice(i - di, i), zh: zi.slice(j - dj, j) })
    i -= di
    j -= dj
  }
  return rows.reverse()
}

export function alignBlocks(en: Block[], zh: Block[]): AlignedRow[] {
  const E = en.map(features)
  const Z = zh.map(features)
  // global length ratio over prose
  const sum = (fs: Feat[]) => fs.filter((f) => f.b.t === 'p').reduce((s, f) => s + f.len, 0) || 1
  const ratio = sum(Z) / sum(E) || 0.35
  const idx = (bs: Block[], keep: (b: Block) => boolean) => bs.flatMap((b, i) => (keep(b) ? [i] : []))

  const main = dp(E, Z, idx(en, (b) => !isFloat(b)), idx(zh, (b) => !isFloat(b)), ratio)
  // a heading found only in English right next to one found only in Chinese is the same heading,
  // promoted or demoted between editions (ch. 23: "Memory Management Hardware" / "23.2 内存管理硬件")
  const loneHeading = (r: AlignedRow, lang: 'en' | 'zh') =>
    r[lang].length === 1 && !r[lang === 'en' ? 'zh' : 'en'].length && (lang === 'en' ? en : zh)[r[lang][0]].t === 'h'
  for (let k = 0; k + 1 < main.length; k++) {
    const [a, b] = [main[k], main[k + 1]]
    if ((loneHeading(a, 'en') && loneHeading(b, 'zh')) || (loneHeading(a, 'zh') && loneHeading(b, 'en'))) main.splice(k, 2, { en: [...a.en, ...b.en], zh: [...a.zh, ...b.zh] })
  }

  // main row holding each main-stream block, per language
  const rowOf = { en: new Map<number, number>(), zh: new Map<number, number>() }
  main.forEach((r, k) => {
    r.en.forEach((i) => rowOf.en.set(i, k))
    r.zh.forEach((i) => rowOf.zh.set(i, k))
  })
  /** the main row a block at index i of a language follows in its own source (-1 = before all) */
  const follows = (lang: 'en' | 'zh', i: number) => {
    for (let k = i - 1; k >= 0; k--) {
      const r = rowOf[lang].get(k)
      if (r !== undefined) return r
    }
    return -1
  }
  /** the main row a block at index i of a language precedes in its own source */
  const precedes = (lang: 'en' | 'zh', i: number) => {
    for (let k = i + 1; k < (lang === 'en' ? en : zh).length; k++) {
      const r = rowOf[lang].get(k)
      if (r !== undefined) return r
    }
    return main.length
  }

  // where each numbered figure is first cited, in its own language ("Figures 8.2 and 8.3", "图 4.3", "表 4.1")
  const citing = (fs: Feat[], lang: 'en' | 'zh', f: FigureBlock) => {
    const label = lang === 'en' ? 'Figures?' : (f.label ?? '图')
    const re = new RegExp(`${label}\\s*(?:[\\d.]+\\s*(?:,|and|和|与|及|、|–|-)\\s*)*${f.num!.replace('.', '\\.')}(?![\\d])`)
    return main.findIndex((r) => r[lang].some((i) => re.test(fs[i].text)))
  }
  for (const [fs, lang] of [[E, 'en'], [Z, 'zh']] as const) for (const f of fs) if (f.b.t === 'fig' && f.b.num) f.cite = citing(fs, lang, f.b)

  // Some chapters of the Chinese edition number tables (表) apart from figures, so its figure numbers
  // drift from the English ones (图 4.3 is Figure 4.5): there, numbers mean nothing across editions.
  if (zh.some((b) => b.t === 'fig' && b.label === '表')) for (const f of [...E, ...Z]) if (f.b.t === 'fig') f.key = null

  // floats of each kind pair one to one, maximising the total score (a greedy pass lets one
  // slightly-off pair take the partner of another)
  const anchor = (f: Feat, lang: 'en' | 'zh', i: number) => (f.cite !== undefined && f.cite >= 0 ? f.cite : follows(lang, i))
  const floats: AlignedRow[] = []
  const pairedE = new Set<number>()
  const pairedZ = new Set<number>()
  for (const t of FLOATS) {
    const ei = idx(en, (b) => b.t === t)
    const zi = idx(zh, (b) => b.t === t && !(b.t === 'fig' && b.cont))
    const w = ei.map((i) =>
      zi.map((j) => {
        // distance in the aligned text, from either side: a float that ends a section precedes the
        // same heading in both editions even when one edition has more text before it
        const d = Math.min(Math.abs(anchor(E[i], 'en', i) - anchor(Z[j], 'zh', j)), Math.abs(precedes('en', i) - precedes('zh', j)))
        const s = floatScore(E[i], Z[j], d, ratio)
        return s > 0.5 ? s : 0
      }),
    )
    assign(w).forEach((k, r) => {
      if (k < 0 || w[r][k] <= 0) return
      floats.push({ en: [ei[r]], zh: [zi[k]] })
      pairedE.add(ei[r])
      pairedZ.add(zi[k])
    })
  }
  en.forEach((b, i) => isFloat(b) && !pairedE.has(i) && floats.push({ en: [i], zh: [] }))
  zh.forEach((b, j) => isFloat(b) && !(b.t === 'fig' && b.cont) && !pairedZ.has(j) && floats.push({ en: [], zh: [j] }))
  // the rest of a Chinese table continued over a page break (续表) joins the row of its first part
  zh.forEach((b, j) => {
    if (b.t !== 'fig' || !b.cont) return
    const isHead = (k: number) => zh[k].t === 'fig' && !(zh[k] as FigureBlock).cont && (zh[k] as FigureBlock).num === b.num && (zh[k] as FigureBlock).label === b.label
    const head = floats.find((r) => r.zh.some(isHead))
    if (head) head.zh.push(j)
    else floats.push({ en: [], zh: [j] })
  })

  const slots = new Map<number, { row: AlignedRow; order: number }[]>()
  for (const row of floats) {
    const first = row.en.length ? E[row.en[0]] : Z[row.zh[0]]
    let at = row.en.length ? follows('en', row.en[0]) : follows('zh', row.zh[0])
    // only move a figure forward to its citation if that stays nearby (same section or so)
    if (first.cite !== undefined && first.cite >= 0 && Math.abs(first.cite - at) <= 12) at = first.cite
    const order = row.en.length ? row.en[0] : (main[at]?.en.at(-1) ?? -1) + 0.5 + row.zh[0] * 1e-6
    if (!slots.has(at)) slots.set(at, [])
    slots.get(at)!.push({ row, order })
  }
  const out: AlignedRow[] = []
  const emit = (k: number) => (slots.get(k) ?? []).sort((a, b) => a.order - b.order).forEach((s) => out.push(s.row))
  emit(-1)
  main.forEach((r, k) => {
    out.push(r)
    emit(k)
  })
  return out
}

/** Lookup tables from block index to its counterpart(s) for "peek translation". */
export function counterpartMaps(rows: AlignedRow[]) {
  const enToZh = new Map<number, number[]>()
  const zhToEn = new Map<number, number[]>()
  for (const r of rows) {
    if (!r.en.length || !r.zh.length) continue
    for (const e of r.en) enToZh.set(e, r.zh)
    for (const z of r.zh) zhToEn.set(z, r.en)
  }
  return { enToZh, zhToEn }
}
