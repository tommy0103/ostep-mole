---
deck: 现代系统把被换出的页压缩后留在内存里，而不是写到磁盘；它们盯着任务因等内存而停滞了多久，并在内核被迫出手之前，主动杀掉一个进程。
title: 今天的交换：先压缩，再测停滞，最后才杀进程
---

::scene overview

2020 年，Fedora 33 在新安装的系统上不再创建交换分区。取而代之的是每次开机时建立一个位于内存中的交换设备 [[zram|`/dev/zram0`]]，大小为物理内存的一半，上限 4 GiB。换到它上面的页被压缩后仍留在内存里。这项变更提案的作者 Chris Murphy 在第一行就写明了理由：“交换是有用的，只要它不慢。”

你的手机早几年就做了同样的选择。Android 的闪存上没有交换分区；它把闲置的[[anonymous-memory|匿名内存]]压缩进 zram，内存仍然不够时，一个名叫 [[lmkd|`lmkd`]] 的用户态[[daemon|守护进程]]会杀掉一个后台应用。这并不是故障。在低内存手机上，系统本来就设计成这样运行，你过会儿再切回那个应用时，它只是被重新启动而已。

第 21、22 章描述的是另一个世界：交换空间在旋转磁盘上，页守护进程由低水位线唤醒，而在最后，还有一个“严厉”的[[oom-kill|内存不足杀手]]。本文讲的是这些部件被什么取代了，以及书里的哪些思想幸存了下来。

::scene book

## 书中的机制，以及它的代价

::chapter vm-beyondphys

第 21 章给出了机制。PTE 的存在位为 0 时，页在交换空间里，访问它会引发页错误。操作系统找一个空闲帧（必要时先淘汰一个牺牲页），从磁盘读入该页，修好 PTE，再重试。为了手头总有空闲帧，交换守护进程会在空闲页低于低水位线时醒来，一直淘汰到高水位线为止。

Linux 至今仍是这样工作的。这个守护进程叫 `kswapd`，水位线由 [[sysctl|`vm.min_free_kbytes`]] 推算而来；另一个参数 `watermark_scale_factor` 决定水位线之间的间距，默认是内存的 0.1%。

变的是慢路径的代价。第 22 章说得很直接：如果换页到磁盘足够昂贵，什么替换策略都救不了你，只能去买更多内存。磁盘的一次随机读要几毫秒；按下面实验里的数字（10 ms 对 100 ns），那是一次 DRAM 访问的 100,000 倍。[[ssd|闪存]]快得多，但写多了会磨损，而手机既担不起这种延迟，也担不起这种磨损。人们的回应不是放弃交换，而是把它挪个地方。

::scene two-kinds

## 为什么还要交换

很容易得出结论：干脆把交换关掉就好。内核内存管理开发者 Chris Down 在 2018 年撰文指出，这是误解了交换的用途。Linux 里有两类页：

- **文件页**缓存文件内容。干净的文件页随时可以丢掉，需要时再从文件读回来。
- **匿名页**存放堆和栈。它们背后没有文件，没有交换空间就永远无法被淘汰。

没有交换，闲置的匿名内存就被钉死在内存里，所有[[reclaim|回收]]压力都落到文件页上，包括正在运行的程序的代码。系统照样会[[thrashing|抖动]]，只不过抖的是文件页而不是交换。用 Down 的话说，交换“首先是一种让回收机会均等的机制”，而不是应急用的内存。压缩交换保留了这种均等，同时去掉了磁盘。

::scene zram

## zram：用内存做成的交换设备

zram 是一个[[block-device|块设备]]驱动。写到 `/dev/zramN` 的页被压缩后，存进按需分配的内存里。把它用作交换设备，内核的交换代码一行都不用改：它照常把一个 4 KiB 的页写到一块“磁盘”上，只不过这块磁盘碰巧是一个压缩器加一个内存分配器。zram 在内核的 [[kernel-staging|staging 区]]待了大约四年，才在 Linux 3.14（2014 年）成为正式驱动。

```sh
modprobe zram
cat /sys/block/zram0/comp_algorithm     # 列出可用压缩算法；方括号标出当前所选
echo zstd > /sys/block/zram0/comp_algorithm   # 必须在设置 disksize 之前
echo 4G   > /sys/block/zram0/disksize
mkswap /dev/zram0
swapon --priority 100 /dev/zram0
cat /sys/block/zram0/mm_stat            # orig_data_size compr_data_size mem_used_total ...
```

