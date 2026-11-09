<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * One x86-64 system call, entry only, in six steps: load the registers, SYSCALL, swapgs and park the
 * stack pointer, switch CR3, build pt_regs on the kernel stack, call the handler. On the left the
 * steps, on the right the machine state each one changes, below the two stacks.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const STEPS = computed(() => [
  L('load the registers', '装入寄存器'),
  'SYSCALL',
  L('swapgs, park rsp', 'swapgs，暂存 rsp'),
  L('switch CR3 (KPTI)', '切换 CR3（KPTI）'),
  L('kernel stack, pt_regs', '内核栈，pt_regs'),
  L('call the handler', '调用处理程序'),
])
// [name, value, the step that changed it]
const STATE = computed(() => {
  const n = s.value
  return [
    [L('mode', '模式'), n >= 1 ? L('kernel', '内核态') : L('user', '用户态'), 1],
    ['rip', n >= 5 ? L('handler', '处理程序') : n >= 1 ? 'entry_SYSCALL_64' : L('your code', '你的代码'), n >= 5 ? 5 : 1],
    ['rax', L('call number', '调用号'), 0],
    ['rcx', n >= 1 ? L('return address', '返回地址') : '—', 1],
    ['r11', n >= 1 ? L('user flags', '用户标志') : '—', 1],
    ['GS', n >= 2 ? L('kernel per-CPU', '内核每 CPU') : L('user', '用户'), 2],
    ['CR3', n >= 3 ? L('kernel tables', '内核页表') : L('user tables', '用户页表'), 3],
    ['rsp', n >= 4 ? L('kernel stack', '内核栈') : L('user stack', '用户栈'), 4],
  ] as [string, string, number][]
})
const onKernelStack = computed(() => s.value >= 4)
const unsafe = computed(() => s.value >= 1 && s.value <= 3)
</script>

<template>
  <svg class="demo scene-drawing" viewBox="0 0 360 370" role="img" :aria-label="L('One system call, step by step', '一次系统调用分步演示')">
    <defs>
      <marker id="st-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head" />
      </marker>
    </defs>

    <!-- the steps -->
    <g v-for="(t, i) in STEPS" :key="i">
      <rect x="10" :y="10 + i * 27" width="146" height="23" rx="4" class="row" :class="{ hot: s === i, past: s > i }" />
      <text x="20" :y="26 + i * 27" class="rowt" :class="{ on: s === i }">{{ t }}</text>
    </g>
    <text x="83" y="184" class="tag c">{{ s === 0 ? L('still your program', '仍是你的程序') : s === 1 ? L('hardware', '硬件做的') : L('kernel software', '内核软件做的') }}</text>

    <!-- what the machine holds now -->
    <rect x="170" y="10" width="180" height="170" rx="6" class="box" />
    <g v-for="(r, i) in STATE" :key="r[0]">
      <text x="180" :y="30 + i * 20" class="code small">{{ r[0] }}</text>
      <text x="342" :y="30 + i * 20" class="val end" :class="{ on: s === r[2] }">{{ r[1] }}</text>
    </g>

    <!-- the two stacks -->
    <text x="90" y="212" class="tag c">{{ L('the user’s stack', '用户的栈') }}</text>
    <rect x="40" y="218" width="100" height="112" rx="3" class="box" />
    <rect x="40" y="218" width="100" height="56" class="used" />
    <text x="90" y="250" class="tiny c">{{ L('your program’s frames', '你的程序的栈帧') }}</text>
    <text x="264" y="212" class="tag c">{{ L('the kernel’s stack', '内核的栈') }}</text>
    <rect x="214" y="218" width="100" height="112" rx="3" class="box" />
    <g class="fade" :class="{ show: onKernelStack }">
      <rect x="214" y="218" width="100" height="62" class="pt" />
      <text x="264" y="245" class="code small c on-text">struct pt_regs</text>
      <text x="264" y="262" class="tiny c on-text">{{ L('every user register', '用户的每一个寄存器') }}</text>
    </g>
    <!-- where rsp points -->
    <g class="fade" :class="{ show: !onKernelStack }">
      <path d="M12,274 H38" class="ptr" marker-end="url(#st-arrow)" />
      <text x="12" y="268" class="code small">rsp</text>
    </g>
    <g class="fade" :class="{ show: onKernelStack }">
      <path d="M184,280 H212" class="ptr" marker-end="url(#st-arrow)" />
      <text x="184" y="274" class="code small">rsp</text>
    </g>
    <text x="180" y="352" class="note c" :class="{ show: unsafe }">{{ L('in kernel mode, on a stack the kernel must not trust', '已在内核态，却踩着内核不能信任的栈') }}</text>
    <text x="180" y="352" class="note c" :class="{ show: s === 5 }">{{ L('the only step that does what you asked', '只有这一步在做你要求的事') }}</text>
  </svg>
</template>

<style scoped>
.row {
  fill: var(--bg-elev);
  stroke: var(--rule);
  transition: fill 0.3s, stroke 0.3s;
}
.row.hot {
  fill: var(--accent-soft);
  stroke: var(--accent);
  stroke-width: 1.8;
}
.row.past {
  fill: var(--bg-sunk);
}
.rowt {
  font-size: 10px;
  fill: var(--ink-2);
}
.rowt.on {
  fill: var(--accent-ink);
  font-weight: 600;
}
.small {
  font-size: 9.5px;
}
.val {
  font-size: 9.5px;
  fill: var(--muted);
  transition: fill 0.3s;
}
.val.on {
  fill: var(--accent-ink);
  font-weight: 700;
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.used {
  fill: var(--p0);
  opacity: 0.18;
}
.pt {
  fill: var(--p2);
}
.on-text {
  fill: #fff;
}
.ptr {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.4;
}
.head {
  fill: var(--ink-2);
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
  .row,
  .val,
  .note,
  .fade {
    transition: none;
  }
}
</style>
