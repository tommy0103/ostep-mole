---
deck: x86-64 关掉了分段，只留下两个寄存器。如今它们的基址撑起了每个进程的线程局部存储和内核的每 CPU 数据，而内核处理它们的方式，十年来麻烦不断。
title: 分段在 x86-64 上的遗存
---

::scene overview

在 [[x86-64|x86-64]] Linux 上，随便反汇编一个开启了栈保护编译的函数，开头几条指令里多半有这样一条：

```text
mov    %fs:0x28,%rax
```

它读取的是栈金丝雀（stack canary）：函数在自己的栈上放一个随机值，返回时检查它有没有被改写。`%fs:` 前缀是一个**段超越**（segment override）前缀：CPU 取出 FS 段的基址，加上 0x28，再从那里读。这就是第 16 章的机制——段基址加偏移——运行在今天编译出的代码里，运行在一颗据说二十年前就抛弃了分段的 64 位处理器上。

在内核里，另一个幸存的寄存器也在玩同样的把戏：给一个[[per-cpu|每 CPU]] 计数器加一，编译出来只有一条指令 `inc gs:[x]`，不需要 [[lock-prefix|lock 前缀]]，也不需要关[[preemption|抢占]]。

这篇文章讲 x86-64 上分段还剩下什么，为什么偏偏是这两个寄存器活了下来，以及为什么内核里管理它们的那段代码，先后成了一个 [[spectre|Spectre]] 变种、一个[[privilege-escalation|提权漏洞]]和“四条指令等了八年”的发生地。

## 第 16 章里的段

::chapter vm-segmentation

::scene segments

第 16 章把基址/界限推广开来：不再是每个进程一对，而是每个**段**一对，比如代码、堆和栈。硬件需要知道一个地址属于哪个段，书里讲了两种办法。**显式**方式用虚拟地址的高几位选择段；**隐式**方式则根据地址是怎么形成的来推断：取指令用代码段，基于栈指针或基址指针的地址用栈段。

x86 用的是隐式方式，外加一个逃生口。取指令走 CS，栈访问走 SS，大多数数据访问走 DS；指令前面可以加一个**前缀**字节，覆盖默认选择，改用另一个段寄存器：ES、FS 或 GS。FS 和 GS 是 80386 才加入的，没有固定用途，所以后来才能腾出手来干新差事。

这一章还有一段补充说明讲“段错误”这个词，说它“甚至在根本不支持分段的机器上”也流传了下来。在 x86-64 上，这话几乎可以按字面理解。

## x86 是怎么变“平”的

x86 上的分段在被关掉之前有一段很长的历史，而这段历史解释了什么东西活了下来。

::scene descriptors

在 8086（1978 年）上，段只是一种访问超过 16 位所能寻址的内存的办法：物理地址等于段寄存器左移四位，再加上一个 16 位偏移，于是能通过一个个 64 KB 的窗口访问 1 MB 内存。80286 把段寄存器变成了**选择子**（selector），即描述符表的下标，表项里存着基址、界限和保护位，很像第 16 章的段表。80386 把偏移扩展到 32 位，并加入了分页。

::scene flat

有了分页，大多数操作系统——包括 Linux 和 Windows NT——都选择了**平坦模型**（flat model）：每个段的基址都是 0，界限覆盖整整 4 GB，于是段内地址就等于[[linear-address|线性地址]]，真正干活的全是分页。分段检查仍然发生在每一次访问上，只是什么也不做了。

AMD 设计、并于 2003 年推出的 64 位扩展，把平坦模型变成了唯一的模型。内核文档说得很直白：“在 64 位模式下，CS/SS/DS/ES 段被忽略，基址总是 0。”界限也不再检查。只有两个寄存器被网开一面：FS 和 GS 保留了基址，而且现在是完整的 64 位地址。它们依然没有界限。

:::fold 8086 上的段运算，以及程序员为什么乐于告别它
8086 的地址写作 *段:偏移*，物理地址为：

> physical = segment × 16 + offset

