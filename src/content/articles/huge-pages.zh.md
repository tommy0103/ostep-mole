---
deck: TLB 能缓存的转换条数是固定的，想让它覆盖更多内存，唯一的办法是让每一条转换覆盖更多。大页的种种权衡，都从这一点出发。
title: TLB 覆盖范围与大页
---

::scene overview

两个流行的数据库，对同一个 Linux 开关给出了相反的建议。Redis 的延迟排查指南把它列进了简短的检查清单：“必须在内核中关闭[[thp|透明大页]]。”而 MongoDB 8.0 的生产部署说明却要你反过来做：在 `mongod` 启动之前，把 [[proc-sys|`/sys/kernel/mm/transparent_hugepage/enabled`]] 设为 `always`。7.0 及更早的版本，说的还是关掉它。

两条建议都有道理。要看清为什么，需要第 19 章里的两个数：一个地址转换旁路缓冲存储器（TLB）能装多少条转换，以及每一条覆盖多少内存。本文讲的就是这两个数：操作系统要做些什么才能把第二个数变大，以及随之而来的账单。

::scene reach

## 覆盖范围：项数乘以页大小

::chapter vm-tlbs

第 19 章结尾有一个警告：如果程序在短时间内访问的页数超过了 TLB 能装下的数量，就会频繁未命中，书里称之为*超出 TLB 覆盖范围*（TLB coverage）。这个覆盖范围，通常也叫 **TLB reach**，算起来很简单：

> 覆盖范围 = TLB 项数 × 页大小

TLB 之所以小，是因为它就在每一次加载和存储的路径上，必须在一两个周期内给出答案。以 Intel 的 Skylake 核心为例，它的二级 TLB 有 1536 项，由 4 KiB 和 2 MiB 两种转换共用。下面是这么多项在本文会遇到的几种页大小下能覆盖的范围：

| 页大小 | 1536 项的覆盖范围 | 未命中时要读的页表项（x86-64） |
|---|---|---|
| 4 KiB | 6 MiB | 4 |
| 16 KiB | 24 MiB | （x86 没有这种页大小） |
| 2 MiB | 3 GiB | 3 |
| 1 GiB | 理论上 1.5 TiB | 2 |

最后一行只是理论值，因为真实的 TLB 给 1 GiB 转换留的槽位要少得多。但结论不变：用 4 KiB 页，一个 TLB 只能覆盖几 MB，比同一颗芯片的[[last-level-cache|末级缓存]]还小。数据库的[[buffer-pool|缓冲池]]、[[jvm|JVM]] 的堆、内存键值存储，动辄以 GB 计，而且访问遍布各处。对这样的程序来说，大多数 TLB 未命中不是运气不好，而是注定的——[[working-set|工作集]]是覆盖范围的上千倍。

::scene walk

第三列是第二重好处。大页是[[multilevel-table|页表树]]里更靠上的一个叶子，所以未命中时要走的层数更少。书里那条“RAM 不总是 RAM”的提示说的正是这件事：随机访问一块 TLB 没覆盖到的内存，除了访问本身，还要额外付出一次[[page-walk|页表遍历]]。

::scene reach

## 在实验里看覆盖范围

这个实验就是书中的图 19.2：从虚拟地址 100 开始的 10 个 4 字节整数，用一个循环求和。页和 TLB 都小得出奇，好让你数清每一次未命中。它是个玩具，但覆盖范围在任何尺度上都是同样的道理。

::lab Tlb

可以试试这些：

- 把页大小设为 16 B，TLB 设为 2 项，遍历 2 次。数组横跨三个页，而 TLB 只覆盖 32 字节。第二遍时每个页又全部未命中，因为 LRU 恰好在循环需要某页之前把它踢了出去。命中率停在 70%（20 次中 14 次）。
- TLB 保持 2 项，把页大小改成 32 B。现在数组只跨两个页，覆盖范围是 64 字节，第二遍全部命中：20 次中 18 次。你一项 TLB 都没加。
- 再试 64 B 的页。什么都没改善：数组从地址 100 延伸到 139，仍然跨过了 128 这条页边界。更大的页只有在减少了被访问的不同页数时才有用，边界落在哪里也很要紧。下一节会看到，真实的大页也有同样的对齐规则。
- 回到 16 B 的页，把 TLB 改成 4 项。两遍下来是 20 次中 17 次。更大的 TLB 同样能买到覆盖范围，但硬件设计者没法免费增加表项，这正是操作系统要在页大小上动脑筋的原因。

