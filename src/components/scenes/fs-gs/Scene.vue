<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import SwapgsDemo from './SwapgsDemo.vue'

/**
 * The running figure of the FS and GS article: the CPU's segment registers on the left, the
 * address space on the right (kernel half above, user half below, thread blocks and per-CPU
 * areas in it), and below the CPU whatever code the passage is about, usually the kernel's entry
 * path. No motion: the arrows from FS and GS change between states.
 */
const props = defineProps<DrawingProps>()
const CPU = ['cpu', 'regs', 'fs', 'gs']
const MEM = ['khalf', 'percpu', 'uhalf']
const THREADS = ['uhalf', 'tls1', 'tls2', 'fsptr']
const ENTRY = ['decide', 'swapbox']
const SHOW: Record<string, string[]> = {
  overview: [...CPU, ...MEM, 'tls1', 'tls2', 'fsptr', 'gsptr', 'ovcode'],
  segments: [...CPU, 'prefix', 'segmem'],
  descriptors: ['cpu', 'regs', 'desc', 'segone'],
  flat: [...CPU, 'flatnote'],
  tls: [...CPU, ...THREADS, 'tlscode'],
  settls: [...CPU, ...THREADS, 'switch'],
  percpu: [...CPU, 'khalf', 'percpu', 'gsptr', 'inc'],
  swapgs: [...CPU, 'khalf', 'percpu', 'msr', 'swap', 'gsptr', ...ENTRY],
  sign: [...CPU, ...MEM, 'sign', ...ENTRY],
  spectre: [...CPU, 'khalf', 'percpu', 'msr', ...ENTRY, 'spec', 'lfence'],
  fsgsbase: [...CPU, ...THREADS, 'cr4'],
  danger: [...CPU, ...MEM, 'msr', 'sign', ...ENTRY, 'rogue'],
  fix59: [...CPU, 'khalf', 'percpu', 'gsptr', 'fix'],
  fred: [...CPU, 'khalf', 'percpu', 'msr', 'swap', 'gsptr', 'fred'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 416)
const st = computed(() => props.state)

const mode = computed(() => {
  if (['tls', 'settls', 'fsgsbase'].includes(st.value)) return L('user mode', '用户态')
  if (['percpu', 'swapgs', 'fix59', 'fred'].includes(st.value)) return L('kernel mode', '内核态')
  if (['sign', 'spectre', 'danger'].includes(st.value)) return L('entering the kernel', '正在进入内核')
  return ''
})
const ROLE: Record<string, [string, string]> = {
  CS: ['instruction fetch', '取指令'],
  SS: ['stack accesses', '栈访问'],
  DS: ['most data', '大多数数据'],
  ES: ['by prefix', '靠前缀选用'],
}
function reg4(name: string) {
  if (st.value === 'segments') return L(...ROLE[name])
  if (st.value === 'descriptors') return L('selector', '选择子')
  return L('base 0 · ignored', '基址 0 · 被忽略')
}
const fsValue = computed(() => {
  if (st.value === 'segments') return L('by prefix', '靠前缀选用')
  if (st.value === 'descriptors') return L('selector', '选择子')
  if (st.value === 'flat') return L('base, no limit', '有基址，无界限')
  if (st.value === 'settls') return L('→ thread 2’s block', '→ 线程 2 的区域')
  if (['overview', 'tls', 'fsgsbase'].includes(st.value)) return L('→ thread 1’s block', '→ 线程 1 的区域')
  return L('the thread’s block', '线程的区域')
})
const gsValue = computed(() => {
  switch (st.value) {
    case 'segments':
      return L('by prefix', '靠前缀选用')
    case 'descriptors':
      return L('selector', '选择子')
    case 'flat':
      return L('base, no limit', '有基址，无界限')
    case 'tls':
    case 'settls':
    case 'fsgsbase':
      return L('no common use', '没有约定用途')
    case 'sign':
      return L('its sign is tested', '看它的符号')
    case 'spectre':
      return L('user’s, if skipped', '跳过时：用户的')
    case 'danger':
      return L('attacker’s, < 0', '攻击者的值 < 0')
    default:
      return L('→ CPU 0’s area', '→ CPU 0 的区域')
  }
})
const msrValue = computed(() => {
  if (st.value === 'spectre') return L('kernel’s, if skipped', '跳过时：内核的')
  if (st.value === 'danger') return L('kernel’s: never loaded', '内核的：没被装上')
  return L('the user’s GS base', '用户的 GS 基址')
})
const decideLabel = computed(() => (st.value === 'sign' || st.value === 'danger' ? L('GS base negative?', 'GS 基址是负数？') : L('came from user mode?', '是从用户态来的？')))
const decideCode = computed(() => (st.value === 'sign' || st.value === 'danger' ? 'rdmsr · js' : 'testl $3,CS+8(%rsp)'))
const leftTag = computed(() => (st.value === 'sign' || st.value === 'danger' ? L('≥ 0: user', '≥ 0：用户') : L('yes', '是')))
const rightTag = computed(() => (st.value === 'sign' || st.value === 'danger' ? L('< 0: kernel', '< 0：内核') : L('no', '否')))
const hotCanary = computed(() => ['overview', 'tls'].includes(st.value))
const fsY = computed(() => (st.value === 'settls' ? 350 : 278))
</script>

<template>
  <SwapgsDemo v-if="demo && state === 'swapgs'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('The CPU’s segment registers and the address space they point into', 'CPU 的段寄存器和它们所指向的地址空间')">
    <defs>
      <marker id="fg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <marker id="fg-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head-bad" />
      </marker>
    </defs>

    <!-- the address space: kernel half above, user half below -->
    <g :class="part('khalf')">
      <rect x="196" y="8" width="156" height="188" rx="7" class="outline" />
      <text x="202" y="22" class="tag">{{ L('kernel · upper half', '内核 · 上半部') }}</text>
    </g>
    <g :class="part('uhalf')">
      <rect x="196" y="206" width="156" height="204" rx="7" class="outline" />
      <text x="202" y="220" class="tag">{{ L('user space · lower half', '用户空间 · 下半部') }}</text>
    </g>

    <!-- per-CPU areas -->
    <g :class="part('percpu')">
      <rect x="204" y="30" width="140" height="54" rx="4" class="box" />
      <text x="212" y="46" class="lbl">CPU 0</text>
      <text x="336" y="46" class="tag end">{{ L('per-CPU area', '每 CPU 区域') }}</text>
      <rect x="210" y="56" width="128" height="20" rx="2" class="row" :class="{ hot: st === 'overview' || st === 'percpu' }" />
      <text x="216" y="70" class="code">x</text>
      <text x="332" y="70" class="tag end">{{ L('this CPU’s copy', '本 CPU 的那份') }}</text>
      <rect x="204" y="94" width="140" height="48" rx="4" class="box" />
      <text x="212" y="108" class="lbl">CPU 1</text>
      <rect x="210" y="114" width="128" height="20" rx="2" class="row" />
      <text x="216" y="128" class="code">x</text>
      <text x="332" y="128" class="tag end">{{ L('CPU 1’s copy', 'CPU 1 的那份') }}</text>
    </g>

    <!-- each thread's block -->
    <g :class="part('tls1')">
      <rect x="204" y="230" width="140" height="80" rx="4" class="box" />
      <text x="212" y="245" class="lbl">{{ L('thread 1', '线程 1') }}</text>
      <text x="336" y="245" class="tag end">{{ L('TLS block', 'TLS 区域') }}</text>
      <rect x="210" y="250" width="128" height="17" rx="2" class="row" />
      <text x="214" y="262" class="code small">%fs:0</text>
      <text x="334" y="262" class="tag end">{{ L('self pointer', '指向自身') }}</text>
      <rect x="210" y="269" width="128" height="17" rx="2" class="row" :class="{ hot: hotCanary }" />
      <text x="214" y="281" class="code small">%fs:0x28</text>
      <text x="334" y="281" class="tag end">{{ L('canary', '金丝雀') }}</text>
      <rect x="210" y="288" width="128" height="17" rx="2" class="row" />
      <text x="214" y="300" class="code small">counter</text>
      <text x="334" y="300" class="tag end">{{ L('thread-local', '线程局部') }}</text>
    </g>
    <g :class="part('tls2')">
      <rect x="204" y="320" width="140" height="82" rx="4" class="box" />
      <text x="212" y="335" class="lbl">{{ L('thread 2', '线程 2') }}</text>
      <text x="336" y="335" class="tag end">{{ L('TLS block', 'TLS 区域') }}</text>
      <rect x="210" y="341" width="128" height="17" rx="2" class="row" />
      <text x="214" y="353" class="code small">%fs:0</text>
      <text x="334" y="353" class="tag end">{{ L('self pointer', '指向自身') }}</text>
      <rect x="210" y="360" width="128" height="17" rx="2" class="row" />
      <text x="214" y="372" class="code small">%fs:0x28</text>
      <text x="334" y="372" class="tag end">{{ L('canary', '金丝雀') }}</text>
      <rect x="210" y="379" width="128" height="17" rx="2" class="row" />
      <text x="214" y="391" class="code small">counter</text>
      <text x="334" y="391" class="tag end">{{ L('thread-local', '线程局部') }}</text>
    </g>

    <!-- chapter 16's picture: each default register, its segment -->
    <g :class="part('segmem')">
      <rect x="204" y="30" width="140" height="38" rx="4" class="box" />
      <text x="274" y="53" class="lbl c">{{ L('code', '代码') }}</text>
      <rect x="204" y="78" width="140" height="38" rx="4" class="box" />
      <text x="274" y="101" class="lbl c">{{ L('stack', '栈') }}</text>
      <rect x="204" y="126" width="140" height="38" rx="4" class="box" />
      <text x="274" y="149" class="lbl c">{{ L('data', '数据') }}</text>
      <path d="M166,46 C184,46 186,49 202,49" class="link solid" marker-end="url(#fg-arrow)" />
      <path d="M166,68 C184,68 186,97 202,97" class="link solid" marker-end="url(#fg-arrow)" />
      <path d="M166,90 C184,90 186,145 202,145" class="link solid" marker-end="url(#fg-arrow)" />
    </g>

    <!-- 80286 on: a selector indexes a descriptor -->
    <g :class="part('segone')">
      <rect x="240" y="262" width="104" height="78" rx="4" class="box" />
      <text x="292" y="306" class="lbl c">{{ L('a segment', '一个段') }}</text>
      <text x="236" y="272" class="tag end">{{ L('base', '基址') }}</text>
      <text x="236" y="340" class="tag end">{{ L('+ limit', '+ 界限') }}</text>
      <path d="M164,300 L238,300" class="link solid" marker-end="url(#fg-arrow)" />
    </g>

    <!-- 64-bit: one flat space -->
    <g :class="part('flatnote')">
      <rect x="196" y="8" width="156" height="220" rx="7" class="outline" />
      <text x="274" y="108" class="lbl c">{{ L('one flat', '一个平坦的') }}</text>
      <text x="274" y="124" class="lbl c">{{ L('address space', '地址空间') }}</text>
      <text x="274" y="146" class="sub c">{{ L('paging does the real work', '真正干活的是分页') }}</text>
    </g>

    <!-- the sign of an address -->
    <g :class="part('sign')">
      <line x1="196" y1="201" x2="352" y2="201" class="signline" />
      <text x="348" y="192" class="tag hi end">{{ L('top bit 1: negative', '最高位 1：负数') }}</text>
      <text x="348" y="236" class="tag hi end">{{ L('top bit 0: positive', '最高位 0：正数') }}</text>
      <text x="274" y="300" class="sub c">{{ st === 'danger' ? L('a user GS base belongs here', '用户的 GS 基址本该在这边') : L('a user GS base is always here', '用户的 GS 基址总在这边') }}</text>
    </g>

    <!-- the CPU -->
    <g :class="part('cpu')">
      <rect x="8" y="8" width="162" height="220" rx="6" class="box strong" />
      <text x="18" y="26" class="lbl">CPU</text>
      <text x="160" y="26" class="tag end">{{ mode }}</text>
    </g>
    <g :class="part('regs')">
      <g v-for="(n, i) in ['CS', 'SS', 'DS', 'ES']" :key="n">
        <rect x="28" :y="36 + i * 22" width="138" height="20" rx="2" class="row" />
        <text x="34" :y="50 + i * 22" class="code">{{ n }}</text>
        <text x="60" :y="50 + i * 22" class="tag">{{ reg4(n) }}</text>
      </g>
    </g>
    <g :class="part('fs')">
      <rect x="28" y="130" width="138" height="20" rx="2" class="row strongrow" :class="{ hot: st === 'segments' }" />
      <text x="34" y="144" class="code strongcode">FS</text>
      <text x="60" y="144" class="tag hi">{{ fsValue }}</text>
    </g>
    <g :class="part('gs')">
      <rect x="28" y="154" width="138" height="20" rx="2" class="row strongrow" :class="{ bad: st === 'danger' }" />
      <text x="34" y="168" class="code strongcode">GS</text>
      <text x="60" y="168" class="tag hi" :class="{ 'bad-text': st === 'danger' }">{{ gsValue }}</text>
    </g>
    <g :class="part('msr')">
      <rect x="28" y="188" width="138" height="34" rx="2" class="row" />
      <text x="34" y="201" class="code tiny">{{ st === 'fred' ? 'IA32_KERNEL_GS_BASE' : 'MSR_KERNEL_GS_BASE' }}</text>
      <text x="34" y="215" class="tag">{{ msrValue }}</text>
    </g>
    <g :class="part('swap')">
      <path d="M27,164 C12,170 12,199 27,205" class="call" marker-start="url(#fg-arrow)" marker-end="url(#fg-arrow)" />
      <text x="34" y="185" class="tag hi">{{ st === 'fred' ? L('swapped by hardware', '由硬件交换') : 'SWAPGS' }}</text>
    </g>

    <!-- what FS and GS point at -->
    <g :class="part('fsptr')">
      <path :d="`M166,140 C186,140 186,${fsY} 203,${fsY}`" class="call" marker-end="url(#fg-arrow)" />
    </g>
    <g :class="part('gsptr')">
      <path d="M166,164 C186,164 186,62 203,62" class="call" marker-end="url(#fg-arrow)" />
    </g>
    <g :class="part('rogue')">
      <path d="M166,164 C184,166 186,172 220,172" class="danger" marker-end="url(#fg-arrow-bad)" />
      <text x="226" y="176" class="tag bad-text">{{ L('wherever it says', '它指到哪是哪') }}</text>
    </g>

    <!-- under the CPU: the code the passage is about -->
    <g :class="part('ovcode')">
      <text x="14" y="252" class="tag hi">{{ L('in a thread', '线程里') }}</text>
      <text x="14" y="268" class="code">mov %fs:0x28,%rax</text>
      <text x="14" y="282" class="tag">{{ L('FS base + 0x28', 'FS 基址 + 0x28') }}</text>
      <text x="14" y="310" class="tag hi">{{ L('in the kernel', '内核里') }}</text>
      <text x="14" y="326" class="code">inc gs:[x]</text>
      <text x="14" y="340" class="tag">{{ L('GS base + x', 'GS 基址 + x') }}</text>
    </g>
    <g :class="part('prefix')">
      <text x="14" y="254" class="code">mov %fs:0x28,%rax</text>
      <text x="14" y="270" class="tag">{{ L('The prefix %fs: chooses FS', '前缀 %fs: 选用 FS，') }}</text>
      <text x="14" y="283" class="tag">{{ L('instead of the default DS.', '而不是默认的 DS。') }}</text>
    </g>
    <g :class="part('desc')">
      <path d="M90,228 L90,256" class="link solid" marker-end="url(#fg-arrow)" />
      <text x="96" y="244" class="tag">{{ L('index', '下标') }}</text>
      <rect x="14" y="258" width="150" height="88" rx="4" class="box" />
      <text x="22" y="274" class="lbl">{{ L('descriptor table', '描述符表') }}</text>
      <g v-for="(n, i) in [L('code', '代码'), L('data', '数据'), L('stack', '栈')]" :key="i">
        <rect x="20" :y="280 + i * 20" width="138" height="18" rx="2" class="row" :class="{ hot: i === 1 }" />
        <text x="26" :y="293 + i * 20" class="tag hi">{{ n }}</text>
        <text x="154" :y="293 + i * 20" class="tag end">{{ L('base · limit · prot', '基址 · 界限 · 保护') }}</text>
      </g>
    </g>
    <g :class="part('tlscode')">
      <text x="12" y="254" class="tag hi">{{ L('the same code in every thread', '每个线程都是同一段代码') }}</text>
      <text x="12" y="270" class="code small">mov %fs:counter@tpoff,%eax</text>
      <text x="12" y="286" class="tag">{{ L('The linker fixes the offset.', '偏移由链接器定下。') }}</text>
    </g>
    <g :class="part('switch')">
      <text x="14" y="254" class="tag hi">{{ L('context switch, 1 to 2', '上下文切换：1 到 2') }}</text>
      <text x="14" y="270" class="tag">{{ L('save thread 1’s FS base', '保存线程 1 的 FS 基址') }}</text>
      <text x="14" y="284" class="tag">{{ L('load thread 2’s FS base', '装入线程 2 的 FS 基址') }}</text>
      <text x="14" y="312" class="tag hi">{{ L('set by the kernel', '由内核设置') }}</text>
      <text x="14" y="328" class="code small">clone(CLONE_SETTLS)</text>
      <text x="14" y="342" class="code small">arch_prctl(ARCH_SET_FS)</text>
    </g>
    <g :class="part('inc')">
      <text x="14" y="254" class="code">inc gs:[x]</text>
      <text x="14" y="272" class="tag">{{ L('one instruction', '一条指令') }}</text>
      <text x="14" y="286" class="tag">{{ L('no lock prefix', '不需要 lock 前缀') }}</text>
      <text x="14" y="300" class="tag">{{ L('preemption stays on', '不必关抢占') }}</text>
    </g>

    <!-- the decision on every entry -->
    <g :class="part('decide')">
      <text x="14" y="250" class="tag">{{ L('kernel entry code', '内核入口代码') }}</text>
      <rect x="14" y="256" width="150" height="36" rx="4" class="box gate" />
      <text x="89" y="271" class="lbl c smalllbl">{{ decideLabel }}</text>
      <text x="89" y="285" class="code c tiny">{{ decideCode }}</text>
      <path d="M50,292 L50,312" class="call" marker-end="url(#fg-arrow)" />
      <path d="M128,292 L128,312" class="call" marker-end="url(#fg-arrow)" />
      <text :x="st === 'spectre' ? 45 : 55" y="306" class="tag" :class="{ end: st === 'spectre' }">{{ leftTag }}</text>
      <text x="133" y="306" class="tag">{{ rightTag }}</text>
    </g>
    <g :class="part('swapbox')">
      <rect x="14" y="314" width="74" height="24" rx="4" class="box" :class="{ skipped: st === 'danger' }" />
      <text x="51" y="330" class="lbl c smalllbl">SWAPGS</text>
      <rect x="96" y="314" width="68" height="24" rx="4" class="box" :class="{ wrong: st === 'danger' }" />
      <text x="130" y="330" class="sub c ink">{{ L('no swap', '不交换') }}</text>
      <text v-if="st === 'danger'" x="89" y="356" class="tag bad-text c">{{ L('It came from user mode,', '明明来自用户态，') }}</text>
      <text v-if="st === 'danger'" x="89" y="369" class="tag bad-text c">{{ L('but the test says kernel.', '检查却说来自内核。') }}</text>
    </g>
    <g :class="part('spec')">
      <path d="M50,294 C62,304 110,302 126,312" class="danger dashed" marker-end="url(#fg-arrow-bad)" />
      <path d="M128,294 C116,304 68,302 52,312" class="danger dashed" marker-end="url(#fg-arrow-bad)" />
      <text x="14" y="392" class="tag bad-text">{{ L('dashed: a wrong prediction', '虚线：预测错的路径') }}</text>
    </g>
    <g :class="part('lfence')">
      <rect x="14" y="348" width="150" height="22" rx="3" class="box gate" />
      <text x="89" y="363" class="sub c ink">{{ L('LFENCE: wait for the branch', 'LFENCE：等分支出结果') }}</text>
    </g>

    <!-- FSGSBASE -->
    <g :class="part('cr4')">
      <text x="14" y="252" class="tag hi">{{ L('to change FS, before', '修改 FS，以前') }}</text>
      <text x="14" y="267" class="code small">arch_prctl(ARCH_SET_FS)</text>
      <text x="14" y="281" class="tag">{{ L('a system call each time', '每次一个系统调用') }}</text>
      <text x="14" y="306" class="tag hi">{{ L('with FSGSBASE', '有了 FSGSBASE') }}</text>
      <text x="14" y="321" class="code small">WRFSBASE</text>
      <text x="14" y="335" class="tag">{{ L('one instruction, in user mode', '一条指令，在用户态') }}</text>
      <rect x="14" y="346" width="150" height="24" rx="3" class="box gate" />
      <text x="89" y="362" class="sub c ink">{{ L('allowed if CR4 bit is set', 'CR4 的那一位置上才允许') }}</text>
    </g>

    <!-- Linux 5.9's paranoid entry -->
    <g :class="part('fix')">
      <text x="14" y="250" class="tag">{{ L('paranoid entry, since 5.9', '偏执入口，5.9 起') }}</text>
      <g v-for="(t, i) in [L('read and save the GS base', '读出并保存 GS 基址'), L('load the kernel’s base', '装入内核的基址'), L('on exit: restore the saved one', '退出时：恢复保存的值')]" :key="i">
        <rect x="14" :y="256 + i * 30" width="150" height="24" rx="3" class="box" />
        <text x="89" :y="272 + i * 30" class="sub c ink">{{ t }}</text>
      </g>
      <text x="89" y="358" class="tag hi c">{{ L('no test to fool', '不再有可糊弄的检查') }}</text>
    </g>

    <!-- FRED -->
    <g :class="part('fred')">
      <text x="14" y="250" class="tag">{{ L('FRED: done by the CPU', 'FRED：由 CPU 完成') }}</text>
      <rect x="14" y="256" width="150" height="36" rx="4" class="box gate" />
      <text x="89" y="271" class="lbl c smalllbl">{{ L('event from ring 3', '来自 ring 3 的事件') }}</text>
      <text x="89" y="285" class="tag c">{{ L('swaps GS during delivery', '投递时交换 GS') }}</text>
      <rect x="14" y="300" width="150" height="36" rx="4" class="box gate" />
      <text x="89" y="315" class="lbl c smalllbl">{{ L('return to user mode', '返回用户态') }}</text>
      <text x="89" y="329" class="tag c">{{ L('swaps it back', '再换回来') }}</text>
      <text x="89" y="356" class="code c bad-text">SWAPGS → #UD</text>
    </g>
  </svg>
</template>

<style scoped>
.head-bad {
  fill: var(--p3);
}
.small {
  font-size: 9.5px;
}
.tiny {
  font-size: 9px;
}
.smalllbl {
  font-size: 10.5px;
}
.ink {
  fill: var(--ink-2);
}
.row {
  fill: var(--bg-sunk);
  stroke: var(--rule);
  stroke-width: 1;
}
.row.strongrow {
  stroke: var(--ink-2);
  fill: var(--bg-elev);
}
.row.hot {
  stroke: var(--accent);
  stroke-width: 1.6;
  fill: var(--accent-soft);
}
.row.bad {
  stroke: var(--p3);
  stroke-width: 1.6;
}
.lit .row {
  stroke: var(--accent);
  stroke-width: 1.6;
}
.strongcode {
  font-weight: 700;
  fill: var(--ink);
}
.signline {
  stroke: var(--ink-2);
  stroke-width: 1.2;
  stroke-dasharray: 2 3;
}
.danger.dashed {
  stroke-dasharray: 4 3;
}
.box.skipped {
  opacity: 0.45;
  stroke-dasharray: 3 3;
}
.box.wrong {
  stroke: var(--p3);
  stroke-width: 1.8;
}
</style>
