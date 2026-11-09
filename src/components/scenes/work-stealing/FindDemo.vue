<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * findRunnable() for an M whose P has run dry, in six steps: the every-61st-tick check of the
 * global queue, its own runnext and local queue, a batch from the global queue, a non-blocking
 * network poll, then stealing: a random visit order (P0 empty, P1 with six goroutines) and half of
 * P1's queue taken from the head. 8 of each queue's 256 slots are drawn.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)
const CX = [62, 180, 298]
/** goroutines in each queue: P1 loses its three oldest to P2 in the last step */
const count = (i: number) => (i === 1 ? (s.value >= 5 ? 3 : 6) : i === 2 ? (s.value >= 5 ? 2 : 0) : 0)
/** P1's slots: after the steal, its three newest move up to the head */
const LIST = computed(() => [
  { n: '1', t: L('every 61st tick: global queue first', '每第 61 个节拍：先看全局队列'), r: L('not this tick', '不是这一拍') },
  { n: '2', t: L('own P: runnext, then local queue', '自己的 P：runnext，再本地队列'), r: L('empty', '空') },
  { n: '3', t: L('global queue: take a batch', '全局队列：取一批'), r: L('empty', '空') },
  { n: '4', t: L('poll the network, without blocking', '非阻塞地轮询网络'), r: L('nothing ready', '没有就绪的') },
  { n: '5', t: L('steal: other Ps in random order', '窃取：随机顺序访问其他 P'), r: s.value >= 5 ? L('took 3 from P1', '从 P1 拿了 3 个') : L('P0 empty, P1 has 6', 'P0 空，P1 有 6 个') },
  { n: '6', t: L('nothing anywhere: park the thread', '哪儿都没有：让线程睡下'), r: L('not needed', '用不着') },
])
const state = (k: number) => (k === Math.min(s.value, 4) || (s.value === 5 && k === 4) ? 'now' : k < s.value || (s.value === 5 && k === 5) ? 'done' : 'todo')
</script>

