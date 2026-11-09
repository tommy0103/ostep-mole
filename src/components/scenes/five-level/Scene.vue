<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import GridDemo from './GridDemo.vue'

/**
 * The running figure of the five-level article: a 64-bit address, the page-table levels as a row of
 * boxes each under the bits that index it, and the address space as a bar. On virtual machines the
 * same row of boxes becomes the head of a grid: under each guest table, the host walk that finds it.
 */
const props = defineProps<DrawingProps>()

const TREE4 = ['cr3', 'pml4', 'pdpt', 'pd', 'pt', 'data']
const TREE5 = ['cr3', 'pml5', 'pml4', 'pdpt', 'pd', 'pt', 'data']
const SHOW: Record<string, string[]> = {
  overview: ['addr', 'links', 'tlb', ...TREE4, 'space'],
  four: ['addr', 'links', ...TREE4, 'reads'],
  canonical: ['addr', 'space'],
  sparse: [...TREE4, 'absent'],
  fifth: ['addr', 'links', ...TREE5, 'reads', 'fifthnote'],
  linux: [...TREE5, 'names'],
  optin: ['addr', 'jit', 'space', 'hint'],
  direct: ['space', 'ram'],
  cached: [...TREE5, 'walkcache'],
  nested: [...TREE4, 'hostbox'],
  grid: [...TREE4, 'grid'],
  grid35: [...TREE5, 'grid'],
  hostpages: [...TREE4, 'grid'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 430)
const st = computed(() => props.state)
const five = computed(() => shown.value.has('pml5'))
const fiveSpace = computed(() => ['optin', 'direct'].includes(st.value))

/* the address, 64 bits across 344 units; the top bits are copies of the highest used one */
const BIT = 344 / 64
const fields = computed(() => {
  const n = five.value || st.value === 'optin' ? 5 : 4
  const sign = 64 - 12 - 9 * n
  let x = 8
  const out = [{ x, w: sign * BIT, t: n === 5 ? L('copies', '复制') : L('copies of bit 47', '复制第 47 位'), kind: 'sign' }]
  x += sign * BIT
  for (let i = 0; i < n; i++) {
    out.push({ x, w: 9 * BIT, t: L('9 bits', '9 位'), kind: 'idx' })
    x += 9 * BIT
  }
  out.push({ x, w: 12 * BIT, t: L('12-bit offset', '12 位偏移'), kind: 'off' })
  return out
})

/* the levels: slot 0 holds CR3 when there are five levels, slot 1 otherwise */
const SX = (i: number) => 9 + i * 50
const cx = (i: number) => SX(i) + 20
const BOXES = [
  { id: 'pml5', slot: 1, name: ['PML5', 'PML5'], maps: '256 TiB' },
  { id: 'pml4', slot: 2, name: ['PML4', 'PML4'], maps: '512 GiB' },
  { id: 'pdpt', slot: 3, name: ['PDPT', 'PDPT'], maps: '1 GiB' },
  { id: 'pd', slot: 4, name: ['PD', '页目录'], maps: '2 MiB' },
  { id: 'pt', slot: 5, name: ['PT', '页表'], maps: '4 KiB' },
]
const cr3Slot = computed(() => (five.value ? 0 : 1))
const firstLevel = computed(() => (five.value ? 0 : 1))
const fieldCx = computed(() => {
  const f = fields.value.filter((x) => x.kind === 'idx')
  return (five.value ? BOXES : BOXES.slice(1)).map((b, i) => ({ fx: f[i].x + f[i].w / 2, bx: cx(b.slot) }))
})

/* the grid under the levels: one column per guest table (and the data), one row per host level */
const gridCols = computed(() => (five.value ? [1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6]))
const ROW = { guest: 262, rows: [162, 182, 202, 222, 242] }
const hostRows = computed(() => {
  // with 4 host levels the top row (a host PML5) is not there; with 2 MiB host pages, the last goes too
  const names = ['PML5', 'PML4', 'PDPT', 'PD', 'PT']
  return names.map((n, i) => ({ n, y: ROW.rows[i], on: (five.value || i > 0) && !(st.value === 'hostpages' && i === 4), ghost: st.value === 'hostpages' && i === 4 }))
})
const total = computed(() => {
  if (st.value === 'grid35') return L('6 host walks × 5 + 5 guest entries = 35', '6 趟宿主机遍历 × 5 + 5 个客户机表项 = 35')
  if (st.value === 'hostpages') return L('5 host walks × 3 + 4 guest entries = 19', '5 趟宿主机遍历 × 3 + 4 个客户机表项 = 19')
  return L('5 host walks × 4 + 4 guest entries = 24', '5 趟宿主机遍历 × 4 + 4 个客户机表项 = 24')
})
const lastCol = computed(() => gridCols.value[gridCols.value.length - 1])
</script>

<template>
  <GridDemo v-if="demo && state === 'grid'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A page-table walk from CR3 to the data', '从 CR3 到数据的页表遍历')">
    <defs>
      <marker id="fl-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- the 64-bit virtual address -->
    <g :class="part('addr')">
      <text x="8" y="11" class="tag">{{ five || st === 'optin' ? L('a 64-bit pointer: 57 bits count', '64 位指针：57 位有效') : L('a 64-bit pointer: 48 bits count', '64 位指针：48 位有效') }}</text>
      <g v-for="(f, i) in fields" :key="i">
        <rect :x="f.x" y="16" :width="f.w" height="20" class="field" :class="[f.kind, { hot: f.kind === 'sign' && (st === 'canonical' || st === 'optin') }]" />
        <text :x="f.x + f.w / 2" y="29.5" class="tiny c">{{ f.t }}</text>
      </g>
    </g>
    <g :class="part('jit')">
      <text x="8" y="52" class="tag hi">{{ L('some JIT compilers keep their own data in the high bits', '一些 JIT 编译器把自己的数据放在高位') }}</text>
    </g>

    <!-- each index picks an entry in the table under it -->
    <g :class="part('links')">
      <path v-for="(c, i) in fieldCx" :key="i" :d="`M${c.fx},36 L${c.bx},92`" class="link" />
    </g>

    <!-- the TLB comes first -->
    <g :class="part('tlb')">
      <rect x="9" y="46" width="48" height="36" rx="5" class="box strong" />
      <text x="33" y="62" class="lbl c">TLB</text>
      <text x="33" y="75" class="tiny c">{{ L('hit: done', '命中：完成') }}</text>
      <path d="M33,82 L33,116 L57,116" class="link solid" marker-end="url(#fl-arrow)" />
      <text x="12" y="104" class="tiny">{{ L('miss', '未命中') }}</text>
    </g>

    <!-- CR3 -->
    <g :class="part('cr3')">
      <rect :x="SX(cr3Slot)" y="92" width="40" height="48" rx="5" class="box gate" />
      <text :x="cx(cr3Slot)" y="112" class="lbl c">CR3</text>
      <text :x="cx(cr3Slot)" y="127" class="tiny c">{{ L('register', '寄存器') }}</text>
    </g>

    <!-- the levels; an arrow leads into each from the one before -->
    <g v-for="(b, i) in BOXES" :key="b.id" :class="part(b.id)">
      <rect :x="SX(b.slot)" y="92" width="40" height="48" rx="5" class="box" :class="{ fresh: b.id === 'pml5' && st === 'fifth', dim: st === 'cached' && b.slot <= 3 }" />
      <text :x="cx(b.slot)" y="110" class="lbl small c">{{ L(b.name[0], b.name[1]) }}</text>
      <text :x="cx(b.slot)" y="127" class="tiny c">{{ b.maps }}</text>
      <path :d="`M${SX(b.slot) - 10},116 L${SX(b.slot) - 1},116`" class="link solid" :class="{ gone: i === 0 && !shown.has('cr3') }" marker-end="url(#fl-arrow)" />
    </g>

    <!-- the data page -->
    <g :class="part('data')">
      <rect :x="SX(6)" y="92" width="42" height="48" rx="5" class="box strong" />
      <text :x="SX(6) + 21" y="112" class="lbl c">{{ L('data', '数据') }}</text>
      <text :x="SX(6) + 21" y="127" class="tiny c">{{ L('the page', '目标页') }}</text>
      <path :d="`M${SX(6) - 10},116 L${SX(6) - 1},116`" class="link solid" marker-end="url(#fl-arrow)" />
    </g>

    <!-- one memory reference per level -->
    <g :class="part('reads')">
      <g v-for="(b, i) in BOXES.slice(firstLevel === 0 ? 0 : 1)" :key="b.id">
        <circle :cx="SX(b.slot) + 38" cy="92" r="6.5" class="badge" />
        <text :x="SX(b.slot) + 38" y="95.2" class="tiny c on-fill">{{ i + 1 }}</text>
      </g>
      <text x="180" y="160" class="tag hi c">{{ five ? L('five references before the access', '访问之前五次内存访问') : L('four references before the access', '访问之前四次内存访问') }}</text>
    </g>

    <!-- only the paths in use exist -->
    <g :class="part('absent')">
      <g v-for="l in [3, 4, 5]" :key="l">
        <path :d="`M${cx(l)},140 L${cx(l)},156`" class="link" />
        <rect :x="SX(l)" y="156" width="40" height="30" rx="4" class="box gone-box" />
        <text :x="cx(l)" y="175" class="bad-text c">✕</text>
        <rect :x="SX(l)" y="196" width="40" height="30" rx="4" class="box gone-box" />
        <text :x="cx(l)" y="215" class="bad-text c">✕</text>
      </g>
      <text x="180" y="248" class="tag hi c">{{ L('other entries are empty: the tables below them do not exist', '其余表项都是空的：它们下面的表根本不存在') }}</text>
      <text x="180" y="262" class="tag c">{{ L('so an unused region, however large, costs one empty entry', '所以一块用不到的区域，再大也只花一个空表项') }}</text>
    </g>

    <!-- the fifth level -->
    <g :class="part('fifthnote')">
      <text x="180" y="178" class="tag c">{{ L('57 bits: 128 PiB virtual · each PML5 entry: 256 TiB', '57 位：128 PiB 虚拟空间 · 每个 PML5 表项：256 TiB') }}</text>
      <text x="180" y="192" class="tag c">{{ L('physical addresses: 52 bits, 4 PiB', '物理地址：52 位，4 PiB') }}</text>
    </g>

    <!-- Linux's names for the levels -->
    <g :class="part('names')">
      <text x="9" y="158" class="tiny strongt">{{ L('5 levels', '五级') }}</text>
      <text x="9" y="176" class="tiny strongt">{{ L('4 levels', '四级') }}</text>
      <text v-for="(n, i) in ['pgd', 'p4d', 'pud', 'pmd', 'pte']" :key="'a' + i" :x="cx(i + 1)" y="158" class="code c">{{ n }}</text>
      <text :x="cx(2)" y="176" class="code c">pgd</text>
      <text :x="cx(2)" y="188" class="tiny c">{{ L('p4d folded', 'p4d 被折叠') }}</text>
      <text v-for="(n, i) in ['pud', 'pmd', 'pte']" :key="'b' + i" :x="cx(i + 3)" y="176" class="code c">{{ n }}</text>
    </g>

    <!-- page-walk caches -->
    <g :class="part('walkcache')">
      <rect :x="SX(1)" y="156" width="140" height="42" rx="5" class="box gate" />
      <text :x="SX(1) + 70" y="173" class="lbl c">{{ L('page-walk cache', '页表遍历缓存') }}</text>
      <text :x="SX(1) + 70" y="188" class="tiny c">{{ L('upper levels, for the running process', '上面几级，属于当前进程') }}</text>
      <path d="M149,156 L149,141" class="link" />
      <path :d="`M199,176 C225,176 ${cx(4)},166 ${cx(4)},143`" class="call" marker-end="url(#fl-arrow)" />
      <text x="214" y="196" class="tag hi">{{ L('the walk starts here', '遍历从这里开始') }}</text>
      <text x="129" y="214" class="tag c">{{ L('a process uses 1 PML5 entry, 1 or 2 PML4 entries', '一个进程只用 1 个 PML5 表项、一两个 PML4 表项') }}</text>
    </g>

    <!-- the host's table under the guest's -->
    <g :class="part('hostbox')">
      <text x="9" y="120" class="tag">{{ L('guest', '客户机') }}</text>
      <path v-for="l in [2, 3, 4, 5]" :key="l" :d="`M${cx(l)},142 L${cx(l)},196`" class="link" />
      <path :d="`M${SX(6) + 21},142 L${SX(6) + 21},196`" class="link" />
      <rect x="59" y="198" width="292" height="44" rx="6" class="box floor" />
      <text x="205" y="215" class="lbl c">{{ L('host table (EPT / nested page tables)', '宿主机页表（EPT / 嵌套页表）') }}</text>
      <text x="205" y="232" class="sub c">{{ L('kept by the hypervisor: guest physical → host physical', '由虚拟机监控程序维护：客户机物理 → 宿主机物理') }}</text>
      <text x="205" y="260" class="tag hi c">{{ L('every pointer in the guest’s tables is guest physical', '客户机页表里的每个指针都是客户机物理地址') }}</text>
    </g>

    <!-- the two-dimensional walk -->
    <g :class="part('grid')">
      <text v-if="!five" x="9" y="120" class="tag">{{ L('guest', '客户机') }}</text>
      <template v-for="(r, i) in hostRows" :key="r.n">
        <template v-if="r.on || r.ghost">
          <text x="9" :y="r.y + 3" class="tiny" :class="{ gh: r.ghost }">{{ L('host ', '宿主机 ') }}{{ r.n }}</text>
          <circle v-for="c in gridCols" :key="c + '-' + i" :cx="c === 6 ? SX(6) + 21 : cx(c)" :cy="r.y" r="5" class="host" :class="{ gh: r.ghost }" />
        </template>
      </template>
      <text x="9" :y="ROW.guest + 3" class="tiny strongt">{{ L('guest entry', '客户机表项') }}</text>
      <template v-for="c in gridCols" :key="'g' + c">
        <circle v-if="c !== lastCol" :cx="cx(c)" :cy="ROW.guest" r="5" class="guest" />
        <circle v-else :cx="SX(6) + 21" :cy="ROW.guest" r="5" class="corner" />
      </template>
      <text x="180" y="288" class="tag hi c">{{ total }}</text>
    </g>

    <!-- the address space, not to scale -->
    <g :class="part('space')">
      <text x="8" y="299" class="tag">{{ L('address space (not to scale)', '地址空间（未按比例）') }}</text>
      <rect x="8" y="306" width="102" height="24" rx="2" class="seg user" />
      <rect x="110" y="306" width="140" height="24" class="seg hole" />
      <rect x="250" y="306" width="102" height="24" rx="2" class="seg kern" />
      <text :x="st === 'optin' ? 78 : 59" y="321" class="tiny c ink">{{ fiveSpace ? L('user · 64 PiB', '用户 · 64 PiB') : L('user · 128 TiB', '用户 · 128 TiB') }}</text>
      <text x="180" y="321" class="tiny c">{{ L('hole: not canonical', '空洞：非规范地址') }}</text>
      <rect x="254" y="309" width="50" height="18" rx="2" class="seg dm" />
      <text x="279" y="321" class="tiny c ink">{{ L('direct map', '直接映射') }}</text>
      <text x="328" y="321" class="tiny c ink">{{ L('kernel', '内核') }}</text>
      <text x="8" y="342" class="tiny">0</text>
      <text v-if="st !== 'direct'" x="110" y="342" class="tiny c">{{ fiveSpace ? '2^56' : '2^47' }}</text>
      <text v-if="st !== 'direct'" x="250" y="342" class="tiny c">{{ fiveSpace ? '2^64 − 2^56' : '2^64 − 2^47' }}</text>
      <text x="352" y="342" class="tiny end">2^64</text>
    </g>

    <!-- user space below 2^47 by default -->
    <g :class="part('hint')">
      <path d="M46,304 L46,334" class="target" />
      <text x="46" y="342" class="tiny c strongt">2^47</text>
      <text x="180" y="360" class="tag hi c">{{ L('addresses stay below 2^47 by default', '默认只分配 2^47 以下的地址') }}</text>
      <text x="180" y="374" class="tag c">{{ L('a mmap() hint above it opts in, one mapping at a time', '给 mmap() 传更高的提示地址，逐个映射地申请') }}</text>
    </g>

    <!-- the direct map covers all physical memory -->
    <g :class="part('ram')">
      <path d="M256,330 L122,380 M302,330 L328,380" class="link" />
      <rect x="120" y="380" width="210" height="24" rx="4" class="box floor" />
      <text x="225" y="396" class="tiny c strongt">{{ L('all physical memory', '全部物理内存') }}</text>
      <text x="225" y="420" class="tag hi c">{{ L('4 levels: 64 TiB → 5 levels: 32 PiB', '四级：64 TiB → 五级：32 PiB') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.tiny.ink {
  fill: var(--ink);
}
.tiny.on-fill {
  fill: #fff;
}
.strongt {
  fill: var(--ink);
  font-weight: 600;
}
.lbl.small {
  font-size: 10.5px;
}
.field {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.field.sign,
.field.off {
  fill: var(--bg-sunk);
}
.field.hot {
  fill: var(--accent-soft);
  stroke: var(--accent);
  stroke-width: 1.6;
}
.box.fresh {
  stroke: var(--accent);
  stroke-width: 2.2;
  fill: var(--accent-soft);
}
.box.dim {
  opacity: 0.55;
}
.box.gone-box {
  fill: none;
  stroke-dasharray: 3 3;
  stroke: var(--muted);
}
.badge {
  fill: var(--accent);
}
.seg.user {
  fill: color-mix(in srgb, var(--p0) 22%, var(--bg-elev));
  stroke: var(--rule-strong);
}
.seg.hole {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-dasharray: 3 3;
}
.seg.kern {
  fill: var(--rule-strong);
}
.seg.dm {
  fill: var(--bg-elev);
}
.target {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.4;
  stroke-dasharray: 3 2;
}
.host {
  fill: var(--p1);
}
.guest {
  fill: var(--p0);
}
.corner {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.2;
  stroke-dasharray: 2 2;
}
.gh {
  opacity: 0.25;
}
.lit .host,
.lit .guest {
  stroke: var(--accent);
  stroke-width: 1.5;
}
</style>