比命令更要紧的是算术。内核文档建议 zram 设备不要超过内存的两倍，“因为我们预期 2:1 的压缩比”。Fedora 的提案把例子算了出来：16 GiB 内存的机器配一个 4 GiB 的 zram 设备，若以 2:1 装满 4 GiB 匿名页，要占用 2 GiB 内存。净收益是 2 GiB，而不是 4 GiB。提案对此很坦白：swap-on-zram 的淘汰效率大约只有磁盘交换的一半，但“至少快一个数量级”。

有几处细节让这笔交易比压缩比看上去更划算：

- **同值页不占空间。** 整页都是同一个重复值（通常是 0）的页，只记下这个值。`mm_stat` 里的 `same_pages` 统计这类页，文档写明“不会为这些页分配内存”。
- **不可压缩的页会被记账。** `huge_pages` 统计压缩不了的页。启用 [[kconfig|`CONFIG_ZRAM_WRITEBACK`]] 后，管理员可以把这些页，或闲置超过一定时间的页，写到真正的后备设备上。
- **可以告诉内核交换很便宜。** `vm.swappiness` 的取值范围是 0 到 200，表示交换 I/O 相对文件 I/O 的成本，100 表示二者相当。文档建议对 zram、zswap 这类内存中的交换使用大于 100 的值。

Android 走得更远。Android 17 加入了内存管理守护进程 `mmd`，它在开机时配置 zram，并在后台做维护：把闲置页写到闪存上的一个文件里，以及用压缩比更高的第二种算法重新压缩闲置页。后一步本身就是一个小小的替换策略：最不可能被用到的页，享受最昂贵的处理。

::scene zswap

## zswap：架在真实磁盘前面的压缩缓存

[[zswap|zswap]] 于 Linux 3.11（2013 年）合入，它在另一个位置解决同一个问题。它不是交换设备，而是交换设备前面的一层缓存。当一个页正要被写往交换设备时，zswap 尝试把它压缩进一个内存池；成功的话，那次写就不会发生。池子满了，zswap 就“按 [[lru|LRU]] 原则”把自己最老的条目逐出到真正的设备上。在内部，它按交换偏移量查找压缩页，用的是“每种交换类型一个 [[xarray|xarray]]”，也就是[多级页表就是一棵基数树](/notes/radix-trees)里讲的那棵基数树。

| | 磁盘交换 | zram 作交换 | zswap + 磁盘交换 |
|---|---|---|---|
| 被淘汰的页去哪儿 | 磁盘或 SSD | 压缩后留在内存 | 先压缩留在内存，再到磁盘 |
| 内存池满了怎么办 | 不适用 | 设备满了 | 最老的条目写到磁盘 |
| 需要磁盘吗 | 需要 | 不需要 | 需要 |
| 常见于 | 传统默认配置 | 手机、ChromeOS、Fedora | 交换在 SSD 上的笔记本和虚拟机 |

Fedora 解释过它为什么选 zram 而不是 zswap：zswap 需要基于磁盘的交换设备，而它写回到那里的页可能把用户数据泄露到持久存储上；zram“只依赖易失性存储”，更简单也更安全。zswap 的文档则指出，把页留在内存里可以大大减少对 SSD 交换设备那些“折损寿命的写入”。两者都是“先压缩”的设计，区别在于压缩也不够时怎么办。

::scene slowpath

## 看慢路径变快

这个实验跟随一次内存访问，走完第 21 章的整条路径：TLB、页表遍历、页错误、找空闲帧、淘汰，以及交换 I/O。

::lab PageFault

可以试试这些：

- 运行“缺页，内存已满，牺牲页是脏的”。实验给两个交换步骤各算了磁盘时代的 10 ms，它们让路径上其他步骤都显得微不足道。
- 现在设想交换设备是 zram。其余步骤原封不动，因为对内核来说 zram 只是又一个块设备；变的只有那两个方框，它们变成了 CPU 上的一次压缩和一次解压。Fedora 说的“一个数量级”就来自这里。
- 再运行“TLB 命中”和“TLB 未命中，页在内存中”作对比。即便是压缩交换，也比从未离开内存的页慢得多。压缩降低了一次错误淘汰的代价，但并没有让它免费。
- 看看“淘汰一页（策略！）”那个方框。淘汰哪一页是第 22 章的问题，Linux 怎么回答，见[没有人实现真正的 LRU](/notes/approx-lru)。

