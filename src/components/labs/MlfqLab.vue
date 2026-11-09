<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { runMlfq, cpuShare, type MlfqJob } from '@/lib/sim/mlfq'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

interface Scenario {
  id: string
  label: Bi
  jobs: MlfqJob[]
  boost: number
  gamingFix: boolean
  note: Bi
  maxT: number
}
const scenarios: Scenario[] = [
  { id: 'long', label: { en: 'Long job', zh: '单个长任务' }, jobs: [{ id: 'A', arrival: 0, length: 80 }], boost: 0, gamingFix: true, maxT: 100, note: { en: 'Figure 8.2: a CPU-bound job uses up its allotment at each level and sinks.', zh: '图 8.2：CPU 密集型任务在每一层用完配额后逐级下沉。' } },
  { id: 'short', label: { en: '+ short job', zh: '+ 短任务' }, jobs: [{ id: 'A', arrival: 0, length: 120 }, { id: 'B', arrival: 50, length: 20 }], boost: 0, gamingFix: true, maxT: 160, note: { en: 'Figure 8.3: B arrives at the top, runs first, finishes before sinking far — MLFQ approximates SJF.', zh: '图 8.3：B 从最高层进入，优先运行，在沉底之前就完成了——MLFQ 近似了 SJF。' } },
  { id: 'io', label: { en: '+ interactive', zh: '+ 交互式' }, jobs: [{ id: 'A', arrival: 0, length: 140 }, { id: 'B', arrival: 30, length: 40, ioEvery: 1, ioTime: 4 }], boost: 0, gamingFix: true, maxT: 200, note: { en: 'Figure 8.4 (left): B does I/O after 1 tick and keeps its high priority, so it stays responsive.', zh: '图 8.4（左）：B 每运行 1 个时钟就做 I/O，保住了高优先级，因此响应迅速。' } },
  { id: 'starve', label: { en: 'Starvation', zh: '饥饿' }, jobs: [{ id: 'A', arrival: 0, length: 200 }, { id: 'B', arrival: 30, length: 200, ioEvery: 1, ioTime: 1 }, { id: 'C', arrival: 30, length: 200, ioEvery: 1, ioTime: 1 }], boost: 0, gamingFix: false, maxT: 220, note: { en: 'Figure 8.5: two interactive jobs keep the top queue busy and A starves. Turn the boost on.', zh: '图 8.5：两个交互式任务一直占着顶层队列，A 被饿死。打开优先级提升试试。' } },
  { id: 'game', label: { en: 'Gaming', zh: '钻空子' }, jobs: [{ id: 'A', arrival: 0, length: 200 }, { id: 'G', arrival: 0, length: 200, ioEvery: 9, ioTime: 1 }], boost: 0, gamingFix: false, maxT: 220, note: { en: 'Figure 8.6: G yields just before its slice ends and never loses priority. Turn on better accounting.', zh: '图 8.6：G 总在时间片结束前主动让出 CPU，从不降级。打开“更好的计时方式”。' } },
]
const sc = ref(scenarios[1])
const boost = ref(0)
const gamingFix = ref(true)
function pick(s: Scenario) {
  sc.value = s
  boost.value = s.boost
  gamingFix.value = s.gamingFix
}
const QUEUES = 3
const cfg = computed(() => ({ queues: QUEUES, quantum: [10, 10, 10], allotment: [10, 10, 10], boost: boost.value, gamingFix: gamingFix.value }))
const ticks = computed(() => runMlfq(sc.value.jobs, cfg.value, sc.value.maxT))
const duration = computed(() => ticks.value.length - 1)
const player = usePlayer(duration, { speed: 24 })
watch([sc, boost, gamingFix], () => {
  player.reset()
  player.play()
})
const now = computed(() => Math.floor(player.t.value))
const tick = computed(() => ticks.value[Math.min(now.value, ticks.value.length - 1)])
const ids = computed(() => sc.value.jobs.map((j) => j.id))
const ci = (id: string) => ids.value.indexOf(id)

const W = 640
const H = 150
const left = 30
const x = (k: number) => left + (k / Math.max(1, duration.value)) * (W - left - 6)
const y = (level: number) => 18 + level * 42
/** running segments: consecutive ticks with the same job at the same level */
const segs = computed(() => {
  const out: { id: string; level: number; a: number; b: number }[] = []
  ticks.value.forEach((k) => {
    if (!k.running) return
    const level = k.level[k.running]
    const last = out[out.length - 1]
    if (last && last.id === k.running && last.level === level && last.b === k.t) last.b = k.t + 1
    else out.push({ id: k.running, level, a: k.t, b: k.t + 1 })
  })
  return out
})
const boosts = computed(() => ticks.value.filter((k) => k.boosted).map((k) => k.t))
const share = computed(() => cpuShare(ticks.value.slice(0, now.value + 1)))
</script>

