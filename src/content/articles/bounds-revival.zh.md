---
deck: 第 15 章里最简单的机制丢掉了管理内存的差事，却保住了另一份工作：画一条一次比较就能守住的边界。如今它出现在浏览器里、内核里，也出现在新的硬件里。
title: 基址加界限从未真正消失
---

::scene overview

[[webassembly|WebAssembly]] 规范用几个编号步骤描述一条读指令做了什么。其中一步的意思是：*如果 i + offset + N/8 大于内存的长度，就陷入（trap）。* 这里 *i* 是程序算出来的地址，*offset* 是指令里的常量，*N* 是访问宽度（以位计）。这就是第 15 章的界限寄存器检查，被写进了一项 Web 标准。2025 年 9 月定稿的 WebAssembly 3.0 里，它依然在。

第 15 章把基址/界限介绍成地址转换最早、最粗糙的形态，随后就转向别处，理由是它浪费内存，而且只给进程一块连续的区域。两条批评都成立。但它们批评的是用基址/界限来构建*虚拟内存*。如果只是用它来画一条*边界*——一块区域、一次比较——它从来没有失去用处。这篇文章顺着它走一遍：软件[[sandbox|沙箱]]、WebAssembly、Linux 内核的 [[bpf|eBPF]] 校验器、一个失败的 Intel 扩展，以及 [[cheri|CHERI]] 研究架构。

## 书里的版本对在哪里

::chapter vm-mechanism

::scene mmu

书中的硬件给每个 CPU 配两个寄存器。每次访存时，它把虚拟地址和**界限**比较，再加上**基址**：

> if (va ≥ bounds) raise exception; else pa = base + va

一次比较，一次加法，与其他工作并行完成。操作系统改一下基址就能搬动进程，而进程毫无察觉。这个想法便宜、容易验证，没有要遍历的表，也没有按页维护的状态。

::scene inside

它的弱点全都来自让它干得太多：用一块区域描述整个地址空间。反过来，如果只让它在一个已经由分页管理的地址空间*内部*圈出一块区域，这些弱点就消失了。区域想多大都行，因为哪些部分真正有内存在背后撑着，由分页来决定。

::scene mmu

::lab BaseBounds

可以试试这些：

- 选“越界”。地址是 17 KB，界限是 16 KB，MMU 还没加基址就抛出了异常。本文里的每一个系统，实现的都是这一个红框。
- 地址不动，拖动基址。物理地址变了，虚拟地址没变。WebAssembly 运行时把一个模块的内存放在宿主地址空间的任意位置时，做的也是这件事。
- 把界限缩到 4 KB，再试“栈顶”。同一个程序现在越界了。在 WebAssembly 里，界限就是内存的当前大小，增长内存只是把它调高。

这个实验就是书里那个简化的 MMU：一块区域，界限按大小存储，先比较再相加。

## 软件自己造一个界限寄存器

::scene sfi

第 15 章的参考文献里有一篇 1993 年的论文：Wahbe、Lucco、Anderson 和 Graham 的 *Efficient Software-based Fault Isolation*（高效的基于软件的故障隔离）。它的想法是不靠硬件也拿到基址/界限式的保护：让编译器改写每一条存储和跳转指令，在使用地址之前把它强行压进沙箱的区域，比如把高位屏蔽掉。这样，不受信任的代码就能和宿主跑在同一个地址空间里，跨越边界时不需要系统调用，也不需要上下文切换。

::scene nacl32

Google 的 [[nacl|Native Client]]（NaCl）在 2008 年底把这个想法带进了浏览器。在 32 位 x86 上，它根本不需要屏蔽地址，因为 x86 那时还有带界限的真正的[[segmentation|段]]，NaCl 只要设置好只覆盖沙箱的段就行了。这正是书里说的那种用硬件实现的基址/界限。

::scene nacl64

