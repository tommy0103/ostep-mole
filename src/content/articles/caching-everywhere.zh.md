---
deck: CPU 缓存、TLB、页缓存、CDN、数据库缓冲池和 Redis 下的是同一个赌注，面对的也是同一个问题。怎样思考它们，第 22 章已经教过你了。
title: 一个思想，六个层次：第 22 章如何解释你用到的每一个缓存
---

::scene overview

打开一个商品页面，盯住其中一张图片。这张图来自附近一台 [[cdn|CDN]] 服务器上保存的副本。图片周围的页面由应用服务器生成，它先向 [[redis|Redis]] 要这件商品的记录。Redis 没命中，应用只好去问 [[postgresql|PostgreSQL]]；PostgreSQL 先查自己的[[buffer-pool|缓冲池]]，又没命中，于是向内核要某个文件里的一个 8 KiB 块。内核在[[page-cache|页缓存]]（page cache）里找到了这个块。一路上执行的每条指令都经过了 [[cpu-cache|L1 缓存]]，访问的每个地址都经过了 TLB 的转换。

一次页面访问，六个缓存，分布在芯片里、内核里和用户空间里。六个缓存做的是同一件事：**为又大又慢的东西保留一份又小又快的局部副本，并押注最近用过的东西很快还会再用。** 每一个也都得回答第 22 章的那个问题：副本满了、新东西又来了，该扔掉谁？

本文沿着这一摞缓存逐层往下走，在每一层问同样四个问题：缓存的单位是什么？谁来决定淘汰谁？写操作怎么处理？过期的副本怎么清除？细节各不相同，结构却始终一样。

## 书里的版本，一段话说完

::chapter vm-beyondphys-policy

第 22 章把物理内存看作虚拟页的缓存。它用**命中率**衡量缓存，再换算成**平均内存访问时间**（AMAT）：AMAT = T~M~ + P~miss~ · T~D~。磁盘比内存慢 10 万倍，哪怕 0.1% 的未命中率也会主导结果。Belady 的**最优策略**（OPT）淘汰未来最晚才会用到的页：完美、无法实现，却是衡量一切的标尺。**LRU** 用过去猜未来，程序有**局部性**时就管用。精确的 LRU 对上百万个页来说太贵，于是用**使用位**和**时钟算法**来近似。**脏页**淘汰起来更贵。而当**工作集**装不下时，系统就会**抖动**，什么策略也救不了。

::scene cpu

## 第一层：CPU 缓存

单位是**缓存行**（cache line）：当今 x86 处理器上是 64 字节，Apple M1 报告的是 128 字节（`sysctl hw.cachelinesize`）。缓存被分成若干*组*（set），某个地址的行只能放进固定的一组，落在这组的少数几*路*（way）之一，比如 8 路或 12 路。一切决策都由硬件在几个时钟周期内完成。

这样一来，替换问题就从“一百万行里挑哪一行”缩小成“这 8 路里挑哪一路”。在这个规模上，芯片付得起精确 LRU 的代价，也可以用一棵小小的位树（*伪 LRU*，pseudo-LRU）来近似它，就像时钟算法近似页面的 LRU 一样。组相联度小还带来了书中“三个 C”之一的**冲突未命中**：几行在同一组里互相挤占，别的组却闲着。

大容量的[[last-level-cache|末级缓存]]走得更远。2013 年，Henry Wong 通过测量发现，Intel [[ivy-bridge|Ivy Bridge]] 的 L3 已经不再是伪 LRU：每个 2048 组的切片里，64 组跑一种类 LRU 策略，64 组跑一种专门抵抗抖动的策略，其余各组跟随当下未命中更少的那一方。CPU 在自己身上做第 22 章的实验，对手正是 22.6 节的循环访问负载，然后挑出赢家。

::scene coherence

