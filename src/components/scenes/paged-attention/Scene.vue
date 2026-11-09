<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import CowDemo from './CowDemo.vue'

/**
 * The running figure of the PagedAttention article: chapter 18 redrawn on a GPU. At the top each
 * request's logical blocks, under them its block table, and below GPU memory cut into physical
 * blocks. Block size 4, as in the paper's worked example (the real default is 16), and only 8
 * physical blocks are drawn.
 */
const props = defineProps<DrawingProps>()

const LX = (j: number) => 40 + j * 84 // logical block j
const PX = (p: number) => 12 + p * 43 // physical block p
const PY = 176 // top of GPU memory
const AY = 24 // request A's row
const BY = 86 // request B's row

interface Req {
  id: string
  y: number
  prompt: number
  n: number[] // slots filled in each logical block
  phys: number[]
  pc: string // colour of the prompt
  gc: string // colour of generated tokens
  ghost?: boolean
}
const reqs = computed<Req[]>(() => {
  switch (props.state) {
    case 'blocks':
      return [{ id: 'A', y: AY, prompt: 7, n: [4, 3], phys: [7, 1], pc: 'p0', gc: 'p2' }]
    case 'share':
      return [
        { id: 'A', y: AY, prompt: 7, n: [4, 3], phys: [7, 1], pc: 'p0', gc: 'p2' },
        { id: 'B', y: BY, prompt: 7, n: [4, 3], phys: [7, 1], pc: 'p0', gc: 'p1' },
      ]
    case 'prefix':
      return [
        { id: 'R1', y: AY, prompt: 8, n: [4, 4, 2], phys: [7, 1, 3], pc: 'p0', gc: 'p2' },
        { id: 'R2', y: BY, prompt: 8, n: [4, 4, 1], phys: [7, 1, 5], pc: 'p0', gc: 'p1' },
      ]
    case 'evict':
      return [
        { id: 'R1', y: AY, prompt: 8, n: [4, 4, 2], phys: [7, 1, 3], pc: 'p0', gc: 'p2' },
        { id: 'R2', y: BY, prompt: 8, n: [4, 4, 3], phys: [2, 5, 6], pc: 'p1', gc: 'p1', ghost: true },
      ]
    default:
      return [{ id: 'A', y: AY, prompt: 7, n: [4, 4, 1], phys: [7, 1, 3], pc: 'p0', gc: 'p2' }]
  }
})
/** what each physical block holds, slot by slot */
const slots = computed(() => {
  const m = new Map<number, string[]>()
  for (const r of reqs.value)
    r.phys.forEach((p, j) =>
      m.set(
        p,
        Array.from({ length: r.n[j] }, (_, k) => (j * 4 + k < r.prompt ? r.pc : r.gc)),
      ),
    )
  return m
})
const ghost = computed(() => new Set(reqs.value.filter((r) => r.ghost).flatMap((r) => r.phys)))
const free = computed(() => [...Array(8).keys()].filter((p) => !slots.value.has(p)))
const refs = (p: number) => reqs.value.filter((r) => r.phys.includes(p)).length
/** the two blocks the shared-prefix state keeps with no users */
const CACHED = [0, 4]

const SHOW: Record<string, string[]> = {
  overview: ['req', 'table', 'links', 'phys', 'analogy'],
  kvcache: ['tokens', 'formula', 'gpu'],
  contiguous: ['contig', 'wastes'],
  blocks: ['req', 'table', 'links', 'phys', 'free', 'steps'],
  grow: ['req', 'table', 'links', 'phys', 'free', 'steps', 'newblock'],
  walk: ['req', 'table', 'links', 'phys', 'attn'],
  split: ['req', 'table', 'links', 'phys', 'split'],
  share: ['req', 'table', 'links', 'phys', 'refs', 'sharenote'],
  prefix: ['req', 'table', 'links', 'phys', 'refs', 'cached', 'hashes'],
  evict: ['req', 'table', 'links', 'phys', 'cpu'],
  measured: ['results'],
  bends: ['vrange', 'gmmu', 'vlinks', 'phys', 'bendnotes'],
}
const { part, L, viewBox } = useDrawing(props, SHOW, 420)
const st = computed(() => props.state)
const twoRows = computed(() => reqs.value.length > 1)

