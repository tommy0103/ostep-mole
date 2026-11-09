---
deck: 调用一次 fork()，Redis 就能在几分之一秒内拿到一份冻结的、一致的 24 GB 数据集副本。账单是后来才寄到的，一页一页地寄。
title: 把 fork() 当作快照机
---

::scene overview

[[redis|Redis]] 把整个数据集放在内存里，许多部署会要求它每隔几分钟把数据集存到磁盘上。它的配置文件里常见这样一行：`save 60 1000`，意思是如果至少有 1000 个键发生了变化，就每 60 秒写一次快照。写快照的同时，服务器照常应答请求，每秒可能多达几十万个；而磁盘上的文件依然是某一瞬间的精确画面。Redis 的 FAQ 还给出了一个精确的保证：凡是在内存中具有原子性的命令，在快照里也是原子的。

这背后的机制只是一个[[syscall|系统调用]]，正是第 5 章最先介绍的那个：Redis 调用 `fork()`。子进程把数据集写进文件然后退出，父进程回去继续服务客户端，仿佛什么都没发生。

::scene literal

如果照字面理解第 5 章，这听起来不可能。书上说子进程几乎是父进程的一份完全拷贝，而复制 24 GB 内存需要好几秒，还需要另外 24 GB 的 RAM。这篇文章解释为什么 Redis 两样代价都不用预先支付、它实际付出的是什么，以及为什么有些操作系统研究者认为整个思路都该退休了。

## 书里的拷贝，和真实的拷贝

::chapter cpu-api

第 5 章把 `fork()` 介绍为一个奇怪的调用：进去一个进程，出来两个，各自从同一条指令继续执行，各有一份内存、寄存器和打开文件的副本。书中给出的动机是 shell：它需要在子进程里、在 `fork()` 和 `exec()` *之间*运行一些代码。快照是书里没提的第二种用途：fork 出来的子进程看到的父进程内存，恰好是调用那一刻的样子，父进程此后做什么都改变不了子进程看到的东西。这正是“时间点快照”（point-in-time snapshot）的定义。

::scene cow

让它变得便宜的，是书里很久以后才讲到的一个技巧，出现在第 23 章对 [[vax-vms|VAX/VMS]] 的案例研究中：**[[copy-on-write|写时复制]]**（copy-on-write），这个想法至少可以追溯到 [[tenex|TENEX]] 系统。操作系统并不复制[[page|页面]]，而是把同一个物理页映射进两个[[address-space|地址空间]]，并在两边都标记为只读。只要双方都只读，就没人复制任何东西。任何一方第一次写入时会[[trap|陷入]]操作系统，由操作系统复制这一页，把私有副本交给写入者，再让它继续执行。

::scene ptcopy

所以，Linux 上的 `fork()` 并不复制你的内存，它复制的是你的**[[page-table|页表]]**，并在此过程中把每一个可写的私有页变成只读的共享页。第 18～20 章说明了为什么这仍然是实打实的工作：页表要为每一个已映射的页面保存一个条目。

::scene pause

## 一次 fork 的代价

Redis 的延迟文档算过这笔账。在使用 4 KB 页面的 [[x86-64|x86-64]] 上，每个已映射页需要一个 8 字节的[[pte|页表项]]。于是一个 24 GB 的 Redis 实例需要 24 GB / 4 KB × 8 字节 = 48 MB 的页表，每次 fork 都要为子进程再分配并填写 48 MB。这期间父进程无法服务请求，因为 Redis 在单个主[[thread|线程]]上执行命令，而此刻这个线程正卡在 `fork()` 里。

Redis 把最近一次 fork 的耗时记录在 `INFO` 的 `latest_fork_usec` 字段里。它的文档列出了在几种系统上的测量结果。这些数字都有些年头了：表的大部分写于 2012 年 4 月，“新实例类型”那一行是 2014 年 11 月加的。

| 系统 | 常驻内存 | fork 耗时 | 每 GB 耗时 |
|---|---|---|---|
| 物理机，Xeon 2.27 GHz | 6.9 GB | 62 ms | 9 ms |
| 物理机，硬件未知 | 6.1 GB | 80 ms | 13.1 ms |
| VMware 上的大[[hypervisor|虚拟机]] | 6.0 GB | 77 ms | 12.8 ms |
| [[ec2-xen|EC2 旧实例类型（Xen）]] | 6.1 GB | 1,460 ms | 239.3 ms |
| EC2 新实例类型（Xen） | 1 GB | 10 ms | 10 ms |
| Linode 虚拟机（Xen） | 0.9 GB | 382 ms | 424 ms |

