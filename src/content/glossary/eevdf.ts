import type { Term } from './index'

/** Terms of the EEVDF article (and the scheduler terms the MLFQ notes share with it). */
const terms: Record<string, Term> = {
  'run-queue': {
    title: { en: 'Run queue', zh: '运行队列' },
    body: {
      en: 'The kernel’s collection of tasks that are ready to run but not running, from which the scheduler picks the next one. Linux keeps one per CPU; how it is organised, a list per priority level or a tree sorted by some key, is the scheduler’s design.',
      zh: '内核里“已就绪、但还没在运行”的任务的集合，调度器从中挑出下一个运行的任务。Linux 为每个 CPU 维护一个；它怎么组织——每个优先级一个链表，还是按某个键排序的一棵树——就是调度器的设计所在。',
    },
    chapter: 'cpu-sched-multi',
  },
  tick: {
    title: { en: 'Clock tick', zh: '时钟节拍（tick）' },
    body: {
      en: 'One periodic timer interrupt, the heartbeat the kernel uses to take back the CPU, charge the running task for its time and decide whether to switch. Its rate is set when the kernel is built, commonly between 100 and 1,000 times a second.',
      zh: '一次周期性的时钟中断，是内核收回 CPU、给正在运行的任务计时、决定要不要切换的“心跳”。它的频率在编译内核时设定，常见的是每秒 100 到 1,000 次。',
    },
    chapter: 'cpu-mechanisms',
  },
  edf: {
    title: { en: 'EDF (Earliest Deadline First)', zh: 'EDF（最早截止期优先）' },
    body: {
      en: 'A real-time scheduling rule: every job has a deadline, and the CPU always runs the ready job whose deadline is soonest. On one CPU with preemption, if any schedule can meet all the deadlines, EDF does.',
      zh: '一种实时调度规则：每个任务都有一个截止期，CPU 总是运行截止期最近的那个就绪任务。在允许抢占的单个 CPU 上，只要存在能满足所有截止期的调度方案，EDF 就能满足。',
    },
  },
  'sched-deadline': {
    title: { en: 'SCHED_DEADLINE', zh: 'SCHED_DEADLINE' },
    body: {
      en: 'A Linux real-time scheduling policy, added in 3.14 (2014). A task declares a runtime, a period and a deadline, for example 2 ms of CPU every 10 ms. The kernel admits it only if the total CPU time promised to such tasks stays within a limit ([[admission-control|admission control]]), then schedules these tasks by [[edf|EDF]], ahead of all ordinary tasks.',
      zh: 'Linux 的一种实时调度策略，3.14 版（2014 年）加入。任务声明一个运行时间、一个周期和一个截止期，例如“每 10 ms 要 2 ms CPU”。只有当承诺给这类任务的 CPU 时间总量不超过一个上限时，内核才接纳它（[[admission-control|准入控制]]），然后按 [[edf|EDF]] 调度这些任务，排在所有普通任务之前。',
    },
  },
  'admission-control': {
    title: { en: 'Admission control', zh: '准入控制' },
    body: {
      en: 'Refusing a new task or request when accepting it would break a guarantee already given to others. A scheduler that promises deadlines has to say no sometimes; one that promises only fair shares never does, since each newcomer just makes every share smaller.',
      zh: '如果接受一个新任务或新请求会打破已经给别人的保证，就拒绝它。承诺截止期的调度器有时必须说“不”；只承诺公平份额的调度器从来不必，因为每来一个新任务，只是让每份变小一点。',
    },
  },
  vma: {
    title: { en: 'Virtual memory area (VMA)', zh: '虚拟内存区域（VMA）' },
    body: {
      en: 'One contiguous range of a process’s [[address-space|address space]] with the same permissions and the same backing: the code, the heap, a stack, a mapped file. Linux long kept a process’s areas in a red-black tree in which each node also cached the largest free gap in its subtree, so it could find room for a new mapping without visiting every area. Since 6.1 it uses a different tree, the maple tree.',
      zh: '进程[[address-space|地址空间]]里一段连续的、权限和来源都相同的范围：代码、堆、某个栈、一个映射进来的文件。Linux 长期把一个进程的这些区域放在一棵红黑树里，每个节点还缓存其子树里最大的空闲间隙，这样为新映射找位置时不必逐个查看。从 6.1 起它换成了另一种树：maple tree。',
    },
    chapter: 'vm-complete',
  },
  debugfs: {
    title: { en: 'debugfs', zh: 'debugfs' },
    body: {
      en: 'A file system with no disk behind it, usually mounted at `/sys/kernel/debug`, where kernel code exposes internal state and switches as files for developers. Writing to a file there changes the setting in the running kernel. It is not a stable interface and normally only root may use it.',
      zh: '一个背后没有磁盘的文件系统，通常挂载在 `/sys/kernel/debug`，内核代码把内部状态和开关以文件的形式摆在这里给开发者用。往这里的文件写入，就会改动正在运行的内核里的设置。它不是稳定接口，通常只有 root 能用。',
    },
  },
  regression: {
    title: { en: 'Regression', zh: '回归（regression）' },
    body: {
      en: 'Something that worked, or ran fast, before a change and works worse after it. Kernel developers track performance regressions by rerunning benchmarks on each release; a scheduler change can speed up one workload and regress another.',
      zh: '在某次改动之前好好的（或跑得快的）东西，改动之后变差了。内核开发者在每个版本上重跑基准测试来追踪性能回归；一次调度器改动可能让一种负载变快、另一种负载回退。',
    },
  },
  'load-balancing': {
    title: { en: 'Load balancing', zh: '负载均衡' },
    body: {
      en: 'On a multiprocessor each CPU has its own [[run-queue|run queue]], so one can be crowded while another sits idle. The load balancer periodically moves tasks from busier queues to idler ones, weighing the gain against losing the caches the task had warmed on its old CPU.',
      zh: '在多处理器上，每个 CPU 有自己的[[run-queue|运行队列]]，于是可能一个挤满、另一个闲着。负载均衡器定期把任务从忙的队列挪到闲的队列，同时要权衡：任务在原来的 CPU 上焐热的缓存，挪过去就没了。',
    },
    chapter: 'cpu-sched-multi',
  },
  'fair-queueing': {
    title: { en: 'Fair queueing', zh: '公平排队（fair queueing）' },
    body: {
      en: 'A way for a router to share one outgoing link among many flows of packets. Each packet gets a virtual finish time, when it would finish if every flow had its own slice of the link, and packets are sent in that order. A flow that sends a flood only delays itself. Weighted versions give flows unequal shares.',
      zh: '路由器在许多分组流之间分享一条出口链路的办法。每个分组得到一个虚拟完成时间——假如每条流都独占链路的一份，它会在何时发完——然后按这个顺序发送。一条流狂发分组，只会拖慢它自己。加权版本可以给各条流不等的份额。',
    },
  },
  'llm-token': {
    title: { en: 'Token (in LLMs)', zh: 'token（大模型里）' },
    body: {
      en: 'The unit of text a large language model reads and writes: a word or a piece of one. A model produces its answer one token at a time, so the work a request costs grows with the number of tokens it reads and generates.',
      zh: '大语言模型读写文本的单位：一个词，或一个词的一部分。模型一次生成一个 token，所以一个请求要花多少计算，随它读入和生成的 token 数增长。',
    },
    note: 'llm-convoy',
  },
}

export default terms
