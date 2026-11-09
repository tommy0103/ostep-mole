---
deck: 2018 年的 Meltdown 迫使内核在每次系统调用时都切换页表。让这件事不至于每秒清空 TLB 成千上万次的，是每个 TLB 项上一个 12 位的标签——第 19 章讲的地址空间标识符。
title: ASID 如何挽救了 Meltdown 修补后的性能
---

::scene overview

2018 年 1 月 7 日，[[spectre|Meltdown]] 公开四天后，Gil Tene 在 mechanical-sympathy 邮件列表上发了一条短帖。他写道，一个叫 [[pcid|PCID]] 的 CPU 特性“过去几乎可有可无”，如今却成了“一个性能与安全都至关重要的东西”。他给了一个谁都能跑的检查命令 [[proc-sys|`grep pcid /proc/cpuinfo`]]，并报告说：他看过的 Linux 实例大多没有这个标志，尽管它们全都跑在现代硬件上。

PCID 就是第 19 章里的地址空间标识符，只是换了个名字。本文要解释的是：一个打在 TLB 项上的标签，在书里只是上下文切换的一项优化，为什么突然决定了一个安全补丁在全世界每台服务器上要付出多大代价。

::scene asid

## 书里的 ASID，以及它留下的问题

::chapter vm-tlbs

第 19 章提出了一个问题：地址转换旁路缓冲存储器（TLB）缓存的是当前进程的地址映射，上下文切换之后，这些映射就属于别人了。简单的办法是每次切换都清空（flush）TLB——正确，但慢，因为每个进程都得从一个冷的 TLB 开始。

更好的办法是**地址空间标识符**（Address Space Identifier，ASID）：在每个 TLB 项里放几位，标明这一项属于哪个地址空间。硬件在比对虚拟页号的同时也比对这个标签，于是多个进程的映射可以同时待在 TLB 里。书中的 MIPS TLB 项有 8 位 ASID，这一节最后留了个问题：如果同时运行的进程超过 256 个，操作系统该怎么办？

x86 很晚才有了同样的机制：大约 2010 年 Intel 的 Westmere 一代，名叫**进程上下文标识符**（Process-Context Identifier，PCID）。此后多年 Linux 并没有用它。上下文切换每秒也许几百、几千次，每次都清空一遍，是大家早已习惯的开销。2018 年变了的是：内核突然需要在每次进入内核、每次离开内核时，都执行一次会清空 TLB 的操作。

::scene shared

## Meltdown 打破了什么

直到 2018 年，所有主流内核都把自己映射进每一个进程的地址空间。内核的页位于每张页表的上半部分，标记为仅限特权态访问，所以用户程序读不到它们；但系统调用或中断也就不必切换页表，一次陷阱（[第 6 章](/virtualization/cpu-mechanisms)）只需改变特权级。内核的映射还被标记为**全局**（global）：这一位告诉 x86，即使重新加载 [[cr3|CR3]]（指向页表的那个寄存器），也要保留这个 TLB 项。因此内核的映射在上下文切换之后也能存活。

::scene meltdown

Meltdown（Lipp 等，USENIX Security 2018）表明，在许多 Intel 处理器上，权限检查是可以被抢跑的。用户程序发出一条读内核地址的加载指令，CPU [[speculative-execution|推测地、乱序地]]执行它，在触发异常之前就把读到的值用在了后续指令里。异常会丢弃寄存器里的结果，却抹不掉留在缓存里的痕迹，一次计时测量就能把偷来的字节恢复出来。用论文的话说，Meltdown 能“读取任意内核内存位置”。页表权限本身并没有错；泄漏的根源在于内核根本就被映射着。

