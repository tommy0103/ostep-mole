<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * The fold's minimal init, in six steps: the set-up (signals blocked, so they wait as pending),
 * three orphans exiting with one SIGCHLD between them, sigwait(), the waitpid() loop that reaps
 * all three, SIGTERM forwarded, and the program's own exit ending the init.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const CODE = [
  'for (;;) {',
  '  sigwait(&all, &sig);',
  '  if (sig != SIGCHLD) { kill(child, sig); continue; }',
  '  while ((pid = waitpid(-1, &st, WNOHANG)) > 0)',
  '    if (pid == child) return …;',
  '}',
]
const HOT: Record<number, number[]> = { 2: [1], 3: [3], 4: [1, 2], 5: [3, 4] }
const hot = (i: number) => (HOT[s.value] ?? []).includes(i)

const ORPHANS = [218, 270, 322]
const orphan = computed(() => (s.value === 0 ? 'run' : s.value <= 2 ? 'z' : 'gone'))
const chld = computed(() => s.value === 1 || s.value === 5)
const term = computed(() => s.value === 4)
const NOTE: Record<number, [string, string]> = {
  1: ['three exits, one pending bit', '三次退出，只置一位'],
  3: ['one call per signal would leave two zombies', '每个信号只调一次，就会剩下两个僵尸'],
  4: ['blocked, not ignored: it is delivered', '是阻塞，不是忽略：信号能送达'],
  5: ['PID 1 exits: the kernel kills what is left', 'PID 1 退出：内核清掉剩下的一切'],
}
</script>

