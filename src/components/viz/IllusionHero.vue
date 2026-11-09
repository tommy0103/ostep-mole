<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { t } from '@/lib/i18n'

/**
 * The thesis of Part I in one picture.
 *  CPU:    one physical timeline is sliced among A, B, C; each process's *virtual* CPU only
 *          sees its own progress. Shrink the slice and the gaps vanish — the illusion appears.
 *  Memory: each process sees a tidy contiguous address space; physically its pages are scattered.
 */
const view = ref<'cpu' | 'mem'>('cpu')
const slice = ref(1.2) // seconds of animation time per slice (log slider)
const now = ref(0)
let raf = 0
let last = 0
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function frame(ts: number) {
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0
  last = ts
  now.value += dt
  raf = requestAnimationFrame(frame)
}
onMounted(() => {
  if (reduced) now.value = 6
  else raf = requestAnimationFrame(frame)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))

const W = 640
const WINDOW = 8 // seconds visible
const procs = ['A', 'B', 'C']
const pxPerSec = W / WINDOW

/** Physical CPU slices visible in the window ending at `now`. */
const physSlices = computed(() => {
  const s = slice.value
  const end = now.value
  const start = end - WINDOW
  const out: { p: number; x: number; w: number }[] = []
  const first = Math.floor(Math.max(0, start) / s)
  for (let k = first; k * s < end; k++) {
    const a = Math.max(k * s, start, 0)
    const b = Math.min((k + 1) * s, end)
    if (b <= a) continue
    out.push({ p: k % 3, x: (a - start) * pxPerSec, w: (b - a) * pxPerSec })
  }
  return out
})
/** Fraction of its own work each process has done — the same for all, at 1/3 speed. */
const progress = computed(() => procs.map((_, i) => {
  const s = slice.value
  const full = Math.floor(now.value / (3 * s))
  const within = now.value - full * 3 * s
  const mine = Math.min(s, Math.max(0, within - i * s))
  return full * s + mine
}))
const sliceLabel = computed(() => (slice.value >= 0.5 ? `${(slice.value * 100).toFixed(0)} ms` : `${(slice.value * 100).toFixed(1)} ms`))

// memory view: 3 processes × 4 pages, scattered across 16 frames
const frames = [9, 2, 14, 5, 0, 11, 7, 13, 3, 15, 6, 10]
const pageNames = ['code', 'heap', '…', 'stack']
const hover = ref<number | null>(null)
const memPhase = computed(() => (Math.sin(now.value * 0.6) + 1) / 2)
</script>

