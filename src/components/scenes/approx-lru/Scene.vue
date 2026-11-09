<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import PlruDemo from './PlruDemo.vue'

/**
 * The running figure of the approximate-LRU article: what a cache does at two moments. Chips on top
 * say which layer we are in (Linux pages, Redis, PostgreSQL, a CPU cache). The upper lane is the
 * work done on every access, the row of cells is the cached items with their hints, the lower lane
 * is the decision made at eviction, and the strip below holds this state's numbers. CLOCK's circle
 * is drawn as a row whose end wraps back to its start. Nothing moves.
 */
const props = defineProps<DrawingProps>()
type T = [string, string]
interface Cfg {
  n: number
  layers: number[]
  work: [T, T]
  decide: [T, T]
  labels?: string[]
  hint?: string[]
  acc?: number
  hand?: number
  victim?: number
}
const ABC = 'ABCDEFGHIJKL'.split('')
const BITS = '1 0 1 1 0 0 1 0 1 1 0 1'.split(' ')

const CFG: Record<string, Cfg> = {
  overview: {
    n: 12, layers: [0, 1, 2, 3], labels: ABC, hint: BITS, acc: 6, hand: 3, victim: 4,
    work: [['on every access: update a small hint', '每次访问：更新一个小提示'], ['a bit, a counter or a timestamp', '一个位、一个计数或一个时间']],
    decide: [['at eviction: read the hints and pick a victim', '淘汰时：读这些提示，挑一个牺牲者'], ['the full order is never kept', '从不保存完整的顺序']],
  },
  exact: {
    n: 12, layers: [0, 1, 2, 3], labels: 'IAKCFHBLDJEG'.split(''), acc: 8,
    work: [['on every access: move it to the front', '每次访问：把它移到最前面'], ['a write to shared pointers, under a lock', '一次对共享指针的写，还要加锁']],
    decide: [['at eviction: take the last item', '淘汰时：取最后一项'], ['simple, but paid for on every access', '很简单，但代价摊在每次访问上']],
  },
  clock: {
    n: 12, layers: [0], labels: ABC, hint: ['1', '0', '1', '1→0', '0', '0', '1', '0', '1', '1', '0', '1'], acc: 6, hand: 3, victim: 4,
    work: [['on every access: hardware sets the use bit', '每次访问：硬件置使用位'], ['and does nothing else', '此外什么都不做']],
    decide: [['at eviction: the hand sweeps', '淘汰时：指针扫过去'], ['bit 1: clear it, a second chance. bit 0: evict', '位为 1：清零，再给一次机会；位为 0：淘汰']],
  },
  family: {
    n: 12, layers: [2], labels: '0 1 2 3 4 5 6 7 8 9 10 11'.split(' '), hint: ['2', '1', '5', '1→0', '0', '3', '0', '2', '4', '1', '5', '2'], acc: 2, hand: 3, victim: 4,
    work: [['each pin: usage count + 1, up to 5', '每 pin 一次：使用计数加一，上限 5'], ['a count per buffer, not one bit', '每个缓冲区一个计数，而不是一位']],
    decide: [['the sweep decrements each buffer it passes', '扫描每经过一个缓冲区就减一'], ['and takes the first one at zero', '取第一个为 0 的']],
  },
  twolist: {
    n: 12, layers: [0],
    work: [['referenced again while inactive: promoted', '在非活跃链表上再次被引用：提升'], ['a page must prove itself twice', '一页要证明自己两次']],
    decide: [['reclaim takes victims from the inactive tail', '回收从非活跃链表的尾部挑牺牲者'], ['when active grows too big, its tail is demoted', '活跃链表太长时，从尾部降级']],
  },
  rmap: {
    n: 12, layers: [0],
    work: [['a load or store: hardware sets the accessed bit', '读写内存：硬件置访问位'], ['in the PTE, not in the page', '置在 PTE 里，而不是页上']],
    decide: [['reclaim follows the reverse map', '回收时沿反向映射查找'], ['from the page to every PTE that maps it', '从页找到映射它的每个 PTE']],
  },
  refault: {
    n: 12, layers: [0],
    work: [['a file page is evicted: a shadow entry stays', '文件页被淘汰：留下影子表项'], ['in its page-cache slot', '留在它原来的页缓存槽位里']],
    decide: [['read back soon: refault distance is small', '很快又读回：回迁距离很小'], ['so the page is activated at once', '于是这一页立即被激活']],
  },
  mglru: {
    n: 12, layers: [0],
    work: [['the aging hand: accessed pages go to the youngest', '老化指针：被访问过的页移入最年轻的一代'], ['and everything else falls behind untouched', '其余的页不必触碰，自然落后']],
    decide: [['the eviction hand takes from the oldest', '淘汰指针从最老的一代取页'], ['2 to 4 generations at any time', '任何时候都有 2 到 4 代']],
  },
  walk: {
    n: 12, layers: [0],
    work: [['the aging hand walks page tables directly', '老化指针直接遍历页表'], ['neighbouring PTEs share cache lines', '相邻的 PTE 共享缓存行']],
    decide: [['a Bloom filter remembers which PTE pages', '布隆过滤器记住哪些页表页'], ['held enough young entries to scan again', '年轻表项够多、值得下次再扫']],
  },
  redis: {
    n: 12, layers: [1], labels: ABC, hint: ['3', '410', '12', '88', '7', '2500', '64', '5', '301', '19', '1200', '44'], acc: 2, victim: 1,
    work: [['each access: write a 24-bit timestamp', '每次访问：写一个 24 位时间戳'], ['keys are kept in no order at all', '键根本没有任何顺序']],
    decide: [['at eviction: sample 5, evict the idlest', '淘汰时：抽 5 个，淘汰闲置最久的'], ['the pool keeps the best candidates seen', '淘汰池保留迄今最好的候选者']],
  },
  lfu: {
    n: 12, layers: [1],
    work: [['under LFU policies, the same 24 bits', '在 LFU 策略下，同样这 24 位'], ['hold a time and a small counter', '存一个时间和一个小计数器']],
    decide: [['the counter grows logarithmically', '计数器按对数增长'], ['and decays: by default −1 per idle minute', '还会衰减：默认每闲置一分钟减一']],
  },
  plru: {
    n: 8, layers: [3], labels: '0 1 2 3 4 5 6 7'.split(' '), hint: ['t9', 't2', 't3', 't4', 't5', 't6', 't7', 't8'], victim: 4,
    work: [['', ''], ['', '']],
    decide: [['on a hit: flip the bits on one path', '命中时：翻转一条路径上的位'], ['to evict: follow the bits from the root', '淘汰时：从根顺着这些位走下去']],
  },
  dueling: {
    n: 12, layers: [3],
    work: [['a few sets each run one of two policies', '少数几组各运行两种策略之一'], ['the rest follow whichever misses less', '其余的组跟随未命中更少的那种']],
    decide: [['a new line’s insertion point matters too', '新行插在哪里同样重要'], ['LRU end, not MRU end: scans pass through', '插在 LRU 端而不是 MRU 端：扫描穿堂而过']],
  },
  bends: {
    n: 12, layers: [0, 1, 2, 3], labels: ABC, hint: BITS, acc: 6, hand: 3, victim: 4,
    work: [['hints are cheap but say little', '提示很便宜，但说得很少'], ['one bit cannot count', '一个位不会计数']],
    decide: [['reading the hints costs something', '读这些提示本身也要花钱'], ['and recency misleads on scans', '而且在扫描面前，新近程度会误导']],
  },
}
const L0 = ['items']
const SHOW: Record<string, string[]> = {
  overview: ['layer', 'access', ...L0, 'hints', 'hand', 'decide', 's-overview'],
  exact: ['layer', 'access', ...L0, 'links', 'move', 'decide', 's-exact'],
  clock: ['layer', 'access', ...L0, 'hints', 'hand', 'loop', 'decide', 's-clock'],
  family: ['layer', 'access', ...L0, 'hints', 'hand', 'loop', 'ring', 'decide', 's-family'],
  twolist: ['layer', 'work', 'lists', 'decide', 's-twolist'],
  rmap: ['layer', 'access', 'ptes', 'inactive', 'decide', 's-rmap'],
  refault: ['layer', 'work', 'cacheslots', 'shadow', 'inactive', 'decide', 's-refault'],
  mglru: ['layer', 'work', 'gens', 'decide', 's-mglru'],
  walk: ['layer', 'work', 'tables', 'bloom', 'decide', 's-walk'],
  redis: ['layer', 'access', ...L0, 'hints', 'sample', 'pool', 'decide', 's-redis'],
  lfu: ['layer', 'work', 'bits24', 'decide', 's-lfu'],
  plru: ['layer', 'tree', ...L0, 'hints', 'decide', 's-plru'],
  dueling: ['layer', 'work', 'sets', 'decide', 's-dueling'],
  bends: ['layer', 'access', ...L0, 'hints', 'hand', 'decide', 's-bends'],
}
const { part, L, viewBox } = useDrawing(props, SHOW, 440)
const T = (s: T) => L(s[0], s[1])
const c = computed(() => CFG[props.state] ?? CFG.overview)