所以修补必须在用户代码运行时把内核从映射中拿掉。办法其实已经写好了：2017 年，Daniel Gruss 等人发表了 **KAISER**，一种为保护 [[kaslr|KASLR]] 免受[[side-channel|侧信道]]攻击而把内核排除在用户页表之外的设计。Meltdown 的作者指出，KAISER“有一个重要（但并非有意）的副作用：它能阻止 Meltdown”。Linux 把改写后的版本作为**内核页表隔离**（kernel page-table isolation，KPTI）并入了 2018 年 1 月 28 日发布的 4.15，并向稳定版内核做了[[backport|回移]]。在 Linux 上，`/sys/devices/system/cpu/vulnerabilities/meltdown` 会告诉你它是否启用。

::scene kpti

## 每个进程两张页表

有了 KPTI，每个进程都有两张顶层页表：

- **内核**副本映射一切：进程的用户内存和整个内核。
- **用户**副本映射进程的内存，外加进出内核所必需的那一点内核数据。内核文档列出的是入口与出口代码、[[idt|中断描述符表]]，以及一块存放入口栈的[[per-cpu|每 CPU 区域]]。

如今每一次进入内核——无论是系统调用、中断还是异常——都以把内核副本装进 CR3 开始；每一次返回用户态，都以把用户副本装进 CR3 结束。内核文档（2018 年）估计一次写 CR3“大约在一百个周期的量级”。这是实打实的开销，但不是大头。

::scene flush

大头在于写 CR3 对 TLB 做了什么。文档说，在不支持 PCID 的系统上，“每次写 CR3 都会清空整个 TLB”。全局位帮不上忙，因为 KPTI 对没有同时映射在两张表里的内核结构关掉了它。结果就是每次进入内核清空一次，每次离开再清空一次：

1. 用户程序带着一个热的 TLB 在运行。
2. 它发起一次系统调用。入口代码切到内核页表，TLB 被清空。内核在自己的代码、栈和数据上一路未命中。
3. 系统调用返回。出口代码切回去，TLB 再次被清空。程序在它接下来碰到的每一样东西上都未命中。

一台每个 CPU 每秒做 5 万次系统调用的服务器，现在每个 CPU 每秒要清空 TLB 10 万次。每次清空本身的直接开销不大，贵的是随后的未命中：最坏情况下每一次都是一趟四级[[page-walk|页表遍历]]，而且在每次切换之后，程序和内核碰到的每一页都要重来一遍。

::scene tag

## 给两半各打一个标签

PCID 让写 CR3 对 TLB 而言变得便宜。启用这一特性（CR4 的第 17 位）后，CR3 的低 12 位存放一个 PCID，一共 4096 个可能的标签。TLB 项会被打上创建它时的当前 PCID，只有当前 PCID 匹配时才会被使用。写入 CR3 的值的第 63 位是一个*不清空*（no-flush）位：置上它，加载 CR3 就只切换地址空间，什么也不丢。

KPTI 给每个地址空间两个 PCID，一个给内核副本，一个给用户副本。Linux 源码里管它们叫 kPCID 和 uPCID，uPCID 等于 kPCID 加 2048，也就是 PCID 的第 11 位。内核的顶层页表按一对 8 KiB 来分配，用户副本在第二个 4 KiB 页里，所以 CR3 的第 12 位选择用哪张表。无论往哪个方向穿过边界，都是翻转这两位，并且在通常情况下置上不清空位。于是内核的映射和程序的映射在 TLB 里并排共存——这正是书里那幅一个 TLB 同时容纳两个地址空间的图景，只不过这里的“两个”，是同一个进程在两个特权级下的样子。

:::fold 逐行看返回用户态的代码
下面是返回用户态途中执行的宏，取自当前主线 Linux 的 `arch/x86/entry/calling.h`。`ALTERNATIVE` 会在启动时被打补丁：在没有 PCID 的 CPU 上，第一个 `ALTERNATIVE` 变成一条直接跳到最后写 CR3 的跳转指令，那次写入就会清空 TLB。

