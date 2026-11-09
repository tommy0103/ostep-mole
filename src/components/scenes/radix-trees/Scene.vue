<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import WalkDemo from './WalkDemo.vue'

/**
 * The running figure of the radix-tree article: one radix tree, drawn top to bottom. The key is cut
 * into digits (top bar); each row is one node, a row of slots, and the dark slot is the one its
 * digit picks, which points to the next row's node (or, in the last row, to the value). Each state
 * relabels the same tree: chapter 20's two-level table, x86-64's four levels, a file's XArray, a
 * router's trie, an inode. Nodes are drawn with 16 slots whatever their real size (the captions say
 * so). Nothing moves; states change labels and what is on view.
 */
const props = defineProps<DrawingProps>()

type T = [string, string]
interface Field {
  bits: number
  v: string | T
  sub: T
  dim?: boolean
}
interface Row {
  /** slots drawn (16 by default) */
  n?: number
  /** slots that point one level down */
  ptr?: number[]
  /** slots that hold a value themselves (a huge page, a next hop, a direct block) */
  val?: number[]
  /** slots holding a shadow entry */
  shadow?: number[]
  /** the slot the key's digit picks */
  sel?: number
  /** slots whose subtree holds a marked (dirty) entry */
  mark?: number[]
  /** slots carrying a route */
  route?: number[]
  name: T
  note: T
  note2?: T
}
interface Brace {
  part: string
  row: number
  from: number
  to: number
  text: T
}
interface Tree {
  tag: T
  key: Field[]
  rows: Row[]
  data: { name: T; note: T; note2?: T }
  braces?: Brace[]
}

const ROW_Y = [76, 140, 204, 268, 332]
const X0 = 16
const CW = 12
const RX = 218

const OVERVIEW: Tree = {
  tag: ['key 0x5A3, cut into 4-bit digits', '键 0x5A3，切成 4 位一个的数位'],
  key: [
    { bits: 4, v: '5', sub: ['digit 1', '数位 1'] },
    { bits: 4, v: '10', sub: ['digit 2', '数位 2'] },
    { bits: 4, v: '3', sub: ['digit 3', '数位 3'] },
  ],
  rows: [
    { ptr: [1, 12], sel: 5, name: ['Root', '根节点'], note: ['digit 1 picks slot 5', '数位 1 选中槽 5'] },
    { ptr: [2], sel: 10, name: ['Node', '节点'], note: ['digit 2 picks slot 10', '数位 2 选中槽 10'] },
    { ptr: [7], sel: 3, name: ['Leaf node', '叶节点'], note: ['digit 3 picks slot 3', '数位 3 选中槽 3'] },
  ],
  data: { name: ['Value', '值'], note: ['the record for 0x5A3', '键 0x5A3 的记录'] },
  braces: [{ part: 'empty', row: 0, from: 6, to: 11, text: ['empty: no keys below, nothing allocated', '空槽：下面没有键，什么都不分配'] }],
}

const TWO: Tree = {
  tag: ['virtual address 0x3F80 (14 bits)', '虚拟地址 0x3F80（14 位）'],
  key: [
    { bits: 4, v: '15', sub: ['VPN, high 4', 'VPN 高 4 位'] },
    { bits: 4, v: '14', sub: ['VPN, low 4', 'VPN 低 4 位'] },
    { bits: 6, v: '0', sub: ['offset', '偏移'], dim: true },
  ],
  rows: [
    { ptr: [0], sel: 15, name: ['Page directory', '页目录'], note: ['PDE 15 of 16', '第 15 项（共 16 项）'] },
    { ptr: [15], sel: 14, name: ['Page of the page table', '一页页表'], note: ['PTE 14 → frame', '第 14 项 → 物理帧'] },
  ],
  data: { name: ['Page (64 bytes)', '页（64 字节）'], note: ['+ offset 0', '+ 偏移 0'] },
  braces: [{ part: 'empty', row: 0, from: 1, to: 14, text: ['PDEs 1–14 empty: no tables below', '第 1–14 项为空：下面没有页表'] }],
}

