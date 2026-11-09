---
deck: Windows、macOS 和 Linux 把第 8 章的五条规则带向了不同的方向：一个保留规则再加上各种提升，一个不再猜测而是直接问应用，还有一个先把启发式统统扔掉，后来又允许你加载自己的。
title: 真实内核拿 MLFQ 做了什么
---

::scene overview

这一章以一个论断和一份名单收尾：BSD UNIX 的衍生系统、Solaris，以及 Windows NT 和后续的 Windows，都以某种形式使用了 MLFQ。如果今天打开你笔记本上操作系统的调度器，第 8 章的内容你能认出多少？

答案因系统而差别很大，而有意思的恰恰是这些差别。2007 年，Linux 用一个文档里写着“完全没有任何启发式规则”的调度器，换掉了一个建立在交互性启发式之上的调度器。与此同时，Windows 依然会在[[thread|线程]]的磁盘读取完成时提升它的优先级，和 Windows NT 当年一样。苹果的系统则基本不再猜测，转而直接问应用：你的线程是干什么用的？

这篇文章逐一走过它们，并拿 MLFQ 的规则一条一条地对照。

::scene rules

## 五条规则，当作一张检查表

::chapter cpu-sched-mlfq

本章最终的规则，简写如下：

1. 如果 A 的优先级高于 B，运行 A。
2. 优先级相同则轮转运行。
3. 新工作从最高层开始。
4. 工作一旦用完它在某一层的时间配额（无论中间放弃过多少次 CPU），就降一层。
5. 每经过一段时间 S，把所有工作移回最高层。

规则 1 和 2 是机制；规则 3 到 5 是一个学习算法：先乐观假设，再观察，把 CPU 大户降级，并定期遗忘——这样谁也不会饿死，改变了行为的工作也能得到第二次机会。最终形式的规则 4 还是一条防“钻空子”的规则：不管一个工作怎么切分自己的 CPU 使用，都照单计费。

于是，对每个真实系统都问四个问题：有多少层？谁决定线程的优先级——调度器观察得出，还是程序自己声明？调度器如何防止程序钻空子？由什么来扮演优先级提升的角色？

下面的实验就是本章的 MLFQ。在往下读之前，有两个场景值得先记在脑子里。选 *饥饿*，把规则 5 的提升设为每 50 ms 一次：CPU 密集型的任务 A 重新分到了时间片。选 *钻空子*，勾上 *更好的计时*：总在时间片结束前让出 CPU 的任务 G 再也赖不住最高层了。

::lab Mlfq

::scene windows

## Windows：32 个队列和一摞提升

Windows 最接近本书的 MLFQ。微软的文档描述了 32 个优先级，从 0（最低）到 31（最高）。调度器为每一级维护一个单独的就绪队列，在最高的非空级别上轮转运行线程，一旦有更高优先级的线程就绪，就立即抢占当前线程。这几乎逐字就是规则 1 和规则 2。

这些级别分成两段。16 到 31 是[[real-time|实时]]段，那里的线程始终保持被赋予的优先级。1 到 15 是动态段，调度器会在这里调动线程。0 级留给零页线程（zero-page thread），它在没有其他线程要运行时负责把空闲内存[[page|页]]清零。

线程的起点，即它的**基础优先级**（base priority），由所属进程的优先级类别和线程在类别内的相对级别共同决定。对于默认相对级别（`THREAD_PRIORITY_NORMAL`）的线程，文档给出的基础优先级如下：

| 优先级类别 | 普通线程的基础优先级 |
|---|---|
| `IDLE_PRIORITY_CLASS` | 4 |
| `BELOW_NORMAL_PRIORITY_CLASS` | 6 |
| `NORMAL_PRIORITY_CLASS` | 8 |
| `ABOVE_NORMAL_PRIORITY_CLASS` | 10 |
| `HIGH_PRIORITY_CLASS` | 13 |
| `REALTIME_PRIORITY_CLASS` | 24 |

在基础优先级之上，动态段里的每个线程还有一个**动态优先级**（dynamic priority），MLFQ 就住在这里。文档列出了调度器提升它的几种场合：