/* the worked example, as in the article's table */
const STEPS = computed(() => [
  { n: L('prompt', '提示词'), c: ['7 · 4', '1 · 3', '–'] },
  { n: L('decode 1', '解码第 1 步'), c: ['7 · 4', '1 · 4', '–'] },
  { n: L('decode 2', '解码第 2 步'), c: ['7 · 4', '1 · 4', '3 · 1'] },
])
const hereRow = computed(() => (st.value === 'grow' ? 2 : 0))

/* request-rate multiples on ShareGPT, on a scale to 22 */
const barX = (v: number) => 190 + v * 5
const RATES = computed(() => [
  { t: L('vs Orca (Oracle)', '对 Orca (Oracle)'), a: 1.7, b: 2.7, w: '1.7–2.7×' },
  { t: L('vs Orca (Max)', '对 Orca (Max)'), a: 2.7, b: 8, w: '2.7–8×' },
  { t: L('vs FasterTransformer', '对 FasterTransformer'), a: 0, b: 22, w: L('up to 22×', '最高 22×') },
])
</script>

<template>
  <CowDemo v-if="demo && state === 'share'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('Requests, block tables and GPU memory cut into blocks', '请求、块表，以及切成块的 GPU 显存')">
    <defs>
      <marker id="pa-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <pattern id="pa-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4" height="4" class="hatch-bg" />
        <line x1="0" y1="0" x2="0" y2="4" class="hatch" />
      </pattern>
      <pattern id="pa-dots" width="5" height="5" patternUnits="userSpaceOnUse">
        <rect width="5" height="5" class="hatch-bg" />
        <circle cx="2.5" cy="2.5" r="1" class="dotfill" />
      </pattern>
    </defs>

    <!-- from table entries to physical blocks, behind everything else -->
    <g :class="part('links')">
      <template v-for="r in reqs" :key="r.id">
        <path v-for="(p, j) in r.phys" :key="j" :d="`M${LX(j) + 37},${r.y + 46} L${PX(p) + 20},${PY}`" class="link" :class="{ solid: st === 'grow' && j === 2 }" />
      </template>
    </g>

    <!-- each request: logical blocks of token slots -->
    <g :class="part('req')">
      <text x="40" y="14" class="tag">{{ twoRows ? L('logical blocks', '逻辑块') : L('request A: logical blocks, in token order', '请求 A：逻辑块，按 token 顺序') }}</text>
      <g v-for="r in reqs" :key="r.id">
        <text x="12" :y="r.y + 16" class="lbl">{{ r.id }}</text>
        <g v-for="(n, j) in r.n" :key="j">
          <rect v-for="k in 4" :key="k" :x="LX(j) + (k - 1) * 19" :y="r.y" width="18" height="22" rx="1.5" class="cell" />
          <rect v-for="k in n" :key="'f' + k" :x="LX(j) + (k - 1) * 19" :y="r.y" width="18" height="22" rx="1.5" :class="j * 4 + k <= r.prompt ? r.pc : r.gc" />
        </g>
      </g>
      <text x="348" :y="AY + 15" class="tag end">token</text>
    </g>
    <g :class="part('table')">
      <g v-for="r in reqs" :key="r.id">
        <g v-for="(p, j) in r.phys" :key="j">
          <rect :x="LX(j)" :y="r.y + 26" width="75" height="20" rx="2" class="cell" :class="{ fresh: st === 'grow' && j === 2, hot: st === 'split' && j === 2 }" />
          <text :x="LX(j) + 37" :y="r.y + 40" class="sub c">{{ L(`→ ${p}, ${r.n[j]} filled`, `→ ${p}，已填 ${r.n[j]}`) }}</text>
        </g>
      </g>
      <text x="348" :y="AY + 40" class="tag end">{{ L('block table', '块表') }}</text>
    </g>

    <!-- GPU memory: physical blocks -->
    <g :class="part('phys')">
      <text x="12" y="166" class="tag halo">{{ L('GPU memory: physical blocks, 4 token slots each here', 'GPU 显存：物理块，这里每块 4 个 token 槽位') }}</text>
      <g v-for="p in 8" :key="p">
        <rect :x="PX(p - 1)" :y="PY" width="41" height="24" rx="2" class="box" :class="{ gone: ghost.has(p - 1) }" />
        <g v-for="k in 4" :key="k">
          <rect :x="PX(p - 1) + 1 + (k - 1) * 10" :y="PY + 2" width="9" height="20" rx="1" class="slot" />
          <rect v-if="slots.get(p - 1)?.[k - 1]" :x="PX(p - 1) + 1 + (k - 1) * 10" :y="PY + 2" width="9" height="20" rx="1" :class="[slots.get(p - 1)![k - 1], { faded: ghost.has(p - 1) }]" />
        </g>
        <text :x="PX(p - 1) + 20" y="213" class="num c">{{ p - 1 }}</text>
      </g>
    </g>
    <g :class="part('free')">
      <text x="12" y="234" class="tag">{{ L('free blocks: any one will do', '空闲块：任何一个都行') }}</text>
      <g v-for="(p, i) in free" :key="p">
        <rect :x="172 + i * 26" y="224" width="22" height="14" rx="2" class="cell" />
        <text :x="183 + i * 26" y="235" class="code c">{{ p }}</text>
      </g>
    </g>

    <!-- the new block when the request grows -->
    <g :class="part('newblock')">
      <rect :x="PX(3) - 3" :y="PY - 3" width="47" height="30" rx="4" class="outline fresh-line" />
    </g>

    <!-- block = page, and so on -->
    <g :class="part('analogy')">
      <rect x="8" y="240" width="344" height="52" rx="6" class="box gate" />
      <text x="180" y="261" class="lbl c">{{ L('block = page, token = byte, request = process', '块 = 页，token = 字节，请求 = 进程') }}</text>
      <text x="180" y="279" class="sub c ink">{{ L('physical block = page frame · block table = page table', '物理块 = 页帧 · 块表 = 页表') }}</text>
    </g>

    <!-- the size of the KV cache, before any block is drawn -->
    <g :class="part('tokens')">
      <text x="12" y="14" class="tag">{{ L('one request: a key and a value for every token', '一个请求：每个 token 一份键和值') }}</text>
      <g v-for="i in 9" :key="i">
        <rect :x="12 + (i - 1) * 26" y="24" width="24" height="22" rx="2" class="p0 soft" />
        <text :x="24 + (i - 1) * 26" y="39" class="num c strong">K V</text>
      </g>
      <text x="252" y="39" class="tag">{{ L('… grows at every step', '……每一步都在长') }}</text>
    </g>
    <g :class="part('formula')">
      <text x="12" y="74" class="tag hi">{{ L('OPT-13B, per token', 'OPT-13B，每个 token') }}</text>
      <g v-for="(c, i) in [{ v: '2', w: L('key, value', '键、值') }, { v: '5,120', w: L('numbers', '维度') }, { v: '40', w: L('layers', '层') }, { v: '2 B', w: L('per number', '每个数') }]" :key="i">
        <rect :x="12 + i * 62" y="82" width="52" height="22" rx="2" class="cell" />
        <text :x="38 + i * 62" y="97" class="code c">{{ c.v }}</text>
        <text :x="38 + i * 62" y="118" class="tag c">{{ c.w }}</text>
        <text v-if="i < 3" :x="69 + i * 62" y="97" class="sub c">×</text>
      </g>
      <text x="262" y="97" class="sub ink">≈ 800 KB</text>
      <text x="12" y="142" class="sub">{{ L('2,048 tokens: about 1.6 GB for one request', '2048 个 token：一个请求约 1.6 GB') }}</text>
    </g>
    <g :class="part('gpu')">
      <text x="12" y="166" class="tag">{{ L('a 40 GB A100', '一块 40 GB 的 A100') }}</text>
      <rect x="12" :y="PY" width="218" height="24" rx="2" class="muted-fill" />
      <rect x="230" :y="PY" width="100" height="24" rx="2" class="p0" />
      <rect x="330" :y="PY" width="18" height="24" rx="2" class="cell" />
      <text x="121" :y="PY + 16" class="sub c ink">{{ L('weights, about 65%', '权重，约 65%') }}</text>
      <text x="280" :y="PY + 16" class="num c on-fill strong">{{ L('KV cache, ~30%', 'KV 缓存，约 30%') }}</text>
      <text x="12" y="224" class="sub">{{ L('about 12 GB: enough for about seven full-length requests', '约 12 GB：只够大约七个满长度的请求') }}</text>
      <text x="12" y="244" class="tag">{{ L('every wasted byte is a request left out of the batch', '浪费的每一点内存，都是被挡在批次之外的请求') }}</text>
    </g>

    <!-- contiguous reservations and their three wastes -->
    <g :class="part('contig')">
      <text x="12" y="150" class="tag">{{ L('each region is sized for the maximum possible length', '每段区域都按可能的最大长度预留') }}</text>
      <text x="12" y="166" class="tag">{{ L('GPU memory, one contiguous region per request', 'GPU 显存，每个请求一整段连续区域') }}</text>
      <rect x="12" :y="PY" width="48" height="24" class="p0" />
      <rect x="60" :y="PY" width="38" height="24" class="rsv" />
      <rect x="98" :y="PY" width="62" height="24" class="tail" />
      <rect x="160" :y="PY + 0.5" width="20" height="23" rx="1" class="gap" />
      <rect x="180" :y="PY" width="30" height="24" class="p1" />
      <rect x="210" :y="PY" width="30" height="24" class="rsv" />
      <rect x="240" :y="PY" width="80" height="24" class="tail" />
      <rect x="320" :y="PY + 0.5" width="28" height="23" rx="1" class="gap" />
      <text x="36" y="218" class="tag c">A</text>
      <text x="195" y="218" class="tag c">B</text>
      <g v-for="m in [{ x: 79, n: 1 }, { x: 129, n: 2 }, { x: 170, n: 3 }, { x: 225, n: 1 }, { x: 280, n: 2 }, { x: 334, n: 3 }]" :key="m.x">
        <circle :cx="m.x" :cy="PY + 12" r="6.5" class="mark" />
        <text :x="m.x" :y="PY + 15" class="num c on-fill strong">{{ m.n }}</text>
      </g>
    </g>
    <g :class="part('wastes')">
      <g v-for="(t, i) in [
        { c: 'rsv', w: L('reserved slots: will be used, but held idle meanwhile', '预留的槽位：终会用上，但现在闲置') },
        { c: 'tail', w: L('internal fragmentation: tokens never generated', '内部碎片：永远不会生成的 token') },
        { c: 'gap', w: L('external fragmentation: gaps between regions', '外部碎片：区域之间的空隙') },
      ]" :key="i">
        <circle cx="19" :cy="244 + i * 24" r="6.5" class="mark" />
        <text x="19" :y="247 + i * 24" class="num c on-fill strong">{{ i + 1 }}</text>
        <rect x="32" :y="238 + i * 24" width="20" height="12" :class="t.c" />
        <text x="60" :y="248 + i * 24" class="sub">{{ t.w }}</text>
      </g>
      <text x="12" y="326" class="sub ink">{{ L('in the paper’s reimplementations, only 20.4–38.2% held token state', '论文复现的系统里，只有 20.4%–38.2% 存着 token 状态') }}</text>
    </g>

    <!-- the worked example -->
    <g :class="part('steps')">
      <text x="12" y="262" class="tag hi">{{ L('physical block · slots filled', '物理块 · 已填槽位') }}</text>
      <g v-for="(h, i) in [L('logical 0', '逻辑块 0'), L('logical 1', '逻辑块 1'), L('logical 2', '逻辑块 2')]" :key="i">
        <text :x="146 + i * 76" y="262" class="tag c">{{ h }}</text>
      </g>
      <g v-for="(r, i) in STEPS" :key="i">
        <rect x="8" :y="268 + i * 22" width="344" height="20" rx="3" class="row" :class="{ here: i === hereRow }" />
        <text x="16" :y="282 + i * 22" class="sub">{{ r.n }}</text>
        <text v-for="(c, j) in r.c" :key="j" :x="146 + j * 76" :y="282 + i * 22" class="code c">{{ c }}</text>
      </g>
    </g>

    <!-- attention gathers from every block -->
    <g :class="part('attn')">
      <rect x="60" y="256" width="240" height="30" rx="5" class="box gate" />
      <text x="180" y="275" class="lbl c">{{ L('attention kernel', '注意力内核') }}</text>
      <path v-for="(p, i) in [1, 3, 7]" :key="i" :d="`M${PX(p) + 20},218 L${100 + i * 80},254`" class="call" marker-end="url(#pa-arrow)" />
      <text x="12" y="306" class="sub">{{ L('a software page-table walk: one lookup per block', '软件实现的页表遍历：每块查一次表') }}</text>
      <text x="12" y="324" class="sub">{{ L('20% to 26% slower than a contiguous kernel', '比连续的内核慢 20% 到 26%') }}</text>
    </g>

    <!-- where a token lives -->
    <g :class="part('split')">
      <rect :x="LX(2) + 0" :y="AY - 1.5" width="19" height="25" rx="2" class="ring" />
      <rect :x="PX(3) + 0.5" :y="PY + 1.5" width="10" height="21" rx="1.5" class="ring" />
      <text x="12" y="248" class="tag hi">{{ L('where is the 9th token, t = 8?', '第 9 个 token（t = 8）在哪里？') }}</text>
      <g v-for="(c, i) in [
        { v: '8 // 4 = 2', w: L('logical block, like the VPN', '逻辑块，相当于 VPN') },
        { v: '8 % 4 = 0', w: L('slot, like the page offset', '槽位，相当于页内偏移量') },
        { v: 'table[2] = 3', w: L('physical block', '物理块') },
      ]" :key="i">
        <text x="12" :y="270 + i * 20" class="code">{{ c.v }}</text>
        <text x="104" :y="270 + i * 20" class="sub">{{ c.w }}</text>
      </g>
      <text x="12" y="336" class="tag">{{ L('with a power-of-two block size: a shift and a mask', '块大小是 2 的幂时：一次移位和一次掩码') }}</text>
    </g>

    <!-- reference counts -->
    <g :class="part('refs')">
      <g v-for="p in [7, 1]" :key="p">
        <text :x="PX(p) + 20" y="227" class="tag hi c">{{ L(`refs ${refs(p)}`, `引用 ${refs(p)}`) }}</text>
      </g>
    </g>
    <g :class="part('sharenote')">
      <text x="12" y="256" class="sub">{{ L('both samples’ tables point at physical blocks 7 and 1', '两个样本的块表都指向物理块 7 和 1') }}</text>
      <text x="12" y="274" class="sub">{{ L('one copy of the prompt’s keys and values', '提示词的键和值只存一份') }}</text>
      <text x="12" y="292" class="sub">{{ L('a write into a shared block copies that block first', '要写共享块时，先复制这一块') }}</text>
    </g>

    <!-- prefix caching -->
    <g :class="part('cached')">
      <g v-for="p in CACHED" :key="p">
        <rect v-for="k in 4" :key="k" :x="PX(p) + 1 + (k - 1) * 10" :y="PY + 2" width="9" height="20" rx="1" class="p4 soft" />
      </g>
    </g>
    <g :class="part('hashes')">
      <text x="12" y="250" class="tag hi">{{ L('each full block is named by a hash', '每个满块由一个哈希值标识') }}</text>
      <rect x="12" y="258" width="130" height="20" rx="2" class="cell" />
      <text x="77" y="272" class="code c">hash(tokens)</text>
      <path d="M143,268 L164,268" class="call" marker-end="url(#pa-arrow)" />
      <rect x="166" y="258" width="182" height="20" rx="2" class="cell" />
      <text x="257" y="272" class="code c">hash(prev, tokens)</text>
      <text x="12" y="296" class="sub">{{ L('so one hash names a whole prefix', '于是一个哈希值就代表了一整段前缀') }}</text>
      <text x="12" y="322" class="tag hi">{{ L('cached, no users (purple): waiting in LRU order', '有缓存、暂无人用（紫色）：按 LRU 顺序等待') }}</text>
      <g v-for="(p, i) in CACHED" :key="p">
        <rect :x="12 + i * 34" y="330" width="26" height="18" rx="2" class="p4 soft" />
        <text :x="25 + i * 34" y="343" class="code c">{{ p }}</text>
        <path v-if="i === 0" d="M39,339 L45,339" class="call thin" marker-end="url(#pa-arrow)" />
      </g>
      <text x="92" y="343" class="sub">{{ L('evicted when memory is needed', '需要内存时才被逐出') }}</text>
    </g>

    <!-- preempted: swap or recompute -->
    <g :class="part('cpu')">
      <text x="348" :y="BY + 15" class="tag end">{{ L('newest', '最晚到') }}</text>
      <rect x="8" y="254" width="168" height="70" rx="6" class="box" />
      <text x="16" y="270" class="tag hi">{{ L('swapping: CPU memory', '换出：CPU 内存') }}</text>
      <g v-for="(p, i) in [2, 5, 6]" :key="p">
        <rect :x="18 + i * 50" y="278" width="44" height="18" rx="2" class="p1" />
        <text :x="40 + i * 50" y="291" class="num c on-fill strong">{{ L(`block ${p}`, `块 ${p}`) }}</text>
      </g>
      <text x="16" y="314" class="tag">{{ L('costly with small blocks', '块小时代价很高') }}</text>
      <path :d="`M${PX(2) + 20},214 L${PX(2) + 20},252`" class="danger" marker-end="url(#pa-arrow)" />
      <rect x="184" y="254" width="168" height="70" rx="6" class="box" />
      <text x="192" y="270" class="tag hi">{{ L('recomputation: discard', '重算：直接丢弃') }}</text>
      <text x="192" y="288" class="sub">{{ L('run the prompt and the', '之后把提示词和') }}</text>
      <text x="192" y="302" class="sub">{{ L('generated tokens again', '已生成的 token 再跑一遍') }}</text>
      <text x="12" y="342" class="sub">{{ L('all of a request’s blocks go together, or none do', '一个请求的块要么一起逐出，要么都不动') }}</text>
    </g>

    <!-- what the paper measured -->
    <g :class="part('results')">
      <text x="12" y="20" class="tag hi">{{ L('KV-cache memory holding token state', 'KV 缓存内存中存着 token 状态的比例') }}</text>
      <text x="12" y="42" class="sub">Orca</text>
      <rect x="86" y="30" width="262" height="18" rx="2" class="cell" />
      <rect x="86" y="30" :width="262 * 0.204" height="18" rx="2" class="p0" />
      <rect :x="86 + 262 * 0.204" y="30" :width="262 * 0.178" height="18" class="p0 soft" />
      <text :x="86 + 262 * 0.382 + 6" y="43" class="sub ink">20.4–38.2%</text>
      <text x="12" y="72" class="sub">vLLM</text>
      <rect x="86" y="60" :width="262 * 0.96" height="18" rx="2" class="p0" />
      <rect :x="86 + 262 * 0.96" y="60" :width="262 * 0.04" height="18" rx="2" class="tail" />
      <text x="348" y="94" class="tag end">{{ L('waste under 4%, by the vLLM blog post', '据 vLLM 博客，浪费不到 4%') }}</text>
      <text x="12" y="124" class="tag hi">{{ L('request rate on ShareGPT, at similar latency', 'ShareGPT 上的请求速率，延迟相近时') }}</text>
      <g v-for="(r, i) in RATES" :key="i">
        <text x="12" :y="150 + i * 24" class="sub">{{ r.t }}</text>
        <rect x="190" :y="140 + i * 24" width="110" height="14" rx="2" class="cell" />
        <rect :x="barX(r.a)" :y="140 + i * 24" :width="barX(r.b) - barX(r.a)" height="14" rx="2" class="p2" />
        <text x="348" :y="150 + i * 24" class="num end strong">{{ r.w }}</text>
      </g>
      <text x="12" y="226" class="sub">{{ L('Orca (Oracle) is told each request’s true length:', 'Orca (Oracle) 事先知道每个请求的真实长度：') }}</text>
      <text x="12" y="242" class="sub">{{ L('it isolates fragmentation and sharing, the fair comparison', '只剩碎片和共享的差距，这才是公平的比较') }}</text>
      <text x="12" y="266" class="sub">{{ L('headline: 2–4× the throughput, at the same latency', '头条结论：相同延迟下，吞吐量是 2 到 4 倍') }}</text>
      <text x="12" y="290" class="tag">{{ L('the attention kernel alone is 20% to 26% slower', '单看注意力内核，慢了 20% 到 26%') }}</text>
    </g>

    <!-- vAttention: the CPU's way -->
    <g :class="part('vrange')">
      <text x="40" y="14" class="tag">{{ L('vAttention: one contiguous virtual range per request', 'vAttention：每个请求一段连续的虚拟地址范围') }}</text>
      <text x="12" :y="AY + 16" class="lbl">A</text>
      <rect :x="LX(0)" :y="AY" width="244" height="22" rx="2" class="p0" />
    </g>
    <g :class="part('gmmu')">
      <rect :x="LX(0)" :y="AY + 26" width="244" height="20" rx="2" class="box gate" />
      <text :x="LX(0) + 122" :y="AY + 40" class="sub c ink">{{ L('the GPU’s own virtual memory', 'GPU 自身的虚拟内存') }}</text>
    </g>
    <g :class="part('vlinks')">
      <path v-for="(p, i) in [7, 1, 3]" :key="p" :d="`M${LX(0) + 40 + i * 82},${AY + 46} L${PX(p) + 20},${PY}`" class="link" />
    </g>
    <g :class="part('bendnotes')">
      <text x="12" y="248" class="tag hi">{{ L('block size', '块大小') }}</text>
      <text x="12" y="264" class="sub">{{ L('ShareGPT: 16 to 128 tokens worked best', 'ShareGPT：16 到 128 个 token 最好') }}</text>
      <text x="12" y="280" class="sub">{{ L('Alpaca’s shorter sequences: 16 and 32; the default is 16', 'Alpaca 序列较短：16 和 32；默认值 16') }}</text>
      <text x="12" y="306" class="tag hi">{{ L('translation in software', '软件里的地址转换') }}</text>
      <text x="12" y="322" class="sub">{{ L('every new kernel must be written for paged memory', '每个新内核都得专门为分页内存来写') }}</text>
      <text x="12" y="338" class="sub">{{ L('vAttention reports up to 1.23× the throughput', 'vAttention 报告的吞吐量最高多 1.23 倍') }}</text>
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
.num.on-fill,
.num.on-fill.strong {
  fill: #fff;
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
.cell.fresh {
  fill: var(--accent-soft);
  stroke: var(--accent);
  stroke-width: 1.6;
}
.slot {
  fill: var(--bg-sunk);
}
.faded {
  opacity: 0.3;
}
.soft {
  opacity: 0.45;
}
.ring {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
}
.outline.fresh-line {
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-dasharray: none;
}
.hatch-bg {
  fill: var(--bg-elev);
}
.hatch {
  stroke: var(--muted);
  stroke-width: 1.3;
}
.dotfill {
  fill: var(--muted);
}
.tail {
  fill: url(#pa-hatch);
}
.rsv {
  fill: url(#pa-dots);
}
.gap {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.mark {
  fill: var(--ink-2);
}
.row {
  fill: none;
  transition: fill 0.3s;
}
.row.here {
  fill: var(--accent-soft);
}
.thin {
  stroke-width: 1.1;
}
/* keeps a label readable where table links pass behind it */
.halo {
  paint-order: stroke;
  stroke: var(--bg-elev);
  stroke-width: 3px;
  stroke-linejoin: round;
}
.lit .cell {
  stroke: var(--accent);
  stroke-width: 1.6;
}
</style>
