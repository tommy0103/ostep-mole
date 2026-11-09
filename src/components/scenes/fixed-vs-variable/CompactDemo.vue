<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * Compaction in five steps, on the scene's own regions, table and frames: a huge page cannot be
 * placed although frames are free; the kernel picks an aligned group to empty, copies its two
 * pages to free frames at the other end and changes one table entry for each; the group is free
 * and the huge page goes in. A group of 4 frames stands for the 512 of a 2 MiB page.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)
const X = (i: number) => 12 + 21 * i
const ROW = 146

const OBJS = computed(() => [
  { id: 'A', cls: 'p0', slot: 0, size: 2.2, frames: [7, s.value >= 3 ? 13 : 2, 12] },
  { id: 'B', cls: 'p1', slot: 4, size: 1.0003, frames: [4, 9] },
  { id: 'C', cls: 'p2', slot: 7, size: 3.5, frames: [s.value >= 2 ? 15 : 0, 14, 5, 10] },
])
const fill = (size: number, j: number) => Math.min(1, Math.max(0, size - j))
const frames = computed(() => {
  const m = new Map<number, { cls: string; frac: number }>()
  for (const o of OBJS.value) o.frames.forEach((f, j) => m.set(f, { cls: o.cls, frac: fill(o.size, j) }))
  return m
})
/** the table entry that changes at this step */
const changed = (id: string, j: number) => (s.value === 2 && id === 'C' && j === 0) || (s.value === 3 && id === 'A' && j === 1)
const counts = computed(() => (s.value < 2 ? [7, 0, 0] : s.value === 2 ? [5, 1, 0] : s.value === 3 ? [3, 0, 1] : [3, 0, 0]))
const free0 = computed(() => s.value >= 3) // frames 0–3 are one free, aligned run
</script>