const RADIX: Tree = {
  tag: ['key: the VPN, two 4-bit digits', '键：VPN，两个 4 位数位'],
  key: [
    { bits: 4, v: '15', sub: ['digit 1', '数位 1'] },
    { bits: 4, v: '14', sub: ['digit 2', '数位 2'] },
    { bits: 6, v: '0', sub: ['not part of the key', '不属于键'], dim: true },
  ],
  rows: [
    { ptr: [0], sel: 15, name: ['Root: 16 slots', '根：16 个槽'], note: ['radix 16: a slot per value', '基数 16：每个值一个槽'] },
    { ptr: [15], sel: 14, name: ['Node: 16 slots', '节点：16 个槽'], note: ['height = 8 bits ÷ 4 = 2', '树高 = 8 位 ÷ 4 = 2'] },
  ],
  data: { name: ['Value', '值'], note: ['shift, mask, index: no compares', '移位、掩码、取下标，不比较'] },
  braces: [{ part: 'empty', row: 0, from: 1, to: 14, text: ['empty slots: whole ranges absent', '空槽：整段键都不存在'] }],
}

const X86_KEY: Field[] = [
  { bits: 9, v: '255', sub: ['47–39', '47–39'] },
  { bits: 9, v: '503', sub: ['38–30', '38–30'] },
  { bits: 9, v: '285', sub: ['29–21', '29–21'] },
  { bits: 9, v: '69', sub: ['20–12', '20–12'] },
  { bits: 12, v: '0xb10', sub: ['offset 11–0', '偏移 11–0'], dim: true },
]
const X86_TAG: T = ['virtual address 0x7ffde3a45b10', '虚拟地址 0x7ffde3a45b10']

const X86: Tree = {
  tag: X86_TAG,
  key: X86_KEY,
  rows: [
    { ptr: [0, 15], sel: 7, name: ['PGD (x86: PML4)', 'PGD（x86：PML4）'], note: ['entry 255 of 512', '第 255 项（共 512）'], note2: ['each maps 512 GiB', '每项映射 512 GiB'] },
    { ptr: [14], sel: 15, name: ['PUD (x86: PDPT)', 'PUD（x86：PDPT）'], note: ['entry 503', '第 503 项'], note2: ['each maps 1 GiB', '每项映射 1 GiB'] },
    { ptr: [9], sel: 8, name: ['PMD (x86: PD)', 'PMD（x86：PD）'], note: ['entry 285', '第 285 项'], note2: ['each maps 2 MiB', '每项映射 2 MiB'] },
    { ptr: [1, 3, 4], sel: 2, name: ['PTE (x86: PT)', 'PTE（x86：PT）'], note: ['entry 69', '第 69 项'], note2: ['each maps 4 KiB', '每项映射 4 KiB'] },
  ],
  data: { name: ['4 KiB page', '4 KiB 的页'], note: ['+ offset 0xb10', '+ 偏移 0xb10'] },
}

const SPARSE: Tree = {
  tag: ['one isolated page, far from the rest', '一个孤立的页，离其他映射都很远'],
  key: X86_KEY,
  rows: [
    { sel: 7, name: ['PGD', 'PGD'], note: ['always exists', '总是存在'] },
    { sel: 15, name: ['PUD table', 'PUD 表'], note: ['4 KiB, 1 entry used', '4 KiB，只用 1 项'] },
    { sel: 8, name: ['PMD table', 'PMD 表'], note: ['4 KiB, 1 entry used', '4 KiB，只用 1 项'] },
    { sel: 2, name: ['PTE table', 'PTE 表'], note: ['4 KiB, 1 entry used', '4 KiB，只用 1 项'] },
  ],
  data: { name: ['4 KiB of data', '4 KiB 数据'], note: ['the only page here', '这里唯一的页'] },
}

const HUGE: Tree = {
  tag: ['if 0x7ffde3a45b10 were in a 2 MiB page', '假如 0x7ffde3a45b10 落在 2 MiB 页里'],
  key: [...X86_KEY.slice(0, 3), { bits: 21, v: '0x45b10', sub: ['offset 20–0', '偏移 20–0'], dim: true }],
  rows: [X86.rows[0], X86.rows[1], { ...X86.rows[2], ptr: [9], sel: 8, val: [8], note: ['page-size bit set', '页大小位置 1'], note2: ['no leaf table below', '下面没有叶子表'] }],
  data: { name: ['2 MiB page', '2 MiB 的页'], note: ['found by the top 27 bits', '由高 27 位找到'], note2: ['like a /27 route', '如同一条 /27 路由'] },
}

