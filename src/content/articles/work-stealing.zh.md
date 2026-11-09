---
deck: 第 10 章“一个队列还是多个队列”的选择，在 Go、Tokio 和 JVM 内部又被做了一遍——而它们的答案如出一辙：闲着的 worker 去忙着的 worker 那里拿活。
---

::scene overview

2012 年 5 月，Dmitry Vyukov 为 Go 运行时写了一份设计文档，题为 *Scalable Go Scheduler Design Doc*。文档列出的现有调度器的第一个问题，是一把保护集中式状态的全局[[lock|互斥锁]]：每个变为可运行的 [[goroutine|goroutine]]、每个在找活干的线程，都要经过这一把锁。第 10 章给这种设计起过名字：**单队列多处理器调度**（SQMS）。它也给过预言：实现简单，负载天然均衡，但核一多就扩展不上去。

Vyukov 的修法正是第 10 章接下来给出的那个：给每个处理器一个自己的队列，某个队列空了，就让它的主人去别处**窃取**。新调度器随 Go 1.1 在 2013 年发布。同样的设计，加上少许变化，如今还在调度 Rust 的 [[tokio|Tokio]]、Java 的 [[forkjoinpool|ForkJoinPool]] 以及构建于其上的[[virtual-thread|虚拟线程]]；它的源头是 1990 年代的 [[cilk|Cilk]] 研究语言，也就是本书引用的 [FLR98]。

## 两层调度器，叠在一起

::scene layers

goroutine、Tokio 任务、Java 虚拟线程，都不是操作系统[[thread|线程]]。它们是小得多的对象——几 KB 的栈，或者一个状态机——由运行时复用到少数几个真实线程上。创建一个很便宜，在它们之间切换也从不进入内核，所以服务器负担得起每个连接一个。

于是有两个调度器在工作，一个压在另一个上面：

- **内核**把线程调度到核心上，用的是第 7 到 10 章的全部内容。
- **运行时**把任务调度到这些线程上，用的是一个用 Go、Rust 或 Java 写成的调度器。

运行时的调度器面对的是缩小版的第 10 章问题：*P* 个线程，一串长度未知的任务，以及奖励“任务留在原地”的缓存。下面的每个运行时，都落在了同一个答案上。

## 书里的版本

::chapter cpu-sched-multi

::scene sqms

第 10 章把这个权衡摆得很清楚。SQMS 好实现，负载天然均衡，但每次调度决策都要拿全局锁，工作在 CPU 之间来回跳，丢掉**缓存亲和度**（cache affinity）。**多队列调度**（MQMS）给每个 CPU 一个队列：它能扩展，工作待在缓存温热的地方。但队列会逐渐失衡，最坏情况下一个 CPU 闲着，另一个却积压了一堆。

::scene steal

解决办法是**迁移**（migration），而这一章描述的技术就是**工作窃取**（work stealing）：工作少的队列偶尔看一眼别的队列，如果对方明显更满，就拿走一些工作。这一章最后点出了这条规则内在的张力：看得太勤，就要付出你当初建多个队列想要避免的开销；看得太少，又要忍受失衡。书里说，找到合适的阈值，“仍然是一门玄学”。

运行时们用一个决定化解了这个张力：**只在闲下来时才去看。** 忙碌的 worker 从不为均衡付出代价，只有无事可做的 worker 才去找活——反正它的时间本来也要浪费掉。

## Go：G、M 和 P

::scene gmp

Go 运行时用三个字母。

- **G** 是 goroutine：一个栈、一个指令指针，外加一些簿记信息。
- **M** 是 machine，即一个操作系统线程。
- **P** 是 processor，一个调度上下文。P 的数量恰好是 [[gomaxprocs|`GOMAXPROCS`]]。M 必须持有一个 P 才能运行 Go 代码。

每个 P 拥有一个**本地运行队列**：一个 256 个槽位的[[ring-buffer|环形缓冲区]]，外加一个单独的 `runnext` 槽。队列的主人在队尾添加时不用加锁，其他 P 用[[atomic-cas|原子操作]]从队头取。另外还有一个**全局运行队列**，由一把锁保护，接收溢出的 goroutine，以及没有明显归属的 goroutine。

::scene find

M 需要活干时，会运行 `findRunnable()`。略去定时器、[[garbage-collection|垃圾回收]] worker 和跟踪不谈，它的顺序是：

