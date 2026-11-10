<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * One clock_gettime() through the vDSO, colliding with a timer tick: the reader takes seq, reads half
 * the values, the kernel bumps seq and rewrites them, the reader reads the rest, sees seq has moved,
 * and retries. The values are drawn as old (t1) and new (t2), not as real numbers.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const CODE = computed(() => [
  'do {',
  '  seq = vc->seq;          /* ' + L('odd: wait', '奇数就等') + ' */',
  '  cycles = rdtsc();',
  '  ns = calc(cycles, vc);',
  '} while (vc->seq != seq);',
  'return ns;',
])
// which reader lines are running at each step
const HOT: number[][] = [[], [1], [2, 3], [], [3], [4], [1, 2, 3, 4, 5]]
const hot = (i: number) => HOT[s.value]?.includes(i)

const seq = computed(() => (s.value < 3 ? 42 : s.value === 3 ? 43 : 44))
const FIELDS = ['cycle_last', 'mult', 'shift', 'base']
// the kernel's stores land at step 3
const isNew = computed(() => s.value >= 3)
// which fields the reader has taken, and from which version
const taken = (i: number): '' | 'old' | 'new' => {
  if (s.value === 6) return 'new'
  if (s.value >= 2 && i < 2) return 'old'
  if (s.value >= 4 && s.value <= 5 && i >= 2) return 'new'
  return ''
}
// the kernel writer's three lines
const WRITER = computed(() => [
  ['seq++', L('odd: an update is in progress', '变成奇数：正在更新')],
  [L('write the values', '写入新值'), 'cycle_last · mult · shift · base'],
  ['seq++', L('even again: done', '重新变回偶数：写完了')],
])
const writerHot = (i: number) => (s.value === 3 ? i < 2 : s.value === 4 ? i === 2 : false)

const local = computed(() => {
  switch (s.value) {
    case 0:
      return L('a plain function call into [vdso]: no trap', '一次普通的函数调用，进入 [vdso]：不陷入')
    case 1:
      return L('seq = 42: even, so no update is running', 'seq = 42：偶数，没有更新在进行')
    case 2:
      return L('took cycle_last and mult (t1)…', '读到了 cycle_last 和 mult（t1）……')
    case 3:
      return L('…and is paused here, mid-read', '……读到一半，停在这里')
    case 4:
      return L('took shift and base (t2): a mix of t1 and t2', '又读到 shift 和 base（t2）：t1 和 t2 混在了一起')
    case 5:
      return L('seq is 44, not 42: discard ns, start over', 'seq 是 44，不是 42：丢掉 ns，从头再来')
    default:
      return L('44 before, 44 after: all t2, return ns', '前后都是 44：全是 t2，返回 ns')
  }
})
const bad = computed(() => s.value === 4 || s.value === 5)
</script>