**写操作**几乎都是*写回*（write-back）：一次存储把缓存行弄脏，等它被淘汰时才写回内存，这就是书里的脏位，只不过粒度是 64 字节。多核机器上，难点在于**失效**（invalidation）：一个核写某一行时，一致性协议会让其他核上的副本失效，也就是[第 10 章](/virtualization/cpu-sched-multi)讲的总线窥探。两个[[thread|线程]]写同一行里的不同变量，就会不停地让对方的副本失效：这叫*伪共享*（false sharing），是一个缓存行尺度上的抖动。

::scene tlb

## 第二层：TLB

[第 19 章](/virtualization/vm-tlbs)的地址转换旁路缓冲存储器（TLB）缓存的是页表项。它的单位是一条地址转换，一条转换覆盖多大范围取决于页大小。假设一个 TLB 有 1,536 项：装 4 KiB 的页，能覆盖 6 MiB；同样的项数装 2 MiB 的页，就能覆盖 3 GiB。这个乘积叫 TLB 的**覆盖范围**（reach），它是一道工作集上限，什么替换策略都越不过去。[大页那篇](/notes/huge-pages)专门讲这件事。

::scene shootdown

TLB 真正不同的地方在于**失效**。CPU 缓存由硬件自动保持一致，TLB 不会。内核修改页表项时，无论是 [[mmap|`munmap()`]]、`mprotect()` 还是换出一个页，都得自己把过期的转换冲掉；如果别的核也可能持有这条转换，它们也得冲掉：在 x86 上内核通常要逐个打断它们，在 arm64 上则由硬件广播这次冲刷。这叫 *TLB 击落*（TLB shootdown），在大机器上是实打实的开销。给表项打上地址空间标识，就不必在每次上下文切换时把整个 TLB 清空，这正是 [PCID 那篇](/notes/pcid)的故事。

TLB 是只读缓存。在 x86 上，唯一的写入方向反过来：硬件在页表项里设置访问位和脏位，供操作系统的时钟算法读取。

::scene pagecache

## 第三层：页缓存

现在来到书里自己的这一层。第 23 章讲的 Linux 页缓存，按页把文件数据保存在内存里。每一次 `read()`、`write()` 和基于文件的 `mmap()` 都要经过它，所以一台繁忙的 Linux 机器上，看起来“被占用”的内存里有很大一部分其实是页缓存。

**淘汰**几乎就是第 22 章的原文：活跃/非活跃两个链表（书里的 2Q），由页表中的引用位驱动（时钟算法的思想）；从 6.1 起也可以改用[[mglru|多代 LRU]]（MGLRU）。[近似 LRU 那篇](/notes/approx-lru)讲这两种做法，[zram 与 OOM 那篇](/notes/zram-oom)讲淘汰也不够用时会发生什么。22.10 节的**预取**在这里叫*预读*（readahead）：遇到顺序读，内核会提前多读，并逐步扩大窗口，上限按设备设在 `/sys/block/<dev>/queue/read_ahead_kb`（常见值为 128）。

::scene writeback

**写操作**是写回的。`write()` 把页弄脏就返回。刷写线程每 5 秒醒来一次，把已经脏了 30 秒的数据写出去（`dirty_expire_centisecs` = 3000）。脏页达到可用内存的 10%（`dirty_background_ratio`）时，后台写回也会启动；达到 20%（`dirty_ratio`）时，正在写的进程就得亲自做写回。要立刻落盘，就调用 [[fsync|`fsync()`]]。

**失效**在这一层几乎免费：在一台机器上只有一份副本，所有读写这个文件的人共享同一批缓存页。麻烦从上面再叠一层缓存时开始。

::scene cdn

## 第四层：CDN 和你的浏览器

[[http-caching|HTTP 缓存]]（RFC 9111）分两种：*私有*缓存，比如你的浏览器，只服务一个用户；*共享*缓存，比如一个 CDN 节点，服务许多用户。单位是整个响应，从几个字节到几个 GB：和书里大小一致的页不同，这里每个单位大小不一，复用的可能性必须和占用的空间一起权衡。

