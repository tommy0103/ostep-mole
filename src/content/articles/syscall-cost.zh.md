---
deck: 系统调用就是书里的陷阱，而 2018 年以来，每一次陷入都变贵了。时间花在了哪里？vDSO、批处理和 io_uring 又是怎样减少往返次数的？
title: 当陷入本身变得太贵：系统调用的代价，以及绕开它的三条路
---

::scene overview

2018 年 1 月，[[spectre|Meltdown]] 攻击公之于众。几周之内，Linux 4.15 带着修补方案发布：**[[kpti|内核页表隔离]]**（kernel page-table isolation，KPTI）。不久，当时在 Netflix 的 Brendan Gregg 公布了它的代价。他写道，这些补丁带来了“我见过的最大的内核性能回退”。Netflix 的典型服务付出的代价远低于百分之一；而在他构造的最坏情况下——系统调用频率高、[[working-set|工作集]]又大——程序慢了 800% 以上。

程序本身一行没改，变的是每一趟进出内核的价钱。这篇文章讲的就是这个价钱：在现代 CPU 上，一次陷入究竟花多少；为什么它取决于书里那张时间线没画出来的东西；以及系统工程师们减少往返次数的三条路。

## 用书里的话来问

第 6 章把它叫作*受限*直接执行。用户代码全速运行，直到它需要某件只有内核才能做的事。这时它执行一条陷阱指令，硬件切换到内核模式、经由陷阱表跳转，内核做完事后再用“从陷阱返回”把它送回去。“受限”这部分让系统安全，也正是这部分要花时间。

::scene account

于是问题变成了一道记账题。如果一个程序每秒跨越用户态/内核态边界 *n* 次，每次代价为 *c*，那么它每秒就有 *n* · *c* 单单花在跨越上。系统可以降低 *c*，也可以降低 *n*。2018 年之后 *c* 涨了，主战场于是转向了 *n*。

::chapter cpu-mechanisms

这一章关于上下文切换开销的补充给出了 1996 年的基准：在 200 MHz 的 P6 上，一次系统调用大约 4 微秒。现代机器快得多，但书中也引用了 Ousterhout 的提醒：操作系统的操作并不随 CPU 速度同步变快，因为其中大量工作是内存访问。这句提醒就是本文的全部故事。

::scene trap

## 一次陷入到底做了什么

先看硬件那一半。在 [[x86-64|x86-64]] 上，程序发起系统调用时，把调用号放进 `rax`，最多六个参数依次放进 `rdi`、`rsi`、`rdx`、`r10`、`r8`、`r9`，然后执行 `SYSCALL`。这条指令做的事比你想象的少：

- 把返回地址存进 `rcx`，把标志寄存器存进 `r11`。
- 从[[msr|模型特定寄存器]]（MSR）`IA32_LSTAR` 里取出新的指令指针——这个值由内核在开机时写入。这就是书里的陷阱表，缩减成了一个入口。
- 切换到内核特权级，并清除 `IA32_FMASK` 中指定的标志位；Linux 借此让内核一进来就处于关中断状态。
- **不**切换栈指针。此刻内核运行在用户的栈上，而它绝不能信任这个栈。

剩下的全靠软件。内核入口代码用 `swapgs` 换上自己的[[per-cpu|每 CPU 数据]]，暂存用户栈指针，若开启了 KPTI 就切换[[page-table|页表]]，载入内核栈，再把用户的每一个寄存器压进 `struct pt_regs`——也就是书中图 6.2 里“把寄存器保存到内核栈”那一格。返回时，这一切再倒着做一遍。

下面的实验按书里的粒度演示了这个过程。选“系统调用”场景，单步走一遍，数一数有几步既不是你的程序、也不是系统调用处理程序在替你干活——它们全是在保存、切换、恢复。在真实硬件上，这里的每一格都比书写成时更胖了。

::lab Lde

单独测量时，直接开销并不大。2014 年，Denys Vlasenko 在一台 2.7 GHz 的 Intel Core i7-2620M 上测得 64 位 `getpid()` 约 54 纳秒。那是在 KPTI 之前，也在如今入口路径上要执行的 Spectre 缓解措施之前。

:::fold 内核入口代码长什么样
下面是近期主线内核 `arch/x86/entry/entry_64.S` 中 64 位系统调用入口的开头部分，有删节，注释有所增补。每一行都对应书中时间线上的某一格，其中好几行在 2018 年之前并不存在。

