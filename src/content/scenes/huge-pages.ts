import type { SceneDef } from './index'

/** The running figure of “TLB reach and huge pages”. */
const scene: SceneDef = {
  height: 400,
  bands: {
    overview: [0, 400],
    reach: [0, 96],
    walk: [102, 314],
    huge: [102, 314],
    rules: [102, 376],
    hugetlbfs: [160, 396],
    thp: [160, 396],
    bloat: [160, 396],
    compaction: [160, 396],
    cow: [160, 314],
    base: [0, 96],
    three: [0, 400],
  },
  parts: {
    tlb: [6, 46],
    reach: [50, 94],
    va: [102, 136],
    pml4: [138, 200],
    pdpt: [158, 212],
    pd: [170, 224],
    pt: [182, 236],
    ps: [170, 300],
    phys: [260, 312],
    kernel: [316, 396],
    hugetlb: [292, 388],
    thpbox: [338, 388],
    khp: [292, 388],
  },
  states: {
    overview: {
      title: { en: 'TLB, page table, memory', zh: 'TLB、页表与内存' },
      caption: {
        en: 'Every load and store asks the TLB for its translation first. On a miss the CPU walks the page table, four levels on x86-64, down to a 4 KiB frame of physical memory. The switch Redis and MongoDB disagree about, transparent huge pages, sits in the kernel below.',
        zh: '每一次加载和存储都先向 TLB 要地址转换；未命中时，CPU 沿着页表（x86-64 上是四级）一路走到物理内存里的一个 4 KiB 页帧。Redis 和 MongoDB 意见相左的那个开关——透明大页——在下面的内核里。',
      },
    },
    reach: {
      title: { en: 'Reach: entries × page size', zh: '覆盖范围：项数 × 页大小' },
      caption: {
        en: 'The TLB holds a fixed number of translations: 1,536 in a Skylake core’s second-level TLB. With 4 KiB pages they cover 6 MiB; with 2 MiB pages, 3 GiB. The bars are drawn to scale.',
        zh: 'TLB 能装的转换条数是固定的：Skylake 核心的二级 TLB 是 1536 项。用 4 KiB 页，它们覆盖 6 MiB；用 2 MiB 页，覆盖 3 GiB。两根条按同一比例画出。',
      },
    },
    walk: {
      title: { en: 'Fewer levels on a miss', zh: '未命中时少走一级' },
      caption: {
        en: 'A miss on a 4 KiB page reads one entry at each of four levels before the access itself. A 2 MiB page is a leaf one level higher, so its walk reads three.',
        zh: '4 KiB 页未命中时，在真正的访问之前要在四级里各读一项；2 MiB 的页是高一级的叶子，遍历只读三项。',
      },
    },
    huge: {
      title: { en: 'The walk stops early', zh: '遍历提前停下' },
      caption: {
        en: 'With its PS bit set, a page-directory entry points straight at 2 MiB of physical memory, and the low 21 bits of the address become the offset. One level higher, a PDPT entry maps 1 GiB. The same tree, a shorter path.',
        zh: '页目录项置上 PS 位后，直接指向 2 MiB 的物理内存，地址的低 21 位成为偏移量；再高一级，页目录指针表（PDPT）的表项映射 1 GiB。还是同一棵树，只是路径更短。',
      },
    },
    rules: {
      title: { en: 'Three hard requirements', zh: '三条硬性要求' },
      caption: {
        en: 'A 2 MiB page is 512 consecutive 4 KiB frames, all free at once. It starts at a multiple of 2 MiB, virtually and physically. And one entry carries one set of bits for all of it. Each 2 MiB span is drawn with 12 cells; a real one holds 512 frames.',
        zh: '一个 2 MiB 的页是 512 个连续的 4 KiB 页帧，必须同时空闲；它的虚拟和物理起点都得是 2 MiB 的整数倍；而一个表项只带一套位，管着整个 2 MiB。图中每个 2 MiB 区间画了 12 格，实际是 512 个页帧。',
      },
    },
    hugetlbfs: {
      title: { en: 'hugetlbfs: a reserved pool', zh: 'hugetlbfs：预留的池' },
      caption: {
        en: 'The administrator reserves huge pages, most reliably at boot, before memory fragments. Pool pages serve nothing else and are never swapped. A program that asks for them gets huge pages or a failure, nothing in between.',
        zh: '管理员预留一批大页，最可靠的是在启动时、内存还没碎片化的时候。池里的页不挪作他用，也不会被换出。程序向池里要页，要么拿到大页，要么失败，没有中间状态。',
      },
    },
    thp: {
      title: { en: 'THP: the kernel guesses', zh: 'THP：由内核来猜' },
      caption: {
        en: 'A fault in an anonymous region asks for a whole 2 MiB page and quietly falls back to 4 KiB frames when no aligned block is free. Later, khugepaged collapses such ranges into huge pages; the kernel splits one again when part of it must change.',
        zh: '匿名区域发生页错误时，先要一整个 2 MiB 的页；没有空闲的对齐块，就悄悄退回 4 KiB 页帧。之后 khugepaged 把这样的区域合并成大页；当其中一部分需要改变时，内核再把它拆开。',
      },
      demo: {
        label: { en: 'One 2 MiB range, start to finish', zh: '一段 2 MiB 区域的经历' },
        steps: [
          {
            en: 'A program starts writing to a fresh anonymous region, aligned to 2 MiB. The first page fault asks for a whole 2 MiB page, but every 2 MiB span of physical memory has a used frame in it.',
            zh: '程序开始写一块新的、按 2 MiB 对齐的匿名区域。第一次页错误就想要一整个 2 MiB 的页，可物理内存里每个 2 MiB 区间都有已被占用的页帧。',
          },
          {
            en: 'So the kernel falls back to 4 KiB pages and says nothing. Each fault maps one free frame, wherever there is one, through an entry in a page table that the page-directory entry points to.',
            zh: '于是内核悄悄退回 4 KiB 的页。每次页错误映射一个空闲页帧，哪里有空就用哪里；映射记在一张页表里，由页目录项指向它。',
          },
          {
            en: 'Later, other memory is freed, and one aligned 2 MiB span becomes entirely free.',
            zh: '后来，别处的内存被释放，有一个对齐的 2 MiB 区间整个空了出来。',
          },
          {
            en: 'khugepaged, scanning address spaces in the background, finds this range of small pages and takes the free span for it. It copies each small page into its place in the span.',
            zh: 'khugepaged 在后台扫描各个地址空间，找到了这段由小页组成的区域，把那个空闲区间拿来给它用，并把每个小页复制到区间里对应的位置。',
          },
          {
            en: 'It points the page-directory entry straight at the span, with the PS bit set. The page table and the old 4 KiB frames are freed. One TLB entry now covers the whole 2 MiB.',
            zh: '它让页目录项直接指向这个区间，并置上 PS 位。那张页表和原来的 4 KiB 页帧都被释放。现在一个 TLB 项就覆盖了整整 2 MiB。',
          },
          {
            en: 'When part of the range must change, say half of it is made read-only, one entry cannot carry two sets of permission bits. The kernel splits the mapping back into a page table of 512 entries over the same memory.',
            zh: '当这段区域的一部分需要改变时，比如其中一半要改成只读，一个表项没法带两套权限位。内核就把映射拆回一张 512 项的页表，指向的还是同一块内存。',
          },
        ],
      },
    },
    bloat: {
      title: { en: 'Internal fragmentation, then bloat', zh: '内部碎片，然后是膨胀' },
      caption: {
        en: 'A 2 MiB page occupies 2 MiB however little of it is used. With max_ptes_none at its default of 511, khugepaged collapses a range in which only one of the 512 small pages is mapped, and the process’s resident memory can grow.',
        zh: '一个 2 MiB 的页，不管用了多少，都占着 2 MiB。max_ptes_none 取默认值 511 时，khugepaged 连 512 个小页里只映射了一个的区域也会合并，进程的常驻内存可能随之变大。',
      },
    },
    compaction: {
      title: { en: 'Compaction stalls', zh: '规整停顿' },
      caption: {
        en: 'After days of uptime, free memory is scattered in 4 KiB holes. To free an aligned 2 MiB span the kernel migrates the pages in the way. With defrag set to always, the thread whose fault asked waits for that work, sometimes for milliseconds.',
        zh: '机器运行几天之后，空闲内存散落在一个个 4 KiB 的空洞里。要腾出一个对齐的 2 MiB 区间，内核得把挡路的页迁走。defrag 设为 always 时，发出请求的那个线程就在页错误里等着这项工作做完，有时要等几毫秒。',
      },
    },
    cow: {
      title: { en: 'Copy-on-write, 2 MiB at a time', zh: '以 2 MiB 为单位的写时复制' },
      caption: {
        en: 'After fork(), parent and child share every page. The first write to a shared huge page, even of one byte, copies all 2 MiB. Redis’s parent keeps writing while its child saves a snapshot, a few thousand such copies.',
        zh: 'fork() 之后，父子进程共享所有页。对一个共享大页的第一次写，哪怕只写一个字节，也要复制整整 2 MiB。Redis 的父进程在子进程保存快照时继续写，这样的复制就有几千次。',
      },
    },
    base: {
      title: { en: 'Bigger base pages', zh: '更大的基础页' },
      caption: {
        en: 'Apple silicon and Android’s 16 KiB devices make every page four times bigger, so the same 1,536 entries would reach 24 MiB instead of 6. Every page pays a little internal fragmentation in return.',
        zh: 'Apple 芯片和 Android 的 16 KiB 设备把每个页都变大到四倍，同样的 1536 项就能覆盖 24 MiB，而不是 6 MiB。代价是每个页都多一点内部碎片。',
      },
    },
    three: {
      title: { en: 'Three ways to more reach', zh: '通往更大覆盖范围的三条路' },
      caption: {
        en: 'Reserve huge pages up front (hugetlbfs), let the kernel promote and split them behind the program’s back (THP), or make every page bigger. Each picks a size of unit, trading overhead per unit against waste inside it.',
        zh: '提前预留大页（hugetlbfs），让内核在程序背后提升和拆分（THP），或者把每个页都变大。三者都是在选单位的大小：每个单位的管理开销，对单位内部的浪费。',
      },
    },
  },
  terms: {
    thp: ['thpbox', 'khp'],
    'proc-sys': ['thpbox'],
    'page-walk': ['pml4', 'pdpt', 'pd', 'pt'],
    'multilevel-table': ['pml4', 'pdpt', 'pd', 'pt'],
    hugetlbfs: ['hugetlb'],
    'page-fault': ['thpbox'],
    khugepaged: ['khp'],
    madvise: ['thpbox'],
    compaction: ['phys'],
    'internal-fragmentation': ['phys'],
  },
}

export default scene