::scene huge

## 怎样才算“大”页

在 x86-64 上，虚拟地址被切成四个 9 位索引加一个 12 位偏移，每级页表树用一个索引。遍历本身在第 20 章和[四级与五级那篇](/notes/five-level)里讲；大页，就是遍历提前停下来的结果。

倒数第二级的表叫*页目录*，其中的每一项通常指向一页、512 个页表项。如果这一项的 **PS**（page size）位被置上，它就改为直接指向一块 2 MiB 的物理内存，虚拟地址的低 21 位成为偏移量。再往上停一级，停在页目录指针表里，这一项就映射 1 GiB，偏移量是 30 位。这并不是什么独立的机制，还是同一棵树，只是路径更短。

::scene rules

这条捷径带着三条硬性要求，操作系统的所有难处都源于此：

1. **物理上连续。** 一个 2 MiB 的页就是 512 个连续的 4 KiB 页帧，它们必须同时空闲。
2. **对齐。** 虚拟起始地址和物理起始地址都必须是 2 MiB 的整数倍，因为偏移量就是低 21 位。
3. **全有或全无。** 一个表项只带一套权限位和脏位，管着整整 2 MiB。你没法只对其中一半做写保护、[[swap|换出]]或共享。

:::fold 为什么是 2 MiB 和 1 GiB（在手机上是 32 MiB）
大页的尺寸不是挑出来的，而是由表的几何结构决定的。

在 x86-64 上，一个页表页是 4 KiB，一项 8 字节，所以一张表装 4096 / 8 = 512 = 2^9^ 项。一个页表页因此映射 512 × 4 KiB = 2 MiB，跳过最底层那张表的页目录项映射的正好是这么多。再往上一级，512 × 2 MiB = 1 GiB。

ARMv8 允许操作系统在 4 KiB、16 KiB 和 64 KiB 中选择基础页大小，即*转换粒度*（translation granule），块大小遵循同样的规则：

| 粒度 | 每张表的项数 | 上一级的块 | 上两级的块 |
|---|---|---|---|
| 4 KiB | 512 | 2 MiB | 1 GiB |
| 16 KiB | 2048 | 32 MiB | 64 GiB |
| 64 KiB | 8192 | 512 MiB | 4 TiB |

Apple 芯片使用的 16 KiB 粒度，第一档大页就是 32 MiB，一步跨得很大。这也是 ARM 另设了一个*连续*（contiguous）提示位的原因之一：它告诉 TLB，一串相邻的表项（4 KiB 粒度下是 16 项）映射的是连续且对齐的内存，TLB 可以把它们当作一项来存。下文介绍的 Linux 多尺寸 THP，在 arm64 上就能利用这个提示。

上表是从规则推出来的，不是对各款芯片的调查结果；并非每种实现都在每一级支持每种块大小。
:::

## Linux 上的两条路

Linux 通过两种截然不同的接口提供大页。两者之间的差别，就是本文的全部故事。

::scene hugetlbfs

**[[hugetlbfs|hugetlbfs]]** 是显式的那一种，历史也更久。管理员预留一个大页池：运行时通过 `/proc/sys/vm/nr_hugepages`，或者在启动时用 `hugepagesz=2M hugepages=512`。内核文档称启动时预留是“最可靠的方法”，因为那时内存还没有碎片化；1 GiB 的页通常也出于同样的原因在启动时预留。池里的页不能挪作他用，也不能被换出。程序通过[[mmap|映射]] hugetlbfs 挂载点上的文件，或者用 `MAP_HUGETLB` 来获得它们。PostgreSQL 就是这样做的：它的 `huge_pages` 参数默认为 `try`，即尝试用大页来分配共享缓冲池，池里不够就退回普通页。