<template>
  <svg class="demo" viewBox="0 0 360 420" role="img" :aria-label="L('A vDSO clock read, step by step', 'vDSO 读时钟，分步演示')">
    <!-- the reader: your process on CPU 0, in user mode -->
    <text x="12" y="14" class="cap">{{ L('CPU 0, user mode: your clock_gettime() in [vdso]', 'CPU 0，用户态：[vdso] 里你的 clock_gettime()') }}</text>
    <rect x="8" y="20" width="344" height="92" rx="6" class="code-box" />
    <text v-for="(c, i) in CODE" :key="i" :x="c.startsWith(' ') ? 30 : 18" :y="36 + i * 14" class="code" :class="{ hot: hot(i), fail: s === 5 && i === 4 }">{{ c.trim() }}</text>
    <rect x="8" y="118" width="344" height="26" rx="5" class="local" :class="{ bad }" />
    <text x="18" y="135" class="mine" :class="{ bad }">{{ local }}</text>

    <!-- what the reader holds so far, by version -->
    <text x="12" y="164" class="tiny">{{ L('your copy:', '你读到的：') }}</text>
    <g v-for="(f, i) in FIELDS" :key="'c' + f">
      <rect :x="82 + i * 67" y="153" width="63" height="16" rx="2" class="cell" :class="taken(i) === 'old' ? 'v1' : taken(i) === 'new' ? 'v2' : 'none'" />
      <text :x="113.5 + i * 67" y="164" class="tiny c" :class="{ 'on-fill': taken(i) !== '' }">{{ taken(i) === '' ? f : `${f} ${taken(i) === 'old' ? 't1' : 't2'}` }}</text>
    </g>

    <!-- [vvar]: one physical page, read-only to every process -->
    <text x="12" y="192" class="cap">{{ L('[vvar]: the kernel’s page, read-only to you', '[vvar]：内核的那一页，对你只读') }}</text>
    <rect x="12" y="198" width="64" height="44" rx="3" class="cell seq" :class="{ odd: seq % 2 === 1 }" />
    <text x="44" y="214" class="tiny c">seq</text>
    <text x="44" y="233" class="num c">{{ seq }}</text>
    <g v-for="(f, i) in FIELDS" :key="f">
      <rect :x="82 + i * 67" y="198" width="63" height="44" rx="3" class="cell" :class="isNew ? 'v2' : 'v1'" />
      <text :x="113.5 + i * 67" y="214" class="tiny c on-fill">{{ f }}</text>
      <text :x="113.5 + i * 67" y="233" class="val c on-fill">{{ isNew ? 't2' : 't1' }}</text>
    </g>
    <text x="12" y="258" class="tiny">{{ L('blue: values from the last tick (t1) · green: from this tick (t2)', '蓝：上一个滴答的值（t1）· 绿：这个滴答的值（t2）') }}</text>

    <!-- the writer: the kernel on CPU 1 -->
    <text x="12" y="286" class="cap">{{ L('CPU 1, kernel: a timer tick runs update_vsyscall()', 'CPU 1，内核：时钟滴答运行 update_vsyscall()') }}</text>
    <rect x="8" y="292" width="344" height="62" rx="6" class="kern" />
    <g v-for="(w, i) in WRITER" :key="i">
      <text x="18" :y="311 + i * 17" class="code" :class="{ hot: writerHot(i) }">{{ w[0] }}</text>
      <text x="130" :y="311 + i * 17" class="tiny" :class="{ hotnote: writerHot(i) }">{{ w[1] }}</text>
    </g>

    <!-- the point of each step -->
    <text x="180" y="382" class="note c" :class="{ show: s === 3 }">{{ L('the kernel never waits for a reader', '内核从不等读的一方') }}</text>
    <text x="180" y="382" class="note bad c" :class="{ show: s === 5 }">{{ L('a mixed read is caught by seq', '混在一起的读数被 seq 识破') }}</text>
    <text x="180" y="382" class="note c" :class="{ show: s === 6 }">{{ L('no lock, no trap, nothing written by you', '没有锁，没有陷入，你什么也没写') }}</text>
    <text x="180" y="402" class="tiny c" :class="{ show: s === 6 }" opacity="0">{{ L('the cost of the collision: one more pass', '撞上一次更新的代价：多读一遍') }}</text>
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
.kern {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
}
.local {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  transition: stroke 0.3s;
}
.local.bad {
  stroke: var(--p3);
}
.mine {
  font-size: 10px;
  font-weight: 600;
  fill: var(--accent-ink);
}
.mine.bad {
  fill: var(--p3);
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
.code.fail {
  fill: var(--p3);
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
.tiny.hotnote {
  fill: var(--accent-ink);
}
.on-fill {
  fill: #fff;
}
.num {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 700;
  fill: var(--ink);
}
.val {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
}
.c {
  text-anchor: middle;
}
.cell {
  stroke: none;
  transition:
    fill 0.4s,
    stroke 0.3s,
    stroke-width 0.3s;
}
.cell.seq {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.cell.seq.odd {
  stroke: var(--p3);
  stroke-width: 2;
}
.cell.v1 {
  fill: var(--p0);
}
.cell.v2 {
  fill: var(--p2);
}
.cell.none {
  fill: var(--bg-elev);
  stroke: var(--rule);
  stroke-width: 1;
}
.note {
  font-size: 10px;
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
@media (prefers-reduced-motion: reduce) {
  .note,
  .cell,
  .code {
    transition: none;
  }
}
</style>