1. 每到第 61 个调度节拍，先从全局队列取一个 goroutine。否则两个不断互相唤醒的 goroutine 可能永远霸占本地队列，让全局队列饿死。
2. 从本地队列取，先看 `runnext`。
3. 从全局队列取一批，最多半个本地队列那么多。
4. 非阻塞地轮询一次网络，运行[[socket|套接字]]已就绪的 goroutine。
5. **窃取。** 以随机顺序访问其他 P，最多四轮，从找到的第一个非空队列里拿走**一半**。只有在最后一轮，窃取者才可以连受害者的 `runnext` goroutine 也一并拿走。
6. 什么都没找到，就交出 P，让线程睡下。

::scene overflow

本地队列也会溢出。往一个已满的本地队列里加 goroutine 时，运行时会把队列的一半连同这个新 goroutine 一起挪到全局队列。工作朝两个方向扩散：被空闲的 P 拉走，被过载的 P 推出。

:::fold 调度循环长什么样
下面是 `src/runtime/proc.go` 里 `findRunnable()` 的核心，只保留了轮廓。这是伪代码；真实的函数还要处理定时器、GC 工作、跟踪、锁定的线程，以及与正要睡下的线程之间的竞态。

```go
// 伪代码，简化自 src/runtime/proc.go
func findRunnable(pp *p) *g {
	if pp.schedtick%61 == 0 && !globalQueue.empty() {
		if gp := globalQueue.get(); gp != nil { // 照顾全局队列的公平
			return gp
		}
	}
	if gp := pp.runqget(); gp != nil { // 先 runnext，再本地环形队列
		return gp
	}
	if gp := globalQueue.getBatch(len(pp.runq) / 2); gp != nil {
		return gp // 这一批里剩下的放进 pp 的本地队列
	}
	if gp := netpoll(nonBlocking); gp != nil {
		return gp
	}
	if 2*spinningMs < busyPs { // 窃取者最多是忙碌 P 数的一半
		for try := 0; try < 4; try++ {
			for _, victim := range allPsInRandomOrder() {
				if gp := steal(pp, victim, try == 3); gp != nil {
					return gp // 拿走了受害者队列的一半
				}
			}
		}
	}
	return stopAndPark(pp)
}
```

窃取本身由 `runqgrab` 完成：它读取受害者的队头和队尾，从找到的 `n` 个 goroutine 里拿走 `n - n/2` 个，也就是向上取整的一半。由于受害者可能正在同时添加 goroutine，窃取者先把它们复制出来，再用一次对受害者队头的比较并交换（CAS）来认领。如果别人抢先一步，就重试。

空闲线程也不会一拥而上。正在找活的线程处于*自旋*（spinning）状态，自旋线程数最多是忙碌 P 数的一半。新工作只有在有空闲 P、且没有线程在自旋时才唤醒一个线程；最后一个找到活的自旋线程再唤醒一个接替者。工作就这样一次一个线程地扩散开。
:::

### 为什么拿一半？

::scene half

第 10 章的示意一次只挪一个工作。Go 和 Tokio 拿一半，理由有两个。

第一，一步到位地均衡。如果 P~1~ 有 40 个 goroutine、P~2~ 一个没有，只拿一个，就剩下 39 比 1，P~2~ 几乎马上又得回来，再付一轮加锁和缓存缺失的代价。拿 20 个，两边就平了。

第二，被偷走的工作会扩散得更远。第三个空闲的 P 能找到两个非空队列可偷，而不是一个。从一个繁忙队列开始，每一轮窃取后持有工作的队列数大约翻一番。

### 原本由操作系统做的那些事

::scene os

用户态调度器继承了第 6 章替内核解决过的那些问题，却没有内核的任何特权。

- **阻塞的系统调用。** goroutine 阻塞在系统调用里，就会阻塞它的 M。如果调用耗时较长，监控线程 `sysmon` 会把 P 交给另一个 M，让其余 goroutine 继续运行。
- **网络 I/O。** 等待套接字的 goroutine 被挂起，并不阻塞线程；运行时的**网络轮询器**（netpoller，在 Linux 上基于 [[epoll|epoll]]）在数据到达时唤醒它们（上面的第 4 步）。
- **抢占。** 在 Go 1.14 之前，goroutine 只会在函数调用处被抢占，一个紧凑循环可以无限期占住 P。从 Go 1.14 起，任何连续运行超过 10 ms 的 goroutine，`sysmon` 都会向它所在的线程发送[[signal|信号]]（`SIGURG`），信号处理程序让这个 goroutine 看起来像是自己调用了调度器。这就是[受限直接执行](/virtualization/cpu-mechanisms)里的时钟中断，用信号在用户态重建了一遍。[受限直接执行那篇](/notes/lde-everywhere)沿着这个模式继续往上追。