const PAGECACHE: Tree = {
  tag: ['byte 10,000,000 of a file → page 2,441', '文件第 10,000,000 字节 → 第 2,441 页'],
  key: [
    { bits: 6, v: '38', sub: ['digit 1', '数位 1'] },
    { bits: 6, v: '9', sub: ['digit 2', '数位 2'] },
  ],
  rows: [
    { ptr: [2, 13], sel: 9, name: ['XArray node', 'XArray 节点'], note: ['slot 38 of 64', '第 38 槽（共 64）'] },
    { ptr: [5, 11], sel: 2, name: ['XArray node', 'XArray 节点'], note: ['slot 9 → the page', '第 9 槽 → 那一页'] },
  ],
  data: { name: ['Cached page', '缓存着的页'], note: ['if there is one', '如果有的话'] },
}

const XARRAY: Tree = {
  tag: ['one file’s XArray: which pages are dirty?', '一个文件的 XArray：哪些页是脏的？'],
  key: PAGECACHE.key,
  rows: [
    { ptr: [2, 13], sel: 9, mark: [9], name: ['XArray node', 'XArray 节点'], note: ['dot: dirty below', '圆点：下面有脏页'], note2: ['grey, no dot: skipped', '灰色无圆点：整棵跳过'] },
    { ptr: [2, 5, 11], sel: 5, mark: [5, 11], name: ['XArray node', 'XArray 节点'], note: ['dot: page is dirty', '圆点：这一页是脏的'] },
  ],
  data: { name: ['Dirty page', '脏页'], note: ['to be written back', '等待写回'] },
  }

const SHADOW: Tree = {
  tag: PAGECACHE.tag,
  key: PAGECACHE.key,
  rows: [PAGECACHE.rows[0], { ptr: [5], shadow: [11], sel: 2, name: ['XArray node', 'XArray 节点'], note: ['pointer → cached page', '指针 → 缓存着的页'], note2: ['value → shadow entry', '值 → 影子表项'] }],
  data: PAGECACHE.data,
  braces: [{ part: 'shadow', row: 1, from: 11, to: 11, text: ['shadow entry: evicted at T', '影子表项：在 T 时被淘汰'] }],
}

const IP_TAG: T = ['IPv4 destination 10.1.2.3', 'IPv4 目的地址 10.1.2.3']
const LPM: Tree = {
  tag: IP_TAG,
  key: [
    { bits: 8, v: '10', sub: ['8 bits', '8 位'] },
    { bits: 8, v: '1', sub: ['8 bits', '8 位'] },
    { bits: 8, v: '2', sub: ['8 bits', '8 位'] },
    { bits: 8, v: '3', sub: ['8 bits', '8 位'], dim: true },
  ],
  rows: [
    { ptr: [6, 12], sel: 3, route: [3], name: ['Trie node', '字典树节点'], note: ['10.0.0.0/8 → hop A', '10.0.0.0/8 → 下一跳 A'], note2: ['remember A, go on', '记下 A，继续'] },
    { ptr: [9], sel: 1, name: ['Trie node', '字典树节点'], note: ['no route here', '这里没有路由'] },
    { ptr: [], sel: 2, val: [2], route: [2], name: ['Trie node', '字典树节点'], note: ['10.1.2.0/24 → hop B', '10.1.2.0/24 → 下一跳 B'] },
  ],
  data: { name: ['Next hop B', '下一跳 B'], note: ['the longest match wins', '最长的匹配胜出'] },
}

