---
deck: 精确的 LRU 要求每次访问都做功，没有哪个追求速度的系统负担得起。Linux、Redis、PostgreSQL 和你的 CPU 都改为给每一项记一个廉价的提示，再成批地做决定。
title: 没有人实现真正的 LRU，而这没什么不好
---

::scene overview

Salvatore Sanfilippo 给 [[redis|Redis]] 加 LRU 淘汰时，在每个对象头里只能腾出 24 位，再多就没有了。链表需要的两个指针放不下，每次读都要更新的数据结构也负担不起。于是他把每个键最近一次访问的时间记在这 24 位里；内存用完时，随机挑三个键，淘汰其中闲置最久的那个。后来“三个”变成了可配置的数字，默认是五。用他自己的话说：“既然 LRU 本身就是对我们真正想要的东西的近似，何不干脆近似 LRU 本身？”

第 22 章对页面做的是同样的论证：LRU 在局部性上押得很准，但完美的 LRU 代价太高，所以这一章最后落在一个使用位和一根时钟指针上。本文沿着这个折中，走过 Linux 的页[[reclaim|回收]]、Redis、一个数据库[[buffer-pool|缓冲池]]，以及你 CPU 里的缓存。它们没有一个实现了真正的 LRU。

::scene exact

## 真东西为什么太贵

::chapter vm-beyondphys-policy

LRU 的规则很简单：淘汰最近一次使用离现在最久的那一项。麻烦在于记账。要随时知道是哪一项，你必须在*每次访问*时做功，而不只是每次淘汰时；访问次数比淘汰次数多出好几个数量级。

这笔开销在每一层的表现不同：

- **页面。** 要在每次访问时把页挪到链表头部，硬件就得在每次读写时陷入操作系统，或者每次都写一个时间戳。它负担得起的，只是在 PTE 里置一个位：访问位（accessed bit）。
- **软件缓存。** 双向链表式的 LRU 每项要两个指针，在 64 位机器上是 16 字节，而且每次读都变成了一次对共享链表指针的写。[[thread|线程]]一多，这次写就需要加[[lock|锁]]。[[sieve|SIEVE]]（NSDI 2024）的作者直接点明了这一点：他们的算法命中时无需加锁，原型的吞吐量达到了经过优化的 16 线程 LRU 的两倍。
- **[[cpu-cache|CPU 缓存]]。** [[set-associative|*n* 路组相联缓存]]的每一组都得记住其 *n* [[cache-line|行]]的先后顺序。可能的顺序有 *n*! 种，所以精确 LRU 每组至少需要 log~2~(*n*!) 位，而且每次命中都要更新。

把这笔账和常见的近似方案“[[tree-plru|树形伪 LRU]]”（tree-PLRU，需要 *n* − 1 位）放在一起算：

| 每组路数 | 顺序数（n!） | 精确 LRU 位数 | tree-PLRU 位数 |
|---|---|---|---|
| 4 | 24 | 5 | 3 |
| 8 | 40,320 | 16 | 7 |
| 16 | 约 2.1 × 10^13^ | 45 | 15 |

状态的增长比缓存本身更快，而且每一位都得在命中的同时更新。硬件于是选了最右边那一列。

::scene clock

## 时钟算法，以及从它长出来的东西

本章的答案是时钟算法，出自 Corbató 在 [[multics|Multics]] 上的工作。每页有一个使用位，访问时由硬件置 1。所有页排成一圈，一根指针扫过去：使用位为 1 的页得到“第二次机会”，位被清零，指针继续走；第一个使用位为 0 的页被淘汰。开销从每次访问挪到了每次淘汰，而硬件只需要置位。

::scene family

几乎所有实用的策略都是对它的改进，大致分成几类：

- **不止一位。** [[postgresql|PostgreSQL]] 的缓冲区管理器给每个缓冲区一个使用计数，每被 [[buffer-pin|pin]] 一次加一，上限为 5（`BM_MAX_USAGE_COUNT`）。它的时钟扫描每经过一个缓冲区就把计数减一，取第一个减到 0 的。常用的缓冲区能熬过好几轮扫描，而不只是一轮。
- **优先挑便宜的牺牲者。** 本章自己的变体会参考脏位，先淘汰干净页，因为淘汰脏页要多一次写。
- **抗扫描。** 本章的循环访问负载是 LRU 的最坏情况：一次比缓存还大的顺序扫描会把所有东西挤出去，而它带进来的东西之后再也不会被用到。PostgreSQL 在策略之外处理这个问题：大的顺序扫描拿到一个私有的 256 KB 缓冲环，循环复用，而不去淹没共享缓存。
- **命中时少做事。** SIEVE 按 FIFO 顺序存放对象，每个对象一个“已访问”位。它的指针从旧往新移动，清掉已访问位，淘汰第一个未访问的对象。和时钟算法不同，幸存者从不被挪动位置。

