<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * AddressSanitizer’s check in seven steps, on the article’s malloc(13): the block between redzones,
 * its two shadow bytes (0 and 5), a read at offset 2 (shadow 0), at 12 (4 < 5, passes), at 13
 * (5 ≥ 5, reported), free() poisoning the block into quarantine, and a read through the old pointer.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)
const freed = computed(() => s.value >= 5)

/** byte cell x for offset 0..15 of the two 8-byte groups */
const bx = (off: number) => 64 + off * 12 + (off >= 8 ? 4 : 0)
/** the offset read at each step, if any */
const target = computed(() => ({ 2: 2, 3: 12, 4: 13, 6: 2 })[s.value as 2 | 3 | 4 | 6] ?? null)
const fails = computed(() => s.value === 4 || s.value === 6)
const hot = (line: number) =>
  ({ 1: [1], 2: [1, 2], 3: [2, 3], 4: [3, 4], 6: [1, 2, 3, 4] })[s.value as 1 | 2 | 3 | 4 | 6]?.includes(line) ?? false
const sh0 = computed(() => (freed.value ? '−' : '0'))
const sh1 = computed(() => (freed.value ? '−' : '5'))
const result = computed(() => {
  switch (s.value) {
    case 2:
      return L('shadow 0: all 8 bytes addressable, pass', '影子值 0：8 个字节都可访问，通过')
    case 3:
      return L('k = 5, position 4: 4 + 1 − 1 = 4 < 5, pass', 'k = 5，位置 4：4 + 1 − 1 = 4 < 5，通过')
    case 4:
      return L('k = 5, position 5: 5 + 1 − 1 = 5 ≥ 5, report', 'k = 5，位置 5：5 + 1 − 1 = 5 ≥ 5，报告')
    case 6:
      return L('k is negative: every position fails, report', 'k 为负：任何位置都不通过，报告')
    default:
      return ''
  }
})
const access = computed(() => (target.value === null ? '' : L(`read 1 byte at offset ${target.value}`, `在偏移 ${target.value} 处读 1 字节`)))
</script>

