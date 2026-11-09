import type { Term } from './index'

/** Terms of “Approximating an oracle with history”. */
const terms: Record<string, Term> = {
  ack: {
    title: { en: 'Acknowledgement (ACK)', zh: '确认（ACK）' },
    body: {
      en: 'A short message the [[tcp|TCP]] receiver sends back to say how much of the data has arrived. It tells the sender that data got through and, from how long it took to come back, something about the path.',
      zh: '[[tcp|TCP]] 接收方发回的一条短消息，说明数据已经收到了多少。发送方由此知道数据送到了，也从它回来用了多久，了解到路径的一些情况。',
    },
  },
  rtt: {
    title: { en: 'Round-trip time (RTT)', zh: '往返时间（RTT）' },
    body: {
      en: 'The time from sending a packet to receiving the reply. It includes the travel time and any waiting in queues along the path, so it rises when those queues fill.',
      zh: '从发出一个分组到收到回应所用的时间。它既包括路上的传播时间，也包括在沿途队列里的等待，所以队列积压时它会上升。',
    },
  },
  'tcp-segment': {
    title: { en: 'Segment (TCP)', zh: '报文段（TCP）' },
    body: {
      en: 'One unit of data [[tcp|TCP]] hands to the network: a header and a slice of the byte stream. On ordinary Ethernet a full-sized segment carries about 1,460 bytes of data.',
      zh: '[[tcp|TCP]] 交给网络的一个数据单位：一个首部加上字节流的一段。在普通以太网上，一个满尺寸报文段装大约 1,460 字节数据。',
    },
  },
  'opt-policy': {
    title: { en: 'Belady’s optimal policy (OPT)', zh: 'Belady 最优策略（OPT）' },
    body: {
      en: 'When memory is full, evict the [[page|page]] whose next use is furthest in the future. No policy can miss less often. No real system can run it, since it needs the future; simulators use it as the yardstick for policies that can be built.',
      zh: '内存满了时，淘汰下一次使用离现在最远的那个[[page|页]]。没有哪种策略的未命中次数比它更少。真实系统跑不了它，因为它需要知道未来；模拟器拿它当衡量实际策略的标尺。',
    },
    chapter: 'vm-beyondphys-policy',
  },
  'cpu-burst': {
    title: { en: 'CPU burst', zh: 'CPU 突发（burst）' },
    body: {
      en: 'One stretch during which a process keeps running on the CPU before it blocks, usually to wait for I/O. Programs alternate bursts and waits; interactive programs tend to have short bursts, number-crunching programs long ones.',
      zh: '进程在 CPU 上连续运行、直到阻塞（通常是等 I/O）的一段时间。程序在突发和等待之间交替；交互式程序的突发往往很短，计算密集型程序的突发则很长。',
    },
    chapter: 'cpu-sched',
  },
  'load-average': {
    title: { en: 'Load average', zh: '平均负载（load average）' },
    body: {
      en: 'A smoothed count of how many tasks are running or waiting to run, which Unix systems report over the last 1, 5 and 15 minutes (`uptime` prints it). Linux also counts tasks in uninterruptible sleep.',
      zh: '对“有多少任务正在运行或等着运行”的平滑统计，Unix 系统按最近 1、5、15 分钟报告（`uptime` 会打印出来）。Linux 还把处于不可中断睡眠的任务也算在内。',
    },
  },
  pelt: {
    title: { en: 'Per-entity load tracking (PELT)', zh: '按实体负载跟踪（PELT）' },
    body: {
      en: 'Linux’s running estimate of how much each schedulable entity, a task or a group of tasks, loads a CPU. Tracking each entity separately means that when a task moves to another CPU, its contribution to the load can move with it.',
      zh: 'Linux 对每个可调度实体（一个任务或一组任务）给 CPU 带来多少负载的滚动估计。逐个实体分别跟踪，任务迁到别的 CPU 时，它贡献的负载也就能跟着迁过去。',
    },
  },
  'slow-start': {
    title: { en: 'Slow start', zh: '慢启动' },
    body: {
      en: 'How [[tcp|TCP]] begins, and begins again after a timeout. The [[congestion-window|window]] starts small and grows by about one [[tcp-segment|segment]] per [[ack|acknowledgement]], which roughly doubles it every round trip, until it reaches a threshold or a loss occurs.',
      zh: '[[tcp|TCP]] 起步的方式，超时之后也这样重新起步。[[congestion-window|窗口]]从很小开始，每收到一个[[ack|确认]]约增加一个[[tcp-segment|报文段]]，于是大约每个往返翻一倍，直到碰上阈值或发生丢包。',
    },
  },
  'ack-clock': {
    title: { en: 'ACK clock', zh: 'ACK 时钟' },
    body: {
      en: 'In a steady [[tcp|TCP]] transfer, each arriving [[ack|acknowledgement]] means some data has left the network, so the sender may send a little more. The returning ACKs thus pace the sender at the rate the path delivers. When a connection goes idle, the ACKs stop and that pacing is lost.',
      zh: '在稳定的 [[tcp|TCP]] 传输中，每到来一个[[ack|确认]]，就说明有数据离开了网络，发送方可以再发一点。于是返回的 ACK 按路径的投递速度给发送方打着节拍。连接一空闲，ACK 停了，这个节拍也就没了。',
    },
  },
  bbr: {
    title: { en: 'BBR', zh: 'BBR' },
    body: {
      en: 'Bottleneck Bandwidth and Round-trip propagation time: a congestion-control algorithm published by Google in 2016. Rather than treating packet loss as the main signal, it builds a model of the path from the delivery rate and [[rtt|round-trip time]] it measures.',
      zh: 'Bottleneck Bandwidth and Round-trip propagation time（瓶颈带宽与往返传播时间）：Google 在 2016 年发表的拥塞控制算法。它不把丢包当作主要信号，而是根据测得的投递速率和[[rtt|往返时间]]，为路径建立一个模型。',
    },
  },
  pipeline: {
    title: { en: 'Pipeline (CPU)', zh: '流水线（CPU）' },
    body: {
      en: 'A CPU splits each instruction into stages (fetch, decode, execute and so on) and works on several instructions at once, one per stage, like an assembly line. It must therefore fetch the next instructions before the current branch has been decided, which is why it has a [[branch-predictor|branch predictor]].',
      zh: 'CPU 把每条指令分成若干阶段（取指、译码、执行等），同时处理好几条指令，每个阶段一条，就像装配线。于是它必须在当前分支结果出来之前就取后面的指令，这正是需要[[branch-predictor|分支预测器]]的原因。',
    },
  },
  'indirect-branch': {
    title: { en: 'Indirect branch', zh: '间接分支' },
    body: {
      en: 'A jump whose destination is not written in the instruction but read from a register or memory at run time, as with a function pointer or a C++ virtual call. The CPU has to guess the destination, not just whether to jump.',
      zh: '目标地址不写在指令里、而是运行时从寄存器或内存读出来的跳转，比如函数指针或 C++ 的虚函数调用。CPU 要猜的是跳到哪里，而不只是跳不跳。',
    },
  },
  btb: {
    title: { en: 'Branch target buffer (BTB)', zh: '分支目标缓冲区（BTB）' },
    body: {
      en: 'A small table in the CPU that remembers where recent branches jumped, so instructions can be fetched from the likely destination before the real one is known.',
      zh: 'CPU 里的一张小表，记着最近的分支跳到了哪里，这样在真正的目标算出来之前，就能从最可能的目标处取指令。',
    },
  },
  lfu: {
    title: { en: 'LFU (least frequently used)', zh: 'LFU（最不经常使用）' },
    body: {
      en: 'A replacement policy: when something must be evicted, evict the item that has been used the fewest times. It keeps a count per item, where [[lru|LRU]] keeps only an order of last use.',
      zh: '一种替换策略：需要淘汰时，淘汰被使用次数最少的那一项。它为每一项记一个次数，而 [[lru|LRU]] 只记最后一次使用的先后。',
    },
    chapter: 'vm-beyondphys-policy',
  },
  fadvise: {
    title: { en: 'posix_fadvise()', zh: 'posix_fadvise()' },
    body: {
      en: 'A [[syscall|system call]] with which a program tells the kernel how it means to read a file: in order, at random, soon, or not again. The kernel may use the hint to change how far it reads ahead or what it keeps cached, and may ignore it.',
      zh: '程序用来告诉内核自己打算怎样读一个文件的[[syscall|系统调用]]：顺序读、随机读、马上要读、不会再读。内核可以据此调整预读多远、缓存里留什么，也可以不理会。',
    },
  },
}

export default terms