到了 [[x86-64|x86-64]]，NaCl 失去了这件工具：x86 在 64 位模式下忽略段界限，详见[FS 与 GS 那篇](/notes/fs-gs)。2010 年的 NaCl 论文描述了替代方案：模块的内存是一块按 4 GB 对齐的区域，一个保留寄存器（`r15`）存放它的基址，每个地址都由这个基址加上一个 32 位偏移构成，区域上下两侧各留 40 GB 未映射的地址空间，接住任何溜出去的访问。在 x86-64 上平均开销为 7%。界限检查从段寄存器搬进了[[page-table|页表]]。

## WebAssembly：界限就是线性内存的大小

::scene wasm

接替 NaCl 在浏览器中角色的 WebAssembly，把同样的结构做进了语言本身。一个模块拥有一块**线性内存**（linear memory）：一个连续、可增长的字节数组。模块里的地址就是这个数组的下标。引擎决定数组放在宿主地址空间的哪里（基址），并记录它的当前大小（界限）。每次访问都要和大小比较，越界访问会[[wasm-trap|陷入]]，而不会碰到宿主。

引擎可以用两种方式实现这项检查：

```text
; pseudo-code: one 4-byte load of memory[i + 16]

; (a) explicit check, like the book's MMU
    lea   t, [i + 16 + 4]
    cmp   t, mem_size
    ja    trap
    mov   eax, [mem_base + i + 16]

; (b) guard region: no compare, no branch
    mov   eax, [mem_base + i + 16]   ; i is a zero-extended 32-bit value
                                     ; an out-of-range access hits unmapped
                                     ; pages and the fault becomes a trap
```

::scene guard

对普通的 32 位内存，64 位引擎更喜欢方案 (b)。以 [[wasmtime|Wasmtime]] 为例，它默认为每块这样的内存预留 4 GiB 虚拟地址空间，后面再加 32 MiB 的保护区（guard region）。只有前 *size* 个字节被映射为可访问，预留区里其余部分都不可访问，所以越界访问会引发[[page-fault|页错误]]。引擎的[[signal|信号]]处理程序发现这个错误来自 WebAssembly 代码，就把它转换成一次 WebAssembly 陷入。界限寄存器就是页表，界限检查就是硬件普通的页错误路径。增长内存只是修改预留区内部的页保护，什么都不用搬。

:::fold 为什么 4 GiB 加一个保护区就够了
使用 32 位下标时，一次读的有效地址是：

> ea = base + i + offset，其中 0 ≤ i < 2^32^，offset 是指令里的常量

所以 *ea* − *base* 至多是 2^32^ − 1 + offset，再加上访问宽度。从 *base* 开始预留 4 GiB，后面接一块 *G* 字节的保护区，那么每一次静态偏移大致小于 *G* 的访问，都会落在预留区或保护区里的某处。只有低于内存当前大小的那些字节可以访问，其余地址一律出错。

Wasmtime 在 64 位宿主上的默认值是 4 GiB 预留和 32 MiB 保护区。它的文档说，这能消除静态偏移小于 32 MiB 的读写上几乎所有的界限检查。偏移更大时，编译器就生成一次显式检查。

代价是虚拟地址空间，以及对信号机制的依赖：

- 每块内存都要占用几 GB 地址空间，哪怕只用了一页。64 位宿主有 128 TiB 甚至更多的用户地址空间，所以负担得起，但也不是无限的。[[nodejs|Node.js]] 把 [[v8|V8]] 的做法描述为一个约 10 GB 的“虚拟内存笼子”（virtual memory cage），并为虚拟内存受限的环境提供了 `--disable-wasm-trap-handler` 选项，改回显式检查。
- 在 32 位宿主上根本没有空间玩这个把戏。Wasmtime 在那里的默认预留只有 10 MiB，每次访问都要显式检查。
:::

::scene memory64

**Memory64** 显示了保护区技巧的极限。WebAssembly 3.0 允许内存使用 64 位地址而不只是 32 位。没有哪块预留区能覆盖 2^64^ 的范围，所以 Wasmtime 的文档明确说，64 位线性内存总是需要界限检查。在 Web 上，64 位内存的上限是 16 GB。检查回到了书里的形式：每次访问一次比较、一个分支，编译器有时能把它提到循环外面。