<template>
  <div class="hero">
    <div class="tabs seg" role="group">
      <button :aria-pressed="view === 'cpu'" @click="view = 'cpu'">CPU</button>
      <button :aria-pressed="view === 'mem'" @click="view = 'mem'">{{ t({ en: 'Memory', zh: '内存' }) }}</button>
    </div>

    <svg v-if="view === 'cpu'" class="viz" :viewBox="`0 0 ${W} 250`" role="img" :aria-label="t({ en: 'time sharing animation', zh: '时分共享动画' })">
      <text x="0" y="14" class="lbl">{{ t({ en: 'physical CPU (what really happens)', zh: '物理 CPU（真实发生的事）' }) }}</text>
      <rect x="0" y="22" :width="W" height="30" rx="4" fill="var(--bg-sunk)" />
      <rect v-for="(s, i) in physSlices" :key="i" :x="s.x" y="22" :width="Math.max(0.6, s.w - (slice > 0.15 ? 1 : 0))" height="30" :fill="`var(--p${s.p})`" />
      <g v-for="(p, i) in procs" :key="p">
        <text x="0" :y="94 + i * 52" class="lbl">{{ t({ en: `virtual CPU of process ${p} (what ${p} believes)`, zh: `进程 ${p} 的虚拟 CPU（${p} 以为的样子）` }) }}</text>
        <rect x="0" :y="102 + i * 52" :width="W" height="16" rx="3" fill="var(--bg-sunk)" />
        <rect x="0" :y="102 + i * 52" :width="(progress[i] * pxPerSec) % W" height="16" rx="3" :fill="`var(--p${i})`" opacity="0.9" />
      </g>
      <line :x1="W" :x2="W" y1="18" y2="56" stroke="var(--ink)" stroke-width="1.5" />
    </svg>

    <svg v-else class="viz" viewBox="0 0 640 280" role="img" :aria-label="t({ en: 'address spaces mapped to physical memory', zh: '地址空间映射到物理内存' })">
      <text x="0" y="14" class="lbl">{{ t({ en: 'virtual address spaces (what each process sees)', zh: '虚拟地址空间（每个进程看到的）' }) }}</text>
      <text x="470" y="14" class="lbl">{{ t({ en: 'physical memory', zh: '物理内存' }) }}</text>
      <g v-for="p in 3" :key="p" @mouseenter="hover = p - 1" @mouseleave="hover = null" :opacity="hover === null || hover === p - 1 ? 1 : 0.25" class="proc">
        <text :x="10 + (p - 1) * 125" y="40" class="pname">{{ procs[p - 1] }} · 0 KB</text>
        <g v-for="(name, k) in pageNames" :key="k">
          <rect :x="10 + (p - 1) * 125" :y="48 + k * 52" width="96" height="46" rx="3" :fill="name === '…' ? 'var(--bg-sunk)' : `var(--p${p - 1})`" :opacity="name === '…' ? 1 : 0.85" />
          <text :x="58 + (p - 1) * 125" :y="76 + k * 52" text-anchor="middle" class="pg">{{ name }}</text>
          <path
            v-if="name !== '…'"
            :d="`M ${106 + (p - 1) * 125} ${71 + k * 52} C ${330 + memPhase * 30} ${71 + k * 52}, ${380 - memPhase * 30} ${36 + frames[(p - 1) * 4 + k] * 15}, 468 ${36 + frames[(p - 1) * 4 + k] * 15}`"
            fill="none"
            :stroke="`var(--p${p - 1})`"
            stroke-width="1.2"
            opacity="0.55"
          />
        </g>
      </g>
      <g v-for="f in 16" :key="f">
        <rect x="470" :y="29 + (f - 1) * 15" width="160" height="14" :fill="frames.indexOf(f - 1) >= 0 && pageNames[frames.indexOf(f - 1) % 4] !== '…' ? `var(--p${Math.floor(frames.indexOf(f - 1) / 4)})` : 'var(--bg-sunk)'" :opacity="hover === null || Math.floor(frames.indexOf(f - 1) / 4) === hover ? 0.85 : 0.2" />
        <text x="636" :y="40 + (f - 1) * 15" class="fr">{{ f - 1 }}</text>
      </g>
    </svg>

    <div v-if="view === 'cpu'" class="ctl">
      <label class="field">
        {{ t({ en: 'time slice', zh: '时间片' }) }}
        <input type="range" min="-3.3" max="0.6" step="0.01" :value="Math.log(slice)" @input="slice = Math.exp(+($event.target as HTMLInputElement).value)" />
        <span class="mono">{{ sliceLabel }}</span>
      </label>
      <span class="muted say">{{ slice > 0.3 ? t({ en: '← shrink the slice: the stutter disappears.', zh: '← 缩短时间片：卡顿就消失了。' }) : t({ en: 'Each process now seems to own a (slower) CPU.', zh: '现在每个进程都像独占了一颗（慢一些的）CPU。' }) }}</span>
    </div>
    <div v-else class="ctl">
      <span class="muted say">{{ t({ en: 'Hover a process: contiguous to it, scattered in reality.', zh: '把鼠标移到某个进程上：它眼中是连续的，现实中却是分散的。' }) }}</span>
    </div>
  </div>
</template>

<style scoped>
.hero {
  display: grid;
  gap: 12px;
}
.tabs {
  justify-self: start;
}
.lbl {
  font-size: 11px !important;
  fill: var(--muted) !important;
}
.pname {
  font-size: 11px !important;
  fill: var(--ink-2) !important;
}
.pg {
  fill: #fff !important;
  font-size: 11px !important;
}
.fr {
  fill: var(--faint) !important;
  font-size: 9px !important;
}
.proc {
  transition: opacity 0.25s;
  cursor: default;
}
.ctl {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  min-height: 32px;
}
.say {
  font-size: 13px;
}
</style>