::scene clock

## 动手试试

这个实验让书中的各种策略跑同一条访问序列，其中 CLOCK 就是本章的单使用位版本。

::lab Replacement

可以试试这些：

- 选 **80-20**、3 个帧。LRU 和 OPT 一样，24 次里命中 20 次；CLOCK 却只和 FIFO、RANDOM 打平，命中 18 次。在这么短的序列上，一位历史信息（“指针上次经过之后用过没有？”）实在不够用。本章的图 22.5 用的是更长的运行，在那里 CLOCK 落在 LRU 和不看历史的策略之间。
- 选 **循环访问**：6 个页、5 个帧。LRU、FIFO 和 CLOCK 每次都未命中，RANDOM 反而命中 14 次。抗扫描的设计正是为这种情形而存在的。
- 选 **Belady 异常**，看那几条曲线。从 3 个帧增加到 4 个帧时，FIFO 的命中率下降了，CLOCK 的也一样。LRU 不会这样，因为它是一种栈算法（stack algorithm）：*k* 个帧的缓存所装的内容，永远是 *k* + 1 个帧时内容的子集。近似算法丢掉了这个保证。
- 始终让 OPT 留在屏幕上。它是衡量所有这些策略的标尺，没有一个能胜过它。

::scene twolist

## Linux：两个链表，然后是“代”

在大部分历史中，Linux 用两个链表来近似 LRU：**活跃**（active）和**非活跃**（inactive），内核注释称之为“双时钟链表”（double CLOCK lists）。新的文件页先进入非活跃链表；在那里再次被引用的页提升到活跃链表；活跃链表太长时，从它尾部降级一些页。回收从非活跃链表的尾部挑牺牲者。一页要证明自己两次才能受到保护，这带来了一定的抗扫描能力。匿名页和文件页各有一对这样的链表，每个内存 [[cgroup|cgroup]] 也各有自己的一套。

::scene rmap

内核怎么知道一页被引用过？对映射到地址空间的页，硬件在 PTE 中置访问位，回收时再沿着[[rmap|反向映射]]（reverse map）从页找到所有映射它的 PTE。对通过 `read()` 读取的页，没有 PTE，内核就自己打标记。

:::fold “标记已访问”长什么样
下面是 Linux 6.12 `mm/swap.c` 中的 [[folio|`folio_mark_accessed()`]]，注释有所精简：

```c
/*
 * folio_mark_accessed - Mark a folio as having seen activity.
 *
 * This function will perform one of the following transitions:
 *
 * * inactive,unreferenced	->	inactive,referenced
 * * inactive,referenced	->	active,unreferenced
 * * active,unreferenced	->	active,referenced
 */
void folio_mark_accessed(struct folio *folio)
{
	if (lru_gen_enabled()) {
		folio_inc_refs(folio);
		return;
	}

	if (!folio_test_referenced(folio)) {
		folio_set_referenced(folio);
	} else if (folio_test_unevictable(folio)) {
		/* 不可回收的 folio 从不轮转，无事可做 */
	} else if (!folio_test_active(folio)) {
		if (folio_test_lru(folio))
			folio_activate(folio);
		else
			__lru_cache_activate_folio(folio);
		folio_clear_referenced(folio);
		workingset_activation(folio);
	}
	if (folio_test_idle(folio))
		folio_clear_idle(folio);
}
```

每页两个标志，`referenced` 和 `active`，构成一个小状态机。第一次访问置 `referenced`；页还在非活跃链表上时的第二次访问，把它移到活跃链表并清掉这个标志。这就是时钟算法的“第二次机会”，只是摊在了两个链表上。

注意第一个分支：启用[[mglru|多代 LRU]] 时，这次访问只是用 `folio_inc_refs()` 计个数，这个计数供下文要讲的“层”（tier）使用。

::scene refault