```text
.macro SWITCH_TO_USER_CR3 scratch_reg:req scratch_reg2:req
	mov	%cr3, \scratch_reg

	ALTERNATIVE "jmp .Lwrcr3_\@", "", X86_FEATURE_PCID

	/*
	 * Test if the ASID needs a flush.
	 */
	movq	\scratch_reg, \scratch_reg2
	andq	$(0x7FF), \scratch_reg		/* mask ASID */
	bt	\scratch_reg, THIS_CPU_user_pcid_flush_mask
	jnc	.Lnoflush_\@

	/* Flush needed, clear the bit */
	btr	\scratch_reg, THIS_CPU_user_pcid_flush_mask
	movq	\scratch_reg2, \scratch_reg
	jmp	.Lwrcr3_pcid_\@

.Lnoflush_\@:
	movq	\scratch_reg2, \scratch_reg
	SET_NOFLUSH_BIT \scratch_reg

.Lwrcr3_pcid_\@:
	/* Flip the ASID to the user version */
	orq	$(PTI_USER_PCID_MASK), \scratch_reg

.Lwrcr3_\@:
	/* Flip the PGD to the user version */
	orq     $(PTI_USER_PGTABLE_MASK), \scratch_reg
	mov	\scratch_reg, %cr3
.endm
```

分三步读：

1. 取当前 CR3，屏蔽出低 11 位。这就是内核侧的 PCID，代码里称之为 ASID。
2. 拿这个数去查一张每 CPU 的位图 `user_pcid_flush_mask`。某一位被置上，意味着内核在内核态时改动了这个地址空间的用户映射，却还没清掉用户侧的表项。这时清掉这一位，并在写 CR3 时*不*置不清空位，让用户 PCID 的表项在出门时被丢弃。否则就置上第 63 位，什么也不清空。
3. 置上第 11 位（切到用户 PCID）和第 12 位（切到 8 KiB 页表对中的用户那一半），然后写 CR3。

进门的 `SWITCH_TO_KERNEL_CR3` 更短：有 PCID 就置上不清空位，清掉第 11 和第 12 位，写 CR3。每个方向只要几条指令加一次写 CR3，通常情况下不清空 TLB。
:::

::scene asids

## 六个 ASID 就够了

内核开发者在 Meltdown 公开之前，就已经回答了书里“超过 256 个进程”的问题。Andy Lutomirski 的 PCID 支持在 2017 年 11 月并入 Linux 4.14，目的是让 TLB 项在普通的上下文切换之后得以保留。它没有给每个进程一个永久标签，而是给每个 CPU 一个小小的“最近使用的地址空间”缓存：

```c
/*
 * 6 because 6 should be plenty and struct tlb_state will fit in two cache
 * lines.
 */
#define TLB_NR_DYN_ASIDS	6
```

上下文切换时，`choose_new_asid()` 在这个 CPU 的六个槽位里找即将运行的地址空间。找到了，就沿用那个 ASID，并且只在该地址空间的页表此后有过改动时才清空——判断依据是一个代数计数器 `tlb_gen`，地址空间和每个槽位各记一份。找不到，就按轮转取下一个槽位，把那个槽位原来的内容清掉。ASID 是每 CPU 的、短命的，所以一台机器跑着成千上万个进程也无妨。要紧的是单个 CPU 在短时间内在多少个地址空间之间来回切换，而这通常只有寥寥几个。

ASID 到 PCID 的映射在源码里一目了然：内核 PCID 是槽位号加一（PCID 0 留给不认识 PCID 的代码），用户 PCID 再加 2048。较新的内核还增加了第二段*全局* ASID，在所有 CPU 上都相同，供那些能用 INVLPGB 指令向其他 CPU [[tlb-shootdown|广播 TLB 失效]]的 AMD 处理器使用。

::scene invalidate

## 清空你看不见的东西

打标签带来了一个新问题：TLB 里如今存着非当前地址空间的表项。当内核从某个进程解除一页的映射时（比如在 [[mmap|`munmap()`]] 里），也必须删掉用户侧的那条映射。可内核运行时，当前 PCID 是内核的，普通的 [[invlpg|`invlpg`]] 只保证作用于当前 PCID。