## eBPF：在程序运行之前证明界限

::scene ebpf

Linux 内核会在自己的地址空间里运行用户提交的小程序，也就是 eBPF。这里根本没有沙箱区域。取而代之的是：程序加载之前，**校验器**（verifier）要证明每一次内存访问都待在指针所指的对象之内。

为此，它为每个寄存器追踪它是哪一类指针、可能取哪些值：无符号和有符号的最小值与最大值，外加一个 *tnum*——一个标明哪些位已知的掩码。一个网络数据包就是一个基址（`data`）加一个末端（`data_end`），程序只有在把地址和末端比较过之后，才能读包里的字节。下面这个例子来自内核的校验器文档：

```text
4:  r5 = r3          ; r3 points to the start of the packet
5:  r5 += 14
6:  if r5 > r4 goto pc+16    ; r4 = data_end
; fall-through: the verifier now knows bytes [r3, r3 + 14) are safe
```

在顺序执行（fall-through）的那条路径上，校验器记下 `r3` 之后的 14 个字节可以安全读取，于是偏移 12 处的 2 字节读被接受，偏移 14 处的读被拒绝。这还是基址/界限，只不过检查在加载时符号化地做一次，程序则把这次比较当作普通分支带在身上。

[[speculative-execution|推测执行]]带来了新的麻烦。CPU 可能越过一个被预测错的界限分支继续往下跑，所以对非特权程序，校验器还会改写指针运算、给偏移加掩码，让访问即使在推测执行中也离不开它的对象。光靠程序里的那次比较已经不够了。

## 每个指针都带界限：MPX

::scene mpx

上面这些都是给一整块*区域*一条边界。而 C 的漏洞，正如[内存安全那篇](/notes/memory-safety)所说，是在同一块区域里从一个*对象*溢出到它的邻居。要抓住这些，每个指针都需要自己的基址和界限。

Intel 曾用 **内存保护扩展**（Memory Protection Extensions，MPX）在硬件里做这件事，它随 2015 年的 Skylake 处理器发布。MPX 加了四个 128 位界限寄存器 `bnd0`–`bnd3`，每个存一个下界和一个上界；还加了一批指令：创建界限（`bndmk`）、拿指针和界限比较（`bndcl`、`bndcu`）、保存和读取界限（`bndstx`、`bndldx`）。寄存器只放得下四组界限，所以存在内存里的指针，其界限要放进**界限表**（bounds table），并通过一个**界限目录**（bounds directory）找到——评估者把这个两级结构比作页表。

不到五年 MPX 就死了。[[gcc|GCC]] 在 2019 年的 GCC 9 中移除了对它的支持。Linux 在 5.4 到 5.6 两个版本间移除了内核一侧的代码，提交说明给出的理由是“今后缺乏工具链支持”。

:::fold MPX 为什么失败
Oleksenko、Kuvaiskii、Bhatotia、Felber 和 Fetzer 在 2017–2018 年做的评估（“Intel MPX Explained”）测得平均性能开销约 50%。它的设计里有些问题，是更快的实现也解决不了的：

- **界限与指针分开存放。** 指针和它在界限表里的条目由不同的指令写入，另一个线程可能看到其中一个更新了、另一个还没有。评估在多线程代码里发现了误报和漏报。
- **内存。** 当一次界限存储碰到空的目录项时，内核才按需分配界限表。Linux 的 MPX 文档警告说，最坏情况下这些表可能是它们所描述数据的四倍大。
- **未检查的代码会抹掉保护。** 一个指针只要经过没用 MPX 编译的代码，回来时就没了界限。如果内存分配器没有[[instrumentation|插桩]]，每个堆指针都没有界限，保护就形同虚设。
- **没有时间安全。** MPX 检查指针指向哪里，不检查对象是否还活着。[[use-after-free|释放后使用]]不在它的管辖范围内。
- **内存布局限制。** MPX 默认限制程序可以使用的内存布局，被测程序中有 8–13% 不做大量代码修改就无法正确运行。配套编译器和库的缺陷，又让另外 3–10% 根本无法编译或运行。