CDN 节点里的**淘汰**通常用 LRU 家族的策略，而近年替换算法最好的一些工作，恰恰来自对这类负载的研究。许多对象是**一次性访问对象**（one-hit wonder）：只被请求一次，再也没人要。S3-FIFO 论文（[[sosp|SOSP 2023]]）报告，在 6,594 条生产环境[[access-trace|访问轨迹]]上，一次性访问对象比例的中位数是 26%；而在缓存实际能容纳的较短片段上，这个比例还要高得多。LRU 却让每个这样的对象都在链表里走完全程。先让新来者在一个小小的“试用区”里证明自己的策略，在这里可以胜过 LRU。

::scene http

**失效**是 HTTP 规定得最明确的部分，因为谁也没法去冲刷互联网另一头的缓存。源站给每个响应附上一个新鲜期，由各级缓存自己判断：

```text
# 带指纹的静态资源，例如 /static/app.3f9a1c.js
Cache-Control: max-age=31536000, immutable

# 引用它的 HTML 页面
Cache-Control: no-cache
ETag: "v42"

# API 响应：浏览器里 1 分钟，共享缓存里 10 分钟，刷新期间可用过期副本顶 30 秒
Cache-Control: max-age=60, s-maxage=600, stale-while-revalidate=30
```

第一种干脆绕开了失效：新版本换一个新 URL，`immutable`（RFC 8246）告诉浏览器即使用户刷新也不必再验证。第二种每次都验证：带上 `If-None-Match: "v42"` 去问，没变就只收到一个很小的 `304 Not Modified`。第三种用有界的陈旧换速度：`s-maxage` 只对共享缓存生效，`stale-while-revalidate`（RFC 5861）允许缓存先用过期副本作答，同时在后台刷新。再不够，CDN 还提供清除（purge）接口：这相当于一次跨越网络的 TLB 击落。

::scene bufferpool

## 第五层：数据库缓冲池

数据库自己缓存表和索引的页（PostgreSQL 是 8 KiB，[[innodb|InnoDB]] 默认 16 KiB），因为它知道内核不知道的事：哪些页属于一次性的扫描，脏页什么时候才可以写出去。

**PostgreSQL** 用的是时钟算法。每个缓冲区有一个 `usage_count`，每用一次加一，最多到 5（`BM_MAX_USAGE_COUNT`）。指针扫过时把计数减一，淘汰遇到的第一个计数为零、且[[buffer-pin|没被钉住]]（pin）的缓冲区：这是书里的使用位，多记了几位历史。面对循环访问负载，PostgreSQL 用**环形缓冲区**：大规模顺序扫描不进主缓冲池，而是在一个私有的 256 KiB 小环里循环使用，这样一个大查询就冲不掉别人的热页。

**InnoDB** 用的是*中点插入*（midpoint insertion）的 LRU。新页从尾部往前八分之三处进入“老”子链表（`innodb_old_blocks_pct` = 37）；只有在首次访问 1,000 ms 之后再次被访问，它才会被移到“年轻”的头部（`innodb_old_blocks_time`）。表扫描会在几毫秒内把每页碰几次，然后再也不碰，所以这些页一直待在老区，很快就被淘汰：这是加了计时器的 2Q。

::scene twice

**写操作**要遵守一条书里的脏位没有的规则：只有在描述这次修改的日志记录刷到持久存储之后，脏页才可以写盘。PostgreSQL 文档称之为[[wal|预写式日志]]（WAL）的核心概念。持久性由日志保证，于是缓冲池可以把脏页留很久、再成批写出：这正是 22.10 节说的写操作聚集，而且是安全的聚集。

缓存叠缓存是有代价的。PostgreSQL 文档建议把 `shared_buffers` 设为内存的 25%，并认为超过 40% 未必更好，*因为 PostgreSQL 同样依赖操作系统的缓存*，于是同一个块可能在内存里存两份。InnoDB 则可以改用 [[o-direct|`O_DIRECT`]]，绕过页缓存。

::scene appcache

## 第六层：应用缓存