还有一个部件让双链表设计具备了自适应能力。文件页被淘汰时，内核在它原先占据的[[page-cache|页缓存]]槽位里留下一个“[[shadow-entry|影子表项]]”（shadow entry），记下淘汰时的时间戳。如果这一页很快又被读回，内核就算出它的“[[refault|回迁距离]]”（refault distance）：其间又淘汰了多少别的页。如果这个距离小到“活跃链表再大一点它就不会被淘汰”，这一页就立即被激活。（`mm/workingset.c` 解释了这一设计。）影子表项是存放在页缓存基数树里的一个值，见[多级页表就是一棵基数树](/notes/radix-trees)。
:::

双链表设计用了很久，但到 2021 年 Yu Zhao 发布[[mglru|多代 LRU]] 时，它的弱点已人所共知。[[lwn|LWN]] 对他的论点的概括是：活跃/非活跃的划分太粗，做不出好的决策；不同 cgroup 的链表之间无法相互比较；而通过反向映射去找映射页的访问位代价高昂。

::scene mglru

**MGLRU** 合入了 Linux 6.1；Linus Torvalds 在 2022 年 10 月的 6.1-rc1 公告中，把它列为“酝酿已久的核心改动”之一。它用一个滑动窗口里的若干**代**（generation）取代两个链表，任何时候都有 2 到 4 代（`MIN_NR_GENS`、`MAX_NR_GENS`），每一代是一组访问新近程度相近的页。Zhao 把这个机制描述为“有两根指针的时钟”：老化（aging）指针把被访问过的页移入最年轻的一代，淘汰（eviction）指针从最老的一代取页。

::scene walk

有意思的设计决定在于老化指针去哪里看。MGLRU 不是逐页访问再去搜索映射它的 PTE，而是直接遍历进程的页表，这样局部性更好：相邻的 PTE 共享缓存行。页表可能非常稀疏，所以一个[[bloom-filter|布隆过滤器]]（Bloom filter）会记住哪些页表页里年轻表项足够多、值得下次再扫。在 x86 上，遍历还能跳过上层表项显示无人访问的整段范围。

:::fold 代、层和一个反馈回路
::scene mglru

内核文档（`Documentation/mm/multigen_lru.rst`）把各个部件讲得很精确。概括如下：

- **序号。** 每个 [[lruvec|lruvec]] 为匿名页和文件页分别保存 `max_seq`（最年轻的一代）和 `min_seq`（最老的一代），两者都只增不减。一页属于哪一代，记在它标志位里的一个小计数器中，按 `MAX_NR_GENS` 取模截断。
- **老化。** 当代数接近下限时，老化把 `max_seq` 加一，创建新的最年轻一代。通过页表发现被访问过的页，访问位被清零并提升到新的一代。其余的页不必触碰，就自然落后了一代：文档的说法是降级“随之发生”，这正是这套方案便宜的原因。
- **淘汰。** 淘汰从最老的一代取页，那一代取空后把 `min_seq` 加一。如果两种类型一样老，就比较回迁率，在匿名页和文件页之间做选择。
- **层。** 在同一代内，通过文件描述符被访问 *N* 次的页位于第 log~2~(*N*) 层。在层之间移动只需原子地更新标志位，不用拿 LRU 锁。
- **[[pid-controller|PID 控制器]]。** 一个仿照比例-积分-微分（PID）控制器的反馈回路按层、按类型监视回迁，决定保护哪些层。它以“代”而不是挂钟时间作为时间基准，因为扫描速度随内存压力变化。

由于每一代在诞生时都打了时间戳，这里对第 22 章的抖动问题也有了直接的回答：设置 `min_ttl_ms` 后，比这更年轻的工作集受到保护；保不住时就运行 [[oom-kill|OOM killer]]（见[今天的交换](/notes/zram-oom)）。

据 LWN 2021 年的报道，MGLRU 的宣称效果是定性的，但覆盖面很广：Android 上低内存杀进程的次数更少，Chrome OS 上内存不足杀进程的次数更少，服务器能更好地利用可用内存。它依然是 LRU 的近似，只是粒度更细；搭起它的部件也和时钟算法一样：一个硬件位，一轮周期性的扫描，一次廉价的批量决定。
:::

MGLRU 是可选的。用 [[kconfig|`CONFIG_LRU_GEN`]] 构建的内核会提供 `/sys/kernel/mm/lru_gen/enabled`，默认是否开启由 `CONFIG_LRU_GEN_ENABLED` 决定。两套设计在源码中并存，上面的 [[folio|`folio_mark_accessed()`]] 就显示了这个岔路口。

::scene redis

## Redis：用抽样代替排序

