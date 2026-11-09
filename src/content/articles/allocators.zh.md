---
deck: 第 17 章的空闲列表还在里面，只是如今站在尺寸类别、每线程缓存，以及一场以月计的碎片拉锯战后面。
title: 如今的 malloc 到底是什么
---

::scene overview

2019 年 9 月 24 日，[[heroku|Heroku]] 改了平台上所有新应用的一个默认值：设置一个[[env-var|环境变量]]，`MALLOC_ARENA_MAX=2`。按 Heroku 自己文档的说法，原因是 [[glibc|glibc]] 的分配器在 64 位系统上最多会为每个 CPU 核心创建八个内存池；在某些分配模式下，尤其是会创建大量[[thread|线程]]的程序，这些内存池会明显多耗内存。池少一些，用一点速度换来更小的内存占用。

第 17 章的分配程序是一个空闲列表，用最优匹配或首次匹配查找，释放时与邻居合并。你进程里的那个分配器做的是同一件事，却要在纳秒级完成，同时应付几十个线程，还要在一跑就是几个月的服务器里干下去。这篇文章讲的就是这需要些什么，以及其中多少内容那一章其实已经讲过。

::scene book

## 书中分配程序没有的三个问题

第 17 章的工具箱至今仍是真实分配器的家底：每个块前面记录大小的头部、穿过空闲块的空闲列表、分割与合并，以及“其他方法”里的分离空闲列表、Bonwick 的[[slab-allocator|厚块分配程序（slab allocator）]]和二分[[buddy-allocator|伙伴分配程序]]。

::chapter vm-freespace

真实的分配器还多了三项要求：

- **速度。** 分配密集的程序无时无刻不在调用 `malloc` 和 `free`。每次调用都查一遍列表太慢了，常见情况必须只需寥寥几条指令。
- **线程。** 一个空闲列表就意味着一把[[lock|锁]]。64 个线程同时分配时，这把锁就成了整个程序的瓶颈。分配必须大体上在线程或 CPU 本地完成。
- **时间。** 第 17 章用“请求失败”来衡量碎片。长期运行的服务器很少分配失败，因为它总能向操作系统再要。它的失败方式是缓慢膨胀：内存已经释放了却还不回去，直到进程[[oom-kill|因为占用太多而被杀掉]]。

生产级分配器对前两个问题的回答如出一辙：**尺寸类别**加**缓存**；它们的分歧主要在第三个问题上。

::scene common

## 共同的设计：尺寸类别与缓存

把每个小请求向上取整到几十种尺寸之一，并为每个尺寸类别准备只装这一种大小对象的内存区块。在区块内部，分配就是弹出一个元素或扫一下[[bitmap|位图]]，释放就是压回去：无需查找、分割或合并。这就是那一章的分离空闲列表，推广到了所有尺寸，也正是 [变长与定长那篇](/notes/fixed-vs-variable) 追踪的那笔交易：用有界的内部碎片，换区块内部没有外部碎片。

再在最前面放一个小缓存，按类别存放空闲对象，归某个线程或 CPU 私有，让大多数调用不必加锁。缓存空了就从共享结构里成批补货，满了就成批退回。

各家分配器的不同在于：尺寸如何分布，缓存属于线程还是 CPU，区块如何从操作系统的页里切出来，以及内存何时归还。

::scene glibc

## glibc：ptmalloc、arena、bin 与 tcache

大多数 Linux 系统上默认的 `malloc` 来自 glibc，它由 Doug Lea 的 dlmalloc 经 Wolfram Gloger 的 ptmalloc 演变而来，是四者中最接近书中设计的一个。

**块（chunk）。** 每次分配都是一个*块*，前面的头部记录它的大小，和第 17 章一样。块是对齐的，所以大小字段的低几位空着，用来存标志位，比如前一个块是否在用——`free` 正是靠它不用查找就能与邻居合并。

**桶（bin）。** 空闲块放在 128 个*桶*里，即按大小划分的空闲列表。每个*小桶*（small bin）只放一种精确的大小，在 64 位系统上最大约 1 KiB；每个*大桶*（large bin）放一个大小区间，并按大小排好序，以便做最优匹配。刚释放的块先进*未排序桶*（unsorted bin），等下一次 `malloc` 经过时再归入正确的桶。超过 [[mmap|mmap 阈值]]的请求（默认 128 KiB，运行时会上调，64 位系统上最高 32 MiB）完全绕开这些桶，直接从内核拿一段独立的映射。