- 拥有前台窗口的进程被切到前台时，它的优先级类别会被提高，至少不低于任何后台进程；
- 窗口收到输入（鼠标、键盘或定时器消息）时，拥有该窗口的线程被提升；
- 被阻塞线程的等待条件得到满足时，例如它等待的磁盘或键盘 I/O 完成时，该线程被提升。

接着是降级规则：提升之后，线程每用完一个时间片，动态优先级就降一级，直到回到基础优先级，但绝不会低于基础优先级。

用 MLFQ 的眼光来读：一个刚从 I/O 中醒来的线程被假定为交互式的，于是跳上去，就像新工作从最高层进入；如果它一直运行，就每个时间片下沉一级，就像规则 4。这里没有规则 3：新线程从基础优先级起步，而不是从最高层。降级到基础优先级就停止，所以每个线程的 MLFQ 都被限定在“基础优先级到 15”这一段里。地板由程序选择，调度器的学习只在地板之上起作用。

:::fold 提升的内部：设备取值、等待计费，以及一个防饥饿的清扫者
::scene sweeper

微软的公开文档只讲到上面这些规则，细节来自《Windows Internals》的作者们。这里的数字出自 David Solomon 和 Mark Russinovich 针对 Windows XP 与 Server 2003 内核的教学材料。后来的版本改过其中不少，请把它们当作设计思路的示例，而不是今天的常量。

**提升幅度取决于设备。** [[driver|驱动程序]]完成一个 I/O 请求时，会随完成通知一起传入一个优先级增量。常见取值是：磁盘、光驱、并口和显卡为 1，串口、网络、命名管道和邮槽为 2，键盘或鼠标为 6，声卡为 8。设备越可能有人在等，跳得越高。

**醒来要付时间片。** 在内部，时间片以三分之一个[[tick|时钟节拍]]为单位计数，线程每从一次等待中返回，就扣掉三分之一个节拍。给出的理由是：免得 I/O 完成后被提升的线程一直运行、永远碰不到时间片结束；也免得 I/O 密集型线程比 CPU 密集型线程得到不公平的优待。这正是本章的“尝试 3：更好的计时方式”，用来对付那种在时间片结束前一刻主动让出的工作。

**一个清扫者扮演规则 5。** 一个名为*平衡集管理器*（balance set manager）的系统线程大约每秒醒来一次，扫描就绪队列，寻找已经就绪却 300 个时钟节拍都没运行的线程——在 10 ms 的时钟下大约是 4 秒。找到的线程被提到优先级 15，即动态段的顶端，并获得一个更长的时间片；这个时间片用完，它就直接回落。这是一次有针对性的优先级提升：只抬起确实在挨饿的线程，而不是把所有人一起抬上去。它也能顺带化解一些[[priority-inversion|优先级反转]]（没有任何保证），因为挨饿的持[[lock|锁]]者终究会被运行。如今的 Windows 用 *AutoBoost* 直接处理这件事：把持锁者提升到其等待者中的最高优先级。

**时间片短，而且可以拉长。** 默认时间片在客户端版本上是 2 个时钟节拍，在服务器上是 12 个；在客户端上，前台进程的线程最多可以得到它的三倍。
:::

::scene win-qos

较新的 Windows 又加了一条轴。从 Windows 10 1709 版起，每个线程还有一个**服务质量**（Quality of Service，QoS）等级：High、Medium、Low，以及后来加入的 Utility、Eco、Media 和 Deadline。系统主要根据用户能看到什么来推断它：有焦点的窗口是 High，可见但无焦点的是 Medium，最小化或被遮挡的是 Low，正在发声的进程是 High。决定下一个运行谁的主要依据仍是优先级；QoS 影响的是线程在[[hybrid-cores|性能核与能效核混合的芯片]]上跑在哪类核心上，以及处理器[[dvfs|跑多快的频率]]。如今调度器为每个线程记两个数：一个管*何时*，一个管*在哪里、跑多快*。

::scene apple-qos

## macOS 与 iOS：去问，而不是去猜

苹果离 MLFQ 的核心前提走得最远。那个前提是：操作系统必须靠观察来了解一个工作是什么。在 macOS 和 iOS 上，调度器的主要输入是应用为每一份工作声明的**[[thread-qos|服务质量类别]]**（QoS class）。苹果的能效指南定义了四个主要类别，每个都附有预期时长：