按上面物理机每 GB 约 10 ms 的速度，一个 24 GB 的实例每做一次快照，就要停顿大约四分之一秒。这是第一笔代价，而且它随地址空间的大小增长，与数据改动了多少无关。在旧的 Xen 虚拟机上，同样的 fork 要慢十倍以上。文档给 EC2 用户的建议很简单：用较新的 [[hvm|HVM]] 实例类型，比如 `m3.medium`，它们的表现几乎和物理服务器一样。这条建议本身也过时了：AWS 如今已把 M3 列为上一代实例，而 2017 年的 C5 是第一批运行在 AWS 自研监控器 [[ec2-xen|Nitro]] 上的实例。所以 1,460 ms 这一行只能看作 2012 年前后 Xen 虚拟机的历史记录，你自己的机器还是要用 `latest_fork_usec` 实测。

:::fold fork 时和第一次写入时，内核做了什么
::scene cow

下面是简化的伪代码，描述 Linux 对一个私有、可写的[[anonymous-memory|匿名页]]所做的事，大致对应 `mm/memory.c` 里 `copy_present_pte()` 和 `do_wp_page()` 的工作。真实代码还要处理被设备 I/O 钉住的页、[[huge-page|大页]]、交换项以及许多其他情况。

```c
/* 伪代码：fork 时，对父进程的每个已驻留私有页 */
child_pte  = parent_pte;
if (writable(parent_pte)) {
    parent_pte = write_protect(parent_pte);   /* 父进程也失去写权限 */
    child_pte  = write_protect(child_pte);
}
get_page(page);                               /* 多了一个地址空间映射它 */
/* 循环结束后：刷新父进程的 TLB，因为它的页表项刚被修改过 */

/* 伪代码：之后对一个写保护私有页的写操作引发页错误 */
if (only_this_process_maps(page)) {
    pte = make_writable(pte);                 /* 没有别人需要保护：直接复用 */
} else {
    new = alloc_page();
    copy_page(new, page);                     /* 真正的写时复制：4 KB */
    pte = make_writable(mk_pte(new));
    put_page(page);
}
```

::scene afterexit

对 Redis 来说有两个要紧的后果。第一，fork 把*父进程*的页表项也设成了写保护，所以虽然干活的是子进程，为快照买单的却也有父进程。第二，子进程退出后，原本共享的页重新变成独占，但父进程的页表项仍是只读的，每一页的下一次写入仍会触发一次[[page-fault|页错误]]——只不过这次很便宜，只需把页表项改回可写。
:::

::scene snapshot

## 两种快照

Redis 为两件事 fork。

- **RDB 快照。** 子进程把整个数据集以紧凑的二进制格式写入一个临时文件，再用一次原子的 `rename()` 替换掉旧的 `dump.rdb`。由于文件只有在写完之后才出现，复制它永远是安全的。[[replica|副本]]（replica）第一次与主节点同步时加载的 RDB 数据，也由同一套机制产生。
- **AOF 重写。** 仅追加文件（append-only file）记录每一条写命令，它会无限增长，所以 Redis 会定期把它重写成能重建当前数据的最短命令序列。子进程从它冻结的内存视图里写出新的日志。从 Redis 7.0 起，父进程同时把新命令追加到一个新的增量文件中，最后原子地切换一个清单（manifest）文件，把新的基础文件和增量文件串起来。7.0 之前，父进程把这些命令缓冲在内存里，最后再追加上去。

两者遵循同一个模式：子进程读，父进程写，子进程干完就退出。随后父进程在周期性的例行任务里，用非阻塞的 `waitpid(-1, &statloc, WNOHANG)` 收取子进程的退出状态，这就是 `checkChildrenDone()` 函数。一个被遗忘的子进程会变成[[zombie|僵尸]]，那是 [上一篇笔记](/notes/zombies-containers) 的主题。

FAQ 的原子性保证来自时机：Redis 只在两条命令之间 fork，从不在命令执行中途 fork。子进程看到的任何状态，都是由一串完整执行的命令产生的。

::lab Fork

这个实验单步演示第 5 章的 `fork()` 和 `wait()`。可以试试这些：

- 单步走到 `fork()` 之后的那一刻：“相同的代码、内存和程序计数器”。这就是快照。在 Redis 里，子进程此时开始把这份内存写到磁盘上。
- 选择“调度器先运行父进程”。父进程立刻继续执行。在 Redis 里，它回去服务客户端，而从此刻起它写的每一页都会被复制，因为子进程还握着旧版本。
- 加入 `wait()`，看父进程阻塞。Redis 从不这样做，因为阻塞的父进程就无法服务了；它改用 `WNOHANG` 轮询。实验里阻塞的 `wait()` 代表的就是这个检查。

