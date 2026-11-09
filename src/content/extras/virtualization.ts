import type { Extra } from './types'

/**
 * Additions to Part I. Book text is never modified; everything here is clearly marked in the UI
 * as a lab, a field note (real-world connection) or a thread (connection across chapters).
 */
export const VIRTUALIZATION_EXTRAS: Record<number, Extra[]> = {
  4: [
    {
      kind: 'lab',
      id: 'proc-states',
      at: 'fig:4.4',
      lab: 'ProcessStates',
      title: { en: 'Process states, live: run, block on I/O, get ready again', zh: '进程状态实况：运行、因 I/O 阻塞、重新就绪' },
    },
    {
      kind: 'note',
      id: 'chrome-processes',
      at: 'sec:4.4',
      title: { en: 'Your browser is an operating system for tabs', zh: '浏览器是标签页的操作系统' },
      tags: ['Chrome', 'Site Isolation'],
      body: [
        {
          en: 'Since 2008 Chrome has run web pages in separate **processes**, and since 2018 its *Site Isolation* gives each site its own renderer process. Why processes and not threads? Because the process is the OS’s unit of **isolation**: a crashing or compromised tab cannot read another tab’s memory, because it lives in a different address space.',
          zh: 'Chrome 从 2008 年起就把网页放在不同的**进程**里运行；2018 年起的“站点隔离（Site Isolation）”更是让每个站点拥有独立的渲染进程。为什么用进程而不是线程？因为进程是操作系统提供的**隔离**单位：一个崩溃或被攻破的标签页读不到别的标签页的内存——它们处在不同的地址空间里。',
        },
        {
          en: 'Open your browser’s task manager and you will see a process list much like this chapter’s, with memory, CPU and process-ID columns: the abstraction, reused one level up.',
          zh: '打开浏览器自带的任务管理器，你会看到一张和本章颇为相似的进程列表：内存、CPU、进程 ID 一应俱全——同一个抽象，在更高一层被再次使用。',
        },
      ],
      links: ['vm-intro', 'cpu-mechanisms'],
    },
    {
      kind: 'note',
      id: 'zombies-containers',
      at: 'sec:4.5',
      title: { en: 'Zombies in your containers', zh: '容器里的僵尸进程' },
      tags: ['Docker', 'PID 1'],
      body: [
        {
          en: 'A process that has exited but has not been `wait()`ed for stays a **zombie**. Normally `init` (PID 1) adopts orphans and reaps them. Inside a container, *your* program is often PID 1 — and if it never calls `wait()`, zombies pile up until the container runs out of PIDs.',
          zh: '一个已退出但还没被 `wait()` 回收的进程会变成**僵尸**。正常情况下 `init`（PID 1）会收养孤儿进程并回收它们。可在容器里，PID 1 往往就是*你的*程序——如果它从不调用 `wait()`，僵尸就会不断堆积，直到容器的 PID 配额被耗尽。',
        },
        {
          en: 'This is why `docker run --init` exists: it inserts a tiny init (tini) as PID 1 that forwards signals to your program and runs the reaping loop described here.',
          zh: '这正是 `docker run --init` 存在的原因：它会放一个极小的 init（tini）作为 PID 1，负责把信号转发给你的程序，并运行本节描述的回收循环。',
        },
      ],
      links: ['cpu-api'],
    },
  ],
  5: [
    {
      kind: 'lab',
      id: 'fork',
      at: 'sec:5.2',
      lab: 'Fork',
      title: { en: 'fork(): one call, two returns', zh: 'fork()：调用一次，返回两次' },
    },
    {
      kind: 'note',
      id: 'fork-redis',
      at: 'sec:5.4',
      title: { en: 'fork() as a snapshot machine', zh: '把 fork() 当作快照机' },
      tags: ['Redis', 'copy-on-write', 'HotOS ’19'],
      body: [
        {
          en: 'Redis persists its in-memory dataset by calling `fork()`: the child sees a frozen copy of memory and writes it to disk while the parent keeps serving requests. It is cheap because modern kernels implement fork with **copy-on-write** — pages are shared until someone writes to them (you will see how page tables make this possible in chapter 18 and 23).',
          zh: 'Redis 持久化内存数据集的方法是调用 `fork()`：子进程看到的是一份“冻结”的内存副本，把它写到磁盘，而父进程继续处理请求。这之所以便宜，是因为现代内核用**写时复制（copy-on-write）**实现 fork——页面一直共享，直到有人写入（第 18、23 章会看到页表如何做到这一点）。',
        },
        {
          en: 'The flip side: a write-heavy workload during the snapshot can nearly double memory use. And some researchers argue fork has outlived its welcome (“A fork() in the road”, HotOS 2019), favouring `posix_spawn()`. The API in this chapter is 50 years old and still debated.',
          zh: '代价是：快照期间如果写入频繁，内存占用可能接近翻倍。也有研究者认为 fork 已不合时宜（《A fork() in the road》，HotOS 2019），主张改用 `posix_spawn()`。本章的接口已有 50 年历史，至今仍在争论之中。',
        },
      ],
      links: ['vm-paging', 'vm-complete'],
    },
  ],
  6: [
    {
      kind: 'lab',
      id: 'lde',
      at: 'sec:6.3',
      lab: 'Lde',
      title: { en: 'Limited direct execution: a system call and a timer interrupt, step by step', zh: '受限直接执行：一次系统调用与一次时钟中断的逐步演示' },
    },
    {
      kind: 'note',
      id: 'syscall-cost',
      at: 'sec:6.4',
      title: { en: 'When the trap is too expensive', zh: '当陷入本身变得太贵' },
      tags: ['vDSO', 'io_uring', 'KPTI'],
      body: [
        {
          en: 'Every trap into the kernel saves registers, switches modes and pollutes caches. After the 2018 Meltdown attack, Linux’s fix (KPTI) also switches page tables on every entry to and exit from the kernel, making system calls measurably slower. Systems people respond by trapping less:',
          zh: '每次陷入内核都要保存寄存器、切换模式、污染缓存。2018 年 Meltdown 漏洞之后，Linux 的修补方案（KPTI）还要在每次进出内核时切换页表，系统调用明显变慢。于是系统工程师们想尽办法“少陷入”：',
        },
        {
          en: 'the **vDSO** maps a few read-only kernel routines (like `clock_gettime`) into every process so they run without a trap; **io_uring** (Linux 5.1) lets programs queue many I/O requests in shared ring buffers and submit them with one call — or none at all.',
          zh: '**vDSO** 把少数只读的内核例程（如 `clock_gettime`）映射进每个进程，无需陷入即可执行；**io_uring**（Linux 5.1）让程序在共享环形缓冲区里排入大量 I/O 请求，一次调用（甚至零次）即可提交。',
        },
      ],
      links: ['vm-tlbs', 'vm-complete'],
    },
    {
      kind: 'thread',
      id: 'lde-everywhere',
      at: 'end',
      title: { en: 'Limited direct execution, all the way up', zh: '受限直接执行，一路向上' },
      tags: ['VT-x', 'Firecracker', 'eBPF', 'WebAssembly'],
      body: [
        {
          en: 'The recipe — *run untrusted code directly on the hardware, but arrange for control to come back* — reappears at every layer. Hardware virtualization (Intel VT-x, AMD-V) runs a whole guest OS directly and traps only on sensitive operations; AWS Lambda runs your function in a Firecracker micro-VM built on exactly that.',
          zh: '这个配方——*让不受信任的代码直接在硬件上运行，但确保控制权能收回来*——在每一层都会重现。硬件虚拟化（Intel VT-x、AMD-V）让整个客户操作系统直接运行，只在敏感操作时陷入；AWS Lambda 用基于这套机制的 Firecracker 微虚拟机来运行你的函数。',
        },
        {
          en: 'eBPF goes the other way: user code runs *inside* the kernel, made safe not by traps but by a verifier that proves the program terminates and stays in bounds before it ever runs. WebAssembly splits the job: validation checks the code before it runs, while bounds are enforced as it runs and runaway loops are cut off by the host. Same question, different answers: how do you let someone run fast without giving them the keys?',
          zh: 'eBPF 走的是另一条路：用户代码直接在内核*里面*运行，安全性不靠陷入，而靠一个验证器在运行前证明程序一定会终止、不会越界。WebAssembly 则把这件事拆开：运行前先校验代码，越界在运行时拦截，失控的循环由宿主来叫停。问题相同，答案各异：如何让别人全速运行，又不把钥匙交给他？',
        },
      ],
      links: ['cpu-intro', 'vm-mechanism'],
    },
  ],
  7: [
    {
      kind: 'lab',
      id: 'scheduler',
      at: 'sec:7.7',
      lab: 'Scheduler',
      title: { en: 'Scheduler playground: FIFO, SJF, STCF and Round Robin', zh: '调度器试验场：FIFO、SJF、STCF 与轮转' },
    },
    {
      kind: 'note',
      id: 'llm-convoy',
      at: 'sec:7.5',
      title: { en: 'The convoy effect, in LLM serving', zh: '大模型推理里的“护航效应”' },
      tags: ['LLM inference', 'Orca', 'vLLM'],
      body: [
        {
          en: 'A server generating text for many users faces this chapter’s problem exactly. If a request that will produce 2,000 tokens is batched first, every short chat reply waits behind it — the convoy effect. Early serving systems scheduled whole requests (FIFO at request granularity).',
          zh: '同时为许多用户生成文本的推理服务器，面对的正是本章的问题。如果一个要生成 2000 个 token 的请求先进入批处理，所有简短的聊天回复都得排在它后面——这就是护航效应。早期的推理系统以整个请求为单位调度（请求粒度的 FIFO）。',
        },
        {
          en: '*Iteration-level scheduling* (Orca, OSDI 2022; now standard in vLLM and others) re-decides the batch after **every token**, letting finished requests leave and new ones join — preemption at a fine time slice, the step from run-to-completion FIFO towards round robin. Researchers now go further and *predict* output length to approximate SJF, the same “no oracle” problem as in section 7.9.',
          zh: '*迭代级调度*（Orca，OSDI 2022；如今已是 vLLM 等系统的标配）在**每生成一个 token** 之后重新决定批次：完成的请求离开，新的请求加入——这就是细粒度时间片的抢占，从“一跑到底”的 FIFO 走向轮转。研究者更进一步，尝试*预测*输出长度来近似 SJF——正是 7.9 节“没有先知”的同一个问题。',
        },
      ],
      links: ['cpu-sched-mlfq'],
    },
    {
      kind: 'thread',
      id: 'hol-blocking',
      at: 'end',
      title: { en: 'Head-of-line blocking is the convoy effect, everywhere', zh: '队头阻塞就是无处不在的护航效应' },
      tags: ['HTTP/2', 'QUIC'],
      body: [
        {
          en: 'HTTP/1.1 pipelining failed partly because one slow response blocked all those behind it (and partly because too many servers and proxies mishandled it). HTTP/2 multiplexed requests over one TCP connection — but a single lost packet still stalls every stream, because TCP delivers bytes in order. QUIC (HTTP/3) finally gives each stream independent delivery.',
          zh: 'HTTP/1.1 的管线化之所以失败，一半是因为一个慢响应会堵住后面所有的响应（另一半是太多服务器和代理处理不好它）。HTTP/2 在一条 TCP 连接上多路复用请求——但只要丢一个包，所有流都会停住，因为 TCP 必须按序交付。QUIC（HTTP/3）终于让每个流独立交付。',
        },
        {
          en: 'Three protocol generations, one lesson from this chapter: when work of very different sizes shares a single FIFO queue, the short jobs pay for the long ones.',
          zh: '三代协议，同一个来自本章的教训：当大小悬殊的工作共享同一个 FIFO 队列时，短任务要为长任务买单。',
        },
      ],
    },
  ],
  8: [
    {
      kind: 'lab',
      id: 'mlfq',
      at: 'sec:8.4',
      lab: 'Mlfq',
      title: { en: 'MLFQ: watch jobs sink, get boosted — and try to game it', zh: 'MLFQ：看任务下沉、被提升，以及尝试“钻空子”' },
    },
    {
      kind: 'note',
      id: 'real-schedulers',
      at: 'sec:8.5',
      title: { en: 'What shipping kernels actually do', zh: '真实内核是怎么做的' },
      tags: ['Windows', 'Linux O(1)', 'CFS', 'EEVDF'],
      body: [
        {
          en: 'Windows schedules threads across 32 priority levels and temporarily **boosts** a thread when its I/O completes or its window comes to the foreground — the spirit of MLFQ’s rules about interactive jobs. Linux 2.6’s O(1) scheduler also used interactivity heuristics like these, but they proved fragile and hard to reason about.',
          zh: 'Windows 在 32 个优先级上调度线程，并在线程的 I/O 完成或窗口切到前台时临时**提升**它的优先级——这正是 MLFQ 对待交互式任务的精神。Linux 2.6 的 O(1) 调度器也用过类似的交互性启发式规则，但事实证明它们脆弱且难以推理。',
        },
        {
          en: 'So in 2007 Linux switched to CFS, a proportional-share design (next chapter), and in 2023 (Linux 6.6) to EEVDF. The trade-off in this chapter — clever heuristics versus predictable fairness — is still being argued on the kernel mailing list.',
          zh: '于是 Linux 在 2007 年换成了基于比例份额的 CFS（下一章），2023 年（Linux 6.6）又换成了 EEVDF。本章的权衡——精巧的启发式还是可预期的公平——至今仍在内核邮件列表上争论不休。',
        },
      ],
      links: ['cpu-sched-lottery'],
    },
    {
      kind: 'thread',
      id: 'history-predicts',
      at: 'end',
      title: { en: 'Approximating an oracle with history', zh: '用历史逼近“先知”' },
      body: [
        {
          en: 'SJF is optimal but needs to know job lengths in advance; MLFQ approximates it by watching how jobs behaved so far. Chapter 22 replays the same story for memory: the optimal replacement policy needs the future, so LRU uses the past instead.',
          zh: 'SJF 是最优的，却需要事先知道任务长度；MLFQ 通过观察任务过去的行为来逼近它。第 22 章会在内存上重演同一个故事：最优替换策略需要预知未来，于是 LRU 改用过去。',
        },
        {
          en: 'Branch predictors, TCP congestion control and cache prefetchers are all built on the same bet: the recent past is a good model of the near future. When the bet fails (a workload changes phase, a job games the rules), you need a reset — MLFQ’s priority boost.',
          zh: '分支预测器、TCP 拥塞控制、缓存预取器都押同一个注：最近的过去能很好地预测不久的将来。押错的时候（负载切换阶段、任务钻规则空子），就需要一次“重置”——也就是 MLFQ 的优先级提升。',
        },
      ],
      links: ['cpu-sched', 'vm-beyondphys-policy'],
    },
  ],
  9: [
    {
      kind: 'lab',
      id: 'lottery',
      at: 'sec:9.6',
      lab: 'Lottery',
      title: { en: 'Lottery vs. stride: randomness converges, determinism is exact', zh: '彩票与步长：随机会收敛，确定性则分毫不差' },
    },
    {
      kind: 'note',
      id: 'k8s-shares',
      at: 'sec:9.5',
      title: { en: 'Tickets in your cloud bill', zh: '你云账单里的“彩票”' },
      tags: ['Kubernetes', 'cgroups'],
      body: [
        {
          en: 'A Kubernetes CPU *request* becomes a cgroup **weight** (`cpu.weight` in cgroup v2): under contention, containers get CPU in proportion to their weights — tickets, by another name. A CPU *limit* is different: it becomes a quota per 100 ms period, and a container that exhausts it is **throttled** until the next period.',
          zh: 'Kubernetes 的 CPU *request* 会变成 cgroup 的**权重**（cgroup v2 中的 `cpu.weight`）：发生争用时，容器按权重比例分得 CPU——换了个名字的彩票。CPU *limit* 则不同：它变成每 100 ms 周期内的配额，用完的容器会被**限流**直到下个周期。',
        },
        {
          en: 'Throttling explains many mysterious tail-latency spikes: a multithreaded service can burn its quota in the first 20 ms of a period and then sit idle for 80 ms. “How to assign tickets?” (section 9.5) remains an open problem in production.',
          zh: '限流解释了许多神秘的长尾延迟：一个多线程服务可能在周期的前 20 ms 就烧完配额，然后空等 80 ms。“如何分配彩票？”（9.5 节）在生产环境中依然是个开放问题。',
        },
      ],
    },
    {
      kind: 'lab',
      id: 'eevdf-lab',
      at: 'sec:9.7',
      lab: 'Eevdf',
      title: { en: 'EEVDF: eligible first, then the earliest deadline', zh: 'EEVDF：先看是否合格，再比截止期' },
    },
    {
      kind: 'note',
      id: 'eevdf',
      at: 'sec:9.7',
      title: { en: 'After CFS: EEVDF', zh: 'CFS 之后：EEVDF' },
      tags: ['Linux 6.6'],
      body: [
        {
          en: 'In Linux 6.6 (2023) CFS’s task picker was replaced by **EEVDF** (Earliest Eligible Virtual Deadline First, from a 1995 paper). It keeps the virtual-time fairness you just saw — like stride’s *pass* or CFS’s *vruntime* — but gives each task a virtual deadline, so a task asking for short slices gets lower latency without getting more CPU overall.',
          zh: '在 Linux 6.6（2023 年）中，CFS 的任务选择逻辑被 **EEVDF**（最早合格虚拟截止期优先，源自 1995 年的一篇论文）取代。它保留了你刚看到的虚拟时间公平——就像步长调度的 *pass* 或 CFS 的 *vruntime*——但给每个任务一个虚拟截止期，于是请求短时间片的任务能获得更低的延迟，而总 CPU 份额并不会增加。',
        },
      ],
    },
  ],
  10: [
    {
      kind: 'lab',
      id: 'multicore',
      at: 'sec:10.5',
      lab: 'Multicore',
      title: { en: 'One queue or many? Affinity, imbalance and work stealing', zh: '一个队列还是多个？亲和性、负载失衡与工作窃取' },
    },
    {
      kind: 'note',
      id: 'work-stealing',
      at: 'sec:10.6',
      title: { en: 'Work stealing lives in your language runtime', zh: '工作窃取就住在你的语言运行时里' },
      tags: ['Go', 'Tokio', 'ForkJoinPool'],
      body: [
        {
          en: 'Go’s runtime gives every logical processor (a “P”) its own run queue of goroutines and lets idle Ps **steal** half of a busy P’s queue — multi-queue scheduling with migration, exactly as in section 10.5. Rust’s Tokio and Java’s ForkJoinPool steal work too, each in its own way.',
          zh: 'Go 运行时给每个逻辑处理器（“P”）一个自己的 goroutine 运行队列，空闲的 P 会从繁忙的 P 那里**窃取**一半任务——这正是 10.5 节的多队列调度加迁移。Rust 的 Tokio、Java 的 ForkJoinPool 也会窃取任务，只是各有各的做法。',
        },
        {
          en: 'So these are two schedulers stacked: the OS schedules threads on cores, the runtime schedules millions of tasks on those threads. Each layer faces the same affinity-versus-balance trade-off.',
          zh: '于是这里叠了两层调度器：操作系统把线程调度到核心上，运行时再把数以百万计的任务调度到这些线程上。每一层都面临同样的亲和性与均衡之间的权衡。',
        },
      ],
    },
  ],
  13: [
    {
      kind: 'lab',
      id: 'addr-space',
      at: 'fig:13.3',
      lab: 'AddressSpace',
      title: { en: 'Three processes, three private address spaces, one physical memory', zh: '三个进程、三个私有地址空间、一块物理内存' },
    },
    {
      kind: 'note',
      id: 'aslr',
      at: 'sec:13.4',
      title: { en: 'Because addresses are virtual, they can lie randomly', zh: '因为地址是虚拟的，所以可以随机“撒谎”' },
      tags: ['ASLR', 'KASLR'],
      body: [
        {
          en: 'Run the book’s address-printing program twice on a modern Linux or macOS and you will get different numbers each time. **ASLR** (address space layout randomization) places the stack, heap and libraries at random virtual addresses, so an attacker exploiting a memory bug cannot hard-code where to jump. The kernel randomizes itself too (KASLR).',
          zh: '在现代 Linux 或 macOS 上把书中打印地址的程序运行两次，你会得到不同的数字。**ASLR**（地址空间布局随机化）把栈、堆和共享库放在随机的虚拟地址上，利用内存漏洞的攻击者就没法把跳转地址写死。内核自己也会随机化（KASLR）。',
        },
        {
          en: 'This is only possible because the address space is an illusion: the OS can put the illusion anywhere it likes.',
          zh: '这之所以可行，正因为地址空间只是一个假象：操作系统想把它放在哪儿都行。',
        },
      ],
    },
  ],
  14: [
    {
      kind: 'note',
      id: 'memory-safety',
      at: 'sec:14.4',
      title: { en: 'These errors are 70% of the problem', zh: '这些错误占了七成' },
      tags: ['ASan', 'Rust'],
      body: [
        {
          en: 'Microsoft (2019) reported that about **70%** of the vulnerabilities it fixed each year were memory-safety bugs, and the Chromium project found the same share among its high-severity bugs. They are the kind of errors this section lists: use-after-free, buffer overflows, frees of the wrong thing.',
          zh: '微软（2019 年）报告称，它每年修复的漏洞中约 **70%** 是内存安全错误；Chromium 项目在其高危漏洞中也发现了同样的比例。它们正是本节列出的这类错误：释放后使用、缓冲区溢出、释放了不该释放的东西。',
        },
        {
          en: 'Two responses dominate today: tools that catch them at run time, like AddressSanitizer (a successor to the Purify and valgrind tools the book mentions), and languages like Rust whose type system rules most of them out at compile time.',
          zh: '如今主要有两种对策：在运行时捕获它们的工具，比如 AddressSanitizer（书中提到的 Purify/valgrind 的后继者）；以及像 Rust 这样用类型系统在编译期排除大多数此类错误的语言。',
        },
      ],
    },
  ],
  15: [
    {
      kind: 'lab',
      id: 'base-bounds',
      at: 'sec:15.3',
      lab: 'BaseBounds',
      title: { en: 'Dynamic relocation: drag the address, watch the MMU', zh: '动态重定位：拖动地址，观察 MMU' },
    },
    {
      kind: 'note',
      id: 'bounds-revival',
      at: 'sec:15.4',
      title: { en: 'Base and bounds never really died', zh: '基址加界限从未真正消失' },
      tags: ['WebAssembly', 'CHERI'],
      body: [
        {
          en: 'A WebAssembly module gets one contiguous **linear memory**; every load and store is an offset that must stay below the memory’s size — base and bounds, enforced by the runtime (often with large guard regions so the check is nearly free).',
          zh: '一个 WebAssembly 模块只拥有一块连续的**线性内存**；每次读写都是一个偏移量，必须小于内存大小——这就是由运行时强制执行的基址加界限（通常借助大块保护区，让检查几乎零开销）。',
        },
        {
          en: 'At the hardware level, CHERI (prototyped on MIPS and RISC-V, and in silicon on Arm’s Morello board) puts bounds into *every pointer*: base-and-bounds at the granularity of a single C object.',
          zh: '在硬件层面，CHERI（先在 MIPS 和 RISC-V 上做出原型，后在 Arm 的 Morello 开发板上做成芯片）把界限放进了*每一个指针*：粒度细到单个 C 对象的基址加界限。',
        },
      ],
    },
  ],
  16: [
    {
      kind: 'lab',
      id: 'segmentation',
      at: 'sec:16.3',
      lab: 'Segmentation',
      title: { en: 'Segmented address translation, including a stack that grows down', zh: '分段地址转换，包括反向增长的栈' },
    },
    {
      kind: 'note',
      id: 'fs-gs',
      at: 'sec:16.6',
      title: { en: 'Where segments survive on x86-64', zh: '分段在 x86-64 上的遗存' },
      tags: ['x86-64', 'TLS'],
      body: [
        {
          en: 'In 64-bit mode x86 turns segmentation almost entirely off: code, data and stack segments have base 0 and no limit. Two registers kept their base, though: **FS and GS**. Every thread’s thread-local storage is reached through FS, and the Linux kernel finds its per-CPU data through GS — a segment base, used as a cheap per-thread pointer.',
          zh: '在 64 位模式下，x86 几乎完全关闭了分段：代码段、数据段、栈段的基址都是 0，也没有界限。但有两个寄存器保留了基址：**FS 和 GS**。每个线程的线程局部存储都通过 FS 访问，Linux 内核则通过 GS 找到每个 CPU 的私有数据——段基址，被当作一个廉价的“每线程指针”来用。',
        },
      ],
    },
    {
      kind: 'thread',
      id: 'fixed-vs-variable',
      at: 'end',
      title: { en: 'Variable-size vs. fixed-size: the trade-off that keeps coming back', zh: '变长还是定长：反复出现的权衡' },
      body: [
        {
          en: 'Segments are variable-sized, so physical memory fragments (chapter 17 is about managing exactly that). Pages are fixed-sized, so external fragmentation disappears — at the cost of internal fragmentation and big tables (chapters 18–20).',
          zh: '段是变长的，于是物理内存会产生碎片（第 17 章讲的正是如何管理它）。页是定长的，外部碎片因此消失——代价是内部碎片和巨大的页表（第 18–20 章）。',
        },
        {
          en: 'File systems replay the same choice with extents versus blocks, and LLM servers with contiguous versus paged KV caches (see the note in chapter 18).',
          zh: '文件系统在“区段（extent）还是块”上重演了同一抉择，大模型推理服务在“连续还是分页的 KV 缓存”上也是如此（见第 18 章的现实连线）。',
        },
      ],
      links: ['vm-freespace', 'vm-paging'],
    },
  ],
  17: [
    {
      kind: 'lab',
      id: 'freelist',
      at: 'sec:17.3',
      lab: 'FreeList',
      title: { en: 'Allocator lab: best, worst, first and next fit, with and without coalescing', zh: '分配器实验：最优、最差、首次与下次匹配，合并与不合并' },
    },
    {
      kind: 'note',
      id: 'allocators',
      at: 'sec:17.4',
      title: { en: 'What malloc really is today', zh: '如今的 malloc 到底是什么' },
      tags: ['jemalloc', 'tcmalloc', 'mimalloc'],
      body: [
        {
          en: 'Production allocators — jemalloc (FreeBSD, Meta), tcmalloc (Google), mimalloc (Microsoft) — are built mostly from this chapter’s “other approaches”: **size classes** with segregated free lists, slab-like runs of same-sized objects, and per-thread or per-CPU caches so the common path takes no lock.',
          zh: '生产级分配器——jemalloc（FreeBSD、Meta）、tcmalloc（Google）、mimalloc（微软）——主要由本章“其他方法”中的组件搭成：带分离空闲列表的**尺寸类别**、同尺寸对象的类 slab 区块，以及每线程或每 CPU 的缓存，使最常见的路径不需要加锁。',
        },
        {
          en: 'Inside the Linux kernel, pages come from a **buddy allocator** and small objects from the slab allocator (SLUB) — both described here, both still running on your machine.',
          zh: '在 Linux 内核里，页面来自**伙伴分配器**，小对象来自 slab 分配器（SLUB）——两者本章都介绍过，此刻都还在你的机器上运行。',
        },
      ],
    },
  ],
  18: [
    {
      kind: 'lab',
      id: 'paging',
      at: 'sec:18.1',
      lab: 'Paging',
      title: { en: 'Split the address, index the table, concatenate the frame', zh: '拆分地址、查页表、拼接物理帧' },
    },
    {
      kind: 'note',
      id: 'paged-attention',
      at: 'sec:18.3',
      title: { en: 'PagedAttention: virtual memory for LLM KV caches', zh: 'PagedAttention：给大模型 KV 缓存用的虚拟内存' },
      tags: ['vLLM', 'SOSP ’23'],
      body: [
        {
          en: 'While generating text, a transformer keeps a growing **KV cache** for every request. Early servers reserved one contiguous chunk per request sized for the maximum length — base and bounds, with all its waste: most of the reserved memory was never used, and the rest fragmented.',
          zh: 'Transformer 生成文本时，要为每个请求维护一份不断增长的 **KV 缓存**。早期的推理服务为每个请求按最大长度预留一整块连续内存——这就是基址加界限，连同它的全部浪费：大部分预留内存从未用到，剩下的还会碎片化。',
        },
        {
          en: 'vLLM’s PagedAttention (SOSP 2023) applies this chapter literally: the KV cache is split into fixed-size **blocks**, a per-request **block table** maps logical blocks to physical ones, and blocks can be shared copy-on-write between samples of the same prompt. Waste dropped to a few percent and throughput rose 2–4×. A 1960s idea, rediscovered on GPUs.',
          zh: 'vLLM 的 PagedAttention（SOSP 2023）原原本本地套用了本章：KV 缓存被切成定长的**块**，每个请求有一张**块表**把逻辑块映射到物理块，同一提示词的多个采样之间还能写时复制地共享块。浪费降到了百分之几，吞吐量提升 2–4 倍。一个 1960 年代的想法，在 GPU 上被重新发现。',
        },
      ],
      links: ['vm-segmentation', 'vm-tlbs'],
    },
  ],
  19: [
    {
      kind: 'lab',
      id: 'tlb',
      at: 'sec:19.2',
      lab: 'Tlb',
      title: { en: 'Walking an array through the TLB: spatial locality you can see', zh: '用 TLB 遍历数组：看得见的空间局部性' },
    },
    {
      kind: 'note',
      id: 'huge-pages',
      at: 'sec:19.6',
      title: { en: 'TLB reach and huge pages', zh: 'TLB 覆盖范围与大页' },
      tags: ['2 MB pages', 'THP', 'Android 16 KB'],
      body: [
        {
          en: 'A TLB with 1,536 entries covers only 6 MB of 4 KB pages — far less than a modern database’s working set. With 2 MB **huge pages** the same TLB covers 3 GB. That is why databases, JVMs and GPU drivers love them, and why Apple silicon uses 16 KB base pages and Android 15 added 16 KB page support.',
          zh: '一个 1536 项的 TLB 在 4 KB 页面下只能覆盖 6 MB——远小于现代数据库的工作集。换成 2 MB 的**大页**，同样的 TLB 能覆盖 3 GB。这就是数据库、JVM、GPU 驱动钟爱大页的原因，也是 Apple 芯片采用 16 KB 基础页、Android 15 增加 16 KB 页面支持的原因。',
        },
        {
          en: 'But bigger pages mean more internal fragmentation and costly compaction: Linux’s *transparent* huge pages caused enough latency spikes that Redis has long recommended turning them off (MongoDB did too, until version 8.0 switched to recommending them). Chapter 20 opens with exactly this trade-off.',
          zh: '但更大的页意味着更多内部碎片和代价高昂的内存规整：Linux 的*透明*大页引发了足够多的延迟抖动，以至于 Redis 长期建议关闭它（MongoDB 也曾如此，直到 8.0 版改为建议开启）。第 20 章正是从这个权衡开篇的。',
        },
      ],
      links: ['vm-smalltables'],
    },
    {
      kind: 'note',
      id: 'pcid',
      at: 'sec:19.5',
      title: { en: 'ASIDs saved Meltdown’s performance', zh: 'ASID 挽救了 Meltdown 修补后的性能' },
      tags: ['PCID', 'KPTI'],
      body: [
        {
          en: 'After Meltdown, kernels stopped mapping themselves into user page tables (KPTI). Every system call now switches address spaces — and without help, every switch would flush the TLB. x86’s **PCID** is the address-space identifier of section 19.5: tagging TLB entries lets user and kernel translations coexist, which is what kept the mitigation’s cost tolerable.',
          zh: 'Meltdown 之后，内核不再把自己映射进用户页表（KPTI）。每次系统调用都要切换地址空间——如果没有帮助，每次切换都得清空 TLB。x86 的 **PCID** 就是 19.5 节所说的地址空间标识符：给 TLB 项打上标签，让用户态与内核态的转换得以共存，这才把修补的代价压到了可接受的范围。',
        },
      ],
      links: ['cpu-mechanisms'],
    },
  ],
  20: [
    {
      kind: 'lab',
      id: 'multilevel',
      at: 'sec:20.3',
      lab: 'MultiLevel',
      title: { en: 'A two-level page-table walk (the chapter’s 0x3F80 example)', zh: '两级页表遍历（本章的 0x3F80 示例）' },
    },
    {
      kind: 'note',
      id: 'five-level',
      at: 'sec:20.4',
      title: { en: 'Four levels, then five', zh: '四级，然后是五级' },
      tags: ['x86-64', 'LA57', 'nested paging'],
      body: [
        {
          en: 'x86-64 translates 48-bit virtual addresses with a **4-level** tree: 9 index bits per level (512 eight-byte entries fill a 4 KB page) plus a 12-bit offset. Newer CPUs add a fifth level for 57-bit addresses (supported by Linux since 4.14). Each extra level is one more memory reference on a TLB miss.',
          zh: 'x86-64 用一棵 **4 级**树来转换 48 位虚拟地址：每级 9 位索引（512 个 8 字节表项正好填满 4 KB 页），再加 12 位偏移。较新的 CPU 增加了第五级以支持 57 位地址（Linux 自 4.14 起支持）。每多一级，TLB 未命中时就多一次内存访问。',
        },
        {
          en: 'Under hardware virtualization it multiplies: a guest’s page-table walk must itself be translated by the host’s tables, so a worst-case 2D walk takes **24** memory references. This is why TLBs, huge pages and page-walk caches matter even more in the cloud.',
          zh: '在硬件虚拟化下，代价会相乘：客户机的页表遍历本身还要经过宿主机页表的转换，最坏情况下的二维遍历需要 **24** 次内存访问。这就是为什么 TLB、大页和页表遍历缓存在云上更加重要。',
        },
      ],
    },
    {
      kind: 'thread',
      id: 'radix-trees',
      at: 'end',
      title: { en: 'A multi-level page table is a radix tree', zh: '多级页表就是一棵基数树' },
      body: [
        {
          en: 'Peel off the hardware and a multi-level page table is a radix tree keyed by address bits: sparse ranges cost nothing, lookups cost one step per level. Part III will show the same shape in file systems (inodes with indirect blocks), and you meet it in IP routing tables and in the Linux page cache (the xarray).',
          zh: '剥去硬件外衣，多级页表就是一棵以地址位为键的基数树：稀疏的区间不占空间，查找每级只走一步。第三部分会在文件系统里再次看到这种形状（带间接块的 inode），你在 IP 路由表和 Linux 页缓存（xarray）里也会遇到它。',
        },
      ],
      links: ['vm-paging'],
    },
  ],
  21: [
    {
      kind: 'lab',
      id: 'pagefault',
      at: 'sec:21.5',
      lab: 'PageFault',
      title: { en: 'Follow one memory access from TLB hit to page fault to disk and back', zh: '跟随一次内存访问：从 TLB 命中到缺页，再到磁盘并返回' },
    },
    {
      kind: 'note',
      id: 'zram-oom',
      at: 'sec:21.6',
      title: { en: 'Swapping today: compress first, kill last', zh: '今天的交换：先压缩，最后才杀进程' },
      tags: ['zram', 'OOM killer', 'PSI'],
      body: [
        {
          en: 'Phones and laptops rarely swap to flash; instead Android and ChromeOS use **zram**, a swap device that compresses pages into RAM itself — cheaper than disk I/O and kinder to flash wear.',
          zh: '手机和笔记本很少真的换出到闪存；Android 和 ChromeOS 用的是 **zram**——一个把页面压缩后仍存放在内存里的交换设备，比磁盘 I/O 便宜，也更爱惜闪存寿命。',
        },
        {
          en: 'When even that is not enough, Linux’s **OOM killer** picks a victim process; Android’s lmkd and systemd-oomd act earlier, using *pressure stall information* (how long tasks wait on memory) as the signal — a production answer to “when replacements really occur”.',
          zh: '连这样都不够时，Linux 的 **OOM killer** 会挑一个进程牺牲掉；Android 的 lmkd 和 systemd-oomd 则更早出手，以*压力停滞信息*（任务等内存等了多久）为信号——这是对“替换究竟何时发生”的生产级回答。',
        },
      ],
    },
  ],
  22: [
    {
      kind: 'lab',
      id: 'replacement',
      at: 'sec:22.6',
      lab: 'Replacement',
      title: { en: 'Replacement policies head to head (and Belady’s anomaly)', zh: '替换策略正面对决（以及 Belady 异常）' },
    },
    {
      kind: 'note',
      id: 'approx-lru',
      at: 'sec:22.8',
      title: { en: 'Nobody implements real LRU', zh: '没有人实现真正的 LRU' },
      tags: ['Redis', 'Linux MGLRU'],
      body: [
        {
          en: 'Redis’s `allkeys-lru` policy does not keep a list of all keys; it **samples** a handful (5 by default) and evicts the least recently used among them — an approximation, exactly as this section argues.',
          zh: 'Redis 的 `allkeys-lru` 策略并不维护所有键的链表；它随机**抽样**几个键（默认 5 个），淘汰其中最久未使用的那个——正如本节所论证的，一种近似。',
        },
        {
          en: 'Linux long approximated LRU with active and inactive lists fed by hardware reference bits (the clock idea). Since Linux 6.1 it can use **MGLRU**, multiple generations of pages aged by scanning page tables — still an approximation, just a better one.',
          zh: 'Linux 长期用活跃/非活跃两个链表、配合硬件引用位（时钟算法的思想）来近似 LRU。从 Linux 6.1 起，它可以使用 **MGLRU**：通过扫描页表把页面按多代老化——依然是近似，只是更好的近似。',
        },
      ],
    },
    {
      kind: 'thread',
      id: 'caching-everywhere',
      at: 'end',
      title: { en: 'One idea, six layers: caching', zh: '一个思想，六个层次：缓存' },
      body: [
        {
          en: 'CPU caches, the TLB (chapter 19), the page cache, a CDN, a database buffer pool, Redis: each keeps a small, fast copy of a big, slow thing and bets on **locality**. Each must answer this chapter’s question — what to evict — and each finds OPT impossible and exact LRU rarely worth its bookkeeping, so most settle for an approximation.',
          zh: 'CPU 缓存、TLB（第 19 章）、页缓存、CDN、数据库缓冲池、Redis：每一个都为又大又慢的东西保留一份又小又快的副本，并押注于**局部性**。每一个都要回答本章的问题——该淘汰谁——也都会发现 OPT 不可能实现，精确的 LRU 又往往得不偿失，于是大多选择某种近似。',
        },
        {
          en: 'Even the vocabulary repeats: hit rate, working set, thrashing. Learn it once here and you can reason about all of them.',
          zh: '连术语都在重复：命中率、工作集、抖动。在这里学会一次，你就能推理所有这些系统。',
        },
      ],
      links: ['vm-tlbs', 'cpu-sched-multi'],
    },
  ],
  23: [
    {
      kind: 'note',
      id: 'page-size-now',
      at: 'intro',
      title: { en: 'Everything in this part, running on your laptop', zh: '本部分的所有内容，此刻正在你的电脑上运行' },
      tags: ['Linux', 'macOS'],
      body: [
        {
          en: 'Run `cat /proc/self/maps` on Linux (or `vmmap` on macOS): you will see this part of the book laid out — code, heap, stack, shared libraries, the vDSO — each region with permissions, lazily backed by demand-zero and copy-on-write pages, translated by a multi-level table cached in a TLB.',
          zh: '在 Linux 上运行 `cat /proc/self/maps`（macOS 上用 `vmmap`）：你会看到本书这一部分铺陈眼前——代码、堆、栈、共享库、vDSO——每个区域都有权限，由按需清零和写时复制的页面惰性地支撑，并由一张缓存在 TLB 中的多级页表完成转换。',
        },
      ],
      links: ['vm-intro', 'vm-smalltables'],
    },
  ],
}
