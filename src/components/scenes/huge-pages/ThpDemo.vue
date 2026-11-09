<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * The life of one 2 MiB anonymous range under THP, in six steps: the fault finds no free 2 MiB
 * span, falls back to 4 KiB frames, a span becomes free, khugepaged copies the small pages into it,
 * the PD entry points at it with PS set, and a partial change splits it again. Each 2 MiB span is
 * drawn with 12 cells, as in the scene.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const X0 = [8, 122, 236]
const cx = (sp: number, k: number) => X0[sp] + k * 9.5 + 0.5
// the program's touched pages (index in the 2 MiB range) and the 4 KiB frames they fell back to
// (chosen so that the copy arcs nest instead of crossing)
const FR = [
  { v: 0, sp: 0, k: 11 },
  { v: 2, sp: 0, k: 9 },
  { v: 3, sp: 2, k: 10 },
  { v: 5, sp: 2, k: 7 },
  { v: 8, sp: 2, k: 2 },
]
// a copy arc dips below the strip, deeper the further it goes
const arc = (f: (typeof FR)[number]) => {
  const a = cx(f.sp, f.k) + 4.25
  const b = cx(1, f.v) + 4.25
  const d = 192 + Math.abs(a - b) * 0.16
  return `M${a},182 C${a},${d} ${b},${d} ${b},184`
}
const touched = new Set(FR.map((f) => f.v))
const BASE = ['o..oo...o.o.', '.oo...oo.o.o', '.o..oo...o..']
const kind = (sp: number, k: number) => {
  if (sp === 1 && s.value >= 2) {
    if (s.value < 3) return 'free'
    return touched.has(k) ? 'mine' : 'ghost'
  }
  if (s.value >= 1 && s.value <= 3 && FR.some((f) => f.sp === sp && f.k === k)) return 'mine'
  return BASE[sp][k] === 'o' ? 'other' : 'free'
}
const status = computed(
  () =>
    [
      L('page fault: no free 2 MiB span', '页错误：没有空闲的 2 MiB 区间'),
      L('fallback: one 4 KiB frame per fault', '退回：每次页错误一个 4 KiB 页帧'),
      L('an aligned 2 MiB span is free', '一个对齐的 2 MiB 区间空了出来'),
      L('khugepaged copies the small pages in', 'khugepaged 把小页复制进去'),
      L('PS = 1: one TLB entry covers 2 MiB', 'PS = 1：一个 TLB 项覆盖 2 MiB'),
      L('split: a page table of 512 entries again', '拆分：又是一张 512 项的页表'),
    ][s.value] ?? '',
)
const ptOn = computed(() => s.value >= 1 && s.value !== 4)
</script>

