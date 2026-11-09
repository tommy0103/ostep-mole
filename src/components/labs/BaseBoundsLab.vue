<script setup lang="ts">
import { computed, ref } from 'vue'
import LabFrame from './LabFrame.vue'
import { baseBounds } from '@/lib/sim/memory'
import { t, uiLang, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

const KB = 1024
const va = ref(128) // bytes; book example "load 128" → 32896
const base = ref(32 * KB)
const bounds = ref(16 * KB)
const r = computed(() => baseBounds(va.value, base.value, bounds.value))
const VMAX = 20 * KB // show addresses past the bounds to provoke a fault
const PMAX = 64 * KB
const vy = (v: number) => 30 + (v / VMAX) * 330
const py = (p: number) => 30 + (p / PMAX) * 330
const kb = (n: number) => (n % KB === 0 ? `${n / KB}KB` : `${n}`)
const presets = [
  { label: { en: 'Book: load 128', zh: '书中：load 128' }, va: 128 },
  { label: { en: 'Stack top', zh: '栈顶' }, va: 15 * KB },
  { label: { en: 'Out of bounds', zh: '越界' }, va: 17 * KB },
]
</script>

<template>
  <LabFrame :title="title" name="base-bounds"
    :hint="{ en: 'Every load and store goes through the MMU: one comparison, one addition. Move the base (what the OS does on a context switch or when relocating) and watch the program not notice.', zh: '每一次读写都经过 MMU：一次比较、一次加法。移动基址（操作系统在上下文切换或重定位时会这么做），观察程序毫无察觉。' }">
    <div class="lab-row">
      <div class="seg">
        <button v-for="p in presets" :key="p.va" :aria-pressed="va === p.va" @click="va = p.va">{{ t(p.label) }}</button>
      </div>
    </div>
    <svg class="viz" viewBox="0 0 640 380" role="img" :aria-label="t({ en: 'base and bounds translation', zh: '基址与界限转换' })">
      <!-- virtual -->
      <text x="20" y="18" class="ttl">{{ t({ en: 'virtual address space', zh: '虚拟地址空间' }) }}</text>
      <rect x="20" :y="vy(0)" width="110" :height="vy(1 * KB) - vy(0)" fill="var(--p4)" opacity="0.85" />
      <rect x="20" :y="vy(1 * KB)" width="110" :height="vy(3 * KB) - vy(1 * KB)" fill="var(--p2)" opacity="0.85" />
      <rect x="20" :y="vy(3 * KB)" width="110" :height="vy(14 * KB) - vy(3 * KB)" fill="var(--bg-sunk)" />
      <rect x="20" :y="vy(14 * KB)" width="110" :height="vy(16 * KB) - vy(14 * KB)" fill="var(--p1)" opacity="0.85" />
      <rect x="20" :y="vy(16 * KB)" width="110" :height="vy(VMAX) - vy(16 * KB)" fill="none" stroke="var(--bad)" stroke-dasharray="3 3" />
      <text x="75" :y="vy(18 * KB)" text-anchor="middle" class="bad">{{ t({ en: 'not yours', zh: '不属于你' }) }}</text>
      <text x="136" :y="vy(0) + 4" class="ax">0</text>
      <text x="136" :y="vy(bounds) + 4" class="ax">{{ kb(bounds) }}</text>
      <line x1="16" x2="134" :y1="vy(Math.min(va, VMAX))" :y2="vy(Math.min(va, VMAX))" stroke="var(--ink)" stroke-width="2" class="mv" />
      <!-- MMU -->
      <g transform="translate(220 120)">
        <rect width="190" height="130" rx="8" fill="var(--bg)" stroke="var(--rule-strong)" />
        <text x="95" y="-8" text-anchor="middle" class="ttl">MMU</text>
        <text x="14" y="28" class="reg">base   = {{ kb(base) }}</text>
        <text x="14" y="48" class="reg">bounds = {{ kb(bounds) }}</text>
        <rect x="12" y="62" width="166" height="26" rx="4" :fill="r.ok ? 'var(--accent-soft)' : 'color-mix(in srgb, var(--bad) 18%, transparent)'" />
        <text x="95" y="80" text-anchor="middle" class="reg">{{ va }} &lt; {{ bounds }} ? {{ r.ok ? '✓' : '✗' }}</text>
        <text x="95" y="114" text-anchor="middle" class="reg big">{{ r.ok ? `+ ${base}` : 'EXCEPTION' }}</text>
      </g>
      <path :d="`M 134 ${vy(Math.min(va, VMAX))} C 180 ${vy(Math.min(va, VMAX))}, 180 185, 220 185`" fill="none" stroke="var(--ink)" stroke-width="1.3" class="mv" />
      <path v-if="r.ok" :d="`M 410 185 C 450 185, 450 ${py(r.pa)}, 500 ${py(r.pa)}`" fill="none" stroke="var(--accent)" stroke-width="1.6" class="mv" />
      <!-- physical -->
      <text x="500" y="18" class="ttl">{{ t({ en: 'physical memory', zh: '物理内存' }) }}</text>
      <rect x="500" :y="py(0)" width="110" :height="py(PMAX) - py(0)" fill="var(--bg-sunk)" />
      <rect x="500" :y="py(0)" width="110" :height="py(16 * KB) - py(0)" fill="var(--ink-2)" opacity="0.8" />
      <text x="555" :y="py(8 * KB) + 4" text-anchor="middle" class="in">OS</text>
      <rect x="500" :y="py(base)" width="110" :height="py(base + bounds) - py(base)" fill="var(--accent)" opacity="0.25" stroke="var(--accent)" class="mv" />
      <text x="555" :y="py(base + bounds / 2) + 4" text-anchor="middle" class="ax mv">{{ t({ en: 'relocated process', zh: '重定位后的进程' }) }}</text>
      <text x="614" :y="py(base) + 4" class="ax">{{ kb(base) }}</text>
      <text x="614" :y="py(PMAX) + 4" class="ax">64KB</text>
      <circle v-if="r.ok" cx="500" :cy="py(r.pa)" r="4" fill="var(--accent)" class="mv" />
    </svg>
    <div class="lab-grid two">
      <div class="lab-grid">
        <label class="field">{{ t({ en: 'virtual address', zh: '虚拟地址' }) }} <input v-model.number="va" type="range" min="0" :max="VMAX - 1" step="64" /> <span class="mono">{{ va }}</span></label>
        <label class="field">base <input v-model.number="base" type="range" :min="16 * KB" :max="48 * KB" :step="KB" /> <span class="mono">{{ kb(base) }}</span></label>
        <label class="field">bounds <input v-model.number="bounds" type="range" :min="4 * KB" :max="16 * KB" :step="KB" /> <span class="mono">{{ kb(bounds) }}</span></label>
      </div>
      <ol class="steps">
        <li v-for="s in r.steps" :key="s.id" :class="s.id">{{ s[uiLang] }}</li>
      </ol>
    </div>
  </LabFrame>
</template>

<style scoped>
.ttl {
  font-size: 11px !important;
  fill: var(--muted) !important;
}
.ax {
  font-size: 9.5px !important;
  fill: var(--faint) !important;
}
.in {
  fill: #fff !important;
  font-size: 11px !important;
}
.bad {
  fill: var(--bad) !important;
  font-size: 10px !important;
}
.reg {
  font-size: 12px !important;
  fill: var(--ink) !important;
  white-space: pre;
}
.big {
  font-size: 15px !important;
  font-weight: 600;
}
.mv {
  transition: all 0.35s var(--ease);
}
.steps {
  margin: 0;
  padding-left: 1.2em;
  font-size: 13.5px;
  display: grid;
  gap: 4px;
}
.steps .fault {
  color: var(--bad);
}
.steps .add {
  color: var(--accent-ink);
}
</style>