```text
SYM_CODE_START(entry_SYSCALL_64)
	swapgs                                    /* 换上内核的每 CPU 基址 */
	movq	%rsp, PER_CPU_VAR(cpu_tss_rw + TSS_sp2)   /* 暂存用户栈指针 */
	SWITCH_TO_KERNEL_CR3 scratch_reg=%rsp     /* KPTI：切换到完整页表 */
	movq	PER_CPU_VAR(cpu_current_top_of_stack), %rsp

	/* Construct struct pt_regs on stack */
	pushq	$__USER_DS                        /* pt_regs->ss */
	pushq	PER_CPU_VAR(cpu_tss_rw + TSS_sp2) /* pt_regs->sp */
	pushq	%r11                              /* pt_regs->flags */
	pushq	$__USER_CS                        /* pt_regs->cs */
	pushq	%rcx                              /* pt_regs->ip */
	pushq	%rax                              /* pt_regs->orig_ax */
	PUSH_AND_CLEAR_REGS rax=$-ENOSYS

	movq	%rsp, %rdi
	movslq	%eax, %rsi
	IBRS_ENTER                                /* Spectre 一类的缓解措施 */
	UNTRAIN_RET
	CLEAR_BRANCH_HISTORY
	call	do_syscall_64
```

有三个细节值得注意：

- 书里说由“硬件”保存的那个栈帧，其实是内核亲手搭起来的。`SYSCALL` 只保存了两个寄存器。
- `PUSH_AND_CLEAR_REGS` 先保存用户寄存器，再把它们清零，免得用户挑选的值在内核里诱导[[speculative-execution|推测执行]]。
- `SWITCH_TO_KERNEL_CR3`、`IBRS_ENTER`、`UNTRAIN_RET` 和 `CLEAR_BRANCH_HISTORY` 都是针对 2018 年以来陆续发现的硬件漏洞的缓解措施。哪些真正在干活，取决于 CPU 型号和启动参数；用不着的，内核会在开机时把它打补丁去掉。
:::

::scene indirect

## 看不见的那部分代价

54 ns 是*直接*开销：花在边界本身上的周期。2010 年，Livio Soares 和 Michael Stumm 证明这远不是账单的全部。他们的 FlexSC 论文（OSDI 2010）在 Intel Core i7 上测量了一个 [[spec-cpu|SPEC]] 基准程序在一次系统调用前后的用户态[[instructions-per-cycle|每周期指令数]]（IPC）。系统调用返回之后，程序会有一段时间跑得更慢，忙着把被内核挤掉的东西重新装回来：[[pipeline|流水线]]、[[cpu-cache|L1 缓存]]、[[tlb|TLB]]。他们的结论是：同步系统调用之所以严重拖累性能，“主要是因为流水线被冲刷，以及关键处理器结构受到污染”。

第 7 章讲上下文切换时说的是同一件事：代价还包括缓存和 TLB 里那些温热的状态，下一段代码得把它们重建起来。陷入就是一次小小的上下文切换——进入内核再回来——交的是同一种间接税。

FlexSC 开出的药方预示了 [[io-uring|io_uring]]：[[thread|线程]]把请求写进[[shared-memory|共享内存]]，由其他核上的[[kernel-thread|内核线程]]取走处理。论文报告，在应用程序不做任何修改的情况下，Apache 最多快了 116%，MySQL 最多 40%，BIND 最多 105%。

::scene kpti

## 2018：价钱上涨

只要内核被映射在进程的页表里，Meltdown 就能让用户代码借助推测执行读出内核内存。而 Linux 和大多数内核一样，把自己映射进了每一个进程（标记为仅限特权级访问），好让陷入时不必切换地址空间。KPTI 拿掉了这条捷径：每个进程现在有两套页表，一套完整的给内核用，另一套给用户态用，只映射进出内核所必需的入口代码。每一次系统调用、中断和异常，进入时要切换一次 [[cr3|`CR3`]]（页表基址寄存器），退出时再切换一次。

::scene pcid

内核文档（2018 年）说，写 `CR3` 的代价“在一百个周期的量级”。这是直接的部分。更大的部分是间接的：写 `CR3` 通常会清空 TLB，所以如果没有额外帮助，每次系统调用都会扔掉所有缓存好的地址转换。这份帮助就是 x86 的 **[[pcid|PCID]]**（进程上下文标识符）：它给 TLB 项打上标签，让用户态和内核态的转换得以共存。这个故事属于第 19 章，有[专门的一篇](/notes/pcid)。这里只需记住：有了 PCID，KPTI 是每次跨越都要交的一笔税；没有 PCID，KPTI 会在每次跨越时把你的 TLB 清空。

