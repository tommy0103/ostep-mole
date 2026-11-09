import type { SceneDef } from './index'

/** The running figure of “Nobody implements real LRU, and that is fine”. */
const scene: SceneDef = {
  height: 440,
  bands: {
    overview: [4, 400],
    exact: [36, 420],
    clock: [36, 336],
    family: [36, 384],
    twolist: [4, 352],
    rmap: [36, 336],
    refault: [36, 368],
    mglru: [36, 352],
    walk: [36, 320],
    redis: [36, 352],
    lfu: [36, 384],
    plru: [36, 352],
    dueling: [36, 336],
    bends: [36, 352],
  },
  parts: {
    layer: [4, 30],
    access: [36, 118],
    work: [44, 78],
    items: [112, 156],
    hints: [156, 176],
    hand: [176, 196],
    loop: [176, 206],
    links: [154, 182],
    move: [96, 120],
    ring: [212, 246],
    sample: [112, 196],
    pool: [200, 252],
    lists: [108, 260],
    inactive: [194, 240],
    ptes: [108, 206],
    cacheslots: [108, 152],
    shadow: [118, 182],
    gens: [108, 244],
    tables: [108, 212],
    bloom: [214, 250],
    bits24: [108, 208],
    tree: [36, 120],
    sets: [108, 242],
    decide: [262, 292],
  },
  states: {
    overview: {
      title: { en: 'A hint, and a late decision', zh: '一个提示，一个迟来的决定' },
      caption: {
        en: 'None of these systems keeps a full order. Each stores a cheap hint per item, updated on access, and decides what to evict only when it must, by reading the hints.',
        zh: '这些系统都不保存完整的顺序。每一项只记一个廉价的提示，在访问时更新；只有不得不淘汰时，才去读这些提示做决定。',
      },
    },
    exact: {
      title: { en: 'Real LRU pays on every access', zh: '真 LRU 每次访问都要付钱' },
      caption: {
        en: 'To know the oldest item at any moment, every access has to update an order: moving a page means a trap or a timestamp, a list needs two pointers per item and a write on every read, and a CPU set needs at least log₂(n!) bits.',
        zh: '要随时知道哪一项最老，每次访问都得更新顺序：挪动一页意味着一次陷入或写一个时间戳；链表每项要两个指针，每次读都变成写；CPU 缓存的每一组至少要 log₂(n!) 位。',
      },
    },
    clock: {
      title: { en: 'CLOCK: one bit and a hand', zh: '时钟算法：一个位，一根指针' },
      caption: {
        en: 'Hardware sets a use bit on access and does no more. At eviction the hand sweeps: a page with its bit set has it cleared and gets a second chance; the first page found with a clear bit is evicted.',
        zh: '访问时硬件置使用位，别的什么也不做。淘汰时指针扫过去：使用位为 1 的页被清零，得到第二次机会；第一个使用位为 0 的页被淘汰。',
      },
    },
    family: {
      title: { en: 'What grew out of it', zh: '从它长出来的东西' },
      caption: {
        en: 'PostgreSQL shows two of the refinements. A usage count of up to 5 per buffer replaces the single bit, so a buffer used often survives several sweeps, and a large sequential scan gets a small private ring of its own.',
        zh: 'PostgreSQL 体现了其中两种改进：每个缓冲区一个上限为 5 的使用计数，取代了单个位，常用的缓冲区能熬过好几轮扫描；大的顺序扫描则拿到一个私有的小环。',
      },
    },
    twolist: {
      title: { en: 'Linux: two lists', zh: 'Linux：两个链表' },
      caption: {
        en: 'New file pages start on the inactive list. A page referenced again there is promoted to the active list, whose tail is demoted when it grows too big, and reclaim takes its victims from the inactive tail.',
        zh: '新的文件页先进入非活跃链表。在那里再次被引用的页提升到活跃链表；活跃链表太长时从尾部降级；回收从非活跃链表的尾部挑牺牲者。',
      },
    },
    rmap: {
      title: { en: 'Who touched this page?', zh: '谁碰过这一页？' },
      caption: {
        en: 'For a mapped page, hardware sets the accessed bit in the PTE, not in the page. So reclaim has to follow the reverse map from the page to every PTE that maps it.',
        zh: '对映射到地址空间的页，硬件把访问位置在 PTE 里，而不是页上。所以回收时得沿着反向映射，从页找到映射它的每个 PTE。',
      },
    },
    refault: {
      title: { en: 'Noticing a bad eviction', zh: '察觉一次错误的淘汰' },
      caption: {
        en: 'An evicted file page leaves a shadow entry in its page-cache slot. If the page is read back soon, the kernel counts how many other pages were evicted in between, and a small enough distance activates the page at once. The numbers here are an example.',
        zh: '被淘汰的文件页在页缓存槽位里留下影子表项。如果它很快又被读回，内核就数一数其间淘汰了多少别的页；距离够小，这一页立即被激活。图中的数字只是举例。',
      },
    },
    mglru: {
      title: { en: 'MGLRU: generations', zh: 'MGLRU：代' },
      caption: {
        en: 'Between 2 and 4 generations replace the two lists. The aging hand moves accessed pages into the youngest generation, the eviction hand takes pages from the oldest, and everything else falls behind without being touched.',
        zh: '2 到 4 代取代了两个链表。老化指针把被访问过的页移入最年轻的一代，淘汰指针从最老的一代取页，其余的页不必触碰就自然落后了。',
      },
    },
    walk: {
      title: { en: 'Walking the page tables', zh: '遍历页表' },
      caption: {
        en: 'Instead of visiting each page and searching for its PTEs, the aging hand walks page tables directly, where neighbouring PTEs share cache lines. A Bloom filter remembers which page-table pages are worth scanning again.',
        zh: '老化指针不再逐页去找映射它的 PTE，而是直接遍历页表，相邻的 PTE 共享缓存行。布隆过滤器记住哪些页表页值得下次再扫。',
      },
    },
    redis: {
      title: { en: 'Redis: sampling', zh: 'Redis：抽样' },
      caption: {
        en: 'Keys are in no order. Each stores its last access in 24 bits, and to evict, Redis samples 5 keys and evicts the one idle longest. The pool keeps the best candidates between rounds. The longest-idle key overall may not be sampled, as here.',
        zh: '键没有任何顺序。每个键用 24 位记下最近一次访问；淘汰时，Redis 抽 5 个键，淘汰其中闲置最久的。淘汰池在各轮之间保留最好的候选者。全体中闲置最久的键未必被抽中，图中就是这样。',
      },
    },
    lfu: {
      title: { en: 'The same 24 bits, for frequency', zh: '同样的 24 位，用来记频率' },
      caption: {
        en: 'Under LFU policies the top 16 bits hold the last access in minutes and the low 8 bits a logarithmic counter. Each increment is less likely than the one before, and the counter decays while the key sits idle.',
        zh: '在 LFU 策略下，高 16 位存以分钟计的最近访问时间，低 8 位存一个对数计数器。每一次加一都比上一次更难，键闲置时计数器还会衰减。',
      },
    },
    plru: {
      title: { en: 'Tree pseudo-LRU', zh: '树形伪 LRU' },
      caption: {
        en: 'The ways of a set are the leaves of a binary tree, and each internal node holds one bit pointing towards the half used less recently. Here way 0 has just been hit, and the bits lead to way 4.',
        zh: '一组中的各路是一棵二叉树的叶子，每个内部节点存一位，指向较久未用的那一半。这里第 0 路刚被命中，这些位指向第 4 路。',
      },
      demo: {
        label: { en: 'Tree-PLRU on one set', zh: '一个组上的 tree-PLRU' },
        steps: [
          {
            en: 'An 8-way set. The eight lines are the leaves of a binary tree, and each of the 7 internal nodes holds one bit that points towards the half used less recently. The ways were used in order, 0 to 7, so every bit points left, and following them leads to way 0, the oldest.',
            zh: '一个 8 路的组。八行是一棵二叉树的叶子，7 个内部节点各存一位，指向较久未用的那一半。各路是按 0 到 7 的顺序用过的，所以每一位都指向左边，顺着走就到了第 0 路，也就是最老的那一行。',
          },
          {
            en: 'A hit on way 0. The three bits on the path from the root to way 0 are flipped to point away from it. The other four bits are not touched: one path per hit.',
            zh: '第 0 路被命中。从根到第 0 路这条路径上的三个位被翻转，指向背离它的方向。其余四位不动：每次命中只更新一条路径。',
          },
          {
            en: 'Time to evict. Start at the root and follow the bits: right, left, left. They lead to way 4.',
            zh: '该淘汰了。从根开始顺着这些位走：右、左、左，到了第 4 路。',
          },
          {
            en: 'But the least recently used line is way 1, last used at t2; way 4 was used at t5. Seven bits cannot hold an order: the tree remembers which half was used, not when. That is the approximation.',
            zh: '可是最久未用的其实是第 1 路（最后使用于 t2），第 4 路用于 t5。七个位存不下一个顺序：这棵树记得的是哪一半被用过，而不是何时用过。这就是近似。',
          },
          {
            en: 'The new line goes into way 4, and that counts as a use: the three bits on its path now point away from it. Seven bits in all, against 16 for exact LRU on 8 ways.',
            zh: '新的一行放进第 4 路，这也算一次使用：它路径上的三个位现在指向背离它的方向。总共七位，而 8 路的精确 LRU 要 16 位。',
          },
        ],
      },
    },
    dueling: {
      title: { en: 'Set dueling', zh: '组决斗' },
      caption: {
        en: 'On Haswell and Broadwell, a few dedicated sets of L3 run each of two competing policies, and the rest of the cache follows whichever is currently missing less.',
        zh: '在 Haswell 和 Broadwell 上，L3 中有少数专用组分别运行两种相互竞争的策略，其余的组跟随当前未命中更少的那一种。',
      },
    },
    bends: {
      title: { en: 'Where it bends', zh: '理想在哪里弯折' },
      caption: {
        en: 'One bit cannot tell a page used once from one used a thousand times. Reading the hints costs CPU under pressure. And recency is the wrong signal for data that will not be reused, so every system has a special case for scans.',
        zh: '一个位分不清用过一次和用过一千次的页；读这些提示在内存压力下也要花 CPU；而对不会再用的数据，新近程度是错误的信号，所以每个系统都为扫描准备了特殊处理。',
      },
    },
  },
  terms: {
    'buffer-pool': ['items'],
    rmap: ['ptes', 'inactive'],
    'shadow-entry': ['shadow'],
    refault: ['shadow'],
    'page-cache': ['cacheslots'],
    'bloom-filter': ['bloom'],
  },
}

export default scene
