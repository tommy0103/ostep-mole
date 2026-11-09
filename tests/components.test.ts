import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import BlockView from '@/components/reader/BlockView.vue'
import RowView from '@/components/reader/RowView.vue'
import SchedulerLab from '@/components/labs/SchedulerLab.vue'
import ABlockView from '@/components/article/ABlockView.vue'
import { inline } from '@/lib/article'
import { mode } from '@/lib/i18n'
import { buildFlow } from '@/lib/flow'
import type { Block } from '@/lib/types'

const p = (t: string): Block => ({ t: 'p', runs: [{ t, s: '' }] })
const stubs = { RouterLink: { template: '<a><slot /></a>' } }

describe('reader components', () => {
  beforeEach(() => {
    mode.value = 'en'
  })

  it('renders inline styles from extracted runs', () => {
    const w = mount(BlockView, { props: { lang: 'en', block: { t: 'p', runs: [{ t: 'a ', s: '' }, { t: 'process', s: 'b' }, { t: ' calls ', s: '' }, { t: 'fork()', s: 'c' }] } } })
    expect(w.find('strong').text()).toBe('process')
    expect(w.find('code').text()).toBe('fork()')
  })

  it('renders English crux questions as small-caps titles', () => {
    const w = mount(BlockView, { props: { lang: 'en', block: { t: 'aside', kind: 'crux', title: 'THE CRUX OF THE PROBLEM:', blocks: [p('HOW TO PROVIDE THE ILLUSION OF MANY CPUS?'), p('Although there are only a few physical CPUs…')] } } })
    expect(w.find('.question').text()).toBe('How To Provide The Illusion Of Many CPUs?')
    expect(w.findAll('p').length).toBe(1)
  })

  it('turns dialogue lines into speaker rows', () => {
    const w = mount(BlockView, { props: { lang: 'zh', dialogue: true, block: p('教授：想象我们有一个桃子。') } })
    expect(w.find('.who').text()).toBe('教授')
    expect(w.find('p').text()).toBe('想象我们有一个桃子。')
  })

  it('shows both languages side by side, or one with a peek toggle', async () => {
    const en = [p('The process is a running program.')]
    const zh = [p('进程就是运行中的程序。')]
    const w = mount(RowView, { props: { row: { en: [0], zh: [0] }, en, zh } })
    expect(w.text()).toContain('running program')
    expect(w.text()).not.toContain('进程')
    await w.find('button.peek').trigger('click')
    expect(w.text()).toContain('进程就是运行中的程序')
    mode.value = 'both'
    await nextTick()
    expect(w.findAll('.cell').length).toBe(2)
  })

  it('places extras after sections and figures', () => {
    const en: Block[] = [p('intro'), { t: 'h', level: 2, num: '7.1', text: 'A' }, p('a'), { t: 'fig', num: '7.1', caption: [] }, { t: 'h', level: 2, num: '7.2', text: 'B' }, p('b')]
    const zh = en.map((b) => (b.t === 'p' ? p('译') : b))
    const rows = en.map((_, i) => ({ en: [i], zh: [i] }))
    const flow = buildFlow(rows, en, zh, [
      { kind: 'note', id: 'x', at: 'sec:7.1', title: { en: '', zh: '' }, body: [] },
      { kind: 'note', id: 'y', at: 'fig:7.1', title: { en: '', zh: '' }, body: [] },
      { kind: 'note', id: 'z', at: 'intro', title: { en: '', zh: '' }, body: [] },
    ])
    // end of 7.1 and figure 7.1 are both after row 3; extras keep their declaration order
    expect(flow.map((f) => (f.kind === 'row' ? f.row.en[0] : f.kind === 'extra' ? f.extra.id : 'solo'))).toEqual([0, 'z', 1, 2, 3, 'x', 'y', 4, 5])
  })

  it('groups runs of rows that exist in one language only', () => {
    const en: Block[] = [p('a'), p('new 1'), p('new 2'), p('b')]
    const zh: Block[] = [p('甲'), p('乙')]
    const flow = buildFlow([{ en: [0], zh: [0] }, { en: [1], zh: [] }, { en: [2], zh: [] }, { en: [3], zh: [1] }], en, zh, [])
    expect(flow.map((f) => f.kind)).toEqual(['row', 'solo', 'row'])
    const solo = flow[1]
    expect(solo.kind === 'solo' && solo.side).toBe('en')
    expect(solo.kind === 'solo' && solo.rows.length).toBe(2)
  })
})

describe('labs', () => {
  it('the scheduler lab reproduces the convoy numbers and reacts to policy changes', async () => {
    mode.value = 'en'
    const w = mount(SchedulerLab, { props: { title: { en: 'Scheduler', zh: '调度' } }, global: { stubs } })
    expect(w.find('tr.avg').text()).toContain('110')
    const sjf = w.findAll('button').find((b) => b.text() === 'SJF')!
    await sjf.trigger('click')
    expect(w.find('tr.avg').text()).toContain('50')
  })
})

describe('glossary terms', () => {
  it('unfold below their block, and a term inside the card opens in the same card', async () => {
    const w = mount(ABlockView, { props: { lang: 'en', block: { t: 'p', runs: inline('A [[seccomp|seccomp-bpf]] filter runs a small program.') } }, global: { stubs } })
    expect(w.find('.term-card').exists()).toBe(false)
    await w.find('button.term').trigger('click')
    expect(w.find('.term-card .title').text()).toBe('seccomp')
    // seccomp's card mentions BPF: following it stays in one card, with a trail back
    await w.findAll('.term-card button.term').find((b) => b.text() === 'BPF')!.trigger('click')
    expect(w.findAll('.term-card')).toHaveLength(1)
    expect(w.find('.term-card .title').text()).toContain('BPF')
    expect(w.find('.trail').text()).toMatch(/seccomp\s*›\s*BPF/)
    await w.find('.trail button.step').trigger('click')
    expect(w.find('.term-card .title').text()).toBe('seccomp')
    // the term in the text closes it again
    await w.find('p button.term').trigger('click')
    expect(w.find('.term-card').exists()).toBe(false)
  })
})
