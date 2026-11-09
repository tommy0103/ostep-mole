---
deck: Kubernetes 的 CPU request 是一张彩票；CPU limit 却是第 9 章从没讲过的东西——一笔会花完的预算。大多数意外，都来自把这两者混为一谈。
title: 你云账单里的“彩票”：CPU request、limit 与限流
---

::scene overview

[[kubernetes|Kubernetes]] [[pod|pod]] 里的每个[[container|容器]]都可以写两个 CPU 数字：

```text
resources:
  requests:
    cpu: "500m"     # 半个 CPU
  limits:
    cpu: "2"        # 两个 CPU
```

它们看起来像同一个量的下限和上限，大多数人也是这么理解的。其实不然。在 Linux 节点上，这两个数字会变成两套毫不相干的内核机制。request 变成**权重**（weight），也就是第 9 章的比例份额换了个名字；limit 变成**配额**（quota），即每 100 ms 时间窗口内固定数量的 CPU 时间。窗口里的预算一旦花完，容器里的所有[[thread|线程]]都要停下来等下一个窗口开始——不管机器此刻有多闲。

第一套机制是工作保持（work-conserving）的，也很宽容；第二套两样都不是。它在生产环境里制造了一些最古怪的延迟曲线：一个平均只用了 limit 20% 的服务，却时不时卡住几十毫秒。本文从 YAML 一路追到调度器，看看这两个数字各自变成了什么，以及明白之后人们是怎么做的。

## 先简单回顾彩票

::chapter cpu-sched-lottery

::scene tickets

第 9 章给每个工作若干张彩票，并承诺它按彩票数的比例分到 CPU——无论是靠抽奖，还是靠步长调度那种确定性的 pass 值。这套方案有两个性质在这里很要紧。

- **份额是相对的。** 100 张对 300 张，和 1 张对 3 张是同一种分法。只有此刻正在竞争的那些工作之间的比例才算数。
- **份额只在争用时起作用。** 如果其他工作都在睡觉，只有一张彩票的工作也能独占 CPU，什么都不浪费。具备这种性质的调度器叫作*工作保持*的。

书里还提到了*彩票货币*：用户可以用自己的“本地货币”给自己的工作发彩票，系统再把它换算成全局彩票。记住这个想法，因为 cgroup 恰恰就是一个层层嵌套的货币体系。

## request 变成权重

::scene weights

Linux 用**[[cgroup|控制组]]**（cgroup）把进程组织成一棵树。在 cgroup v2 中，每个组都有一个 `cpu.weight` 文件，取值是 1 到 10000 的整数，默认 100。内核文档用的正是第 9 章的说法：父节点的 CPU 在活跃的子节点之间分配，“每个子节点得到的比例等于它的权重占权重总和的比例”。没有任务可运行的子节点不参与求和，所以这个方案是工作保持的。

Kubernetes 给每个 pod 建一个 cgroup，pod 下面再给每个容器各建一个。request 要经过两步才变成 `cpu.weight`，而第二步最近刚刚改过。

1. **[[kubelet|kubelet]] 把[[millicpu|毫核]]（millicore）换算成 cgroup v1 的“shares”。** 公式是 `shares = milliCPU × 1024 / 1000`，并限制在 2 到 262144 之间。完全没写 CPU request 的 pod（*[[qos-class|BestEffort]]* pod）拿最小值 2。1024 不过是旧版 v1 接口里 cgroup 的默认权重。
2. **容器运行时把 shares 换算成 v2 权重。** 这一步由 [[oci-runtime|OCI 运行时]]（runc、crun）完成。直到 2025 年，它们用的都是一条直线，把 shares 的 [2, 262144] 线性映射到权重的 [1, 10000]。现在的版本改用一条曲线，拟合三个点：2 → 1、1024 → 100、262144 → 10000。

下表是几个常见 request 在新旧两种换算下的结果，按运行时代码里的公式算出：