所以 `1234:0010` 是 0x12340 + 0x10 = 0x12350。`1235:0000` 也是，另外还有大约四千个组合也是：段每隔 16 字节就重叠一次。偏移只有 16 位，所以任何一个段都只覆盖 64 KB，比这更大的数据结构得手工拆到几个段里。

这台机器上的 C 编译器把这团乱麻暴露给了程序员。它们提供各种*内存模型*（small、medium、compact、large、huge），决定代码指针和数据指针是*近指针*（near，同一段内的 16 位偏移）还是*远指针*（far，段加偏移），许多程序不得不两者混用。连判断两个远指针是否相等都不简单，因为不同的组合可能指向同一个字节。

286 的描述符加上了保护，386 把段做得足够大，大到无关紧要；分页随后让它们变得多余。这正是第 16 章的论证在市场上的演绎：作为内存管理手段的分段，输给了定长的页，原因见[定长与变长那篇](/notes/fixed-vs-variable)。剩下的是最便宜的那一部分：给地址白白多加一个基址。
:::

失去界限对至少一个项目很要紧：Google 的 [[nacl|Native Client]] [[sandbox|沙箱]]依靠 x86-32 的段界限，把不受信任的代码圈在一块区域里；到了 x86-64，它只好用保护页和一个保留寄存器重新筑起这道篱笆。这个故事见[基址加界限从未真正消失](/notes/bounds-revival)。

## FS 和 GS 有什么用

::scene tls

一个没有界限的段基址算不上保护机制。它提供的是一次每条访存指令都能免费做的加法：`%fs:off` 的意思是“从 FS 指向的地方往后 *off* 个字节”，而程序不需要知道那是哪里。让每个[[thread|线程]]的 FS 指向不同的地方，同一条指令在每个线程里就会访问到不同的位置。这是一个**每上下文指针**，不占通用寄存器，也不多花一条指令。

需要指向的上下文有两种，x86-64 Linux 给每种各用一个寄存器。

### 用户空间：线程局部存储

每个线程都有自己的一块[[tls|线程局部存储]]（TLS），[[glibc|glibc]] 让 FS 指向该线程的控制块。内核文档说，FS “通常”就是这样使用的，依赖这类运行时的应用不应再拿 FS 另作他用。在 64 位用户空间里，GS 没有约定俗成的用途。

于是，一个线程局部变量就是相对 FS 的一个固定偏移：

```c
__thread int counter;     /* 每个线程一份 */

int bump(void) { return ++counter; }
```

```text
# typical x86-64 code in an executable (local-exec TLS model), simplified
mov    %fs:counter@tpoff, %eax
add    $1, %eax
mov    %eax, %fs:counter@tpoff
```

[[linker|链接器]]把 `counter@tpoff` 变成一个常量，所以这个变量的开销和全局变量一模一样。运行时才加载的[[shared-library|共享库]]不一定能事先知道自己的偏移，只好用慢一些的指令序列，比如调用 `__tls_get_addr`。glibc 还在同一块区域的固定位置放了其他每线程数据：指向控制块自身的指针在 `%fs:0`，开头例子里的栈金丝雀在 `%fs:0x28`。在 32 位 x86 上，这份工作由 GS 承担，金丝雀放在 `%gs:0x14`。

::scene settls

设置 FS 是内核的事，因为默认情况下写段基址是特权操作。创建线程时，[[clone|`clone()`]] 配合 `CLONE_SETTLS` 接收新值；用 man 手册的话说，在 x86-64 上它就是“要设置给 %fs 基址寄存器的新值”。程序也可以调用 `arch_prctl(ARCH_SET_FS, addr)`。每次上下文切换，内核都会像保存其他寄存器一样，保存并恢复每个线程的 FS 基址。

后来设计的架构干脆专门提供一个寄存器来干这件事：[[aarch64|AArch64]] 有 `TPIDR_EL0`，用户代码用一条普通的 `mrs` 指令就能读。在 x86 上，这份差事落到了一个剩下的段寄存器头上，只因为它正好闲着。

### 内核：每 CPU 数据

::scene percpu

