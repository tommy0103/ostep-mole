import type { Term } from './index'

/** Terms of “A multi-level page table is a radix tree” (and the memory notes that follow it). */
const terms: Record<string, Term> = {
  'radix-tree': {
    title: { en: 'Radix tree', zh: '基数树' },
    body: {
      en: 'A tree for integer keys that cuts each key into fixed-width digits. Each node is an array with one slot per digit value, and each digit picks the slot to follow one level down, so a lookup is a few array indexings and never a comparison. An empty slot near the top stands for a whole range of keys that do not exist; a multi-level [[page-table|page table]] is a radix tree.',
      zh: '一种以整数为键的树：把键切成固定宽度的数位，每个节点是一个数组，数位的每种取值占一个槽，每个数位选出往下一层走的那个槽。所以一次查找就是几次数组取下标，从不做比较。靠近顶层的一个空槽代表一整段不存在的键；多级[[page-table|页表]]就是一棵基数树。',
    },
    chapter: 'vm-smalltables',
    note: 'radix-trees',
  },
  trie: {
    title: { en: 'Trie', zh: '字典树（trie）' },
    body: {
      en: 'A search tree in which a key is not stored whole in one node but spelled out along a path: each level takes the next piece of the key, a letter, a bit or a group of bits, and picks the child for it. Keys that share a prefix share the path to it. The name comes from re*trie*val.',
      zh: '一种搜索树：键不是整个存放在某个节点里，而是沿一条路径“拼”出来——每一层取键的下一段（一个字母、一位或几位）来选子节点。前缀相同的键共用通向这段前缀的路径。名字取自 re*trie*val（检索）。',
    },
  },
  'page-cache': {
    title: { en: 'Page cache', zh: '页缓存（page cache）' },
    body: {
      en: 'The kernel’s in-memory copy of file contents, in page-sized pieces, so that reading a file again does not go to the disk. Writes land in it first and reach the disk later. Linux indexes each file’s cached pages with a [[radix-tree|radix tree]], today behind the [[xarray|XArray]] interface.',
      zh: '内核在内存里保存的文件内容副本，按页大小分块，这样再次读同一个文件就不必去读磁盘。写入也先落到这里，稍后才到达磁盘。Linux 用一棵[[radix-tree|基数树]]为每个文件的缓存页建索引，如今套着 [[xarray|XArray]] 的接口。',
    },
    chapter: 'vm-complete',
  },
  xarray: {
    title: { en: 'XArray', zh: 'XArray' },
    body: {
      en: 'The Linux kernel’s array-like interface to its [[radix-tree|radix tree]], merged for Linux 4.20 in 2018: store an entry at an integer index, load it back, find the next present entry after an index. Its most important user is the page cache, which keeps one per file.',
      zh: 'Linux 内核给它的[[radix-tree|基数树]]套上的数组式接口，2018 年随 Linux 4.20 合入：按整数下标存一个表项、按下标取回、找某个下标之后的下一个有效项。它最重要的用户是页缓存，每个文件一个。',
    },
    note: 'radix-trees',
  },
  riscv: {
    title: { en: 'RISC-V', zh: 'RISC-V' },
    body: {
      en: 'An open instruction-set architecture: a specification of a processor’s instructions that anyone may implement without paying a licence fee. Its page-table formats are named after the virtual-address width they translate: Sv39, Sv48 and Sv57.',
      zh: '一套开放的指令集架构：对处理器指令的规范，任何人都可以实现，无需支付授权费。它的页表格式按所转换的虚拟地址宽度命名：Sv39、Sv48、Sv57。',
    },
  },
  writeback: {
    title: { en: 'Dirty pages and writeback', zh: '脏页与回写' },
    body: {
      en: 'A cached page that has been changed in memory but not yet on disk is *dirty*. Writeback is the kernel writing such pages to the disk later, in the background or when asked to; after that they are clean again and can be dropped from memory at no cost.',
      zh: '在内存里被改过、还没写到磁盘上的缓存页是*脏*的。回写（writeback）就是内核稍后把这些页写回磁盘，或在后台进行，或应要求进行；写完之后它们又是干净的，可以随时从内存里丢掉，不费任何代价。',
    },
    chapter: 'vm-beyondphys-policy',
  },
  'shadow-entry': {
    title: { en: 'Shadow entry', zh: '影子表项（shadow entry）' },
    body: {
      en: 'What Linux leaves in a file’s [[page-cache|page cache]] slot when it evicts the page: a small number instead of a pointer, recording when the eviction happened. If the page is read back soon, the kernel can work out how many other pages were evicted in between, and tell that this page should have stayed.',
      zh: 'Linux 淘汰一个文件页时，在它于[[page-cache|页缓存]]中的槽位里留下的东西：一个小数字而不是指针，记下淘汰发生的时间。如果这一页很快又被读回来，内核就能算出其间又淘汰了多少别的页，从而知道这一页本该留下。',
    },
    note: 'approx-lru',
  },
  zswap: {
    title: { en: 'zswap', zh: 'zswap' },
    body: {
      en: 'A compressed cache in front of a Linux [[swap|swap]] device, merged in Linux 3.11 (2013). A page on its way out to swap is compressed and kept in a RAM pool instead; only when the pool is full are its oldest entries written to the real device.',
      zh: '架在 Linux [[swap|交换]]设备前面的一层压缩缓存，2013 年随 Linux 3.11 合入。正要被换出的页先被压缩，留在内存里的一个池子中；只有池子满了，最老的条目才被写到真正的设备上。',
    },
    note: 'zram-oom',
  },
  'ip-prefix': {
    title: { en: 'IP prefix (10.0.0.0/8)', zh: 'IP 前缀（10.0.0.0/8）' },
    body: {
      en: 'A block of addresses written as an address and a length. An IPv4 address is 32 bits, and 10.0.0.0/8 means every address whose first 8 bits are those of 10.0.0.0, about 16.8 million addresses; a /24 covers 256 addresses and a /32 just one.',
      zh: '用“地址/长度”表示的一段地址。IPv4 地址是 32 位，10.0.0.0/8 指前 8 位与 10.0.0.0 相同的所有地址，约 1,680 万个；一个 /24 覆盖 256 个地址，/32 只有一个。',
    },
  },
  'longest-prefix-match': {
    title: { en: 'Longest-prefix match', zh: '最长前缀匹配' },
    body: {
      en: 'The rule routers use to pick a route: of all the [[ip-prefix|prefixes]] in the table that match a packet’s destination, the longest, most specific one wins. A packet for 10.1.2.3 matches both 10.0.0.0/8 and 10.1.2.0/24, and follows the /24.',
      zh: '路由器选路的规则：表中与分组目的地址匹配的所有[[ip-prefix|前缀]]里，最长、最具体的那条胜出。发往 10.1.2.3 的分组同时匹配 10.0.0.0/8 和 10.1.2.0/24，走的是 /24 那条。',
    },
  },
  'forwarding-table': {
    title: { en: 'Forwarding table', zh: '转发表' },
    body: {
      en: 'The table a router consults for every packet. It maps [[ip-prefix|prefixes]] of destination addresses to a next hop: the neighbouring router, or the interface, the packet is sent on to. In the Linux kernel it is called the FIB, the forwarding information base.',
      zh: '路由器对每个分组都要查的那张表：把目的地址的[[ip-prefix|前缀]]映射到下一跳，即分组接下来要交给的相邻路由器或网络接口。在 Linux 内核里它叫 FIB（forwarding information base，转发信息库）。',
    },
  },
  'lc-trie': {
    title: { en: 'LC-trie', zh: 'LC-trie' },
    body: {
      en: 'A level- and path-compressed [[trie|trie]] for IP lookups, from Nilsson and Karlsson (1999). Level compression replaces several levels of a binary trie with one node indexed by several bits at once; path compression skips bits that every key below a node shares. Linux’s IPv4 [[forwarding-table|forwarding table]] is one.',
      zh: '一种做了层压缩和路径压缩的[[trie|字典树]]，用于 IP 查找，出自 Nilsson 和 Karlsson（1999）。层压缩把二叉字典树的若干层合并成一个一次用好几位来索引的节点；路径压缩跳过某个节点之下所有键共有的那些位。Linux 的 IPv4 [[forwarding-table|转发表]]就是一棵 LC-trie。',
    },
  },
  dpdk: {
    title: { en: 'DPDK', zh: 'DPDK' },
    body: {
      en: 'The Data Plane Development Kit: libraries for processing network packets at high rates in user space, bypassing the kernel’s network stack. Software routers and load balancers are built on it.',
      zh: 'Data Plane Development Kit（数据平面开发套件）：一组在用户态高速处理网络分组的库，绕过内核的网络协议栈。软件路由器、负载均衡器常建立在它之上。',
    },
  },
  inode: {
    title: { en: 'Inode', zh: 'inode（索引节点）' },
    body: {
      en: 'The record a Unix file system keeps for each file: its size, owner, permissions and where its data blocks are. A few block pointers sit in the inode itself; a larger file adds indirect blocks, blocks full of further pointers. Part III of the book covers them.',
      zh: 'Unix 文件系统为每个文件保存的记录：大小、属主、权限，以及数据块在哪里。几个块指针直接放在 inode 里；文件更大时再加上间接块，也就是装满更多指针的块。本书第三部分会讲到它。',
    },
  },
  'persistent-vector': {
    title: { en: 'Persistent vector', zh: '持久化向量' },
    body: {
      en: 'An immutable array, such as Clojure’s (Clojure is a Lisp for the Java virtual machine): an update returns a new version and leaves the old one intact. It is a 32-way [[trie|trie]] over element positions, so an update copies only the nodes on one root-to-leaf path and shares the rest.',
      zh: '一种不可变数组，比如 Clojure（运行在 Java 虚拟机上的一种 Lisp）里的向量：更新返回一个新版本，旧版本原封不动。它是一棵以元素位置为键的 32 路[[trie|字典树]]，所以一次更新只复制从根到叶那一条路径上的节点，其余全部共享。',
    },
  },
  'red-black-tree': {
    title: { en: 'Red-black tree', zh: '红黑树' },
    body: {
      en: 'A binary search tree that stays roughly balanced: each node is coloured red or black, and after every insert or delete a few recolourings and rotations restore the colour rules. Lookups and updates take time logarithmic in the number of keys. The Linux kernel uses it in many places.',
      zh: '一种保持大致平衡的二叉搜索树：每个节点涂成红色或黑色，每次插入或删除之后，靠几次改色和旋转恢复颜色规则。查找和更新的时间与键数的对数成正比。Linux 内核里很多地方都用它。',
    },
  },
  'b-tree': {
    title: { en: 'B-tree', zh: 'B 树' },
    body: {
      en: 'A search tree whose nodes each hold many sorted keys, with a child between every two, so the tree is wide and shallow. It was designed for disks, where reading one large node costs about the same as reading a small one; file systems and databases index their data with B-trees.',
      zh: '一种每个节点都存放许多有序键、每两个键之间挂一个子节点的搜索树，因此又宽又矮。它是为磁盘设计的：在磁盘上读一个大节点和读一个小节点代价差不多。文件系统和数据库都用 B 树给数据建索引。',
    },
  },
  'maple-tree': {
    title: { en: 'Maple tree', zh: '枫树（maple tree）' },
    body: {
      en: 'A [[b-tree|B-tree]] type in the Linux kernel, optimized for storing non-overlapping ranges. Since Linux 6.1 it holds each process’s [[vma|memory areas]], its most important use. It can run in a mode that lets readers proceed while a writer changes the tree.',
      zh: 'Linux 内核里一种 [[b-tree|B 树]]，专为存放互不重叠的区间而优化。从 Linux 6.1 起，每个进程的[[vma|内存区域]]都存放在它里面，这是它最重要的用途。它可以运行在一种模式下，让读者在写者修改这棵树的同时继续读取。',
    },
  },
  'nested-paging': {
    title: { en: 'Nested paging', zh: '嵌套分页' },
    body: {
      en: 'How hardware virtualization translates a virtual machine’s memory. The guest OS’s page tables map guest-virtual to guest-physical addresses, and the host’s tables map those to real memory. Every guest table entry the walk reads must itself be translated through the host’s tree, so with four levels on each side a miss can take 24 memory reads.',
      zh: '硬件虚拟化转换虚拟机内存的方式：客户机操作系统的页表把客户机虚拟地址映射到客户机物理地址，宿主机的页表再把后者映射到真实内存。遍历读到的每一个客户机表项，本身都要先经宿主机的树转换，所以两边各四级时，一次未命中最多要 24 次内存读取。',
    },
    note: 'five-level',
  },
  'cache-line': {
    title: { en: 'Cache line', zh: '缓存行' },
    body: {
      en: 'The unit a [[cpu-cache|CPU cache]] stores and moves: a block of consecutive bytes, 64 on most current processors. Reading one byte brings its whole line into the cache, so data that sits together is cheaper to read together.',
      zh: '[[cpu-cache|CPU 缓存]]存放和搬运数据的单位：一块连续的字节，在如今大多数处理器上是 64 字节。读一个字节会把它所在的整行搬进缓存，所以放在一起的数据，一起读更便宜。',
    },
  },
  mglru: {
    title: { en: 'Multi-generational LRU (MGLRU)', zh: '多代 LRU（MGLRU）' },
    body: {
      en: 'Linux’s page-replacement scheme merged for 6.1, which a kernel built with it can switch on or off. Instead of two lists, active and inactive, it sorts pages into a few generations by how recently they were used, and finds used pages by walking page tables for their accessed bits.',
      zh: 'Linux 6.1 合入的页面替换机制；编译进内核后可以开启或关闭。它不再用活跃、非活跃两个链表，而是按最近使用的时间把页分进几“代”，并通过遍历页表、读取访问位来找出被用过的页。',
    },
    chapter: 'vm-beyondphys-policy',
    note: 'approx-lru',
  },
}

export default terms
