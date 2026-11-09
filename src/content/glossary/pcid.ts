import type { Term } from './index'

/** Terms of “How ASIDs saved Meltdown’s performance”. */
const terms: Record<string, Term> = {
  pcid: {
    title: { en: 'PCID (process-context identifier)', zh: 'PCID（进程上下文标识符）' },
    body: {
      en: 'x86’s name for the [[tlb|TLB]]’s address-space tag, available since Intel’s Westmere generation, around 2010. When it is enabled, the low 12 bits of [[cr3|CR3]] hold the current tag, and TLB entries made under one tag are not used under another, so switching address spaces need not flush them.',
      zh: 'x86 对 [[tlb|TLB]] 地址空间标签的叫法，从 Intel 大约 2010 年的 Westmere 一代开始提供。启用后，[[cr3|CR3]] 的低 12 位存放当前标签；在一个标签下建立的 TLB 项不会在另一个标签下被使用，所以切换地址空间时不必清空它们。',
    },
    chapter: 'vm-tlbs',
    note: 'pcid',
  },
  cr3: {
    title: { en: 'CR3', zh: 'CR3' },
    body: {
      en: 'The x86 control register that holds the physical address of the running address space’s top-level page table. Writing it switches address spaces. Its neighbour CR4 holds switches for processor features, among them the one that enables PCID.',
      zh: 'x86 的一个控制寄存器，存放当前地址空间顶层页表的物理地址；写它就切换了地址空间。它的邻居 CR4 存放处理器特性的开关，其中就有启用 PCID 的那一个。',
    },
    note: 'pcid',
  },
  kaslr: {
    title: { en: 'KASLR', zh: 'KASLR' },
    body: {
      en: 'Kernel address space layout randomization: loading the kernel at a random address at each boot, so that an attacker who finds a bug does not know where the kernel’s code and data are. It helps only while those addresses stay secret, and [[side-channel|side channels]] can reveal them.',
      zh: '内核地址空间布局随机化：每次启动都把内核加载到一个随机地址，让找到漏洞的攻击者不知道内核的代码和数据在哪里。它只在这些地址保密时才有用，而[[side-channel|侧信道]]能把它们泄露出来。',
    },
    note: 'aslr',
  },
  'side-channel': {
    title: { en: 'Side channel', zh: '侧信道' },
    body: {
      en: 'A way to learn a secret not by reading it but by watching a side effect of its use: how long an operation takes, which [[cpu-cache|cache]] lines are warm, how much power is drawn.',
      zh: '不直接读取秘密，而是观察使用它时的副作用来得知它：一个操作花了多久、哪些[[cpu-cache|缓存]]行是热的、耗了多少电。',
    },
  },
  'speculative-execution': {
    title: { en: 'Speculative and out-of-order execution', zh: '推测执行与乱序执行' },
    body: {
      en: 'A processor does not run instructions strictly one after another. It executes later instructions as soon as their inputs are ready (*out of order*), and it guesses past branches and checks that have not finished (*speculatively*). When a guess was wrong it discards the results, but effects such as which data is now in the [[cpu-cache|cache]] remain. [[spectre|Spectre and Meltdown]] exploit exactly that.',
      zh: '处理器并不严格地一条接一条执行指令。后面的指令只要输入就绪就先执行（*乱序*），还没算完的分支和检查也会先猜一个结果往下走（*推测*）。猜错了就丢弃结果，但诸如“哪些数据已进了[[cpu-cache|缓存]]”这样的影响会留下来。[[spectre|Spectre 与 Meltdown]] 利用的正是这一点。',
    },
  },
  idt: {
    title: { en: 'Interrupt descriptor table (IDT)', zh: '中断描述符表（IDT）' },
    body: {
      en: 'The x86 table that tells the CPU where the kernel’s handler for each interrupt and exception is: the trap table of chapter 6. The CPU reads it at the moment of the [[trap|trap]], before any kernel code has run, so it must be mapped in whatever page table is loaded.',
      zh: 'x86 上告诉 CPU 每种中断和异常该交给内核哪个处理程序的表，也就是第 6 章的陷阱表。CPU 在[[trap|陷入]]的那一刻、任何内核代码运行之前就要读它，所以无论当前装的是哪张页表，它都必须映射在里面。',
    },
    chapter: 'cpu-mechanisms',
  },
  'per-cpu': {
    title: { en: 'Per-CPU data', zh: '每 CPU 数据' },
    body: {
      en: 'Kernel variables of which every CPU has its own copy, so that CPUs can use them without locks. Linux keeps each CPU’s entry stacks, and its bookkeeping about what that CPU’s TLB holds, in such per-CPU areas.',
      zh: '每个 CPU 各有一份的内核变量，CPU 使用它们无需加锁。Linux 把每个 CPU 的入口栈，以及“这个 CPU 的 TLB 里装着什么”的记账信息，都放在这样的每 CPU 区域里。',
    },
  },
  'tlb-shootdown': {
    title: { en: 'TLB shootdown', zh: 'TLB 击落（shootdown）' },
    body: {
      en: 'When the kernel changes or removes a mapping that other CPUs may hold in their own [[tlb|TLBs]], it must make them drop it. Usually it interrupts each of those CPUs and has it flush the entry; some newer processors, such as AMD’s with INVLPGB, can broadcast the invalidation in hardware instead.',
      zh: '内核修改或删除了一个映射，而别的 CPU 的 [[tlb|TLB]] 里可能还存着它，就得让它们丢掉。通常的做法是给那些 CPU 各发一个中断，让它们自己清掉这一项；一些较新的处理器（比如支持 INVLPGB 的 AMD 处理器）可以改由硬件广播这次失效。',
    },
  },
  invlpg: {
    title: { en: 'invlpg', zh: 'invlpg' },
    body: {
      en: 'The x86 instruction that removes the [[tlb|TLB]] entry for one virtual page. With PCID enabled it is sure to remove the page’s entry for the current PCID and any global entry; it may or may not remove the entries of other PCIDs, so the kernel cannot rely on it for those.',
      zh: '从 [[tlb|TLB]] 里删除某一个虚拟页表项的 x86 指令。启用 PCID 后，它一定会清掉这一页在当前 PCID 下的表项和全局表项；其他 PCID 的表项可能清也可能不清，所以内核不能指望它。',
    },
  },
  'lts-kernel': {
    title: { en: 'Long-term kernel', zh: '长期支持内核' },
    body: {
      en: 'A Linux release that the kernel’s maintainers keep fixing for several years, by [[backport|backporting]] fixes from newer releases, so distributions and companies can stay on it. 4.4, 4.9 and 4.14 were such releases.',
      zh: '内核维护者会持续修补好几年的 Linux 版本：把新版本里的修复[[backport|回移]]过来，让发行版和公司可以一直用它。4.4、4.9 和 4.14 都是这样的版本。',
    },
  },
  'perf-counter': {
    title: { en: 'Hardware performance counters', zh: '硬件性能计数器' },
    body: {
      en: 'Counters built into the processor that count events while a program runs: cycles, instructions, cache and TLB misses, cycles spent walking page tables. Tools such as Linux’s `perf` read them.',
      zh: '处理器内置的计数器，在程序运行时对各种事件计数：周期、指令、缓存和 TLB 未命中、花在页表遍历上的周期。Linux 的 `perf` 之类的工具读取的就是它们。',
    },
  },
  'instructions-per-cycle': {
    title: { en: 'Instructions per cycle (IPC)', zh: '每周期指令数（IPC）' },
    body: {
      en: 'How many instructions a processor completes per clock cycle, on average. A modern core can complete several; a program that keeps waiting on memory, for example after TLB misses, completes far fewer.',
      zh: '处理器平均每个时钟周期完成多少条指令。现代处理器核心每周期能完成好几条；而一个总在等内存（比如 TLB 未命中之后）的程序，完成的要少得多。',
    },
  },
  msr: {
    title: { en: 'Model-specific register (MSR)', zh: '型号特定寄存器（MSR）' },
    body: {
      en: 'One of the many x86 registers, read and written by the kernel with special instructions, that report what a processor supports and control its settings. `IA32_ARCH_CAPABILITIES` is one: its bits tell the kernel which hardware flaws this processor does not have.',
      zh: 'x86 上众多由内核用专门指令读写的寄存器之一，用来报告处理器支持什么、控制它的各种设置。`IA32_ARCH_CAPABILITIES` 就是一个：它的各位告诉内核，这颗处理器没有哪些硬件缺陷。',
    },
  },
  'exception-level': {
    title: { en: 'Exception level (ARM)', zh: '异常级别（ARM）' },
    body: {
      en: 'ARM’s privilege levels: EL0 for user programs, EL1 for the OS kernel, EL2 for a [[hypervisor|hypervisor]] and EL3 for firmware. “Unmap kernel at EL0” means the kernel is not mapped while user code runs.',
      zh: 'ARM 的特权级：EL0 给用户程序，EL1 给操作系统内核，EL2 给[[hypervisor|虚拟机监控程序]]，EL3 给固件。“unmap kernel at EL0” 的意思是：用户代码运行时，内核不在映射里。',
    },
  },
  'virtually-indexed-cache': {
    title: { en: 'Virtually indexed cache', zh: '虚拟索引的缓存' },
    body: {
      en: 'A CPU cache that uses the virtual address to find where data may be, so the lookup can start before translation finishes. If it also matches lines by virtual address, the same address in two address spaces would collide, so such a cache must flush on a switch or tag its lines with an address-space identifier.',
      zh: '用虚拟地址来确定数据可能在哪儿的 CPU 缓存，这样不必等地址转换完成就能开始查找。如果它连匹配缓存行也用虚拟地址，两个地址空间里的同一个地址就会撞车，所以这样的缓存要么在切换时清空，要么给缓存行打上地址空间标识符。',
    },
  },
}

export default terms