:::fold Gregg 是怎么测的，800% 又是怎么来的
Gregg 2018 年的分析在 AWS 实例上进行，内核为 Linux 4.14，用一个微基准分别调节系统调用频率和工作集大小。他列出了决定开销的五个因素：系统调用频率、上下文切换频率、[[page-fault|页错误]]频率、工作集大小，以及缓存访问模式。

他的部分数据：

- 每 CPU 每秒 5 万次系统调用时，开销约为 2%。低于约 1 万次（Netflix 典型服务的水平）时，他预计开销不到 0.5%。
- 每 CPU 每秒 5000 次、工作集较大时，较老的 4.4 和 4.9 内核上开销约 2.1%，启用了 PCID 的 4.14 上约 0.5%。
- 工作集超过约 10 MB 后，TLB 清空会带来额外开销，可能把 1% 变成 7%；缓存访问模式还可能再加 1% 到 10%。
- 在他构造的最坏情况下，每周期指令数从 0.86 跌到 0.10，有 27.4% 的周期花在数据 TLB 未命中后的页表遍历上。“800% 以上”就是这么来的。

他对 Netflix 整个机群的估计是 0.1% 到 6%，调优后的目标是低于 2%：使用支持 PCID 的内核、使用[[huge-page|大页]]，以及减少系统调用。注意最后一条：应对昂贵陷入的办法，有一部分就是少陷入。
:::

::scene vdso

## 第一条路：根本不陷入

有些系统调用只是读一个内核早已知道的值，当前时间就是典型例子：给每个请求打时间戳的程序会不停地调用 `clock_gettime()`，而这些调用没有一次需要特权硬件，需要的只是内核随时更新的几个数。

**[[vdso|vDSO]]**（virtual dynamic shared object，虚拟动态共享对象）就是内核的回答。每次 [[fork-exec|`execve()`]] 时，内核把一个小小的 [[elf|ELF]] 库映射进新进程，并在[[auxv|辅助向量]]里告知它的（随机化的）地址。[[libc|C 库]]把 `clock_gettime()` 这类调用转给它，而不再陷入；在 x86-64 上，它导出 `clock_gettime`、`gettimeofday`、`time` 和 `getcpu`。代码旁边是一个只读数据页，内核把当前时钟参数发布在那里。vDSO 函数读这个页，通常再读一下 CPU 的[[tsc|时间戳计数器]]，然后在用户态把账算完。用[[man-page|手册页]]的话说，这个调用“从一次系统调用变成了一次普通函数调用加上几次内存访问”。

这依然是受限直接执行，只是边界挪了位置：进程可以*读*内核发布的值，但不能写。如果没有快速路径可走——比如时钟源没法在用户态读取——vDSO 函数就悄悄地发起真正的系统调用。这个思路还在扩展：Linux 6.11（2024 年）加入了 Jason Donenfeld 编写的 vDSO 版 `getrandom()`，他报告生成 32 位随机数时快了“大约 15 倍”。

::scene batch

## 第二条路：一次陷入，多个请求

当工作确实需要内核来做时，系统可以让多个操作分摊一次固定开销。这就是摊销——第 7 章在时间片问题上推荐的同一招：当一个操作有固定成本时，少做几次，让每次承载更多工作。

UNIX 很早就这么做了。`readv()` 和 `writev()` 一次调用搬动多个缓冲区；`sendmmsg()`（Linux 3.0）和 `recvmmsg()` 一次调用收发多个数据报；[[epoll|`epoll_wait()`]] 一次返回多个就绪的[[handle|文件描述符]]。套路始终如一：把 *n* 次陷入换成一次携带 *n* 个请求的陷入。

它的局限在于：每一批都得先凑齐，再通过一次程序必须等着的调用交出去。想在前面的工作还在进行时继续提交新的工作，就得把“调用”这一步挪开。

::scene rings

## 第三条路：共享队列

**[[io-uring|io_uring]]** 由 Jens Axboe 编写，2019 年 5 月随 Linux 5.1 合入。它干脆把“调用”从交接环节里拿掉了。核心是两个由进程和内核共享的[[ring-buffer|环形缓冲区]]：

