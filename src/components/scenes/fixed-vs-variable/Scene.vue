<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import CompactDemo from './CompactDemo.vue'

/**
 * The running figure of the fixed-vs-variable thread: one picture in three rows, the pattern the
 * article keeps finding. Top, the variable-size things users want; middle, the table in between;
 * bottom, the fixed-size units the system manages. Each layer of the article (virtual memory,
 * malloc, kernel pages, file blocks, packets, KV blocks) relabels or redraws the same rows; the
 * panel below the rows holds what a state adds (a free list, a size-class ladder, buddy counts…).
 */
const props = defineProps<DrawingProps>()

/** frame or virtual slot i of the 16 drawn */
const X = (i: number) => 12 + 21 * i
const ROW = 146 // top of the units row

/** three regions (in the GPU state, three requests): their virtual pages and the frames holding them */
const OBJS = [
  { id: 'A', kv: 'R1', cls: 'p0', slot: 0, size: 2.2, frames: [7, 2, 12] },
  { id: 'B', kv: 'R2', cls: 'p1', slot: 4, size: 1.0003, frames: [4, 9] }, // the 4,097-byte heap
  { id: 'C', kv: 'R3', cls: 'p2', slot: 7, size: 3.5, frames: [0, 14, 5, 10] },
]
const pages = (o: (typeof OBJS)[number]) => o.frames.length
/** how full page j of an object is (0..1) */
const fill = (o: (typeof OBJS)[number], j: number) => Math.min(1, Math.max(0, o.size - j))
const FRAME = new Map<number, { cls: string; frac: number }>()
for (const o of OBJS) o.frames.forEach((f, j) => FRAME.set(f, { cls: o.cls, frac: fill(o, j) }))
const FREE = [...Array(16).keys()].filter((f) => !FRAME.has(f))

const SHOW: Record<string, string[]> = {
  overview: ['view', 'table', 'links', 'frames', 'tails', 'legend'],
  external: ['segs', 'request'],
  paging: ['view', 'table', 'links', 'frames', 'tails', 'heap'],
  buys: ['view', 'table', 'links', 'frames', 'freelist', 'split'],
  costs: ['view', 'table', 'links', 'frames', 'tails', 'costs'],
  pattern: ['view', 'table', 'links', 'frames', 'tails', 'slogan'],
  classes: ['mview', 'bins', 'runs', 'ladder'],
  hugepage: ['view', 'table', 'links', 'frames', 'groups', 'orders'],
  extents: ['dview', 'extable', 'blocks', 'extnums'],
  packets: ['stream', 'seqs', 'packets', 'atm'],
  kv: ['view', 'table', 'links', 'frames', 'tails', 'reserve'],
  choose: ['view', 'table', 'links', 'frames', 'tails', 'forces'],
}
const { part, L, viewBox } = useDrawing(props, SHOW, 380)
const costs = computed(() => props.state === 'costs')

const kv = computed(() => props.state === 'kv')
const kernel = computed(() => props.state === 'hugepage')
const chip = computed(() =>
  kv.value ? L('LLM serving', '大模型推理') : kernel.value ? L('kernel memory', '内核内存') : L('virtual memory', '虚拟内存'),
)

/* malloc: three runs, each of one size class (slot widths to scale: 24 units per 256 bytes) */
const RUNS = [
  { size: 256, x: 12, w: 24, used: [0.9, 1, 0, 0.95] },
  { size: 320, x: 114, w: 30, used: [0.9, 257 / 320, 0, 0.95] },
  { size: 384, x: 240, w: 36, used: [0.9, 0, 0.87] },
]
const ladderX = (b: number) => 30 + ((b - 256) * 300) / 256

/* file system: file A in blocks 3–8, other files elsewhere */
const DISK = new Map<number, string>([
  [0, 'muted-fill'],
  [1, 'muted-fill'],
  [10, 'muted-fill'],
  [11, 'muted-fill'],
  [13, 'muted-fill'],
  ...[3, 4, 5, 6, 7, 8].map((b) => [b, 'p0'] as [number, string]),
])

/* network: packets of a byte stream, each at most one MTU */
const PKTS = [
  { x: 12, w: 84 },
  { x: 100, w: 84 },
  { x: 188, w: 46 },
  { x: 238, w: 84 },
]
</script>

