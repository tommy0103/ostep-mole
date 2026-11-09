import type { Term } from './index'

/** Terms of “TLB reach and huge pages” (and some its neighbours on PCID and five-level paging share). */
const terms: Record<string, Term> = {
  thp: {
    title: { en: 'Transparent huge pages (THP)', zh: '透明大页（THP）' },
    body: {
      en: 'A Linux feature, merged in 2011, that gives programs [[huge-page|huge pages]] without their asking. On a [[page-fault|page fault]] in anonymous memory the kernel tries a 2 MiB page and falls back to 4 KiB pages if none is free; a kernel thread, [[khugepaged|khugepaged]], later collapses small pages into huge ones. A setting turns it on for all suitable memory, only for regions that ask, or off.',
      zh: 'Linux 在 2011 年合入的一项功能：不用程序开口，就给它[[huge-page|大页]]。匿名内存发生[[page-fault|页错误]]时，内核先试着给一个 2 MiB 的页，没有空闲的就退回 4 KiB 页；之后由内核线程 [[khugepaged|khugepaged]] 把小页合并成大页。一个设置决定它对所有合适的内存生效、只对主动要求的区域生效，还是关闭。',
    },
    note: 'huge-pages',
  },
  'huge-page': {
    title: { en: 'Huge page', zh: '大页（huge page）' },
    body: {
      en: 'A page larger than the base page, made by ending the [[page-walk|page walk]] one or two levels early: on x86-64, 2 MiB or 1 GiB instead of 4 KiB. One [[tlb|TLB]] entry then covers 512 or 262,144 times as much memory. The memory must be physically contiguous and aligned to the page’s size.',
      zh: '比基础页更大的页，做法是让[[page-walk|页表遍历]]提前一两级结束：在 x86-64 上是 2 MiB 或 1 GiB，而不是 4 KiB。于是一个 [[tlb|TLB]] 项覆盖的内存是原来的 512 倍或 262144 倍。这块内存必须物理连续，并按页的大小对齐。',
    },
    note: 'huge-pages',
  },
  'page-walk': {
    title: { en: 'Page walk', zh: '页表遍历（page walk）' },
    body: {
      en: 'What happens on a [[tlb|TLB]] miss: the hardware (on some CPUs, the OS) reads the [[multilevel-table|page table]] from the top level down, one entry per level, until it finds the translation. On x86-64 with 4 KiB pages that is four memory reads before the access itself.',
      zh: '[[tlb|TLB]] 未命中时发生的事：硬件（在某些 CPU 上是操作系统）从顶层往下读[[multilevel-table|页表]]，每级读一项，直到找到这条转换。在使用 4 KiB 页的 x86-64 上，这意味着在真正的访问之前先读四次内存。',
    },
    chapter: 'vm-tlbs',
  },
  'multilevel-table': {
    title: { en: 'Multi-level page table', zh: '多级页表' },
    body: {
      en: 'A [[page-table|page table]] built as a tree. The top level points to pages of entries, which point to further pages, down to the entries that map the program’s pages. Parts of the address space nobody uses need no pages of the tree at all. x86-64 uses four levels, or five.',
      zh: '组织成一棵树的[[page-table|页表]]。顶层指向一页页的表项，这些表项再指向下一级的页，直到最底层的表项映射程序的页。地址空间里没人用的部分，在树里根本不需要页。x86-64 用四级，或者五级。',
    },
    chapter: 'vm-smalltables',
    note: 'five-level',
  },
  'proc-sys': {
    title: { en: '/proc and /sys', zh: '/proc 与 /sys' },
    body: {
      en: 'Linux file systems with no files on disk. Each “file” under them is a piece of the kernel’s state shown as text: reading one asks the kernel for a value, and writing one, as root, changes a setting. Most of Linux’s tunables and hardware details are exposed this way.',
      zh: 'Linux 上两个不对应磁盘文件的文件系统。它们下面的每个“文件”都是内核的一部分状态，以文本形式呈现：读它，就是向内核要一个值；以 root 身份写它，就是改一个设置。Linux 的大多数可调参数和硬件信息都是这样暴露出来的。',
    },
  },
  'last-level-cache': {
    title: { en: 'Last-level cache', zh: '末级缓存' },
    body: {
      en: 'The largest and slowest level of a processor’s [[cpu-cache|caches]], usually shared by all its cores. It holds megabytes, often tens of megabytes: far less than main memory, but still more than a TLB of 4 KiB pages can reach.',
      zh: '处理器各级[[cpu-cache|缓存]]中最大、最慢的一级，通常由所有核心共享。它能装几 MB，常常是几十 MB：远小于主存，却仍比用 4 KiB 页的 TLB 能覆盖的范围大。',
    },
  },
  'buffer-pool': {
    title: { en: 'Buffer pool', zh: '缓冲池（buffer pool）' },
    body: {
      en: 'The memory a database sets aside to cache the pages of its tables and indexes, so that most reads need not go to disk. It is often gigabytes in size and is read all over the place.',
      zh: '数据库划出来缓存表和索引页的内存，让大多数读取不必去碰磁盘。它常常有好几 GB，访问遍布各处。',
    },
  },
  'working-set': {
    title: { en: 'Working set', zh: '工作集' },
    body: {
      en: 'The pages a program is actively using over a short stretch of time. If they fit in a cache (the TLB, the CPU caches, or physical memory itself), the program runs from that cache; if they do not, it keeps missing.',
      zh: '程序在一小段时间里正在使用的那些页。它们装得进某个缓存（TLB、CPU 缓存，或物理内存本身），程序就从这个缓存里跑；装不进，就会不停地未命中。',
    },
    chapter: 'vm-beyondphys-policy',
  },
  swap: {
    title: { en: 'Swapping', zh: '换出（swap）' },
    body: {
      en: 'Moving pages that have not been used lately out of physical memory to a disk area, the swap space, so the memory can hold something else. A swapped-out page has a non-present [[page-table|page-table]] entry, in whose otherwise unused bits Linux records where the page is; its next use causes a [[page-fault|page fault]] that reads it back.',
      zh: '把最近没用到的页从物理内存挪到磁盘上的一块区域（交换空间），腾出内存装别的东西。被换出的页，其[[page-table|页表]]项标记为不在内存，Linux 把它在交换空间里的位置记在这个表项本来空着的位里；下次使用时触发一次[[page-fault|页错误]]，再把它读回来。',
    },
    chapter: 'vm-beyondphys',
  },
  'page-fault': {
    title: { en: 'Page fault', zh: '页错误（page fault）' },
    body: {
      en: 'The [[trap|trap]] a CPU takes when an access finds no valid translation for its address, or one that forbids the access. The kernel then decides what to do: allocate a page, read one back from disk, copy one, or stop the process for touching memory it may not.',
      zh: 'CPU 在访问某个地址却找不到有效的转换、或者转换禁止这次访问时发生的[[trap|陷阱]]。接下来由内核决定怎么办：分配一页、从磁盘读回一页、复制一页，或者因为进程碰了不该碰的内存而终止它。',
    },
    chapter: 'vm-beyondphys',
  },
  hugetlbfs: {
    title: { en: 'hugetlbfs', zh: 'hugetlbfs' },
    body: {
      en: 'Linux’s explicit huge-page interface. The administrator reserves a pool of [[huge-page|huge pages]]; a program maps a file on a hugetlbfs mount, or passes `MAP_HUGETLB` to [[mmap|`mmap()`]], and either gets pages from the pool or fails. The name comes from HugeTLB, the kernel’s name for this support.',
      zh: 'Linux 显式使用大页的接口。管理员预留一个[[huge-page|大页]]池；程序映射 hugetlbfs 挂载点上的文件，或者给 [[mmap|`mmap()`]] 传 `MAP_HUGETLB`，要么从池里拿到页，要么失败。名字来自 HugeTLB，即内核对这项支持的称呼。',
    },
  },
  mmap: {
    title: { en: 'mmap()', zh: 'mmap()' },
    body: {
      en: 'The [[syscall|system call]] that maps memory into a process’s address space: a file, or zero-filled *anonymous* memory with no file behind it. Its flags choose whether the mapping is shared, where it goes and, with `MAP_HUGETLB`, whether it uses huge pages. `munmap()` removes a mapping.',
      zh: '把内存映射进进程地址空间的[[syscall|系统调用]]：可以是一个文件，也可以是背后没有文件、初始为零的*匿名*内存。它的标志决定映射是否共享、放在哪里，以及（用 `MAP_HUGETLB` 时）是否使用大页。`munmap()` 用来撤掉一个映射。',
    },
    chapter: 'vm-api',
  },
  'anonymous-memory': {
    title: { en: 'Anonymous memory', zh: '匿名内存' },
    body: {
      en: 'Memory with no file behind it: the heap, the stacks, and regions from [[mmap|`mmap()`]] with `MAP_ANONYMOUS`. It starts out zero-filled, and if it has to leave physical memory it goes to [[swap|swap]].',
      zh: '背后没有文件的内存：堆、栈，以及用 `MAP_ANONYMOUS` 通过 [[mmap|`mmap()`]] 得到的区域。它一开始全是零；如果不得不离开物理内存，就去[[swap|交换空间]]。',
    },
  },
  khugepaged: {
    title: { en: 'khugepaged', zh: 'khugepaged' },
    body: {
      en: 'A Linux kernel thread, a thread that runs only kernel code, which scans processes’ memory in the background and collapses runs of 4 KiB pages into 2 MiB [[huge-page|huge pages]]. To collapse a range it allocates a huge page and copies the small pages into it. Its settings live under `/sys/kernel/mm/transparent_hugepage/khugepaged/`.',
      zh: 'Linux 的一个内核线程（只运行内核代码的线程），在后台扫描各进程的内存，把成片的 4 KiB 页合并成 2 MiB 的[[huge-page|大页]]。合并一段区域时，它先分配一个大页，再把那些小页复制进去。它的设置在 `/sys/kernel/mm/transparent_hugepage/khugepaged/` 下面。',
    },
  },
  madvise: {
    title: { en: 'madvise()', zh: 'madvise()' },
    body: {
      en: 'A [[syscall|system call]] with which a program tells the kernel how it means to use a range of its memory. `MADV_HUGEPAGE` asks for [[thp|transparent huge pages]] there; other values say the range will be read in order, is no longer needed, and so on. The kernel may act on the advice or ignore it.',
      zh: '程序用来告诉内核“我打算怎么用这段内存”的[[syscall|系统调用]]。`MADV_HUGEPAGE` 要求在这里使用[[thp|透明大页]]；其他取值表示这段内存会被顺序读取、已经不再需要，等等。内核可以照办，也可以不理。',
    },
  },
  compaction: {
    title: { en: 'Memory compaction', zh: '内存规整（compaction）' },
    body: {
      en: 'Moving pages around in physical memory so that free frames end up next to each other. The kernel copies each page to a new frame and updates the page-table entries that pointed to it. It is how Linux makes a free, aligned 2 MiB block when free memory is scattered in small holes.',
      zh: '在物理内存里挪动页，让空闲页帧聚到一起。内核把每个页复制到新的页帧，并更新指向它的页表项。当空闲内存散落在小空洞里时，Linux 就靠它凑出一块空闲且对齐的 2 MiB。',
    },
  },
  'internal-fragmentation': {
    title: { en: 'Internal fragmentation', zh: '内部碎片' },
    body: {
      en: 'Memory wasted inside an allocated unit. A program that needs 5 KiB and gets two 4 KiB pages wastes 3 KiB; the bigger the unit, the more can be wasted. Its counterpart, external fragmentation, is free memory scattered in pieces too small to use.',
      zh: '浪费在已分配单位内部的内存。程序需要 5 KiB，却拿到两个 4 KiB 的页，就浪费了 3 KiB；单位越大，可能浪费的越多。与之相对的外部碎片，是空闲内存散成了太小而用不上的碎块。',
    },
    chapter: 'vm-freespace',
  },
  rss: {
    title: { en: 'Resident set size (RSS)', zh: '常驻集大小（RSS）' },
    body: {
      en: 'How much of a process’s memory is actually in physical memory right now, as opposed to merely reserved in its address space. Tools such as `top` and `ps` show it.',
      zh: '进程的内存里此刻真正待在物理内存中的那部分，而不只是在地址空间里占了位置。`top`、`ps` 之类的工具会显示它。',
    },
  },
  'event-loop': {
    title: { en: 'Event loop', zh: '事件循环' },
    body: {
      en: 'A program structure in which one thread waits for events, such as a request arriving or a socket becoming ready, and handles them one after another in a loop. Redis executes its commands in such a loop, so anything slow inside it delays every client.',
      zh: '一种程序结构：一个线程等待事件（比如请求到达、套接字可读），在一个循环里一件接一件地处理。Redis 就在这样的循环里执行命令，所以循环里任何慢的东西都会拖慢所有客户端。',
    },
  },
  tcmalloc: {
    title: { en: 'TCMalloc', zh: 'TCMalloc' },
    body: {
      en: 'A memory allocator from Google that replaces the C library’s `malloc()`. The name means thread-caching malloc; current versions keep their caches of free memory per CPU rather than per thread, so most allocations need no lock.',
      zh: 'Google 出品的内存分配器，用来替代 C 库的 `malloc()`。名字的意思是“按线程缓存的 malloc”；现在的版本把空闲内存的缓存按 CPU 而不是按线程来存放，所以大多数分配不需要加锁。',
    },
    note: 'allocators',
  },
  rosetta: {
    title: { en: 'Rosetta', zh: 'Rosetta' },
    body: {
      en: 'Apple’s translator that lets Macs with Apple’s own chips run programs built for Intel Macs, by translating their x86-64 instructions into ARM instructions.',
      zh: 'Apple 的翻译层：把为 Intel Mac 编译的程序的 x86-64 指令翻译成 ARM 指令，让搭载 Apple 自研芯片的 Mac 也能运行它们。',
    },
  },
  iommu: {
    title: { en: 'IOMMU', zh: 'IOMMU' },
    body: {
      en: 'An address-translation unit for devices. A device that reads and writes memory directly (DMA) uses addresses that the IOMMU translates through its own page tables, as the CPU’s MMU does for programs, so the OS decides which memory each device can reach.',
      zh: '给设备用的地址转换单元。设备直接读写内存（DMA）时用的地址，要经过 IOMMU 用它自己的页表转换，就像 CPU 的 MMU 为程序做的那样；这样，每个设备能碰到哪些内存由操作系统说了算。',
    },
  },
  abi: {
    title: { en: 'ABI (application binary interface)', zh: 'ABI（应用二进制接口）' },
    body: {
      en: 'The rules that already-compiled programs rely on at the machine level: how functions pass arguments, how data is laid out, how binaries are loaded, what the kernel promises about addresses and page sizes. Changing one can break programs that were built against the old rule, though their source code is fine.',
      zh: '已编译好的程序在机器层面所依赖的规则：函数怎样传参、数据怎样布局、二进制文件怎样加载、内核对地址和页大小作何承诺。改动其中一条，就可能让按旧规则编译的程序出错，哪怕它们的源代码毫无问题。',
    },
  },
  elf: {
    title: { en: 'ELF', zh: 'ELF' },
    body: {
      en: 'The file format of Linux and Android programs and shared libraries. It divides a program into *segments* that the loader maps into memory, each with its own permissions. Memory is mapped in whole pages, so the file must align its segments to at least the page size.',
      zh: 'Linux 和 Android 上程序与共享库的文件格式。它把程序分成若干*段*（segment），由加载器映射进内存，每段有自己的权限。内存是按整页映射的，所以文件里的段至少要按页大小对齐。',
    },
  },
  ndk: {
    title: { en: 'Android NDK', zh: 'Android NDK' },
    body: {
      en: 'The Native Development Kit: Google’s toolchain for compiling the parts of an Android app written in C or C++ into machine code.',
      zh: '原生开发工具包（Native Development Kit）：Google 提供的工具链，用来把 Android 应用中用 C 或 C++ 写的部分编译成机器码。',
    },
  },
}

export default terms
