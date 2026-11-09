<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { mean, runEevdf, type EevdfTask } from '@/lib/sim/eevdf'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

// Two CPU-bound tasks with the default 3 ms slice, and an interactive task C that runs 0.5 ms and
// sleeps 3.75 ms. Change C's requested slice: its latency moves, its entitlement does not.
const cSlice = ref(3)
const aWeight = ref(1)
const DURATION = 60
const tasks = computed<EevdfTask[]>(() => [
  { name: 'A', weight: aWeight.value, slice: 3 },
  { name: 'B', weight: 1, slice: 3 },
  { name: 'C', weight: 1, slice: cSlice.value, burst: 0.5, sleep: 3.75 },
])
const run = computed(() => runEevdf(tasks.value, DURATION))
const long = computed(() => runEevdf(tasks.value, 2000))
const steps = computed(() => run.value.frames.length)
const player = usePlayer(steps, { speed: 10 })
watch([cSlice, aWeight], () => player.reset())
const k = computed(() => Math.min(steps.value - 1, Math.floor(player.t.value)))
const frame = computed(() => run.value.frames[k.value])

// timeline geometry
const W = 640
const LX = 26
const tx = (step: number) => LX + (step / steps.value) * (W - LX - 8)
const segs = computed(() => {
  const out: { task: number; a: number; b: number }[] = []
  run.value.timeline.forEach((x, i) => {
    if (x === null) return
    const last = out[out.length - 1]
    if (last && last.task === x && last.b === i) last.b = i + 1
    else out.push({ task: x, a: i, b: i + 1 })
  })
  return out
})
// C's wakeups: from waking up (runnable, not running) to running
const waits = computed(() => {
  const out: { a: number; b: number }[] = []
  let from: number | null = null
  run.value.frames.forEach((f, i) => {
    const waiting = f.tasks[2].runnable && f.running !== 2
    if (waiting && from === null) from = i
    if (!waiting && from !== null) {
      out.push({ a: from, b: i })
      from = null
    }
  })
  return out.filter((w) => w.a > 0)
})

// virtual-time number line around V
const span = 6
const vx = (v: number) => LX + 40 + ((v - frame.value.V + span) / (2 * span)) * (W - LX - 90)
const clampX = (x: number) => Math.max(LX + 2, Math.min(W - 10, x))
const picked = computed(() => {
  const f = frame.value
  let best: number | null = null
  f.tasks.forEach((s, i) => {
    if (s.eligible && (best === null || s.deadline < f.tasks[best].deadline)) best = i
  })
  return best
})
const NAMES = ['A', 'B', 'C']
const latency = computed(() => mean(long.value.wakeLatency[2]))
</script>