有两件工具对付这个问题。Intel 在 Haswell 一代加入的 **INVPCID** 能使属于非当前 PCID 的表项失效，所以要丢掉单个页时，Linux 直接清掉用户侧的那一项。没有 INVPCID 时，以及需要清空整个 TLB 时，Linux 就用上面折叠里的那张位图：给用户 PCID 置位，让出口路径做一次会清空的 CR3 写入。内核文档把这称为把用户侧的清空推迟“到退出到用户态时，把代价降到最低”。如果进程再也没有在这个 CPU 上回到用户态，这次清空就根本不必发生。

::scene flush

## 代价几何，PCID 挽回了多少

Brendan Gregg 在 2018 年 2 月测量了 KPTI 在 Netflix 的开销，发表了最清楚的记述之一。他发现代价取决于五个因素：系统调用频率、上下文切换频率、页错误频率、[[working-set|工作集]]大小和缓存访问模式。经验上，每个 CPU 每秒 5 万次系统调用时，“开销可能是 2%，并随系统调用频率上升而攀升”；每秒低于 1 万次的服务，开销应当不到 0.5%。

::scene tag

PCID 的作用体现在其中 TLB 的那一部分。在一个每 CPU 每秒 5000 次系统调用、工作集 100 MB 的微基准里，他在打了 KPTI 补丁的 4.4 和 4.9 [[lts-kernel|长期支持内核]]上测到约 2.1% 的开销，而在“支持 pcid”的 4.14 上约为 0.5%。再加上[[huge-page|大页]]，开销反而变成了 3.0% 的*收益*。

:::fold Brendan Gregg 的 TLB 计数器
Gregg 用[[perf-counter|硬件性能计数器]]测量了数据 TLB 和指令 TLB 未命中后用于页表遍历的周期占比，取的是同一个微基准里的一个点，所在系统上不带 PCID 的 KPTI 开销为 8.7%。以下是他的数据：

| 配置 | DTLB 遍历周期 | ITLB 遍历周期 |
|---|---|---|
| 无 KPTI | 0.23% | 0.01% |
| KPTI，无 PCID | 2.91% | 2.21% |
| KPTI，有 PCID | 0.22% | 0.32% |
| KPTI、PCID 加 [[thp|THP]] | 0.00% | 0.22% |

第二行就是“每次穿越都清空”的问题：数据侧的遍历周期涨了十倍多，指令侧涨了两百多倍。第三行是书里的 ASID 在起作用：两半各有标签之后，数据 TLB 的遍历周期回落到未打补丁时的水平。第四行加上了[大页](/notes/huge-pages)：覆盖范围更大，数据侧的遍历干脆消失了。

他还拿真实负载检验了自己的估算。MySQL OLTP 基准在 8 个 CPU 上、每 CPU 每秒约 7.5 万次系统调用，他估计开销约 4%，实测 5%；一个每 CPU 每秒 21 万次系统调用的压力测试，他估计不到 12%，实测 25%。他构造的最坏情形开销超过 800%，[[instructions-per-cycle|每周期指令数]]从 0.86 掉到 0.10。
:::

剩下的代价是穿越内核本身，它变贵了，而且一直贵着。[系统调用开销那篇](/notes/syscall-cost)讲的是故事的这一面。

::scene immune

## 理想在哪里弯折

**并非每颗 CPU 都需要它。** Meltdown 漏洞只存在于某些处理器设计中。Linux 的 CPU 初始化代码会在两类处理器上跳过这项缓解措施：一是列在 `NO_MELTDOWN` 名单上的，其中包括 AMD 的各个家族；二是通过 [[msr|`IA32_ARCH_CAPABILITIES` 寄存器]]的 `RDCL_NO` 位声明自己不受影响的 Intel 处理器。在这些机器上 KPTI 默认关闭，那套 CR3 舞步根本不会发生。

::scene vm

**云上得把标志透传进去。** 虚拟机只能看到[[hypervisor|虚拟机监控程序]]暴露给它的 CPU 特性。Tene 2018 年的帖子报告说：他查过的 KVM 客户机大多没有 `pcid` 标志，VMware 客户机全都有，AWS 实例大约一半一半。没有这个标志的客户机，在本可以避免的硬件上付着全额的清空代价。

