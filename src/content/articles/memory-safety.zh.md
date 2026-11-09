---
deck: 两个截然不同的代码库各自清点了最严重的漏洞，得出了同一个结论：大部分正是第 14 章列出的那些错误。
title: 七成：第 14 章的错误，放大到工业规模
---

::scene overview

2019 年 2 月，微软安全响应中心（MSRC）的 Matt Miller 在 BlueHat IL 大会上放出了一张此后被反复引用的图。图里统计的是 2006 到 2018 年间，微软每年通过安全更新修复的所有[[rce|远程代码执行]]、[[privilege-escalation|权限提升]]和信息泄露漏洞。每根柱子都分成两段：[[memory-safety|内存安全漏洞]]，和其他一切。每一年，内存安全那一段都占七成左右。

Chromium 项目也公布过自己的统计。代码由另一家公司、另一批人写成，结论却几乎一样：大约 70% 的严重安全漏洞是内存安全问题，其中一半是[[use-after-free|释放后使用]]（use-after-free）。

第 14 章在列举常见错误之前说过一句话：C 程序能编译通过是“必要的”，但“远远不够”。这篇文章讲的就是这道缺口放大到工业规模时的代价，以及业界如今应对它的三种办法。

## 到底统计了什么

“70%”这个数字常被随口引用，所以有必要先弄清每个来源到底量的是什么。

| 来源 | 统计对象 | 时间范围 | 内存安全占比 |
|---|---|---|---|
| 微软（BlueHat IL 2019） | 通过安全更新修复的[[rce|远程代码执行]]、[[privilege-escalation|权限提升]]、信息泄露类 [[cve|CVE]] | 2006–2018，按补丁年份 | 每年约 70% |
| Chromium | 影响稳定版的 912 个高危或严重安全漏洞 | 2015 年以来 | 约 70%，其中一半是释放后使用 |
| Android（Google） | Android 报告的漏洞 | 2019 年 | 76% |

从这张表可以读出几点保留意见：

- 这些是**占比，不是数量**。它们描述的是被发现并修复的漏洞，而不是攻击者实际用过的漏洞。Miller 的报告单独分析过[[exploit|被利用]]的漏洞，发现攻击者偏爱的是释放后使用和堆破坏。
- 这些分类里的“内存安全”比第 14 章的清单更宽。微软的根因分类是栈破坏、堆破坏、释放后使用、类型混淆、使用未初始化内存，以及堆越界读。类型混淆（type confusion）——把一个对象当成另一种类型来用——书里没有讲，但结局一样：代码把一块内存当成了它本来不是的东西来读。
- 总比例几乎不动，内部构成却一直在变。在微软的数据里，栈破坏到 2018 年已经“基本绝迹”；释放后使用在 2013–2015 年间因浏览器漏洞激增，随后在浏览器改进内存管理、加上缓解措施之后回落；堆越界访问始终是最大的一类。

这个数字有说服力，不在于它有多精确，而在于两个庞大的 C++ 代码库，工程文化不同、工具不同，各自独立地得出了差不多的答案。

## 书里的清单，换成安全行业的分类

::chapter vm-api

::scene families

14.4 节列出了这些错误。按安全行业的习惯归类，它们分成几族：

- **空间错误**：访问了对象边界之外的内存。书里的“没有分配足够的内存”就是缓冲区溢出：`malloc(strlen(src))` 之后 `strcpy`，多写一个字节。越界*读*也属于这一类，它泄露数据而不是破坏数据。
- **时间错误**：在对象生命周期之外访问它。“在用完之前释放内存”留下悬挂指针，再用它就是释放后使用；“反复释放内存”是重复释放（double free）；“错误地调用 free()”是无效释放（invalid free）。
- **未初始化读取**：“忘记初始化分配的内存”。读到的是这块内存上一任主人留下的东西，可能是一段密码，也可能是一个指针。
- **野指针**：“忘记分配内存”，就像书中那个 `dst` 从未赋值就拿去 `strcpy(dst, src)` 的例子。

