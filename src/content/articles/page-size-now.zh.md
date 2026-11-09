---
deck: 地址空间、页、TLB、页错误、按需置零和写时复制都不是历史。一个 shell、两段小小的 C 程序和 /proc 下的几个文件，就能让你在眼前这台机器上看到它们每一个。
title: 本部分的所有内容，此刻正在你的电脑上运行
---

::scene overview

核对本文所用的那台 Linux 机器，对 `getconf PAGESIZE` 的回答是 `4096`。而按 `lscpu` 的说法，它的处理器是 Apple 造的。在同一类芯片上启动 macOS，同一条命令回答的是 `16384`。同样的硅片，两种页大小。

页不是自然规律，而是操作系统在硬件给出的选项里做的一个选择。这个选择，以及建立在它之上的几乎一切，你都能在一个普通终端里查看。本文是一次导览：每一站都注明出自哪一章，给你一条命令或一小段程序，并说明它适用于哪个系统。

## 问题

::chapter vm-complete

本书从地址空间（第 13 章）出发，经过分页、TLB 和多级页表（第 18 到 20 章），再到页错误与替换（第 21、22 章），最后是第 23 章的完整系统，以及它们的两个“偷懒”技巧：[[demand-zero|按需置零]]和[[copy-on-write|写时复制]]。这些东西在真实机器上到哪里*看得见*？数字又说明了什么？

::scene maps

## 你的地址空间，就是一个文本文件

在 Linux 上，每个进程都有一个描述自身地址空间的文件。`cat` 可以给你看它自己的：

```sh
# 仅限 Linux
cat /proc/self/maps
```

下面是真实输出，来自运行在 Linux 6.8 上的 arm64 Debian 12 用户态里的 `cat`，略去了一些行：

```text
abf6ec0a0000-abf6ec0a9000 r-xp 00000000 00:2e 1048843   /usr/bin/cat
abf6ec0bf000-abf6ec0c0000 r--p 0000f000 00:2e 1048843   /usr/bin/cat
abf6ec0c0000-abf6ec0c1000 rw-p 00010000 00:2e 1048843   /usr/bin/cat
abf70a097000-abf70a0b8000 rw-p 00000000 00:00 0         [heap]
ef18aa5d0000-ef18aa75c000 r-xp 00000000 00:2e 1049378   /usr/lib/aarch64-linux-gnu/libc.so.6
ef18aa75c000-ef18aa76c000 ---p 0018c000 00:2e 1049378   /usr/lib/aarch64-linux-gnu/libc.so.6
ef18aa76c000-ef18aa770000 r--p 0018c000 00:2e 1049378   /usr/lib/aarch64-linux-gnu/libc.so.6
ef18aa770000-ef18aa772000 rw-p 00190000 00:2e 1049378   /usr/lib/aarch64-linux-gnu/libc.so.6
ef18aa772000-ef18aa77f000 rw-p 00000000 00:00 0
...
ef18aa7c8000-ef18aa7ca000 r--p 00000000 00:00 0         [vvar]
ef18aa7ca000-ef18aa7cb000 r-xp 00000000 00:00 0         [vdso]
ffffe07be000-ffffe07df000 rw-p 00000000 00:00 0         [stack]
```

每一行是一段虚拟地址区域，内核称之为 [[vma|VMA]]。各列依次是：地址范围、权限、该区域在其背后文件中的偏移、那个文件所在的设备号和 [[inode|inode]] 号，以及它的名字。带着第 13 章那幅地址空间的图来读：

