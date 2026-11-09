import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { alignBlocks } from '@/lib/align'
import type { Block, ChapterData } from '@/lib/types'
import { blockText } from '@/lib/text'

const load = (lang: string, n: number): ChapterData =>
  JSON.parse(fs.readFileSync(`src/content/generated/${lang}/${String(n).padStart(2, '0')}.json`, 'utf8'))

describe('alignBlocks', () => {
  it('pairs headings and figures by their numbers', () => {
    const en = load('en', 4)
    const zh = load('zh', 4)
    const rows = alignBlocks(en.blocks, zh.blocks)
    for (const r of rows) {
      if (r.en.length === 1 && r.zh.length === 1) {
        const e = en.blocks[r.en[0]]
        const z = zh.blocks[r.zh[0]]
        if (e.t === 'h' && e.num) expect(z.t === 'h' && z.num).toBe(e.num)
      }
    }
    const sections = rows.filter((r) => r.en.length && r.zh.length && en.blocks[r.en[0]].t === 'h').length
    expect(sections).toBeGreaterThanOrEqual(6)
  })

  it('keeps every block exactly once, and the main text in order', () => {
    const isFloat = (b: Block) => b.t === 'fig' || b.t === 'aside' || b.t === 'note'
    for (const n of [4, 7, 9, 18]) {
      const en = load('en', n)
      const zh = load('zh', n)
      const rows = alignBlocks(en.blocks, zh.blocks)
      const seenEn = rows.flatMap((r) => r.en)
      const seenZh = rows.flatMap((r) => r.zh)
      expect([...seenEn].sort((a, b) => a - b)).toEqual(en.blocks.map((_, i) => i))
      expect([...seenZh].sort((a, b) => a - b)).toEqual(zh.blocks.map((_, i) => i))
      const mainEn = seenEn.filter((i) => !isFloat(en.blocks[i]))
      expect(mainEn).toEqual([...mainEn].sort((a, b) => a - b))
    }
  })

  it('pairs numbered figures even when the two editions order them differently', () => {
    const fig = (num: string): Block => ({ t: 'fig', num, caption: [] })
    const para = (t: string): Block => ({ t: 'p', runs: [{ t, s: '' }] })
    const en = [para('See Figure 7.1 and Figure 7.2 for FIFO and SJF.'), fig('7.1'), fig('7.2')]
    const zh = [para('见图 7.1 和图 7.2（FIFO 与 SJF）。'), fig('7.2'), fig('7.1')]
    const rows = alignBlocks(en, zh)
    expect(rows).toContainEqual({ en: [1], zh: [2] })
    expect(rows).toContainEqual({ en: [2], zh: [1] })
  })

  it('pairs figures by kind and citation where the Chinese edition numbers tables apart (ch. 4)', () => {
    const para = (t: string): Block => ({ t: 'p', runs: [{ t, s: '' }] })
    const table = (num: string, label?: '表', cont?: true): Block => ({ t: 'fig', num, kind: 'table', caption: [], table: [], ...(label && { label }), ...(cont && { cont }) })
    const code = (num: string): Block => ({ t: 'fig', num, caption: [], code: 'struct proc {}' })
    const en = [para('Figure 4.3 traces two processes.'), table('4.3'), para('Figure 4.5 shows struct proc in xv6.'), code('4.5')]
    const zh = [para('表 4.1 跟踪了两个进程。'), table('4.1', '表'), table('4.1', '表', true), para('图 4.3 展示了 xv6 的 proc 结构。'), code('4.3')]
    const rows = alignBlocks(en, zh)
    expect(rows).toContainEqual({ en: [1], zh: [1, 2] })
    expect(rows).toContainEqual({ en: [3], zh: [4] })
  })

  it('moves a figure that floated to the top of the page after the paragraph that cites it', () => {
    const para = (t: string): Block => ({ t: 'p', runs: [{ t, s: '' }] })
    const en: Block[] = [{ t: 'fig', num: '9.1', caption: [] }, para('Intro text about lottery tickets.'), para('The code in Figure 9.1 walks the list.')]
    const zh: Block[] = [para('关于彩票的介绍。'), para('图 9.1 中的代码遍历列表。'), { t: 'fig', num: '9.1', caption: [] }]
    const rows = alignBlocks(en, zh)
    expect(rows.findIndex((r) => r.en.includes(0))).toBeGreaterThan(rows.findIndex((r) => r.en.includes(2)))
  })

  it('pairs the closing summary even when the section numbers differ', () => {
    const h = (num: string, text: string): Block => ({ t: 'h', level: 2, num, text })
    const rows = alignBlocks([h('9.7', 'The Linux CFS'), h('9.8', 'Summary')], [h('9.7', '小结')])
    expect(rows).toContainEqual({ en: [1], zh: [0] })
  })

  it('pairs most prose paragraphs in a closely translated chapter', () => {
    const en = load('en', 4)
    const zh = load('zh', 4)
    const rows = alignBlocks(en.blocks, zh.blocks)
    const paired = rows.filter((r) => r.en.length && r.zh.length).flatMap((r) => r.en).length
    expect(paired / en.blocks.length).toBeGreaterThan(0.7)
  })

  it('handles synthetic split paragraphs (1–2 merge)', () => {
    const en = [{ t: 'p' as const, runs: [{ t: 'The process API includes fork() and exec() and wait() calls for processes.', s: '' as const }] }]
    const zh = [
      { t: 'p' as const, runs: [{ t: '进程 API 包括 fork()', s: '' as const }] },
      { t: 'p' as const, runs: [{ t: '以及 exec() 和 wait() 调用。', s: '' as const }] },
    ]
    const rows = alignBlocks(en, zh)
    expect(rows).toEqual([{ en: [0], zh: [0, 1] }])
    expect(blockText(zh[0])).toContain('fork')
  })
})