| request | shares | 旧权重（线性） | 新权重（曲线） |
|---|---|---|---|
| 100m | 102 | 4 | 17 |
| 250m | 256 | 10 | 35 |
| 500m | 512 | 20 | 59 |
| 1 CPU | 1024 | 39 | 100 |
| 2 CPU | 2048 | 79 | 174 |
| 4 CPU | 4096 | 157 | 303 |

旧的直线几乎完全保持 request 之间的比例：在一个满负荷的节点上，两个并排的 pod，一个 request 500m、一个 1500m，权重分别是 20 和 59，大约按 1 : 3 分父节点的 CPU。新曲线则把差距压缩了：同样这两个 pod 现在是 59 和 138，大约 1 : 2.3。request 越大分到的份额仍然越多，但不再严格成比例。节点空闲时，任何一个都可以用满所有核。

:::fold 换算公式为什么要改
::scene formula

线性公式在某种狭义上是对的：它把一个接口的全部取值范围映射到了另一个接口的全部取值范围。问题出在中段。一个 request 整整一个 CPU 的容器，在 cgroup v1 里恰好是默认权重；到了 cgroup v2，它的权重却只有 39 左右，不到默认值 100 的四成。

这很要紧，因为节点上不只有 Kubernetes 的 pod。系统服务跑在别的 cgroup 里，权重是默认的 100。按线性公式，一个要了整个 CPU 的 pod，和一个日志[[daemon|守护进程]]竞争时，权重还不到对方的一半。小 request 更惨：100m 只剩权重 4，几乎没有余地再往下分给子 cgroup。

新公式是 shares 对数的二次函数：*weight* = ⌈10^(L²/612 + 125L/612 − 7/34)^⌉，其中 *L* = log~2~(shares)。选它是为了让最小值、默认值和最大值对齐：2 → 1、1024 → 100、262144 → 10000。运行时代码对 1024 shares 算出的恰好是 100；Kubernetes 的公告里写的是 102。这次改动发生在 OCI 运行时里，而不是 Kubernetes 本身，所以它随 runc 1.3.2 和 crun 1.23 到来——节点的运行时什么时候升级，什么时候生效。这个映射是多对一的：90m 到 109m 之间的所有 request 最后都是权重 17。那些读取 `cpu.weight` 想反推 request 的工具，以及把旧直线写死的工具，都得跟着改。
:::

::scene hierarchy

有两个细节让 cgroup 的图景比第 9 章那张扁平的工作列表更丰富。

- **它是分层的。** pod 位于 `kubepods` cgroup 之下，通常还按服务质量（QoS）等级再分一层，节点的系统服务则在它们旁边。权重只在兄弟节点之间比较，所以一个 pod 真正的份额，是它在父节点份额里所占的比例，一层层乘上去。这就是书里的彩票货币。
- **它是按 CPU 的。** 在内核里，一个组在每个 CPU 的运行队列上都是一个可调度实体、带一个权重，组内部还有自己的任务队列。内核把组的权重分摊到它有可运行任务的那些 CPU 上，大致按它在每个 CPU 上的负载成比例。CPU 再如何在这些实体之间挑选，是 [EEVDF 那篇](/notes/eevdf) 的内容。

## limit 变成预算

::scene quota

limit 用的是另一套机制：**CFS 带宽控制**（bandwidth control）。每个 cgroup 还有一个文件 `cpu.max`，里面是两个数：配额和周期（period），单位都是微秒。在每个*周期*的墙钟时间里，这个组最多消耗*配额*那么多的 CPU 时间。默认值是 `max 100000`，即不设配额、周期 100 ms。kubelet 把配额设为 `milliCPU × period / 1000`，下限 1 ms。于是 2 个 CPU 的 limit 就变成：

```sh
$ cat /sys/fs/cgroup/cpu.max
200000 100000
```

意思是“每 100 ms 给 200 ms 的 CPU 时间”。注意它*没*说什么：它没说“同时用两个 CPU”。预算是这个组在所有 CPU 上用掉的时间之和。在 64 核的节点上，同一个容器可以同时跑 64 个线程，每个跑三毫秒多一点，然后预算就没了。