书中清单里有一项不在安全统计之内：**内存泄露**。泄露是可靠性问题——长期运行的服务器会慢慢耗尽内存——但它很少给攻击者带来什么。那 70% 说的是其余几类。

::scene padding

书里警告说，有缺陷的程序“常常看起来运行正常”，这正是问题的核心。测试时，那个差一字节的写入落在分配器的填充区里，什么事也没有。而一个能控制输入和堆布局的攻击者，可以安排同一次写入落在要紧的东西上。

:::fold 释放后使用如何变成对程序的控制权
::scene reuse

许多真实攻击背后的套路其实很短。下面用 C 写出来，用一个函数指针代替 C++ 对象携带的[[vtable|虚表指针]]：

```c
struct session { void (*on_close)(struct session *); char name[24]; };

struct session *s = malloc(sizeof *s);
s->on_close = normal_close;
/* ... */
free(s);                       /* bug: s is still reachable elsewhere */

char *msg = malloc(32);        /* same size class as struct session */
read(fd, msg, 32);             /* contents chosen by the attacker */

s->on_close(s);                /* calls whatever address the attacker wrote */
```

为什么 `msg` 恰好落在 `s` 原来的位置？因为分配器本来就被设计成尽快重用内存。[[glibc|glibc]] 的每[[thread|线程]]缓存（[[tcache|tcache]]）为每个大小类维护一个后进先出的空闲链表，所以下一次同样大小的 `malloc` 通常就会拿回刚释放的那块。这对[[cpu-cache|缓存]]局部性有利，也正是攻击者需要的。这些空闲列表如何工作，见[分配器那篇](/notes/allocators)。

要把它变成能用的攻击，还差两步，两步都连着别的章节。攻击者得知道该写*哪个*地址，而 [ASLR](/notes/aslr) 的作用就是把它藏起来，所以真实的攻击通常要把释放后使用和一个能泄露指针的越界读组合起来。然后目标地址还得能被调用，[[cfg|控制流防护]]（Control Flow Guard）一类的缓解措施就是在限制这一点。每一道防线都多加一步，但没有一道能消除漏洞本身。
:::

## 对策一：在发布之前找到它们

::scene memcheck

书里推荐 Purify 和 Valgrind。两者都作用于已经构建好的程序：Purify（1992 年）改写目标代码，Valgrind 的 Memcheck 则让程序跑在一颗合成的 CPU 上，追踪每一个字节。所以它们上手容易，但慢。Valgrind 手册提醒，程序会慢“20 到 30 倍”。

::scene asan

**AddressSanitizer**（ASan）由 Google 的 Konstantin Serebryany 等人在 2012 年发表，它把同样的检查做得足够便宜，可以在日常测试里一直开着。它把工作挪进了编译器：每一次读写都多出几条指令，去查一块**影子内存**（shadow memory）——应用内存每 8 个字节对应 1 个影子字节，记录这 8 个字节里有几个可以访问。分配器在每个内存块周围放上带毒的**红区**（redzone）；`free` 则把整块内存标记为有毒，并先放进**隔离区**（quarantine）一段时间，而不是立刻重用。溢出会撞上红区，释放后使用会碰到隔离区里的内存，无论哪种，下一次插桩过的访问都过不了检查。

论文报告的平均减速为 73%，并在 Chromium 里找到了 300 多个此前未知的漏洞。如今 [[clang|Clang]] 的文档把典型减速描述为 2 倍。用 `-fsanitize=address` 编译，书里那个空间不够的 `strcpy` 会在出错的调用处停下，报告一个 `heap-buffer-overflow`，同时给出越界写入的调用栈，以及那块 5 字节内存被分配时的调用栈。

```sh
clang -fsanitize=address -g -O1 bug.c -o bug && ./bug
```

::scene msan

ASan 抓不到未初始化读取，那是 **MemorySanitizer**（MSan）的工作。MSan 为内存的每一*位*维护一个影子位，让“未初始化”这一属性随着复制和运算传播，只有当垃圾值影响到分支、地址或系统调用时才报告。它 2015 年的论文给出的代价约为 2.5 倍时间、2 倍内存。麻烦在于，MSan 要求进程里所有代码——包括各种库——都经过插桩，否则就会误报。

