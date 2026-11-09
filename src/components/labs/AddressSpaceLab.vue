<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import LabFrame from './LabFrame.vue'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

/** Figure 13.2: 512KB of physical memory, three 64KB slots in use by A, B and C. */
const PROCS = [
  { id: 'A', base: 320 },
  { id: 'B', base: 192 },
  { id: 'C', base: 128 },
]
const current = ref(0)
const auto = ref(true)
let timer = 0
onMounted(() => {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!reduced) timer = window.setInterval(() => auto.value && (current.value = (current.value + 1) % 3), 2600)
})
onBeforeUnmount(() => clearInterval(timer))
function choose(i: number) {
  auto.value = false
  current.value = i
}
const va = ref(14) // KB within the 16KB address space
const p = computed(() => PROCS[current.value])
const pa = computed(() => p.value.base + va.value)

// geometry: physical memory column 0..512KB mapped to y 20..420
const PY = (kb: number) => 20 + (kb / 512) * 400
// virtual address space 0..16KB shown large on the left: y 60..380
const VY = (kb: number) => 60 + (kb / 16) * 320
const segments = [
  { name: 'code', from: 0, to: 1, color: 'var(--p4)' },
  { name: 'heap', from: 1, to: 3, color: 'var(--p2)' },
  { name: '(free)', from: 3, to: 14, color: 'none' },
  { name: 'stack', from: 14, to: 16, color: 'var(--p1)' },
]
const slots = [
  { from: 0, to: 64, label: 'OS', kind: 'os' },
  { from: 64, to: 128, label: '(free)', kind: 'free' },
  { from: 128, to: 192, label: 'C', kind: 'proc' },
  { from: 192, to: 256, label: 'B', kind: 'proc' },
  { from: 256, to: 320, label: '(free)', kind: 'free' },
  { from: 320, to: 384, label: 'A', kind: 'proc' },
  { from: 384, to: 448, label: '(free)', kind: 'free' },
  { from: 448, to: 512, label: '(free)', kind: 'free' },
]
const slotIdx = (label: string) => PROCS.findIndex((x) => x.id === label)
</script>

<template>
  <LabFrame :title="title" name="address-space"
    :hint="{ en: 'Each process believes its memory starts at 0 KB. Only the OS (and the hardware) know where it really lives — Figure 13.2, animated.', zh: '每个进程都以为自己的内存从 0 KB 开始。只有操作系统（和硬件）知道它实际在哪里——动起来的图 13.2。' }">
    <div class="lab-row">
      <span class="lab-label">{{ t({ en: 'running process', zh: '正在运行' }) }}</span>
      <div class="seg">
        <button v-for="(pr, i) in PROCS" :key="pr.id" :aria-pressed="current === i" @click="choose(i)">{{ pr.id }}</button>
      </div>
      <label class="field"><input v-model="auto" type="checkbox" /> {{ t({ en: 'context-switch automatically', zh: '自动上下文切换' }) }}</label>
    </div>
    <svg class="viz" viewBox="0 0 640 440" role="img" :aria-label="t({ en: 'virtual to physical mapping', zh: '虚拟到物理的映射' })">
      <!-- virtual address space -->
      <text x="20" y="44" class="ttl">{{ t({ en: `process ${p.id}'s view`, zh: `进程 ${p.id} 眼中的内存` }) }}</text>
      <g>
        <rect v-for="s in segments" :key="s.name" x="20" :y="VY(s.from)" width="150" :height="VY(s.to) - VY(s.from)" :fill="s.color === 'none' ? 'var(--bg-sunk)' : s.color" :opacity="s.color === 'none' ? 1 : 0.85" stroke="var(--bg)" />
        <text v-for="s in segments" :key="'l' + s.name" x="95" :y="(VY(s.from) + VY(s.to)) / 2 + 4" text-anchor="middle" :class="s.color === 'none' ? 'free' : 'in'">{{ s.name }}</text>
        <text x="176" :y="VY(0) + 4" class="ax">0 KB</text>
        <text x="176" :y="VY(16) + 4" class="ax">16 KB</text>
      </g>
      <!-- probe -->
      <line x1="10" x2="170" :y1="VY(va)" :y2="VY(va)" stroke="var(--ink)" stroke-width="1.5" />
      <circle cx="170" :cy="VY(va)" r="3.5" fill="var(--ink)" />
      <text x="8" :y="VY(va) - 4" class="probe">{{ va }} KB</text>

      <!-- mapping band -->
      <path
        class="band"
        :d="`M 170 ${VY(0)} C 330 ${VY(0)}, 330 ${PY(p.base)}, 430 ${PY(p.base)} L 430 ${PY(p.base + 64)} C 330 ${PY(p.base + 64)}, 330 ${VY(16)}, 170 ${VY(16)} Z`"
        :fill="`var(--p${current})`"
        opacity="0.12"
      />
      <path class="band" :d="`M 170 ${VY(va)} C 330 ${VY(va)}, 330 ${PY(pa)}, 430 ${PY(pa)}`" fill="none" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="3 3" />

      <!-- physical memory -->
      <text x="430" y="14" class="ttl">{{ t({ en: 'physical memory (the truth)', zh: '物理内存（真相）' }) }}</text>
      <g v-for="s in slots" :key="s.from">
        <rect x="430" :y="PY(s.from)" width="150" :height="PY(s.to) - PY(s.from)" :fill="s.kind === 'os' ? 'var(--ink-2)' : s.kind === 'free' ? 'var(--bg-sunk)' : `var(--p${slotIdx(s.label)})`" :opacity="s.kind === 'proc' ? (slotIdx(s.label) === current ? 0.95 : 0.35) : 1" stroke="var(--bg)" class="slot" />
        <text x="505" :y="(PY(s.from) + PY(s.to)) / 2 + 4" text-anchor="middle" :class="s.kind === 'free' ? 'free' : 'in'">{{ s.label }}</text>
        <text x="586" :y="PY(s.from) + 4" class="ax">{{ s.from }} KB</text>
      </g>
      <text x="586" :y="PY(512) + 4" class="ax">512 KB</text>
      <circle cx="430" :cy="PY(pa)" r="3.5" fill="var(--ink)" class="dot" />
    </svg>
    <div class="lab-row">
      <label class="field">{{ t({ en: 'virtual address', zh: '虚拟地址' }) }} <input v-model.number="va" type="range" min="0" max="15.9" step="0.1" /> <span class="mono">{{ va.toFixed(1) }} KB</span></label>
      <span class="mono eq">→ {{ t({ en: 'physical', zh: '物理地址' }) }} = {{ p.base }} KB + {{ va.toFixed(1) }} KB = <b>{{ pa.toFixed(1) }} KB</b></span>
    </div>
  </LabFrame>
</template>

<style scoped>
.ttl {
  font-size: 11px !important;
  fill: var(--muted) !important;
}
.in {
  fill: #fff !important;
  font-size: 11px !important;
}
.free {
  fill: var(--faint) !important;
  font-size: 10.5px !important;
}
.ax {
  fill: var(--faint) !important;
  font-size: 9.5px !important;
}
.probe {
  font-size: 10px !important;
  fill: var(--ink) !important;
}
.band {
  transition: d 0.7s var(--ease);
}
.slot {
  transition: opacity 0.5s;
}
.dot {
  transition: cy 0.7s var(--ease);
}
.eq b {
  color: var(--accent-ink);
}
</style>
