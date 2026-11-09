import type { Term } from './index'

/** Terms of “Everything in this part, running on your laptop”: what /proc and the tools show. */
const terms: Record<string, Term> = {
  asahi: {
    title: { en: 'Asahi Linux', zh: 'Asahi Linux' },
    body: {
      en: 'A project that ports Linux to Macs with Apple silicon. It runs directly on the hardware, not in a virtual machine, so it must use a page size the machines’ [[iommu|IOMMUs]] support.',
      zh: '把 Linux 移植到 Apple 芯片 Mac 上的项目。它直接跑在硬件上，而不是跑在虚拟机里，所以必须使用这些机器的 [[iommu|IOMMU]] 支持的页大小。',
    },
  },
  brk: {
    title: { en: 'brk() and the heap', zh: 'brk() 与堆' },
    body: {
      en: 'The [[syscall|system call]] that moves the end of a process’s heap, called the break. `malloc()` grows the heap with it for small requests and usually takes large ones straight from [[mmap|`mmap()`]].',
      zh: '移动进程堆末尾（称为 break）的[[syscall|系统调用]]。`malloc()` 遇到小请求时用它扩展堆，大请求则通常直接向 [[mmap|`mmap()`]] 要。',
    },
    chapter: 'vm-api',
  },
  bss: {
    title: { en: '.bss', zh: '.bss 段' },
    body: {
      en: 'The part of a program that holds global and static variables starting at zero. The file records only its size, and when the program is loaded that much [[demand-zero|demand-zero]] memory is mapped in its place.',
      zh: '程序里存放初值为零的全局变量和静态变量的那一部分。文件里只记下它的大小，程序加载时，在相应位置映射同样大小的[[demand-zero|按需置零]]内存。',
    },
  },
  'demand-zero': {
    title: { en: 'Demand-zero page', zh: '按需置零的页' },
    body: {
      en: 'A page the OS has promised but not yet created. When the process first touches it, the kernel takes a free frame, fills it with zeros and maps it. The zeroing matters: the frame may last have held another process’s data.',
      zh: '操作系统答应给、但还没真正创建的页。进程第一次访问它时，内核拿一个空闲帧，填满零，再映射进来。清零很要紧：这个帧上一次装的可能是别的进程的数据。',
    },
    chapter: 'vm-complete',
  },
  'mach-o': {
    title: { en: 'Mach-O', zh: 'Mach-O' },
    body: {
      en: 'The file format of programs and libraries on macOS and iOS, as ELF is on Linux. Its segments include `__TEXT`, for code and read-only data, and `__DATA`, for writable data.',
      zh: 'macOS 和 iOS 上程序与库的文件格式，地位相当于 Linux 上的 ELF。它的段包括存放代码和只读数据的 `__TEXT`，以及存放可写数据的 `__DATA`。',
    },
  },
  'minor-fault': {
    title: { en: 'Minor and major page faults', zh: '次要与主要页错误' },
    body: {
      en: 'A [[page-fault|page fault]] is *minor* when the kernel can resolve it without the disk: by zeroing a fresh frame, or by mapping a page already in memory, such as one in the [[page-cache|page cache]]. A *major* fault has to wait for a read from disk, which is far slower.',
      zh: '如果内核不碰磁盘就能处理一次[[page-fault|页错误]]，它就是*次要*的：清零一个新帧，或者映射一个已经在内存里的页，比如[[page-cache|页缓存]]里的页。*主要*页错误则必须等磁盘读完，慢得多。',
    },
    chapter: 'vm-beyondphys',
  },
  pmd: {
    title: { en: 'PMD (page middle directory)', zh: 'PMD（页中间目录）' },
    body: {
      en: 'Linux’s name for the [[page-table|page-table]] level just above the last one; from the top, the levels are called PGD, P4D, PUD, PMD and PTE. A PMD entry can map a whole block directly instead of pointing to a table: 2 MiB with 4 KiB pages, 32 MiB with 16 KiB pages.',
      zh: 'Linux 对[[page-table|页表]]倒数第二级的称呼；从上往下，各级依次叫 PGD、P4D、PUD、PMD 和 PTE。一个 PMD 表项可以不指向下一级表，而是直接映射一整块：4 KiB 页时是 2 MiB，16 KiB 页时是 32 MiB。',
    },
    chapter: 'vm-smalltables',
  },
  root: {
    title: { en: 'root and CAP_SYS_ADMIN', zh: 'root 与 CAP_SYS_ADMIN' },
    body: {
      en: 'root is the Unix superuser, the account the kernel’s permission checks let do anything. Linux splits root’s powers into *capabilities* that can be granted one at a time; `CAP_SYS_ADMIN` is the broadest of them.',
      zh: 'root 是 Unix 的超级用户，内核的权限检查对这个账户一律放行。Linux 把 root 的权力拆成一项项可以单独授予的*能力*（capability），`CAP_SYS_ADMIN` 是其中范围最广的一项。',
    },
  },
  rowhammer: {
    title: { en: 'Rowhammer', zh: 'Rowhammer（行锤击）' },
    body: {
      en: 'A flaw in DRAM chips, published in 2014: reading the same memory rows over and over, very fast, can flip bits in the neighbouring rows. An attacker who knows physical addresses can aim the flips, for example at a [[page-table|page-table]] entry.',
      zh: 'DRAM 芯片的一个缺陷，2014 年公开：极快地反复读取同几行内存，可能让相邻行里的比特翻转。知道物理地址的攻击者可以瞄准翻转的位置，比如某个[[page-table|页表]]项。',
    },
  },
  vdso: {
    title: { en: 'vDSO', zh: 'vDSO' },
    body: {
      en: 'The virtual dynamic shared object: a small library the kernel maps into every process. Calls such as `clock_gettime()` run there in user mode, reading time data the kernel keeps up to date in the `[vvar]` page, so they need no [[trap|trap]] into the kernel.',
      zh: '虚拟动态共享对象（virtual dynamic shared object）：内核映射进每个进程的一个小库。`clock_gettime()` 这类调用就在这里以用户态运行，读取内核在 `[vvar]` 页里随时更新的时间数据，因此无需[[trap|陷入]]内核。',
    },
  },
}

export default terms
