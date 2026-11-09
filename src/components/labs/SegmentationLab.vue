<script setup lang="ts">
import { computed, ref } from 'vue'
import LabFrame from './LabFrame.vue'
import { segmentTranslate, type Segment } from '@/lib/sim/memory'
import { t, uiLang, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

const KB = 1024
/** Figure 16.3 / 16.4: code at 32K, heap at 34K, stack at 28K growing downward. */
const SEGS: (Segment | undefined)[] = [
  { name: 'Code', base: 32 * KB, size: 2 * KB, growsPositive: true },
  { name: 'Heap', base: 34 * KB, size: 3 * KB, growsPositive: true },
  undefined,
  { name: 'Stack', base: 28 * KB, size: 2 * KB, growsPositive: false },
]
const COLORS = ['var(--p4)', 'var(--p2)', 'var(--faint)', 'var(--p1)']
const va = ref(4200)
const r = computed(() => segmentTranslate(va.value, SEGS as Segment[]))
const bits = computed(() => va.value.toString(2).padStart(14, '0').split(''))
const seg = computed(() => va.value >>> 12)
const presets = [
  { label: { en: 'heap: 4200', zh: '堆：4200' }, va: 4200 },
  { label: { en: 'code: 100', zh: '代码：100' }, va: 100 },
  { label: { en: 'stack: 15KB', zh: '栈：15KB' }, va: 15 * KB },
  { label: { en: 'heap overflow: 7KB', zh: '堆越界：7KB' }, va: 7 * KB },
  { label: { en: 'segment 10', zh: '段 10' }, va: 9 * KB },
]
// geometry
const vy = (v: number) => 30 + (v / (16 * KB)) * 320
const py = (p: number) => 30 + (p / (64 * KB)) * 320
const vRegions = [
  { s: 0, from: 0, to: 2 * KB },
  { s: 1, from: 4 * KB, to: 7 * KB },
  { s: 3, from: 14 * KB, to: 16 * KB },
]
const vy0 = computed(() => vy(va.value))
const pa = computed(() => (r.value.ok ? r.value.pa : null))
</script>

<template>
  <LabFrame :title="title" name="segmentation"
    :hint="{ en: 'The top two bits pick a base/bounds pair; the remaining 12 bits are the offset. The stack segment counts backwards from its base.', zh: '高两位选择一对基址/界限寄存器；其余 12 位是偏移量。栈段从基址向下反向计数。' }">
    <div class="lab-row">
      <div class="seg">
        <button v-for="p in presets" :key="p.va" :aria-pressed="va === p.va" @click="va = p.va">{{ t(p.label) }}</button>
      </div>
    </div>
    <div class="lab-row bitsrow">
      <span class="lab-label">VA {{ va }}</span>
      <span class="bits">
        <span v-for="(b, i) in bits" :key="i" :style="i < 2 ? { background: COLORS[seg], color: '#fff' } : {}">{{ b }}</span>
      </span>
      <span class="mono small">{{ t({ en: 'segment', zh: '段' }) }} {{ bits.slice(0, 2).join('') }} · {{ t({ en: 'offset', zh: '偏移' }) }} {{ va & 0xfff }}</span>
    </div>
    <div class="lab-grid">
      <svg class="viz" viewBox="0 0 520 370" role="img" :aria-label="t({ en: 'segmented address translation', zh: '分段地址转换' })">
        <text x="10" y="18" class="ttl">{{ t({ en: 'virtual (16KB)', zh: '虚拟（16KB）' }) }}</text>
        <rect x="10" :y="vy(0)" width="100" :height="vy(16 * KB) - vy(0)" fill="var(--bg-sunk)" />
        <rect v-for="v in vRegions" :key="v.s" x="10" :y="vy(v.from)" width="100" :height="vy(v.to) - vy(v.from)" :fill="COLORS[v.s]" opacity="0.85" />
        <text v-for="v in vRegions" :key="'t' + v.s" x="60" :y="(vy(v.from) + vy(v.to)) / 2 + 4" text-anchor="middle" class="in">{{ SEGS[v.s]!.name }}</text>
        <text v-for="k in [0, 4, 8, 12, 16]" :key="k" x="114" :y="vy(k * KB) + 4" class="ax">{{ k }}K</text>
        <line x1="6" x2="112" :y1="vy0" :y2="vy0" stroke="var(--ink)" stroke-width="2" class="mv" />

        <text x="200" y="18" class="ttl">{{ t({ en: 'segment registers', zh: '段寄存器' }) }}</text>
        <g v-for="(s, i) in SEGS" :key="i" :transform="`translate(200 ${36 + i * 30})`">
          <rect width="150" height="24" rx="3" :fill="i === seg ? 'var(--accent-soft)' : 'var(--bg)'" :stroke="i === seg ? 'var(--accent)' : 'var(--rule)'" />
          <rect width="5" height="24" :fill="COLORS[i]" />
          <text x="12" y="16" class="reg">{{ i.toString(2).padStart(2, '0') }} {{ s ? `${s.name} ${s.base / KB}K ${s.size / KB}K ${s.growsPositive ? '+' : '−'}` : '—' }}</text>
        </g>
        <path :d="`M 112 ${vy0} C 150 ${vy0}, 160 ${48 + seg * 30}, 200 ${48 + seg * 30}`" fill="none" stroke="var(--ink)" stroke-width="1.2" class="mv" />
        <path v-if="pa !== null" :d="`M 350 ${48 + seg * 30} C 380 ${48 + seg * 30}, 380 ${py(pa)}, 410 ${py(pa)}`" fill="none" stroke="var(--accent)" stroke-width="1.6" class="mv" />
        <text v-else x="360" y="200" class="bad">SEGFAULT</text>

        <text x="410" y="18" class="ttl">{{ t({ en: 'physical (64KB)', zh: '物理（64KB）' }) }}</text>
        <rect x="410" :y="py(0)" width="90" :height="py(64 * KB) - py(0)" fill="var(--bg-sunk)" />
        <rect x="410" :y="py(0)" width="90" :height="py(16 * KB) - py(0)" fill="var(--ink-2)" opacity="0.8" />
        <text x="455" :y="py(8 * KB) + 4" text-anchor="middle" class="in">OS</text>
        <template v-for="(s, i) in SEGS" :key="'p' + i">
          <rect v-if="s" x="410" :y="py(s.growsPositive ? s.base : s.base - s.size)" width="90" :height="py(s.size) - py(0)" :fill="COLORS[i]" opacity="0.85" />
        </template>
        <text v-for="k in [0, 16, 32, 48, 64]" :key="'k' + k" x="504" :y="py(k * KB) + 4" class="ax">{{ k }}K</text>
        <circle v-if="pa !== null" cx="410" :cy="py(pa)" r="4" fill="var(--accent)" class="mv" />
      </svg>
      <div class="lab-grid two">
        <label class="field">VA <input v-model.number="va" type="range" min="0" :max="16 * KB - 1" step="8" /> <span class="mono">{{ va }}</span></label>
        <ol class="steps">
          <li v-for="s in r.steps" :key="s.id" :class="s.id">{{ s[uiLang] }}</li>
        </ol>
        <div v-if="pa !== null" class="stat good"><span class="k">{{ t({ en: 'physical address', zh: '物理地址' }) }}</span><span class="v">{{ pa }}</span></div>
      </div>
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
  font-size: 10.5px !important;
}
.reg {
  font-size: 11px !important;
  fill: var(--ink) !important;
}
.bad {
  fill: var(--bad) !important;
  font-size: 12px !important;
  font-weight: 600;
}
.mv {
  transition: all 0.35s var(--ease);
}
.bitsrow {
  margin: 10px 0 6px;
}
.small {
  font-size: 12px;
  color: var(--muted);
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
