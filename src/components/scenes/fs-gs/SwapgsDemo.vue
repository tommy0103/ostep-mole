<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * SWAPGS on a trip through the kernel, in six steps: user mode; entry from user mode, seen in the
 * saved CS; the swap; the kernel using gs:; an interrupt in the kernel, which must not swap; the
 * swap back on the way out.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)
const swapped = computed(() => s.value >= 2 && s.value <= 4)
const kernel = computed(() => s.value >= 1 && s.value <= 4)
const userV = computed(() => L('the user’s GS base', '用户的 GS 基址'))
const kernV = computed(() => L('CPU 0’s per-CPU area', 'CPU 0 的每 CPU 区域'))
const swapping = computed(() => s.value === 2 || s.value === 5)
const line = computed(() => {
  switch (s.value) {
    case 1:
      return L('saved CS & 3 = 3: came from user mode', '压栈的 CS & 3 = 3：来自用户态')
    case 2:
      return 'SWAPGS'
    case 3:
      return L('inc gs:[x] reaches this CPU’s data', 'inc gs:[x] 访问到本 CPU 的数据')
    case 4:
      return L('saved CS & 3 = 0: from the kernel, so no SWAPGS', '压栈的 CS & 3 = 0：来自内核，不做 SWAPGS')
    case 5:
      return L('SWAPGS, then return to user mode', 'SWAPGS，然后返回用户态')
    default:
      return L('running the program', '程序正在运行')
  }
})
</script>

<template>
  <svg class="demo" viewBox="0 0 360 286" role="img" :aria-label="L('SWAPGS, step by step', 'SWAPGS 分步演示')">
    <defs>
      <marker id="sg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head" />
      </marker>
    </defs>

    <!-- which mode the CPU is in -->
    <rect x="8" y="8" width="168" height="26" rx="5" class="mode" :class="{ on: !kernel }" />
    <text x="92" y="26" class="m c" :class="{ on: !kernel }">{{ L('user mode', '用户态') }}</text>
    <rect x="184" y="8" width="168" height="26" rx="5" class="mode" :class="{ on: kernel }" />
    <text x="268" y="26" class="m c" :class="{ on: kernel }">{{ L('kernel mode', '内核态') }}</text>

    <!-- the active GS base and the hidden one -->
    <rect x="12" y="50" width="150" height="62" rx="6" class="reg" />
    <text x="87" y="68" class="name c">{{ L('GS base (active)', 'GS 基址（生效的）') }}</text>
    <text x="87" y="94" class="val c">{{ swapped ? kernV : userV }}</text>
    <rect x="198" y="50" width="150" height="62" rx="6" class="reg" />
    <text x="273" y="68" class="name c mono">MSR_KERNEL_GS_BASE</text>
    <text x="273" y="94" class="val c">{{ swapped ? userV : kernV }}</text>
    <path d="M164,81 L196,81" class="swap fade" :class="{ show: swapping }" marker-start="url(#sg-arrow)" marker-end="url(#sg-arrow)" />

    <!-- what the entry code is doing -->
    <rect x="12" y="232" width="336" height="44" rx="6" class="entry" />
    <text x="24" y="250" class="cap">{{ L('entry code', '入口代码') }}</text>
    <text x="24" y="267" class="now" :class="{ hot: swapping }">{{ line }}</text>

    <!-- what the active base leads to -->
    <rect x="12" y="150" width="150" height="66" rx="6" class="area" />
    <text x="87" y="178" class="name c">{{ L('the program’s', '程序自己的') }}</text>
    <text x="87" y="194" class="name c">{{ L('GS target', 'GS 目标') }}</text>
    <rect x="198" y="150" width="150" height="66" rx="6" class="area" :class="{ on: swapped }" />
    <text x="273" y="168" class="name c">{{ L('CPU 0’s per-CPU area', 'CPU 0 的每 CPU 区域') }}</text>
    <text x="273" y="186" class="cap c">{{ L('x, a per-CPU variable', 'x，一个每 CPU 变量') }}</text>
    <text x="273" y="202" class="cap c">{{ L('which kernel stack to use', '该用哪个内核栈') }}</text>
    <path :d="swapped ? 'M130,112 C136,146 180,128 214,148' : 'M87,112 L87,148'" class="ptr" marker-end="url(#sg-arrow)" />
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
.c {
  text-anchor: middle;
}
.mode {
  fill: var(--bg-sunk);
  stroke: var(--rule);
  transition: fill 0.3s, stroke 0.3s;
}
.mode.on {
  fill: var(--accent-soft);
  stroke: var(--accent);
  stroke-width: 1.6;
}
.m {
  font-size: 11px;
  fill: var(--muted);
}
.m.on {
  fill: var(--accent-ink);
  font-weight: 600;
}
.reg,
.area {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1.2;
  transition: stroke 0.3s;
}
.area.on {
  stroke: var(--accent);
  stroke-width: 1.8;
}
.name {
  font-size: 10.5px;
  font-weight: 600;
  fill: var(--ink);
}
.name.mono {
  font-family: var(--font-mono);
  font-size: 9.5px;
}
.val {
  font-size: 10.5px;
  fill: var(--accent-ink);
}
.entry {
  fill: var(--code-bg);
  stroke: var(--rule);
}
.cap {
  font-size: 9.5px;
  fill: var(--muted);
}
.now {
  font-size: 11px;
  fill: var(--ink-2);
}
.now.hot {
  font-weight: 700;
  fill: var(--accent-ink);
}
.swap {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
}
.ptr {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.4;
}
.head {
  fill: var(--ink-2);
}
.show {
  opacity: 1 !important;
}
.fade {
  opacity: 0;
  transition: opacity 0.35s;
}
@media (prefers-reduced-motion: reduce) {
  .fade,
  .mode,
  .reg,
  .area {
    transition: none;
  }
}
</style>
