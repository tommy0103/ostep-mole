import type { Term } from './index'

/** Terms of “When the trap is too expensive”. */
const terms: Record<string, Term> = {
  'spec-cpu': {
    title: { en: 'SPEC CPU', zh: 'SPEC CPU' },
    body: {
      en: 'A standard suite of compute-heavy benchmark programs from the Standard Performance Evaluation Corporation, used to compare processors and compilers.',
      zh: '标准性能评估组织（SPEC）发布的一套计算密集型基准程序，用来比较处理器和编译器。',
    },
  },
  'kernel-thread': {
    title: { en: 'Kernel thread', zh: '内核线程' },
    body: {
      en: 'A [[thread|thread]] that runs only in kernel mode, with no user program behind it. It is scheduled like any other, and Linux uses such threads for background work: writing data to disk, reclaiming memory, polling an io_uring queue.',
      zh: '只在内核态运行、背后没有用户程序的[[thread|线程]]。它和其他线程一样接受调度，Linux 用它做后台工作：把数据写回磁盘、回收内存、轮询 io_uring 队列。',
    },
  },
  tsc: {
    title: { en: 'Timestamp counter (TSC)', zh: '时间戳计数器（TSC）' },
    body: {
      en: 'An x86 counter that ticks steadily and that the kernel normally lets user programs read with the `RDTSC` instruction. Combined with the clock parameters the kernel publishes, it gives the current time without entering the kernel.',
      zh: 'x86 上一个稳定递增的计数器，内核通常允许用户程序用 `RDTSC` 指令读取它。配合内核发布的时钟参数，不进内核就能算出当前时间。',
    },
  },
  'memory-barrier': {
    title: { en: 'Memory barrier', zh: '内存屏障（memory barrier）' },
    body: {
      en: 'An instruction that stops the CPU and compiler from reordering memory accesses across it. A writer fills in an entry, then a barrier, then advances the tail, so that a reader on another CPU that sees the new tail also sees the finished entry.',
      zh: '一条阻止 CPU 和编译器把内存访问重排到它另一侧的指令。写入方先填好条目，再放一道屏障，然后才推进队尾；这样另一个 CPU 上的读取方只要看到新队尾，就一定能看到填好的条目。',
    },
  },
  'io-uring': {
    title: { en: 'io_uring', zh: 'io_uring' },
    body: {
      en: 'A Linux interface for asynchronous I/O, merged in 5.1 in 2019. A program and the kernel share two [[ring-buffer|ring buffers]] in memory, one of requests and one of results, so many operations can be handed over with one [[syscall|system call]] or none.',
      zh: 'Linux 的异步 I/O 接口，2019 年随 5.1 合入。程序和内核在内存里共享两个[[ring-buffer|环形缓冲区]]，一个放请求，一个放结果，于是一次[[syscall|系统调用]]甚至零次，就能交接许多操作。',
    },
  },
}

export default terms