## 理想在哪里弯折

::scene copies

### 迟早要付的拷贝

写时复制推迟了拷贝，但并没有取消它。子进程存活期间，父进程写过的每一页都会被复制一份。如果在一次漫长的快照中父进程把所有数据都改写了一遍，内存占用就会逼近数据集的两倍。写入频繁的负载确实可能让内存接近翻倍。

究竟逼近到什么程度，取决于写操作在页面之间如何分布，而不是改了多少个键。一次很小的更新也会复制整整一页；而在哈希表里，一起被修改的键很少存放在一起。

:::fold 一次快照会复制多少？一个粗略估算
::scene model

把数据集看作 *N* 个页，并假设每次写入都均匀随机地落在某一页上。写入 *n* 次之后，某一页*没有*被写过的概率是 (1 − 1/*N*)^n^，*N* 很大时约等于 e^−n/N^。所以数据集被复制的比例期望为

> 复制比例 ≈ 1 − e^−n/N^

取一个使用 4 KB 页的 24 GB 实例，*N* 约为 630 万。纯粹为了举例，假设它每秒处理 50,000 次写入，快照耗时 60 秒，于是 *n* = 300 万。那么 *n*/*N* ≈ 0.48，复制比例约为 1 − e^−0.48^ ≈ 38%。这大约是 9 GB 的额外内存，在子进程写盘期间一页一页地花掉。

现在让同一个实例使用 2 MB 的页，*N* 就只有 12,288。仅仅一秒之后，*n* = 50,000，*n*/*N* ≈ 4.1，复制比例约为 98%。按这个模型，大页把缓慢爬升的 38% 变成了第一秒内就几乎复制整个数据集。这正是 Redis 文档描述的[[thp|透明大页]]场景：几千次写入就足以复制几乎全部内存。

这个模型很粗糙。真实的写入会集中在热点键上，这有帮助；它们还会碰到分配器元数据和其他簿记信息，这有害。所以 Redis 直接测量真实数字：子进程从 `/proc/self/smaps` 读取自己的 `Private_Dirty` 总量并报告给父进程，后者在 fork 期间通过 `INFO` 的 `current_cow_size` 展示，事后则记为 `rdb_last_cow_size` 或 `aof_last_cow_size`。对大进程来说，读取 `smaps` 本身就很慢（源码中的注释警告可能超过 1000 ms），所以子进程会限制测量的频率。
:::

::scene promise

### 内存超量分配与 OOM killer

内核建立写时复制映射时，每个共享页都是一份承诺：只要任何一方写入，就需要一个新的物理页。谨慎的内核会拒绝这次 fork，除非它能兜住最坏情况——再来一份完整的拷贝。Linux 的默认设置 [[sysctl|`vm.overcommit_memory = 0`]] 采用一种启发式规则，只拒绝明显的超量分配（overcommit）。即便如此，Redis 的 FAQ 仍报告说，在内存紧张的机器上后台保存会因 `fork()` 出错而失败，它一贯的建议是把这个值设为 1，即“总是允许超量分配”。

::scene oom

这只是转移了风险，并没有消除风险。如果后来的拷贝超出了物理内存，内核也没法让引发这些拷贝的 `fork()` 失败，因为它早就返回了。内核只能为[[page-fault|页错误]]去别处找内存，走到最后，就由 [[oom-kill|OOM killer]] 挑一个进程杀掉。Redis 的 `oom-score-adj` 设置在启用时，会让后台子进程成为首选的牺牲品，默认分值为：主节点 0、副本 200、fork 出的子进程 800。丢掉一次快照，总比丢掉服务器强。走到 OOM killer 之前会经历什么——压缩[[swap|交换]]与内存回收——是 [交换那篇笔记](/notes/zram-oom) 的主题。

::scene huge

### 大页

[TLB 覆盖范围与大页](/notes/huge-pages) 解释了 [[huge-page|2 MB 的页]]为什么对 [[tlb|TLB]] 有帮助。但对写时复制来说，它曾经是一场灾难。直到 2020 年，对一个共享的匿名[[thp|透明大页]]的第一次写入，都会让 Linux 分配并复制整整 2 MB，是 4 KB 拷贝的 512 倍，于是几千次写入就可能复制几乎全部内存。Redis 的文档至今仍直截了当地说：关闭透明大页。

内核在 2020 年年中改变了这一行为：一个合入 Linux 5.8 的提交，在提交说明里点名 Redis 是透明大页此前无法使用的负载之一。从那以后，对共享匿名大页的写入会拆分这个映射，只复制被写到的那一个 4 KB 页，与 Linux 早已对文件页大页采取的做法一致。在新内核上，内存暴涨不复存在；但拆分本身有开销，而且父进程会一直用小页映射，直到内核的后台线程把大页重新拼起来。Redis 现在默认带着 `disable-thp yes`：当系统全局设置为 `always` 时，Redis 会通过 [[prctl|`prctl(PR_SET_THP_DISABLE)`]] 请求内核只为它自己的进程关闭透明大页。

:::fold Redis 如何对抗自己的写时复制
::scene rules

Redis 的源码里积累了一组小规则，它们唯一的目的，就是在子进程存活期间让父进程少碰页面。

- **不更新访问时间。** 平时每次查找键都会更新对象头里的 [[lru|LRU]] 或 LFU 字段，所以连一次*读*都会弄脏一页。子进程运行期间，`lookupKey()` 会跳过这次更新；源码注释说，否则会“引发写时复制的疯狂”（trigger a copy on write madness）。
- **不调整哈希表大小。** 扩容或渐进式 rehash 会改写大段的指针数组。`updateDictResizePolicy()` 在有子进程时避免调整大小，以便与写时复制和平共处。
- **在子进程里丢弃内存。** 子进程用不着客户端缓冲区和复制缓冲区，而这些恰恰是父进程在高流量下反复改写的东西。在使用 [[jemalloc|jemalloc]] 的 Linux 上，子进程会提前用 [[madvise|`madvise(MADV_DONTNEED)`]] 释放它们，且只针对大于半页的分配。子进程撤掉自己的映射之后，父进程的下一次写入会发现这一页已是独占，可以直接复用而无需复制。开启透明大页时这一步会被跳过，因为那时 `MADV_DONTNEED` 可能释放不了内存。
- **报告。** `INFO` 展示 `current_cow_size`、`current_cow_peak` 和 `current_fork_perc`，让运维人员在快照进行时就能看到它的内存代价。

每一条都是应用程序在绕着一个操作系统抽象打转：这个抽象免费送了它一份快照，却没法告诉它哪些写入即将变得昂贵。
:::

::scene road

## 《A fork() in the road》

2019 年，Andrew Baumann、Jonathan Appavoo、Orran Krieger 和 Timothy Roscoe 在 HotOS 上发表了一篇论文，题为《A fork() in the road》（一语双关：“岔路口”）。论文摘要称，fork 是为 1970 年代的机器和程序设计的一个巧妙的权宜之计（hack），早已过了它的有用期，如今成了一种负担。论文把 Redis 列为它的主要使用者之一。

论证分好几部分，其中大多数也适用于快照：

- **fork 不是线程安全的。** 子进程得到整个地址空间的副本，却只有调用 `fork()` 的那一个线程。如果另一个线程当时持有一把[[lock|锁]]——比如分配器的锁——子进程就继承了一把锁着的锁，却没有人来解锁。在调用 `exec()` 之前，子进程只能使用[[async-signal-safe|异步信号安全]]的函数，而 [[malloc|`malloc()`]] 不在其列。
- **fork 默认就不安全。** 子进程继承了每一个[[handle|文件描述符]]、内存里的每一个秘密，以及父进程完全相同的内存布局。不调用 `exec()` 的子进程与父进程共享同一套[[aslr|地址空间随机化]]结果，这削弱了随机化的效果（参见 [ASLR 那篇笔记](/notes/aslr)）。
- **fork 很慢。** 论文引用了 Chrome 中高达 100 ms 的 fork 延迟，并测得 fork 加 exec 的耗时随父进程大小增长，而 `posix_spawn()` 无论父进程多大都只需约 0.5 ms。
- **fork 助长了超量分配。** 这就是上文描述的那个权衡，作者认为 fork 把它强加给了整个系统。

他们的建议是：别再用 fork 来启动程序。`posix_spawn()` 直接创建一个运行新程序的进程；[[glibc|glibc]] 从 2.24 版起用带 `CLONE_VM | CLONE_VFORK` 标志的 [[clone|`clone()`]] 来实现它：子进程借用父进程的内存，而不是复制页表，父进程则一直等到子进程调用了 `exec()`。

对快照，论文的态度要宽容一些。它把“对运行中的进程拍一份一致的快照”（以持久化为例）列为写时复制的正当用途。它抱怨的是，应用程序为了得到快照不得不创建一整个进程；它建议 [[posix|POSIX]] 提供一个独立于进程创建的写时复制内存接口。

也有人从两头着手解决这个问题。内核这一头，*On-demand-fork*（Zhao、Gong 与 Fonseca，EuroSys 2021）让页表本身也写时复制，把复制页表的工作从 `fork()` 推迟到页错误处理程序里。应用这一头，与 Redis 兼容的 Dragonfly 干脆不 fork 就拍快照：每个分片序列化自己的数据，一个钩子在写操作修改某个条目之前，先把它的旧值写进快照。这又是写时复制，只不过是在应用里按键来做，而不是在内核里按页来做。Redis 8.10 新增了 `BACKUP` 命令族，其设计让集群的控制平面可以错开各节点的快照时间，免得所有节点同时 fork。

::scene overview

## 回到书里的那条线

第 5 章问：为什么有人会把创建进程设计成一对古怪的调用？它给出的答案是 shell。Redis 给出了第二个答案：在 UNIX 上，`fork()` 是程序获得一份一致的、私有的、写时复制的自身内存视图的标准、可移植的办法。这份视图由本书中的三种机制搭成：第 13 章的进程私有地址空间，第 18～20 章的页表，以及第 21 章的页错误——在这里，它被用来复制一页，而不是从磁盘读入一页。

这里的权衡，正是虚拟内存一贯的权衡：用一个便宜的承诺和许多细小的惰性操作，替代一次昂贵的急切操作——复制 24 GB。在负载来兑现之前，这份承诺几乎是免费的；一旦兑现，账单就取决于这个抽象本想隐藏的细节：页大小、写入的局部性、剩余的内存余量。Chrome 用同样的承诺，从预先初始化好的 [zygote](/notes/chrome-processes) 里廉价地启动渲染进程；Redis 用它来保存数据。这个已有 50 年历史的调用至今仍有争议，正因为它一身兼了这么多份差事，每一份都带着同样的权衡。

## 延伸阅读

- [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)（Redis 文档）：RDB 快照和 AOF 重写如何使用 fork，包括 Redis 7.0 的多文件 AOF。
- [Diagnosing latency issues](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/)（Redis 文档）：页表的算术、fork 耗时的测量，以及关于透明大页的警告。
- 上文日期的出处，Redis 文档的两次提交：[加入 fork 耗时表](https://github.com/redis/redis-doc/commit/18caa09945d079be04de8fec5b15d8b5b553c25e)（2012 年 4 月）和[把 EC2 分成新旧实例类型](https://github.com/redis/redis-doc/commit/85588b658a4383afc116f9fdfab8e61ecbed61bb)（2014 年 11 月）。
- Brendan Gregg：[AWS EC2 Virtualization 2017: Introducing Nitro](https://www.brendangregg.com/blog/2017-11-29/aws-ec2-virtualization-2017.html)：EC2 如何从 Xen 半虚拟化一路走到 Nitro。
- [Redis FAQ](https://redis.io/docs/latest/develop/get-started/faq/)：后台保存为何会因 `fork()` 出错而失败，快照为何是原子的。
- Andrew Baumann、Jonathan Appavoo、Orran Krieger、Timothy Roscoe：[*A fork() in the road*](https://www.microsoft.com/en-us/research/uploads/prod/2019/04/fork-hotos19.pdf)，HotOS 2019。
- [Overcommit accounting](https://docs.kernel.org/mm/overcommit-accounting.html)（Linux 内核文档）：`vm.overcommit_memory` 的三种模式。
- [`fork(2)`](https://man7.org/linux/man-pages/man2/fork.2.html) 与 [`posix_spawn(3)`](https://man7.org/linux/man-pages/man3/posix_spawn.3.html)（Linux 手册页）：写时复制、多线程程序中的 fork，以及 glibc 用 `CLONE_VFORK` 实现的 spawn。
- [thp: change CoW semantics for anon-THP](https://github.com/torvalds/linux/commit/3917c80280c93a7123f1a3a6dcdb10a3ea19737d)（Linux 提交，2020 年）：为什么大页的写时复制如今只复制 4 KB。
- [On-demand-fork](https://github.com/rssys/on-demand-fork)（Zhao、Gong、Fonseca，EuroSys 2021）：让页表也写时复制，从而加快 fork。
- [Dragonfly snapshotting](https://www.dragonflydb.io/docs/managing-dragonfly/snapshotting)（Dragonfly 文档）：不用 fork 的时间点快照。
