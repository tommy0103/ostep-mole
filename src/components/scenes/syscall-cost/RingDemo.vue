<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * A batch of three reads through io_uring, in five steps: the empty rings, three SQEs and the SQ
 * tail, one io_uring_enter() and the SQ head, CQEs and the CQ tail, the application reading them.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)
const X0 = 62
const W = 30
const cx = (i: number) => X0 + i * W + 13

const sqTail = computed(() => (s.value >= 1 ? 3 : 0))
const sqHead = computed(() => (s.value >= 2 ? 3 : 0))
const cqTail = computed(() => (s.value >= 3 ? 3 : 0))
const cqHead = computed(() => (s.value >= 4 ? 3 : 0))
const sqKind = (i: number) => (i >= 3 || s.value === 0 ? 'empty' : s.value === 1 ? 'sq' : 'taken')
const cqKind = (i: number) => (i >= 3 || s.value < 3 ? 'empty' : s.value === 3 ? 'cq' : 'taken')
// completions may arrive in any order
const CQ_ORDER = [2, 0, 1]
const at = (i: number) => ({ transform: `translateX(${cx(i)}px)` })
</script>

<template>
  <svg class="demo scene-drawing" viewBox="0 0 360 340" role="img" :aria-label="L('io_uring, step by step', 'io_uring 分步演示')">
    <defs>
      <marker id="sr-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head" />
      </marker>
    </defs>

    <rect x="12" y="10" width="336" height="36" rx="6" class="box strong" />
    <text x="180" y="33" class="lbl c">{{ L('Your program', '你的程序') }}</text>

    <!-- submission queue -->
    <text x="62" y="74" class="tag hi">{{ L('submission queue (SQ)', '提交队列（SQ）') }}</text>
    <g class="ptr-g" :style="at(sqHead)">
      <text y="92" class="ptr-t c">{{ L('head', '队头') }}</text>
      <path d="M0,95 V102" class="ptr" />
    </g>
    <g v-for="i in 8" :key="'s' + i">
      <rect :x="X0 + (i - 1) * W" y="104" width="26" height="24" rx="2" class="cell" :class="sqKind(i - 1)" />
      <text :x="cx(i - 1)" y="120" class="tiny c" :class="{ 'on-text': sqKind(i - 1) === 'sq' }">{{ sqKind(i - 1) === 'empty' ? '' : `SQE ${i - 1}` }}</text>
    </g>
    <g class="ptr-g" :style="at(sqTail)">
      <path d="M0,130 V137" class="ptr" />
      <text y="148" class="ptr-t c">{{ L('tail', '队尾') }}</text>
    </g>

    <!-- completion queue -->
    <text x="62" y="172" class="tag hi">{{ L('completion queue (CQ)', '完成队列（CQ）') }}</text>
    <g class="ptr-g" :style="at(cqHead)">
      <text y="190" class="ptr-t c">{{ L('head', '队头') }}</text>
      <path d="M0,193 V200" class="ptr" />
    </g>
    <g v-for="i in 8" :key="'c' + i">
      <rect :x="X0 + (i - 1) * W" y="202" width="26" height="24" rx="2" class="cell" :class="cqKind(i - 1)" />
      <text :x="cx(i - 1)" y="218" class="tiny c" :class="{ 'on-text': cqKind(i - 1) === 'cq' }">{{ cqKind(i - 1) === 'empty' ? '' : `CQE ${CQ_ORDER[i - 1]}` }}</text>
    </g>
    <g class="ptr-g" :style="at(cqTail)">
      <path d="M0,228 V235" class="ptr" />
      <text y="246" class="ptr-t c">{{ L('tail', '队尾') }}</text>
    </g>

    <rect x="12" y="262" width="336" height="36" rx="6" class="box floor" />
    <text x="180" y="285" class="lbl c">{{ L('Kernel', '内核') }}</text>

    <!-- who moves what, step by step -->
    <path d="M40,46 V116 H60" class="flow" :class="{ show: s === 1 }" marker-end="url(#sr-arrow)" />
    <text x="46" y="60" class="note" :class="{ show: s === 1 }">{{ L('writes to memory: no trap', '写内存：不陷入') }}</text>
    <path d="M28,46 V260" class="flow trap" :class="{ show: s === 2 }" marker-end="url(#sr-arrow)" />
    <text x="34" y="60" class="note" :class="{ show: s === 2 }">io_uring_enter()</text>
    <path d="M326,262 V116 H304" class="flow" :class="{ show: s === 2 }" marker-end="url(#sr-arrow)" />
    <path d="M316,262 V214 H304" class="flow" :class="{ show: s === 3 }" marker-end="url(#sr-arrow)" />
    <path d="M60,214 H40 V48" class="flow" :class="{ show: s === 4 }" marker-end="url(#sr-arrow)" />
    <text x="46" y="60" class="note" :class="{ show: s === 4 }">{{ L('reads memory: no trap', '读内存：不陷入') }}</text>

    <text x="180" y="322" class="note c" :class="{ show: s === 0 }">{{ L('each side writes only its own end', '每一方只写自己那一端') }}</text>
    <text x="180" y="322" class="note c" :class="{ show: s === 2 }">{{ L('one trap, however many requests', '一次陷入，不管多少个请求') }}</text>
    <text x="180" y="322" class="note c" :class="{ show: s === 3 }">{{ L('results may arrive in any order', '结果的到达顺序不定') }}</text>
  </svg>
</template>

<style scoped>
.cell {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
  transition: fill 0.3s;
}
.cell.sq {
  fill: var(--p0);
  stroke: none;
}
.cell.cq {
  fill: var(--p2);
  stroke: none;
}
.cell.taken {
  fill: var(--bg-sunk);
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.on-text {
  fill: #fff;
}
.ptr-g {
  transition: transform 0.45s ease;
}
.ptr-t {
  font-size: 9.5px;
  font-weight: 600;
  fill: var(--ink-2);
}
.ptr {
  stroke: var(--ink-2);
  stroke-width: 1.2;
  fill: none;
}
.c {
  text-anchor: middle;
}
.head {
  fill: var(--ink-2);
}
.flow {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.4;
  opacity: 0;
  transition: opacity 0.35s;
}
.flow.trap {
  stroke: var(--p3);
}
.note {
  font-size: 9.5px;
  font-weight: 600;
  fill: var(--accent-ink);
  opacity: 0;
  transition: opacity 0.35s;
}
.show {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .flow,
  .note,
  .ptr-g {
    transition: none;
  }
}
</style>