<template>
  <svg class="scene-drawing demo" viewBox="0 0 360 272" role="img" :aria-label="L('A 2 MiB range under THP, step by step', 'THP 下的一段 2 MiB 区域，分步演示')">
    <defs>
      <marker id="hpd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- the program's region: 2 MiB of virtual addresses, aligned, drawn as 12 pages -->
    <text x="179" y="13" class="tag c">{{ L('the program’s region: 2 MiB, aligned', '程序的区域：2 MiB，已对齐') }}</text>
    <rect v-for="k in 12" :key="'v' + k" :x="cx(1, k - 1)" y="19" width="8.5" height="20" rx="1" class="vcell" :class="{ mine: (s >= 1 && touched.has(k - 1)) || (s === 0 && k === 1) }" />
    <rect x="121" y="18" width="116" height="22" rx="2" class="vframe" />
    <text v-if="s === 0" x="118" y="33" class="tag bad-text end">{{ L('first write → fault', '第一次写 → 页错误') }}</text>

    <!-- PD, PT and khugepaged -->
    <rect x="20" y="62" width="80" height="44" rx="5" class="box" />
    <text x="60" y="78" class="lbl c">{{ L('PD', '页目录') }}</text>
    <rect x="34" y="88" width="52" height="7" rx="1" class="entry" :class="{ ps: s === 4 }" />
    <text v-if="s === 4" x="106" y="95" class="tag hi">PS = 1</text>

    <g class="fade" :class="{ show: ptOn }">
      <rect x="140" y="62" width="80" height="44" rx="5" class="box" />
      <text x="180" y="78" class="lbl c">{{ L('PT', '页表') }}</text>
      <text x="180" y="96" class="sub c">{{ L('512 entries', '512 项') }}</text>
      <path d="M86,91.5 L139,91.5" class="link solid" marker-end="url(#hpd-arrow)" />
    </g>
    <text v-if="s === 4" x="180" y="88" class="tag c">{{ L('page table freed', '页表已释放') }}</text>

    <rect x="250" y="62" width="98" height="44" rx="5" class="box" :class="{ act: s === 3 }" />
    <text x="299" y="80" class="lbl c">khugepaged</text>
    <text x="299" y="95" class="sub c">{{ L('scans in the background', '后台扫描') }}</text>

    <!-- the mappings -->
    <g class="fade" :class="{ show: s >= 1 && s <= 3 }">
      <path v-for="f in FR" :key="'m' + f.v" :d="`M180,106 L${cx(f.sp, f.k) + 4.25},157`" class="link solid thin" />
    </g>
    <path class="call fade" :class="{ show: s === 4 }" d="M60,106 C60,140 170,130 176,157" marker-end="url(#hpd-arrow)" />
    <path class="link solid fade" :class="{ show: s === 5 }" d="M180,106 L180,157" marker-end="url(#hpd-arrow)" />

    <!-- physical memory -->
    <text x="8" y="150" class="tag">{{ L('physical memory', '物理内存') }}</text>
    <text x="180" y="234" class="tag c fade" :class="{ show: s === 3 || s === 4 }">{{ L('pale: pages never written, filled with zeros', '浅色：从没写过的页，填零') }}</text>
    <template v-for="sp in 3" :key="'sp' + sp">
      <rect v-for="k in 12" :key="k" :x="cx(sp - 1, k - 1)" y="160" width="8.5" height="22" rx="1" :class="kind(sp - 1, k - 1)" />
    </template>
    <path v-for="x in [8, 122, 236, 350]" :key="'t' + x" :d="`M${x},156 L${x},186`" class="tick" />
    <rect x="121" y="158" width="116" height="26" rx="3" class="spanline fade" :class="{ show: s >= 2, ok: s >= 4 }" />
    <text v-if="s === 0" x="179" y="198" class="tag bad-text c">{{ L('every span has a used frame', '每个区间都有被占用的页帧') }}</text>
    <!-- read-only half after the split -->
    <g class="fade" :class="{ show: s === 5 }">
      <path v-for="k in 6" :key="'ro' + k" :d="`M${cx(1, k + 5)},182 l8.5,-22`" class="hatch" />
      <text x="208" y="198" class="tag hi c">{{ L('read-only', '只读') }}</text>
      <text x="150" y="198" class="tag c">{{ L('writable', '可写') }}</text>
    </g>

    <!-- khugepaged copies each small page into its place -->
    <g class="fade" :class="{ show: s === 3 }">
      <path v-for="f in FR" :key="'c' + f.v" :d="arc(f)" class="call" marker-end="url(#hpd-arrow)" />
    </g>

    <!-- what this step changed -->
    <text x="180" y="250" class="note c" :class="{ bad: s === 0 }">{{ status }}</text>
    <text v-if="s === 4" x="180" y="264" class="tag c">{{ L('old 4 KiB frames freed', '原来的 4 KiB 页帧已释放') }}</text>
  </svg>
</template>

<style scoped>
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.vcell {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 0.6;
  transition: fill 0.3s;
}
.vcell.mine {
  fill: var(--p0);
}
.vframe {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1;
}
.entry {
  fill: var(--p0);
}
.entry.ps {
  stroke: var(--accent);
  stroke-width: 1.6;
}
.box.act {
  stroke: var(--accent);
  stroke-width: 2;
  fill: var(--accent-soft);
}
.free {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 0.6;
  transition: fill 0.3s;
}
.other {
  fill: var(--rule-strong);
  transition: fill 0.3s;
}
.mine {
  fill: var(--p0);
  transition: fill 0.3s;
}
.ghost {
  fill: var(--p0);
  opacity: 0.28;
}
.tick {
  stroke: var(--muted);
  stroke-width: 1;
}
.spanline {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.2;
  stroke-dasharray: 3 2;
}
.spanline.ok {
  stroke: var(--p0);
  stroke-dasharray: none;
  stroke-width: 1.6;
}
.hatch {
  stroke: var(--ink-2);
  stroke-width: 0.9;
}
.thin {
  stroke-width: 0.8;
}
.note {
  font-size: 10.5px;
  font-weight: 600;
  fill: var(--accent-ink);
}
.note.bad {
  fill: var(--p3);
}
.fade {
  opacity: 0;
  transition: opacity 0.35s;
}
.fade.show {
  opacity: 1;
}
</style>