回到 Redis：它的键根本没有任何顺序。每个对象头里有一个 24 位的 `lru` 字段。在 LRU 策略下，它存的是一个分辨率为一秒的时钟（`LRU_CLOCK_RESOLUTION` 为 1000 ms），所以 2^24^ 秒、约 194 天后回绕；这无伤大雅，因为活跃的键被访问得频繁得多。淘汰时，Redis 随机抽取 `maxmemory-samples` 个键（默认 5 个），淘汰其中闲置最久的。

Redis 3.0 加了一处改进：一个候选者组成的**淘汰池**（eviction pool，今天的源码里是 16 个，`EVPOOL_SIZE`）。每轮抽样都把抽到的键交给淘汰池，池里保留迄今为止最好的候选者，于是好的候选者不会在两次淘汰之间被扔掉。在 Redis 文档与真正 LRU 的对比中，取 10 个样本时，Redis 3.0 已“非常接近理论表现”；对幂律分布的访问模式，差别微乎其微甚至没有。

:::fold 五个样本到底有多好？
假设所有键按闲置时间排序，抽样从中均匀随机地取 *N* 个。样本里最老的那个键落在全体最老的 *q* 比例之中，除非每个样本都没落进去，所以概率是 1 − (1 − *q*)^N^：

| 样本数 N | 落在最老的 10% | 落在最老的 50% |
|---|---|---|
| 1（随机淘汰） | 10% | 50% |
| 5（Redis 默认） | 41% | 97% |
| 10 | 65% | 99.9% |

五个样本时，你很少淘汰掉最老的那个键，但几乎从不淘汰年轻的键。对缓存来说这是正确的失败方式：LRU 的价值在于不扔掉热数据，而热数据只占键的一小部分。淘汰池能改善第一列，因为候选者会跨轮次积累。这个模型忽略了淘汰池，并假设样本独立且均匀，所以应把它看作下限。

::scene lfu

在 Redis 4.0 加入的 [[lfu|LFU]] 策略下，同样这 24 位身兼二职：高 16 位存以分钟计的最近访问时间，低 8 位存一个对数计数器，即 [[morris-counter|Morris 计数器]]，用来近似访问频率。下面摘自当今 Redis 的 `evict.c`：

```c
uint8_t LFULogIncr(uint8_t counter) {
    if (counter == 255) return 255;
    double r = (double)rand()/RAND_MAX;
    double baseval = counter - LFU_INIT_VAL;
    if (baseval < 0) baseval = 0;
    double p = 1.0/(baseval*server.lfu_log_factor+1);
    if (r < p) counter++;
    return counter;
}
```

新键从 `LFU_INIT_VAL`（值为 5）起步，免得还没来得及被用到就被淘汰。此后每一次加一都比上一次更难。按默认的 `lfu-log-factor` 10，文档里的表格显示：100 次命中后计数器为 10，1,000 次后为 18，100,000 次后为 142，到一百万次时饱和于 255。只增不减的计数器会永远记着去年的热键，所以它还会衰减：默认情况下，自该键上次访问以来每过一分钟（`lfu-decay-time`）就减一，在下次检查这个键时结算。八个位、一点随机性和一个时钟，代替了一张频率直方图。
:::

Redis 8.6 又加入了 LRM（最近最少修改），只在写操作时更新时间戳，用的是同一个抽样器。一旦有了廉价的逐键提示和一个抽样器，新策略基本上就只是一条更新提示的新规则。

::scene plru

## CPU 内部：伪 LRU，以及在插入时下注

处理器厂商很少公开它们的替换策略，所以人们知道的都来自测量。Andreas Abel 和 Jan Reineke 的 nanoBench 工具通过微基准测试推断替换策略，uops.info 公布了结果。他们发现，从 [[intel-microarch|Haswell]] 到 Coffee Lake 的 Intel 核心，8 路 [[cache-levels|L1]] 数据缓存用的都是 tree-PLRU；Ice Lake 的 12 路 L1 则是由三棵 4 路 PLRU 树拼成的变体。

tree-PLRU 可以看作硬件里的时钟算法的表亲。一组中的各路是一棵二叉树的叶子，每个内部节点存一位，指向较久未用的那一半。命中时，把路径上的位翻转为背离刚用过的那一行；淘汰时，从根顺着这些位走下去。总共 *n* − 1 位，每次命中更新一条路径。

::scene dueling

