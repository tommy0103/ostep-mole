<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { simulateCache, hitCurve, BELADY, type ReplPolicy } from '@/lib/sim/caching'
import { rng } from '@/lib/sim/rng'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

const POLICIES: ReplPolicy[] = ['OPT', 'LRU', 'CLOCK', 'FIFO', 'RANDOM']
const COLOR: Record<ReplPolicy, string> = { OPT: 'var(--ink)', LRU: 'var(--p0)', CLOCK: 'var(--p2)', FIFO: 'var(--p1)', RANDOM: 'var(--p3)' }

function eightyTwenty(n: number, seed: number) {
  const r = rng(seed)
  return Array.from({ length: n }, () => (r() < 0.8 ? Math.floor(r() * 2) : 2 + Math.floor(r() * 8)))
}
const WORKLOADS: { id: string; label: Bi; refs: number[]; size: number; note: Bi }[] = [
  { id: 'book', label: { en: 'Book example', zh: '书中例子' }, refs: [0, 1, 2, 0, 1, 3, 0, 3, 1, 2, 1], size: 3, note: { en: 'Figures 22.1–22.6: OPT gets 6 hits, LRU 6, FIFO 4.', zh: '图 22.1–22.6：OPT 命中 6 次，LRU 6 次，FIFO 4 次。' } },
  { id: 'belady', label: { en: 'Belady’s anomaly', zh: 'Belady 异常' }, refs: BELADY, size: 4, note: { en: 'With FIFO, 4 frames give fewer hits than 3. Look at the FIFO curve dip below.', zh: '在 FIFO 下，4 个帧的命中次数反而比 3 个帧少。看下面 FIFO 曲线的下凹。' } },
  { id: 'loop', label: { en: 'Looping', zh: '循环访问' }, refs: Array.from({ length: 24 }, (_, i) => i % 6), size: 5, note: { en: 'Looping over 6 pages with 5 frames: LRU and FIFO miss every time; RANDOM does better.', zh: '用 5 个帧循环访问 6 个页：LRU 和 FIFO 每次都未命中；RANDOM 反而更好。' } },
  { id: '8020', label: { en: '80-20', zh: '80-20' }, refs: eightyTwenty(24, 5), size: 3, note: { en: '80% of references go to 20% of pages: history pays off.', zh: '80% 的访问落在 20% 的页上：历史信息派上了用场。' } },
]
const wl = ref(WORKLOADS[0])
const size = ref(wl.value.size)
watch(wl, (w) => (size.value = w.size))
const runs = computed(() => Object.fromEntries(POLICIES.map((p) => [p, simulateCache(wl.value.refs, size.value, p)])) as Record<ReplPolicy, ReturnType<typeof simulateCache>>)
const duration = computed(() => wl.value.refs.length)
const player = usePlayer(duration, { speed: 2.2 })
watch([wl, size], () => player.reset())
const k = computed(() => Math.min(wl.value.refs.length, Math.floor(player.t.value)))
const hitsAt = (p: ReplPolicy) => runs.value[p].slice(0, k.value).filter((s) => s.hit).length

