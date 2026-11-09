import type { SceneDef } from './index'

/** The running figure of “When the trap is too expensive”. */
const scene: SceneDef = {
  height: 436,
  bands: {
    overview: [6, 430],
    account: [6, 270],
    trap: [6, 336],
    indirect: [6, 430],
    kpti: [186, 430],
    pcid: [340, 430],
    vdso: [6, 270],
    batch: [6, 270],
    rings: [6, 336],
    sqpoll: [78, 336],
    surface: [78, 336],
  },
  parts: {
    program: [20, 76],
    trap: [70, 216],
    gate: [180, 212],
    handler: [218, 266],
    boundary: [188, 204],
    cpu: [342, 430],
    tlb: [362, 424],
    cr3: [362, 424],
    pipeline: [362, 424],
    l1: [362, 424],
    kptitables: [208, 332],
    vdso: [20, 76],
    seq: [212, 332],
    regs: [20, 104],
    rings: [88, 276],
    sq: [112, 164],
    cq: [208, 262],
    kside: [284, 332],
  },
  states: {
    overview: {
      title: { en: 'The price of a trip', zh: '往返一趟的价钱' },
      caption: {
        en: 'Your program runs at full speed until it needs something only the kernel may do, then traps across the boundary and comes back. Since the 2018 Meltdown fix, each trip has cost more, and part of the bill is paid in the CPU’s own state. On the right are two of the ways around it: the vDSO and io_uring’s shared rings.',
        zh: '你的程序全速运行，直到需要某件只有内核才能做的事，于是陷入、跨过边界，再回来。2018 年 Meltdown 的修补方案之后，每一趟都更贵了，而账单有一部分是用 CPU 自身的状态来付的。右边是绕开它的两条路：vDSO 和 io_uring 的共享环。',
      },
    },
    account: {
      title: { en: 'n crossings, c each', zh: 'n 次跨越，每次 c' },
      caption: {
        en: 'A program that crosses the boundary n times a second, at a cost c per crossing, spends n · c of every second on crossing alone. A system can lower c or lower n. Since 2018 c has gone up, so most of the action has moved to n.',
        zh: '一个程序每秒跨越边界 n 次，每次代价为 c，那么每秒就有 n · c 单单花在跨越上。系统可以降低 c，也可以降低 n。2018 年之后 c 涨了，主战场于是转向了 n。',
      },
    },
    trap: {
      title: { en: 'What one trap does', zh: '一次陷入做了什么' },
      caption: {
        en: 'SYSCALL does little: it saves two registers, jumps to the address in IA32_LSTAR and raises the privilege level. It leaves the stack pointer alone. Everything else is the kernel’s entry code, and all of it runs again in reverse on the way out.',
        zh: 'SYSCALL 做的事很少：保存两个寄存器，跳到 IA32_LSTAR 里的地址，提升特权级。它不动栈指针。其余的全是内核入口代码，返回时还要倒着再做一遍。',
      },
      demo: {
        label: { en: 'One trap, step by step', zh: '一次陷入，逐步看' },
        steps: [
          {
            en: 'Your program puts the system-call number in rax and up to six arguments in other registers. At this point the CPU is in user mode, running on the program’s stack, and CR3 holds the user page tables.',
            zh: '你的程序把调用号放进 rax，把最多六个参数放进别的寄存器。此刻 CPU 处于用户态，用的是程序自己的栈，CR3 里是用户页表。',
          },
          {
            en: 'SYSCALL. The hardware saves the return address in rcx and the flags in r11, loads the instruction pointer from IA32_LSTAR, which the kernel wrote at boot, and switches to kernel privilege. It does not touch the stack pointer: the kernel is now running on the user’s stack, which it must not trust.',
            zh: 'SYSCALL。硬件把返回地址存进 rcx，把标志存进 r11，从内核开机时写好的 IA32_LSTAR 里取出指令指针，并切换到内核特权级。它不动栈指针：内核此刻运行在用户的栈上，而它绝不能信任这个栈。',
          },
          {
            en: 'swapgs swaps in the kernel’s per-CPU data, and the entry code uses it to park the user’s stack pointer. Nothing can be pushed yet, because there is no trustworthy stack.',
            zh: 'swapgs 换上内核的每 CPU 数据，入口代码借助它暂存用户栈指针。这时还什么都不能压栈，因为还没有可信的栈。',
          },
          {
            en: 'If KPTI is on, the entry code writes CR3 and switches to the kernel’s full page tables. Before this line, most of the kernel is not even mapped.',
            zh: '如果开启了 KPTI，入口代码写 CR3，切换到内核的完整页表。在这一行之前，内核的大部分甚至都没有被映射。',
          },
          {
            en: 'It loads the kernel stack, and pushes every user register there as a struct pt_regs, the “save registers to the kernel stack” box in the book’s Figure 6.2. Now the kernel has a safe place to work.',
            zh: '载入内核栈，把用户的每一个寄存器作为 struct pt_regs 压进去，也就是书中图 6.2 里“把寄存器保存到内核栈”那一格。至此内核才有了安全的工作场地。',
          },
          {
            en: 'After the mitigations for hardware flaws found since 2018, which do real work only where the CPU needs them, it calls the handler. The handler is the only part that does what you asked for. On the way out, all of this runs in reverse.',
            zh: '再执行针对 2018 年以来发现的硬件漏洞的缓解措施（只在 CPU 需要时才真正干活），然后调用处理程序。只有处理程序在做你要求的事。返回时，这一切再倒着做一遍。',
          },
        ],
      },
    },
    indirect: {
      title: { en: 'The cost you do not see', zh: '看不见的那部分代价' },
      caption: {
        en: 'About 54 ns was the direct cost in one 2014 measurement. FlexSC showed the rest: after a system call returns, the program runs slower for a while, refilling what the kernel displaced in the pipeline, the L1 caches and the TLB. The curve and the cells show the idea, not a measurement.',
        zh: '2014 年的一次测量里，直接开销约 54 ns。FlexSC 揭示了其余的部分：系统调用返回之后，程序会有一段时间跑得更慢，忙着把被内核挤掉的东西重新装回流水线、L1 缓存和 TLB。图中的曲线和格子只是示意，不是测量结果。',
      },
    },
    kpti: {
      title: { en: '2018: two sets of page tables', zh: '2018：两套页表' },
      caption: {
        en: 'Meltdown let user code read kernel memory as long as the kernel was mapped in the process’s page tables. KPTI gives each process two sets: a full one for the kernel, and a user one mapping only the entry code. Every entry and exit writes CR3.',
        zh: '只要内核被映射在进程的页表里，Meltdown 就能让用户代码读出内核内存。KPTI 给每个进程两套页表：一套完整的给内核用，另一套给用户态用，只映射入口代码。每次进入和退出都要写 CR3。',
      },
    },
    pcid: {
      title: { en: 'Keeping the TLB', zh: '保住 TLB' },
      caption: {
        en: 'A CR3 write normally flushes the TLB, so without help every system call would throw away every cached translation. PCID tags TLB entries so user and kernel translations can coexist. With it, KPTI is a tax on each crossing; without it, your TLB is wiped on each one.',
        zh: '写 CR3 通常会清空 TLB，所以如果没有额外帮助，每次系统调用都会扔掉所有缓存好的地址转换。PCID 给 TLB 项打上标签，让用户态和内核态的转换得以共存。有它，KPTI 是每次跨越都要交的一笔税；没有它，每次跨越都会清空你的 TLB。',
      },
    },
    vdso: {
      title: { en: 'Strategy one: no trap at all', zh: '第一条路：根本不陷入' },
      caption: {
        en: 'For calls that only read what the kernel already knows, the kernel maps a small library, the vDSO, and a read-only data page into every process and keeps the clock parameters there. The program reads them in user mode. The process may read those values but not write them.',
        zh: '有些调用只是读内核早已知道的值。内核把一个小库 vDSO 和一个只读数据页映射进每个进程，并把时钟参数放在那里，程序在用户态读取即可。进程可以读这些值，但不能写。',
      },
    },
    batch: {
      title: { en: 'Strategy two: one trap, n requests', zh: '第二条路：一次陷入，n 个请求' },
      caption: {
        en: 'When the work really needs the kernel, pay the fixed cost once for many operations: amortization. The limit is that the batch must be assembled first and handed over in a call the program waits for.',
        zh: '当工作确实需要内核来做时，就让多个操作分摊一次固定开销，这就是摊销。它的局限在于：每一批都得先凑齐，再通过一次程序必须等着的调用交出去。',
      },
    },
    rings: {
      title: { en: 'Strategy three: share the queue', zh: '第三条路：共享队列' },
      caption: {
        en: 'io_uring puts two ring buffers in memory the process and the kernel share. The application writes requests into the submission queue; the kernel writes results into the completion queue. One io_uring_enter() can submit everything queued so far and wait, in the same trap.',
        zh: 'io_uring 把两个环形缓冲区放在进程和内核共享的内存里。应用程序把请求写进提交队列，内核把结果写进完成队列。一次 io_uring_enter() 就能把目前排好的请求一并提交并等待，都在同一次陷入里。',
      },
      demo: {
        label: { en: 'How a request travels', zh: '一个请求怎么走' },
        steps: [
          {
            en: 'Two rings in memory that both sides map, because requests go one way and results the other. Each has a head and a tail. Whoever produces entries moves the tail, whoever consumes them moves the head, so each side writes only its own end and neither needs a lock.',
            zh: '内存里的两个环，双方都映射着：请求朝一个方向走，结果朝另一个方向走，所以要两个。每个环都有队头和队尾。生产条目的一方推进队尾，消费条目的一方推进队头，于是每一方只写自己那一端，谁也不需要锁。',
          },
          {
            en: 'The application fills in three requests, called SQEs, then advances the SQ tail. A memory barrier keeps the order: a reader that sees the new tail also sees the finished entries. So far this is ordinary memory writing, with no trap.',
            zh: '应用程序填好三个请求（SQE），然后推进 SQ 的队尾。内存屏障保证了顺序：读到新队尾的一方，也一定能读到填好的条目。到这里都只是普通的内存写入，没有陷入。',
          },
          {
            en: 'One io_uring_enter(), one trap, however many requests are queued. The kernel reads all three from the head and advances the SQ head.',
            zh: '一次 io_uring_enter()，一次陷入，不管排了多少个请求。内核从队头读走全部三个，并推进 SQ 的队头。',
          },
          {
            en: 'As the operations finish, in any order, the kernel writes results, called CQEs, into the completion queue and advances the CQ tail.',
            zh: '操作陆续完成，顺序不定。内核把结果（CQE）写进完成队列，并推进 CQ 的队尾。',
          },
          {
            en: 'The application reads the results from the head and advances the CQ head. If a result is already there, this is memory reading again: it enters the kernel only when the queue is empty.',
            zh: '应用程序从队头读取结果，并推进 CQ 的队头。如果结果已经在那里，这又只是读内存：只有队列为空时，它才需要进内核。',
          },
        ],
      },
    },
    sqpoll: {
      title: { en: 'SQPOLL: zero system calls', zh: 'SQPOLL：零次系统调用' },
      caption: {
        en: 'With IORING_SETUP_SQPOLL a kernel thread polls the submission ring, so the application submits by writing to memory and makes no system call. If the ring stays idle, by default for about a second, the thread sleeps and one io_uring_enter() must wake it.',
        zh: '设置 IORING_SETUP_SQPOLL 后，一个内核线程轮询提交环，应用程序只要写内存就算提交，完全不用系统调用。如果环一直空闲（默认约一秒），这个线程就会睡去，需要调用一次 io_uring_enter() 把它叫醒。',
      },
    },
    surface: {
      title: { en: 'Where it bends', zh: '在哪里弯折' },
      caption: {
        en: 'A trap has one narrow, checked entry point. io_uring is a large asynchronous subsystem reading requests from memory the user can change at any moment. Google reported in June 2023 that 60% of the kernel exploits submitted to its kCTF bug bounty in the past year had used it.',
        zh: '陷入只有一个狭窄、受检查的入口；io_uring 却是一个庞大的异步子系统，从用户随时可以改动的内存里读取请求。2023 年 6 月 Google 披露：过去一年提交到其 kCTF 漏洞奖励计划的内核漏洞利用中，60% 利用了 io_uring。',
      },
    },
  },
  terms: {
    kpti: ['cr3'],
    'page-table': ['cr3'],
    cr3: ['cr3'],
    pcid: ['tlb'],
    tlb: ['tlb'],
    'cpu-cache': ['l1'],
    pipeline: ['pipeline'],
    vdso: ['vdso'],
    'ring-buffer': ['rings'],
    'io-uring': ['rings', 'kside'],
    'shared-memory': ['rings'],
    'memory-barrier': ['sq'],
    msr: ['regs'],
  },
}

export default scene