::scene thp

**透明大页（THP）** 是自动的那一种。Andrea Arcangeli 的补丁在 2011 年并入 Linux 2.6.38，用 LWN 的话说，目标是让大页“自然而然地发生”。[[anonymous-memory|匿名内存区域]]发生[[page-fault|页错误]]时，内核尝试直接分配一整个 2 MiB 的页；没有空闲的，就悄悄退回 4 KiB 的页。之后，一个叫 **[[khugepaged|khugepaged]]** 的内核线程会扫描各个地址空间，等内存宽裕时把成片的小页*合并*（collapse）成大页。而当一个大页需要被部分解除映射、改保护属性或回收时，内核再把它*拆分*（split）回 512 个小页。

```c
#include <sys/mman.h>

size_t len = 64UL << 20;                 /* 64 MiB */

/* THP：普通映射加一个提示；THP 的 enabled 为 always 或 madvise 时生效 */
void *a = mmap(NULL, len, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
madvise(a, len, MADV_HUGEPAGE);

/* hugetlb：从预留池中取页；池中空闲页不够时直接失败 */
void *b = mmap(NULL, len, PROT_READ | PROT_WRITE,
               MAP_PRIVATE | MAP_ANONYMOUS | MAP_HUGETLB, -1, 0);
```

这两个调用看着相像，行为却大不相同。第二个要么拿到大页，要么失败；第一个可能现在拿到、以后拿到，也可能永远拿不到，而且只有这段区域中按 2 MiB 对齐的部分才有资格。

THP 的全局行为由 `/sys/kernel/mm/transparent_hugepage/` 下的两个文件控制：

- `enabled`：`always`（所有合适的匿名区域）、`madvise`（只对用 [[madvise|`MADV_HUGEPAGE`]] 标记过的区域）或 `never`。默认值在编译内核时选定，因此各发行版不尽相同。
- `defrag`：页错误发生时没有空闲 2 MiB 页怎么办。`always` 让触发页错误的线程停下来，等内核回收和[[compaction|规整内存]]；`defer` 唤醒后台线程，由 khugepaged 稍后装上大页；`madvise` 是默认值，只对 `MADV_HUGEPAGE` 区域做直接规整；`defer+madvise` 是两者的组合；`never` 则在页错误时从不规整。

::scene bloat

## 理想在哪里弯折

第 20 章第一节就点出了大页的代价：**[[internal-fragmentation|内部碎片]]**（internal fragmentation）。一个只用了 4 KiB 的 2 MiB 页，照样占着 2 MiB。THP 又添了三笔代价，每一笔都对应上面的一条硬性要求。

**膨胀。** khugepaged 的 `max_ptes_none` 参数规定：合并一段区域时，512 个小页槽位里最多可以有多少个是空的。默认值是 511。内核源码的注释解释了这个选择：只要“至少有一个 pte 被映射”就合并，就像这段区域足够大时页错误本来会做的那样。于是，一个稀疏的堆——分配器已经释放了每个 2 MiB 区间里的大部分页——在 khugepaged 跑过之后，[[rss|常驻内存]]反而可能变大。

::scene compaction

**规整停顿。** 难点在于连续性。机器运行几天之后，空闲内存散落在一个个 4 KiB 的空洞里，要凑出一块空闲且对齐的 2 MiB，就得把挡路的页迁移走。`defrag` 设为 `always` 时，这项工作就发生在发出请求的那个线程的页错误里，于是一次内存访问可能要花上几毫秒。`defer` 和 `madvise` 这些模式存在的意义，就是把这笔开销挡在延迟敏感的路径之外。

::scene cow

**以 2 MiB 为单位的写时复制。** “全有或全无”撞上了 `fork()`。[[copy-on-write|写时复制]]（[fork 那篇](/notes/fork-redis)讲过）会在任一进程第一次写某页时复制这一页。换成大页，写一个字节就要复制 2 MiB。

:::fold Redis、fork() 与一次 2 MiB 的复制
Redis 靠 fork 做快照：子进程把数据集写到磁盘，父进程继续处理请求，写时复制让两份视图互不干扰。在 4 KiB 页下，父进程的一次写只复制 4 KiB；大部分内存保持共享，快照多花的内存与父进程写了多少成正比。

