<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * A 32-bit WebAssembly memory behind a guard region, in six steps: reserve 4 GiB plus a guard, make
 * the first `size` bytes accessible, an in-range load (one instruction), an out-of-range load (a
 * page fault), the fault turned into a trap through a signal, and memory.grow changing protections
 * only. Sizes are not to scale.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)
/** right edge of the accessible part */
const sizeEnd = computed(() => (s.value >= 5 ? 128 : 80))
/** page-protection cells under the reservation */
const cells = Array.from({ length: 16 }, (_, i) => 16 + i * 16)
</script>

<template>
  <svg class="demo" viewBox="0 0 360 290" role="img" :aria-label="L('A guard region, step by step', '保护区，分步演示')">
    <defs>
      <marker id="gd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head" />
      </marker>
      <marker id="gd-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head bad" />
      </marker>
      <pattern id="gd-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" class="hatch-bg" />
        <line x1="0" y1="0" x2="0" y2="5" class="hatch-line" />
      </pattern>
    </defs>

    <!-- the compiled load: no compare, no branch -->
    <rect x="8" y="6" width="344" height="40" rx="6" class="code-box" />
    <text x="18" y="24" class="code" :class="{ hot: s === 2 || s === 3 }">mov eax, [mem_base + i + 16]</text>
    <text x="18" y="38" class="cap">{{ L('the whole bounds check: nothing', '整个界限检查：什么都没有') }}</text>

    <!-- the reservation: size accessible, the rest of 4 GiB and the guard not -->
    <path d="M16,82 L16,78 L272,78 L272,82" class="bracket" />
    <text x="144" y="73" class="cap c">{{ L('4 GiB reserved', '预留 4 GiB') }}</text>
    <text x="298" y="73" class="cap c">{{ L('guard', '保护区') }}</text>
    <rect x="16" y="88" width="256" height="34" rx="2" class="reserved" />
    <rect x="272" y="88" width="52" height="34" rx="2" fill="url(#gd-hatch)" class="guard" />
    <text x="298" y="109" class="tiny c">32 MiB</text>
    <rect x="324" y="88" width="24" height="34" rx="2" class="host" />
    <rect x="16" y="88" :width="sizeEnd - 16" height="34" rx="2" class="mapped fade" :class="{ show: s >= 1 }" />
    <text :x="(16 + sizeEnd) / 2" y="109" class="tiny c on-fill fade" :class="{ show: s >= 1 }">size</text>
    <text x="16" y="136" class="tiny">mem_base</text>
    <text x="336" y="136" class="tiny c">{{ L('host', '宿主') }}</text>

    <!-- page protections: what the page table allows -->
    <g class="fade" :class="{ show: s >= 1 }">
      <rect v-for="x in cells" :key="x" :x="x" y="144" width="15" height="14" rx="1.5" :class="x < sizeEnd ? 'prot ok' : 'prot no'" />
      <text x="16" y="172" class="tiny">{{ L('page table: accessible (green) or not', '页表：可访问（绿）或不可访问') }}</text>
    </g>
    <text x="180" y="186" class="note c" :class="{ show: s === 5 }">{{ L('memory.grow: protections change, base stays', 'memory.grow：改页保护，基址不动') }}</text>

    <!-- an in-range load -->
    <g class="fade" :class="{ show: s === 2 }">
      <path d="M48,46 L48,86" class="flow" marker-end="url(#gd-arrow)" />
      <text x="56" y="58" class="note show">{{ L('in range: the load just happens', '范围内：读就这么完成了') }}</text>
    </g>
    <!-- an out-of-range load lands on an inaccessible page -->
    <g class="fade" :class="{ show: s === 3 || s === 4 }">
      <path d="M190,46 L190,86" class="flow bad" marker-end="url(#gd-arrow-bad)" />
      <text x="190" y="111" class="bad-ink c big">✕</text>
      <text x="198" y="58" class="note bad show">{{ L('i too large: an inaccessible page', 'i 太大：落在不可访问的页上') }}</text>
    </g>

    <!-- from page fault to WebAssembly trap -->
    <g class="fade" :class="{ show: s >= 3 && s <= 4 }">
      <rect x="12" y="200" width="100" height="38" rx="5" class="box" />
      <text x="62" y="216" class="lbl c">CPU</text>
      <text x="62" y="230" class="tiny c">{{ L('page fault', '页错误') }}</text>
    </g>
    <g class="fade" :class="{ show: s === 4 }">
      <path d="M112,219 L128,219" class="flow" marker-end="url(#gd-arrow)" />
      <rect x="130" y="200" width="100" height="38" rx="5" class="box" />
      <text x="180" y="216" class="lbl c">{{ L('kernel', '内核') }}</text>
      <text x="180" y="230" class="tiny c">{{ L('sends a signal', '发出信号') }}</text>
      <path d="M230,219 L246,219" class="flow" marker-end="url(#gd-arrow)" />
      <rect x="248" y="200" width="100" height="38" rx="5" class="box" />
      <text x="298" y="216" class="lbl c">{{ L('engine', '引擎') }}</text>
      <text x="298" y="230" class="tiny c">{{ L('signal handler', '信号处理程序') }}</text>
      <text x="298" y="256" class="tiny c">{{ L('fault in Wasm code?', '出错处在 Wasm 代码里？') }}</text>
      <rect x="248" y="264" width="100" height="22" rx="5" class="trap" />
      <text x="298" y="279" class="lbl c bad-ink">{{ L('Wasm trap', 'Wasm 陷入') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.demo {
  width: 100%;
  height: auto;
  display: block;
  font-family: var(--font-sans);
}
.demo:lang(zh) {
  font-family: var(--font-zh);
}
.code-box {
  fill: var(--code-bg);
  stroke: var(--rule);
}
.code {
  font-family: var(--font-mono);
  font-size: 10.5px;
  fill: var(--ink-2);
  transition: fill 0.3s;
}
.code.hot {
  fill: var(--accent-ink);
  font-weight: 600;
}
.cap {
  font-size: 9.5px;
  fill: var(--muted);
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.lbl {
  font-size: 11.5px;
  font-weight: 600;
  fill: var(--ink);
}
.c {
  text-anchor: middle;
}
.big {
  font-size: 14px;
  font-weight: 700;
}
.on-fill {
  fill: #fff;
}
.bad-ink {
  fill: var(--p3);
}
.note {
  font-size: 9.5px;
  font-weight: 600;
  fill: var(--accent-ink);
  opacity: 0;
  transition: opacity 0.35s;
}
.note.bad {
  fill: var(--p3);
}
.show {
  opacity: 1 !important;
}
.fade {
  opacity: 0;
  transition: opacity 0.4s;
}
.bracket {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
}
.reserved {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-dasharray: 3 2;
}
.mapped {
  fill: var(--p0);
  transition:
    width 0.5s ease,
    opacity 0.4s;
}
.guard {
  stroke: var(--warn);
  stroke-width: 1;
}
.hatch-bg {
  fill: var(--bg-elev);
}
.hatch-line {
  stroke: var(--warn);
  stroke-width: 1.3;
}
.host {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
}
.prot {
  stroke: none;
  transition: fill 0.4s;
}
.prot.ok {
  fill: var(--ok);
}
.prot.no {
  fill: var(--rule-strong);
}
.box {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1.2;
}
.trap {
  fill: var(--bg-elev);
  stroke: var(--p3);
  stroke-width: 1.4;
}
.flow {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.5;
}
.flow.bad {
  stroke: var(--p3);
}
.head {
  fill: var(--ink-2);
}
.head.bad {
  fill: var(--p3);
}
@media (prefers-reduced-motion: reduce) {
  .fade,
  .note,
  .mapped,
  .prot {
    transition: none;
  }
}
</style>
