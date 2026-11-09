<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import ThpDemo from './ThpDemo.vue'

/**
 * The running figure of the huge-pages article: the TLB and its reach at the top, a virtual address
 * and the four-level x86-64 page table under it, physical memory cut into 2 MiB spans, and the
 * kernel's huge-page machinery (hugetlbfs, THP, khugepaged) at the bottom. Each 2 MiB span is drawn
 * with 12 cells; a real one holds 512 frames of 4 KiB.
 */
const props = defineProps<DrawingProps>()

const SHOW: Record<string, string[]> = {
  overview: ['tlb', 'reach', 'va', 'pml4', 'pdpt', 'pd', 'pt', 'phys', 'legend', 'kernel', 'hugetlb', 'thpbox', 'khp'],
  reach: ['tlb', 'reach'],
  walk: ['tlb', 'va', 'pml4', 'pdpt', 'pd', 'pt', 'ps', 'phys', 'reads'],
  huge: ['va', 'pml4', 'pdpt', 'pd', 'ps', 'phys', 'hugenote'],
  rules: ['va', 'pml4', 'pdpt', 'pd', 'ps', 'phys', 'rules'],
  hugetlbfs: ['pd', 'ps', 'phys', 'pool', 'kernel', 'hugetlb'],
  thp: ['pd', 'pt', 'phys', 'legend', 'kernel', 'thpbox', 'khp', 'collapse'],
  bloat: ['pd', 'ps', 'phys', 'kernel', 'khp', 'bloatnote'],
  compaction: ['pd', 'want', 'phys', 'kernel', 'thpbox', 'compact'],
  cow: ['pd', 'pdc', 'ps', 'phys'],
  base: ['tlb', 'reach'],
  three: ['tlb', 'va', 'pml4', 'pdpt', 'pd', 'pt', 'ps', 'phys', 'pool', 'kernel', 'hugetlb', 'thpbox', 'khp', 'marks'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 400)
const st = computed(() => props.state)

/* the TLB: eight of its 1,536 entries, each holding one translation */
const slotSize = computed(() => {
  if (st.value === 'base') return Array(8).fill('16 KiB')
  if (st.value === 'overview' || st.value === 'reach') return Array(8).fill('4 KiB')
  return ['4 KiB', '4 KiB', '2 MiB', '4 KiB', '4 KiB', '2 MiB', '4 KiB', '4 KiB']
})

/* the virtual address: four 9-bit indexes and a 12-bit offset, or a 21-bit offset when the walk stops at the PD */
const U = 344 / 48
const shortWalk = computed(() => st.value === 'huge' || st.value === 'rules')
const fields = computed(() => {
  const f = [
    { x: 8, w: 9 * U, t: L('9 bits', '9 位') },
    { x: 8 + 9 * U, w: 9 * U, t: L('9 bits', '9 位') },
    { x: 8 + 18 * U, w: 9 * U, t: L('9 bits', '9 位') },
  ]
  if (shortWalk.value) f.push({ x: 8 + 27 * U, w: 21 * U, t: L('21-bit offset', '21 位偏移') })
  else f.push({ x: 8 + 27 * U, w: 9 * U, t: L('9 bits', '9 位' ) }, { x: 8 + 36 * U, w: 12 * U, t: L('12-bit offset', '12 位偏移') })
  return f
})

/* the four levels of the page table, as a staircase under the address bits that index them */
const BOXES = [
  { id: 'pml4', x: 14, y: 148, name: ['PML4', 'PML4'], sub: ['level 4', '第 4 级'] },
  { id: 'pdpt', x: 79, y: 160, name: ['PDPT', 'PDPT'], sub: ['level 3', '第 3 级'] },
  { id: 'pd', x: 143, y: 172, name: ['PD', '页目录'], sub: ['level 2', '第 2 级'] },
  { id: 'pt', x: 208, y: 184, name: ['PT', '页表'], sub: ['level 1', '第 1 级'] },
]
const boxSub = (b: (typeof BOXES)[number]) => (st.value === 'cow' && b.id === 'pd' ? L('child', '子进程') : L(b.sub[0], b.sub[1]))

/* physical memory: three 2 MiB spans of 12 cells; '.' free, 'o' another process, 'm' this program */
type Span = { cells?: string; huge?: [string, string]; pool?: boolean; ghost?: number }
const MIX0 = 'o..oo...o.o.'
const MIX1 = '.oo...oo.o.o'
const MIX2M = '.m..oo...o..'
const MIX2 = '.o..oo...o..'
const PAGE: [string, string] = ['2 MiB page', '2 MiB 大页']
const SPANS: Record<string, Span[]> = {
  overview: [{ cells: MIX0 }, { cells: MIX1 }, { cells: MIX2M }],
  walk: [{ cells: MIX0 }, { huge: PAGE }, { cells: MIX2M }],
  huge: [{ cells: MIX0 }, { huge: PAGE }, { cells: MIX2 }],
  rules: [{ cells: MIX0 }, { huge: PAGE }, { cells: MIX2 }],
  hugetlbfs: [{ pool: true }, { huge: PAGE }, { cells: MIX2 }],
  thp: [{ cells: MIX0 }, { cells: '............' }, { cells: '.m.moo.m.om.' }],
  bloat: [{ cells: MIX0 }, { ghost: 3 }, { cells: MIX2 }],
  compaction: [{ cells: MIX0 }, { cells: '..o..o...o..' }, { cells: 'oo..ooo.o.oo' }],
  cow: [{ cells: MIX0 }, { huge: ['original', '原页'] }, { huge: ['copy', '副本'] }],
  three: [{ pool: true }, { huge: PAGE }, { cells: MIX2M }],
}
const spans = computed(() => SPANS[st.value] ?? SPANS.overview)
const X0 = [8, 122, 236]
const cellX = (s: number, k: number) => X0[s] + k * 9.5 + 0.5
const KIND: Record<string, string> = { '.': 'free', o: 'other', m: 'mine' }

const thpSub = computed(() => {
  if (st.value === 'overview') return L('on or off?', '开还是关？')
  if (st.value === 'compaction') return L('defrag=always: waits', 'defrag=always：等待')
  if (st.value === 'thp') return L('fault: 2 MiB or 4 KiB', '页错误：2 MiB 或 4 KiB')
  return L('enabled · defrag', 'enabled · defrag')
})
</script>

<template>
  <ThpDemo v-if="demo && state === 'thp'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('TLB, page table and physical memory', 'TLB、页表与物理内存')">
    <defs>
      <marker id="hp-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- the TLB -->
    <g :class="part('tlb')">
      <rect x="8" y="8" width="344" height="34" rx="6" class="box strong" />
      <text x="16" y="29" class="lbl">TLB</text>
      <g v-for="(s, i) in slotSize" :key="i">
        <rect :x="52 + i * 37" y="14" width="33" height="22" rx="3" class="slot" :class="{ big: s !== '4 KiB' }" />
        <text :x="68.5 + i * 37" y="28.5" class="tiny c" :class="{ strongt: s !== '4 KiB' }">{{ s }}</text>
      </g>
    </g>

    <!-- reach: entries × page size, the bars to scale (3 GiB = 252 units) -->
    <g :class="part('reach')">
      <text x="16" y="60" class="tag">{{ L('reach = 1,536 entries × page size', '覆盖范围 = 1536 项 × 页大小') }}</text>
      <text x="16" y="75" class="sub">{{ L('4 KiB pages', '4 KiB 页') }}</text>
      <rect x="92" y="67" width="2" height="9" class="p0" />
      <text x="99" y="75" class="tag hi">6 MiB</text>
      <template v-if="st !== 'base'">
        <text x="16" y="89" class="sub">{{ L('2 MiB pages', '2 MiB 页') }}</text>
        <rect x="92" y="81" width="252" height="9" rx="1" class="p0" />
        <text x="338" y="88.5" class="tiny end on-fill">3 GiB</text>
      </template>
      <template v-else>
        <text x="16" y="89" class="sub">{{ L('16 KiB pages', '16 KiB 页') }}</text>
        <rect x="92" y="81" width="2" height="9" class="p0" />
        <text x="99" y="89" class="tag hi">{{ L('24 MiB, 4×', '24 MiB，4 倍') }}</text>
      </template>
    </g>

    <!-- the virtual address: each index picks an entry in the table below it -->
    <g :class="part('va')">
      <text x="8" y="110" class="tag">{{ L('virtual address, 48 bits', '虚拟地址，48 位') }}</text>
      <g v-for="(f, i) in fields" :key="i">
        <rect :x="f.x" y="114" :width="f.w" height="20" class="field" :class="{ off: i >= 3 && (shortWalk || i === 4) }" />
        <text :x="f.x + f.w / 2" y="127.5" class="tiny c">{{ f.t }}</text>
      </g>
      <path v-for="(b, i) in BOXES" :key="'l' + i" :d="`M${8 + (i + 0.5) * 9 * U},134 L${b.x + 26},${b.y}`" class="link" :class="{ gone: !shown.has(b.id) || (shortWalk && i === 3) }" />
    </g>

    <!-- the page table: each level a page of 512 entries; one entry leads to the next level -->
    <g v-for="(b, i) in BOXES" :key="b.id" :class="part(b.id)">
      <rect :x="b.x" :y="b.y" width="52" height="50" rx="5" class="box" />
      <text :x="b.x + 26" :y="b.y + 16" class="lbl c">{{ L(b.name[0], b.name[1]) }}</text>
      <text :x="b.x + 26" :y="b.y + 28" class="sub c">{{ boxSub(b) }}</text>
      <rect :x="b.x + 6" :y="b.y + 34" width="40" height="7" rx="1" class="cell entry" />
      <path v-if="i > 0" :d="`M${BOXES[i - 1].x + 46},${BOXES[i - 1].y + 37.5} L${b.x},${BOXES[i - 1].y + 37.5}`" class="link solid" :class="{ gone: !shown.has(BOXES[i - 1].id) }" marker-end="url(#hp-arrow)" />
      <text v-if="i === 0" x="36" y="146" class="tag end">CR3</text>
      <!-- the last level leads to one 4 KiB frame -->
      <path v-if="b.id === 'pt'" d="M234,234 L249,272" class="link solid" marker-end="url(#hp-arrow)" />
    </g>

    <!-- a PD entry with its PS bit set leads straight to 2 MiB -->
    <g :class="part('ps')">
      <path d="M169,222 L178,272" class="call" marker-end="url(#hp-arrow)" />
    </g>
    <g :class="part('hugenote')">
      <text x="206" y="196" class="tag hi">{{ L('PS = 1 in the PD entry:', '页目录项 PS = 1：') }}</text>
      <text x="206" y="209" class="tag">{{ L('the walk stops, 2 MiB page', '遍历到此为止，2 MiB 页') }}</text>
      <text x="206" y="226" class="tag">{{ L('PS in a PDPT entry: 1 GiB', 'PDPT 表项置 PS：1 GiB') }}</text>
    </g>
    <g :class="part('reads')">
      <g v-for="(b, i) in BOXES" :key="'r' + i">
        <circle :cx="b.x + 52" :cy="b.y" r="6.5" class="badge" />
        <text :x="b.x + 52" :y="b.y + 3.2" class="tiny c on-fill">{{ i + 1 }}</text>
      </g>
      <text x="166" y="256" class="tag hi end">{{ L('2 MiB: 3 reads', '2 MiB：读 3 次') }}</text>
      <text x="258" y="256" class="tag hi">{{ L('4 KiB: 4 reads', '4 KiB：读 4 次') }}</text>
    </g>

    <!-- copy-on-write: the parent's PD next to the child's -->
    <g :class="part('pdc')">
      <rect x="208" y="172" width="52" height="50" rx="5" class="box" />
      <text x="234" y="188" class="lbl c">{{ L('PD', '页目录') }}</text>
      <text x="234" y="200" class="sub c">{{ L('parent', '父进程') }}</text>
      <rect x="214" y="206" width="40" height="7" rx="1" class="cell entry" />
      <path d="M234,222 L290,272" class="call" marker-end="url(#hp-arrow)" />
      <text x="266" y="186" class="tag hi">{{ L('writes 1 byte', '写 1 个字节') }}</text>
      <text x="266" y="199" class="tag">{{ L('→ 2 MiB copied', '→ 复制 2 MiB') }}</text>
    </g>

    <!-- physical memory in 2 MiB spans -->
    <g :class="part('phys')">
      <text x="8" y="266" class="tag">{{ L('physical memory', '物理内存') }}</text>
      <g :class="part('legend')">
        <rect :x="lang === 'zh' ? 56 : 92" y="259" width="7" height="7" class="mine" />
        <text :x="lang === 'zh' ? 66 : 102" y="266" class="tiny">{{ L('program', '本程序') }}</text>
        <rect :x="lang === 'zh' ? 100 : 144" y="259" width="7" height="7" class="other" />
        <text :x="lang === 'zh' ? 110 : 154" y="266" class="tiny">{{ L('others', '其他进程') }}</text>
        <rect :x="lang === 'zh' ? 154 : 186" y="259" width="7" height="7" class="free" />
        <text :x="lang === 'zh' ? 164 : 196" y="266" class="tiny">{{ L('free', '空闲') }}</text>
      </g>
      <template v-for="(sp, s) in spans" :key="'s' + s">
        <template v-if="sp.huge">
          <rect :x="X0[s] + 0.5" y="274" width="113" height="22" rx="2" class="p0 cell" />
          <text :x="X0[s] + 57" y="288.5" class="tiny c on-fill">{{ L(sp.huge[0], sp.huge[1]) }}</text>
        </template>
        <template v-else-if="sp.pool">
          <rect :x="X0[s] + 0.5" y="274" width="113" height="22" rx="2" class="poolpage" />
          <text :x="X0[s] + 57" y="288.5" class="tiny c">{{ L('reserved, free', '预留，空闲') }}</text>
        </template>
        <template v-else-if="sp.ghost !== undefined">
          <rect v-for="k in 12" :key="k" :x="cellX(s, k - 1)" y="274" width="8.5" height="22" rx="1" class="cell" :class="k - 1 === sp.ghost ? 'mine' : 'ghost'" />
          <rect :x="X0[s] + 0.5" y="273" width="113" height="24" rx="2" class="hugeline" />
        </template>
        <template v-else>
          <rect v-for="k in 12" :key="k" :x="cellX(s, k - 1)" y="274" width="8.5" height="22" rx="1" class="cell" :class="KIND[sp.cells![k - 1]]" />
        </template>
      </template>
      <path v-for="x in [8, 122, 236, 350]" :key="'t' + x" :d="`M${x},270 L${x},300`" class="tick" :class="{ hot: st === 'rules' }" />
      <text x="8" y="309" class="tiny" :class="{ strongt: st === 'rules' }">0</text>
      <text x="122" y="309" class="tiny c" :class="{ strongt: st === 'rules' }">2 MiB</text>
      <text x="236" y="309" class="tiny c" :class="{ strongt: st === 'rules' }">4 MiB</text>
      <text x="350" y="309" class="tiny end" :class="{ strongt: st === 'rules' }">6 MiB</text>
    </g>

    <!-- the three requirements -->
    <g :class="part('rules')">
      <text x="16" y="334" class="tag hi">{{ L('① Contiguous: 512 frames, all free at once', '① 物理连续：512 个页帧同时空闲') }}</text>
      <text x="16" y="350" class="tag hi">{{ L('② Aligned: starts at a multiple of 2 MiB', '② 对齐：起点是 2 MiB 的整数倍') }}</text>
      <text x="16" y="366" class="tag hi">{{ L('③ All or nothing: one entry, one set of bits', '③ 全有或全无：一个表项，一套位') }}</text>
    </g>

    <!-- hugetlbfs: a pool reserved in advance -->
    <g :class="part('pool')">
      <rect x="5" y="271" width="234" height="28" rx="4" class="outline" />
      <path d="M62,341 L62,301" class="link solid" marker-end="url(#hp-arrow)" />
    </g>

    <!-- bloat: one page used, 2 MiB resident -->
    <g :class="part('bloatnote')">
      <text x="206" y="196" class="tag hi">max_ptes_none = 511</text>
      <text x="206" y="209" class="tag">{{ L('1 of 512 mapped: collapsed', '512 个只映射了 1 个：照样合并') }}</text>
      <text x="206" y="226" class="tag hi">{{ L('2 MiB resident', '常驻 2 MiB') }}</text>
    </g>

    <!-- compaction: a fault wants 2 MiB here, so pages migrate out of the way -->
    <g :class="part('want')">
      <path d="M169,222 L178,272" class="link" marker-end="url(#hp-arrow)" />
      <rect x="122.5" y="273" width="113" height="24" rx="2" class="target" />
      <text x="206" y="196" class="tag hi">{{ L('a fault wants 2 MiB:', '页错误想要 2 MiB：') }}</text>
      <text x="206" y="209" class="tag">{{ L('its thread waits', '它所在的线程等着') }}</text>
    </g>
    <g :class="part('compact')">
      <path d="M145.75,274 C145.75,262 117.25,262 117.25,272" class="call" marker-end="url(#hp-arrow)" />
      <path d="M174.25,274 C174.25,252 307.25,252 307.25,272" class="call" marker-end="url(#hp-arrow)" />
      <path d="M212.25,274 C212.25,262 269.25,262 269.25,272" class="call" marker-end="url(#hp-arrow)" />
      <text x="240" y="248" class="tag hi c">{{ L('migrate', '迁移') }}</text>
    </g>

    <!-- the kernel's huge-page machinery -->
    <g :class="part('kernel')">
      <rect x="8" y="318" width="344" height="76" rx="6" class="box floor" />
      <text x="16" y="333" class="lbl">{{ L('Kernel', '内核') }}</text>
    </g>
    <g :class="part('hugetlb')">
      <rect x="16" y="341" width="92" height="44" rx="4" class="box" />
      <text x="62" y="359" class="lbl c">hugetlbfs</text>
      <text x="62" y="374" class="sub c">{{ L('reserved pool', '预留池') }}</text>
    </g>
    <g :class="part('thpbox')">
      <rect x="120" y="341" width="120" height="44" rx="4" class="box" />
      <text x="180" y="359" class="lbl c">THP</text>
      <text x="180" y="374" class="sub c">{{ thpSub }}</text>
    </g>
    <g :class="part('khp')">
      <rect x="252" y="341" width="92" height="44" rx="4" class="box" />
      <text x="298" y="359" class="lbl c">khugepaged</text>
      <text x="298" y="374" class="sub c">{{ L('collapses', '后台合并') }}</text>
    </g>

    <!-- THP: khugepaged collapses small pages into a free span -->
    <g :class="part('collapse')">
      <rect x="122.5" y="273" width="113" height="24" rx="2" class="target" />
      <path d="M268,341 C252,318 196,318 184,300" class="call" marker-end="url(#hp-arrow)" />
      <text x="190" y="330" class="tag hi end">{{ L('collapse here', '合并到这里') }}</text>
    </g>

    <!-- the three approaches -->
    <g :class="part('marks')">
      <circle cx="108" cy="341" r="7" class="badge" />
      <text x="108" y="344.5" class="tiny c on-fill">1</text>
      <circle cx="240" cy="341" r="7" class="badge" />
      <text x="240" y="344.5" class="tiny c on-fill">2</text>
      <circle cx="262" cy="252" r="7" class="badge" />
      <text x="262" y="255.5" class="tiny c on-fill">3</text>
      <text x="273" y="255.5" class="tag hi">4 → 16 KiB</text>
    </g>
  </svg>
</template>

<style scoped>
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.tiny.on-fill {
  fill: #fff;
}
.strongt {
  fill: var(--ink);
  font-weight: 600;
}
.slot {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.slot.big {
  fill: var(--accent-soft);
  stroke: var(--ink-2);
}
.field {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.field.off {
  fill: var(--bg-sunk);
}
.entry {
  fill: var(--p0);
  stroke: none;
}
.free {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 0.6;
}
.other {
  fill: var(--rule-strong);
}
.mine {
  fill: var(--p0);
}
.ghost {
  fill: var(--p0);
  opacity: 0.28;
}
.hugeline {
  fill: none;
  stroke: var(--p0);
  stroke-width: 1.4;
}
.target {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.2;
  stroke-dasharray: 3 2;
}
.poolpage {
  fill: var(--bg-sunk);
  stroke: var(--p0);
  stroke-width: 1.2;
  stroke-dasharray: 3 2;
}
.tick {
  stroke: var(--muted);
  stroke-width: 1;
}
.tick.hot {
  stroke: var(--ink);
  stroke-width: 1.6;
}
.badge {
  fill: var(--accent);
}
.lit .cell {
  stroke: var(--accent);
  stroke-width: 1.5;
}
</style>
