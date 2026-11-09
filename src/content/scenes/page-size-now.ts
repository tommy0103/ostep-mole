import type { SceneDef } from './index'

/** The running figure of “Everything in this part, running on your laptop”. */
const scene: SceneDef = {
  height: 392,
  bands: {
    overview: [4, 392],
    maps: [16, 322],
    smaps: [16, 392],
    rss: [16, 392],
    pagesize: [16, 392],
    levels: [16, 392],
    lazy: [16, 392],
    touched: [16, 392],
    faultlab: [16, 322],
    major: [16, 392],
    cow: [16, 392],
    pagemap: [16, 392],
    beyond: [16, 392],
  },
  parts: {
    kernelhalf: [18, 36],
    stack: [38, 58],
    vdso: [64, 89],
    anon: [94, 108],
    libc: [105, 162],
    mmap: [170, 234],
    heap: [242, 268],
    prog: [276, 320],
    tlb: [20, 60],
    pt: [70, 196],
    ptB: [204, 248],
    handler: [262, 320],
    frames: [20, 190],
    disk: [212, 264],
    term: [328, 390],
  },
  states: {
    overview: {
      title: { en: 'One chip, two page sizes', zh: '同一块芯片，两种页大小' },
      caption: {
        en: 'A process sees only virtual addresses (left). Its page table, cached by the TLB, translates them page by page into physical frames (right). How big a page is, the operating system chooses: 4096 bytes in the Linux VM this article was checked on, 16384 under macOS on the same kind of chip.',
        zh: '进程只看得到虚拟地址（左）。它的页表（由 TLB 缓存）按页把这些地址翻译成物理帧（右）。一页多大，由操作系统选择：核对本文的那台 Linux 虚拟机上是 4096 字节，同类芯片上的 macOS 是 16384。',
      },
    },
    maps: {
      title: { en: 'The address space, as text', zh: '地址空间，就是一段文本' },
      caption: {
        en: 'Each line of maps is one region, a VMA: code, read-only data and data of the program and of each library, the heap, the stack, the vDSO. The permissions are the protection bits, applied per page; p means private, copied on write. libc’s ---p gap faults on any access.',
        zh: 'maps 的每一行是一个区域，也就是一个 VMA：程序和每个库的代码、只读数据和数据，还有堆、栈、vDSO。权限就是保护位，按页生效；p 表示私有，写时复制。libc 里那段 ---p 空洞，任何访问都会出错。',
      },
    },
    smaps: {
      title: { en: 'Mapped is not resident', zh: '映射了不等于在内存里' },
      caption: {
        en: 'smaps says, region by region, how much is really in memory. This heap spans 132 KiB of addresses, but only one 4 KiB page has a frame; the rest has never been touched.',
        zh: 'smaps 逐个区域告诉你有多少真的在内存里。这个堆占了 132 KiB 的地址，却只有一个 4 KiB 的页有物理帧，其余部分从没被碰过。',
      },
    },
    rss: {
      title: { en: 'VSZ, RSS and PSS', zh: 'VSZ、RSS 与 PSS' },
      caption: {
        en: 'VSZ counts every mapped region. RSS counts the pages now in frames, so a shared library’s page counts in every process that maps it. PSS divides each shared page among its sharers: this libc frame, mapped by A and B, counts half to each.',
        zh: 'VSZ 算上所有已映射的区域。RSS 只算当前在物理帧里的页，所以共享库的页在每个映射它的进程里都算一遍。PSS 把每个共享页分摊给共享它的进程：A 和 B 都映射了这个 libc 帧，各算一半。',
      },
    },
    pagesize: {
      title: { en: '4 KiB or 16 KiB', zh: '4 KiB 还是 16 KiB' },
      caption: {
        en: 'x86-64 always uses 4 KiB base pages; 64-bit Arm lets the OS choose 4, 16 or 64 KiB. One TLB entry maps one page, so 16 KiB pages give four times the reach and a quarter of the faults, at the price of up to four times the waste in each partly used page.',
        zh: 'x86-64 的基础页永远是 4 KiB；64 位 Arm 让操作系统在 4、16、64 KiB 里选一种。一个 TLB 项映射一页，所以 16 KiB 的页带来四倍的覆盖范围、四分之一的页错误，代价是每个没用满的页最多浪费四倍的空间。',
      },
    },
    levels: {
      title: { en: 'Where the levels come from', zh: '页表的级数从何而来' },
      caption: {
        en: 'A page-table page is one page of 8-byte entries, so the page size sets how many bits each level translates. 4 KiB pages: four levels of 9 bits make 48. 16 KiB: three of 11, plus a two-entry level for the 48th bit. 64 KiB: two of 13, for 42 bits.',
        zh: '页表页本身就是一页、每项 8 字节，所以页大小决定了每一级翻译多少位。4 KiB 的页：四级各 9 位，凑成 48 位。16 KiB：三级各 11 位，第 48 位再加一个只有两项的小级。64 KiB：两级各 13 位，共 42 位。',
      },
    },
    lazy: {
      title: { en: 'Mapped, not touched', zh: '映射了，还没碰' },
      caption: {
        en: 'mmap() of 256 MiB only records a VMA: no frames, no page-table entries. VSZ already includes the 256 MiB; RSS is still small.',
        zh: 'mmap() 映射 256 MiB，只是记下一个 VMA：没有物理帧，也没有页表项。VSZ 已经算上了这 256 MiB，RSS 却还很小。',
      },
    },
    touched: {
      title: { en: 'One fault per page', zh: '每页一次页错误' },
      caption: {
        en: 'The first write to each page traps. The kernel finds the address inside the VMA, zeroes a free frame and fills in the entry: a minor fault, no disk involved. 256 MiB of 4 KiB pages takes about 65,536 faults; of 16 KiB pages, about 16,384.',
        zh: '对每一页的第一次写入都会陷入内核。内核发现地址落在 VMA 里，把一个空闲帧清零，填好页表项：这是一次次要页错误，不碰磁盘。256 MiB 按 4 KiB 分页，大约 65,536 次；按 16 KiB 分页，大约 16,384 次。',
      },
    },
    faultlab: {
      title: { en: 'One fault in slow motion', zh: '慢动作看一次页错误' },
      caption: {
        en: 'The lab follows one access: a TLB miss, a walk down the page table, and for a missing page a trap into the kernel’s fault handler, which reads the page from swap into a frame. A demand-zero fault skips the disk and just zeroes a frame.',
        zh: '实验跟着一次访问走：TLB 未命中，沿页表逐级查找；页不在时陷入内核的页错误处理程序，由它把页从交换区读进一个帧。按需置零的页错误不碰磁盘，只把一个帧清零。',
      },
    },
    major: {
      title: { en: 'Major and minor faults', zh: '主要与次要页错误' },
      caption: {
        en: 'After drop_caches empties the page cache, a program’s code must be read from disk: major faults. Run it again and the code is still in the page cache, so each fault only points the page table at a frame that is already there: minor.',
        zh: 'drop_caches 清空页缓存之后，程序的代码得从磁盘读进来：这是主要页错误。再运行一次，代码还在页缓存里，每次页错误只需让页表指向一个现成的帧：这是次要页错误。',
      },
    },
    cow: {
      title: { en: 'Copy-on-write after fork()', zh: 'fork() 之后的写时复制' },
      caption: {
        en: 'fork() copies the page tables, not the memory: parent and child map the same frames, read-only. Reads cause almost no faults; each first write traps, and the kernel copies just that page for the writer. 64 MiB of 4 KiB pages: about 16,384 write faults.',
        zh: 'fork() 复制的是页表，不是内存：父子进程映射同一批帧，都是只读。读几乎不引发页错误；每次首写都会陷入内核，内核只为写的一方复制那一页。64 MiB 按 4 KiB 分页：写的一轮大约 16,384 次页错误。',
      },
      demo: {
        label: { en: 'How fork() shares, then copies', zh: 'fork() 怎样先共享、再复制' },
        steps: [
          {
            en: 'Before the fork. The parent has written all 64 MiB, so every page has a frame of its own. Four of its 16,384 pages are drawn, each with its page-table entry, which points at a frame and says rw: read-write.',
            zh: 'fork 之前。父进程写满了 64 MiB，所以每一页都有自己的物理帧。图里画出它 16,384 页中的 4 页，以及每页的页表项：它指向一个帧，rw 表示可读写。',
          },
          {
            en: 'fork(). The kernel gives the child a copy of the parent’s page-table entries, not of the memory: both point at the same frames. It also marks every private page read-only (r-) in both tables, so that a write will trap.',
            zh: 'fork()。内核给子进程复制一份父进程的页表项，而不是内存：两边指向同一批帧。它还把每个私有页在两张表里都标成只读（r-），这样一旦有人写，就会陷入内核。',
          },
          {
            en: 'The child reads every page. Each entry is already there and allows reading, so the reads cause close to zero faults.',
            zh: '子进程把每页读一遍。每个表项都已就位，而且允许读，所以读的这一轮几乎没有页错误。',
          },
          {
            en: 'The child writes to page 1. Its entry says read-only, so the CPU traps into the kernel: a page fault.',
            zh: '子进程写第 1 页。它的表项是只读的，于是 CPU 陷入内核：一次页错误。',
          },
          {
            en: 'The kernel copies that one frame into a free one, points the child’s entry at the copy and makes it writable. The parent’s entry still points at the original.',
            zh: '内核把这一个帧复制到一个空闲帧里，让子进程的表项指向副本，并改为可写。父进程的表项仍指向原来的帧。',
          },
          {
            en: 'After writing every page: about 16,384 faults, one per page, and the child has copies of its own. The parent’s memory was never touched.',
            zh: '每页都写过之后：大约 16,384 次页错误，每页一次，子进程有了自己的副本。父进程的内存自始至终没被动过。',
          },
        ],
      },
    },
    pagemap: {
      title: { en: 'Your page table, almost', zh: '你的页表，几乎可读' },
      caption: {
        en: 'pagemap holds one 8-byte entry per virtual page: bit 63 says present, bit 62 swapped, bits 0–54 give the physical frame number. Since Linux 4.2 an unprivileged reader sees the frame number as zero, because physical addresses help Rowhammer.',
        zh: 'pagemap 为每个虚拟页提供一个 8 字节的表项：第 63 位表示在内存中，第 62 位表示已换出，第 0 到 54 位是物理帧号。从 Linux 4.2 起，无特权的读者看到的帧号是零，因为物理地址能帮 Rowhammer 攻击。',
      },
    },
    beyond: {
      title: { en: 'Past the book', zh: '比书走得更远' },
      caption: {
        en: 'Pages come in several sizes: 2 MiB transparent huge pages and, in recent kernels, intermediate sizes such as 16, 32 or 64 KiB. The kernel half of the address space is not in maps. And with overcommit, VSZ is a promise and RSS is what has been delivered.',
        zh: '页不止一种大小：2 MiB 的透明大页，以及较新内核里 16、32、64 KiB 等中间尺寸。地址空间里属于内核的那一半不在 maps 里。有了超额分配，VSZ 是承诺，RSS 是已兑现的部分。',
      },
    },
  },
  terms: {
    'proc-sys': ['term'],
    vma: ['stack', 'vdso', 'libc', 'anon', 'heap', 'prog'],
    libc: ['libc'],
    'demand-zero': ['anon'],
    bss: ['anon'],
    brk: ['heap'],
    vdso: ['vdso'],
    thp: ['mmap', 'frames'],
    'huge-page': ['frames'],
    'radix-tree': ['pt'],
    pmd: ['pt'],
    mmap: ['mmap'],
    'minor-fault': ['handler', 'frames'],
    'anonymous-memory': ['heap', 'mmap', 'stack'],
    'page-cache': ['frames', 'disk'],
    rowhammer: ['frames'],
    spectre: ['kernelhalf'],
    'copy-on-write': ['ptB', 'frames'],
  },
}

export default scene