- **提交队列**（submission queue，SQ）。应用程序写入请求描述符（SQE）并推进队尾；内核从队头读取。
- **完成队列**（completion queue，CQ）。内核写入结果（CQE）并推进队尾；应用程序从队头读取。

每一方只写每个环的自己那一端，所以双方可以并行工作而不必加锁，靠[[memory-barrier|内存屏障]]来发布更新。初始化要花几次系统调用（`io_uring_setup()` 和几次 [[mmap|`mmap()`]]）。此后，一次 `io_uring_enter()` 就能把目前排好的请求一并提交，*同时*等待完成事件——都在同一次陷入里。

::scene sqpoll

所以在默认模式下，io_uring 是第二条路的更好接口：每次陷入承载多个请求，完成结果异步到达。设置 `IORING_SETUP_SQPOLL` 标志后它更进一步：内核启动一个线程轮询提交环，应用程序只要写内存就算提交，完全不用系统调用。如果环一直空闲（默认约一秒），这个线程就会睡去，并置上 `IORING_SQ_NEED_WAKEUP` 标志，应用程序这时需要调用一次 `io_uring_enter()` 把它叫醒。注册的（“固定”）缓冲区和文件则让映射和文件引用只建立一次，而不是每个操作都来一遍。

下面这个程序用 `liburing` 辅助库读取一个文件的八个块，大致展示了用法。`IORING_OP_READ` 需要 Linux 5.6 及以上，编译时加 `-luring`。

```c
#include <fcntl.h>
#include <liburing.h>
#include <stdio.h>

#define N  8
#define BS 4096

int main(int argc, char **argv)
{
    struct io_uring ring;
    static char buf[N][BS];
    if (argc < 2) return 1;
    int fd = open(argv[1], O_RDONLY);
    if (fd < 0 || io_uring_queue_init(N, &ring, 0) < 0) return 1;

    for (int i = 0; i < N; i++) {              /* 在共享环里填好 N 个槽位：没有系统调用 */
        struct io_uring_sqe *sqe = io_uring_get_sqe(&ring);
        io_uring_prep_read(sqe, fd, buf[i], BS, (__u64)i * BS);
        io_uring_sqe_set_data(sqe, (void *)(long)i);
    }
    io_uring_submit(&ring);                     /* 一次 io_uring_enter() 交出全部 N 个 */

    for (int i = 0; i < N; i++) {               /* 完成顺序不一定与提交顺序相同 */
        struct io_uring_cqe *cqe;
        io_uring_wait_cqe(&ring, &cqe);         /* 只有 CQ 为空时才进入内核 */
        printf("block %ld: %d bytes\n", (long)io_uring_cqe_get_data(cqe), cqe->res);
        io_uring_cqe_seen(&ring, cqe);
    }
    io_uring_queue_exit(&ring);
    return 0;
}
```

无论排了多少个读请求，提交都只花一次陷入；等待只有在还没有完成结果时才会陷入。开启 SQPOLL 后，一个持续繁忙的程序可以一次都不陷入。

:::fold 自己测一测
第 6 章的作业要你测一次系统调用的耗时。这个版本还把同一个操作——读单调时钟——计时两次：一次经由 vDSO，一次用 `syscall()` 强制走真正的陷入。

```c
#define _GNU_SOURCE
#include <stdio.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

static double now(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec + ts.tv_nsec / 1e9;
}

int main(void)
{
    enum { N = 10000000 };
    struct timespec ts;
    double t0 = now();
    for (int i = 0; i < N; i++)
        syscall(SYS_getpid);                               /* 每次都真正陷入 */
    double t1 = now();
    for (int i = 0; i < N; i++)
        clock_gettime(CLOCK_MONOTONIC, &ts);               /* vDSO：通常不陷入 */
    double t2 = now();
    for (int i = 0; i < N; i++)
        syscall(SYS_clock_gettime, CLOCK_MONOTONIC, &ts);  /* 同样的工作，强制走陷入 */
    double t3 = now();
    printf("getpid, trap          %6.1f ns\n", (t1 - t0) / N * 1e9);
    printf("clock_gettime, vDSO   %6.1f ns\n", (t2 - t1) / N * 1e9);
    printf("clock_gettime, trap   %6.1f ns\n", (t3 - t2) / N * 1e9);
    return 0;
}
```

