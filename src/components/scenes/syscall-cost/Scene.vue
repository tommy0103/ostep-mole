<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import TrapDemo from './TrapDemo.vue'
import RingDemo from './RingDemo.vue'
import MeltdownDemo from './MeltdownDemo.vue'
import VdsoDemo from './VdsoDemo.vue'

/**
 * The running figure of the system-call article: a program above the user/kernel boundary, the trap
 * that crosses it, the kernel's handler below, and the CPU state each crossing disturbs. To the
 * right are the ways of crossing less: the vDSO in user memory, and io_uring's two rings straddling
 * the boundary. No part moves; states light up and swap what stands in the right-hand column.
 */
const props = defineProps<DrawingProps>()

const CPU = ['cpu', 'pipeline', 'l1', 'tlb', 'cr3']
const BASE = ['program', 'gate', 'handler', 'boundary']
const RINGS = ['rings', 'sq', 'cq', 'kside']
const SHOW: Record<string, string[]> = {
  overview: [...BASE, 'trap', ...CPU, 'vdso', ...RINGS],
  meltdown: ['program', 'boundary', 'gate', 'handler', 'onetable', 'leak', 'samecr3'],
  account: [...BASE, 'trap', 'acct'],
  trap: [...BASE, 'trap', 'regs', 'seq'],
  indirect: [...BASE, 'trap', ...CPU, 'legend', 'graph'],
  kpti: [...BASE, 'trap', ...CPU, 'kptitables'],
  pcid: [...BASE, 'trap', ...CPU, 'kptitables', 'legend'],
  vvar: ['boundary', 'vvarmap'],
  vdso: [...BASE, 'vdso', 'publish', 'notrap'],
  compare: ['boundary', 'cmp'],
  batch: [...BASE, 'trap', 'packet', 'list'],
  rings: [...BASE, 'trap', ...RINGS, 'onetrap'],
  sqpoll: [...BASE, ...RINGS, 'notrap'],
  surface: [...BASE, ...RINGS, 'narrow'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 436)

const CELLS: Record<string, Record<string, string>> = {
  indirect: { pipeline: '......', l1: 'kkkuuu', tlb: 'kkuuuu' },
  pcid: { pipeline: 'uuuuuu', l1: 'uuuuuu', tlb: 'uuukkk' },
}
const cells = (panel: string) => [...(CELLS[props.state]?.[panel] ?? 'uuuuuu')]
const PANELS = computed(() => [
  { id: 'pipeline', x: 16, name: L('pipeline', '流水线'), note: props.state === 'indirect' ? L('flushed', '被冲刷') : '' },
  { id: 'l1', x: 98, name: L('L1 caches', 'L1 缓存'), note: props.state === 'indirect' ? L('displaced', '被挤掉') : '' },
  {
    id: 'tlb',
    x: 180,
    name: 'TLB',
    note: props.state === 'indirect' ? L('displaced', '被挤掉') : props.state === 'pcid' ? L('tags keep both', '有标签，两边都留') : '',
  },
])
const PROCS = [14, 128, 242]
const isSq = computed(() => props.state === 'sqpoll')
const isSurface = computed(() => props.state === 'surface')
const SEQ = computed(() => [
  ['swapgs', L('per-CPU data', '每 CPU 数据')],
  ['rsp', L('park the user stack', '暂存用户栈指针')],
  ['CR3', L('KPTI: full tables', 'KPTI：完整页表')],
  ['rsp', L('load the kernel stack', '载入内核栈')],
  ['push', L('registers: pt_regs', '寄存器：pt_regs')],
  ['call', L('the handler', '处理程序')],
])
const REGS = computed(() => [
  ['rax', L('call number', '调用号')],
  ['rdi rsi rdx r10 r8 r9', L('arguments', '参数')],
  ['rcx', L('return address', '返回地址')],
  ['r11', L('flags', '标志')],
  ['IA32_LSTAR', L('entry, set at boot', '入口，开机时写好')],
])
</script>

<template>
  <TrapDemo v-if="demo && state === 'trap'" :step="step ?? 0" :lang="lang" />
  <RingDemo v-else-if="demo && state === 'rings'" :step="step ?? 0" :lang="lang" />
  <VdsoDemo v-else-if="demo && state === 'vdso'" :step="step ?? 0" :lang="lang" />
  <MeltdownDemo v-else-if="demo && state === 'meltdown'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A program, the user/kernel boundary and the CPU', '程序、用户态与内核态的边界，以及 CPU')">
    <defs>
      <marker id="sc-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- the boundary the article is about -->
    <g :class="part('boundary')">
      <path d="M8,196 H352" class="link" />
      <text x="14" y="16" class="tag">{{ L('user mode', '用户态') }}</text>
      <text x="14" y="279" class="tag">{{ L('kernel mode', '内核态') }}</text>
    </g>

    <g :class="part('program')">
      <rect x="14" y="22" width="108" height="48" rx="6" class="box strong" />
      <text x="68" y="44" class="lbl c">{{ L('Your program', '你的程序') }}</text>
      <text x="68" y="60" class="sub c">{{ L('runs at full speed', '全速运行') }}</text>
    </g>

    <!-- the crossing -->
    <g :class="part('trap')">
      <path d="M50,70 V182" class="call" marker-end="url(#sc-arrow)" />
      <path d="M90,182 V72" class="call" marker-end="url(#sc-arrow)" />
      <path d="M50,208 V222" class="call" />
      <path d="M90,222 V208" class="call" />
    </g>
    <g :class="part('gate')">
      <rect x="30" y="184" width="76" height="24" rx="4" class="box gate" />
      <text x="68" y="200" class="lbl c">{{ L('trap', '陷阱') }}</text>
    </g>
    <g :class="part('handler')">
      <rect x="14" y="224" width="108" height="42" rx="6" class="box floor" />
      <text x="68" y="242" class="lbl c">{{ L('handler', '处理程序') }}</text>
      <text x="68" y="257" class="sub c">{{ L('does what you asked', '做你要的事') }}</text>
    </g>
    <g :class="part('notrap')">
      <text x="68" y="132" class="tag hi c">{{ isSq ? L('no system call', '没有系统调用') : L('no trap', '不陷入') }}</text>
    </g>
    <g :class="part('onetrap')">
      <text x="44" y="132" class="tag end">{{ L('one trap', '一次陷入') }}</text>
    </g>
    <g :class="part('narrow')">
      <text x="68" y="176" class="tag hi c">{{ L('one narrow entry', '一个狭窄的入口') }}</text>
    </g>

    <!-- before 2018: one page table, the kernel in it, and a load that outruns its check -->
    <g :class="part('onetable')">
      <text x="246" y="16" class="tag hi c">{{ L('one page table, before 2018', '一张页表，2018 年以前') }}</text>
      <rect x="146" y="24" width="200" height="46" class="ublock" />
      <text x="246" y="44" class="sub c on-text">{{ L('your memory', '你的内存') }}</text>
      <text x="246" y="59" class="tiny c on-text">{{ L('user mode may read', '用户态可读') }}</text>
      <rect x="146" y="70" width="200" height="100" class="kblock" />
      <text x="230" y="94" class="sub c on-text">{{ L('the kernel', '内核') }}</text>
      <text x="230" y="110" class="tiny c on-text">{{ L('with all physical memory', '连同全部物理内存') }}</text>
      <text x="230" y="124" class="tiny c on-text">{{ L('supervisor-only', '仅限特权态') }}</text>
      <rect x="290" y="140" width="48" height="20" rx="2" class="secret" />
      <text x="314" y="154" class="tiny c on-text">{{ L('a secret', '秘密') }}</text>
    </g>
    <g :class="part('leak')">
      <path d="M122,58 C214,64 300,92 312,138" class="spec" marker-end="url(#sc-arrow)" />
      <text x="16" y="96" class="tag bad-text">{{ L('a speculative load', '推测执行的加载') }}</text>
      <text x="16" y="110" class="tag bad-text">{{ L('uses the value', '先用上了读到的值') }}</text>
      <text x="16" y="124" class="tag bad-text">{{ L('before the fault', '异常才到') }}</text>
    </g>

    <g :class="part('samecr3')">
      <rect x="146" y="224" width="200" height="42" rx="6" class="box floor" />
      <text x="246" y="242" class="lbl c">{{ L('CR3: the same table', 'CR3：还是同一张表') }}</text>
      <text x="246" y="257" class="sub c">{{ L('a trap only raises the privilege level', '陷入只提升特权级') }}</text>
    </g>

    <!-- n · c -->
    <g :class="part('acct')">
      <rect x="140" y="100" width="208" height="76" rx="6" class="box" />
      <text x="244" y="126" class="formula c">n · c</text>
      <text x="244" y="146" class="tag c">{{ L('time spent crossing, per second', '每秒花在跨越上的时间') }}</text>
      <text x="244" y="164" class="tag hi c">{{ L('lower c, or lower n', '降低 c，或者降低 n') }}</text>
    </g>

    <!-- the hardware half and the software half of one trap -->
    <g :class="part('regs')">
      <rect x="134" y="22" width="218" height="88" rx="6" class="box" />
      <g v-for="(r, i) in REGS" :key="i">
        <text x="142" :y="40 + i * 16" class="code small">{{ r[0] }}</text>
        <text x="344" :y="40 + i * 16" class="tag end">{{ r[1] }}</text>
      </g>
    </g>
    <g :class="part('seq')">
      <rect x="134" y="214" width="218" height="116" rx="6" class="box floor" />
      <text x="142" y="228" class="tag hi">{{ L('the kernel’s entry code', '内核入口代码') }}</text>
      <g v-for="(r, i) in SEQ" :key="i">
        <text x="142" :y="245 + i * 15" class="code small">{{ r[0] }}</text>
        <text x="200" :y="245 + i * 15" class="tag">{{ r[1] }}</text>
      </g>
    </g>

    <!-- a program's speed around one system call -->
    <g v-if="!lit.includes('rings')" :class="part('graph')">
      <text x="146" y="100" class="tag">{{ L('your program’s speed (schematic)', '程序的运行速度（示意）') }}</text>
      <path d="M146,170 H348" class="link solid" />
      <rect x="212" y="110" width="24" height="60" class="kbar" />
      <text x="224" y="182" class="tag c">{{ L('in the kernel', '在内核里') }}</text>
      <path d="M146,118 H212" class="call" />
      <path d="M236,158 C258,146 290,122 346,118" class="call" />
      <text x="262" y="166" class="tag">{{ L('refilling', '重新装填') }}</text>
    </g>

    <!-- KPTI: two sets of page tables -->
    <g :class="part('kptitables')">
      <text x="244" y="212" class="tag hi c">{{ L('CR3 switches at every entry and exit', '每次进出都切换 CR3') }}</text>
      <text x="190" y="228" class="tag c">{{ L('used in user mode', '用户态用') }}</text>
      <rect x="142" y="233" width="96" height="30" class="ublock" />
      <text x="190" y="252" class="sub c on-text">{{ L('your memory', '你的内存') }}</text>
      <rect x="142" y="263" width="96" height="14" class="kblock" />
      <text x="190" y="274" class="tiny c on-text">{{ L('entry code', '入口代码') }}</text>
      <rect x="142" y="277" width="96" height="44" class="nomap" />
      <text x="190" y="303" class="tiny c">{{ L('kernel: not mapped', '内核：未映射') }}</text>
      <text x="300" y="228" class="tag c">{{ L('used in the kernel', '内核用') }}</text>
      <rect x="252" y="233" width="96" height="30" class="ublock" />
      <text x="300" y="252" class="sub c on-text">{{ L('your memory', '你的内存') }}</text>
      <rect x="252" y="263" width="96" height="58" class="kblock" />
      <text x="300" y="294" class="sub c on-text">{{ L('the whole kernel', '整个内核') }}</text>
    </g>

    <!-- the vDSO: kernel code and data in user memory -->
    <g :class="part('vdso')">
      <rect x="134" y="22" width="102" height="48" rx="6" class="box" />
      <text x="185" y="44" class="lbl c">vDSO</text>
      <text x="185" y="60" class="sub c">clock_gettime()</text>
      <rect x="250" y="22" width="102" height="48" rx="6" class="box" />
      <text x="301" y="44" class="lbl c">{{ L('data page', '数据页') }}</text>
      <text x="301" y="60" class="sub c">{{ L('read-only here', '这里只读') }}</text>
      <path d="M122,46 H132" class="call" marker-end="url(#sc-arrow)" />
      <path d="M236,46 H248" class="call" marker-end="url(#sc-arrow)" />
    </g>
    <g :class="part('publish')">
      <rect x="250" y="224" width="102" height="42" rx="6" class="box floor" />
      <text x="301" y="242" class="lbl c">{{ L('Kernel', '内核') }}</text>
      <text x="301" y="257" class="sub c">{{ L('clock parameters', '时钟参数') }}</text>
      <path d="M301,224 V72" class="call" marker-end="url(#sc-arrow)" />
      <text x="307" y="150" class="tag">{{ L('publishes', '发布') }}</text>
    </g>

    <!-- [vdso] and [vvar] in three processes: one physical copy of each -->
    <g :class="part('vvarmap')">
      <text x="352" y="16" class="tag hi end">{{ L('every process maps the same two pages', '每个进程映射的都是同样两页') }}</text>
      <g v-for="(x, i) in PROCS" :key="i">
        <rect :x="x" y="24" width="104" height="24" rx="5" class="box strong" />
        <text :x="x + 52" y="40" class="lbl c">{{ L('process', '进程') }} {{ 'ABC'[i] }}</text>
        <rect :x="x" y="54" width="50" height="20" rx="2" class="box" />
        <text :x="x + 25" y="67" class="code c">[vdso]</text>
        <rect :x="x + 54" y="54" width="50" height="20" rx="2" class="box" />
        <text :x="x + 79" y="67" class="code c">[vvar]</text>
        <text :x="x + 25" y="86" class="tag c">r-x</text>
        <text :x="x + 79" y="86" class="tag c">{{ L('r-- only', '只读') }}</text>
        <path :d="`M${x + 25},92 L100,226`" class="link" />
        <path :d="`M${x + 79},92 L260,226`" class="link solid" />
      </g>
      <text x="100" y="296" class="tag c">{{ L('physical memory: one copy of each', '物理内存：各只有一份') }}</text>
      <rect x="40" y="228" width="120" height="36" rx="3" class="box" />
      <text x="100" y="244" class="lbl c">{{ L('vDSO code', 'vDSO 代码') }}</text>
      <text x="100" y="257" class="sub c">{{ L('built with the kernel', '随内核一起编译') }}</text>
      <rect x="200" y="228" width="120" height="36" rx="3" class="box strong" />
      <text x="260" y="244" class="lbl c">{{ L('time data', '时间数据') }}</text>
      <text x="260" y="257" class="sub c">seq · mult · shift · …</text>
      <rect x="200" y="300" width="120" height="38" rx="6" class="box floor" />
      <text x="260" y="317" class="lbl c">{{ L('timekeeping', '内核计时代码') }}</text>
      <text x="260" y="331" class="sub c">update_vsyscall()</text>
      <path d="M260,300 V268" class="call" marker-end="url(#sc-arrow)" />
      <text x="266" y="288" class="tag hi">{{ L('writes, every tick', '每个滴答写一次') }}</text>
    </g>

    <!-- the vDSO's mapping next to io_uring's -->
    <g :class="part('cmp')">
      <path d="M180,26 V386" class="link" />
      <text x="90" y="40" class="lbl c">vDSO</text>
      <text x="270" y="40" class="lbl c">io_uring</text>
      <g v-for="i in 3" :key="i">
        <rect :x="14 + (i - 1) * 54" y="50" width="46" height="24" rx="5" class="box strong" />
        <text :x="37 + (i - 1) * 54" y="66" class="sub c">{{ 'ABC'[i - 1] }}</text>
        <path :d="`M90,212 L${37 + (i - 1) * 54},78`" class="link solid" marker-end="url(#sc-arrow)" />
      </g>
      <text x="96" y="140" class="tag">{{ L('read', '读') }}</text>
      <rect x="40" y="214" width="100" height="30" rx="3" class="box strong" />
      <text x="90" y="233" class="sub c">{{ L('time data', '时间数据') }}</text>
      <rect x="40" y="300" width="100" height="34" rx="6" class="box floor" />
      <text x="90" y="321" class="lbl c">{{ L('kernel', '内核') }}</text>
      <path d="M90,300 V248" class="call" marker-end="url(#sc-arrow)" />
      <text x="96" y="278" class="tag">{{ L('writes', '写') }}</text>
      <text x="90" y="360" class="tag hi c">{{ L('one writer, every process reads', '一个写者，所有进程都读') }}</text>
      <text x="90" y="374" class="tag c">{{ L('nothing flows into the kernel', '没有东西流进内核') }}</text>

      <rect x="214" y="50" width="112" height="24" rx="5" class="box strong" />
      <text x="270" y="66" class="sub c">{{ L('one program', '一个程序') }}</text>
      <rect x="198" y="160" width="62" height="70" rx="4" class="box" />
      <text x="229" y="192" class="lbl c">SQ</text>
      <text x="229" y="206" class="tag c">{{ L('requests', '请求') }}</text>
      <rect x="282" y="160" width="62" height="70" rx="4" class="box" />
      <text x="313" y="192" class="lbl c">CQ</text>
      <text x="313" y="206" class="tag c">{{ L('results', '结果') }}</text>
      <rect x="214" y="300" width="112" height="34" rx="6" class="box floor" />
      <text x="270" y="321" class="lbl c">{{ L('kernel', '内核') }}</text>
      <path d="M229,78 V156" class="call" marker-end="url(#sc-arrow)" />
      <text x="223" y="120" class="tag end">{{ L('writes', '写') }}</text>
      <path d="M229,234 V296" class="danger" marker-end="url(#sc-arrow)" />
      <text x="223" y="270" class="tag bad-text end">{{ L('reads', '读') }}</text>
      <path d="M313,296 V234" class="call" marker-end="url(#sc-arrow)" />
      <text x="319" y="270" class="tag">{{ L('writes', '写') }}</text>
      <path d="M313,156 V78" class="call" marker-end="url(#sc-arrow)" />
      <text x="319" y="120" class="tag">{{ L('reads', '读') }}</text>
      <text x="270" y="360" class="tag hi c">{{ L('both sides write', '双方都写') }}</text>
      <text x="270" y="374" class="tag bad-text c">{{ L('the kernel reads what you wrote', '内核读你写下的东西') }}</text>
    </g>

    <!-- batching -->
    <g :class="part('packet')">
      <rect v-for="i in 4" :key="i" :x="54 + (i - 1) * 8.5" y="114" width="7" height="12" rx="1" class="p0" />
      <text x="96" y="124" class="tag">n</text>
    </g>
    <g :class="part('list')">
      <rect x="140" y="100" width="208" height="76" rx="6" class="box" />
      <text x="150" y="116" class="tag hi">{{ L('one trap, n requests', '一次陷入，n 个请求') }}</text>
      <text x="150" y="134" class="code small">readv() · writev()</text>
      <text x="150" y="150" class="code small">sendmmsg() · recvmmsg()</text>
      <text x="150" y="166" class="code small">epoll_wait()</text>
    </g>

    <!-- io_uring: two rings in memory both sides map -->
    <g :class="part('rings')">
      <text x="136" y="91" class="tag" :class="{ 'bad-text': isSurface }">{{ isSurface ? L('memory the user can change at any moment', '用户随时可以改动的内存') : L('memory shared by process and kernel', '进程和内核共享的内存') }}</text>
      <rect x="134" y="96" width="218" height="176" rx="9" class="outline" :class="{ warn: isSurface }" />
      <g :class="part('sq')">
        <text x="142" y="116" class="tag hi">{{ L('submission queue (SQ)', '提交队列（SQ）') }}</text>
        <g v-for="i in 6" :key="i">
          <rect :x="142 + (i - 1) * 25" y="122" width="24" height="22" rx="2" :class="i >= 4 ? 'p0' : 'empty'" />
          <text v-if="i >= 4" :x="154 + (i - 1) * 25" y="137" class="tiny c on-text">SQE</text>
        </g>
        <text x="144" y="157" class="tag">{{ L('tail: app writes', '队尾：应用写') }}</text>
        <text x="292" y="157" class="tag end">{{ L('head: kernel reads', '队头：内核读') }}</text>
      </g>
      <g :class="part('cq')">
        <text x="142" y="214" class="tag hi">{{ L('completion queue (CQ)', '完成队列（CQ）') }}</text>
        <g v-for="i in 6" :key="i">
          <rect :x="142 + (i - 1) * 25" y="220" width="24" height="22" rx="2" :class="i <= 2 ? 'p2' : 'empty'" />
          <text v-if="i <= 2" :x="154 + (i - 1) * 25" y="235" class="tiny c on-text">CQE</text>
        </g>
        <text x="144" y="255" class="tag">{{ L('head: app reads', '队头：应用读') }}</text>
        <text x="292" y="255" class="tag end">{{ L('tail: kernel writes', '队尾：内核写') }}</text>
      </g>
      <path d="M122,56 C132,60 130,128 140,132" class="call" marker-end="url(#sc-arrow)" />
      <path d="M140,231 C126,231 128,96 118,72" class="call" marker-end="url(#sc-arrow)" />
    </g>
    <g :class="part('kside')">
      <rect x="140" y="290" width="208" height="42" rx="6" class="box floor" :class="{ outrisk: isSurface }" />
      <text x="244" y="308" class="lbl c">{{ isSq ? L('SQPOLL kernel thread', 'SQPOLL 内核线程') : 'io_uring' }}</text>
      <text x="244" y="323" class="sub c" :class="{ 'bad-text': isSurface }">{{ isSq ? L('polls the submission ring', '轮询提交环') : isSurface ? L('a large asynchronous subsystem', '一个庞大的异步子系统') : L('the kernel’s side', '内核这一侧') }}</text>
      <path d="M332,290 V133 H294" class="call" marker-end="url(#sc-arrow)" />
      <path d="M312,290 V231 H294" class="call" marker-end="url(#sc-arrow)" />
    </g>

    <!-- the CPU state a crossing disturbs -->
    <g :class="part('cpu')">
      <rect x="8" y="342" width="344" height="88" rx="6" class="box floor" />
      <text x="18" y="358" class="lbl">CPU</text>
      <text v-if="shown.has('legend')" x="344" y="358" class="tag end">{{ L('blue: yours · green: the kernel’s', '蓝：你的 · 绿：内核的') }}</text>
    </g>
    <g v-for="p in PANELS" :key="p.id" :class="part(p.id)">
      <rect :x="p.x" y="364" width="76" height="60" rx="5" class="box" />
      <text :x="p.x + 38" y="377" class="tag c">{{ p.name }}</text>
      <rect
        v-for="(k, i) in cells(p.id)"
        :key="i"
        :x="p.x + 4 + i * 11.6"
        y="384"
        width="10"
        height="14"
        rx="1.5"
        :class="k === 'u' ? 'p0' : k === 'k' ? 'p2' : 'empty'"
      />
      <text :x="p.x + 38" y="414" class="tiny c">{{ p.note }}</text>
    </g>
    <g :class="part('cr3')">
      <rect x="262" y="364" width="82" height="60" rx="5" class="box" />
      <text x="303" y="377" class="code small c">CR3</text>
      <text x="303" y="396" class="tiny c">{{ L('page-table base', '页表基址') }}</text>
      <text x="303" y="414" class="tiny c">{{ state === 'kpti' || state === 'pcid' ? L('written twice per trip', '每趟写两次') : '' }}</text>
    </g>
  </svg>
</template>

<style scoped>
.small {
  font-size: 9.5px;
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.on-text {
  fill: #fff;
}
.formula {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
  fill: var(--ink);
}
.empty {
  fill: var(--bg-elev);
  stroke: var(--rule);
  stroke-width: 1;
}
.kbar {
  fill: var(--p2);
  opacity: 0.35;
}
.ublock {
  fill: var(--p0);
}
.kblock {
  fill: var(--p2);
}
.nomap {
  fill: none;
  stroke: var(--rule-strong);
  stroke-dasharray: 3 3;
}
.outrisk {
  stroke: var(--warn);
}
.secret {
  fill: var(--p3);
}
.spec {
  fill: none;
  stroke: var(--p3);
  stroke-width: 1.4;
  stroke-dasharray: 4 3;
}
.lit .ublock,
.lit .kblock {
  stroke: var(--accent);
  stroke-width: 2;
}
</style>