**arena。** 为了在多线程下扩展，glibc 维护若干相互独立的堆，叫作 *arena*，各有自己的锁和桶。线程发现自己的 arena 被锁住，就换一个或新建一个，64 位系统上最多每个核心八个——Heroku 调成 2 的就是这个上限。arena 多，锁竞争就少；但一个 arena 里释放的内存满足不了另一个 arena 的请求，每个 arena 也各自产生碎片。

**tcache。** glibc 2.26（2017 年）在 arena 前面加了一层每线程缓存，由 DJ Delorie 在 Florian Weimer 和 Carlos O'Donell 协助下贡献。访问它不需要锁；缓存空了再补货时才要拿 arena 的锁。默认每种小尺寸最多缓存七个空闲块，在 64 位系统上覆盖 1032 字节以内的请求；从 glibc 2.42 起，还可以通过配置让它缓存大块。glibc 更早的 *fastbin*——跳过合并的小空闲列表——与它功能重叠，2025 年底提交的补丁已把它们从源码树中移除。

:::fold 一次 malloc 调用，一步一步看
下面是一个小 `malloc` 在 glibc 里走过的路径，经过简化，略去了对齐、`mmap` 分配的块、错误检查和 fastbin。

```c
/* 伪代码：简化的 glibc malloc(n) */
void *malloc(size_t n)
{
    size_t sz = request2size(n);          /* 加上头部，向上取整到 16 字节 */

    if (tcache_has(sz))                    /* 1. 本线程缓存：不加锁 */
        return tcache_pop(sz);

    arena *a = lock_some_arena();          /* 2. 与其他线程共享的堆 */
    chunk *c = smallbin_pop(a, sz);        /*    小请求：查精确大小的列表 */
    if (!c)
        c = scan_unsorted(a, sz);          /* 3. 最近释放的块：精确匹配就拿走，
                                                其余归入各自的桶 */
    if (!c)
        c = largebin_best_fit(a, sz);      /* 4. 最小的够用块；分割它 */
    if (!c)
        c = split_top(a, sz);              /* 5. 从 arena 顶端的块切，
                                                不够就用 brk 或 mmap 扩展 */
    tcache_refill_from_bins(a, sz);        /*    离开前顺手补满缓存 */
    unlock(a);
    return chunk2mem(c);
}
```

第 3、4 步几乎就是第 17 章原文。第 1 步是那一章没有的，而大多数调用到这里就结束了。`free` 是它的镜像：块不加锁地放进 tcache；只有当这个尺寸的缓存满了，才回到 arena，在那里与邻居合并，放进未排序桶。
:::

::scene jemalloc

## jemalloc：处处是尺寸类别

Jason Evans 在 2004 年为自己设计的一门语言写下了 [[jemalloc|jemalloc]]，2005 年起把它改造成 [[freebsd-solaris|FreeBSD]] 的 `malloc`；他在 BSDCan 2006 上的论文就是本书的 [E06]。Mozilla 为 Firefox 分叉了一份，Facebook 在 Evans 2009 年加入后采用了它，Rust 程序也一直默认使用它，直到 Rust 1.32（2019 年）。

jemalloc 是那套共同设计最干净的样板：

- **尺寸类别**，每翻一倍分四档。在 4 KiB 页的 64 位系统上依次是 16、32、48……128，然后 160、192、224、256，然后 320、384、448、512，以此类推。手册写明了后果：除最小的几个类别外，内部碎片被限制在约 20%。
- **slab。** 小对象（4 KiB 页时小于 16 KiB）被装进同一尺寸类别的 *slab*，每个 slab 用一张位图记录哪些槽位在用。这就是 Bonwick 的厚块分配程序，只是去掉了对象构造函数。
- **arena 与线程缓存。** jemalloc 默认按每个 CPU 四个创建 arena，把线程分配上去，前面再放每线程缓存。
- **随时间清退。** 释放的页不会立刻还给内核，而是先标为“脏页”，再逐步清退：默认脏页在大约 10 秒内衰减。这是 jemalloc 对第三个问题的回答，而且是一项可以调节的策略。

2025 年 6 月，Evans 发表了一篇“事后回顾”，说上游的活跃开发已经结束。2026 年 3 月，Meta 宣布重新投入：仓库被解除归档，路线图涵盖技术债、[[huge-page|大页]]、内存效率和 ARM64。

::scene tcmalloc

## tcmalloc：每 CPU 缓存与大页