const curves = computed(() => Object.fromEntries(POLICIES.map((p) => [p, hitCurve(wl.value.refs, p, 6)])) as Record<ReplPolicy, number[]>)
const CW = 300
const CH = 150
const cx = (i: number) => 30 + (i / 5) * (CW - 40)
const cy = (v: number) => 10 + (1 - v) * (CH - 34)
const cpath = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${cx(i)} ${cy(v)}`).join(' ')
</script>

<template>
  <LabFrame :title="title" name="replacement" :player="player" :duration="duration">
    <div class="lab-grid">
      <div class="lab-row">
        <div class="seg">
          <button v-for="w in WORKLOADS" :key="w.id" :aria-pressed="wl.id === w.id" @click="wl = w">{{ t(w.label) }}</button>
        </div>
        <label class="field">{{ t({ en: 'frames', zh: '帧数' }) }} <input v-model.number="size" type="range" min="1" max="6" /> {{ size }}</label>
      </div>
      <p class="caption-line">{{ t(wl.note) }}</p>
      <div class="grid-wrap">
        <table class="refs mono">
          <thead>
            <tr>
              <th />
              <th v-for="(r, i) in wl.refs" :key="i" :class="{ cur: i === k - 1, future: i >= k }">{{ r }}</th>
              <th class="hits">hits</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in POLICIES" :key="p">
              <td class="pname" :style="{ color: COLOR[p] }">{{ p }}</td>
              <td v-for="(s, i) in runs[p]" :key="i" :class="{ cur: i === k - 1, future: i >= k }">
                <template v-if="i < k">
                  <span class="cell" :class="s.hit ? 'h' : 'm'">
                    <span v-for="(slot, j) in s.slots" :key="j" class="slot" :class="{ new: !s.hit && slot === s.ref }">{{ slot ?? '·' }}</span>
                  </span>
                  <span v-if="s.evicted !== null" class="ev">−{{ s.evicted }}</span>
                </template>
              </td>
              <td class="hits">{{ hitsAt(p) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="lab-grid two">
        <svg class="viz" :viewBox="`0 0 ${CW} ${CH}`" role="img" :aria-label="t({ en: 'hit rate vs cache size', zh: '命中率与缓存大小' })">
          <g class="axis">
            <line x1="30" :x2="CW - 10" :y1="cy(0)" :y2="cy(0)" />
            <text v-for="i in 6" :key="i" :x="cx(i - 1)" :y="CH - 10" text-anchor="middle">{{ i }}</text>
            <text x="24" :y="cy(1) + 3" text-anchor="end">100%</text>
            <text x="24" :y="cy(0) + 3" text-anchor="end">0</text>
            <text :x="CW - 10" :y="CH" text-anchor="end">{{ t({ en: 'frames', zh: '帧数' }) }}</text>
          </g>
          <line :x1="cx(size - 1)" :x2="cx(size - 1)" :y1="cy(1)" :y2="cy(0)" stroke="var(--rule-strong)" stroke-dasharray="3 3" />
          <g v-for="p in POLICIES" :key="p">
            <path :d="cpath(curves[p])" fill="none" :stroke="COLOR[p]" stroke-width="1.6" />
            <circle v-for="(v, i) in curves[p]" :key="i" :cx="cx(i)" :cy="cy(v)" r="2.2" :fill="COLOR[p]" />
          </g>
        </svg>
        <div class="lab-grid">
          <div class="lab-label">{{ t({ en: 'hit rate vs. number of frames', zh: '命中率随帧数变化' }) }}</div>
          <div class="legend mono">
            <span v-for="p in POLICIES" :key="p"><i :style="{ background: COLOR[p] }" />{{ p }}</span>
          </div>
          <p class="muted small">{{ t({ en: 'OPT (Belady’s MIN) evicts the page used furthest in the future — unbuildable, but the yardstick for everything else. CLOCK approximates LRU with one use bit per page.', zh: 'OPT（Belady 的 MIN 算法）淘汰在未来最晚才被使用的页——无法实现，却是衡量其他策略的标尺。CLOCK 用每页一个使用位来近似 LRU。' }) }}</p>
        </div>
      </div>
    </div>
  </LabFrame>
</template>

<style scoped>
.grid-wrap {
  overflow-x: auto;
}
.refs {
  border-collapse: collapse;
  font-size: 11.5px;
}
.refs th,
.refs td {
  padding: 3px 4px;
  text-align: center;
  border-bottom: 1px solid var(--rule);
  vertical-align: top;
}
.refs th {
  font-size: 13px;
  color: var(--ink);
}
.refs .future {
  opacity: 0.35;
}
.refs th.cur {
  background: var(--accent);
  color: #fff;
  border-radius: 3px;
}
.pname {
  text-align: left !important;
  font-weight: 600;
  padding-right: 10px !important;
}
.cell {
  display: inline-grid;
  gap: 1px;
  padding: 2px;
  border-radius: 3px;
  min-width: 18px;
}
.cell.h {
  background: color-mix(in srgb, var(--ok) 18%, transparent);
}
.cell.m {
  background: color-mix(in srgb, var(--bad) 12%, transparent);
}
.slot {
  display: block;
  line-height: 1.25;
  color: var(--ink-2);
}
.slot.new {
  color: var(--bad);
  font-weight: 700;
}
.ev {
  display: block;
  font-size: 9.5px;
  color: var(--faint);
}
.hits {
  font-weight: 600;
  padding-left: 10px !important;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11.5px;
}
.legend i {
  display: inline-block;
  width: 12px;
  height: 3px;
  margin-right: 4px;
  vertical-align: middle;
}
.small {
  font-size: 13px;
  margin: 0;
}
</style>
