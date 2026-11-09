import type { Term } from './index'

/** Terms of “fork() as a snapshot machine”. */
const terms: Record<string, Term> = {
  'vax-vms': {
    title: { en: 'VAX/VMS', zh: 'VAX/VMS' },
    body: {
      en: 'The operating system Digital Equipment Corporation built in the late 1970s for its VAX minicomputers. Chapter 23 of the book studies its virtual memory.',
      zh: '数字设备公司（DEC）在 1970 年代末为自家 VAX 小型机打造的操作系统。本书第 23 章专门研究它的虚拟内存。',
    },
    chapter: 'vm-complete',
  },
  tenex: {
    title: { en: 'TENEX', zh: 'TENEX' },
    body: {
      en: 'A time-sharing operating system for DEC PDP-10 computers, developed at the research firm BBN from 1969. It paged its virtual memory on demand and could share pages copy-on-write.',
      zh: '一个运行在 DEC PDP-10 计算机上的分时操作系统，由研究公司 BBN 从 1969 年起开发。它按需调页，并且能以写时复制的方式共享页面。',
    },
  },
  pte: {
    title: { en: 'Page-table entry (PTE)', zh: '页表项（PTE）' },
    body: {
      en: 'One slot of a [[page-table|page table]]: which physical frame a virtual page lives in, plus permission bits such as present and writable. Copy-on-write works by clearing the writable bit, so that the next write [[trap|traps]].',
      zh: '[[page-table|页表]]里的一格：记录一个虚拟页位于哪个物理页帧，外加“存在”“可写”等权限位。写时复制靠的就是清掉可写位，这样下一次写入就会[[trap|陷入]]内核。',
    },
    chapter: 'vm-paging',
  },
  hvm: {
    title: { en: 'HVM (on EC2)', zh: 'HVM（EC2 上的）' },
    body: {
      en: 'Hardware virtual machine: Amazon EC2 instance types that run guests with the processor’s hardware virtualization support. The older alternative was paravirtual (PV) guests on the Xen [[hypervisor|hypervisor]], whose kernels are modified to ask the hypervisor to make privileged changes such as page-table updates for them.',
      zh: '硬件虚拟机：Amazon EC2 上借助处理器硬件虚拟化支持来运行客户机的实例类型。较早的另一种做法是 Xen [[hypervisor|虚拟机监控器]]上的半虚拟化（PV）客户机：它们的内核经过修改，页表更新这类特权操作要请监控器代劳。',
    },
  },
  'ec2-xen': {
    title: { en: 'Xen and EC2’s “old” instance types', zh: 'Xen 与 EC2 的“旧实例类型”' },
    body: {
      en: 'Xen is the open-source [[hypervisor|hypervisor]] under Amazon EC2’s first instances, which launched in August 2006. The “old” row of this table was published in April 2012, before the M3 family arrived that October; Redis does not say which instance type it measured. C5, in 2017, was the first family on AWS’s own Nitro hypervisor.',
      zh: 'Xen 是一款开源的[[hypervisor|虚拟机监控器]]，Amazon EC2 在 2006 年 8 月上线时的第一批实例就运行在它上面。表中“旧实例类型”这一行发表于 2012 年 4 月，比同年 10 月推出的 M3 系列还早；Redis 没有说明具体测的是哪种实例。2017 年的 C5 是第一个运行在 AWS 自研 Nitro 监控器上的实例系列。',
    },
  },
  replica: {
    title: { en: 'Replica', zh: '副本（replica）' },
    body: {
      en: 'A server that keeps a copy of another server’s data, its *primary*. A new replica first loads a full snapshot from the primary, then applies each write the primary sends it.',
      zh: '保存另一台服务器（*主节点*，primary）数据副本的服务器。新副本先从主节点加载一份完整快照，然后逐条应用主节点发来的写操作。',
    },
  },
  zombie: {
    title: { en: 'Zombie process', zh: '僵尸进程' },
    body: {
      en: 'A process that has exited but whose parent has not yet collected its exit status with `wait()`. The kernel has freed nearly everything it used and keeps only a small record until the parent asks.',
      zh: '已经退出、但父进程还没用 `wait()` 取走退出状态的进程。它用过的东西内核几乎都释放了，只留下一小份记录，等父进程来取。',
    },
    chapter: 'cpu-intro',
    note: 'zombies-containers',
  },
  'async-signal-safe': {
    title: { en: 'Async-signal-safe', zh: '异步信号安全' },
    body: {
      en: 'A function that POSIX guarantees can be called from a [[signal|signal]] handler, which may interrupt the program at any instruction, possibly while it is holding a [[lock|lock]]. The list is short: `write()` is on it, `malloc()` and `printf()` are not. A forked child of a multithreaded program lives under the same rules until it calls `exec()`.',
      zh: 'POSIX 保证可以在[[signal|信号]]处理函数里调用的函数。处理函数可能在任何一条指令处打断程序，而那时程序或许正握着一把[[lock|锁]]。这份名单很短：`write()` 在列，`malloc()` 和 `printf()` 不在。多线程程序 fork 出的子进程，在调用 `exec()` 之前也受同样的限制。',
    },
  },
  malloc: {
    title: { en: 'malloc()', zh: 'malloc()' },
    body: {
      en: 'The C library function that hands a program a block of memory from the heap; `free()` gives it back. Its bookkeeping is shared by the whole process, so it is protected by [[lock|locks]]. Chapter 14 introduces it.',
      zh: 'C 库里从堆上给程序分配一块内存的函数，用 `free()` 归还。它的簿记数据由整个进程共用，因此要靠[[lock|锁]]来保护。第 14 章会介绍它。',
    },
    chapter: 'vm-api',
  },
  aslr: {
    title: { en: 'ASLR (address-space layout randomization)', zh: 'ASLR（地址空间布局随机化）' },
    body: {
      en: 'Loading a program’s code, libraries, stack and heap at random addresses, so that an attacker who finds a memory bug does not know where anything is. A process that forks without calling `exec()` gives its child the very same layout.',
      zh: '把程序的代码、库、栈和堆加载到随机的地址上，让发现了内存漏洞的攻击者不知道东西都在哪儿。进程 fork 之后如果不调用 `exec()`，子进程拿到的布局和它一模一样。',
    },
    note: 'aslr',
  },
  posix: {
    title: { en: 'POSIX', zh: 'POSIX' },
    body: {
      en: 'The IEEE standard for the interface of Unix-like operating systems: system calls, library functions, the shell and common commands. A program written to it can be built on Linux, macOS and the BSDs alike.',
      zh: 'IEEE 为类 Unix 操作系统的接口制定的标准，涵盖系统调用、库函数、shell 和常用命令。按它编写的程序，可以在 Linux、macOS 和各 BSD 上构建。',
    },
  },
}

export default terms