| QoS 类别 | 用于 | 预期时长 |
|---|---|---|
| User-interactive | 主线程、界面刷新、动画 | 几乎瞬时 |
| User-initiated | 用户发起并正在等待结果的工作 | 几秒以内 |
| Utility | 带进度条的长任务：下载、导入 | 几秒到几分钟 |
| Background | 用户看不见的工作：索引、同步、备份 | 几分钟到几小时 |

系统用 QoS 来调整调度优先级、CPU 与 I/O 吞吐量，以及定时器延迟。QoS 还会在程序中传播：提交到更高 QoS 队列的工作会被提升到该队列的级别；当高 QoS 线程阻塞在低 QoS 线程持有的 [[lock|`pthread_mutex`]] 上，或者用 `dispatch_sync` 等待一个[[dispatch-queue|串行队列]]时，系统会临时提高低 QoS 那一方，以化解[[priority-inversion|优先级反转]]。

这是把本书中“建议”（advice）那段旁注提升成了主接口。第 8 章把 `nice` 当作一个提示；苹果把提示变成了主信号，并把它挂在程序本来就在用的派发队列上，让给出提示变得很便宜。

::scene clutch

在底层，[[xnu|XNU]] 内核依然从历史中学习。它的 Clutch 调度器在 XNU 源码树里有文档，是一个三层的层级结构：

1. **根桶**（root bucket），每个 QoS 类别一个，按[[edf|最早截止期优先（EDF）]]选择。一个桶变为可运行时，获得的截止期是“当前时间加上该类别的*最坏情况执行延迟*（WCEL）”：前台类别为 0，user-initiated 为 37.5 ms，default 为 75 ms，utility 为 150 ms，background 为 250 ms。较高的类别还有一小笔“跃迁”（warp）预算，可以短暂地插到截止期更早的桶前面。一个总被跳过的低级桶会进入*饥饿避免*模式。
2. 每个桶里的**线程组**（thread group）：XNU 合在一起记账的一组相关线程。每个组根据其线程阻塞时间与运行时间之比得到一个*交互性分数*；阻塞多于运行的组分数落在较高区间，因而受到优待。这就是 MLFQ 的规则 4，只是作用于整个应用，而不是单个线程。
3. 每个组里的**线程**，按 Mach 经典的分时规则调度：优先级等于基础优先级减去线程近期的 CPU 使用量右移一个比例因子（即 priority shift）。使用量随时间衰减。这就是第 8 章引自 4.3BSD 和 Epema [E95] 的“[[decay-usage|衰减使用]]”（decay-usage）一族。

有一处细节与本书的建议背道而驰。教科书里的 MLFQ 给低优先级队列*更长*的时间片，因为那里的工作是 CPU 密集的批处理。Clutch 却让时间片随类别*缩短*：前台 10 ms，user-initiated 8 ms，default 6 ms，utility 4 ms，background 2 ms。手机上的后台工作不是看重吞吐量的批处理，它应该尽快让路。在苹果芯片的非对称处理器上，一个叫 Edge 调度器的扩展又在上面加了“在哪里跑”的问题，按类别把线程引导到性能核簇或能效核簇。

::scene o1

## Linux：先是启发式，然后什么都没有，然后可插拔

Linux 试过的设计最多，它的历史就是第 8 章那个权衡的公开上演。

**O(1)，2002 至 2007 年。** Ingo Molnar 为 2.5 开发系列编写、随 2.6 发布的 O(1) 调度器有 140 个优先级（100 个实时级加上 nice 值对应的 40 级），每个 CPU 上有若干组[[run-queue|运行队列]]数组，每级一个链表。它的形状就是 MLFQ，并且从睡眠中学习交互性：每个任务记一个 `sleep_avg`，睡眠时上升，运行时下降。按 Con Kolivas 在 2003 年的描述，一个任务的动态优先级可以根据这个值在静态优先级上下各浮动最多 5 级：LWN 在 2007 年的总结是：主线调度器长出了“一大套精巧的启发式规则”来识别交互式进程，可人们仍在抱怨交互响应。

::scene rsdl

