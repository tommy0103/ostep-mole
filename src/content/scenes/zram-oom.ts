import type { SceneDef } from './index'

/** The running figure of “Swapping today: compress first, measure the stall, kill last”. */
const scene: SceneDef = {
  height: 440,
  bands: {
    overview: [4, 374],
    book: [74, 400],
    'two-kinds': [154, 392],
    zram: [154, 404],
    zswap: [154, 392],
    slowpath: [154, 392],
    oom: [4, 414],
    livelock: [76, 316],
    psi: [90, 438],
    trigger: [4, 438],
    oomd: [4, 392],
    lmkd: [4, 392],
    bends: [88, 364],
  },
  parts: {
    apps: [6, 64],
    cgroups: [10, 76],
    daemon: [14, 64],
    kernel: [76, 152],
    kswapd: [94, 144],
    psi: [94, 144],
    oomk: [94, 144],
    ram: [156, 206],
    wm: [156, 236],
    fs: [260, 310],
    disk: [260, 310],
    zram: [200, 310],
    evict: [200, 262],
    fault: [200, 262],
    drop: [200, 262],
    tozram: [200, 262],
    zswap: [200, 262],
    kill: [58, 100],
    watch: [58, 100],
    dkill: [14, 64],
  },
  states: {
    overview: {
      title: { en: 'Memory under pressure, today', zh: '今天的内存压力' },
      caption: {
        en: 'Evicted anonymous pages are compressed into RAM by zram instead of going to a disk. The kernel measures how long tasks stall waiting for memory (PSI), and a daemon in user space can kill an app before the kernel’s OOM killer has to.',
        zh: '被淘汰的匿名页由 zram 压缩后留在内存里，而不是写到磁盘。内核度量任务因等内存而停滞了多久（PSI），用户态的守护进程可以赶在内核的 OOM killer 不得不出手之前杀掉一个应用。',
      },
    },
    book: {
      title: { en: 'The book’s machinery', zh: '书中的机制' },
      caption: {
        en: 'When free memory drops below the low watermark, kswapd evicts pages until it reaches the high one. An evicted anonymous page goes to swap on disk, and touching it again faults and reads it back: 10 ms, against 100 ns for memory, in the lab’s figures.',
        zh: '空闲内存跌破低水位线时，kswapd 开始淘汰页，直到回到高水位线。被淘汰的匿名页去了磁盘上的交换空间，再访问它就会缺页、把它读回来：按实验里的数字，要 10 ms，而访问内存只要 100 ns。',
      },
    },
    'two-kinds': {
      title: { en: 'Why swap at all', zh: '为什么还要交换' },
      caption: {
        en: 'A clean file page can be dropped and read back from its file. An anonymous page has no file behind it: without swap it can never leave memory, and all reclaim falls on file pages.',
        zh: '干净的文件页可以直接丢掉，需要时再从文件读回来。匿名页背后没有文件：没有交换，它就永远离不开内存，所有回收压力都落到文件页上。',
      },
    },
    zram: {
      title: { en: 'A swap device made of RAM', zh: '用内存做成的交换设备' },
      caption: {
        en: 'To the kernel, /dev/zram0 is just another block device. What is written to it is compressed into a pool of RAM (purple), so at the expected 2:1, 4 GiB of swapped-out pages take about 2 GiB.',
        zh: '在内核眼里，/dev/zram0 只是又一个块设备。写给它的东西被压缩后存进一块内存池（紫色），所以按预期的 2:1，换出的 4 GiB 页大约占 2 GiB 内存。',
      },
      demo: {
        label: { en: 'A page’s round trip through zram', zh: '一页在 zram 里的来回' },
        steps: [
          {
            en: 'An idle anonymous page sits in frame 5. Memory is short, and kswapd picks it as a victim. With no file behind it, swap is the only place it can go.',
            zh: '一个闲置的匿名页待在第 5 帧。内存紧张，kswapd 挑中它作为牺牲页。它背后没有文件，只能去交换空间。',
          },
          {
            en: 'The swap code writes the 4 KiB page to /dev/zram0, exactly as it would write to a disk. The PTE is marked not present and now holds the page’s swap location.',
            zh: '交换代码把这 4 KiB 的页写给 /dev/zram0，和写磁盘一模一样。PTE 被标记为不在内存，转而存着这一页的交换位置。',
          },
          {
            en: 'zram compresses the page and stores it in memory it allocates as needed: at the expected 2:1, about 2 KiB. A page of one repeated value, typically zeros, is recorded as just that value, and no memory is allocated for it.',
            zh: 'zram 压缩这一页，存进按需分配的内存里：按预期的 2:1，约 2 KiB。整页都是同一个重复值（通常是 0）的页，只记下这个值，不为它分配内存。',
          },
          {
            en: 'Frame 5 is free again: a 4 KiB frame traded for about 2 KiB of pool.',
            zh: '第 5 帧又空出来了：用约 2 KiB 的池空间换回一个 4 KiB 的帧。',
          },
          {
            en: 'Later the program touches the page. The PTE says not present, so the CPU raises a page fault, and the kernel reads the page back from the swap device: for zram, a decompression into a free frame. No disk is involved.',
            zh: '后来程序访问这一页。PTE 显示它不在内存，于是 CPU 触发缺页，内核从交换设备把它读回来：对 zram 来说，就是解压到一个空闲帧里，不涉及任何磁盘。',
          },
          {
            en: 'The PTE is fixed to point at the new frame and the access is retried. The round trip cost a compression and a decompression on the CPU, not two disk I/Os of milliseconds each.',
            zh: 'PTE 被改为指向新的帧，再重试这次访问。这一个来回花掉的是 CPU 上的一次压缩和一次解压，而不是两次以毫秒计的磁盘 I/O。',
          },
        ],
      },
    },
    zswap: {
      title: { en: 'zswap: a cache before the disk', zh: 'zswap：磁盘前的缓存' },
      caption: {
        en: 'zswap compresses a page on its way to the swap device into a pool in RAM, and the write never happens. When the pool is full, its oldest entries go out to the real device.',
        zh: 'zswap 把正要写往交换设备的页压缩进内存里的一个池子，那次写就不会发生。池子满了，最老的条目才被写到真正的设备上。',
      },
    },
    slowpath: {
      title: { en: 'The slow path, faster', zh: '变快的慢路径' },
      caption: {
        en: 'On the fault path, the two swap I/Os dwarf every other step: 10 ms each from disk, in the lab. With zram they become a compression and a decompression on the CPU, which Fedora puts at least an order of magnitude faster.',
        zh: '在缺页路径上，两次交换 I/O 让其他步骤都显得微不足道：实验里从磁盘各算 10 ms。换成 zram，它们变成 CPU 上的一次压缩和一次解压，Fedora 说至少快一个数量级。',
      },
    },
    oom: {
      title: { en: 'The kernel’s OOM killer', zh: '内核的 OOM killer' },
      caption: {
        en: 'When reclaim has failed, the kernel kills the task with the highest badness: its resident pages, swapped-out pages and page tables, plus oom_score_adj. Size is all it sees; importance comes only from the adjustment.',
        zh: '回收失败之后，内核杀掉劣度最高的任务：它的驻留页、已换出的页和页表，再加上 oom_score_adj。它只看得到大小；重要性只能通过这个调整值进来。',
      },
    },
    livelock: {
      title: { en: 'Too late: livelock', zh: '出手太晚：活锁' },
      caption: {
        en: 'Reclaim keeps almost succeeding: each pass frees a few pages, which are faulted straight back. The machine is not out of memory, so the OOM killer waits, but no useful work gets done. This is thrashing.',
        zh: '回收一直“差一点就成功”：每一轮都释放出几页，又马上被缺页换回来。机器并没有耗尽内存，所以 OOM killer 按兵不动，可也没有在干有用的活。这就是抖动。',
      },
    },
    psi: {
      title: { en: 'Measuring the stall: PSI', zh: '度量停滞：PSI' },
      caption: {
        en: 'PSI measures time, not free pages. some is the share of time in which at least one task waits for memory; full is the share in which all non-idle tasks wait at once. The kernel documentation says a workload that stays there is considered to be thrashing.',
        zh: 'PSI 度量的是时间，而不是空闲页。some 是至少有一个任务在等内存的时间占比；full 是所有非空闲任务同时在等的时间占比。内核文档说，长时间处于这种状态的负载被认为在抖动。',
      },
    },
    trigger: {
      title: { en: 'Woken by a threshold', zh: '越过阈值就唤醒' },
      caption: {
        en: 'A program writes a threshold and a window to the pressure file, such as 150 ms of some stall in any 1 s, and poll() wakes it when that is crossed. Android’s lmkd registers triggers of this form.',
        zh: '程序把阈值和时间窗口写进压力文件，比如“任意 1 秒内 some 停滞 150 毫秒”，越过阈值时 poll() 就会把它唤醒。Android 的 lmkd 注册的正是这种触发器。',
      },
    },
    oomd: {
      title: { en: 'systemd-oomd: a cgroup at a time', zh: 'systemd-oomd：一次一个 cgroup' },
      caption: {
        en: 'systemd-oomd watches the cgroups that opt in. By default it acts when one’s full memory pressure stays over 60% for 30 s, or when memory and swap are both over 90% used, and it sends SIGKILL to every process in the chosen cgroup.',
        zh: 'systemd-oomd 监视主动加入的 cgroup。默认情况下，某个 cgroup 的 full 内存压力持续 30 秒高于 60%，或内存和交换的使用率都超过 90% 时，它就出手，向选中 cgroup 里的每个进程发送 SIGKILL。',
      },
    },
    lmkd: {
      title: { en: 'Android: kill by importance', zh: 'Android：按重要性杀' },
      caption: {
        en: 'The activity manager keeps each app’s oom_score_adj current with what the user can see. lmkd kills from the highest value down: cached apps first, and the foreground app only under critical pressure.',
        zh: '活动管理器根据用户能看到什么，随时更新每个应用的 oom_score_adj。lmkd 从值最高的往下杀：先杀缓存的应用，只有临界压力才会杀到前台应用。',
      },
    },
    bends: {
      title: { en: 'Where it bends', zh: '理想在哪里弯折' },
      caption: {
        en: 'Compression costs CPU on every swap-out and swap-in, the pool competes for the RAM it saves, and data that does not compress gains nothing. The kernel’s killer still chooses by size alone.',
        zh: '每次换出、换入都要花 CPU 压缩和解压；池子和它省下的内存相互竞争；压不小的数据什么也得不到。内核的杀手仍然只按大小来选。',
      },
    },
  },
  terms: {
    zram: ['zram'],
    'block-device': ['zram'],
    'anonymous-memory': ['ram'],
    'page-cache': ['ram'],
    reclaim: ['kswapd', 'ram'],
    daemon: ['daemon'],
    lmkd: ['daemon'],
    systemd: ['daemon'],
    'oom-kill': ['oomk'],
    ssd: ['disk'],
    zswap: ['zswap'],
    thrashing: ['psi'],
    livelock: ['kswapd', 'ram'],
    cgroup: ['cgroups'],
    poll: ['watch'],
    sigkill: ['dkill'],
  },
}

export default scene
