import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { articleText, parseArticle, skeleton, type ABlock } from '@/lib/article'
import { allNotes } from '@/content/extras/notes'
import { findChapter } from '@/content/book'
import { readingUnits } from '@/lib/text'
import { GLOSSARY, GLOSSARY_FILES } from '@/content/glossary'
import { findScene, sceneIds } from '@/content/scenes'
import { bandOf } from '@/lib/scene'

const DIR = 'src/content/articles'
const ids = [...new Set(fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.(en|zh)\.md$/, '')))]
const read = (id: string, lang: string) => parseArticle(fs.readFileSync(`${DIR}/${id}.${lang}.md`, 'utf8'))
const LAB_NAMES = [...fs.readFileSync('src/components/labs/registry.ts', 'utf8').matchAll(/^\s+(\w+): defineAsyncComponent/gm)].map((m) => m[1])

describe('article markdown', () => {
  it('parses the block kinds of the dialect', () => {
    const a = parseArticle(
      [
        '---',
        'deck: A standfirst.',
        '---',
        'Intro with `code`, **bold**, *it*, [a link](https://example.org) and 2^64^.',
        '',
        '## A section',
        '- one',
        '- two',
        '  continued',
        '',
        '1. first',
        '2. second',
        '',
        '> quoted',
        '',
        '```c',
        'int x = 1;',
        '```',
        '',
        '| a | b |',
        '|---|---|',
        '| 1 | 2 |',
        '',
        '::lab Lottery',
        '::chapter cpu-sched-lottery',
        '',
        ':::fold The math',
        'Inner paragraph.',
        ':::aside Nested',
        'Deeper.',
        ':::',
        ':::',
        '---',
      ].join('\n'),
    )
    expect(a.deck).toBe('A standfirst.')
    expect(skeleton(a.blocks)).toBe('p h2 ul2 ol2 quote code table1x2 lab:Lottery chapter:cpu-sched-lottery fold(p aside(p)) hr')
    const p = a.blocks[0] as ABlock & { t: 'p' }
    expect(p.runs.map((r) => r.s)).toEqual(['', 'c', '', 'b', '', 'i', '', '', '', 'sup', ''])
    expect(p.runs.find((r) => r.href)?.href).toBe('https://example.org')
    expect((a.blocks[2] as ABlock & { t: 'ul' }).items[1].map((r) => r.t).join('')).toBe('two continued')
  })

  it('parses markup inside links and code inside bold', () => {
    const a = parseArticle('[*A fork() in the road*](https://example.org) and **after `fork()`**\n')
    const runs = (a.blocks[0] as ABlock & { t: 'p' }).runs
    expect(runs[0]).toEqual({ t: 'A fork() in the road', s: 'i', href: 'https://example.org' })
    expect(runs.slice(2)).toEqual([{ t: 'after ', s: 'b' }, { t: 'fork()', s: 'c' }])
  })

  it('marks glossary terms, also inside other markup', () => {
    const a = parseArticle('a [[bpf|BPF program]] and **[[seccomp|seccomp-bpf]]** with [[fork-exec|`exec()`]]\n')
    const runs = (a.blocks[0] as ABlock & { t: 'p' }).runs
    expect(runs[1]).toEqual({ t: 'BPF program', s: '', term: 'bpf' })
    expect(runs[3]).toEqual({ t: 'seccomp-bpf', s: 'b', term: 'seccomp' })
    expect(runs[5]).toEqual({ t: 'exec()', s: 'c', term: 'fork-exec' })
    // brackets in the words, and a mark inside a table cell
    const b = parseArticle('**[[vdso|`[vdso]`]]**\n\n| a | b |\n|---|---|\n| [[hypervisor|VM]] on x | [[jit|JIT]] |\n').blocks
    expect((b[0] as ABlock & { t: 'p' }).runs).toEqual([{ t: '[vdso]', s: 'c', term: 'vdso' }])
    const row = (b[1] as ABlock & { t: 'table' }).rows[0]
    expect(row).toHaveLength(2)
    expect(row[0][0]).toEqual({ t: 'VM', s: '', term: 'hypervisor' })
  })

  it('accepts lab props as JSON', () => {
    const a = parseArticle('::lab Mlfq {"preset": "gaming"}\n')
    expect(a.blocks[0]).toEqual({ t: 'lab', name: 'Mlfq', props: { preset: 'gaming' } })
  })
})