<template>
  <LabFrame :title="title" name="mlfq" :player="player" :duration="duration">
    <div class="lab-grid">
      <div class="lab-row">
        <div class="seg">
          <button v-for="s in scenarios" :key="s.id" :aria-pressed="sc.id === s.id" @click="pick(s)">{{ t(s.label) }}</button>
        </div>
      </div>
      <p class="caption-line">{{ t(sc.note) }}</p>

      <div class="lab-grid">
        <svg class="viz" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="t({ en: 'MLFQ timeline by priority level', zh: '按优先级展示的 MLFQ 时间线' })">
          <g v-for="q in QUEUES" :key="q">
            <text x="0" :y="y(q - 1) + 4" class="ql">Q{{ QUEUES - q }}</text>
            <line :x1="left" :x2="W - 6" :y1="y(q - 1)" :y2="y(q - 1)" stroke="var(--rule)" stroke-dasharray="2 3" />
          </g>
          <defs><clipPath id="mlfq-clip"><rect x="0" y="0" :width="x(player.t.value)" :height="H" /></clipPath></defs>
          <g clip-path="url(#mlfq-clip)">
            <rect v-for="(s, i) in segs" :key="i" :x="x(s.a)" :y="y(s.level) - 9" :width="Math.max(0.6, x(s.b) - x(s.a))" height="18" :fill="`var(--p${ci(s.id)})`" />
          </g>
          <g v-for="b in boosts.filter((b) => b <= now)" :key="'b' + b">
            <line :x1="x(b)" :x2="x(b)" y1="4" :y2="H - 24" stroke="var(--warn)" stroke-width="1.2" />
            <text :x="x(b) + 2" y="10" class="boost">↑ boost</text>
          </g>
          <line :x1="x(player.t.value)" :x2="x(player.t.value)" y1="2" :y2="H - 22" stroke="var(--ink)" />
          <text :x="left" :y="H - 6" class="ql">0</text>
          <text :x="W - 6" :y="H - 6" text-anchor="end" class="ql">{{ duration }} ms</text>
        </svg>

        <div class="queues">
          <div v-for="q in QUEUES" :key="q" class="queue">
            <span class="qn mono">Q{{ QUEUES - q }}<small>{{ q === 1 ? ' ' + t({ en: 'high', zh: '高' }) : q === QUEUES ? ' ' + t({ en: 'low', zh: '低' }) : '' }}</small></span>
            <TransitionGroup name="mv" tag="div" class="slots">
              <span v-if="tick.running && tick.level[tick.running] === q - 1" :key="tick.running" class="chip running" :class="'p' + ci(tick.running)">{{ tick.running }}▸</span>
              <span v-for="id in tick.queues[q - 1]" :key="id" class="chip" :class="'p' + ci(id)">{{ id }}</span>
            </TransitionGroup>
          </div>
          <div class="queue">
            <span class="qn mono">I/O</span>
            <TransitionGroup name="mv" tag="div" class="slots">
              <span v-for="id in tick.blocked" :key="id" class="chip ghost" :class="'p' + ci(id)">{{ id }}</span>
            </TransitionGroup>
          </div>
          <div class="stats">
            <div v-for="id in ids" :key="id" class="stat"><span class="k">{{ id }} {{ t({ en: 'CPU share', zh: 'CPU 占比' }) }}</span><span class="v">{{ Math.round((share[id] ?? 0) * 100) }}%</span></div>
          </div>
        </div>
      </div>
    </div>
    <template #controls>
      <label class="field">
        {{ t({ en: 'Rule 5 boost every', zh: '规则 5：每隔' }) }}
        <select v-model.number="boost">
          <option :value="0">{{ t({ en: 'never', zh: '从不' }) }}</option>
          <option :value="50">50 ms</option>
          <option :value="100">100 ms</option>
        </select>
        {{ t({ en: '', zh: '提升一次' }) }}
      </label>
      <label class="field"><input v-model="gamingFix" type="checkbox" /> {{ t({ en: 'Rule 4: better accounting', zh: '规则 4：更好的计时' }) }}</label>
    </template>
  </LabFrame>
</template>

<style scoped>
.ql {
  font-size: 10.5px !important;
  fill: var(--muted) !important;
}
.boost {
  font-size: 9.5px !important;
  fill: var(--warn) !important;
}
.queues {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  align-content: start;
}
.queues .stats {
  grid-column: 1 / -1;
}
.queue {
  display: grid;
  grid-template-columns: 4.6em 1fr;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 3px 6px;
  border: 1px solid var(--rule);
  border-radius: 5px;
  background: var(--bg);
}
.qn {
  font-size: 12px;
  color: var(--ink-2);
}
.qn small {
  font-size: 10px;
  color: var(--faint);
}
.slots {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.chip.running {
  outline: 2px solid var(--ink);
  outline-offset: 1px;
}
.chip.ghost {
  opacity: 0.55;
}
.mv-move,
.mv-enter-active,
.mv-leave-active {
  transition: all 0.3s var(--ease);
}
.mv-enter-from,
.mv-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.mv-leave-active {
  position: absolute;
}
</style>
