import type { SceneDef } from './index'

/** The running figure of “Work stealing lives in your language runtime”. */
const scene: SceneDef = {
  height: 400,
  bands: {
    overview: [0, 392],
    layers: [56, 392],
    sqms: [2, 392],
    steal: [47, 229],
    gmp: [2, 266],
    find: [2, 266],
    overflow: [2, 229],
    half: [47, 229],
    os: [2, 306],
    tokio: [47, 266],
    deque: [47, 229],
    cilk: [47, 392],
    bends: [226, 392],
  },
  parts: {
    global: [8, 46],
    netpoll: [8, 46],
    sysmon: [8, 64],
    ps: [64, 228],
    steal: [46, 64],
    ms: [240, 262],
    kernel: [276, 302],
    cores: [262, 344],
  },
  states: {
    overview: {
      title: { en: 'A queue each, and theft', zh: '各有队列，闲者去偷' },
      caption: {
        en: 'A runtime such as Go’s keeps a private queue of tasks for each P and one shared global queue. A P that runs dry steals half of a busy P’s queue. Below, the kernel schedules the threads that run them onto cores.',
        zh: 'Go 这样的运行时给每个 P 一个私有任务队列，外加一个共享的全局队列。队列空了的 P，会从繁忙的 P 那里偷走一半。在下面，内核再把运行它们的线程调度到核心上。',
      },
    },
    layers: {
      title: { en: 'Two schedulers, stacked', zh: '两层调度器' },
      caption: {
        en: 'Goroutines, Tokio tasks and Java virtual threads are not OS threads. The runtime schedules them onto a few threads; the kernel schedules those threads onto cores, using chapters 7 to 10.',
        zh: 'goroutine、Tokio 任务、Java 虚拟线程都不是操作系统线程。运行时把它们调度到少数几个线程上；内核再用第 7 到 10 章的办法，把这些线程调度到核心上。',
      },
    },
    sqms: {
      title: { en: 'One queue, one lock', zh: '一个队列，一把锁' },
      caption: {
        en: 'Chapter 10’s SQMS: every scheduling decision takes the global lock, and a task runs on whichever CPU is free, losing its cache affinity. Go’s scheduler before 1.1 kept its central state behind one global mutex like this.',
        zh: '第 10 章的 SQMS：每次调度决策都要拿全局锁，任务哪个 CPU 空就在哪儿跑，丢掉了缓存亲和度。Go 1.1 之前的调度器，就是用这样一把全局互斥锁保护集中式状态。',
      },
    },
    steal: {
      title: { en: 'Steal, only when idle', zh: '只在闲时去偷' },
      caption: {
        en: 'With a queue per CPU, queues drift out of balance: one has a backlog while another is empty. The runtimes’ rule: only a worker with nothing to do goes looking, so busy workers never pay for balancing.',
        zh: '每个 CPU 一个队列，队列就会逐渐失衡：一个积压，另一个空着。运行时们的规则是：只有无事可做的 worker 才去找活，所以忙碌的 worker 从不为均衡付出代价。',
      },
    },
    gmp: {
      title: { en: 'G, M and P', zh: 'G、M 和 P' },
      caption: {
        en: 'G is a goroutine, M an OS thread, P a scheduling context. There are GOMAXPROCS Ps, and an M must hold one to run Go code. Each P has a runnext slot and a local queue of 256 slots; the global queue sits behind a lock.',
        zh: 'G 是 goroutine，M 是操作系统线程，P 是调度上下文。P 的数量是 GOMAXPROCS，M 必须持有一个 P 才能运行 Go 代码。每个 P 有一个 runnext 槽和一个 256 槽的本地队列；全局队列由一把锁守着。',
      },
    },
    find: {
      title: { en: 'Where an idle M looks', zh: '空闲的 M 去哪儿找活' },
      caption: {
        en: 'findRunnable() tries, in order: the global queue on every 61st tick, its own runnext and local queue, a batch from the global queue, the network poller, then the other Ps’ queues. Finding nothing, it parks the thread.',
        zh: 'findRunnable() 依次尝试：每第 61 个节拍先看全局队列；自己的 runnext 和本地队列；从全局队列取一批；网络轮询器；最后是其他 P 的队列。都没有，就让线程睡下。',
      },
      demo: {
        label: { en: 'findRunnable(), step by step', zh: 'findRunnable() 分步看' },
        steps: [
          {
            en: 'P2 has run out of goroutines, so its thread M2 calls findRunnable(). First check: on every 61st scheduling tick it takes one goroutine from the global queue before anything else, so goroutines waiting there are never starved. This is not such a tick.',
            zh: 'P2 的 goroutine 用完了，于是它的线程 M2 调用 findRunnable()。第一项检查：每到第 61 个调度节拍，先从全局队列取一个 goroutine，免得那里的 goroutine 被饿死。这一拍不是。',
          },
          {
            en: 'Next, its own P: the runnext slot, where a goroutine that should run next waits, then the local queue. Both are empty.',
            zh: '接着看自己的 P：先看 runnext 槽（下一个该运行的 goroutine 在这里等），再看本地队列。两者都空。',
          },
          {
            en: 'Then the global queue, which collects overflow from full local queues. M2 would take a batch, up to half a local queue’s worth, but the global queue is empty too.',
            zh: '然后是收容本地队列溢出的全局队列。M2 本会取一批，最多半个本地队列那么多，但全局队列也是空的。',
          },
          {
            en: 'Poll the network, without blocking: has data arrived on a socket some goroutine is waiting for? Not this time.',
            zh: '非阻塞地轮询一次网络：有没有哪个 goroutine 等着的套接字来了数据？这次没有。',
          },
          {
            en: 'Steal. M2 visits the other Ps in a random order. P0’s queue is empty; P1 has six goroutines waiting.',
            zh: '窃取。M2 以随机顺序访问其他 P。P0 的队列是空的；P1 有六个 goroutine 在等。',
          },
          {
            en: 'It takes half of them, three, from the head of P1’s queue, the oldest end. One of them runs on M2 now, the other two wait in P2’s queue. Had every queue been empty, M2 would have given up P2 and parked: the thread sleeps until new work arrives.',
            zh: '它从 P1 队列的队头（最老的一端）拿走一半，也就是三个。其中一个马上在 M2 上运行，另外两个排进 P2 的队列。要是每个队列都空，M2 就会交出 P2、睡下，直到有新工作出现。',
          },
        ],
      },
    },
    overflow: {
      title: { en: 'Pushed out, too', zh: '也会往外推' },
      caption: {
        en: 'When a goroutine is added to a full local queue, half of the queue and the new goroutine move to the global queue. Idle Ps pull work in; overloaded ones push it out.',
        zh: '往已满的本地队列里加 goroutine 时，队列的一半连同这个新 goroutine 一起挪到全局队列。空闲的 P 把工作拉走，过载的 P 把工作推出。',
      },
    },
    half: {
      title: { en: 'Why take half?', zh: '为什么拿一半？' },
      caption: {
        en: 'P1 has 40 goroutines and P2 none. Taking one would leave 39 to 1 and bring P2 straight back; taking 20 evens them in one steal. A third idle P now finds two queues to steal from.',
        zh: 'P1 有 40 个 goroutine，P2 一个没有。只拿一个，就剩 39 比 1，P2 马上又得回来；拿 20 个，一次就拉平。第三个空闲的 P 现在有两个队列可偷。',
      },
    },
    os: {
      title: { en: 'Jobs the kernel used to do', zh: '原本由内核做的事' },
      caption: {
        en: 'A goroutine in a long system call blocks its M, so sysmon hands the P to another M. Goroutines waiting on sockets are parked with the netpoller. Since Go 1.14, sysmon also signals the thread of any goroutine that has run for more than 10 ms.',
        zh: 'goroutine 陷在一个耗时的系统调用里，会把它的 M 也堵住，于是 sysmon 把 P 交给另一个 M。等待套接字的 goroutine 挂在网络轮询器上。从 Go 1.14 起，任何连续运行超过 10 ms 的 goroutine，sysmon 都会向它所在的线程发信号。',
      },
    },
    tokio: {
      title: { en: 'Tokio: same shape', zh: 'Tokio：同样的结构' },
      caption: {
        en: 'Each worker has a local queue of 256 tasks, a global queue takes overflow, and an idle worker steals half. A woken task goes into the LIFO slot, which runs before the queue and cannot be stolen; after three uses in a row the slot is disabled.',
        zh: '每个 worker 有一个 256 个任务的本地队列，全局队列接收溢出，空闲的 worker 偷走一半。被唤醒的任务进入 LIFO 槽，它在队列之前运行，窃取者拿不走；连续用了三次之后，这个槽会被暂时停用。',
      },
    },
    deque: {
      title: { en: 'Java: the deque', zh: 'Java：双端队列' },
      caption: {
        en: 'Each ForkJoinPool worker owns a deque. The owner pushes and pops the newest task, the smallest piece, whose data is still in its cache; a thief takes the oldest, the biggest piece. One task per steal.',
        zh: '每个 ForkJoinPool worker 拥有一个双端队列。主人在最新的一端压入、弹出，那是最小的一块，数据还在它的缓存里；窃取者拿最老的那个，也就是最大的一块。每次只偷一个任务。',
      },
    },
    cilk: {
      title: { en: 'Random victims', zh: '随机挑受害者' },
      caption: {
        en: 'In Cilk’s scheduler a thief picks its victim uniformly at random and takes the oldest task. For fully strict programs the expected time is T₁/P + O(T∞), and the number of steals grows with the span, not the work.',
        zh: 'Cilk 的调度器里，窃取者均匀随机地挑选受害者，拿走最老的任务。对完全严格的程序，期望运行时间是 T₁/P + O(T∞)，窃取次数随跨度增长，而不是随工作量。',
      },
    },
    bends: {
      title: { en: 'The kernel steals too', zh: '内核也在偷' },
      caption: {
        en: 'Linux keeps a run queue per CPU, and a CPU about to go idle first pulls tasks from a busier one nearby. The runtime above moves tasks between threads without knowing what the kernel does, and the kernel cannot see the tasks.',
        zh: 'Linux 给每个 CPU 一个运行队列，一个 CPU 即将空闲时，会先从附近更忙的 CPU 拉任务过来。上面的运行时在线程之间移动任务，并不知道内核在做什么；内核也看不见这些任务。',
      },
    },
  },
  terms: {
    lock: ['global'],
    goroutine: ['ps'],
    tokio: ['ps'],
    forkjoinpool: ['ps'],
    'virtual-thread': ['ps'],
    thread: ['ms'],
    gomaxprocs: ['ps'],
    'ring-buffer': ['ps'],
    'atomic-cas': ['steal', 'ps'],
    epoll: ['netpoll'],
    socket: ['netpoll'],
    signal: ['sysmon'],
    'rust-future': ['ps'],
    'fork-join': ['ps'],
    'chase-lev': ['ps'],
    'load-balancing': ['cores', 'kernel'],
  },
}

export default scene