后来的设计从中吸取的教训是：界限必须*跟着*指针走，且原子地一起更新；硬件还必须能分清一个真正的指针和一个长得像指针的整数。
:::

## 每个指针都带界限，这回做对了：CHERI

::scene cheri

**CHERI**（Capability Hardware Enhanced RISC Instructions，能力硬件增强 RISC 指令）是 SRI International 与剑桥大学的联合研究项目，自 2010 年起获得 DARPA 资助，正是吸取了这条教训的设计。CHERI 的指针是一个**能力**（capability）：宽度是普通指针的两倍，在 64 位机器上就是 128 位。它包含一个 64 位地址，外加压缩过的元数据：**界限**、**权限**（读、写、执行等）和一个对象类型。内存中每个能力大小的字还配有一个 **1 位有效性标签**（validity tag），存放在带外，软件无法直接写它。

硬件强制执行几条规则：

- 每一次通过能力进行的读写，都要对照它的界限和权限检查。这就是书里的界限检查，只是每个指针各有一份。
- **单调性**（monotonicity）：可以从已有的能力派生新能力，但界限和权限只能相等或更小。`malloc` 拿着覆盖整个堆的能力，把它收窄到恰好这次分配的范围，再返回出去。调用者没法再把它放宽。
- **来源有效性**（provenance）：只有通过能力指令、从一个有效能力派生出来的值，标签才会被置位。用普通数据覆盖它的任何一个字节都会清掉标签，没有标签的能力不能使用。指针再也无法从整数伪造出来。

这些规则解决了让 MPX 沉没的那些问题：界限和地址是同一个 128 位的值，由同一条指令写入；没插桩的路径也没法悄悄丢掉界限，因为没有有效标签的值根本不能解引用。

CHERI 还保留了书里的一个界限寄存器。对于没有按能力编译的代码，一个特殊的**默认数据能力**（default data capability，DDC）约束着每一次以普通整数寻址的读写。这就是为整个遗留隔间准备的基址/界限寄存器——第 15 章的机制，再加上权限。

Arm 把这套架构做进了芯片。在英国“设计即安全”（Digital Security by Design）计划下，**Morello** 开发板于 2022 年 1 月发布，使用一颗经过改造的四核 Neoverse N1，主频 2.5 GHz。它运行 CheriBSD，一个基于 FreeBSD 的系统，普通的 C 和 C++ 程序重新编译之后，每个指针都是一个能力。Morello 是研究原型，不是产品，但它证明了能力可以加进主流的 64 位核心，并撑起完整的操作系统和上面的应用。

:::fold 一个能力长什么样
下面是 CHERI 入门报告里的 128 位格式，做了简化（各字段宽度因架构而异）：

| 组成部分 | 内容 | 存放位置 |
|---|---|---|
| 地址 | 64 位虚拟地址：普通指针里装的就是它 | 128 位字内 |
| 界限 | 起点和终点，相对地址压缩编码 | 128 位字内 |
| 权限 | 读、写、执行、读写能力等 | 128 位字内 |
| 对象类型 | 若已设置，能力即被*封印*（sealed）：不能修改或解引用，只能传递 | 128 位字内 |
| 有效性标签 | 1 位：这是不是一个真正的能力？ | 带外，每个 128 位颗粒一个 |

压缩界限是 128 位够用的关键。和浮点数类似，这种编码对小对象是精确的，对大对象则要求适当对齐，所以分配器会把大块分配稍微向上取整。这是书里归咎于基址/界限的内部碎片的一个温和版本。

CHERI 本身提供的是空间安全。时间安全——防止释放后使用——还需要额外的软件。CheriBSD 有一套机制，在被释放的内存重新使用之前，找出并撤销指向它的能力；CHERI 入门报告把“用户空间的非栈时间内存安全”列为 CheriBSD 的特性之一。
:::

## 每个版本把线画在哪里

::scene table