describe('field-note articles', () => {
  const noteIds = new Set(allNotes().map((n) => n.note.id))

  it.each(ids)('%s: both languages exist and share one block skeleton', (id) => {
    expect(fs.existsSync(`${DIR}/${id}.en.md`)).toBe(true)
    expect(fs.existsSync(`${DIR}/${id}.zh.md`)).toBe(true)
    const en = read(id, 'en')
    const zh = read(id, 'zh')
    expect(skeleton(zh.blocks)).toBe(skeleton(en.blocks))
    expect(en.deck && zh.deck).toBeTruthy()
  })

  it.each(ids)('%s: belongs to a note, and its labs, chapters and internal links exist', (id) => {
    expect(noteIds.has(id)).toBe(true)
    const walk = (bs: ABlock[]): ABlock[] => bs.flatMap((b) => (b.t === 'fold' || b.t === 'aside' ? [b, ...walk(b.blocks)] : [b]))
    for (const lang of ['en', 'zh']) {
      const blocks = walk(read(id, lang).blocks)
      for (const b of blocks) {
        if (b.t === 'lab') expect(LAB_NAMES).toContain(b.name)
        if (b.t === 'chapter') expect(findChapter(b.slug)).not.toBeNull()
      }
      const src = fs.readFileSync(`${DIR}/${id}.${lang}.md`, 'utf8')
      for (const m of src.matchAll(/\]\((\/[^)]+)\)/g)) {
        const [, kind, slug] = m[1].split('/')
        if (kind === 'notes') expect(noteIds.has(slug.split('#')[0])).toBe(true)
        else expect(findChapter(slug?.split('#')[0] ?? '')).not.toBeNull()
      }
    }
  })

  it.each(ids)('%s: is a long read, not a stub', (id) => {
    const en = readingUnits(articleText(read(id, 'en').blocks))
    const zh = readingUnits(articleText(read(id, 'zh').blocks))
    expect(en.words).toBeGreaterThan(1200)
    expect(zh.cjk).toBeGreaterThan(2000)
  })
})

describe('glossary', () => {
  it('defines every term once, across all its files', () => {
    const seen = new Map<string, string>()
    const twice: string[] = []
    for (const [file, ids] of Object.entries(GLOSSARY_FILES))
      for (const id of ids) {
        if (seen.has(id)) twice.push(`${id}: ${seen.get(id)} and ${file}`)
        seen.set(id, file)
      }
    expect(twice).toEqual([])
  })

  const termsIn = (s: string) => [...s.matchAll(/\[\[([\w-]+)\|/g)].map((m) => m[1])
  const noteIds = new Set(allNotes().map((n) => n.note.id))

  it.each(Object.keys(GLOSSARY))('%s: has both languages, and its links and terms exist', (id) => {
    const t = GLOSSARY[id]
    for (const l of ['en', 'zh'] as const) expect(t.title[l] && t.body[l]).toBeTruthy()
    // the same terms in both languages, none pointing to itself
    expect(termsIn(t.body.zh).sort()).toEqual(termsIn(t.body.en).sort())
    for (const ref of termsIn(t.body.en)) {
      expect(GLOSSARY[ref], `${id} → ${ref}`).toBeDefined()
      expect(ref).not.toBe(id)
    }
    if (t.chapter) expect(findChapter(t.chapter)).not.toBeNull()
    if (t.note) expect(noteIds.has(t.note)).toBe(true)
  })

  it.each(ids)('%s: a term mark never leaks into the text or splits a table cell', (id) => {
    for (const lang of ['en', 'zh']) {
      const walk = (bs: ABlock[]): ABlock[] => bs.flatMap((b) => (b.t === 'fold' || b.t === 'aside' ? [b, ...walk(b.blocks)] : [b]))
      const blocks = walk(parseArticle(fs.readFileSync(`${DIR}/${id}.${lang}.md`, 'utf8')).blocks)
      for (const b of blocks) if (b.t === 'table') for (const row of b.rows) expect(row.length).toBe(b.head.length)
      expect(articleText(blocks.filter((b) => b.t !== 'code' && b.t !== 'fold' && b.t !== 'aside'))).not.toMatch(/\[\[|\]\]/)
    }
  })

  it.each(ids)('%s: marks the same known terms in both languages', (id) => {
    const en = termsIn(fs.readFileSync(`${DIR}/${id}.en.md`, 'utf8'))
    const zh = termsIn(fs.readFileSync(`${DIR}/${id}.zh.md`, 'utf8'))
    expect([...new Set(zh)].sort()).toEqual([...new Set(en)].sort())
    for (const t of en) expect(GLOSSARY[t], t).toBeDefined()
  })
})

describe('scenes', () => {
  it.each(sceneIds())('%s: every state the article reaches is drawn, and every drawn state is reached', (id) => {
    const spec = findScene(id)!
    const walk = (bs: ABlock[]): ABlock[] => bs.flatMap((b) => (b.t === 'fold' || b.t === 'aside' ? walk(b.blocks) : [b]))
    for (const lang of ['en', 'zh']) {
      const used = walk(read(id, lang).blocks).flatMap((b) => (b.t === 'scene' ? [b.state] : []))
      expect(used.length).toBeGreaterThan(0)
      for (const st of used) expect(spec.states[st], st).toBeDefined()
      expect([...new Set(used)].sort()).toEqual(Object.keys(spec.states).sort())
    }
    for (const t of Object.keys(spec.terms)) expect(GLOSSARY[t], t).toBeDefined()
  })

  it.each(sceneIds())('%s: every state has a band to show in the text, and every lit part has rows', (id) => {
    const spec = findScene(id)!
    for (const st of Object.keys(spec.states)) {
      const band = spec.bands[st]
      expect(band, st).toBeDefined()
      expect(band[0]).toBeGreaterThanOrEqual(0)
      expect(band[1]).toBeLessThanOrEqual(spec.height)
      expect(band[1]).toBeGreaterThan(band[0])
    }
    // a term's card in the text cuts the drawing to its parts, so each must have rows (or be absent from the drawing)
    for (const [t, parts] of Object.entries(spec.terms)) expect(bandOf(spec, parts), t).not.toBeNull()
  })
})