具体机制是：内核为这个组维护一个全局的运行时间池，每个周期开始时补满。运行该组线程的 CPU 按片（slice）从池里领取，默认每片 5 ms。当某个 CPU 的片用完、池也空了，这个组就在该 CPU 上被**限流**（throttled）：它的调度实体被移出运行队列，组里的线程都不能在那里运行，直到周期定时器把池补满。默认情况下，没用完的配额不会结转。

### 一个算例

::scene throttle

设想一个 limit 为 2 个 CPU 的服务，所在节点有大量空闲核。大多数时候它处理小请求，每个只需几毫秒 CPU。每秒有一次并行的事情发生：一次[[garbage-collection|垃圾回收]]、一次缓存重建、一批扇出请求。假设有 10 个线程同时忙起来。

- *t* = 0，周期开始，预算 200 ms。
- 十个线程并行运行，每过 1 ms 墙钟时间就烧掉 10 ms CPU 时间。到 *t* = 20 ms，预算用光。
- 从 *t* = 20 到 *t* = 100 ms，容器被限流。里面什么都不跑：突发任务不跑，小请求不跑，[[health-check|健康检查]]也不跑。
- 一个在 *t* = 21 ms 到达、只需 3 ms 的请求，大约在 *t* = 103 ms 完成。它的延迟是 82 ms，其中 79 ms 花在等周期边界上。

::scene dashboard

再从监控面板上看同一个服务。假设基线负载是 0.2 个 CPU，突发每秒再加 200 ms CPU 时间，也就是又一个 0.2 CPU。按分钟平均，容器用了 0.4 个 CPU，即 limit 的 20%；它在每 10 个周期里被限流 1 个。利用率看着很宽裕，[[percentile|p99 延迟]]却宽达 80 ms。这正是本章卡片上说的模式：前 20 ms 烧完配额，然后空等 80 ms。

内核会记下这些。在 cgroup v2 里，`cpu.stat` 报告 `nr_periods`、`nr_throttled` 和 `throttled_usec`。[[cadvisor|cAdvisor]] 把它们以 `container_cpu_cfs_periods_total`、`container_cpu_cfs_throttled_periods_total` 和 `container_cpu_cfs_throttled_seconds_total` 的名字导出给 [[prometheus|Prometheus]]。对任何设了 limit 的服务来说，被限流周期占全部周期的比例，都是比 CPU 利用率好得多的告警指标。

:::fold 让空闲服务也被限流的内核 bug
::scene bug

2019 年，Indeed 的工程师发现了比上面更糟的情况。他们有个应用分配了 4.1 个 CPU，实际最多只用了大约半个 CPU，却照样被严重限流。[[tail-latency|长尾延迟]]是在升级到 Linux 4.18 之后上升的。

Dave Chiluk 一路追查到了“片”的机制。当某个 CPU 上属于该组的线程都空闲下来时，内核会把这个 CPU 剩余的片还给全局池，但在 CPU 上留下 1 ms。在 4.18 之前，过期检查里有个 bug，导致这些零头实际上永远不会过期。4.18 里一个修复时钟漂移的提交（512ac999d275）让检查生效了，于是这些 1 ms 的零头在每个周期边界都会过期。对一个线程多、分散在许多 CPU 上的服务来说，零头可不少。Indeed 的文章算过：在一台 88 核的机器上，每个周期最多有 87 ms 配额被困住——几乎是一整个 CPU 的预算，应用付了钱却用不上。

修复是 Chiluk 的提交 de53fd7aedb1，它彻底去掉了片的过期。代价是一个组可以短暂超出配额，超出量就是各个 CPU 上剩下的部分，通常每个 CPU 最多 1 ms。提交说明报告，在一台 80 CPU 机器上、配额 10 ms / 100 ms 的人工测试中，性能提升了将近 30 倍。这一改动进入了 Linux 5.4，并[[backport|回移植]]到稳定版 4.14、4.19、5.3 系列以及主要发行版的内核。Indeed 报告说，他们一个应用的最坏响应延迟从 2 秒多降到了 30 ms。