Google 的 [[tcmalloc|TCMalloc]] 得名于 *thread-caching malloc*（线程缓存式 malloc），它自己的文档如今称这个名字只是历史遗留。它分三层：

- **前端**按尺寸类别缓存空闲对象，默认是每个 *CPU* 一份。它用的是 Linux 的可重启序列（`rseq`）：一小段代码，如果线程在中途被抢占或迁移，内核会中止并让它重来，于是每 CPU 数组的更新既不用锁，也不用[[atomic-cas|原子指令]]。没有 `rseq` 时，退回每线程缓存。
- **中端**为前端补货。每个尺寸类别有一个*转移缓存*（transfer cache），由空闲指针数组组成，让内存在 CPU 之间廉价流动；还有一个*中央空闲列表*，从 *span*（若干 TCMalloc 页组成的一段）里切出对象。
- **后端**向操作系统要内存。较新的页堆是*感知大页*的：在 x86 上以 2 MiB 为单位管理内存，尽量把 span 塞进尽可能少的大页里。

小请求被映射到 60 到 80 个尺寸类别上。`free` 时，TCMalloc 在一棵两层或三层的[[radix-tree|基数树]]里查出指针所属的 span——正是[[multilevel-table|多级页表]]的形状（见 [基数树那篇](/notes/radix-trees)）。

这个感知大页的后端由 Google 的 A.H. Hunter 等人在 OSDI 2021 上发表，它优化的是整台机器，而不是 `malloc` 本身。在八个应用的研究中，它把每秒请求数提高了 7.7%，内存用量降低了 2.4%；在整个机群里，它让 [[tlb|TLB]] 未命中造成的停顿减少了 6%，因碎片浪费的内存减少了 26%。

::scene mimalloc

## mimalloc：空闲列表分片

mimalloc 由微软研究院的 Daan Leijen、Ben Zorn 和 Leonardo de Moura 开发（2019 年），最初为 Koka 和 Lean 两门语言的运行时而写。CPython 的自由线程构建采用了它，因为 Python 自己的小对象分配器在没有[[gil|全局解释器锁]]时不是线程安全的。

它的核心思想是**空闲列表分片**（free list sharding）。不是每个尺寸类别一个大空闲列表，而是每个 mimalloc *页*（64 位系统上通常 64 KiB，只装一个尺寸类别的块）都有自己的空闲列表——准确地说，有三个：

- `free`：`malloc` 从这里弹出；
- `local_free`：所属线程把自己释放的块压到这里；
- `xthread_free`：*其他*线程把它们释放的块压到这里，只需一次原子的[[atomic-cas|比较并交换（CAS）]]。

于是 `malloc` 的快速路径只从一个本线程独享的列表里弹出；每隔一段时间，分配器离开快速路径，把 `local_free` 和 `xthread_free` 并回 `free`——作者称这种节奏为*时间节律*（temporal cadence）。他们 2019 年的报告测得，在 Redis 上 mimalloc 比 tcmalloc 快 7%，比 jemalloc 快 14%。当前的第 3 版简化了无锁设计。

:::fold 为什么是三个空闲列表而不是一个
如果每页只有一个空闲列表，所属线程的 `malloc` 和 `free`、其他任何线程的 `free` 都得共用它。这会迫使每次调用都用原子操作，哪怕是最常见的“一个线程分配、同一个线程释放”的情形。

按*谁在碰它*来拆分列表，冲突就消失了：

```c
/* 伪代码：依照 mimalloc 的设计 */
void *page_malloc(page *p)            /* 仅所属线程调用 */
{
    block *b = p->free;
    if (b) { p->free = b->next; return b; }    /* 快速路径：普通读写 */
    return malloc_generic(p);                  /* 收集 local_free、xthread_free */
}

void page_free(page *p, block *b)
{
    if (p->owner == this_thread) {             /* 本地释放：无原子操作 */
        b->next = p->local_free;
        p->local_free = b;
    } else {                                   /* 远程释放：一个 CAS 循环 */
        do b->next = p->xthread_free;
        while (!cas(&p->xthread_free, b->next, b));
    }
}
```

还有一个更微妙的好处。因为 `free` 从不往 `malloc` 正在弹出的那个列表里压，快速路径注定每隔一阵就会用光，这时慢速路径就会运行。这给了分配器一个规律的、有界的时机去做延后的工作，比如收集远程释放、归还空页，而不需要定时器或后台线程。
:::