:::fold 自己检查一台机器
三个文件就能说明一台 Linux 机器的处境。下面的命令只读不改。

```sh
grep -o -w 'pcid\|invpcid' /proc/cpuinfo | sort | uniq -c   # 这些特性暴露出来了吗？
cat /sys/devices/system/cpu/vulnerabilities/meltdown          # "Not affected" 或 "Mitigation: PTI"
grep -o 'nopti\|pti=[a-z]*' /proc/cmdline                     # 启动时被关掉了吗？
```

标志的计数是每个逻辑 CPU 各出现一次。在虚拟机里，如果看到 `Mitigation: PTI`，而第一条命令里却没有 `pcid`，那就是 Tene 警告的情形：客户机每次穿越内核都付着全额的 TLB 清空代价。
:::

::scene arm

**ARM 用它自己的 ASID 做了同样的事。** 一些 ARM 核心同样受影响，arm64 Linux 也有了自己的版本，内核里叫“unmap kernel at [[exception-level|EL0]]”。ARM 的 TLB 一直都有 ASID。arm64 的实现给每个地址空间一对只在 ASID 最低位上不同的 ASID（即转换表基址寄存器第 48 位的 `USER_ASID_BIT`），并把内核的映射改为非全局。之后的 ARM 架构版本增加了一个硬件特性 E0PD，内核自己的注释说它做的是“与 KPTI 类似的工作”。

::scene asid

## 回到书里的那条线

第 19 章给上下文切换问题开了两个方子：清空，或者打标签。几十年来 x86 内核靠清空也过得去，因为上下文切换不算频繁，全局位又护住了内核的表项。Meltdown 把每一次系统调用都变成了一次地址空间切换。在这样的频率下，清空不再负担得起；而书里讲的那个标签，自 2010 年起就一直闲置在硬件里，成了让这项缓解措施负担得起的关键。

::scene asids

Linux 对书中“超过 256 个进程”这个问题的回答值得记住：别把标签空间当成每个进程的名字，而是当作每 CPU 一个小小的地址空间缓存，按近似 LRU 的方式回收。这和 TLB 是同一个想法，只是用在了 TLB 的标签上。

打标签的技巧也出现在别处。[[virtually-indexed-cache|按虚拟地址匹配缓存行的缓存]]出于同样的理由，给缓存行打上地址空间标识符；硬件虚拟化给 TLB 项打上虚拟机标识符（Intel 叫 VPID，AMD 叫 ASID，ARM 叫 VMID），让客户机之间的切换也不必清空 TLB。只要一个缓存挡在某个频繁切换的东西前面，打标签就胜过清空。

## 延伸阅读

- [Page Table Isolation (PTI)](https://docs.kernel.org/arch/x86/pti.html)：内核文档，包括上文引用的开销清单。
- [Meltdown: Reading Kernel Memory from User Space](https://www.usenix.org/conference/usenixsecurity18/presentation/lipp)（Lipp 等，USENIX Security 2018）。
- Daniel Gruss、Moritz Lipp、Michael Schwarz、Richard Fellner、Clémentine Maurice、Stefan Mangard：*KASLR is Dead: Long Live KASLR*，ESSoS 2017。即 KAISER 论文。
- [The current state of kernel page-table isolation](https://lwn.net/Articles/741878/)（LWN，2017 年 12 月）：漏洞公开前夕的 KPTI。
- [KPTI/KAISER Meltdown Initial Performance Regressions](https://www.brendangregg.com/blog/2018-02-09/kpti-kaiser-meltdown-performance.html)（Brendan Gregg，2018 年 2 月）：上文的测量数据。
- [PCID is now a critical performance/security feature on x86](https://groups.google.com/g/mechanical-sympathy/c/L9mHTbeQLNU)（Gil Tene，2018 年 1 月）。
- [Linux 4.14](https://kernelnewbies.org/Linux_4.14)（KernelNewbies）：开始使用 PCID 的那个版本。