:::fold ASan 的检查编译出来是什么样
::scene asan

在 [[x86-64|x86-64]] Linux 上，地址 *a* 对应的影子字节位于：

> shadow(a) = (a >> 3) + 0x7fff8000

影子值为 0，表示这 8 个字节都可访问；为负，表示一个都不能访问——那是红区或已释放的内存；介于 1 到 7 之间的 *k*，表示只有前 *k* 个字节可访问，这出现在一次分配的尾部。`malloc(13)` 会得到一个完全可访问的 8 字节组（影子为 0），后面跟一个影子为 5 的组。

在每次访问 `size` 个字节之前，编译器插入的代码相当于下面这段（据 ASan 算法说明简化）：

```c
/* 伪代码：插在对 addr 处 `size` 字节（1、2 或 4）的访问之前 */
int8_t k = *(int8_t *)((addr >> 3) + 0x7fff8000);
if (k != 0) {
    if ((int8_t)((addr & 7) + size - 1) >= k)   /* k 为负时也成立 */
        report_error(addr, size);
}
```

再看那个 13 字节的块。在偏移 12 处读 1 个字节：`addr & 7` 是 4，4 + 1 − 1 = 4 < 5，通过；在偏移 13 处读，得到 5 ≥ 5，报告错误。绝大多数访问碰到的内存影子值都是 0，代价只是一次读、一次比较和一个几乎总能[[branch-predictor|预测正确]]的分支。正因如此，ASan 比 Memcheck 快了大约一个数量级——后者必须在运行时翻译每一条指令，才能做同样的记账。

代价是内存。在 64 位系统上，ASan 一开始就为影子映射 16 TB 甚至更多的虚拟地址空间，红区和隔离区也会让堆膨胀。所以 ASan 是测试和[[fuzzing|模糊测试]]的工具，不是随产品发布的东西。
:::

消毒器（sanitizer）有一个结构性的局限：它们只能发现实际跑到的路径上的错误。这就是为什么它们几乎总是和模糊测试（fuzzing）搭配使用——由模糊测试器生成输入，把程序赶到新的路径上去。

## 对策二：让它们更难被利用

::scene harden

总有一些漏洞会漏到线上。第二种对策承认这一点，转而让漏洞更难被利用，主要手段是加固分配器——正是分配器决定了什么东西挨着什么东西。

- **廉价的完整性检查。** 从 [[glibc|glibc]] 2.29 起，[[tcache|tcache]] 会给每个释放的块打上一个标记，所以对同一块释放两次，通常会以 `free(): double free detected in tcache 2` 中止，而不是悄悄弄坏空闲链表。
- **加固的分配器。** 自 Android 11 起，Android 的所有[[native-code|原生代码]]都使用 **Scudo**（低内存设备仍用 [[jemalloc|jemalloc]]）。Scudo 在每个块头里放一个校验和，追踪每个块的状态以便抓住重复释放，还可以在重用之前先把释放的块放进隔离区。
- **在要紧处推迟重用。** Chrome 的 **MiraclePtr**（BackupRefPtr）把 C++ 类里的裸指针字段换成 `raw_ptr<T>`，后者在分配块里维护一个隐藏的[[reference-count|引用计数]]。如果内存被释放时仍有这样的指针指向它，分配器就给它下毒并留在隔离区，直到计数归零。释放后使用依然会发生，但读到的是毒值，而不是攻击者的数据。它从 Chrome 102 起在 Windows 和 Android 的浏览器进程中启用。Google 估计它能保护该进程中大约一半的释放后使用漏洞，代价是那里多用 3.5–6.5% 的内存。
- **硬件标签。** Arm 的内存标记扩展（MTE）给内存的每个 16 字节颗粒一个小标签，并在指针高位放一个对应的标签，CPU 在每次读写时比较两者。块被释放时重新打标签，旧指针就对不上了。Android 12 加入了内核和分配器层面的支持。