::scene oom

## 压缩也不够时：OOM killer

第 22 章以抖动收尾，并给出两种应对。一是[[admission-control|准入控制]]：少运行一些进程，让剩下的放得进内存。二是内存不足杀手（out-of-memory killer，下文称 OOM killer）：挑一个吃内存的进程，杀掉它。

Linux 的 OOM killer 在回收已经尽力、分配仍无法满足时运行。它用一个“劣度”（badness）启发式给每个候选进程打分。分数大致是该任务占用了允许内存的多大比例，再用一个按进程设置的参数 [[procfs|`/proc/<pid>/oom_score_adj`]] 调整，取值范围是 −1000 到 +1000，−1000 表示该任务完全豁免。当前分数可在 `/proc/<pid>/oom_score` 中查看，它把调整值也算进去，范围是 0 到 2000。

:::fold 劣度分数，逐行看
下面是主线 Linux（2026 年）`mm/oom_kill.c` 中的 `oom_badness()`，略有删节：

```c
long oom_badness(struct task_struct *p, unsigned long totalpages)
{
	long points;
	long adj;

	if (oom_unkillable_task(p))
		return LONG_MIN;
	p = find_lock_task_mm(p);
	if (!p)
		return LONG_MIN;

	adj = (long)p->signal->oom_score_adj;
	if (adj == OOM_SCORE_ADJ_MIN ||
			mm_flags_test(MMF_OOM_SKIP, p->mm) ||
			in_vfork(p)) {
		task_unlock(p);
		return LONG_MIN;
	}

	/*
	 * The baseline for the badness score is the proportion of RAM that each
	 * task's rss, pagetable and swap space use.
	 */
	points = get_mm_rss_sum(p->mm) + get_mm_counter_sum(p->mm, MM_SWAPENTS) +
		mm_pgtables_bytes(p->mm) / PAGE_SIZE;
	task_unlock(p);

	/* Normalize to oom_score_adj units */
	adj *= totalpages / OOM_SCORE_ADJ_MAX;
	points += adj;
	return points;
}
```

基准分就是杀掉这个进程能还回来的页：[[rss|驻留页]]、已经换出到交换区的页，以及它的页表。这里面没有“重要性”“存活时间”或“CPU 用量”的概念。重要性只能通过 `oom_score_adj` 进来，它被缩放成每一单位相当于全部允许内存的千分之一。

算一个例子。一台 16 GiB 内存、没有交换的机器，`totalpages` 是 4,194,304 个 4 KiB 页，所以调整值的一个单位相当于 4,194 页。一个驻留 2 GiB 的进程，基准分是 524,288。把它的 `oom_score_adj` 设成 500，就多出 500 × 4,194 = 2,097,000 分，相当于再多占 8 GiB，也就是一半内存。proc 文档对 +500 的描述如出一辙：大致相当于让其他任务至少多用 50% 的内存。

这个函数也说明了杀手不知道什么：这个进程里有没有用户没保存的工作，杀掉它能不能很快释放内存。书里的例子，杀掉 [[x-server|X 服务器]]、所有窗口一起消失，只要没人把显示服务器标成重要，今天照样可能发生。
:::

::scene livelock

内核的 OOM killer 名声不好，问题主要出在时机上。它只在回收失败时出手，而回收可以长时间“差一点就成功”：每一轮都释放出几页，又马上被缺页换回来。机器并没有耗尽内存，所以杀手不出场；可它也没在干有用的活。Facebook 的工程师在 2018 年这样描述后果：内核的 OOM killer“出手太晚，导致系统陷入一段不确定长度的[[livelock|活锁]]”。第 22 章把这种状态称为抖动。要想更早行动，就得有办法度量它。

::scene psi

## 度量抖动：压力停滞信息

空闲内存的数量是个糟糕的信号：健康的机器会把几乎所有内存都用作[[page-cache|页缓存]]，挣扎中的机器看起来可能一模一样。Johannes Weiner 的**压力停滞信息**（pressure stall information，PSI）在 Linux 4.20 合入，它度量真正要紧的东西：等待中损失的时间。

```text
$ cat /proc/pressure/memory
some avg10=0.00 avg60=0.00 avg300=0.00 total=0
full avg10=0.00 avg60=0.00 avg300=0.00 total=0
```