**RSDL，2007 年，那个没被合并的 MLFQ。** Kolivas 的旋转阶梯截止期调度器（Rotating Staircase Deadline）彻底去掉了交互性估计器。每个优先级有一份时间配额；某一级的配额用完时，这一级的所有任务都下降一级，称为*小轮转*；当活跃数组清空时，活跃数组与过期数组对调，每个任务都回到原来的优先级重新开始，称为*大轮转*。和本书放在一起看，这就是带精确计账的规则 4，加上作为周期性重置的规则 5。RSDL 几乎就是教科书里那个最终版的 MLFQ，而它输了。

::scene cfs

**CFS，Linux 2.6.23，2007 年 10 月。** 胜出的是 Molnar 的完全公平调度器，一个比例份额设计，下一章会讲到。按 LWN 当时的描述，它彻底抛弃了运行队列数组：不跟踪睡眠时间，也不尝试识别交互式进程。交互性应当从公平中自然产生：经常睡眠的任务[[vruntime|虚拟运行时间]]落后，醒来时便能及时运行。实际上 CFS 后来还是长出了一些启发式，比如给睡眠者的补偿和唤醒粒度。在 Linux 2.6.38 里它又加入了**自动分组**（autogroup）：把每个终端会话放进单独的组，免得一个窗口里的 [[make-j|`make -j10`]] 压垮另一个窗口里的视频播放器。`sched(7)` 手册页给的例子是：播放器的份额从大约 9% 变成了大约 50%。

::scene eevdf

**EEVDF，Linux 6.6，2023 年。** CFS 的继任者加入了由请求的时间片长度推出的虚拟截止期，让延迟可以和份额分开请求，详见 [EEVDF 那篇](/notes/eevdf)。留意方向：Linux 最终有了“多快轮到”的输入，但它是任务自己请求的一个数，更接近苹果的做法，而不是猜测。

::scene sched-ext

**sched_ext，Linux 6.12，2024 年 11 月。** 最后这一转最奇特。sched_ext 是一个[[sched-class|调度类]]，它的策略在运行时以一组 [[bpf|BPF 程序]]的形式提供；内核保留了一张安全网：如果 BPF 调度器出错、某个可运行任务太久没有被调度（看门狗的超时默认为、同时也最多为 30 秒），或者操作员按下 [[sysrq|SysRq-S]]，BPF 调度器就会被卸载，所有任务退回公平调度类。[[out-of-tree|在树外]]，sched-ext 项目的 `scx_lavd` 最初由游戏负载推动，它从任务的行为中衡量每个任务对延迟有多敏感，再把结果换算成虚拟截止期和时间片。启发式回来了——只不过成了你可以加载的程序，而不是所有人都得跑的代码。

合并过程本身，就是调度问题“至今仍在争论”的具体写照。LWN 在 2024 年 6 月报道，Linus Torvalds 决定越过调度器维护者的反对合并 sched_ext；此前尽管用户兴趣明显，它的合并一直受阻。它错过了 6.11，最终进入 6.12。

:::fold FreeBSD 的 ULE：用公式实现的 MLFQ
::scene ule

FreeBSD 的 ULE 调度器是很有用的第四个参照，因为它保留了第 8 章的思想，却把逐队列的规则换成了一个数。每个线程累计它近期主动睡眠的时间和运行的时间，一个 0 到 100 的**交互性分数**对二者进行比较，越小越“交互”。分数低于某个阈值（默认 30）的线程被视为交互式，获得交互区间内的优先级，而这个区间先于批处理区间得到服务。

打分函数很短。下面的片段从 `sys/kern/sched_ule.c` 略作删节：

```c
/* SCHED_INTERACT_HALF 为 50 */
if (ts->ts_runtime > ts->ts_slptime) {          /* 跑得比睡得多 */
    div = max(1, ts->ts_runtime / SCHED_INTERACT_HALF);
    return (SCHED_INTERACT_HALF +
        (SCHED_INTERACT_HALF - (ts->ts_slptime / div)));
}
if (ts->ts_slptime > ts->ts_runtime) {          /* 睡得比跑得多 */
    div = max(1, ts->ts_slptime / SCHED_INTERACT_HALF);
    return (ts->ts_runtime / div);
}
```

有两处细节能和本书对上。第一，分数只算*主动*睡眠。源码注释解释说，在运行队列上等待的时间被排除在外，因为它说明不了线程的意图。第二，历史有上限。一旦睡眠加运行的时间超过 `SCHED_SLP_RUN_MAX`（相当于 5 秒），两者都会按比例缩小。一个线程无法先攒下一小时的睡眠，再以交互式优先级花掉它；而改变了阶段的线程几秒之内就会被重新归类。给历史设上限扮演的正是规则 5 的角色：它让调度器遗忘，免得过去压倒现在。
:::