- 程序和每个库的**代码、只读数据和数据**各自是独立的区域，权限分别是 `r-x`、`r--` 和 `rw-`。这就是第 16、18 章的保护位，以页为单位生效。
- **第四个字母**是 `p` 表示私有映射（内核文档注明为“copy on write”，即写时复制），是 `s` 表示共享。上面所有可写区域都是私有的：如果这个进程写了 [[libc|libc]] 数据区的某一页，它会得到一份自己的副本。
- **inode 为 0** 表示区域背后没有文件。libc 后面那行无名的 `rw-p` 很可能是它的零初始化数据（[[bss|`.bss`]]）。这些页是**按需置零**的：在第一次被访问之前，它们只是区域里的一段范围而已。
- **`---p`** 是 libc 地址范围里的一个空洞，没有任何权限，访问它就会出错。
- **`[heap]`** 是 [[brk|`brk()`]] 扩展的那片区域。**`[stack]`** 是主线程的栈，位于用户地址空间顶部附近，向下增长。
- **[[vdso|`[vdso]`]]** 是内核映射进每个进程的一个小共享库，让 `clock_gettime()` 之类的调用无需陷入内核就能完成。**`[vvar]`** 存放它读取的数据。

现在把命令再运行一次。所有地址都变了，因为每次 [[fork-exec|`exec()`]] 时内核都会把各个区域放在随机偏移处。这就是地址空间布局随机化（ASLR），正是因为地址是虚拟的才做得到。它防的是什么，见 [ASLR 那篇](/notes/aslr)。

macOS 上没有 [[proc-sys|`/proc`]]。最接近的工具是 `vmmap <pid>`，它列出同类区域，并标明每个区域的用途：`__TEXT`、`__DATA` 之类的 [[mach-o|Mach-O]] 段、malloc 区域、栈。`vmmap -summary <pid>` 则只给汇总，不列明细。

::scene smaps

## 一页值多少：smaps

`maps` 告诉你映射了什么；`/proc/<pid>/smaps` 则逐个区域告诉你，其中究竟有多少真的在内存里。下面是同一系统上一个小进程的堆区域（有删节）：

```text
b561e5f4e000-b561e5f6f000 rw-p 00000000 00:00 0          [heap]
Size:                132 kB
KernelPageSize:        4 kB
MMUPageSize:           4 kB
Rss:                   4 kB
Pss:                   4 kB
Private_Dirty:         4 kB
Anonymous:             4 kB
AnonHugePages:         0 kB
Swap:                  0 kB
```

这个堆占了 132 KiB 的地址，却只有一个 4 KiB 的页驻留在内存里，其余部分从未被碰过。`KernelPageSize` 和 `MMUPageSize` 告诉你这个区域由多大的页支撑，`AnonHugePages` 显示其中有多少用上了 2 MiB 的[[thp|透明大页]]，`Swap` 显示有多少已被换出。`/proc/<pid>/smaps_rollup` 给出把所有区域加总后的同样字段，对大进程来说读起来更省事。

::scene rss

## RSS、VSZ 和 PSS

每当有人问一个进程用了多少内存，总会冒出三个数字。它们量的是不同的东西。

- **VSZ**（虚拟大小）是所有已映射区域的总大小，也就是 `maps` 里的全部。它几乎不花钱，可以远远超过物理内存。
- **RSS**（驻留集大小）是其中当前位于物理帧里的部分。共享库的驻留页会在*每一个*映射它的进程里都算一遍，所以把各进程的 RSS 加起来会重复计算。
- **PSS**（按比例分摊的驻留集大小）把每个共享页除以共享它的进程数。对所有进程求和，得到的就是真实的内存用量。

`ps` 在两个系统上都能打印前两个数字，单位是 KiB：

```sh
# Linux 和 macOS
ps -o pid,vsz,rss,comm -p $$
```

在 Linux 上，`grep -E '^(Rss|Pss)' /proc/$$/smaps_rollup` 还能补上 PSS。

::scene pagesize

## 页大小：4 KiB、16 KiB，以及为什么这是一个选择

```sh
getconf PAGESIZE          # Linux 和 macOS
sysctl hw.pagesize        # 仅限 macOS
```

在 x86-64 上，答案永远是 4096。硬件的基础页是 4 KiB，往页表上走一层和两层，分别是第 23 章讲到的 2 MiB 和 1 GiB [[huge-page|大页]]。四级、每级 9 位，再加 12 位偏移，合起来是 48 位虚拟地址。再往上会发生什么，见[五级页表那篇](/notes/five-level)。

