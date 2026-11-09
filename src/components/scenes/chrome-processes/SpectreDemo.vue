<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * Spectre variant 1 (bounds-check bypass) in seven steps: train, the plan (a value must become an
 * address), prepare and flush the probe slots, speculate past the bounds, touch probe[secret], roll
 * back, time the probe slots. The probe array has 256 lines in a real
 * attack; 16 are drawn.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const SECRET = 11
const s = computed(() => props.step)
const cached = computed(() => s.value >= 4)
// access times in the last step: one line answers from the cache
const height = (i: number) => (i === SECRET ? 7 : 50 + ((i * 37) % 17))
</script>

<template>
  <svg class="demo" viewBox="0 0 360 420" role="img" :aria-label="L('Spectre, step by step', 'Spectre 分步演示')">
    <defs>
      <marker id="sp-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head" />
      </marker>
    </defs>

    <!-- the victim code, run by the attacker's own script -->
    <rect x="8" y="4" width="344" height="72" rx="6" class="code-box" />
    <text x="18" y="22" class="code" :class="{ hot: s === 0 || s === 5 }">if (x &lt; len) {</text>
    <text x="30" y="38" class="code" :class="{ hot: s === 3 }">s = a[x];</text>
    <text x="30" y="54" class="code" :class="{ hot: s === 4 }">t = probe[s * 4096];</text>
    <text x="18" y="70" class="code">}</text>
    <text x="344" y="24" class="note end" :class="{ show: s === 0 }">{{ L('predictor: “passes”', '预测：通过') }}</text>
    <text x="344" y="24" class="note end bad" :class="{ show: s === 5 }">{{ L('out of bounds!', '越界！') }}</text>

    <!-- one address space: a.com's array, then b.com's data right after it -->
    <text x="12" y="92" class="cap">{{ L('one address space', '同一个地址空间') }}</text>
    <g v-for="i in 6" :key="'a' + i">
      <rect :x="12 + (i - 1) * 34" y="98" width="32" height="24" rx="2" class="cell a" :class="{ ring: s === 0 && i === 3 }" />
      <text :x="28 + (i - 1) * 34" y="114" class="tiny c on-fill">a[{{ i - 1 }}]</text>
    </g>
    <rect x="226" y="98" width="62" height="24" rx="2" class="cell b" :class="{ ring: s >= 3 }" />
    <text x="257" y="114" class="tiny c on-fill">{{ s >= 3 ? `${L('secret', '秘密')} = ${SECRET}` : L('secret', '秘密') }}</text>
    <text x="110" y="136" class="tiny c">{{ L('a.com’s array', 'a.com 的数组') }}</text>
    <text x="257" y="136" class="tiny c">b.com</text>
    <!-- the reads: a valid one while training, the speculative one in the attack -->
    <path d="M100,62 C110,80 96,86 96,96" class="flow" :class="{ show: s === 0 }" marker-end="url(#sp-arrow)" />
    <path d="M150,40 C230,44 250,70 252,96" class="flow spec" :class="{ show: s === 3 }" marker-end="url(#sp-arrow)" />

    <!-- the probe array: line i stands for the value i -->
    <text x="12" y="160" class="cap">{{ L('probe: one slot per possible value (16 of 256 drawn)', 'probe：每个可能的值一个位置（共 256 个，画了 16 个）') }}</text>
    <g v-for="i in 16" :key="'p' + i">
      <rect :x="12 + (i - 1) * 21" y="166" width="19" height="22" rx="2" class="cell probe" :class="{ ring: s >= 4 && i - 1 === SECRET }" />
      <text :x="21.5 + (i - 1) * 21" y="181" class="tiny c">{{ i - 1 }}</text>
    </g>
    <text x="180" y="200" class="note c" :class="{ show: s === 1 }">{{ L('the cache remembers addresses, not values', '缓存记住的是地址，不是值') }}</text>
    <path d="M257,124 C262,140 252,150 249,164" class="flow spec" :class="{ show: s === 4 }" marker-end="url(#sp-arrow)" />

    <!-- the cache, and the registers that are rolled back -->
    <rect x="12" y="204" width="164" height="44" rx="5" class="box" />
    <text x="20" y="220" class="cap">{{ L('CPU cache', 'CPU 缓存') }}</text>
    <text x="20" y="238" class="tiny" :class="{ show: s === 2 || s === 3 }" opacity="0">{{ L('no probe slot cached', '没有任何 probe 位置') }}</text>
    <text x="104" y="238" class="tiny" :class="{ show: s >= 4 }" opacity="0">{{ L('← value 11 as a place', '← 值 11 变成了位置') }}</text>
    <g :class="{ show: cached }" class="fade">
      <rect x="20" y="226" width="78" height="16" rx="3" class="chip" />
      <text x="59" y="238" class="tiny c on-fill">probe[11]</text>
    </g>
    <rect x="188" y="204" width="160" height="44" rx="5" class="box" />
    <text x="196" y="220" class="cap">{{ L('registers', '寄存器') }}</text>
    <g class="fade" :class="{ show: s >= 3 }">
      <text x="196" y="239" class="code" :class="{ struck: s >= 5 }">s = {{ SECRET }}</text>
      <text x="252" y="239" class="code" :class="{ struck: s >= 5, show: s >= 4 }">t = …</text>
    </g>
    <text x="340" y="239" class="note end bad" :class="{ show: s >= 5 }">{{ L('discarded', '已丢弃') }}</text>
    <text x="180" y="262" class="note c" :class="{ show: s === 5 }">{{ L('registers undone · cache untouched', '寄存器撤销了，缓存没有') }}</text>

    <!-- timing every probe line -->
    <text x="12" y="272" class="cap">{{ L('time to read each probe slot', '读每个 probe 位置所用时间') }}</text>
    <line x1="12" y1="400" x2="348" y2="400" class="axis" />
    <g v-for="i in 16" :key="'t' + i">
      <rect
        :x="14 + (i - 1) * 21"
        :y="400 - (s >= 6 ? height(i - 1) * 1.6 : 0)"
        width="15"
        :height="s >= 6 ? height(i - 1) * 1.6 : 0"
        rx="1.5"
        class="bar"
        :class="{ fast: i - 1 === SECRET }"
        :style="{ transitionDelay: `${(i - 1) * 60}ms` }"
      />
    </g>
    <text x="252" y="414" class="note bad c" :class="{ show: s >= 6 }">↑ {{ L('slot 11: a few ns', '第 11 个：几纳秒') }}</text>
    <text x="12" y="414" class="tiny" :class="{ show: s >= 6 }" opacity="0">{{ L('others ≈ 100 ns', '其他 ≈ 100 纳秒') }}</text>
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
.code.struck {
  text-decoration: line-through;
  fill: var(--muted);
}
.cap {
  font-size: 9.5px;
  fill: var(--muted);
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.on-fill {
  fill: #fff;
}
.c {
  text-anchor: middle;
}
.end {
  text-anchor: end;
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
.cell {
  stroke: none;
  transition:
    stroke 0.3s,
    stroke-width 0.3s;
}
.cell.a {
  fill: var(--p0);
}
.cell.b {
  fill: var(--p1);
}
.cell.probe {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.cell.ring {
  stroke: var(--accent);
  stroke-width: 2.4;
}
.box {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
}
.chip {
  fill: var(--accent);
}
.flow {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.4;
  opacity: 0;
  transition: opacity 0.35s;
}
.flow.spec {
  stroke: var(--p3);
  stroke-dasharray: 4 3;
}
.head {
  fill: var(--ink-2);
}
.axis {
  stroke: var(--rule-strong);
}
.bar {
  fill: var(--rule-strong);
  transition:
    y 0.5s ease,
    height 0.5s ease;
}
.bar.fast {
  fill: var(--p3);
}
@media (prefers-reduced-motion: reduce) {
  .bar,
  .fade,
  .note,
  .flow {
    transition: none;
  }
}
</style>