const DIR24: Tree = {
  tag: IP_TAG,
  key: [
    { bits: 24, v: '10.1.2', sub: ['top 24 bits', '高 24 位'] },
    { bits: 8, v: '3', sub: ['last 8', '低 8 位'] },
  ],
  rows: [
    { val: [1, 9, 10, 11, 12], ptr: [14], sel: 5, name: ['tbl24', 'tbl24'], note: ['2²⁴ entries', '2²⁴ 项'], note2: ['this one → a tbl8 group', '这一项 → 一个 tbl8 组'] },
    { val: [0, 3, 8], sel: 3, name: ['tbl8 group', 'tbl8 组'], note: ['256 entries, by last 8', '256 项，用低 8 位'] },
  ],
  data: { name: ['Next hop', '下一跳'], note: ['two reads on this path', '这条路径读两次'], note2: ['green in tbl24: one read', 'tbl24 绿项：只读一次'] },
  braces: [{ part: 'expand', row: 0, from: 9, to: 12, text: ['a /20, copied to 16 slots', '一条 /20，复制进 16 个槽'] }],
}

const INODE: Tree = {
  tag: ['a block reached by the double-indirect pointer', '经二级间接指针找到的块'],
  key: [
    { bits: 6, v: '2×', sub: ['which pointer', '哪个指针'] },
    { bits: 10, v: 'i1', sub: ['10 bits', '10 位'] },
    { bits: 10, v: 'i2', sub: ['10 bits', '10 位'] },
    { bits: 12, v: ['offset', '偏移'], sub: ['within block', '块内'], dim: true },
  ],
  rows: [
    { n: 11, val: [0, 1, 2, 3, 4, 5, 6, 7], ptr: [8, 10], sel: 9, name: ['Inode', 'inode'], note: ['direct, then 1×, 2×, 3×', '直接指针，再 1×、2×、3×'], note2: ['green: a data block', '绿色：直接指向数据块'] },
    { ptr: [0, 1], sel: 4, name: ['Indirect block', '间接块'], note: ['1,024 pointers', '1,024 个指针'] },
    { ptr: [2, 9], sel: 6, name: ['Indirect block', '间接块'], note: ['1,024 pointers', '1,024 个指针'] },
  ],
  data: { name: ['Data block', '数据块'], note: ['4 KB', '4 KB'] },
  braces: [{ part: 'direct', row: 0, from: 0, to: 7, text: ['direct pointers', '直接指针'] }],
}

const DEPTH: Tree = {
  tag: X86_TAG,
  key: X86_KEY,
  rows: X86.rows.map((r, i) => ({ ...r, note: [`read ${i + 1}`, `第 ${i + 1} 次读取`] as T, note2: [i < 3 ? 'gives the next table' : 'gives the frame', i < 3 ? '得到下一张表的地址' : '得到物理帧'] as T })),
  data: { name: ['4 KiB page', '4 KiB 的页'], note: ['read 5: the data', '第 5 次：数据本身'], note2: ['a TLB hit comes here', 'TLB 命中直接到这里'] },
}

const TREES: Record<string, Tree> = {
  overview: OVERVIEW,
  'two-level': TWO,
  radix: RADIX,
  x86: X86,
  sparse: SPARSE,
  huge: HUGE,
  pagecache: PAGECACHE,
  xarray: XARRAY,
  shadow: SHADOW,
  lpm: LPM,
  dir24: DIR24,
  inode: INODE,
  depth: DEPTH,
}