在 64 位 Arm 上，硬件提供三种*转换粒度*（translation granule）供选：4、16 或 64 KiB，由操作系统挑一种。Apple 芯片上 macOS 的原生 arm64 进程看到的是 16 KiB 的页；同样这些 Mac 上的 [[asahi|Asahi Linux]] 也用 16 KiB，其文档解释说，原因是这些机器的 [[iommu|IOMMU]] 只支持 16 KiB 的页。而同一块芯片上的 Linux [[hypervisor|虚拟机]]仍然可以用 4 KiB，本文开头那台机器就是这样。Android 15 开始支持使用 16 KiB 页的设备。按 Google 的初步测试，这类设备平均多用一点内存，在内存紧张时应用启动平均快 3.16%，开机平均快约 8%（约 950 毫秒）。

为什么要把页变大？第 19、20 章里的一切都随页大小缩放：

- **TLB 覆盖范围**扩大到四倍：同样多的 TLB 项能覆盖四倍的内存。覆盖范围为什么要紧，见[大页那篇](/notes/huge-pages)。
- **页表**变得更浅、更小，下面的折叠部分会算给你看。
- **页错误**：逐页访问同样多的内存，次数只有四分之一。

代价是第 17 章讲的内部碎片：一个只需要一个字节的进程也得拿走整页，而 16 KiB 的页上，每个没用满的页最多会浪费四倍的空间。它还会弄坏那些把 4096 写死的代码。Android 如今要求开发者把原生库按 16 KiB 对齐，并调用 `getpagesize()` 或 `sysconf(_SC_PAGESIZE)`，而不是假设一个页大小。

:::fold 页表的级数从何而来
::scene levels

页表页本身就是一个页，每个表项 8 字节。所以页大小决定了一张表能装多少项，也就决定了这棵[[radix-tree|基数树]]每一级翻译多少位地址：

| 页大小 | 偏移位数 | 每张表的项数 | 每级位数 | 上一级的大页 |
|---|---|---|---|---|
| 4 KiB | 12 | 512 | 9 | 2 MiB |
| 16 KiB | 14 | 2,048 | 11 | 32 MiB |
| 64 KiB | 16 | 8,192 | 13 | 512 MiB |

4 KiB 的页，12 + 4 × 9 = 48 位，需要四级。16 KiB 的页，14 + 3 × 11 = 47 位，只要三级；第 48 位则需要再加一个只有两项的小小一级。64 KiB 的页，arm64 上的 Linux 用两级覆盖 42 位地址空间：16 + 2 × 13 = 42。

最后一列是上一级“块”映射的大小：一个叶子表项一次映射整张表那么多的内存。我们熟悉的 2 MiB 大页就是这么来的：512 × 4 KiB。在 16 KiB 的系统上，对应的是 32 MiB，所以 Linux 的 arm64 文档把 32 MiB 列为这种粒度下 [[pmd|PMD]] 级的大页大小。

这一张表就是第 20 章的权衡：页越大，树越浅，代价是分配粒度越粗。树本身见[基数树那篇](/notes/radix-trees)。
:::

::scene lazy

## 惰性分配，量给你看

第 23 章讲 VAX/VMS 时介绍了**按需置零**：进程申请内存时，操作系统只记下这次申请（VMS 记在一个标为无效的页表项里，Linux 记在一个 VMA 里），其余什么也不做，直到第一次访问触发陷阱。下面这个程序让你数一数这些陷阱。它[[mmap|映射]] 256 MiB，停下来让你从外面看一眼，然后往每页写一个字节，并报告这一共引发了多少次[[minor-fault|次要页错误]]（minor fault）。