用 `cc -O2 cost.c` 编译，再用 `taskset -c 0 ./a.out` 把它钉在一个 CPU 上。值得试三件事：

- 比较第二行和第三行。两者做的工作完全相同，差值就是一次陷入的价钱。
- 看看 `/sys/devices/system/cpu/vulnerabilities/`，这里列出了 CPU 已知的漏洞和启用的缓解措施——也就是你的入口路径在为什么买单。
- 在一台可以随便折腾的测试机上，用 `nopti` 启动一次再比较。这会去掉针对 Meltdown 的保护；运行不受信任代码的地方绝不要这么做。

在虚拟机里，如果时钟源无法经由 vDSO 读取，“快速”路径就会退回到陷入。
:::

::scene surface

## 理想方案在哪里弯折

每条路都只是把代价挪到了别处：

- **vDSO 只适用于以读为主的数据：** 时钟、CPU 编号，如今还有随机字节。它帮不了要修改内核状态的调用。
- **批处理会增加延迟。** 攒够 64 个包再用一次 `sendmmsg()` 发出去，第一个包就得等着：用响应时间换吞吐量，和第 7 章里选更长的时间片是同一笔交易。
- **轮询要烧掉一个核。** 在空闲的环上自旋的 SQPOLL 线程占着一颗 CPU；空闲超时就是折中。
- **共享内存意味着更大的攻击面。** 陷入只有一个狭窄、受检查的入口；io_uring 却是一个庞大的异步子系统，从用户随时可以改动的内存里读取请求。2023 年 6 月，Google 披露：过去一年提交到其 kCTF 漏洞奖励计划的内核[[exploit|漏洞利用]]中，60% 利用了 io_uring。Google 在 ChromeOS 和生产服务器上禁用了 io_uring，并用 [[seccomp|seccomp-bpf]] 过滤器让 Android 应用无法触及它。

最后一点正是书中安全论证的反面。第 6 章提醒内核要对用户输入保持怀疑，而陷入是施加这种怀疑的好地方，因为入口只有一个。每一种绕过陷入的设计，都得在别处把这份怀疑重新建立起来。

::scene overview

## 回到书里的那条线

这三条路归结起来，是书里头几章的两个想法。

第一个是摊销：固定成本降不下来，就把它摊到更多的工作上，就像第 7 章对时间片所做的那样。

第二个是受限直接执行本身的形状。vDSO 把“不能碰内核状态”放宽为“可以读”；io_uring 把“必须经由陷阱表进入”变成“可以把请求留在一个内核答应会盯着的队列里”。两种情况下内核都保住了控制权；边界挪了位置，跨越变得更便宜。“直接运行”与“保住控制权”之间的这种张力，在内核之上的每一层都会重现——那正是[本章末尾那条线索](/notes/lde-everywhere)的主题。

## 延伸阅读

- [The current state of kernel page-table isolation](https://lwn.net/Articles/741878/)（LWN，2017 年 12 月）：KPTI 如何拆分页表。
- [Page Table Isolation (PTI)](https://docs.kernel.org/arch/x86/pti.html)：内核自己的文档，含开销一节。
- [KPTI/KAISER Meltdown Initial Performance Regressions](https://www.brendangregg.com/blog/2018-02-09/kpti-kaiser-meltdown-performance.html)（Brendan Gregg，2018 年 2 月）：五个因素、测量数据和 800% 的案例。
- [vdso(7)](https://man7.org/linux/man-pages/man7/vdso.7.html)：各体系结构上 vDSO 导出哪些函数。
- [Ringing in a new asynchronous I/O API](https://lwn.net/Articles/776703/)（LWN，2019 年 1 月）：io_uring 最初提出时的设计，包括 SQPOLL 和固定缓冲区。
- [io_uring(7)](https://man7.org/linux/man-pages/man7/io_uring.7.html)：环的布局、队头/队尾归属，以及一个不依赖 liburing 的示例。
- Livio Soares、Michael Stumm：[FlexSC: Flexible System Call Scheduling with Exception-Less System Calls](https://www.usenix.org/conference/osdi10/flexsc-flexible-system-call-scheduling-exception-less-system-calls)，OSDI 2010：系统调用的间接开销，有实测。
- [Learnings from kCTF VRP’s 42 Linux kernel exploits submissions](https://security.googleblog.com/2023/06/learnings-from-kctf-vrps-42-linux.html)（Google，2023 年 6 月）：关于 io_uring 安全问题的数据。
