<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * One small malloc through glibc, following the article's simplified path: size the chunk; try the
 * thread's tcache; lock an arena and try the exact small bin; walk the unsorted bin, sorting what
 * does not fit; split the smallest large chunk that fits; only then the top chunk. The chunk sizes
 * are invented for the example; the 112 comes from the rule (100 + 8 of header, rounded up to 16).
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const SIZES = [32, 48, 64, 80, 112]
const colX = (i: number) => 104 + i * 48
const TCACHE = [2, 1, 3, 1, 0] // free chunks per size in the thread's cache
/** chunks in each small bin, growing when the unsorted bin is sorted */
const small = computed(() => [1, s.value >= 3 ? 2 : 1, s.value >= 3 ? 1 : 0, 1, 0])
const UNSORTED = [
  { n: 64, w: 34 },
  { n: 1504, w: 96 },
  { n: 48, w: 28 },
]
const hot = (n: number) => s.value === n
</script>

<template>
  <svg class="scene-drawing" viewBox="0 0 360 420" role="img" :aria-label="L('One call to malloc through glibc', 'glibc 里的一次 malloc 调用')">
    <defs>
      <marker id="md-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <g id="md-lock">
        <path d="M2.5,5 V3.5 a2.5,2.5 0 0 1 5,0 V5" class="shackle" />
        <rect x="1" y="5" width="8" height="6" rx="1.2" class="lockbody" />
      </g>
    </defs>

    <!-- the request -->
    <rect x="8" y="8" width="344" height="30" rx="5" class="box" :class="{ on: hot(0) }" />
    <text x="18" y="27" class="code">malloc(100)</text>
    <text x="344" y="27" class="tag end" :class="{ strong: hot(0) }">{{ L('100 + 8 of header, rounded up to 16: a 112-byte chunk', '100 + 8 字节头部，取整到 16：112 字节的块') }}</text>

    <!-- this thread's cache -->
    <rect x="8" y="46" width="344" height="58" rx="5" class="box" :class="{ on: hot(1) }" />
    <text x="16" y="62" class="tag hi">tcache</text>
    <text x="16" y="76" class="tag">{{ L('no lock', '不加锁') }}</text>
    <g v-for="(n, i) in TCACHE" :key="'t' + i">
      <text :x="colX(i) + 16" y="62" class="num c" :class="{ strong: SIZES[i] === 112 }">{{ SIZES[i] }}</text>
      <rect v-for="k in n" :key="k" :x="colX(i) + 5" :y="98 - k * 9" width="22" height="7" rx="1" class="chunk" />
      <rect v-if="!n" :x="colX(i) + 5" y="82" width="22" height="16" rx="1" class="none" :class="{ look: hot(1) }" />
    </g>

    <!-- the arena -->
    <rect x="8" y="112" width="344" height="224" rx="5" class="box" :class="{ on: s >= 2 && s <= 5 }" />
    <text x="16" y="128" class="tag hi">{{ L('arena, shared with other threads', 'arena，与其他线程共享') }}</text>
    <use href="#md-lock" x="334" y="118" :class="['lock', { held: s >= 2 }]" />
    <text x="328" y="128" class="tag end" :class="{ strong: s >= 2 }">{{ s >= 2 ? L('locked', '已加锁') : L('free', '未加锁') }}</text>

    <!-- small bins -->
    <rect x="16" y="136" width="328" height="58" rx="4" class="inner" :class="{ on: hot(2) }" />
    <text x="24" y="152" class="tag hi">{{ L('small bins', '小桶') }}</text>
    <text x="24" y="166" class="tag">{{ L('exact sizes', '精确大小') }}</text>
    <g v-for="(n, i) in small" :key="'s' + i">
      <text :x="colX(i) + 16" y="150" class="num c" :class="{ strong: SIZES[i] === 112 }">{{ SIZES[i] }}</text>
      <rect v-for="k in n" :key="k" :x="colX(i) + 5" :y="188 - k * 9" width="22" height="7" rx="1" class="chunk" :class="{ fresh: s === 3 && k === n && (i === 1 || i === 2) }" />
      <rect v-if="!n" :x="colX(i) + 5" y="172" width="22" height="16" rx="1" class="none" :class="{ look: hot(2) && SIZES[i] === 112 }" />
    </g>

    <!-- unsorted bin -->
    <rect x="16" y="200" width="328" height="44" rx="4" class="inner" :class="{ on: hot(3) }" />
    <text x="24" y="216" class="tag hi">{{ L('unsorted bin', '未排序桶') }}</text>
    <text x="24" y="230" class="tag">{{ L('recently freed', '最近释放的') }}</text>
    <g class="unsorted" :class="{ gone: s >= 3 }">
      <template v-for="(c, i) in UNSORTED" :key="c.n">
        <rect :x="UNSORTED.slice(0, i).reduce((a, u) => a + u.w + 6, 110)" y="212" :width="c.w" height="20" rx="2" class="chunk light" />
        <text :x="UNSORTED.slice(0, i).reduce((a, u) => a + u.w + 6, 110) + c.w / 2" y="226" class="num c strong">{{ c.n }}</text>
      </template>
    </g>
    <text x="176" y="226" class="note" :class="{ show: s === 3 }">{{ L('no 112: each is sorted into its bin', '没有 112：各自归入自己的桶') }}</text>

    <!-- large bins -->
    <rect x="16" y="250" width="328" height="42" rx="4" class="inner" :class="{ on: hot(4) }" />
    <text x="24" y="266" class="tag hi">{{ L('large bins', '大桶') }}</text>
    <text x="24" y="280" class="tag">{{ L('kept in size order', '按大小排序') }}</text>
    <g class="fade" :class="{ show: s === 3 }">
      <rect x="110" y="262" width="96" height="20" rx="2" class="chunk light" />
      <text x="158" y="276" class="num c strong">1504</text>
    </g>
    <g class="fade" :class="{ show: s >= 4 }">
      <rect x="110" y="262" width="12" height="20" rx="2" class="taken" />
      <rect x="123" y="262" width="83" height="20" rx="2" class="chunk light" />
      <text x="165" y="276" class="num c strong">1392</text>
      <text x="212" y="276" class="note show">{{ L('112 taken, the rest stays free', '切走 112，余下的继续空闲') }}</text>
    </g>

    <!-- top chunk -->
    <rect x="16" y="298" width="328" height="30" rx="4" class="top" :class="{ on: hot(5) }" />
    <text x="24" y="317" class="sub ink">{{ L('top chunk', '顶端块') }}</text>
    <text x="340" y="317" class="tag end" :class="{ strong: hot(5) }">{{ s === 5 ? L('not needed this time', '这次用不上') : L('grows with brk or mmap', '不够时用 brk 或 mmap 扩展') }}</text>

    <!-- the kernel -->
    <path d="M180,328 L180,348" class="link solid" />
    <rect x="8" y="348" width="344" height="26" rx="5" class="box floor" />
    <text x="180" y="365" class="sub c ink">{{ L('kernel', '内核') }}</text>

    <!-- what comes back -->
    <rect x="8" y="384" width="344" height="28" rx="5" class="box result" :class="{ on: s >= 5 }" />
    <text x="180" y="402" class="sub c ink">{{ s >= 5 ? L('returned to the program: the data after the 112-byte chunk’s header', '返回给程序：112 字节块头部之后的数据区') : L('returned to the program', '返回给程序') }}</text>
  </svg>
