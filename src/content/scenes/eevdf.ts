import type { SceneDef } from './index'

/** The running figure of “After CFS: how EEVDF separates share from latency”. */
const scene: SceneDef = {
  height: 432,
  bands: {
    overview: [6, 426],
    'two-questions': [6, 104],
    vruntime: [106, 250],
    lag: [106, 250],
    deadline: [106, 250],
    tree: [252, 426],
    wakeup: [6, 250],
    sleep: [106, 348],
    delayed: [106, 348],
    slice: [6, 250],
    bends: [106, 426],
    lineage: [106, 348],
  },
  parts: {
    tasks: [12, 82],
    dials: [84, 102],
    line: [108, 248],
    V: [108, 236],
    elig: [120, 236],
    lag: [124, 214],
    bars: [136, 214],
    tree: [254, 344],
    cpu: [360, 424],
    asleep: [252, 346],
    group: [252, 346],
    cpus: [360, 424],
    syscall: [12, 102],
  },
  states: {
    overview: {
      title: { en: 'Who runs next', zh: '下一个该谁运行' },
      caption: {
        en: 'Three tasks wait in one CPU’s run queue, and the scheduler picks which runs next. The line in the middle is where each task stands in virtual time, explained below. From 2007 the choice was CFS’s; since Linux 6.6 it is EEVDF’s.',
        zh: '三个任务在一个 CPU 的运行队列里等着，调度器挑出下一个运行的。中间那条线标出每个任务在虚拟时间上的位置，下文细讲。从 2007 年起由 CFS 来挑；从 Linux 6.6 起换成了 EEVDF。',
      },
    },
    'two-questions': {
      title: { en: 'One dial for two questions', zh: '两个问题，一个旋钮' },
      caption: {
        en: 'How much CPU should each task get, and how soon should it run? Under CFS the only dial a user had was nice, and turning it moves both at once.',
        zh: '每个任务该分多少 CPU？它该多快轮到？在 CFS 下，用户手里只有 nice 这一个旋钮，一拧就两样一起动。',
      },
    },
    vruntime: {
      title: { en: 'Virtual time', zh: '虚拟时间' },
      caption: {
        en: 'Each dot is a task’s virtual runtime v: 10, 12 and 14 ms in the article’s example, equal weights. V is their weighted average, 12, where a perfectly fair CPU would have them all. CFS would run A, the smallest v.',
        zh: '每个圆点是一个任务的虚拟运行时间 v：文中例子里是 10、12、14 ms，权重相同。V 是它们的加权平均 12，也就是绝对公平的 CPU 会把大家推到的位置。CFS 会运行 v 最小的 A。',
      },
    },
    lag: {
      title: { en: 'Lag and eligibility', zh: '滞后量与合格' },
      caption: {
        en: 'Lag is the distance to V: A is owed 2 ms, B is even, C is 2 ms ahead. Only tasks at or left of V are eligible to run, so C must wait however short its slice. The lags always sum to zero.',
        zh: '滞后量就是到 V 的距离：A 被欠 2 ms，B 正好持平，C 超前 2 ms。只有在 V 上或 V 左边的任务才合格，所以 C 的时间片再短也得等。所有滞后量加起来恒为零。',
      },
    },
    deadline: {
      title: { en: 'Earliest eligible deadline', zh: '最早的合格截止期' },
      caption: {
        en: 'Each bar runs from v to the virtual deadline d = v + r, the slice the task asked for. Among the eligible tasks, A and B, B’s deadline is earlier, so B runs. Weights are equal here, so the scaling is dropped.',
        zh: '每根横条从 v 延伸到虚拟截止期 d = v + r，r 是任务请求的时间片。合格的是 A 和 B，B 的截止期更早，所以运行 B。这里权重相同，省去了按权重的缩放。',
      },
    },
    tree: {
      title: { en: 'The pick in the tree', zh: '在树里挑' },
      caption: {
        en: 'Since 6.8 the run queue is a red-black tree ordered by deadline, and each node caches the smallest v in its subtree. The leftmost node is cached too; here it is B, eligible, so the pick is immediate.',
        zh: '从 6.8 起，运行队列是一棵按截止期排序的红黑树，每个节点缓存其子树里最小的 v。最左节点也有缓存：这里是 B，它合格，于是一步就挑出来了。',
      },
    },
    wakeup: {
      title: { en: 'A short slice on wakeup', zh: '醒来时的短时间片' },
      caption: {
        en: 'The lab’s setup: A and B ask for 3 ms, C wakes up eligible. With a 3 ms slice (dashed) C’s deadline is later than the running task’s, so it waits; with 0.5 ms it has the earliest deadline and runs almost at once.',
        zh: '实验里的设置：A 和 B 请求 3 ms，C 醒来时是合格的。时间片为 3 ms（虚线）时，C 的截止期晚于正在运行的任务，只能等；改成 0.5 ms，它的截止期最早，几乎立刻就能运行。',
      },
    },
    sleep: {
      title: { en: 'Sleeping keeps your lag', zh: '睡眠时带着滞后量' },
      caption: {
        en: 'C goes to sleep 2 ms ahead and takes that lag with it. With C gone, V is the average of A and B. When C comes back it is placed at V − lag / w: still ahead, so it waits. Sleeping cannot wipe out an overdraft.',
        zh: 'C 超前 2 ms 时睡去，带走了这份滞后量。C 一走，V 就成了 A 和 B 的平均。C 回来时被放在 V − lag / w：依然超前，只能等。睡一觉洗不掉透支。',
      },
    },
    delayed: {
      title: { en: 'Delayed dequeue', zh: '延迟出队' },
      caption: {
        en: 'Since 6.12 a task that sleeps while ineligible stays on the queue. Its v stays put while V moves forward as the others run. When V reaches it, its lag is zero and it leaves, owing nothing.',
        zh: '从 6.12 起，在不合格状态下睡去的任务留在队列上。它的 v 不动，V 随着别的任务运行向前走。V 走到它那里时滞后量归零，它才离开，两不相欠。',
      },
    },
    slice: {
      title: { en: 'Two dials', zh: '两个旋钮' },
      caption: {
        en: 'Since 6.12 a task can ask for its slice with sched_setattr(). Nice still sets the weight, how much; the slice sets the deadline, how soon. A shorter slice moves C’s deadline closer without giving it more CPU.',
        zh: '从 6.12 起，任务可以用 sched_setattr() 请求自己的时间片。nice 依旧决定权重，管分多少；时间片决定截止期，管多快轮到。时间片短了，C 的截止期近了，分到的 CPU 却不会变多。',
      },
    },
    bends: {
      title: { en: 'Where the rule bends', zh: '规则弯折的地方' },
      caption: {
        en: 'A running task keeps the CPU until its slice is used or it reaches V (run to parity). A cgroup is one entity in its parent’s queue, with a queue of its own inside. Each CPU has its own run queue, and the load balancer moves tasks between them.',
        zh: '正在运行的任务一直跑到用完时间片或追上 V（跑到持平）。一个 cgroup 在父队列里是一个实体，内部还有自己的队列。每个 CPU 有自己的运行队列，任务在队列之间的迁移由负载均衡器负责。',
      },
    },
    lineage: {
      title: { en: 'From lottery to EEVDF', zh: '从彩票到 EEVDF' },
      caption: {
        en: 'Stride’s pass and CFS’s vruntime are the dots. EEVDF keeps them, makes the fair share explicit as V and lag, and adds the deadline as a second key that sets the order without touching share.',
        zh: '步长调度的 pass、CFS 的 vruntime，就是这些圆点。EEVDF 保留了它们，把公平份额显式化为 V 和滞后量，再加上截止期这第二个键：它决定先后，却不碰份额。',
      },
    },
  },
  terms: {
    thread: ['tasks'],
    syscall: ['syscall'],
    'run-queue': ['tree'],
    cgroup: ['group'],
    container: ['group'],
    'load-balancing': ['cpus'],
  },
}

export default scene