这些措施都是概率性的或局部的：MiraclePtr 只覆盖类字段，而不是所有指针；标签可能碰巧相同；隔离区终究要把内存再交出去。它们抬高了利用的成本，但没有改变语言本身。

## 对策三：干脆不写出它们

::scene rust

第 14 章提到了最古老的答案：自动内存管理。有了[[garbage-collection|垃圾收集器]]，你永远不调用 `free`，时间错误大体就消失了，代价是由运行时来决定何时回收内存。**Rust** 不用垃圾收集器也拿到了大部分同样的保证，办法是让编译器追踪每个值归谁所有、指向它的每个引用能活多久。

```rust
fn main() {
    let s = String::from("hello");
    let r = &s;
    drop(s);              // error[E0505]: cannot move out of `s` because it is borrowed
    println!("{}", r);
}
```

书里的悬挂指针在这里成了编译错误。重复释放根本写不出来，因为一个堆上的值只有唯一的所有者。在变量初始化之前读取它，也会被拒绝。空间错误则靠运行时检查处理：越界索引一个 `Vec` 不会碰到相邻的内存，而是以 `index out of bounds: the len is 3 but the index is 10` 让[[thread|线程]]停下。这是对每次访问的界限检查，是第 15 章硬件检查的软件版本；见[基址加界限从未真正消失](/notes/bounds-revival)。

### Android 发生了什么

::scene android

一个组织换语言之后会发生什么，Android 给出了最好的公开证据。大约从 2019 年起，Android 团队开始把*新*开发转向内存安全语言，为原生代码引入了 Rust，并且决定不重写现有的 C 和 C++。到 Android 13，新增原生代码中约有 21% 是 Rust。内存安全漏洞的占比变化如下：

| 年份 | 内存安全漏洞在 Android 漏洞中的占比 |
|---|---|
| 2019 | 76% |
| 2022 | 35% |
| 2024 | 24% |
| 2025 | 低于 20% |

2024 年的数字只统计了当年的一部分，2025 年的数字来自 Google 2025 年 11 月的报告。那时 Android 里约有 500 万行 Rust，只发现过一个潜在的内存安全漏洞——CrabbyAVIF 图像解析器中的 CVE-2025-48530，在进入任何发布版之前就修掉了。折算下来约为每百万行 0.2 个，而 Google 对 Android 中 C 和 C++ 的历史估计是每百万行接近 1,000 个。同一份报告还发现，中等和大型的 Rust 改动被回滚的频率比同类 C++ 改动低约四倍——安全并不是用速度换来的。

那次险情本身也说明问题：它出在使用了 `unsafe` 的 Rust 代码里，而 `unsafe` 是与硬件和 C 打交道的逃生口。内存安全语言缩小了必须被信任的代码范围，但没有把它清零。

:::fold 为什么 Android 不必重写一切
Android 团队 2024 年的解释，建立在漏洞数据里的一个观察之上：漏洞集中在新写的和最近改过的代码里，一段代码的漏洞密度大致随它的年龄指数下降。经历了多年使用、模糊测试和修补的代码，大部分漏洞已经被抖落出来了。

按照这个模型，Google 估计五年前的代码，漏洞数比新代码少 3.4 到 7.4 倍——取决于代入的是一项学术研究里的漏洞寿命，还是在 Android 和 Chromium 中观察到的寿命。如果几乎所有新代码都是内存安全的，那么年轻、漏洞密集的 C++ 每年都在缩水，尽管几百万行老 C++ 还在，内存安全漏洞的总体占比也会下降。

由此得出的策略比“用 Rust 重写”温和得多：把手头的不安全代码冻结起来，继续对它做模糊测试和加固，新代码用安全语言写。上文的[分配器加固](/notes/allocators)和消毒器，就是在这期间看住剩下那些 C++ 的手段。
:::

## 理想在哪里弯折

::scene bends

三种对策没有一种能单独解决问题。