## Tokio：同样的设计，为异步调校

::scene tokio

Carl Lerche 在 2019 年重写 Tokio 的多线程调度器时，明确说 Go 的调度器是灵感来源之一，结构也一眼就能认出来。

- 每个 worker 线程有一个固定大小、容量 **256** 个任务的本地队列：一个环形缓冲区，只有主人往里推，其他人从中窃取。
- 一个共享的**全局队列**接收溢出（本地队列满时，一半任务挪过去），以及从非 worker 线程唤醒的任务。
- 空闲的 worker 从随机挑选的兄弟那里**偷走一半**。
- 同一时刻最多**一半的 worker** 在找活，找到活的 worker 再唤醒一个，和 Go 一样。

差别来自异步 Rust 的典型负载：大部分是任务之间的消息传递。当任务 A 给任务 B 发消息时，B 很可能下一个运行，而消息还在缓存里。Tokio 把被唤醒的任务放进一个 **LIFO 槽**，在队列之前检查，就像 Go 的 `runnext`，而且窃取者拿不走它。为了防止两个任务借这个槽永远打乒乓，连续使用三次后它会被暂时停用。为了公平，全局队列会定期检查；现在的 Tokio 会自动调节检查间隔，目标是大约每 10 ms 一次。

Tokio 根本无法抢占任务，因为 Rust 的 [[rust-future|future]] 只会在某个返回“未就绪”的 `.await` 处让出线程。一个套接字总有数据的任务，永远走不到那一步。从 Tokio 0.2.14（2020 年）起，每个任务每轮调度有 128 次操作的**预算**（budget）；花完之后，Tokio 自己的资源会假装未就绪，任务于是让出。真正会阻塞的工作应该通过 `spawn_blocking` 放到单独的线程池里——这是 Tokio 版的“Go 交出 P”。

2019 年的重写报告了这些换来了什么：一个 [[hyper|Hyper]] “hello world” 服务器从每秒约 113,900 个请求提高到约 152,300 个，多了约 34%；一个衍生任务链的微基准快了约 12 倍。

## Java：双端队列

::scene deque

Java 的版本出自 Doug Lea。他 2000 年的论文 *A Java Fork/Join Framework* 把自己的设计描述为“Cilk 所设计的工作窃取框架的一个变体”。它在 Java 7 中成为 `ForkJoinPool`。

每个 worker 拥有一个**双端队列**（deque）。主人在一端（top）压入和弹出任务，窃取者从另一端（base）拿。于是在默认模式下，主人按 **LIFO** 工作：总是运行它最近派生的任务；窃取者按 **FIFO** 工作：拿走最老的任务。

这种不对称是工作窃取里最重要的想法，它源于 [[fork-join|fork/join 程序]]的形状。一个递归的分治任务派生出两半，再派生出两半的两半，依此类推。双端队列里最新的任务是最小的那块，它的数据还在主人的缓存里；最老的任务是最大的那块，靠近递归的根，偷走它，窃取者一次就拿到了一大份工作。主人保住了局部性，窃取者拿到了能让它忙得最久的任务。源码里的设计说明引用了 [[chase-lev|Chase–Lev 双端队列]]（SPAA 2005）。

如今，大部分并行 Java 都跑在同一个池子上。`ForkJoinPool.commonPool()`（Java 8）执行[[parallel-stream|并行流]]。设置 `asyncMode` 后，worker 按 FIFO 处理自己的队列，适合那些从不 join 的事件式任务。在 JDK 21 中定稿虚拟线程的 [[jep|JEP 444]]，把虚拟线程的调度器描述为“一个以 FIFO 模式运行的工作窃取 ForkJoinPool”。注意它和 Go、Tokio 的一个不同：`ForkJoinPool` 的窃取者每次只拿一个任务，而不是半个队列。对分治任务来说，这一个任务往往本身就是剩余工作的一半。

