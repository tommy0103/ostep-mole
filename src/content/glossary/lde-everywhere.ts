import type { Term } from './index'

/** Terms of “Limited direct execution, all the way up”: virtual machines, eBPF, WebAssembly, Go. */
const terms: Record<string, Term> = {
  hypervisor: {
    title: { en: 'Hypervisor (virtual machine monitor)', zh: '虚拟机监控器（hypervisor）' },
    body: {
      en: 'Software that runs virtual machines. It gives each guest operating system what looks like a whole machine of its own, while it keeps control of the real hardware. VMware’s products, Xen, Hyper-V and Linux’s [[kvm|KVM]] are hypervisors.',
      zh: '运行虚拟机的软件。它让每个客户操作系统都以为自己独占一整台机器，同时自己牢牢掌握真实的硬件。VMware 的产品、Xen、Hyper-V 和 Linux 的 [[kvm|KVM]] 都是虚拟机监控器。',
    },
  },
  'port-io': {
    title: { en: 'I/O port', zh: 'I/O 端口' },
    body: {
      en: 'On x86, devices can be reached through numbered I/O ports, a small address space of their own, with the special instructions `in` and `out`. Ordinary programs may not use them. Inside a virtual machine, the monitor makes the guest’s port accesses exit, so that it can play the device.',
      zh: '在 x86 上，设备可以通过编了号的 I/O 端口访问——这是一块独立的小地址空间，要用专门的 `in`、`out` 指令。普通程序不许使用它们。在虚拟机里，监控器让客户对端口的访问引发退出，好由它来扮演那个设备。',
    },
  },
  mmu: {
    title: { en: 'MMU (memory management unit)', zh: 'MMU（内存管理单元）' },
    body: {
      en: 'The part of the CPU that translates every address a program uses into a physical one, using the [[page-table|page tables]] the OS set up, with the [[tlb|TLB]] as its cache. When there is no valid translation, or the access is not allowed, it raises a [[page-fault|page fault]].',
      zh: 'CPU 中负责地址转换的部件：程序用到的每个地址，都由它按操作系统设好的[[page-table|页表]]转换成物理地址，[[tlb|TLB]] 是它的缓存。找不到有效的转换、或访问不被允许时，它就触发[[page-fault|页错误]]。',
    },
    chapter: 'vm-mechanism',
  },
  kvm: {
    title: { en: 'KVM (Kernel-based Virtual Machine)', zh: 'KVM（基于内核的虚拟机）' },
    body: {
      en: 'The [[hypervisor|hypervisor]] built into the Linux kernel since 2007. It runs guests with the CPU’s virtualization support (Intel VT-x, AMD-V) and leaves the rest, such as emulating devices, to an ordinary user process like QEMU or Firecracker, which drives it through `/dev/kvm`.',
      zh: '2007 年起内置于 Linux 内核的[[hypervisor|虚拟机监控器]]。它借助 CPU 的虚拟化支持（Intel VT-x、AMD-V）运行客户，其余的事，比如模拟设备，交给 QEMU 或 Firecracker 这样的普通用户进程，后者通过 `/dev/kvm` 驱动它。',
    },
  },
  vcpu: {
    title: { en: 'vCPU (virtual CPU)', zh: 'vCPU（虚拟 CPU）' },
    body: {
      en: 'A processor as a virtual machine sees it. Under [[kvm|KVM]], each vCPU is a [[thread|thread]] of the monitor’s process on the host, scheduled onto the real cores like any other thread.',
      zh: '虚拟机眼中的一颗处理器。在 [[kvm|KVM]] 下，每个 vCPU 都是宿主机上监控器进程的一个[[thread|线程]]，像其他线程一样被调度到真实的核心上。',
    },
  },
  serverless: {
    title: { en: 'AWS Lambda and Fargate', zh: 'AWS Lambda 与 Fargate' },
    body: {
      en: 'Amazon cloud services where customers hand over a function (Lambda, run on each request or event) or a container (Fargate) and AWS decides where it runs. Code from many customers shares the same physical hosts, so each piece needs a strong wall around it.',
      zh: '亚马逊的云服务：客户交出一个函数（Lambda，每来一个请求或事件就运行一次）或一个容器（Fargate），由 AWS 决定它在哪里运行。许多客户的代码共用同一批物理主机，所以每一份都需要一道结实的墙。',
    },
  },
  tracepoint: {
    title: { en: 'Tracepoint', zh: '跟踪点（tracepoint）' },
    body: {
      en: 'A fixed place in the Linux kernel’s code, put there by its developers, where tracing tools can attach and record an event, such as a system call starting or a task being switched. [[bpf|eBPF]] programs can be attached to tracepoints.',
      zh: 'Linux 内核代码中由开发者预先放好的固定位置，跟踪工具可以挂在这里记录事件，比如一次系统调用开始、一次任务切换。[[bpf|eBPF]] 程序可以挂在跟踪点上。',
    },
  },
  'control-flow-graph': {
    title: { en: 'Control-flow graph', zh: '控制流图' },
    body: {
      en: 'A map of a program’s possible paths. Each node is a straight run of instructions; each edge is a jump or branch from one to another. A loop shows up as an edge back to an earlier node.',
      zh: '一张描绘程序所有可能路径的图：每个节点是一段顺序执行的指令，每条边是从一段到另一段的跳转或分支。循环表现为一条指回前面节点的边。',
    },
  },
  'halting-problem': {
    title: { en: 'Halting problem', zh: '停机问题' },
    body: {
      en: 'Alan Turing’s 1936 result: no program can decide, for every program and input, whether that program eventually stops. A checker can still prove termination for some programs, by accepting only those simple enough for it to analyse.',
      zh: '图灵 1936 年的结论：不存在一个程序，能对任意程序和输入判定那个程序最终会不会停下。检查器仍然可以为*某些*程序证明它们会终止，办法是只接受简单到自己分析得了的程序。',
    },
  },
  sysrq: {
    title: { en: 'Magic SysRq key', zh: 'SysRq 魔术键' },
    body: {
      en: 'A key combination that the Linux kernel handles itself, even when the rest of the system is not responding: SysRq (on a PC, held with Alt) plus a letter, each letter one emergency command. With a sched_ext scheduler loaded, SysRq-S restores the default scheduler.',
      zh: '由 Linux 内核亲自处理的组合键，即使系统其他部分已经没有响应也有效：SysRq（在 PC 上要同时按住 Alt）加一个字母，每个字母对应一条应急命令。加载了 sched_ext 调度器时，SysRq-S 会恢复默认的调度器。',
    },
  },
  'fair-class': {
    title: { en: 'Fair class (Linux scheduler)', zh: '公平调度类（Linux）' },
    body: {
      en: 'The scheduling class Linux uses for ordinary tasks. It gives each runnable task a share of the CPU in proportion to its weight. Its algorithm was CFS until Linux 6.6 and is EEVDF since.',
      zh: 'Linux 用来调度普通任务的调度类，按权重比例给每个可运行任务分一份 CPU。它的算法在 Linux 6.6 之前是 CFS，之后是 EEVDF。',
    },
    chapter: 'cpu-sched-lottery',
    note: 'eevdf',
  },
  liveness: {
    title: { en: 'Safety and liveness', zh: '安全性与活性' },
    body: {
      en: 'Two kinds of guarantee. Safety: nothing bad ever happens, such as the kernel crashing. Liveness: something good eventually happens, such as every runnable task getting to run. The eBPF verifier checks a program for the first kind; sched_ext keeps a [[watchdog|watchdog]] for the second.',
      zh: '两类保证。安全性：坏事永远不会发生，比如内核崩溃。活性：好事终究会发生，比如每个可运行的任务终究能运行。eBPF 验证器为程序检查的是前一类；sched_ext 为后一类留着一只[[watchdog|看门狗]]。',
    },
  },
  watchdog: {
    title: { en: 'Watchdog', zh: '看门狗（watchdog）' },
    body: {
      en: 'A check that something keeps making progress, which acts when it stops: a timer the system must keep resetting, or a monitor of how long work has been waiting. In sched_ext, a runnable task that stalls makes the kernel abandon the BPF scheduler.',
      zh: '检查某样东西是否一直在推进、一旦停住就出手的机制：要么是一个系统必须不断重置的定时器，要么是一个盯着工作等了多久的监视器。在 sched_ext 里，可运行任务一旦停滞，内核就弃用 BPF 调度器。',
    },
  },
  webassembly: {
    title: { en: 'WebAssembly (Wasm)', zh: 'WebAssembly（Wasm）' },
    body: {
      en: 'A compact bytecode that browsers, and standalone runtimes such as [[wasmtime|Wasmtime]], run at close to native speed. Programs in C, C++, Rust and other languages are compiled to it. A module is validated before it runs and can touch only its own linear memory.',
      zh: '一种紧凑的字节码，浏览器和 [[wasmtime|Wasmtime]] 这类独立运行时能以接近原生的速度运行它。C、C++、Rust 等语言的程序可以编译成它。模块运行前要经过验证，而且只能碰它自己的线性内存。',
    },
  },
  'buffer-overflow': {
    title: { en: 'Buffer overflow', zh: '缓冲区溢出' },
    body: {
      en: 'A bug where a program writes past the end of an array into whatever memory follows. In C and C++ nothing stops it, and attackers use it to overwrite return addresses or other data that steers the program.',
      zh: '程序越过数组末尾、写进紧随其后的内存的错误。在 C 和 C++ 里没有任何东西拦着，攻击者借它改写返回地址或其他左右程序走向的数据。',
    },
    note: 'memory-safety',
  },
  'base-bounds': {
    title: { en: 'Base and bounds', zh: '基址/界限' },
    body: {
      en: 'The simplest hardware address translation. Each process gets a base, added to every address it uses, and a bound; an address past the bound causes a fault. The process can reach one contiguous region of memory and nothing else.',
      zh: '最简单的硬件地址转换：每个进程有一个基址，加到它用的每个地址上，还有一个界限，越过界限的地址会引发错误。进程只能碰到一块连续的内存，别的一概碰不到。',
    },
    chapter: 'vm-mechanism',
    note: 'bounds-revival',
  },
  wasmtime: {
    title: { en: 'Wasmtime', zh: 'Wasmtime' },
    body: {
      en: 'A standalone [[webassembly|WebAssembly]] runtime from the Bytecode Alliance, written in Rust. It runs Wasm modules outside the browser, for example on servers or inside other programs.',
      zh: 'Bytecode Alliance 出品、用 Rust 编写的独立 [[webassembly|WebAssembly]] 运行时，在浏览器之外运行 Wasm 模块，比如在服务器上，或嵌在别的程序里。',
    },
  },
  libc: {
    title: { en: 'libc', zh: 'libc' },
    body: {
      en: 'The C standard library: `printf`, `malloc`, wrappers for the [[syscall|system calls]] and much more, linked into nearly every program on a Unix-like system. glibc and musl are common versions on Linux.',
      zh: 'C 标准库：`printf`、`malloc`、各个[[syscall|系统调用]]的包装函数等等，类 Unix 系统上几乎每个程序都链接了它。Linux 上常见的版本有 glibc 和 musl。',
    },
  },
  jit: {
    title: { en: 'JIT compilation', zh: 'JIT 编译（即时编译）' },
    body: {
      en: 'Translating code into the machine’s own instructions while the program runs, just before it is needed, instead of ahead of time. The Linux kernel can JIT-compile an [[bpf|eBPF]] program once it has been verified, so it runs as native code.',
      zh: '在程序运行时、用到之前才把代码翻译成机器自己的指令，而不是事先翻译好。Linux 内核可以在 [[bpf|eBPF]] 程序通过验证后对它做 JIT 编译，让它以原生代码运行。',
    },
  },
  eintr: {
    title: { en: 'EINTR', zh: 'EINTR' },
    body: {
      en: 'The error a slow [[syscall|system call]], such as a read from a pipe or a socket, returns when a [[signal|signal]] arrives while it is waiting. Unless the call is set up to restart by itself, the program has to make it again.',
      zh: '慢速[[syscall|系统调用]]（比如从管道或套接字读数据）在等待期间遇到[[signal|信号]]时返回的错误码。除非这个调用被设置成自动重启，否则程序得自己再调一次。',
    },
  },
}

export default terms