内核面临同样的问题，只不过是按 CPU 而不是按线程：运行队列、计数器、统计信息，每个 CPU 各存一份，免得共享[[cache-line|缓存行]]。在 x86-64 Linux 上，每个 CPU 的 GS 基址指向该 CPU 的每 CPU 区域。内核的 `this_cpu` 文档解释了这为什么重要：

```c
DEFINE_PER_CPU(int, x);

z = this_cpu_read(x);     /* 编译成一条指令：mov ax, gs:[x] */
this_cpu_inc(x);          /* inc gs:[x]，不需要 lock 前缀 */
```

没有段基址的话，读一个每 CPU 变量就得先找出当前 CPU 的编号、算出地址、再去读，而且这期间线程不能被迁移到别的 CPU 上，所以整个序列前后都要关抢占。把基址折进指令之后，算地址和用地址之间不再有空隙，于是用文档的话说，“不必为了确保处理器不变而关闭抢占或中断”。一条指令不可能被打断在一半。

## 两个 GS 基址与 SWAPGS

::scene swapgs

麻烦就在这里。用户空间可以拿 GS 自用，内核又拿 GS 存每 CPU 数据。CPU 通过系统调用、中断或异常进入内核时，装着的还是用户的 GS 基址；而内核必须先换上自己的，才能碰任何每 CPU 数据——包括告诉它该用哪个内核栈的那些数据。

AMD64 的回答是：在一个[[msr|模型特定寄存器]] `MSR_KERNEL_GS_BASE` 里藏第二个 GS 基址，再提供一条指令 `SWAPGS`，把它和当前生效的那个互换。内核进门时执行一次 SWAPGS，出门时再执行一次。内核运行期间，这个 MSR 里装的反而是*用户*的 GS 基址，与它的名字恰恰相反，内核文档也特意提醒了这一点。

SWAPGS 是个开关，所以从用户空间进入时内核必须恰好执行一次，从内核空间进入时则绝不能执行。内核正在运行时到来的中断如果也做了交换，就会在内核里装上用户的 GS 基址。因此，入口代码每次进入都必须判断：我是不是从用户态来的？

:::fold 决定是否 SWAPGS 的入口代码
::scene sign

内核的 x86-64 入口文档给出了两种判断方法。便宜的那种查看中断压在内核栈上的代码段，它的低两位就是 CPU 当时所处的[[ring|特权级]]：

```text
xorl %ebx,%ebx
testl $3,CS+8(%rsp)
je error_kernelspace
SWAPGS
```

这对 [[nmi|NMI]] 和其他几种“偏执”（paranoid）入口不管用：它们可能在任何一条指令处到来，包括普通入口刚把 CS 压栈、还没执行 SWAPGS 的那一刻。这时栈不可信，唯一可靠的办法是读出当前的 GS 基址，看它的符号：

```text
movl $1,%ebx
movl $MSR_GS_BASE,%ecx
rdmsr
testl %edx,%edx
js 1f   /* negative -> in kernel */
SWAPGS
xorl %ebx,%ebx
1:    ret
```

x86-64 Linux 的内核地址位于地址空间的上半部，所以内核的 GS 基址当作有符号数是“负”的，而用户的 GS 基址永远不是——*前提是用户空间不能随意设置 GS 基址*。本文剩下的大部分故事，都源于这个前提。
:::

## SWAPGS 撞上 Spectre

::scene spectre

2019 年 8 月，Bitdefender 的研究人员披露了恰好出在这段代码里的一个 Spectre 变种 1 问题，编号 [[cve|CVE-2019-1125]]。要不要执行 SWAPGS 是一个条件分支，而条件分支是会被[[branch-predictor|预测]]的。内核的 Spectre 文档描述了两个方向：

- 用户空间的攻击者训练分支预测器，让 CPU 在来自用户态的中断里[[speculative-execution|推测性地]]*跳过* SWAPGS。在推测窗口剩下的时间里，基于 GS 的每 CPU 读取用的是攻击者选定的值，它们对缓存的影响可能泄露内核内存。
- 从内核态进入时，CPU 推测性地*执行*了 SWAPGS，于是内核代码带着用户的 GS 基址推测运行。

