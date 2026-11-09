<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { schedule, type Job, type Policy } from '@/lib/sim/scheduler'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

const POLICIES: Policy[] = ['FIFO', 'SJF', 'STCF', 'RR']
const presets: { id: string; label: Bi; jobs: Job[]; policy: Policy; note: Bi }[] = [
  {
    id: 'equal',
    label: { en: 'Equal jobs', zh: '等长任务' },
    policy: 'FIFO',
    jobs: [{ id: 'A', arrival: 0, length: 10 }, { id: 'B', arrival: 0, length: 10 }, { id: 'C', arrival: 0, length: 10 }],
    note: { en: 'Figure 7.1: FIFO is fine when jobs are alike — average turnaround 20.', zh: '图 7.1：任务长度相同时 FIFO 没问题——平均周转时间 20。' },
  },
  {
    id: 'convoy',
    label: { en: 'Convoy', zh: '护航效应' },
    policy: 'FIFO',
    jobs: [{ id: 'A', arrival: 0, length: 100 }, { id: 'B', arrival: 0, length: 10 }, { id: 'C', arrival: 0, length: 10 }],
    note: { en: 'Figure 7.2: one long job in front and everyone waits (110). Try SJF.', zh: '图 7.2：一个长任务排在前面，所有人都在等（110）。试试 SJF。' },
  },
  {
    id: 'late',
    label: { en: 'Late arrivals', zh: '晚到的短任务' },
    policy: 'SJF',
    jobs: [{ id: 'A', arrival: 0, length: 100 }, { id: 'B', arrival: 10, length: 10 }, { id: 'C', arrival: 10, length: 10 }],
    note: { en: 'Figure 7.4: non-preemptive SJF is stuck behind A (103.33). STCF preempts (50).', zh: '图 7.4：非抢占的 SJF 被困在 A 后面（103.33）。STCF 可以抢占（50）。' },
  },
  {
    id: 'rr',
    label: { en: 'Response time', zh: '响应时间' },
    policy: 'RR',
    jobs: [{ id: 'A', arrival: 0, length: 5 }, { id: 'B', arrival: 0, length: 5 }, { id: 'C', arrival: 0, length: 5 }],
    note: { en: 'Figures 7.6–7.7: RR answers everyone fast (response 1) but finishes everyone late.', zh: '图 7.6–7.7：RR 让每个任务都很快得到响应（响应时间 1），但都很晚才完成。' },
  },
]

const preset = ref(presets[1])
const jobs = reactive<Job[]>(preset.value.jobs.map((j) => ({ ...j })))
const policy = ref<Policy>(preset.value.policy)
const quantum = ref(1)
function load(p: (typeof presets)[number]) {
  preset.value = p
  jobs.splice(0, jobs.length, ...p.jobs.map((j) => ({ ...j })))
  policy.value = p.policy
}
function addJob() {
  if (jobs.length >= 5) return
  jobs.push({ id: 'ABCDE'[jobs.length], arrival: 0, length: 20 })
}
function removeJob() {
  if (jobs.length > 1) jobs.pop()
}

const result = computed(() => schedule(jobs, policy.value, quantum.value))
const all = computed(() => POLICIES.map((p) => ({ p, r: schedule(jobs, p, quantum.value) })))
const duration = computed(() => Math.max(1, result.value.makespan))
const player = usePlayer(duration, { speed: 10 })
watch(duration, (d) => (player.speed.value = Math.max(4, d / 7)), { immediate: true })
watch([policy, quantum, () => JSON.stringify(jobs)], () => {
  player.reset()
  player.play()
})

const W = 640
const LANE = 26
const left = 28
const x = (time: number) => left + (time / duration.value) * (W - left - 8)
const now = computed(() => player.t.value)
const ticks = computed(() => {
  const d = duration.value
  const step = d <= 20 ? 2 : d <= 60 ? 10 : d <= 150 ? 20 : 50
  return Array.from({ length: Math.floor(d / step) + 1 }, (_, i) => i * step)
})
const idx = (id: string) => jobs.findIndex((j) => j.id === id)
const statOf = (id: string) => result.value.stats.find((s) => s.id === id)!
const done = (id: string) => statOf(id).completion <= now.value + 1e-6
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
const maxAvg = computed(() => Math.max(1, ...all.value.flatMap((a) => [a.r.avgTurnaround, a.r.avgResponse])))
</script>