<template>
  <svg class="scene-drawing" viewBox="0 0 360 380" role="img" :aria-label="L('Compaction, step by step', '紧凑，分步演示')">
    <defs>
      <marker id="fvd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <pattern id="fvd-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4" height="4" class="hatch-bg" />
        <line x1="0" y1="0" x2="0" y2="4" class="hatch" />
      </pattern>
    </defs>

    <!-- the regions, whose virtual pages never move -->
    <text x="12" y="16" class="tag">{{ L('regions A, B, C: their virtual pages stay put', '区域 A、B、C：虚拟页一直不动') }}</text>
    <g v-for="o in OBJS" :key="o.id">
      <rect v-for="j in o.frames.length" :key="j" :x="X(o.slot + j - 1)" y="24" width="20" height="24" rx="2" class="slot" />
      <rect :x="X(o.slot)" y="24" :width="o.size * 21 - 1" height="24" rx="2" :class="o.cls" />
      <text :x="X(o.slot) + 10" y="40" class="num c on-fill">{{ o.id }}</text>
    </g>

    <!-- the page table -->
    <rect x="8" y="78" width="344" height="44" rx="5" class="box" />
    <text x="16" y="92" class="tag hi">{{ L('page table', '页表') }}</text>
    <text x="344" y="92" class="tag end">{{ L('one entry changes per move', '每搬一页，改一条表项') }}</text>
    <g v-for="o in OBJS" :key="o.id">
      <g v-for="(f, j) in o.frames" :key="j">
        <rect :x="X(o.slot + j)" y="98" width="20" height="18" rx="2" class="cell" :class="{ hot: changed(o.id, j) }" />
        <text :x="X(o.slot + j) + 10" y="111" class="code c">{{ f }}</text>
        <path :d="`M${X(o.slot + j) + 10},116 L${X(f) + 10},${ROW}`" class="link" :class="{ now: changed(o.id, j) }" />
      </g>
    </g>

    <!-- the frames -->
    <g v-for="f in 16" :key="f">
      <rect :x="X(f - 1)" :y="ROW" width="20" height="28" rx="2" class="cell" :class="{ target: s === 1 && (f - 1 === 15 || f - 1 === 13) }" />
      <template v-if="frames.has(f - 1)">
        <rect :x="X(f - 1)" :y="ROW" :width="Math.max(1.5, frames.get(f - 1)!.frac * 20)" height="28" rx="2" :class="frames.get(f - 1)!.cls" />
        <rect :x="X(f - 1) + frames.get(f - 1)!.frac * 20" :y="ROW" :width="20 - frames.get(f - 1)!.frac * 20" height="28" class="tail" />
      </template>
      <text :x="X(f - 1) + 10" y="185" class="num c">{{ f - 1 }}</text>
    </g>
    <!-- the huge page, once it fits -->
    <g class="fade" :class="{ show: s === 4 }">
      <rect :x="X(0)" :y="ROW" width="83" height="28" rx="2" class="p4" />
      <text :x="X(0) + 41.5" y="164" class="num c on-fill">{{ L('huge page', '大页') }}</text>
    </g>
    <!-- the group being emptied -->
    <rect :x="X(0) - 3" :y="ROW - 3" width="89" height="34" rx="4" class="outline warn fade" :class="{ show: s === 1 || s === 2 }" />

    <!-- the copies, along the bottom of the frames -->
    <path :d="`M${X(0) + 10},190 C${X(0) + 30},222 ${X(15) - 10},222 ${X(15) + 10},190`" class="move fade" :class="{ show: s === 2 }" marker-end="url(#fvd-arrow)" />
    <path :d="`M${X(2) + 10},190 C${X(2) + 30},218 ${X(13) - 10},218 ${X(13) + 10},190`" class="move fade" :class="{ show: s === 3 }" marker-end="url(#fvd-arrow)" />
    <text x="180" y="236" class="note c fade" :class="{ show: s === 2 }">{{ L('copy C’s page: frame 0 → 15', '复制 C 的一页：第 0 帧 → 第 15 帧') }}</text>
    <text x="180" y="236" class="note c fade" :class="{ show: s === 3 }">{{ L('copy A’s page: frame 2 → 13', '复制 A 的一页：第 2 帧 → 第 13 帧') }}</text>

    <!-- aligned groups of 4 frames -->
    <g v-for="g in 4" :key="g">
      <path
        :d="`M${X((g - 1) * 4)},190 L${X((g - 1) * 4)},193 L${X((g - 1) * 4 + 3) + 20},193 L${X((g - 1) * 4 + 3) + 20},190`"
        class="bracket"
        :class="{ fade: true, show: s < 2 || (g === 1 && s >= 3) }"
      />
      <text :x="X((g - 1) * 4) + 41" y="206" class="bad-text c fade" :class="{ show: s < 2 || (g > 1 && s >= 3) }">✕</text>
    </g>
    <text :x="X(0) + 41" y="206" class="ok-text c fade" :class="{ show: s >= 3 }">✓</text>
    <text x="180" y="236" class="note c fade" :class="{ show: s === 0 }">{{ L('7 frames free, but no aligned run of 4', '7 帧空闲，却没有对齐的连续 4 帧') }}</text>
    <text x="180" y="236" class="note c fade" :class="{ show: s === 4 }">{{ L('the huge page takes frames 0–3', '大页放进了第 0–3 帧') }}</text>
    <text x="180" y="236" class="note c fade" :class="{ show: s === 1 }">{{ L('empty frames 0–3 into free frames at the far end', '腾空第 0–3 帧，页搬到另一端的空闲帧') }}</text>

    <!-- buddy counts -->
    <text x="12" y="258" class="tag hi">{{ L('free blocks per order', '每一阶的空闲块数') }}</text>
    <g v-for="(n, i) in counts" :key="i">
      <text :x="60 + i * 110" y="282" class="big c" :class="{ up: i === 2 && n > 0 }">{{ n }}</text>
      <text :x="60 + i * 110" y="298" class="tag c">{{ L(`order ${i}`, `${i} 阶`) }} · {{ [L('1 frame', '1 帧'), L('2 frames', '2 帧'), L('4 frames', '4 帧')][i] }}</text>
    </g>
    <text x="12" y="322" class="tag">{{ L('simplified: 4 frames stand for the 512 of a 2 MiB page', '简化：这里 4 帧代表 2 MiB 大页的 512 帧') }}</text>
  </svg>
</template>

<style scoped>
.slot {
  fill: none;
  stroke: var(--rule-strong);
  stroke-width: 1;
  stroke-dasharray: 2 2;
}
.cell {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
  transition: stroke 0.3s, fill 0.3s;
}
.cell.hot {
  fill: var(--accent-soft);
  stroke: var(--accent);
  stroke-width: 1.6;
}
.cell.target {
  stroke: var(--accent);
  stroke-width: 2;
}
.hatch-bg {
  fill: var(--bg-elev);
}
.hatch {
  stroke: var(--muted);
  stroke-width: 1.3;
}
.tail {
  fill: url(#fvd-hatch);
}
.num {
  font-size: 8.5px;
  fill: var(--muted);
}
.num.on-fill {
  fill: #fff;
  font-weight: 600;
}
.link.now {
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-dasharray: none;
}
.bracket {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
}
.move {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.6;
}
.note {
  font-size: 9.5px;
  font-weight: 600;
  fill: var(--accent-ink);
}
.ok-text {
  fill: var(--ok);
  font-weight: 700;
}
.big {
  fill: var(--ink);
}
.big.up {
  fill: var(--ok);
}
.fade {
  opacity: 0;
  transition: opacity 0.35s;
}
.fade.show {
  opacity: 1;
}
</style>
