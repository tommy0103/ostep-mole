import type { Bi } from '@/lib/i18n'

/** Big ideas that run through Part I, each tied to the chapters where it does the work. */
export interface Idea {
  id: string
  title: Bi
  gist: Bi
  chapters: number[]
  examples: Bi
}

export const IDEAS: Idea[] = [
  {
    id: 'illusion',
    title: { en: 'Virtualization = a convincing illusion', zh: '虚拟化 = 令人信服的假象' },
    gist: {
      en: 'Take one physical resource and present many private, idealized copies of it: a CPU per process, a memory per process.',
      zh: '把一份物理资源，呈现为许多私有的、理想化的副本：每个进程一颗 CPU、一块内存。',
    },
    chapters: [3, 4, 12, 13, 21],
    examples: { en: 'Virtual machines, containers, browser tabs, cloud vCPUs.', zh: '虚拟机、容器、浏览器标签页、云上的 vCPU。' },
  },
  {
    id: 'time-space',
    title: { en: 'Time sharing vs. space sharing', zh: '时分共享与空分共享' },
    gist: {
      en: 'A resource is shared either by taking turns (CPU) or by dividing it up (memory, disk). Most designs mix both.',
      zh: '资源要么轮流使用（CPU），要么切分使用（内存、磁盘）。大多数设计两者兼用。',
    },
    chapters: [4, 7, 9, 13, 17, 18],
    examples: { en: 'GPU time slicing vs. MIG partitions; TDMA vs. FDMA in radio.', zh: 'GPU 时间片 vs. MIG 分区；无线通信中的 TDMA 与 FDMA。' },
  },
  {
    id: 'mech-policy',
    title: { en: 'Mechanism vs. policy', zh: '机制与策略分离' },
    gist: {
      en: 'Separate *how* (context switch, page fault handling) from *which* (who runs next, which page to evict) so either can change independently.',
      zh: '把“如何做”（上下文切换、缺页处理）与“选哪个”（下一个运行谁、淘汰哪一页）分开，让两者可以独立演进。',
    },
    chapters: [4, 6, 7, 8, 21, 22],
    examples: { en: 'Linux sched_ext (BPF-defined schedulers), pluggable TCP congestion control.', zh: 'Linux sched_ext（用 BPF 编写调度策略）、可插拔的 TCP 拥塞控制。' },
  },
  {
    id: 'hw-assist',
    title: { en: 'Hardware and OS, co-designed', zh: '硬件与操作系统协同设计' },
    gist: {
      en: 'User/kernel modes, traps, the timer interrupt, the MMU, TLBs and present bits: the OS stays in control only because the hardware helps.',
      zh: '用户/内核模式、陷阱、时钟中断、MMU、TLB 与存在位：操作系统之所以能保持控制，全靠硬件相助。',
    },
    chapters: [6, 15, 16, 18, 19, 21],
    examples: { en: 'VT-x/AMD-V, nested paging, Arm’s pointer authentication.', zh: 'VT-x/AMD-V、嵌套分页、Arm 的指针认证。' },
  },
  {
    id: 'indirection',
    title: { en: 'Indirection', zh: '间接层' },
    gist: {
      en: 'Every virtual address goes through a mapping — base register, segment table, page table — which lets the OS move, share and protect memory freely.',
      zh: '每个虚拟地址都要经过一层映射——基址寄存器、段表、页表——操作系统因此可以自由地移动、共享和保护内存。',
    },
    chapters: [13, 15, 16, 18, 20, 23],
    examples: { en: 'DNS, file-system inodes, PagedAttention’s block tables, pointers to pointers.', zh: 'DNS、文件系统 inode、PagedAttention 的块表、指向指针的指针。' },
  },
  {
    id: 'caching',
    title: { en: 'Caching & locality', zh: '缓存与局部性' },
    gist: {
      en: 'Programs reuse recent data (temporal) and nearby data (spatial). A small fast cache in front of a big slow store turns that into speed.',
      zh: '程序会复用最近的数据（时间局部性）和相邻的数据（空间局部性）。在又大又慢的存储前放一块又小又快的缓存，就能把局部性变成速度。',
    },
    chapters: [10, 19, 21, 22],
    examples: { en: 'CPU caches, CDNs, Redis, LLM KV caches.', zh: 'CPU 缓存、CDN、Redis、大模型 KV 缓存。' },
  },
  {
    id: 'oracle',
    title: { en: 'Approximating the oracle', zh: '逼近“先知”' },
    gist: {
      en: 'The optimal policy needs the future (SJF, OPT). Real systems learn from the past instead (MLFQ, LRU) and add resets for when the past lies.',
      zh: '最优策略需要预知未来（SJF、OPT）。真实系统转而从过去学习（MLFQ、LRU），并在过去“说谎”时加以重置。',
    },
    chapters: [7, 8, 22],
    examples: { en: 'Branch prediction, learned index structures, output-length prediction in LLM serving.', zh: '分支预测、学习型索引、大模型推理中的输出长度预测。' },
  },
  {
    id: 'amortize',
    title: { en: 'Amortization', zh: '摊销' },
    gist: {
      en: 'Fixed costs (a context switch, a TLB miss, a page table walk) become tolerable when spread over enough useful work: longer slices, bigger pages, batched calls.',
      zh: '固定开销（上下文切换、TLB 未命中、页表遍历）只要分摊到足够多的有用工作上就可以接受：更长的时间片、更大的页、批量调用。',
    },
    chapters: [6, 7, 19, 20],
    examples: { en: 'io_uring batching, huge pages, continuous batching in LLM inference.', zh: 'io_uring 批量提交、大页、大模型推理中的连续批处理。' },
  },
  {
    id: 'fragmentation',
    title: { en: 'Fragmentation: fixed vs. variable sizes', zh: '碎片：定长与变长' },
    gist: {
      en: 'Variable-sized allocation wastes space between chunks (external); fixed-sized wastes space inside them (internal). Every allocator picks its poison.',
      zh: '变长分配浪费块与块之间的空间（外部碎片）；定长分配浪费块内部的空间（内部碎片）。每个分配器都得选一种代价。',
    },
    chapters: [14, 16, 17, 18, 20],
    examples: { en: 'jemalloc size classes, file-system extents vs. blocks, vLLM paged KV cache.', zh: 'jemalloc 的尺寸类别、文件系统的区段与块、vLLM 的分页 KV 缓存。' },
  },
]
