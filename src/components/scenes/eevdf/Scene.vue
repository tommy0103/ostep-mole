<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'

/**
 * The running figure of the EEVDF article: three tasks (their weight and requested slice), the
 * virtual-time number line with V, lag and deadlines, the run queue as a red-black tree, a place
 * for sleepers, and the CPU. Positions are the article's snapshot (A 10, B 12, C 14 ms, equal
 * weights) except where a passage is about a different moment: a wakeup, a sleeper leaving.
 * Nothing moves on its own; the lab next to the text is the moving picture.
 */
const props = defineProps<DrawingProps>()

const SHOW: Record<string, string[]> = {
  overview: ['tasks', 'line', 'tree', 'cpu'],
  'two-questions': ['tasks', 'dials', 'cpu'],
  vruntime: ['tasks', 'line', 'V', 'ticks', 'cfs', 'tree', 'cpu'],
  lag: ['tasks', 'line', 'V', 'ticks', 'elig', 'lag', 'tree', 'cpu'],
  deadline: ['tasks', 'line', 'V', 'ticks', 'elig', 'lag', 'bars', 'pick', 'tree', 'cpu'],
  tree: ['tasks', 'line', 'V', 'elig', 'bars', 'tree', 'treeinfo', 'cpu'],
  wakeup: ['tasks', 'line', 'V', 'elig', 'bars', 'woke', 'cpu'],
  sleep: ['tasks', 'line', 'V', 'elig', 'tree', 'asleep', 'cpu'],
  delayed: ['tasks', 'line', 'V', 'elig', 'tree', 'catchup', 'cpu'],
  slice: ['tasks', 'dials', 'syscall', 'line', 'V', 'elig', 'bars', 'tree', 'cpu'],
  bends: ['tasks', 'line', 'V', 'elig', 'parity', 'tree', 'cpu', 'group', 'cpus'],
  lineage: ['tasks', 'line', 'V', 'elig', 'lag', 'bars', 'lineage', 'cpu'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 432)

/* the number line: virtual time 9 … 16 ms across the drawing */
const x = (v: number) => 24 + (v - 9) * 46
const ROW = [146, 176, 206]
const NAMES = ['A', 'B', 'C']
const FILL = ['p0', 'p1', 'p2']

interface Pos {
  v: number
  d: number
  /** a second, dashed deadline: the same task with another slice */
  alt?: number
  /** asleep: off the line (in the sleepers' box), or still on it, delayed */
  away?: boolean
  sleeping?: boolean
}
const SNAP: Pos[] = [
  { v: 10, d: 13 },
  { v: 12, d: 12.75 },
  { v: 14, d: 14.5 },
]
const POS = computed<{ V: number; t: Pos[]; run: number }>(() => {
  switch (props.state) {
    case 'wakeup':
      return { V: 12, run: 0, t: [{ v: 11.4, d: 14.4 }, { v: 12.6, d: 15.6 }, { v: 12, d: 12.5, alt: 15 }] }
    case 'sleep':
      return { V: 11, run: 0, t: [SNAP[0], SNAP[1], { ...SNAP[2], away: true }] }
    case 'delayed':
      return { V: 12, run: 1, t: [SNAP[0], SNAP[1], { ...SNAP[2], sleeping: true }] }
    case 'bends':
      return { V: 12, run: 0, t: SNAP }
    default:
      return { V: 12, run: 1, t: SNAP }
  }
})
const slices = computed(() =>
  props.state === 'wakeup' ? ['3 ms', '3 ms', L('0.5 or 3', '0.5 或 3')] : ['3 ms', '0.75 ms', '0.5 ms'],
)
const nice = computed(() => props.state === 'two-questions')
const lagText = (p: Pos, V: number) => {
  const l = Math.round((V - p.v) * 10) / 10
  return l > 0 ? `+${l}` : l < 0 ? `−${-l}` : '0'
}
const fmt = (n: number) => String(n)
</script>

<template>
  <svg class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('An EEVDF run queue on virtual time', '虚拟时间上的 EEVDF 运行队列')">
    <defs>
      <marker id="ev-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- the three tasks: what each one asks for -->
    <g :class="part('tasks')">
      <text x="8" y="56" class="sub">{{ nice ? 'nice' : L('weight', '权重') }}</text>
      <text v-if="!nice" x="8" y="74" class="sub">{{ L('slice', '时间片') }}</text>
      <g v-for="(n, i) in NAMES" :key="n">
        <rect :x="64 + i * 98" y="14" width="92" height="68" rx="6" class="box" />
        <circle :cx="110 + i * 98" cy="31" r="8" :class="FILL[i]" />
        <text :x="110 + i * 98" y="34.5" class="sub c on-fill">{{ n }}</text>
        <text :x="110 + i * 98" y="56" class="code c">{{ nice ? '0' : '1024' }}</text>
        <text v-if="!nice" :x="110 + i * 98" y="74" class="code c" :class="{ hot: i === 2 && (shown.has('syscall') || shown.has('woke')) }">{{ slices[i] }}</text>
      </g>
    </g>
    <g :class="part('dials')">
      <text v-if="nice" x="12" y="98" class="tag hi">{{ L('One dial, nice: share and latency move together', '只有一个旋钮 nice：份额和延迟一起动') }}</text>
      <text v-else x="12" y="98" class="tag hi">{{ L('weight: how much · slice: how soon', '权重管分多少 · 时间片管多快轮到') }}</text>
    </g>
    <g :class="part('syscall')">
      <path d="M306,91 L306,85" class="call" marker-end="url(#ev-arrow)" />
      <text x="348" y="101" class="code end">sched_setattr()</text>
    </g>

    <!-- the number line -->
    <g :class="part('line')">
      <text x="12" y="116" class="tag">{{ L('virtual time', '虚拟时间') }}</text>
      <line x1="20" y1="228" x2="350" y2="228" class="axis" />
      <g :class="part('ticks')">
        <template v-for="v in 7" :key="v">
          <line :x1="x(v + 9)" y1="225" :x2="x(v + 9)" y2="231" class="axis" />
          <text :x="x(v + 9)" y="243" class="sub c">{{ v + 9 }}</text>
        </template>
      </g>
    </g>

    <!-- eligible: at or left of V -->
    <g :class="part('elig')">
      <rect x="20" y="124" :width="x(POS.V) - 20" height="98" class="elig" />
      <text x="26" y="134" class="tag">{{ L('eligible', '合格') }}</text>
    </g>
    <g :class="part('V')">
      <line :x1="x(POS.V)" y1="120" :x2="x(POS.V)" y2="232" class="vline" />
      <text :x="x(POS.V) + 5" y="122" class="lbl">V</text>
    </g>
    <!-- delayed dequeue: V walks up to the sleeper -->
    <g :class="part('catchup')">
      <path :d="`M${x(12) + 18},${ROW[2] - 14} L${x(14) - 10},${ROW[2] - 14}`" class="call" marker-end="url(#ev-arrow)" />
      <text :x="x(13)" :y="ROW[2] - 19" class="tag c">{{ L('V moves on', 'V 向前走') }}</text>
      <text :x="x(14) + 12" :y="ROW[2] + 3.5" class="tag">{{ L('asleep, still queued', '睡着，仍在队列') }}</text>
    </g>

    <!-- each task on the line: its v, its lag to V, its deadline -->
    <template v-for="(p, i) in POS.t" :key="NAMES[i]">
      <g v-if="shown.has('line')" class="task" :class="{ away: p.away }">
        <g :class="part('bars')">
          <rect :x="x(p.v)" :y="ROW[i] - 3" :width="x(p.d) - x(p.v)" height="6" rx="2" :class="FILL[i]" opacity="0.45" />
          <line :x1="x(p.d)" :y1="ROW[i] - 7" :x2="x(p.d)" :y2="ROW[i] + 7" class="dl" />
          <text v-if="!shown.has('woke')" :x="x(p.d) + 5" :y="ROW[i] + 3.5" class="tag">d {{ fmt(p.d) }}</text>
          <g v-if="p.alt" :class="part('woke')">
            <rect :x="x(p.d)" :y="ROW[i] - 3" :width="x(p.alt) - x(p.d)" height="6" rx="2" class="alt" />
            <line :x1="x(p.alt)" :y1="ROW[i] - 7" :x2="x(p.alt)" :y2="ROW[i] + 7" class="dl" />
            <text :x="x(p.d)" :y="ROW[i] + 17" class="tag c">0.5</text>
            <text :x="x(p.alt)" :y="ROW[i] + 17" class="tag c">3 ms</text>
          </g>
        </g>
        <g :class="part('lag')">
          <path :d="`M${x(p.v)},${ROW[i] - 10} L${x(POS.V)},${ROW[i] - 10}`" class="bracket" />
          <text
            :x="Math.abs(p.v - POS.V) < 0.1 ? x(POS.V) + 5 : (x(p.v) + x(POS.V)) / 2"
            :y="ROW[i] - 14"
            class="tag hi"
            :class="{ c: Math.abs(p.v - POS.V) >= 0.1 }"
          >{{ lagText(p, POS.V) }}</text>
        </g>
        <circle :cx="x(p.v)" :cy="ROW[i]" r="7" :class="[FILL[i], { hollow: p.sleeping }]" />
        <text :x="x(p.v)" :y="ROW[i] + 3.2" class="sub c" :class="p.sleeping ? 'ink' : 'on-fill'">{{ NAMES[i] }}</text>
        <circle v-if="shown.has('pick') && i === 1" :cx="x(p.v)" :cy="ROW[i]" r="10.5" class="ring" />
        <circle v-if="shown.has('woke') && i === 2" :cx="x(p.v)" :cy="ROW[i]" r="10.5" class="ring" />
      </g>
    </template>
    <g :class="part('cfs')">
      <text :x="x(10) + 13" :y="ROW[0] + 3.5" class="tag">{{ L('← CFS: smallest v', '← CFS：v 最小') }}</text>
    </g>
    <g :class="part('woke')">
      <text :x="x(12) - 13" :y="ROW[2] + 3.5" class="tag end">{{ L('woke', '刚醒') }}</text>
      <text :x="x(11.4) - 13" :y="ROW[0] + 3.5" class="tag end">{{ L('running', '在运行') }}</text>
    </g>
    <g :class="part('parity')">
      <path :d="`M${x(10) + 10},${ROW[0] - 12} L${x(12) - 3},${ROW[0] - 12}`" class="call" marker-end="url(#ev-arrow)" />
      <text :x="x(12) + 8" :y="ROW[0] - 8" class="tag">{{ L('runs to V or slice end', '跑到 V 或时间片用完') }}</text>
    </g>

    <!-- the run queue: a red-black tree ordered by deadline -->
    <g :class="part('tree')">
      <text x="14" y="264" class="tag">{{ shown.has('treeinfo') ? L('run queue: red-black tree by deadline', '运行队列：按截止期排序的红黑树') : L('run queue', '运行队列') }}</text>
      <path d="M100,298 L60,312" class="link solid" />
      <path d="M132,298 L172,312" class="link solid task" :class="{ away: POS.t[2].away }" />
      <g v-for="n in [{ i: 0, x: 77, y: 268, mv: 10 }, { i: 1, x: 14, y: 312, mv: 12 }, { i: 2, x: 133, y: 312, mv: 14 }]" :key="n.i">
        <g :class="{ away: POS.t[n.i].away }" class="task">
          <rect :x="n.x" :y="n.y" width="78" height="30" rx="5" class="box" :class="{ sleeper: POS.t[n.i].sleeping }" />
          <circle :cx="n.x + 13" :cy="n.y + 15" r="6" :class="FILL[n.i]" />
          <text :x="n.x + 13" :y="n.y + 18" class="tiny c on-fill">{{ NAMES[n.i] }}</text>
          <template v-if="shown.has('treeinfo')">
            <text :x="n.x + 24" :y="n.y + 13" class="code sm">d {{ fmt(POS.t[n.i].d) }}</text>
            <text :x="n.x + 24" :y="n.y + 25" class="tiny">min v {{ n.mv }}</text>
          </template>
          <text v-else-if="POS.t[n.i].sleeping" :x="n.x + 24" :y="n.y + 18.5" class="tiny">{{ L('asleep', '睡着') }}</text>
        </g>
      </g>
      <g :class="part('treeinfo')">
        <path d="M53,342 L53,360" class="call" marker-end="url(#ev-arrow)" />
        <text x="60" y="355" class="tag hi">{{ L('leftmost, eligible: run it', '最左且合格：就是它') }}</text>
      </g>
    </g>

    <!-- sleepers off the queue -->
    <g :class="part('asleep')">
      <rect x="232" y="254" width="118" height="90" rx="8" class="outline" />
      <text x="240" y="268" class="tag">{{ L('asleep, off the queue', '睡着，不在队列里') }}</text>
      <circle :cx="x(14)" :cy="ROW[2]" r="7" class="ghost" />
      <path :d="`M${x(14) + 6},${ROW[2] + 6} C${x(14) + 30},236 300,232 300,252`" class="link" marker-end="url(#ev-arrow)" />
      <circle cx="252" cy="290" r="7" class="p2" />
      <text x="252" y="293.2" class="sub c on-fill">C</text>
      <text x="266" y="294" class="code">lag −2</text>
      <text x="240" y="315" class="tag">{{ L('back at', '回来时放在') }}</text>
      <text x="240" y="332" class="code">V − lag / w</text>
    </g>

    <!-- a cgroup: one entity outside, a queue inside -->
    <g :class="part('group')">
      <rect x="232" y="254" width="118" height="90" rx="8" class="box" />
      <text x="291" y="272" class="lbl c">cgroup</text>
      <text x="291" y="287" class="tag c">{{ L('one entity, one weight', '一个实体，一个权重') }}</text>
      <rect x="244" y="296" width="94" height="38" rx="5" class="outline" />
      <text x="291" y="310" class="tiny c">{{ L('its own queue', '自己的队列') }}</text>
      <circle cx="270" cy="323" r="4.5" class="p3" />
      <circle cx="291" cy="323" r="4.5" class="p3" />
      <circle cx="312" cy="323" r="4.5" class="p3" />
    </g>

    <!-- the CPU, and in the last passages a second one -->
    <g :class="part('cpu')">
      <rect x="12" y="362" width="190" height="60" rx="6" class="box floor" />
      <text x="26" y="396" class="lbl">{{ shown.has('cpus') ? 'CPU 0' : 'CPU' }}</text>
      <text x="196" y="396" class="tag end">{{ L('running', '正在运行') }}</text>
      <circle cx="110" cy="392" r="12" :class="FILL[POS.run]" />
      <text x="110" y="396" class="lbl c on-fill">{{ NAMES[POS.run] }}</text>
    </g>
    <g :class="part('cpus')">
      <path d="M206,404 L232,404" class="link solid" marker-start="url(#ev-arrow)" marker-end="url(#ev-arrow)" />
      <rect x="236" y="362" width="114" height="60" rx="6" class="box floor" />
      <text x="293" y="384" class="lbl c">CPU 1</text>
      <text x="293" y="400" class="tag c">{{ L('own run queue', '自己的运行队列') }}</text>
      <text x="293" y="414" class="tag c">{{ L('← load balancer', '← 负载均衡器') }}</text>

    </g>

    <!-- the lineage -->
    <g :class="part('lineage')">
      <text x="14" y="270" class="tag">1 · {{ L('Lottery: shares by chance', '彩票：按概率分份额') }}</text>
      <text x="14" y="290" class="tag">2 · {{ L('Stride: a pass value per task', '步长：每个任务一个 pass 值') }}</text>
      <text x="14" y="310" class="tag">3 · {{ L('CFS: pass becomes vruntime, in a tree', 'CFS：pass 改叫 vruntime，放进树里') }}</text>
      <text x="14" y="330" class="tag hi">4 · {{ L('EEVDF: + V and lag, + a deadline', 'EEVDF：加上 V 与滞后量，再加截止期') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.axis {
  stroke: var(--rule-strong);
  stroke-width: 1.2;
}
.elig {
  fill: var(--bg-sunk);
}
.vline {
  stroke: var(--ink-2);
  stroke-width: 1.4;
  stroke-dasharray: 4 3;
}
.bracket {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
  stroke-dasharray: 2 2;
}
.dl {
  stroke: var(--ink-2);
  stroke-width: 1.4;
}
.alt {
  fill: none;
  stroke: var(--p2);
  stroke-width: 1.2;
  stroke-dasharray: 3 2;
}
.ring {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
}
.hollow {
  fill: var(--bg-elev);
  stroke: var(--p2);
  stroke-width: 1.6;
  stroke-dasharray: 3 2;
}
.ink {
  fill: var(--ink);
}
.task {
  transition: opacity 0.35s ease;
}
.task.away {
  opacity: 0;
}
.ghost {
  fill: none;
  stroke: var(--p2);
  stroke-width: 1.2;
  stroke-dasharray: 2 2;
}
.sleeper {
  stroke-dasharray: 4 3;
}
text.on-fill {
  fill: #fff;
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.code.sm {
  font-size: 9.5px;
}
.code.hot {
  fill: var(--accent-ink);
  font-weight: 600;
}
.lit .elig {
  fill: var(--accent-soft);
}
@media (prefers-reduced-motion: reduce) {
  .task {
    transition: none;
  }
}
</style>
