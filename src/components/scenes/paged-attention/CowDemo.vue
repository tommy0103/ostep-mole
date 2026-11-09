<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * Copy-on-write at block granularity, the paper's example with block size 4: a 7-token prompt and
 * two samples. Both tables point at physical blocks 7 and 1; A's first token copies block 1 to a
 * new block 3; B's writes in place; later blocks are private. Which free blocks A and B take after
 * the shared ones is not in the paper: 5 and 2 are drawn as examples.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const LX = (j: number) => 40 + j * 84
const PX = (p: number) => 12 + p * 43
const PY = 176
const PROMPT = 'p0'
const GA = 'p2' // what sample A generates
const GB = 'p1' // what sample B generates

interface Row {
  id: string
  y: number
  gc: string
  phys: number[]
  n: number[]
}
const rows = computed<Row[]>(() => [
  { id: 'A', y: 24, gc: GA, phys: s.value >= 3 ? [7, 3, 5] : s.value >= 1 ? [7, 3] : [7, 1], n: s.value >= 3 ? [4, 4, 1] : s.value >= 1 ? [4, 4] : [4, 3] },
  { id: 'B', y: 86, gc: GB, phys: s.value >= 3 ? [7, 1, 2] : [7, 1], n: s.value >= 3 ? [4, 4, 1] : s.value >= 2 ? [4, 4] : [4, 3] },
])
/** slot colours of each physical block */
const slots = computed(() => {
  const m = new Map<number, string[]>()
  for (const r of rows.value)
    r.phys.forEach((p, j) =>
      m.set(
        p,
        Array.from({ length: r.n[j] }, (_, k) => (j * 4 + k < 7 ? PROMPT : r.gc)),
      ),
    )
  return m
})
const refs = (p: number) => rows.value.filter((r) => r.phys.includes(p)).length
const changed = (id: string, j: number) => (s.value === 1 && id === 'A' && j === 1) || (s.value === 2 && id === 'B' && j === 1)
const SHOWN = [7, 1, 3, 5, 2]
</script>

<template>
  <svg class="scene-drawing" viewBox="0 0 360 420" role="img" :aria-label="L('Copy-on-write, block by block', '写时复制，一块一块来')">
    <defs>
      <marker id="pc-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <text x="40" y="14" class="tag">{{ L('two samples of one 7-token prompt: logical blocks', '同一个 7-token 提示词的两个样本：逻辑块') }}</text>
    <text x="348" y="39" class="tag end">token</text>
    <text x="348" y="64" class="tag end">{{ L('block table', '块表') }}</text>
    <g v-for="r in rows" :key="r.id">
      <text x="12" :y="r.y + 16" class="lbl">{{ r.id }}</text>
      <g v-for="(n, j) in r.n" :key="j">
        <rect v-for="k in 4" :key="k" :x="LX(j) + (k - 1) * 19" :y="r.y" width="18" height="22" rx="1.5" class="cell" />
        <rect v-for="k in n" :key="'f' + k" :x="LX(j) + (k - 1) * 19" :y="r.y" width="18" height="22" rx="1.5" :class="j * 4 + k <= 7 ? PROMPT : r.gc" />
        <rect :x="LX(j)" :y="r.y + 26" width="75" height="20" rx="2" class="cell" :class="{ hot: changed(r.id, j) }" />
        <text :x="LX(j) + 37" :y="r.y + 40" class="sub c">{{ L(`→ ${r.phys[j]}, ${r.n[j]} filled`, `→ ${r.phys[j]}，已填 ${r.n[j]}`) }}</text>
        <path :d="`M${LX(j) + 37},${r.y + 46} L${PX(r.phys[j]) + 20},${PY}`" class="link" :class="{ now: changed(r.id, j) }" />
      </g>
    </g>

    <!-- GPU memory -->
    <text x="12" y="166" class="tag halo">{{ L('GPU memory: physical blocks', 'GPU 显存：物理块') }}</text>
    <g v-for="p in 8" :key="p">
      <rect :x="PX(p - 1)" :y="PY" width="41" height="24" rx="2" class="box" />
      <g v-for="k in 4" :key="k">
        <rect :x="PX(p - 1) + 1 + (k - 1) * 10" :y="PY + 2" width="9" height="20" rx="1" class="slot" />
        <rect v-if="slots.get(p - 1)?.[k - 1]" :x="PX(p - 1) + 1 + (k - 1) * 10" :y="PY + 2" width="9" height="20" rx="1" :class="slots.get(p - 1)![k - 1]" />
      </g>
      <text :x="PX(p - 1) + 20" y="213" class="num c">{{ p - 1 }}</text>
      <text v-if="SHOWN.includes(p - 1) && refs(p - 1)" :x="PX(p - 1) + 20" y="227" class="tag hi c" :class="{ warn: refs(p - 1) > 1 }">{{ L(`refs ${refs(p - 1)}`, `引用 ${refs(p - 1)}`) }}</text>
    </g>

    <!-- the copy -->
    <path :d="`M${PX(1) + 20},232 C${PX(1) + 30},254 ${PX(3) + 10},254 ${PX(3) + 20},232`" class="copy" :class="{ show: s === 1 }" marker-end="url(#pc-arrow)" />
    <text x="180" y="272" class="note c" :class="{ show: s === 1 }">{{ L('new block: copy three filled slots, then A’s token', '新块：复制三个已填槽位，再写入 A 的 token') }}</text>
    <text x="180" y="272" class="note c" :class="{ show: s === 0 }">{{ L('one copy of the prompt: both tables point at it', '提示词只有一份：两张表都指向它') }}</text>
    <text x="180" y="272" class="note c" :class="{ show: s === 2 }">{{ L('block 1 now has one user: B writes in place, no copy', '块 1 只剩一个使用者：B 原地写入，无需复制') }}</text>
    <text x="180" y="272" class="note c" :class="{ show: s === 3 }">{{ L('new blocks are private from the start; block 7 stays shared', '新块一开始就是私有的；块 7 一直共享') }}</text>
  </svg>
</template>

<style scoped>
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
.slot {
  fill: var(--bg-sunk);
}
.halo {
  paint-order: stroke;
  stroke: var(--bg-elev);
  stroke-width: 3px;
  stroke-linejoin: round;
}
.num {
  font-size: 8.5px;
  fill: var(--muted);
}
.link.now {
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-dasharray: none;
}
.tag.warn {
  fill: var(--warn);
}
.copy {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.6;
  opacity: 0;
  transition: opacity 0.3s;
}
.copy.show {
  opacity: 1;
}
.note {
  font-size: 9.5px;
  font-weight: 600;
  fill: var(--accent-ink);
  opacity: 0;
  transition: opacity 0.3s;
}
.note.show {
  opacity: 1;
}
</style>