Redis 的延迟文档描述了开启 THP 后会发生什么：fork 之后，“几轮[[event-loop|事件循环]]里的命令就会落到几千个页上，导致几乎整个进程的内存都被写时复制”。几千次对随机键的写，落在几千个不同的 2 MiB 页上，每个页的第一次写都要复制 2 MiB。几千个页乘以 2 MiB，就是好几 GB，而这些复制就夹在普通命令的延迟里。这就是指南所警告的“巨大的延迟和巨大的内存占用”。

同一份文档还给页表算了一笔账：一个 24 GB 的实例，在 4 KiB 页下需要“24 GB / 4 kB * 8 = 48 MB”的页表项，`fork()` 时要全部复制。大页能把它缩小到 1/512——这是同一笔交易里的收益一方。

如今 Redis 已不再只靠管理员。它的配置文件里有一个 `disable-thp` 选项，默认为 `yes`：当系统设置为 `always` 时，只为 Redis 进程自己关闭 THP。Linux 通过一个按进程的控制接口 `prctl(PR_SET_THP_DISABLE)` 支持这种做法。
:::

::scene hugetlbfs

这些代价解释了数据库圈子里长久以来关闭 THP 的传统。PostgreSQL 的文档至今仍说“目前不鼓励”使用 THP，同时推荐为共享缓冲池使用显式大页。数据库想要大页，但要的是预先预留、可预测的大页。

:::fold MongoDB 8.0 改了什么
MongoDB 的转向，恰恰说明了问题究竟出在哪里。它的 8.0 文档把这一变化与升级后的 [[tcmalloc|TCMalloc]] 分配器联系在一起（新分配器使用按 CPU 的缓存），并要求一组特定的设置，而不只是打开 THP：

| 设置 | 取值 | 排除了什么 |
|---|---|---|
| `transparent_hugepage/enabled` | `always` | （打开 THP） |
| `transparent_hugepage/defrag` | `defer+madvise` | 页错误里的规整停顿，除非某个区域主动要求 |
| `khugepaged/max_ptes_none` | `0` | 合并没被用满的区间，因而不会膨胀 |

MongoDB 的页面并没有逐项解释这些取值；表格最后一列是依据内核文档对各个开关作用的解读。这样读下来，这组设置保住了 TLB 的收益，又去掉了上面三笔代价中的两笔。第三笔——写时复制的放大——只对会 fork 一个庞大而繁忙的堆的程序要紧，那是 Redis 的设计，而不是 MongoDB 的。

页面还提到，在 PPC64LE 和 s390x 架构上，MongoDB 仍使用旧版分配器，所以依旧应当关闭 THP。可见这条建议既取决于内核，也同样取决于分配器。
:::

::scene base

## 更大的基础页

还有一种更直接的办法：把所有东西的最小页都变大。

Apple 在 Apple 芯片上走的就是这条路。搭载 Apple 自研芯片的 Mac 原生使用 16 KiB 的页，而 Intel Mac 用的是 4 KiB。Apple 的移植指南提醒开发者：`PAGE_SIZE` 不再是编译期常量，代码应在运行时读取 `vm_page_size`。[[rosetta|Rosetta]] 则给转译运行的 Intel 进程提供 4 KiB 的页，让它们看到熟悉的环境。在这些机器上运行 Linux 的 Asahi Linux 也用 16 KiB 的页；它的文档解释说，这些芯片的 [[iommu|IOMMU]] 只支持 16K 对齐的页，4 KiB 内核需要各种变通，代价是性能。

Android 也在朝同一个方向走。从 Android 15 开始，AOSP 支持配置为 16 KiB 页的设备。Google 开发者文档根据其初步测试（2024～2025 年发布）报告：内存压力下应用启动平均快 3.16%（部分应用最多快 30%），启动期间功耗平均降低 4.56%，系统启动平均快约 8%（约 950 毫秒）。同一页面也说，16 KiB 设备“平均会多用一点内存”。这又是第 20 章的内部碎片，只不过如今作用在系统里的每一个页上。

