<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * The article's worked example in six steps: a 2-CPU limit (200 ms per 100 ms period), ten threads
 * burst at t = 0 and empty the pool by t = 20 ms, the group is throttled, a 3 ms request arriving
 * at t = 21 ms waits for the refill at t = 100 ms and finishes at t = 103 ms.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)
/** wall-clock time at each step, in ms */
const NOW = [0, 10, 20, 21, 100, 103]
const now = computed(() => NOW[Math.min(s.value, NOW.length - 1)])
const T = (ms: number) => 60 + ms * 2.582
const CORES = Array.from({ length: 10 }, (_, i) => 8 + i * 34.67)

/** budget left at time t (ms of CPU time) */
const left = (t: number) => (t < 20 ? 200 - 10 * t : t < 100 ? 0 : 200 - (t - 100))
const poolFrac = computed(() => left(now.value) / 200)
const throttled = computed(() => now.value >= 20 && now.value < 100)
const budgetY = (b: number) => 192 - (b / 200) * 22
const budgetPath = computed(() => {
  const n = now.value
  const pts: [number, number][] = [[0, 200]]
  pts.push([Math.min(n, 20), left(Math.min(n, 20))])
  if (n > 20) pts.push([Math.min(n, 100), 0])
  if (n >= 100) pts.push([100, 200], [n, left(n)])
  return 'M' + pts.map(([t, b]) => `${T(t)},${budgetY(b)}`).join(' L')
})
const poolText = computed(
  () =>
    [
      L('pool refilled: 200 ms of CPU time', '配额池补满：200 ms CPU 时间'),
      L('t = 10 ms: 100 ms left', 't = 10 ms：还剩 100 ms'),
      L('t = 20 ms: empty', 't = 20 ms：空了'),
      L('empty until the period ends', '空着，直到周期结束'),
      L('t = 100 ms: refilled', 't = 100 ms：补满'),
      L('refilled', '已补满'),
    ][s.value],
)
</script>

