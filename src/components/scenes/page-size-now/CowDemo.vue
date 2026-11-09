<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * Copy-on-write in six steps, four of cow.c's 16,384 pages: the parent's entries and frames; fork()
 * copies the entries, read-only on both sides; reads need nothing; a write traps; the kernel copies
 * that one page; after every page is written, the child has copies and the parent is untouched.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)
const ROWS = [0, 1, 2, 3]
const y = (k: number) => 72 + k * 36
const cy = (k: number) => 232 + k * 36
/** has the child's page k been copied yet? */
const copied = (k: number) => s.value >= 5 || (s.value === 4 && k === 1)
const perm = computed(() => (s.value >= 1 ? 'r-' : 'rw'))
</script>

<template>
  <svg class="scene-drawing" viewBox="0 0 360 392" role="img" :aria-label="L('Copy-on-write after fork(), step by step', 'fork() 之后的写时复制，分步演示')">
    <defs>
      <marker id="cw-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- headings -->
    <text x="56" y="44" class="lbl c">{{ L('Parent', '父进程') }}</text>
    <text x="56" y="58" class="sub c">{{ L('page table', '页表') }}</text>
    <text x="180" y="44" class="lbl c">{{ L('Frames', '物理帧') }}</text>
    <text x="180" y="58" class="sub c">{{ L('physical memory', '物理内存') }}</text>
    <g class="fade" :class="{ show: s >= 1 }">
      <text x="304" y="44" class="lbl c">{{ L('Child', '子进程') }}</text>
      <text x="304" y="58" class="sub c">{{ L('page table', '页表') }}</text>
    </g>

    <template v-for="k in ROWS" :key="k">
      <!-- the parent's entry and its frame -->
      <rect x="8" :y="y(k)" width="96" height="26" rx="3" class="pte a" />
      <text x="56" :y="y(k) + 17" class="code c">{{ L('page', '页') }} {{ k }} · {{ perm }}</text>
      <path :d="`M104,${y(k) + 13} L148,${y(k) + 13}`" class="call" marker-end="url(#cw-arrow)" />
      <rect x="150" :y="y(k)" width="60" height="26" rx="3" class="frame a" />
      <text x="180" :y="y(k) + 17" class="code c on">{{ L('frame', '帧') }} {{ 7 + k }}</text>

      <!-- the child's entry: first the same frame, later its own copy -->
      <g class="fade" :class="{ show: s >= 1 }">
        <rect x="256" :y="y(k)" width="96" height="26" rx="3" class="pte b" :class="{ trap: s === 3 && k === 1 }" />
        <text x="304" :y="y(k) + 17" class="code c">{{ L('page', '页') }} {{ k }} · {{ copied(k) ? 'rw' : 'r-' }}</text>
        <path v-if="!copied(k)" :d="`M256,${y(k) + 13} L212,${y(k) + 13}`" class="link b" marker-end="url(#cw-arrow)" />
        <path v-else :d="`M256,${y(k) + 13} C232,${y(k) + 13} 236,${cy(k) + 13} 212,${cy(k) + 13}`" class="call b" marker-end="url(#cw-arrow)" />
      </g>
      <g class="fade" :class="{ show: copied(k) }">
        <rect x="150" :y="cy(k)" width="60" height="26" rx="3" class="frame b" />
        <text x="180" :y="cy(k) + 17" class="code c on">{{ L('frame', '帧') }} {{ 31 + k }}</text>
      </g>
    </template>

    <!-- 2: reads need nothing -->
    <g class="fade" :class="{ show: s === 2 }">
      <text x="304" y="232" class="tag hi c">{{ L('reads: no faults', '读：没有页错误') }}</text>
    </g>
    <!-- 3: the write traps -->
    <g class="fade" :class="{ show: s === 3 }">
      <text x="304" y="232" class="tag bad-text c">{{ L('write to page 1: r- → trap', '写第 1 页：r- → 陷入') }}</text>
    </g>
    <!-- 4: one copy -->
    <g class="fade" :class="{ show: s === 4 }">
      <text x="56" y="232" class="tag hi c">{{ L('kernel copies', '内核复制') }}</text>
      <text x="56" y="246" class="tag hi c">{{ L('frame 8 → 32', '帧 8 → 32') }}</text>
    </g>
    <!-- 5: done -->
    <g class="fade" :class="{ show: s === 5 }">
      <text x="56" y="232" class="tag hi c">{{ L('≈16,384 faults,', '约 16,384 次页错误，') }}</text>
      <text x="56" y="246" class="tag hi c">{{ L('one per page', '每页一次') }}</text>
      <text x="56" y="268" class="tag c">{{ L('parent: untouched', '父进程：没被动过') }}</text>
    </g>

    <text x="180" y="20" class="tag c">{{ L('4 of the 16,384 pages of 64 MiB', '64 MiB 的 16,384 页中的 4 页') }}</text>
  </svg>
</template>

<style scoped>
.pte {
  fill: var(--bg-elev);
  stroke-width: 1.4;
  transition: stroke 0.3s;
}
.pte.a {
  stroke: var(--p0);
}
.pte.b {
  stroke: var(--p1);
}
.pte.trap {
  stroke: var(--p3);
  stroke-width: 2.2;
}
.frame.a {
  fill: var(--p0);
}
.frame.b {
  fill: var(--p1);
}
.code.on {
  fill: #fff;
}
.link.b {
  stroke: var(--p1);
}
.call.b {
  stroke: var(--p1);
}
.fade {
  opacity: 0;
  transition: opacity 0.4s;
}
.fade.show {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .fade,
  .pte {
    transition: none;
  }
}
</style>
