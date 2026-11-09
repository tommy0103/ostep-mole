<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

/** Figures 21.2 & 21.3 as a flow chart; each scenario lights up a path through it. */
interface Node {
  id: string
  x: number
  y: number
  label: Bi
  who: 'hw' | 'os'
  /** cost in nanoseconds when this node is executed */
  ns: number
}
const NODES: Node[] = [
  { id: 'tlb', x: 20, y: 20, label: { en: 'TLB lookup', zh: '查 TLB' }, who: 'hw', ns: 1 },
  { id: 'hit', x: 20, y: 100, label: { en: 'hit: access memory', zh: '命中：访问内存' }, who: 'hw', ns: 100 },
  { id: 'walk', x: 230, y: 20, label: { en: 'miss: walk page table', zh: '未命中：遍历页表' }, who: 'hw', ns: 100 },
  { id: 'segv', x: 230, y: 100, label: { en: 'invalid: SEGFAULT', zh: '无效：段错误' }, who: 'os', ns: 0 },
  { id: 'insert', x: 440, y: 20, label: { en: 'present: insert into TLB, retry', zh: '在内存中：插入 TLB，重试' }, who: 'hw', ns: 1 },
  { id: 'fault', x: 440, y: 100, label: { en: 'not present: PAGE FAULT', zh: '不在内存：缺页' }, who: 'hw', ns: 1000 },
  { id: 'free', x: 440, y: 180, label: { en: 'OS: find a free frame', zh: '操作系统：找空闲帧' }, who: 'os', ns: 500 },
  { id: 'evict', x: 230, y: 180, label: { en: 'none: evict a page (policy!)', zh: '没有：淘汰一页（策略！）' }, who: 'os', ns: 500 },
  { id: 'write', x: 20, y: 180, label: { en: 'dirty? write it to swap', zh: '脏页？写回交换区' }, who: 'os', ns: 10_000_000 },
  { id: 'read', x: 230, y: 260, label: { en: 'read page from swap (I/O)', zh: '从交换区读入页（I/O）' }, who: 'os', ns: 10_000_000 },
  { id: 'update', x: 440, y: 260, label: { en: 'set present bit & PFN, retry', zh: '设置存在位与 PFN，重试' }, who: 'os', ns: 200 },
]
/** hand-routed so no edge crosses a box */
const EDGES: [string, string, string][] = [
  ['tlb', 'hit', 'M110 64 V100'],
  ['tlb', 'walk', 'M200 42 H230'],
  ['walk', 'segv', 'M320 64 V100'],
  ['walk', 'insert', 'M410 42 H440'],
  ['walk', 'fault', 'M410 56 H425 V122 H440'],
  ['fault', 'free', 'M530 144 V180'],
  ['free', 'evict', 'M440 202 H410'],
  ['evict', 'write', 'M230 202 H200'],
  ['free', 'read', 'M470 224 V242 H380 V260'],
  ['write', 'read', 'M110 224 V282 H230'],
  ['evict', 'read', 'M320 224 V260'],
  ['read', 'update', 'M410 282 H440'],
  ['insert', 'tlb', 'M560 20 V9 H120 V20'],
  ['update', 'tlb', 'M620 282 H632 V3 H100 V20'],
]
const SCEN: { id: string; label: Bi; path: string[] }[] = [
  { id: 'hit', label: { en: 'TLB hit', zh: 'TLB 命中' }, path: ['tlb', 'hit'] },
  { id: 'miss', label: { en: 'TLB miss, page in memory', zh: 'TLB 未命中，页在内存中' }, path: ['tlb', 'walk', 'insert', 'tlb', 'hit'] },
  { id: 'fault', label: { en: 'page fault, free frame', zh: '缺页，有空闲帧' }, path: ['tlb', 'walk', 'fault', 'free', 'read', 'update', 'tlb', 'walk', 'insert', 'tlb', 'hit'] },
  { id: 'evict', label: { en: 'page fault, memory full, dirty victim', zh: '缺页，内存已满，牺牲页是脏的' }, path: ['tlb', 'walk', 'fault', 'free', 'evict', 'write', 'read', 'update', 'tlb', 'walk', 'insert', 'tlb', 'hit'] },
  { id: 'segv', label: { en: 'invalid address', zh: '非法地址' }, path: ['tlb', 'walk', 'segv'] },
]
const scen = ref(SCEN[2])
const duration = computed(() => scen.value.path.length)
const player = usePlayer(duration, { speed: 1.3 })
watch(scen, () => {
  player.reset()
  player.play()
})
const k = computed(() => Math.min(scen.value.path.length, Math.ceil(player.t.value)))
const visited = computed(() => scen.value.path.slice(0, k.value))
const node = (id: string) => NODES.find((n) => n.id === id)!
const curId = computed(() => visited.value[visited.value.length - 1])
const totalNs = computed(() => visited.value.reduce((s, id) => s + node(id).ns, 0))
const edgeOn = (a: string, b: string) => visited.value.some((id, i) => i > 0 && visited.value[i - 1] === a && id === b)
const fmtTime = (ns: number) => (ns >= 1e6 ? `${(ns / 1e6).toFixed(1)} ms` : ns >= 1e3 ? `${(ns / 1e3).toFixed(1)} µs` : `${ns} ns`)
const BW = 180
const BH = 44
const logW = computed(() => Math.max(2, (Math.log10(Math.max(1, totalNs.value)) / 8) * 100))
</script>

