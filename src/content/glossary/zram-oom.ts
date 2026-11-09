import type { Term } from './index'

/** Terms of “Swapping today: compress first, measure the stall, kill last”. */
const terms: Record<string, Term> = {
  zram: {
    title: { en: 'zram', zh: 'zram' },
    body: {
      en: 'A Linux [[block-device|block device]] that compresses whatever is written to it and keeps it in RAM. Used as a swap device, it turns swapping out into compressing a page and swapping in into decompressing it, with no disk involved. It has been a regular driver since Linux 3.14 (2014).',
      zh: 'Linux 的一种[[block-device|块设备]]，把写给它的数据压缩后存在内存里。拿它当交换设备，换出就变成压缩一页，换入就变成解压一页，全程不碰磁盘。从 Linux 3.14（2014 年）起它是正式驱动。',
    },
    note: 'zram-oom',
  },
  lmkd: {
    title: { en: 'lmkd (Android)', zh: 'lmkd（Android）' },
    body: {
      en: 'Android’s low memory killer [[daemon|daemon]]. It watches memory pressure from user space, through [[psi-trigger|PSI triggers]] by default since Android 10, and when memory runs short it kills apps, starting with those the user is least likely to miss. It replaced an older killer inside the kernel.',
      zh: 'Android 的低内存杀手[[daemon|守护进程]]。它在用户态监视内存压力，从 Android 10 起默认借助 [[psi-trigger|PSI 触发器]]；内存不够时它杀掉应用，先从用户最不会想念的那些下手。它取代了原先内核里的一个杀手。',
    },
    note: 'zram-oom',
  },
  'psi-trigger': {
    title: { en: 'PSI trigger', zh: 'PSI 触发器' },
    body: {
      en: 'A request a program writes to a pressure file such as `/proc/pressure/memory`: a threshold and a time window, for example 150 ms of stall in any 1 s. The program then waits in [[poll|`poll()`]], and the kernel wakes it when the stall time in a window crosses the threshold.',
      zh: '程序写进 `/proc/pressure/memory` 这类压力文件的一个请求：一个阈值加一个时间窗口，比如“任意 1 秒内停滞 150 毫秒”。程序随后在 [[poll|`poll()`]] 里等待，窗口内的停滞时间越过阈值时，内核就把它唤醒。',
    },
    note: 'zram-oom',
  },
  reclaim: {
    title: { en: 'Reclaim', zh: '回收（reclaim）' },
    body: {
      en: 'The kernel freeing page frames when memory runs short: dropping clean file pages, writing dirty ones back first, and writing [[anonymous-memory|anonymous pages]] to swap. Linux’s background reclaimer is kswapd; a program whose allocation finds no free frame may also have to reclaim itself.',
      zh: '内存不够时，内核腾出页帧的过程：丢掉干净的文件页，先写回脏页再丢，把[[anonymous-memory|匿名页]]写到交换空间。Linux 在后台负责回收的是 kswapd；分配内存时找不到空闲帧的程序，也可能得亲自动手回收。',
    },
    chapter: 'vm-beyondphys',
  },
  thrashing: {
    title: { en: 'Thrashing', zh: '抖动（thrashing）' },
    body: {
      en: 'When the running programs together need more memory than there is, the system spends its time evicting pages that are needed again moments later, and reading them back. The disk, or here the compressor, is busy, and almost no useful work gets done.',
      zh: '正在运行的程序合起来需要的内存超过了实际拥有的，系统于是把时间都花在淘汰马上又要用的页、再把它们读回来上。磁盘（或者这里的压缩器）忙个不停，有用的活却几乎没干。',
    },
    chapter: 'vm-beyondphys-policy',
  },
  'block-device': {
    title: { en: 'Block device', zh: '块设备' },
    body: {
      en: 'A device the kernel reads and writes in fixed-size blocks at any position, as it would a disk. File systems and swap sit on block devices, so anything that behaves like one, even a [[driver|driver]] that keeps the blocks in RAM, can hold them.',
      zh: '内核以固定大小的块、按任意位置读写的设备，就像对待磁盘那样。文件系统和交换空间都建立在块设备上，所以任何表现得像块设备的东西，哪怕是一个把块存在内存里的[[driver|驱动]]，都能承载它们。',
    },
  },
  'kernel-staging': {
    title: { en: 'Kernel staging area', zh: '内核的 staging 区' },
    body: {
      en: 'A directory of the Linux source tree, `drivers/staging`, for drivers that work but are not yet up to the kernel’s standards. Code there is shipped and used while it is cleaned up, and it moves to its proper place, or is deleted, later.',
      zh: 'Linux 源码树里的一个目录 `drivers/staging`，用来放那些能用、但还没达到内核标准的驱动。这里的代码一边被发布和使用，一边被整理，之后要么搬到正式的位置，要么被删掉。',
    },
  },
  kconfig: {
    title: { en: 'Kernel build options (CONFIG_)', zh: '内核编译选项（CONFIG_）' },
    body: {
      en: 'Choices made when the Linux kernel is compiled, named `CONFIG_SOMETHING`: whether a feature is built in, built as a loadable module, or left out. A feature whose option was off is simply not in that kernel.',
      zh: '编译 Linux 内核时做出的选择，名字形如 `CONFIG_SOMETHING`：某项功能是编进内核、编成可加载模块，还是不要。选项关掉的功能，在那个内核里根本不存在。',
    },
  },
  lru: {
    title: { en: 'LRU (least recently used)', zh: 'LRU（最近最少使用）' },
    body: {
      en: 'A replacement policy: when something must be evicted, evict the item whose last use is furthest in the past. It bets on locality, that what was used recently will be used again soon.',
      zh: '一种替换策略：必须淘汰时，淘汰最近一次使用离现在最久的那一项。它押的是局部性：最近用过的东西，很快还会再用。',
    },
    chapter: 'vm-beyondphys-policy',
    note: 'approx-lru',
  },
  procfs: {
    title: { en: '/proc', zh: '/proc' },
    body: {
      en: 'A file system the Linux kernel generates on the fly, through which it reports on itself. Each process has a directory, `/proc/<pid>`, whose files describe it, and some files can be written to change a setting, such as how willing the OOM killer is to pick that process.',
      zh: 'Linux 内核即时生成的一个文件系统，内核通过它报告自身的情况。每个进程都有一个目录 `/proc/<pid>`，里面的文件描述这个进程；有些文件还可以写入以修改设置，比如 OOM killer 有多愿意挑中这个进程。',
    },
  },
  'x-server': {
    title: { en: 'X server', zh: 'X 服务器' },
    body: {
      en: 'The display server of the X Window System, long the graphics layer of Unix and Linux desktops. Every graphical program draws its windows and gets its input through it, so if it dies, every window on the screen goes with it.',
      zh: 'X 窗口系统的显示服务器，长期以来是 Unix 和 Linux 桌面的图形层。每个图形程序都通过它来画窗口、接收输入，所以它一死，屏幕上的所有窗口都跟着消失。',
    },
  },
  livelock: {
    title: { en: 'Livelock', zh: '活锁' },
    body: {
      en: 'A state in which a system is busy all the time but makes no progress: unlike a deadlock nothing is blocked forever, yet the work being done keeps undoing itself. A machine that keeps evicting pages it faults straight back in is in one.',
      zh: '系统一直在忙、却毫无进展的状态：和死锁不同，没有什么被永远卡住，但所做的工作不断被自己抵消。一台不停淘汰页、又马上把它们缺页读回的机器，就处在活锁之中。',
    },
  },
  poll: {
    title: { en: 'poll()', zh: 'poll()' },
    body: {
      en: 'A Unix [[syscall|system call]] that puts a process to sleep until something happens on one of the files it names: data arrives to read, a write would not block, or, for a pressure file, a threshold has been crossed.',
      zh: 'Unix 的一个[[syscall|系统调用]]：让进程睡眠，直到它指定的某个文件上发生了事情——有数据可读、写入不会阻塞，或者对压力文件来说，越过了阈值。',
    },
  },
  refault: {
    title: { en: 'Refault', zh: '回迁（refault）' },
    body: {
      en: 'A page that is needed again soon after it was evicted, so it has to be read back in. Linux notices this through the [[shadow-entry|shadow entry]] left behind at eviction. Many refaults mean memory is being reclaimed that is still in use: thrashing.',
      zh: '一页被淘汰后不久又要用到，只好再读回来。Linux 靠淘汰时留下的[[shadow-entry|影子表项]]察觉这一点。回迁一多，就说明被回收的内存其实还在用：这就是抖动。',
    },
    note: 'approx-lru',
  },
  vmpressure: {
    title: { en: 'vmpressure', zh: 'vmpressure' },
    body: {
      en: 'An older Linux way of reporting memory pressure to programs, through memory [[cgroup|cgroups]], as three levels: low (memory is being reclaimed for new allocations), medium (the system may be swapping or paging out active file caches) and critical (it is actively thrashing). lmkd relied on it before PSI, and had to filter out its many false alarms.',
      zh: 'Linux 较早的一种向程序报告内存压力的方式，通过内存 [[cgroup|cgroup]] 给出三个级别：低（正在为新的分配回收内存）、中（系统可能在交换，或在换出活跃的文件缓存）、临界（正在抖动）。在 PSI 之前，lmkd 依靠的就是它，还得滤掉其中大量的误报。',
    },
  },
}

export default terms