<template>
  <LabFrame
    :title="title"
    name="eevdf"
    :player="player"
    :duration="steps"
    :hint="{
      en: 'Top: who runs (0–60 ms); red marks are C waiting after a wakeup. Bottom: virtual time. A task is eligible when it sits left of V; the scheduler runs the eligible task whose deadline (the end of its bar) comes first.',
      zh: '上：谁在运行（0–60 ms），红色标记是 C 被唤醒后的等待。下：虚拟时间轴。位于 V 左侧的任务是“合格”的；调度器在合格任务中挑选截止期（横条末端）最早的那个。',
    }"
  >
    <div class="lab-grid">
      <div class="lab-row">
        <span class="field">
          {{ t({ en: 'C requests slices of', zh: 'C 请求的时间片' }) }}
          <span class="seg">
            <button v-for="s in [3, 1, 0.5]" :key="s" :aria-pressed="cSlice === s" @click="cSlice = s">{{ s }} ms</button>
          </span>
        </span>
        <span class="field">
          {{ t({ en: 'A’s weight', zh: 'A 的权重' }) }}
          <span class="seg">
            <button v-for="w in [1, 2]" :key="w" :aria-pressed="aWeight === w" @click="aWeight = w">×{{ w }}</button>
          </span>
        </span>
      </div>

      <svg class="viz" :viewBox="`0 0 ${W} 92`" role="img" :aria-label="t({ en: 'schedule timeline', zh: '调度时间线' })">
        <g class="axis">
          <text v-for="(n, i) in NAMES" :key="n" x="4" :y="18 + i * 24">{{ n }}</text>
          <text :x="W - 8" y="88" text-anchor="end">{{ DURATION }} ms</text>
        </g>
        <rect v-for="(w, i) in waits" :key="'w' + i" :x="tx(w.a)" :y="2 * 24 + 4" :width="Math.max(1.5, tx(w.b) - tx(w.a))" height="18" fill="var(--bad, #c0392b)" opacity="0.28" />
        <rect v-for="(s, i) in segs" :key="i" :x="tx(s.a)" :y="s.task * 24 + 4" :width="Math.max(1, tx(s.b) - tx(s.a) - 0.6)" height="18" :fill="`var(--p${s.task})`" :opacity="s.a <= k ? 0.95 : 0.22" />
        <line :x1="tx(k)" :x2="tx(k)" y1="0" y2="76" stroke="var(--ink)" stroke-width="1" />
      </svg>

      <svg class="viz" :viewBox="`0 0 ${W} 112`" role="img" :aria-label="t({ en: 'virtual time number line', zh: '虚拟时间数轴' })">
        <rect :x="LX" y="4" :width="Math.max(0, vx(frame.V) - LX)" height="84" fill="var(--accent-soft)" />
        <text :x="LX + 4" y="102" class="note">{{ t({ en: '← eligible (lag ≥ 0)', zh: '← 合格（lag ≥ 0）' }) }}</text>
        <line :x1="vx(frame.V)" :x2="vx(frame.V)" y1="2" y2="92" stroke="var(--accent)" stroke-width="1.5" />
        <text :x="vx(frame.V)" y="104" text-anchor="middle" class="vlab">V</text>
        <g v-for="(s, i) in frame.tasks" :key="i" :opacity="s.runnable ? 1 : 0.3">
          <text x="4" :y="i * 28 + 22" class="axis-t">{{ NAMES[i] }}</text>
          <line :x1="clampX(vx(s.v))" :x2="clampX(vx(s.deadline))" :y1="i * 28 + 18" :y2="i * 28 + 18" :stroke="`var(--p${i})`" stroke-width="5" stroke-linecap="round" opacity="0.45" />
          <line :x1="clampX(vx(s.deadline))" :x2="clampX(vx(s.deadline))" :y1="i * 28 + 10" :y2="i * 28 + 26" :stroke="`var(--p${i})`" stroke-width="2" />
          <circle :cx="clampX(vx(s.v))" :cy="i * 28 + 18" r="6" :fill="s.runnable ? `var(--p${i})` : 'var(--bg-elev)'" :stroke="`var(--p${i})`" stroke-width="2" />
          <circle v-if="picked === i" :cx="clampX(vx(s.v))" :cy="i * 28 + 18" r="10" fill="none" stroke="var(--ink)" stroke-width="1.5" />
          <text v-if="!s.runnable" :x="clampX(vx(s.v)) + 12" :y="i * 28 + 22" class="note">{{ t({ en: 'asleep', zh: '睡眠中' }) }}</text>
        </g>
      </svg>

      <div class="stats">
        <div class="stat">
          <span class="k">{{ t({ en: 'C’s mean wait after wakeup', zh: 'C 唤醒后的平均等待' }) }}</span>
          <span class="v" :style="{ color: 'var(--p2)' }">{{ latency.toFixed(2) }} ms</span>
        </div>
        <div v-for="(n, i) in NAMES" :key="n" class="stat">
          <span class="k">{{ n }} · {{ t({ en: 'CPU share', zh: 'CPU 份额' }) }}</span>
          <span class="v" :style="{ color: `var(--p${i})` }">{{ Math.round(long.share[i] * 1000) / 10 }}%</span>
        </div>
      </div>
    </div>
  </LabFrame>
</template>

<style scoped>
.note,
.axis-t {
  font-family: var(--font-mono);
  font-size: 10.5px;
  fill: var(--muted);
}
.vlab {
  font-family: var(--font-mono);
  font-size: 11px;
  fill: var(--accent-ink);
  font-weight: 600;
}
circle,
line {
  transition: cx 0.12s linear, x1 0.12s linear, x2 0.12s linear;
}
</style>
