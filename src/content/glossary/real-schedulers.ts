import type { Term } from './index'

/** Terms of “What shipping kernels actually do with MLFQ” (several are shared with the history note). */
const terms: Record<string, Term> = {
  'real-time': {
    title: { en: 'Real-time priority', zh: '实时优先级' },
    body: {
      en: 'Priorities for work with timing requirements, such as audio or machine control. In Windows and Linux a real-time thread runs ahead of every ordinary thread, and the scheduler never raises or lowers its priority by guessing. By itself this is a ranking, not a promise that any deadline will be met.',
      zh: '给有时间要求的工作（比如音频、设备控制）用的优先级。在 Windows 和 Linux 上，实时线程排在所有普通线程前面，调度器也从不靠猜测去调高或调低它的优先级。单凭这一点，它只是一种排序，并不承诺满足任何截止期。',
    },
  },
  page: {
    title: { en: 'Page', zh: '页（page）' },
    body: {
      en: 'A fixed-size block of memory, commonly 4 KB, the unit in which the OS manages memory: it maps, protects, evicts and zeroes memory a page at a time.',
      zh: '固定大小的一块内存，常见的是 4 KB，是操作系统管理内存的单位：映射、保护、换出、清零，都以页为单位进行。',
    },
    chapter: 'vm-paging',
  },
  'priority-inversion': {
    title: { en: 'Priority inversion', zh: '优先级反转' },
    body: {
      en: 'A high-priority thread waits for a [[lock|lock]] that a low-priority thread holds, and while it waits, medium-priority threads keep the holder from running, so the most urgent thread is stuck behind the least urgent. The usual cure is to lend the holder the waiter’s priority until it releases the lock.',
      zh: '高优先级线程在等一把被低优先级线程持有的[[lock|锁]]；等待期间，中等优先级的线程又让持锁者得不到运行，于是最急的线程被卡在最不急的线程后面。通常的解法是：在持锁者释放锁之前，把等待者的优先级借给它。',
    },
  },
  'hybrid-cores': {
    title: { en: 'Performance and efficiency cores', zh: '性能核与能效核' },
    body: {
      en: 'Processors that mix two kinds of core on one chip: large, fast, power-hungry performance cores and small, frugal efficiency cores. Arm’s big.LITTLE, Apple silicon and Intel chips since Alder Lake (2021) do this, and the OS has to decide which kind each thread should run on.',
      zh: '在一块芯片上混用两种核心的处理器：大而快、耗电多的性能核，和小而省电的能效核。Arm 的 big.LITTLE、苹果芯片、Intel 从 Alder Lake（2021 年）起都是如此，操作系统得决定每个线程该跑在哪一种核心上。',
    },
  },
  dvfs: {
    title: { en: 'CPU frequency scaling', zh: 'CPU 调频' },
    body: {
      en: 'The OS raises or lowers a core’s clock frequency, and with it the voltage, to match the work: faster finishes sooner, slower saves energy. On Linux the cpufreq subsystem chooses the frequency, commonly from the scheduler’s own estimate of how busy each CPU is. The general name is dynamic voltage and frequency scaling (DVFS).',
      zh: '操作系统按工作量调高或调低核心的时钟频率，电压随之一起变：快了早完成，慢了省电。在 Linux 上由 cpufreq 子系统选频率，常见的做法是依据调度器自己对每个 CPU 有多忙的估计。通称动态电压频率调节（DVFS）。',
    },
  },
  'thread-qos': {
    title: { en: 'QoS class (Apple, Windows)', zh: 'QoS 类别（苹果、Windows）' },
    body: {
      en: 'A label saying what kind of work a thread is doing. Apple’s four main classes run from user-interactive (the main thread, animation) to background (indexing, backup). The system uses it to set scheduling priority, the kind of core and clock speed, I/O throughput and timer latency. On Apple systems the program declares it; Windows mostly infers it from what the user can see.',
      zh: '一个说明线程在做哪类工作的标签。苹果的四个主要类别，从 user-interactive（主线程、动画）一直到 background（索引、备份）。系统据此设定调度优先级、核心类型与频率、I/O 吞吐量和定时器延迟。在苹果系统上由程序声明；Windows 则主要根据用户能看到什么来推断。',
    },
  },
  'dispatch-queue': {
    title: { en: 'Dispatch queue (GCD)', zh: '派发队列（GCD）' },
    body: {
      en: 'Apple’s Grand Central Dispatch runs work for a program: the program submits blocks of code to queues, and a pool of [[thread|threads]] runs them. A serial queue runs its blocks one at a time, in order; `dispatch_sync` submits a block and waits until it has run. Each queue can carry a QoS class.',
      zh: '苹果的 Grand Central Dispatch 替程序执行工作：程序把一段段代码块提交到队列里，由一个[[thread|线程]]池去运行。串行队列一次只运行一个块，按顺序来；`dispatch_sync` 提交一个块，并等它运行完。每个队列都可以带一个 QoS 类别。',
    },
  },
  xnu: {
    title: { en: 'XNU', zh: 'XNU' },
    body: {
      en: 'The kernel of macOS, iOS and Apple’s other systems, and open source. It joins code from the Mach [[microkernel|microkernel]] (threads, scheduling, virtual memory) with parts of BSD Unix in a single kernel. The name stands for “X is Not Unix”.',
      zh: 'macOS、iOS 以及苹果其他系统的内核，开源。它把来自 Mach [[microkernel|微内核]]的代码（线程、调度、虚拟内存）和 BSD Unix 的一部分合进同一个内核。名字是“X is Not Unix”的缩写。',
    },
  },
  'decay-usage': {
    title: { en: 'Decay-usage scheduling', zh: '衰减使用（decay-usage）调度' },
    body: {
      en: 'A family of schedulers in which a thread’s priority falls as it uses the CPU, while the usage on record shrinks over time, so old CPU use counts less than recent use. The 4.3BSD scheduler and Mach’s timesharing work this way. Chapter 8 cites it as the other road to what MLFQ does with explicit queues.',
      zh: '一类调度器：线程用 CPU 越多，优先级越低；同时记下的使用量会随时间缩小，于是很久以前的 CPU 使用不如最近的分量重。4.3BSD 的调度器和 Mach 的分时调度都是这样。第 8 章把它当作通向 MLFQ 效果的另一条路，MLFQ 靠的是显式的队列。',
    },
    chapter: 'cpu-sched-mlfq',
  },
  vruntime: {
    title: { en: 'Virtual runtime (vruntime)', zh: '虚拟运行时间（vruntime）' },
    body: {
      en: 'Linux’s per-task count of the CPU time a task has received, scaled by its weight, so it grows more slowly for heavier tasks. CFS always runs the task with the smallest one; a task that has slept a lot is behind and runs as soon as it wakes.',
      zh: 'Linux 为每个任务记的“已得到的 CPU 时间”，按权重缩放过，权重越大涨得越慢。CFS 总是运行 vruntime 最小的任务；睡得多的任务落在后面，一醒来就能运行。',
    },
    chapter: 'cpu-sched-lottery',
    note: 'eevdf',
  },
  'sched-class': {
    title: { en: 'Scheduler class (Linux)', zh: '调度类（Linux）' },
    body: {
      en: 'Linux’s scheduler is split into classes, each with its own policy and queues: among them deadline, real-time, fair (for ordinary tasks) and idle. The kernel runs a task from the highest class that has one ready. sched_ext adds a class whose policy is a [[bpf|BPF]] program.',
      zh: 'Linux 的调度器分成若干个类，每个类有自己的策略和队列，其中有 deadline、实时、公平（普通任务用）和 idle。内核总是从有就绪任务的最高一类里挑任务。sched_ext 加了一个类，它的策略是一段 [[bpf|BPF]] 程序。',
    },
  },
  'out-of-tree': {
    title: { en: 'Out of tree', zh: '树外（out of tree）' },
    body: {
      en: 'Code kept outside the official Linux source tree, so it ships with no kernel release and the kernel developers do not maintain it. sched_ext schedulers such as `scx_lavd` live in the separate sched-ext project and are loaded into an ordinary kernel.',
      zh: '放在 Linux 官方源码树之外的代码：它不随内核版本发布，也不由内核开发者维护。`scx_lavd` 这样的 sched_ext 调度器放在独立的 sched-ext 项目里，加载进普通内核运行。',
    },
  },
  'make-j': {
    title: { en: 'make -j', zh: 'make -j' },
    body: {
      en: '`make` builds a program by running the compiler on each source file that needs it; `-j10` lets it run up to ten of those jobs at once. From the scheduler’s side, one command in one terminal becomes about ten CPU-hungry processes.',
      zh: '`make` 通过对每个需要重新编译的源文件运行编译器来构建程序；`-j10` 允许它同时跑最多十个这样的任务。在调度器看来，一个终端里的一条命令，变成了大约十个吃 CPU 的进程。',
    },
  },
}

export default terms