::scene overview

## 对照表

把检查表填上（大大简化）：

| 规则 | Windows | macOS（XNU Clutch） | Linux（CFS、EEVDF） | FreeBSD ULE |
|---|---|---|---|---|
| 1–2：按优先级，同级轮转 | 是：32 级 | 是，QoS 桶之间用 EDF | 普通任务没有优先级层次；用权重和虚拟时间 | 是：按优先级的运行队列 |
| 3：从最高层开始 | 否：从基础优先级开始 | 由 QoS 类别声明 | 新任务没有额外奖励 | fork 时继承一小段历史 |
| 4：按使用量降级 | 每个时间片降一级；等待也计费 | 衰减使用；线程组交互性分数 | vruntime 精确计账 | 睡眠/运行分数 |
| 5：周期性提升 | 清扫饿了约 4 秒的线程 | 桶之间的饥饿避免 | 不需要：份额有保证 | 历史上限 5 秒 |
| 建议 | 优先级类别、线程级别、EcoQoS | QoS 类别（主要输入） | nice、时间片请求、[[cgroup|cgroup]] | nice |

## 本书的权衡去了哪里

第 8 章提醒过*巫毒常量*：需要某种黑魔法才能设对的参数。上面每个系统都有：微软的 300 个节拍、ULE 的阈值 30、Clutch 的 37.5 ms，每一个都是某人挑出来、再针对负载调过的。常量从未消失，只是搬到了更不容易看见的地方。

变了的，是“谁知道一个工作是什么”这个问题的答案。在 1962 年，在本书里，答案都是操作系统必须自己推断。Windows 从 I/O 完成和窗口焦点中推断；苹果去问开发者；从 2007 年到 2024 年，Linux 选择完全不推断、转而提供公平；有了 sched_ext，想要推断的人可以自己加载一个。这些都不是最终答案，所以那场争论还没有结束。

贯穿所有这些系统的教训，正是本章自己的那一条：当工作有稳定的阶段时，从历史中学习很管用；当工作改变行为或钻规则空子时，它就会失灵。每一个真实系统都给自己的学习规则配了两样东西：躲不掉的计账，以及一种遗忘的办法。另一篇贯穿性的笔记[用历史逼近“先知”](/notes/history-predicts) 会在调度器之外追踪这种搭配。

## 延伸阅读

- [Scheduling Priorities](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities)、[Priority Boosts](https://learn.microsoft.com/en-us/windows/win32/procthread/priority-boosts) 与 [Quality of Service](https://learn.microsoft.com/en-us/windows/win32/procthread/quality-of-service)，Microsoft Learn。
- [Advanced Windows Thread Scheduling](https://osm.hpi.de/bs/2007/Slides/Unit04/4.5_AdvancedScheduling.pdf)，David A. Solomon、Mark E. Russinovich 与 Andreas Polze，Windows Operating System Internals 课程讲义（XP 与 Server 2003 时代）。
- [Prioritize Work with Quality of Service Classes](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/PrioritizeWorkWithQoS.html)，苹果能效指南。
- [Clutch scheduler](https://github.com/apple-oss-distributions/xnu/blob/main/doc/scheduler/sched_clutch_edge.md)，XNU 源码文档。
- [The Rotating Staircase Deadline Scheduler](https://lwn.net/Articles/224865/)（LWN，2007 年 3 月）与 [Schedulers: the plot thickens](https://lwn.net/Articles/230574/)（LWN，2007 年 4 月）。
- [CFS Scheduler](https://docs.kernel.org/scheduler/sched-design-CFS.html)，Linux 内核文档。
- [Extensible Scheduler Class](https://docs.kernel.org/scheduler/sched-ext.html)，Linux 内核文档；以及 [Extensible scheduler class to be merged for 6.11](https://lwn.net/Articles/978007/)（LWN，2024 年 6 月）。
- [sched_ule.c](https://github.com/freebsd/freebsd-src/blob/main/sys/kern/sched_ule.c)，FreeBSD 源码。
