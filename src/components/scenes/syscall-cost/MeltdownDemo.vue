<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * Meltdown in seven steps: the kernel mapped in every process, the flushed probe slots, the load
 * from a kernel address, probe[secret] touched before the fault, the fault that discards the
 * registers but not the cache, the timing that reads the byte back, and the same load under KPTI,
 * where the kernel is not mapped at all. The probe array has 256 slots in the real attack; 16 are
 * drawn.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const SECRET = 11
const s = computed(() => props.step)
const kpti = computed(() => s.value >= 6)
const cached = computed(() => s.value >= 3 && s.value <= 5)
// access times: one slot answers from the cache, unless KPTI left nothing there
const height = (i: number) => (i === SECRET && !kpti.value ? 7 : 50 + ((i * 37) % 17))
const timed = computed(() => s.value >= 5)
const CODE = ['xor rax, rax', 'retry:', '  mov al, byte [rcx]', '  shl rax, 0xc', '  jz retry', '  mov rbx, qword [rbx + rax]']
const hot = (i: number) => (s.value === 2 || s.value === 6 ? i === 2 : s.value === 3 ? i === 3 || i === 5 : false)
</script>

<template>
  <svg class="demo" viewBox="0 0 360 420" role="img" :aria-label="L('Meltdown, step by step', 'Meltdown 分步演示')">
    <defs>
      <marker id="md-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head" />
      </marker>
    </defs>

    <!-- the attacker's own code, from the paper's Listing 2 -->
    <rect x="8" y="4" width="344" height="94" rx="6" class="code-box" />
    <text v-for="(c, i) in CODE" :key="i" :x="c.startsWith(' ') ? 30 : 18" :y="21 + i * 14" class="code" :class="{ hot: hot(i) }">{{ c.trim() }}</text>
    <text x="344" y="49" class="note end bad" :class="{ show: s === 2 }">{{ L('not allowed, but the fault waits', '无权读取，但异常还没到') }}</text>
    <text x="344" y="49" class="note end bad" :class="{ show: s === 6 }">{{ L('no translation: nothing loaded', '没有转换：什么也读不到') }}</text>
    <text x="344" y="91" class="note end" :class="{ show: s === 3 }">{{ L('the value picks the slot', '值是几，就读第几格') }}</text>

    <!-- one address space: the program below, the kernel above (drawn left to right) -->
    <text x="12" y="114" class="cap">{{ kpti ? L('with KPTI: the page table loaded in user mode', '有了 KPTI：用户态装着的页表') : L('one page table, before 2018', '一张页表，2018 年以前') }}</text>
    <rect x="12" y="120" width="140" height="26" rx="2" class="cell user" />
    <text x="82" y="137" class="tiny c on-fill">{{ L('your memory', '你的内存') }}</text>
    <g v-if="!kpti">
      <rect x="154" y="120" width="194" height="26" rx="2" class="cell kern" :class="{ ring: s === 0 }" />
      <text x="214" y="137" class="tiny c on-fill">{{ L('kernel · supervisor-only', '内核 · 仅限特权态') }}</text>
      <rect x="282" y="123" width="62" height="20" rx="2" class="cell secret" :class="{ ring: s >= 2 }" />
      <text x="313" y="137" class="tiny c on-fill">{{ s >= 2 ? `${L('secret', '秘密')} = ${SECRET}` : L('secret', '秘密') }}</text>
    </g>
    <g v-else>
      <rect x="154" y="120" width="14" height="26" rx="2" class="cell kern" />
      <rect x="170" y="120" width="178" height="26" rx="2" class="nomap" />
      <text x="259" y="137" class="tiny c">{{ L('kernel: not mapped', '内核：未映射') }}</text>
    </g>
    <text x="82" y="158" class="tiny c">{{ L('user mode may read', '用户态可读') }}</text>
    <text x="251" y="158" class="tiny c">{{ kpti ? L('only the entry code is mapped', '只映射了入口代码') : L('mapped, so a trap needs no switch', '映射着，陷入时不用切换') }}</text>
    <!-- the load: into the secret before KPTI, into nothing after -->
    <path d="M150,48 C250,52 300,92 308,118" class="flow spec" :class="{ show: s === 2 }" marker-end="url(#md-arrow)" />
    <path d="M150,48 C230,52 250,92 258,118" class="flow spec" :class="{ show: s === 6 }" marker-end="url(#md-arrow)" />

    <!-- the probe array: slot i stands for the value i -->
    <text x="12" y="178" class="cap">{{ L('probe array (16 of 256 slots drawn)', 'probe 数组（256 格，画了 16 格）') }}</text>
    <g v-for="i in 16" :key="'p' + i">
      <rect :x="12 + (i - 1) * 21" y="184" width="19" height="22" rx="2" class="cell probe" :class="{ ring: cached && i - 1 === SECRET }" />
      <text :x="21.5 + (i - 1) * 21" y="199" class="tiny c">{{ i - 1 }}</text>
    </g>
    <path d="M330,146 C332,172 268,166 256,182" class="flow spec" :class="{ show: s === 3 }" marker-end="url(#md-arrow)" />

    <!-- the cache, and the registers that the fault rolls back -->
    <rect x="12" y="216" width="164" height="44" rx="5" class="box" />
    <text x="20" y="232" class="cap">{{ L('CPU cache', 'CPU 缓存') }}</text>
    <text x="20" y="250" class="tiny fade" :class="{ show: s === 1 || s === 2 || s === 6 }">{{ L('no probe slot', '没有任何 probe 格') }}</text>
    <g class="fade" :class="{ show: cached }">
      <rect x="20" y="238" width="78" height="16" rx="3" class="chip" />
      <text x="59" y="250" class="tiny c on-fill">probe[{{ SECRET }}]</text>
    </g>
    <text x="104" y="250" class="tiny fade" :class="{ show: s === 4 }">{{ L('← still here', '← 还在') }}</text>
    <rect x="188" y="216" width="160" height="44" rx="5" class="box" />
    <text x="196" y="232" class="cap">{{ L('registers', '寄存器') }}</text>
    <g class="fade" :class="{ show: s >= 2 && s <= 5 }">
      <text x="196" y="251" class="code" :class="{ struck: s >= 4 }">al = {{ SECRET }}</text>
      <text x="250" y="251" class="code fade" :class="{ struck: s >= 4, show: s >= 3 }">rbx = …</text>
    </g>
    <text x="340" y="251" class="note end bad" :class="{ show: s === 4 || s === 5 }">{{ L('discarded', '已丢弃') }}</text>
    <text x="180" y="274" class="note c bad" :class="{ show: s === 4 }">{{ L('the fault: SIGSEGV, caught by a handler', '异常：SIGSEGV，被处理函数接住') }}</text>

    <!-- timing every probe slot -->
    <text x="12" y="290" class="cap">{{ L('time to read each probe slot', '读每个 probe 格所用的时间') }}</text>
    <line x1="12" y1="400" x2="348" y2="400" class="axis" />
    <g v-for="i in 16" :key="'t' + i">
      <rect
        :x="14 + (i - 1) * 21"
        :y="400 - (timed ? height(i - 1) * 1.6 : 0)"
        width="15"
        :height="timed ? height(i - 1) * 1.6 : 0"
        rx="1.5"
        class="bar"
        :class="{ fast: i - 1 === SECRET && !kpti }"
        :style="{ transitionDelay: `${(i - 1) * 60}ms` }"
      />
    </g>
    <text x="252" y="414" class="note bad c" :class="{ show: s === 5 }">↑ {{ L('slot 11: a few ns', '第 11 格：几纳秒') }}</text>
    <text x="12" y="414" class="tiny fade" :class="{ show: s === 5 }">{{ L('others ≈ 100 ns', '其他 ≈ 100 纳秒') }}</text>
    <text x="180" y="414" class="note c" :class="{ show: s === 6 }">{{ L('every slot equally slow: nothing leaked', '每一格都一样慢：什么也没漏出来') }}</text>
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
.code {
  font-family: var(--font-mono);
  font-size: 10.5px;
  fill: var(--ink-2);
  transition: fill 0.3s;
}
.code.hot {
  fill: var(--accent-ink);
  font-weight: 600;
}
.code.struck {
  text-decoration: line-through;
  fill: var(--muted);
}
.cap {
  font-size: 9.5px;
  fill: var(--muted);
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.on-fill {
  fill: #fff;
}
.c {
  text-anchor: middle;
}
.end {
  text-anchor: end;
}
.note {
  font-size: 9.5px;
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
.fade {
  opacity: 0;
  transition: opacity 0.4s;
}
.cell {
  stroke: none;
  transition:
    stroke 0.3s,
    stroke-width 0.3s;
}
.cell.user {
  fill: var(--p0);
}
.cell.kern {
  fill: var(--p2);
}
.cell.secret {
  fill: var(--p3);
}
.cell.probe {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.cell.ring {
  stroke: var(--accent);
  stroke-width: 2.4;
}
.nomap {
  fill: none;
  stroke: var(--rule-strong);
  stroke-dasharray: 3 3;
}
.box {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
}
.chip {
  fill: var(--accent);
}
.flow {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.4;
  opacity: 0;
  transition: opacity 0.35s;
}
.flow.spec {
  stroke: var(--p3);
  stroke-dasharray: 4 3;
}
.head {
  fill: var(--p3);
}
.axis {
  stroke: var(--rule-strong);
}
.bar {
  fill: var(--rule-strong);
  transition:
    y 0.5s ease,
    height 0.5s ease;
}
.bar.fast {
  fill: var(--p3);
}
@media (prefers-reduced-motion: reduce) {
  .bar,
  .fade,
  .note,
  .flow {
    transition: none;
  }
}
</style>
