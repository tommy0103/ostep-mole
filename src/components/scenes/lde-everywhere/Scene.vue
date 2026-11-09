<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import NestedWalkDemo from './NestedWalkDemo.vue'

/**
 * The running figure of the limited-direct-execution article: one machine, seen as layers. Above
 * the kernel, three columns of code that runs directly: a virtual machine with its monitor's
 * process (left), a browser renderer with a WebAssembly module (middle), a Go program (right).
 * In the kernel, the monitor (KVM), an eBPF program behind its verifier, the trap table and the
 * scheduler; under it all, the CPU, the MMU and the timer. Each state shows one layer's version
 * of the recipe: what runs directly, what restricts it, and how control comes back.
 */
const props = defineProps<DrawingProps>()

const ALL = ['guest', 'gapp', 'gkernel', 'vmm', 'jailer', 'renderer', 'wasm', 'linmem', 'goproc', 'gor', 'sysmon', 'kernel', 'monitor', 'verifier', 'ebpf', 'traptable', 'ksched', 'hw']
const SHOW: Record<string, string[]> = {
  overview: ALL,
  recipe: ['goproc', 'usercode', 'trap', 'traptable', 'ksched', 'kernel', 'hw', 'tick', 'mmucheck'],
  'trap-emulate': ['guest', 'gapp', 'gkernel', 'kernel', 'monitor', 'hw', 'exit', 'popf'],
  vtx: ['guest', 'gapp', 'gkernel', 'gsys', 'kernel', 'monitor', 'vmcs', 'hw', 'exit', 'enter'],
  shadow: ['guest', 'gapp', 'gkernel', 'gpt', 'kernel', 'monitor', 'shadowpt', 'hw', 'exit', 'shadowlink'],
  nested: ['guest', 'gapp', 'gkernel', 'gpt', 'kernel', 'monitor', 'nestedpt', 'hw', 'nestedlinks'],
  firecracker: ['guest', 'gapp', 'gkernel', 'vmm', 'jailer', 'kernel', 'monitor', 'hw', 'exit', 'upcall'],
  ebpf: ['kernel', 'verifier', 'ebpf', 'bytecode', 'checks', 'hooks', 'hw'],
  'sched-ext': ['kernel', 'ebpf', 'ksched', 'watchdog', 'policy', 'tasks', 'hw'],
  wasm: ['renderer', 'wasm', 'linmem', 'kernel', 'hw', 'oob', 'wasmsig'],
  epoch: ['renderer', 'wasm', 'epoch', 'kernel', 'hw'],
  go: ['goproc', 'gor', 'sysmon', 'sigurg', 'kernel', 'hw'],
  pattern: [...ALL, 'legend'],
}
// 'hw' stands for the three boxes of the hardware row
for (const k of Object.keys(SHOW)) SHOW[k] = SHOW[k].flatMap((p) => (p === 'hw' ? ['hw', 'cpu', 'mmu', 'timer'] : [p]))
const { shown, part, L, viewBox, still } = useDrawing(props, SHOW, 460)
const st = computed(() => props.state)
const VM = ['vtx', 'shadow', 'nested', 'firecracker']

const guestTag = computed(() =>
  st.value === 'trap-emulate' ? L('guest · in user mode', '客户 · 跑在用户模式') : VM.includes(st.value) ? L('guest mode', '客户模式') : L('virtual machine', '虚拟机'),
)
const exitTag = computed(() => (st.value === 'trap-emulate' ? L('trap', '陷入') : st.value === 'shadow' ? L('VM exit on each PT write', '每次写页表都 VM 退出') : L('VM exit', 'VM 退出')))
const procLabel = computed(() => (st.value === 'recipe' ? L('Process', '进程') : L('Go program', 'Go 程序')))
const schedSub = computed(() =>
  st.value === 'recipe' ? L('switches process', '切换进程') : st.value === 'sched-ext' ? L('policy: BPF', '策略：BPF') : L('picks who runs', '决定谁运行'),
)
const cpuSub = computed(() => (st.value === 'recipe' ? L('user / kernel mode', '用户态 / 内核态') : VM.includes(st.value) || st.value === 'trap-emulate' ? L('+ guest mode', '+ 客户模式') : L('privilege modes', '特权模式')))
const cpuSubShown = computed(() => (st.value === 'trap-emulate' ? L('user / kernel mode', '用户态 / 内核态') : cpuSub.value))
const mmuSub = computed(() =>
  st.value === 'nested' ? L('walks both tables', '两套页表都要走') : st.value === 'shadow' ? L('uses the shadow', '用的是影子页表') : st.value === 'wasm' ? L('faults on guards', '碰到保护区就出错') : L('checks addresses', '检查每个地址'),
)
const kvmSub = computed(() => (['overview', 'pattern', 'firecracker', 'nested'].includes(st.value) ? L('KVM on Linux', 'Linux 上即 KVM') : ''))
</script>