修复办法是在中断、异常和 NMI 入口路径上、SWAPGS 判断之后放上 `LFENCE` 屏障，在分支结果确定之前什么都不推测执行。打过补丁的机器上，`/sys/devices/system/cpu/vulnerabilities/spectre_v1` 会报告“Mitigation: usercopy/swapgs barriers and __user pointer sanitization”。它是 2018–2019 年那一批让内核入口路径变贵的修复之一；另一项是针对 Meltdown 的页表隔离，见[PCID 那篇](/notes/pcid)。

## FSGSBASE：四条指令等了八年

::scene fsgsbase

通过 `arch_prctl()` 修改 FS 基址要一次系统调用，读取它也要一次。对大多数程序来说这无所谓，因为每个线程只设一次 FS。但对少数程序影响很大：在任务之间每切换一次就要换一次 TLS 的[[user-threads|用户态线程]]运行时，以及 [[sgx|Intel SGX 飞地]]（enclave）的运行时——它们在进出飞地时都要改动这些基址。[系统调用开销那篇](/notes/syscall-cost)解释了为什么每次操作一个系统调用会积少成多。

2012 年，Intel 在 [[ivy-bridge|Ivy Bridge]] 处理器上加入了解决这个问题的四条指令：`RDFSBASE`、`WRFSBASE`、`RDGSBASE` 和 `WRGSBASE`，可以在用户态直接读写这两个基址。只有内核在控制寄存器 CR4 里置上一位，CPU 才允许使用它们——而 Linux 八年都没有置这一位。

::scene danger

原因就是上面折叠部分里那个符号检查。一旦用户空间可以执行 `WRGSBASE`，它就能装入任何 GS 基址，包括负数。[[nmi|NMI]] 入口代码会因此认定自己来自内核、跳过 SWAPGS，让内核带着攻击者控制的 GS 基址运行。要安全地启用这些指令，必须先重写入口代码里最脆弱的那部分。

::scene fix59

这花了好几轮尝试。2019 年，一个版本的补丁被合入 x86 分支，又因为暴露出新问题而被回退。与此同时，一些在 SGX 飞地里运行代码的研究项目发布了内核模块，直接把 CR4 那一位置上。据 LWN 2020 年 6 月的报道，这让内核关于 GS 的假设失效，使系统暴露在容易被利用的攻击之下。补丁系列一直出到第 13 版，支持终于在 2020 年 10 月发布的 **Linux 5.9** 中落地。偏执入口路径不再靠猜：启用 FSGSBASE 时，它读出当前的 GS 基址并保存起来，无条件装入内核自己的值，退出时再恢复保存的值。

:::fold 读取 FS 基址：5.9 之前与之后
::scene fsgsbase