const X0 = 12
const WID = 336
const cw = computed(() => WID / c.value.n)
const cellX = (i: number) => X0 + i * cw.value
const cx = (i: number) => cellX(i) + (cw.value - 3) / 2
const LAYERS: T[] = [['Pages (Linux)', '页面（Linux）'], ['Redis', 'Redis'], ['PostgreSQL', 'PostgreSQL'], ['CPU cache', 'CPU 缓存']]
const SAMPLE = [1, 4, 6, 8, 11]
const accPath = computed(() => {
  const x = cx(c.value.acc ?? 0)
  return `M43,76 C43,104 ${x},88 ${x},117`
})
// the two lists: the active list's head is at the right, so demotion is a short step down at the left
const AY = 120
const IY = 206
const W12 = 28
const c12 = (i: number) => X0 + i * W12 + 12.5
const ACTIVE_REF = [2, 7]
const INACTIVE_REF = [3, 8]
const PTE_A = [1, 4]
const PTE_B = [2]
// generations, youngest on the left
const GENS: { fill: number; name: T }[] = [
  { fill: 3, name: ['youngest (max_seq)', '最年轻（max_seq）'] },
  { fill: 5, name: ['', ''] },
  { fill: 7, name: ['', ''] },
  { fill: 10, name: ['oldest (min_seq)', '最老（min_seq）'] },
]
const GX = (i: number) => 12 + i * 85
const OVER: T[][] = [
  [['Linux', 'Linux'], ['PTE accessed bit', 'PTE 访问位'], ['clock hands, generations', '时钟指针、代']],
  [['Redis', 'Redis'], ['24-bit clock', '24 位时钟'], ['a sample of five', '五个样本']],
  [['PostgreSQL', 'PostgreSQL'], ['usage count', '使用计数'], ['clock sweep', '时钟扫描']],
  [['CPU cache', 'CPU 缓存'], ['a few PLRU bits', '几个 PLRU 位'], ['a walk down a bit tree', '沿位树走一趟']],
]
// the 8-way set's tree: after ways 0..7 in order, then a hit on way 0
const NODES = [
  { id: 1, x: 180, y: 46, bit: 1, kids: [2, 3] },
  { id: 2, x: 96, y: 74, bit: 1, kids: [4, 5] },
  { id: 3, x: 264, y: 74, bit: 0, kids: [6, 7] },
  { id: 4, x: 54, y: 100, bit: 1, kids: [0, 1] },
  { id: 5, x: 138, y: 100, bit: 0, kids: [2, 3] },
  { id: 6, x: 222, y: 100, bit: 0, kids: [4, 5] },
  { id: 7, x: 306, y: 100, bit: 0, kids: [6, 7] },
]
const nodeXY = (id: number) => NODES.find((n) => n.id === id)!
const FOLLOW = [1, 3, 6]
// the sets of a cache, each a row of ways
const SETS = [
  { y: 120, kind: 'a' }, { y: 132, kind: '' }, { y: 144, kind: 'b' }, { y: 156, kind: '' },
  { y: 168, kind: '' }, { y: 180, kind: 'a' }, { y: 192, kind: '' }, { y: 204, kind: 'b' }, { y: 216, kind: '' }, { y: 228, kind: '' },
]
</script>

