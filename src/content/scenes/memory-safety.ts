import type { SceneDef } from './index'

/** The running figure of “Seventy percent: chapter 14’s bugs at industrial scale”. */
const scene: SceneDef = {
  height: 356,
  bands: {
    overview: [4, 336],
    families: [4, 190],
    padding: [4, 190],
    reuse: [4, 272],
    memcheck: [0, 160],
    asan: [94, 272],
    msan: [94, 200],
    harden: [4, 272],
    rust: [4, 190],
    android: [4, 160],
    bends: [4, 352],
    levels: [94, 352],
  },
  parts: {
    program: [8, 54],
    unsafe: [26, 52],
    gate: [58, 86],
    heap: [88, 156],
    objA: [100, 150],
    objB: [100, 150],
    objC: [100, 150],
    shadow: [158, 198],
    alloc: [204, 270],
    freelist: [226, 262],
    quarantine: [226, 262],
    miracle: [26, 196],
    mte: [26, 196],
    os: [282, 332],
  },
  states: {
    overview: {
      title: { en: 'Pointers into the heap', zh: '指向堆的指针' },
      caption: {
        en: 'A C or C++ program reaches its objects through pointers; the allocator, malloc and free, carves the objects out of pages the OS gave the process. About 70% of the serious security bugs counted at Microsoft and in Chromium were memory-safety bugs: mistakes in how a program uses these pointers and objects.',
        zh: 'C 或 C++ 程序通过指针访问自己的对象；分配器（malloc 和 free）从操作系统交给进程的页里切出这些对象。微软和 Chromium 统计的严重安全漏洞里，约七成是内存安全漏洞：错就出在这些指针和对象之间。',
      },
    },
    families: {
      title: { en: 'The book’s list, sorted', zh: '书里的清单，重新归类' },
      caption: {
        en: 'p writes past its 5-byte block (spatial); s still points at a freed block (temporal); c reads what the block’s previous owner left (uninitialized); q was never set (wild). The leaked block on the right, which nothing points to, is the one item not in the security counts.',
        zh: 'p 写过了自己 5 字节的块（空间错误）；s 仍指向一个已释放的块（时间错误）；c 读到了这块内存上一任主人留下的东西（未初始化）；q 从未赋值（野指针）。右边那个没有任何指针指向的泄露块，是唯一不在安全统计里的一项。',
      },
    },
    padding: {
      title: { en: 'Runs seemingly correctly', zh: '看起来运行正常' },
      caption: {
        en: 'In testing, the byte p writes past its block lands in the allocator’s padding and nothing happens. Someone who controls the input and the heap layout can make the same write land on something that matters.',
        zh: '测试时，p 多写的那个字节落在分配器的填充区里，什么事也没有。而能控制输入和堆布局的人，可以让同一次写入落在要紧的东西上。',
      },
    },
    reuse: {
      title: { en: 'Freed memory comes back fast', zh: '释放的内存很快就被重用' },
      caption: {
        en: 'After free(s), glibc’s tcache keeps the chunk on a last-in, first-out list for its size, so the next malloc of that size gets the same chunk back. msg now lives where the session was, and the stale pointer s reads msg’s bytes as if they were a session.',
        zh: 'free(s) 之后，glibc 的 tcache 把这块放进该大小类的后进先出链表，下一次同样大小的 malloc 就拿回同一块。msg 住进了 session 原来的位置，而过期的指针 s 把 msg 的字节当成 session 来读。',
      },
    },
    memcheck: {
      title: { en: 'Every byte, slowly', zh: '逐字节检查，但很慢' },
      caption: {
        en: 'Valgrind’s Memcheck runs the unchanged program on a synthetic CPU and tracks every byte it touches. That makes it easy to adopt, and slow: the manual warns of 20 to 30 times.',
        zh: 'Valgrind 的 Memcheck 让原封不动的程序跑在一颗合成的 CPU 上，追踪它碰到的每一个字节。所以上手容易，但慢：手册提醒会慢 20 到 30 倍。',
      },
    },
    asan: {
      title: { en: 'AddressSanitizer', zh: 'AddressSanitizer' },
      caption: {
        en: 'The compiler adds a check before every load and store. One shadow byte describes each 8 bytes of heap: 0 means all addressable, 5 only the first five, negative none. Redzones surround each block and a freed block waits in quarantine, so an overflow and a use after free both fail the check.',
        zh: '编译器在每次读写之前插入一道检查。每 8 个字节的堆对应 1 个影子字节：0 表示全部可访问，5 表示只有前 5 个，负数表示一个都不行。每个块周围有红区，释放的块先进隔离区，于是溢出和释放后使用都过不了检查。',
      },
      demo: {
        label: { en: 'How ASan checks one access', zh: 'ASan 怎么检查一次访问' },
        steps: [
          {
            en: 'malloc(13) returns a block of 13 bytes, offsets 0 to 12. ASan’s allocator puts poisoned redzones on both sides, so whatever lies just past the block is never another live object.',
            zh: 'malloc(13) 返回一个 13 字节的块，偏移 0 到 12。ASan 的分配器在它两侧放上带毒的红区，所以紧挨着块的地方绝不会是另一个活着的对象。',
          },
          {
            en: 'Each 8-byte group of memory has one shadow byte saying how many of its bytes may be touched: 0 for the first group (all 8), 5 for the second (offsets 8 to 12), negative for the redzones.',
            zh: '内存每 8 个字节为一组，各有 1 个影子字节，记录这一组里有几个字节可以访问：第一组是 0（8 个全可以），第二组是 5（偏移 8 到 12），红区是负数。',
          },
          {
            en: 'Before every access the compiler inserted a check. A read at offset 2 finds shadow 0 and goes ahead: one load, one compare, one branch that is almost always predicted right. Most accesses look like this.',
            zh: '编译器在每次访问之前都插入了检查。在偏移 2 处读，查到影子值 0，直接放行：一次读、一次比较、一个几乎总能预测正确的分支。绝大多数访问都是这样。',
          },
          {
            en: 'A 1-byte read at offset 12: shadow 5. The byte is at position 4 in its group, and 4 + 1 − 1 = 4 is less than 5, so it passes.',
            zh: '在偏移 12 处读 1 个字节：影子值是 5。这个字节在组内的位置是 4，4 + 1 − 1 = 4，小于 5，通过。',
          },
          {
            en: 'A 1-byte read at offset 13, one past the end: position 5, and 5 is not less than 5. The check fails, and ASan stops the program with a heap-buffer-overflow report.',
            zh: '在偏移 13 处读 1 个字节，刚好越过末尾：位置是 5，5 不小于 5。检查失败，ASan 以 heap-buffer-overflow 报告让程序停下。',
          },
          {
            en: 'free() poisons the whole block, so both of its shadow bytes become negative, and puts it in quarantine instead of handing it to the next malloc.',
            zh: 'free() 给整块下毒，两个影子字节都变成负数；块被放进隔离区，而不是交给下一次 malloc。',
          },
          {
            en: 'A read through the old pointer now finds a negative shadow byte. The use after free is reported at the access itself, because the memory has not been handed to anyone else yet.',
            zh: '再通过旧指针去读，查到的是负的影子字节。释放后使用在访问发生的那一刻就被报告出来，因为这块内存还没有交给别人。',
          },
        ],
      },
    },
    msan: {
      title: { en: 'Uninitialized reads', zh: '未初始化读取' },
      caption: {
        en: 'MemorySanitizer keeps one shadow bit per bit of memory, marking what was never written. It reports only when such a value decides a branch, an address or a system call, and every library in the process must be built with it.',
        zh: 'MemorySanitizer 为内存的每一位维护一个影子位，标出从未写过的部分。只有当这样的值影响到分支、地址或系统调用时它才报告；进程里的每个库也都必须用它编译。',
      },
    },
    harden: {
      title: { en: 'Harder to exploit', zh: '让漏洞更难利用' },
      caption: {
        en: 'The tcache marks each freed chunk, so freeing it twice usually aborts, and Scudo puts a checksum in every chunk header. MiraclePtr poisons and quarantines a block that a raw_ptr still points to, and MTE re-tags a freed block so the old pointer’s tag no longer matches.',
        zh: 'tcache 给每个释放的块打标记，释放两次通常直接中止；Scudo 在每个块头里放校验和。MiraclePtr 把仍有 raw_ptr 指向的块下毒并隔离；MTE 给释放的块重新打标签，旧指针的标签就对不上了。',
      },
    },
    rust: {
      title: { en: 'The language checks', zh: '由语言来检查' },
      caption: {
        en: 'Rust’s compiler tracks who owns each value and how long each reference to it may live, so using s after its value is dropped does not compile. An index out of range is caught at run time and stops the thread instead of touching the neighbour.',
        zh: 'Rust 编译器追踪每个值归谁所有、指向它的每个引用能活多久，所以在值被 drop 之后还用 s，根本编译不过。越界索引在运行时被抓住，线程停下，而不会碰到相邻的内存。',
      },
    },
    android: {
      title: { en: 'Old C++, new Rust', zh: '老代码 C++，新代码 Rust' },
      caption: {
        en: 'Android kept its C and C++ and wrote new native code in memory-safe languages, Rust among them. The memory-safety share of its vulnerabilities fell from 76% in 2019 to below 20% in 2025. Unsafe Rust is still code that has to be trusted.',
        zh: 'Android 保留了已有的 C 和 C++，新的原生代码改用包括 Rust 在内的内存安全语言写。内存安全漏洞在其漏洞中的占比，从 2019 年的 76% 降到 2025 年的不足 20%。unsafe 的 Rust 仍然是必须被信任的代码。',
      },
    },
    bends: {
      title: { en: 'Where each response stops', zh: '每种对策止步之处' },
      caption: {
        en: 'Sanitizers see only the paths that tests and fuzzers run. Hardening is probabilistic. Safe code still sits on C: the kernel, the C library, and every unsafe block or foreign-function call.',
        zh: '消毒器只看得到测试和模糊测试跑到的路径；加固是概率性的；安全的代码仍然坐在 C 之上：内核、C 库，以及每一个 unsafe 块和外部函数调用。',
      },
    },
    levels: {
      title: { en: 'Two levels, one checked', zh: '两层管理，只有一层有检查' },
      caption: {
        en: 'The OS level is safe because the hardware checks every access against the process’s page table, page by page. Nothing checks an access against one object’s bounds; every response in this article pushes a check down to that finer grain.',
        zh: '操作系统那一层是安全的，因为硬件按页拿每一次访问去对照进程的页表。没有任何东西拿访问去对照单个对象的边界；本文的每一种对策，都是想把检查推到这个更细的粒度上。',
      },
    },
  },
  terms: {
    'memory-safety': ['heap', 'objA', 'objB', 'objC'],
    'use-after-free': ['objA', 'program'],
    vtable: ['objA'],
    tcache: ['freelist'],
    glibc: ['alloc'],
    jemalloc: ['alloc'],
    'native-code': ['program'],
    'reference-count': ['miracle'],
    ffi: ['unsafe'],
    'page-table': ['os'],
  },
}

export default scene