在最顶层，缓存是一台独立的服务器，单位是应用放在某个键下的任何东西。

**淘汰。** Redis 开箱即用时什么都不淘汰：`maxmemory-policy` 的默认值是 `noeviction`，而且除非你自己配置，64 位版本不设内存上限。选用 `allkeys-lru` 后，Redis 随机抽样 5 个键（`maxmemory-samples`），淘汰其中空闲最久的那个；从 3.0 起，它还会在两次淘汰之间保留一个小小的候选池来改进效果，详见[近似 LRU 那篇](/notes/approx-lru)。Redis 4.0 起提供的 `allkeys-lfu` 给每个键配一个 8 位的对数计数器，并随时间衰减，免得昨天的热门键永远赖着不走。

**[[memcached|memcached]]** 让每种大小各有自己的缓存：内存被分成块大小固定的 slab 类，每类有自己的 LRU。从 1.5.0 起，这个 LRU 改成了*分段*的：新条目进入 HOT；再次命中的条目移入 WARM，以免被扫描冲掉，比如爬虫在翻旧内容；其余的流入 COLD，淘汰在那里发生。提升由后台线程完成，所以一次命中永远不必等链表上的[[lock|锁]]。

**写操作和失效**归应用自己管，大多数缓存 bug 也住在这里。常见的*旁路缓存*（cache-aside）模式里，未命中时读数据库、再填进缓存；写操作则先更新数据库、再*删除*这个键，因为如果改成覆盖写，两个并发的写者可能让旧值永久留在缓存里。即便如此，仍有一个[[race-condition|竞态]]：读者未命中，读到了旧行；写者更新这一行并删除键；接着读者把它手里的旧值写进缓存，一直陈旧到 [[ttl|TTL]] 过期。Facebook 2013 年的 memcache 论文描述了他们的解法：每次未命中时发放一个*租约*（lease），删除操作会让租约作废，于是那次迟到的陈旧回填会被拒绝。租约还能防止一大群客户端同时去回填同一个热键。

::scene scans

## 动手试试：一个策略问题，每一层都在问

::lab Replacement

这个实验在短小的访问序列上运行第 22 章的各种策略，其中每一种模式上面都出现过：

- 选 **Looping**（循环访问），用 5 个帧：LRU 和 FIFO 每次都未命中，RANDOM 还能命中几次，调到 6 个帧则全部命中。PostgreSQL 的环形缓冲区、InnoDB 的老子链表、Linux 的非活跃链表、memcached 的 HOT 队列，都是为了把这种扫描关在笼子里。
- 选 **80-20**。LRU 胜过 FIFO，因为历史能预测热页。正是这种偏斜，让一个小缓存就能服务大多数请求。
- 选 **Belady 异常**，比较 FIFO 在 3 个帧和 4 个帧时的表现：缓存更大，未命中反而更多。LRU 和 OPT 永远不会这样，因为它们是*栈算法*：小缓存的内容总是大缓存内容的子集。

这个实验和书一样，假设所有页大小相同、每次未命中代价相同。

::scene overview

## 共同的术语

把整摞缓存放进一张表。容量只是数量级。

| 层次 | 单位 | 典型容量 | 淘汰 | 写 | 失效 |
|---|---|---|---|---|---|
| CPU 缓存 | 64 B 缓存行 | 几 KiB 到几十 MiB | 组内 LRU、伪 LRU 或自适应策略 | 写回 | 一致性协议 |
| TLB | 一条地址转换 | 几十到几千项 | 硬件，组内 | 无（设置 A/D 位） | 显式冲刷、击落 |
| 页缓存 | 4 KiB 页 | 大部分空闲内存 | 活跃/非活跃链表或 MGLRU | 写回，`fsync` | 每台机器只有一份 |
| CDN / 浏览器 | HTTP 响应 | 每台服务器的内存和磁盘 | LRU 家族，考虑大小 | 无（数据归源站） | TTL、再验证、清除 |
| 缓冲池 | 8 或 16 KiB 页 | 由配置决定 | 带计数的时钟、中点插入 LRU | WAL 之后写回 | 自己就是数据的主人 |
| Redis / memcached | 键值条目 | 由配置决定 | 抽样 LRU/LFU、分段 LRU | 旁路缓存 | 删除、TTL、租约 |