<template>
  <svg class="scene-drawing demo" viewBox="0 0 360 378" role="img" :aria-label="L('findRunnable, step by step', 'findRunnable 分步演示')">
    <defs>
      <marker id="wf-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="hothead" />
      </marker>
    </defs>

    <!-- the global queue and the netpoller -->
    <rect x="96" y="8" width="168" height="38" rx="5" class="box" :class="{ hl: s === 0 || s === 2 }" />
    <text x="180" y="22" class="lbl c">{{ L('global run queue', '全局运行队列') }}</text>
    <text x="180" y="38" class="tiny c">{{ L('(empty)', '（空）') }}</text>
    <rect x="272" y="8" width="80" height="38" rx="5" class="box gate" :class="{ hl: s === 3 }" />
    <text x="312" y="22" class="lbl c">netpoller</text>
    <text x="312" y="38" class="tiny c">epoll</text>

    <!-- three Ps -->
    <g v-for="(cx, i) in CX" :key="i">
      <rect :x="cx - 54" y="64" width="108" height="150" rx="6" class="box strong" :class="{ hl: (s === 1 && i === 2) || (s === 4 && i < 2) || (s === 5 && i >= 1) }" />
      <text :x="cx - 44" y="81" class="lbl">P{{ i }}</text>
      <rect :x="cx + 4" y="69" width="42" height="16" rx="3" class="slot" />
      <text :x="cx + 25" y="80" class="tiny c">runnext</text>
      <rect v-for="k in 8" :key="k" :x="cx - 44" :y="94 + (k - 1) * 13" width="88" height="11" rx="2" :class="k <= count(i) ? (i === 2 ? 'g moved' : 'g') : 'slot'" />
      <text v-if="s === 4 && i === 0" :x="cx" y="206" class="tiny c bad">{{ L('empty', '空') }}</text>
      <text v-if="s >= 4 && i === 1" :x="cx" y="206" class="tiny c strong">{{ s >= 5 ? L('6 − 3 = 3 left', '6 − 3，剩 3 个') : L('6 waiting', '6 个在等') }}</text>
      <text v-if="i === 2" :x="cx" y="206" class="tiny c strong">{{ s >= 5 ? L('1 runs, 2 wait', '1 个运行，2 个排队') : L('empty', '空') }}</text>
    </g>
    <!-- the visits, then the steal -->
    <path d="M310,64 C300,48 78,48 70,64" class="visit" :class="{ show: s === 4 }" marker-end="url(#wf-arrow)" />
    <path d="M286,64 C270,50 214,50 200,64" class="visit" :class="{ show: s === 4 }" marker-end="url(#wf-arrow)" />
    <path d="M200,64 C214,48 270,48 286,64" class="flow" :class="{ show: s === 5 }" marker-end="url(#wf-arrow)" />
    <text x="292" y="59" class="note" :class="{ show: s === 5 }">{{ L('takes 3', '拿走 3 个') }}</text>

    <!-- M2, looking -->
    <path d="M298,214 L298,226" class="link" />
    <rect x="268" y="226" width="60" height="22" rx="4" class="box" :class="{ hl: s === 5 }" />
    <text x="298" y="241" class="lbl c">M2</text>
    <text x="262" y="241" class="tiny end shown">{{ s >= 5 ? L('runs a stolen G', '运行偷来的 G') : 'findRunnable()' }}</text>

    <!-- the order of the search -->
    <rect x="8" y="258" width="344" height="114" rx="5" class="list-box" />
    <g v-for="(it, k) in LIST" :key="it.n">
      <circle cx="22" :cy="274 + k * 17" r="6" :class="['dot', state(k)]" />
      <text x="22" :y="277 + k * 17" class="tiny c on-fill b">{{ it.n }}</text>
      <text x="34" :y="277.5 + k * 17" class="item" :class="state(k)">{{ it.t }}</text>
      <text x="344" :y="277.5 + k * 17" class="tiny end" :class="{ shown: state(k) !== 'todo' }">{{ it.r }}</text>
    </g>
  </svg>
</template>

<style scoped>
.lbl {
  font-size: 11.5px;
  font-weight: 600;
  fill: var(--ink);
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.tiny.end {
  text-anchor: end;
}
.end {
  text-anchor: end;
}
.c {
  text-anchor: middle;
}
.b {
  font-weight: 700;
}
.on-fill {
  fill: #fff;
}
.strong {
  fill: var(--ink-2);
  font-weight: 600;
}
.bad {
  fill: var(--p3);
}
.box {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1.2;
  transition: stroke 0.3s;
}
.box.strong {
  stroke: var(--ink-2);
  stroke-width: 1.4;
}
.box.gate {
  fill: var(--bg-sunk);
}
.box.hl {
  stroke: var(--accent);
  stroke-width: 2.2;
}
.g {
  fill: var(--p0);
}
.g.moved {
  fill: var(--p1);
}
.slot {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 0.8;
}
.link {
  stroke: var(--ink-2);
}
.visit,
.flow {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.4;
  opacity: 0;
  transition: opacity 0.35s;
}
.visit {
  stroke-dasharray: 3 3;
}
.hothead {
  fill: var(--accent);
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
.list-box {
  fill: var(--bg-sunk);
  stroke: var(--rule);
}
.dot {
  fill: var(--rule-strong);
}
.dot.now {
  fill: var(--accent);
}
.dot.done {
  fill: var(--muted);
}
.item {
  font-size: 9.5px;
  fill: var(--muted);
}
.item.now {
  fill: var(--accent-ink);
  font-weight: 600;
}
.item.done {
  fill: var(--ink-2);
}
.tiny.end:not(.shown) {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .visit,
  .flow,
  .note,
  .box {
    transition: none;
  }
}
</style>
