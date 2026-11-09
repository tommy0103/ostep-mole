import type { SceneDef } from './index'

/** The running figure of “What shipping kernels actually do with MLFQ”. */
const scene: SceneDef = {
  height: 436,
  bands: {
    overview: [6, 432],
    rules: [62, 340],
    windows: [6, 340],
    sweeper: [62, 340],
    'win-qos': [62, 432],
    'apple-qos': [6, 340],
    clutch: [62, 432],
    o1: [6, 340],
    rsdl: [62, 340],
    cfs: [62, 340],
    eevdf: [6, 340],
    'sched-ext': [6, 340],
    ule: [62, 340],
  },
  parts: {
    program: [8, 60],
    queues: [80, 334],
    panel: [80, 334],
    win: [80, 334],
    o1: [80, 334],
    qos: [80, 334],
    clutch: [80, 334],
    tree: [80, 334],
    autogroup: [210, 334],
    inversion: [222, 334],
    bpf: [80, 334],
    cores: [348, 432],
    cpu: [348, 432],
  },
  states: {
    overview: {
      title: { en: 'Who decides a priority?', zh: '优先级由谁决定' },
      caption: {
        en: 'Each scheduler sits between programs and the CPU. It can learn what a thread is by watching it, as chapter 8’s MLFQ does, or be told by the program. The four questions on the right are asked of every system that follows.',
        zh: '每个调度器都夹在程序和 CPU 之间。它可以像第 8 章的 MLFQ 那样靠观察来了解一个线程，也可以由程序告诉它。右边四个问题，下文对每个系统都要问一遍。',
      },
    },
    rules: {
      title: { en: 'MLFQ, as the book left it', zh: '书里最终的 MLFQ' },
      caption: {
        en: 'Rules 1 and 2 pick from the highest non-empty queue, round robin. Rules 3 to 5 learn: a new job starts at the top, a job that uses its allotment moves down, and every period S all jobs go back to the top.',
        zh: '规则 1 和 2 从最高的非空队列里轮转着挑。规则 3 到 5 负责学习：新工作从最高层开始，用完配额就降一层，每过一段时间 S 所有工作回到最高层。',
      },
    },
    windows: {
      title: { en: 'Windows: 32 levels', zh: 'Windows：32 级' },
      caption: {
        en: 'Levels 16 to 31 are real-time and fixed; 1 to 15 are dynamic. A thread starts at its base priority (8 for a normal thread in a normal process), is boosted when it wakes from I/O or gets input, and drops one level per time slice back to its base, never below.',
        zh: '16 到 31 级是实时段，优先级固定；1 到 15 级是动态段。线程从基础优先级起步（普通进程里的普通线程是 8），从 I/O 中醒来或收到输入时被提升，然后每个时间片降一级，回到基础优先级为止，绝不更低。',
      },
    },
    sweeper: {
      title: { en: 'Inside the boosts', zh: '提升的内部' },
      caption: {
        en: 'XP-era numbers, now changed in places: the boost depends on the device, waking costs a third of a tick, and about once a second a sweeper lifts any thread that has been ready but not run for 300 ticks to 15, for one longer quantum.',
        zh: 'XP 时代的数字，后来有的已经改了：提升幅度取决于设备，醒来要扣三分之一个节拍；平衡集管理器每秒扫一次，把就绪了 300 个节拍还没运行的线程提到 15，给一个更长的时间片。',
      },
    },
    'win-qos': {
      title: { en: 'A second number: QoS', zh: '第二个数：QoS' },
      caption: {
        en: 'Since Windows 10 1709 each thread also has a QoS level, mostly inferred from what the user can see. Priority still decides when a thread runs; QoS influences which kind of core it runs on and how fast the processor is clocked.',
        zh: '从 Windows 10 1709 起，每个线程还有一个 QoS 等级，主要根据用户能看到什么来推断。何时运行仍由优先级决定；QoS 影响的是跑在哪类核心上，以及处理器跑多快。',
      },
    },
    'apple-qos': {
      title: { en: 'Apple: ask, don’t guess', zh: '苹果：去问，不去猜' },
      caption: {
        en: 'The app declares a QoS class for each piece of work, from user-interactive to background. When a high-QoS thread waits on a lock a lower-QoS thread holds, the holder is raised for a while, to resolve the priority inversion.',
        zh: '应用为每份工作声明一个 QoS 类别，从 user-interactive 到 background。高 QoS 线程等着低 QoS 线程持有的锁时，持锁的一方被临时提高，以化解优先级反转。',
      },
    },
    clutch: {
      title: { en: 'XNU’s Clutch scheduler', zh: 'XNU 的 Clutch 调度器' },
      caption: {
        en: 'Root buckets, one per class, are chosen by earliest deadline: now plus the class’s worst-case execution latency. Inside, thread groups are favoured by an interactivity score, and threads by decaying usage. The quantum shrinks from 10 ms to 2 ms down the classes; Edge steers threads between performance and efficiency clusters.',
        zh: '根桶每个类别一个，按最早截止期挑选：当前时间加上该类别的最坏情况执行延迟（WCEL）。桶里的线程组按交互性分数受优待，组里的线程按衰减使用量排先后。时间片随类别从 10 ms 缩到 2 ms；Edge 在性能核簇和能效核簇之间引导线程。',
      },
    },
    o1: {
      title: { en: 'Linux O(1): learn from sleep', zh: 'Linux O(1)：从睡眠中学' },
      caption: {
        en: '140 levels: 100 real-time and 40 for the nice range, with a run queue per level. A task’s sleep_avg rose while it slept and fell while it ran, and could move it up to five levels either side of its static priority.',
        zh: '140 个优先级：100 个实时级，40 个对应 nice 范围，每级一个运行队列。任务的 sleep_avg 睡眠时上升、运行时下降，能让它在静态优先级上下各浮动最多 5 级。',
      },
    },
    rsdl: {
      title: { en: 'RSDL: the staircase', zh: 'RSDL：阶梯' },
      caption: {
        en: 'No estimator. When a level’s quota runs out, every task on it moves down one (a minor rotation). Tasks that have used up their time wait in the expired array at their original priority; when the active array empties, the two swap (a major rotation).',
        zh: '没有估计器。某一级的配额用完时，这一级的所有任务下降一级（小轮转）。用完了时间的任务，按原来的优先级在过期数组里等着；活跃数组空了，两个数组就对调（大轮转）。',
      },
    },
    cfs: {
      title: { en: 'CFS: no levels at all', zh: 'CFS：根本没有层级' },
      caption: {
        en: 'One tree ordered by virtual runtime, and no attempt to spot interactive tasks: a task that sleeps a lot is behind and runs promptly when it wakes. Autogroup gives each terminal session its own group, so a video player’s share goes from about 9% to about 50% beside a make -j10.',
        zh: '一棵按虚拟运行时间排序的树，不再试图识别交互式任务：常睡眠的任务落在后面，醒来就能及时运行。自动分组让每个终端会话自成一组，于是在 make -j10 旁边，视频播放器的份额从约 9% 变成约 50%。',
      },
    },
    eevdf: {
      title: { en: 'EEVDF: a slice you ask for', zh: 'EEVDF：自己请求的时间片' },
      caption: {
        en: 'Since 6.6 a virtual deadline, derived from a requested slice length, decides how soon a task runs, separately from its share. Linux got a “how soon” input, but as a number the task asks for, not a guess.',
        zh: '从 6.6 起，一个由请求的时间片长度推出的虚拟截止期决定任务多快轮到，和份额分开。Linux 终于有了“多快轮到”的输入，但它是任务自己请求的数，不是猜出来的。',
      },
    },
    'sched-ext': {
      title: { en: 'sched_ext: bring your own', zh: 'sched_ext：自带调度器' },
      caption: {
        en: 'Since 6.12 a scheduler class can take its policy from BPF programs loaded at run time. If one errs, leaves a runnable task waiting too long (30 s at most), or the operator presses SysRq-S, it is unloaded and every task goes back to the fair class.',
        zh: '从 6.12 起，有一个调度类的策略可以由运行时加载的 BPF 程序提供。BPF 调度器一旦出错、让可运行任务等得太久（最多 30 秒），或操作员按下 SysRq-S，就会被卸载，所有任务退回公平调度类。',
      },
    },
    ule: {
      title: { en: 'FreeBSD ULE: one score', zh: 'FreeBSD ULE：一个分数' },
      caption: {
        en: 'A score from 0 to 100 compares voluntary sleep with run time; below 30 a thread counts as interactive and is served ahead of the batch range. Once sleep plus run passes five seconds’ worth, both are scaled down, so the past cannot outvote the present.',
        zh: '一个 0 到 100 的分数比较主动睡眠时间和运行时间；低于 30 的线程算交互式，先于批处理区间得到服务。睡眠加运行一旦超过 5 秒的量，两者都按比例缩小，过去压不倒现在。',
      },
    },
  },
  terms: {
    'real-time': ['win'],
    'run-queue': ['o1'],
    'thread-qos': ['qos', 'program'],
    'hybrid-cores': ['cores'],
    dvfs: ['cores'],
    'dispatch-queue': ['program'],
    xnu: ['clutch'],
    edf: ['clutch'],
    'decay-usage': ['clutch'],
    vruntime: ['tree'],
    bpf: ['bpf'],
    'sched-class': ['bpf', 'tree'],
    sysrq: ['bpf'],
  },
}

export default scene
