import type { SceneDef } from './index'

/** The running figure of “fork() as a snapshot machine”. */
const scene: SceneDef = {
  height: 440,
  bands: {
    overview: [6, 366],
    literal: [30, 366],
    cow: [30, 236],
    ptcopy: [30, 236],
    pause: [30, 436],
    afterexit: [30, 236],
    snapshot: [30, 366],
    copies: [84, 366],
    model: [84, 436],
    promise: [84, 366],
    oom: [30, 366],
    huge: [84, 436],
    rules: [84, 366],
    road: [30, 300],
  },
  parts: {
    parent: [34, 78],
    child: [34, 78],
    clients: [38, 74],
    pt: [84, 234],
    frames: [84, 366],
    disk: [288, 364],
    meter: [292, 366],
    note: [376, 434],
    threads: [96, 296],
  },
  states: {
    overview: {
      title: { en: 'One call, two processes', zh: '调用一次，两个进程' },
      caption: {
        en: 'After fork(), the parent goes on serving clients and the child writes the data to disk. Both page tables point at the same physical pages; only a page the parent has since written (page 2 here) exists twice. Six pages are drawn; 24 GB is about 6.3 million.',
        zh: 'fork() 之后，父进程继续服务客户端，子进程把数据写到磁盘。两张页表指向同一批物理页，只有父进程后来写过的页（这里是第 2 页）才有两份。图中只画了 6 页；24 GB 大约是 630 万页。',
      },
    },
    literal: {
      title: { en: 'Taken literally', zh: '照字面理解' },
      caption: {
        en: 'Chapter 5 says the child gets its own copy of memory. Done literally, that means copying all 24 GB, which takes seconds and another 24 GB of RAM. The dashed parts are what Redis does not pay up front.',
        zh: '第 5 章说子进程有自己的一份内存。真要照字面做，就得复制整整 24 GB，耗时好几秒，还要再占 24 GB 内存。虚线部分就是 Redis 不用预先支付的东西。',
      },
    },
    cow: {
      title: { en: 'Shared, marked read-only', zh: '共享，并标记为只读' },
      caption: {
        en: 'Copy-on-write: the OS maps the same physical page into both address spaces and marks it read-only in both. While both sides only read, nothing is copied. The first write from either side traps into the OS, which copies that one page.',
        zh: '写时复制：操作系统把同一个物理页映射进两个地址空间，并在两边都标记为只读。只要双方都只读，就什么也不复制。任何一方第一次写入时陷入操作系统，由它复制这一页。',
      },
      demo: {
        label: { en: 'What one write does', zh: '一次写入做了什么' },
        steps: [
          {
            en: 'After fork(), one page of the dataset. The parent’s and the child’s page-table entries both point at the same physical frame, which holds x = 1. Both entries are marked read-only. Nobody is forbidden to write; the mark exists so that a write will stop and call the kernel.',
            zh: 'fork() 之后，数据集里的一页。父进程和子进程的页表项指向同一个物理页帧，里面是 x = 1。两个页表项都标记为只读。并不是谁不许写，这个标记的用处是：一有写入，就停下来叫内核。',
          },
          {
            en: 'A client sends SET, and the parent tries to write x = 2. The CPU reads the entry, finds it read-only, stops the write and raises a page fault: a trap into the kernel.',
            zh: '客户端发来 SET，父进程想写 x = 2。CPU 读到页表项是只读的，于是拦下这次写入，引发一次页错误，也就是陷入内核。',
          },
          {
            en: 'The kernel sees that this frame is mapped by two processes, so neither may change it in place. It allocates a free frame and copies all 4 KB into it.',
            zh: '内核发现这个页帧被两个进程映射着，谁都不能就地修改。于是它分配一个空闲页帧，把整整 4 KB 复制过去。',
          },
          {
            en: 'The kernel points the parent’s entry at the new frame and marks it writable. The parent’s write runs again and this time succeeds: its copy now holds x = 2.',
            zh: '内核让父进程的页表项指向新页帧，并标记为可写。父进程的写入重新执行，这次成功了：它的副本里现在是 x = 2。',
          },
          {
            en: 'The child’s entry was not touched. It still reads x = 1, the value at the instant of fork(). That is the snapshot: whatever the parent does, the child keeps the old frame.',
            zh: '子进程的页表项没有动过，它读到的仍是 x = 1，也就是 fork() 那一刻的值。这就是快照：不管父进程做什么，子进程都留着旧页帧。',
          },
          {
            en: 'The parent’s next write to this page finds a writable entry: no trap, no copy. The cost was paid once per page, and it is why a small update copies a whole 4 KB.',
            zh: '父进程再写这一页时，页表项已经可写：不陷入，也不复制。这笔代价每页只付一次；一次很小的更新也要复制整整 4 KB，原因也在这里。',
          },
        ],
      },
    },
    ptcopy: {
      title: { en: 'fork() copies page tables', zh: 'fork() 复制的是页表' },
      caption: {
        en: 'fork() on Linux does not copy your memory. It copies your page tables, and turns every writable private page into a read-only shared one. A page table holds an entry for every mapped page, so that is still real work.',
        zh: 'Linux 上的 fork() 并不复制你的内存。它复制的是页表，并把每一个可写的私有页都变成只读的共享页。页表要为每个已映射的页保存一个条目，所以这仍然是实打实的工作。',
      },
    },
    pause: {
      title: { en: 'The stop you can measure', zh: '测得出来的停顿' },
      caption: {
        en: 'Redis runs commands on one main thread, and that thread is inside fork(), so clients wait. 24 GB needs 48 MB of page tables; at about 10 ms per gigabyte, as on physical machines, that is roughly a quarter of a second. It scales with the address space, not with how much changes.',
        zh: 'Redis 在一个主线程上执行命令，而这个线程正卡在 fork() 里，客户端只能等。24 GB 需要 48 MB 的页表；按物理机上每 GB 约 10 ms 算，大约停顿四分之一秒。它随地址空间增长，与改动了多少数据无关。',
      },
    },
    afterexit: {
      title: { en: 'After the child exits', zh: '子进程退出之后' },
      caption: {
        en: 'fork write-protected the parent’s entries too, so the parent pays as well. When the child exits, its shared pages become exclusive, but the parent’s entries stay read-only. Each page’s next write still faults, now cheaply: the entry just flips back to writable.',
        zh: 'fork 把父进程的页表项也设成了写保护，所以父进程同样要付出代价。子进程退出后，共享页变成独占，但父进程的页表项仍是只读的。每一页的下一次写入照样触发页错误，只不过很便宜：把页表项改回可写就行。',
      },
    },
    snapshot: {
      title: { en: 'The child writes, the parent serves', zh: '子进程写盘，父进程服务' },
      caption: {
        en: 'An RDB snapshot goes to a temporary file, then an atomic rename() replaces dump.rdb, so the file only appears when complete. An AOF rewrite follows the same pattern. When the child exits, the parent collects its status with a non-blocking waitpid().',
        zh: 'RDB 快照先写进临时文件，再用一次原子的 rename() 替换 dump.rdb，所以这个文件只有写完才会出现。AOF 重写遵循同样的模式。子进程退出后，父进程用非阻塞的 waitpid() 收取它的状态。',
      },
    },
    copies: {
      title: { en: 'The copy you pay for later', zh: '迟早要付的拷贝' },
      caption: {
        en: 'Every page the parent writes while the child is alive exists twice: its copy (blue) and the old frame the child keeps. If the parent rewrites everything, memory use approaches double the dataset. What counts is how writes spread across pages, not how many keys change.',
        zh: '子进程存活期间，父进程写过的每一页都有两份：它的副本（蓝色）和子进程留着的旧页帧。如果父进程把所有数据都改写一遍，内存占用就逼近数据集的两倍。关键在于写操作如何分布在各页之间，而不是改了多少个键。',
      },
    },
    model: {
      title: { en: 'How much gets copied', zh: '会复制多少' },
      caption: {
        en: 'A crude model: if each write lands on a uniformly random page, the copied fraction is about 1 − e^(−n/N). With 4 KB pages, 3 million writes over 6.3 million pages copy about 38%, roughly 9 GB. Redis measures the real number instead and reports it in INFO.',
        zh: '一个粗略的模型：假设每次写入都均匀随机地落在某一页上，被复制的比例约为 1 − e^(−n/N)。使用 4 KB 页时，630 万页上的 300 万次写入约复制 38%，大约 9 GB。Redis 自己则直接测量真实数字，并在 INFO 里报告。',
      },
    },
    promise: {
      title: { en: 'Every shared page is a promise', zh: '每个共享页都是一份承诺' },
      caption: {
        en: 'If either side writes, a new physical page will be needed. A cautious kernel would refuse the fork unless it could back a second full copy. Linux’s default applies a heuristic, and Redis’s standing advice is to set vm.overcommit_memory to 1, “always overcommit”.',
        zh: '只要任何一方写入，就需要一个新的物理页。谨慎的内核会拒绝这次 fork，除非它能兜住再来一份完整拷贝的情况。Linux 的默认设置采用一种启发式规则，而 Redis 一贯的建议是把 vm.overcommit_memory 设为 1，即“总是允许超量分配”。',
      },
    },
    oom: {
      title: { en: 'When the promises come due', zh: '承诺到期的时候' },
      caption: {
        en: 'If the copies outrun physical memory, the fork that caused them returned long ago and cannot fail. The OOM killer picks a process to end. With oom-score-adj enabled, Redis makes the child the preferred victim: 800 against the primary’s 0. Losing a snapshot is better than losing the server.',
        zh: '如果拷贝超出了物理内存，引发它们的 fork 早已返回，也就没法让它失败了。OOM killer 会挑一个进程杀掉。启用 oom-score-adj 后，Redis 让子进程成为首选的牺牲品：800 对主节点的 0。丢掉一次快照，总比丢掉服务器强。',
      },
    },
    huge: {
      title: { en: 'One write, 2 MB', zh: '写一次，复制 2 MB' },
      caption: {
        en: 'Here the six cells are one 2 MB huge page. Until 2020 the first write to a shared anonymous huge page copied all of it, 512 times a 4 KB copy. Since Linux 5.8 the mapping is split and only the 4 KB touched is copied, though the split costs work. Redis ships with disable-thp yes.',
        zh: '这里的六格是同一个 2 MB 大页。直到 2020 年，对共享匿名大页的第一次写入都会把它整个复制一遍，是 4 KB 拷贝的 512 倍。从 Linux 5.8 起，映射会被拆分，只复制被写到的那 4 KB，只是拆分本身有开销。Redis 现在默认带着 disable-thp yes。',
      },
    },
    rules: {
      title: { en: 'Redis fights its own copying', zh: 'Redis 对抗自己的拷贝' },
      caption: {
        en: 'While a child is alive, the parent skips access-time updates and avoids resizing hash tables, because either would write to pages. The child drops the client and replication buffers with madvise(MADV_DONTNEED); the parent’s next write to such a page finds it exclusive and reuses it without copying.',
        zh: '子进程存活期间，父进程不更新访问时间，也避免调整哈希表大小，因为这两件事都会写页面。子进程用 madvise(MADV_DONTNEED) 丢掉客户端缓冲区和复制缓冲区；父进程下一次写这样的页时，发现它已是独占，无需复制就能直接复用。',
      },
    },
    road: {
      title: { en: 'A fork() in the road', zh: '岔路口的 fork()' },
      caption: {
        en: 'The child gets the whole address space but only the thread that called fork(). If another thread held a lock, the child inherits it locked, with nobody to unlock it. The HotOS 2019 paper’s advice is to stop using fork to start programs, but it counts consistent snapshots as a real use of copy-on-write.',
        zh: '子进程得到整个地址空间，却只有调用 fork() 的那一个线程。如果另一个线程当时持有一把锁，子进程就继承了一把锁着的锁，却没有人来解锁。HotOS 2019 那篇论文建议别再用 fork 启动程序，但它承认一致性快照是写时复制的正当用途。',
      },
    },
  },
  terms: {
    redis: ['parent'],
    page: ['frames'],
    'copy-on-write': ['frames', 'pt'],
    'address-space': ['pt'],
    'page-table': ['pt'],
    pte: ['pt'],
    trap: ['pt'],
    'page-fault': ['pt'],
    thread: ['parent'],
    lock: ['threads'],
    'oom-kill': ['child'],
    thp: ['frames'],
    'huge-page': ['frames'],
    madvise: ['frames'],
    zombie: ['child'],
  },
}

export default scene