<template>
  <NestedWalkDemo v-if="demo && state === 'nested'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('Layers of limited direct execution', '受限直接执行的各层')">
    <defs>
      <marker id="lde-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <marker id="lde-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="bad-head" />
      </marker>
    </defs>

    <!-- ── hardware ── -->
    <g :class="part('hw')">
      <g :class="part('cpu')">
        <rect x="8" y="408" width="108" height="44" rx="6" class="box floor" />
        <text x="62" y="426" class="lbl c">CPU</text>
        <text x="62" y="441" class="sub c">{{ cpuSubShown }}</text>
      </g>
      <g :class="part('mmu')">
        <rect x="126" y="408" width="108" height="44" rx="6" class="box floor" />
        <text x="180" y="426" class="lbl c">MMU</text>
        <text x="180" y="441" class="sub c">{{ mmuSub }}</text>
      </g>
      <g :class="part('timer')">
        <rect x="244" y="408" width="108" height="44" rx="6" class="box floor" />
        <text x="298" y="426" class="lbl c">{{ L('Timer', '定时器') }}</text>
        <text x="298" y="441" class="sub c">{{ L('periodic interrupt', '定期中断') }}</text>
      </g>
    </g>

    <!-- ── the kernel ── -->
    <g :class="part('kernel')">
      <rect x="8" y="312" width="344" height="82" rx="6" class="box floor" />
      <text x="26" y="324" class="tag">{{ L('Kernel', '内核') }}</text>
    </g>
    <g :class="part('monitor')">
      <rect x="16" y="330" width="92" height="58" rx="5" class="box" />
      <text x="62" y="346" class="lbl c">{{ L('Monitor', '监控器') }}</text>
      <text x="62" y="359" class="sub c">{{ kvmSub }}</text>
      <g :class="part('vmcs')">
        <rect x="24" y="365" width="76" height="17" rx="3" class="box gate" />
        <text x="62" y="377" class="tag hi c">VMCS</text>
      </g>
      <g :class="part('shadowpt')">
        <rect x="24" y="365" width="76" height="17" rx="3" class="box gate" />
        <text x="62" y="377" class="tag hi c">{{ L('shadow PT', '影子页表') }}</text>
      </g>
      <g :class="part('nestedpt')">
        <rect x="24" y="365" width="76" height="17" rx="3" class="box gate" />
        <text x="62" y="377" class="tag hi c">{{ L('nested PT', '嵌套页表') }}</text>
      </g>
    </g>
    <g :class="part('verifier')">
      <rect x="134" y="320" width="92" height="18" rx="3" class="box gate" />
      <text x="180" y="332.5" class="tag hi c">{{ L('verifier', '验证器') }}</text>
    </g>
    <g :class="part('ebpf')">
      <rect x="134" y="344" width="92" height="44" rx="5" class="box" />
      <text x="180" y="362" class="lbl c">{{ L('eBPF program', 'eBPF 程序') }}</text>
      <text x="180" y="377" class="sub c">{{ L('calls helpers only', '只能调辅助函数') }}</text>
    </g>
    <g :class="part('traptable')">
      <rect x="252" y="320" width="92" height="18" rx="3" class="box gate" />
      <text x="298" y="332.5" class="tag hi c">{{ L('trap table', '陷阱表') }}</text>
    </g>
    <g :class="part('watchdog')">
      <rect x="252" y="320" width="68" height="18" rx="3" class="box gate" />
      <text x="286" y="332.5" class="tag hi c">{{ L('watchdog', '看门狗') }}</text>
    </g>
    <g :class="part('ksched')">
      <rect x="252" y="344" width="92" height="44" rx="5" class="box" />
      <text x="298" y="362" class="lbl c">{{ L('Scheduler', '调度器') }}</text>
      <text x="298" y="377" class="sub c">{{ schedSub }}</text>
    </g>

    <!-- ── left column: a virtual machine and its monitor's process ── -->
    <g :class="part('guest')">
      <rect x="8" y="14" width="108" height="120" rx="8" class="outline" />
      <text x="14" y="27" class="tag">{{ guestTag }}</text>
    </g>
    <g :class="part('gapp')">
      <rect x="18" y="33" width="88" height="23" rx="4" class="box" />
      <text x="62" y="48.5" class="sub c">{{ L('guest app', '客户应用') }}</text>
    </g>
    <g :class="part('gkernel')">
      <rect x="18" y="64" width="88" height="62" rx="5" class="box" />
      <text x="62" y="81" class="lbl c">{{ L('guest kernel', '客户内核') }}</text>
      <g :class="part('gpt')">
        <rect x="28" y="90" width="68" height="18" rx="3" class="box gate" />
        <text x="62" y="102.5" class="tag hi c">{{ L('page table', '页表') }}</text>
      </g>
    </g>
    <!-- a system call inside the guest stays inside the guest -->
    <g :class="part('gsys')">
      <path d="M106,45 C114,50 114,70 107,76" class="call" marker-end="url(#lde-arrow)" />
      <text x="122" y="50" class="tag hi">{{ L('system call in the guest:', '客户里的系统调用：') }}</text>
      <text x="122" y="62" class="tag">{{ L('no exit, 246 vs 242 cycles', '不退出，246 对 242 周期') }}</text>
    </g>

    <g :class="part('jailer')">
      <rect x="30" y="162" width="86" height="130" rx="8" class="outline" />
      <text x="36" y="175" class="tag">jailer</text>
      <text x="38" y="244" class="tag">{{ L('namespaces', '命名空间') }}</text>
      <text x="38" y="256" class="tag">cgroups</text>
      <rect x="38" y="264" width="52" height="18" rx="3" class="box gate" />
      <text x="64" y="276.5" class="tag hi c">seccomp</text>
    </g>
    <g :class="part('vmm')">
      <rect x="34" y="182" width="78" height="46" rx="5" class="box" />
      <text x="73" y="200" class="lbl c">Firecracker</text>
      <text x="73" y="215" class="sub c">{{ L('VMM process', 'VMM 进程') }}</text>
    </g>

    <!-- the way back to the monitor -->
    <g :class="part('exit')">
      <path d="M20,127 L20,328" class="call" marker-end="url(#lde-arrow)" />
      <text x="26" y="150" class="tag hi">{{ exitTag }}</text>
    </g>
    <g :class="part('enter')">
      <path d="M96,328 L96,128" class="link solid" marker-end="url(#lde-arrow)" />
      <text x="102" y="200" class="tag">{{ L('enter the guest (one instruction)', '进入客户（一条指令）') }}</text>
      <text x="26" y="250" class="tag">{{ L('exits on', '清单上的') }}</text>
      <text x="26" y="262" class="tag">{{ L('the events', '事件发生时') }}</text>
      <text x="26" y="274" class="tag">{{ L('listed in', '退出，清单') }}</text>
      <text x="26" y="286" class="tag">{{ L('the VMCS', '在 VMCS 里') }}</text>
    </g>
    <g :class="part('popf')">
      <path d="M90,127 L90,170" class="danger" />
      <text x="90" y="182" class="bad-text c big">✕</text>
      <text x="102" y="166" class="tag bad-text">{{ L('popf: no trap,', 'popf：不陷入，') }}</text>
      <text x="102" y="178" class="tag">{{ L('the flag stays as it was', '标志位原样不动') }}</text>
      <text x="40" y="286" class="tag">{{ L('other privileged instructions trap;', '其他特权指令会陷入，') }}</text>
      <text x="40" y="298" class="tag">{{ L('the monitor emulates them', '由监控器来模拟') }}</text>
      <text x="40" y="222" class="tag hi">{{ L('VMware’s fix: binary translation', 'VMware 的绕法：二进制翻译') }}</text>
      <text x="40" y="234" class="tag">{{ L('rewrites such code to call the monitor', '把这类代码改写成调用监控器') }}</text>
    </g>
    <g :class="part('shadowlink')">
      <path d="M100,374 C140,374 168,384 176,404" class="link solid" marker-end="url(#lde-arrow)" />
      <text x="126" y="362" class="tag">{{ L('the MMU uses this copy', 'MMU 用的是这份副本') }}</text>
      <text x="122" y="100" class="tag">{{ L('the guest edits its own;', '客户改的是自己这份；') }}</text>
      <text x="122" y="112" class="tag">{{ L('the monitor keeps a copy', '监控器同步一份副本') }}</text>
    </g>
    <g :class="part('nestedlinks')">
      <path d="M96,99 C176,104 186,250 182,404" class="link solid" marker-end="url(#lde-arrow)" />
      <path d="M100,374 C140,374 166,384 172,404" class="link solid" marker-end="url(#lde-arrow)" />
      <text x="192" y="150" class="tag">{{ L('guest-virtual', '客户虚拟地址') }}</text>
      <text x="192" y="162" class="tag">{{ L('→ guest-physical', '→ 客户物理地址') }}</text>
      <text x="196" y="346" class="tag">{{ L('guest-physical', '客户物理地址') }}</text>
      <text x="196" y="358" class="tag">{{ L('→ host-physical', '→ 宿主物理地址') }}</text>
      <text x="40" y="232" class="tag hi">{{ L('no exit for page-table edits', '客户改页表不必退出') }}</text>
    </g>
    <g :class="part('upcall')">
      <path d="M100,328 L100,226" class="call" marker-end="url(#lde-arrow)" />
      <text x="122" y="250" class="tag">{{ L('what KVM leaves,', 'KVM 不管的事，') }}</text>
      <text x="122" y="262" class="tag hi">{{ L('such as devices', '比如设备') }}</text>
    </g>

    <!-- ── middle column: a browser renderer running WebAssembly ── -->
    <g :class="part('renderer')">
      <rect x="126" y="14" width="108" height="274" rx="6" class="box" />
      <text x="180" y="32" class="lbl c">{{ L('Renderer', '渲染进程') }}</text>
      <text x="180" y="46" class="sub c">{{ L('an OS process', '一个普通进程') }}</text>
    </g>
    <g :class="part('wasm')">
      <rect x="136" y="56" width="88" height="52" rx="5" class="box strong" />
      <text x="180" y="74" class="lbl c">{{ L('Wasm module', 'Wasm 模块') }}</text>
      <text x="180" y="89" class="sub c">{{ L('validated', '已验证') }}</text>
      <text v-if="shown.has('epoch')" x="180" y="101" class="sub c">{{ L('loops check epoch', '循环处查纪元') }}</text>
    </g>
    <g :class="part('linmem')">
      <rect x="140" y="118" width="80" height="28" rx="2" class="guard" />
      <text x="180" y="135.5" class="tag c">{{ L('guard 2 GiB', '保护区 2 GiB') }}</text>
      <rect x="140" y="146" width="80" height="56" rx="2" class="mem" />
      <text x="180" y="170" class="tag hi c">{{ L('linear memory', '线性内存') }}</text>
      <text x="180" y="183" class="tag c">4 GiB</text>
      <rect x="140" y="202" width="80" height="28" rx="2" class="guard" />
      <text x="180" y="219.5" class="tag c">{{ L('guard 2 GiB', '保护区 2 GiB') }}</text>
    </g>
    <g :class="part('oob')">
      <path d="M216,108 C234,140 234,196 216,212" class="danger" marker-end="url(#lde-arrow-bad)" />
      <path d="M156,231 L156,404" class="call" marker-end="url(#lde-arrow)" />
      <path d="M186,406 L186,352" class="call" marker-end="url(#lde-arrow)" />
      <text x="192" y="384" class="tag hi">{{ L('page fault', '页错误') }}</text>
    </g>
    <g :class="part('wasmsig')">
      <path d="M214,342 L214,262" class="call" marker-end="url(#lde-arrow)" />
      <text x="208" y="304" class="tag end">{{ L('signal', '信号') }}</text>
      <text x="168" y="252" class="tag hi">{{ L('Wasm trap', 'Wasm 陷阱') }}</text>
    </g>
    <g :class="part('epoch')">
      <path d="M180,108 L180,120" class="link solid" marker-end="url(#lde-arrow)" />
      <rect x="136" y="122" width="88" height="46" rx="5" class="box gate" />
      <text x="180" y="140" class="lbl c">{{ L('epoch: 42', '纪元：42') }}</text>
      <text x="180" y="156" class="sub c">{{ L('timer thread: +1', '定时线程 +1') }}</text>
    </g>
    <g :class="part('bytecode')">
      <rect x="144" y="262" width="72" height="22" rx="4" class="box" />
      <text x="180" y="277" class="sub c">{{ L('bytecode', '字节码') }}</text>
      <path d="M180,284 L180,316" class="call" marker-end="url(#lde-arrow)" />
      <text x="186" y="304" class="tag">{{ L('load', '加载') }}</text>
    </g>
    <g :class="part('policy')">
      <path d="M226,366 L250,366" class="link solid" marker-end="url(#lde-arrow)" />
      <text x="136" y="262" class="tag">{{ L('if a task stalls, on an error,', '一旦任务停滞、出错，') }}</text>
      <text x="136" y="274" class="tag">{{ L('or on SysRq-S, the kernel', '或按下 SysRq-S，内核就') }}</text>
      <text x="136" y="290" class="tag hi">{{ L('sends every task back', '把所有任务送回') }}</text>
      <text x="136" y="302" class="tag hi">{{ L('to the fair class', '公平调度类') }}</text>
    </g>
    <g :class="part('tasks')">
      <rect x="256" y="236" width="26" height="20" rx="3" class="p0" />
      <rect x="286" y="236" width="26" height="20" rx="3" class="p1" />
      <rect x="316" y="236" width="26" height="20" rx="3" class="p2" />
      <text x="298" y="228" class="tag c">{{ L('runnable tasks', '可运行的任务') }}</text>
      <path d="M334,342 L334,260" class="link solid" marker-end="url(#lde-arrow)" />
      <text x="328" y="300" class="tag end">{{ L('picks next', '挑下一个') }}</text>
    </g>
    <g :class="part('checks')">
      <text x="136" y="196" class="tag hi">{{ L('the verifier, at load time:', '验证器在加载时：') }}</text>
      <text x="136" y="210" class="tag">{{ L('· simulates every path', '· 模拟每一条路径') }}</text>
      <text x="136" y="222" class="tag">{{ L('· no uninitialized reads', '· 不许读未初始化的值') }}</text>
      <text x="136" y="234" class="tag">{{ L('· memory accesses in bounds', '· 内存访问不越界') }}</text>
      <text x="136" y="246" class="tag">{{ L('· gives up after 1M instructions', '· 处理满一百万条指令即放弃') }}</text>
    </g>
    <g :class="part('hooks')">
      <path d="M134,366 L114,366" class="link solid" marker-end="url(#lde-arrow)" />
      <text x="24" y="342" class="tag hi">{{ L('attached to:', '挂在：') }}</text>
      <text x="24" y="355" class="tag">{{ L('network hooks', '网络钩子') }}</text>
      <text x="24" y="368" class="tag">{{ L('tracepoints', '跟踪点') }}</text>
      <text x="24" y="381" class="tag">{{ L('the scheduler (6.12)', '调度器（6.12 起）') }}</text>
    </g>

    <!-- ── right column: a process; a Go program ── -->
    <g :class="part('goproc')">
      <rect x="244" y="14" width="108" height="274" rx="6" class="box" />
      <text x="298" y="32" class="lbl c">{{ procLabel }}</text>
      <text v-if="state === 'recipe'" x="298" y="46" class="sub c">{{ L('user mode', '用户模式') }}</text>
    </g>
    <g :class="part('gor')">
      <text x="298" y="48" class="tag c">goroutines</text>
      <circle cx="270" cy="66" r="9" class="p0" />
      <circle cx="298" cy="66" r="9" class="p1" />
      <circle cx="326" cy="66" r="9" class="p2" />
      <text x="270" y="69.5" class="tag c gl">G</text>
      <text x="298" y="69.5" class="tag c gl">G</text>
      <text x="326" y="69.5" class="tag c gl">G</text>
      <path d="M270,75 L274,104" class="link solid" />
      <path d="M298,75 L322,104" class="link solid" />
      <rect x="254" y="104" width="40" height="22" rx="4" class="box" />
      <rect x="302" y="104" width="40" height="22" rx="4" class="box" />
      <text x="274" y="119" class="tag c">{{ L('thread', '线程') }}</text>
      <text x="322" y="119" class="tag c">{{ L('thread', '线程') }}</text>
      <!-- the goroutine stuck in a loop without calls -->
      <text x="254" y="140" class="tag bad-text":class="{ gone: state !== 'go' }">{{ L('loop, no calls', '循环，无函数调用') }}</text>
    </g>
    <g :class="part('sysmon')">
      <rect x="284" y="176" width="60" height="40" rx="5" class="box gate" />
      <text x="314" y="193" class="lbl c">sysmon</text>
      <text x="314" y="207" class="sub c">&gt; 10 ms?</text>
    </g>
    <g :class="part('sigurg')">
      <path d="M330,216 L330,328 L249,328 L249,115 L252,115" class="call" marker-end="url(#lde-arrow)" />
      <text x="302" y="248" class="tag hi c">SIGURG</text>
      <text x="302" y="343" class="tag c">{{ L('the kernel delivers', '由内核递送') }}</text>
    </g>
    <g :class="part('usercode')">
      <rect x="252" y="210" width="92" height="24" rx="4" class="box strong" />
      <text x="298" y="225.5" class="sub c">{{ L('runs on the CPU', '直接在 CPU 上跑') }}</text>
    </g>
    <g :class="part('trap')">
      <path d="M280,234 L280,316" class="call" marker-end="url(#lde-arrow)" />
      <text x="288" y="266" class="tag hi">{{ L('system call:', '系统调用：') }}</text>
      <text x="288" y="278" class="tag">{{ L('a trap', '一次陷阱') }}</text>
      <circle v-if="!still" r="3" class="dot">
        <animateMotion path="M280,236 L280,314" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </g>
    <g :class="part('tick')">
      <path d="M318,408 L318,390" class="call" marker-end="url(#lde-arrow)" />
      <text x="324" y="403" class="tag">{{ L('interrupt', '中断') }}</text>
    </g>
    <g :class="part('mmucheck')">
      <path d="M244,252 C206,252 190,330 186,404" class="link" marker-end="url(#lde-arrow)" />
      <text x="132" y="232" class="tag">{{ L('and a fourth: every', '还有第四样：') }}</text>
      <text x="132" y="244" class="tag">{{ L('address is checked', '每个地址都要检查') }}</text>
    </g>

    <!-- ── the two strategies ── -->
    <g :class="part('legend')">
      <rect x="132" y="317" width="96" height="24" rx="5" class="mark pre" />
      <rect x="132" y="52" width="96" height="60" rx="7" class="mark pre" />
      <rect x="13" y="327" width="98" height="64" rx="7" class="mark during" />
      <rect x="137" y="115" width="86" height="118" rx="5" class="mark during" />
      <rect x="241" y="405" width="114" height="50" rx="8" class="mark during" />
      <rect x="281" y="173" width="66" height="46" rx="7" class="mark during" />
      <rect x="249" y="317" width="98" height="24" rx="5" class="mark during" />
      <rect x="132" y="294" width="9" height="9" rx="2" class="key pre" />
      <text x="145" y="302" class="tag">{{ L('checked before', '事前检查') }}</text>
      <rect x="236" y="294" width="9" height="9" rx="2" class="key during" />
      <text x="249" y="302" class="tag">{{ L('caught while running', '运行中拦截') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.bad-head {
  fill: var(--p3);
}
.guard {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-dasharray: 3 2;
}
.mem {
  fill: var(--accent-soft);
  stroke: var(--rule-strong);
}
.lit .guard,
.lit .mem {
  stroke: var(--accent);
  stroke-width: 2;
}
text.gl {
  fill: #fff;
  font-weight: 600;
}
.mark {
  fill: none;
  stroke-width: 1.8;
}
.mark.pre,
.key.pre {
  stroke: var(--ok);
}
.mark.during,
.key.during {
  stroke: var(--warn);
}
.key {
  fill: none;
  stroke-width: 2;
}
</style>