```c
/* lazy.c：虚拟内存在你碰它之前一文不花。
   Linux 和 macOS：cc -O2 -o lazy lazy.c && ./lazy */
#include <stdio.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <unistd.h>

static long minor_faults(void) {
    struct rusage ru;
    getrusage(RUSAGE_SELF, &ru);
    return ru.ru_minflt;
}

static void pause_here(const char *what) {
    printf("%s. In another terminal: ps -o pid,vsz,rss -p %d\n", what, (int)getpid());
    printf("Press Enter to continue.\n");
    getchar();
}

int main(void) {
    long page = sysconf(_SC_PAGESIZE);
    size_t len = (size_t)256 << 20;                       /* 256 MiB */

    char *mem = mmap(NULL, len, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANON, -1, 0);
    if (mem == MAP_FAILED) { perror("mmap"); return 1; }
    volatile char *p = mem;                               /* 确保下面的写入不被优化掉 */
    pause_here("Mapped 256 MiB, touched nothing");

    long before = minor_faults();
    for (size_t off = 0; off < len; off += (size_t)page)
        p[off] = 1;                                       /* 对每页的第一次写入 */
    long after = minor_faults();

    printf("page size %ld: touched %zu pages, took %ld minor faults\n",
           page, len / (size_t)page, after - before);
    pause_here("Touched every page");
    return 0;
}
```

第一次暂停时，VSZ 已经包含了这 256 MiB，RSS 却还很小：这块内存只是一个 VMA。第二次暂停时，RSS 也涨了大约 256 MiB。

::scene touched

页大小的影响体现在页错误次数上。4 KiB 的页一共要碰 65,536 页，所以预计大约 65,536 次次要页错误，每页一次。作为验证，把同样的循环用 JavaScript 写出来，在本文所用的 Linux 虚拟机上用 Node 运行，得到 65,692 次，多出来的一点大概来自运行时本身。16 KiB 的页只需碰 16,384 页，次数预计只有四分之一。如果透明大页设成了 `always`（见 `/sys/kernel/mm/transparent_hugepage/enabled`），Linux 可能会用 2 MiB 的页来支撑这块区域，一次页错误就能映射 512 页，次数会大幅下降；该区域在 `smaps` 里的 `AnonHugePages` 会显示出来。

这些页错误全都是*次要*的。内核找一个空闲帧、清零、填好页表项，就完事了。这一页并不是躺在磁盘上等着被读进来；在你写它之前，它根本不存在于任何地方。

这种惰性带来一个第 21 章暗示过的后果。既然没碰过的内存不花钱，Linux 默认就允许进程映射超过它实际能提供的内存：`vm.overcommit_memory` 为 0，是一种只拒绝明显过分请求的启发式模式。账单要等到页被碰到时才来。如果付不起，Linux 会怎么办，是 [zram 与 OOM 那篇](/notes/zram-oom)的主题。

::scene faultlab

## 慢动作看一次页错误

::lab PageFault

这个实验跟踪一次内存访问穿过 TLB、页表遍历和页错误处理程序的全过程。试试这些：

- 先运行 **TLB 命中**，再运行 **TLB 未命中，页在内存中**。两者的差别是一次页表遍历，即第 20 章的多级查找；上面的折叠部分告诉你，在你的机器上这次遍历有几级。
- 运行 **缺页，有空闲帧**。这和 `lazy.c` 每一轮循环做的事情很接近，只有一点不同：实验里要从交换区读入页，而按需置零的页错误只是把一个新帧清零。这就是 `lazy.c` 的页错误是次要的、而且很快的原因。
- 运行 **缺页，内存已满，牺牲页是脏的**，比较时间条。这条路径先写磁盘、再读磁盘，是一次主要页错误（major fault），你最希望看到的次数是零。

实验里的时间只是粗略的数量级；而且真实的页表遍历常常能借助上层页表项的缓存。

## 从外面数页错误

数页错误不必写 C。三个标准工具能为任意命令报告它们：