`some` 一行是至少有一个任务在等内存的时间占比，比如卡在回收里，或者在等一个刚被淘汰的页读回来。`full` 一行是*所有*非空闲任务同时停滞的时间占比。内核文档对这种状态的描述就是教科书上的定义：实实在在的 CPU 周期被浪费，长时间处于这种状态的负载“被认为在抖动”。平均值覆盖 10 秒、60 秒和 300 秒三个窗口。每个 [[cgroup|cgroup]] 下也有同样格式的 `memory.pressure` 文件。

这把第 22 章那个定性的概念变成了一个可以设阈值的数字，而用户态杀手正是这么做的。

:::fold 让内核在压力上升时叫醒你
::scene trigger

轮询平均值可以，但 PSI 还支持触发器：把阈值和时间窗口写进压力文件，然后对它调用 [[poll|`poll()`]]。内核接受 500 ms 到 10 s 的窗口；非特权用户也可以创建触发器，但窗口必须是 2 s 的整数倍。下面的代码浓缩自内核 PSI 文档中的示例：

```c
/* 浓缩自 Documentation/accounting/psi.rst 中的示例 */
#include <fcntl.h>
#include <poll.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

int main(void)
{
	const char trig[] = "some 150000 1000000";	/* 任意 1 s 窗口内累计停滞 150 ms */
	struct pollfd fds = { .events = POLLPRI };

	fds.fd = open("/proc/pressure/memory", O_RDWR | O_NONBLOCK);
	if (fds.fd < 0 || write(fds.fd, trig, strlen(trig) + 1) < 0)
		return 1;
	for (;;) {
		if (poll(&fds, 1, -1) < 0 || (fds.revents & POLLERR))
			return 1;
		if (fds.revents & POLLPRI)
			printf("memory pressure: time to shed load\n");
	}
}
```

单位是微秒：任意 1,000,000 µs 的窗口内累计停滞 150,000 µs。Android 的 `lmkd` 注册的就是这种形式的触发器。按 Android 文档，它的默认值是：部分停滞（`some`）在高性能设备上 70 ms、低内存设备上 200 ms，完全停滞（`full`）700 ms，用来决定何时出手、出手多重。
:::

::scene oomd

## 有意为之的杀戮：systemd-oomd 与 lmkd

一旦能度量压力，杀谁就成了一个在用户态、提早、带着内核所没有的信息做出的策略决定。

**systemd-oomd** 于 [[systemd|systemd]] 247（2020 年）加入，它把同样的思路用在 cgroup 而非单个进程上，只管理主动加入的单元。它的默认值是：某个被监视的 cgroup 的内存压力持续 30 秒高于 60%，或者内存和交换的使用率都超过 90%，就出手。这里的压力取的是 `full` 指标：在 10 秒窗口里，组内所有任务都被延迟的时间占比。出手时，它向选中 cgroup 里的每个进程发送 [[sigkill|`SIGKILL`]]，于是一个应用连同它的所有辅助进程一起退出。它的手册页还强调了 Chris Down 也会强调的一点：要开着交换运行。有交换，系统退化得够慢，守护进程来得及反应；没有交换，机器会太快陷入活锁。

::scene lmkd

**Android 的 lmkd** 是更早、也更激进的设计，因为杀进程本来就是它日常运行的一部分。Android 过去带一个内核里的“低内存杀手”（low memory killer）驱动，使用固定的空闲内存阈值。从内核 4.12 起它被移出上游，由用户态的 `lmkd` 接手。从 Android 10 起，它默认使用 PSI 触发器；Android 11 又加入一种策略，同时观察页缓存被“[[refault|回迁]]”（refault）的比例，这是对抖动的直接度量。

杀谁，取决于活动管理器（activity manager）：它根据用户能看到什么，随时更新每个应用的 `oom_score_adj`。下面是框架 `ProcessList.java` 中定义的部分级别：

| 状态 | oom_score_adj |
|---|---|
| 原生守护进程 | −1000 |
| 系统服务进程 | −900 |
| 前台应用 | 0 |
| 可见应用 | 100 |
| 可感知（如正在播放音乐） | 200 |
| 桌面（主屏幕） | 600 |
| 上一个应用 | 700 |
| 缓存的应用 | 900–999 |

`lmkd` 从这张表的底部往上杀。在基于 [[vmpressure|vmpressure]] 的配置下，文档给出的默认值让中等压力只能杀 800 及以上的进程（缓存的应用和非必要服务），只有临界压力才能一路杀到 0。这就是第 22 章的准入控制，只不过是事后执行：手机不能拒绝启动应用，于是就按“用户最不会想念”的顺序，停掉用户没在看的那些。