::scene overview

## 并排比较

| | glibc | jemalloc | tcmalloc | mimalloc |
|---|---|---|---|---|
| 快速路径 | 每线程 tcache | 每线程 tcache | 每 CPU 缓存（rseq） | 每页空闲列表 |
| 小尺寸 | 精确大小的桶 | 每翻一倍 4 档 | 60 到 80 个类别 | 按尺寸类别划分的页 |
| 并发 | arena，每核 8 个 | arena，每 CPU 4 个 | 转移缓存、中央列表 | 线程本地堆，远程释放用 CAS |
| 归还内存 | 收缩顶端、`malloc_trim` | 按时间衰减脏页 | 感知大页的后端 | 页重置、延后工作 |

每一格背后都藏着可调参数，但骨架是相同的：尺寸类别、无锁的快速路径，以及一个与操作系统打交道的、较慢的共享层。

::scene kernel

## 内核里：伙伴系统与 SLUB

Linux 内核也是同样的两层结构，而两层都在第 17 章里。

物理页来自**伙伴分配器**。空闲内存按*阶*（order）分列表保存，即 2^阶^ 个连续页组成的块，阶通常是 0 到 10（4 KiB 页时为 4 KiB 到 4 MiB；上限是 `MAX_PAGE_ORDER`，Linux 6.8 之前叫 `MAX_ORDER`）。分配时取够用的最小块，一分为二地切到合适大小；释放的块若其伙伴也空闲就与之合并，伙伴的地址只差一位。最前面还有每 CPU 的空闲页列表，成批地补充和退回：又是线程缓存的思路，只是对象换成了页。

更小的对象来自 Bonwick 为 [[freebsd-solaris|Solaris]] 设计的**厚块分配程序**。[[inode|inode]]、[[dentry|dentry]] 这类对象各有专属缓存，通用的 `kmalloc()` 请求则由 `kmalloc-64`、`kmalloc-192` 这样的缓存满足，在 [[procfs|`/proc/slabinfo`]] 里都看得到。Linux 曾经同时有三种实现。SLUB 在 2.6.22 合入，2.6.23（2007 年）成为默认；SLOB 在 6.4 被移除，SLAB 在 6.8 被移除，只剩 SLUB。

:::fold 读懂 /proc/buddyinfo
内核文档给出的示例输出是这样的：

```text
Node 0, zone      DMA      0      4      5      4      4      3 ...
Node 0, zone   Normal      1      0      0      1    101      8 ...
Node 0, zone  HighMem      2      0      0      1      1      0 ...
```

每一列是某一阶的空闲块数，从 0 阶开始。上面的 `Normal` [[memory-zone|区域]]里，有 1 个空闲的单页，没有 2 页和 4 页的空闲块，有 1 个 8 页的块，以及 101 个 16 页的块。文档说明了这个文件的用途：外部碎片在某些负载下是个问题，这个文件能告诉你可以安全地分配多大的区域。

单页请求几乎从不失败，因为任何更大的块都能拆开。而 2^9^ 个连续页的请求，也就是 x86-64 上的一个 2 MiB 大页，即使还有好几 GB 空闲也可能失败——只要没有哪个对齐的 2 MiB 区域是完全空闲的。这时内核会尝试*紧凑*，把可移动的页挪开。它能这样做，是因为页表在它手里：一页被挪走，任何虚拟地址都不用变。
:::

::scene months

## 以月计的碎片

一台跑了一个月的服务器，表现出的症状与第 17 章的“请求失败”不同。[[redis|Redis]] 的文档是这样描述的：往实例里写满 5 GB 数据，删掉 2 GB，进程的[[rss|常驻集大小（RSS）]]多半还在 5 GB 左右，尽管 Redis 报告的使用量只有 3 GB 左右。文档特意补充，这不是 Redis 的毛病，而是大多数 `malloc` 实现的工作方式：剩下的键和被删的键散布在同一批页上，而一页上哪怕只有一个活对象，也还不回内核。

几个原因，大致按你遇到它们的顺序：

- **被钉住的页和 slab。** 一批短命对象里夹着一个长寿对象，就让整个区块和它所在的页一直驻留。
- **缓存与 arena。** 每个线程缓存、每个 arena 都攥着别人用不上的内存，而它们可能有成百上千个。
- **负载在变。** 对象大小随时间变化时，旧尺寸类别的 slab 半满着留在那里，新的 slab 又不断被创建。

::scene defrag

