<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { runProcesses, programFrom, type ProcSpec, type PState } from '@/lib/sim/process'
import { t, uiLang, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

const presets: { id: string; label: Bi; flags: string; procs: ProcSpec[] }[] = [
  { id: 'cpu', label: { en: 'CPU only', zh: '只用 CPU' }, flags: '-l 5:100,5:100', procs: [{ id: 'P0', program: programFrom(5, 100) }, { id: 'P1', program: programFrom(5, 100) }] },
  { id: 'io-late', label: { en: 'I/O last', zh: 'I/O 在后' }, flags: '-l 4:100,1:0', procs: [{ id: 'P0', program: programFrom(4, 100) }, { id: 'P1', program: ['io'] }] },
  { id: 'io-first', label: { en: 'I/O first', zh: 'I/O 在前' }, flags: '-l 1:0,4:100', procs: [{ id: 'P0', program: ['io'] }, { id: 'P1', program: programFrom(4, 100) }] },
  { id: 'mixed', label: { en: 'Book Fig. 4.4', zh: '书中图 4.4' }, flags: '-l 4:75,6:100', procs: [{ id: 'P0', program: ['cpu', 'cpu', 'cpu', 'io', 'cpu'] }, { id: 'P1', program: programFrom(6, 100) }] },
]
const preset = ref(presets[3])
const switchOnIo = ref(true)
const runImmediate = ref(false)
const ioLength = ref(4)

const rows = computed(() => runProcesses(preset.value.procs, { ioLength: ioLength.value, switchOnIo: switchOnIo.value, runImmediate: runImmediate.value }))
const duration = computed(() => rows.value.length)
const player = usePlayer(duration, { speed: 1.6 })
watch([preset, switchOnIo, runImmediate, ioLength], () => player.reset())

const tick = computed(() => Math.min(rows.value.length - 1, Math.floor(player.t.value)))
const started = computed(() => player.t.value > 0)
const current = computed(() => (started.value ? rows.value[tick.value] : null))
const shown = computed(() => rows.value.slice(0, started.value ? tick.value + 1 : 0))
const ids = computed(() => preset.value.procs.map((p) => p.id))
const util = computed(() => {
  const s = shown.value
  return s.length ? Math.round((100 * s.filter((r) => r.cpuBusy).length) / s.length) : 0
})

// state machine geometry
const NODE: Record<Exclude<PState, 'done'>, { x: number; y: number; label: Bi }> = {
  running: { x: 90, y: 60, label: { en: 'Running', zh: '运行' } },
  ready: { x: 310, y: 60, label: { en: 'Ready', zh: '就绪' } },
  blocked: { x: 200, y: 200, label: { en: 'Blocked', zh: '阻塞' } },
}
function tokenPos(id: string, i: number) {
  const st = current.value?.states[id] ?? 'ready'
  if (st === 'done') return { x: 410 + i * 0, y: 186 + i * 26, done: true }
  const n = NODE[st]
  const peers = ids.value.filter((p) => (current.value?.states[p] ?? 'ready') === st)
  const k = peers.indexOf(id)
  return { x: n.x + (k - (peers.length - 1) / 2) * 30, y: n.y + 2, done: false }
}
const stateLabel = (s: PState) => (s === 'done' ? (uiLang.value === 'zh' ? '完成' : 'Done') : t(NODE[s].label))
const lastTransition = computed(() => current.value?.event ?? '')
</script>

<template>
  <LabFrame :title="title" name="process-run" :player="player" :duration="duration"
    :hint="{ en: 'Each tick, a process either runs one instruction or waits for I/O. Watch tokens move along the edges of Figure 4.2.', zh: '每个时钟周期，进程要么执行一条指令，要么在等 I/O。观察令牌如何沿着图 4.2 的边移动。' }">
    <div class="lab-grid">
      <div class="lab-row">
        <div class="seg">
          <button v-for="p in presets" :key="p.id" :aria-pressed="preset.id === p.id" @click="preset = p">{{ t(p.label) }}</button>
        </div>
        <code class="flags">./process-run.py {{ preset.flags }}</code>
      </div>
      <div class="lab-grid side">
        <svg class="viz" viewBox="0 0 470 250" role="img" :aria-label="t({ en: 'process state diagram', zh: '进程状态图' })">
          <defs>
            <marker id="ps-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="var(--muted)" />
            </marker>
          </defs>
          <g class="edges" fill="none" stroke="var(--rule-strong)" stroke-width="1.4" marker-end="url(#ps-arrow)">
            <path d="M130 44 Q200 14 270 44" />
            <path d="M270 76 Q200 106 130 76" />
            <path d="M100 92 L176 182" />
            <path d="M226 182 L298 92" />
          </g>
          <g class="edge-labels">
            <text x="200" y="18" text-anchor="middle">{{ t({ en: 'descheduled', zh: '取消调度' }) }}</text>
            <text x="200" y="112" text-anchor="middle">{{ t({ en: 'scheduled', zh: '调度' }) }}</text>
            <text x="112" y="150" text-anchor="end">{{ t({ en: 'I/O: initiate', zh: 'I/O：发起' }) }}</text>
            <text x="290" y="150">{{ t({ en: 'I/O: done', zh: 'I/O：完成' }) }}</text>
          </g>
          <g v-for="(n, key) in NODE" :key="key">
            <rect :x="n.x - 54" :y="n.y - 24" width="108" height="48" rx="24" fill="var(--bg)" :stroke="key === 'running' && current?.cpuBusy ? 'var(--accent)' : 'var(--rule-strong)'" :stroke-width="key === 'running' && current?.cpuBusy ? 2 : 1.2" />
            <text :x="n.x" :y="n.y - 30" text-anchor="middle" class="node-label">{{ t(n.label) }}</text>
          </g>
          <text x="410" y="166" text-anchor="middle" class="node-label">{{ uiLang === 'zh' ? '完成' : 'Done' }}</text>
          <g v-for="(id, i) in ids" :key="id" class="token" :style="{ transform: `translate(${tokenPos(id, i).x}px, ${tokenPos(id, i).y}px)` }">
            <circle r="13" :fill="`var(--p${i})`" :opacity="tokenPos(id, i).done ? 0.45 : 1" />
            <text text-anchor="middle" y="4" class="tok-label">{{ id }}</text>
          </g>
        </svg>
        <div class="trace">
          <table class="mono-table">
            <thead>
              <tr>
                <th>{{ t({ en: 'Time', zh: '时间' }) }}</th>
                <th v-for="id in ids" :key="id">{{ id }}</th>
                <th>CPU</th>
                <th>IO</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in shown" :key="r.t" :class="{ now: r.t === current?.t }">
                <td>{{ r.t }}</td>
                <td v-for="(id, i) in ids" :key="id" :class="'st-' + r.states[id]" :style="{ '--pc': `var(--p${i})` }">{{ stateLabel(r.states[id]) }}</td>
                <td>{{ r.cpuBusy ? 1 : '' }}</td>
                <td>{{ r.ioBusy ? 1 : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="lab-row">
        <div class="stats">
          <div class="stat"><span class="k">{{ t({ en: 'tick', zh: '时钟' }) }}</span><span class="v">{{ started ? current!.t : 0 }} / {{ rows.length }}</span></div>
          <div class="stat" :class="util >= 90 ? 'good' : ''"><span class="k">{{ t({ en: 'CPU busy', zh: 'CPU 利用率' }) }}</span><span class="v">{{ util }}%</span></div>
        </div>
        <span class="caption-line mono">{{ lastTransition }}</span>
      </div>
    </div>
    <template #controls>
      <label class="field"><input v-model="switchOnIo" type="checkbox" /> SWITCH_ON_IO</label>
      <label class="field"><input v-model="runImmediate" type="checkbox" /> IO_RUN_IMMEDIATE</label>
      <label class="field">{{ t({ en: 'I/O length', zh: 'I/O 时长' }) }} <input v-model.number="ioLength" type="range" min="1" max="8" /> {{ ioLength }}</label>
    </template>
  </LabFrame>
</template>

<style scoped>
.flags {
  font-size: 12px;
  color: var(--muted);
}
.token {
  transition: transform 0.45s var(--ease);
}
.tok-label {
  fill: #fff !important;
  font-size: 10px !important;
  font-weight: 600;
}
.node-label {
  font-size: 11.5px !important;
  fill: var(--muted) !important;
  letter-spacing: 0.04em;
}
.edge-labels text {
  font-size: 10px;
  fill: var(--faint);
}
.trace {
  max-height: 260px;
  overflow: auto;
}
td.st-running {
  color: var(--pc);
  font-weight: 600;
}
td.st-blocked {
  color: var(--bad);
}
td.st-done {
  color: var(--faint);
}
</style>