表头这几列，就是共同的术语：

- **命中率。** 每一层都在数它，从 CPU 性能计数器到 Redis `INFO` 里的 `keyspace_hits`。AMAT 告诉你，为什么它的一点点变化都很要紧。
- **工作集。** 这是 Peter Denning 1968 年提出的说法，指一个进程最近用过的那些页。每一层都会在超过某个规模时抖动：溢出 L1 的循环、超出 TLB 覆盖范围的堆、长得比缓冲池还大的索引。
- **局部性。** 赌注本身。时间局部性是保留东西的理由；空间局部性是一次取一整行、一整个预读窗口或一整个响应的理由。
- **写策略。** 凡是拥有数据的层都用写回，再配一个“这次是真的要写”的手段：缓存冲刷指令、`fsync()`、WAL 刷盘。
- **失效。** 越往上越难：先是硬件一致性，再是手动冲刷 TLB，最后是只限定陈旧程度、而不阻止陈旧的 TTL 和验证器。

:::fold 一个公式管整摞缓存
书里的 AMAT 只有一层。把它嵌套起来，就能描述一整摞。三层时：

AMAT = T~1~ + m~1~ · (T~2~ + m~2~ · T~3~)

其中 T~i~ 是访问第 *i* 层所需的时间，m~i~ 是到达这一层的请求里未命中的比例。

取一组示意性的整数（不是测量值）：应用缓存 0.2 ms 作答；缓冲池命中时数据库 2 ms 作答；必须访问存储时 10 ms。应用缓存命中率 90%、缓冲池命中率 99% 时：

AMAT = 0.2 + 0.10 · (2 + 0.01 · 10) = 0.2 + 0.10 · 2.1 = 0.41 ms。

把顶层命中率提到 95%，结果约为 0.31 ms；若改为让缓冲池命中率跌到 90%，结果是 0.2 + 0.10 · 3 = 0.5 ms。最慢那一层的未命中代价太高，以至于底层的一点滑坡，抵得上顶层一大步改进省下的时间。

而且各层的未命中率并不独立。上层缓存吸走了热门请求，下层看到的请求流局部性比原始负载*更差*，命中率也就随之下降。这就是为什么在源站前面加上 CDN 之后，源站自己的缓存看起来反而变差了。
:::

::scene cdn

## 书里的模型在哪里弯折

书里假设页大小一致、未命中代价一致、只有一个线程。真实的缓存在三个方面弯折了它：

- **大小与代价。** 淘汰一个大对象可能腾出够放几百个小对象的空间；一次要花 2 秒重新计算页面的未命中，比一次 4 KiB 的 [[ssd|SSD]] 读贵得多。考虑大小的策略和 memcached 的 slab 类就是为此而生。
- **并发。** 精确的 LRU 在*每次命中*时都要移动表项，把一把锁放在了最热的路径上。SIEVE（2024 年）和 S3-FIFO（2023 年）的论文报告，在 16 线程下，它们的吞吐量分别约为优化过的 LRU 的 2 倍和 6 倍以上，因为一次命中只需设置一个位。
- **准入。** 书里每个未命中的页都会进入缓存。CDN 和闪存缓存常常要先决定*要不要*接纳一个对象，因为把一次性访问对象写进闪存，只会白白磨损它。

:::fold FIFO 的反击：SIEVE 是怎么工作的
SIEVE（NSDI 2024）只有一个 FIFO 队列、每个对象一个位，外加一根移动的指针：

```text
# 伪代码，依据 Zhang 等人，NSDI 2024
on hit(x):   x.visited = 1                     # 链表完全不动
on miss(x):
    if cache is full:
        o = hand or tail
        while o.visited == 1:
            o.visited = 0                      # 幸存者原地不动
            o = o.prev or tail                 # 指针从尾部向头部移动
        hand = o.prev
        evict(o)
    insert x at head with visited = 0
```

