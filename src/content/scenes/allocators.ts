import type { SceneDef } from './index'

/** The running figure of “What malloc really is today”. */
const scene: SceneDef = {
  height: 420,
  bands: {
    overview: [8, 384],
    book: [8, 392],
    common: [8, 380],
    glibc: [6, 398],
    jemalloc: [58, 388],
    tcmalloc: [58, 398],
    mimalloc: [8, 390],
    kernel: [8, 396],
    months: [130, 390],
    defrag: [130, 380],
  },
  parts: {
    threads: [12, 46],
    caches: [60, 110],
    contend: [40, 132],
    shared: [124, 266],
    runs: [124, 266],
    arenas: [124, 266],
    jarenas: [124, 266],
    tcm: [124, 266],
    mpage: [40, 266],
    mmap: [6, 312],
    kernel: [274, 314],
    buddy: [274, 314],
    slub: [60, 200],
    pagemap: [320, 398],
    rssbars: [320, 390],
  },
  states: {
    overview: {
      title: { en: 'One malloc, three layers', zh: '一个 malloc，三层' },
      caption: {
        en: 'Threads call malloc. A cache private to a thread or a CPU answers most calls without a lock; a slower shared layer refills it and gets memory from the OS. In glibc the shared layer is a set of arenas, up to eight per core: the pools Heroku limited to two.',
        zh: '线程调用 malloc。线程或 CPU 私有的缓存不加锁就能应付大多数调用；较慢的共享层为它补货，并向操作系统要内存。glibc 的共享层是一组 arena，每个核心最多八个，也就是 Heroku 限制成两个的那些内存池。',
      },
    },
    book: {
      title: { en: 'One list, one lock', zh: '一个列表，一把锁' },
      caption: {
        en: 'Chapter 17’s allocator: one free list through the free chunks, searched with best or first fit, coalescing neighbours on free. Real allocators need more: a common case of a few instructions, no single lock for 64 threads, and a way to give memory back in servers that run for months.',
        zh: '第 17 章的分配程序：一个穿过空闲块的空闲列表，用最优匹配或首次匹配查找，释放时与邻居合并。真实的分配器还要更多：常见情况只需寥寥几条指令，64 个线程不能挤一把锁，一跑几个月的服务器还得把内存还回去。',
      },
    },
    common: {
      title: { en: 'Size classes and caches', zh: '尺寸类别与缓存' },
      caption: {
        en: 'Each small request is rounded up to one of a few dozen sizes, and each run of memory holds objects of one size, so allocating is a pop or a bitmap scan. In front sits a cache private to a thread or a CPU, refilled and drained in batches, so most calls take no lock.',
        zh: '每个小请求向上取整到几十种尺寸之一，每个内存区块只装一种大小的对象，分配就是弹出一个元素或扫一下位图。最前面是线程或 CPU 私有的缓存，成批补货、成批退回，于是大多数调用不必加锁。',
      },
    },
    glibc: {
      title: { en: 'glibc: arenas, bins, tcache', zh: 'glibc：arena、桶、tcache' },
      caption: {
        en: 'The closest of the four to the book: chunks with size headers, free lists in 128 bins. Each arena is a heap with its own lock, and memory freed in one cannot serve a request in another. The tcache holds up to seven free chunks per small size; requests above the mmap threshold, 128 KiB by default, skip the bins.',
        zh: '四者中最接近书中设计的一个：带大小头部的块，分放在 128 个桶里的空闲列表。每个 arena 是一个有自己的锁的堆，一个 arena 里释放的内存满足不了另一个 arena 的请求。tcache 每种小尺寸最多存七个空闲块；超过 mmap 阈值（默认 128 KiB）的请求完全绕开这些桶。',
      },
      demo: {
        label: { en: 'One call to malloc', zh: '一次 malloc 调用' },
        steps: [
          {
            en: 'malloc(100). glibc adds the header and rounds up to a multiple of 16, so it needs a 112-byte chunk. Everything below is a search for a free chunk of that size, cheapest place first. The other chunk sizes in the drawing are invented for the example.',
            zh: 'malloc(100)。glibc 加上头部，再取整到 16 的倍数，于是需要一个 112 字节的块。下面的一切都是在找这样一个空闲块，最便宜的地方先找。图里其他块的大小是为这个例子编的。',
          },
          {
            en: 'First this thread’s tcache, which needs no lock because no other thread touches it. If the 112-byte list had a chunk, malloc would pop it and return, and most calls stop here. In this walk the list is empty.',
            zh: '先看本线程的 tcache。别的线程碰不到它，所以不用加锁。如果 112 字节的列表里有块，malloc 弹出一个就返回，大多数调用到这里就结束了。这一次它恰好是空的。',
          },
          {
            en: 'Now the arena, a heap shared with other threads, so its lock must be taken. Its small bin for exactly 112 bytes is empty too.',
            zh: '接下来是 arena。它是与其他线程共享的堆，所以要先拿到它的锁。112 字节的那个小桶同样是空的。',
          },
          {
            en: 'The unsorted bin holds recently freed chunks that have not been filed yet. malloc walks it: an exact fit would be taken at once, and the others are sorted into their bins, here 64 and 48 into small bins and 1,504 into a large bin.',
            zh: '未排序桶里是最近释放、还没归档的块。malloc 走一遍：精确匹配的会被立刻拿走，其余的归入各自的桶，这里 64 和 48 进了小桶，1504 进了大桶。',
          },
          {
            en: 'Next the smallest chunk that is big enough, split in two: 112 bytes for this request, and the rest stays free. This and the walk before it are chapter 17 almost word for word.',
            zh: '接下来找够用的最小的块，一分为二：112 字节给这个请求，余下的继续空闲。这一步和上一步几乎就是第 17 章原文。',
          },
          {
            en: 'Had nothing fitted, malloc would carve from the arena’s top chunk and grow it with brk or mmap. Not needed here. On the way out it tops up the tcache from the bins, unlocks the arena and returns the chunk’s data area.',
            zh: '要是什么都不合适，malloc 就从 arena 的顶端块切，并用 brk 或 mmap 扩展它。这次用不上。离开前它从桶里顺手补满 tcache，解开 arena 的锁，把块的数据区返回给程序。',
          },
        ],
      },
    },
    jemalloc: {
      title: { en: 'jemalloc: classes and slabs', zh: 'jemalloc：类别与 slab' },
      caption: {
        en: 'Four size classes per doubling. Small objects go into slabs of one class, each with a bitmap of its used slots, and by default there are four arenas per CPU with a per-thread cache in front. Freed pages are marked dirty and purged gradually, by default over about 10 seconds.',
        zh: '每翻一倍四档尺寸类别。小对象装进同一类别的 slab，每个 slab 用一张位图记录哪些槽位在用；默认每个 CPU 四个 arena，前面再放每线程缓存。释放的页先标为脏页，再逐步清退，默认在约 10 秒内衰减。',
      },
    },
    tcmalloc: {
      title: { en: 'TCMalloc: three tiers', zh: 'TCMalloc：三层' },
      caption: {
        en: 'The front end is by default a cache per CPU, updated without locks through Linux’s restartable sequences. The middle end moves memory between CPUs and carves objects out of spans. The back end packs spans into as few 2 MiB huge pages as it can. On free, a radix tree finds a pointer’s span.',
        zh: '前端默认每个 CPU 一份缓存，借助 Linux 的可重启序列，更新时不用锁。中端让内存在 CPU 之间流动，并从 span 里切出对象。后端把 span 尽量塞进少数几个 2 MiB 大页。free 时，一棵基数树查出指针所属的 span。',
      },
    },
    mimalloc: {
      title: { en: 'mimalloc: three free lists', zh: 'mimalloc：三个空闲列表' },
      caption: {
        en: 'Every page has its own free lists, split by who touches them. malloc pops from free, which only the owning thread touches. The owner’s frees go to local_free; other threads’ frees go to xthread_free with one atomic compare-and-swap.',
        zh: '每一页都有自己的空闲列表，按“谁在碰”拆开。malloc 从只有所属线程碰的 free 里弹出；所属线程释放的块进 local_free；其他线程释放的块用一次原子的比较并交换进 xthread_free。',
      },
    },
    kernel: {
      title: { en: 'In the kernel: SLUB and buddy', zh: '内核里：SLUB 与伙伴系统' },
      caption: {
        en: 'The same two layers. Small objects come from SLUB’s caches, such as inode and kmalloc-64. Physical pages come from the buddy allocator, in blocks of 1, 2, 4, … contiguous pages, with per-CPU lists of free pages in front, refilled and drained in batches.',
        zh: '同样的两层。小对象来自 SLUB 的缓存，比如 inode、kmalloc-64；物理页来自伙伴分配器，按 1、2、4……个连续页成块；最前面还有每 CPU 的空闲页列表，成批补充和退回。',
      },
    },
    months: {
      title: { en: 'Fragmentation over months', zh: '以月计的碎片' },
      caption: {
        en: 'A page with even one live object cannot go back to the kernel. Redis’s documentation gives the numbers: write 5 GB, delete 2 GB, and the process’s resident size probably stays about 5 GB while Redis reports about 3 GB in use.',
        zh: '一页上哪怕只有一个活对象，也还不回内核。Redis 文档给出的例子：写入 5 GB，删掉 2 GB，进程的常驻集大小多半还在 5 GB 左右，而 Redis 报告的使用量只有 3 GB 左右。',
      },
    },
    defrag: {
      title: { en: 'Compaction by the program', zh: '由程序来紧凑' },
      caption: {
        en: 'malloc cannot move an object the program holds pointers to, but the program can. Redis’s active defragmentation copies a value out of a poorly used region and updates its own pointer. Drawn simplified: once its live objects have moved, a page can be returned.',
        zh: 'malloc 移动不了程序持有指针的对象，但程序自己可以。Redis 的主动碎片整理把值从利用率低的区域复制出去，再更新自己的指针。图是简化的：活对象搬走之后，这一页就能归还了。',
      },
    },
  },
  terms: {
    glibc: ['shared'],
    thread: ['threads'],
    lock: ['contend'],
    'oom-kill': ['kernel'],
    bitmap: ['runs'],
    mmap: ['mmap', 'kernel'],
    jemalloc: ['jarenas'],
    tcmalloc: ['tcm'],
    'radix-tree': ['pagemap'],
    'multilevel-table': ['pagemap'],
    inode: ['slub'],
    dentry: ['slub'],
    procfs: ['slub'],
    'memory-zone': ['buddy'],
    redis: ['rssbars'],
    rss: ['rssbars'],
  },
}

export default scene
