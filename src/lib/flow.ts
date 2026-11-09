import type { AlignedRow } from './align'
import type { Block } from './types'
import type { Extra } from '@/content/extras/types'

export type RowItem = { kind: 'row'; key: string; row: AlignedRow; anchor?: string }
/** Consecutive rows that exist in one language only (the translation follows an earlier edition). */
export type SoloItem = { kind: 'solo'; key: string; side: 'en' | 'zh'; rows: RowItem[] }
export type FlowItem = RowItem | SoloItem | { kind: 'extra'; key: string; extra: Extra }

const sideOf = (r: AlignedRow): 'en' | 'zh' | null => (r.en.length && !r.zh.length ? 'en' : r.zh.length && !r.en.length ? 'zh' : null)

/** Group runs of one-sided rows so the reader can show "not in the other edition" once per run. */
export function groupSolo(flow: FlowItem[]): FlowItem[] {
  const out: FlowItem[] = []
  for (const item of flow) {
    const side = item.kind === 'row' ? sideOf(item.row) : null
    const last = out[out.length - 1]
    if (item.kind === 'row' && side) {
      if (last?.kind === 'solo' && last.side === side) last.rows.push(item)
      else out.push({ kind: 'solo', key: 's' + item.key, side, rows: [item] })
    } else out.push(item)
  }
  return out
}

/** All rows of a flow, including those inside solo runs. */
export const flowRows = (flow: FlowItem[]): RowItem[] => flow.flatMap((f) => (f.kind === 'row' ? [f] : f.kind === 'solo' ? f.rows : []))

const headNum = (b: Block | undefined) => (b && b.t === 'h' && b.level === 2 ? b.num : null)
const isRefs = (b: Block | undefined) => !!b && b.t === 'h' && !!b.special && /References|参考/.test(b.text)

/** Interleave aligned rows with extras placed by section / figure identifiers. */
export function buildFlow(rows: AlignedRow[], en: Block[], zh: Block[], extras: Extra[]): FlowItem[] {
  const rowHead = rows.map((r) => headNum(en[r.en[0]]) ?? headNum(zh[r.zh[0]]))
  const rowFigs = rows.map((r) => [...r.en.map((i) => en[i]), ...r.zh.map((i) => zh[i])].flatMap((b) => (b.t === 'fig' && b.num ? [b.num] : [])))
  const firstHead = rowHead.findIndex((h) => h !== null)
  const refsRow = rows.findIndex((r) => isRefs(en[r.en[0]]) || isRefs(zh[r.zh[0]]))

  /** index of the row after which the extra goes (-1 = before everything) */
  const resolve = (at: string): number => {
    const [kind, arg] = at.split(':')
    if (kind === 'intro') return (firstHead < 0 ? rows.length : firstHead) - 1
    if (kind === 'end') return (refsRow < 0 ? rows.length : refsRow) - 1
    if (kind === 'head') {
      const i = rowHead.indexOf(arg)
      return i < 0 ? rows.length - 1 : i
    }
    if (kind === 'sec') {
      const i = rowHead.indexOf(arg)
      if (i < 0) return rows.length - 1
      let j = i + 1
      while (j < rows.length && rowHead[j] === null && j !== refsRow) j++
      return j - 1
    }
    if (kind === 'fig') {
      const i = rowFigs.findIndex((f) => f.includes(arg))
      return i < 0 ? rows.length - 1 : i
    }
    return rows.length - 1
  }

  const after = new Map<number, Extra[]>()
  for (const e of extras) {
    const i = resolve(e.at)
    if (!after.has(i)) after.set(i, [])
    after.get(i)!.push(e)
  }
  const flow: FlowItem[] = []
  const push = (i: number) => (after.get(i) ?? []).forEach((e) => flow.push({ kind: 'extra', key: 'x-' + e.id, extra: e }))
  push(-1)
  rows.forEach((row, i) => {
    const h = rowHead[i]
    flow.push({ kind: 'row', key: `r${i}`, row, anchor: h ? `s-${h}` : isRefs(en[row.en[0]]) || isRefs(zh[row.zh[0]]) ? 's-refs' : undefined })
    push(i)
  })
  return groupSolo(flow)
}