```sh
# Linux，GNU time（通常在名为 "time" 的软件包里；shell 内建的 time 做不到）
/usr/bin/time -v ./lazy        # 输出里的 "Minor (reclaiming a frame) page faults" 和 "Major (requiring I/O) page faults"

# Linux，perf
perf stat -e page-faults,minor-faults,major-faults -- ./lazy

# macOS，BSD time："page reclaims" 是次要页错误，"page faults" 是主要页错误
/usr/bin/time -l ./lazy
```

::scene major

想看到主要页错误，就让内核忘掉一个文件，然后再用它。在 Linux 上以 [[root|root]] 身份执行 `sync; echo 1 > /proc/sys/vm/drop_caches`，会清空[[page-cache|页缓存]]，但不会丢数据，因为脏页不会被丢弃。紧接着运行一个大程序，它的代码要从磁盘换入，于是出现主要页错误。再运行一次，页错误就变成次要的了，因为代码已经在页缓存里：内核只需把页表指向一个现成的帧。`free` 把页缓存显示为 `buff/cache`。同一个程序跑两遍，第 22 章的 AMAT 就摆在你眼前。

:::fold 写时复制，量给你看
::scene cow

第 23 章解释过，`fork()` 并不复制内存。它复制页表，把私有页在两个进程里都标成只读，等其中一方写某一页时，才复制那一页。下面的程序演示这一点：父进程先填满 64 MiB，然后 fork；子进程先把每页读一遍，再把每页写一遍，分别统计两轮的次要页错误。

```c
/* cow.c：fork() 之后的写时复制。cc -O2 -o cow cow.c && ./cow */
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>

static long minor_faults(void) {
    struct rusage ru;
    getrusage(RUSAGE_SELF, &ru);
    return ru.ru_minflt;
}

int main(void) {
    long page = sysconf(_SC_PAGESIZE);
    size_t len = (size_t)64 << 20;                        /* 64 MiB */
    char *mem = mmap(NULL, len, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANON, -1, 0);
    if (mem == MAP_FAILED) { perror("mmap"); return 1; }
    memset(mem, 1, len);                                  /* 父进程拥有真实的物理页 */

    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }
    if (pid == 0) {
        volatile char *p = mem;
        long sum = 0, a = minor_faults();
        for (size_t off = 0; off < len; off += (size_t)page) sum += p[off];   /* 读 */
        long b = minor_faults();
        for (size_t off = 0; off < len; off += (size_t)page) p[off] = 2;      /* 写 */
        long c = minor_faults();
        printf("child: %zu pages, %ld faults reading, %ld faults writing (sum %ld)\n",
               len / (size_t)page, b - a, c - b, sum);
        _exit(0);
    }
    waitpid(pid, NULL, 0);
    return 0;
}
```

在使用 4 KiB 页的 Linux 上，读的那一轮预计几乎没有页错误：`fork()` 已经复制了页表项，共享的页早就映射好了。写的那一轮预计约 16,384 次：每次首写都撞上一个只读表项，内核复制这一页，给子进程一个私有的、可写的映射。如果这块区域由透明大页支撑，数字会有所不同。父进程的内存自始至终没被动过，这正是关键所在。[fork 与 Redis 那篇](/notes/fork-redis)讲了一个靠这一点做快照的数据库。
:::

:::fold 你的页表，（几乎）可读
::scene pagemap

Linux 还暴露了更深的一层：`/proc/<pid>/pagemap`，一个二进制文件，每个虚拟页对应一个 8 字节的表项。第 63 位表示页是否在内存中，第 62 位表示是否已换出，第 0 到 54 位是物理帧号，也就是第 18 章的 PFN。定位到（虚拟地址 / 页大小）× 8 处，读到的就是 TLB 会缓存的那条地址转换。

但有个限制。从 Linux 4.0 起，帧号只对拥有 [[root|`CAP_SYS_ADMIN`]] 的进程开放；从 4.2 起，无特权的读者看到的 PFN 字段全是零，标志位则照常可用。内核文档给出了原因：物理地址能帮攻击者实施 [[rowhammer|Rowhammer]]，也就是反复“锤击”DRAM 的某些行，让相邻行的比特发生翻转。连本书当作普通簿记的地址转换，原来也是需要藏起来的东西。
:::