- **消毒器**只能看到测试和模糊测试跑到的路径，代价是 2–3 倍，而且不能随产品发布。
- **加固**是概率性的。它抬高了攻击的价格，而财力雄厚的攻击者会继续付这个价。
- **安全语言**仍然坐在 C 之上：内核、C 库、驱动，以及每一个 `unsafe` 块和[[ffi|外部函数调用]]。剩下的 Rust 漏洞往往就出在这些互操作边界上。
- **另外那 30%** 是逻辑漏洞、注入、认证错误和配置错误。内存安全消除了一大类漏洞，但并不能让软件变得正确。

还有一个统计上的保留：内存安全漏洞的占比下降时，分母也在变。占比下降，既可能是内存漏洞少了，也可能是别的漏洞被发现得多了。Google 2024 年的文章显示，内存安全漏洞的绝对数量也在下降，只是并非每年如此：2023 年略有回升。

## 回到书里的那条线

::scene levels

第 14 章讲了内存管理的两个层次：操作系统把页交给进程、在进程退出时收回；库里的 `malloc` 和 `free` 则在这些页内部管理字节。操作系统那一层是安全的，因为硬件会拿每一次访问去对照进程的[[page-table|页表]]；库这一层不安全，因为没有任何东西拿访问去对照单个对象的边界。

三种对策都是想把检查推到这个更细的粒度上。ASan 为每次访问加一道软件检查，所用的影子映射很像一张以 8 字节为页的页表；加固的分配器让库自己去验证自己的不变量；Rust 能在编译期检查的就在编译期查，查不了的就放到运行时。硬件也开始出手：MTE 用标签来做，[[cheri|CHERI]] 则把界限放进每一个指针，详见[界限那篇](/notes/bounds-revival)。

书里的建议是学会 Purify 和 Valgrind，然后“奇怪自己以前是怎么活下来的”。此后这些年，业界一直在弄清自己其实活得有多艰难，而 70% 就是它得出的数字。

## 延伸阅读

- Matt Miller：[*Trends, challenges, and strategic shifts in the software vulnerability mitigation landscape*](https://github.com/microsoft/MSRC-Security-Research/blob/master/presentations/2019_02_BlueHatIL/2019_01%20-%20BlueHatIL%20-%20Trends%2C%20challenge%2C%20and%20shifts%20in%20software%20vulnerability%20mitigation.pdf)，BlueHat IL 2019：包含 2006–2018 年统计图和根因分解的幻灯片。
- MSRC：[*A proactive approach to more secure code*](https://www.microsoft.com/en-us/msrc/blog/2019/07/a-proactive-approach-to-more-secure-code)，2019 年 7 月：微软自己对 70% 这一数字的总结。
- The Chromium Projects：[*Memory safety*](https://www.chromium.org/Home/chromium-security/memory-safety/)：912 个漏洞的分析，以及 Chromium 的应对策略。
- Jeff Vander Stoep、Alex Rebert：[*Eliminating memory safety vulnerabilities at the source*](https://security.googleblog.com/2024/09/eliminating-memory-safety-vulnerabilities-Android.html)，Google 安全博客，2024 年 9 月：关于代码年龄的论证。
- Jeff Vander Stoep：[*Rust in Android: move fast and fix things*](https://blog.google/security/rust-in-android-move-fast-fix-things/)，2025 年 11 月：低于 20% 的占比、漏洞密度与回滚率。
- Konstantin Serebryany 等：[*AddressSanitizer: A Fast Address Sanity Checker*](https://www.usenix.org/conference/atc12/technical-sessions/presentation/serebryany)，USENIX ATC 2012；以及 [AddressSanitizer 算法说明](https://github.com/google/sanitizers/wiki/AddressSanitizerAlgorithm)。
- Evgeniy Stepanov、Konstantin Serebryany：[*MemorySanitizer: fast detector of uninitialized memory use in C++*](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/43308.pdf)，CGO 2015。
- Adrian Taylor、Bartek Nowierski、Kentaro Hara：[*Use-after-freedom: MiraclePtr*](https://security.googleblog.com/2022/09/use-after-freedom-miracleptr.html)，Google 安全博客，2022 年 9 月。
- Android 开源项目：[*Scudo*](https://source.android.com/docs/security/test/scudo)：Android 的加固分配器。