<template>
  <CompactDemo v-if="demo && state === 'hugepage'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('Variable-size objects, a table, fixed-size units', '变长的对象、中间的表、定长的单位')">
    <defs>
      <marker id="fv-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <!-- space inside an allocation that nothing uses -->
      <pattern id="fv-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4" height="4" class="hatch-bg" />
        <line x1="0" y1="0" x2="0" y2="4" class="hatch" />
      </pattern>
    </defs>

    <!-- ───────── top row: what users want ───────── -->
    <g :class="part('view')">
      <text x="12" y="16" class="tag">{{ kv ? L('each request’s KV cache', '每个请求的 KV 缓存') : L('variable-size view: regions', '变长的视图：区域') }}</text>
      <text x="348" y="16" class="tag hi end">{{ chip }}</text>
      <g v-for="o in OBJS" :key="o.id">
        <rect v-for="j in pages(o)" :key="j" :x="X(o.slot + j - 1)" y="24" width="20" height="24" rx="2" class="slot" />
        <rect :x="X(o.slot)" y="24" :width="Math.max(1.5, o.size * 21 - 1)" height="24" rx="2" :class="o.cls" />
        <!-- where one page ends and the next begins -->
        <path v-for="j in pages(o) - 1" :key="'c' + j" :d="`M${X(o.slot + j) - 0.5},24 L${X(o.slot + j) - 0.5},48`" class="cut" />
        <text :x="X(o.slot) + 10" y="40" class="num c on-fill">{{ kv ? o.kv : o.id }}</text>
      </g>
    </g>
    <g :class="part('slogan')">
      <path v-for="o in OBJS" :key="o.id" :d="`M${X(o.slot)},53 L${X(o.slot)},56 L${X(o.slot) + pages(o) * 21 - 1},56 L${X(o.slot) + pages(o) * 21 - 1},53`" class="bracket" />
      <text x="252" y="34" class="tag hi">{{ L('contiguous', '对使用者') }}</text>
      <text x="252" y="46" class="tag hi">{{ L('to the user', '是连续的') }}</text>
    </g>
    <g :class="part('heap')">
      <text x="96" y="64" class="tag hi">{{ L('B: 4,097 B → 2 pages, 4,095 B unused', 'B：4097 B → 2 页，4095 B 没用上') }}</text>
    </g>

    <!-- ───────── middle row: the table in between ───────── -->
    <g :class="part('table')">
      <rect x="8" y="78" width="344" height="44" rx="5" class="box" />
      <text x="16" y="92" class="tag hi">{{ kv ? L('block table', '块表') : L('page table', '页表') }}</text>
      <text x="344" y="92" class="tag end">{{ L('the table in between', '中间那张表') }}</text>
      <g v-for="o in OBJS" :key="o.id">
        <g v-for="(f, j) in o.frames" :key="j">
          <rect :x="X(o.slot + j)" y="98" width="20" height="18" rx="2" class="cell" />
          <text :x="X(o.slot + j) + 10" y="111" class="code c">{{ f }}</text>
        </g>
      </g>
    </g>
    <g :class="part('links')">
      <template v-for="o in OBJS" :key="o.id">
        <path v-for="(f, j) in o.frames" :key="j" :d="`M${X(o.slot + j) + 10},116 L${X(f) + 10},${ROW}`" class="link" :class="{ solid: costs && o.id === 'A' }" />
      </template>
    </g>

    <!-- ───────── bottom row: fixed-size units ───────── -->
    <g :class="part('frames')">
      <g v-for="f in 16" :key="f">
        <rect :x="X(f - 1)" :y="ROW" width="20" height="28" rx="2" class="cell" />
        <rect v-if="FRAME.has(f - 1)" :x="X(f - 1)" :y="ROW" :width="Math.max(1.5, FRAME.get(f - 1)!.frac * 20)" height="28" rx="2" :class="FRAME.get(f - 1)!.cls" />
        <text :x="X(f - 1) + 10" y="185" class="num c">{{ f - 1 }}</text>
      </g>
      <text x="12" y="220" class="tag">
        {{
          kv
            ? L('fixed-size units: physical KV blocks, 16 tokens each', '定长单位：物理 KV 块，每块 16 个 token')
            : L('fixed-size units: page frames, 4 KiB each', '定长单位：页帧，每个 4 KiB')
        }}
      </text>
    </g>
    <!-- internal fragmentation: the unused tail of each object's last unit -->
    <g :class="part('tails')">
      <template v-for="o in OBJS" :key="o.id">
        <rect :x="X(o.slot) + o.size * 21 - 1" y="24" :width="pages(o) * 21 - 1 - (o.size * 21 - 1)" height="24" class="tail" />
        <rect
          :x="X(o.frames[pages(o) - 1]) + fill(o, pages(o) - 1) * 20"
          :y="ROW"
          :width="20 - fill(o, pages(o) - 1) * 20"
          height="28"
          class="tail"
        />
      </template>
    </g>

    <!-- segmentation: variable-size segments placed straight into memory, 5 units per byte -->
    <g :class="part('segs')">
      <text x="12" y="140" class="tag">{{ L('physical memory, segments placed directly', '物理内存，段直接放在里面') }}</text>
      <rect x="12" :y="ROW" width="90" height="28" rx="2" class="p0" />
      <rect x="102.5" :y="ROW + 0.5" width="49" height="27" rx="2" class="hole" />
      <rect x="152" :y="ROW" width="100" height="28" rx="2" class="p1" />
      <rect x="252.5" :y="ROW + 0.5" width="49" height="27" rx="2" class="hole" />
      <rect x="302" :y="ROW" width="46" height="28" rx="2" class="p2" />
      <text x="57" y="164" class="lbl c on-fill">A</text>
      <text x="202" y="164" class="lbl c on-fill">B</text>
      <text x="325" y="164" class="lbl c on-fill">C</text>
      <text x="127" y="164" class="sub c">10 B</text>
      <text x="277" y="164" class="sub c">10 B</text>
      <text x="127" y="190" class="tag c">{{ L('free', '空闲') }}</text>
      <text x="277" y="190" class="tag c">{{ L('free', '空闲') }}</text>
      <text x="12" y="220" class="tag">{{ L('no byte wasted inside A, B or C: the waste is between them', 'A、B、C 内部一个字节也没浪费：浪费在它们之间') }}</text>
    </g>
    <g :class="part('request')">
      <text x="12" y="80" class="tag">{{ L('a new request', '一个新请求') }}</text>
      <rect x="12" y="88" width="75" height="24" rx="2" class="box strong" />
      <text x="49.5" y="104" class="lbl c">15 B</text>
      <text x="100" y="105" class="bad-text big">✕</text>
      <text x="118" y="98" class="tag hi">{{ L('20 B free, but in two pieces of 10:', '空闲共 20 B，却分成两块 10 B：') }}</text>
      <text x="118" y="111" class="tag hi">{{ L('no 15 B in one piece', '找不到连续的 15 B') }}</text>
    </g>

    <!-- malloc: size classes -->
    <g :class="part('mview')">
      <text x="12" y="16" class="tag">{{ L('objects of any size', '任意大小的对象') }}</text>
      <text x="348" y="16" class="tag hi end">malloc</text>
      <rect x="144" y="24" width="24.1" height="24" rx="2" class="p0" />
      <text x="174" y="40" class="tag hi">{{ L('a 257-byte request', '一个 257 字节的请求') }}</text>
      <path d="M156,48 L156,96" class="call" marker-end="url(#fv-arrow)" />
    </g>
    <g :class="part('bins')">
      <rect x="8" y="78" width="344" height="44" rx="5" class="box" />
      <text x="16" y="92" class="tag hi">{{ L('size-class bins', '尺寸类别的空闲桶') }}</text>
      <text x="344" y="92" class="tag end">{{ L('the table in between', '中间那张表') }}</text>
      <g v-for="r in RUNS" :key="r.size">
        <rect :x="r.x + (r.used.length * r.w) / 2 - 22" y="98" width="44" height="18" rx="2" class="cell" :class="{ hot: r.size === 320 }" />
        <text :x="r.x + (r.used.length * r.w) / 2" y="111" class="code c">{{ r.size }} B</text>
        <path :d="`M${r.x + (r.used.length * r.w) / 2},116 L${r.x + (r.used.length * r.w) / 2},${ROW - 2}`" class="link" />
      </g>
    </g>
    <g :class="part('runs')">
      <g v-for="r in RUNS" :key="r.size">
        <g v-for="(u, i) in r.used" :key="i">
          <rect :x="r.x + i * r.w" :y="ROW" :width="r.w - 1" height="28" rx="2" class="cell" />
          <rect v-if="u" :x="r.x + i * r.w" :y="ROW" :width="u * (r.w - 1)" height="28" rx="2" :class="r.size === 320 && i === 1 ? 'p0' : 'muted-fill'" />
          <rect v-if="u && u < 1" :x="r.x + i * r.w + u * (r.w - 1)" :y="ROW" :width="(1 - u) * (r.w - 1)" height="28" class="tail" />
        </g>
        <path :d="`M${r.x},180 L${r.x},183 L${r.x + r.used.length * r.w - 1},183 L${r.x + r.used.length * r.w - 1},180`" class="bracket" />
        <text :x="r.x + (r.used.length * r.w) / 2" y="196" class="tag c">{{ L(`run of ${r.size} B slots`, `${r.size} B 槽位的区块`) }}</text>
      </g>
      <text x="12" y="220" class="tag">{{ L('inside a run every slot is the same size: allocation is a pop', '同一区块里槽位一样大：分配就是弹出一个') }}</text>
    </g>
    <g :class="part('ladder')">
      <text x="12" y="244" class="tag hi">{{ L('jemalloc: four size classes per doubling', 'jemalloc：每翻一倍分四个尺寸类别') }}</text>
      <rect :x="ladderX(257)" y="272" :width="ladderX(320) - ladderX(257)" height="10" class="tail" />
      <path :d="`M${ladderX(256)},282 L${ladderX(512)},282`" class="call" />
      <g v-for="b in [256, 320, 384, 448, 512]" :key="b">
        <path :d="`M${ladderX(b)},276 L${ladderX(b)},288`" class="call" />
        <text :x="ladderX(b)" y="301" class="num c">{{ b }}</text>
      </g>
      <path :d="`M${ladderX(257)},262 L${ladderX(257)},280`" class="call" marker-end="url(#fv-arrow)" />
      <text :x="ladderX(257) + 6" y="266" class="tag">{{ L('257 B lands in the 320 B class', '257 B 落进 320 B 这一类') }}</text>
      <text x="12" y="320" class="sub">{{ L('63 B unused: 19.7% of the slot', '63 B 没用上：占槽位的 19.7%') }}</text>
      <text x="12" y="338" class="sub">{{ L('k classes per doubling: worst waste ≈ 1/(k+1)', '每翻一倍分 k 类：最坏浪费 ≈ 1/(k+1)') }}</text>
      <text x="12" y="354" class="sub">{{ L('k = 1, powers of two: 1/2 · k = 4: 1/5', 'k = 1（二次幂）：1/2 · k = 4：1/5') }}</text>
    </g>

    <!-- file system: a block map against extents -->
    <g :class="part('dview')">
      <text x="12" y="16" class="tag">{{ L('a file', '一个文件') }}</text>
      <text x="348" y="16" class="tag hi end">{{ L('file system', '文件系统') }}</text>
      <rect v-for="j in 6" :key="j" :x="X(j - 1)" y="24" width="20" height="24" rx="2" class="slot" />
      <rect x="12" y="24" width="125" height="24" rx="2" class="p0" />
      <text x="74" y="40" class="num c on-fill">{{ L('file A: 6 blocks', '文件 A：6 个块') }}</text>
    </g>
    <g :class="part('extable')">
      <rect x="8" y="78" width="344" height="44" rx="5" class="box" />
      <text x="16" y="92" class="tag hi">{{ L('extents', '区段') }}</text>
      <text x="344" y="92" class="tag end">{{ L('the table in between', '中间那张表') }}</text>
      <rect x="12" y="98" width="125" height="18" rx="2" class="cell hot" />
      <text x="74" y="111" class="code c">{{ L('block 3, length 6', '起始块 3，长度 6') }}</text>
      <text x="146" y="111" class="tag">{{ L('one entry, not six pointers', '一条记录，而不是六个指针') }}</text>
      <path :d="`M12,116 L137,116 L${X(8) + 20},${ROW} L${X(3)},${ROW} Z`" class="spread" />
    </g>
    <g :class="part('blocks')">
      <g v-for="f in 16" :key="f">
        <rect :x="X(f - 1)" :y="ROW" width="20" height="28" rx="2" class="cell" />
        <rect v-if="DISK.has(f - 1)" :x="X(f - 1)" :y="ROW" width="20" height="28" rx="2" :class="DISK.get(f - 1)" />
        <text :x="X(f - 1) + 10" y="185" class="num c">{{ f - 1 }}</text>
      </g>
      <text x="12" y="220" class="tag">{{ L('fixed-size units: disk blocks, often 4 KiB', '定长单位：磁盘块，通常 4 KiB') }}</text>
      <rect x="284" y="211" width="12" height="11" rx="2" class="muted-fill" />
      <text x="348" y="220" class="tag end">{{ L('other files', '其他文件') }}</text>
    </g>
    <g :class="part('extnums')">
      <text x="12" y="244" class="tag hi">{{ L('a 1 GiB file, contiguous, in 4 KiB blocks', '一个 1 GiB 的连续文件，块大小 4 KiB') }}</text>
      <text x="12" y="264" class="sub">{{ L('block map: 262,144 pointers, 1 MiB', '块映射：262144 个指针，1 MiB') }}</text>
      <text x="12" y="282" class="sub">{{ L('extents: 8 × 12 B = 96 B', '区段：8 × 12 B = 96 B') }}</text>
      <text x="12" y="302" class="tag">{{ L('badly fragmented: up to one extent per block', '碎得厉害时：最坏每块一个区段') }}</text>
    </g>

    <!-- network: a byte stream in packets -->
    <g :class="part('stream')">
      <text x="12" y="16" class="tag">{{ L('one byte stream (TCP)', '一条字节流（TCP）') }}</text>
      <text x="348" y="16" class="tag hi end">{{ L('network', '网络') }}</text>
      <rect x="12" y="24" width="310" height="24" rx="2" class="p0" />
      <path d="M326,36 L344,36" class="call" marker-end="url(#fv-arrow)" />
      <path v-for="p in PKTS.slice(1)" :key="p.x" :d="`M${p.x - 2},24 L${p.x - 2},48`" class="cut" />
    </g>
    <g :class="part('seqs')">
      <rect x="8" y="78" width="344" height="44" rx="5" class="box" />
      <text x="16" y="92" class="tag hi">{{ L('sequence numbers: where bytes belong', '序列号：字节在流中的位置') }}</text>
      <text x="344" y="92" class="tag end">{{ L('the table in between', '中间那张表') }}</text>
      <g v-for="p in PKTS" :key="p.x">
        <rect :x="p.x + p.w / 2 - 16" y="98" width="32" height="18" rx="2" class="cell" />
        <text :x="p.x + p.w / 2" y="111" class="code c">seq</text>
        <path :d="`M${p.x + p.w / 2},116 L${p.x + p.w / 2},${ROW}`" class="link" />
      </g>
    </g>
    <g :class="part('packets')">
      <g v-for="p in PKTS" :key="p.x">
        <rect :x="p.x" :y="ROW" :width="p.w" height="28" rx="2" class="p0 soft" />
        <rect :x="p.x" :y="ROW" width="6" height="28" rx="1.5" class="hdr" />
      </g>
      <path d="M12,180 L12,183 L96,183 L96,180" class="bracket" />
      <text x="54" y="196" class="tag c">{{ L('at most one MTU', '最多一个 MTU') }}</text>
      <text x="12" y="220" class="tag">{{ L('packets: variable size up to a bound (1,500 B on Ethernet)', '分组：上限以内大小可变（以太网 1500 B）') }}</text>
    </g>
    <g :class="part('atm')">
      <text x="12" y="244" class="tag hi">{{ L('ATM: every cell is 53 bytes', 'ATM：每个信元都是 53 字节') }}</text>
      <g v-for="i in 7" :key="i">
        <rect :x="12 + (i - 1) * 44" y="252" :width="i === 7 ? 16 : 40" height="20" rx="2" class="p0 soft" />
        <rect v-if="i === 7" :x="28 + (i - 1) * 44" y="252" width="24" height="20" class="tail" />
        <rect :x="12 + (i - 1) * 44" y="252" width="4" height="20" rx="1" class="hdr" />
      </g>
      <text x="12" y="290" class="sub">{{ L('5 B header + 48 B payload: about 9% header', '5 B 信头 + 48 B 载荷：约 9% 是信头') }}</text>
      <text x="12" y="306" class="sub">{{ L('the last cell of each packet is padded', '每个分组的最后一个信元要补满') }}</text>
    </g>

    <!-- the kernel: huge pages need aligned runs of free frames -->
    <g :class="part('groups')">
      <g v-for="g in 4" :key="g">
        <path :d="`M${X((g - 1) * 4)},190 L${X((g - 1) * 4)},193 L${X((g - 1) * 4 + 3) + 20},193 L${X((g - 1) * 4 + 3) + 20},190`" class="bracket" />
        <text :x="X((g - 1) * 4) + 41" y="206" class="bad-text c">✕</text>
      </g>
    </g>
    <g :class="part('orders')">
      <text x="12" y="244" class="tag hi">{{ L('free blocks per order, as /proc/buddyinfo counts them', '每一阶的空闲块数，如 /proc/buddyinfo 所列') }}</text>
      <g v-for="(o, i) in [{ n: 7, w: L('1 frame', '1 帧') }, { n: 0, w: L('2 frames', '2 帧') }, { n: 0, w: L('4 frames', '4 帧') }]" :key="i">
        <text :x="60 + i * 110" y="270" class="big c count">{{ o.n }}</text>
        <text :x="60 + i * 110" y="286" class="tag c">{{ L(`order ${i}`, `${i} 阶`) }} · {{ o.w }}</text>
      </g>
      <text x="12" y="310" class="tag">{{ L('simplified: 4 frames stand for the 512 of a 2 MiB page', '简化：这里 4 帧代表 2 MiB 大页的 512 帧') }}</text>
    </g>

    <!-- what a fixed size buys -->
    <g :class="part('freelist')">
      <text x="12" y="244" class="tag hi">{{ L('free list: every free frame is as good as any other', '空闲列表：每个空闲页帧都一样好') }}</text>
      <g v-for="(f, i) in FREE" :key="f">
        <rect :x="12 + i * 38" y="252" width="24" height="18" rx="2" class="cell" :class="{ hot: i === 0 }" />
        <text :x="24 + i * 38" y="265" class="code c">{{ f }}</text>
        <path v-if="i < FREE.length - 1" :d="`M${37 + i * 38},261 L${49 + i * 38},261`" class="call" marker-end="url(#fv-arrow)" />
      </g>
      <text x="12" y="288" class="sub">{{ L('allocate: take the first. No search, no split', '分配：取第一个。不用查找，不用分割') }}</text>
      <rect v-for="f in FREE" :key="'r' + f" :x="X(f) + 0.5" :y="ROW + 0.5" width="19" height="27" rx="2" class="ring" />
    </g>
    <g :class="part('split')">
      <text x="12" y="314" class="tag hi">{{ L('translation is arithmetic', '地址转换只是算术') }}</text>
      <rect x="12" y="322" width="80" height="20" rx="2" class="cell hot" />
      <rect x="92" y="322" width="80" height="20" rx="2" class="cell" />
      <text x="52" y="336" class="sub c">{{ L('page no.', '页号') }}</text>
      <text x="132" y="336" class="sub c">{{ L('offset', '偏移量') }}</text>
      <text x="182" y="330" class="tag">{{ L('page no. → table → frame', '页号 → 查表 → 页帧') }}</text>
      <text x="182" y="343" class="tag">{{ L('offset passes through', '偏移量原样通过') }}</text>
    </g>

    <!-- the costs, numbered where they are -->
    <g :class="part('costs')">
      <g v-for="m in [{ n: 1, y: 36 }, { n: 2, y: 108 }, { n: 3, y: 134 }]" :key="m.n">
        <circle cx="342" :cy="m.y" r="7" class="mark" />
        <text x="342" :y="m.y + 3.5" class="num c on-fill">{{ m.n }}</text>
      </g>
      <g v-for="(t, i) in [
        L('internal waste: the hatched tails, under one unit each', '内部浪费：斜线部分，每个对象不到一个单位'),
        L('metadata: one entry per unit. 32-bit, 4 KiB pages: 4 MB', '元数据：每个单位一条表项。32 位、4 KiB 页：4 MB'),
        L('contiguity lost: A sits in frames 7, 2 and 12', '失去连续性：A 散在第 7、2、12 帧'),
      ]" :key="i">
        <circle cx="19" :cy="244 + i * 22" r="7" class="mark" />
        <text x="19" :y="247.5 + i * 22" class="num c on-fill">{{ i + 1 }}</text>
        <text x="32" :y="248 + i * 22" class="sub">{{ t }}</text>
      </g>
    </g>

    <g :class="part('slogan')">
      <rect x="8" y="232" width="344" height="48" rx="6" class="box gate" />
      <text x="180" y="252" class="lbl c">{{ L('variable-size objects, described by a table,', '变长的对象，由一张表来描述，') }}</text>
      <text x="180" y="270" class="lbl c">{{ L('built out of fixed-size units', '用定长的单位搭成') }}</text>
    </g>

    <g :class="part('legend')">
      <rect x="12" y="236" width="20" height="14" class="tail" />
      <text x="40" y="247" class="sub">{{ L('unused: internal fragmentation', '没用上：内部碎片') }}</text>
      <rect x="12" y="258" width="20" height="14" rx="2" class="cell" />
      <text x="40" y="269" class="sub">{{ L('free frame: any one can hold any page', '空闲页帧：任何一个都能装任何一页') }}</text>
    </g>

    <!-- the earlier, contiguous way to hold a KV cache -->
    <g :class="part('reserve')">
      <text x="12" y="244" class="tag hi">{{ L('earlier: one region per request, sized for the maximum', '早期：每个请求一整块，按最大长度预留') }}</text>
      <rect x="12" y="252" width="336" height="18" rx="2" class="hole" />
      <rect x="12" y="252" width="101" height="18" rx="2" class="p0" />
      <text x="62" y="265" class="num c on-fill">{{ L('tokens so far', '已有的 token') }}</text>
      <text x="230" y="265" class="tag c">{{ L('reserved for the maximum length', '为最大长度预留') }}</text>
      <text x="12" y="288" class="sub">{{ L('in all, only 20.4–38.2% of KV-cache memory held tokens', '总的看，KV 缓存内存只有 20.4%–38.2% 存着 token') }}</text>
      <text x="12" y="304" class="sub">{{ L('blocks: waste only in each request’s last block', '分块后：浪费只在每个请求的最后一块') }}</text>
    </g>

    <!-- the one number every system tunes -->
    <g :class="part('forces')">
      <text x="12" y="244" class="tag hi">{{ L('one number to tune: the unit size', '要调的只有一个数：单位大小') }}</text>
      <text x="170" y="264" class="tag">{{ L('small unit', '单位小') }}</text>
      <text x="340" y="264" class="tag end">{{ L('large unit', '单位大') }}</text>
      <g v-for="(f, i) in [
        { t: L('internal waste', '内部浪费'), up: true, cls: 'w-waste' },
        { t: L('metadata', '元数据'), up: false, cls: 'w-meta' },
        { t: L('contiguity', '连续性'), up: true, cls: 'w-cont' },
      ]" :key="i">
        <text x="12" :y="288 + i * 26" class="sub">{{ f.t }}</text>
        <path
          :d="f.up ? `M170,${292 + i * 26} L340,${292 + i * 26} L340,${276 + i * 26} Z` : `M170,${292 + i * 26} L340,${292 + i * 26} L170,${276 + i * 26} Z`"
          :class="f.cls"
        />
      </g>
      <text x="12" y="368" class="tag">{{ L('vLLM measured block sizes and chose 16 tokens', 'vLLM 测量了不同块大小，选了 16 个 token') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.slot {
  fill: none;
  stroke: var(--rule-strong);
  stroke-width: 1;
  stroke-dasharray: 2 2;
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
.hole {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.hatch-bg {
  fill: var(--bg-elev);
}
.hatch {
  stroke: var(--muted);
  stroke-width: 1.3;
}
.tail {
  fill: url(#fv-hatch);
}
.num {
  font-size: 8.5px;
  fill: var(--muted);
}
.num.on-fill {
  fill: #fff;
  font-weight: 600;
}
.count {
  fill: var(--ink);
}
.lbl.on-fill {
  fill: #fff;
}
.ring {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.6;
}
.bracket {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
}
.spread {
  fill: var(--p0);
  opacity: 0.16;
}
.soft {
  opacity: 0.55;
}
.hdr {
  fill: var(--ink-2);
}
.cut {
  stroke: var(--bg-elev);
  stroke-width: 2;
}
.mark {
  fill: var(--ink-2);
}
.w-waste {
  fill: var(--p3);
  opacity: 0.7;
}
.w-meta {
  fill: var(--muted);
  opacity: 0.7;
}
.w-cont {
  fill: var(--ok);
  opacity: 0.7;
}
.lit .tail {
  stroke: var(--accent);
  stroke-width: 1.5;
}
.lit .bracket {
  stroke: var(--accent);
  stroke-width: 1.8;
}
.lit .p0,
.lit .p1,
.lit .p2 {
  stroke: var(--accent);
  stroke-width: 1.5;
}
</style>
