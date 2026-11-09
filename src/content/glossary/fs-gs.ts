import type { Term } from './index'

/** Terms of the FS and GS article (“Where segments survive on x86-64”). */
const terms: Record<string, Term> = {
  'lock-prefix': {
    title: { en: 'The x86 lock prefix', zh: 'x86 的 lock 前缀' },
    body: {
      en: 'A prefix byte that makes an instruction’s read-modify-write of memory atomic with respect to the other CPUs. It is needed when several CPUs may update the same variable, and it costs more than the plain instruction.',
      zh: '一个前缀字节，让指令对内存的“读-改-写”相对于其他 CPU 成为原子操作。多个 CPU 可能更新同一个变量时需要它，而且它比普通指令更费时。',
    },
  },
  preemption: {
    title: { en: 'Preemption', zh: '抢占' },
    body: {
      en: 'The kernel taking the CPU away from a running task so that another can run, without the first task’s cooperation. Kernel code that must stay on one CPU for a moment disables preemption around that stretch.',
      zh: '内核不经正在运行的任务同意，就把 CPU 从它手里拿走，换另一个任务运行。内核里有些代码片刻也不能换 CPU，就在那一小段前后关掉抢占。',
    },
    chapter: 'cpu-sched',
  },
  'linear-address': {
    title: { en: 'Linear address', zh: '线性地址' },
    body: {
      en: 'On x86, the address that comes out of segmentation, the segment base plus the offset, before paging translates it to a physical address.',
      zh: '在 x86 上，分段处理之后、分页转换之前的地址，也就是段基址加偏移的结果。',
    },
  },
  tls: {
    title: { en: 'Thread-local storage (TLS)', zh: '线程局部存储（TLS）' },
    body: {
      en: 'Variables of which every [[thread|thread]] has its own copy; in C they can be declared `__thread`. Each thread’s copies live in a block of memory of its own. On x86-64 Linux, FS points at the running thread’s block.',
      zh: '每个[[thread|线程]]各有一份的变量，在 C 里可以用 `__thread` 声明。每个线程的这些变量放在一块属于它自己的内存里。在 x86-64 Linux 上，FS 指向当前线程的那一块。',
    },
  },
  linker: {
    title: { en: 'Linker', zh: '链接器' },
    body: {
      en: 'The tool that combines a program’s separately compiled pieces and libraries into one executable, filling in the addresses and offsets they refer to in each other.',
      zh: '把程序分别编译出来的各个部分和库组合成一个可执行文件的工具，同时填好它们互相引用的地址和偏移。',
    },
  },
  'shared-library': {
    title: { en: 'Shared library', zh: '共享库' },
    body: {
      en: 'A library kept in a file of its own (`.so` on Linux) and loaded into a process when the program starts or later, instead of being copied into the executable.',
      zh: '单独存放在一个文件里（Linux 上是 `.so`）的库，在程序启动时或之后加载进进程，而不是复制进可执行文件。',
    },
  },
  aarch64: {
    title: { en: 'AArch64', zh: 'AArch64' },
    body: {
      en: 'The 64-bit mode and instruction set of the Arm architecture.',
      zh: 'Arm 架构的 64 位模式及其指令集。',
    },
  },
  nmi: {
    title: { en: 'NMI (non-maskable interrupt)', zh: 'NMI（不可屏蔽中断）' },
    body: {
      en: 'An interrupt the CPU delivers even when the kernel has turned ordinary interrupts off. That is why it can arrive at any instruction, including in the middle of the kernel’s own entry code.',
      zh: '即使内核关掉了普通中断，CPU 也照样递送的中断。正因如此，它可能在任何一条指令处到来，包括内核入口代码的中途。',
    },
  },
  ring: {
    title: { en: 'Privilege level (ring)', zh: '特权级（ring）' },
    body: {
      en: 'x86’s levels of privilege, numbered 0 to 3. Linux runs the kernel in ring 0 and programs in ring 3. The CPU’s current level is in the low two bits of the CS register.',
      zh: 'x86 的特权等级，编号 0 到 3。Linux 让内核运行在 ring 0，程序运行在 ring 3。CPU 当前的特权级就在 CS 寄存器的低两位里。',
    },
    chapter: 'cpu-mechanisms',
  },
  sgx: {
    title: { en: 'Intel SGX', zh: 'Intel SGX' },
    body: {
      en: 'Software Guard Extensions: processor support for *enclaves*, regions of a program’s memory that the CPU protects even from the operating system. Code enters and leaves an enclave through special instructions.',
      zh: 'Software Guard Extensions（软件防护扩展）：处理器对*飞地*（enclave）的支持。飞地是程序内存中的一些区域，CPU 连操作系统也不让碰。代码要通过专门的指令进出飞地。',
    },
  },
  'user-threads': {
    title: { en: 'User-level threads', zh: '用户态线程' },
    body: {
      en: 'Tasks that a library or language runtime schedules itself inside a process, switching between them without asking the kernel, so a switch can cost far less than a [[syscall|system call]].',
      zh: '由库或语言运行时在进程内部自己调度的任务，在它们之间切换不用找内核，所以一次切换的开销可以远小于一次[[syscall|系统调用]]。',
    },
  },
  auxv: {
    title: { en: 'Auxiliary vector', zh: '辅助向量（auxiliary vector）' },
    body: {
      en: 'A small table that the kernel’s program loader passes to a program when it starts, with facts about the system such as which features are available. Programs read it with `getauxval()`.',
      zh: '内核的程序加载器在程序启动时传给它的一张小表，里面是关于系统的一些信息，比如哪些功能可用。程序用 `getauxval()` 读取。',
    },
  },
  'invalid-opcode': {
    title: { en: '#UD (invalid opcode)', zh: '#UD（无效操作码）' },
    body: {
      en: 'The exception an x86 CPU raises for an instruction it will not execute, because it does not exist or is not allowed in the current state.',
      zh: 'x86 CPU 遇到不肯执行的指令时引发的异常：要么没有这条指令，要么当前状态下不允许执行。',
    },
  },
}

export default terms
