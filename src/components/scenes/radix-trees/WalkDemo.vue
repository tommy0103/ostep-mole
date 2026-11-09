<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * The x86-64 walk of 0x7ffde3a45b10, in the scene's own layout: the address in binary, cut into
 * four 9-bit digits and a 12-bit offset; then one dependent read per table (CR3 → PGD → PUD → PMD →
 * PTE); then the data, and the TLB keeping the translation. Tables have 512 entries; 16 are drawn.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const BIN = '011111111' + '111110111' + '100011101' + '001000101' + '101100010000'
const FIELDS = [
  { bin: BIN.slice(0, 9), v: '255', bits: 9 },
  { bin: BIN.slice(9, 18), v: '503', bits: 9 },
  { bin: BIN.slice(18, 27), v: '285', bits: 9 },
  { bin: BIN.slice(27, 36), v: '69', bits: 9 },
  { bin: BIN.slice(36), v: '0xb10', bits: 12 },
].reduce<{ bin: string; v: string; x: number; w: number }[]>((acc, f) => {
  const x = acc.length ? acc[acc.length - 1].x + acc[acc.length - 1].w : 16
  return [...acc, { ...f, x, w: (f.bits / 48) * 328 }]
}, [])

const ROW_Y = [76, 140, 204, 268, 332]
const X0 = 16
const CW = 12
const RX = 218
const ROWS = [
  { name: 'PGD', sel: 7, ptr: [0, 15], idx: '255', what: ['→ a PUD table', '→ 一张 PUD 表'] },
  { name: 'PUD', sel: 15, ptr: [14], idx: '503', what: ['→ a PMD table', '→ 一张 PMD 表'] },
  { name: 'PMD', sel: 8, ptr: [9], idx: '285', what: ['→ a PTE table', '→ 一张 PTE 表'] },
  { name: 'PTE', sel: 2, ptr: [1, 3, 4], idx: '69', what: ['→ the frame', '→ 物理帧'] },
]
const cellX = (i: number) => X0 + i * CW
/** the field being used at this step */
const hot = (i: number) => (s.value === 0 ? i < 5 : i === s.value - 1 || (s.value === 5 && i === 4))
const reads = computed(() => Math.min(s.value, 5))
</script>

<template>
  <svg class="scene-drawing demo" viewBox="0 0 360 420" role="img" :aria-label="L('A four-level page walk, step by step', '四级页表遍历，分步演示')">
    <defs>
      <marker id="rtw-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- the address, in binary, nine bits at a time -->
    <text :x="X0" y="12" class="tag">{{ L('virtual address 0x7ffde3a45b10, in binary', '虚拟地址 0x7ffde3a45b10 的二进制') }}</text>
    <g v-for="(f, i) in FIELDS" :key="i">
      <rect :x="f.x" y="18" :width="f.w - 2" height="24" rx="3" class="field" :class="{ hot: hot(i) }" />
      <text :x="f.x + f.w / 2 - 1" y="34" class="bits c">{{ f.bin }}</text>
      <text :x="f.x + f.w / 2 - 1" y="55" class="code c" :class="{ strong: hot(i) }">{{ f.v }}</text>
    </g>

    <!-- CR3 holds the root's address -->
    <g class="fade" :class="{ show: s >= 1 }">
      <rect :x="RX + 76" y="60" width="38" height="15" rx="3" class="box gate" />
      <text :x="RX + 95" y="71" class="code c">CR3</text>
      <path :d="`M${RX + 76},67.5 L${X0 + 3},67.5 L${X0 + 3},72`" class="link solid" marker-end="url(#rtw-arrow)" />
    </g>

    <!-- the four tables -->
    <g v-for="(r, ri) in ROWS" :key="r.name" class="row" :class="{ done: s > ri + 1, now: s === ri + 1, later: s < ri + 1 }">
      <rect :x="X0 - 2" :y="ROW_Y[ri] - 2" width="196" height="24" rx="3" class="box" />
      <rect
        v-for="i in 16"
        :key="i"
        :x="cellX(i - 1) + 1"
        :y="ROW_Y[ri] + 1"
        width="10"
        height="18"
        rx="1.5"
        class="cell"
        :class="{ ptr: r.ptr.includes(i - 1), sel: s > ri && r.sel === i - 1 }"
      />
      <path
        v-if="s > ri"
        :d="`M${cellX(r.sel) + 6},${ROW_Y[ri] + 21} L${X0 + 3},${ROW_Y[ri + 1] - 3}`"
        class="link solid"
        marker-end="url(#rtw-arrow)"
      />
      <text :x="RX" :y="ROW_Y[ri] + 8" class="lbl">{{ r.name }}</text>
      <text :x="RX" :y="ROW_Y[ri] + 21" class="sub">{{ s > ri ? L(`read ${ri + 1}: entry ${r.idx}`, `第 ${ri + 1} 次读：第 ${r.idx} 项`) : L('512 entries', '512 项') }}</text>
      <text v-if="s > ri" :x="RX" :y="ROW_Y[ri] + 33" class="sub">{{ L(r.what[0], r.what[1]) }}</text>
    </g>

    <!-- the data -->
    <g class="row" :class="{ now: s === 5, later: s < 5 }">
      <rect :x="X0" y="332" width="192" height="26" rx="3" class="box" />
      <rect :x="X0" y="332" width="6" height="26" rx="2" class="datum-edge" />
      <!-- the offset inside the page: 0xb10 of 0x1000 -->
      <path v-if="s >= 5" :d="`M${X0 + 192 * (0xb10 / 0x1000)},330 L${X0 + 192 * (0xb10 / 0x1000)},360`" class="offset" />
      <text :x="RX" y="340" class="lbl">{{ L('4 KiB page', '4 KiB 的页') }}</text>
      <text :x="RX" y="353" class="sub">{{ s >= 5 ? L('read 5: frame + 0xb10', '第 5 次读：帧 + 0xb10') : L('the data', '数据') }}</text>
    </g>

    <!-- the count, and the TLB keeping the result -->
    <text :x="X0" y="390" class="tag hi">{{ L(`memory reads so far: ${reads}`, `目前的内存读取：${reads} 次`) }}</text>
    <g class="fade" :class="{ show: s >= 5 }">
      <rect :x="X0" y="398" width="290" height="18" rx="3" class="box gate" />
      <text :x="X0 + 8" y="411" class="code">TLB: 0x7ffde3a45 → {{ L('frame', '帧') }}</text>
      <text :x="X0 + 282" y="411" class="tag end">{{ L('next time: 0 walks', '下次：不用遍历') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.field {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1.1;
  transition: stroke 0.3s;
}
.field.hot {
  stroke: var(--accent);
  stroke-width: 1.8;
}
.bits {
  font-family: var(--font-mono);
  font-size: 8.5px;
  fill: var(--ink-2);
}
.strong {
  fill: var(--accent-ink);
  font-weight: 700;
}
.cell {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.cell.ptr {
  fill: var(--rule-strong);
}
.cell.sel {
  fill: var(--ink-2);
  stroke: none;
}
.row {
  transition: opacity 0.35s;
}
.row.later {
  opacity: 0.35;
}
.row.now .box {
  stroke: var(--accent);
  stroke-width: 2;
}
.row.now .cell.sel {
  fill: var(--accent);
}
.datum-edge {
  fill: var(--p2);
}
.offset {
  stroke: var(--accent);
  stroke-width: 1.6;
}
.fade {
  opacity: 0;
  transition: opacity 0.35s;
}
.fade.show {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .row,
  .fade,
  .field {
    transition: none;
  }
}
</style>