<template>
  <PlruDemo v-if="demo && state === 'plru'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A cache: the work on every access, the hints, and the decision at eviction', '一个缓存：每次访问做的事、提示，以及淘汰时的决定')">
    <defs>
      <marker id="al-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <marker id="al-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="bad-head" />
      </marker>
    </defs>

    <!-- which layer -->
    <g :class="part('layer')">
      <g v-for="(l, i) in LAYERS" :key="i">
        <rect :x="12 + i * 85" y="8" width="81" height="18" rx="9" class="chip" :class="{ here: c.layers.includes(i) }" />
        <text :x="52.5 + i * 85" y="21" class="tiny c chipword" :class="{ here: c.layers.includes(i) }">{{ T(l) }}</text>
      </g>
    </g>

    <!-- the lane of work on every access -->
    <g :class="part('work')">
      <text x="12" y="56" class="tag hi">{{ T(c.work[0]) }}</text>
      <text x="12" y="71" class="tag">{{ T(c.work[1]) }}</text>
    </g>
    <g :class="part('access')">
      <rect x="12" y="46" width="62" height="30" rx="5" class="box" />
      <text x="43" y="65" class="tiny c">{{ L('an access', '一次访问') }}</text>
      <text x="84" y="56" class="tag hi">{{ T(c.work[0]) }}</text>
      <text x="84" y="71" class="tag">{{ T(c.work[1]) }}</text>
      <path v-if="c.acc !== undefined" :d="accPath" class="call" marker-end="url(#al-arrow)" />
    </g>

    <!-- the items, and their hints -->
    <g :class="part('items')">
      <rect
        v-for="i in c.n"
        :key="i"
        :x="cellX(i - 1)"
        y="120"
        :width="cw - 3"
        height="34"
        rx="3"
        class="box item"
        :class="{ acc: c.acc === i - 1, victim: c.victim === i - 1 }"
      />
      <text v-for="i in c.n" :key="'t' + i" :x="cx(i - 1)" y="142" class="lbl c small">{{ c.labels?.[i - 1] ?? '' }}</text>
    </g>
    <g :class="part('hints')">
      <text v-for="(h, i) in c.hint ?? []" :key="i" :x="cx(i)" y="169" class="code c hint">{{ h }}</text>
    </g>
    <g :class="part('links')">
      <path v-for="i in c.n - 1" :key="i" :d="`M${cx(i - 1)},156 Q${(cx(i - 1) + cx(i)) / 2},166 ${cx(i)},156`" class="link" />
      <text :x="cx(0)" y="178" class="tiny c hi">{{ L('most recent', '最近用过') }}</text>
      <text :x="cx(11)" y="178" class="tiny c hi">{{ L('least', '最久') }}</text>
    </g>
    <g :class="part('move')">
      <path :d="`M${cx(8) + 5},118 C${cx(8)},100 ${cx(0)},100 ${cx(0)},117`" class="danger" marker-end="url(#al-bad)" />
    </g>
    <g :class="part('hand')">
      <path v-if="c.hand !== undefined" :d="`M${cx(c.hand) - 5},187 L${cx(c.hand)},178 L${cx(c.hand) + 5},187 z`" class="handmark" />
      <text v-if="c.hand !== undefined" :x="cx(c.hand) + 9" y="186" class="tiny">{{ L('hand', '指针') }}</text>
      <text v-if="c.victim !== undefined" :x="cx(c.victim)" y="114" class="tiny c bad-text">{{ L('victim', '牺牲者') }}</text>
    </g>
    <g :class="part('loop')">
      <path d="M346,178 C358,196 352,201 340,201 L24,201 C8,201 6,192 10,180" class="link solid" marker-end="url(#al-arrow)" />
      <text x="260" y="196" class="tiny c">{{ L('the row wraps: really a circle', '这一行首尾相接，其实是一个圈') }}</text>
    </g>
    <g :class="part('ring')">
      <circle cx="30" cy="229" r="15" class="ringline" />
      <circle cx="30" cy="229" r="9" class="ringline thin" />
      <text x="54" y="226" class="tag hi">{{ L('a large sequential scan', '大的顺序扫描') }}</text>
      <text x="54" y="240" class="tag">{{ L('gets a private 256 KB ring and recycles it', '拿到一个私有的 256 KB 环，循环复用') }}</text>
    </g>
    <g :class="part('sample')">
      <rect v-for="i in SAMPLE" :key="i" :x="cellX(i) - 2" y="116" :width="cw + 1" height="56" rx="5" class="outline warn" />
      <text x="12" y="192" class="tiny hi">{{ L('sampled at random; the number is seconds idle', '随机抽样；数字是闲置秒数') }}</text>
      <text :x="cx(1)" y="114" class="tiny c bad-text">{{ L('victim', '牺牲者') }}</text>
    </g>
    <g :class="part('pool')">
      <rect v-for="i in 16" :key="i" :x="12 + (i - 1) * 21" y="214" width="19" height="18" rx="2" class="box item" :class="{ pooled: i > 5 }" />
      <text x="12" y="208" class="tiny">{{ L('eviction pool: 16 candidates, idlest to the right', '淘汰池：16 个候选者，闲置最久的在右') }}</text>
      <path d="M340,233 L340,248" class="danger" marker-end="url(#al-bad)" />
    </g>

    <!-- two lists -->
    <g :class="part('lists')">
      <text x="12" y="116" class="tag hi">{{ L('active', '活跃') }}</text>
      <text x="348" y="116" class="tiny end">{{ L('head', '头') }}</text>
      <text x="60" y="116" class="tiny">{{ L('tail', '尾') }}</text>
      <template v-for="i in 12" :key="i">
        <rect :x="X0 + (i - 1) * W12" :y="AY" width="25" height="30" rx="3" class="box item" />
        <rect :x="X0 + (i - 1) * W12" :y="IY" width="25" height="30" rx="3" class="box item" :class="{ victim: i === 12 }" />
      </template>
      <circle v-for="i in ACTIVE_REF" :key="'a' + i" :cx="c12(i)" :cy="AY + 15" r="3" class="ref" />
      <circle v-for="i in INACTIVE_REF" :key="'n' + i" :cx="c12(i)" :cy="IY + 15" r="3" class="ref" />
      <text x="60" y="202" class="tag hi">{{ L('inactive', '非活跃') }}</text>
      <text x="348" y="202" class="tiny end">{{ L('tail', '尾') }}</text>
      <path :d="`M${c12(0)},152 L${c12(0)},204`" class="call" marker-end="url(#al-arrow)" />
      <text :x="c12(0) + 6" y="184" class="tiny">{{ L('demoted', '降级') }}</text>
      <path :d="`M${c12(8)},204 L${c12(11)},152`" class="call" marker-end="url(#al-arrow)" />
      <text :x="c12(8) - 6" y="184" class="tiny end">{{ L('referenced again: promoted', '再次被引用：提升') }}</text>
      <path :d="`M${c12(0)},256 L${c12(0)},238`" class="link solid" marker-end="url(#al-arrow)" />
      <text :x="c12(0) + 6" y="254" class="tiny">{{ L('new file pages', '新的文件页') }}</text>
      <path :d="`M${c12(11)},238 L${c12(11)},256`" class="danger" marker-end="url(#al-bad)" />
      <text :x="c12(11) - 6" y="254" class="tiny end bad-text">{{ L('reclaimed', '被回收') }}</text>
    </g>
    <g :class="part('inactive')">
      <rect v-for="i in 12" :key="i" :x="X0 + (i - 1) * W12" :y="IY" width="25" height="30" rx="3" class="box item" :class="{ hot: i === 7 }" />
      <text x="12" y="202" class="tag hi">{{ L('pages on the inactive list', '非活跃链表上的页') }}</text>
    </g>

    <!-- two processes' page tables, and the reverse map -->
    <g :class="part('ptes')">
      <text x="20" y="116" class="tiny">{{ L('process A’s page table', '进程 A 的页表') }}</text>
      <text x="212" y="116" class="tiny">{{ L('process B’s page table', '进程 B 的页表') }}</text>
      <template v-for="i in 6" :key="i">
        <rect :x="20 + (i - 1) * 22" y="120" width="20" height="30" rx="2" class="box item" :class="{ acc: i === 5 }" />
        <rect :x="212 + (i - 1) * 22" y="120" width="20" height="30" rx="2" class="box item" :class="{ acc: i === 3 }" />
      </template>
      <circle v-for="i in PTE_A" :key="'a' + i" :cx="30 + i * 22" cy="135" r="3" class="ref" />
      <circle v-for="i in PTE_B" :key="'b' + i" :cx="222 + i * 22" cy="135" r="3" class="ref" />
      <path d="M43,76 C43,98 118,92 118,118" class="call" marker-end="url(#al-arrow)" />
      <text x="20" y="162" class="tiny">{{ L('dot: accessed bit set', '圆点：访问位已置') }}</text>
      <path :d="`M${c12(6)},204 C${c12(6)},182 118,176 118,152`" class="link solid" marker-end="url(#al-arrow)" />
      <path :d="`M${c12(6)},204 C${c12(6)},182 266,176 266,152`" class="link solid" marker-end="url(#al-arrow)" />
      <text x="188" y="178" class="tiny c">{{ L('reverse map', '反向映射') }}</text>
    </g>

    <!-- a file's page-cache slots, with one shadow entry -->
    <g :class="part('cacheslots')">
      <text x="12" y="116" class="tiny">{{ L('this file’s page-cache slots', '这个文件的页缓存槽位') }}</text>
      <rect v-for="i in 12" :key="i" :x="X0 + (i - 1) * W12" y="120" width="25" height="30" rx="3" class="box item" :class="{ filled: [1, 2, 5, 9].includes(i) }" />
    </g>
    <g :class="part('shadow')">
      <rect :x="X0 + 6 * W12" y="120" width="25" height="30" rx="3" class="shadow-cell" />
      <path :d="`M${c12(6)},152 L${c12(6)},166`" class="link solid" />
      <text :x="c12(6)" y="178" class="tiny c hi">{{ L('shadow entry: “evicted at count 1,000”', '影子表项：“在计数 1,000 时淘汰”') }}</text>
    </g>

    <!-- generations, youngest on the left -->
    <g :class="part('gens')">
      <g v-for="(g, i) in GENS" :key="i">
        <text :x="GX(i)" y="116" class="tiny">{{ T(g.name) }}</text>
        <rect :x="GX(i)" y="120" width="81" height="76" rx="5" class="box" />
        <rect v-for="k in g.fill" :key="k" :x="GX(i) + 6 + ((k - 1) % 5) * 14" :y="130 + Math.floor((k - 1) / 5) * 22" width="11" height="18" rx="2" class="pg" :class="{ used: i > 0 && k === 1 }" />
      </g>
      <path :d="`M${GX(2) + 12},196 C${GX(2) + 12},232 ${GX(0) + 40},232 ${GX(0) + 40},198`" class="call" marker-end="url(#al-arrow)" />
      <text :x="GX(1) + 30" y="240" class="tiny c">{{ L('aging: accessed, so moved to the youngest', '老化：被访问过，移入最年轻的一代') }}</text>
      <path :d="`M${GX(3) + 58},198 L${GX(3) + 58},232`" class="danger" marker-end="url(#al-bad)" />
      <text :x="GX(3) + 54" y="228" class="tiny end bad-text">{{ L('evict', '淘汰') }}</text>
    </g>

    <!-- page tables walked directly, with a Bloom filter -->
    <g :class="part('tables')">
      <text x="12" y="116" class="tiny">{{ L('an upper-level table', '上层页表') }}</text>
      <rect v-for="i in 8" :key="i" :x="12 + (i - 1) * 22" y="120" width="20" height="18" rx="2" class="box item" :class="{ pooled: i === 2 || i === 6 }" />
      <path d="M45,140 L118,174" class="link solid" marker-end="url(#al-arrow)" />
      <path d="M133,140 L250,174" class="link dashfaint" marker-end="url(#al-arrow)" />
      <text x="12" y="172" class="tiny">{{ L('PTE page, scanned', '页表页，被扫描') }}</text>
      <rect v-for="i in 16" :key="'a' + i" :x="12 + (i - 1) * 11" y="176" width="10" height="18" rx="1.5" class="item-c" :class="{ on: [2, 3, 4, 8, 9].includes(i) }" />
      <rect v-for="i in 8" :key="'b' + i" :x="200 + (i - 1) * 11" y="176" width="10" height="18" rx="1.5" class="item-c faint" />
      <text x="200" y="208" class="tiny">{{ L('on x86: no access above, skipped', 'x86：上层表项没人访问，跳过') }}</text>
      <text x="12" y="208" class="tiny">{{ L('dark: accessed; neighbours share cache lines', '深色：访问过；相邻项共享缓存行') }}</text>
    </g>
    <g :class="part('bloom')">
      <rect x="12" y="218" width="336" height="28" rx="5" class="box gate" />
      <text x="20" y="236" class="lbl small">{{ L('Bloom filter', '布隆过滤器') }}</text>
      <text x="340" y="236" class="tiny end">{{ L('“this page-table page was worth it”', '“这一页页表值得再扫”') }}</text>
    </g>

    <!-- the 24 bits -->
    <g :class="part('bits24')">
      <text x="12" y="116" class="tiny">{{ L('under LRU policies', 'LRU 策略下') }}</text>
      <rect x="12" y="120" width="336" height="28" rx="3" class="box" />
      <text x="180" y="139" class="code c">{{ L('24 bits: clock, in seconds', '24 位：时钟，以秒计') }}</text>
      <text x="12" y="172" class="tiny">{{ L('under LFU policies', 'LFU 策略下') }}</text>
      <rect x="12" y="176" width="224" height="28" rx="3" class="box" />
      <text x="124" y="195" class="code c">{{ L('16 bits: last access, minutes', '16 位：最近访问，以分钟计') }}</text>
      <rect x="236" y="176" width="112" height="28" rx="3" class="box gate" />
      <text x="292" y="195" class="code c">{{ L('8-bit counter', '8 位计数器') }}</text>
    </g>

    <!-- an 8-way set as a tree of bits -->
    <g :class="part('tree')">
      <template v-for="n in NODES" :key="n.id">
        <line v-for="(k, side) in n.kids" :key="side" :x1="n.x" :y1="n.y + 9" :x2="n.id >= 4 ? cx(k) : nodeXY(k).x" :y2="n.id >= 4 ? 118 : nodeXY(k).y - 9" class="edge" :class="{ point: n.bit === side, walk: FOLLOW.includes(n.id) && n.bit === side }" />
      </template>
      <template v-for="n in NODES" :key="'n' + n.id">
        <circle :cx="n.x" :cy="n.y" r="9" class="bitnode" :class="{ walk: FOLLOW.includes(n.id) }" />
        <text :x="n.x" :y="n.y + 4" class="code c">{{ n.bit }}</text>
      </template>
    </g>

    <!-- the sets of a cache -->
    <g :class="part('sets')">
      <text x="12" y="116" class="tiny">{{ L('sets of a cache (rows); a few are dedicated', '缓存的组（每行一组），其中少数是专用的') }}</text>
      <template v-for="(s, i) in SETS" :key="i">
        <rect v-for="k in 12" :key="k" :x="60 + (k - 1) * 18" :y="s.y" width="16" height="10" rx="1.5" class="way" :class="s.kind" />
        <text x="12" :y="s.y + 9" class="tiny" :class="s.kind + 'word'">{{ s.kind === 'a' ? L('policy A', '策略 A') : s.kind === 'b' ? L('policy B', '策略 B') : L('follows', '跟随') }}</text>
      </template>
    </g>

    <!-- the lane of decisions at eviction -->
    <g :class="part('decide')">
      <text x="12" y="272" class="tag hi">{{ T(c.decide[0]) }}</text>
      <text x="12" y="287" class="tag">{{ T(c.decide[1]) }}</text>
    </g>

    <!-- this state's numbers -->
    <g :class="part('s-overview')">
      <text x="12" y="312" class="tiny">{{ L('layer', '层次') }}</text>
      <text x="96" y="312" class="tiny">{{ L('the hint', '提示') }}</text>
      <text x="236" y="312" class="tiny">{{ L('the decision', '决定') }}</text>
      <g v-for="(r, i) in OVER" :key="i">
        <text x="12" :y="330 + i * 17" class="tag hi">{{ T(r[0]) }}</text>
        <text x="96" :y="330 + i * 17" class="tag">{{ T(r[1]) }}</text>
        <text x="236" :y="330 + i * 17" class="tag">{{ T(r[2]) }}</text>
      </g>
    </g>
    <g :class="part('s-exact')">
      <text x="12" y="312" class="tag hi">{{ L('bits per set, n-way CPU cache', 'n 路 CPU 缓存，每组所需的位数') }}</text>
      <text x="12" y="330" class="tiny">{{ L('ways', '路数') }}</text>
      <text x="70" y="330" class="tiny">{{ L('orders (n!)', '顺序数（n!）') }}</text>
      <text x="196" y="330" class="tiny">{{ L('exact LRU', '精确 LRU') }}</text>
      <text x="270" y="330" class="tiny">tree-PLRU</text>
      <g v-for="(r, i) in [['4', '24', '5', '3'], ['8', '40,320', '16', '7'], ['16', '≈ 2.1 × 10¹³', '45', '15']]" :key="i">
        <text x="12" :y="348 + i * 17" class="code">{{ r[0] }}</text>
        <text x="70" :y="348 + i * 17" class="code">{{ r[1] }}</text>
        <text x="196" :y="348 + i * 17" class="code">{{ r[2] }}</text>
        <text x="270" :y="348 + i * 17" class="code">{{ r[3] }}</text>
      </g>
      <text x="12" y="412" class="tag">{{ L('in software: two pointers, 16 bytes, per item', '在软件里：每项两个指针，16 字节') }}</text>
    </g>
    <g :class="part('s-clock')">
      <text x="12" y="312" class="tag hi">{{ L('the cost moved', '代价搬了家') }}</text>
      <text x="12" y="328" class="tag">{{ L('from every access to every eviction', '从每次访问，挪到每次淘汰') }}</text>
    </g>
    <g :class="part('s-family')">
      <text x="12" y="312" class="tag hi">{{ L('refinements of CLOCK', '时钟算法的改进') }}</text>
      <text x="12" y="328" class="tag">{{ L('more than one bit: PostgreSQL’s usage count', '不止一位：PostgreSQL 的使用计数') }}</text>
      <text x="12" y="344" class="tag">{{ L('prefer cheap victims: clean pages first', '优先挑便宜的：先淘汰干净页') }}</text>
      <text x="12" y="360" class="tag">{{ L('scan resistance: PostgreSQL’s buffer ring', '抗扫描：PostgreSQL 的缓冲环') }}</text>
      <text x="12" y="376" class="tag">{{ L('less on a hit: SIEVE, FIFO order, a visited bit', '命中时少做事：SIEVE，FIFO 顺序，一个已访问位') }}</text>
    </g>
    <g :class="part('s-twolist')">
      <text x="12" y="312" class="tag hi">{{ L('dot: referenced flag set', '圆点：referenced 标志已置') }}</text>
      <text x="12" y="328" class="tag">{{ L('one pair for anonymous pages, one for file pages', '匿名页一对，文件页一对') }}</text>
      <text x="12" y="344" class="tag">{{ L('and each memory cgroup has its own', '每个内存 cgroup 也各有一套') }}</text>
    </g>
    <g :class="part('s-rmap')">
      <text x="12" y="312" class="tag hi">{{ L('a page read through read() has no PTE', '通过 read() 读取的页没有 PTE') }}</text>
      <text x="12" y="328" class="tag">{{ L('so the kernel marks it itself', '于是内核自己打标记') }}</text>
    </g>
    <g :class="part('s-refault')">
      <text x="12" y="312" class="tag hi">{{ L('for example', '举个例子') }}</text>
      <text x="12" y="328" class="tag">{{ L('evicted at count 1,000; read back at 1,040', '在计数 1,000 时淘汰；在 1,040 时读回') }}</text>
      <text x="12" y="344" class="tag">{{ L('refault distance: 40 other pages evicted meanwhile', '回迁距离：其间又淘汰了 40 个别的页') }}</text>
      <text x="12" y="360" class="tag">{{ L('small: it would have survived a larger active list', '很小：活跃链表再大一点，它就不会被淘汰') }}</text>
    </g>
    <g :class="part('s-mglru')">
      <text x="12" y="312" class="tag hi">{{ L('a clock with two hands (pink: found accessed)', '一个有两根指针的时钟（粉色：发现被访问过）') }}</text>
      <text x="12" y="328" class="tag">{{ L('aging adds a new youngest generation', '老化新建一个最年轻的代') }}</text>
      <text x="12" y="344" class="tag">{{ L('eviction empties the oldest, then moves on', '淘汰取空最老的一代，再往前走') }}</text>
    </g>
    <g :class="part('s-walk')">
      <text x="12" y="312" class="tag hi">{{ L('instead of page by page through the reverse map', '不再沿反向映射逐页去找') }}</text>
    </g>
    <g :class="part('s-redis')">
      <text x="12" y="312" class="tag hi">{{ L('the 24-bit clock ticks once a second', '24 位时钟每秒走一格') }}</text>
      <text x="12" y="328" class="tag">{{ L('it wraps after 2²⁴ seconds, about 194 days', '2²⁴ 秒、约 194 天后回绕') }}</text>
      <text x="12" y="344" class="tag">{{ L('samples: 5 by default (maxmemory-samples)', '样本数默认 5（maxmemory-samples）') }}</text>
    </g>
    <g :class="part('s-lfu')">
      <text x="12" y="312" class="tag hi">{{ L('counter at lfu-log-factor 10', 'lfu-log-factor 为 10 时的计数器') }}</text>
      <g v-for="(r, i) in [['100', '10'], ['1,000', '18'], ['100,000', '142'], ['1,000,000', '255']]" :key="i">
        <text x="12" :y="330 + i * 15" class="code">{{ r[0] }} {{ L('hits', '次命中') }}</text>
        <text x="150" :y="330 + i * 15" class="code">→ {{ r[1] }}</text>
      </g>
    </g>
    <g :class="part('s-plru')">
      <text x="12" y="312" class="tag hi">{{ L('8 ways: 7 bits, against 16 for exact LRU', '8 路：7 位，而精确 LRU 要 16 位') }}</text>
      <text x="12" y="328" class="tag">{{ L('t = when each way was last used', 't = 这一路最后被使用的时刻') }}</text>
      <text x="12" y="344" class="tag">{{ L('oldest is way 1, yet the bits lead to way 4', '最老的是第 1 路，这些位却指向第 4 路') }}</text>
    </g>
    <g :class="part('s-dueling')">
      <text x="12" y="312" class="tag hi">{{ L('set dueling, on Haswell and Broadwell L3', 'Haswell 和 Broadwell 的 L3：组决斗') }}</text>
      <text x="12" y="328" class="tag">{{ L('known from measurement: vendors rarely say', '来自测量：厂商很少公开') }}</text>
    </g>
    <g :class="part('s-bends')">
      <text x="12" y="312" class="tag">{{ L('one bit forgets too fast: counters, tiers', '一位忘得太快：于是有计数器、层') }}</text>
      <text x="12" y="328" class="tag">{{ L('reading hints costs CPU: page-table walks', '读提示要花 CPU：于是遍历页表') }}</text>
      <text x="12" y="344" class="tag">{{ L('scans fool recency: lists, rings, insertion', '扫描骗过新近程度：链表、环、插入位置') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.tiny.hi {
  fill: var(--ink-2);
  font-weight: 600;
}
.small {
  font-size: 10.5px;
}
.hint {
  font-size: 9px;
}
.chip {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.chip.here {
  fill: var(--ink-2);
  stroke: none;
}
.chipword.here {
  fill: var(--bg);
  font-weight: 600;
}
.box.item.acc {
  stroke: var(--ink-2);
  stroke-width: 1.8;
}
.box.item.victim {
  stroke: var(--p3);
  stroke-width: 2;
}
.box.item.hot {
  fill: var(--p0);
  stroke: none;
}
.box.item.filled {
  fill: var(--p1);
  stroke: none;
}
.box.item.pooled {
  fill: var(--rule-strong);
  stroke: none;
}
.bad-head {
  fill: var(--p3);
}
.handmark {
  fill: var(--ink-2);
}
.ref {
  fill: var(--p3);
}
.ringline {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.4;
  stroke-dasharray: 4 3;
}
.ringline.thin {
  stroke-dasharray: none;
  stroke: var(--rule-strong);
}
.shadow-cell {
  fill: var(--p4);
}
.pg {
  fill: var(--p0);
}
.pg.used {
  fill: var(--p3);
}
.item-c {
  fill: var(--rule-strong);
}
.item-c.on {
  fill: var(--ink-2);
}
.item-c.faint {
  opacity: 0.4;
}
.dashfaint {
  opacity: 0.5;
}
.edge {
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.edge.point {
  stroke: var(--ink-2);
  stroke-width: 1.6;
}
.edge.walk {
  stroke: var(--p3);
  stroke-width: 2;
}
.bitnode {
  fill: var(--bg-elev);
  stroke: var(--ink-2);
  stroke-width: 1.2;
}
.bitnode.walk {
  stroke: var(--p3);
  stroke-width: 2;
}
.way {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 0.8;
}
.way.a {
  fill: var(--p0);
  stroke: none;
}
.way.b {
  fill: var(--p1);
  stroke: none;
}
.aword {
  fill: var(--p0);
  font-weight: 600;
}
.bword {
  fill: var(--p1);
  font-weight: 600;
}
.lit .box.item {
  stroke: var(--accent);
  stroke-width: 2;
}
.lit .tiny {
  fill: var(--accent-ink);
}
.lit .shadow-cell,
.lit .pg {
  fill: var(--accent);
}
</style>