:::aside 不是每台桌面电脑都跑着 OOM 守护进程
Linux 的[[mglru|多代 LRU]] 给没有这类守护进程的机器准备了自己的泄压阀：向 `/sys/kernel/mm/lru_gen/min_ttl_ms` 写入 N，就能保护最近 N 毫秒的[[working-set|工作集]]不被淘汰；如果这个工作集保不住，内核就运行 OOM killer，而不是任由系统抖动。文档基于人能察觉的约 100 ms 延迟，建议取 N = 1000，以消除难以忍受的卡顿。
:::

::scene bends

## 理想在哪里弯折

现代这一套并没有摆脱书中的问题，只是把问题挪了地方。

- **压缩要花 CPU。** 每次换出都要压缩，每次换入都要解压。在手机上这是电量，在繁忙的服务器上是 CPU 周期。Android 的 `mmd` 只在设备空闲且电量不低时才做昂贵的维护。
- **压缩交换与它省下的东西相互竞争。** zram 的池子也是内存。如果工作集在 2:1 下仍放不下，系统就在解压上抖动，而不是在磁盘 I/O 上。
- **压缩比是负载的事实，而不是常数。** 2:1 只是文档的预期，并无保证。加密过的、已经压缩过的或随机的数据都压不小，所以 zram 才会统计不可压缩页，并允许把它们写到后备设备上。
- **杀谁是策略问题。** 内核的劣度分数只看大小，重要性必须由用户态通过 `oom_score_adj` 和 cgroup 布局提供。弄错了，书里 [[x-server|X 服务器]]的故事就会重演。

::scene overview

## 回到书里的那条线

把这些部件和第 21、22 章对照，对应得相当紧：

1. 带高低水位线的**交换守护进程**就是 `kswapd`，仍然在同一类阈值上醒来。
2. **交换空间**从磁盘分区搬进了压缩内存：zram 当设备，或者 zswap 当设备前的缓存。
3. **“替换究竟何时发生”**如今有了度量：PSI 报告替换发生时，任务因此损失了多少时间。
4. **抖动**有了可操作的定义：所有任务都因内存而停滞的时间占比。
5. **准入控制与 OOM killer** 合并成了用户态守护进程：按重要性，提早地，一次杀一个 cgroup 或一个缓存的应用。

标题里的顺序就是整个设计。先压缩，因为把内存里的压缩页取回来，比从任何磁盘取回都便宜。度量停滞而不是空闲内存，因为用户感受到的是损失的时间。最后才杀，但要有意为之，赶在内核只能按大小来选之前。

## 延伸阅读

- [zram: Compressed RAM-based block devices](https://docs.kernel.org/admin-guide/blockdev/zram.html)：配置方法、2:1 的容量建议、`mm_stat`、闲置页跟踪与写回。
- [zswap](https://docs.kernel.org/admin-guide/mm/zswap.html)：压缩交换缓存、它的 LRU 写回与内存池上限。
- [PSI: Pressure Stall Information](https://docs.kernel.org/accounting/psi.html)：`some` 与 `full` 指标、触发器和 cgroup 接口。
- [Tracking pressure-stall information](https://lwn.net/Articles/759781/)（LWN，2018 年 7 月）：补丁集提出时的样子。
- [Changes/SwapOnZRAM](https://fedoraproject.org/wiki/Changes/SwapOnZRAM)：Fedora 33 的变更提案，含容量算术，以及不选 zswap 的理由。
- [In defence of swap: common misconceptions](https://chrisdown.name/2018/01/02/in-defence-of-swap.html)（Chris Down，2018）：为什么交换关乎回收机会的均等。
- [Low memory killer daemon](https://source.android.com/docs/core/perf/lmkd)：Android 的 `lmkd`、PSI 监视器与调优属性。
- [oomd.conf](https://www.freedesktop.org/software/systemd/man/latest/oomd.conf.html) 与 [systemd-oomd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd-oomd.service.html)：systemd OOM 守护进程的默认值与运行要求。
- [Open-sourcing oomd](https://engineering.fb.com/2018/07/19/production-engineering/oomd/)（Facebook Engineering，2018）：为什么要有用户态的 OOM killer。
- [/proc/<pid>/oom_score_adj](https://docs.kernel.org/filesystems/proc.html)：内核对劣度分数及其调整的说明（3.1 节）。