::scene beyond

## 机器在哪里走得比书更远

书里的模型经得起检验，但你的电脑在三个地方走得更远：

- **页不止一种大小。** Linux 可以用 2 MiB 的透明大页来支撑[[anonymous-memory|匿名内存]]；较新的内核还支持 16、32、64 KiB 等中间尺寸（“多尺寸 THP”，multi-size THP）。
- **内核不在 `maps` 里。** 除了 x86-64 上遗留的 `[vsyscall]` 页这类特例，地址空间里属于内核的那一半并不出现在这里。自从第 23 章讨论过的 [[spectre|Meltdown]] 之后，x86 内核可能把其中大部分完全移出用户页表，[PCID 那篇](/notes/pcid)讲了它们如何让这件事不那么昂贵。
- **内存先承诺，后兑现。** 有了超额分配（overcommit），VSZ 是承诺，RSS 是已兑现的部分。太多承诺同时被兑现时，答案依次是压缩、交换，最后是杀进程，见 [zram 与 OOM 那篇](/notes/zram-oom)。

::scene overview

## 回到书里的那条线

把这一整部分写成一组命令：

| 书中概念 | 章 | Linux | macOS |
|---|---|---|---|
| 地址空间 | 13 | `cat /proc/<pid>/maps` | `vmmap <pid>` |
| 页大小 | 18 | `getconf PAGESIZE` | `getconf PAGESIZE`、`sysctl hw.pagesize` |
| 大页与 TLB 覆盖范围 | 19、23 | `smaps` 中的 `AnonHugePages` | 没有同样的暴露方式 |
| 驻留页 | 21 | `smaps_rollup` 中的 `Rss` 和 `Pss`、`ps` | `ps`、`vmmap -summary` |
| 页错误 | 21 | `/usr/bin/time -v`、`perf stat` | `/usr/bin/time -l` |
| 按需置零 | 23 | `lazy.c` | `lazy.c` |
| 写时复制 | 23 | `cow.c` | `cow.c` |
| 页缓存 | 22、23 | `free`、`drop_caches` | `vm_stat` |
| 物理帧 | 18 | `/proc/<pid>/pagemap`（需 root） | 无 |

这些都不是模拟。书把这些机制画在了纸上；你正用来读这篇文章的机器，时时刻刻都在运行它们。上面这些工具，只是让你看得见。

## 延伸阅读

- [The /proc filesystem](https://docs.kernel.org/filesystems/proc.html)：`maps`、`smaps`、`smaps_rollup` 和 `status`。
- [Examining process page tables](https://docs.kernel.org/admin-guide/mm/pagemap.html)：`pagemap` 的格式及其权限规则。
- [Transparent Hugepage Support](https://docs.kernel.org/admin-guide/mm/transhuge.html)：THP 设置、`AnonHugePages` 与多尺寸 THP。
- [HugeTLBpage on ARM64](https://docs.kernel.org/arch/arm64/hugetlbpage.html)：各种转换粒度下的大页大小。
- [Documentation for /proc/sys/vm](https://docs.kernel.org/admin-guide/sysctl/vm.html)：`overcommit_memory` 与 `drop_caches`。
- [getrusage(2)](https://man7.org/linux/man-pages/man2/getrusage.2.html)、[fork(2)](https://man7.org/linux/man-pages/man2/fork.2.html) 和 [vdso(7)](https://man7.org/linux/man-pages/man7/vdso.7.html) 手册页。
- [Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes)：Android 的指南，附 Google 的测量数据。
- [Asahi Linux: broken software](https://asahilinux.org/docs/sw/broken-software/)：为什么 Apple 芯片上的 Linux 使用 16 KiB 页。
- Brendan Gregg：[perf examples](https://www.brendangregg.com/perf.html)。
