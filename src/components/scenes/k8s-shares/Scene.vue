<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import ThrottleDemo from './ThrottleDemo.vue'

/**
 * The running figure of the Kubernetes CPU article: a container's YAML at the top, the two paths its
 * numbers take (request → shares → cpu.weight, limit → cpu.max), the cgroup tree they land in, the
 * node's CPUs drawing slices from pod A's quota pool, and one 100 ms period on a timeline. Ten CPUs
 * are drawn whatever the node has; the tag under them says how many the passage is about.
 */
const props = defineProps<DrawingProps>()

const SHOW: Record<string, string[]> = {
  overview: ['yaml', 'reqpath', 'limpath', 'tree', 'system', 'pods', 'weights', 'pool', 'cores', 'timeline'],
  tickets: ['pods', 'split'],
  weights: ['yaml', 'reqpath', 'tree', 'system', 'pods', 'split', 'weights'],
  formula: ['yaml', 'reqpath', 'tree', 'system', 'pods', 'weights', 'formula'],
  hierarchy: ['tree', 'system', 'pods', 'weights', 'cores', 'entities'],
  quota: ['yaml', 'limpath', 'tree', 'system', 'pods', 'weights', 'pool', 'slices', 'cores'],
  throttle: ['pool', 'cores', 'timeline', 'request'],
  dashboard: ['timeline', 'request', 'strip'],
  bug: ['pool', 'cores', 'crumbs'],
  threads: ['pool', 'cores', 'timeline'],
  runtimes: ['pool', 'cores', 'timeline'],
  fixes: ['yaml', 'reqpath', 'limpath', 'tree', 'system', 'pods', 'weights', 'pool', 'cores', 'strip'],
  assign: ['yaml', 'reqpath', 'tree', 'system', 'pods', 'weights', 'sched'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 460)
const st = computed(() => props.state)

// the timeline: 0..110 ms of wall-clock time
const T = (ms: number) => 60 + ms * 2.582
/** when the period's 200 ms budget runs out: ten threads in the worked example, 64 or 2 in the Go passages */
const burnEnd = computed(() => (st.value === 'threads' ? 3.1 : st.value === 'runtimes' ? 100 : 20))
const budgetPath = computed(() => {
  const e = burnEnd.value
  const y = (left: number) => 382 - (left / 200) * 20
  // the worked example's burst comes once a second: after the refill only the small request runs
  if (e === 20) return `M${T(0)},${y(200)} L${T(20)},${y(0)} L${T(100)},${y(0)} L${T(100)},${y(200)} L${T(103)},${y(197)} L${T(110)},${y(197)}`
  const after = Math.min(110, 100 + e)
  const leftAfter = Math.max(0, 200 - (200 / e) * (after - 100))
  return `M${T(0)},${y(200)} L${T(e)},${y(0)} L${T(100)},${y(0)} L${T(100)},${y(200)} L${T(after)},${y(leftAfter)}` + (after < 110 ? ` L${T(110)},${y(0)}` : '')
})

const CORES = Array.from({ length: 10 }, (_, i) => ({ i, x: 8 + i * 34.67 }))
/** which CPUs are running one of pod A's threads */
const running = (i: number) => {
  if (st.value === 'runtimes' || st.value === 'fixes') return i < 2
  if (st.value === 'threads' || st.value === 'quota' || st.value === 'overview') return true
  return false
}
// per-CPU scheduling entities of the two pods (where each has runnable tasks)
const HAS_A = [0, 1, 2, 3, 6, 8]
const HAS_B = [1, 4, 5, 7, 8, 9]

/** share of the parent's CPU for pod A when both pods are busy */
const shareA = computed(() => (shown.value.has('weights') ? 59 / 159 : 1 / 4))
const poolLeft = computed(() => ({ throttle: 0, threads: 0 })[st.value] ?? 1)
</script>

<template>
  <ThrottleDemo v-if="demo && state === 'throttle'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A container’s CPU request and limit, from YAML to the kernel', '容器的 CPU request 与 limit：从 YAML 到内核')">
    <defs>
      <marker id="ks-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <pattern id="ks-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" class="hatch-bg" />
        <line x1="0" y1="0" x2="0" y2="5" class="hatch-line" />
      </pattern>
    </defs>

    <!-- the container's two numbers -->
    <g :class="part('yaml')">
      <rect x="8" y="10" width="128" height="60" rx="5" class="code-card" />
      <text x="16" y="25" class="code" :class="{ hot: state === 'assign' }">requests: 500m</text>
      <text x="72" y="43" class="sub c">{{ L('pod A’s container', 'pod A 的容器') }}</text>
      <text x="16" y="61" class="code" :class="{ struck: state === 'fixes' }">limits: 2</text>
    </g>

    <!-- request → shares → weight -->
    <g :class="part('reqpath')">
      <path d="M138,21 L158,21" class="call" marker-end="url(#ks-arrow)" />
      <rect x="160" y="12" width="76" height="18" rx="3" class="box" />
      <text x="198" y="25" class="code c">512 shares</text>
      <path d="M236,21 L250,21" class="call" marker-end="url(#ks-arrow)" />
      <rect x="252" y="12" width="100" height="18" rx="3" class="box" />
      <text x="302" y="25" class="code c">{{ shown.has('formula') ? L('weight 20 → 59', '权重 20 → 59') : 'cpu.weight 59' }}</text>
      <text x="198" y="41" class="tag c">kubelet</text>
      <text x="302" y="41" class="tag c">{{ shown.has('formula') ? L('runtime: line → curve', '运行时：直线 → 曲线') : L('OCI runtime', 'OCI 运行时') }}</text>
    </g>

    <!-- limit → quota per period -->
    <g :class="part('limpath')">
      <path d="M138,57 L158,57" class="call" marker-end="url(#ks-arrow)" />
      <rect x="160" y="48" width="192" height="18" rx="3" class="box" :class="{ off: state === 'fixes' }" />
      <text x="256" y="61" class="code c">cpu.max 200000 100000</text>
      <text x="256" y="78" class="tag c" :class="{ hi: state === 'fixes' }">
        {{ state === 'fixes' ? L('or no limit at all', '或者干脆不设 limit') : L('kubelet: 200 ms per 100 ms period', 'kubelet：每 100 ms 周期 200 ms') }}
      </text>
    </g>

    <!-- the cgroup tree -->
    <g :class="part('tree')">
      <path d="M180,110 L90,128 M180,110 L275,128" class="link" />
      <rect x="125" y="88" width="110" height="22" rx="5" class="box strong" />
      <text x="180" y="103" class="lbl c">{{ L('root cgroup', '根 cgroup') }}</text>
      <rect x="30" y="128" width="120" height="30" rx="5" class="box" />
      <text x="90" y="141" class="lbl c">kubepods</text>
      <text x="90" y="153" class="sub c">{{ L('parent of all pods', '所有 pod 的父组') }}</text>
      <path d="M70,158 L55,170 M110,158 L157,170" class="link" />
    </g>
    <g :class="part('system')">
      <rect x="200" y="128" width="150" height="30" rx="5" class="box" />
      <text x="275" y="141" class="lbl c">{{ L('system services', '系统服务') }}</text>
      <text x="275" y="153" class="sub c">{{ L('default weight 100', '默认权重 100') }}</text>
    </g>
    <g :class="part('pods')">
      <rect x="8" y="170" width="94" height="44" rx="5" class="box" />
      <rect x="8" y="170" width="5" height="44" rx="2" class="p0" />
      <text x="57" y="184" class="lbl c">pod A</text>
      <rect x="110" y="170" width="94" height="44" rx="5" class="box" />
      <rect x="110" y="170" width="5" height="44" rx="2" class="p1" />
      <text x="159" y="184" class="lbl c">pod B</text>
      <template v-if="shown.has('weights')">
        <text x="57" y="197" class="sub c">{{ L('request 500m', 'request 500m') }}</text>
        <text x="57" y="209" class="sub c strong-sub">{{ shown.has('formula') ? L('old 20 · new 59', '旧 20 · 新 59') : L('weight 59', '权重 59') }}</text>
        <text x="159" y="197" class="sub c">{{ L('request 1 CPU', 'request 1 CPU') }}</text>
        <text x="159" y="209" class="sub c strong-sub">{{ shown.has('formula') ? L('old 39 · new 100', '旧 39 · 新 100') : L('weight 100', '权重 100') }}</text>
      </template>
      <template v-else>
        <text x="57" y="203" class="sub c strong-sub">{{ L('100 tickets', '100 张彩票') }}</text>
        <text x="159" y="203" class="sub c strong-sub">{{ L('300 tickets', '300 张彩票') }}</text>
      </template>
    </g>

    <!-- how the pods' parent splits its CPU -->
    <g :class="part('split')">
      <text x="214" y="172" class="tag">{{ shown.has('weights') ? L('both busy: 59 : 100', '都忙时：59 : 100') : L('both busy: 1 : 3', '都忙时：1 : 3') }}</text>
      <rect x="214" y="177" :width="138 * shareA" height="12" class="p0 grow" />
      <rect :x="214 + 138 * shareA" y="177" :width="138 * (1 - shareA)" height="12" class="p1 grow" />
      <text x="214" y="204" class="tag">{{ L('B has nothing to run:', 'B 无事可做时：') }}</text>
      <rect x="214" y="208" width="138" height="12" class="p0" />
      <text x="283" y="217.5" class="tiny c on-fill">{{ L('A may use all of it', 'A 可以全用') }}</text>
    </g>

    <!-- the old line against the curve, for a pod that requests a whole CPU -->
    <g :class="part('formula')">
      <text x="214" y="170" class="tag">{{ L('1 CPU, old line: 39', '1 CPU，旧直线：39') }}</text>
      <rect x="214" y="173" :width="1.38 * 39" height="7" class="p1" />
      <text x="214" y="191" class="tag">{{ L('1 CPU, new curve: 100', '1 CPU，新曲线：100') }}</text>
      <rect x="214" y="194" width="138" height="7" class="p1" />
      <text x="214" y="212" class="tag">{{ L('system services: 100', '系统服务：100') }}</text>
      <rect x="214" y="215" width="138" height="7" class="muted-fill" />
    </g>

    <!-- the scheduler reads requests to place pods -->
    <g :class="part('sched')">
      <rect x="214" y="168" width="138" height="46" rx="5" class="box gate" />
      <text x="283" y="183" class="lbl c">kube-scheduler</text>
      <text x="283" y="197" class="sub c">{{ L('fits pods by request', '按 request 放置 pod') }}</text>
      <text x="283" y="209" class="sub c">{{ L('ticket and reservation', '既是彩票，也是预订') }}</text>
    </g>

    <!-- pod A's quota pool -->
    <g :class="part('pool')">
      <path v-if="shown.has('pods')" d="M57,214 L57,224" class="link" />
      <rect x="8" y="224" width="344" height="20" rx="4" class="box" />
      <rect x="9" y="225" :width="342 * poolLeft" height="18" rx="3" class="pool-fill grow" />
      <text x="14" y="238" class="sub pool-text">
        {{
          state === 'throttle'
            ? L('pod A’s pool: empty at t = 20 ms', 'pod A 的配额池：t = 20 ms 时已空')
            : state === 'threads'
              ? L('pod A’s pool: 200 ms gone in ~3 ms', 'pod A 的配额池：约 3 ms 就花光 200 ms')
              : state === 'runtimes'
                ? L('pod A’s pool: 200 ms lasts the whole period', 'pod A 的配额池：200 ms 刚好用满整个周期')
                : state === 'bug'
                  ? L('quota pool (global, refilled every period)', '配额池（全局，每个周期补满）')
                  : state === 'fixes'
                    ? L('or bank unused quota: cpu.max.burst', '或者存下没用完的配额：cpu.max.burst')
                    : L('pod A’s quota pool: 200 ms per 100 ms', 'pod A 的配额池：每 100 ms 200 ms')
        }}
      </text>
    </g>
    <g :class="part('slices')">
      <path v-for="c in CORES" :key="'s' + c.i" :d="`M${c.x + 15.5},245 L${c.x + 15.5},256`" class="call thin" marker-end="url(#ks-arrow)" />
    </g>

    <!-- the node's CPUs -->
    <g :class="part('cores')">
      <g v-for="c in CORES" :key="c.i">
        <rect :x="c.x" y="258" width="31" height="58" rx="4" class="box" :class="{ mine: state === 'fixes' && c.i >= 8 }" />
        <text :x="c.x + 15.5" y="269" class="tiny c">CPU {{ c.i }}</text>
        <!-- one of pod A's threads running here -->
        <g v-if="running(c.i)">
          <rect :x="c.x + 5" y="276" width="21" height="34" rx="3" class="p0" />
          <text v-if="state === 'quota'" :x="c.x + 15.5" y="296" class="tiny c on-fill">5 ms</text>
        </g>
        <!-- throttled: the group is off this CPU's run queue -->
        <rect v-if="state === 'throttle'" :x="c.x + 5" y="276" width="21" height="34" rx="3" fill="url(#ks-hatch)" class="hatched" />
        <!-- each pod's per-CPU scheduling entity -->
        <g :class="part('entities')">
          <g v-if="HAS_A.includes(c.i)">
            <rect :x="c.x + 5" y="276" width="21" height="14" rx="2" class="p0" />
            <text :x="c.x + 15.5" y="286" class="tiny c on-fill">A</text>
          </g>
          <g v-if="HAS_B.includes(c.i)">
            <rect :x="c.x + 5" y="294" width="21" height="14" rx="2" class="p1" />
            <text :x="c.x + 15.5" y="304" class="tiny c on-fill">B</text>
          </g>
        </g>
        <!-- the 1 ms each idle CPU kept, expiring at the period boundary -->
        <g :class="part('crumbs')">
          <path :d="`M${c.x + 15.5},257 L${c.x + 15.5},246`" class="link solid" marker-end="url(#ks-arrow)" />
          <rect :x="c.x + 3" y="294" width="25" height="15" rx="2" class="crumb" />
          <text :x="c.x + 15.5" y="305" class="tiny c">1 ms</text>
        </g>
      </g>
      <text x="8" y="328" class="tag" :class="{ hi: state === 'fixes' || state === 'runtimes' || state === 'threads' }">
        {{
          state === 'hierarchy'
            ? L('each pod: one entity on each CPU where it has tasks', '每个 pod 在它有任务的每个 CPU 上各有一个实体')
            : state === 'quota'
              ? L('each CPU running pod A draws 5 ms slices', '运行 pod A 的 CPU 每次领取 5 ms 的片')
              : state === 'throttle'
                ? L('throttled: pod A is off every run queue', '限流：pod A 被移出所有运行队列')
                : state === 'bug'
                  ? L('slices go back; the 1 ms left expires: up to 87 ms on 88 CPUs', '片还回池里，留下的 1 ms 会过期：88 核最多 87 ms')
                  : state === 'threads'
                    ? L('GOMAXPROCS = 64: 10 of 64 CPUs drawn', 'GOMAXPROCS = 64：64 个 CPU 画了 10 个')
                    : state === 'runtimes'
                      ? L('GOMAXPROCS = 2, from the limit (Go 1.25)', 'GOMAXPROCS = 2，取自 limit（Go 1.25）')
                      : state === 'fixes'
                        ? L('threads to match the budget, or whole cores', '让线程数匹配预算，或独占整核')
                        : L('10 of the node’s CPUs', '节点上的 10 个 CPU')
        }}
      </text>
    </g>

    <!-- one 100 ms period -->
    <g :class="part('timeline')">
      <text x="8" y="351" class="tag">{{ L('pod A', 'pod A') }}</text>
      <rect :x="T(0)" y="340" :width="T(burnEnd) - T(0)" height="16" class="p0" />
      <text v-if="burnEnd >= 20" :x="(T(0) + T(burnEnd)) / 2" y="351.5" class="tiny c on-fill">
        {{ state === 'runtimes' ? L('2 threads, all period', '2 个线程，跑满整个周期') : L('10 threads', '10 个线程') }}
      </text>
      <template v-if="burnEnd < 100">
        <rect :x="T(burnEnd)" y="340" :width="T(100) - T(burnEnd)" height="16" fill="url(#ks-hatch)" class="hatched" />
        <text :x="(T(burnEnd) + T(100)) / 2" y="351.5" class="tiny c ink">
          {{ state === 'threads' ? L('64 threads ran ~3 ms; throttled', '64 个线程跑了约 3 ms；限流') : L('throttled: nothing runs', '限流：什么都不运行') }}
        </text>
        <rect v-if="burnEnd < 20" :x="T(100)" y="340" :width="Math.min(T(110), T(100 + burnEnd)) - T(100)" height="16" class="p0" />
        <rect v-if="burnEnd < 20 && 100 + burnEnd < 110" :x="T(100 + burnEnd)" y="340" :width="T(110) - T(100 + burnEnd)" height="16" fill="url(#ks-hatch)" class="hatched" />
      </template>
      <rect v-else :x="T(100)" y="340" :width="T(110) - T(100)" height="16" class="p0" />

      <text x="8" y="376" class="tag">{{ L('budget', '预算') }}</text>
      <path :d="budgetPath" class="budget" />

      <path :d="`M${T(100)},336 L${T(100)},410`" class="link" />
      <line :x1="T(0)" y1="410" :x2="T(110)" y2="410" class="axis" />
      <text :x="T(0)" y="421" class="tiny c">0</text>
      <text v-if="burnEnd === 20" :x="T(20)" y="421" class="tiny c">20</text>
      <text :x="T(100)" y="421" class="tiny c">100 ms</text>
    </g>

    <!-- a small request caught by the stall -->
    <g :class="part('request')">
      <text x="8" y="402" class="tag">{{ L('request', '请求') }}</text>
      <circle :cx="T(21)" cy="398" r="3" class="req" />
      <path :d="`M${T(21) + 4},398 L${T(100)},398`" class="link" />
      <rect :x="T(100)" y="393" :width="T(103) - T(100)" height="10" class="req" />
      <text :x="(T(21) + T(100)) / 2" y="393" class="tiny c">{{ L('arrives at 21 ms, done at 103 ms', '21 ms 到达，103 ms 完成') }}</text>
    </g>

    <!-- a second of periods, as a dashboard sees it -->
    <g :class="part('strip')">
      <text x="8" y="447" class="tag">1 s</text>
      <rect v-for="k in 10" :key="k" :x="T(0) + (k - 1) * 14" y="436" width="12" height="14" rx="2" :class="k === 1 ? 'hatched' : 'p0 soft'" :fill="k === 1 ? 'url(#ks-hatch)' : undefined" />
      <text x="206" y="441" class="tag hi">{{ state === 'fixes' ? L('alert on this ratio', '按这个比例告警') : L('throttled in 1 of 10 periods', '10 个周期里限流 1 个') }}</text>
      <text x="206" y="454" class="tag">{{ L('average use: 20% of the limit', '平均只用了 limit 的 20%') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.code-card {
  fill: var(--code-bg);
  stroke: var(--rule-strong);
}
.code.hot {
  fill: var(--accent-ink);
  font-weight: 600;
}
.code.struck {
  text-decoration: line-through;
  fill: var(--muted);
}
.box.off {
  stroke-dasharray: 3 3;
}
.box.mine {
  stroke: var(--ok);
  stroke-width: 2;
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.tiny.on-fill {
  fill: #fff;
}
.tiny.ink {
  fill: var(--ink-2);
  font-weight: 600;
}
.strong-sub {
  fill: var(--ink-2);
  font-weight: 600;
}
.call.thin {
  stroke-width: 1;
}
.pool-fill {
  fill: var(--p0);
  opacity: 0.25;
}
.pool-text {
  fill: var(--ink-2);
}
.grow {
  transition:
    width 0.5s ease,
    x 0.5s ease;
}
.hatch-bg {
  fill: var(--bg-sunk);
}
.hatch-line {
  stroke: var(--p3);
  stroke-width: 1.4;
  opacity: 0.55;
}
.hatched {
  stroke: var(--p3);
  stroke-width: 0.8;
}
.crumb {
  fill: var(--bg-elev);
  stroke: var(--warn);
  stroke-width: 1.4;
}
.budget {
  fill: none;
  stroke: var(--p0);
  stroke-width: 1.6;
}
.axis {
  stroke: var(--rule-strong);
}
.req {
  fill: var(--accent);
}
.soft {
  opacity: 0.35;
}
.lit .p0,
.lit .p1 {
  stroke: var(--accent);
  stroke-width: 1.5;
}
@media (prefers-reduced-motion: reduce) {
  .grow {
    transition: none;
  }
}
</style>
