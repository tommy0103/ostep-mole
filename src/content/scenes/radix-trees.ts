import type { SceneDef } from './index'

/** The running figure of “A multi-level page table is a radix tree, and it is everywhere”. */
const scene: SceneDef = {
  height: 420,
  bands: {
    overview: [4, 332],
    'two-level': [4, 268],
    radix: [4, 268],
    x86: [4, 396],
    sparse: [4, 418],
    huge: [4, 332],
    pagecache: [4, 268],
    xarray: [4, 268],
    shadow: [4, 268],
    lpm: [4, 332],
    dir24: [4, 268],
    inode: [4, 332],
    depth: [4, 396],
  },
  parts: {
    key: [4, 58],
    l1: [62, 112],
    l2: [126, 176],
    l3: [190, 240],
    l4: [254, 304],
    empty: [58, 98],
    marks: [62, 166],
    shadow: [124, 162],
    expand: [58, 98],
    direct: [58, 98],
    cost: [374, 406],
    psc: [60, 248],
    tlb: [18, 362],
  },
  states: {
    overview: {
      title: { en: 'One shape: a radix tree', zh: '同一个形状：基数树' },
      caption: {
        en: 'A key is cut into fixed-width digits. Each digit picks a slot in one node, and the slot points one level down. An empty slot means no key below it exists, so nothing below it is allocated.',
        zh: '键被切成固定宽度的数位。每个数位在一个节点里选一个槽，槽指向下一层。空槽表示它下面没有任何键，下面也就什么都不用分配。',
      },
    },
    'two-level': {
      title: { en: 'Chapter 20’s two-level table', zh: '第 20 章的两级页表' },
      caption: {
        en: 'The chapter’s 14-bit address 0x3F80: 4 bits pick page-directory entry 15, 4 bits pick entry 14 in that page of the page table, and 6 bits are the offset. Directory entries 1 to 14 are empty, so their 14 page-table pages are never allocated.',
        zh: '本章的 14 位地址 0x3F80：4 位选中页目录第 15 项，4 位选中那一页页表的第 14 项，剩下 6 位是偏移。页目录第 1 到 14 项为空，它们对应的 14 个页表页从未分配。',
      },
    },
    radix: {
      title: { en: 'The same thing, as a tree', zh: '换个说法：一棵树' },
      caption: {
        en: 'Without the hardware words: the root has one slot per digit value (radix 16), and the height is 8 key bits ÷ 4 = 2, however many keys are stored. Every step is a shift, a mask and an array index, so there is nothing to compare and nothing to rebalance.',
        zh: '去掉硬件术语：根节点为数位的每种取值留一个槽（基数 16）；树高是 8 位键 ÷ 4 = 2，与存了多少键无关。每一步都是移位、掩码、取下标，没有比较，也无需再平衡。',
      },
    },
    x86: {
      title: { en: 'x86-64: four 9-bit digits', zh: 'x86-64：四个 9 位数位' },
      caption: {
        en: 'A node is one 4 KiB page of 512 eight-byte entries, so each digit is 9 bits (16 entries of each table are drawn). The stack address 0x7ffde3a45b10 walks entries 255, 503, 285 and 69: four dependent reads before the data.',
        zh: '一个节点就是一页 4 KiB，放 512 个 8 字节表项，所以每个数位 9 位（每张表画出 16 项）。栈地址 0x7ffde3a45b10 依次走过第 255、503、285、69 项：读到数据之前，先有四次彼此依赖的内存读取。',
      },
      demo: {
        label: { en: 'Walk 0x7ffde3a45b10', zh: '走一遍 0x7ffde3a45b10' },
        steps: [
          {
            en: 'Cut the address into digits. Written in binary, 0x7ffde3a45b10 splits into four groups of nine bits, 255, 503, 285 and 69, and a 12-bit offset, 0xb10. Each group is a shift and a mask; nothing is compared.',
            zh: '把地址切成数位。0x7ffde3a45b10 写成二进制，每 9 位一组：255、503、285、69，最后 12 位是偏移 0xb10。取出每一组只需移位和掩码，不做任何比较。',
          },
          {
            en: 'Read 1. A register (CR3 on x86) holds the physical address of this process’s top table, the PGD. The CPU reads its entry 255, which gives the address of a PUD table.',
            zh: '第 1 次读取。一个寄存器（x86 上是 CR3）存着这个进程顶层表 PGD 的物理地址。CPU 读出它的第 255 项，得到一张 PUD 表的地址。',
          },
          {
            en: 'Read 2. Entry 503 of the PUD table gives the address of a PMD table. This read could not start until the first one returned: each level is a dependent read.',
            zh: '第 2 次读取。PUD 表的第 503 项给出一张 PMD 表的地址。上一次读取没回来之前，这一次根本无从开始：每一层都是依赖前一次结果的读取。',
          },
          {
            en: 'Read 3. Entry 285 of the PMD table gives the address of the last table.',
            zh: '第 3 次读取。PMD 表的第 285 项给出最后一张表的地址。',
          },
          {
            en: 'Read 4. Entry 69 is the PTE. It holds the frame number of the 4 KiB physical page, along with bits such as present.',
            zh: '第 4 次读取。第 69 项就是 PTE：它存着那个 4 KiB 物理页的帧号，以及存在位等标志位。',
          },
          {
            en: 'Read 5 is the data itself: the frame plus the offset 0xb10. The TLB keeps the translation of page 0x7ffde3a45, so the next access to this page skips all four table reads.',
            zh: '第 5 次才读到数据本身：物理帧加上偏移 0xb10。TLB 记下页 0x7ffde3a45 的转换，下次访问这一页时，四次读表全部省掉。',
          },
        ],
      },
    },
    sparse: {
      title: { en: 'Paying only for what is used', zh: '只为用到的部分付费' },
      caption: {
        en: 'One isolated 4 KiB page still needs a table at each of the three lower levels: 12 KiB of tables for 4 KiB of data. A dense, aligned 1 GiB region needs 514 table pages, about 0.2%. The cost depends on clustering.',
        zh: '一个孤零零的 4 KiB 页，下面三级仍各要一张表：12 KiB 的页表只为映射 4 KiB 数据。一段对齐的、稠密的 1 GiB 区域需要 514 个页表页，约 0.2%。开销取决于映射是否成簇。',
      },
    },
    huge: {
      title: { en: 'A value in an interior node', zh: '值存在内部节点上' },
      caption: {
        en: 'A PMD entry with the page-size bit set maps a 2 MiB page itself, with no leaf table under it, so the walk ends a level early. Every address that shares its top 27 bits finds it: in routing terms, a route for a /27 prefix.',
        zh: '设置了页大小位的 PMD 项自己就映射一个 2 MiB 的页，下面不再挂叶子表，遍历提前一层结束。凡是高 27 位相同的地址都会找到它：用路由的话说，这是一条 /27 前缀的路由。',
      },
    },
    pagecache: {
      title: { en: 'The page cache: a tree per file', zh: '页缓存：每个文件一棵树' },
      caption: {
        en: 'Byte 10,000,000 of a file is in page 2,441. With 64-slot nodes (16 drawn), its 6-bit digits are 38 and 9, and the slot they reach points to the cached page, if there is one.',
        zh: '文件的第 10,000,000 个字节在第 2,441 页。节点有 64 个槽（画出 16 个），6 位一个数位，得到 38 和 9；走到的那个槽指向缓存着的页（如果有的话）。',
      },
    },
    xarray: {
      title: { en: 'Marks: summary bits', zh: '标记：摘要位' },
      caption: {
        en: 'Entries can carry marks such as dirty. Each interior node keeps, per mark, a bit for each child saying whether anything below it is marked, so a search for dirty pages skips every subtree whose bit is clear.',
        zh: '表项可以带标记，比如“脏”。每个内部节点按标记为每个子节点各存一位，表示它下面有没有被标记的项；于是查找脏页时，位为零的子树整棵跳过。',
      },
    },
    shadow: {
      title: { en: 'Slots that hold values', zh: '槽里存的是值' },
      caption: {
        en: 'A slot can hold a small integer instead of a pointer. When the page cache evicts a page, it leaves a shadow entry in the slot recording when that happened, so a quick re-read shows the eviction was a mistake.',
        zh: '槽里可以放一个小整数而不是指针。页缓存淘汰一页时，在它的槽里留下一个影子表项，记下淘汰发生的时间；如果这一页很快又被读回来，就说明这次淘汰错了。',
      },
    },
    lpm: {
      title: { en: 'Routing: longest prefix wins', zh: '路由：最长前缀胜出' },
      caption: {
        en: 'A router walks the destination 10.1.2.3 down a trie and remembers the last route it passed: 10.0.0.0/8, then 10.1.2.0/24, the longest match. Drawn with 8-bit digits for simplicity; Linux’s LC-trie picks each node’s width from the data.',
        zh: '路由器沿字典树向下走目的地址 10.1.2.3，记住途经的最后一条路由：先是 10.0.0.0/8，再是 10.1.2.0/24，也就是最长匹配。为简单起见按 8 位一个数位来画；Linux 的 LC-trie 会按数据为每个节点挑选宽度。',
      },
    },
    dir24: {
      title: { en: 'DIR-24-8: a two-level table', zh: 'DIR-24-8：两级表' },
      caption: {
        en: 'tbl24 is indexed by the top 24 bits. An entry holds either the next hop, ending the lookup after one read like a huge page, or a tbl8 group indexed by the last 8 bits. A route shorter than 24 bits is copied into every slot it covers (only a few slots are drawn).',
        zh: 'tbl24 用高 24 位索引。一项要么直接存下一跳，像大页一样一次读取就结束查找；要么指向一个用最后 8 位索引的 tbl8 组。短于 24 位的路由被复制到它覆盖的每个槽里（图中只画出少数几个槽）。',
      },
    },
    inode: {
      title: { en: 'File blocks: the inode', zh: '文件块：inode' },
      caption: {
        en: 'An inode holds a few direct block pointers, then single, double and triple indirect ones: a radix tree over block numbers whose depth grows with the offset. With 4 KB blocks, each indirect block holds 1,024 pointers.',
        zh: 'inode 先放几个直接块指针，再放一级、二级、三级间接指针：这是一棵以块号为键、深度随偏移增长的基数树。4 KB 的块里，每个间接块放 1,024 个指针。',
      },
    },
    depth: {
      title: { en: 'Depth is the price', zh: '深度就是代价' },
      caption: {
        en: 'Each level is a dependent memory read: the next table’s address is not known until this one is read. The TLB lets most accesses skip the walk, and paging-structure caches let a miss restart near the bottom.',
        zh: '每一层都是一次依赖前一次结果的内存读取：不读这一层，就不知道下一张表在哪里。TLB 让大多数访问完全不必遍历，分页结构缓存让未命中时可以从靠近底部的地方重新开始。',
      },
    },
  },
  terms: {
    'radix-tree': ['key', 'l1', 'l2'],
    trie: ['l1', 'l2'],
    xarray: ['l1', 'l2'],
    writeback: ['marks'],
    'shadow-entry': ['shadow'],
    'ip-prefix': ['key'],
    'longest-prefix-match': ['l1', 'l2', 'l3'],
    'forwarding-table': ['l1', 'l2', 'l3'],
    'lc-trie': ['l1', 'l2', 'l3'],
    dpdk: ['l1', 'l2'],
    inode: ['l1', 'l2', 'l3', 'direct'],
  },
}

export default scene