<template>
  <svg class="demo" viewBox="0 0 360 304" role="img" :aria-label="L('AddressSanitizer’s check, step by step', 'AddressSanitizer 的检查，分步演示')">
    <defs>
      <marker id="asd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head" />
      </marker>
      <marker id="asd-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head bad" />
      </marker>
      <pattern id="asd-rz" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" class="rz-bg" />
        <line x1="0" y1="0" x2="0" y2="5" class="rz-line" />
      </pattern>
    </defs>

    <!-- the check the compiler inserted before each access -->
    <rect x="8" y="6" width="344" height="68" rx="6" class="code-box" />
    <text x="18" y="22" class="code" :class="{ hot: hot(1) }">k = *((addr &gt;&gt; 3) + 0x7fff8000);</text>
    <text x="18" y="36" class="code" :class="{ hot: hot(2) }">if (k != 0 &amp;&amp;</text>
    <text x="30" y="50" class="code" :class="{ hot: hot(3) }">(addr &amp; 7) + size - 1 &gt;= k)</text>
    <text x="30" y="64" class="code" :class="{ hot: hot(4), bad: fails }">report_error(addr, size);</text>
    <text x="344" y="36" class="note end" :class="{ show: target !== null }">{{ access }}</text>

    <!-- the block: 13 bytes in two 8-byte groups, between redzones -->
    <text x="144" y="90" class="cap c">malloc(13)</text>
    <path d="M64,96 L64,100 L223,100 L223,96" class="bracket" />
    <rect x="12" y="106" width="48" height="30" rx="2" fill="url(#asd-rz)" class="rz" />
    <text x="36" y="125" class="tiny c">{{ L('redzone', '红区') }}</text>
    <g v-for="off in 16" :key="'b' + off">
      <rect
        :x="bx(off - 1)"
        y="106"
        width="11"
        height="30"
        rx="1.5"
        :class="['byte', off - 1 > 12 ? 'pad' : freed ? 'poison' : 'live', { ring: target === off - 1 }]"
      />
    </g>
    <rect x="264" y="106" width="84" height="30" rx="2" fill="url(#asd-rz)" class="rz" />
    <text x="306" y="125" class="tiny c">{{ L('redzone', '红区') }}</text>
    <!-- offsets -->
    <text :x="bx(0) + 5.5" y="148" class="tiny c">0</text>
    <text :x="bx(2) + 5.5" y="148" class="tiny c">2</text>
    <text :x="bx(8) + 5.5" y="148" class="tiny c">8</text>
    <text :x="bx(12) + 5.5" y="148" class="tiny c">12</text>
    <text :x="bx(13) + 5.5" y="148" class="tiny c">13</text>

    <!-- the read being checked -->
    <path
      v-if="target !== null"
      :d="`M${bx(target) + 5.5},78 L${bx(target) + 5.5},104`"
      class="flow"
      :class="{ bad: fails }"
      :marker-end="fails ? 'url(#asd-arrow-bad)' : 'url(#asd-arrow)'"
    />

    <!-- one shadow byte per 8-byte group -->
    <g class="fade" :class="{ show: s >= 1 }">
      <path d="M36,138 L36,176 M112,152 L112,176 M216,152 L216,176 M306,138 L306,176" class="link" />
      <rect x="16" y="178" width="40" height="22" rx="3" class="sh bad" />
      <text x="36" y="193" class="code c on-fill">−</text>
      <rect x="92" y="178" width="40" height="22" rx="3" class="sh" :class="{ bad: freed, ring: target !== null && target < 8 }" />
      <text x="112" y="193" class="code c" :class="{ 'on-fill': freed }">{{ sh0 }}</text>
      <rect x="196" y="178" width="40" height="22" rx="3" class="sh" :class="{ bad: freed, ring: s === 3 || s === 4 }" />
      <text x="216" y="193" class="code c" :class="{ 'on-fill': freed }">{{ sh1 }}</text>
      <rect x="286" y="178" width="40" height="22" rx="3" class="sh bad" />
      <text x="306" y="193" class="code c on-fill">−</text>
      <text x="180" y="218" class="cap c">{{ L('shadow: one byte per 8-byte group', '影子：每 8 字节一组，各 1 个影子字节') }}</text>
    </g>

    <!-- the arithmetic of this check -->
    <text x="180" y="240" class="note c" :class="{ show: result !== '', bad: fails }">{{ result }}</text>

    <!-- the report -->
    <g class="fade" :class="{ show: fails }">
      <rect x="12" y="254" width="164" height="40" rx="5" class="report" />
      <text x="94" y="271" class="tiny c bad-ink">{{ L('ASan stops the program', 'ASan 让程序停下') }}</text>
      <text x="94" y="286" class="code c bad-ink">{{ s === 4 ? 'heap-buffer-overflow' : L('use after free', '释放后使用') }}</text>
    </g>

    <!-- the freed block waits in quarantine -->
    <g class="fade" :class="{ show: freed }">
      <rect x="188" y="254" width="160" height="40" rx="5" class="quarantine" />
      <text x="268" y="271" class="tiny c">{{ L('quarantine', '隔离区') }}</text>
      <text x="268" y="286" class="tiny c">{{ L('not handed out again yet', '暂不交给下一次 malloc') }}</text>
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
  font-size: 10px;
  fill: var(--ink-2);
  transition: fill 0.3s;
}
.code.hot {
  fill: var(--accent-ink);
  font-weight: 600;
}
.code.hot.bad {
  fill: var(--p3);
}
.cap {
  font-size: 9.5px;
  fill: var(--muted);
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.c {
  text-anchor: middle;
}
.end {
  text-anchor: end;
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
.rz {
  stroke: var(--p3);
  stroke-width: 1;
}
.rz-bg {
  fill: var(--bg-elev);
}
.rz-line {
  stroke: var(--p3);
  stroke-width: 1.4;
}
.byte {
  stroke-width: 1;
  transition:
    fill 0.35s,
    stroke 0.3s;
}
.byte.live {
  fill: var(--p0);
  stroke: none;
}
.byte.pad {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
}
.byte.poison {
  fill: var(--p3);
  opacity: 0.55;
  stroke: none;
}
.byte.ring,
.sh.ring {
  stroke: var(--accent);
  stroke-width: 2.4;
}
.link {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.sh {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
  transition: fill 0.35s;
}
.sh.bad {
  fill: var(--p3);
  stroke: none;
}
.flow {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.6;
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
.report {
  fill: var(--bg-elev);
  stroke: var(--p3);
  stroke-width: 1.4;
}
.quarantine {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.2;
  stroke-dasharray: 5 4;
}
@media (prefers-reduced-motion: reduce) {
  .fade,
  .note,
  .byte,
  .sh {
    transition: none;
  }
}
</style>
