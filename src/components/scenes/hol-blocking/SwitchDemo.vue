<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * Why a FIFO-queued switch wastes capacity, on the two-port switch of the article's fold: three
 * time slots, the average, and the same blocked slot with one queue per output. Cells are coloured
 * by the output they are going to; the head of each queue is on the right.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)

interface View {
  slot: string
  in1: number[]
  in2: number[]
  /** input → output pairs sent in this slot */
  go: [number, number][]
  blocked?: boolean
  sent: string
}
const STEPS = computed<View[]>(() => [
  { slot: L('Time slot 1', '时隙 1'), in1: [2, 1, 1], in2: [2, 1, 2], go: [], sent: L('sent so far: 0', '已发出：0') },
  { slot: L('Time slot 1', '时隙 1'), in1: [2, 1, 1], in2: [2, 1, 2], go: [[1, 1], [2, 2]], sent: L('this slot 2 · sent so far: 2', '这个时隙 2 个 · 累计 2') },
  { slot: L('Time slot 2', '时隙 2'), in1: [2, 2, 1], in2: [1, 2, 1], go: [[1, 1]], blocked: true, sent: L('this slot 1 · sent so far: 3', '这个时隙 1 个 · 累计 3') },
  { slot: L('Time slot 3', '时隙 3'), in1: [1, 2, 2], in2: [1, 2, 1], go: [[1, 2], [2, 1]], sent: L('this slot 2 · sent so far: 5', '这个时隙 2 个 · 累计 5') },
  { slot: L('Over many slots', '许多个时隙之后'), in1: [], in2: [], go: [], sent: '' },
  { slot: L('Time slot 2, with one queue per output', '时隙 2，每个输出一个队列'), in1: [2, 2, 1], in2: [], go: [[1, 1], [2, 2]], sent: L('this slot 2', '这个时隙 2 个') },
])
const v = computed(() => STEPS.value[props.step] ?? STEPS.value[0])
const voq = computed(() => props.step === 5)
const avg = computed(() => props.step === 4)
const Y = (i: number) => (i === 1 ? 84 : 174)
const cellX = (i: number) => 54 + i * 32
const path = (a: number, b: number) => `M152,${Y(a) + 14} C200,${Y(a) + 14} 216,${Y(b) + 14} 262,${Y(b) + 14}`
const outBusy = (o: number) => v.value.go.some((g) => g[1] === o)
</script>

<template>
  <svg class="scene-drawing" viewBox="0 0 360 330" role="img" :aria-label="L('A two-port switch, slot by slot', '两端口交换机，逐时隙演示')">
    <defs>
      <marker id="hol-demo-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>
    <text x="12" y="24" class="lbl">{{ v.slot }}</text>

    <template v-if="!avg">
      <text x="54" y="58" class="tag">{{ L('waiting (head on the right)', '排队（队头在右）') }}</text>
      <!-- the outputs -->
      <g v-for="o in [1, 2]" :key="'o' + o">
        <rect x="264" :y="Y(o)" width="84" height="28" rx="5" class="box" :class="{ strong: outBusy(o), idle: !outBusy(o) && v.go.length > 0 }" />
        <text x="306" :y="Y(o) + 18" class="tag c" :class="{ hi: outBusy(o) }">{{ L('output ', '输出 ') }}{{ o }}</text>
      </g>
      <!-- input 1 -->
      <text x="12" :y="Y(1) + 18" class="tag">{{ L('in 1', '输入 1') }}</text>
      <rect x="50" :y="Y(1) - 2" width="102" height="32" rx="3" class="lane" />
      <g v-for="(d, i) in v.in1" :key="'a' + i">
        <rect :x="cellX(i)" :y="Y(1) + 2" width="28" height="24" rx="2" :class="d === 1 ? 'p0' : 'p1'" />
        <text :x="cellX(i) + 14" :y="Y(1) + 18" class="tag c w">→{{ d }}</text>
      </g>
      <!-- input 2: one FIFO, or a queue for each output -->
      <text x="12" :y="Y(2) + 18" class="tag">{{ L('in 2', '输入 2') }}</text>
      <template v-if="!voq">
        <rect x="50" :y="Y(2) - 2" width="102" height="32" rx="3" class="lane" />
        <g v-for="(d, i) in v.in2" :key="'b' + i">
          <rect :x="cellX(i)" :y="Y(2) + 2" width="28" height="24" rx="2" :class="d === 1 ? 'p0' : 'p1'" />
          <text :x="cellX(i) + 14" :y="Y(2) + 18" class="tag c w">→{{ d }}</text>
        </g>
        <rect v-if="v.blocked" x="84" :y="Y(2)" width="32" height="28" rx="3" class="ring" />
        <text v-if="v.blocked" x="100" :y="Y(2) + 44" class="tag bad-text c">{{ L('could use output 2, but is not the head', '本可以去输出 2，却不是队头') }}</text>
      </template>
      <template v-else>
        <rect x="50" y="156" width="102" height="22" rx="3" class="lane" />
        <text x="56" y="171" class="tag">{{ L('for 1', '去 1') }}</text>
        <rect x="118" y="158" width="28" height="18" rx="2" class="p0" />
        <text x="132" y="171" class="tag c w">→1</text>
        <rect x="50" y="182" width="102" height="22" rx="3" class="lane" />
        <text x="56" y="197" class="tag">{{ L('for 2', '去 2') }}</text>
        <rect x="118" y="184" width="28" height="18" rx="2" class="p1" />
        <text x="132" y="197" class="tag c w">→2</text>
      </template>
      <!-- what goes this slot -->
      <path v-for="(g, i) in v.go" :key="'g' + i" :d="path(g[0], g[1])" class="call" marker-end="url(#hol-demo-arrow)" />
      <template v-if="v.blocked">
        <path d="M152,188 L170,188" class="danger" />
        <text x="176" y="193" class="bad-text c big">✕</text>
      </template>
      <text x="12" y="290" class="tag hi">{{ v.sent }}</text>
    </template>

    <template v-else>
      <text x="12" y="62" class="tag hi">{{ L('Half of the slots collide, half do not', '一半的时隙发生冲突，一半不冲突') }}</text>
      <rect x="12" y="74" width="168" height="28" rx="2" class="sunk" />
      <text x="96" y="92" class="tag hi c">{{ L('no collision: 2 cells', '不冲突：2 个信元') }}</text>
      <rect x="180" y="74" width="168" height="28" rx="2" class="sunk" />
      <text x="264" y="92" class="tag hi c">{{ L('collision: 1 cell', '冲突：1 个信元') }}</text>
      <text x="12" y="140" class="lbl">{{ L('(1/2) · 2 + (1/2) · 1 = 1.5 cells per slot', '(1/2) · 2 + (1/2) · 1 = 每时隙 1.5 个信元') }}</text>
      <text x="12" y="166" class="tag">{{ L('out of a possible 2:', '满分是 2：') }}</text>
      <text x="348" y="166" class="lbl end">75%</text>
      <line x1="12" x2="348" y1="186" y2="186" class="rule" />
      <text x="12" y="210" class="tag">{{ L('with more and more ports, the ceiling falls to', '端口越来越多时，天花板降到') }}</text>
      <text x="348" y="210" class="lbl end">2 − √2 ≈ 58.6%</text>
    </template>
  </svg>
</template>

<style scoped>
.lane {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.rule {
  stroke: var(--rule);
}
.ring {
  fill: none;
  stroke: var(--p3);
  stroke-width: 1.8;
}
.idle {
  stroke-dasharray: 4 3;
}
text.w {
  fill: #fff;
  font-weight: 600;
}
</style>
