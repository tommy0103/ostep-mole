<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import MallocDemo from './MallocDemo.vue'

/**
 * The running figure of the allocators article: one allocator in layers, top to bottom. Threads
 * call malloc; a cache in front answers most calls without a lock; a slower shared layer refills
 * it; the kernel supplies the pages. Each allocator in the article redraws the shared layer and
 * relabels the rest. Below the layers is a strip for what a state adds.
 */
const props = defineProps<DrawingProps>()

const BX = [64, 162, 260] // the three columns of threads and caches
const BW = 90
const mid = (i: number) => BX[i] + BW / 2

const SHOW: Record<string, string[]> = {
  overview: ['threads', 'calls', 'caches', 'refill', 'shared', 'runs', 'kernel', 'link', 'skeleton'],
  book: ['threads', 'contend', 'shared', 'heap', 'kernel', 'link', 'problems'],
  common: ['threads', 'calls', 'caches', 'refill', 'shared', 'runs', 'kernel', 'link', 'cachenote'],
  glibc: ['threads', 'calls', 'caches', 'refill', 'shared', 'arenas', 'kernel', 'link', 'mmap', 'chunk'],
  jemalloc: ['threads', 'calls', 'caches', 'refill', 'shared', 'jarenas', 'kernel', 'purge', 'jclasses'],
  tcmalloc: ['threads', 'calls', 'caches', 'refill', 'shared', 'tcm', 'kernel', 'link', 'pagemap'],
  mimalloc: ['threads', 'shared', 'mpage', 'kernel', 'link', 'cadence'],
  kernel: ['kcode', 'slub', 'pcp', 'buddy', 'buddysplit'],
  months: ['shared', 'pages', 'stuck', 'kernel', 'rssbars'],
  defrag: ['shared', 'pages', 'moves', 'returned', 'kernel', 'defragnote'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 420)

/* the row names in the left column */
const ROWS = computed(() => {
  if (props.state === 'kernel')
    return [
      { y: 33, t: L('kernel', '内核') },
      { y: 125, t: L('objects', '小对象') },
      { y: 234, t: L('per-CPU', '每 CPU') },
      { y: 298, t: L('pages', '物理页') },
    ]
  if (props.state === 'months' || props.state === 'defrag')
    return [
      { y: 195, t: L('shared', '共享层') },
      { y: 298, t: L('the OS', '操作系统') },
    ]
  const front = !['book', 'mimalloc'].includes(props.state)
  return [
    { y: 33, t: L('threads', '线程') },
    ...(front ? [{ y: 84, t: L('front', '前端'), s: L('no lock', '不加锁') }] : []),
    { y: 190, t: L('shared', '共享层'), s: L('slower', '较慢') },
    { y: 298, t: L('the OS', '操作系统') },
  ]
})

/* what each column's cache is called */
const cacheName = (i: number) =>
  props.state === 'tcmalloc' ? `CPU ${i}` : props.state === 'glibc' || props.state === 'jemalloc' ? 'tcache' : L('cache', '缓存')
const cacheNote = computed(() =>
  props.state === 'glibc' ? L('≤ 7 each', '每种 ≤ 7') : props.state === 'tcmalloc' ? 'rseq' : '',
)
const STACKS = [3, 2, 4, 1, 2]

/* size-class runs: slot width to scale with the class, some slots in use */
const RUNS = [
  { c: 16, w: 12, n: 20 },
  { c: 32, w: 16, n: 15 },
  { c: 48, w: 20, n: 12 },
  { c: 64, w: 24, n: 10 },
]
const used = (r: number, i: number) => (i * 7 + r * 3) % 5 < 3

/* chapter 17's heap: chunks in use and free chunks, in address order */
const HEAP = (() => {
  let x = 72
  return [
    { w: 34, free: false },
    { w: 44, free: true },
    { w: 52, free: false },
    { w: 26, free: true },
    { w: 40, free: false },
    { w: 64, free: true },
  ].map((c) => {
    const o = { ...c, x }
    x += c.w
    return o
  })
})()
const FREE = HEAP.filter((c) => c.free)

/* jemalloc: slabs of one class each */
const JSLABS = [
  { c: 16, w: 6 },
  { c: 32, w: 7 },
  { c: 48, w: 8 },
  { c: 160, w: 12 },
]

/* the kernel's slab caches */
const SLUBS = [
  { n: 'inode', w: 20, k: 8 },
  { n: 'dentry', w: 12, k: 13 },
  { n: 'kmalloc-64', w: 10, k: 16 },
  { n: 'kmalloc-192', w: 18, k: 9 },
]

/* buddy: blocks of 2^order pages, 16 units per page in the split example */
const SPLIT = [
  [{ x: 0, n: 8 }],
  [
    { x: 0, n: 4 },
    { x: 4, n: 4 },
  ],
  [
    { x: 0, n: 2 },
    { x: 2, n: 2 },
    { x: 4, n: 4 },
  ],
  [
    { x: 0, n: 1, take: true },
    { x: 1, n: 1 },
    { x: 2, n: 2 },
    { x: 4, n: 4 },
  ],
]

/* after deletions: four pages, 24 slots each; the live objects that remain */
const CELL = (p: number, i: number) => ({ x: 72 + p * 70 + (i % 6) * 10.2, y: 160 + Math.floor(i / 6) * 18 })
const defrag = computed(() => shown.value.has('moves'))
const LIVE = computed(() =>
  defrag.value
    ? [
        [2, 3, 4],
        [7, 15],
        [],
        [],
      ]
    : [[2], [7, 15], [10], [18]],
)
const moved = (p: number, i: number) => defrag.value && ((p === 2 && i === 10) || (p === 3 && i === 18))
const MOVES = computed(() =>
  [
    { from: CELL(2, 10), to: CELL(0, 3) },
    { from: CELL(3, 18), to: CELL(0, 4) },
  ].map(({ from, to }) => `M${from.x + 4.5},${from.y} C${from.x},142 ${to.x + 20},142 ${to.x + 4.5},${to.y - 1}`),
)
</script>

<template>
  <MallocDemo v-if="demo && state === 'glibc'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('An allocator in layers: threads, caches, a shared layer, the kernel', '分层的分配器：线程、缓存、共享层、内核')">
    <defs>
      <marker id="al-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <g id="al-lock">
        <path d="M2.5,5 V3.5 a2.5,2.5 0 0 1 5,0 V5" class="shackle" />
        <rect x="1" y="5" width="8" height="6" rx="1.2" class="lockbody" />
      </g>
    </defs>

    <!-- the rows' names -->
    <g v-for="r in ROWS" :key="r.t">
      <text x="10" :y="r.y" class="tag hi">{{ r.t }}</text>
      <text v-if="r.s" x="10" :y="r.y + 12" class="tag">{{ r.s }}</text>
    </g>

    <!-- threads -->
    <g :class="part('threads')">
      <g v-for="(x, i) in BX" :key="x">
        <rect :x="x" y="16" :width="BW" height="26" rx="5" class="box" />
        <text :x="x + BW / 2" y="33" class="sub c ink">{{ L(`thread ${i + 1}`, `线程 ${i + 1}`) }}</text>
      </g>
    </g>
    <g :class="part('calls')">
      <path v-for="i in 3" :key="i" :d="`M${mid(i - 1)},42 L${mid(i - 1)},62`" class="call" marker-end="url(#al-arrow)" />
    </g>

    <!-- the cache in front of the shared layer -->
    <g :class="part('caches')">
      <g v-for="(x, i) in BX" :key="x">
        <rect :x="x" y="64" :width="BW" height="42" rx="5" class="box" />
        <text :x="x + 8" y="78" class="sub ink">{{ cacheName(i) }}</text>
        <text v-if="cacheNote" :x="x + BW - 6" y="78" class="tag end">{{ cacheNote }}</text>
        <g v-for="(n, c) in STACKS" :key="c">
          <rect v-for="k in n" :key="k" :x="x + 10 + c * 15" :y="102 - k * 5" width="11" height="4" rx="0.8" class="stack" />
        </g>
      </g>
    </g>
    <g :class="part('refill')">
      <path v-for="i in 3" :key="i" :d="`M${mid(i - 1)},108 L${mid(i - 1)},126`" class="call thin" marker-start="url(#al-arrow)" marker-end="url(#al-arrow)" />
      <text :x="mid(0) + 8" y="121" class="tag">{{ L('batches', '成批') }}</text>
    </g>

    <!-- the shared layer -->
    <g :class="part('shared')">
      <rect x="64" y="128" width="288" height="134" rx="6" class="box" />
    </g>

    <!-- generic size-class runs -->
    <g :class="part('runs')">
      <text x="72" y="143" class="tag hi">{{ L('runs of memory, one size class each', '内存区块，每块一种尺寸') }}</text>
      <g v-for="(r, ri) in RUNS" :key="r.c">
        <text x="72" :y="162 + ri * 22" class="code">{{ r.c }}</text>
        <g v-for="i in r.n" :key="i">
          <rect :x="100 + (i - 1) * r.w" :y="150 + ri * 22" :width="r.w - 1" height="16" rx="1.5" class="cell" />
          <rect v-if="used(ri, i)" :x="100 + (i - 1) * r.w" :y="150 + ri * 22" :width="r.w - 1" height="16" rx="1.5" class="muted-fill" />
        </g>
      </g>
      <text x="72" y="252" class="tag">{{ L('inside a run: pop a free slot or scan a bitmap', '区块内部：弹出一个空闲槽位，或扫一下位图') }}</text>
    </g>

    <!-- chapter 17's allocator -->
    <g :class="part('contend')">
      <path v-for="i in 3" :key="i" :d="`M${mid(i - 1)},42 L${200 + (i - 1) * 8},112`" class="call" marker-end="url(#al-arrow)" />
      <use href="#al-lock" x="203" y="116" />
      <text x="218" y="124" class="tag hi">{{ L('one lock', '一把锁') }}</text>
    </g>
    <g :class="part('heap')">
      <text x="72" y="143" class="tag hi">{{ L('one free list, searched on every call', '一个空闲列表，每次调用都要查') }}</text>
      <g v-for="c in HEAP" :key="c.x">
        <rect :x="c.x" y="182" :width="c.w - 1" height="26" rx="1.5" :class="c.free ? 'cell' : 'muted-fill'" />
        <rect v-if="c.free" :x="c.x" y="182" width="4" height="26" rx="1" class="hdr" />
      </g>
      <path v-for="(c, i) in FREE.slice(0, -1)" :key="c.x" :d="`M${c.x + 8},180 C${c.x + 8},156 ${FREE[i + 1].x + 8},156 ${FREE[i + 1].x + 8},178`" class="link solid" marker-end="url(#al-arrow)" />
      <text x="72" y="224" class="tag">{{ L('free chunks (white) are linked; grey are in use', '白色的空闲块串成链表，灰色的在用') }}</text>
      <text x="72" y="240" class="tag">{{ L('best or first fit; neighbours coalesce on free', '最优或首次匹配；释放时与邻居合并') }}</text>
    </g>

    <!-- glibc: arenas -->
    <g :class="part('arenas')">
      <text x="72" y="143" class="tag hi">{{ L('arenas: up to 8 per core on 64-bit; Heroku set 2', 'arena：64 位上每核最多 8 个；Heroku 设为 2') }}</text>
      <g v-for="(x, a) in [70, 211]" :key="x">
        <rect :x="x" y="148" width="135" height="110" rx="4" class="box inner" />
        <text :x="x + 6" y="162" class="tag hi">arena {{ a + 1 }}</text>
        <use href="#al-lock" :x="x + 120" y="152" />
        <text :x="x + 6" y="180" class="tag">{{ L('small bins', '小桶') }}</text>
        <text :x="x + 6" y="198" class="tag">{{ L('unsorted', '未排序桶') }}</text>
        <text :x="x + 6" y="216" class="tag">{{ L('large bins', '大桶') }}</text>
        <g v-for="(row, r) in [[9, 9, 9, 12], [12, 26, 9], [34, 26]]" :key="r">
          <g v-for="(w, i) in row" :key="i">
            <rect :x="x + 60 + row.slice(0, i).reduce((s, v) => s + v + 3, 0)" :y="171 + r * 18" :width="w" height="10" rx="1" class="cell" />
            <rect :x="x + 60 + row.slice(0, i).reduce((s, v) => s + v + 3, 0)" :y="171 + r * 18" width="2.5" height="10" class="hdr" />
          </g>
        </g>
        <rect :x="x + 6" y="226" width="123" height="26" rx="2" class="muted-fill" />
        <text :x="x + 67" y="243" class="sub c ink">{{ L('top chunk', '顶端块') }}</text>
      </g>
    </g>
    <g :class="part('chunk')">
      <text x="12" y="330" class="tag hi">{{ L('a chunk', '一个块（chunk）') }}</text>
      <rect x="64" y="338" width="78" height="20" rx="2" class="cell hot" />
      <rect x="142" y="338" width="180" height="20" rx="2" class="cell" />
      <text x="103" y="352" class="sub c">{{ L('size + flags', '大小 + 标志') }}</text>
      <text x="232" y="352" class="sub c">{{ L('your data', '你的数据') }}</text>
      <text x="12" y="376" class="tag">{{ L('the size’s low bits hold flags, such as “previous chunk in use”,', '大小字段的低位存标志，比如“前一个块在用”，') }}</text>
      <text x="12" y="391" class="tag">{{ L('which lets free coalesce without a search', 'free 因此不用查找就能与邻居合并') }}</text>
    </g>

    <!-- jemalloc -->
    <g :class="part('jarenas')">
      <text x="72" y="143" class="tag hi">{{ L('arenas, 4 per CPU · each slab has a bitmap', 'arena，每 CPU 4 个 · 每个 slab 一张位图') }}</text>
      <g v-for="(x, a) in [70, 211]" :key="x">
        <rect :x="x" y="148" width="135" height="110" rx="4" class="box inner" />
        <text :x="x + 6" y="162" class="tag hi">arena {{ a + 1 }}</text>
        <g v-for="(s, r) in JSLABS" :key="s.c">
          <text :x="x + 6" :y="179 + r * 17" class="num">{{ s.c }}</text>
          <g v-for="i in Math.floor(96 / s.w)" :key="i">
            <rect :x="x + 32 + (i - 1) * s.w" :y="170 + r * 17" :width="s.w - 1" height="12" rx="1" class="cell" />
            <rect v-if="used(r + a, i)" :x="x + 32 + (i - 1) * s.w" :y="170 + r * 17" :width="s.w - 1" height="12" rx="1" class="muted-fill" />
          </g>
        </g>
        <text :x="x + 6" y="249" class="num">{{ L('dirty', '脏页') }}</text>
        <rect v-for="d in 4" :key="d" :x="x + 32 + (d - 1) * 15" y="240" width="12" height="12" rx="1" class="dirty" :opacity="1 - (d - 1) * 0.28" />
      </g>
    </g>
    <g :class="part('purge')">
      <path d="M132,252 L132,276" class="link solid" marker-end="url(#al-arrow)" />
      <text x="138" y="272" class="tag">{{ L('purged gradually, by default over about 10 s', '逐步清退，默认约 10 秒') }}</text>
    </g>
    <g :class="part('jclasses')">
      <text x="12" y="330" class="tag hi">{{ L('size classes: four per doubling', '尺寸类别：每翻一倍四档') }}</text>
      <text x="12" y="348" class="code">16 32 48 … 128</text>
      <text x="12" y="364" class="code">160 192 224 256</text>
      <text x="12" y="380" class="code">320 384 448 512</text>
      <text x="140" y="360" class="tag">{{ L('internal fragmentation about 20%,', '内部碎片限制在约 20%，') }}</text>
      <text x="140" y="374" class="tag">{{ L('for all but the smallest classes', '最小的几个类别除外') }}</text>
    </g>

    <!-- TCMalloc's middle and back ends -->
    <g :class="part('tcm')">
      <text x="72" y="143" class="tag hi">{{ L('middle end · 60 to 80 size classes', '中端 · 60 到 80 个尺寸类别') }}</text>
      <text x="72" y="164" class="sub ink">{{ L('transfer cache', '转移缓存') }}</text>
      <g v-for="g in 3" :key="g">
        <rect v-for="c in 5" :key="c" :x="170 + (g - 1) * 58 + (c - 1) * 10" y="152" width="9" height="16" rx="1" class="cell" />
        <circle v-for="c in 5 - g" :key="'d' + c" :cx="174.5 + (g - 1) * 58 + (c - 1) * 10" cy="160" r="1.8" class="dot" />
      </g>
      <text x="72" y="192" class="sub ink">{{ L('central free list', '中央空闲列表') }}</text>
      <text x="72" y="205" class="tag">{{ L('carved from spans', '从 span 里切出对象') }}</text>
      <g v-for="s in 3" :key="s">
        <rect :x="170 + (s - 1) * 58" y="178" width="50" height="26" rx="2" class="cell" />
        <path v-for="c in 4" :key="c" :d="`M${170 + (s - 1) * 58 + c * 10},178 L${170 + (s - 1) * 58 + c * 10},204`" class="grid" />
      </g>
      <rect x="66" y="214" width="284" height="44" rx="4" class="box inner" />
      <text x="72" y="232" class="sub ink">{{ L('back end', '后端') }}</text>
      <text x="72" y="247" class="tag">{{ L('hugepage-aware', '感知大页') }}</text>
      <rect x="170" y="220" width="84" height="32" rx="2" class="cell" />
      <rect x="172" y="222" width="28" height="28" rx="1" class="p0 soft" />
      <rect x="201" y="222" width="20" height="28" rx="1" class="p1 soft" />
      <rect x="222" y="222" width="30" height="28" rx="1" class="p2 soft" />
      <rect x="260" y="220" width="84" height="32" rx="2" class="cell" />
      <text x="212" y="240" class="num c strong">2 MiB</text>
      <text x="302" y="240" class="num c">{{ L('2 MiB, free', '2 MiB，空闲') }}</text>
    </g>
    <g :class="part('pagemap')">
      <text x="12" y="330" class="tag hi">{{ L('free(p): which span is p in?', 'free(p)：p 属于哪个 span？') }}</text>
      <g v-for="(n, i) in [L('level 1', '第 1 层'), L('level 2', '第 2 层'), L('level 3', '第 3 层'), 'span']" :key="i">
        <rect :x="12 + i * 88" y="338" width="60" height="20" rx="2" :class="i === 3 ? 'cell hot' : 'cell'" />
        <text :x="42 + i * 88" y="352" class="sub c">{{ n }}</text>
        <path v-if="i < 3" :d="`M${73 + i * 88},348 L${98 + i * 88},348`" class="call thin" marker-end="url(#al-arrow)" />
      </g>
      <text x="12" y="376" class="tag">{{ L('a two- or three-level radix tree,', '一棵两层或三层的基数树，') }}</text>
      <text x="12" y="391" class="tag">{{ L('the shape of a multi-level page table', '正是多级页表的形状') }}</text>
    </g>

    <!-- mimalloc: one page and its three lists -->
    <g :class="part('mpage')">
      <text x="72" y="143" class="tag hi">{{ L('page of thread 1: 64 KiB, one size class', '线程 1 的一页：64 KiB，一个尺寸类别') }}</text>
      <g v-for="(l, r) in [{ n: 'free', k: 4 }, { n: 'local_free', k: 2 }, { n: 'xthread_free', k: 2 }]" :key="l.n">
        <text x="72" :y="172 + r * 30" class="code">{{ l.n }}</text>
        <g v-for="i in l.k" :key="i">
          <rect :x="168 + (i - 1) * 32" :y="160 + r * 30" width="20" height="18" rx="2" class="cell" />
          <path v-if="i < l.k" :d="`M${189 + (i - 1) * 32},${169 + r * 30} L${199 + (i - 1) * 32},${169 + r * 30}`" class="call thin" marker-end="url(#al-arrow)" />
        </g>
      </g>
      <path d="M109,42 L109,126" class="call" marker-end="url(#al-arrow)" />
      <text x="116" y="88" class="tag">{{ L('owner: malloc, free', '所属线程：malloc、free') }}</text>
      <path d="M330,42 L330,229 L236,229" class="call" marker-end="url(#al-arrow)" />
      <text x="324" y="112" class="tag end">{{ L('another thread: free, one CAS', '其他线程：free，一次 CAS') }}</text>
    </g>
    <g :class="part('cadence')">
      <text x="12" y="330" class="tag hi">{{ L('three lists, split by who touches them', '按“谁在碰”拆成三个列表') }}</text>
      <text x="12" y="348" class="sub">{{ L('malloc pops from free, which only this thread touches', 'malloc 只从本线程独享的 free 里弹出') }}</text>
      <text x="12" y="366" class="sub">{{ L('every so often free runs out, and the slow path', 'free 隔一阵就用光，这时慢速路径') }}</text>
      <text x="12" y="381" class="sub">{{ L('folds local_free and xthread_free back into it', '把 local_free 和 xthread_free 并回来') }}</text>
    </g>

    <!-- the kernel's two layers -->
    <g :class="part('kcode')">
      <rect x="64" y="16" width="288" height="26" rx="5" class="box" />
      <text x="208" y="33" class="sub c ink">{{ L('kernel code: kmalloc() and object caches', '内核代码：kmalloc() 与各种对象缓存') }}</text>
      <path d="M208,42 L208,62" class="call" marker-end="url(#al-arrow)" />
    </g>
    <g :class="part('slub')">
      <rect x="64" y="64" width="288" height="132" rx="6" class="box" />
      <text x="72" y="79" class="tag hi">{{ L('slab allocator (SLUB)', 'slab 分配器（SLUB）') }}</text>
      <text x="344" y="79" class="code end">/proc/slabinfo</text>
      <g v-for="(s, r) in SLUBS" :key="s.n">
        <text x="72" :y="101 + r * 25" class="code">{{ s.n }}</text>
        <g v-for="i in s.k" :key="i">
          <rect :x="160 + (i - 1) * s.w" :y="88 + r * 25" :width="s.w - 1" height="18" rx="1.5" class="cell" />
          <rect v-if="used(r, i)" :x="160 + (i - 1) * s.w" :y="88 + r * 25" :width="s.w - 1" height="18" rx="1.5" class="muted-fill" />
        </g>
      </g>
      <path d="M208,196 L208,206" class="link solid" />
    </g>
    <g :class="part('pcp')">
      <text x="64" y="215" class="tag">{{ L('per-CPU lists of free pages, refilled and drained in batches', '每 CPU 的空闲页列表，成批补充和退回') }}</text>
      <g v-for="(x, i) in BX" :key="x">
        <rect :x="x" y="222" :width="BW" height="34" rx="5" class="box" />
        <text :x="x + 8" y="243" class="sub ink">CPU {{ i }}</text>
        <rect v-for="k in 3" :key="k" :x="x + 46 + (k - 1) * 13" y="233" width="11" height="11" rx="1" class="cell" />
      </g>
      <path v-for="i in 3" :key="i" :d="`M${mid(i - 1)},258 L${mid(i - 1)},276`" class="call thin" marker-start="url(#al-arrow)" marker-end="url(#al-arrow)" />
    </g>
    <g :class="part('buddy')">
      <rect x="64" y="278" width="288" height="32" rx="6" class="box floor" />
      <text x="72" y="298" class="lbl">{{ L('buddy allocator', '伙伴分配器') }}</text>
      <rect x="176" y="288" width="6" height="12" rx="1" class="cell" />
      <rect x="186" y="288" width="12" height="12" rx="1" class="cell" />
      <rect x="202" y="288" width="24" height="12" rx="1" class="cell" />
      <rect x="230" y="288" width="48" height="12" rx="1" class="cell" />
      <text x="344" y="298" class="tag end">{{ L('orders 0 to 10', '0 到 10 阶') }}</text>
    </g>
    <g :class="part('buddysplit')">
      <text x="12" y="330" class="tag hi">{{ L('one page wanted: split the smallest block that fits in halves', '要 1 页：把够用的最小块一分为二地切') }}</text>
      <g v-for="(row, r) in SPLIT" :key="r">
        <rect v-for="b in row" :key="b.x" :x="12 + b.x * 16" :y="338 + r * 13" :width="b.n * 16 - 1" height="11" rx="1" :class="(b as { take?: boolean }).take ? 'p0' : 'cell'" />
      </g>
      <text x="150" y="358" class="tag">{{ L('a freed block merges with its buddy if that is free,', '释放的块若伙伴也空闲，就与之合并，') }}</text>
      <text x="150" y="372" class="tag">{{ L('and a buddy’s address differs in one bit', '伙伴的地址只差一位') }}</text>
    </g>

    <!-- the kernel under everything -->
    <g :class="part('link')">
      <path d="M208,262 L208,278" class="link solid" />
    </g>
    <g :class="part('kernel')">
      <rect x="64" y="278" width="288" height="32" rx="6" class="box floor" />
      <text x="72" y="298" class="lbl">{{ L('kernel: brk and mmap', '内核：brk 与 mmap') }}</text>
    </g>
    <!-- a large request skips the bins, along the right edge -->
    <g :class="part('mmap')">
      <path d="M350,29 L356,29 L356,294 L353,294" class="link" marker-end="url(#al-arrow)" />
      <text x="346" y="298" class="tag end">{{ L('above the threshold: own mmap', '超过阈值：独立 mmap') }}</text>
    </g>

    <!-- months later: live objects scattered over partly empty pages -->
    <g :class="part('pages')">
      <text x="72" y="143" class="tag hi">{{ L('pages after many deletions', '大量删除之后的页') }}</text>
      <g v-for="(live, p) in LIVE" :key="p">
        <g v-for="i in 24" :key="i">
          <rect :x="CELL(p, i - 1).x" :y="CELL(p, i - 1).y" width="9" height="16" rx="1" class="cell" :class="{ ghost: moved(p, i - 1) }" />
          <rect v-if="live.includes(i - 1)" :x="CELL(p, i - 1).x" :y="CELL(p, i - 1).y" width="9" height="16" rx="1" class="p0" />
        </g>
      </g>
    </g>
    <g :class="part('stuck')">
      <text x="208" y="250" class="tag c">{{ L('one live object keeps a whole page resident', '一页上哪怕只有一个活对象，也还不回去') }}</text>
      <path d="M208,262 L208,276" class="danger" />
      <text x="218" y="274" class="bad-text">✕</text>
    </g>
    <g :class="part('moves')">
      <path v-for="m in MOVES" :key="m" :d="m" class="move" marker-end="url(#al-arrow)" />
    </g>
    <g :class="part('returned')">
      <path d="M247,236 L247,276" class="call" marker-end="url(#al-arrow)" />
      <path d="M317,236 L317,276" class="call" marker-end="url(#al-arrow)" />
      <text x="282" y="272" class="tag c">{{ L('returned', '归还') }}</text>
    </g>

    <!-- the strip below the layers -->
    <g :class="part('skeleton')">
      <rect x="8" y="330" width="344" height="48" rx="6" class="box gate" />
      <text x="180" y="350" class="lbl c">{{ L('size classes, a lock-free fast path,', '尺寸类别、无锁的快速路径，') }}</text>
      <text x="180" y="367" class="lbl c">{{ L('a slower shared layer that talks to the OS', '和一个与操作系统打交道的、较慢的共享层') }}</text>
    </g>
    <g :class="part('skeleton')">
      <rect x="12" y="389" width="11" height="4" rx="0.8" class="stack" />
      <text x="30" y="394" class="tag">{{ L('green in a cache: free objects, one column per size class', '缓存里的绿色：空闲对象，每列一种尺寸') }}</text>
    </g>
    <g :class="part('problems')">
      <text x="12" y="330" class="tag hi">{{ L('what real allocators add', '真实分配器多出来的三项要求') }}</text>
      <text x="12" y="348" class="sub">{{ L('speed: no list search on every call', '速度：不能每次调用都查一遍列表') }}</text>
      <text x="12" y="366" class="sub">{{ L('threads: one free list means one lock', '线程：一个空闲列表就是一把锁') }}</text>
      <text x="12" y="384" class="sub">{{ L('time: freed memory that cannot be given back', '时间：释放了却还不回去的内存') }}</text>
    </g>
    <g :class="part('cachenote')">
      <text x="12" y="336" class="sub">{{ L('a small request is rounded up to one of a few dozen sizes', '小请求向上取整到几十种尺寸之一') }}</text>
      <text x="12" y="354" class="sub">{{ L('cache has one: no lock, no search', '缓存里有：不加锁、不查找') }}</text>
      <text x="12" y="372" class="sub">{{ L('cache empty or full: move a batch', '缓存空了或满了：成批搬运') }}</text>
      <rect x="12" y="387" width="11" height="4" rx="0.8" class="stack" />
      <text x="30" y="392" class="tag">{{ L('green in a cache: free objects, one column per size class', '缓存里的绿色：空闲对象，每列一种尺寸') }}</text>
    </g>
    <g :class="part('rssbars')">
      <text x="12" y="330" class="tag hi">{{ L('Redis’s example: write 5 GB, delete 2 GB', 'Redis 文档的例子：写入 5 GB，删掉 2 GB') }}</text>
      <text x="12" y="353" class="sub">{{ L('process RSS', '进程 RSS') }}</text>
      <rect x="92" y="342" width="240" height="16" rx="2" class="p1" />
      <text x="212" y="354" class="num c on-fill strong">{{ L('about 5 GB', '约 5 GB') }}</text>
      <text x="12" y="377" class="sub">{{ L('in use', '实际使用') }}</text>
      <rect x="92" y="366" width="144" height="16" rx="2" class="p0" />
      <text x="164" y="378" class="num c on-fill strong">{{ L('about 3 GB', '约 3 GB') }}</text>
    </g>
    <g :class="part('defragnote')">
      <text x="12" y="336" class="sub">{{ L('Redis asks jemalloc whether a value sits in a poorly used', 'Redis 向 jemalloc 询问某个分配是否落在') }}</text>
      <text x="12" y="351" class="sub">{{ L('region, copies it to a better place, updates its pointer.', '利用率低的区域，把值复制到更好的位置，再更新自己的指针。') }}</text>
      <text x="12" y="372" class="tag">{{ L('off by default; only with the jemalloc bundled with Redis', '默认关闭；只在用 Redis 自带的 jemalloc 时可用') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.ink {
  fill: var(--ink-2);
}
.num {
  font-size: 8.5px;
  fill: var(--muted);
}
.num.strong {
  fill: var(--ink-2);
  font-weight: 600;
}
.num.on-fill {
  fill: #fff;
}
.inner {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
}
.cell {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.cell.hot {
  fill: var(--accent-soft);
  stroke: var(--accent);
}
.cell.ghost {
  stroke-dasharray: 2 2;
  stroke: var(--p0);
}
.stack {
  fill: var(--p2);
}
.hdr {
  fill: var(--ink-2);
}
.dirty {
  fill: var(--warn);
}
.soft {
  opacity: 0.6;
}
.grid {
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.thin {
  stroke-width: 1.1;
}
.move {
  fill: none;
  stroke: var(--p0);
  stroke-width: 1.5;
}
.shackle {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.3;
}
.lockbody {
  fill: var(--ink-2);
}
.lit .cell {
  stroke: var(--accent);
  stroke-width: 1.6;
}
.lit .inner {
  stroke: var(--accent);
}
</style>