<template>
  <svg class="scene-drawing demo" viewBox="0 0 360 300" role="img" :aria-label="L('One period of a 2-CPU limit, step by step', '2 CPU limit 的一个周期，分步演示')">
    <defs>
      <pattern id="kt-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" class="hatch-bg" />
        <line x1="0" y1="0" x2="0" y2="5" class="hatch-line" />
      </pattern>
      <marker id="kt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head" />
      </marker>
    </defs>

    <!-- the pool -->
    <text x="8" y="14" class="cap">{{ L('pod A’s quota pool (limit 2 CPUs)', 'pod A 的配额池（limit 2 个 CPU）') }}</text>
    <rect x="8" y="20" width="344" height="20" rx="4" class="box" />
    <rect x="9" y="21" :width="342 * poolFrac" height="18" rx="3" class="pool-fill" />
    <text x="14" y="34" class="cap ink">{{ poolText }}</text>

    <!-- slices handed to CPUs -->
    <g class="fade" :class="{ show: s === 1 }">
      <path v-for="x in CORES" :key="'a' + x" :d="`M${x + 15.5},41 L${x + 15.5},52`" class="flow" marker-end="url(#kt-arrow)" />
    </g>

    <!-- ten CPUs, one of pod A's threads on each -->
    <g v-for="(x, i) in CORES" :key="x">
      <rect :x="x" y="54" width="31" height="56" rx="4" class="box" />
      <text :x="x + 15.5" y="65" class="tiny c">CPU {{ i }}</text>
      <rect v-if="s <= 1" :x="x + 5" y="71" width="21" height="33" rx="3" :class="s === 0 ? 'ready' : 'run'" />
      <text v-if="s === 1" :x="x + 15.5" y="91" class="tiny c on-fill">5 ms</text>
      <rect v-if="s === 4 && i === 0" :x="x + 5" y="71" width="21" height="33" rx="3" class="req" />
      <rect v-if="throttled" :x="x + 5" y="71" width="21" height="33" rx="3" fill="url(#kt-hatch)" class="hatched" />
    </g>
    <text x="8" y="124" class="cap" :class="{ bad: throttled }">
      {{
        s === 0
          ? L('ten threads wake up, one per idle CPU', '十个线程醒来，各占一个空闲 CPU')
          : s === 1
            ? L('each CPU takes 5 ms slices from the pool', '每个 CPU 从池里按 5 ms 一片领取')
            : throttled
              ? L('throttled: pod A is off every run queue', '限流：pod A 被移出所有运行队列')
              : s === 4
                ? L('pod A is back; the request’s thread runs', 'pod A 回来了；请求的线程运行')
                : L('the request is done', '请求完成')
      }}
    </text>

    <!-- the request, waiting outside -->
    <g class="fade" :class="{ show: s >= 3 }">
      <rect x="252" y="114" width="100" height="16" rx="3" :class="s >= 5 ? 'done' : 'req-box'" />
      <text x="302" y="125" class="tiny c" :class="s >= 3 && s < 5 ? 'on-fill' : ''">{{ s >= 5 ? L('request done', '请求完成') : s === 4 ? L('request runs', '请求运行') : L('request waits', '请求在等') }}</text>
    </g>

    <!-- the timeline up to now -->
    <text x="8" y="158" class="cap">{{ L('pod A', 'pod A') }}</text>
    <rect :x="T(0)" y="147" :width="T(Math.min(now, 20)) - T(0)" height="16" class="run" />
    <rect v-if="now > 20" :x="T(20)" y="147" :width="T(Math.min(now, 100)) - T(20)" height="16" fill="url(#kt-hatch)" class="hatched" />
    <text v-if="now > 40" :x="(T(20) + T(Math.min(now, 100))) / 2" y="158.5" class="tiny c ink">{{ L('throttled: nothing runs', '限流：什么都不运行') }}</text>
    <text v-if="now >= 20" :x="(T(0) + T(20)) / 2" y="158.5" class="tiny c on-fill">{{ L('10 threads', '10 个线程') }}</text>
    <rect v-if="now > 100" :x="T(100)" y="147" :width="T(now) - T(100)" height="16" class="req" />

    <text x="8" y="186" class="cap">{{ L('budget', '预算') }}</text>
    <path :d="budgetPath" class="budget" />

    <text x="8" y="214" class="cap">{{ L('request', '请求') }}</text>
    <g class="fade" :class="{ show: s >= 3 }">
      <circle :cx="T(21)" cy="210" r="3" class="req" />
      <path :d="`M${T(21) + 4},210 L${T(Math.max(21, Math.min(now, 100)))},210`" class="link" />
      <rect v-if="now > 100" :x="T(100)" y="205" :width="T(now) - T(100)" height="10" class="req" />
      <text :x="T(21) + 6" y="205" class="tiny">{{ L('arrives at 21 ms, needs 3 ms', '21 ms 到达，需要 3 ms') }}</text>
    </g>

    <!-- now -->
    <path :d="`M${T(now)},142 L${T(now)},226`" class="now" />
    <line :x1="T(0)" y1="226" :x2="T(110)" y2="226" class="axis" />
    <text :x="T(0)" y="238" class="tiny c">0</text>
    <text :x="T(20)" y="238" class="tiny c">20</text>
    <text :x="T(100)" y="238" class="tiny c">100 ms</text>
    <text x="8" y="238" class="tiny">t</text>

    <!-- the account -->
    <g class="fade" :class="{ show: s >= 5 }">
      <rect x="8" y="250" width="344" height="40" rx="5" class="box" />
      <text x="180" y="266" class="cap c ink">{{ L('latency 82 ms = 3 ms of work + 79 ms of waiting', '延迟 82 ms = 3 ms 工作 + 79 ms 等待') }}</text>
      <text x="180" y="281" class="cap c">{{ L('the node had idle CPUs all along', '节点上始终有空闲的 CPU') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.cap {
  font-size: 9.5px;
  fill: var(--muted);
}
.cap.ink {
  fill: var(--ink-2);
  font-weight: 600;
}
.cap.bad {
  fill: var(--p3);
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.tiny.ink {
  fill: var(--ink-2);
  font-weight: 600;
}
.on-fill {
  fill: #fff;
}
.c {
  text-anchor: middle;
}
.box {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
}
.pool-fill {
  fill: var(--p0);
  opacity: 0.25;
  transition: width 0.5s ease;
}
.run {
  fill: var(--p0);
}
.ready {
  fill: none;
  stroke: var(--p0);
  stroke-width: 1.4;
  stroke-dasharray: 3 2;
}
.req,
.req-box {
  fill: var(--accent);
}
.done {
  fill: var(--bg-elev);
  stroke: var(--accent);
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
.budget {
  fill: none;
  stroke: var(--p0);
  stroke-width: 1.6;
}
.link {
  fill: none;
  stroke: var(--muted);
  stroke-dasharray: 3 3;
}
.flow {
  stroke: var(--ink-2);
  stroke-width: 1;
}
.head {
  fill: var(--ink-2);
}
.now {
  stroke: var(--accent);
  stroke-width: 1.4;
  transition: d 0.5s ease;
}
.axis {
  stroke: var(--rule-strong);
}
.fade {
  opacity: 0;
  transition: opacity 0.35s;
}
.show {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .fade,
  .pool-fill,
  .now {
    transition: none;
  }
}
</style>
