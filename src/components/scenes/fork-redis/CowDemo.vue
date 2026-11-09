<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * Copy-on-write for one page, in six steps: shared and read-only, a write faults, the kernel copies
 * the frame, the parent's entry is repointed and writable, the child still sees the old value, and
 * a later write costs nothing.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)
const copied = computed(() => s.value >= 2)
const moved = computed(() => s.value >= 3)
</script>

<template>
  <svg class="demo scene-drawing" viewBox="0 0 360 330" role="img" :aria-label="L('Copy-on-write, step by step', '写时复制分步演示')">
    <defs>
      <marker id="fd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head" />
      </marker>
    </defs>

    <!-- the two processes -->
    <rect x="12" y="10" width="110" height="36" rx="6" class="box strong" />
    <rect x="12" y="10" width="110" height="5" rx="2" class="p0" />
    <text x="67" y="33" class="lbl c">{{ L('Redis parent', 'Redis 父进程') }}</text>
    <rect x="238" y="10" width="110" height="36" rx="6" class="box" />
    <rect x="238" y="10" width="110" height="5" rx="2" class="p1" />
    <text x="293" y="33" class="lbl c">{{ L('Child', '子进程') }}</text>

    <!-- each one's page-table entry for this page -->
    <text x="67" y="66" class="tag c">{{ L('page-table entry', '页表项') }}</text>
    <rect x="22" y="72" width="90" height="30" rx="4" class="cell" :class="{ hot: s === 1 || s === 3 }" />
    <text x="32" y="91" class="sub">{{ L('page 2', '页 2') }}</text>
    <text x="102" y="91" class="flag end" :class="{ rw: moved }">{{ moved ? 'RW' : 'RO' }}</text>
    <text x="293" y="66" class="tag c">{{ L('page-table entry', '页表项') }}</text>
    <rect x="248" y="72" width="90" height="30" rx="4" class="cell" :class="{ hot: s === 4 }" />
    <text x="258" y="91" class="sub">{{ L('page 2', '页 2') }}</text>
    <text x="328" y="91" class="flag end">RO</text>

    <!-- physical memory: the old frame and, later, its copy -->
    <text x="180" y="66" class="tag c">{{ L('physical memory', '物理内存') }}</text>
    <rect x="136" y="72" width="88" height="30" rx="4" class="cell" :class="{ hot: s === 4 }" />
    <text x="180" y="91" class="code c">x = 1</text>
    <rect x="136" y="132" width="88" height="30" rx="4" :class="copied ? 'cell done' : 'cell free'" />
    <text x="180" y="151" class="code c" :class="{ 'on-text': copied }">{{ s < 2 ? '' : s === 2 ? 'x = 1' : 'x = 2' }}</text>
    <text x="180" y="176" class="tag c">{{ copied ? L('new frame, the parent’s', '新页帧，归父进程') : L('a free frame', '一个空闲页帧') }}</text>

    <!-- the mappings -->
    <path :d="moved ? 'M112,87 C128,87 124,147 134,147' : 'M112,87 L134,87'" class="map p" marker-end="url(#fd-arrow)" />
    <path d="M248,87 L226,87" class="map c2" marker-end="url(#fd-arrow)" />

    <!-- the copy itself -->
    <path d="M180,102 V130" class="flow" :class="{ show: s === 2 }" marker-end="url(#fd-arrow)" />
    <text x="186" y="120" class="note" :class="{ show: s === 2 }">{{ L('copy 4 KB', '复制 4 KB') }}</text>

    <!-- the write and the trap -->
    <text x="116" y="56" class="code fade" :class="{ show: s === 1 || s === 3 || s === 5 }">x = 2</text>
    <path d="M108,46 V70" class="flow" :class="{ show: s === 1 || s === 3 || s === 5 }" marker-end="url(#fd-arrow)" />
    <text x="67" y="122" class="note c" :class="{ show: s === 3 }">{{ L('retried, succeeds', '重新执行，成功') }}</text>
    <text x="67" y="122" class="note c" :class="{ show: s === 5 }">{{ L('writable: no trap', '可写：不陷入') }}</text>

    <!-- the child's view -->
    <text x="293" y="128" class="code c fade" :class="{ show: s >= 4 }">read: x = 1</text>
    <text x="293" y="146" class="note c" :class="{ show: s === 4 }">{{ L('the snapshot', '这就是快照') }}</text>

    <!-- the kernel -->
    <rect x="12" y="204" width="336" height="38" rx="6" class="box floor" />
    <text x="24" y="227" class="lbl">{{ L('Kernel', '内核') }}</text>
    <text x="92" y="227" class="tag" :class="{ hi: s === 1 || s === 2 || s === 3 }">{{
      s === 1 ? L('page fault: a write to a read-only entry', '页错误：写了一个只读的页表项')
        : s === 2 ? L('this frame has two users: copy it', '这个页帧有两个使用者：复制一份')
          : s === 3 ? L('repoint the entry, mark it writable', '让页表项指向新页帧，标记为可写')
            : ''
    }}</text>
    <path d="M67,104 V202" class="flow" :class="{ show: s === 1 }" marker-end="url(#fd-arrow)" />
    <text x="73" y="156" class="note" :class="{ show: s === 1 }">{{ L('trap', '陷入') }}</text>

    <!-- what it cost -->
    <text x="180" y="272" class="note c" :class="{ show: s === 5 }">{{ L('paid once per page, 4 KB each time', '每页只付一次，每次 4 KB') }}</text>
    <text x="180" y="290" class="tag c fade" :class="{ show: s === 0 }">{{ L('read-only here means: a write must call the kernel', '这里的“只读”意思是：一写就得叫内核') }}</text>
  </svg>
</template>

<style scoped>
.cell {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
  transition: stroke 0.3s, fill 0.3s;
}
.cell.hot {
  stroke: var(--accent);
  stroke-width: 2;
}
.cell.free {
  stroke: var(--rule);
  stroke-dasharray: 3 3;
}
.cell.done {
  fill: var(--p0);
  stroke: none;
}
.on-text {
  fill: #fff;
}
.flag {
  font-size: 9.5px;
  font-weight: 700;
  fill: var(--muted);
}
.flag.rw {
  fill: var(--ok);
}
.map {
  fill: none;
  stroke-width: 1.4;
}
.map.p {
  stroke: var(--p0);
}
.map.c2 {
  stroke: var(--p1);
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
.note {
  font-size: 9.5px;
  font-weight: 600;
  fill: var(--accent-ink);
  opacity: 0;
  transition: opacity 0.35s;
}
.fade {
  opacity: 0;
  transition: opacity 0.35s;
}
.show {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .flow,
  .note,
  .fade,
  .cell {
    transition: none;
  }
}
</style>
