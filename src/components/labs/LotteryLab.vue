<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { lottery, stride, runningShare, STRIDE_CONSTANT } from '@/lib/sim/proportional'
import { rng } from '@/lib/sim/rng'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

const jobs = reactive([
  { id: 'A', tickets: 100 },
  { id: 'B', tickets: 50 },
  { id: 'C', tickets: 250 },
])
const seed = ref(7)
const N = 200
const total = computed(() => jobs.reduce((s, j) => s + j.tickets, 0))
const ids = computed(() => jobs.map((j) => j.id))
const lot = computed(() => lottery(jobs, N, seed.value))
const str = computed(() => stride(jobs, N))
const lotShare = computed(() => runningShare(lot.value, ids.value))
const strShare = computed(() => runningShare(str.value.order, ids.value))
/** the winning ticket numbers, regenerated with the same RNG so the wheel matches the draws */
const draws = computed(() => {
  const r = rng(seed.value)
  return Array.from({ length: N }, () => Math.floor(r() * total.value))
})

const duration = ref(N)
const player = usePlayer(duration, { speed: 14 })
watch([() => JSON.stringify(jobs), seed], () => player.reset())
const k = computed(() => Math.min(N - 1, Math.floor(player.t.value)))
const started = computed(() => player.t.value > 0)

// ticket ruler
const W = 640
const rx = (n: number) => 10 + (n / total.value) * (W - 20)
const ranges = computed(() => {
  let a = 0
  return jobs.map((j, i) => {
    const r = { id: j.id, i, a, b: a + j.tickets }
    a += j.tickets
    return r
  })
})
// convergence plot
const PH = 150
const px = (i: number) => 34 + (i / (N - 1)) * (W - 44)
const py = (v: number) => 10 + (1 - v) * (PH - 30)
const path = (arr: number[]) => arr.slice(0, k.value + 1).map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ')
const recent = computed(() => lot.value.slice(Math.max(0, k.value - 23), k.value + 1))
</script>

<template>
  <LabFrame :title="title" name="lottery" :player="player" :duration="duration"
    :hint="{ en: 'Solid lines: lottery (random draws). Dashed: stride (deterministic). Thin grey: each job’s fair share.', zh: '实线：彩票调度（随机抽取）。虚线：步长调度（确定性）。细灰线：每个任务应得的份额。' }">
    <div class="lab-grid">
      <div class="lab-row">
        <label v-for="(j, i) in jobs" :key="j.id" class="field">
          <span class="chip" :class="'p' + i">{{ j.id }}</span>
          <input v-model.number="j.tickets" type="range" min="10" max="400" step="10" />
          <span class="mono tk">{{ j.tickets }}</span>
        </label>
      </div>
      <svg class="viz" :viewBox="`0 0 ${W} 58`" role="img" :aria-label="t({ en: 'ticket ranges', zh: '彩票编号区间' })">
        <rect v-for="r in ranges" :key="r.id" :x="rx(r.a)" y="14" :width="rx(r.b) - rx(r.a) - 1" height="20" :fill="`var(--p${r.i})`" opacity="0.85" />
        <text v-for="r in ranges" :key="'t' + r.id" :x="(rx(r.a) + rx(r.b)) / 2" y="28" text-anchor="middle" class="in">{{ r.id }} {{ r.a }}–{{ r.b - 1 }}</text>
        <g v-if="started" :style="{ transform: `translateX(${rx(draws[k] + 0.5)}px)` }" class="needle">
          <path d="M0 10 L-5 2 L5 2 Z" fill="var(--ink)" />
          <line x1="0" x2="0" y1="10" y2="38" stroke="var(--ink)" />
          <text y="52" text-anchor="middle" class="win">#{{ draws[k] }} → {{ lot[k] }}</text>
        </g>
      </svg>
      <div class="recent">
        <span class="lab-label">{{ t({ en: 'last draws', zh: '最近抽中' }) }}</span>
        <TransitionGroup name="pop" tag="span" class="rec">
          <span v-for="(id, i) in started ? recent : []" :key="k - recent.length + 1 + i" class="chip" :class="'p' + ids.indexOf(id)">{{ id }}</span>
        </TransitionGroup>
      </div>
      <svg class="viz" :viewBox="`0 0 ${W} ${PH}`" role="img" :aria-label="t({ en: 'share of CPU over time', zh: 'CPU 份额随时间变化' })">
        <g class="axis">
          <line x1="34" :x2="W - 10" :y1="py(0)" :y2="py(0)" />
          <text x="28" :y="py(0) + 3" text-anchor="end">0</text>
          <text x="28" :y="py(0.5) + 3" text-anchor="end">50%</text>
          <text x="28" :y="py(1) + 3" text-anchor="end">100%</text>
          <text :x="W - 10" :y="PH - 4" text-anchor="end">{{ t({ en: 'quanta', zh: '时间片' }) }} → {{ N }}</text>
        </g>
        <g v-for="(j, i) in jobs" :key="j.id">
          <line x1="34" :x2="W - 10" :y1="py(j.tickets / total)" :y2="py(j.tickets / total)" stroke="var(--rule-strong)" stroke-width="1" />
          <path :d="path(lotShare[j.id])" fill="none" :stroke="`var(--p${i})`" stroke-width="1.8" />
          <path :d="path(strShare[j.id])" fill="none" :stroke="`var(--p${i})`" stroke-width="1.3" stroke-dasharray="4 3" opacity="0.8" />
        </g>
      </svg>
      <div class="stats">
        <div v-for="(j, i) in jobs" :key="j.id" class="stat">
          <span class="k">{{ j.id }} · {{ t({ en: 'target', zh: '目标' }) }} {{ Math.round((j.tickets / total) * 100) }}%</span>
          <span class="v" :style="{ color: `var(--p${i})` }">{{ started ? Math.round(lotShare[j.id][k] * 100) : 0 }}% <small class="mono">/ {{ started ? Math.round(strShare[j.id][k] * 100) : 0 }}%</small></span>
        </div>
        <div class="stat">
          <span class="k">stride = {{ STRIDE_CONSTANT }} / tickets</span>
          <span class="v small mono">{{ jobs.map((j) => j.id + ':' + Math.round(STRIDE_CONSTANT / j.tickets)).join(' ') }}</span>
        </div>
      </div>
    </div>
    <template #controls>
      <button class="btn" @click="seed = seed + 1">↻ {{ t({ en: 'new random seed', zh: '换个随机种子' }) }} ({{ seed }})</button>
    </template>
  </LabFrame>
</template>

<style scoped>
.tk {
  width: 2.6em;
  color: var(--ink);
}
.in {
  fill: #fff !important;
  font-size: 10px !important;
}
.win {
  font-size: 10.5px !important;
  fill: var(--ink) !important;
}
.needle {
  transition: transform 0.18s var(--ease);
}
.recent {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 24px;
}
.rec {
  display: inline-flex;
  gap: 3px;
  flex-wrap: wrap;
}
.rec .chip {
  min-width: 20px;
  height: 18px;
  font-size: 10.5px;
}
.pop-enter-active {
  transition: all 0.25s var(--ease);
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.5);
}
.stat .v small {
  font-size: 11px;
  color: var(--muted);
}
.stat .v.small {
  font-size: 12px;
}
</style>