<template>
  <svg class="demo scene-drawing" viewBox="0 0 360 400" role="img" :aria-label="L('A minimal init, step by step', '最小 init 分步演示')">
    <defs>
      <marker id="zm-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head" />
      </marker>
    </defs>

    <!-- the loop -->
    <rect x="8" y="6" width="344" height="96" rx="6" class="code-box" />
    <text v-for="(line, i) in CODE" :key="i" x="16" :y="21 + i * 14.5" class="code pre" :class="{ hot: hot(i) }">{{ line }}</text>

    <!-- mini-init and the program it started -->
    <rect x="16" y="112" width="96" height="34" rx="6" class="box strong" />
    <text x="64" y="127" class="lbl c">mini-init</text>
    <text x="64" y="140" class="sub c" :class="{ hi: s === 5 }">{{ s === 5 ? L('returns 143', '返回 143') : 'PID 1' }}</text>
    <path d="M64,146 V176" class="link solid" />
    <rect x="40" y="176" width="96" height="34" rx="6" class="box" :class="{ ghost: s === 5 }" />
    <text x="88" y="191" class="lbl c" :class="{ faint: s === 5 }">myserver</text>
    <text x="88" y="204" class="sub c">{{ s === 5 ? L('killed by SIGTERM', '被 SIGTERM 结束') : L('your program', '你的程序') }}</text>

    <!-- orphans reparented to it -->
    <text x="214" y="122" class="tag c">{{ L('orphans, reparented to it', '过继给它的孤儿') }}</text>
    <path d="M112,129 H322 M218,129 V176 M270,129 V176 M322,129 V176" class="link" />
    <g v-for="(x, i) in ORPHANS" :key="x" class="fade show" :style="{ opacity: orphan === 'gone' ? 0.3 : 1, transitionDelay: s === 3 ? `${i * 350}ms` : '0ms' }">
      <rect :x="x - 22" y="176" width="44" height="34" rx="5" class="box" :class="{ ghost: orphan !== 'run' }" />
      <text :x="x" y="191" class="tag hi c">{{ L('orphan', '孤儿') }}</text>
      <text :x="x" y="204" class="tiny c">{{ orphan === 'run' ? L('running', '运行中') : orphan === 'z' ? 'Z' : L('reaped', '已回收') }}</text>
    </g>

    <!-- signals sent to it: blocked, so held as pending -->
    <rect x="16" y="236" width="228" height="68" rx="6" class="box floor" />
    <text x="24" y="296" class="tag">{{ L('mini-init’s pending signals (all blocked)', 'mini-init 的待处理信号（全部阻塞）') }}</text>
    <rect x="24" y="244" width="100" height="26" rx="4" class="cell" :class="{ on: chld }" />
    <text x="34" y="261" class="code">SIGCHLD</text>
    <text x="114" y="261" class="code end bit" :class="{ on: chld }">{{ chld ? 1 : 0 }}</text>
    <rect x="134" y="244" width="100" height="26" rx="4" class="cell" :class="{ on: term }" />
    <text x="144" y="261" class="code">SIGTERM</text>
    <text x="224" y="261" class="code end bit" :class="{ on: term }">{{ term ? 1 : 0 }}</text>
    <!-- three exits into one bit; later the program's own exit -->
    <path v-for="x in ORPHANS" :key="'c' + x" :d="`M${x},210 C${x},232 ${64 + (x - 218) * 0.35},224 ${60 + (x - 218) * 0.35},242`" class="flow" :class="{ show: s === 1 }" marker-end="url(#zm-arrow)" />
    <path d="M100,210 V242" class="flow" :class="{ show: s === 5 }" marker-end="url(#zm-arrow)" />
    <!-- sigwait() takes a pending signal -->
    <path d="M22,238 V150" class="flow" :class="{ show: s === 2 || s === 4 || s === 5 }" marker-end="url(#zm-arrow)" />
    <!-- docker stop -->
    <g class="fade" :class="{ show: s >= 4 }">
      <rect x="258" y="240" width="92" height="34" rx="6" class="box" />
      <text x="304" y="255" class="lbl c">Docker</text>
      <text x="304" y="268" class="tiny c">docker stop</text>
    </g>
    <path d="M258,257 H238" class="flow" :class="{ show: s === 4 }" marker-end="url(#zm-arrow)" />
    <!-- forwarded to the program -->
    <path d="M100,146 V174" class="flow" :class="{ show: s === 4 }" marker-end="url(#zm-arrow)" />
    <text x="106" y="165" class="code small fade" :class="{ show: s === 4 }">kill(child, sig)</text>

    <!-- what each waitpid() call returned -->
    <g class="fade" :class="{ show: s === 3 || s === 5 }">
      <text x="16" y="330" class="tag">{{ L('waitpid(-1, …, WNOHANG) returned', 'waitpid(-1, …, WNOHANG) 的返回值') }}</text>
    </g>
    <template v-if="s === 3">
      <g v-for="(c, i) in [L('orphan 1', '孤儿 1'), L('orphan 2', '孤儿 2'), L('orphan 3', '孤儿 3'), L('0: none left', '0：没有了')]" :key="'r' + i" class="fade show chipin" :style="{ animationDelay: `${i * 350}ms` }">
        <rect :x="16 + i * 84" y="338" width="78" height="22" rx="4" :class="i < 3 ? 'chip' : 'chip end-chip'" />
        <text :x="55 + i * 84" y="353" class="tiny c" :class="{ 'on-fill': i < 3 }">{{ c }}</text>
      </g>
    </template>
    <g v-if="s === 5" class="fade show">
      <rect x="16" y="338" width="246" height="22" rx="4" class="chip" />
      <text x="139" y="353" class="tiny c on-fill">{{ L('myserver’s PID → return 128 + 15 = 143', 'myserver 的 PID → 返回 128 + 15 = 143') }}</text>
    </g>

    <text x="180" y="388" class="note c" :class="{ show: NOTE[s] }">{{ NOTE[s] ? L(...NOTE[s]) : '' }}</text>
  </svg>
</template>

<style scoped>
.code-box {
  fill: var(--code-bg);
  stroke: var(--rule);
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
.pre {
  white-space: pre;
}
.code.small {
  font-size: 9.5px;
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.sub.hi {
  fill: var(--accent-ink);
  font-weight: 600;
}
.faint {
  fill: var(--muted);
}
.ghost {
  fill: var(--bg-sunk);
  stroke-dasharray: 4 3;
}
.cell {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
  transition: stroke 0.3s, fill 0.3s;
}
.cell.on {
  stroke: var(--accent);
  stroke-width: 2;
  fill: var(--accent-soft);
}
.bit.on {
  fill: var(--accent-ink);
  font-weight: 700;
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
.chip {
  fill: var(--accent);
}
.chip.end-chip {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
}
.on-fill {
  fill: #fff;
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
  transition: opacity 0.4s;
}
.show {
  opacity: 1;
}
.chipin {
  animation: zm-in 0.35s ease both;
}
@keyframes zm-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .fade,
  .flow,
  .note,
  .chipin {
    transition: none;
    animation: none;
  }
}
</style>
