<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { runMulticore, type McPolicy } from '@/lib/sim/multicore'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

const policy = ref<McPolicy>('SQMS')
const cpus = ref(4)
const workload = ref<'even' | 'uneven'>('even')
const jobs = computed(() =>
  workload.value === 'even'
    ? ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, length: 60 }))
    : [{ id: 'A', length: 90 }, { id: 'B', length: 90 }, { id: 'C', length: 15 }, { id: 'D', length: 90 }, { id: 'E', length: 15 }],
)
const res = computed(() => runMulticore(jobs.value, cpus.value, policy.value))
const duration = computed(() => res.value.makespan)
const player = usePlayer(duration, { speed: 30 })
watch([policy, cpus, workload], () => {
  player.reset()
  player.play()
})
const ids = computed(() => jobs.value.map((j) => j.id))
const W = 640
const LANE = 30
const left = 46
const scaleMax = computed(() => Math.max(...['SQMS', 'MQMS', 'MQMS+steal'].map((p) => runMulticore(jobs.value, cpus.value, p as McPolicy).makespan)))
const x = (v: number) => left + (v / scaleMax.value) * (W - left - 10)
const now = computed(() => player.t.value)
const NOTES: Record<McPolicy, Bi> = {
  SQMS: { en: 'One shared queue: perfectly balanced, but jobs hop between CPUs and keep refilling cold caches (hatched).', zh: '一个共享队列：负载完美均衡，但任务在 CPU 之间来回跳，不断重新填充冷缓存（斜线部分）。' },
  MQMS: { en: 'One queue per CPU: jobs stay put (warm caches), but when short jobs finish, some CPUs sit idle while others are crowded.', zh: '每个 CPU 一个队列：任务原地不动（缓存是热的），但短任务结束后，有的 CPU 闲着，有的却很拥挤。' },
  'MQMS+steal': { en: 'Work stealing: an idle CPU takes a job from the busiest queue — a few migrations buy back balance.', zh: '工作窃取：空闲的 CPU 从最忙的队列里拿走一个任务——用少量迁移换回均衡。' },
}
</script>

<template>
  <LabFrame :title="title" name="multicore" :player="player" :duration="duration">
    <div class="lab-grid">
      <div class="lab-row">
        <div class="seg">
          <button v-for="p in ['SQMS', 'MQMS', 'MQMS+steal'] as McPolicy[]" :key="p" :aria-pressed="policy === p" @click="policy = p">{{ p }}</button>
        </div>
        <div class="seg">
          <button :aria-pressed="workload === 'even'" @click="workload = 'even'">{{ t({ en: 'equal jobs', zh: '等长任务' }) }}</button>
          <button :aria-pressed="workload === 'uneven'" @click="workload = 'uneven'">{{ t({ en: 'some finish early', zh: '部分提前结束' }) }}</button>
        </div>
        <label class="field">CPUs <select v-model.number="cpus"><option :value="2">2</option><option :value="4">4</option></select></label>
      </div>
      <p class="caption-line">{{ t(NOTES[policy]) }}</p>
      <svg class="viz" :viewBox="`0 0 ${W} ${cpus * LANE + 24}`" role="img" :aria-label="t({ en: 'per-CPU timeline', zh: '各 CPU 时间线' })">
        <defs>
          <pattern id="mc-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#fff" stroke-width="2" opacity="0.7" />
          </pattern>
          <clipPath id="mc-clip"><rect x="0" y="0" :width="x(now)" :height="cpus * LANE" /></clipPath>
        </defs>
        <g v-for="c in cpus" :key="c">
          <text x="0" :y="(c - 1) * LANE + 18" class="ll">CPU {{ c - 1 }}</text>
          <rect :x="left" :y="(c - 1) * LANE + 4" :width="W - left - 10" height="20" fill="var(--bg-sunk)" />
        </g>
        <g clip-path="url(#mc-clip)">
          <g v-for="(s, i) in res.slices" :key="i">
            <rect :x="x(s.start)" :y="s.cpu * LANE + 4" :width="Math.max(0.5, x(s.end) - x(s.start) - 1)" height="20" :fill="`var(--p${ids.indexOf(s.job)})`" />
            <rect v-if="s.cold" :x="x(s.start)" :y="s.cpu * LANE + 4" :width="x(s.start + 3) - x(s.start)" height="20" fill="url(#mc-hatch)" />
            <text v-if="x(s.end) - x(s.start) > 12" :x="(x(s.start) + x(s.end)) / 2" :y="s.cpu * LANE + 18" text-anchor="middle" class="in">{{ s.job }}</text>
          </g>
        </g>
        <line :x1="x(now)" :x2="x(now)" y1="0" :y2="cpus * LANE + 4" stroke="var(--ink)" />
        <text :x="x(res.makespan)" :y="cpus * LANE + 18" text-anchor="middle" class="ll">{{ res.makespan }}</text>
      </svg>
      <div class="stats">
        <div class="stat" :class="res.migrations === 0 ? 'good' : ''"><span class="k">{{ t({ en: 'migrations', zh: '迁移次数' }) }}</span><span class="v">{{ res.migrations }}</span></div>
        <div class="stat" :class="res.idle > 0 ? 'bad' : 'good'"><span class="k">{{ t({ en: 'idle CPU time', zh: 'CPU 空闲时间' }) }}</span><span class="v">{{ res.idle }}</span></div>
        <div class="stat"><span class="k">{{ t({ en: 'all done at', zh: '全部完成于' }) }}</span><span class="v">{{ res.makespan }}</span></div>
      </div>
    </div>
  </LabFrame>
</template>

<style scoped>
.ll {
  font-size: 10.5px !important;
  fill: var(--muted) !important;
}
.in {
  fill: #fff !important;
  font-size: 10px !important;
  font-weight: 600;
}
</style>
