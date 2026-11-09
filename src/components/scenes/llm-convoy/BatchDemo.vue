<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * The article's worked example as a timeline, in iterations: A writes 2,000 tokens, B, C and D 20
 * each, E 20 and arrives just after the start. First static batching, then deciding every
 * iteration. The axis is broken: only the first iterations and the last ones are drawn.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const X = (i: number) => (i <= 60 ? 44 + i * 2.6 : 226 + (i - 1980) * 1.9)
const COLOR: Record<string, string> = { A: 'p0', B: 'p1', C: 'p2', D: 'p4', E: 'p3' }
const ROWS = ['A', 'B', 'C', 'D', 'E']
const Y = (r: number) => 74 + r * 34

type Seg = [string, number, number] // kind: run | held | wait, from, to
const PLANS = computed((): Record<string, Seg[]> => {
  switch (s.value) {
    case 0:
      return {}
    case 1:
      return { A: [['run', 0, 20]], B: [['run', 0, 20]], C: [['run', 0, 20]], D: [['run', 0, 20]], E: [['wait', 1, 20]] }
    case 2:
      return { A: [['run', 0, 2000]], B: [['run', 0, 20], ['held', 20, 2000]], C: [['run', 0, 20], ['held', 20, 2000]], D: [['run', 0, 20], ['held', 20, 2000]], E: [['wait', 1, 2000], ['run', 2000, 2020]] }
    case 3:
      return { A: [['run', 0, 20]], B: [['run', 0, 20]], C: [['run', 0, 20]], D: [['run', 0, 20]], E: [['wait', 1, 20]] }
    default:
      return { A: [['run', 0, 2000]], B: [['run', 0, 20]], C: [['run', 0, 20]], D: [['run', 0, 20]], E: [['wait', 1, 20], ['run', 20, 40]] }
  }
})
const title = computed(() => (s.value === 0 ? L('The example', '例子') : s.value <= 2 ? L('Static batching', '静态批处理') : L('Deciding every iteration', '每次迭代都重新决策')))
const decide = computed(() => s.value === 3)
const result = computed(() => (s.value === 2 ? L('average completion ≈ 2,004 iterations', '平均完成时间 ≈ 2004 次迭代') : s.value === 4 ? L('average completion = 420 iterations', '平均完成时间 = 420 次迭代') : ''))
const firstToken = computed(() => (s.value === 2 ? L('E’s first token: after 2,001 iterations', 'E 的第一个 token：2001 次迭代之后') : s.value === 4 ? L('E’s first token: after 21 iterations', 'E 的第一个 token：21 次迭代之后') : ''))
const TICKS = [0, 20, 40, 2000, 2020]
const ticks = computed(() => TICKS.filter((t) => s.value >= 1 || t === 0))
</script>

<template>
  <svg class="scene-drawing" viewBox="0 0 360 340" role="img" :aria-label="L('Static batching against deciding every iteration', '静态批处理与每次迭代重新决策的对比')">
    <text x="12" y="24" class="lbl">{{ title }}</text>
    <text x="12" y="42" class="tag">{{ L('tokens to write: A 2,000 · B, C, D, E 20 each', '要写的 token 数：A 2000 · B、C、D、E 各 20') }}</text>

    <g v-for="(k, r) in ROWS" :key="k">
      <rect x="12" :y="Y(r)" width="22" height="22" rx="2" :class="COLOR[k]" />
      <text x="23" :y="Y(r) + 15" class="tag c w">{{ k }}</text>
      <line x1="44" x2="348" :y1="Y(r) + 11" :y2="Y(r) + 11" class="track" />
      <rect v-for="(g, i) in PLANS[k] ?? []" :key="i" :x="X(g[1])" :y="Y(r) + 2" :width="Math.max(X(g[2]) - X(g[1]), 2)" height="18" rx="1.5" :class="g[0] === 'run' ? COLOR[k] : g[0]" />
    </g>
    <text v-if="s === 0" :x="X(1) + 4" :y="Y(4) - 4" class="tag">{{ L('E arrives just after the start', 'E 在刚开始后到达') }}</text>

    <!-- the break in the axis -->
    <g class="break"><rect x="205" y="66" width="20" height="178" class="gap" /><text x="215" y="256" class="tag c">≈</text></g>

    <!-- the axis -->
    <line x1="44" x2="348" y1="246" y2="246" class="axis" />
    <g v-for="t in ticks" :key="t">
      <line :x1="X(t)" :x2="X(t)" y1="246" y2="251" class="axis" />
      <text :x="X(t)" y="262" class="tag c">{{ t.toLocaleString('en-US') }}</text>
    </g>
    <text x="44" y="276" class="tag">{{ L('iterations', '迭代次数') }}</text>

    <g v-if="decide">
      <line :x1="X(20)" :x2="X(20)" y1="66" y2="246" class="decide" />
      <text :x="X(20) + 5" y="66" class="tag hi">{{ L('B, C, D leave; E takes a seat', 'B、C、D 离开，E 坐进空位') }}</text>
    </g>

    <!-- the legend -->
    <g v-if="s === 2">
      <rect x="150" y="270" width="12" height="9" class="held" /><text x="166" y="278" class="tag">{{ L('seat empty, still held', '座位空着，却还占着') }}</text>
    </g>
    <g v-if="s >= 1 && s !== 2">
      <rect x="150" y="270" width="12" height="9" class="wait" /><text x="166" y="278" class="tag">{{ L('waiting for a seat', '等座位') }}</text>
    </g>
    <text x="12" y="304" class="tag hi">{{ result }}</text>
    <text x="12" y="320" class="tag">{{ firstToken }}</text>
  </svg>
</template>

<style scoped>
.track {
  stroke: var(--rule);
}
.axis {
  stroke: var(--rule-strong);
}
.gap {
  fill: var(--bg-elev);
}
.wait {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-dasharray: 2 2;
}
.held {
  fill: none;
  stroke: var(--muted);
  stroke-dasharray: 3 2;
}
.decide {
  stroke: var(--accent);
  stroke-width: 1.6;
}
text.w {
  fill: #fff;
  font-weight: 600;
}
</style>