</template>

<style scoped>
.ink {
  fill: var(--ink-2);
}
.num {
  font-size: 8.5px;
  fill: var(--muted);
}
.num.strong,
.tag.strong {
  fill: var(--accent-ink);
  font-weight: 600;
}
.box.on,
.inner.on,
.top.on {
  stroke: var(--accent);
  stroke-width: 1.8;
}
.inner {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
  transition: stroke 0.3s;
}
.top {
  fill: var(--rule);
  stroke: var(--rule-strong);
  stroke-width: 1;
  transition: stroke 0.3s;
}
.result {
  transition: stroke 0.3s;
}
.chunk {
  fill: var(--p2);
}
.chunk.light {
  fill: var(--bg-elev);
  stroke: var(--p2);
}
.chunk.fresh {
  fill: var(--accent);
}
.taken {
  fill: var(--accent);
}
.none {
  fill: none;
  stroke: var(--rule-strong);
  stroke-width: 1;
  stroke-dasharray: 2 2;
}
.none.look {
  stroke: var(--accent);
  stroke-width: 1.6;
}
.lock {
  opacity: 0.35;
  transition: opacity 0.3s;
}
.lock.held {
  opacity: 1;
}
.shackle {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.3;
}
.lockbody {
  fill: var(--ink-2);
}
.note {
  font-size: 9.5px;
  font-weight: 600;
  fill: var(--accent-ink);
  opacity: 0;
  transition: opacity 0.35s;
}
.note.show {
  opacity: 1;
}
.fade {
  opacity: 0;
  transition: opacity 0.35s;
}
.fade.show {
  opacity: 1;
}
.unsorted {
  transition: opacity 0.35s;
}
.unsorted.gone {
  opacity: 0;
}
</style>