这个故事值得记住的是它的形状：每一处改动单独看都是对的。记账变得更精确了，而一个原本依赖不精确的负载就此翻车。
:::

## 为什么多线程服务受害最深

::scene threads

限流是预算的性质，不是 CPU 数量的性质，所以任何让预算花得更快的东西都会让情况更糟。并行恰恰如此，而语言运行时会替你制造并行。

典型的例子是按机器规模设定线程池的运行时。直到 Go 1.25 之前，[[gomaxprocs|`GOMAXPROCS`]]——同时运行 Go 代码的线程数——默认等于进程能看到的[[logical-cpu|逻辑 CPU]] 数。一个 limit 为 2 个 CPU、跑在 64 核节点上的 Go 服务，会同时运行多达 64 个 [[goroutine|goroutine]]，几毫秒就花光 200 ms，然后在周期剩下的时间里干等。根据 `GOMAXPROCS` 决定工作线程数量的垃圾回收器更是雪上加霜。Go 团队自己的博客把这笔账算得很直白：“8 个 CPU 的 limit”其实是每 100 ms 给 800 ms CPU 时间，你可以让 8 个线程跑满整个周期，也可以让 16 个线程跑一半。

::scene runtimes

运行时们已经学会去看 cgroup 了：

- **Go 1.25**（2025 年 8 月）在 cgroup 的 CPU limit 低于核数时，用它作为 `GOMAXPROCS` 的默认值，非整数的 limit 向上取整。它还会定期重新检查，因为运行中的 pod 的 limit 可能改变。它刻意忽略 request，因为权重说明不了能同时跑几个线程。
- **[[jvm|JVM]]** 感知容器已经好些年了，它的处理器数跟着 CPU 配额走。JDK 19 不再在这项计算中使用 CPU shares，因为在只设 request、不设 limit 的 Kubernetes pod 里，那会让 Java 用不满 CPU；这一改动回移植到了 17.0.5 和 11.0.17。

每一项都是某个运行时发现：机器上不只有它自己，它能看到的核数也不等于它可以用的核数。

## 人们怎么应对

::scene fixes

没有一劳永逸的办法，因为 request 和 limit 表达的是不同的意图。常见的做法有：

- **设 request，去掉 limit。** 对延迟敏感的服务，许多团队设一个准确的 request，完全不设 CPU limit。权重依然保证 pod 在争用时拿到它的份额；节点有空闲周期时，pod 也能用上。代价是可预测性：pod 的性能如今取决于邻居，也没什么能阻止一个失控的进程吞掉其他可突发 pod 想要的空闲 CPU。
- **让线程数匹配预算。** 如果保留 limit，就按它来设定线程池：`GOMAXPROCS`（Go 1.25 起自动）、JVM 的处理器数，以及 Node、Python、Rust 服务里的 worker 数量。线程少了，就不可能在周期的一小段里把整个周期的预算烧光。
- **给关键 pod 整核。** 使用 kubelet 的 `static` CPU 管理策略时，*Guaranteed* pod（request 等于 limit）中请求整数个 CPU 的容器会获得独占核心。那些核上不再调度别的东西，这对[[cache-affinity|缓存亲和度]]的帮助不亚于对公平的帮助。
- **允许突发。** 从 Linux 5.14 起，一个组可以把没用完的配额存起来（有上限），以后再花（cgroup v2 里是 `cpu.max.burst`），代价是对其他组的干扰更大。有些平台还会拉长周期，kubelet 在一个[[feature-gate|特性开关]]后面允许这样做；周期越长，突发越能做完，但一旦被限流，卡顿也越长。
- **盯对指标。** 告警看的是被限流周期的比例，而不是平均利用率。容器在任何平均值下都可能被限流。

:::fold 自己读这些计数器
::scene dashboard

在 cgroup v2 节点上的容器里，容器自己的 cgroup 通常挂载在 `/sys/fs/cgroup`。两个文件几乎能告诉你一切：