## 窃取为什么管用：Cilk

::scene cilk

这一切背后的理论来自 MIT 的 Cilk 项目。Robert Blumofe 和 Charles Leiserson 分析了这样一个调度器：每个处理器处理自己的队列，没活干的处理器**均匀随机**地挑一个受害者，从它那里窃取（FOCS 1994；*Journal of the ACM*，1999）。1995 年关于 Cilk 运行时的论文写明了规则：窃取者“偷走受害者派生树中最浅的就绪线程”，也就是最老的那个，理由与 Java 从 base 端偷相同。

用两个数描述一个并行计算：**工作量**（work）*T*~1~，即在单个处理器上需要的总时间；**跨度**（span）*T*~∞~，即最长的一条相互依赖的步骤链的长度。*P* 个处理器上的任何调度都不可能快过 *T*~1~/*P*，也不可能快过 *T*~∞~。对结构良好（“完全严格”，fully strict）的程序，随机工作窃取的期望运行时间是

> T~P~ = T~1~ / P + O(T~∞~)

与最优相差不超过一个常数因子，使用的内存最多是串行运行的 *P* 倍。通信量同样有界，而且界取决于跨度，而不是工作量。

:::fold 工作量与跨度：代入数字
拿一个并行归并排序来说，总工作量 *T*~1~ = 1 s，跨度 *T*~∞~ = 1 ms。跨度是必须一步接一步完成的最长步骤链。

在 *P* = 8 个处理器上，界给出的运行时间大约是 1 s / 8 = 125 ms，再加上一个与 1 ms 成正比的项。既然任何调度都不可能比 125 ms 更快，工作窃取在这里几乎完美。用 1,000 个处理器时，*T*~1~/*P* 降到 1 ms，和跨度一样，再加处理器也没用了。比值 *T*~1~/*T*~∞~ 称为程序的*并行度*（parallelism），它告诉你这个程序能用上多少处理器。

关于跨度那一项，论证大致如下。任何时刻，每个处理器要么在干活，这在偿还 *T*~1~；要么在尝试窃取。由于受害者是随机选的，而窃取者拿的是最老的任务，每一轮大约 *P* 次窃取尝试，都有一个常数概率在关键路径上取得进展。所以期望的窃取尝试次数是 O(*P* · *T*~∞~)；每次尝试耗时为常数，除以 *P* 之后，失败的窃取只给运行时间增加 O(*T*~∞~)。窃取次数随跨度增长，而不是随总工作量增长。于是一个有充足并行余量的程序几乎从不窃取——这正是你对一个多队列调度器的期望：队列几乎总是保持私有。

Go 和 Tokio 的任务不是 fork/join 树，还会阻塞在 I/O 上，所以这个定理覆盖不到它们。但它背后的直觉——随机挑受害者、只在空闲时窃取，能让开销与失衡程度成正比——在实践中经受住了考验。
:::

## 动手试试

下面的实验就是第 10 章的那组对比：一个共享队列、每个 CPU 一个队列，以及带窃取的每 CPU 队列。

::lab Multicore

可以试试这些：

- 设为 2 个 CPU，选**等长任务**和 **SQMS**。五个工作共享一个队列，负载是均衡的，但发生了 40 次迁移，每次都是一段带斜线的冷缓存启动；缓存重新填充的代价大到全部完成得最晚，在 224。
- 切换到 **MQMS**。迁移降为零。但五个工作没法在两个队列间平分：CPU 1 做完它的两个工作后闲置了 60 个时间单位，而 CPU 0 还在做它的三个。全部完成于 180。
- 切换到 **MQMS+steal**。CPU 1 空下来时，从 CPU 0 拿走一个正在等待的工作。一次迁移就把空闲时间从 60 降到 17，完成时间降到 160，比两种纯粹的设计都好。
- 再试试**部分提前结束**。短工作会留下空洞，窃取以同样的方式把它们填上。

这个实验是简化过的：窃取者从最忙的队列里拿一个工作，而且只在那个队列里有不止一个工作在等待时才拿。找出最忙的队列，需要知道所有队列长度的全局信息；Go 和 Tokio 随机挑一个受害者、拿走一半，完全不需要全局信息。

## 理想规则在哪里弯折

::scene bends

工作窃取说起来简单，工程都花在它和系统其余部分相接的地方。

- **局部性与公平。** `runnext` 和 LIFO 槽让最新的任务优先，因为它的数据是热的。这可能饿死较老的任务，所以两个运行时都加了公平检查：Go 每 61 个节拍看一次全局队列，Tokio 限制 LIFO 槽连续运行三次并引入协作预算。这和第 8 章 MLFQ 的优先级提升是同一种张力。
- **自旋要花 CPU。** 一个四处找活的线程是在烧周期。运行时把窃取者的数量限制在忙碌 worker 的一半以内。在设了 CPU limit 的[[container|容器]]里，这些自旋的周期也要从配额里扣（参见 [Kubernetes 那篇](/notes/k8s-shares)）。
- **彼此看不见的两层。** 内核在核心之间移动线程，运行时在线程之间移动任务，谁也不知道对方在做什么。当运行时以为自己有 `GOMAXPROCS` = 64 个 P，而容器只被允许用两个 CPU 的时间时，结果就是 Kubernetes 那篇所描述的限流模式。这正是 Go 1.25 根据 [[cgroup|cgroup]] limit 设定 `GOMAXPROCS` 的原因。
- **内核也在偷。** Linux 给每个 CPU 一个运行队列，正如第 10 章对 CFS 的描述。一个 CPU 即将空闲时，调度器会先尝试一次“新空闲”（new idle）均衡：在附近找一个更忙的 CPU，把任务拉过来。这就是内核里的工作窃取。它的周期性[[load-balancing|均衡]]则既拉也推。

## 回到书里的那条线

::scene overview

第 10 章问：多队列调度器该如何处理负载不均？它把阈值留给了玄学。本文里的这些运行时是对这个问题的四个回答，而它们几乎在每一点上都一致：

1. 队列保持私有，让常见情况不碰共享锁，缓存保持温热。
2. 只在空闲时均衡，让忙碌的 worker 永远不为此付费。
3. 随机挑选受害者，于是不需要任何全局状态。
4. 拿最老的工作，或者半个队列，让每次窃取都物有所值。

只要有几个 worker、许多独立任务，以及一个奖励“待着别动”的缓存，同样的决定就会出现，而工作窃取是多队列一方处理失衡的办法。你的 Go 程序里跑着两份第 10 章，一份套在另一份里面。

## 延伸阅读

- Dmitry Vyukov，[Scalable Go Scheduler Design Doc](https://docs.google.com/document/d/1TTj4T2JO42uD5ID9e89oa0sLKhJYD0Y_kqxDv3I3XMw/mobilebasic)（2012）：旧调度器的问题，以及 P 的设计。
- [`src/runtime/proc.go`](https://github.com/golang/go/blob/master/src/runtime/proc.go)：Go 的调度器，文件开头有一段很长的设计注释。本文讨论的是 `findRunnable`、`stealWork` 和 `runqgrab` 这几个函数。
- [Go 1.14 Release Notes](https://go.dev/doc/go1.14)：异步抢占。
- Carl Lerche，[Making the Tokio scheduler 10x faster](https://tokio.rs/blog/2019-10-scheduler)（2019），以及 [Reducing tail latencies with automatic cooperative task yielding](https://tokio.rs/blog/2020-04-preemption)（2020）。
- [tokio::runtime](https://docs.rs/tokio/latest/tokio/runtime/index.html)：多线程调度器的队列、LIFO 槽与窃取的现行文档。
- Doug Lea，[A Java Fork/Join Framework](https://gee.cs.oswego.edu/dl/papers/fj.pdf)（2000），以及 [`ForkJoinPool` API 文档](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ForkJoinPool.html)。
- [JEP 444: Virtual Threads](https://openjdk.org/jeps/444)：虚拟线程的调度器是一个 FIFO 模式的 ForkJoinPool。
- Robert D. Blumofe 等，[Cilk: An Efficient Multithreaded Runtime System](https://people.cs.umass.edu/~emery/classes/cmpsci691s-fall2004/papers/blumofe95cilk.pdf)（PPoPP 1995）：随机受害者、最浅窃取，以及空间、时间和通信的界。
- Robert D. Blumofe、Charles E. Leiserson：*Scheduling Multithreaded Computations by Work Stealing*，Journal of the ACM 46(5)，1999：T~1~/P + O(T~∞~) 这一结果。