| 系统 | 界限覆盖什么 | 界限存在哪里 | 谁来检查 | 何时检查 |
|---|---|---|---|---|
| 书中的 MMU | 整个进程 | 界限寄存器 | 硬件 | 每次访问 |
| NaCl x86-32 | 一个沙箱 | 段界限 | 硬件 | 每次访问 |
| NaCl x86-64、带保护区的 Wasm32 | 一个沙箱 | 页表中未映射的页 | 硬件，经由页错误 | 每次访问 |
| Wasm memory64 | 一个沙箱 | 运行时记录的大小 | 编译出的比较和分支 | 每次访问 |
| eBPF | 指针所指的每个对象 | 校验器的寄存器状态 | 内核校验器 | 加载前一次 |
| Intel MPX | 每个指针 | 界限寄存器和界限表 | 编译出的检查指令 | [[instrumentation|插桩时]] |
| CHERI | 每个指针 | 128 位能力内部 | 硬件 | 每次访问 |

从上往下读，权衡就很清楚了：边界越粗，检查越便宜，一直便宜到零条指令的保护区；边界越细，能抓的漏洞越多，代价也越高，直到 CHERI 把界限搬进指针，用更宽的指针和新的硬件来买单。

## 回到书里的那条线

::scene inside

第 15 章先介绍基址/界限，再列出它的问题：每个进程只有一块连续区域，区域内部还有浪费。第 16 章给每个段各自的基址和界限，解决了第一个问题；第 18 章用页把两者都替换掉。对*虚拟内存*来说，这段历史讲得没错。

但保护边界是另一份工作。书中关于软件重定位的补充说明引用了 1993 年那篇软件故障隔离论文，本文里的这些系统就是它的后代：一条一次比较就能守住的边界，嵌在分页之内，而不是取代分页。这样看，CHERI 就是第 16 章的细粒度分段，每个 C 对象一个段——在 [[multics|Multics]] 和 Burroughs 机器初次尝试类似做法的半个世纪之后，重新登场。

基址/界限丢了一份工作，保住了另一份。变长的区域难以*分配*，[定长与变长那篇](/notes/fixed-vs-variable)讲的就是这个；但它们很容易*检查*。

## 延伸阅读

- [WebAssembly 核心规范](https://webassembly.github.io/spec/core/exec/instructions.html)，内存指令的执行语义：开头引用的界限规则出自这里。
- [Wasm 3.0 completed](https://webassembly.org/news/2025-09-17-wasm-3.0/)（Andreas Rossberg，2025 年 9 月）：memory64 与 Web 上 16 GB 的上限。
- [Wasmtime `Config` 文档](https://docs.wasmtime.dev/api/wasmtime/struct.Config.html)：`memory_reservation`、`memory_guard_size`，以及何时可以省掉界限检查。
- David Sehr 等：[*Adapting Software Fault Isolation to Contemporary CPU Architectures*](https://www.scs.stanford.edu/~zyedidia/docs/papers/nacl2.pdf)，USENIX Security 2010：x86-64 和 ARM 上的 NaCl。
- Robert Wahbe、Steven Lucco、Thomas E. Anderson、Susan L. Graham：*Efficient Software-based Fault Isolation*，SOSP 1993。即本书的 [WL+93]。
- [eBPF verifier](https://docs.kernel.org/bpf/verifier.html)，Linux 内核文档：寄存器界限追踪和数据包访问示例。
- Oleksii Oleksenko 等：[*Intel MPX Explained*](https://intel-mpx.github.io/)，SIGMETRICS 2018（另见 [arXiv:1702.00719](https://arxiv.org/abs/1702.00719)）。
- [Intel MPX](https://docs.kernel.org/5.5/x86/intel_mpx.html)，Linux 5.5 内核文档：移除前不久，内核如何管理界限表。
- Robert N. M. Watson、Simon W. Moore、Peter Sewell、Peter G. Neumann：[*An Introduction to CHERI*](https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-941.html)，剑桥大学技术报告 UCAM-CL-TR-941，2019。
- [CHERI 项目主页](https://www.cl.cam.ac.uk/research/security/ctsrd/cheri/)（剑桥）与 [Morello 计划](https://www.morello-project.org/)。
