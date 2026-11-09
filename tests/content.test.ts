import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { blockText } from '@/lib/text'
import type { Block, ChapterData } from '@/lib/types'
// @ts-expect-error plain JS build tool
import { FIXES, runsOf } from '../tools/content/fixes.mjs'

const chapter = (lang: string, n: number): ChapterData =>
  JSON.parse(fs.readFileSync(`src/content/generated/${lang}/${String(n).padStart(2, '0')}.json`, 'utf8'))
const text = (lang: string, n: number) => {
  const walk = (bs: Block[]): string[] => bs.flatMap((b) => [blockText(b), ...(b.t === 'aside' ? walk(b.blocks) : [])])
  return walk(chapter(lang, n).blocks).join('\n')
}

describe('extracted content', () => {
  it('repairs fonts whose ToUnicode map sends several characters to one', () => {
    // broken: 事实上 → 实实上, 认为 → 但为, 字节 → 字我, 金/乡/伯/星/球 → 变
    expect(text('zh', 14)).not.toMatch(/实实上|但为|字我/)
    expect(text('zh', 10)).toContain('变形金刚的家乡塞伯坦星球')
    expect(text('zh', 13)).toContain('坚持到底')
  })

  it('keeps a program\'s output apart from a listing set directly below it', () => {
    const blocks = chapter('zh', 5).blocks
    const listings = blocks.flatMap((b) => (b.t === 'fig' && b.code !== undefined ? [b.code] : []))
    expect(listings).toHaveLength(4)
    for (const code of listings) {
      expect(code.startsWith('#include')).toBe(true)
      expect(code).not.toMatch(/prompt>|^\s*\d+\s+#/m)
      expect(code).toMatch(/^int$/m)
    }
    const outputs = blocks.flatMap((b) => (b.t === 'code' ? [b.text] : []))
    expect(outputs.some((t) => t.startsWith('prompt> ./p3') && t.endsWith('prompt>'))).toBe(true)
    expect(outputs.some((t) => t.startsWith('prompt> ./p4') && t.includes('p4.c'))).toBe(true)
  })

  it('keeps footnotes apart from each other and from the references', () => {
    const notes = (lang: string, n: number) => chapter(lang, n).blocks.filter((b) => b.t === 'note').map(blockText)
    expect(notes('en', 5).some((t) => t.startsWith('3') && t.includes('six variants'))).toBe(true)
    expect(notes('en', 17).some((t) => t.includes('LaTeX'))).toBe(true)
    expect(notes('zh', 4).some((t) => t.includes('僵尸状态'))).toBe(true)
    // a fraction's denominator is not a footnote marker
    expect(notes('en', 7).every((t) => t.length > 3)).toBe(true)
  })

  it('finds figures that sit beside the text or have no caption', () => {
    const figs = (lang: string, n: number) => chapter(lang, n).blocks.filter((b) => b.t === 'fig')
    // a caption beside a figure that text wraps around
    expect(figs('zh', 8).map((f) => f.t === 'fig' && f.num)).toContain('8.2')
    // ch. 10's queue diagrams are thin images
    expect(figs('zh', 10).filter((f) => f.t === 'fig' && !f.num).length).toBeGreaterThanOrEqual(12)
    // the 32-bit address layout is a drawing, not three lines of digits
    expect(text('en', 20)).not.toContain('3 3 2 2 2 2')
  })

  it('every figure file exists', () => {
    for (const lang of ['en', 'zh'])
      for (const f of fs.readdirSync(`src/content/generated/${lang}`)) {
        const data: ChapterData = JSON.parse(fs.readFileSync(`src/content/generated/${lang}/${f}`, 'utf8'))
        for (const b of data.blocks) if (b.t === 'fig' && b.img) expect(fs.existsSync(`public/figs/${lang}/${b.img}`)).toBe(true)
      }
  })
})

describe('hand corrections (tools/content/fixes.mjs)', () => {
  it('parses their inline markup', () => {
    expect(runsOf('`weight`~0~ / x^2^ *i*')).toEqual([
      { t: 'weight', s: 'c' },
      { t: '0', s: 'sub' },
      { t: ' / x', s: '' },
      { t: '2', s: 'sup' },
      { t: ' ', s: '' },
      { t: 'i', s: 'i' },
    ])
  })

  it('are all applied: no scattered fraction is left', () => {
    expect(Object.keys(FIXES.en).length).toBeGreaterThan(0)
    expect(text('en', 7)).not.toMatch(/\( = \d|\d+\+\d+\+\d+ /)
    expect(text('en', 7)).toContain('(10 + 20 + 30) / 3 = 20')
    expect(text('en', 9)).toContain('about 3/4 of sched_latency')
    expect(text('zh', 22)).toContain('6 / (6 + 5)')
  })
})
