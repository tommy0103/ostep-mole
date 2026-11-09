import type { Term } from './index'

/** Terms of “Work stealing lives in your language runtime”. */
const terms: Record<string, Term> = {
  tokio: {
    title: { en: 'Tokio', zh: 'Tokio' },
    body: {
      en: 'A widely used runtime for asynchronous Rust. It runs many lightweight tasks, each a Rust [[rust-future|future]], on a pool of worker [[thread|threads]], and handles timers and network I/O for them.',
      zh: '异步 Rust 常用的一个运行时。它把大量轻量的任务（每个都是一个 Rust [[rust-future|future]]）放在一组 worker [[thread|线程]]上运行，并替它们处理定时器和网络 I/O。',
    },
    note: 'work-stealing',
  },
  forkjoinpool: {
    title: { en: 'ForkJoinPool (Java)', zh: 'ForkJoinPool（Java）' },
    body: {
      en: 'Java’s work-stealing thread pool, added in Java 7 for [[fork-join|fork/join]] tasks that split themselves into subtasks. The same pool now runs parallel streams and, since JDK 21, the scheduler of [[virtual-thread|virtual threads]].',
      zh: 'Java 的工作窃取线程池，Java 7 加入，原本为那些会把自己拆成子任务的 [[fork-join|fork/join]] 任务而设计。如今并行流也跑在它上面；从 JDK 21 起，[[virtual-thread|虚拟线程]]的调度器也是它。',
    },
    note: 'work-stealing',
  },
  'virtual-thread': {
    title: { en: 'Virtual thread (Java)', zh: '虚拟线程（Java）' },
    body: {
      en: 'A thread managed by the [[jvm|JVM]] instead of the OS, final since JDK 21. Many virtual threads take turns on a few OS [[thread|threads]]; when one blocks on I/O, the JVM sets it aside and runs another on that OS thread, so a server can afford one per request.',
      zh: '由 [[jvm|JVM]] 而不是操作系统管理的线程，自 JDK 21 起成为正式特性。大量虚拟线程轮流跑在少数几个操作系统[[thread|线程]]上；一个虚拟线程阻塞在 I/O 上时，JVM 把它放到一边，在同一个操作系统线程上换另一个运行，所以服务器负担得起每个请求一个。',
    },
  },
  cilk: {
    title: { en: 'Cilk', zh: 'Cilk' },
    body: {
      en: 'A parallel extension of C developed at MIT from the mid-1990s. A function can *spawn* calls that may run in parallel and *sync* to wait for them; the runtime spreads the spawned work over processors by randomized work stealing, with proven bounds on time and memory.',
      zh: 'MIT 从 1990 年代中期开始开发的 C 语言并行扩展。函数可以 *spawn* 出可能并行执行的调用，再用 *sync* 等它们完成；运行时用随机化的工作窃取把派生出的工作分摊到各处理器上，时间和内存都有经过证明的上界。',
    },
  },
  'ring-buffer': {
    title: { en: 'Ring buffer', zh: '环形缓冲区' },
    body: {
      en: 'A fixed-size array used as a queue whose ends wrap around: items are added at a tail index and taken at a head index, both counted modulo the size. Nothing is ever allocated or moved, and the indices can be updated with [[atomic-cas|atomic instructions]], so other threads can take items without a lock.',
      zh: '一个当作队列用、两端首尾相接的定长数组：在队尾下标处添加，在队头下标处取出，两个下标都对数组长度取模。它从不分配、也不搬动元素，下标可以用[[atomic-cas|原子指令]]更新，所以别的线程不加锁也能从中取走元素。',
    },
  },
  epoll: {
    title: { en: 'epoll', zh: 'epoll' },
    body: {
      en: 'The Linux interface for waiting on many [[socket|sockets]] and other file descriptors at once. A program registers the ones it cares about, and a single call reports which are ready to read or write, so a few threads can serve thousands of connections.',
      zh: 'Linux 上同时等待大量[[socket|套接字]]及其他文件描述符的接口。程序先登记自己关心的那些，然后一次调用就能得知哪些已经可读或可写，于是少数几个线程就能服务成千上万个连接。',
    },
  },
  socket: {
    title: { en: 'Socket', zh: '套接字（socket）' },
    body: {
      en: 'The OS’s endpoint for network communication. A program reads from and writes to a socket much as it does a file; a read waits until data has arrived, unless the socket has been set to non-blocking.',
      zh: '操作系统提供的网络通信端点。程序读写套接字，和读写文件差不多；读的时候，数据没到就一直等着，除非套接字被设成了非阻塞的。',
    },
  },
  'rust-future': {
    title: { en: 'Future (Rust)', zh: 'future（Rust）' },
    body: {
      en: 'A value standing for work that finishes later, written with `async` and compiled into a state machine. A runtime such as [[tokio|Tokio]] *polls* it; it runs until it reaches an `.await` whose result is not ready, then hands the thread back to the runtime.',
      zh: '代表一项稍后才完成的工作的值，用 `async` 写成，编译成一个状态机。由 [[tokio|Tokio]] 这样的运行时去*轮询*（poll）它；它一直运行到某个结果还没就绪的 `.await` 处，然后把线程交还给运行时。',
    },
  },
  hyper: {
    title: { en: 'Hyper', zh: 'Hyper' },
    body: {
      en: 'A widely used HTTP library for Rust, built on [[tokio|Tokio]]. A “hello world” server answers every request with the same short reply, so it measures the runtime’s overhead rather than the application’s work.',
      zh: 'Rust 里广泛使用的 HTTP 库，构建在 [[tokio|Tokio]] 之上。“hello world” 服务器对每个请求都回同一句短话，所以它测的是运行时本身的开销，而不是应用干的活。',
    },
  },
  'fork-join': {
    title: { en: 'Fork/join', zh: 'fork/join' },
    body: {
      en: 'A style of parallel program in which a task splits its work into subtasks (*fork*), lets them run in parallel and waits for their results (*join*), recursively: divide and conquer. Not the Unix [[fork-exec|`fork()`]], which copies a whole process.',
      zh: '一种并行程序的写法：一个任务把工作拆成子任务（*fork*），让它们并行运行，再等它们的结果（*join*），如此递归下去，也就是分治。它和复制整个进程的 Unix [[fork-exec|`fork()`]] 不是一回事。',
    },
  },
  'chase-lev': {
    title: { en: 'Chase–Lev deque', zh: 'Chase–Lev 双端队列' },
    body: {
      en: 'A work-stealing deque without locks, published by David Chase and Yossi Lev in 2005. In the common case the owner pushes and pops at one end with no expensive synchronization; thieves take from the other end with a [[atomic-cas|compare-and-swap]], and the array grows when it fills.',
      zh: 'David Chase 和 Yossi Lev 在 2005 年发表的一种无锁工作窃取双端队列。通常情况下，主人在一端压入、弹出，不需要昂贵的同步；窃取者用[[atomic-cas|比较并交换]]从另一端拿，数组满了会自动扩容。',
    },
  },
  'parallel-stream': {
    title: { en: 'Parallel stream (Java)', zh: '并行流（Java）' },
    body: {
      en: 'A Java stream, a pipeline of operations such as `map`, `filter` and `reduce` over a collection, asked to run in parallel. The library splits the data into pieces and processes them as [[fork-join|fork/join]] tasks in the common [[forkjoinpool|ForkJoinPool]].',
      zh: '要求并行执行的 Java 流（stream）——即在一个集合上串起 `map`、`filter`、`reduce` 等操作的流水线。类库把数据切成若干块，作为 [[fork-join|fork/join]] 任务放进公共的 [[forkjoinpool|ForkJoinPool]] 里处理。',
    },
  },
  jep: {
    title: { en: 'JEP (JDK Enhancement Proposal)', zh: 'JEP（JDK 增强提案）' },
    body: {
      en: 'The document in which a change to Java and the JDK is proposed, discussed and tracked, numbered in order. JEP 444 made [[virtual-thread|virtual threads]] a final feature in JDK 21.',
      zh: '提出、讨论和跟踪 Java 与 JDK 某项改动的文档，按顺序编号。JEP 444 让[[virtual-thread|虚拟线程]]在 JDK 21 中成为正式特性。',
    },
  },
}

export default terms