对策也就顺理成章：少用几个 arena，像 Heroku 那样；按时间表归还内存，像 jemalloc 那样；把对象塞紧，让整块大页保持空闲，像 TCMalloc 那样。或者做书里说 C 分配器做不到的事：**紧凑**。`malloc` 移动不了程序还持有指针的对象，但程序自己可以。Redis 的*主动碎片整理*（active defragmentation）只在使用 Redis 自带的那份 jemalloc 时可用，默认关闭；它向 jemalloc 询问某个分配是否落在利用率低的区域，把值复制到更好的位置，再更新自己指向它的指针。搬家由应用来做，因为只有它知道指针在哪里。

::scene book

## 在实验里试试

这个实验就是书中的分配程序：一个空闲列表，可选的匹配策略，可选的合并，堆只有 100 字节。

::lab FreeList

可以试试这些：

- 留意 **查找** 这一列。最优匹配和最差匹配每次分配都要走完整个空闲列表。空闲块成千上万时，这正是尺寸类别省掉的开销：每种尺寸一个列表，第一个元素总是合适的。
- 关掉合并，数一数每种策略下失败的分配，再把合并打开。glibc 的桶里至今仍在合并；尺寸类别分配器在 slab 内部则不需要，因为那里每个槽位一样大。
- 多按几次 **换一组负载**，看哪种策略失败最少。没有始终如一的赢家——这正是那一章自己的结论，也是真实分配器不再靠匹配策略来管理小对象的原因之一。

实验里的堆很小，请求大小均匀随机，所以碎片程度比真实程序夸大了：真实的请求集中在少数几种大小上，这正是尺寸类别奏效的原因。

::scene overview

## 回到书里

带着这些系统重读第 17 章最后一节。分离空闲列表变成了尺寸类别。Bonwick 的 slab 变成了 jemalloc 的 slab、TCMalloc 的 span 和 mimalloc 的页，并且作为 SLUB 仍在内核里运行。伙伴分配器给 Linux 机器上的每一个物理页做分配。空闲列表和匹配策略活在 glibc 的桶里。真正新的东西关乎线程和时间：避开锁的缓存，以及何时归还内存的策略。

那一章还引用了 Hoard [B+00]，它用每处理器的堆来扩展，同时为浪费的内存设定上界。这里的每一个分配器都在回答 Hoard 提出的问题：怎样让 `malloc` 随线程数扩展，又不让内存无限制地增长？

## 延伸阅读

- [mallopt(3)](https://man7.org/linux/man-pages/man3/mallopt.3.html)：glibc 的 arena、mmap 阈值与收缩参数及其默认值。
- [Tuning glibc memory behavior](https://devcenter.heroku.com/articles/tuning-glibc-memory-behavior)（Heroku）：`MALLOC_ARENA_MAX=2` 这个默认值及其原因。
- [jemalloc 手册](https://jemalloc.net/jemalloc.3.html)：尺寸类别、slab、arena 与衰减。
- Jason Evans：[jemalloc Postmortem](https://jasone.github.io/2025/06/12/jemalloc-postmortem/)（2025 年 6 月）；Meta：[Investing in Infrastructure: Meta's Renewed Commitment to jemalloc](https://engineering.fb.com/2026/03/02/data-infrastructure/investing-in-infrastructure-metas-renewed-commitment-to-jemalloc/)（2026 年 3 月）。
- [TCMalloc 设计文档](https://google.github.io/tcmalloc/design.html)：前端、中端、后端与每 CPU 缓存。
- A.H. Hunter 等：[*Beyond malloc efficiency to fleet efficiency: a hugepage-aware memory allocator*](https://www.usenix.org/conference/osdi21/presentation/hunter)，OSDI 2021。
- Daan Leijen、Ben Zorn、Leonardo de Moura：[*Mimalloc: Free List Sharding in Action*](https://www.microsoft.com/en-us/research/publication/mimalloc-free-list-sharding-in-action/)，微软研究院，2019；以及 [mimalloc 代码仓库](https://github.com/microsoft/mimalloc)。
- 内核文档中的 [Physical memory](https://docs.kernel.org/mm/physical_memory.html)：内存区域、空闲区与每 CPU 页列表。
- Jonathan Corbet：[What's next for the SLUB allocator](https://lwn.net/Articles/974138/)（LWN，2024 年 5 月）。
- [Redis 内存优化](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/memory-optimization/)：为什么删除键之后 RSS 依然居高不下。
