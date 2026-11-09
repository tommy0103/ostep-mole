import type { Term } from './index'

/** Terms of “Nobody implements real LRU, and that is fine”. */
const terms: Record<string, Term> = {
  sieve: {
    title: { en: 'SIEVE', zh: 'SIEVE' },
    body: {
      en: 'A cache eviction algorithm presented at NSDI 2024. Objects stay in insertion order, each with one “visited” bit; a hit only sets the bit. A hand moves from old to new, clears visited bits and evicts the first unvisited object, and survivors are never moved.',
      zh: 'NSDI 2024 上提出的一种缓存淘汰算法。对象按插入顺序排列，各带一个“已访问”位；命中时只置这一位。一根指针从旧往新移动，清掉已访问位，淘汰第一个未访问的对象；幸存者从不挪动位置。',
    },
  },
  'set-associative': {
    title: { en: 'Set-associative cache', zh: '组相联缓存' },
    body: {
      en: 'How a [[cpu-cache|CPU cache]] is organised. An address picks one *set*, and its [[cache-line|line]] may go in any of that set’s *n* slots, called ways. So replacement is decided inside one set, among only *n* lines.',
      zh: '[[cpu-cache|CPU 缓存]]的组织方式。一个地址选中一个“组”（set），它的[[cache-line|缓存行]]可以放进这一组 *n* 个位置（称为“路”，way）中的任何一个。所以替换决定只在一组之内、*n* 行之间做出。',
    },
  },
  'tree-plru': {
    title: { en: 'Tree pseudo-LRU', zh: '树形伪 LRU（tree-PLRU）' },
    body: {
      en: 'A cheap stand-in for LRU in hardware. The ways of a [[set-associative|set]] are the leaves of a binary tree whose *n* − 1 internal nodes hold one bit each, pointing towards the half used less recently. A hit flips the bits on one path; eviction follows the bits from the root.',
      zh: '硬件里对 LRU 的廉价替代。[[set-associative|一组]]中的各路是一棵二叉树的叶子，*n* − 1 个内部节点各存一位，指向较久未用的那一半。命中时翻转一条路径上的位；淘汰时从根顺着这些位走下去。',
    },
  },
  rmap: {
    title: { en: 'Reverse map (rmap)', zh: '反向映射（rmap）' },
    body: {
      en: 'The Linux structures that go the other way from a [[page-table|page table]]: from a physical page to every page-table entry that maps it. The kernel needs them to clear or read those entries, for example to see whether a shared page has been used.',
      zh: 'Linux 里与[[page-table|页表]]方向相反的那套结构：从一个物理页找到映射它的每个页表项。内核要清除或读取这些表项时用得上，比如查看一个共享的页有没有被用过。',
    },
  },
  folio: {
    title: { en: 'Folio', zh: 'folio' },
    body: {
      en: 'The Linux kernel’s structure for a group of physically contiguous pages, one page or a power of two of them, handled as a unit. Much of the memory-management code now works on folios rather than single pages.',
      zh: 'Linux 内核用来表示一组物理连续页面的结构，可以是一页，也可以是 2 的幂个页，作为一个单位来处理。如今内存管理的很多代码都以 folio 而不是单个页为操作对象。',
    },
  },
  lwn: {
    title: { en: 'LWN', zh: 'LWN' },
    body: {
      en: 'LWN.net, originally Linux Weekly News: a news site whose reporting on Linux kernel development is a standard source for why a change was made.',
      zh: 'LWN.net，原名 Linux Weekly News：一个新闻网站，它对 Linux 内核开发的报道，是了解某项改动为何发生的常用资料。',
    },
  },
  'bloom-filter': {
    title: { en: 'Bloom filter', zh: '布隆过滤器（Bloom filter）' },
    body: {
      en: 'A compact bit array that answers “have I seen this?” Each item sets a few bits chosen by hash functions; if any of an item’s bits is clear, it was never added. A yes can be wrong, a no cannot, and the array does not grow with the items.',
      zh: '一个紧凑的位数组，用来回答“这个我见过吗？”。每一项按几个哈希函数选中几个位并置 1；只要某项对应的位有一个是 0，它就肯定没加入过。回答“见过”可能出错，回答“没见过”绝不会错，而且数组不随项数增长。',
    },
  },
  lruvec: {
    title: { en: 'lruvec', zh: 'lruvec' },
    body: {
      en: 'The Linux kernel’s set of LRU lists, kept per memory [[cgroup|cgroup]] and per NUMA node, that reclaim works on.',
      zh: 'Linux 内核里供回收使用的一组 LRU 链表，按内存 [[cgroup|cgroup]]、按 NUMA 节点各有一份。',
    },
  },
  'pid-controller': {
    title: { en: 'PID controller', zh: 'PID 控制器' },
    body: {
      en: 'A feedback loop from control engineering, the kind that keeps an oven at temperature. It adjusts its output from the current error (proportional), the error accumulated so far (integral) and how fast the error is changing (derivative).',
      zh: '控制工程里的一种反馈回路，烤箱保温用的就是这类东西。它根据当前误差（比例）、累积误差（积分）和误差变化的快慢（微分）来调整输出。',
    },
  },
  'morris-counter': {
    title: { en: 'Morris counter', zh: 'Morris 计数器' },
    body: {
      en: 'A way to count large numbers in very few bits, published by Robert Morris in 1978. Each event raises the counter only with a probability that shrinks as the counter grows, so the value tracks roughly the logarithm of the true count.',
      zh: '一种用极少的位数统计大数的办法，由 Robert Morris 于 1978 年发表。每发生一次事件，计数器只以某个概率加一，这个概率随计数增大而变小，于是计数值大致跟随真实次数的对数。',
    },
  },
  'cache-levels': {
    title: { en: 'L1, L2, L3 caches', zh: 'L1、L2、L3 缓存' },
    body: {
      en: 'The tiers of a processor’s [[cpu-cache|cache]]. L1 is the smallest and fastest, split into instructions and data on each core; L2 is larger and slower; L3 is larger still and usually shared by the cores. An access tries them in that order.',
      zh: '处理器[[cpu-cache|缓存]]的各个层级。L1 最小最快，每个核心各有一份，分为指令和数据两部分；L2 更大也更慢；L3 更大，通常由各核心共享。一次访问按这个顺序逐级查找。',
    },
  },
  'intel-microarch': {
    title: { en: 'Haswell, Coffee Lake, Ice Lake', zh: 'Haswell、Coffee Lake、Ice Lake' },
    body: {
      en: 'Intel’s code names for successive generations of processor core: Haswell (2013), Broadwell (2014), Coffee Lake (2017), Ice Lake (2019).',
      zh: 'Intel 给一代代处理器核心起的代号：Haswell（2013 年）、Broadwell（2014 年）、Coffee Lake（2017 年）、Ice Lake（2019 年）。',
    },
  },
}

export default terms