基础页不只是一个硬件设置，它还是 [[abi|ABI]] 的一部分，所以这次迁移要花好几年。共享库必须把 [[elf|ELF]] 段按 16 KiB 对齐，否则根本无法映射。[[ndk|NDK]] r28 默认就这样做；更老的工具链需要加 `-Wl,-z,max-page-size=16384`。Google Play 要求面向 Android 15 及更高版本的应用在 64 位设备上支持 16 KiB 页。把 4096 写死的代码、按 4 KiB 调优的分配器，要么浪费内存，要么直接崩溃。想看看你自己的机器用的是多大的页，以及本书这一部分的内容在那上面是什么样子，请看[页大小那篇](/notes/page-size-now)。

Linux 也在填补中间地带。**多尺寸 THP**（multi-size THP）从 Linux 6.8 起作为可选功能提供，允许匿名内存以介于基础页和 2 MiB 之间的块来分配，比如 16 KiB 或 64 KiB，每种尺寸都有自己的 `hugepages-<size>kB` 控制项。这些尺寸比 2 MiB 容易凑得多，只用了一部分时浪费也更少；在 arm64 上，它们还能利用第一个折叠里提到的连续提示位。这是一种不改 ABI、也能拿到 16 KiB 页部分好处的办法。

::scene three

## 回到书里的那条线

第 19 章点出了问题：TLB 覆盖范围。第 20 章开篇给出了最简单的解法——更大的页——又因为内部碎片，用一段话就把它否掉了。真实的系统没法这样一否了之，它们把这个解法拆成了几块：

1. **显式大页**（hugetlbfs）：明知自己需要覆盖范围的程序，提前预留，接受代价。
2. **透明大页**：由内核来猜，在程序背后把内存提升为大页，必要时再拆开。
3. **更大的基础页**：所有东西都承担一点内部碎片，所有东西都得到 4 倍的覆盖范围。

第二种做法在本书自己的参考文献里就有一个精确的祖先。[N+02]，即 Navarro、Iyer、Druschel 和 Cox 的《Practical, Transparent Operating System Support for Superpages》（OSDI 2002），描述了在页错误时预留连续物理内存、在区域填满后把它*提升*（promote）为超级页、在其中一部分需要被换出或改保护时再把它*降级*（demote）。换几个名字，就是 THP 的页错误时分配、khugepaged 合并与拆分。书中给这篇论文写的那句注解，几乎可以当作 THP 头十年的总结：“没你想的那么容易，唉。”

缓存行、磁盘块、数据库页，以及 [PagedAttention](/notes/paged-attention) 里的块，都在做同一个选择：单位多大，在每个单位的管理开销与单位内部的浪费之间权衡。大页是为地址转换这个缓存做的同一种选择。

## 延伸阅读

- [Transparent Hugepage Support](https://docs.kernel.org/admin-guide/mm/transhuge.html)：内核的 THP 文档，包括 `enabled` 和 `defrag` 的各种模式、khugepaged 以及多尺寸 THP。
- [HugeTLB Pages](https://docs.kernel.org/admin-guide/mm/hugetlbpage.html)：显式大页池、启动参数和 `/proc/meminfo` 中的各个字段。
- [Transparent huge pages in 2.6.38](https://lwn.net/Articles/423584/)（LWN，2011 年 1 月）：THP 合入时的设计。
- [Diagnosing latency issues](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/)（Redis 文档）：上文引用的 fork 与 THP 两节。
- [TCMalloc performance optimization](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/)（MongoDB 文档）：8.0 的 THP 设置。
- [Resource consumption: huge_pages](https://www.postgresql.org/docs/current/runtime-config-resource.html)（PostgreSQL 文档）：显式大页，以及关于 THP 的说明。
- [Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes)（Android 开发者文档）：实测收益，以及应用开发者需要改什么。
- Juan Navarro、Sitaram Iyer、Peter Druschel、Alan Cox：*Practical, Transparent Operating System Support for Superpages*，OSDI 2002。即本书的 [N+02]。