<template>
  <LabFrame :title="title" name="page-fault" :player="player" :duration="duration"
    :hint="{ en: 'Times are rough orders of magnitude. The bar is logarithmic — a page fault that goes to disk is ~100,000× slower than a TLB hit.', zh: '时间只是粗略的数量级。进度条是对数刻度——需要访问磁盘的缺页比 TLB 命中慢约十万倍。' }">
    <div class="lab-row">
      <div class="seg wrap">
        <button v-for="s in SCEN" :key="s.id" :aria-pressed="scen.id === s.id" @click="scen = s">{{ t(s.label) }}</button>
      </div>
    </div>
    <svg class="viz" viewBox="0 -4 650 314" role="img" :aria-label="t({ en: 'page fault control flow', zh: '缺页控制流程' })">
      <defs>
        <marker id="pf-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke" /></marker>
      </defs>
      <path v-for="([a, b, d], i) in EDGES" :key="i" :d="d" fill="none" :stroke="edgeOn(a, b) ? 'var(--accent)' : 'var(--rule-strong)'" :stroke-width="edgeOn(a, b) ? 2 : 1" :stroke-dasharray="b === 'tlb' ? '4 3' : ''" marker-end="url(#pf-ar)" class="mv" />
      <g v-for="n in NODES" :key="n.id" :transform="`translate(${n.x} ${n.y})`" class="mv">
        <rect :width="BW" :height="BH" rx="6" :fill="n.id === curId ? 'var(--accent)' : visited.includes(n.id) ? 'var(--accent-soft)' : 'var(--bg)'" :stroke="n.who === 'os' ? 'var(--bad)' : 'var(--rule-strong)'" :stroke-dasharray="n.who === 'os' ? '4 3' : ''" />
        <text :x="BW / 2" :y="BH / 2 + 4" text-anchor="middle" :class="n.id === curId ? 'on' : 'lbl'">{{ t(n.label) }}</text>
      </g>
    </svg>
    <div class="lab-row">
      <span class="legend mono"><i class="hw" /> {{ t({ en: 'hardware', zh: '硬件' }) }} <i class="os" /> {{ t({ en: 'OS (page-fault handler)', zh: '操作系统（缺页处理程序）' }) }}</span>
    </div>
    <div class="cost">
      <div class="lab-label">{{ t({ en: 'time spent on this one memory access', zh: '这一次内存访问花掉的时间' }) }}</div>
      <div class="track"><div class="fill" :style="{ width: logW + '%' }" /></div>
      <div class="mono total">{{ fmtTime(totalNs) }}</div>
    </div>
  </LabFrame>
</template>

<style scoped>
.wrap {
  flex-wrap: wrap;
}
.lbl {
  font-size: 11px !important;
  fill: var(--ink-2) !important;
  font-family: var(--font-sans);
}
.on {
  font-size: 11px !important;
  fill: #fff !important;
  font-weight: 600;
  font-family: var(--font-sans);
}
.mv {
  transition: all 0.3s var(--ease);
}
.legend {
  font-size: 11.5px;
  color: var(--muted);
  display: inline-flex;
  gap: 8px;
  align-items: center;
}
.legend i {
  width: 14px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}
.legend .hw {
  border: 1px solid var(--rule-strong);
}
.legend .os {
  border: 1px dashed var(--bad);
}
.cost {
  margin-top: 10px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
}
@media (max-width: 640px) {
  .cost {
    grid-template-columns: 1fr;
  }
}
.track {
  height: 10px;
  border-radius: 5px;
  background: var(--bg-sunk);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, var(--ok), var(--warn), var(--bad));
  transition: width 0.4s var(--ease);
}
.total {
  font-size: 15px;
  min-width: 6em;
  text-align: right;
}
</style>