用户空间可以通过[[auxv|辅助向量]]里的 `HWCAP2_FSGSBASE` 位，判断内核是否启用了这些指令。内核文档建议检查这一位而不是 [[cpuid|CPUID]]，因为即使 CPU 支持这些指令，只要内核没有启用，执行时照样会触发 [[invalid-opcode|#UD]]。

```c
#include <stdio.h>
#include <sys/auxv.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <asm/prctl.h>       /* ARCH_GET_FS */
#include <immintrin.h>       /* _readfsbase_u64；编译时加 -mfsgsbase */

#ifndef HWCAP2_FSGSBASE
#define HWCAP2_FSGSBASE (1 << 1)
#endif

int main(void)
{
    unsigned long base;
    syscall(SYS_arch_prctl, ARCH_GET_FS, &base);    /* 任何 x86-64 内核：一次系统调用 */
    printf("FS base via arch_prctl: %#lx\n", base);

    if (getauxval(AT_HWCAP2) & HWCAP2_FSGSBASE)     /* Linux 5.9+，且 CPU 支持 */
        printf("FS base via RDFSBASE:   %#llx\n", _readfsbase_u64());   /* 一条指令 */
    return 0;
}
```

两行打印的是同一个地址，即线程的控制块。第一行要经过内核，第二行不用。编译器还提供了更直接的写法：[[gcc|GCC]] 6 及以后的版本把 `__seg_fs` 和 `__seg_gs` 当作地址空间限定符，于是 `*(int __seg_gs *)8` 就是从 GS 基址 + 8 处读取。[[clang|Clang]] 则用 `__attribute__((address_space(256)))` 表示 GS，`address_space(257)` 表示 FS。
:::

## FRED：硬件接手了交换

::scene fred

SWAPGS 的故事正以许多类似故事的方式收尾：硬件把活接了过去。Intel 的 **FRED**（Flexible Return and Event Delivery，灵活返回与事件投递）用新的特权级转换，取代了 20 世纪 80 年代沿用至今的中断投递机制。启用 FRED 后，来自 [[ring|ring 3]] 的事件在投递过程中就会把 GS 基址与 `IA32_KERNEL_GS_BASE` 互换，返回用户态时再换回来。SWAPGS 于是不仅多余，而且被禁止：执行它会触发 [[invalid-opcode|#UD]]。配套的 `LKGS` 指令让内核可以装入用户的 GS 选择子，而不扰动自己的 GS 基址。Linux 在 2024 年的 6.9 版合入了 FRED 支持。

不再有可以预测错的分支，也不再有可以糊弄的符号检查，因为硬件永远知道自己是从哪个特权级来的。对一个脆弱约定最干净的修复，就是别再用软件去维持它。

## 回到书里的那条线

::scene overview

第 16 章讲的分段是三个想法的组合：每个地址加一个基址，每次访问查一次界限，再加上一套选择用哪一对的规则。作为内存管理方案，这个组合输给了分页：变长的段会让物理内存产生碎片，那是第 17 章的问题，而分页解决了它。

x86-64 只保留了三者之一。FS 和 GS 是**有基址、无界限**的段，由 1978 年那套“隐式加超越前缀”的规则来选择。它们活下来，是因为地址通路上一次免费的加法，是让同一段代码在每个上下文里看到不同视图的最便宜办法：用户空间里按线程，内核里按 CPU。围绕它们出的所有问题——符号检查、Spectre 片段、FSGSBASE 的漫长等待——都源于一个寄存器有两个主人，而软件必须在恰好正确的时刻切换它。

界限那一半也没有消亡，只是搬了家：搬进了保护页、WebAssembly 运行时和能力硬件，详见[界限那篇](/notes/bounds-revival)。就连把界限放进每个指针的 [[cheri|CHERI]] 也指出，它的架构可能需要扩展，来支持基于能力访问线程局部存储。每上下文的基址指针，是新设计一再撞上的需求。

## 延伸阅读

- [Using FS and GS segments in user space applications](https://docs.kernel.org/arch/x86/x86_64/fsgs.html)，Linux 内核文档：64 位下段的语义、`arch_prctl()`、FSGSBASE、编译器支持以及 SWAPGS 的细节。
- [this_cpu operations](https://docs.kernel.org/core-api/this_cpu_ops.html)，Linux 内核文档：通过段前缀访问每 CPU 数据。
- [Kernel entries](https://docs.kernel.org/arch/x86/entry_64.html)，Linux 内核文档：入口代码在哪里决定是否 SWAPGS。
- [Spectre side channels](https://docs.kernel.org/admin-guide/hw-vuln/spectre.html)，Linux 内核文档：SWAPGS 变种及其 LFENCE 缓解措施。
- Jonathan Corbet：[*A possible end to the FSGSBASE saga*](https://lwn.net/Articles/821723/)，LWN，2020 年 6 月。
- [5.9 Merge window, part 1](https://lwn.net/Articles/828120/)，LWN，2020 年 8 月：FSGSBASE 合入。
- [Flexible Return and Event Delivery (FRED)](https://docs.kernel.org/arch/x86/x86_64/fred.html)，Linux 内核文档。
- Fangrui Song：[*All about thread-local storage*](https://maskray.me/blog/2021-02-14-all-about-thread-local-storage)：各种 TLS 模型及编译器为它们生成的代码。
