import type { Term } from './index'

/** Terms of “Because addresses are virtual, they can lie randomly”. */
const terms: Record<string, Term> = {
  'return-address': {
    title: { en: 'Return address', zh: '返回地址' },
    body: {
      en: 'The place in the code a function goes back to when it finishes. It is usually kept on the stack, close to the function’s local variables, so a write that runs past a local buffer can reach it.',
      zh: '函数结束后要回到的代码位置。它通常保存在栈上，紧挨着函数的局部变量，所以越过局部缓冲区的写入可能碰到它。',
    },
  },
  'function-pointer': {
    title: { en: 'Function pointer', zh: '函数指针' },
    body: {
      en: 'A variable holding the address of a function. When the program calls through it, execution continues at whatever address the variable holds at that moment.',
      zh: '保存某个函数地址的变量。程序通过它调用时，执行流会跳到这个变量此刻保存的地址上。',
    },
  },
  pax: {
    title: { en: 'PaX', zh: 'PaX' },
    body: {
      en: 'A set of security patches for the Linux kernel by an anonymous group of developers, the PaX Team. Besides address space randomization it introduced ways of keeping memory from being both writable and executable. Many of its ideas were later adopted by Linux itself.',
      zh: '由匿名开发者团体 PaX Team 编写的一组 Linux 内核安全补丁。除了地址空间随机化，它还引入了不让内存同时可写又可执行的手段。它的许多想法后来被 Linux 本身采纳。',
    },
  },
  pie: {
    title: { en: 'PIE (position-independent executable)', zh: 'PIE（位置无关可执行文件）' },
    body: {
      en: 'A program compiled so that its code refers to its own functions and data by their distance from the current instruction, never by absolute address. The kernel can then load it at any base, which is what lets [[aslr|ASLR]] move the main program as well.',
      zh: '这样编译出来的程序：代码引用自己的函数和数据时，用的是相对当前指令的距离，从不使用绝对地址。于是内核可以把它加载到任意基址，[[aslr|ASLR]] 也就能把主程序一起移动。',
    },
  },
  'page-frame': {
    title: { en: 'Page frame', zh: '页帧' },
    body: {
      en: 'A page-sized slot of physical memory. The [[page-table|page table]] says which frame each virtual [[page|page]] of a process lives in, and those frames can be anywhere.',
      zh: '物理内存里一个页大小的槽位。[[page-table|页表]]记录进程的每个虚拟[[page|页]]住在哪个页帧里，而这些页帧可以散落在任何地方。',
    },
    chapter: 'vm-paging',
  },
  alignment: {
    title: { en: 'Alignment', zh: '对齐' },
    body: {
      en: 'A region is aligned to some size when its start address is a multiple of that size. Requiring a larger alignment leaves fewer addresses where the region may start.',
      zh: '如果一个区域的起始地址是某个大小的整数倍，就说它按这个大小对齐。要求的对齐越大，这个区域可以起始的地址就越少。',
    },
  },
  relocation: {
    title: { en: 'Static and dynamic relocation', zh: '静态与动态重定位' },
    body: {
      en: 'Two ways of running a program at an address other than the one it was written for. *Static*: before the program runs, a loader rewrites the addresses in its code. *Dynamic*: the hardware adds a base register to every address as the program runs, so the program can be moved even later.',
      zh: '让程序运行在并非编写时所设想的地址上的两种办法。*静态*：程序运行前，由加载器改写代码里的地址。*动态*：程序运行时，由硬件给每个地址加上一个基址寄存器，所以程序之后还能再移动。',
    },
    chapter: 'vm-mechanism',
  },
  prefetch: {
    title: { en: 'Prefetch instruction', zh: '预取指令' },
    body: {
      en: 'An instruction that tells the CPU a program will soon need the data at some address, so that it can load it into the [[cpu-cache|cache]] early. It is only a hint: an address the program may not access raises no error.',
      zh: '告诉 CPU 程序很快会用到某个地址的数据、好提前把它装进[[cpu-cache|缓存]]的指令。它只是个提示：即使程序无权访问那个地址，也不会报错。',
    },
  },
  tsx: {
    title: { en: 'Transactional memory (Intel TSX)', zh: '事务内存（Intel TSX）' },
    body: {
      en: 'CPU instructions that run a block of memory operations as one all-or-nothing transaction. If anything goes wrong inside, the CPU abandons the whole block and undoes its effects.',
      zh: '把一段内存操作当作一个“要么全做、要么全不做”的事务来运行的 CPU 指令。里面只要出了问题，CPU 就放弃整段操作，并撤销它的效果。',
    },
  },
  kpti: {
    title: { en: 'KAISER and KPTI', zh: 'KAISER 与 KPTI' },
    body: {
      en: 'Kernel page-table isolation. Each process gets two sets of [[page-table|page tables]]: while user code runs, almost nothing of the kernel is mapped; the kernel’s entry code switches to the full set. KAISER was the research design of 2017, and it entered Linux as KPTI in early 2018 to stop [[spectre|Meltdown]].',
      zh: '内核页表隔离。每个进程有两套[[page-table|页表]]：用户代码运行时，内核几乎没有被映射；进入内核时，由内核的入口代码切换到完整的那一套。KAISER 是 2017 年的研究设计，2018 年初以 KPTI 之名进入 Linux，用来阻止 [[spectre|Meltdown]]。',
    },
    note: 'pcid',
  },
  gdb: {
    title: { en: 'gdb', zh: 'gdb' },
    body: {
      en: 'The GNU debugger. It runs a program under its control, stops it at chosen places (*breakpoints*), and lets you look at its memory and registers.',
      zh: 'GNU 调试器。它在自己的控制下运行程序，在指定的位置（*断点*，breakpoint）让程序停下，并让你查看内存和寄存器。',
    },
  },
  personality: {
    title: { en: 'Personality (Linux)', zh: 'personality（Linux）' },
    body: {
      en: 'A per-process setting that selects variations in how Linux treats a process. One flag, `ADDR_NO_RANDOMIZE`, turns off address randomization, and programs the process starts inherit it.',
      zh: '进程级的一项设置，用来选择 Linux 对待这个进程的方式上的一些差异。其中的 `ADDR_NO_RANDOMIZE` 标志关闭地址随机化，由这个进程启动的程序也会继承它。',
    },
  },
  'stack-canary': {
    title: { en: 'Stack canary', zh: '栈金丝雀（stack canary）' },
    body: {
      en: 'A random value the compiler places between a function’s local buffers and its [[return-address|return address]] and checks before returning. A write that runs past a buffer changes it first, so the damage is noticed. The name comes from the canaries miners carried, which fell ill before the miners did.',
      zh: '编译器放在函数的局部缓冲区和[[return-address|返回地址]]之间、并在返回前检查的一个随机值。越过缓冲区的写入会先改掉它，破坏于是被发现。名字来自矿工带下井的金丝雀：它们会比人先出事。',
    },
  },
  'memory-tagging': {
    title: { en: 'Memory tagging', zh: '内存标记' },
    body: {
      en: 'Hardware, such as Arm’s Memory Tagging Extension, that gives each small block of memory a tag and puts a matching tag in the unused high bits of each pointer. An access whose two tags differ is caught.',
      zh: '一种硬件机制（比如 Arm 的内存标记扩展 MTE）：给每一小块内存一个标记，并在指针没用到的高位放上对应的标记。两个标记不一致的访问会被抓住。',
    },
    note: 'bounds-revival',
  },
}

export default terms