再往外，测出来的策略就不那么像 LRU，而更像预测了。同样的测量把近年 Intel 核心的 L2 和 L3 缓存描述为一族叫 QLRU 的基于“年龄”的策略：每行记一个小小的年龄，而不是一个顺序。在 Haswell 和 Broadwell 上，L3 中有少数专用组分别运行两种相互竞争的策略，其余的组跟随当前未命中更少的那一种。这种技术叫“组决斗”（set dueling），由 Qureshi 等人在 ISCA 2007 上提出。他们的关键观察是：新行*插在哪里*，和淘汰谁一样重要。把新行插在 LRU 端而不是 MRU 端，能保护缓存不被比它还大的访问模式冲垮。RRIP（Jaleel 等人，ISCA 2010）把这一点推广为：逐行预测它多久之后会被再次引用。

这又是本章的抗扫描问题，只不过是用每行几个位在芯片里解决的：一行得先表明自己会被复用，才有资格挤掉那些已经证明过自己的行。

::scene bends

## 理想在哪里弯折

这些近似各有各的典型失败方式：

- **一位忘得太快。** 只有一个使用位的时钟算法，分不清“上轮扫描以来用过一次”的页和“用过一千次”的页。计数器（PostgreSQL）、层（MGLRU）和 LFU 计数器（Redis）补上了对频率的记忆。
- **扫描提示本身要花钱。** Linux 通过反向映射读取访问位，在内存压力下是出了名的 CPU 开销。MGLRU 用页表遍历和布隆过滤器来对付它，但这些也带来了自己的复杂性。
- **对扫描而言，新近程度是错误的信号。** 上面每个系统都为“不会再用的数据”准备了特殊处理：非活跃链表、缓冲环、在 LRU 端插入。本书小结提到的 [[arc|ARC]] 是另一种答案，探索仍在继续。

::scene overview

## 回到书里的那条线

第 22 章说，任何周期性地清除使用位、再区分 1 和 0 的方法都行得通。本文中的系统在四个层次上把这句话付诸实践：

1. 一个**廉价的逐项提示**，在访问时更新：PTE 访问位、24 位时钟或 Morris 计数器、使用计数、几个 PLRU 位。
2. 一个**周期性或批量的决定**，在淘汰时做出：一根时钟指针、五个样本、一次代的推进、沿位树走一趟。
3. 一道**抗扫描的防线**，因为单看新近程度，会被只用一次的数据骗过。

它们谁都没有去做真正的 LRU 在每次访问时都要做的那份记账。近似本身就是设计。同样的权衡出现在[缓存](/notes/caching-everywhere)的每一个层次。

## 延伸阅读

- [Multi-Gen LRU](https://docs.kernel.org/mm/multigen_lru.html)：内核的设计文档，讲代、层、布隆过滤器和 PID 控制器。
- [Multi-Gen LRU（管理员指南）](https://docs.kernel.org/admin-guide/mm/multigen_lru.html)：如何启用，以及 `min_ttl_ms` 抖动防护。
- [The multi-generational LRU](https://lwn.net/Articles/851184/)（LWN，2021 年 4 月）：最初的补丁集，以及活跃/非活跃链表的问题。
- [Merging the multi-generational LRU](https://lwn.net/Articles/894859/)（LWN，2022 年 5 月）：LSFMM 上的讨论，以及 Yu Zhao 的“两根指针的时钟”。
- [Linux 6.1-rc1](https://lwn.net/Articles/911366/)：Linus Torvalds 宣布合入的公告。
- [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/)：Redis 的近似 LRU、LFU、LRM，以及 `maxmemory-samples`。
- [Random notes on improving the Redis LRU algorithm](http://antirez.com/news/109)（antirez，2016）：24 位的由来、抽样与淘汰池。
- [PostgreSQL 缓冲区管理器 README](https://raw.githubusercontent.com/postgres/postgres/master/src/backend/storage/buffer/README)：带使用计数的时钟扫描与缓冲环。
- [SIEVE is Simpler than LRU](https://www.usenix.org/conference/nsdi24/presentation/zhang-yazhuo)（NSDI 2024）：一种基于 FIFO、命中无需加锁的淘汰算法。
- [uops.info: caches](https://uops.info/cache.html)：实测的 Intel L1、L2、L3 缓存替换策略。
- Moinuddin Qureshi、Aamer Jaleel、Yale Patt、Simon Steely Jr.、Joel Emer：*Adaptive Insertion Policies for High Performance Caching*，ISCA 2007：插入策略与组决斗。
- Aamer Jaleel、Kevin Theobald、Simon Steely Jr.、Joel Emer：*High Performance Cache Replacement Using Re-Reference Interval Prediction (RRIP)*，ISCA 2010。
