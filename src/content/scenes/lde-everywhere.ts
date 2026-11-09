import type { SceneDef } from './index'

/** The running figure of “Limited direct execution, all the way up”. */
const scene: SceneDef = {
  height: 460,
  bands: {
    overview: [8, 456],
    recipe: [8, 456],
    'trap-emulate': [8, 396],
    vtx: [8, 396],
    shadow: [8, 456],
    nested: [8, 456],
    firecracker: [8, 396],
    ebpf: [186, 396],
    'sched-ext': [220, 396],
    wasm: [8, 456],
    epoch: [8, 176],
    go: [8, 350],
    pattern: [8, 456],
  },
  parts: {
    guest: [14, 134],
    gkernel: [64, 126],
    gpt: [90, 108],
    exit: [126, 332],
    jailer: [158, 294],
    vmm: [176, 224],
    renderer: [14, 288],
    wasm: [56, 108],
    linmem: [118, 230],
    epoch: [118, 168],
    wasmsig: [228, 408],
    goproc: [14, 288],
    gor: [40, 132],
    sysmon: [174, 216],
    sigurg: [126, 332],
    kernel: [312, 394],
    monitor: [330, 390],
    verifier: [320, 338],
    ebpf: [344, 388],
    traptable: [320, 338],
    ksched: [344, 388],
    watchdog: [320, 338],
    checks: [186, 250],
    hooks: [334, 388],
    tasks: [222, 258],
    cpu: [408, 452],
    mmu: [408, 452],
    timer: [408, 452],
  },
  states: {
    overview: {
      title: { en: 'One recipe, many layers', zh: '一个配方，许多层' },
      caption: {
        en: 'Every system in this piece lets someone else’s code run directly on the CPU and keeps a way to take control back: a virtual machine, a microVM’s monitor, a WebAssembly module in a browser, a Go program’s goroutines, and an eBPF program inside the kernel itself.',
        zh: '这篇文章里的每个系统，都让别人的代码直接在 CPU 上运行，同时留着收回控制权的办法：虚拟机、微虚拟机的监控器、浏览器里的 WebAssembly 模块、Go 程序的 goroutine，以及内核内部的 eBPF 程序。',
      },
    },
    recipe: {
      title: { en: 'Chapter 6’s recipe', zh: '第 6 章的配方' },
      caption: {
        en: 'The process runs directly in user mode. The only way into the kernel is a trap through the trap table. The timer interrupts every few milliseconds, whatever the process is doing, and the MMU checks every address it issues.',
        zh: '进程在用户模式下直接运行；进入内核的唯一途径，是经由陷阱表的一次陷阱。不管进程在做什么，时钟每隔几毫秒就中断一次；它发出的每个地址都由 MMU 检查。',
      },
    },
    'trap-emulate': {
      title: { en: 'Trap and emulate', zh: '陷入并模拟' },
      caption: {
        en: 'Run the guest kernel in user mode: each privileged instruction traps to the monitor, which does it on the virtual machine’s state. On x86, popf in user mode does not trap, so the monitor never sees it; VMware rewrote such code with binary translation.',
        zh: '让客户内核运行在用户模式：每条特权指令都陷入监控器，由它在虚拟机的状态上完成。在 x86 上，用户模式下的 popf 不会陷入，监控器根本看不见；VMware 用二进制翻译改写这类代码。',
      },
    },
    vtx: {
      title: { en: 'VT-x: a mode for guests', zh: 'VT-x：客户专用的模式' },
      caption: {
        en: 'The guest runs in a mode of its own. The VMCS holds its CPU state and the list of events that cause a VM exit back to the monitor. A system call inside the guest exits nothing and runs directly: 246 cycles against 242 natively.',
        zh: '客户运行在专属于它的模式里。VMCS 保存它的 CPU 状态，以及哪些事件会引发 VM 退出、回到监控器。客户内部的系统调用不引起退出，直接运行：246 个周期，原生是 242。',
      },
    },
    shadow: {
      title: { en: 'Shadow page tables', zh: '影子页表' },
      caption: {
        en: 'In 2006 the guest edited its own page table, but the MMU used a shadow copy the monitor kept in sync. So every guest page-table write, and every page fault, became a VM exit costing thousands of cycles.',
        zh: '2006 年，客户修改的是自己的页表，MMU 用的却是监控器同步维护的影子副本。于是客户每次写页表、每次页错误，都变成一次耗费数千周期的 VM 退出。',
      },
    },
    nested: {
      title: { en: 'Nested paging', zh: '嵌套分页' },
      caption: {
        en: 'Now the MMU walks two tables itself: the guest’s, from guest-virtual to guest-physical addresses, and the monitor’s, from guest-physical to host-physical. The guest edits its own tables without exits; the price is a longer walk on a TLB miss.',
        zh: '现在由 MMU 自己走两套页表：客户的，把客户虚拟地址映射到客户物理地址；监控器的，再把客户物理地址映射到宿主物理地址。客户改自己的页表不再退出，代价是 TLB 未命中时的遍历变长了。',
      },
      demo: {
        label: { en: 'Why a nested walk can take 24 reads', zh: '嵌套遍历为何最多要 24 次读取' },
        steps: [
          {
            en: 'Without a VM. On a TLB miss the hardware walks a four-level page table: one entry per level, four memory reads, and then it can read the data.',
            zh: '没有虚拟机时。TLB 未命中，硬件遍历四级页表：每级读一项，共读四次内存，然后才能读数据本身。',
          },
          {
            en: 'In a VM, each guest page-table entry sits at a guest-physical address. Before the hardware can read the top guest entry, it must translate that address through the monitor’s four-level nested table: four reads, then the guest entry itself. Five reads for one guest level.',
            zh: '在虚拟机里，每个客户页表项都位于一个客户物理地址上。硬件要读顶层的客户页表项，得先把这个地址经监控器的四级嵌套页表转换一遍：读四次，再读客户页表项本身。一级客户页表，五次读取。',
          },
          {
            en: 'The same holds for every guest level: a nested walk of four, then the guest entry. Four guest levels make 4 × 5 = 20 reads.',
            zh: '每一级客户页表都是如此：先做一次四步的嵌套遍历，再读客户页表项。四级客户页表，共 4 × 5 = 20 次读取。',
          },
          {
            en: 'The last guest entry gives the data’s guest-physical address, which needs one more nested walk: 4 reads. Total 24, against 4 without a VM.',
            zh: '最后一级客户页表项给出的是数据的客户物理地址，还要再做一次嵌套遍历：4 次。合计 24 次，而不用虚拟机时只要 4 次。',
          },
          {
            en: 'Many of these nested entries are read again and again, walk after walk. Caching them in page-walk caches absorbs much of the cost, and every TLB hit avoids the walk entirely.',
            zh: '这些嵌套页表项里，许多会在一次又一次的遍历中被反复读到。把它们存在页表遍历缓存里，能吸收掉相当一部分开销；而每一次 TLB 命中，都能完全省掉这趟遍历。',
          },
        ],
      },
    },
    firecracker: {
      title: { en: 'Firecracker: three layers', zh: 'Firecracker：叠了三层' },
      caption: {
        en: 'Guest code runs directly. A VM exit lands in KVM, in the host kernel; what KVM does not handle, such as devices, goes up to the Firecracker process. That process is jailed in its own namespaces and cgroups, and seccomp filters its system calls.',
        zh: '客户代码直接运行。VM 退出落到宿主内核里的 KVM；KVM 不处理的事，比如设备，再上交给 Firecracker 进程。这个进程被 jailer 关进独立的命名空间和 cgroup，它的系统调用还要经过 seccomp 过滤。',
      },
    },
    ebpf: {
      title: { en: 'eBPF: check, then run', zh: 'eBPF：先检查，再运行' },
      caption: {
        en: 'An eBPF program runs inside the kernel, so no trap can catch it. Before it is loaded, the verifier simulates every path it can take; once in, it can call only the helper functions the kernel offers.',
        zh: 'eBPF 程序在内核里面运行，没有陷阱能接住它。加载之前，验证器把它可能走的每条路径都模拟一遍；进了内核，它也只能调用内核开放的辅助函数。',
      },
    },
    'sched-ext': {
      title: { en: 'sched_ext keeps a watchdog', zh: 'sched_ext 留着看门狗' },
      caption: {
        en: 'With sched_ext a BPF program decides which task runs next. The verifier proves it cannot crash the kernel, not that it schedules well, so on a stalled task, an error or SysRq-S the kernel moves every task back to the fair-class scheduler.',
        zh: '有了 sched_ext，由一个 BPF 程序决定下一个运行哪个任务。验证器能证明它不会让内核崩溃，却证明不了它调度得好；所以一旦有任务停滞、出错或按下 SysRq-S，内核就把所有任务送回公平调度类。',
      },
    },
    wasm: {
      title: { en: 'WebAssembly’s walls', zh: 'WebAssembly 的墙' },
      caption: {
        en: 'The module is validated before it runs. In Wasmtime, its 4 GiB linear memory has 2 GiB of unmapped guard region on each side, so an access out of bounds hits an unmapped page: a page fault, a signal, and Wasmtime turns it into a WebAssembly trap.',
        zh: '模块运行前先经过验证。在 Wasmtime 里，4 GiB 的线性内存两侧各有 2 GiB 未映射的保护区；越界访问落在未映射的页上：页错误、信号，再由 Wasmtime 转成一次 WebAssembly 陷阱。',
      },
    },
    epoch: {
      title: { en: 'A timer made of software', zh: '软件做的时钟' },
      caption: {
        en: 'Validation does not prove a module stops. With epoch interruption, compiled code checks a counter that another thread increments on a timer, at a cost of about 10%; fuel instead charges for the code executed.',
        zh: '验证证明不了模块一定会停。采用纪元中断时，编译出的代码会检查一个由另一线程按时递增的计数器，代价约 10%；燃料则按执行的代码计费。',
      },
    },
    go: {
      title: { en: 'Go preempts with a signal', zh: 'Go 用信号来抢占' },
      caption: {
        en: 'A goroutine in a loop without function calls never reaches a safe point. Since Go 1.14, sysmon notices one that has run for more than 10 ms and has the kernel send SIGURG to its thread; the handler switches goroutines if it can stop safely there.',
        zh: '一个在不含函数调用的循环里打转的 goroutine，永远走不到安全点。从 Go 1.14 起，sysmon 发现某个 goroutine 运行超过 10 ms，就让内核向它所在的线程发送 SIGURG；如果能在那里安全停下，处理程序就切换 goroutine。',
      },
    },
    pattern: {
      title: { en: 'Before, or while it runs', zh: '事前，还是事中' },
      caption: {
        en: 'Two ways to stay in control. Check the code before it runs (the eBPF verifier, WebAssembly validation), or catch it while it runs (traps, VM exits, guard-page faults, timers). Every mature system here does both.',
        zh: '保住控制权有两种办法：在代码运行前检查它（eBPF 验证器、WebAssembly 验证），或在它运行时拦住它（陷阱、VM 退出、保护页错误、定时器）。这里每个成熟的系统都两者兼用。',
      },
    },
  },
  terms: {
    goroutine: ['gor'],
    hypervisor: ['monitor', 'guest'],
    'page-table': ['gpt'],
    'page-fault': ['mmu'],
    mmu: ['mmu'],
    tlb: ['mmu'],
    'nested-paging': ['gpt', 'monitor', 'mmu'],
    kvm: ['monitor'],
    vcpu: ['guest'],
    namespace: ['jailer'],
    cgroup: ['jailer'],
    seccomp: ['jailer'],
    bpf: ['ebpf', 'verifier'],
    tracepoint: ['hooks', 'ebpf'],
    'control-flow-graph': ['verifier', 'checks'],
    'halting-problem': ['verifier', 'checks'],
    jit: ['ebpf'],
    sysrq: ['ksched'],
    'fair-class': ['ksched'],
    watchdog: ['watchdog'],
    liveness: ['watchdog'],
    webassembly: ['wasm', 'linmem'],
    'base-bounds': ['linmem'],
    wasmtime: ['renderer'],
    signal: ['wasmsig'],
  },
}

export default scene