<template>
  <LabFrame :title="title" name="scheduler" :player="player" :duration="duration">
    <div class="lab-grid">
      <div class="lab-row">
        <div class="seg">
          <button v-for="p in presets" :key="p.id" :aria-pressed="preset.id === p.id" @click="load(p)">{{ t(p.label) }}</button>
        </div>
        <span class="caption-line muted">{{ t(preset.note) }}</span>
      </div>

      <div class="lab-row">
        <div class="seg" role="group" aria-label="policy">
          <button v-for="p in POLICIES" :key="p" :aria-pressed="policy === p" @click="policy = p">{{ p }}</button>
        </div>
        <label v-if="policy === 'RR'" class="field">
          {{ t({ en: 'time slice', zh: '时间片' }) }}
          <select v-model.number="quantum"><option v-for="q in [1, 2, 5, 10]" :key="q" :value="q">{{ q }}</option></select>
        </label>
      </div>

      <svg class="viz" :viewBox="`0 0 ${W} ${(jobs.length + 1) * LANE + 34}`" role="img" :aria-label="t({ en: 'schedule timeline', zh: '调度时间线' })">
        <defs>
          <clipPath id="sched-clip"><rect :x="0" y="0" :width="x(now)" :height="(jobs.length + 1) * LANE + 10" /></clipPath>
        </defs>
        <!-- CPU lane -->
        <text x="0" y="17" class="lane-l">CPU</text>
        <rect :x="left" y="4" :width="W - left - 8" height="18" fill="var(--bg-sunk)" rx="2" />
        <g clip-path="url(#sched-clip)">
          <rect v-for="(s, i) in result.slices" :key="'c' + i" :x="x(s.start)" y="4" :width="Math.max(0.5, x(s.end) - x(s.start) - 0.5)" height="18" :fill="`var(--p${idx(s.job)})`" />
          <text v-for="(s, i) in result.slices.filter((s) => x(s.end) - x(s.start) > 14)" :key="'l' + i" :x="(x(s.start) + x(s.end)) / 2" y="17" text-anchor="middle" class="in">{{ s.job }}</text>
        </g>
        <!-- per-job lanes -->
        <g v-for="(j, k) in jobs" :key="j.id" :transform="`translate(0 ${(k + 1) * LANE + 4})`">
          <text x="0" y="13" class="lane-l">{{ j.id }}</text>
          <line :x1="x(j.arrival)" :x2="x(Math.min(now, statOf(j.id).completion))" y1="9" y2="9" :stroke="`var(--p${k})`" stroke-dasharray="2 3" opacity="0.6" v-if="now > j.arrival" />
          <g clip-path="url(#sched-clip)">
            <rect v-for="(s, i) in result.slices.filter((s) => s.job === j.id)" :key="i" :x="x(s.start)" y="2" :width="Math.max(0.5, x(s.end) - x(s.start) - 0.5)" height="14" rx="2" :fill="`var(--p${k})`" />
          </g>
          <path :d="`M ${x(j.arrival) - 4} -2 L ${x(j.arrival) + 4} -2 L ${x(j.arrival)} 4 z`" fill="var(--ink-2)" />
          <text v-if="done(j.id)" :x="x(statOf(j.id).completion) + 4" y="13" class="done">✓ {{ statOf(j.id).completion }}</text>
        </g>
        <!-- axis -->
        <g class="axis" :transform="`translate(0 ${(jobs.length + 1) * LANE + 8})`">
          <line :x1="left" :x2="W - 8" y1="0" y2="0" />
          <g v-for="tk in ticks" :key="tk">
            <line :x1="x(tk)" :x2="x(tk)" y1="0" y2="4" />
            <text :x="x(tk)" y="16" text-anchor="middle">{{ tk }}</text>
          </g>
        </g>
        <line :x1="x(now)" :x2="x(now)" y1="0" :y2="(jobs.length + 1) * LANE + 8" stroke="var(--ink)" stroke-width="1" />
      </svg>

      <div class="lab-grid two">
        <table class="mono-table">
          <thead>
            <tr>
              <th>{{ t({ en: 'job', zh: '任务' }) }}</th>
              <th>{{ t({ en: 'arrive', zh: '到达' }) }}</th>
              <th>{{ t({ en: 'length', zh: '长度' }) }}</th>
              <th title="T_firstrun − T_arrival">{{ t({ en: 'response', zh: '响应' }) }}</th>
              <th title="T_completion − T_arrival">{{ t({ en: 'turnaround', zh: '周转' }) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(j, k) in jobs" :key="j.id">
              <td><span class="chip" :class="'p' + k">{{ j.id }}</span></td>
              <td><input v-model.number="j.arrival" class="num" type="number" min="0" max="200" :aria-label="`${j.id} arrival`" /></td>
              <td><input v-model.number="j.length" class="num" type="number" min="1" max="200" :aria-label="`${j.id} length`" /></td>
              <td>{{ statOf(j.id).firstRun <= now ? statOf(j.id).response : '…' }}</td>
              <td>{{ done(j.id) ? statOf(j.id).turnaround : '…' }}</td>
            </tr>
            <tr class="avg">
              <td colspan="3">{{ t({ en: 'average', zh: '平均' }) }}</td>
              <td>{{ fmt(result.avgResponse) }}</td>
              <td>{{ fmt(result.avgTurnaround) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="compare">
          <div class="lab-label">{{ t({ en: 'same workload, every policy', zh: '同一负载，所有策略' }) }}</div>
          <div v-for="a in all" :key="a.p" class="cmp" :class="{ on: a.p === policy }" @click="policy = a.p">
            <span class="pn mono">{{ a.p }}</span>
            <div class="bars">
              <div class="bar ta" :style="{ width: (a.r.avgTurnaround / maxAvg) * 100 + '%' }"><span>{{ fmt(a.r.avgTurnaround) }}</span></div>
              <div class="bar rs" :style="{ width: Math.max(0.5, (a.r.avgResponse / maxAvg) * 100) + '%' }"><span>{{ fmt(a.r.avgResponse) }}</span></div>
            </div>
          </div>
          <div class="legend mono"><i class="ta" /> {{ t({ en: 'avg turnaround', zh: '平均周转' }) }} <i class="rs" /> {{ t({ en: 'avg response', zh: '平均响应' }) }}</div>
        </div>
      </div>
    </div>
    <template #controls>
      <button class="btn" :disabled="jobs.length >= 5" @click="addJob">+ {{ t({ en: 'job', zh: '任务' }) }}</button>
      <button class="btn" :disabled="jobs.length <= 1" @click="removeJob">− {{ t({ en: 'job', zh: '任务' }) }}</button>
    </template>
  </LabFrame>
</template>

<style scoped>
.lane-l {
  font-size: 11px !important;
  fill: var(--muted) !important;
}
.in {
  fill: #fff !important;
  font-size: 10px !important;
  font-weight: 600;
}
.done {
  font-size: 10px !important;
  fill: var(--ok) !important;
}
.num {
  width: 4em;
  font: inherit;
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--rule);
  border-radius: 3px;
  padding: 1px 4px;
}
tr.avg td {
  font-weight: 600;
  border-bottom: 0;
}
.compare {
  display: grid;
  gap: 6px;
  align-content: start;
}
.cmp {
  display: grid;
  grid-template-columns: 3.4em 1fr;
  gap: 8px;
  align-items: center;
  padding: 3px 4px;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s, background 0.2s;
}
.cmp.on,
.cmp:hover {
  opacity: 1;
  background: var(--bg-sunk);
}
.pn {
  font-size: 12px;
}
.bars {
  display: grid;
  gap: 2px;
}
.bar {
  height: 11px;
  border-radius: 2px;
  position: relative;
  transition: width 0.5s var(--ease);
}
.bar span {
  position: absolute;
  left: calc(100% + 4px);
  top: -2px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--muted);
  white-space: nowrap;
}
.ta {
  background: var(--accent);
}
.rs {
  background: var(--p1);
}
.legend {
  font-size: 10.5px;
  color: var(--muted);
  display: flex;
  gap: 6px;
  align-items: center;
}
.legend i {
  display: inline-block;
  width: 10px;
  height: 8px;
  border-radius: 2px;
}
</style>