/** The Chinese partner(s) of the first English block whose text contains `en`, as text. */
function partner(n: number, en: string): string {
  const E = load('en', n).blocks
  const Z = load('zh', n).blocks
  const i = E.findIndex((b) => blockText(b).includes(en))
  expect(i).toBeGreaterThanOrEqual(0)
  const row = alignBlocks(E, Z).find((r) => r.en.includes(i))!
  return row.zh.map((j) => blockText(Z[j])).join(' | ')
}

describe('alignBlocks on the book (floats move between the editions)', () => {
  it('pairs asides by content and position, not by order', () => {
    expect(partner(19, 'RISC VS. CISC')).toContain('RISC 与 CISC')
    expect(partner(19, 'TLB VALID BIT')).toContain('TLB 的有效位')
    expect(partner(6, 'REBOOT IS USEFUL')).toContain('重新启动是有用的')
    // the newer English edition turned this crux into an aside
    expect(partner(23, 'THE CURSE OF GENERALITY')).toContain('通用性')
    // the "key terms" summaries were added after the translation
    expect(partner(4, 'KEY PROCESS TERMS')).toBe('')
  })

  it('pairs footnotes one to one, maximising the total score', () => {
    expect(partner(13, 'This usage of transparency')).toContain('透明的这种用法')
    expect(partner(13, 'drop the course')).toContain('放弃课程')
    expect(partner(5, 'six variants of')).toContain('exec()有几种变体')
  })

  it('follows the citation when the Chinese edition renumbers figures (ch. 8 splits Figure 8.3 in two)', () => {
    expect(partner(8, 'Without (Left) and With (Right) Priority Boost')).toContain('不采用优先级提升')
    expect(partner(8, 'Lower Priority, Longer Quanta')).toContain('优先级越低，时间片越长')
  })

  it('joins a heading demoted in one edition with its neighbour in the other (ch. 23)', () => {
    expect(partner(23, 'Memory Management Hardware')).toContain('内存管理硬件')
  })
})
