<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * A loop branch taken nine times, not taken once, then taken again as the loop restarts, guessed by
 * a one-bit predictor (steps 1–3) and a two-bit counter (steps 4–6). Step 0 only introduces the
 * sequence. One row per predictor; each cell shows the guess and whether it was right.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

// the sequence: nine taken, the exit, then the first iteration of the next run
const SEQ = ['T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'N', 'T']
const cx = (i: number) => 40 + i * 28 + (i >= 10 ? 8 : 0)

// the guess for each outcome: the one-bit predictor repeats the last outcome
const ONE = SEQ.map((_, i) => (i === 0 ? 'T' : SEQ[i - 1]))
// the two-bit counter, starting at 3
const COUNT: number[] = []
SEQ.reduce((c, o) => {
  COUNT.push(c)
  return o === 'T' ? Math.min(3, c + 1) : Math.max(0, c - 1)
}, 3)
const TWO = COUNT.map((c) => (c >= 2 ? 'T' : 'N'))

// how many outcomes each row has reached at this step
const oneUpto = computed(() => (s.value < 1 ? 0 : s.value === 1 ? 9 : s.value === 2 ? 10 : 11))
const twoUpto = computed(() => (s.value < 4 ? 0 : s.value === 4 ? 9 : s.value === 5 ? 10 : 11))
const bitLabel = computed(() => (s.value >= 2 ? 'N' : 'T'))
const counter = computed(() => (s.value < 5 ? 3 : s.value === 5 ? 2 : 3))
const onActive = computed(() => s.value >= 1 && s.value <= 3)
const twoActive = computed(() => s.value >= 4)
</script>

<template>
  <svg class="scene-drawing" viewBox="0 0 360 396" role="img" :aria-label="L('A loop branch under one-bit and two-bit prediction', '一位与两位预测下的循环分支')">
    <!-- the sequence -->
    <text x="14" y="22" class="tag">{{ L('the branch: taken (T) or not (N)', '这个分支：跳转（T）或不跳转（N）') }}</text>
    <g v-for="(o, i) in SEQ" :key="i">
      <rect :x="cx(i) - 12" y="30" width="24" height="26" rx="3" class="box" :class="{ exit: o === 'N' }" />
      <text :x="cx(i)" y="48" class="code c">{{ o }}</text>
    </g>
    <text :x="cx(4.5)" y="72" class="tag c">{{ L('one run of the loop', '循环的一轮') }}</text>
    <text :x="cx(10)" y="72" class="tag c">{{ L('next run', '下一轮') }}</text>
    <path :d="`M${cx(0) - 12},62 H${cx(9) + 12}`" class="br" />

    <!-- one bit -->
    <text x="14" y="104" class="lbl">{{ L('One bit: the last outcome', '一位：最后一次的结果') }}</text>
    <g v-for="(g, i) in ONE" :key="'o' + i" class="fade" :class="{ show: i < oneUpto }">
      <rect :x="cx(i) - 12" y="112" width="24" height="26" rx="3" :class="g === SEQ[i] ? 'hit' : 'miss'" />
      <text :x="cx(i)" y="130" class="code c ink">{{ g }}</text>
    </g>
    <text x="346" y="104" class="tally end" :class="{ show: oneUpto === 11 }">{{ L('2 misses per run', '每轮错 2 次') }}</text>

    <!-- what the one-bit predictor holds -->
    <g class="fade" :class="{ show: onActive }">
      <rect x="14" y="150" width="60" height="30" rx="5" class="box" />
      <text x="44" y="170" class="lbl c">{{ bitLabel }}</text>
      <text x="82" y="169" class="tag">{{ L('what the bit now says', '这一位现在写着的') }}</text>
    </g>

    <line x1="14" y1="196" x2="346" y2="196" class="rule" />

    <!-- two bits -->
    <text x="14" y="222" class="lbl">{{ L('Two bits: a saturating counter', '两位：饱和计数器') }}</text>
    <g v-for="(g, i) in TWO" :key="'t' + i" class="fade" :class="{ show: i < twoUpto }">
      <rect :x="cx(i) - 12" y="230" width="24" height="26" rx="3" :class="g === SEQ[i] ? 'hit' : 'miss'" />
      <text :x="cx(i)" y="248" class="code c ink">{{ g }}</text>
    </g>
    <text x="346" y="222" class="tally end" :class="{ show: twoUpto === 11 }">{{ L('1 miss per run', '每轮错 1 次') }}</text>

    <!-- the counter -->
    <g class="fade" :class="{ show: twoActive }">
      <text x="62" y="284" class="tag c">{{ L('predict not taken', '预测不跳转') }}</text>
      <text x="166" y="284" class="tag c">{{ L('predict taken', '预测跳转') }}</text>
      <g v-for="n in 4" :key="n">
        <circle :cx="44 + (n - 1) * 49" cy="316" r="15" class="box" :class="{ cur: n - 1 === counter }" />
        <text :x="44 + (n - 1) * 49" y="320.5" class="lbl c" :class="{ onc: n - 1 === counter }">{{ n - 1 }}</text>
      </g>
      <text x="228" y="312" class="tag">{{ L('the counter', '计数器') }}</text>
      <text x="228" y="326" class="tag">{{ L('starts at 3 here', '这里从 3 开始') }}</text>
    </g>

    <!-- legend -->
    <rect x="14" y="360" width="14" height="14" rx="2" class="hit" />
    <text x="33" y="371" class="tag">{{ L('guess right', '猜对') }}</text>
    <rect x="94" y="360" width="14" height="14" rx="2" class="miss" />
    <text x="113" y="371" class="tag">{{ L('guess wrong', '猜错') }}</text>
    <text x="346" y="371" class="tag end">{{ L('letter: the guess', '字母：猜的是什么') }}</text>
  </svg>
</template>

<style scoped>
.box {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1.2;
}
.box.exit {
  stroke: var(--ink-2);
  stroke-width: 1.6;
}
.box.cur {
  fill: var(--accent);
  stroke: var(--accent);
}
.hit {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
}
.miss {
  fill: var(--p3);
  opacity: 0.7;
}
.code {
  font-family: var(--font-mono);
  font-size: 10.5px;
  fill: var(--ink-2);
}
.ink {
  fill: var(--ink);
}
.lbl {
  font-size: 11.5px;
  font-weight: 600;
  fill: var(--ink);
}
.lbl.onc {
  fill: #fff;
}
.tag {
  font-size: 9.5px;
  fill: var(--muted);
}
.c {
  text-anchor: middle;
}
.end {
  text-anchor: end;
}
.br {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
}
.rule {
  stroke: var(--rule);
}
.tally {
  font-size: 10px;
  font-weight: 600;
  fill: var(--accent-ink);
  opacity: 0;
  transition: opacity 0.3s;
}
.fade {
  opacity: 0;
  transition: opacity 0.3s;
}
.show {
  opacity: 1 !important;
}
@media (prefers-reduced-motion: reduce) {
  .fade,
  .tally {
    transition: none;
  }
}
</style>