const BASE = ['key', 'l1', 'data']
const SHOW: Record<string, string[]> = {
  overview: [...BASE, 'l2', 'l3', 'empty'],
  'two-level': [...BASE, 'l2', 'empty'],
  radix: [...BASE, 'l2', 'empty'],
  x86: [...BASE, 'l2', 'l3', 'l4'],
  sparse: [...BASE, 'l2', 'l3', 'l4', 'cost'],
  huge: [...BASE, 'l2', 'l3'],
  pagecache: [...BASE, 'l2'],
  xarray: [...BASE, 'l2', 'marks'],
  shadow: [...BASE, 'l2', 'shadow'],
  lpm: [...BASE, 'l2', 'l3'],
  dir24: [...BASE, 'l2', 'expand'],
  inode: [...BASE, 'l2', 'l3', 'direct'],
  depth: [...BASE, 'l2', 'l3', 'l4', 'tlb', 'psc'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 420)
const t = computed(() => TREES[props.state] ?? OVERVIEW)
const T = (s: T) => L(s[0], s[1])

/** the key bar: fields as wide as their bits */
const fields = computed(() => {
  const total = t.value.key.reduce((s, f) => s + f.bits, 0)
  let x = X0
  return t.value.key.map((f) => {
    const w = (f.bits / total) * 328
    const r = { ...f, x, w }
    x += w
    return r
  })
})

const cellX = (i: number) => X0 + i * CW
const kind = (r: Row, i: number) => ({
  ptr: r.ptr?.includes(i),
  val: r.val?.includes(i),
  shadow: r.shadow?.includes(i),
  sel: r.sel === i,
})
/** the data box sits in the row after the last node */
const dataY = computed(() => ROW_Y[t.value.rows.length])
/** where the walk goes from each row: to the next node's start, or to the value */
const arrow = (ri: number) => {
  const r = t.value.rows[ri]
  if (r.sel === undefined) return ''
  const x = cellX(r.sel) + CW / 2
  const y = ROW_Y[ri] + 20
  const ny = ROW_Y[ri + 1]
  return `M${x},${y + 1} L${X0 + 3},${ny - 3}`
}
const brace = (b: Brace) => {
  const y = ROW_Y[b.row] - 6
  const x1 = cellX(b.from) + 1
  const x2 = cellX(b.to) + CW - 1
  return { d: `M${x1},${y + 3} L${x1},${y} L${x2},${y} L${x2},${y + 3}`, x: x1, y: y - 4 }
}
/** the legend sits under the value (under the cost lines when they are shown) */
const legendY = computed(() => (shown.value.has('cost') ? 414 : dataY.value + 58))
const LEGEND: { cls: string; text: T }[] = [
  { cls: 'sel', text: ['on the walk', '查找路径上'] },
  { cls: 'ptr', text: ['points elsewhere', '指向别处'] },
  { cls: '', text: ['empty', '空槽'] },
  { cls: 'val', text: ['value', '值'] },
]
const LEGEND_X = [16, 96, 198, 256]
const braceOf = (p: string) => t.value.braces?.find((b) => b.part === p)
</script>

<template>
  <WalkDemo v-if="demo && state === 'x86'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A radix tree: a key cut into digits, one node per digit', '基数树：键切成数位，每个数位一个节点')">
    <defs>
      <marker id="rt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- the key, cut into digits -->
    <g :class="part('key')">
      <text :x="X0" y="12" class="tag">{{ T(t.tag) }}</text>
      <g v-for="(f, i) in fields" :key="'f' + i">
        <rect :x="f.x" y="18" :width="f.w - 2" height="24" rx="3" class="field" :class="{ dim: f.dim }" />
        <text :x="f.x + f.w / 2 - 1" y="34" class="code c" :class="{ faint: f.dim }">{{ typeof f.v === 'string' ? f.v : T(f.v) }}</text>
        <text :x="f.x + f.w / 2 - 1" y="54" class="tiny c">{{ T(f.sub) }}</text>
      </g>
    </g>

    <!-- the nodes, one per digit -->
    <template v-for="(r, ri) in t.rows" :key="state + ri">
      <g :class="part('l' + (ri + 1))">
        <rect :x="X0 - 2" :y="ROW_Y[ri] - 2" :width="(r.n ?? 16) * CW + 4" height="24" rx="3" class="box" />
        <rect
          v-for="i in r.n ?? 16"
          :key="i"
          :x="cellX(i - 1) + 1"
          :y="ROW_Y[ri] + 1"
          :width="CW - 2"
          height="18"
          rx="1.5"
          class="cell"
          :class="kind(r, i - 1)"
        />
        <!-- route and mark dots sit on top of their slot -->
        <circle v-for="i in r.route ?? []" :key="'r' + i" :cx="cellX(i) + CW / 2" :cy="ROW_Y[ri] - 6" r="2.6" class="route" />
        <path :d="arrow(ri)" class="link solid walk" marker-end="url(#rt-arrow)" />
        <text :x="RX" :y="ROW_Y[ri] + 8" class="lbl">{{ T(r.name) }}</text>
        <text :x="RX" :y="ROW_Y[ri] + 21" class="sub">{{ T(r.note) }}</text>
        <text v-if="r.note2" :x="RX" :y="ROW_Y[ri] + 33" class="sub">{{ T(r.note2) }}</text>
      </g>
      <g v-if="r.mark" :class="part('marks')">
        <circle v-for="i in r.mark" :key="'m' + i" :cx="cellX(i) + CW / 2" :cy="ROW_Y[ri] - 6" r="2.6" class="mark" />
      </g>
    </template>

    <!-- the value the walk ends at -->
    <g :class="part('data')">
      <rect :x="X0" :y="dataY" width="192" height="26" rx="3" class="box datum" />
      <rect :x="X0" :y="dataY" width="6" height="26" rx="2" class="datum-edge" />
      <text :x="RX" :y="dataY + 8" class="lbl">{{ T(t.data.name) }}</text>
      <text :x="RX" :y="dataY + 21" class="sub">{{ T(t.data.note) }}</text>
      <text v-if="t.data.note2" :x="RX" :y="dataY + 33" class="sub">{{ T(t.data.note2) }}</text>
    </g>

    <!-- what the slot colours mean -->
    <g class="legend">
      <template v-for="(k, i) in LEGEND" :key="k.cls">
        <rect :x="LEGEND_X[i]" :y="legendY - 9" width="10" height="11" rx="1.5" class="cell" :class="k.cls" />
        <text :x="LEGEND_X[i] + 14" :y="legendY" class="tag">{{ T(k.text) }}</text>
      </template>
    </g>

    <!-- braces over slots: empty ranges, a copied route, a shadow entry, direct pointers -->
    <template v-for="p in ['empty', 'expand', 'shadow', 'direct']" :key="p">
      <g v-if="braceOf(p)" :class="part(p)">
        <path :d="brace(braceOf(p)!).d" class="brace" />
        <text :x="brace(braceOf(p)!).x" :y="brace(braceOf(p)!).y" class="tag hi">{{ T(braceOf(p)!.text) }}</text>
      </g>
    </template>

    <!-- the cost of one isolated page -->
    <g :class="part('cost')">
      <text :x="X0" y="382" class="tag hi">{{ L('3 tables × 4 KiB = 12 KiB to map 4 KiB', '3 张表 × 4 KiB = 12 KiB，只为映射 4 KiB') }}</text>
      <text :x="X0" y="397" class="tag">{{ L('a dense, aligned 1 GiB: 514 table pages, ≈ 0.2%', '对齐的稠密 1 GiB：514 个页表页，约 0.2%') }}</text>
    </g>

    <!-- the shortcuts around the walk -->
    <g :class="part('psc')">
      <rect x="9" y="64" width="202" height="166" rx="7" class="outline" />
      <text x="208" y="243" class="tag end">{{ L('paging-structure caches', '分页结构缓存') }}</text>
    </g>
    <g :class="part('tlb')">
      <path :d="`M344,30 L348,30 L348,${legendY - 18} L150,${legendY - 18} L150,${dataY + 30}`" class="call" marker-end="url(#rt-arrow)" />
      <rect x="336" y="176" width="23" height="18" rx="3" class="box gate" />
      <text x="347.5" y="189" class="code c">TLB</text>
    </g>
  </svg>
</template>

<style scoped>
.field {
  fill: var(--bg-sunk);
  stroke: var(--ink-2);
  stroke-width: 1.1;
}
.field.dim {
  stroke: var(--rule-strong);
}
.faint {
  fill: var(--muted);
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.cell {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.cell.ptr {
  fill: var(--rule-strong);
}
.cell.val {
  fill: var(--p2);
  stroke: none;
}
.cell.shadow {
  fill: var(--p4);
  stroke: none;
}
.cell.sel {
  fill: var(--ink-2);
  stroke: none;
}
.cell.sel.val {
  fill: var(--p2);
  stroke: var(--ink);
  stroke-width: 1.6;
}
.walk {
  stroke-width: 1.3;
}
.mark {
  fill: var(--p3);
}
.route {
  fill: var(--p2);
}
.datum-edge {
  fill: var(--p2);
}
.brace {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
}
.lit .brace {
  stroke: var(--accent);
  stroke-width: 1.6;
}
.lit .tag {
  fill: var(--accent-ink);
}
.lit .mark,
.lit .route {
  fill: var(--accent);
}
</style>