这几乎就是时钟算法，区别在于幸存者去哪儿。时钟算法实际上把它放回头部，和新来者混在一起；SIEVE 让它留在原地，于是老的热门对象聚在指针身后，指针的大部分时间都花在最新的那批条目上。没有再被命中的新来者很快就离开，作者称之为*快速降级*（quick demotion）；热门对象靠淘汰时翻转一个位得以保留，而不是每次命中都挪动，作者称之为*惰性提升*（lazy promotion）。

作者报告，在来自 7 个来源的 1,559 条访问轨迹上，SIEVE 在超过 45% 的轨迹上未命中率低于另外 9 种算法，比 [[arc|ARC]] 最多低 63.2%。S3-FIFO（SOSP 2023）出自有部分重叠的作者团队，把快速降级做得更直接：一个占 10% 空间、专供新来者的小 FIFO；一个主 FIFO，接收在小队列里就被再次命中的对象；还有一个“幽灵”队列，只记住最近被淘汰的键，不存数据。原来，使用位不只是 LRU 的廉价替身。
:::

::scene invalidation

## 回到书里的那条线

第 22 章说主存是虚拟页的缓存，然后问该如何管理它。本文的每一层都是把这句话里的名词换掉，而书里的答案几乎原封不动地适用。

更高的层次添上的，主要是失效问题。页缓存能这么简单，是因为它是唯一的副本；它上面的每一层缓存都在复制别人可能修改的东西，所以都需要一条规则，规定自己可以陈旧到什么程度。硬件精确地解决了它，代价是一致性流量；Web 近似地解决了它，代价是陈旧；应用自己解决它，代价是 bug。

这个模式还在延续：带 TTL 的 [[dns|DNS]] 解析器、按内容哈希做键的构建缓存，以及大模型推理服务器里的 [[kv-cache|KV 缓存]]，它也有自己的分页故事，见 [PagedAttention 那篇](/notes/paged-attention)。术语学会一次，你就能推理所有这些系统。

## 延伸阅读

- [HTTP Caching，RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html)（2022），以及 [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html)（stale-while-revalidate）和 [RFC 8246](https://www.rfc-editor.org/rfc/rfc8246.html)（immutable）。
- [Linux 内核 vm sysctl 文档](https://docs.kernel.org/admin-guide/sysctl/vm.html)：脏页写回的各个参数。
- [PostgreSQL 缓冲管理器 README](https://github.com/postgres/postgres/blob/master/src/backend/storage/buffer/README)。
- [MySQL 8.4：让缓冲池抵抗扫描](https://dev.mysql.com/doc/refman/8.4/en/innodb-performance-midpoint_insertion.html)：中点插入与 `innodb_old_blocks_time`。
- [Redis：键的淘汰](https://redis.io/docs/latest/develop/reference/eviction/)。
- [Replacing the cache replacement algorithm in memcached](https://memcached.org/blog/modern-lru/)（dormando，2018）：分段 LRU。
- Rajesh Nishtala 等：[Scaling Memcache at Facebook](https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala)，NSDI 2013。关于租约，另见 [MIT 6.824 讲义](https://pdos.csail.mit.edu/6.824/notes/l-memcached.txt)。
- Yazhuo Zhang 等：[SIEVE is Simpler than LRU](https://www.usenix.org/conference/nsdi24/presentation/zhang-yazhuo)，NSDI 2024。Juncheng Yang 等：[FIFO queues are all you need for cache eviction](https://junchengyang.com/publication/sosp23-s3fifo.pdf)，SOSP 2023。
- Henry Wong：[Intel Ivy Bridge cache replacement policy](https://blog.stuffedcow.net/2013/01/ivb-cache-replacement/)（2013）。
- Peter J. Denning：*The working set model for program behavior*，Communications of the ACM 11(5)，1968。