```sh
$ cat /sys/fs/cgroup/cpu.max
200000 100000
$ cat /sys/fs/cgroup/cpu.weight
59
$ grep -E 'nr_periods|nr_throttled|throttled_usec' /sys/fs/cgroup/cpu.stat
nr_periods 36000
nr_throttled 3600
throttled_usec 288000000
```

上面的数字是示意性的，特意和前面的算例对上：limit 为 2 个 CPU，request 500m（按新换算），一小时共 36,000 个 100 ms 周期，十分之一被限流，每次损失约 80 ms（3,600 × 80 ms = 288 s）。即使 CPU 面板显示容器只用了 limit 的 20%，10% 的限流比例也值得警惕。

有两点要注意。这些计数器只统计由本 cgroup 自己的 limit 引起的限流，不包括父节点造成的。而在 cgroup v1 节点上，同样的信息分布在 `cpu.cfs_quota_us`、`cpu.cfs_period_us`、`cpu.shares`，以及一个时间字段以纳秒为单位的 `cpu.stat`（`throttled_time`）里。
:::

## 生产环境里的彩票分配问题

::scene assign

本书 9.5 节承认，彩票调度从没说过每个工作该拿多少张彩票。“假设用户最清楚”，书里说，这是个“非方案”。Kubernetes 原封不动地采纳了这个非方案：由人把 request 写进 YAML 文件，往往只写一次，往往是照抄隔壁的。

这个数字承载的分量比第 9 章的彩票重得多。Kubernetes 调度器用 request 来决定哪些 pod 能放到哪个节点上，所以 request 既是彩票，也是预订。要多了，你为闲置的机器买单；要少了，你会被塞进一个繁忙的节点，权重还很小。[[vpa|Vertical Pod Autoscaler]] 之类的工具尝试根据观测到的用量来设定 request——这和本书在别处用过去预测未来是同一招（参见[用历史逼近“先知”](/notes/history-predicts)）。

::scene overview

limit 又加了一个第 9 章从未有过的旋钮。份额说的是如何分配现有的东西；limit 说的是即使没人想要，你最多也只能拿多少。比例份额天生是工作保持的，配额则刻意不是。当你要按整整两个 CPU 给人计费，或者要防止失控进程拖垮节点时，这很有用；当被限制的东西既突发又并行时——这几乎描述了所有现代服务——它就有害了。

本书这一章以彩票收尾。你的云账单上有两个数字，只有一个是彩票。

## 延伸阅读

- [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)：内核文档，讲 `cpu.weight`、`cpu.max`、`cpu.max.burst` 和 `cpu.stat`。
- [CFS Bandwidth Control](https://docs.kernel.org/scheduler/sched-bwc.html)：内核调度器文档，讲配额、周期、片和突发。
- [New Conversion from cgroup v1 CPU Shares to v2 CPU Weight](https://kubernetes.io/blog/2026/01/30/new-cgroup-v1-to-v2-cpu-conversion-formula/)（Kubernetes 博客，2026 年 1 月）：新旧两个公式，以及改动的原因。
- [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) 与 [Control CPU Management Policies on the Node](https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/)：Kubernetes 关于 request、limit 和 static CPU 管理器的文档。
- [Unthrottled: Fixing CPU Limits in the Cloud](https://engineering.indeedblog.com/blog/2019/12/unthrottled-fixing-cpu-limits-in-the-cloud/) 及其[第二篇](https://engineering.indeedblog.com/blog/2019/12/cpu-throttling-regression-fix/)（Indeed Engineering，2019 年 12 月）：限流回退的来龙去脉。
- [sched/fair: Fix low cpu usage with high throttling by removing expiration of cpu-local slices](https://android-kvm.googlesource.com/linux/+/de53fd7aedb100f03e5d2231cfce0e4993282425)：那个内核提交。
- [Container-aware GOMAXPROCS](https://go.dev/blog/container-aware-gomaxprocs)（Go 博客，2025 年 8 月）：Go 1.25 如何读取 CPU limit，以及为什么忽略 request。
